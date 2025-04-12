
import { ICardUsageRepository } from '../../src/domain/repositories/ICardUsageRepository';
import { CardUsage } from '../../src/domain/entities/CardUsage';

/**
 * カード利用情報リポジトリのモッククラス
 */
export class MockCardUsageRepository implements ICardUsageRepository {
  getByTimestamp(timestamp: string): Promise<CardUsage | null> {
    throw new Error('Method not implemented.');
  }
  private items: Map<string, CardUsage> = new Map();
  private shouldFail: boolean = false;

  /**
   * カード利用情報を保存する
   * @param usage カード利用情報
   * @returns 保存されたパス
   */
  async save(usage: CardUsage): Promise<string> {
    if (this.shouldFail) {
      throw new Error('データの保存に失敗しました（モック）');
    }

    const date = usage.datetime_of_use.toDate();
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const timestamp = date.getTime().toString();
    const path = `details/${year}/${month}/${timestamp}`;

    this.items.set(path, { ...usage });
    return path;
  }

  /**
   * 年月を指定してカード利用情報を取得する
   * @param year 年
   * @param month 月
   * @returns カード利用情報の配列
   */
  async getByDate(year: string, month: string): Promise<CardUsage[]> {
    return Array.from(this.items.values()).filter(item => {
      const date = item.datetime_of_use.toDate();
      return date.getFullYear().toString() === year &&
        (date.getMonth() + 1).toString().padStart(2, '0') === month;
    });
  }

  /**
   * 保存されているアイテム数を取得する
   * @returns アイテム数
   */
  getItemCount(): number {
    return this.items.size;
  }

  /**
   * 指定されたパスのアイテムを取得する
   * @param path パス
   * @returns カード利用情報
   */
  getByPath(path: string): CardUsage | undefined {
    return this.items.get(path);
  }

  /**
   * 失敗フラグを設定する
   * @param fail 失敗するかどうか
   */
  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  /**
   * 保存されているアイテムをクリアする
   */
  clear(): void {
    this.items.clear();
  }
}

