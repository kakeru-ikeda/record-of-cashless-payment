/**
 * Discord通知用のデータモデル
 */
export interface CardUsageNotification {
    card_name: string;
    datetime_of_use: string;
    amount: number;
    where_to_use: string;
    memo?: string; // メモ（オプション）
    is_active?: boolean; // 有効かどうか（非表示フラグ）
}