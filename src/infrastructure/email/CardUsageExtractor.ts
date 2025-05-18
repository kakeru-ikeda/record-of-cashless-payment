import { logger } from '../../../shared/utils/Logger';
import { AppError, ErrorType } from '../../../shared/errors/AppError';
import { ICardUsageExtractor } from '../../domain/interfaces/email/ICardUsageExtractor';

/**
 * カード会社の種類
 */
export enum CardCompany {
  MUFG = 'MUFG',        // 三菱UFJ銀行
  SMBC = 'SMBC'         // 三井住友カード
}

/**
 * カード利用情報の型定義
 */
export interface CardUsageInfo {
  card_name: string;
  datetime_of_use: string;
  amount: number;
  where_to_use: string;
}

/**
 * カード利用情報の抽出を専門に行うクラス
 * メール本文からカード会社固有の形式でカード利用情報を抽出する
 */
export class CardUsageExtractor implements ICardUsageExtractor {
  private readonly serviceContext: string;

  constructor() {
    this.serviceContext = 'CardUsageExtractor';
  }

  /**
   * メール本文からカード利用情報を抽出
   * @param body メール本文
   * @param cardCompany カード会社の種類
   * @returns 抽出されたカード利用情報
   */
  extractFromEmailBody(body: string, cardCompany: CardCompany): CardUsageInfo {
    const context = `${this.serviceContext}:${cardCompany}`;
    logger.info(`${cardCompany}のカード利用情報を抽出します`, context);

    switch (cardCompany) {
      case CardCompany.MUFG:
        return this.parseMufgEmail(body, context);
      case CardCompany.SMBC:
        return this.parseSmbcEmail(body, context);
      default:
        const appError = new AppError(
          `未対応のカード会社: ${cardCompany}`,
          ErrorType.VALIDATION,
          { cardCompany }
        );
        logger.logAppError(appError, context);
        throw appError;
    }
  }

  /**
   * 三菱UFJ銀行のメールからカード利用情報を抽出
   * @param body メール本文
   * @returns 抽出されたカード利用情報
   */
  private parseMufgEmail(body: string, context: string): CardUsageInfo {
    // 正規表現パターン - 新しいメール形式に対応
    const cardNameMatch = body.match(/カード名称\s*：\s*(.+?)(?=\s*\n)/);
    const dateMatch = body.match(/【ご利用日時\(日本時間\)】\s*([\d年月日 :]+)/);
    const amountMatch = body.match(/【ご利用金額】\s*([\d,]+)円/);
    const whereToUseMatch = body.match(/【ご利用先】\s*([^\n]+)/);

    // データを抽出・整形
    const datetime_of_use = dateMatch?.[1]?.trim() || '';
    const amountStr = amountMatch?.[1]?.replace(/,/g, '') || '0';
    const card_name = cardNameMatch?.[1]?.trim() || '';
    const where_to_use = whereToUseMatch?.[1]?.trim() || '';

    // 抽出結果をログ出力
    logger.debug("抽出データ（MUFG）:", context);
    logger.debug(JSON.stringify({
      card_name,
      datetime_of_use,
      amount: parseInt(amountStr, 10),
      where_to_use,
    }), context);

    // 日付文字列をISOフォーマットに変換
    try {
      const isoDate = new Date(datetime_of_use.replace(/年|月/g, '-').replace('日', '')).toISOString();
      logger.debug("変換後日時: " + isoDate, context);

      return {
        card_name,
        datetime_of_use: isoDate,
        amount: parseInt(amountStr, 10),
        where_to_use,
      };
    } catch (error) {
      logger.warn('日付変換に失敗しました。現在時刻を使用します', context);
      logger.debug(String(error), context);

      return {
        card_name,
        datetime_of_use: new Date().toISOString(),
        amount: parseInt(amountStr, 10),
        where_to_use,
      };
    }
  }

  /**
   * 三井住友カードのメールからカード利用情報を抽出
   * @param body メール本文
   * @returns 抽出されたカード利用情報
   */
  private parseSmbcEmail(body: string, context: string): CardUsageInfo {
    logger.debug("三井住友カードのメール本文解析", context);

    // 三井住友カードのメール形式に合わせたパターン抽出
    const cardNameMatch = body.match(/(.+のカード) 様/);
    const dateMatch = body.match(/ご利用日時：(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2})/);

    // より正確な利用場所と金額の抽出
    // カンマを含む金額にも対応（例: 1,500円）
    const fullUsageMatch = body.match(/ご利用日時：\d{4}\/\d{2}\/\d{2} \d{2}:\d{2} (.*?) ([\d,]+)円/);

    // データを抽出・整形
    const datetime_of_use = dateMatch?.[1]?.trim() || new Date().toISOString();
    const card_name = cardNameMatch?.[1]?.trim() || '三井住友カード';
    const where_to_use = fullUsageMatch?.[1]?.trim() || '不明';

    // 金額からカンマを削除して整数に変換
    const amountStr = fullUsageMatch?.[2]?.replace(/,/g, '') || '0';

    // 抽出結果をログ出力
    logger.debug("抽出データ（SMBC）:", context);
    logger.debug(JSON.stringify({
      card_name,
      datetime_of_use,
      amount: parseInt(amountStr, 10),
      where_to_use,
    }), context);

    try {
      // SMBCの日付形式（YYYY/MM/DD HH:MM）をISOフォーマットに変換
      const isoDate = new Date(datetime_of_use.replace(/\//g, '-')).toISOString();
      logger.debug("変換後日時（SMBC）: " + isoDate, context);

      return {
        card_name,
        datetime_of_use: isoDate,
        amount: parseInt(amountStr, 10),
        where_to_use,
      };
    } catch (error) {
      logger.warn('日付変換に失敗しました。現在時刻を使用します', context);
      logger.debug(String(error), context);

      return {
        card_name,
        datetime_of_use: new Date().toISOString(),
        amount: parseInt(amountStr, 10),
        where_to_use,
      };
    }
  }
}