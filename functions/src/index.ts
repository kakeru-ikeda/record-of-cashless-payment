import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { DiscordWebhookNotifier } from '../../shared/discord/DiscordNotifier';
import { WeeklyReportNotification } from '../../shared/types/WeeklyReportNotification';
import { DateUtil } from '../../shared/utils/DateUtil';
import { FirestoreService } from '../../shared/firebase/FirestoreService';
import { Environment } from '../../shared/config/Environment';
import { ResponseHelper } from '../../shared/utils/ResponseHelper';
import { AppError, ErrorType } from '../../shared/errors/AppError';
import { ErrorHandler } from '../../shared/errors/ErrorHandler';

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

/**
 * 週次レポートのしきい値
 */
const THRESHOLD = {
    LEVEL1: 1000,
    LEVEL2: 5000,
    LEVEL3: 10000,
};

/**
 * 週次レポートデータ
 */
interface WeeklyReport {
    totalAmount: number;
    totalCount: number;
    lastUpdated: admin.firestore.FieldValue;
    lastUpdatedBy: string;
    documentIdList: string[];
    termStartDate: admin.firestore.Timestamp;
    termEndDate: admin.firestore.Timestamp;
    hasNotifiedLevel1: boolean;
    hasNotifiedLevel2: boolean;
    hasNotifiedLevel3: boolean;
}

/**
 * 日付情報を取得
 */
const getDateInfo = () => {
    // 共通のDateUtilクラスを使用
    return DateUtil.getCurrentDateInfo();
};

/**
 * 週次レポートの通知チェック
 */
async function checkAndNotifyWeeklyReport(
    weeklyReport: WeeklyReport,
    weekNumber: number,
    year: string,
    month: string
): Promise<{ updated: boolean, alertLevel: number, weeklyReport: WeeklyReport }> {
    if (!DISCORD_WEBHOOK_URL) {
        console.log('📝 Webhook URL未設定のため通知をスキップ');
        return { updated: false, alertLevel: 0, weeklyReport };
    }

    let updated = false;
    let alertLevel = 0;
    const updatedReport = { ...weeklyReport };

    try {
        // しきい値チェック
        if (weeklyReport.totalAmount >= THRESHOLD.LEVEL3 && !weeklyReport.hasNotifiedLevel3) {
            alertLevel = 3;
            updatedReport.hasNotifiedLevel3 = true;
            updated = true;
        } else if (weeklyReport.totalAmount >= THRESHOLD.LEVEL2 && !weeklyReport.hasNotifiedLevel2) {
            alertLevel = 2;
            updatedReport.hasNotifiedLevel2 = true;
            updated = true;
        } else if (weeklyReport.totalAmount >= THRESHOLD.LEVEL1 && !weeklyReport.hasNotifiedLevel1) {
            alertLevel = 1;
            updatedReport.hasNotifiedLevel1 = true;
            updated = true;
        }

        if (alertLevel > 0) {
            console.log(`📊 アラートレベル${alertLevel}の通知を送信`);

            // 日付整形 - 拡張されたDateUtilを使用
            const startDate = weeklyReport.termStartDate.toDate();
            const endDate = weeklyReport.termEndDate.toDate();
            const formattedPeriod = DateUtil.formatDateRange(startDate, endDate, 'yyyy/MM/dd');

            // アラートメッセージ設定
            let additionalInfo = '';
            if (alertLevel === 1) {
                additionalInfo = `金額が${THRESHOLD.LEVEL1.toLocaleString()}円を超過。ペース注意。`;
            } else if (alertLevel === 2) {
                additionalInfo = `金額が${THRESHOLD.LEVEL2.toLocaleString()}円を超過。支出見直し。`;
            } else if (alertLevel === 3) {
                additionalInfo = `金額が${THRESHOLD.LEVEL3.toLocaleString()}円を超過。予算大幅超過！`;
            }

            // 通知データ作成
            const notification: WeeklyReportNotification = {
                title: `${year}年${month}月 第${weekNumber}週 レポート`,
                period: formattedPeriod,
                totalAmount: weeklyReport.totalAmount,
                totalCount: weeklyReport.totalCount,
                alertLevel,
                additionalInfo,
            };

            try {
                await discordNotifier.notifyWeeklyReport(notification);
            } catch (error) {
                throw new AppError(
                    'Discord通知の送信に失敗しました',
                    ErrorType.DISCORD,
                    { notification },
                    error instanceof Error ? error : undefined
                );
            }
        }

        return { updated, alertLevel, weeklyReport: updatedReport };
    } catch (error) {
        const appError = error instanceof AppError ? error : new AppError(
            '週次レポート通知処理中にエラーが発生しました',
            ErrorType.GENERAL,
            { year, month, weekNumber },
            error instanceof Error ? error : undefined
        );

        console.error('❌ ' + appError.toLogString());
        return { updated: false, alertLevel: 0, weeklyReport };
    }
}

