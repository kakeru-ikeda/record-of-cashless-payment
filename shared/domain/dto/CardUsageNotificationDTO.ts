import { CardUsage } from '../entities/CardUsage';

/**
 * カード利用情報の通知用オブジェクト（DTO）
 * Discordへの通知連携で使用される形式
 * - エンティティからの変換: Timestamp→文字列、内部フィールド除外
 */
export type CardUsageNotificationDTO = Omit<CardUsage, 'datetime_of_use' | 'created_at'> & {
    datetime_of_use: string;
};

export type UpdateCardUsageRequest = Partial<CardUsageNotificationDTO> & { id: string };
export type UpdateCardUsageResponse = CardUsageNotificationDTO;
export type CreateCardUsageRequest = CardUsageNotificationDTO;
export type CreateCardUsageResponse = CardUsageNotificationDTO & { savedPath: string };
export type DeleteCardUsageRequest = { id: string };
export type DeleteCardUsageResponse = { success: boolean };
export type GetCardUsageRequest = { id: string };
export type GetCardUsageResponse = CardUsageNotificationDTO;

// Notifications関連のDTO
export type SendReportNotificationRequest = {
    type: string;
    reportData?: any;
    cardUsage?: CardUsage;
};

export type ProcessCardUsageNotificationRequest = {
    cardUsage: CardUsage;
};

// Reports関連のDTO
export type GenerateReportRequest = {
    date?: Date;
};

export type UpdateReportRequest = {
    operation: 'add' | 'update' | 'delete';
    cardUsage: CardUsage;
};

