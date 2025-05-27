import { CardUsageNotificationDTO } from '@shared/domain/dto/CardUsageNotificationDTO';

export interface INotifyCardUsageUseCase {
  /**
   * カード利用情報をDiscordに通知する
   */
  notifyUsage(usage: CardUsageNotificationDTO): Promise<void>;
}