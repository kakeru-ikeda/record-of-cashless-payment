import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { BaseReportService } from './BaseReportService';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { DateUtil } from '../../../../shared/utils/DateUtil';
import { DailyReportNotification } from '../../../../shared/domain/entities/ReportNotifications';


/**
 * デイリーレポートデータ
 */
export interface DailyReport {
    totalAmount: number;
    totalCount: number;
    lastUpdated: admin.firestore.FieldValue;
    lastUpdatedBy: string;
    documentIdList: string[];
    date: admin.firestore.Timestamp;
    hasNotified: boolean;
}

/**
 * デイリーレポート処理サービス
 */
export class DailyReportService extends BaseReportService {
    /**
     * デイリーレポート処理
     * @param document Firestoreドキュメント
     * @param data ドキュメントデータ
     * @param params パスパラメータ（year, month, term, day）
     */
    async processReport(
        document: functions.firestore.DocumentSnapshot,
        data: any,
        params: Record<string, string>
    ): Promise<DailyReport> {
        try {
            const { year, month, day } = params;

            // DateUtilを使用してパスを取得
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            const pathInfo = DateUtil.getFirestorePath(dateObj);
            const dailyReportPath = pathInfo.dailyReportPath;

            // ドキュメントのフルパスを生成
            const documentFullPath = document.ref.path;

            // 既存のデイリーレポートを取得
            const existingReport = await this.firestoreService.getDocument<DailyReport>(dailyReportPath);

            let dailyReport: DailyReport;

            if (!existingReport) {
                // 新規レポート作成
                dailyReport = {
                    totalAmount: data.amount,
                    totalCount: 1,
                    lastUpdated: this.getServerTimestamp(),
                    lastUpdatedBy: 'system',
                    documentIdList: [documentFullPath], // フルパスを使用
                    date: this.getTimestampFromDate(dateObj),
                    hasNotified: false,
                };

                await this.firestoreService.saveDocument(dailyReportPath, dailyReport);
                console.log(`✅ デイリーレポート作成完了: ${dailyReportPath}`);
            } else {
                // 既存レポート更新
                dailyReport = {
                    ...existingReport,
                    totalAmount: existingReport.totalAmount + data.amount,
                    totalCount: existingReport.totalCount + 1,
                    lastUpdated: this.getServerTimestamp(),
                    lastUpdatedBy: 'system',
                    documentIdList: [...existingReport.documentIdList, documentFullPath], // フルパスを追加
                };

                await this.firestoreService.updateDocument(dailyReportPath, dailyReport);
                console.log(`✅ デイリーレポート更新完了: ${dailyReportPath}`);
            }

            return dailyReport;
        } catch (error) {
            const appError = error instanceof AppError ? error : new AppError(
                'デイリーレポート処理中にエラーが発生しました',
                ErrorType.GENERAL,
                params,
                error instanceof Error ? error : undefined
            );

            console.error('❌ ' + appError.toLogString());
            throw appError;
        }
    }

    /**
     * 金額変更に伴うデイリーレポートの更新
     * @param docRef 変更されたドキュメントの参照
     * @param params パスパラメータ（year, month, term, day）
     * @param amountDiff 金額の差分
     */
    public async updateReportForAmountChange(
        docRef: admin.firestore.DocumentReference,
        params: Record<string, string>,
        amountDiff: number
    ): Promise<void> {
        try {
            const { year, month, day } = params;

            // DateUtilを使用してパスを取得
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            const pathInfo = DateUtil.getFirestorePath(dateObj);
            const dailyReportPath = pathInfo.dailyReportPath;

            // ドキュメントのフルパスを生成

            // 既存のデイリーレポートを取得
            const existingReport = await this.firestoreService.getDocument<DailyReport>(dailyReportPath);

            if (!existingReport) {
                console.log(`⚠️ 更新対象のデイリーレポートが存在しません: ${dailyReportPath}`);
                return;
            }

            // 金額を更新
            const updatedReport = {
                ...existingReport,
                totalAmount: existingReport.totalAmount + amountDiff,
                lastUpdated: this.getServerTimestamp(),
                lastUpdatedBy: 'api-update',
            };

            await this.firestoreService.updateDocument(dailyReportPath, updatedReport);
            console.log(`✅ デイリーレポート金額更新完了: ${dailyReportPath}, 差分: ${amountDiff}`);
        } catch (error) {
            const appError = error instanceof AppError ? error : new AppError(
                'デイリーレポート更新中にエラーが発生しました',
                ErrorType.GENERAL,
                params,
                error instanceof Error ? error : undefined
            );

            console.error('❌ ' + appError.toLogString());
            throw appError;
        }
    }

