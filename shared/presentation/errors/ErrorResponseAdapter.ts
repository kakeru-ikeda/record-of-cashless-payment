import { AppError, ErrorType } from '@shared/errors/AppError';
import { ResponseHelper } from '@shared/presentation/responses/ResponseHelper';

/**
 * エラーオブジェクトをHTTPレスポンスに変換するアダプタークラス
 * インフラ層のAppErrorをプレゼンテーション層のレスポンス形式に変換する
 */
export class ErrorResponseAdapter {
    /**
     * AppErrorをHTTPレスポンスオブジェクトに変換
     * @param appError 変換するAppErrorオブジェクト
     * @returns 適切に整形されたエラーレスポンス
     */
    static toResponse(appError: AppError): ReturnType<typeof ResponseHelper.error> {
        // エラータイプに基づいてHTTPステータスコードを決定
        const statusCode = this.mapErrorTypeToStatusCode(appError.type);

        return ResponseHelper.error(
            statusCode,
            appError.message,
            // 本番環境では詳細情報を含めない
            process.env.NODE_ENV !== 'production' ? appError.details : undefined
        );
    }

    /**
     * ErrorTypeをHTTPステータスコードにマッピング
     * @param errorType エラータイプ
     * @returns 対応するHTTPステータスコード
     */
    private static mapErrorTypeToStatusCode(errorType: ErrorType): number {
        switch (errorType) {
            case ErrorType.NOT_FOUND:
                return 404;
            case ErrorType.VALIDATION:
                return 400;
            case ErrorType.AUTHENTICATION:
                return 401;
            case ErrorType.AUTHORIZATION:
                return 403;
            case ErrorType.NETWORK:
            case ErrorType.EMAIL:
            case ErrorType.DISCORD:
            case ErrorType.FIREBASE:
            case ErrorType.DATA_ACCESS:
                return 502;
            case ErrorType.CONFIGURATION:
            case ErrorType.ENVIRONMENT:
                return 500;
            case ErrorType.GENERAL:
            default:
                return 500;
        }
    }
}