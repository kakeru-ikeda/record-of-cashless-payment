import {
  DailyReportNotificationDTO,
  WeeklyReportNotificationDTO,
  MonthlyReportNotificationDTO,
} from '@shared/domain/dto/ReportNotificationDTOs';

/**
 * レポート通知UseCaseのインターフェース
 */
export interface INotifyReportUseCase {
    /**
     * デイリーレポートをDiscordに通知する
     * @param report デイリーレポート通知DTO
     */
    notifyDailyReport(report: DailyReportNotificationDTO): Promise<void>;

    /**
     * ウィークリーレポートをDiscordに通知する
     * @param report ウィークリーレポート通知DTO
     */
    notifyWeeklyReport(report: WeeklyReportNotificationDTO): Promise<void>;

    /**
     * マンスリーレポートをDiscordに通知する
     * @param report マンスリーレポート通知DTO
     */
    notifyMonthlyReport(report: MonthlyReportNotificationDTO): Promise<void>;
}
