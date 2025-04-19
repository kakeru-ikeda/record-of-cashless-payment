import axios from 'axios';
import { CardUsageNotification } from '../types/CardUsageNotification';
import {
    WeeklyReportNotification,
    DailyReportNotification,
    MonthlyReportNotification,
} from '../types/reports/ReportNotifications';

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
    private readonly webhookUrl: string;

    /**
     * コンストラクタ
     * @param webhookUrl Discord WebhookのURL（必須）
     */
    constructor(webhookUrl: string) {
        this.webhookUrl = webhookUrl;
    }

    /**
     * Discord Webhookを使用して利用情報を通知する
     * @param data カード利用情報
     * @returns 通知の成功または失敗を表すブール値
     */
    async notify(data: CardUsageNotification): Promise<boolean> {
        try {
            if (!this.webhookUrl) {
                console.log('ℹ️ Discord WebhookのURLが設定されていないため、通知はスキップされました');
                return false;
            }

            // WebhookのURLが有効かチェック
            if (!this.webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
                console.error('❌ Discord WebhookのURLが無効です');
                return false;
            }

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

            console.log('📤 Discord通知を送信しています...');

            const response = await axios.post(this.webhookUrl, { embeds });

            if (response.status === 204 || response.status === 200) {
                console.log('✅ Discord通知を送信しました');
                return true;
            } else {
                console.error('❌ Discord通知の送信に失敗しました。ステータスコード:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ Discord通知の送信中にエラーが発生しました:', error);
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
            if (!this.webhookUrl) {
                console.log('ℹ️ Discord WebhookのURLが設定されていないため、通知はスキップされました');
                return false;
            }

            // WebhookのURLが有効かチェック
            if (!this.webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
                console.error('❌ Discord WebhookのURLが無効です');
                return false;
            }

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

            console.log('📤 ウィークリーレポートの通知を送信しています...');

            const response = await axios.post(this.webhookUrl, { embeds });

            if (response.status === 204 || response.status === 200) {
                console.log('✅ ウィークリーレポートの通知を送信しました');
                return true;
            } else {
                console.error('❌ ウィークリーレポートの通知の送信に失敗しました。ステータスコード:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ ウィークリーレポートの通知の送信中にエラーが発生しました:', error);
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
            if (!this.webhookUrl) {
                console.log('ℹ️ Discord WebhookのURLが設定されていないため、通知はスキップされました');
                return false;
            }

            // WebhookのURLが有効かチェック
            if (!this.webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
                console.error('❌ Discord WebhookのURLが無効です');
                return false;
            }

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

            console.log('📤 デイリーレポートの通知を送信しています...');

            const response = await axios.post(this.webhookUrl, { embeds });

            if (response.status === 204 || response.status === 200) {
                console.log('✅ デイリーレポートの通知を送信しました');
                return true;
            } else {
                console.error('❌ デイリーレポートの通知の送信に失敗しました。ステータスコード:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ デイリーレポートの通知の送信中にエラーが発生しました:', error);
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
            if (!this.webhookUrl) {
                console.log('ℹ️ Discord WebhookのURLが設定されていないため、通知はスキップされました');
                return false;
            }

            // WebhookのURLが有効かチェック
            if (!this.webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
                console.error('❌ Discord WebhookのURLが無効です');
                return false;
            }

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

            console.log('📤 マンスリーレポートの通知を送信しています...');

            const response = await axios.post(this.webhookUrl, { embeds });

            if (response.status === 204 || response.status === 200) {
                console.log('✅ マンスリーレポートの通知を送信しました');
                return true;
            } else {
                console.error('❌ マンスリーレポートの通知の送信に失敗しました。ステータスコード:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ マンスリーレポートの通知の送信中にエラーが発生しました:', error);
            return false;
        }
    }
}