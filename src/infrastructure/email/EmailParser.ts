import { simpleParser } from 'mailparser';
import { htmlToText } from 'html-to-text';
import { logger } from '@shared/infrastructure/logging/Logger';
import { AppError, ErrorType } from '@shared/errors/AppError';
import { RawEmailMessage } from '@infrastructure/email/ImapClientAdapter';
import { IEmailParser } from '@domain/interfaces/infrastructure/email/IEmailParser';

/**
 * パース済みメールの型定義
 */
export interface ParsedEmail {
  subject: string;
  from: string;
  body: string;
  date: Date;
  uid: string;
}

/**
 * メール解析を担当するクラス
 * 生のメールデータを受け取り、構造化された形式に変換する
 */
export class EmailParser implements IEmailParser {
  private readonly serviceContext: string;

  constructor() {
    this.serviceContext = 'EmailParser';
  }

  /**
   * 生のメールデータをパースして構造化された形式に変換
   * @param rawMessage 生のメールデータ
   * @returns パース済みのメールデータ
   */
  async parseEmail(rawMessage: RawEmailMessage): Promise<ParsedEmail | null> {
    const context = `${this.serviceContext}:${rawMessage.uid}`;

    try {
      // メールのパース
      const parsed = await simpleParser(rawMessage.source);

      // HTMLメールかテキストメールかを確認してボディを抽出
      let body = parsed.text || '';

      // HTMLからプレーンテキストに変換
      if (parsed.html) {
        body = this.convertHtmlToPlainText(parsed.html);
      }

      return {
        subject: parsed.subject || '',
        from: parsed.from?.text || '',
        body,
        date: parsed.date || new Date(),
        uid: rawMessage.uid
      };
    } catch (error) {
      const appError = new AppError(
        `メール解析中にエラーが発生しました (UID=${rawMessage.uid})`,
        ErrorType.EMAIL,
        { uid: rawMessage.uid },
        error instanceof Error ? error : new Error(String(error))
      );
      logger.error(appError, context);
      return null;
    }
  }

  /**
   * HTMLをプレーンテキストに変換
   * @param html HTMLテキスト
   * @returns プレーンテキスト
   */
  private convertHtmlToPlainText(html: string): string {
    return htmlToText(html, {
      wordwrap: false,
    });
  }
}