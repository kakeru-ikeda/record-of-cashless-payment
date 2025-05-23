/**
 * アプリケーションエラーの種類を定義する列挙型
 */
export enum ErrorType {
    // 一般的なエラー
    GENERAL = 'GENERAL_ERROR',

    // 認証・認可関連
    AUTHENTICATION = 'AUTHENTICATION_ERROR',
    AUTHORIZATION = 'AUTHORIZATION_ERROR',

    // 入力検証関連
    VALIDATION = 'VALIDATION_ERROR',

    // データ関連
    NOT_FOUND = 'NOT_FOUND_ERROR',
    DUPLICATE = 'DUPLICATE_ERROR',
    DATA_ACCESS = 'DATA_ACCESS_ERROR',

    // 外部サービス関連
    FIREBASE = 'FIREBASE_ERROR',
    EMAIL = 'EMAIL_ERROR',
    DISCORD = 'DISCORD_ERROR',
    NETWORK = 'NETWORK_ERROR',

    // 設定・環境関連
    CONFIGURATION = 'CONFIGURATION_ERROR',
    ENVIRONMENT = 'ENVIRONMENT_ERROR',
}

/**
 * HTTP ステータスコードとエラータイプのマッピング
 */
export const ErrorStatusMap: Record<ErrorType, number> = {
    [ErrorType.GENERAL]: 500,
    [ErrorType.AUTHENTICATION]: 401,
    [ErrorType.AUTHORIZATION]: 403,
    [ErrorType.VALIDATION]: 400,
    [ErrorType.NOT_FOUND]: 404,
    [ErrorType.DUPLICATE]: 409,
    [ErrorType.DATA_ACCESS]: 500,
    [ErrorType.FIREBASE]: 500,
    [ErrorType.EMAIL]: 500,
    [ErrorType.DISCORD]: 500,
    [ErrorType.NETWORK]: 503,
    [ErrorType.CONFIGURATION]: 500,
    [ErrorType.ENVIRONMENT]: 500,
};

/**
 * アプリケーションで発生するエラーを表すベースクラス
 */
export class AppError extends Error {
    readonly type: ErrorType;
    readonly statusCode: number;
    readonly details?: any;
    readonly originalError?: Error;

    /**
     * @param message エラーメッセージ
     * @param type エラーの種類
     * @param details エラーの詳細情報（オプション）
     * @param originalError 元のエラーオブジェクト（オプション）
     */
    constructor(
        message: string,
        type: ErrorType = ErrorType.GENERAL,
        details?: any,
        originalError?: Error
    ) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.statusCode = ErrorStatusMap[type];
        this.details = details;
        this.originalError = originalError;

        // Errorオブジェクトのスタックトレースを正しく維持する
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * エラーオブジェクトをログ出力用の文字列に変換する
     * @returns ログ出力用の文字列
     */
    toLogString(): string {
        const parts = [
            `[${this.type}] ${this.message}`,
            this.details ? `詳細: ${JSON.stringify(this.details)}` : '',
            this.originalError ? `元のエラー: ${this.originalError.message}` : '',
            this.stack ? `スタックトレース: ${this.stack}` : ''
        ];

        return parts.filter(Boolean).join('\n');
    }

    /**
     * エラーオブジェクトをJSON形式に変換する
     * @returns JSON形式のエラー情報
     */
    toJSON(): Record<string, any> {
        return {
            type: this.type,
            message: this.message,
            statusCode: this.statusCode,
            details: this.details,
            stack: process.env.NODE_ENV !== 'production' ? this.stack : undefined
        };
    }
}