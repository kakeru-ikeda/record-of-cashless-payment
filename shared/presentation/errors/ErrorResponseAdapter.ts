import { AppError } from '@shared/errors/AppError';
import { ResponseHelper } from '@shared/presentation/responses/ResponseHelper';
import { ErrorTypeMapper } from '@shared/infrastructure/mappers/ErrorTypeMapper';
import { ErrorConfig } from '@shared/infrastructure/config/ErrorConfig';

/**
 * エラーオブジェクトをHTTPレスポンスに変換するアダプタークラス
 * プレゼンテーション層でのレスポンス形式統一に特化
 */
export class ErrorResponseAdapter {
    /**
     * AppErrorをHTTPレスポンスオブジェクトに変換
     * @param appError 変換するAppErrorオブジェクト
     * @returns 適切に整形されたエラーレスポンス
     */
    static toResponse(appError: AppError): ReturnType<typeof ResponseHelper.error> {
        const statusCode = ErrorTypeMapper.toHttpStatusCode(appError.type);
        const details = ErrorConfig.shouldIncludeDetails() ? appError.details : undefined;

        return ResponseHelper.error(statusCode, appError.message, details);
    }
}