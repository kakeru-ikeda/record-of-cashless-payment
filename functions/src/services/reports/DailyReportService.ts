import * as functions from 'firebase-functions';
import { BaseReportService } from './BaseReportService';
import { DailyReport } from '../../../../shared/types/reports/ReportTypes';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';

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
            const { year, month, term, day } = params;

            // デイリーレポートのパス
            const dailyReportPath = `details/${year}/${month}/${term}/${day}/reports`;
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

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
}
