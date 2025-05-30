import { ErrorType } from '@shared/errors/AppError';

/**
 * ErrorTypeをHTTPステータスコードにマッピングする責務
 */
export class ErrorTypeMapper {
    /**
     * ErrorTypeをHTTPステータスコードにマッピング
     * @param errorType エラータイプ
     * @returns 対応するHTTPステータスコード
     */
    static toHttpStatusCode(errorType: ErrorType): number {
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