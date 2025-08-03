import * as functions from 'firebase-functions';
import { IDiscordNotifier } from '../../../../shared/domain/interfaces/discord/IDiscordNotifier';
import { FirestoreReportUseCase } from '../../../../shared/usecases/database/FirestoreReportUseCase';
import { logger } from '../../../../shared/infrastructure/logging/Logger';
import { FirestorePathUtil } from '../../../../shared/utils/FirestorePathUtil';
import {
    DailyReportFactory,
    WeeklyReportFactory,
    MonthlyReportFactory,
} from '../../../../shared/domain/factories/ReportsFactory';
import { DailyReport, WeeklyReport, MonthlyReport } from '../../../../shared/domain/entities/Reports';
import { ReportNotificationMapper } from '../../../../shared/infrastructure/mappers/ReportNotificationMapper';
import {
    REPORT_THRESHOLDS,
    ThresholdLevel,
    ReportType,
} from '../../domain/constants/ReportThresholds';

/**
 * レポート処理サービス
 * 各種レポート（日次・週次・月次）の作成・更新とアラート処理を行う
 */
export class ReportProcessingService {
    /**
     * コンストラクタ
     * @param discordNotifier Discord通知サービス
     * @param reportUseCase レポートユースケース
     */
    constructor(
        private readonly discordNotifier: IDiscordNotifier,
        private readonly reportUseCase: FirestoreReportUseCase
    ) { }

    /**
     * デイリーレポート処理
     * @param document Firestoreドキュメント
     * @param data カード利用データ
     * @param params パラメータ（年、月、日）
     * @returns 処理されたデイリーレポート
     */
    async processDailyReport(
        document: functions.firestore.DocumentSnapshot,
        data: { amount: number },
        params: Record<string, string>
    ): Promise<DailyReport> {
        const { year, month, day } = params;

        // ドキュメントのフルパスを生成
        const documentFullPath = document.ref.path;

        // 既存のデイリーレポートを取得（存在チェック）
        const existingReport = await this.reportUseCase
            .getDailyReport(year, month.padStart(2, '0'), day.padStart(2, '0'))
            .catch(() => null);

        if (existingReport) {
            // 既存レポート更新 - ファクトリーを使用
            const updatedReport = DailyReportFactory.reconstruct({
                ...existingReport,
                totalAmount: existingReport.totalAmount + data.amount,
                totalCount: existingReport.totalCount + 1,
                lastUpdatedBy: 'system',
                documentIdList: [...existingReport.documentIdList, documentFullPath],
            });

            await this.reportUseCase.updateDailyReport(
                updatedReport,
                year,
                month.padStart(2, '0'),
                day.padStart(2, '0')
            );
            logger.info(
                `デイリーレポート更新完了: ${year}年${month}月${day}日`,
                'Report Processing Service'
            );

            return updatedReport;
        } else {
            // レポートが存在しない場合は新規作成
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            const dailyReport = DailyReportFactory.create(
                dateObj.toISOString(),
                data.amount,
                1,
                'system',
                [documentFullPath]
            );

            await this.reportUseCase.createDailyReport(dailyReport, year, month.padStart(2, '0'), day.padStart(2, '0'));
            logger.info(`デイリーレポート作成完了: ${year}年${month}月${day}日`, 'Report Processing Service');

            return dailyReport;
        }
    }

    /**
     * ウィークリーレポート処理
     * @param document Firestoreドキュメント
     * @param data カード利用データ
     * @param params パラメータ（年、月、日）
     * @returns 処理されたウィークリーレポート
     */
    async processWeeklyReport(
        document: functions.firestore.DocumentSnapshot,
        data: { amount: number },
        params: Record<string, string>
    ): Promise<WeeklyReport> {
        const { year, month, day } = params;

        // ドキュメントのフルパスを生成
        const documentFullPath = document.ref.path;

        // DateUtilを使用してパスを取得
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const pathInfo = FirestorePathUtil.getFirestorePath(dateObj);
        const term = pathInfo.weekNumber.toString();

        // 既存の週次レポートを取得（存在チェック）
        const existingReport = await this.reportUseCase
            .getWeeklyReport(year, month.padStart(2, '0'), term)
            .catch(() => null);

        if (existingReport) {
            // 既存レポート更新 - ファクトリーを使用
            const updatedReport = WeeklyReportFactory.reconstruct({
                ...existingReport,
                totalAmount: existingReport.totalAmount + data.amount,
                totalCount: existingReport.totalCount + 1,
                lastUpdatedBy: 'system',
                documentIdList: [...existingReport.documentIdList, documentFullPath],
            });

            await this.reportUseCase.updateWeeklyReport(updatedReport, year, month.padStart(2, '0'), term);
            logger.info(`ウィークリーレポート更新完了: ${year}年${month}月第${term}週`, 'Report Processing Service');

            // アラート条件チェック
            await this.checkAndSendAlert(
                'WEEKLY',
                updatedReport,
                '', // パスは不要（UseCaseで管理）
                { weekNumber: pathInfo.weekNumber, year, month }
            );

            return updatedReport;
        } else {
            // レポートが存在しない場合は新規作成
            const weeklyReport = WeeklyReportFactory.create(
                pathInfo.weekStartDate.toISOString(),
                pathInfo.weekEndDate.toISOString(),
                data.amount,
                1,
                'system',
                [documentFullPath]
            );

            await this.reportUseCase.createWeeklyReport(weeklyReport, year, month, day);
            logger.info(`ウィークリーレポート作成完了: ${year}年${month}月第${term}週`, 'Report Processing Service');

            // アラート条件チェック
            await this.checkAndSendAlert(
                'WEEKLY',
                weeklyReport,
                '',
                { weekNumber: pathInfo.weekNumber, year, month }
            );

            return weeklyReport;
        }
    }

