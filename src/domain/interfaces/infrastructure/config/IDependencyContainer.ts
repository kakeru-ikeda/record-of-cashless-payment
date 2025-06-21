/**
 * アプリケーションの依存性を管理するインターフェース
 * サービス、リポジトリ、ユースケース、コントローラーの初期化と提供を担当
 */
import { EmailController } from "@presentation/email/controllers/EmailController";
import { ImapEmailService } from "@infrastructure/email/ImapEmailService";
import { FirestoreCardUsageRepository } from "@infrastructure/database/repositories/FirestoreCardUsageRepository";
import { DiscordNotifier } from "@shared/infrastructure/discord/DiscordNotifier";
import { ProcessEmailUseCase } from "@usecase/email/ProcessEmailUseCase";
import { IProcessCardCompanyEmailUseCase } from "@domain/interfaces/usecases/email/IProcessCardCompanyEmailUseCase";
import { INotifyCardUsageUseCase } from "@domain/interfaces/usecases/notification/INotifyCardUsageUseCase";

export interface IDependencyContainer {
    /**
     * 依存性を初期化する
     * 各サービス、リポジトリ、ユースケースの初期化を行う
     */
    initialize(): Promise<void>;

    /**
     * EmailControllerを取得する
     */
    getEmailController(): EmailController;

    /**
     * ProcessEmailUseCaseを取得する
     */
    getProcessEmailUseCase(): ProcessEmailUseCase;

    /**
     * ProcessCardCompanyEmailUseCaseを取得する
     */
    getProcessCardCompanyEmailUseCase(): IProcessCardCompanyEmailUseCase;

    /**
     * NotifyCardUsageUseCaseを取得する
     */
    getNotifyCardUsageUseCase(): INotifyCardUsageUseCase;

    /**
     * ImapEmailServiceを取得する
     */
    getEmailService(): ImapEmailService;

    /**
     * FirestoreCardUsageRepositoryを取得する
     */
    getCardUsageRepository(): FirestoreCardUsageRepository;

    /**
     * DiscordNotifierを取得する
     */
    getDiscordNotifier(): DiscordNotifier;
}
