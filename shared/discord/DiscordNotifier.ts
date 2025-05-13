import axios from 'axios';
import { CardUsageNotification } from '../types/CardUsageNotification';
import {
    WeeklyReportNotification,
    DailyReportNotification,
    MonthlyReportNotification,
} from '../types/reports/ReportNotifications';
import { logger } from '../utils/Logger';
import { AppError, ErrorType } from '../errors/AppError';

/**
 * 通知の種類を表す列挙型
 */
export enum NotificationType {
    USAGE = 'usage',                  // カード利用通知
    ALERT_WEEKLY = 'alert_weekly',    // 週次アラート通知
    ALERT_MONTHLY = 'alert_monthly',  // 月次アラート通知
    REPORT_DAILY = 'report_daily',    // 日次レポート通知
    REPORT_WEEKLY = 'report_weekly',  // 週次レポート通知
    REPORT_MONTHLY = 'report_monthly' // 月次レポート通知
}

/**
 * Discordの通知インターフェース
 */
export interface DiscordNotifier {
    /**
     * カード利用情報を通知する
     * @param data カード利用情報
     * @returns 通知の成功または失敗を表すブール値
     */
    notify(data: CardUsageNotification): Promise<boolean>;

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
}

/**
 * Discordを使用した通知のプレゼンター実装
 */
export class DiscordWebhookNotifier implements DiscordNotifier {
    private readonly serviceContext = 'DiscordNotifier';
    // 各種通知用Webhook URL
    private readonly usageWebhookUrl: string;            // 利用明細通知用
    private readonly alertWeeklyWebhookUrl: string;      // 週次アラート通知用
    private readonly alertMonthlyWebhookUrl: string;     // 月次アラート通知用
    private readonly reportDailyWebhookUrl: string;      // 日次レポート通知用
    private readonly reportWeeklyWebhookUrl: string;     // 週次レポート通知用
    private readonly reportMonthlyWebhookUrl: string;    // 月次レポート通知用

    /**
     * コンストラクタ
     * @param usageWebhookUrl 利用明細通知用のDiscord WebhookのURL
     * @param alertWeeklyWebhookUrl 週次アラート通知用のDiscord WebhookのURL
     * @param alertMonthlyWebhookUrl 月次アラート通知用のDiscord WebhookのURL
     * @param reportDailyWebhookUrl 日次レポート通知用のDiscord WebhookのURL
     * @param reportWeeklyWebhookUrl 週次レポート通知用のDiscord WebhookのURL
     * @param reportMonthlyWebhookUrl 月次レポート通知用のDiscord WebhookのURL
     */
    constructor(
        usageWebhookUrl: string,
        alertWeeklyWebhookUrl?: string,
        alertMonthlyWebhookUrl?: string,
        reportDailyWebhookUrl?: string,
        reportWeeklyWebhookUrl?: string,
        reportMonthlyWebhookUrl?: string
    ) {
        this.usageWebhookUrl = usageWebhookUrl;
        this.alertWeeklyWebhookUrl = alertWeeklyWebhookUrl || usageWebhookUrl;
        this.alertMonthlyWebhookUrl = alertMonthlyWebhookUrl || usageWebhookUrl;
        this.reportDailyWebhookUrl = reportDailyWebhookUrl || usageWebhookUrl;
        this.reportWeeklyWebhookUrl = reportWeeklyWebhookUrl || usageWebhookUrl;
        this.reportMonthlyWebhookUrl = reportMonthlyWebhookUrl || usageWebhookUrl;
    }

    /**
     * 通知タイプに応じたWebhook URLを取得する
     * @param type 通知タイプ
     * @returns 対応するWebhook URL
     */
    private getWebhookUrl(type: NotificationType): string {
        switch (type) {
            case NotificationType.ALERT_WEEKLY:
                return this.alertWeeklyWebhookUrl;
            case NotificationType.ALERT_MONTHLY:
                return this.alertMonthlyWebhookUrl;
            case NotificationType.REPORT_DAILY:
                return this.reportDailyWebhookUrl;
            case NotificationType.REPORT_WEEKLY:
                return this.reportWeeklyWebhookUrl;
            case NotificationType.REPORT_MONTHLY:
                return this.reportMonthlyWebhookUrl;
            case NotificationType.USAGE:
            default:
                return this.usageWebhookUrl;
        }
    }

