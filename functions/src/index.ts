import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { DiscordWebhookNotifier } from '../../shared/discord/DiscordNotifier';
import { WeeklyReportNotification } from '../../shared/types/WeeklyReportNotification';

admin.initializeApp();

// Discord Webhook URL取得 - Cloud Functions v2対応
let DISCORD_WEBHOOK_URL: string;
try {
    // Cloud Functions v2では標準の環境変数を使用
    DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
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

// レスポンス用インターフェース
interface Response {
    status: number;
    success: boolean;
    message: string;
    data?: any;
}

// レスポンスヘルパー
const responceHelper = (status: number, success: boolean, message: string, data?: any): Response => {
    return { status, success, message, data };
};

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
    const now = new Date(new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const timestamp = now.getTime();

    // 週番号の計算
    // 月の最初の日を取得
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // 月初の曜日 (0: 日曜, 1: 月曜, ...)
    const startOfMonthDay = firstDayOfMonth.getDay();
    // 現在の日の月内週番号を計算
    const weekNumber = Math.ceil((now.getDate() + startOfMonthDay) / 7);
    const term = `term${weekNumber}`;

    // 週の開始日（日曜日）を計算
    const dayOfWeek = now.getDay(); // 0: 日曜, 1: 月曜, ...
    let weekStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0);

    // 週の終了日（土曜日）を計算
    let weekEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - dayOfWeek), 23, 59, 59);

    // 週の開始日が今月の1日より前の場合（月をまたいだ場合）
    if (weekStartDate.getMonth() !== now.getMonth()) {
        // 週の開始日が前月の場合は、今月の1日から計算し直す
        weekStartDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    }

    // 週の終了日が翌月の場合、終了日を今月の最終日に設定
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    if (weekEndDate > lastDayOfMonth) {
        weekEndDate = lastDayOfMonth;
    }

    return {
        now,
        year,
        month,
        day,
        weekNumber,
        term,
        weekStartDate,
        weekEndDate,
        timestamp,
    };
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

            // 日付整形
            const startDate = weeklyReport.termStartDate.toDate();
            const endDate = weeklyReport.termEndDate.toDate();
            const formattedStartDate = startDate.toLocaleDateString('ja-JP');
            const formattedEndDate = endDate.toLocaleDateString('ja-JP');

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
                period: `${formattedStartDate} 〜 ${formattedEndDate}`,
                totalAmount: weeklyReport.totalAmount,
                totalCount: weeklyReport.totalCount,
                alertLevel,
                additionalInfo,
            };

            await discordNotifier.notifyWeeklyReport(notification);
        }

        return { updated, alertLevel, weeklyReport: updatedReport };
    } catch (error) {
        console.error('❌ 週次レポート通知エラー:', error);
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

        const { year, month, term } = event.params;
        const dateInfo = getDateInfo();

        const document = event.data;
        if (!document) {
            console.error('❌ ドキュメントが存在しません');
            return responceHelper(404, false, 'ドキュメントが存在しません');
        }

        const data = document.data();
        if (!data) {
            console.error('❌ ドキュメントデータが存在しません');
            return responceHelper(404, false, 'ドキュメントデータが存在しません');
        }

        // 週次レポートのパス (例: details/2023/09/term1)
        const reportsPath = `details/${year}/${month}/${term}`;

        try {
            let weeklyReport: WeeklyReport;
            const reportDoc = await admin.firestore().doc(reportsPath).get();
            if (!reportDoc.exists) {
                // 新規レポート作成
                weeklyReport = {
                    totalAmount: data.amount,
                    totalCount: 1,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'system',
                    documentIdList: [document.id],
                    termStartDate: admin.firestore.Timestamp.fromDate(dateInfo.weekStartDate),
                    termEndDate: admin.firestore.Timestamp.fromDate(dateInfo.weekEndDate),
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                };
                await admin.firestore().doc(reportsPath).set(weeklyReport);
                console.log('✅ 週次レポート作成完了');
            } else {
                // 既存レポート更新
                const existingReport = reportDoc.data() as WeeklyReport;
                weeklyReport = {
                    ...existingReport,
                    totalAmount: existingReport.totalAmount + data.amount,
                    totalCount: existingReport.totalCount + 1,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'system',
                    documentIdList: [...existingReport.documentIdList, document.id],
                };

                await admin.firestore().doc(reportsPath).update({
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
                await admin.firestore().doc(reportsPath).update({
                    hasNotifiedLevel1: updatedReport.hasNotifiedLevel1,
                    hasNotifiedLevel2: updatedReport.hasNotifiedLevel2,
                    hasNotifiedLevel3: updatedReport.hasNotifiedLevel3,
                });
            }

            return responceHelper(200, true, '週次レポート処理成功', updatedReport);
        } catch (error) {
            console.error('❌ ドキュメント更新エラー:', error);
            return responceHelper(500, false, 'ドキュメント更新エラー', error);
        }
    });
