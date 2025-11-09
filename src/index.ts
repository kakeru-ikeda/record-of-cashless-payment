import 'module-alias/register';
import * as dotenv from 'dotenv';
import { Environment } from '@shared/infrastructure/config/Environment';
import { logger, LogLevel } from '@shared/infrastructure/logging/Logger';
import { Application } from '@infrastructure/app/Application';
import { CardCompany } from '@domain/enums/CardCompany';
import { AppError, ErrorType } from '@shared/errors/AppError';

// 環境変数の読み込み
dotenv.config();

/**
 * アプリケーションのブートストラップを行う関数
 */
async function bootstrap() {
    try {
        // Logger初期化 - 環境変数から設定を読み込む
        initializeLogger();

        // 起動メッセージ
        logger.info('アプリケーションを起動しています...', 'App');

        // 環境変数の検証
        if (!Environment.validate()) {
            throw new AppError(
                '環境変数の設定に問題があります。必要な環境変数がすべて設定されていることを確認してください。',
                ErrorType.ENVIRONMENT,
            );
        }

        // アプリケーションのインスタンスを作成
        const app = new Application();

        // アプリケーションを初期化
        await app.initialize();

        // コマンドライン引数の解析
        const args = process.argv.slice(2);

        if (args.includes('--test')) {
            // テストモード：サンプルメールでのテスト実行
            // テスト対象のカード会社を特定
            const testCardCompany = args.includes('--smbc') ? CardCompany.SMBC : CardCompany.MUFG;
            await app.runInTestMode(testCardCompany);
        } else {
            // 通常モード：メール監視の開始
            await app.runInNormalMode();
        }
    } catch (error) {
        logger.error(error, 'App');
        process.exit(1);
    }
}

/**
 * ロガーを初期化する関数
 */
function initializeLogger(): void {
    logger.setConfig({
        level: Environment.LOG_LEVEL === 'DEBUG' ? LogLevel.DEBUG :
            Environment.LOG_LEVEL === 'WARN' ? LogLevel.WARN :
                Environment.LOG_LEVEL === 'ERROR' ? LogLevel.ERROR :
                    Environment.LOG_LEVEL === 'NONE' ? LogLevel.NONE : LogLevel.INFO,
        suppressPolling: Environment.SUPPRESS_POLLING_LOGS,
        compactMode: Environment.COMPACT_LOGS,
        statusRefreshInterval: Environment.STATUS_REFRESH_INTERVAL,
    });
}

// アプリケーションの起動
bootstrap()
    .then(() => logger.info('アプリケーションが正常に起動しました', 'App'))
    .catch((error) => {
        logger.error(error, 'App');
        process.exit(1);
    });
