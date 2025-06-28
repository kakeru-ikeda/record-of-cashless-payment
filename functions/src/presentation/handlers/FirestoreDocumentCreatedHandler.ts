import { BaseEventHandler } from './base/BaseEventHandler';
import { logger } from '../../../../shared/infrastructure/logging/Logger';
import { ProcessFirestoreDocumentUseCase } from '../../application/usecases/ProcessFirestoreDocumentUseCase';
import { FirestoreDocumentCreatedEvent } from '../../domain/types/FirebaseFunctionTypes';
import { Response } from '../../../../shared/presentation/responses/ResponseHelper';

/**
 * Firestoreドキュメント作成イベントハンドラー
 */
export class FirestoreDocumentCreatedHandler extends BaseEventHandler<FirestoreDocumentCreatedEvent, Response> {
    constructor(
        private readonly processUseCase: ProcessFirestoreDocumentUseCase
    ) {
        super('Firestore Document Created Handler');
    }

    /**
     * 前処理：パスバリデーション
     */
    protected async beforeProcess(event: FirestoreDocumentCreatedEvent): Promise<void> {
        const path = event.data?.ref.path;
        logger.debug(`ドキュメントパス: ${path}`, this.handlerName);

        // レポートドキュメントの場合は処理をスキップ
        if (path && path.includes('/reports')) {
            logger.warn('レポートドキュメントには処理をスキップします', this.handlerName);
            throw new SkipProcessingError('レポートドキュメントのため処理をスキップ');
        }
    }

    /**
     * メイン処理：ユースケースを実行
     */
    protected async process(event: FirestoreDocumentCreatedEvent): Promise<Response> {
        return await this.processUseCase.execute(event);
    }

    /**
     * エラーハンドリング：スキップエラー用の特別処理
     */
    protected async handleError(error: unknown): Promise<Response> {
        if (error instanceof SkipProcessingError) {
            return this.createSuccessResponse(error.message, {});
        }
        return await super.handleError(error);
    }
}

/**
 * 処理スキップ用の専用エラー
 */
class SkipProcessingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SkipProcessingError';
    }
}
