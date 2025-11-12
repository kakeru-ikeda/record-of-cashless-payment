import { CardUsage } from '../entities/CardUsage';

/**
 * カード利用情報の通知用オブジェクト（DTO）
 * Discordへの通知連携で使用される形式
 * - エンティティからの変換: Timestamp→文字列、内部フィールド除外
 */
export type CardUsageNotificationDTO = Omit<CardUsage, 'datetime_of_use' | 'created_at'> & {
    datetime_of_use: string;
};
