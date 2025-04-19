import * as functions from 'firebase-functions';
import { DiscordWebhookNotifier } from '../../shared/discord/DiscordNotifier';
import { FirestoreService } from '../../shared/firebase/FirestoreService';
import { Environment } from '../../shared/config/Environment';
import { ResponseHelper } from '../../shared/utils/ResponseHelper';
import { AppError, ErrorType } from '../../shared/errors/AppError';
import { ErrorHandler } from '../../shared/errors/ErrorHandler';
import { WeeklyReportService } from './services/reports/WeeklyReportService';
import { DailyReportService } from './services/reports/DailyReportService';
import { MonthlyReportService } from './services/reports/MonthlyReportService';

// Firestoreサービスの初期化
const firestoreService = FirestoreService.getInstance();
firestoreService.setCloudFunctions(true);
firestoreService.initialize();

// Discord Webhook URL取得 - Cloud Functions v2対応
let DISCORD_WEBHOOK_URL: string;
try {
    // 共通の環境設定クラスからWebhook URLを取得
    DISCORD_WEBHOOK_URL = Environment.getDiscordWebhookUrl();
    if (!DISCORD_WEBHOOK_URL) {
        console.warn('⚠️ Discord Webhook URLが見つかりません');
    } else {
        console.log('✅ 環境変数からDISCORD_WEBHOOK_URLを取得しました');
    }
} catch (error) {
    console.error('❌ 環境変数読み込みエラー:', error);
    DISCORD_WEBHOOK_URL = '';
}

// Discord通知インスタンス
const discordNotifier = new DiscordWebhookNotifier(DISCORD_WEBHOOK_URL);

// 各種レポートサービスの初期化
const weeklyReportService = new WeeklyReportService(firestoreService, discordNotifier);
const dailyReportService = new DailyReportService(firestoreService);
const monthlyReportService = new MonthlyReportService(firestoreService, discordNotifier);

/**
 * Firestoreドキュメント作成時に実行
 */
export const onFirestoreWrite = functions.firestore
    .onDocumentCreated({
        document: 'details/{year}/{month}/{term}/{day}/{timestamp}',
        region: 'asia-northeast1',
    }, async (event) => {
        console.log('🚀 処理開始 - ドキュメントパス:', event.params);

        // パスチェック
        const path = event.data?.ref.path;
        console.log('📂 ドキュメントパス:', path);

        if (path && path.includes('/reports')) {
            console.log('⚠️ レポートドキュメントには処理をスキップします:', path);
            return ResponseHelper.success('レポートドキュメントのため処理をスキップしました', {});
        }

        // エラーハンドリングを使用して安全に処理
        return await ErrorHandler.handleAsync(async () => {
            const params = event.params;

            const document = event.data;
            if (!document) {
                throw new AppError('ドキュメントが存在しません', ErrorType.NOT_FOUND);
            }

            const data = document.data();
            if (!data) {
                throw new AppError('ドキュメントデータが存在しません', ErrorType.NOT_FOUND);
            }

            // 各種レポートを処理
            console.log('📊 レポート処理を開始します...');

            // 1. デイリーレポート処理
            console.log('📆 デイリーレポート処理中...');
            const dailyReport = await dailyReportService.processReport(document, data, params);

            // 2. ウィークリーレポート処理
            console.log('📅 ウィークリーレポート処理中...');
            const weeklyReport = await weeklyReportService.processReport(document, data, params);

            // 3. マンスリーレポート処理
            console.log('📅 マンスリーレポート処理中...');
            const monthlyReport = await monthlyReportService.processReport(document, data, params);

            // 処理結果を返す
            return ResponseHelper.success('全てのレポート処理が完了しました', {
                weeklyReport,
                dailyReport,
                monthlyReport,
            });
        }, 'Firestore ドキュメント作成イベント処理');
    });
