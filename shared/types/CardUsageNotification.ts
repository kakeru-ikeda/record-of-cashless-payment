import { CardUsage } from './CardUsage';

/**
 * Discord通知用のデータモデル
 * CardUsageエンティティからcreated_atを除外し、datetime_of_useを文字列型に変更
 */
export type CardUsageNotification = Omit<CardUsage, 'datetime_of_use' | 'created_at'> & {
    datetime_of_use: string;
};