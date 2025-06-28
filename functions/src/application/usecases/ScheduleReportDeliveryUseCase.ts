import { ResponseHelper, Response } from '../../../../shared/presentation/responses/ResponseHelper';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { logger } from '../../../../shared/infrastructure/logging/Logger';
import { ReportSchedulingService } from '../services/ReportSchedulingService';
import { ScheduleContext } from '../../domain/types/FirebaseFunctionTypes';

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
    async execute(context: ScheduleContext): Promise<Response> {
        logger.info('スケジュール配信処理開始', 'Schedule Report Delivery UseCase');
        logger.debug(`イベント: ${JSON.stringify(context)}`, 'Schedule Report Delivery UseCase');

        try {
            // ReportSchedulingServiceの統合メソッドを呼び出し
            await this.reportSchedulingService.executeScheduledReports();

            return ResponseHelper.success('スケジュール配信処理が完了しました', {
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            logger.error(error as Error, 'Schedule Report Delivery UseCase');
            throw new AppError(
                `スケジュール配信処理でエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
                ErrorType.GENERAL
            );
        }
    }
}
