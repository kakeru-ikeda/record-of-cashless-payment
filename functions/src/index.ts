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
import { DateUtil } from '../../shared/utils/DateUtil';

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
const dailyReportService = new DailyReportService(firestoreService, discordNotifier);
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

/**
 * 毎日日本時間0時に実行される関数
 * デイリー・ウィークリー・マンスリーレポートを自動的にDiscordに送信する
 */
export const dailyReportSchedule = functions.scheduler
    .onSchedule({
        schedule: '0 0 * * *',
        timeZone: 'Asia/Tokyo',
        region: 'asia-northeast1',
    }, async (context) => {
        console.log('🕛 毎日定期実行: レポート自動送信処理を開始します');

        await ErrorHandler.handleAsync(async () => {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const dateInfo = DateUtil.getDateInfo(yesterday);

            console.log(`📅 処理日: ${dateInfo.year}年${dateInfo.month}月${dateInfo.day}日`);

            // 1. 前日のデイリーレポートを送信
            const dailyReportResult = await dailyReportService.sendDailyReport(
                dateInfo.year.toString(),
                dateInfo.month.toString().padStart(2, '0'),
                dateInfo.term.toString().replace('term', ''),
                dateInfo.day.toString().padStart(2, '0')
            );

            // 2. 週初め（月曜）の場合は先週のウィークリーレポートを送信
            let weeklyReportResult = null;
            if (yesterday.getDay() === 1 || (dateInfo.isLastDayOfTerm && !dateInfo.isLastDayOfMonth)) {
                // 月曜日の場合、または月を跨がない期間の最終日の場合
                const lastWeekInfo = DateUtil.getLastTermInfo(yesterday);
                weeklyReportResult = await weeklyReportService.sendWeeklyReport(
                    lastWeekInfo.year.toString(),
                    lastWeekInfo.month.toString().padStart(2, '0'),
                    `term${lastWeekInfo.term}`
                );
            }

            // 3. 月初め（1日）の場合は先月のマンスリーレポートを送信
            let monthlyReportResult = null;
            if (yesterday.getDate() === 1 || dateInfo.isLastDayOfMonth) {
                // 月の最初の日の場合、または月の最終日の場合
                const lastMonthInfo = DateUtil.getLastMonthInfo(yesterday);
                monthlyReportResult = await monthlyReportService.sendMonthlyReport(
                    lastMonthInfo.year.toString(),
                    lastMonthInfo.month.toString().padStart(2, '0')
                );
            }

            console.log('✅ 定期レポート送信処理が完了しました');
            console.log('定期レポート送信処理が完了しました', {
                dailyReportResult,
                weeklyReportResult,
                monthlyReportResult,
            });
            return;
        }, '定期レポート自動送信処理');
    });
