import { Request, Response } from 'express';
import { BaseHttpHandler } from '../base/BaseHttpHandler';
import { ScheduleReportDeliveryUseCase } from '../../../application/usecases/ScheduleReportDeliveryUseCase';
import { ScheduleContext } from '../../../domain/types/FirebaseFunctionTypes';
import { logger } from '../../../../../shared/infrastructure/logging/Logger';

/**
 * 日次レポートスケジュール処理のHTTPハンドラー
 * DailyReportScheduleHandlerと同じ処理をHTTP経由で実行可能にする
 */
export class DailyReportScheduleHttpHandler extends BaseHttpHandler {
    constructor(
        private readonly scheduleUseCase: ScheduleReportDeliveryUseCase
    ) {
        super('Daily Report Schedule HTTP Handler');
    }

    /**
     * HTTPリクエスト処理
     */
    protected async processHttp(req: Request, res: Response): Promise<void> {
        logger.debug('HTTP経由で日次レポートスケジュール処理を実行', this.handlerName);

        // ScheduleContextを模擬（Firebase Schedulerのcontextを模擬）
        const mockContext: ScheduleContext = {
            timestamp: new Date().toISOString(),
            eventId: `http-trigger-${Date.now()}`,
            resource: 'projects/*/locations/*/functions/dailyReportSchedule'
        } as any;

        try {
            const result = await this.scheduleUseCase.execute(mockContext);
            res.status(result.status).json(result);

            logger.info('HTTP経由での日次レポートスケジュール処理が正常に完了しました', this.handlerName);
        } catch (error) {
            logger.error(error as Error, this.handlerName);
            throw error; // BaseHttpHandlerのhandleHttpErrorで処理される
        }
    }
}
