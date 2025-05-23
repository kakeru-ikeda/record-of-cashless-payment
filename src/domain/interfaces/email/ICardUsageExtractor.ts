/**
 * カード利用情報の抽出を専門に行うインターフェース
 * メール本文からカード会社固有の形式でカード利用情報を抽出する処理を定義
 */
import { CardCompany, CardUsageInfo } from '@domain/entities/card/CardTypes';

export interface ICardUsageExtractor {
    /**
     * メール本文からカード利用情報を抽出
     * @param body メール本文
     * @param cardCompany カード会社の種類
     * @returns 抽出されたカード利用情報
     */
    extractFromEmailBody(body: string, cardCompany: CardCompany): CardUsageInfo;
}
