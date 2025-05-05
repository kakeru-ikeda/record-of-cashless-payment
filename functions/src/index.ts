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
import { app as apiApp } from './api';

// Firestoreサービスの初期化
const firestoreService = FirestoreService.getInstance();
firestoreService.setCloudFunctions(true);
firestoreService.initialize();

// Discord Webhook URL取得 - 細分化されたWebhook URL対応
let DISCORD_WEBHOOK_URL = ''; // 利用明細通知用（Cloud Functionsでは使用しない）
let DISCORD_ALERT_WEEKLY_WEBHOOK_URL = '';
let DISCORD_ALERT_MONTHLY_WEBHOOK_URL = '';
let DISCORD_REPORT_DAILY_WEBHOOK_URL = '';
let DISCORD_REPORT_WEEKLY_WEBHOOK_URL = '';
let DISCORD_REPORT_MONTHLY_WEBHOOK_URL = '';

try {
    // 各種Webhook URLの取得
    // 注: 利用明細通知はCloud Functionsでは使用しないが、互換性のために取得
    DISCORD_WEBHOOK_URL = Environment.getDiscordWebhookUrl();

    // アラート通知用Webhook URL
    DISCORD_ALERT_WEEKLY_WEBHOOK_URL = Environment.getDiscordAlertWeeklyWebhookUrl();
    DISCORD_ALERT_MONTHLY_WEBHOOK_URL = Environment.getDiscordAlertMonthlyWebhookUrl();

    // レポート通知用Webhook URL
    DISCORD_REPORT_DAILY_WEBHOOK_URL = Environment.getDiscordReportDailyWebhookUrl();
    DISCORD_REPORT_WEEKLY_WEBHOOK_URL = Environment.getDiscordReportWeeklyWebhookUrl();
    DISCORD_REPORT_MONTHLY_WEBHOOK_URL = Environment.getDiscordReportMonthlyWebhookUrl();

    // Webhook URLのログ出力
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
const discordNotifier = new DiscordWebhookNotifier(
    DISCORD_WEBHOOK_URL, // 利用明細通知用（使用しない）
    DISCORD_ALERT_WEEKLY_WEBHOOK_URL, // 週次アラート通知用
    DISCORD_ALERT_MONTHLY_WEBHOOK_URL, // 月次アラート通知用
    DISCORD_REPORT_DAILY_WEBHOOK_URL, // 日次レポート通知用
    DISCORD_REPORT_WEEKLY_WEBHOOK_URL, // 週次レポート通知用
    DISCORD_REPORT_MONTHLY_WEBHOOK_URL // 月次レポート通知用
);

// 各種レポートサービスの初期化
const weeklyReportService = new WeeklyReportService(firestoreService, discordNotifier);
const dailyReportService = new DailyReportService(firestoreService, discordNotifier);
const monthlyReportService = new MonthlyReportService(firestoreService, discordNotifier);

// REST API エンドポイントを公開
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

            const dateInfo = DateUtil.getDateInfo(yesterday);

            console.log(`📅 処理日: ${dateInfo.year}年${dateInfo.month}月${dateInfo.day}日`);

            // 1. 前日のデイリーレポートを送信
            const dailyReportResult = await dailyReportService.sendDailyReport(
                dateInfo.year.toString(),
                dateInfo.month.toString().padStart(2, '0'),
                dateInfo.term.toString().replace('term', ''),
                dateInfo.day.toString().padStart(2, '0')
            );

            // 2. 週初め（月曜）または月の最終日の場合は先週のウィークリーレポートを送信
            let weeklyReportResult = null;
            if (yesterday.getDay() === 1 || dateInfo.isLastDayOfTerm || dateInfo.isLastDayOfMonth) {
                // 月曜日の場合、または週の最終日の場合、または月の最終日の場合
                console.log('📅 週次レポート条件に一致: 週次レポートを送信します');

                // 前週の情報を取得 - 月が変わる場合は同じ月内の週を参照する
                const lastWeekInfo = DateUtil.getLastTermInfo(yesterday);

                // 月をまたぐ場合は当月の情報を使用
                const reportYear = dateInfo.month !== lastWeekInfo.month ?
                    dateInfo.year.toString() :
                    lastWeekInfo.year.toString();

                const reportMonth = dateInfo.month !== lastWeekInfo.month ?
                    dateInfo.month.toString().padStart(2, '0') :
                    lastWeekInfo.month.toString().padStart(2, '0');

                const reportTerm = dateInfo.month !== lastWeekInfo.month ?
                    `term${dateInfo.term}` :
                    `term${lastWeekInfo.term}`;

                console.log(`📊 週次レポート対象: ${reportYear}年${reportMonth}月${reportTerm}`);

                weeklyReportResult = await weeklyReportService.sendWeeklyReport(
                    reportYear,
                    reportMonth,
                    reportTerm
                );
            }

            // 3. 月末の場合は当月のマンスリーレポートを送信
            let monthlyReportResult = null;
            if (dateInfo.isLastDayOfMonth) {
                // 月の最終日の場合
                console.log('📅 月次レポート条件に一致: 月次レポートを送信します');
                // 前月ではなく当月の情報を使用
                monthlyReportResult = await monthlyReportService.sendMonthlyReport(
                    dateInfo.year.toString(),
                    dateInfo.month.toString().padStart(2, '0')
                );
            } else if (yesterday.getDate() === 1) {
                // 月の最初の日の場合は前月の情報を使用
                console.log('📅 月初めのため前月の月次レポートを送信します');
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
