import { CardUsageNotification } from '../../../../shared/domain/entities/CardUsageNotification';

export interface INotifyCardUsageUseCase {
  /**
   * カード利用情報をDiscordに通知する
   */
  notifyUsage(usage: CardUsageNotification): Promise<void>;
}