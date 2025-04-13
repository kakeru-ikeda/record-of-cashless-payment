/**
 * Discord通知用のデータモデル
 */
export interface CardUsageNotification {
    card_name: string;
    datetime_of_use: string;
    amount: number;
    where_to_use: string;
}