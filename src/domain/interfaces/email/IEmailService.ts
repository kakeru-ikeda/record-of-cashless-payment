import { ParsedEmail } from '../../../infrastructure/email/EmailParser';
import { CardUsageNotification } from '../../../../shared/domain/entities/CardUsageNotification';
import { CardCompany } from '../../../infrastructure/email/CardUsageExtractor';

/**
 * メールサービスのインターフェース
 * ドメイン層がメールサービスとやり取りするために必要な機能を定義
 */
export interface IEmailService {
    /**
     * IMAPサーバーに接続し、メールの監視を開始
     * @param mailboxName 接続するメールボックス名
     * @param callback 新しいメールを受信した時のコールバック
     */
    connect(
        mailboxName: string,
        callback: (email: ParsedEmail) => Promise<void>
    ): Promise<void>;

    /**
     * メール本文からカード利用情報を抽出する
     * @param emailContent メール本文
     * @param cardCompany カード会社の種類
     * @returns カード利用情報
     */
    parseCardUsageFromEmail(
        emailContent: string,
        cardCompany?: CardCompany
    ): Promise<CardUsageNotification>;
}