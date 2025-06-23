import { FirestoreReportUseCase } from '../../../../shared/usecases/database/FirestoreReportUseCase';
import { NotifyReportUseCase } from '../../../../shared/usecases/notification/NotifyReportUseCase';
import { DateUtil } from '../../../../shared/utils/DateUtil';
import { FirestorePathUtil } from '../../../../shared/utils/FirestorePathUtil';
import { DailyReportNotificationDTO, WeeklyReportNotificationDTO, MonthlyReportNotificationDTO } from '../../../../shared/domain/dto/ReportNotificationDTOs';
import { ReportNotificationMapper } from '../../../../shared/infrastructure/mappers/ReportNotificationMapper';

/**
 * レポートスケジューリングサービス
 * 定期実行によるレポート送信処理を管理
 */
export class ReportSchedulingService {
    constructor(
        private readonly reportUseCase: FirestoreReportUseCase,
        private readonly notifyReportUseCase: NotifyReportUseCase
    ) { }

    /**
     * 日次レポート送信処理
     */
    async sendDailyReport(yesterdayInfo: any): Promise<void> {
        try {
            const dailyReport = await this.reportUseCase.getDailyReport(
                yesterdayInfo.year.toString(),
                yesterdayInfo.month.toString().padStart(2, '0'),
                yesterdayInfo.day.toString().padStart(2, '0')
            );

            // レポートが既に送信済みでない場合のみ送信
            if (!dailyReport.hasNotified) {
                const dailyNotificationDTO = ReportNotificationMapper.toDailyScheduledNotification(
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

                console.log('✅ デイリーレポートを送信しました');
            } else {
                console.log('⏭️ デイリーレポートは送信済みのためスキップします');
            }
        } catch (error) {
            console.log('⚠️ デイリーレポートが見つかりません。送信をスキップします');
        }
    }

    /**
     * 週次レポート送信処理
     */
    async sendWeeklyReport(yesterdayInfo: any): Promise<void> {
        try {
            const weeklyReport = await this.reportUseCase.getWeeklyReport(
                yesterdayInfo.year.toString(),
                yesterdayInfo.month.toString().padStart(2, '0'),
                yesterdayInfo.term.toString()
            );

            // レポートが既に送信済みでない場合のみ送信
            if (!weeklyReport.hasReportSent) {
                const weeklyNotificationDTO = ReportNotificationMapper.toWeeklyScheduledNotification(
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

                console.log('✅ ウィークリーレポートを送信しました');
            } else {
                console.log('⏭️ ウィークリーレポートは送信済みのためスキップします');
            }
        } catch (error) {
            console.log('⚠️ ウィークリーレポートが見つかりません。送信をスキップします');
        }
    }

    /**
     * 月次レポート送信処理
     */
    async sendMonthlyReport(yesterdayInfo: any): Promise<void> {
        try {
            const monthlyReport = await this.reportUseCase.getMonthlyReport(
                yesterdayInfo.year.toString(),
                yesterdayInfo.month.toString().padStart(2, '0')
            );

            // レポートが既に送信済みでない場合のみ送信
            if (!monthlyReport.hasReportSent) {
                const monthlyNotificationDTO = ReportNotificationMapper.toMonthlyScheduledNotification(
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

                console.log('✅ マンスリーレポートを送信しました');
            } else {
                console.log('⏭️ マンスリーレポートは送信済みのためスキップします');
            }
        } catch (error) {
            console.log('⚠️ マンスリーレポートが見つかりません。送信をスキップします');
        }
    }

    /**
     * 全体的なスケジュール処理実行
     * dailyReportSchedule関数から呼び出される統合メソッド
     */
    async executeScheduledReports(): Promise<void> {
        console.log('🕛 毎日定期実行: レポート自動送信処理を開始します');

        // 日本時間の「今日」を取得
        const today = DateUtil.getJSTDate();
        // 「昨日」を計算
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const yesterdayInfo = DateUtil.getDateInfo(yesterday);

        console.log(`📅 処理日: ${yesterdayInfo.year}年${yesterdayInfo.month}月${yesterdayInfo.day}日`);

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

        console.log('✅ 定期レポート送信処理が完了しました');
    }

    /**
     * レポート送信済みフラグを更新
     */
    private async updateReportSentFlag(
        reportType: 'daily' | 'weekly' | 'monthly',
        dateInfo: any
    ): Promise<void> {
        let dateObj: Date;
        let pathInfo: any;
        let updateData: any;
        let updateBy: string;

        switch (reportType) {
            case 'daily':
                dateObj = new Date(parseInt(dateInfo.year.toString()), dateInfo.month - 1, dateInfo.day);
                pathInfo = FirestorePathUtil.getFirestorePath(dateObj);
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
                dateObj = new Date(parseInt(dateInfo.year.toString()), dateInfo.month - 1, dateInfo.day);
                pathInfo = FirestorePathUtil.getFirestorePath(dateObj);
                updateData = { hasReportSent: true };
                updateBy = 'weekly-report-schedule';
                await this.reportUseCase.updateWeeklyReport(
                    {
                        ...updateData,
                        lastUpdatedBy: updateBy,
                    },
                    dateInfo.year.toString(),
                    dateInfo.month.toString().padStart(2, '0'),
                    pathInfo.weekNumber.toString()
                );
                break;

            case 'monthly':
                dateObj = new Date(parseInt(dateInfo.year.toString()), dateInfo.month - 1, 1);
                pathInfo = FirestorePathUtil.getFirestorePath(dateObj);
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
