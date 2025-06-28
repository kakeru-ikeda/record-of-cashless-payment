import { Logger, LogLevel } from '../../../../../shared/infrastructure/logging/Logger';
import { AppError, ErrorType } from '../../../../../shared/errors/AppError';

// モック
jest.mock('../../../../../shared/infrastructure/discord/DiscordNotifier', () => {
    return {
        DiscordNotifier: jest.fn().mockImplementation(() => {
            return {
                notifyLogging: jest.fn().mockResolvedValue(undefined),
                notifyError: jest.fn().mockResolvedValue(undefined)
            };
        })
    };
});

// console メソッドのスパイを設定
const consoleSpy = {
    log: jest.spyOn(console, 'log').mockImplementation(),
    warn: jest.spyOn(console, 'warn').mockImplementation(),
    error: jest.spyOn(console, 'error').mockImplementation(),
    clear: jest.spyOn(console, 'clear').mockImplementation()
};

// 環境変数をモック
const originalEnv = process.env;

describe('Logger', () => {
    let logger: Logger;

    beforeEach(() => {
        // 環境変数をリセット
        process.env = { ...originalEnv };
        // テスト中であることを明示
        process.env.NODE_ENV = 'test';

        // コンソールスパイをリセット
        Object.values(consoleSpy).forEach(spy => spy.mockClear());

        // テスト用のLogger取得
        logger = Logger.getInstance();
    });

    afterAll(() => {
        // 環境変数を元に戻す
        process.env = originalEnv;
        // スパイをリストア
        Object.values(consoleSpy).forEach(spy => spy.mockRestore());
    });

    describe('シングルトンパターン', () => {
        it('getInstance()は同じインスタンスを返すべき', () => {
            const instance1 = Logger.getInstance();
            const instance2 = Logger.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('ログレベル', () => {
        it('DEBUGログレベルで全レベルのログが出力されるべき', () => {
            logger.setConfig({ level: LogLevel.DEBUG });

            logger.debug('デバッグメッセージ', 'テスト');
            logger.info('情報メッセージ', 'テスト');
            logger.warn('警告メッセージ', 'テスト');
            logger.error(new Error('エラーメッセージ'), 'テスト');

            expect(consoleSpy.log).toHaveBeenCalledTimes(4); // debug, info, warn, error
            expect(consoleSpy.error).toHaveBeenCalledTimes(1);
        });

        it('INFOログレベルではDEBUGログが抑制されるべき', () => {
            logger.setConfig({ level: LogLevel.INFO });

            logger.debug('デバッグメッセージ', 'テスト');
            logger.info('情報メッセージ', 'テスト');

            expect(consoleSpy.log).toHaveBeenCalledTimes(1); // infoのみ
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('情報メッセージ'));
        });

        it('WARNログレベルではDEBUGとINFOログが抑制されるべき', () => {
            logger.setConfig({ level: LogLevel.WARN });

            logger.debug('デバッグメッセージ', 'テスト');
            logger.info('情報メッセージ', 'テスト');
            logger.warn('警告メッセージ', 'テスト');

            expect(consoleSpy.log).toHaveBeenCalledTimes(1); // warnのみ
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('警告メッセージ'));
        });

        it('ERRORログレベルではDEBUG、INFO、WARNログが抑制されるべき', () => {
            logger.setConfig({ level: LogLevel.ERROR });

            logger.debug('デバッグメッセージ', 'テスト');
            logger.info('情報メッセージ', 'テスト');
            logger.warn('警告メッセージ', 'テスト');
            logger.error(new Error('エラーメッセージ'), 'テスト');

            expect(consoleSpy.log).toHaveBeenCalledTimes(1); // errorのみ
            expect(consoleSpy.error).toHaveBeenCalledTimes(1);
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('エラーメッセージ'));
        });

        it('NONEログレベルでは全てのログが抑制されるべき', () => {
            logger.setConfig({ level: LogLevel.NONE });

            logger.debug('デバッグメッセージ', 'テスト');
            logger.info('情報メッセージ', 'テスト');
            logger.warn('警告メッセージ', 'テスト');
            logger.error(new Error('エラーメッセージ'), 'テスト');

            expect(consoleSpy.log).not.toHaveBeenCalled();
            expect(consoleSpy.error).not.toHaveBeenCalled();
        });
    });

    describe('環境変数による設定', () => {
        afterEach(() => {
            // 各テスト後にタイマーをクリア
            if (Logger.getInstance()) {
                Logger.getInstance().clearTimers();
            }
        });

        it('環境変数LOG_LEVELによってログレベルが設定されるべき', () => {
            // 既存のLoggerインスタンスをリセット
            // @ts-ignore - privateプロパティにアクセスするため
            Logger.instance = undefined;

            // 環境変数を設定
            process.env.LOG_LEVEL = 'ERROR';

            // 新しいインスタンスを取得
            const newLogger = Logger.getInstance();

            // デバッグとインフォは表示されないはず
            newLogger.debug('デバッグは表示されない', 'テスト');
            newLogger.info('インフォも表示されない', 'テスト');
            newLogger.error(new Error('エラーは表示される'), 'テスト');

            expect(consoleSpy.log).toHaveBeenCalledTimes(1); // errorのみ
            expect(consoleSpy.error).toHaveBeenCalledTimes(1);
        });

        it('環境変数COMPACT_LOGSがtrueの場合、コンパクトモードが有効になるべき', () => {
            // 既存のLoggerインスタンスをリセット
            // @ts-ignore - privateプロパティにアクセスするため
            Logger.instance = undefined;

            // 環境変数を設定
            process.env.COMPACT_LOGS = 'true';
            process.env.STATUS_REFRESH_INTERVAL = '1000'; // 短い間隔で設定

            // タイマーをモック
            jest.useFakeTimers();

            // 新しいインスタンスを取得
            const newLogger = Logger.getInstance();

            // ステータスを更新
            newLogger.updateServiceStatus('TestService', 'online');

            // タイマーを進める
            jest.advanceTimersByTime(1000);

            // ダッシュボードが描画されたか確認
            expect(consoleSpy.log).toHaveBeenCalledWith('==== サービスステータスダッシュボード ====');

            // タイマーをクリア
            jest.useRealTimers();
            newLogger.clearTimers();
        });
    });

    describe('サービスステータス管理', () => {
        it('サービスステータスが正しく更新されるべき', () => {
            logger.updateServiceStatus('Service1', 'online');
            logger.updateServiceStatus('Service2', 'error', 'エラーが発生しました');

            // プライベートプロパティにアクセスする方法でテスト
            // @ts-ignore - privateプロパティにアクセスするため
            const services = logger['services'];

            expect(services.get('Service1')?.status).toBe('online');
            expect(services.get('Service2')?.status).toBe('error');
            expect(services.get('Service2')?.message).toBe('エラーが発生しました');
        });

        it('エラーメッセージが記録されるべき', () => {
            const error = new AppError('テストエラー', ErrorType.GENERAL);
            logger.error(error, 'ErrorService');

            // プライベートプロパティにアクセス
            // @ts-ignore - privateプロパティにアクセスするため
            const errorHistory = logger['errorHistory'];

            expect(errorHistory.length).toBeGreaterThan(0);
            expect(errorHistory[0].message).toBe('テストエラー');
            expect(errorHistory[0].service).toBe('ErrorService');
        });
    });

    describe('Discord通知', () => {
        it('DiscordNotifierが設定されている場合に通知が送信されるべき', () => {
            // DiscordNotifierのモックをインポート
            const { DiscordNotifier } = require('../../../../../shared/infrastructure/discord/DiscordNotifier');
            const mockDiscordNotifier = new DiscordNotifier();

            // Loggerにモックを設定
            logger.setDiscordNotifier(mockDiscordNotifier);

            // 通知オプション付きでログを出力
            logger.info('通知テスト', 'Service', { notify: true });

            // 通知メソッドが呼ばれたか検証
            expect(mockDiscordNotifier.notifyLogging).toHaveBeenCalledWith(
                '通知テスト',
                'お知らせ',
                'Service'
            );
        });

        it('DiscordNotifierが設定されていない場合は通知が送信されないべき', () => {
            // DiscordNotifierのモックをインポート
            const { DiscordNotifier } = require('../../../../../shared/infrastructure/discord/DiscordNotifier');
            const mockDiscordNotifier = new DiscordNotifier();

            // notifyオプション付きでログを出力（Notifierは設定されていない）
            logger.info('通知テスト', 'Service', { notify: true });

            // 通知メソッドが呼ばれていないことを検証
            expect(mockDiscordNotifier.notifyLogging).not.toHaveBeenCalled();
        });
    });

    describe('ログの抑制', () => {
        it('suppression設定がtrueの場合に繰り返しポーリングログが抑制されるべき', () => {
            logger.setConfig({ suppressPolling: true });

            // 同じポーリングメッセージを複数回出力
            for (let i = 0; i < 5; i++) {
                logger.info('ポーリング実行中', 'ポーリングサービス');
            }

            // 最初の1回だけコンソールログに出力される
            // @ts-ignore - privateプロパティにアクセスするため
            const suppressedMessages = logger['suppressedMessages'];

            expect(suppressedMessages.get('polling')).toBeDefined();
            const pollingRecord = suppressedMessages.get('polling');
            expect(pollingRecord?.count).toBe(5); // 全てのメッセージがカウントされている
        });

        it('suppressConsoleオプションが指定された場合にコンソール出力が抑制されるべき', () => {
            logger.info('これは表示されない', 'テスト', { suppressConsole: true });

            expect(consoleSpy.log).not.toHaveBeenCalled();
        });
    });

    describe('エラー統計', () => {
        afterEach(() => {
            // 各テスト後にタイマーをクリア
            logger.clearTimers();
            jest.useRealTimers();
        });

        it('エラー統計が正しく記録されるべき', () => {
            // エラーを複数回出力
            for (let i = 0; i < 3; i++) {
                logger.error(new Error(`エラー ${i}`), 'StatService');
            }

            // プライベートプロパティにアクセス
            // @ts-ignore - privateプロパティにアクセスするため
            const serviceErrorStats = logger['serviceErrorStats'];

            expect(serviceErrorStats.get('StatService')).toBeDefined();
            const statServiceStats = serviceErrorStats.get('StatService');
            expect(statServiceStats?.count).toBe(3);
        });

        it('古いエラー統計が正しくクリーンアップされるべき', () => {
            // 時間をモック
            jest.useFakeTimers();

            // 短い時間枠を設定
            logger.setConfig({ errorStatsTimeWindow: 1000 });

            // エラーを出力
            logger.error(new Error('古いエラー'), 'CleanupService');

            // 時間を進める
            jest.advanceTimersByTime(2000);

            // クリーンアップメソッドを呼び出し
            // @ts-ignore - privateメソッドを呼び出すため
            logger['cleanupErrorStats']();

            // プライベートプロパティにアクセス
            // @ts-ignore - privateプロパティにアクセスするため
            const serviceErrorStats = logger['serviceErrorStats'];

            expect(serviceErrorStats.has('CleanupService')).toBe(false);
        });
    });

    describe('ステータスダッシュボード', () => {
        afterEach(() => {
            // 各テスト後にタイマーをクリア
            logger.clearTimers();
        });

        it('コンパクトモードが有効の場合、ダッシュボードが描画されるべき', () => {
            // コンパクトモードを有効化
            logger.setConfig({ compactMode: true });

            // サービスステータスを設定
            logger.updateServiceStatus('Service1', 'online');
            logger.updateServiceStatus('Service2', 'error', 'テストエラー');

            // ダッシュボードを描画
            logger.renderStatusDashboard();

            // ダッシュボードのヘッダーが表示されたか確認
            expect(consoleSpy.log).toHaveBeenCalledWith('==== サービスステータスダッシュボード ====');
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('🟢 Service1'));
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('🔴 Service2'));
        });

        it('コンパクトモードが無効の場合、ダッシュボードが描画されないべき', () => {
            // コンパクトモードを無効化
            logger.setConfig({ compactMode: false });

            // 一旦コンソールログをクリア
            consoleSpy.log.mockClear();

            // サービスステータスを設定
            logger.updateServiceStatus('Service1', 'online');

            // ダッシュボードを描画
            logger.renderStatusDashboard();

            // ダッシュボードのヘッダーが表示されていないことを確認
            expect(consoleSpy.log).not.toHaveBeenCalledWith('==== サービスステータスダッシュボード ====');
        });
    });
});
