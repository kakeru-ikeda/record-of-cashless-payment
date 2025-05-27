import { CardUsage } from '@shared/domain/entities/CardUsage';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * CardUsageエンティティを生成するファクトリークラス
 */
export class CardUsageFactory {
    /**
     * 新しいCardUsageエンティティを作成する
     * @param card_name カード名
     * @param datetime_of_use 利用日時 (ISOフォーマット文字列)
     * @param amount 利用金額
     * @param where_to_use 利用場所
     * @param memo メモ (オプション)
     * @param is_active 有効フラグ (デフォルトはtrue)
     * @returns 新しいCardUsageエンティティ
     */
    static create(
        card_name: string,
        datetime_of_use: string,
        amount: number,
        where_to_use: string,
        memo?: string,
        is_active: boolean = true
    ): CardUsage {
        return {
            card_name,
            datetime_of_use: Timestamp.fromDate(new Date(datetime_of_use)),
            amount,
            where_to_use,
            memo,
            is_active,
            created_at: Timestamp.fromDate(new Date())
        };
    }

    /**
     * 既存のデータからCardUsageエンティティを復元する
     * (データベースから取得した値などを元にエンティティを作成する場合に使用)
     */
    static reconstruct(data: Partial<CardUsage> & {
        card_name: string,
        datetime_of_use: Timestamp,
        amount: number,
        where_to_use: string,
        created_at: Timestamp
    }): CardUsage {
        return {
            card_name: data.card_name,
            datetime_of_use: data.datetime_of_use,
            amount: data.amount,
            where_to_use: data.where_to_use,
            memo: data.memo,
            is_active: data.is_active ?? true,
            created_at: data.created_at
        };
    }
}