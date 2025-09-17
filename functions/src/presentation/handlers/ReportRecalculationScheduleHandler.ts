import { BaseEventHandler } from './base/BaseEventHandler';
import { ScheduleContext } from '../../domain/types/FirebaseFunctionTypes';
import { ReportRecalculationUseCase } from '../../application/usecases/ReportRecalculationUseCase';
import { ReportRecalculationRequest } from '../../domain/entities/ReportRecalculation';
import { Response } from '../../../../shared/presentation/responses/ResponseHelper';
import { logger } from '../../../../shared/infrastructure/logging/Logger';

/**
 * レポート再集計スケジュールハンドラー
 * 定期実行でレポート再集計を行う
 */
export class ReportRecalculationScheduleHandler extends BaseEventHandler<ScheduleContext, Response> {
    constructor(
        private readonly recalculationUseCase: ReportRecalculationUseCase
    ) {
        super('Report Recalculation Schedule Handler');
    }

    /**
     * 前処理：ログ出力
     */
    protected async beforeProcess(context: ScheduleContext): Promise<void> {
        logger.info('定期レポート再集計処理を開始します', this.handlerName);
        logger.debug(`スケジュールイベント詳細: ${JSON.stringify(context)}`, this.handlerName);
    }

    /**
     * メイン処理：レポート再集計を実行
     */
    protected async process(context: ScheduleContext): Promise<Response> {
        // デフォルトでは過去7日間のデータを再集計
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);

        const request: ReportRecalculationRequest = {
            startDate,
            endDate,
            reportTypes: ['daily', 'weekly', 'monthly'],
            executedBy: 'scheduled-task',
            dryRun: false
        };

        logger.info(`定期再集計実行: ${startDate.toISOString()} - ${endDate.toISOString()}`, this.handlerName);

        return await this.recalculationUseCase.execute(request);
    }
}
