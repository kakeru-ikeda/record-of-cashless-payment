import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { logger } from '../utils/Logger';

// .envファイルを読み込む（存在する場合）
dotenv.config();

// コンテキスト定義
const CONTEXT = 'Environment';

/**
 * 環境変数の設定
 * アプリケーション全体で使用する環境変数を一元管理するクラス
 */
export class Environment {
    // IMAP関連の設定
    static readonly IMAP_SERVER = process.env.IMAP_SERVER || 'imap.gmail.com';
    static readonly IMAP_USER = process.env.IMAP_USER || '';
    static readonly IMAP_PASSWORD = process.env.IMAP_PASSWORD || '';

    // Discord関連の設定
    // 利用明細通知用のWebhook URL（メール受信時の通知）
    static readonly DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
    // アラート通知用のWebhook URL（週次）
    static readonly DISCORD_ALERT_WEEKLY_WEBHOOK_URL = process.env.DISCORD_ALERT_WEEKLY_WEBHOOK_URL || '';
    // アラート通知用のWebhook URL（月次）
    static readonly DISCORD_ALERT_MONTHLY_WEBHOOK_URL = process.env.DISCORD_ALERT_MONTHLY_WEBHOOK_URL || '';
    // レポート通知用のWebhook URL（日次）
    static readonly DISCORD_REPORT_DAILY_WEBHOOK_URL = process.env.DISCORD_REPORT_DAILY_WEBHOOK_URL || '';
    // レポート通知用のWebhook URL（週次）
    static readonly DISCORD_REPORT_WEEKLY_WEBHOOK_URL = process.env.DISCORD_REPORT_WEEKLY_WEBHOOK_URL || '';
    // レポート通知用のWebhook URL（月次）
    static readonly DISCORD_REPORT_MONTHLY_WEBHOOK_URL = process.env.DISCORD_REPORT_MONTHLY_WEBHOOK_URL || '';
    // エラーログ通知用のWebhook URL
    static readonly DISCORD_LOGGING_WEBHOOK_URL = process.env.DISCORD_LOGGING_WEBHOOK_URL || '';

    // Firebase関連の設定
    static readonly FIREBASE_ADMIN_KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
        || path.resolve(process.cwd(), 'firebase-admin-key.json');

    // Cloud Functions関連の設定
    static readonly IS_CLOUD_FUNCTIONS = process.env.FUNCTIONS_EMULATOR === 'true'
        || process.env.FUNCTION_TARGET != null;
        
    // ログ関連の設定
    static readonly LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
    static readonly COMPACT_LOGS = process.env.COMPACT_LOGS === 'true';
    static readonly SUPPRESS_POLLING_LOGS = process.env.SUPPRESS_POLLING_LOGS === 'true';
    static readonly STATUS_REFRESH_INTERVAL = parseInt(process.env.STATUS_REFRESH_INTERVAL || '30000', 10);

    /**
     * 環境変数のバリデーションを行う
     * @returns 検証結果（成功の場合true）
     */
    static validate(): boolean {
        const requiredVars = ['IMAP_SERVER', 'IMAP_USER', 'IMAP_PASSWORD'];
        const missingVars = requiredVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
            logger.warn('必須環境変数が設定されていません: ' + missingVars.join(', '), CONTEXT);
            return false;
        }

        // Firebase Adminキーのチェック（Cloud Functions環境では不要）
        if (!this.IS_CLOUD_FUNCTIONS) {
            try {
                if (!fs.existsSync(this.FIREBASE_ADMIN_KEY_PATH)) {
                    logger.warn(`Firebase Admin SDKのキーファイルが見つかりません: ${this.FIREBASE_ADMIN_KEY_PATH}`, CONTEXT);
                }
            } catch (error) {
                logger.warn('Firebase Admin SDK キーファイルの確認中にエラーが発生しました', CONTEXT);
            }
        }

        // Discord WebhookのURLチェック
        this.validateDiscordWebhook(this.DISCORD_WEBHOOK_URL, '利用明細通知用');
        this.validateDiscordWebhook(this.DISCORD_ALERT_WEEKLY_WEBHOOK_URL, '週次アラート通知用');
        this.validateDiscordWebhook(this.DISCORD_ALERT_MONTHLY_WEBHOOK_URL, '月次アラート通知用');
        this.validateDiscordWebhook(this.DISCORD_REPORT_DAILY_WEBHOOK_URL, '日次レポート通知用');
        this.validateDiscordWebhook(this.DISCORD_REPORT_WEEKLY_WEBHOOK_URL, '週次レポート通知用');
        this.validateDiscordWebhook(this.DISCORD_REPORT_MONTHLY_WEBHOOK_URL, '月次レポート通知用');
        this.validateDiscordWebhook(this.DISCORD_LOGGING_WEBHOOK_URL, 'エラーログ通知用');

