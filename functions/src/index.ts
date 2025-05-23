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
import { app as apiApp } from './api/app';

// Firestoreサービスの初期化
const firestoreService = FirestoreService.getInstance();
firestoreService.setCloudFunctions(true);
firestoreService.initialize();

// Discord Webhook URL取得 - 細分化されたWebhook URL対応
let DISCORD_WEBHOOK_URL = '';
let DISCORD_LOGGING_WEBHOOK_URL = '';
let DISCORD_ALERT_WEEKLY_WEBHOOK_URL = '';
let DISCORD_ALERT_MONTHLY_WEBHOOK_URL = '';
let DISCORD_REPORT_DAILY_WEBHOOK_URL = '';
let DISCORD_REPORT_WEEKLY_WEBHOOK_URL = '';
let DISCORD_REPORT_MONTHLY_WEBHOOK_URL = '';

try {
    // 利用明細通知用Webhook URL
    DISCORD_WEBHOOK_URL = Environment.getDiscordWebhookUrl();

    // ロギング用Webhook URL
    DISCORD_LOGGING_WEBHOOK_URL = Environment.getDiscordLoggingWebhookUrl();

    // アラート通知用Webhook URL
    DISCORD_ALERT_WEEKLY_WEBHOOK_URL = Environment.getDiscordAlertWeeklyWebhookUrl();
    DISCORD_ALERT_MONTHLY_WEBHOOK_URL = Environment.getDiscordAlertMonthlyWebhookUrl();

    // レポート通知用Webhook URL
    DISCORD_REPORT_DAILY_WEBHOOK_URL = Environment.getDiscordReportDailyWebhookUrl();
    DISCORD_REPORT_WEEKLY_WEBHOOK_URL = Environment.getDiscordReportWeeklyWebhookUrl();
    DISCORD_REPORT_MONTHLY_WEBHOOK_URL = Environment.getDiscordReportMonthlyWebhookUrl();

    // Webhook URLのログ出力
    if (DISCORD_WEBHOOK_URL) {
        console.log('✅ 環境変数から利用明細通知用のDISCORD_WEBHOOK_URLを取得しました');
    }

    if (DISCORD_LOGGING_WEBHOOK_URL) {
        console.log('✅ 環境変数からロギング用のDISCORD_LOGGING_WEBHOOK_URLを取得しました');
    }

    if (DISCORD_ALERT_WEEKLY_WEBHOOK_URL) {
        console.log('✅ 環境変数から週次アラート通知用のDISCORD_ALERT_WEEKLY_WEBHOOK_URLを取得しました');
    }

    if (DISCORD_ALERT_MONTHLY_WEBHOOK_URL) {
        console.log('✅ 環境変数から月次アラート通知用のDISCORD_ALERT_MONTHLY_WEBHOOK_URLを取得しました');
    }

    if (DISCORD_REPORT_DAILY_WEBHOOK_URL) {
        console.log('✅ 環境変数から日次レポート通知用のDISCORD_REPORT_DAILY_WEBHOOK_URLを取得しました');
    }

    if (DISCORD_REPORT_WEEKLY_WEBHOOK_URL) {
        console.log('✅ 環境変数から週次レポート通知用のDISCORD_REPORT_WEEKLY_WEBHOOK_URLを取得しました');
    }

    if (DISCORD_REPORT_MONTHLY_WEBHOOK_URL) {
        console.log('✅ 環境変数から月次レポート通知用のDISCORD_REPORT_MONTHLY_WEBHOOK_URLを取得しました');
    }
} catch (error) {
    console.error('❌ 環境変数読み込みエラー:', error);
}

// Discord通知インスタンス - 細分化されたWebhook URLを設定
const discordNotifier = new DiscordWebhookNotifier({
    usageWebhookUrl: DISCORD_WEBHOOK_URL,
    loggingWebhookUrl: DISCORD_LOGGING_WEBHOOK_URL,
    alertWeeklyWebhookUrl: DISCORD_ALERT_WEEKLY_WEBHOOK_URL,
    alertMonthlyWebhookUrl: DISCORD_ALERT_MONTHLY_WEBHOOK_URL,
    reportDailyWebhookUrl: DISCORD_REPORT_DAILY_WEBHOOK_URL,
    reportWeeklyWebhookUrl: DISCORD_REPORT_WEEKLY_WEBHOOK_URL,
    reportMonthlyWebhookUrl: DISCORD_REPORT_MONTHLY_WEBHOOK_URL,
});

// 各種レポートサービスの初期化
const weeklyReportService = new WeeklyReportService(firestoreService, discordNotifier);
const dailyReportService = new DailyReportService(firestoreService, discordNotifier);
const monthlyReportService = new MonthlyReportService(firestoreService, discordNotifier);

/**
 * APIエンドポイント
 * Cloud FunctionsのHTTPトリガーを使用してAPIを公開
 */
export const api = functions.https
    .onRequest({
        region: 'asia-northeast1',
    }, apiApp);

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
            // 日本時間の「今日」を取得
            const today = DateUtil.getJSTDate();
            // 「昨日」を計算
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const yesterdayInfo = DateUtil.getDateInfo(yesterday);

            console.log(`📅 処理日: ${yesterdayInfo.year}年${yesterdayInfo.month}月${yesterdayInfo.day}日`);

            // 1. 処理日のデイリーレポートを送信
            const dailyReportResult = await dailyReportService.sendDailyReport(
                yesterdayInfo.year.toString(),
                yesterdayInfo.month.toString().padStart(2, '0'),
                yesterdayInfo.term.toString().replace('term', ''),
                yesterdayInfo.day.toString().padStart(2, '0')
            );

            // 2. 処理日が週の最終日、または月の最終日の場合はウィークリーレポートを送信
            let weeklyReportResult = null;
            if (yesterdayInfo.isLastDayOfTerm || yesterdayInfo.isLastDayOfMonth) {
                console.log('📅 週次レポート条件に一致: 週次レポートを送信します');
                weeklyReportResult = await weeklyReportService.sendWeeklyReport(
                    yesterdayInfo.year.toString(),
                    yesterdayInfo.month.toString().padStart(2, '0'),
                    `term${yesterdayInfo.term}`
                );
            }

            // 3. 処理日が月の最終日の場合はマンスリーレポートを送信
            let monthlyReportResult = null;
            if (yesterdayInfo.isLastDayOfMonth) {
                console.log('📅 月次レポート条件に一致: 月次レポートを送信します');
                monthlyReportResult = await monthlyReportService.sendMonthlyReport(
                    yesterdayInfo.year.toString(),
                    yesterdayInfo.month.toString().padStart(2, '0')
                );
            }

            console.log('✅ 定期レポート送信処理が完了しました', {
                dailyReportResult,
                weeklyReportResult,
                monthlyReportResult,
            });
            return;
        }, '定期レポート自動送信処理');
    });
