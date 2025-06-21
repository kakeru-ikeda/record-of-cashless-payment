
import { CardUsage } from '@shared/domain/entities/CardUsage';

/**
 * データベースにおけるカード利用情報のリポジトリインターフェース
 * カード利用情報の取得、保存、更新、削除を行う
 */
export interface ICardUsageCrudRepository {
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

  /**
   * IDによるカード利用情報の取得
   * @param id カード利用情報のID
   * @returns カード利用情報（IDとパス情報を含む）
   */
  getById(id: string): Promise<(CardUsage & { id: string, path: string }) | null>;

  /**
   * 指定された年月のカード利用情報を全て取得する
   * @param year 年
   * @param month 月
   * @returns カード利用情報の配列（IDとパス情報を含む）
   */
  getByYearMonth(year: string, month: string): Promise<(CardUsage & { id: string, path: string })[]>;

  /**
   * カード利用情報を更新する
   * @param id カード利用情報のID
   * @param updateData 更新データ
   * @returns 更新後のカード利用情報（IDとパス情報を含む）
   */
  update(id: string, updateData: Partial<CardUsage>): Promise<(CardUsage & { id: string, path: string }) | null>;

  /**
   * カード利用情報を論理削除する（is_activeをfalseに設定）
   * @param id カード利用情報のID
   * @returns 削除されたカード利用情報のIDとパス
   */
  delete(id: string): Promise<{ id: string, path: string } | null>;
}

