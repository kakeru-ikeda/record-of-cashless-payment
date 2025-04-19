import { AppError, ErrorType } from './AppError';
import { ResponseHelper } from '../utils/ResponseHelper';

/**
 * エラーハンドリングのためのユーティリティクラス
 * アプリケーション全体で統一されたエラー処理を提供します
 */
export class ErrorHandler {
    /**
     * エラーをキャッチして適切に処理する
     * @param error 発生したエラー
     * @param context エラーが発生したコンテキスト情報
     * @returns 標準化されたレスポンスオブジェクト
     */
    static handle(error: any, context: string = '不明なコンテキスト'): ReturnType<typeof ResponseHelper.error> {
        // すでにAppErrorインスタンスならそのまま使用
        const appError = error instanceof AppError
            ? error
            : this.convertToAppError(error);

        // エラーをログに出力
        this.logError(appError, context);

        // エラーに対応するレスポンスを生成
        return ResponseHelper.error(
            appError.statusCode,
            appError.message,
            process.env.NODE_ENV !== 'production' ? appError.details : undefined
        );
    }

    /**
     * 様々な形式のエラーをAppErrorに変換する
     * @param error 元のエラー
     * @returns AppErrorインスタンス
     */
    static convertToAppError(error: any): AppError {
        // すでにAppErrorインスタンスならそのまま返す
        if (error instanceof AppError) {
            return error;
        }

        // エラーオブジェクトの場合
        if (error instanceof Error) {
            // エラーの種類を推測
            const errorType = this.inferErrorType(error);
            return new AppError(
                error.message || '不明なエラーが発生しました',
                errorType,
                undefined,
                error
            );
        }

        // 文字列の場合
        if (typeof error === 'string') {
            return new AppError(error);
        }

        // オブジェクトの場合
        if (typeof error === 'object' && error !== null) {
            const message = error.message || JSON.stringify(error);
            return new AppError(message, ErrorType.GENERAL, error);
        }

        // その他の場合
        return new AppError('不明なエラーが発生しました');
    }

    /**
     * エラーの内容からエラータイプを推測する
     * @param error エラーオブジェクト
     * @returns 推測されたエラータイプ
     */
    private static inferErrorType(error: Error): ErrorType {
        const errorName = error.name?.toLowerCase() || '';
        const errorMessage = error.message?.toLowerCase() || '';

        // Firebase関連のエラー
        if (
            errorName.includes('firebase') ||
            errorName.includes('firestore') ||
            errorMessage.includes('firebase') ||
            errorMessage.includes('firestore')
        ) {
            return ErrorType.FIREBASE;
        }

        // ネットワーク関連のエラー
        if (
            errorName.includes('network') ||
            errorName.includes('connection') ||
            errorName.includes('timeout') ||
            errorMessage.includes('network') ||
            errorMessage.includes('connection') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('econnrefused')
        ) {
            return ErrorType.NETWORK;
        }

        // 認証関連のエラー
        if (
            errorName.includes('auth') ||
            errorMessage.includes('auth') ||
            errorMessage.includes('permission') ||
            errorMessage.includes('credential')
        ) {
            return ErrorType.AUTHENTICATION;
        }

        // データ関連のエラー
        if (
            errorName.includes('not found') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('missing') ||
            errorMessage.includes('存在しません')
        ) {
            return ErrorType.NOT_FOUND;
        }

        // 検証エラー
        if (
            errorName.includes('validation') ||
            errorMessage.includes('validation') ||
            errorMessage.includes('invalid') ||
            errorMessage.includes('不正な')
        ) {
            return ErrorType.VALIDATION;
        }

        // メール関連のエラー
        if (
            errorName.includes('mail') ||
            errorName.includes('email') ||
            errorName.includes('imap') ||
            errorMessage.includes('mail') ||
            errorMessage.includes('email') ||
            errorMessage.includes('imap')
        ) {
            return ErrorType.EMAIL;
        }

        // Discord関連のエラー
        if (
            errorName.includes('discord') ||
            errorMessage.includes('discord') ||
            errorMessage.includes('webhook')
        ) {
            return ErrorType.DISCORD;
        }

        // その他のエラーは一般エラーとして扱う
        return ErrorType.GENERAL;
    }

    /**
     * エラーをログに出力する
     * @param appError AppErrorオブジェクト
     * @param context エラーが発生したコンテキスト
     */
    private static logError(appError: AppError, context: string): void {
        const errorLog = `
======================================
エラー発生: ${new Date().toISOString()}
コンテキスト: ${context}
${appError.toLogString()}
======================================
`;

        // エラーの重大度に応じてログ出力
        if (
            appError.type === ErrorType.GENERAL ||
            appError.type === ErrorType.FIREBASE ||
            appError.type === ErrorType.DATA_ACCESS ||
            appError.type === ErrorType.NETWORK ||
            appError.type === ErrorType.CONFIGURATION ||
            appError.type === ErrorType.ENVIRONMENT
        ) {
            console.error(errorLog);
        } else {
            console.warn(errorLog);
        }
    }

    /**
     * エラーを非同期関数内で安全に処理するためのラッパー
     * @param fn 実行する非同期関数
     * @param context エラーコンテキスト
     * @returns 処理結果またはエラーレスポンス
     */
    static async handleAsync<T>(
        fn: () => Promise<T>,
        context: string = '不明なコンテキスト'
    ): Promise<T | ReturnType<typeof ResponseHelper.error>> {
        try {
            return await fn();
        } catch (error) {
            return this.handle(error, context);
        }
    }

    /**
     * 特定のエラータイプに対するエラーインスタンスを作成する
     * @param type エラータイプ
     * @param message エラーメッセージ
     * @param details エラー詳細（オプション）
     * @returns AppErrorインスタンス
     */
    static createError(type: ErrorType, message: string, details?: any): AppError {
        return new AppError(message, type, details);
    }

    /**
     * 特定の例外をスローする
     * @param type エラータイプ
     * @param message エラーメッセージ
     * @param details エラー詳細（オプション）
     * @throws AppError
     */
    static throwError(type: ErrorType, message: string, details?: any): never {
        throw this.createError(type, message, details);
    }
}