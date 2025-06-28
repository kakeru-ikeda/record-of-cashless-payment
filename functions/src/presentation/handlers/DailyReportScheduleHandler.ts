import { BaseEventHandler } from './base/BaseEventHandler';
import { logger } from '../../../../shared/infrastructure/logging/Logger';
import { ScheduleReportDeliveryUseCase } from '../../application/usecases/ScheduleReportDeliveryUseCase';
import { ScheduleContext } from '../../domain/types/FirebaseFunctionTypes';
import { Response } from '../../../../shared/presentation/responses/ResponseHelper';

/**
 * 日次レポートスケジュールイベントハンドラー
 */
export class DailyReportScheduleHandler extends BaseEventHandler<ScheduleContext, Response> {
    constructor(
        private readonly scheduleUseCase: ScheduleReportDeliveryUseCase
    ) {
        super('Daily Report Schedule Handler');
    }

    /**
     * 前処理：イベント情報のログ出力
     */
    protected async beforeProcess(context: ScheduleContext): Promise<void> {
        logger.debug(`スケジュールイベント実行時刻: ${new Date().toISOString()}`, this.handlerName);
        logger.debug(`イベントコンテキスト: ${JSON.stringify(context)}`, this.handlerName);
    }

    /**
     * メイン処理：スケジュール配信ユースケースを実行
     */
    protected async process(context: ScheduleContext): Promise<Response> {
        return await this.scheduleUseCase.execute(context);
    }

    /**
     * 後処理：処理完了ログ
     */
    protected async afterProcess(context: ScheduleContext, result: Response): Promise<void> {
        logger.info('スケジュール配信処理が正常に完了しました', this.handlerName);
    }
}
