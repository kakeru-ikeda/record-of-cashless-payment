import * as functions from 'firebase-functions';
import { BaseReportService } from './BaseReportService';
import { DailyReport } from '../../../../shared/types/reports/ReportTypes';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { DateUtil } from '../../../../shared/utils/DateUtil';
import { DailyReportNotification } from '../../../../shared/types/reports/ReportNotifications';

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
                    documentIdList: [document.id],
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
                    documentIdList: [...existingReport.documentIdList, document.id],
                };

                await this.firestoreService.updateDocument(dailyReportPath, dailyReport as any);
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
