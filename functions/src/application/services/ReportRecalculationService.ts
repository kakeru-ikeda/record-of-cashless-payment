import { FirestoreReportUseCase } from '../../../../shared/usecases/database/FirestoreReportUseCase';
import { FirestorePathUtil } from '../../../../shared/utils/FirestorePathUtil';
import {
    DailyReportFactory,
    WeeklyReportFactory,
    MonthlyReportFactory,
} from '../../../../shared/domain/factories/ReportsFactory';
import { DailyReport, WeeklyReport, MonthlyReport } from '../../../../shared/domain/entities/Reports';
import { CardUsageDocument } from '../../domain/entities/ReportRecalculation';
import { logger } from '../../../../shared/infrastructure/logging/Logger';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';

/**
 * レポート再集計サービス
 * カード利用データからレポートを完全に再構築する
 */
export class ReportRecalculationService {
    private readonly serviceContext = 'Report Recalculation Service';

    constructor(
        private readonly reportUseCase: FirestoreReportUseCase
    ) { }

    /**
     * デイリーレポートを再集計
     * @param cardUsageDocuments カード利用データのリスト
     * @param executedBy 実行者
     * @returns 作成されたレポート数
     */
    async recalculateDailyReports(
        cardUsageDocuments: CardUsageDocument[],
        executedBy: string
    ): Promise<{ created: number; updated: number }> {
        const stats = { created: 0, updated: 0 };

        // 日付ごとにグループ化
        const groupedByDate = this.groupByDate(cardUsageDocuments);

        for (const [dateKey, documents] of groupedByDate.entries()) {
            const [year, month, day] = dateKey.split('-');

            try {
                // 既存レポートを取得
                const existingReport = await this.reportUseCase
                    .getDailyReport(year, month, day)
                    .catch(() => null);

                // データから新しいレポートを構築
                const totalAmount = documents.reduce((sum, doc) => sum + doc.data.amount, 0);
                const totalCount = documents.length;
                const documentIdList = documents.map((doc) => doc.path);
                const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

                const report: DailyReport = DailyReportFactory.create(
                    dateObj.toISOString(),
                    totalAmount,
                    totalCount,
                    executedBy,
                    documentIdList,
                    existingReport?.hasNotified || false
                );

                if (existingReport) {
                    // 既存レポートを上書き
                    await this.reportUseCase.updateDailyReport(report, year, month, day);
                    stats.updated++;
                    logger.info(`デイリーレポート更新: ${dateKey}`, this.serviceContext);
                } else {
                    // 新規作成
                    await this.reportUseCase.createDailyReport(report, year, month, day);
                    stats.created++;
                    logger.info(`デイリーレポート作成: ${dateKey}`, this.serviceContext);
                }
            } catch (error) {
                throw new AppError(
                    `デイリーレポート再集計エラー: ${dateKey}`,
                    ErrorType.GENERAL,
                    { dateKey, documentCount: documents.length },
                    error instanceof Error ? error : undefined
                );
            }
        }

        return stats;
    }

    /**
     * ウィークリーレポートを再集計
     * @param cardUsageDocuments カード利用データのリスト
     * @param executedBy 実行者
     * @returns 作成されたレポート数
     */
    async recalculateWeeklyReports(
        cardUsageDocuments: CardUsageDocument[],
        executedBy: string
    ): Promise<{ created: number; updated: number }> {
        const stats = { created: 0, updated: 0 };

        // 週ごとにグループ化
        const groupedByWeek = this.groupByWeek(cardUsageDocuments);

        for (const [weekKey, documents] of groupedByWeek.entries()) {
            const [year, month, term] = weekKey.split('-');

            try {
                // 既存レポートを取得
                const existingReport = await this.reportUseCase
                    .getWeeklyReport(year, month, term)
                    .catch(() => null);

                // 期間の開始日と終了日を計算（最初のドキュメントから取得）
                const firstDoc = documents[0];
                const dateObj = new Date(
                    parseInt(firstDoc.params.year),
                    parseInt(firstDoc.params.month) - 1,
                    parseInt(firstDoc.params.day)
                );
                const pathInfo = FirestorePathUtil.getFirestorePath(dateObj);

                // データから新しいレポートを構築
                const totalAmount = documents.reduce((sum, doc) => sum + doc.data.amount, 0);
                const totalCount = documents.length;
                const documentIdList = documents.map((doc) => doc.path);

                const report: WeeklyReport = WeeklyReportFactory.create(
                    pathInfo.weekStartDate.toISOString(),
                    pathInfo.weekEndDate.toISOString(),
                    totalAmount,
                    totalCount,
                    executedBy,
                    documentIdList,
                    existingReport?.hasNotifiedLevel1 || false,
                    existingReport?.hasNotifiedLevel2 || false,
                    existingReport?.hasNotifiedLevel3 || false,
                    existingReport?.hasReportSent || false
                );

                if (existingReport) {
                    // 既存レポートを上書き
                    await this.reportUseCase.updateWeeklyReport(report, year, month, term);
                    stats.updated++;
                    logger.info(`ウィークリーレポート更新: ${weekKey}`, this.serviceContext);
                } else {
                    // 新規作成
                    await this.reportUseCase.createWeeklyReport(report, year, month, term);
                    stats.created++;
                    logger.info(`ウィークリーレポート作成: ${weekKey}`, this.serviceContext);
                }
            } catch (error) {
                throw new AppError(
                    `ウィークリーレポート再集計エラー: ${weekKey}`,
                    ErrorType.GENERAL,
                    { weekKey, documentCount: documents.length },
                    error instanceof Error ? error : undefined
                );
            }
        }

        return stats;
    }

