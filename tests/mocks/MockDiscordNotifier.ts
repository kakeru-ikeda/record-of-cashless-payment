import { CardUsageNotification } from '../../shared/types/CardUsageNotification';
import { WeeklyReportNotification } from '../../shared/types/WeeklyReportNotification';
import { DiscordNotifier } from '../../shared/discord/DiscordNotifier';

/**
 * Discord通知のモッククラス
 */
export class MockDiscordNotifier implements DiscordNotifier {
    private notifications: CardUsageNotification[] = [];
    private weeklyReportNotifications: WeeklyReportNotification[] = [];
    private shouldFail: boolean = false;

    /**
     * コンストラクタ
     */
    constructor() {
        this.notifications = [];
        this.weeklyReportNotifications = [];
        this.shouldFail = false;
    }

    /**
     * 通知を送信する
     * @param data カード利用情報
     * @returns 成功時はtrue、失敗時はfalse
     */
    async notify(data: CardUsageNotification): Promise<boolean> {
        if (this.shouldFail) {
            throw new Error('Discord通知の送信に失敗しました（モック）');
        }
        this.notifications.push({ ...data });
        return true;
    }

    /**
     * 週次レポートを通知する
     * @param data 週次レポート情報
     * @returns 成功時はtrue、失敗時はfalse
     */
    async notifyWeeklyReport(data: WeeklyReportNotification): Promise<boolean> {
        if (this.shouldFail) {
            throw new Error('週次レポート通知の送信に失敗しました（モック）');
        }
        this.weeklyReportNotifications.push({ ...data });
        return true;
    }

    /**
     * 全ての通知を取得する
     * @returns 通知の配列
     */
    getNotifications(): CardUsageNotification[] {
        return [...this.notifications];
    }

    /**
     * 全ての週次レポート通知を取得する
     * @returns 週次レポート通知の配列
     */
    getWeeklyReportNotifications(): WeeklyReportNotification[] {
        return [...this.weeklyReportNotifications];
    }

    /**
     * 最後に送信された通知を取得する
     * @returns 最後の通知またはundefined
     */
    getLastNotification(): CardUsageNotification | undefined {
        return this.notifications[this.notifications.length - 1];
    }

    /**
     * 最後に送信された週次レポート通知を取得する
     * @returns 最後の週次レポート通知またはundefined
     */
    getLastWeeklyReportNotification(): WeeklyReportNotification | undefined {
        return this.weeklyReportNotifications[this.weeklyReportNotifications.length - 1];
    }

    /**
     * 失敗フラグを設定する
     * @param fail 失敗するかどうか
     */
    setShouldFail(fail: boolean): void {
        this.shouldFail = fail;
    }

    /**
     * 通知履歴をクリアする
     */
    clear(): void {
        this.notifications = [];
        this.weeklyReportNotifications = [];
    }
}
