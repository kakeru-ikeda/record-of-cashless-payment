import { ResponseHelper } from '../../../../../shared/presentation/responses/ResponseHelper';
import { ErrorHandler } from '../../../../../shared/infrastructure/errors/ErrorHandler';
import { logger } from '../../../../../shared/infrastructure/logging/Logger';

/**
 * イベントハンドラーの基底クラス
 * 共通のエラーハンドリングとロギング機能を提供
 */
export abstract class BaseEventHandler<TEvent, TResult> {
    protected readonly handlerName: string;

    constructor(handlerName: string) {
        this.handlerName = handlerName;
    }

    /**
     * イベントを処理する（テンプレートメソッドパターン）
     */
    async handle(event: TEvent): Promise<TResult> {
        logger.info('処理開始', this.handlerName, {
            suppressConsole: false
        });

        try {
            // 前処理
            await this.beforeProcess(event);

            // メイン処理
            const result = await this.process(event);

            // 後処理
            await this.afterProcess(event, result);

            logger.info('処理完了', this.handlerName);
            return result;

        } catch (error) {
            logger.error(error as Error, this.handlerName);
            return await this.handleError(error);
        }
    }

    /**
     * 前処理（オーバーライド可能）
     */
    protected async beforeProcess(event: TEvent): Promise<void> {
        // デフォルト実装は何もしない
    }

    /**
     * メイン処理（サブクラスで実装必須）
     */
    protected abstract process(event: TEvent): Promise<TResult>;

    /**
     * 後処理（オーバーライド可能）
     */
    protected async afterProcess(event: TEvent, result: TResult): Promise<void> {
        // デフォルト実装は何もしない
    }

    /**
     * エラーハンドリング（オーバーライド可能）
     */
    protected async handleError(error: unknown): Promise<TResult> {
        return await ErrorHandler.handle(error, this.handlerName) as TResult;
    }

    /**
     * 成功レスポンスのヘルパー
     */
    protected createSuccessResponse(message: string, data: any = {}): any {
        return ResponseHelper.success(message, data);
    }
}
