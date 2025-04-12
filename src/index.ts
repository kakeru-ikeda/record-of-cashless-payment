import * as dotenv from 'dotenv';
import * as path from 'path';
import { Environment } from './infrastructure/config/environment';
import { ImapEmailService } from './infrastructure/email/ImapEmailService';
import { FirestoreCardUsageRepository } from './infrastructure/firebase/FirestoreCardUsageRepository';
import { DiscordWebhookNotifier } from './interfaces/presenters/DiscordNotifier';
import { ProcessEmailUseCase } from './usecases/ProcessEmailUseCase';
import { EmailController } from './interfaces/controllers/EmailController';

// 環境変数の読み込み
dotenv.config();

/**
 * アプリケーションのブートストラップを行う関数
 */
async function bootstrap() {
    try {
        // 環境変数の検証
        if (!Environment.validate()) {
            console.error('❌ 環境変数の検証に失敗しました');
            process.exit(1);
        }

        console.log('🚀 アプリケーションを起動しています...');

        // インフラストラクチャレイヤーの初期化
        const emailService = new ImapEmailService(
            Environment.IMAP_SERVER,
            Environment.IMAP_USER,
            Environment.IMAP_PASSWORD
        );

        const cardUsageRepository = new FirestoreCardUsageRepository();
        await cardUsageRepository.initialize();

        const discordNotifier = new DiscordWebhookNotifier(Environment.DISCORD_WEBHOOK_URL);

        // ユースケースの初期化
        const processEmailUseCase = new ProcessEmailUseCase(
            emailService,
            cardUsageRepository,
            discordNotifier
        );

        // コントローラーの初期化
        const emailController = new EmailController(emailService, processEmailUseCase);

        // コマンドライン引数の解析
        const args = process.argv.slice(2);

        if (args.includes('--test')) {
            // テストモード：サンプルメールでのテスト実行
            console.log('🧪 テストモードで実行しています...');

            try {
                // サンプルメールファイルを読み込む
                const sampleMailPath = path.resolve(__dirname, '../samplemail.txt');
                const result = await testWithSampleMail(sampleMailPath, processEmailUseCase);
                console.log('✅ テスト結果:', result);
            } catch (error) {
                console.error('❌ テスト実行中にエラーが発生しました:', error);
            }
        } else {
            // 通常モード：メール監視の開始
            console.log('📧 メール監視モードで実行しています...');
            await emailController.startMonitoring('&TgmD8WdxTqw-UFJ&koCITA-'); // 三菱東京UFJ銀行のメールボックス

            // プロセス終了時のクリーンアップ
            process.on('SIGINT', () => {
                console.log('👋 アプリケーションを終了しています...');
                emailController.stopMonitoring();
                process.exit(0);
            });
        }
    } catch (error) {
        console.error('❌ アプリケーションの起動中にエラーが発生しました:', error);
        process.exit(1);
    }
}

/**
 * サンプルメールを使ったテスト実行関数
 */
async function testWithSampleMail(
    sampleMailPath: string,
    processEmailUseCase: ProcessEmailUseCase
): Promise<any> {
    const fs = require('fs');

    // サンプルメールの読み込み
    console.log('📄 サンプルメールを読み込んでいます:', sampleMailPath);
    const sampleMailContent = fs.readFileSync(sampleMailPath, 'utf8');

    // テスト実行
    return processEmailUseCase.executeTest(sampleMailContent);
}

// アプリケーションの起動
bootstrap()
    .then(() => console.log('✅ アプリケーションが正常に起動しました'))
    .catch(error => {
        console.error('❌ 予期せぬエラーが発生しました:', error);
        process.exit(1);
    });