import * as dotenv from 'dotenv';
import * as path from 'path';
import express from 'express';
import { Environment } from './infrastructure/config/environment';
import { ImapEmailService } from './infrastructure/email/ImapEmailService';
import { FirestoreCardUsageRepository } from './infrastructure/firebase/FirestoreCardUsageRepository';
import { DiscordWebhookNotifier } from '../shared/discord/DiscordNotifier';
import { ProcessEmailUseCase } from './usecases/ProcessEmailUseCase';
import { EmailController } from './interfaces/controllers/EmailController';
import { ResponseHelper } from '../shared/utils/ResponseHelper';
import { DateUtil } from '../shared/utils/DateUtil';

// 環境変数の読み込み
dotenv.config();

// Expressアプリケーションの作成
const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);
let emailController: EmailController;
let isMonitoring = false;

/**
 * 現在時刻をJST形式で取得し、指定されたフォーマットで整形する共通関数
 * @param format 日時フォーマット（デフォルト: 'yyyy/MM/dd HH:mm:ss'）
 * @returns フォーマット済みの日時文字列
 */
function getCurrentFormattedTime(format: string = 'yyyy/MM/dd HH:mm:ss'): string {
    const now = DateUtil.getJSTDate();
    return DateUtil.formatDate(now, format);
}

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    const formattedTimestamp = getCurrentFormattedTime();

    const response = ResponseHelper.success('システムは正常に稼働しています', {
        timestamp: formattedTimestamp,
        monitoring: isMonitoring
    });

    res.status(response.status).json(response);
});

// メール監視の状態を取得
app.get('/status', (req, res) => {
    const formattedTimestamp = isMonitoring ? getCurrentFormattedTime() : null;

    const response = ResponseHelper.success('メール監視の状態', {
        status: isMonitoring ? 'monitoring' : 'idle',
        startTime: formattedTimestamp
    });

    res.status(response.status).json(response);
});

// メール監視の手動開始エンドポイント
app.post('/start', async (req, res) => {
    if (!emailController) {
        const errorResponse = ResponseHelper.error(500, 'アプリケーションが初期化されていません');
        res.status(errorResponse.status).json(errorResponse);
        return;
    }

    if (isMonitoring) {
        const response = ResponseHelper.success('すでにメール監視を実行中です');
        res.status(response.status).json(response);
        return;
    }

    try {
        await emailController.startMonitoring();
        isMonitoring = true;
        const formattedTimestamp = getCurrentFormattedTime();

        const response = ResponseHelper.success('メール監視を開始しました', {
            startTime: formattedTimestamp
        });
        res.status(response.status).json(response);
    } catch (error) {
        const errorResponse = ResponseHelper.error(
            500,
            `メール監視の開始に失敗しました: ${error}`
        );
        res.status(errorResponse.status).json(errorResponse);
    }
});

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
        emailController = new EmailController(emailService, processEmailUseCase);

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
            // Cloud Run環境の場合はメール監視を自動的に開始
            if (process.env.K_SERVICE) {
                console.log('☁️ Cloud Run環境で実行しています。メール監視を自動的に開始します...');
                await emailController.startMonitoring();
                isMonitoring = true;
            } else {
                // ローカル環境では手動で開始する必要がある
                console.log('💻 ローカル環境で実行しています。/start エンドポイントでメール監視を開始できます');
            }

            // プロセス終了時のクリーンアップ
            process.on('SIGINT', () => {
                console.log('👋 アプリケーションを終了しています...');
                if (isMonitoring) {
                    emailController.stopMonitoring();
                }
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

// サーバー起動とメール監視の開始
bootstrap()
    .then(() => {
        // HTTPサーバーを起動
        app.listen(PORT, () => {
            console.log(`✅ HTTPサーバーを起動しました - ポート: ${PORT}`);
            console.log('✅ アプリケーションが正常に起動しました');
        });
    })
    .catch(error => {
        console.error('❌ 予期せぬエラーが発生しました:', error);
        process.exit(1);
    });