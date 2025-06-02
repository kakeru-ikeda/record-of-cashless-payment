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
    const { datetime_of_use, created_at, ...rest } = entity;
    return {
      ...rest,
      datetime_of_use: datetime_of_use.toDate().toISOString()
    };
  }

  /**
   * 通知用DTOをCardUsageエンティティに変換する
   * @param dto 通知用DTO
   * @returns ドメインエンティティ
   */
  static fromNotification(dto: CardUsageNotificationDTO): CardUsage {
    return {
      ...dto,
      datetime_of_use: Timestamp.fromDate(new Date(dto.datetime_of_use)),
      created_at: Timestamp.now()
    };
  }

  /**
   * Firestoreから取得したデータをCardUsageエンティティに変換する
   * @param data Firestoreから取得したデータ
   * @returns 
   */
  static fromFirestore(data: any): CardUsage {
    return {
      card_name: data.card_name,
      amount: data.amount,
      where_to_use: data.where_to_use,
      datetime_of_use: Timestamp.fromDate(data.datetime_of_use.toDate()),
      is_active: data.is_active,
      created_at: Timestamp.fromDate(data.created_at.toDate())
    };
  }
}