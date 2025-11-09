/**
 * メール解析を担当するインターフェース
 * 生のメールデータを受け取り、構造化された形式に変換する処理を定義
 */
import { RawEmailMessage } from '@infrastructure/email/ImapEmailClient';
import { ParsedEmail } from '@infrastructure/email/EmailParser';

export interface IEmailParser {
    /**
     * 生のメールデータをパースして構造化された形式に変換
     * @param rawMessage 生のメールデータ
     * @returns パース済みのメールデータ
     */
    parseEmail(rawMessage: RawEmailMessage): Promise<ParsedEmail | null>;
}
