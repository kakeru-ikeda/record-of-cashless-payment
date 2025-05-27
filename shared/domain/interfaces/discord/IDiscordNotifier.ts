import { CardUsageNotificationDTO } from "@shared/domain/dto/CardUsageNotificationDTO";
import { DailyReportNotification, MonthlyReportNotification, WeeklyReportNotification } from "@shared/domain/entities/ReportNotifications";
import { AppError } from "@shared/errors/AppError";

/**
 * Discordの通知インターフェース
 */
export interface IDiscordNotifier {
    /**
     * カード利用情報を通知する
     * @param data カード利用情報
     * @returns 通知の成功または失敗を表すブール値
     */
    notifyCardUsage(data: CardUsageNotificationDTO): Promise<boolean>;

    /**
     * ウィークリーレポートを通知する
     * @param data ウィークリーレポート情報
     * @returns 通知の成功または失敗を表すブール値
     */
    notifyWeeklyReport(data: WeeklyReportNotification): Promise<boolean>;

    /**
     * デイリーレポートを通知する
     * @param data デイリーレポート情報
     * @returns 通知の成功または失敗を表すブール値
     */
    notifyDailyReport(data: DailyReportNotification): Promise<boolean>;

    /**
     * マンスリーレポートを通知する
     * @param data マンスリーレポート情報
     * @returns 通知の成功または失敗を表すブール値
     */
    notifyMonthlyReport(data: MonthlyReportNotification): Promise<boolean>;

    /**
     * エラー情報を通知する
     * @param error AppErrorオブジェクト
     * @param context エラーが発生したコンテキスト情報
     * @returns 通知の成功または失敗を表すブール値
     */
    notifyError(error: AppError, context?: string): Promise<boolean>;

    /**
     * ログメッセージを通知する
     * @param message 通知するメッセージ文字列
     * @param title メッセージのタイトル（オプション）
     * @param context メッセージのコンテキスト情報（オプション）
     * @returns 通知の成功または失敗を表すブール値
     */
    notifyLogging(message: string, title?: string, context?: string): Promise<boolean>;
}