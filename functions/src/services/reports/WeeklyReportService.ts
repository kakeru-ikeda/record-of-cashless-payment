import * as functions from 'firebase-functions';
import { BaseReportService } from './BaseReportService';
import { WeeklyReport, THRESHOLD } from '../../../../shared/types/reports/ReportTypes';
import { DateUtil } from '../../../../shared/utils/DateUtil';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { WeeklyReportNotification } from '../../../../shared/types/reports/ReportNotifications';

/**
 * ウィークリーレポート処理サービス
 */
export class WeeklyReportService extends BaseReportService {
    /**
     * ウィークリーレポート処理
     * @param document Firestoreドキュメント
     * @param data ドキュメントデータ
     * @param params パスパラメータ（year, month, term, day）
     */
    async processReport(
        document: functions.firestore.DocumentSnapshot,
        data: any,
        params: Record<string, string>
    ): Promise<WeeklyReport> {
        try {
            const { year, month, term } = params;
            const dateInfo = DateUtil.getCurrentDateInfo();

            // DateUtilを使用してパスを取得
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1); // 月の初日を使用
            const pathInfo = DateUtil.getFirestorePath(dateObj);
            const weeklyReportPath = pathInfo.weekReportPath;

            // ドキュメントのフルパスを生成
            const documentFullPath = document.ref.path;

            // 既存のウィークリーレポートを取得
            const reportDoc = await this.firestoreService.getDocument<WeeklyReport>(weeklyReportPath);

            let weeklyReport: WeeklyReport;

            if (!reportDoc) {
                // 新規レポート作成
                weeklyReport = {
                    totalAmount: data.amount,
                    totalCount: 1,
                    lastUpdated: this.getServerTimestamp(),
                    lastUpdatedBy: 'system',
                    documentIdList: [documentFullPath], // フルパスを使用
                    termStartDate: this.getTimestampFromDate(dateInfo.weekStartDate),
                    termEndDate: this.getTimestampFromDate(dateInfo.weekEndDate),
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                    hasReportSent: false,
                };

                await this.firestoreService.saveDocument(weeklyReportPath, weeklyReport);
                console.log(`✅ ウィークリーレポート作成完了: ${weeklyReportPath}`);
            } else {
                // 既存レポート更新
                weeklyReport = {
                    ...reportDoc,
                    totalAmount: reportDoc.totalAmount + data.amount,
                    totalCount: reportDoc.totalCount + 1,
                    lastUpdated: this.getServerTimestamp(),
                    lastUpdatedBy: 'system',
                    documentIdList: [...reportDoc.documentIdList, documentFullPath], // フルパスを追加
                };

                await this.firestoreService.updateDocument(weeklyReportPath, weeklyReport);
                console.log(`✅ ウィークリーレポート更新完了: ${weeklyReportPath}`);
            }

            // アラート条件チェック（しきい値超過時のアラート）
            const { updated, alertLevel, updatedReport } =
                await this.checkAndSendAlert(weeklyReport, Number(term.replace('term', '')), year, month);

            // 通知フラグ更新
            if (updated) {
                console.log(`📢 アラートレベル${alertLevel}の通知フラグを更新`);
                await this.firestoreService.updateDocument(weeklyReportPath, {
                    hasNotifiedLevel1: updatedReport.hasNotifiedLevel1,
                    hasNotifiedLevel2: updatedReport.hasNotifiedLevel2,
                    hasNotifiedLevel3: updatedReport.hasNotifiedLevel3,
                });
            }

            return updatedReport;
        } catch (error) {
            const appError = error instanceof AppError ? error : new AppError(
                'ウィークリーレポート処理中にエラーが発生しました',
                ErrorType.GENERAL,
                params,
                error instanceof Error ? error : undefined
            );

            console.error('❌ ' + appError.toLogString());
            throw appError;
        }
    }

    /**
     * ウィークリーレポートのアラート条件チェック（しきい値超過時の通知）
     * @param weeklyReport ウィークリーレポートデータ
     * @param weekNumber 週番号
     * @param year 年
     * @param month 月
     */
    private async checkAndSendAlert(
        weeklyReport: WeeklyReport,
        weekNumber: number,
        year: string,
        month: string
    ): Promise<{ updated: boolean; alertLevel: number; updatedReport: WeeklyReport }> {
        if (!this.discordNotifier) {
            console.log('📝 通知モジュールが設定されていないため通知をスキップ');
            return { updated: false, alertLevel: 0, updatedReport: weeklyReport };
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
                    title: `${year}年${month}月 第${weekNumber}週 アラート`,
                    period: formattedPeriod,
                    totalAmount: weeklyReport.totalAmount,
                    totalCount: weeklyReport.totalCount,
                    alertLevel,
                    additionalInfo,
                };

                try {
                    await this.discordNotifier.notifyWeeklyReport(notification);
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
                'ウィークリーレポート通知処理中にエラーが発生しました',
                ErrorType.GENERAL,
                { year, month, weekNumber },
                error instanceof Error ? error : undefined
            );

            console.error('❌ ' + appError.toLogString());
            return { updated: false, alertLevel: 0, updatedReport: weeklyReport };
        }
    }

    /**
     * ウィークリーレポートを取得してDiscordに定期レポートとして送信する
     * 毎週月曜日0時に自動実行される定期タスクから呼び出される
     * または、月をまたぐ場合は月末に送信される
     * @param year 年
     * @param month 月
     * @param term 期間（週）識別子 (例: "term1")
     * @returns 処理結果
     */
    async sendWeeklyReport(
        year: string,
        month: string,
        term: string
    ): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            if (!this.discordNotifier) {
                return {
                    success: false,
                    message: 'Discord通知モジュールが設定されていないためスキップしました',
                };
            }

            // DateUtilを使用してパスを取得
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1); // 月の初日を使用
            const pathInfo = DateUtil.getFirestorePath(dateObj);
            const weeklyReportPath = pathInfo.weekReportPath;

            // レポートデータを取得
            const reportData = await this.firestoreService.getDocument<WeeklyReport>(weeklyReportPath);

            if (!reportData) {
                return {
                    success: false,
                    message: `ウィークリーレポートが存在しません: ${weeklyReportPath}`,
                };
            }

            // 既にレポートを送信済みの場合はスキップ
            if (reportData.hasReportSent) {
                return {
                    success: true,
                    message: `ウィークリーレポートは既に送信済みです: ${weeklyReportPath}`,
                    data: reportData,
                };
            }

            // 日付整形
            const startDate = reportData.termStartDate.toDate();
            const endDate = reportData.termEndDate.toDate();
            const formattedPeriod = DateUtil.formatDateRange(startDate, endDate, 'yyyy/MM/dd');

            // 週番号を取得
            const weekNumber = Number(term.replace('term', ''));

            // 追加情報を計算
            let additionalInfo = '';
            if (reportData.totalCount > 0) {
                additionalInfo = `平均支出: 
                    ${Math.round(reportData.totalAmount / reportData.totalCount).toLocaleString()}円/件`;

                // しきい値との比較情報を追加
                if (reportData.totalAmount > THRESHOLD.LEVEL3) {
                    additionalInfo += `\nしきい値超過: レベル3 (${THRESHOLD.LEVEL3.toLocaleString()}円) を 
                        ${(reportData.totalAmount - THRESHOLD.LEVEL3).toLocaleString()}円 超過`;
                } else if (reportData.totalAmount > THRESHOLD.LEVEL2) {
                    additionalInfo += `\nしきい値超過: レベル2 (${THRESHOLD.LEVEL2.toLocaleString()}円) を 
                        ${(reportData.totalAmount - THRESHOLD.LEVEL2).toLocaleString()}円 超過`;
                } else if (reportData.totalAmount > THRESHOLD.LEVEL1) {
                    additionalInfo += `\nしきい値超過: レベル1 (${THRESHOLD.LEVEL1.toLocaleString()}円) を 
                        ${(reportData.totalAmount - THRESHOLD.LEVEL1).toLocaleString()}円 超過`;
                } else {
                    additionalInfo += `\nしきい値内: 予算内で収まっています (目標: ${THRESHOLD.LEVEL1.toLocaleString()}円)`;
                }
            } else {
                additionalInfo = '対象期間内の利用はありません';
            }

            // 通知データを作成（レポートはアラート情報を含めない）
            const notification: WeeklyReportNotification = {
                title: `${year}年${month}月 第${weekNumber}週 レポート`,
                period: formattedPeriod,
                totalAmount: reportData.totalAmount,
                totalCount: reportData.totalCount,
                alertLevel: 0, // 定期レポートではアラートレベルを使用しない
                additionalInfo,
            };

            // Discordに送信
            console.log('📤 ウィークリーレポートを送信します...');
            const success = await this.discordNotifier.notifyWeeklyReport(notification);

            if (success) {
                await this.firestoreService.updateDocument(weeklyReportPath, {
                    hasReportSent: true,
                    lastUpdated: this.getServerTimestamp(),
                    lastUpdatedBy: 'weekly-report-schedule',
                });

                return {
                    success: true,
                    message: `ウィークリーレポートを送信しました: ${year}年${month}月 第${weekNumber}週`,
                    data: notification,
                };
            } else {
                return {
                    success: false,
                    message: 'ウィークリーレポートの送信に失敗しました',
                    data: notification,
                };
            }
        } catch (error) {
            const appError = error instanceof AppError ? error : new AppError(
                'ウィークリーレポート送信中にエラーが発生しました',
                ErrorType.GENERAL,
                { year, month, term },
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