/**
 * Firestoreドキュメント作成時に実行
 */
export const onFirestoreWrite = functions.firestore
    .onDocumentCreated({
        document: 'details/{year}/{month}/{term}/{day}/{timestamp}',
        region: 'asia-northeast1',
    }, async (event) => {
        console.log('🚀 処理開始');

        // エラーハンドリングを使用して安全に処理
        return await ErrorHandler.handleAsync(async () => {
            const { year, month, term } = event.params;
            const dateInfo = getDateInfo();

            const document = event.data;
            if (!document) {
                throw new AppError('ドキュメントが存在しません', ErrorType.NOT_FOUND);
            }

            const data = document.data();
            if (!data) {
                throw new AppError('ドキュメントデータが存在しません', ErrorType.NOT_FOUND);
            }

            // 週次レポートのパス (例: details/2023/09/term1)
            const reportsPath = `details/${year}/${month}/${term}`;

            let weeklyReport: WeeklyReport;
            // 共通のFirestoreServiceを使用してドキュメントを取得
            const reportDoc = await firestoreService.getDocument<WeeklyReport>(reportsPath);

            if (!reportDoc) {
                // 新規レポート作成
                weeklyReport = {
                    totalAmount: data.amount,
                    totalCount: 1,
                    lastUpdated: firestoreService.getServerTimestamp(),
                    lastUpdatedBy: 'system',
                    documentIdList: [document.id],
                    termStartDate: firestoreService.getTimestampFromDate(dateInfo.weekStartDate),
                    termEndDate: firestoreService.getTimestampFromDate(dateInfo.weekEndDate),
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                };
                await firestoreService.saveDocument(reportsPath, weeklyReport);
                console.log('✅ 週次レポート作成完了');
            } else {
                // 既存レポート更新
                const existingReport = reportDoc;
                weeklyReport = {
                    ...existingReport,
                    totalAmount: existingReport.totalAmount + data.amount,
                    totalCount: existingReport.totalCount + 1,
                    lastUpdated: firestoreService.getServerTimestamp(),
                    lastUpdatedBy: 'system',
                    documentIdList: [...existingReport.documentIdList, document.id],
                };

                await firestoreService.updateDocument(reportsPath, {
                    ...weeklyReport,
                } as any);

                console.log('✅ 週次レポート更新完了');
            }

            // 通知条件チェック
            const { updated, alertLevel, weeklyReport: updatedReport } =
                await checkAndNotifyWeeklyReport(weeklyReport, Number(term.replace('term', '')), year, month);

            // 通知フラグ更新
            if (updated) {
                console.log(`📢 アラートレベル${alertLevel}の通知フラグを更新`);
                await firestoreService.updateDocument(reportsPath, {
                    hasNotifiedLevel1: updatedReport.hasNotifiedLevel1,
                    hasNotifiedLevel2: updatedReport.hasNotifiedLevel2,
                    hasNotifiedLevel3: updatedReport.hasNotifiedLevel3,
                });
            }

            return ResponseHelper.success('週次レポート処理成功', updatedReport);
        }, 'Firestore ドキュメント作成イベント処理');
    });
