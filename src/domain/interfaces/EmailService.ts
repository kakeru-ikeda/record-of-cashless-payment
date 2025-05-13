import { CardUsageNotification } from '../../../shared/domain/entities/CardUsageNotification';

/**
 * メールサービスのインターフェース
 */
export interface EmailService {
    /**
     * メール本文からカード利用情報を抽出する
     * @param emailContent メール本文
     * @returns カード利用情報
     */
    parseCardUsageFromEmail(emailContent: string): Promise<CardUsageNotification>;
}

