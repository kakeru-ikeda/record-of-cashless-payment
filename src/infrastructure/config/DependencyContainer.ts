import { ImapEmailService } from '../email/ImapEmailService';
import { FirestoreCardUsageRepository } from '../firebase/FirestoreCardUsageRepository';
import { DiscordWebhookNotifier } from '../../../shared/discord/DiscordNotifier';
import { ProcessEmailUseCase } from '../../usecases/ProcessEmailUseCase';
import { EmailController } from '../../interfaces/controllers/EmailController';
import { logger } from '../../../shared/utils/Logger';
import { Environment } from '../../../shared/config/Environment';

/**
 * アプリケーションの依存性を管理するコンテナクラス
 * 各サービス、リポジトリ、ユースケース、コントローラーの初期化と提供を担当
 */
export class DependencyContainer {
  private emailService: ImapEmailService;
  private cardUsageRepository: FirestoreCardUsageRepository;
  private discordNotifier: DiscordWebhookNotifier;
  private processEmailUseCase: ProcessEmailUseCase;
  private emailController: EmailController;

  /**
   * 依存性を初期化
   */
  public async initialize(): Promise<void> {
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
    
    // Discord通知とエラーログのステータス更新
    const discordStatus = Environment.DISCORD_WEBHOOK_URL ? 'online' : 'offline';
    const errorLoggingStatus = Environment.DISCORD_LOGGING_WEBHOOK_URL ? 'online' : 'offline';
    
    logger.updateServiceStatus(
      'DiscordNotifier', 
      discordStatus, 
      discordStatus === 'online' ? 'Discord通知準備完了' : 'Discord通知無効'
    );
    
    logger.updateServiceStatus(
      'DiscordNotifier', 
      errorLoggingStatus, 
      errorLoggingStatus === 'online' ? 'Discordログ通知準備完了' : 'Discordログ通知無効'
    );

    // ユースケースの初期化
    this.processEmailUseCase = new ProcessEmailUseCase(
      this.emailService,
      this.cardUsageRepository
    );
    logger.updateServiceStatus('ProcessEmailUseCase', 'online', '初期化完了');

    // コントローラーの初期化
    this.emailController = new EmailController(this.processEmailUseCase, this.discordNotifier);
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