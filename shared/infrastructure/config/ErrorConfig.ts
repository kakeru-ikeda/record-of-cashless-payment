/**
 * エラーレスポンスの設定管理
 */
export class ErrorConfig {
    /**
     * エラー詳細情報を含めるかどうかを判定
     * @returns 詳細情報を含める場合はtrue
     */
    static shouldIncludeDetails(): boolean {
        return process.env.NODE_ENV !== 'production';
    }
}