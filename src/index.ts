import * as dotenv from 'dotenv';
import * as path from 'path';
import express from 'express';
import { Environment } from './infrastructure/config/environment';
import { ImapEmailService, CardCompany } from './infrastructure/email/ImapEmailService';
import { FirestoreCardUsageRepository } from './infrastructure/firebase/FirestoreCardUsageRepository';
import { DiscordWebhookNotifier } from '../shared/discord/DiscordNotifier';
import { ProcessEmailUseCase } from './usecases/ProcessEmailUseCase';
import { EmailController } from './interfaces/controllers/EmailController';
import { logger, LogLevel } from '../shared/utils/Logger';

// 環境変数の読み込み
dotenv.config();

/**
 * アプリケーションのブートストラップを行う関数
 */
async function bootstrap() {
    try {
        // Logger初期化 - 環境変数から設定を読み込む
        logger.setConfig({
            level: Environment.LOG_LEVEL === 'DEBUG' ? LogLevel.DEBUG : 
                  Environment.LOG_LEVEL === 'WARN' ? LogLevel.WARN : 
                  Environment.LOG_LEVEL === 'ERROR' ? LogLevel.ERROR : 
                  Environment.LOG_LEVEL === 'NONE' ? LogLevel.NONE : LogLevel.INFO,
            suppressPolling: Environment.SUPPRESS_POLLING_LOGS,
            compactMode: Environment.COMPACT_LOGS,
            statusRefreshInterval: Environment.STATUS_REFRESH_INTERVAL
        });
        
        // 起動メッセージ
        logger.info('アプリケーションを起動しています...', 'App');
        
        // 環境変数の検証
        if (!Environment.validate()) {
            logger.error('環境変数の検証に失敗しました', null, 'App');
            process.exit(1);
        }

        // Express.jsサーバーの初期化
        const app = express();
        const port = process.env.PORT || 3000;

        // ヘルスチェックエンドポイント
        app.get('/health', (req, res) => {
            res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // サーバーの起動
        const server = app.listen(port, () => {
            logger.info(`HTTPサーバーがポート${port}で起動しました`, 'HttpServer');
            logger.updateServiceStatus('HttpServer', 'online');
        });

        // インフラストラクチャレイヤーの初期化
        const emailService = new ImapEmailService(
            Environment.IMAP_SERVER,
            Environment.IMAP_USER,
            Environment.IMAP_PASSWORD
        );

        const cardUsageRepository = new FirestoreCardUsageRepository();
        await cardUsageRepository.initialize();
        logger.updateServiceStatus('FirestoreRepository', 'online', '初期化完了');

        const discordNotifier = new DiscordWebhookNotifier(Environment.DISCORD_WEBHOOK_URL);
        logger.updateServiceStatus('DiscordNotifier', Environment.DISCORD_WEBHOOK_URL ? 'online' : 'offline', 
            Environment.DISCORD_WEBHOOK_URL ? 'Discord通知準備完了' : 'Discord通知無効');

        // ユースケースの初期化
        const processEmailUseCase = new ProcessEmailUseCase(
            emailService,
            cardUsageRepository,
            discordNotifier
        );
        logger.updateServiceStatus('ProcessEmailUseCase', 'online', '初期化完了');

        // コントローラーの初期化
        const emailController = new EmailController(emailService, processEmailUseCase);
        logger.updateServiceStatus('EmailController', 'online', '初期化完了');

        // コマンドライン引数の解析
        const args = process.argv.slice(2);

        if (args.includes('--test')) {
            // テストモード：サンプルメールでのテスト実行
            logger.info('テストモードで実行しています...', 'TestMode');

            try {
                // サンプルメールファイルを読み込む
                const sampleMailPath = path.resolve(__dirname, '../samplemail.txt');
                
                // テスト対象のカード会社を特定
                const testCardCompany = args.includes('--smbc') ? CardCompany.SMBC : CardCompany.MUFG;
                logger.info(`${testCardCompany}のサンプルメールでテスト実行します...`, 'TestMode');
                
                const result = await testWithSampleMail(sampleMailPath, processEmailUseCase, testCardCompany);
                logger.info('テスト結果: ' + JSON.stringify(result), 'TestMode');
            } catch (error) {
                logger.error('テスト実行中にエラーが発生しました', error, 'TestMode');
            }
        } else {
            // 通常モード：メール監視の開始
            logger.info('メール監視モードで実行しています...', 'App');
            // すべてのメールボックス（三菱UFJ銀行、三井住友カード）を監視
            await emailController.startAllMonitoring();

            // プロセス終了時のクリーンアップ
            process.on('SIGINT', async () => {
                logger.info('アプリケーションを終了しています...', 'App');
                await emailController.stopMonitoring();
                if (server) {
                    server.close(() => {
                        logger.info('HTTPサーバーを停止しました', 'HttpServer');
                        process.exit(0);
                    });
                } else {
                    process.exit(0);
                }
            });
            
            // 最後にステータスダッシュボードを表示（コンパクトモードの場合）
            if (Environment.COMPACT_LOGS) {
                // 少し待ってからダッシュボードを表示（すべてのステータスが更新される時間を与える）
                setTimeout(() => {
                    logger.renderStatusDashboard();
                }, 1000);
            }
        }
    } catch (error) {
        logger.error('アプリケーションの起動中にエラーが発生しました', error, 'App');
        process.exit(1);
    }
}

/**
 * サンプルメールを使ったテスト実行関数
 */
async function testWithSampleMail(
    sampleMailPath: string,
    processEmailUseCase: ProcessEmailUseCase,
    cardCompany: CardCompany = CardCompany.MUFG
): Promise<any> {
    const fs = require('fs');

    // サンプルメールの読み込み
    logger.info('サンプルメールを読み込んでいます: ' + sampleMailPath, 'TestMode');
    const sampleMailContent = fs.readFileSync(sampleMailPath, 'utf8');

    // テスト実行
    return processEmailUseCase.executeTest(sampleMailContent, cardCompany);
}

// アプリケーションの起動
bootstrap()
    .then(() => logger.info('アプリケーションが正常に起動しました', 'App'))
    .catch(error => {
        logger.error('予期せぬエラーが発生しました', error, 'App');
        process.exit(1);
    });