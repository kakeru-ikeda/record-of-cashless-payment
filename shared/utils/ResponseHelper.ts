/**
 * API/Functions用の標準レスポンスインターフェイス
 */
export interface Response {
    status: number;
    success: boolean;
    message: string;
    data?: any;
}

/**
 * レスポンスヘルパークラス
 * 標準化されたレスポンス形式を簡単に生成するためのユーティリティ
 */
export class ResponseHelper {
    /**
     * 標準レスポンスオブジェクトを生成する
     * @param status ステータスコード
     * @param success 成功フラグ
     * @param message メッセージ
     * @param data レスポンスデータ（オプション）
     * @returns 標準化されたレスポンスオブジェクト
     */
    static createResponse(status: number, success: boolean, message: string, data?: any): Response {
        return { status, success, message, data };
    }

    /**
     * 成功レスポンスを生成する
     * @param message 成功メッセージ
     * @param data レスポンスデータ（オプション）
     * @returns 成功レスポンスオブジェクト
     */
    static success(message: string, data?: any): Response {
        return this.createResponse(200, true, message, data);
    }

    /**
     * エラーレスポンスを生成する
     * @param status ステータスコード（デフォルト: 500）
     * @param message エラーメッセージ
     * @param data エラー詳細データ（オプション）
     * @returns エラーレスポンスオブジェクト
     */
    static error(status: number = 500, message: string, data?: any): Response {
        return this.createResponse(status, false, message, data);
    }

    /**
     * 404エラーレスポンスを生成する
     * @param message エラーメッセージ（デフォルト: 'リソースが見つかりません'）
     * @returns 404エラーレスポンスオブジェクト
     */
    static notFound(message: string = 'リソースが見つかりません'): Response {
        return this.error(404, message);
    }

    /**
     * バリデーションエラーレスポンスを生成する
     * @param message エラーメッセージ（デフォルト: '入力データが不正です'）
     * @param errors バリデーションエラーの詳細
     * @returns 400エラーレスポンスオブジェクト
     */
    static validationError(message: string = '入力データが不正です', errors?: any): Response {
        return this.error(400, message, errors);
    }

    /**
     * 未認証エラーレスポンスを生成する
     * @param message エラーメッセージ（デフォルト: '認証が必要です'）
     * @param data エラー詳細データ（オプション）
     * @returns 401エラーレスポンスオブジェクト
     */
    static unauthorized(message: string = '認証が必要です', data?: any): Response {
        return this.error(401, message, data);
    }

    /**
     * トークン無効エラーレスポンスを生成する
     * @param message エラーメッセージ（デフォルト: '認証トークンが無効または期限切れです'）
     * @param data エラー詳細データ（オプション）
     * @returns 401エラーレスポンスオブジェクト
     */
    static invalidToken(message: string = '認証トークンが無効または期限切れです', data?: any): Response {
        return this.error(401, message, data);
    }

    /**
     * アクセス拒否エラーレスポンスを生成する
     * @param message エラーメッセージ（デフォルト: 'この操作を実行する権限がありません'）
     * @param data エラー詳細データ（オプション）
     * @returns 403エラーレスポンスオブジェクト
     */
    static forbidden(message: string = 'この操作を実行する権限がありません', data?: any): Response {
        return this.error(403, message, data);
    }
}