    /**
     * ドキュメント削除（論理削除）に伴うデイリーレポートの更新
     * @param docRef 削除されたドキュメントの参照
     * @param params パスパラメータ（year, month, term, day）
     * @param amountDiff 金額の差分（マイナス値）
     * @param countDiff カウントの差分（通常は -1）
     */
    public async updateReportForDeletion(
        docRef: admin.firestore.DocumentReference,
        params: Record<string, string>,
        amountDiff: number,
        countDiff: number
    ): Promise<void> {
        try {
            const { year, month, day } = params;

            // DateUtilを使用してパスを取得
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            const pathInfo = DateUtil.getFirestorePath(dateObj);
            const dailyReportPath = pathInfo.dailyReportPath;

            // ドキュメントのフルパスを生成

            // 既存のデイリーレポートを取得
            const existingReport = await this.firestoreService.getDocument<DailyReport>(dailyReportPath);

            if (!existingReport) {
                console.log(`⚠️ 更新対象のデイリーレポートが存在しません: ${dailyReportPath}`);
                return;
            }

            // 金額とカウントを更新
            const updatedReport = {
                ...existingReport,
                totalAmount: existingReport.totalAmount + amountDiff,
                totalCount: existingReport.totalCount + countDiff,
                lastUpdated: this.getServerTimestamp(),
                lastUpdatedBy: 'api-delete',
                // documentIdListからは削除しない（履歴を残しておく）
            };

            await this.firestoreService.updateDocument(dailyReportPath, updatedReport);
            console.log(`✅ デイリーレポート削除更新完了: ${dailyReportPath}, 金額差分: ${amountDiff}, カウント差分: ${countDiff}`);
        } catch (error) {
            const appError = error instanceof AppError ? error : new AppError(
                'デイリーレポート更新中にエラーが発生しました（削除処理）',
                ErrorType.GENERAL,
                params,
                error instanceof Error ? error : undefined
            );

            console.error('❌ ' + appError.toLogString());
            throw appError;
        }
    }

    /**
     * 非表示から表示への変更に伴うデイリーレポートの更新（再加算）
     * @param docRef 変更されたドキュメントの参照
     * @param params パスパラメータ（year, month, term, day）
     * @param amountToAdd 加算する金額
     * @param countToAdd 加算するカウント数（通常は 1）
     */
    public async updateReportForAddition(
        docRef: admin.firestore.DocumentReference,
        params: Record<string, string>,
        amountToAdd: number,
        countToAdd: number
    ): Promise<void> {
        try {
            const { year, month, day } = params;

            // DateUtilを使用してパスを取得
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            const pathInfo = DateUtil.getFirestorePath(dateObj);
            const dailyReportPath = pathInfo.dailyReportPath;

            // ドキュメントのフルパスを生成
            const documentFullPath = docRef.path;

            // 既存のデイリーレポートを取得
            const existingReport = await this.firestoreService.getDocument<DailyReport>(dailyReportPath);

            if (!existingReport) {
                console.log(`⚠️ 更新対象のデイリーレポートが存在しません: ${dailyReportPath}`);
                // 既存のレポートがない場合は新規作成
                const dailyReport: DailyReport = {
                    totalAmount: amountToAdd,
                    totalCount: countToAdd,
                    lastUpdated: this.getServerTimestamp(),
                    lastUpdatedBy: 'api-reactivate',
                    documentIdList: [documentFullPath], // 復活したドキュメントのパスをリストに追加
                    date: this.getTimestampFromDate(dateObj),
                    hasNotified: false,
                };

                await this.firestoreService.saveDocument(dailyReportPath, dailyReport);
                console.log(`✅ デイリーレポート新規作成完了（再アクティブ化）: ${dailyReportPath}`);
                return;
            }

            // 既存レポート更新：金額とカウントを加算
            const updatedReport = {
                ...existingReport,
                totalAmount: existingReport.totalAmount + amountToAdd,
                totalCount: existingReport.totalCount + countToAdd,
                lastUpdated: this.getServerTimestamp(),
                lastUpdatedBy: 'api-reactivate',
            };

            // documentIdListに既に含まれていなければ追加（重複を避ける）
            if (!existingReport.documentIdList.includes(documentFullPath)) {
                updatedReport.documentIdList = [...existingReport.documentIdList, documentFullPath];
            }

            await this.firestoreService.updateDocument(dailyReportPath, updatedReport);
            console.log(`✅ デイリーレポート再アクティブ化更新完了: ${dailyReportPath}, 金額追加: ${amountToAdd}, カウント追加: ${countToAdd}`);
        } catch (error) {
            const appError = error instanceof AppError ? error : new AppError(
                'デイリーレポート更新中にエラーが発生しました（再アクティブ化処理）',
                ErrorType.GENERAL,
                params,
                error instanceof Error ? error : undefined
            );

            console.error('❌ ' + appError.toLogString());
            throw appError;
        }
    }

