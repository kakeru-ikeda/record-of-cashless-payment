import { Environment } from '../../../../../shared/infrastructure/config/Environment';
import * as fs from 'fs';

// fsのモック
jest.mock('fs', () => ({
    existsSync: jest.fn()
}));

// Loggerをモック化
jest.mock('../../../../../shared/infrastructure/logging/Logger', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        logAppError: jest.fn(),
        updateServiceStatus: jest.fn()
    }
}));

// Logger importをテスト用に取得
import { logger } from '../../../../../shared/infrastructure/logging/Logger';

describe('Environment', () => {
    // 元の環境変数を保存
    const originalEnv = process.env;

    beforeEach(() => {
        // 環境変数をリセット
        process.env = { ...originalEnv };

        // モックをリセット
        jest.clearAllMocks();

        // fsのモックデフォルト設定
        (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    afterAll(() => {
        // 環境変数を元に戻す
        process.env = originalEnv;
    });

    describe('環境変数の読み込み', () => {
        it('IMAP設定がデフォルト値で初期化されること', () => {
            delete process.env.IMAP_SERVER;
            delete process.env.IMAP_USER;
            delete process.env.IMAP_PASSWORD;

            expect(Environment.IMAP_SERVER).toBe('imap.gmail.com');
            expect(Environment.IMAP_USER).toBe('');
            expect(Environment.IMAP_PASSWORD).toBe('');
        });

        it('環境変数が設定されている場合は環境変数の値が使用されること', () => {
            process.env.IMAP_SERVER = 'test.imap.server';
            process.env.IMAP_USER = 'test-user';
            process.env.IMAP_PASSWORD = 'test-password';

            // Environment クラスを再require することで環境変数を再読み込み
            jest.resetModules();
            const { Environment: ReloadedEnvironment } = require('../../../../../shared/infrastructure/config/Environment');

            expect(ReloadedEnvironment.IMAP_SERVER).toBe('test.imap.server');
            expect(ReloadedEnvironment.IMAP_USER).toBe('test-user');
            expect(ReloadedEnvironment.IMAP_PASSWORD).toBe('test-password');
        });

        it('Discord Webhook URLが環境変数から読み込まれること', () => {
            process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
            process.env.DISCORD_ALERT_WEEKLY_WEBHOOK_URL = 'https://discord.com/api/webhooks/alert-weekly';
            process.env.DISCORD_LOGGING_WEBHOOK_URL = 'https://discord.com/api/webhooks/logging';

            jest.resetModules();
            const { Environment: ReloadedEnvironment } = require('../../../../../shared/infrastructure/config/Environment');

            expect(ReloadedEnvironment.DISCORD_WEBHOOK_URL).toBe('https://discord.com/api/webhooks/test');
            expect(ReloadedEnvironment.DISCORD_ALERT_WEEKLY_WEBHOOK_URL).toBe('https://discord.com/api/webhooks/alert-weekly');
            expect(ReloadedEnvironment.DISCORD_LOGGING_WEBHOOK_URL).toBe('https://discord.com/api/webhooks/logging');
        });

        it('Cloud Functions環境の判定が正しく行われること', () => {
            // Cloud Functions環境でない場合
            delete process.env.FUNCTIONS_EMULATOR;
            delete process.env.FUNCTION_TARGET;

            jest.resetModules();
            let { Environment: ReloadedEnvironment } = require('../../../../../shared/infrastructure/config/Environment');
            expect(ReloadedEnvironment.IS_CLOUD_FUNCTIONS).toBe(false);

            // FUNCTIONS_EMULATORが設定されている場合
            process.env.FUNCTIONS_EMULATOR = 'true';
            jest.resetModules();
            ReloadedEnvironment = require('../../../../../shared/infrastructure/config/Environment').Environment;
            expect(ReloadedEnvironment.IS_CLOUD_FUNCTIONS).toBe(true);

            // FUNCTION_TARGETが設定されている場合
            delete process.env.FUNCTIONS_EMULATOR;
            process.env.FUNCTION_TARGET = 'api';
            jest.resetModules();
            ReloadedEnvironment = require('../../../../../shared/infrastructure/config/Environment').Environment;
            expect(ReloadedEnvironment.IS_CLOUD_FUNCTIONS).toBe(true);
        });
    });

    describe('validate', () => {
        beforeEach(() => {
            // デフォルトで有効な環境変数を設定
            process.env.IMAP_SERVER = 'imap.gmail.com';
            process.env.IMAP_USER = 'test@example.com';
            process.env.IMAP_PASSWORD = 'password';
            process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
        });

        it('必須環境変数が設定されている場合はtrueを返すこと', () => {
            const result = Environment.validate();
            expect(result).toBe(true);
            expect(logger.info).toHaveBeenCalledWith('✅ 環境変数の検証が完了しました', 'Environment');
        });

        it('必須環境変数が不足している場合はfalseを返すこと', () => {
            delete process.env.IMAP_USER;
            delete process.env.IMAP_PASSWORD;

            const result = Environment.validate();
            expect(result).toBe(false);
            expect(logger.warn).toHaveBeenCalledWith(
                '必須環境変数が設定されていません: IMAP_USER, IMAP_PASSWORD',
                'Environment'
            );
        });

        it('ローカル環境でFirebaseキーファイルが存在しない場合は警告を出すこと', () => {
            // ローカル環境に設定
            delete process.env.FUNCTIONS_EMULATOR;
            delete process.env.FUNCTION_TARGET;

            // ファイルが存在しないようにモック
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            Environment.validate();

            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Firebase Admin SDKのキーファイルが見つかりません'),
                'Environment'
            );
        });

        it('Cloud Functions環境ではFirebaseキーファイルのチェックをスキップすること', () => {
            // Cloud Functions環境に設定
            process.env.FUNCTIONS_EMULATOR = 'true';

            jest.resetModules();
            const { Environment: ReloadedEnvironment } = require('../../../../../shared/infrastructure/config/Environment');

            // ファイルが存在しないようにモック
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            ReloadedEnvironment.validate();

            // Firebase関連の警告が出ていないことを確認
            expect(logger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining('Firebase Admin SDKのキーファイルが見つかりません'),
                'Environment'
            );
        });

        it('Discord WebhookのURLが無効な場合は警告を出すこと', () => {
            process.env.DISCORD_WEBHOOK_URL = 'invalid-url';

            Environment.validate();

            expect(logger.warn).toHaveBeenCalledWith(
                '利用明細通知用 Discord WebhookのURLが設定されていません。この通知は無効です。',
                'Environment'
            );
        });

        it('Discord WebhookのURLが未設定の場合は警告を出すこと', () => {
            delete process.env.DISCORD_WEBHOOK_URL;

            Environment.validate();

            expect(logger.warn).toHaveBeenCalledWith(
                '利用明細通知用 Discord WebhookのURLが設定されていません。この通知は無効です。',
                'Environment'
            );
        });
    });

    describe('validateDiscordWebhook', () => {
        it('有効なDiscord WebhookのURLの場合はtrueを返すこと', () => {
            const result = (Environment as any).validateDiscordWebhook(
                'https://discord.com/api/webhooks/123456789/abcdefg',
                'テスト用'
            );
            expect(result).toBe(true);
        });

        it('無効なURLの場合はfalseを返し警告を出すこと', () => {
            const result = (Environment as any).validateDiscordWebhook(
                'https://invalid-url.com/webhook',
                'テスト用'
            );
            expect(result).toBe(false);
            expect(logger.warn).toHaveBeenCalledWith(
                'テスト用 Discord WebhookのURLが正しくない可能性があります',
                'Environment'
            );
        });

        it('空文字の場合はfalseを返し警告を出すこと', () => {
            const result = (Environment as any).validateDiscordWebhook('', 'テスト用');
            expect(result).toBe(false);
            expect(logger.warn).toHaveBeenCalledWith(
                'テスト用 Discord WebhookのURLが設定されていません。この通知は無効です。',
                'Environment'
            );
        });
    });

    describe('ゲッターメソッド', () => {
        beforeEach(() => {
            process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/main';
            process.env.DISCORD_ALERT_WEEKLY_WEBHOOK_URL = 'https://discord.com/api/webhooks/alert-weekly';
            process.env.DISCORD_ALERT_MONTHLY_WEBHOOK_URL = 'https://discord.com/api/webhooks/alert-monthly';
            process.env.DISCORD_REPORT_DAILY_WEBHOOK_URL = 'https://discord.com/api/webhooks/report-daily';
            process.env.DISCORD_REPORT_WEEKLY_WEBHOOK_URL = 'https://discord.com/api/webhooks/report-weekly';
            process.env.DISCORD_REPORT_MONTHLY_WEBHOOK_URL = 'https://discord.com/api/webhooks/report-monthly';
            process.env.DISCORD_LOGGING_WEBHOOK_URL = 'https://discord.com/api/webhooks/logging';

            jest.resetModules();
        });

        it('isCloudFunctions()が正しい値を返すこと', () => {
            expect(Environment.isCloudFunctions()).toBe(Environment.IS_CLOUD_FUNCTIONS);
        });

        it('getFirebaseAdminKeyPath()が正しいパスを返すこと', () => {
            expect(Environment.getFirebaseAdminKeyPath()).toBe(Environment.FIREBASE_ADMIN_KEY_PATH);
        });

        it('getDiscordWebhookUrl()が正しいURLを返すこと', () => {
            const { Environment: ReloadedEnvironment } = require('../../../../../shared/infrastructure/config/Environment');
            expect(ReloadedEnvironment.getDiscordWebhookUrl()).toBe('https://discord.com/api/webhooks/main');
        });

        it('専用URLが設定されている場合は専用URLを返すこと', () => {
            const { Environment: ReloadedEnvironment } = require('../../../../../shared/infrastructure/config/Environment');

            expect(ReloadedEnvironment.getDiscordAlertWeeklyWebhookUrl()).toBe('https://discord.com/api/webhooks/alert-weekly');
            expect(ReloadedEnvironment.getDiscordAlertMonthlyWebhookUrl()).toBe('https://discord.com/api/webhooks/alert-monthly');
            expect(ReloadedEnvironment.getDiscordReportDailyWebhookUrl()).toBe('https://discord.com/api/webhooks/report-daily');
            expect(ReloadedEnvironment.getDiscordReportWeeklyWebhookUrl()).toBe('https://discord.com/api/webhooks/report-weekly');
            expect(ReloadedEnvironment.getDiscordReportMonthlyWebhookUrl()).toBe('https://discord.com/api/webhooks/report-monthly');
            expect(ReloadedEnvironment.getDiscordLoggingWebhookUrl()).toBe('https://discord.com/api/webhooks/logging');
        });

        it('専用URLが未設定の場合はメインURLにフォールバックすること', () => {
            // 専用URLを削除
            delete process.env.DISCORD_ALERT_WEEKLY_WEBHOOK_URL;
            delete process.env.DISCORD_ALERT_MONTHLY_WEBHOOK_URL;
            delete process.env.DISCORD_REPORT_DAILY_WEBHOOK_URL;
            delete process.env.DISCORD_REPORT_WEEKLY_WEBHOOK_URL;
            delete process.env.DISCORD_REPORT_MONTHLY_WEBHOOK_URL;
            delete process.env.DISCORD_LOGGING_WEBHOOK_URL;

            const { Environment: ReloadedEnvironment } = require('../../../../../shared/infrastructure/config/Environment');

            const mainUrl = 'https://discord.com/api/webhooks/main';
            expect(ReloadedEnvironment.getDiscordAlertWeeklyWebhookUrl()).toBe(mainUrl);
            expect(ReloadedEnvironment.getDiscordAlertMonthlyWebhookUrl()).toBe(mainUrl);
            expect(ReloadedEnvironment.getDiscordReportDailyWebhookUrl()).toBe(mainUrl);
            expect(ReloadedEnvironment.getDiscordReportWeeklyWebhookUrl()).toBe(mainUrl);
            expect(ReloadedEnvironment.getDiscordReportMonthlyWebhookUrl()).toBe(mainUrl);
            expect(ReloadedEnvironment.getDiscordLoggingWebhookUrl()).toBe(mainUrl);
        });
    });

    describe('ログ設定', () => {
        it('ログレベルがデフォルト値で初期化されること', () => {
            delete process.env.LOG_LEVEL;

            jest.resetModules();
            const { Environment: ReloadedEnvironment } = require('../../../../../shared/infrastructure/config/Environment');

            expect(ReloadedEnvironment.LOG_LEVEL).toBe('INFO');
        });

        it('コンパクトログがfalseで初期化されること', () => {
            delete process.env.COMPACT_LOGS;

            jest.resetModules();
            const { Environment: ReloadedEnvironment } = require('../../../../../shared/infrastructure/config/Environment');

            expect(ReloadedEnvironment.COMPACT_LOGS).toBe(false);
        });

        it('ポーリングログ抑制がfalseで初期化されること', () => {
            delete process.env.SUPPRESS_POLLING_LOGS;

            jest.resetModules();
            const { Environment: ReloadedEnvironment } = require('../../../../../shared/infrastructure/config/Environment');

            expect(ReloadedEnvironment.SUPPRESS_POLLING_LOGS).toBe(false);
        });

        it('ステータス更新間隔がデフォルト値で初期化されること', () => {
            delete process.env.STATUS_REFRESH_INTERVAL;

            jest.resetModules();
            const { Environment: ReloadedEnvironment } = require('../../../../../shared/infrastructure/config/Environment');

            expect(ReloadedEnvironment.STATUS_REFRESH_INTERVAL).toBe(30000);
        });

        it('環境変数が設定されている場合は環境変数の値が使用されること', () => {
            process.env.LOG_LEVEL = 'DEBUG';
            process.env.COMPACT_LOGS = 'true';
            process.env.SUPPRESS_POLLING_LOGS = 'true';
            process.env.STATUS_REFRESH_INTERVAL = '60000';

            jest.resetModules();
            const { Environment: ReloadedEnvironment } = require('../../../../../shared/infrastructure/config/Environment');

            expect(ReloadedEnvironment.LOG_LEVEL).toBe('DEBUG');
            expect(ReloadedEnvironment.COMPACT_LOGS).toBe(true);
            expect(ReloadedEnvironment.SUPPRESS_POLLING_LOGS).toBe(true);
            expect(ReloadedEnvironment.STATUS_REFRESH_INTERVAL).toBe(60000);
        });
    });
});
