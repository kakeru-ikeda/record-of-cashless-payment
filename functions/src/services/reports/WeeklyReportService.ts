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

            // ウィークリーレポートのパス (例: details/2023/09/term1)
            const reportsPath = `details/${year}/${month}/${term}`;

            // 既存のウィークリーレポートを取得
            const reportDoc = await this.firestoreService.getDocument<WeeklyReport>(reportsPath);

            let weeklyReport: WeeklyReport;

            if (!reportDoc) {
                // 新規レポート作成
                weeklyReport = {
                    totalAmount: data.amount,
                    totalCount: 1,
                    lastUpdated: this.getServerTimestamp(),
                    lastUpdatedBy: 'system',
                    documentIdList: [document.id],
                    termStartDate: this.getTimestampFromDate(dateInfo.weekStartDate),
                    termEndDate: this.getTimestampFromDate(dateInfo.weekEndDate),
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                };

                await this.firestoreService.saveDocument(reportsPath, weeklyReport);
                console.log('✅ ウィークリーレポート作成完了');
            } else {
                // 既存レポート更新
                weeklyReport = {
                    ...reportDoc,
                    totalAmount: reportDoc.totalAmount + data.amount,
                    totalCount: reportDoc.totalCount + 1,
                    lastUpdated: this.getServerTimestamp(),
                    lastUpdatedBy: 'system',
                    documentIdList: [...reportDoc.documentIdList, document.id],
                };

                await this.firestoreService.updateDocument(reportsPath, weeklyReport as any);
                console.log('✅ ウィークリーレポート更新完了');
            }

            // 通知条件チェック
            const { updated, alertLevel, updatedReport } =
                await this.checkAndNotify(weeklyReport, Number(term.replace('term', '')), year, month);

            // 通知フラグ更新
            if (updated) {
                console.log(`📢 アラートレベル${alertLevel}の通知フラグを更新`);
                await this.firestoreService.updateDocument(reportsPath, {
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
     * ウィークリーレポートの通知条件チェック
     * @param weeklyReport ウィークリーレポートデータ
     * @param weekNumber 週番号
     * @param year 年
     * @param month 月
     */
    private async checkAndNotify(
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
                    title: `${year}年${month}月 第${weekNumber}週 レポート`,
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
}
