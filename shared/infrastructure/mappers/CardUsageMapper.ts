import { CardUsage } from '@shared/domain/entities/CardUsage';
import { CardUsageNotificationDTO } from '@shared/domain/dto/CardUsageNotificationDTO';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * CardUsageエンティティと通知用DTOの変換を行うマッパークラス
 */
export class CardUsageMapper {
  /**
   * CardUsageエンティティを通知用DTOに変換する
   * @param entity ドメインエンティティ
   * @returns 通知用DTO
   */
  static toNotification(entity: CardUsage): CardUsageNotificationDTO {
    /* eslint-disable camelcase */
    // created_at is intentionally excluded from notification DTO
    const { datetime_of_use, created_at: _created_at, ...rest } = entity;
    return {
      ...rest,
      datetime_of_use: datetime_of_use.toDate().toISOString(),
    };
    /* eslint-enable camelcase */
  }

  /**
   * 通知用DTOをCardUsageエンティティに変換する
   * @param dto 通知用DTO
   * @returns ドメインエンティティ
   */
  static fromNotification(dto: CardUsageNotificationDTO): CardUsage {
    /* eslint-disable camelcase */
    return {
      ...dto,
      datetime_of_use: Timestamp.fromDate(new Date(dto.datetime_of_use)),
      created_at: Timestamp.now(),
    };
    /* eslint-enable camelcase */
  }
}
