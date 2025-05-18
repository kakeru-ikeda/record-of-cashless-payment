import { CardUsageNotification } from '../../../../shared/domain/entities/CardUsageNotification';
import { AppError } from '../../../../shared/errors/AppError';

export interface INotifyCardUsageUseCase {
  /**
   * カード利用情報をDiscordに通知する
   */
  notifyUsage(usage: CardUsageNotification): Promise<void>;
  
  /**
   * エラー情報をDiscordに通知する
   */
  notifyError(error: AppError, context: string): Promise<void>;
  
  /**
   * ログメッセージをDiscordに通知する
   */
  notifyLogging(message: string, title: string, context: string): Promise<void>;
}