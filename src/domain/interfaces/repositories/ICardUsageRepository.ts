
import { CardUsage } from '@shared/domain/entities/CardUsage';

/**
 * カード利用情報のリポジトリインターフェース
 */
export interface ICardUsageRepository {
  /**
   * カード利用情報を保存する
   * @param cardUsage カード利用情報
   * @returns 保存された情報のID
   */
  save(cardUsage: CardUsage): Promise<string>;

  /**
   * カード利用情報をタイムスタンプから取得する
   * @param timestamp タイムスタンプ
   * @returns カード利用情報
   */
  getByTimestamp(timestamp: string): Promise<CardUsage | null>;
}

