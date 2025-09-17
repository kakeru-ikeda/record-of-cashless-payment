import { Request, Response } from 'express';
import { BaseHttpHandler } from '../base/BaseHttpHandler';
import { ReportRecalculationUseCase } from '../../../application/usecases/ReportRecalculationUseCase';
import { ReportRecalculationRequest } from '../../../domain/entities/ReportRecalculation';
import { logger } from '../../../../../shared/infrastructure/logging/Logger';
import { ResponseHelper } from '../../../../../shared/presentation/responses/ResponseHelper';

/**
 * レポート再集計HTTPハンドラー
 * HTTP経由でレポート再集計処理を実行
 */
export class ReportRecalculationHttpHandler extends BaseHttpHandler {
    constructor(
        private readonly recalculationUseCase: ReportRecalculationUseCase
    ) {
        super('Report Recalculation HTTP Handler');
    }

    /**
     * HTTPリクエスト処理
     */
    protected async processHttp(req: Request, res: Response): Promise<void> {
        // リクエストボディから再集計パラメータを取得
        const {
            startDate,
            endDate,
            reportTypes = ['daily', 'weekly', 'monthly'],
            executedBy = 'http-api',
            dryRun = false
        } = req.body;

        // バリデーション
        if (!startDate || !endDate) {
            const errorResponse = ResponseHelper.validationError('開始日と終了日が必要です', {
                error: 'startDate and endDate are required'
            });
            res.status(errorResponse.status).json(errorResponse);
            return;
        }

        let parsedStartDate: Date;
        let parsedEndDate: Date;

        try {
            parsedStartDate = new Date(startDate);
            parsedEndDate = new Date(endDate);
            
            if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
                throw new Error('無効な日付形式');
            }

            if (parsedStartDate > parsedEndDate) {
                throw new Error('開始日は終了日より前である必要があります');
            }

            // 90日を超える期間は制限
            const diffDays = Math.ceil((parsedEndDate.getTime() - parsedStartDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 90) {
                throw new Error('処理期間は90日以内にしてください');
            }
        } catch (error) {
            const errorResponse = ResponseHelper.validationError('日付の形式が正しくありません', {
                error: error instanceof Error ? error.message : String(error),
                example: '2025-01-01'
            });
            res.status(errorResponse.status).json(errorResponse);
            return;
        }

        // レポートタイプのバリデーション
        const validReportTypes = ['daily', 'weekly', 'monthly'];
        const invalidTypes = reportTypes.filter((type: string) => !validReportTypes.includes(type));
        if (invalidTypes.length > 0) {
            const errorResponse = ResponseHelper.validationError('無効なレポートタイプが含まれています', {
                invalidTypes,
                validTypes: validReportTypes
            });
            res.status(errorResponse.status).json(errorResponse);
            return;
        }

        const request: ReportRecalculationRequest = {
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            reportTypes,
            executedBy,
            dryRun
        };

        logger.info(`HTTP経由でレポート再集計を実行: ${startDate} - ${endDate}`, this.handlerName);
        logger.info(`レポートタイプ: ${reportTypes.join(', ')}, ドライラン: ${dryRun}`, this.handlerName);

        try {
            const result = await this.recalculationUseCase.execute(request);
            res.status(result.status).json(result);
        } catch (error) {
            logger.error(error as Error, this.handlerName);
            throw error; // BaseHttpHandlerのhandleHttpErrorで処理される
        }
    }
}
