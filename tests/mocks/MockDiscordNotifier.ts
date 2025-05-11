import { CardUsageNotification } from '../../shared/types/CardUsageNotification';
import { WeeklyReportNotification, DailyReportNotification, MonthlyReportNotification } from '../../shared/types/reports/ReportNotifications';
import { DiscordNotifier } from '../../shared/discord/DiscordNotifier';
import { logger } from './Logger';
import { AppError, ErrorType } from '../../shared/errors/AppError';

/**
 * Discord通知のモッククラス
 */
export class MockDiscordNotifier implements DiscordNotifier {
    private notifications: CardUsageNotification[] = [];
    private weeklyReportNotifications: WeeklyReportNotification[] = [];
    private dailyReportNotifications: DailyReportNotification[] = [];
    private monthlyReportNotifications: MonthlyReportNotification[] = [];
    private shouldFail: boolean = false;
    private readonly serviceContext = 'MockDiscordNotifier';

    /**
     * コンストラクタ
     */
    constructor() {
        this.notifications = [];
        this.weeklyReportNotifications = [];
        this.dailyReportNotifications = [];
        this.monthlyReportNotifications = [];
        this.shouldFail = false;
        logger.info('MockDiscordNotifierが初期化されました', this.serviceContext);
    }

    /**
     * 通知を送信する
     * @param data カード利用情報
     * @returns 成功時はtrue、失敗時はfalse
     */
    async notify(data: CardUsageNotification): Promise<boolean> {
        if (this.shouldFail) {
            const error = new Error('Discord通知の送信に失敗しました（モック）');
            const appError = new AppError('カード利用通知の送信に失敗しました', ErrorType.DISCORD, data, error);
            logger.logAppError(appError, this.serviceContext);
            throw error;
        }
        this.notifications.push({ ...data });
        logger.info(`カード利用通知を送信しました: ${data.where_to_use}`, this.serviceContext);
        return true;
    }

    /**
     * 週次レポートを通知する
     * @param data 週次レポート情報
     * @returns 成功時はtrue、失敗時はfalse
     */
    async notifyWeeklyReport(data: WeeklyReportNotification): Promise<boolean> {
        if (this.shouldFail) {
            const error = new Error('週次レポート通知の送信に失敗しました（モック）');
            const appError = new AppError('週次レポート通知の送信に失敗しました', ErrorType.DISCORD, data, error);
            logger.logAppError(appError, this.serviceContext);
            throw error;
        }
        this.weeklyReportNotifications.push({ ...data });
        logger.info(`週次レポート通知を送信しました: ${data.title || '無題'}`, this.serviceContext);
        return true;
    }

    /**
     * 日次レポートを通知する
     * @param data 日次レポート情報
     * @returns 成功時はtrue、失敗時はfalse
     */
    async notifyDailyReport(data: DailyReportNotification): Promise<boolean> {
        if (this.shouldFail) {
            const error = new Error('日次レポート通知の送信に失敗しました（モック）');
            const appError = new AppError('日次レポート通知の送信に失敗しました', ErrorType.DISCORD, data, error);
            logger.logAppError(appError, this.serviceContext);
            throw error;
        }
        this.dailyReportNotifications.push({ ...data });
        logger.info(`日次レポート通知を送信しました: ${data.title || '無題'}`, this.serviceContext);
        return true;
    }

    /**
     * 月次レポートを通知する
     * @param data 月次レポート情報
     * @returns 成功時はtrue、失敗時はfalse
     */
    async notifyMonthlyReport(data: MonthlyReportNotification): Promise<boolean> {
        if (this.shouldFail) {
            const error = new Error('月次レポート通知の送信に失敗しました（モック）');
            const appError = new AppError('月次レポート通知の送信に失敗しました', ErrorType.DISCORD, data, error);
            logger.logAppError(appError, this.serviceContext);
            throw error;
        }
        this.monthlyReportNotifications.push({ ...data });
        logger.info(`月次レポート通知を送信しました: ${data.title || '無題'}`, this.serviceContext);
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
     * 全ての日次レポート通知を取得する
     * @returns 日次レポート通知の配列
     */
    getDailyReportNotifications(): DailyReportNotification[] {
        return [...this.dailyReportNotifications];
    }

    /**
     * 全ての月次レポート通知を取得する
     * @returns 月次レポート通知の配列
     */
    getMonthlyReportNotifications(): MonthlyReportNotification[] {
        return [...this.monthlyReportNotifications];
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
     * 最後に送信された日次レポート通知を取得する
     * @returns 最後の日次レポート通知またはundefined
     */
    getLastDailyReportNotification(): DailyReportNotification | undefined {
        return this.dailyReportNotifications[this.dailyReportNotifications.length - 1];
    }

    /**
     * 最後に送信された月次レポート通知を取得する
     * @returns 最後の月次レポート通知またはundefined
     */
    getLastMonthlyReportNotification(): MonthlyReportNotification | undefined {
        return this.monthlyReportNotifications[this.monthlyReportNotifications.length - 1];
    }

    /**
     * 失敗フラグを設定する
     * @param fail 失敗するかどうか
     */
    setShouldFail(fail: boolean): void {
        this.shouldFail = fail;
        logger.debug(`MockDiscordNotifierの失敗フラグを${fail ? '有効' : '無効'}に設定しました`, this.serviceContext);
    }

    /**
     * 通知履歴をクリアする
     */
    clear(): void {
        this.notifications = [];
        this.weeklyReportNotifications = [];
        this.dailyReportNotifications = [];
        this.monthlyReportNotifications = [];
        logger.debug('MockDiscordNotifierの通知履歴をクリアしました', this.serviceContext);
    }
}
