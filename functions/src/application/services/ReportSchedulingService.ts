import { FirestoreReportUseCase } from '../../../../shared/usecases/database/FirestoreReportUseCase';
import { NotifyReportUseCase } from '../../../../shared/usecases/notification/NotifyReportUseCase';
import { logger } from '../../../../shared/infrastructure/logging/Logger';
import { DateUtil, DateInfo } from '../../../../shared/utils/DateUtil';
import { ReportNotificationMapper } from '../../../../shared/infrastructure/mappers/ReportNotificationMapper';

/**
 * レポートスケジューリングサービス
 * 定期実行によるレポート送信処理を管理
 */
export class ReportSchedulingService {
    /**
     * コンストラクタ
     * @param reportUseCase レポートユースケース
     * @param notifyReportUseCase 通知レポートユースケース
     */
    constructor(
        private readonly reportUseCase: FirestoreReportUseCase,
        private readonly notifyReportUseCase: NotifyReportUseCase
    ) { }

    /**
     * 日次レポート送信処理
     * @param yesterdayInfo 昨日の日付情報
     */
    async sendDailyReport(yesterdayInfo: DateInfo): Promise<void> {
        try {
            const dailyReport = await this.reportUseCase.getDailyReport(
                yesterdayInfo.year.toString(),
                yesterdayInfo.month.toString().padStart(2, '0'),
                yesterdayInfo.day.toString().padStart(2, '0')
            );

            logger.info(
                `デイリーレポート取得: ${dailyReport.totalAmount}円, ` +
                `件数: ${dailyReport.totalCount}, hasNotified: ${dailyReport.hasNotified}`,
                'Report Scheduling Service'
            );

            // レポートが既に送信済みでない場合のみ送信
            if (!dailyReport.hasNotified) {
                const dailyNotificationDTO = ReportNotificationMapper
                    .toDailyScheduledNotification(
                        dailyReport,
                        yesterdayInfo.year.toString(),
                        yesterdayInfo.month.toString(),
                        yesterdayInfo.day.toString()
                    );

                // 追加情報を設定
                dailyNotificationDTO.additionalInfo = dailyReport.totalCount > 0
                    ? `平均支出: ${Math.round(dailyReport.totalAmount / dailyReport.totalCount).toLocaleString()}円/件`
                    : '利用なし';

                await this.notifyReportUseCase.notifyDailyReport(dailyNotificationDTO);

                // 送信済みフラグを更新
                await this.updateReportSentFlag('daily', yesterdayInfo);

                logger.info('デイリーレポートを送信しました', 'Report Scheduling Service');
            } else {
                logger.info(
                    'デイリーレポートは送信済みのためスキップします',
                    'Report Scheduling Service'
                );
            }
        } catch (error) {
            logger.warn(
                'デイリーレポートが見つかりません。送信をスキップします',
                'Report Scheduling Service'
            );
        }
    }

    /**
     * 週次レポート送信処理
     * @param yesterdayInfo 昨日の日付情報
     */
    async sendWeeklyReport(yesterdayInfo: DateInfo): Promise<void> {
        try {
            const weeklyReport = await this.reportUseCase.getWeeklyReport(
                yesterdayInfo.year.toString(),
                yesterdayInfo.month.toString().padStart(2, '0'),
                yesterdayInfo.term.toString()
            );

            logger.info(
                `週次レポート取得: ${weeklyReport.totalAmount}円, ` +
                `件数: ${weeklyReport.totalCount}, hasReportSent: ${weeklyReport.hasReportSent}`,
                'Report Scheduling Service'
            );

            // レポートが既に送信済みでない場合のみ送信
            if (!weeklyReport.hasReportSent) {
                const weeklyNotificationDTO = ReportNotificationMapper
                    .toWeeklyScheduledNotification(
                        weeklyReport,
                        yesterdayInfo.year.toString(),
                        yesterdayInfo.month.toString(),
                        yesterdayInfo.term
                    );

                // 追加情報を設定
                weeklyNotificationDTO.additionalInfo = weeklyReport.totalCount > 0
                    ? `平均支出: ${Math.round(weeklyReport.totalAmount / weeklyReport.totalCount).toLocaleString()}円/件`
                    : '利用なし';

                await this.notifyReportUseCase.notifyWeeklyReport(weeklyNotificationDTO);

                // 送信済みフラグを更新
                await this.updateReportSentFlag('weekly', yesterdayInfo);

                logger.info('ウィークリーレポートを送信しました', 'Report Scheduling Service');
            } else {
                logger.info(
                    'ウィークリーレポートは送信済みのためスキップします',
                    'Report Scheduling Service'
                );
            }
        } catch (error) {
            logger.warn(
                'ウィークリーレポートが見つかりません。送信をスキップします',
                'Report Scheduling Service'
            );
        }
    }