    /**
     * Discord Webhookを使用して通知を送信する共通メソッド
     * @param webhookUrl 送信先のWebhook URL
     * @param embeds 送信するEmbed配列
     * @param notificationType 通知タイプの説明（ログ用）
     * @returns 成功時はtrue、失敗時はfalse
     */
    private async sendDiscordNotification(
        webhookUrl: string,
        embeds: any[],
        notificationType: string
    ): Promise<boolean> {
        try {
            if (!webhookUrl) {
                logger.warn(`${notificationType}用のDiscord WebhookのURLが設定されていないため、通知はスキップされました`, this.serviceContext);
                return false;
            }

            // WebhookのURLが有効かチェック
            if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
                logger.error(`${notificationType}用のDiscord WebhookのURLが無効です`, null, this.serviceContext);
                return false;
            }

            logger.info(`${notificationType}の通知を送信しています...`, this.serviceContext);

            const response = await axios.post(webhookUrl, { embeds });

            if (response.status === 204 || response.status === 200) {
                logger.info(`${notificationType}の通知を送信しました`, this.serviceContext);
                return true;
            } else {
                const appError = new AppError(
                    `${notificationType}の通知の送信に失敗しました`,
                    ErrorType.DISCORD,
                    { statusCode: response.status }
                );
                logger.logAppError(appError, this.serviceContext);
                return false;
            }
        } catch (error) {
            const appError = new AppError(
                `${notificationType}の通知の送信中にエラーが発生しました`,
                ErrorType.DISCORD,
                { notificationType },
                error instanceof Error ? error : undefined
            );
            logger.logAppError(appError, this.serviceContext);
            return false;
        }
    }

    /**
     * Discord Webhookを使用して利用情報を通知する
     * @param data カード利用情報
     * @returns 通知の成功または失敗を表すブール値
     */
    async notify(data: CardUsageNotification): Promise<boolean> {
        try {
            const webhookUrl = this.getWebhookUrl(NotificationType.USAGE);

            const formattedDate = new Date(data.datetime_of_use).toLocaleString('ja-JP', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            const formattedAmount = data.amount.toLocaleString() + '円';

            const embeds = [
                {
                    title: '利用情報',
                    description: `# ${formattedAmount}\nお支払いが完了しました\n-`,
                    color: 14805795,
                    fields: [
                        {
                            name: '日時',
                            value: formattedDate || '不明',
                            inline: false
                        },
                        {
                            name: '利用先',
                            value: data.where_to_use || '不明',
                            inline: false
                        },
                        {
                            name: 'カード名',
                            value: data.card_name || '不明'
                        }
                    ]
                }
            ];

            return this.sendDiscordNotification(webhookUrl, embeds, 'カード利用');
        } catch (error) {
            const appError = new AppError(
                'Discord通知の送信中にエラーが発生しました',
                ErrorType.DISCORD,
                { notificationType: 'カード利用通知' },
                error instanceof Error ? error : undefined
            );
            logger.logAppError(appError, this.serviceContext);
            return false;
        }
    }

    /**
     * Discord Webhookを使用してウィークリーレポートを通知する
     * @param data ウィークリーレポート情報
     * @returns 通知の成功または失敗を表すブール値
     */
    async notifyWeeklyReport(data: WeeklyReportNotification): Promise<boolean> {
        try {
            // アラートレベルが0より大きいならアラート通知、それ以外は定期レポート
            const notificationType = data.alertLevel > 0 ? NotificationType.ALERT_WEEKLY : NotificationType.REPORT_WEEKLY;
            const webhookUrl = this.getWebhookUrl(notificationType);

            const formattedAmount = data.totalAmount.toLocaleString() + '円';

            // アラートレベルに応じた色とアイコンを設定
            let color: number;
            let alertIcon: string;

            switch (data.alertLevel) {
                case 1:
                    color = 16766720; // オレンジ色
                    alertIcon = '🔔';
                    break;
                case 2:
                    color = 15548997; // 濃いオレンジ
                    alertIcon = '⚠️';
                    break;
                case 3:
                    color = 15158332; // 赤色
                    alertIcon = '🚨';
                    break;
                default:
                    color = 3447003; // 青色
                    alertIcon = '📊';
                    break;
            }

            const embeds = [
                {
                    title: `${alertIcon} ${data.title}`,
                    description: `# ${formattedAmount}\nウィークリー利用合計額\n-`,
                    color: color,
                    fields: [
                        {
                            name: '期間',
                            value: data.period || '不明',
                            inline: false
                        },
                        {
                            name: '利用件数',
                            value: `${data.totalCount}件` || '0件',
                            inline: false
                        }
                    ]
                }
            ];

            // 追加情報があれば追加
            if (data.additionalInfo) {
                embeds[0].fields.push({
                    name: '補足情報',
                    value: data.additionalInfo,
                    inline: false
                });
            }

            // 通知タイプの説明を設定（ログ表示用）
            const description = data.alertLevel > 0 ? 'ウィークリーアラート' : 'ウィークリーレポート';

            return this.sendDiscordNotification(webhookUrl, embeds, description);
        } catch (error) {
            const appError = new AppError(
                'ウィークリーレポートの通知の送信中にエラーが発生しました',
                ErrorType.DISCORD,
                { reportType: 'weekly', alertLevel: data.alertLevel },
                error instanceof Error ? error : undefined
            );
            logger.logAppError(appError, this.serviceContext);
            return false;
        }
    }

    /**
     * Discord Webhookを使用してデイリーレポートを通知する
     * @param data デイリーレポート情報
     * @returns 通知の成功または失敗を表すブール値
     */
    async notifyDailyReport(data: DailyReportNotification): Promise<boolean> {
        try {
            const webhookUrl = this.getWebhookUrl(NotificationType.REPORT_DAILY);

            const formattedAmount = data.totalAmount.toLocaleString() + '円';

            const embeds = [
                {
                    title: `📅 ${data.title}`,
                    description: `# ${formattedAmount}\nデイリー利用合計額\n-`,
                    color: 3066993, // 緑色
                    fields: [
                        {
                            name: '日付',
                            value: data.date || '不明',
                            inline: false
                        },
                        {
                            name: '利用件数',
                            value: `${data.totalCount}件` || '0件',
                            inline: false
                        }
                    ]
                }
            ];

            // 追加情報があれば追加
            if (data.additionalInfo) {
                embeds[0].fields.push({
                    name: '補足情報',
                    value: data.additionalInfo,
                    inline: false
                });
            }

            return this.sendDiscordNotification(webhookUrl, embeds, 'デイリーレポート');
        } catch (error) {
            const appError = new AppError(
                'デイリーレポートの通知の送信中にエラーが発生しました',
                ErrorType.DISCORD,
                { reportType: 'daily', date: data.date },
                error instanceof Error ? error : undefined
            );
            logger.logAppError(appError, this.serviceContext);
            return false;
        }
    }

    /**
     * Discord Webhookを使用してマンスリーレポートを通知する
     * @param data マンスリーレポート情報
     * @returns 通知の成功または失敗を表すブール値
     */
    async notifyMonthlyReport(data: MonthlyReportNotification): Promise<boolean> {
        try {
            // アラートレベルが0より大きいならアラート通知、それ以外は定期レポート
            const notificationType = data.alertLevel > 0 ? NotificationType.ALERT_MONTHLY : NotificationType.REPORT_MONTHLY;
            const webhookUrl = this.getWebhookUrl(notificationType);

            const formattedAmount = data.totalAmount.toLocaleString() + '円';

            // アラートレベルに応じた色とアイコンを設定
            let color: number;
            let alertIcon: string;

            switch (data.alertLevel) {
                case 1:
                    color = 16766720; // オレンジ色
                    alertIcon = '🔔';
                    break;
                case 2:
                    color = 15548997; // 濃いオレンジ
                    alertIcon = '⚠️';
                    break;
                case 3:
                    color = 15158332; // 赤色
                    alertIcon = '🚨';
                    break;
                default:
                    color = 10181046; // 紫色
                    alertIcon = '📆';
                    break;
            }

            const embeds = [
                {
                    title: `${alertIcon} ${data.title}`,
                    description: `# ${formattedAmount}\nマンスリー利用合計額\n-`,
                    color: color,
                    fields: [
                        {
                            name: '期間',
                            value: data.period || '不明',
                            inline: false
                        },
                        {
                            name: '利用件数',
                            value: `${data.totalCount}件` || '0件',
                            inline: false
                        }
                    ]
                }
            ];

            // 追加情報があれば追加
            if (data.additionalInfo) {
                embeds[0].fields.push({
                    name: '補足情報',
                    value: data.additionalInfo,
                    inline: false
                });
            }

            // 通知タイプの説明を設定（ログ表示用）
            const description = data.alertLevel > 0 ? 'マンスリーアラート' : 'マンスリーレポート';

            return this.sendDiscordNotification(webhookUrl, embeds, description);
        } catch (error) {
            const appError = new AppError(
                'マンスリーレポートの通知の送信中にエラーが発生しました',
                ErrorType.DISCORD,
                { reportType: 'monthly', alertLevel: data.alertLevel },
                error instanceof Error ? error : undefined
            );
            logger.logAppError(appError, this.serviceContext);
            return false;
        }
    }
}