    /**
     * マンスリーレポート処理
     * @param document Firestoreドキュメント
     * @param data カード利用データ
     * @param params パラメータ（年、月）
     * @returns 処理されたマンスリーレポート
     */
    async processMonthlyReport(
        document: functions.firestore.DocumentSnapshot,
        data: { amount: number },
        params: Record<string, string>
    ): Promise<MonthlyReport> {
        const { year, month } = params;

        // ドキュメントのフルパスを生成
        const documentFullPath = document.ref.path;

        // 既存の月次レポートを取得（存在チェック）
        const existingReport = await this.reportUseCase
            .getMonthlyReport(year, month.padStart(2, '0'))
            .catch(() => null);

        if (existingReport) {
            // 既存レポート更新 - ファクトリーを使用
            const updatedReport = MonthlyReportFactory.reconstruct({
                ...existingReport,
                totalAmount: existingReport.totalAmount + data.amount,
                totalCount: existingReport.totalCount + 1,
                lastUpdatedBy: 'system',
                documentIdList: [...existingReport.documentIdList, documentFullPath],
            });

            await this.reportUseCase.updateMonthlyReport(updatedReport, year, month.padStart(2, '0'));
            logger.info(`マンスリーレポート更新完了: ${year}年${month}月`, 'Report Processing Service');

            // アラート条件チェック
            await this.checkAndSendAlert(
                'MONTHLY',
                updatedReport,
                '', // パスは不要（UseCaseで管理）
                { year, month }
            );

            return updatedReport;
        } else {
            // レポートが存在しない場合は新規作成
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(month), 0);

            const monthlyReport = MonthlyReportFactory.create(
                startDate.toISOString(),
                endDate.toISOString(),
                data.amount,
                1,
                'system',
                [documentFullPath]
            );

            await this.reportUseCase.createMonthlyReport(monthlyReport, year, month.padStart(2, '0'));
            logger.info(`マンスリーレポート作成完了: ${year}年${month}月`, 'Report Processing Service');

            // アラート条件チェック
            await this.checkAndSendAlert(
                'MONTHLY',
                monthlyReport,
                '',
                { year, month }
            );

            return monthlyReport;
        }
    }

    /**
     * レポートのアラート条件チェック（統一化）
     */
    private async checkAndSendAlert<T extends WeeklyReport | MonthlyReport>(
        reportType: ReportType,
        report: T,
        reportPath: string, // 現在は使用しない（UseCaseで管理）
        context: { year: string; month: string; weekNumber?: number }
    ): Promise<void> {
        let updated = false;
        let alertLevel: ThresholdLevel | null = null;
        const updatedReport = { ...report };
        const thresholds = REPORT_THRESHOLDS[reportType];

        try {
            // しきい値チェック
            if (report.totalAmount >= thresholds.LEVEL3 && !report.hasNotifiedLevel3) {
                alertLevel = 3;
                updatedReport.hasNotifiedLevel3 = true;
                updated = true;
            } else if (report.totalAmount >= thresholds.LEVEL2 && !report.hasNotifiedLevel2) {
                alertLevel = 2;
                updatedReport.hasNotifiedLevel2 = true;
                updated = true;
            } else if (report.totalAmount >= thresholds.LEVEL1 && !report.hasNotifiedLevel1) {
                alertLevel = 1;
                updatedReport.hasNotifiedLevel1 = true;
                updated = true;
            }

            if (alertLevel !== null) {
                // アラート通知を送信
                await this.sendAlert(reportType, report, alertLevel, context);
            }

            // 通知フラグ更新
            if (updated) {
                const updateData = {
                    hasNotifiedLevel1: updatedReport.hasNotifiedLevel1,
                    hasNotifiedLevel2: updatedReport.hasNotifiedLevel2,
                    hasNotifiedLevel3: updatedReport.hasNotifiedLevel3,
                };

                if (reportType === 'WEEKLY' && context.weekNumber) {
                    await this.reportUseCase.updateWeeklyReport(
                        updateData,
                        context.year,
                        context.month.padStart(2, '0'),
                        context.weekNumber.toString()
                    );
                } else if (reportType === 'MONTHLY') {
                    await this.reportUseCase.updateMonthlyReport(
                        updateData,
                        context.year,
                        context.month.padStart(2, '0')
                    );
                }
            }
        } catch (error) {
            logger.error(error as Error, 'Report Processing Service');
        }
    }

    /**
     * アラート通知送信
     */
    private async sendAlert<T extends WeeklyReport | MonthlyReport>(
        reportType: ReportType,
        report: T,
        alertLevel: ThresholdLevel,
        context: { year: string; month: string; weekNumber?: number }
    ): Promise<void> {
        const thresholds = REPORT_THRESHOLDS[reportType];
        const thresholdValue = Object.values(thresholds)[alertLevel - 1];

        if (reportType === 'WEEKLY' && 'termStartDate' in report && context.weekNumber) {
            const alertNotification = ReportNotificationMapper.toWeeklyAlertNotification(
                report,
                alertLevel,
                context.year,
                context.month,
                context.weekNumber,
                thresholdValue
            );

            await this.discordNotifier.notifyWeeklyReport(alertNotification);
            logger.info(`ウィークリーアラートレベル${alertLevel}を送信しました`, 'Report Processing Service');
        } else if (reportType === 'MONTHLY' && 'monthStartDate' in report) {
            const alertNotification = ReportNotificationMapper.toMonthlyAlertNotification(
                report,
                alertLevel,
                context.year,
                context.month,
                thresholdValue
            );

            await this.discordNotifier.notifyMonthlyReport(alertNotification);
            logger.info(`マンスリーアラートレベル${alertLevel}を送信しました`, 'Report Processing Service');
        }
    }
}
