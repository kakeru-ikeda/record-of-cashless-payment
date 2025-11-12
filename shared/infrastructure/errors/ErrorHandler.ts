import { AppError, ErrorType } from '@shared/errors/AppError';
import { logger } from '@shared/infrastructure/logging/Logger';

/**
 * エラーハンドリングのためのユーティリティクラス
 * アプリケーション全体で統一されたエラー処理を提供します
 */
export class ErrorHandler {
    /**
     * イベント処理のエラーをハンドリング (Discord通知サポート)
     * @param error 発生したエラー
     * @param context エラーが発生したコンテキスト情報
     * @param options 追加オプション
     * @returns 正規化されたAppError
     */
    static async handle(
        error: any,
        context: string,
        options?: {
            suppressNotification?: boolean;
            additionalInfo?: Record<string, unknown>;
            defaultMessage?: string;
        }
    ): Promise<AppError> {
        // エラーの正規化
        const appError = error instanceof AppError
            ? error
            : this.convertToAppError(error, options?.defaultMessage, options?.additionalInfo);

        // 標準ロガーを使用
        logger.error(appError, context, {
            notify: !options?.suppressNotification,
        });

        return appError;
    }

    /**
     * エラーデコレータ - 非同期メソッドをラップしてエラー処理を追加
     * @param context エラーコンテキスト
     * @param options エラーハンドリングオプション
     */
    static errorDecorator(context: string, options?: {
        suppressNotification?: boolean; // Discord通知を抑制するかどうか
        defaultMessage?: string; // カスタムエラーメッセージ
        rethrow?: boolean; // エラーを再スローするかどうか
    }) {
        return function(
            _target: any,
            _propertyKey: string | symbol,
            descriptor: PropertyDescriptor
        ): PropertyDescriptor {
            const originalMethod = descriptor.value;
            if (!originalMethod) return descriptor;

            descriptor.value = async function(...args: any[]): Promise<any> {
                try {
                    return await originalMethod.apply(this, args);
                } catch (error) {
                    // エラー情報を抽出（引数から必要な情報を取り出す）
                    const additionalInfo = ErrorHandler.extractErrorInfoFromArgs(args);

                    // 拡張されたエラーハンドラを使用
                    const appError = await ErrorHandler.handle(error, context, {
                        ...options,
                        additionalInfo,
                    });

                    // 設定に応じてエラーを再スロー
                    if (options?.rethrow !== false) {
                        throw appError;
                    }

                    // エラーがスローされない場合は未定義を返す
                    return undefined;
                }
            };

            return descriptor;
        };
    }

    /**
     * 引数からエラー情報を抽出するヘルパー関数
     */
    static extractErrorInfoFromArgs(args: any[]): Record<string, unknown> {
        const info: Record<string, unknown> = {};

        // 引数からエラー情報に関連しそうなものを抽出
        for (const arg of args) {
            if (arg && typeof arg === 'object') {
                // メールに関する情報
                if ('subject' in arg) info.subject = arg.subject;
                if ('from' in arg) info.from = arg.from;
                if ('body' in arg && typeof arg.body === 'string') {
                    // 本文は長すぎる場合があるので先頭部分のみ
                    info.bodyPreview = arg.body.substring(0, 100);
                }

                // カード会社情報
                if ('cardCompany' in arg) info.cardCompany = arg.cardCompany;

                // その他の情報
                if ('id' in arg) info.id = arg.id;
                if ('uid' in arg) info.uid = arg.uid;
                if ('mailboxName' in arg) info.mailboxName = arg.mailboxName;
            }
        }

        return info;
    }

    /**
     * 様々な形式のエラーをAppErrorに変換する
     * @param error 元のエラー
     * @returns AppErrorインスタンス
     */
    static convertToAppError(
        error: any,
        customMessage?: string,
        additionalDetails?: Record<string, unknown>,
    ): AppError {
        // すでにAppErrorインスタンスならそのまま返す
        if (error instanceof AppError) {
            // 追加情報がある場合は新しいインスタンスを作成
            if (additionalDetails) {
                const mergedDetails = {
                    ...(typeof error.details === 'object' && error.details !== null ? error.details as Record<string, unknown> : {}),
                    ...additionalDetails
                };
                return new AppError(
                    customMessage || error.message,
                    error.type,
                    mergedDetails,
                    error.originalError
                );
            }
            return error;
        }

        // エラーオブジェクトの場合
        if (error instanceof Error) {
            // エラーの種類を推測
            const errorType = this.inferErrorType(error);
            return new AppError(
                customMessage || error.message || '不明なエラーが発生しました',
                errorType,
                additionalDetails || undefined,
                error
            );
        }

        // 文字列の場合
        if (typeof error === 'string') {
            return new AppError(
                customMessage || error,
                ErrorType.GENERAL,
                additionalDetails
            );
        }

        // オブジェクトの場合
        if (typeof error === 'object' && error !== null) {
            const message = customMessage || error.message || JSON.stringify(error);
            return new AppError(
                message,
                ErrorType.GENERAL,
                additionalDetails ? { ...error, ...additionalDetails } : error
            );
        }

        // その他の場合
        return new AppError(
            customMessage || '不明なエラーが発生しました',
            ErrorType.GENERAL,
            additionalDetails
        );
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
}
