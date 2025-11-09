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
        // eslint-disable-next-line camelcase
        card_name: string,
        // eslint-disable-next-line camelcase
        datetime_of_use: string,
        amount: number,
        // eslint-disable-next-line camelcase
        where_to_use: string,
        memo?: string,
        // eslint-disable-next-line camelcase
        is_active = true,
    ): CardUsage {
        /* eslint-disable camelcase */
        return {
            card_name,
            datetime_of_use: Timestamp.fromDate(new Date(datetime_of_use)),
            amount,
            where_to_use,
            memo,
            is_active,
            created_at: Timestamp.fromDate(new Date()),
        };
        /* eslint-enable camelcase */
    }

    /**
     * 既存のデータからCardUsageエンティティを復元する
     * (データベースから取得した値などを元にエンティティを作成する場合に使用)
     */
    static reconstruct(data: Partial<CardUsage> & {
        // eslint-disable-next-line camelcase
        card_name: string,
        // eslint-disable-next-line camelcase
        datetime_of_use: Timestamp,
        amount: number,
        // eslint-disable-next-line camelcase
        where_to_use: string,
        // eslint-disable-next-line camelcase
        created_at: Timestamp,
    }): CardUsage {
        /* eslint-disable camelcase */
        return {
            card_name: data.card_name,
            datetime_of_use: data.datetime_of_use,
            amount: data.amount,
            where_to_use: data.where_to_use,
            memo: data.memo,
            is_active: data.is_active ?? true,
            created_at: data.created_at,
        };
        /* eslint-enable camelcase */
    }
}
