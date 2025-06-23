import { INotifyReportUseCase } from '@shared/domain/interfaces/usecases/notification/INotifyReportUseCase';
import { DailyReportNotificationDTO, WeeklyReportNotificationDTO, MonthlyReportNotificationDTO } from '@shared/domain/dto/ReportNotificationDTOs';
import { logger } from '@shared/infrastructure/logging/Logger';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';
import { IDiscordNotifier } from '@shared/domain/interfaces/discord/IDiscordNotifier';

/**
 * レポート通知UseCaseの具象実装
 */
export class NotifyReportUseCase implements INotifyReportUseCase {
    private readonly serviceContext = 'NotifyReportUseCase';

    constructor(
        private readonly discordNotifier: IDiscordNotifier
    ) { }

    /**
     * デイリーレポートをDiscordに通知する
     */
    @ErrorHandler.errorDecorator('NotifyReportUseCase', {
        defaultMessage: 'デイリーレポートのDiscord通知送信に失敗しました',
        suppressNotification: true // 通知エラーの通知は不要
    })
    async notifyDailyReport(report: DailyReportNotificationDTO): Promise<void> {
        await this.discordNotifier.notifyDailyReport(report);
        logger.info(`デイリーレポートのDiscord通知を送信しました: ${report.title}`, this.serviceContext);
    }

    /**
     * ウィークリーレポートをDiscordに通知する
     */
    @ErrorHandler.errorDecorator('NotifyReportUseCase', {
        defaultMessage: 'ウィークリーレポートのDiscord通知送信に失敗しました',
        suppressNotification: true // 通知エラーの通知は不要
    })
    async notifyWeeklyReport(report: WeeklyReportNotificationDTO): Promise<void> {
        await this.discordNotifier.notifyWeeklyReport(report);
        logger.info(`ウィークリーレポートのDiscord通知を送信しました: ${report.title}`, this.serviceContext);
    }

    /**
     * マンスリーレポートをDiscordに通知する
     */
    @ErrorHandler.errorDecorator('NotifyReportUseCase', {
        defaultMessage: 'マンスリーレポートのDiscord通知送信に失敗しました',
        suppressNotification: true // 通知エラーの通知は不要
    })
    async notifyMonthlyReport(report: MonthlyReportNotificationDTO): Promise<void> {
        await this.discordNotifier.notifyMonthlyReport(report);
        logger.info(`マンスリーレポートのDiscord通知を送信しました: ${report.title}`, this.serviceContext);
    }
}
