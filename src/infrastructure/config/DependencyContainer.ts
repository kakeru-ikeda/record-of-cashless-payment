import { ImapEmailService } from '../email/ImapEmailService';
import { FirestoreCardUsageRepository } from '../firebase/FirestoreCardUsageRepository';
import { DiscordWebhookNotifier } from '../../../shared/discord/DiscordNotifier';
import { ProcessEmailUseCase } from '../../usecases/email/ProcessEmailUseCase';
import { EmailController } from '../../presentation/email/controllers/EmailController';
import { Environment } from '../../../shared/config/Environment';
import { logger } from '../../../shared/utils/Logger';
import { ProcessCardCompanyEmailUseCase } from '../../usecases/email/ProcessCardCompanyEmailUseCase';
import { NotifyCardUsageUseCase } from '../../usecases/notification/NotifyCardUsageUseCase';
import { ErrorHandler } from '../../../shared/errors/ErrorHandler';
import { IProcessCardCompanyEmailUseCase } from '../../domain/usecases/email/IProcessCardCompanyEmailUseCase';
import { INotifyCardUsageUseCase } from '../../domain/usecases/notification/INotifyCardUsageUseCase';
import { IDependencyContainer } from '../../domain/interfaces/config/IDependencyContainer';

/**
 * アプリケーションの依存性を管理するコンテナクラス
 * 各サービス、リポジトリ、ユースケース、コントローラーの初期化と提供を担当
 */
export class DependencyContainer implements IDependencyContainer {
  private emailService: ImapEmailService;
  private cardUsageRepository: FirestoreCardUsageRepository;
  private discordNotifier: DiscordWebhookNotifier;
  private processEmailUseCase: ProcessEmailUseCase;
  private processCardCompanyEmailUseCase: ProcessCardCompanyEmailUseCase;
  private notifyCardUsageUseCase: NotifyCardUsageUseCase;
  private emailController: EmailController;

  /**
   * 依存性を初期化
   */
  public async initialize(): Promise<void> {
    // loggerにDiscordNotifierを設定
    logger.setDiscordNotifier(this.discordNotifier);

    // インフラストラクチャレイヤーの初期化
    this.emailService = new ImapEmailService(
      Environment.IMAP_SERVER,
      Environment.IMAP_USER,
      Environment.IMAP_PASSWORD
    );

    this.cardUsageRepository = new FirestoreCardUsageRepository();
    await this.cardUsageRepository.initialize();
    logger.updateServiceStatus('FirestoreRepository', 'online', '初期化完了');

    this.discordNotifier = new DiscordWebhookNotifier({
      usageWebhookUrl: Environment.DISCORD_WEBHOOK_URL,
      loggingWebhookUrl: Environment.DISCORD_LOGGING_WEBHOOK_URL,
    });
    logger.updateServiceStatus('DiscordNotifier', 'online', '初期化完了');

    // ユースケースレイヤーの初期化
    this.processEmailUseCase = new ProcessEmailUseCase(
      this.emailService,
      this.cardUsageRepository
    );
    logger.updateServiceStatus('ProcessEmailUseCase', 'online', '初期化完了');

    // 新しいユースケースの初期化
    this.notifyCardUsageUseCase = new NotifyCardUsageUseCase(this.discordNotifier);
    logger.updateServiceStatus('NotifyCardUsageUseCase', 'online', '初期化完了');

    this.processCardCompanyEmailUseCase = new ProcessCardCompanyEmailUseCase(
      this.processEmailUseCase
    );
    logger.updateServiceStatus('ProcessCardCompanyEmailUseCase', 'online', '初期化完了');

    // コントローラーの初期化
    this.emailController = new EmailController(
      this.processCardCompanyEmailUseCase,
      this.notifyCardUsageUseCase
    );
    logger.updateServiceStatus('EmailController', 'online', '初期化完了');
  }

  /**
   * EmailControllerを取得
   */
  public getEmailController(): EmailController {
    return this.emailController;
  }

  /**
   * ProcessEmailUseCaseを取得
   */
  public getProcessEmailUseCase(): ProcessEmailUseCase {
    return this.processEmailUseCase;
  }

  /**
   * ProcessCardCompanyEmailUseCaseを取得
   */
  public getProcessCardCompanyEmailUseCase(): IProcessCardCompanyEmailUseCase {
    return this.processCardCompanyEmailUseCase;
  }

  /**
   * NotifyCardUsageUseCaseを取得
   */
  public getNotifyCardUsageUseCase(): INotifyCardUsageUseCase {
    return this.notifyCardUsageUseCase;
  }

  /**
   * ImapEmailServiceを取得
   */
  public getEmailService(): ImapEmailService {
    return this.emailService;
  }

  /**
   * FirestoreCardUsageRepositoryを取得
   */
  public getCardUsageRepository(): FirestoreCardUsageRepository {
    return this.cardUsageRepository;
  }

  /**
   * DiscordWebhookNotifierを取得
   */
  public getDiscordNotifier(): DiscordWebhookNotifier {
    return this.discordNotifier;
  }
}