import { Request, Response } from 'express';
import { BaseHttpHandler } from '../base/BaseHttpHandler';
import { ProcessFirestoreDocumentUseCase } from '../../../application/usecases/ProcessFirestoreDocumentUseCase';
import { FirestoreDocumentCreatedEvent } from '../../../domain/types/FirebaseFunctionTypes';
import { logger } from '../../../../../shared/infrastructure/logging/Logger';
import { ResponseHelper } from '../../../../../shared/presentation/responses/ResponseHelper';

/**
 * Firestore ドキュメント処理のHTTPハンドラー
 * FirestoreDocumentCreatedHandlerと同じ処理をHTTP経由で実行可能にする
 */
export class ProcessFirestoreDocumentHttpHandler extends BaseHttpHandler {
    constructor(
        private readonly processUseCase: ProcessFirestoreDocumentUseCase
    ) {
        super('Process Firestore Document HTTP Handler');
    }

    /**
     * HTTPリクエスト処理
     */
    protected async processHttp(req: Request, res: Response): Promise<void> {
        // リクエストボディからFirestoreDocumentCreatedEventに必要な情報を取得
        const { path, data, year, month, term, day, timestamp } = req.body;

        if (!path) {
            const errorResponse = ResponseHelper.validationError('パスが指定されていません', {
                error: 'path is required in request body',
            });
            res.status(errorResponse.status).json(errorResponse);
            return;
        }

        logger.debug(`HTTP経由でFirestoreドキュメント処理を実行: ${path}`, this.handlerName);

        // レポートドキュメントの場合は処理をスキップ
        if (path.includes('/reports')) {
            logger.warn('レポートドキュメントには処理をスキップします', this.handlerName);
            const skipResponse = ResponseHelper.success('レポートドキュメントのため処理をスキップ', {});
            res.status(skipResponse.status).json(skipResponse);
            return;
        }

        // pathからパラメータを抽出するか、リクエストから取得
        let params: Record<string, string>;
        if (year && month && term && day && timestamp) {
            params = { year, month, term, day, timestamp };
        } else {
            // パスから抽出 (details/{year}/{month}/{term}/{day}/{timestamp})
            const pathParts = path.split('/');
            if (pathParts.length >= 6 && pathParts[0] === 'details') {
                params = {
                    year: pathParts[1],
                    month: pathParts[2],
                    term: pathParts[3],
                    day: pathParts[4],
                    timestamp: pathParts[5],
                };
            } else {
                const errorResponse = ResponseHelper.validationError('パスの形式が無効です', {
                    error: 'path must be in format: details/{year}/{month}/{term}/{day}/{timestamp}',
                });
                res.status(errorResponse.status).json(errorResponse);
                return;
            }
        }

        // FirestoreDocumentCreatedEventを模擬
        const mockEvent: FirestoreDocumentCreatedEvent = {
            data: {
                ref: {
                    path: path,
                },
                data: () => data || {},
            },
            params: params,
        } as any;

        try {
            const result = await this.processUseCase.execute(mockEvent);
            res.status(result.status).json(result);
        } catch (error) {
            logger.error(error as Error, this.handlerName);
            throw error; // BaseHttpHandlerのhandleHttpErrorで処理される
        }
    }
}
