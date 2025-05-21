import { CardUsageNotification } from '../../../../shared/domain/entities/CardUsageNotification';
import { AppError } from '../../../../shared/errors/AppError';

export interface INotifyCardUsageUseCase {
  /**
   * カード利用情報をDiscordに通知する
   */
  notifyUsage(usage: CardUsageNotification): Promise<void>;
}