    /**
     * 月次レポート送信処理
     * @param yesterdayInfo 昨日の日付情報
     */
    async sendMonthlyReport(yesterdayInfo: DateInfo): Promise<void> {
        try {
            const monthlyReport = await this.reportUseCase.getMonthlyReport(
                yesterdayInfo.year.toString(),
                yesterdayInfo.month.toString().padStart(2, '0')
            );

            logger.info(
                `マンスリーレポート取得: ${monthlyReport.totalAmount}円, ` +
                `件数: ${monthlyReport.totalCount}, hasReportSent: ${monthlyReport.hasReportSent}`,
                'Report Scheduling Service'
            );

            // レポートが既に送信済みでない場合のみ送信
            if (!monthlyReport.hasReportSent) {
                const monthlyNotificationDTO = ReportNotificationMapper
                    .toMonthlyScheduledNotification(
                        monthlyReport,
                        yesterdayInfo.year.toString(),
                        yesterdayInfo.month.toString()
                    );

                // 追加情報を設定
                monthlyNotificationDTO.additionalInfo = monthlyReport.totalCount > 0
                    ? `平均支出: ${Math.round(monthlyReport.totalAmount / monthlyReport.totalCount).toLocaleString()}円/件`
                    : '利用なし';

                await this.notifyReportUseCase.notifyMonthlyReport(monthlyNotificationDTO);

                // 送信済みフラグを更新
                await this.updateReportSentFlag('monthly', yesterdayInfo);

                logger.info('マンスリーレポートを送信しました', 'Report Scheduling Service');
            } else {
                logger.info(
                    'マンスリーレポートは送信済みのためスキップします',
                    'Report Scheduling Service'
                );
            }
        } catch (error) {
            logger.warn(
                'マンスリーレポートが見つかりません。送信をスキップします',
                'Report Scheduling Service'
            );
        }
    }

    /**
     * 全体的なスケジュール処理実行
     * dailyReportSchedule関数から呼び出される統合メソッド
     */
    async executeScheduledReports(): Promise<void> {
        logger.info(
            '毎日定期実行: レポート自動送信処理を開始します',
            'Report Scheduling Service'
        );

        // 日本時間の「今日」を取得
        const today = DateUtil.getJSTDate();
        // 「昨日」を計算
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const yesterdayInfo = DateUtil.getDateInfo(yesterday);

        logger.info(
            `処理日: ${yesterdayInfo.year}年${yesterdayInfo.month}月${yesterdayInfo.day}日`,
            'Report Scheduling Service'
        );

        // 1. デイリーレポート送信
        await this.sendDailyReport(yesterdayInfo);

        // 2. 週次レポート処理（週の最終日または月の最終日の場合）
        if (yesterdayInfo.isLastDayOfTerm || yesterdayInfo.isLastDayOfMonth) {
            await this.sendWeeklyReport(yesterdayInfo);
        }

        // 3. 月次レポート処理（月の最終日の場合）
        if (yesterdayInfo.isLastDayOfMonth) {
            await this.sendMonthlyReport(yesterdayInfo);
        }

        logger.info('定期レポート送信処理が完了しました', 'Report Scheduling Service');
    }

    /**
     * レポート送信済みフラグを更新
     * @param reportType レポートタイプ
     * @param dateInfo 日付情報
     */
    private async updateReportSentFlag(
        reportType: 'daily' | 'weekly' | 'monthly',
        dateInfo: DateInfo
    ): Promise<void> {
        let updateData: Record<string, boolean>;
        let updateBy: string;

        switch (reportType) {
            case 'daily':
                updateData = { hasNotified: true };
                updateBy = 'daily-report-schedule';
                await this.reportUseCase.updateDailyReport(
                    {
                        ...updateData,
                        lastUpdatedBy: updateBy,
                    },
                    dateInfo.year.toString(),
                    dateInfo.month.toString().padStart(2, '0'),
                    dateInfo.day.toString().padStart(2, '0')
                );
                break;

            case 'weekly':
                updateData = { hasReportSent: true };
                updateBy = 'weekly-report-schedule';
                await this.reportUseCase.updateWeeklyReport(
                    {
                        ...updateData,
                        lastUpdatedBy: updateBy,
                    },
                    dateInfo.year.toString(),
                    dateInfo.month.toString().padStart(2, '0'),
                    dateInfo.day.toString().padStart(2, '0'),
                );
                break;

            case 'monthly':
                updateData = { hasReportSent: true };
                updateBy = 'monthly-report-schedule';
                await this.reportUseCase.updateMonthlyReport(
                    {
                        ...updateData,
                        lastUpdatedBy: updateBy,
                    },
                    dateInfo.year.toString(),
                    dateInfo.month.toString().padStart(2, '0')
                );
                break;
        }
    }
}
