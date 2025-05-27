import { INotifyCardUsageUseCase } from '@domain/usecases/notification/INotifyCardUsageUseCase';
import { CardUsageNotificationDTO } from '@shared/domain/dto/CardUsageNotificationDTO';
import { logger } from '@shared/infrastructure/logging/Logger';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';
import { IDiscordNotifier } from '@shared/domain/interfaces/discord/IDiscordNotifier';

export class NotifyCardUsageUseCase implements INotifyCardUsageUseCase {
  private readonly serviceContext = 'NotifyCardUsageUseCase';

  constructor(
    private readonly discordNotifier: IDiscordNotifier
  ) { }

  /**
   * カード利用情報をDiscordに通知する
   */
  @ErrorHandler.errorDecorator('NotifyCardUsageUseCase', {
    defaultMessage: 'Discord通知の送信に失敗しました',
    suppressNotification: true // 通知エラーの通知は不要
  })
  async notifyUsage(usage: CardUsageNotificationDTO): Promise<void> {
    await this.discordNotifier.notifyCardUsage(usage);
    logger.info('Discord通知を送信しました', this.serviceContext);
  }
}