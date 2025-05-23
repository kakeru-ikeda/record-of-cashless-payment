import { Timestamp } from "firebase-admin/firestore";

/**
 * カード利用情報を表すエンティティ
 */
export interface CardUsage {
    // 利用カード名
    card_name: string;

    // 利用日時
    datetime_of_use: Timestamp;

    // 利用金額
    amount: number;

    // 利用場所
    where_to_use: string;

    // メモ（オプション）
    memo?: string;

    // 有効かどうか（非表示フラグ）
    is_active?: boolean;

    // データ作成日時
    created_at: Timestamp;
}
