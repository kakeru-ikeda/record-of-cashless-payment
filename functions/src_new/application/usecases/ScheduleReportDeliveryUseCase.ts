import * as functions from 'firebase-functions';
import { ResponseHelper } from '../../../../shared/presentation/responses/ResponseHelper';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { ReportSchedulingService } from '../services/ReportSchedulingService';

/**
 * スケジュールレポート配信ユースケース
 * 定期的なレポート配信のビジネスロジックを管理
 */
export class ScheduleReportDeliveryUseCase {
    constructor(
        private readonly reportSchedulingService: ReportSchedulingService
    ) { }

    /**
     * スケジュール配信イベントを処理
     */
    async execute(context): Promise<any> {
        console.log('📅 スケジュール配信処理開始 - イベント:', context);

        try {
            // ReportSchedulingServiceの統合メソッドを呼び出し
            await this.reportSchedulingService.executeScheduledReports();

            return ResponseHelper.success('スケジュール配信処理が完了しました', {
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ スケジュール配信処理でエラーが発生:', error);
            throw new AppError(
                `スケジュール配信処理でエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                ErrorType.GENERAL
            );
        }
    }
}
