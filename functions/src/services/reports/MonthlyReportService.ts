import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { BaseReportService } from './BaseReportService';
import { DateUtil } from '../../../../shared/utils/DateUtil';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { MonthlyReportNotification } from '../../../../shared/domain/entities/ReportNotifications';

/**
 * マンスリーレポートデータ
 */
export interface MonthlyReport {
    totalAmount: number;
    totalCount: number;
    lastUpdated: admin.firestore.FieldValue;
    lastUpdatedBy: string;
    documentIdList: string[];
    monthStartDate: admin.firestore.Timestamp;
    monthEndDate: admin.firestore.Timestamp;
    hasNotifiedLevel1: boolean;
    hasNotifiedLevel2: boolean;
    hasNotifiedLevel3: boolean;
    hasReportSent?: boolean; // 定期レポートとして送信済みかどうか
}

/**
 * レポートの通知しきい値
 */
export const THRESHOLD = {
    LEVEL1: 5000,
    LEVEL2: 10000,
    LEVEL3: 15000,
};

/**
 * マンスリーレポート処理サービス
 */
export class MonthlyReportService extends BaseReportService {
    /**
     * マンスリーレポート処理
     * @param document Firestoreドキュメント
     * @param data ドキュメントデータ
     * @param params パスパラメータ（year, month）
     */
    async processReport(
        document: functions.firestore.DocumentSnapshot,
        data: any,
        params: Record<string, string>
    ): Promise<MonthlyReport> {
        try {
            const { year, month } = params;

            // DateUtilを使用してパスを取得
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
            const pathInfo = DateUtil.getFirestorePath(dateObj);
            const monthlyReportPath = pathInfo.monthlyReportPath;

            // 月の開始日と終了日を計算
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(month), 0); // 前月の最終日

            // ドキュメントのフルパスを生成
            const documentFullPath = document.ref.path; // e.g. "/details/2025/04/term4/21/1745223428661"

            // 既存のマンスリーレポートを取得
            const existingReport = await this.firestoreService.getDocument<MonthlyReport>(monthlyReportPath);
            let monthlyReport: MonthlyReport;

            if (!existingReport) {
                // 新規レポート作成
                monthlyReport = {
                    totalAmount: data.amount,
                    totalCount: 1,
                    lastUpdated: this.getServerTimestamp(),
                    lastUpdatedBy: 'system',
                    documentIdList: [documentFullPath], // フルパスを使用
                    monthStartDate: this.getTimestampFromDate(startDate),
                    monthEndDate: this.getTimestampFromDate(endDate),
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                    hasReportSent: false,
                };

                await this.firestoreService.saveDocument(monthlyReportPath, monthlyReport);
                console.log(`✅ マンスリーレポート作成完了: ${monthlyReportPath}`);
            } else {
                // 既存レポート更新
                monthlyReport = {
                    ...existingReport,
                    totalAmount: existingReport.totalAmount + data.amount,
                    totalCount: existingReport.totalCount + 1,
                    lastUpdated: this.getServerTimestamp(),
                    lastUpdatedBy: 'system',
                    documentIdList: [...existingReport.documentIdList, documentFullPath], // フルパスを追加
                };

                await this.firestoreService.updateDocument(monthlyReportPath, monthlyReport);
                console.log(`✅ マンスリーレポート更新完了: ${monthlyReportPath}`);
            }

            // 通知条件チェック（しきい値超過時のアラート）
            const { updated, alertLevel, updatedReport } =
                await this.checkAndSendAlert(monthlyReport, year, month);

            // 通知フラグ更新
            if (updated) {
                console.log(`📢 マンスリーレポート: アラートレベル${alertLevel}の通知フラグを更新`);
                await this.firestoreService.updateDocument(monthlyReportPath, {
                    hasNotifiedLevel1: updatedReport.hasNotifiedLevel1,
                    hasNotifiedLevel2: updatedReport.hasNotifiedLevel2,
                    hasNotifiedLevel3: updatedReport.hasNotifiedLevel3,
                });
            }

            return updatedReport;
        } catch (error) {
            const appError = error instanceof AppError ? error : new AppError(
                'マンスリーレポート処理中にエラーが発生しました',
                ErrorType.GENERAL,
                params,
                error instanceof Error ? error : undefined
            );

            console.error('❌ ' + appError.toLogString());
            throw appError;
        }
    }

    /**
     * 金額変更に伴うマンスリーレポートの更新
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
            const { year, month } = params;

            const paddedMonth = month.padStart(2, '0');
            const monthlyReportPath = `reports/monthly/${year}/${paddedMonth}`;

            // ドキュメントのフルパスを生成

            // 既存のマンスリーレポートを取得
            const existingReport = await this.firestoreService.getDocument<MonthlyReport>(monthlyReportPath);

            if (!existingReport) {
                console.log(`⚠️ 更新対象のマンスリーレポートが存在しません: ${monthlyReportPath}`);
                return;
            }

            // 金額を更新
            const updatedReport = {
                ...existingReport,
                totalAmount: existingReport.totalAmount + amountDiff,
                lastUpdated: this.getServerTimestamp(),
                lastUpdatedBy: 'api-update',
            };

            await this.firestoreService.updateDocument(monthlyReportPath, updatedReport);
            console.log(`✅ マンスリーレポート金額更新完了: ${monthlyReportPath}, 差分: ${amountDiff}`);

            // 金額が変わったので、アラート条件もチェック
            await this.checkAndSendAlert(updatedReport, year, month);
        } catch (error) {
            const appError = error instanceof AppError ? error : new AppError(
                'マンスリーレポート更新中にエラーが発生しました',
                ErrorType.GENERAL,
                params,
                error instanceof Error ? error : undefined
            );

            console.error('❌ ' + appError.toLogString());
            throw appError;
        }
    }

    /**
     * ドキュメント削除（論理削除）に伴うマンスリーレポートの更新
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
            const { year, month } = params;

            // DateUtilを使用してパスを取得
            const paddedMonth = month.padStart(2, '0');
            const monthlyReportPath = `reports/monthly/${year}/${paddedMonth}`;

            // ドキュメントのフルパスを生成

            // 既存のマンスリーレポートを取得
            const existingReport = await this.firestoreService.getDocument<MonthlyReport>(monthlyReportPath);

            if (!existingReport) {
                console.log(`⚠️ 更新対象のマンスリーレポートが存在しません: ${monthlyReportPath}`);
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

            await this.firestoreService.updateDocument(monthlyReportPath, updatedReport);
            console.log(`✅ マンスリーレポート削除更新完了: ${monthlyReportPath}, 金額差分: ${amountDiff}, カウント差分: ${countDiff}`);

            // 金額が変わったので、アラート条件もチェック
            await this.checkAndSendAlert(updatedReport, year, month);
        } catch (error) {
            const appError = error instanceof AppError ? error : new AppError(
                'マンスリーレポート更新中にエラーが発生しました（削除処理）',
                ErrorType.GENERAL,
                params,
                error instanceof Error ? error : undefined
            );

            console.error('❌ ' + appError.toLogString());
            throw appError;
        }
    }

    /**
     * 非表示から表示への変更に伴うマンスリーレポートの更新（再加算）
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
            const { year, month } = params;

            // DateUtilを使用してパスを取得
            const paddedMonth = month.padStart(2, '0');
            const monthlyReportPath = `reports/monthly/${year}/${paddedMonth}`;

            // ドキュメントのフルパスを生成
            const documentFullPath = docRef.path;

            // 既存のマンスリーレポートを取得
            const existingReport = await this.firestoreService.getDocument<MonthlyReport>(monthlyReportPath);

            if (!existingReport) {
                console.log(`⚠️ 更新対象のマンスリーレポートが存在しません: ${monthlyReportPath}`);

                // 月の開始日と終了日を計算
                const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                const endDate = new Date(parseInt(year), parseInt(month), 0); // 前月の最終日

                // 既存のレポートがない場合は新規作成
                const monthlyReport: MonthlyReport = {
                    totalAmount: amountToAdd,
                    totalCount: countToAdd,
                    lastUpdated: this.getServerTimestamp(),
                    lastUpdatedBy: 'api-reactivate',
                    documentIdList: [documentFullPath], // 復活したドキュメントのパスをリストに追加
                    monthStartDate: this.getTimestampFromDate(startDate),
                    monthEndDate: this.getTimestampFromDate(endDate),
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                    hasReportSent: false,
                };

                await this.firestoreService.saveDocument(monthlyReportPath, monthlyReport);
                console.log(`✅ マンスリーレポート新規作成完了（再アクティブ化）: ${monthlyReportPath}`);

                // 金額が追加されたので、アラート条件もチェック
                await this.checkAndSendAlert(monthlyReport, year, month);

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

            await this.firestoreService.updateDocument(monthlyReportPath, updatedReport);
            console.log(`✅ マンスリーレポート再アクティブ化更新完了: ${monthlyReportPath}, 金額追加: ${amountToAdd}, カウント追加: ${countToAdd}`);

            // 金額が追加されたので、アラート条件もチェック
            await this.checkAndSendAlert(updatedReport, year, month);
        } catch (error) {
            const appError = error instanceof AppError ? error : new AppError(
                'マンスリーレポート更新中にエラーが発生しました（再アクティブ化処理）',
                ErrorType.GENERAL,
                params,
                error instanceof Error ? error : undefined
            );

            console.error('❌ ' + appError.toLogString());
            throw appError;
        }
    }

    /**
     * マンスリーレポートのアラート条件チェック（しきい値超過時の通知）
     * @param monthlyReport マンスリーレポートデータ
     * @param year 年
     * @param month 月
     */
    private async checkAndSendAlert(
        monthlyReport: MonthlyReport,
        year: string,
        month: string
    ): Promise<{ updated: boolean; alertLevel: number; updatedReport: MonthlyReport }> {
        if (!this.discordNotifier) {
            console.log('📝 通知モジュールが設定されていないため通知をスキップ');
            return { updated: false, alertLevel: 0, updatedReport: monthlyReport };
        }

        let updated = false;
        let alertLevel = 0;
        const updatedReport = { ...monthlyReport };

        try {
            if (monthlyReport.totalAmount >= THRESHOLD.LEVEL3 && !monthlyReport.hasNotifiedLevel3) {
                alertLevel = 3;
                updatedReport.hasNotifiedLevel3 = true;
                updated = true;
            } else if (monthlyReport.totalAmount >= THRESHOLD.LEVEL2 && !monthlyReport.hasNotifiedLevel2) {
                alertLevel = 2;
                updatedReport.hasNotifiedLevel2 = true;
                updated = true;
            } else if (monthlyReport.totalAmount >= THRESHOLD.LEVEL1 && !monthlyReport.hasNotifiedLevel1) {
                alertLevel = 1;
                updatedReport.hasNotifiedLevel1 = true;
                updated = true;
            }

            if (alertLevel > 0) {
                console.log(`📊 マンスリーレポート: アラートレベル${alertLevel}の通知を送信`);

                // 日付整形
                const startDate = monthlyReport.monthStartDate.toDate();
                const endDate = monthlyReport.monthEndDate.toDate();
                const formattedPeriod = DateUtil.formatDateRange(startDate, endDate, 'yyyy/MM/dd');

                // アラートメッセージ設定
                let additionalInfo = '';
                if (alertLevel === 1) {
                    additionalInfo = `今月の合計金額が${THRESHOLD.LEVEL1.toLocaleString()}円を超過。予算管理を見直してください。`;
                } else if (alertLevel === 2) {
                    additionalInfo = `今月の合計金額が${THRESHOLD.LEVEL2.toLocaleString()}円を超過。出費を抑えましょう！`;
                } else if (alertLevel === 3) {
                    additionalInfo = `今月の合計金額が${THRESHOLD.LEVEL3.toLocaleString()}円を超過。緊急の予算見直しが必要です！`;
                }

                // 通知データ作成
                const notification: MonthlyReportNotification = {
                    title: `${year}年${month}月 マンスリーアラート`,
                    period: formattedPeriod,
                    totalAmount: monthlyReport.totalAmount,
                    totalCount: monthlyReport.totalCount,
                    alertLevel,
                    additionalInfo,
                };

                try {
                    // 専用のマンスリーレポート通知メソッドを使用
                    await this.discordNotifier.notifyMonthlyReport(notification);
                } catch (error) {
                    throw new AppError(
                        'Discord通知の送信に失敗しました',
                        ErrorType.DISCORD,
                        { notification },
                        error instanceof Error ? error : undefined
                    );
                }
            }

            return { updated, alertLevel, updatedReport };
        } catch (error) {
            const appError = error instanceof AppError ? error : new AppError(
                'マンスリーレポート通知処理中にエラーが発生しました',
                ErrorType.GENERAL,
                { year, month },
                error instanceof Error ? error : undefined
            );

            console.error('❌ ' + appError.toLogString());
            return { updated: false, alertLevel: 0, updatedReport: monthlyReport };
        }
    }

    /**
     * マンスリーレポートを取得してDiscordに定期レポートとして送信する
     * 毎月1日0時に自動実行される定期タスクから呼び出される
     * @param year 年
     * @param month 月
     * @returns 処理結果
     */
    async sendMonthlyReport(
        year: string,
        month: string
    ): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            if (!this.discordNotifier) {
                return {
                    success: false,
                    message: 'Discord通知モジュールが設定されていないためスキップしました',
                };
            }

            // DateUtilを使用してパスを取得
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
            const pathInfo = DateUtil.getFirestorePath(dateObj);
            const monthlyReportPath = pathInfo.monthlyReportPath;

            // レポートデータを取得
            const reportData = await this.firestoreService.getDocument<MonthlyReport>(monthlyReportPath);

            if (!reportData) {
                return {
                    success: false,
                    message: `マンスリーレポートが存在しません: ${monthlyReportPath}`,
                };
            }

            // 既にレポートを送信済みの場合はスキップ
            if (reportData.hasReportSent) {
                return {
                    success: true,
                    message: `マンスリーレポートは既に送信済みです: ${monthlyReportPath}`,
                    data: reportData,
                };
            }

            // 月の開始日と終了日を取得
            const startDate = reportData.monthStartDate.toDate();
            const endDate = reportData.monthEndDate.toDate();
            const formattedPeriod = DateUtil.formatDateRange(startDate, endDate, 'yyyy/MM/dd');

            // 追加情報を計算
            let additionalInfo = '';
            if (reportData.totalCount > 0) {
                // 平均支出
                additionalInfo = `平均支出: 
                    ${Math.round(reportData.totalAmount / reportData.totalCount).toLocaleString()}円/件\n`;
                additionalInfo += `1日あたり平均: 
                    ${Math.round(reportData.totalAmount / endDate.getDate()).toLocaleString()}円/日`;

                // しきい値との比較情報を追加
                if (reportData.totalAmount > THRESHOLD.LEVEL3) {
                    additionalInfo += `\n📊 しきい値超過: レベル3 (${THRESHOLD.LEVEL3.toLocaleString()}円) を 
                        ${(reportData.totalAmount - THRESHOLD.LEVEL3).toLocaleString()}円 超過`;
                } else if (reportData.totalAmount > THRESHOLD.LEVEL2) {
                    additionalInfo += `\n📊 しきい値超過: レベル2 (${THRESHOLD.LEVEL2.toLocaleString()}円) を 
                        ${(reportData.totalAmount - THRESHOLD.LEVEL2).toLocaleString()}円 超過`;
                } else if (reportData.totalAmount > THRESHOLD.LEVEL1) {
                    additionalInfo += `\n📊 しきい値超過: レベル1 (${THRESHOLD.LEVEL1.toLocaleString()}円) を 
                        ${(reportData.totalAmount - THRESHOLD.LEVEL1).toLocaleString()}円 超過`;
                } else {
                    additionalInfo += `\n📊 しきい値内: 予算内で収まっています (目標: ${THRESHOLD.LEVEL1.toLocaleString()}円)`;
                }
            } else {
                additionalInfo = '対象期間内の利用はありません';
            }

            // 通知データを作成（レポートはアラート情報を含めない）
            const notification: MonthlyReportNotification = {
                title: `${year}年${month}月 マンスリーレポート`,
                period: formattedPeriod,
                totalAmount: reportData.totalAmount,
                totalCount: reportData.totalCount,
                alertLevel: 0, // 定期レポートではアラートレベルを使用しない
                additionalInfo,
            };

            // Discordに送信
            console.log('📤 マンスリーレポートを送信します...');
            const success = await this.discordNotifier.notifyMonthlyReport(notification);

            if (success) {
                await this.firestoreService.updateDocument(monthlyReportPath, {
                    hasReportSent: true,
                    lastUpdated: this.getServerTimestamp(),
                    lastUpdatedBy: 'monthly-report-schedule',
                });

                return {
                    success: true,
                    message: `マンスリーレポートを送信しました: ${year}年${month}月`,
                    data: notification,
                };
            } else {
                return {
                    success: false,
                    message: 'マンスリーレポートの送信に失敗しました',
                    data: notification,
                };
            }
        } catch (error) {
            const appError = error instanceof AppError ? error : new AppError(
                'マンスリーレポート送信中にエラーが発生しました',
                ErrorType.GENERAL,
                { year, month },
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
