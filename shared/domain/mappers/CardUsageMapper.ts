import { CardUsage } from '@shared/domain/entities/CardUsage';
import { CardUsageNotification } from '@shared/domain/entities/CardUsageNotification';

/**
 * CardUsageエンティティと通知用DTOの変換を行うマッパークラス
 */
export class CardUsageMapper {
  /**
   * CardUsageエンティティを通知用DTOに変換する
   * @param entity ドメインエンティティ
   * @returns 通知用DTO
   */
  static toNotification(entity: CardUsage): CardUsageNotification {
    const { datetime_of_use, created_at, ...rest } = entity;
    return {
      ...rest,
      datetime_of_use: datetime_of_use.toDate().toISOString()
    };
  }
}