    /**
     * マンスリーレポートを再集計
     * @param cardUsageDocuments カード利用データのリスト
     * @param executedBy 実行者
     * @returns 作成されたレポート数
     */
    async recalculateMonthlyReports(
        cardUsageDocuments: CardUsageDocument[],
        executedBy: string
    ): Promise<{ created: number; updated: number }> {
        const stats = { created: 0, updated: 0 };

        // 月ごとにグループ化
        const groupedByMonth = this.groupByMonth(cardUsageDocuments);

        for (const [monthKey, documents] of groupedByMonth.entries()) {
            const [year, month] = monthKey.split('-');

            try {
                // 既存レポートを取得
                const existingReport = await this.reportUseCase
                    .getMonthlyReport(year, month)
                    .catch(() => null);

                // 期間の開始日と終了日を計算
                const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                const endDate = new Date(parseInt(year), parseInt(month), 0);

                // データから新しいレポートを構築
                const totalAmount = documents.reduce((sum, doc) => sum + doc.data.amount, 0);
                const totalCount = documents.length;
                const documentIdList = documents.map((doc) => doc.path);

                const report: MonthlyReport = MonthlyReportFactory.create(
                    startDate.toISOString(),
                    endDate.toISOString(),
                    totalAmount,
                    totalCount,
                    executedBy,
                    documentIdList,
                    existingReport?.hasNotifiedLevel1 || false,
                    existingReport?.hasNotifiedLevel2 || false,
                    existingReport?.hasNotifiedLevel3 || false,
                    existingReport?.hasReportSent || false
                );

                if (existingReport) {
                    // 既存レポートを上書き
                    await this.reportUseCase.updateMonthlyReport(report, year, month);
                    stats.updated++;
                    logger.info(`マンスリーレポート更新: ${monthKey}`, this.serviceContext);
                } else {
                    // 新規作成
                    await this.reportUseCase.createMonthlyReport(report, year, month);
                    stats.created++;
                    logger.info(`マンスリーレポート作成: ${monthKey}`, this.serviceContext);
                }
            } catch (error) {
                throw new AppError(
                    `マンスリーレポート再集計エラー: ${monthKey}`,
                    ErrorType.GENERAL,
                    { monthKey, documentCount: documents.length },
                    error instanceof Error ? error : undefined
                );
            }
        }

        return stats;
    }

    /**
     * カード利用データを日付ごとにグループ化
     */
    private groupByDate(
        documents: CardUsageDocument[]
    ): Map<string, CardUsageDocument[]> {
        const grouped = new Map<string, CardUsageDocument[]>();

        for (const doc of documents) {
            /* eslint-disable-next-line */
            const dateKey = `${doc.params.year}-${doc.params.month.padStart(2, '0')}-${doc.params.day.padStart(2, '0')}`;
            const existing = grouped.get(dateKey) || [];
            existing.push(doc);
            grouped.set(dateKey, existing);
        }

        return grouped;
    }

    /**
     * カード利用データを週ごとにグループ化
     */
    private groupByWeek(documents: CardUsageDocument[]): Map<string, CardUsageDocument[]> {
        const grouped = new Map<string, CardUsageDocument[]>();

        for (const doc of documents) {
            // doc.params.termは "term1", "term2" のような形式なので、
            // "term"プレフィックスを除去して数字のみを取得
            const termNumber = doc.params.term.replace('term', '');
            const weekKey = `${doc.params.year}-${doc.params.month.padStart(2, '0')}-${termNumber}`;
            const existing = grouped.get(weekKey) || [];
            existing.push(doc);
            grouped.set(weekKey, existing);
        }

        return grouped;
    }

    /**
     * カード利用データを月ごとにグループ化
     */
    private groupByMonth(documents: CardUsageDocument[]): Map<string, CardUsageDocument[]> {
        const grouped = new Map<string, CardUsageDocument[]>();

        for (const doc of documents) {
            const monthKey = `${doc.params.year}-${doc.params.month.padStart(2, '0')}`;
            const existing = grouped.get(monthKey) || [];
            existing.push(doc);
            grouped.set(monthKey, existing);
        }

        return grouped;
    }
}
