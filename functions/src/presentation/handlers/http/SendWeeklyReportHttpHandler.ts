import { Request, Response } from 'express';
import { BaseHttpHandler } from '../base/BaseHttpHandler';
import { ReportSchedulingService } from '../../../application/services/ReportSchedulingService';
import { DateUtil } from '../../../../../shared/utils/DateUtil';
import { logger } from '../../../../../shared/infrastructure/logging/Logger';
import { ResponseHelper } from '../../../../../shared/presentation/responses/ResponseHelper';

/**
 * 週次レポート送信処理のHTTPハンドラー
 * 特定の週次レポートを送信するためのテスト用エンドポイント
 */
export class SendWeeklyReportHttpHandler extends BaseHttpHandler {
    constructor(
        private readonly reportSchedulingService: ReportSchedulingService
    ) {
        super('Send Weekly Report HTTP Handler');
    }

    /**
     * HTTPリクエスト処理
     * リクエストボディから年、月、日を受け取り、該当する週次レポートを送信
     */
    protected async processHttp(req: Request, res: Response): Promise<void> {
        logger.debug('HTTP経由で週次レポート送信処理を実行', this.handlerName);

        const { year, month, day } = req.body;

        // バリデーション
        if (!year || !month || !day) {
            const errorResponse = ResponseHelper.validationError(
                'year, month, dayは必須パラメータです',
                { providedParams: { year, month, day } }
            );
            res.status(errorResponse.status).json(errorResponse);
            return;
        }

        try {
            // 指定された年月日からDateInfoを生成
            const targetDate = new Date(year, month - 1, day);
            const dateInfo = DateUtil.getDateInfo(targetDate);

            logger.info(
                `週次レポート送信テスト: ${year}年${month}月${day}日 (第${dateInfo.term}週) - ${dateInfo.year}/${dateInfo.month}/${dateInfo.day}`,
                this.handlerName
            );

            // 週次レポート送信
            await this.reportSchedulingService.sendWeeklyReport(dateInfo);

            const successResponse = ResponseHelper.success(
                '週次レポートを送信しました',
                {
                    year,
                    month,
                    day,
                    term: dateInfo.term,
                    targetDate: dateInfo,
                    timestamp: new Date().toISOString()
                }
            );

            res.status(successResponse.status).json(successResponse);

            logger.info('HTTP経由での週次レポート送信処理が正常に完了しました', this.handlerName);
        } catch (error) {
            logger.error(error as Error, this.handlerName);
            throw error; // BaseHttpHandlerのhandleHttpErrorで処理される
        }
    }
}