    /**
     * デイリーレポートを取得してDiscordに送信する
     * 毎日0時に自動実行される定期タスクから呼び出される
     * @param year 年
     * @param month 月
     * @param term 週番号
     * @param day 日
     * @returns 処理結果
     */
    async sendDailyReport(
        year: string,
        month: string,
        term: string,
        day: string
    ): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            if (!this.discordNotifier) {
                return {
                    success: false,
                    message: 'Discord通知モジュールが設定されていないためスキップしました',
                };
            }

            // DateUtilを使用してパスを取得
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            const pathInfo = DateUtil.getFirestorePath(dateObj);
            const dailyReportPath = pathInfo.dailyReportPath;

            // レポートデータを取得
            const reportData = await this.firestoreService.getDocument<DailyReport>(dailyReportPath);

            if (!reportData) {
                return {
                    success: false,
                    message: `デイリーレポートが存在しません: ${dailyReportPath}`,
                };
            }

            const formattedDate = DateUtil.formatDate(dateObj, 'yyyy/MM/dd');
            const dayOfWeek = DateUtil.getJapaneseDayOfWeek(dateObj);

            // 通知データを作成
            const notification: DailyReportNotification = {
                title: `${year}年${month}月${day}日(${dayOfWeek}) デイリーレポート`,
                date: formattedDate,
                totalAmount: reportData.totalAmount,
                totalCount: reportData.totalCount,
                additionalInfo: reportData.totalCount > 0
                    ? `平均支出: ${Math.round(reportData.totalAmount / reportData.totalCount).toLocaleString()}円/件`
                    : '利用なし',
            };

            // Discordに送信
            console.log('📤 デイリーレポートを送信します...');
            const success = await this.discordNotifier.notifyDailyReport(notification);

            if (success) {
                if (!reportData.hasNotified) {
                    await this.firestoreService.updateDocument(dailyReportPath, {
                        hasNotified: true,
                        lastUpdated: this.getServerTimestamp(),
                        lastUpdatedBy: 'daily-report-schedule',
                    });
                }

                return {
                    success: true,
                    message: 'デイリーレポートを送信しました',
                    data: notification,
                };
            } else {
                return {
                    success: false,
                    message: 'デイリーレポートの送信に失敗しました',
                    data: notification,
                };
            }
        } catch (error) {
            const appError = error instanceof AppError ? error : new AppError(
                'デイリーレポート送信中にエラーが発生しました',
                ErrorType.GENERAL,
                { year, month, term, day },
                error instanceof Error ? error : undefined
            );

            console.error('❌ ' + appError.toLogString());
            return {
                success: false,
                message: appError.message,
            };
        }
    }
}