        logger.info('✅ 環境変数の検証が完了しました', CONTEXT);
        return true;
    }

    /**
     * Discord WebhookのURLを検証する
     * @param webhookUrl 検証するWebhook URL
     * @param description Webhook URLの説明（ログ用）
     * @returns 有効な場合はtrue
     */
    private static validateDiscordWebhook(webhookUrl: string, description: string): boolean {
        if (webhookUrl) {
            if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
                logger.warn(`${description} Discord WebhookのURLが正しくない可能性があります`, CONTEXT);
                return false;
            }
            return true;
        } else {
            logger.warn(`${description} Discord WebhookのURLが設定されていません。この通知は無効です。`, CONTEXT);
            return false;
        }
    }

    /**
     * Cloud Functions環境かどうかを判定する
     * @returns Cloud Functions環境の場合はtrue
     */
    static isCloudFunctions(): boolean {
        return this.IS_CLOUD_FUNCTIONS;
    }

    /**
     * Firebase Admin SDKの設定ファイルパスを取得する
     * @returns 設定ファイルパス
     */
    static getFirebaseAdminKeyPath(): string {
        return this.FIREBASE_ADMIN_KEY_PATH;
    }

    /**
     * 利用明細通知用のDiscord WebhookのURLを取得する
     * @returns 利用明細通知用Discord WebhookのURL
     */
    static getDiscordWebhookUrl(): string {
        return this.DISCORD_WEBHOOK_URL;
    }

    /**
     * アラート通知用の週次Discord WebhookのURLを取得する
     * 週次のしきい値超過時の通知に使用される
     * @returns アラート通知用週次Discord WebhookのURL
     */
    static getDiscordAlertWeeklyWebhookUrl(): string {
        // 週次アラート用URLがなければ標準URLにフォールバック
        return this.DISCORD_ALERT_WEEKLY_WEBHOOK_URL || this.DISCORD_WEBHOOK_URL;
    }

    /**
     * アラート通知用の月次Discord WebhookのURLを取得する
     * 月次のしきい値超過時の通知に使用される
     * @returns アラート通知用月次Discord WebhookのURL
     */
    static getDiscordAlertMonthlyWebhookUrl(): string {
        // 月次アラート用URLがなければ標準URLにフォールバック
        return this.DISCORD_ALERT_MONTHLY_WEBHOOK_URL || this.DISCORD_WEBHOOK_URL;
    }

    /**
     * レポート通知用の日次Discord WebhookのURLを取得する
     * 日次の定期レポート送信に使用される
     * @returns レポート通知用日次Discord WebhookのURL
     */
    static getDiscordReportDailyWebhookUrl(): string {
        // 日次レポート用URLがなければ標準URLにフォールバック
        return this.DISCORD_REPORT_DAILY_WEBHOOK_URL || this.DISCORD_WEBHOOK_URL;
    }

    /**
     * レポート通知用の週次Discord WebhookのURLを取得する
     * 週次の定期レポート送信に使用される
     * @returns レポート通知用週次Discord WebhookのURL
     */
    static getDiscordReportWeeklyWebhookUrl(): string {
        // 週次レポート用URLがなければ標準URLにフォールバック
        return this.DISCORD_REPORT_WEEKLY_WEBHOOK_URL || this.DISCORD_WEBHOOK_URL;
    }

    /**
     * レポート通知用の月次Discord WebhookのURLを取得する
     * 月次の定期レポート送信に使用される
     * @returns レポート通知用月次Discord WebhookのURL
     */
    static getDiscordReportMonthlyWebhookUrl(): string {
        // 月次レポート用URLがなければ標準URLにフォールバック
        return this.DISCORD_REPORT_MONTHLY_WEBHOOK_URL || this.DISCORD_WEBHOOK_URL;
    }

    /**
     * エラーログ通知用のDiscord WebhookのURLを取得する
     * エラーログの通知に使用される
     * @returns エラーログ通知用Discord WebhookのURL
     */
    static getDiscordLoggingWebhookUrl(): string {
        // エラーログ用URLがなければ標準URLにフォールバック
        return this.DISCORD_LOGGING_WEBHOOK_URL || this.DISCORD_WEBHOOK_URL;
    }
}