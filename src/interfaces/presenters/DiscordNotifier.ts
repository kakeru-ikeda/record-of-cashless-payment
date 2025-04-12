import axios from 'axios';
import { CardUsageNotification } from '../../domain/entities/CardUsage';
import { Environment } from '../../infrastructure/config/environment';

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
}

/**
 * Discordを使用した通知のプレゼンター実装
 */
export class DiscordWebhookNotifier implements DiscordNotifier {
  private readonly webhookUrl: string;

  /**
   * コンストラクタ
   * @param webhookUrl Discord WebhookのURL（指定がない場合は環境変数から取得）
   */
  constructor(webhookUrl?: string) {
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
      console.error('❌ Discord通知の送信中にエラーが発生しました:', error.message || error);
      return false;
    }
  }
}

