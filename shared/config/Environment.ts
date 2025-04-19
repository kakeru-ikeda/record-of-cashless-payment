import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// .envファイルを読み込む（存在する場合）
dotenv.config();

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
    static readonly DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

    // Firebase関連の設定
    static readonly FIREBASE_ADMIN_KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
        || path.resolve(process.cwd(), 'firebase-admin-key.json');

    // Cloud Functions関連の設定
    static readonly IS_CLOUD_FUNCTIONS = process.env.FUNCTIONS_EMULATOR === 'true'
        || process.env.FUNCTION_TARGET != null;

    /**
     * 環境変数のバリデーションを行う
     * @returns 検証結果（成功の場合true）
     */
    static validate(): boolean {
        const requiredVars = ['IMAP_SERVER', 'IMAP_USER', 'IMAP_PASSWORD'];
        const missingVars = requiredVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
            console.error('❌ 必須環境変数が設定されていません:', missingVars.join(', '));
            return false;
        }

        // Firebase Adminキーのチェック（Cloud Functions環境では不要）
        if (!this.IS_CLOUD_FUNCTIONS) {
            try {
                if (!fs.existsSync(this.FIREBASE_ADMIN_KEY_PATH)) {
                    console.warn(`⚠️ Firebase Admin SDKのキーファイルが見つかりません: ${this.FIREBASE_ADMIN_KEY_PATH}`);
                }
            } catch (error) {
                console.warn('⚠️ Firebase Admin SDK キーファイルの確認中にエラーが発生しました');
            }
        }

        // Discord WebhookのURLチェック
        if (this.DISCORD_WEBHOOK_URL) {
            if (!this.DISCORD_WEBHOOK_URL.startsWith('https://discord.com/api/webhooks/')) {
                console.warn('⚠️ Discord WebhookのURLが正しくない可能性があります');
            }
        } else {
            console.info('ℹ️ Discord WebhookのURLが設定されていません。通知は無効です。');
        }

        console.log('✅ 環境変数の検証が完了しました');
        return true;
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
     * Discord WebhookのURLを取得する
     * Cloud Functionsの場合は環境変数から取得する
     * @returns Discord WebhookのURL
     */
    static getDiscordWebhookUrl(): string {
        return this.DISCORD_WEBHOOK_URL;
    }
}