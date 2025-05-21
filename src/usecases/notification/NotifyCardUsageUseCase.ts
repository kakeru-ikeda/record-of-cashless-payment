import { INotifyCardUsageUseCase } from '../../domain/usecases/notification/INotifyCardUsageUseCase';
import { CardUsageNotification } from '../../../shared/domain/entities/CardUsageNotification';
import { AppError } from '../../../shared/errors/AppError';
import { DiscordNotifier } from '../../../shared/discord/DiscordNotifier';
import { logger } from '../../../shared/utils/Logger';
import { ErrorHandler } from '../../../shared/errors/ErrorHandler';

export class NotifyCardUsageUseCase implements INotifyCardUsageUseCase {
  private readonly serviceContext = 'NotifyCardUsageUseCase';
  
  constructor(
    private readonly discordNotifier: DiscordNotifier
  ) {}
  
  /**
   * カード利用情報をDiscordに通知する
   */
  @ErrorHandler.errorDecorator('NotifyCardUsageUseCase', {
    defaultMessage: 'Discord通知の送信に失敗しました',
    suppressNotification: true // 通知エラーの通知は不要
  })
  async notifyUsage(usage: CardUsageNotification): Promise<void> {
    await this.discordNotifier.notify(usage);
    logger.info('Discord通知を送信しました', this.serviceContext);
  }
}