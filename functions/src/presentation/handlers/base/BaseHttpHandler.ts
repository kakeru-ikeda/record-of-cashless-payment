import { Request, Response } from 'express';
import { BaseEventHandler } from './BaseEventHandler';
import { logger } from '../../../../../shared/infrastructure/logging/Logger';

/**
 * HTTPリクエストイベントハンドラーの基底クラス
 */
export abstract class BaseHttpHandler extends BaseEventHandler<{ req: Request; res: Response }, void> {
    constructor(handlerName: string) {
        super(handlerName);
    }

    /**
     * HTTPハンドラー用のメイン処理オーバーライド
     */
    async handle(event: { req: Request; res: Response }): Promise<void> {
        logger.info('HTTP処理開始', this.handlerName);

        try {
            // 前処理
            await this.beforeProcess(event);

            // メイン処理
            await this.processHttp(event.req, event.res);

            // 後処理
            await this.afterProcess(event, undefined);

            logger.info('HTTP処理完了', this.handlerName);
        } catch (error) {
            logger.error(error as Error, this.handlerName);
            await this.handleHttpError(error, event.res);
        }
    }

    /**
     * HTTPリクエスト処理（サブクラスで実装必須）
     */
    protected abstract processHttp(req: Request, res: Response): Promise<any>;

    /**
     * HTTPエラーハンドリング
     */
    protected async handleHttpError(error: unknown, res: Response): Promise<void> {
        const errorResponse = await this.handleError(error);
        res.status(500).json(errorResponse);
    }

    /**
     * process メソッドは使用しない（HTTPハンドラーでは processHttp を使用）
     */
    protected async process(event: { req: Request; res: Response }): Promise<void> {
        // 実装不要
    }
}
