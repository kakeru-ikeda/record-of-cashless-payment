import { DependencyContainer } from '../../../../src/infrastructure/config/DependencyContainer';
import { ImapEmailService } from '../../../../src/infrastructure/email/ImapEmailService';
import { FirestoreCardUsageRepository } from '../../../../src/infrastructure/firebase/FirestoreCardUsageRepository';
import { DiscordWebhookNotifier } from '../../../../shared/discord/DiscordNotifier';
import { ProcessEmailUseCase } from '../../../../src/usecases/ProcessEmailUseCase';
import { EmailController } from '../../../../src/interfaces/controllers/EmailController';

// 環境変数のモックを直接オブジェクトリテラルで設定
jest.mock('../../../../shared/config/Environment', () => ({
  Environment: {
    IMAP_SERVER: 'test.imap.server',
    IMAP_USER: 'test-user',
    IMAP_PASSWORD: 'test-password',
    DISCORD_WEBHOOK_URL: 'https://discord.webhook/test',
  }
}));

// 依存コンポーネントをモック
jest.mock('../../../../src/infrastructure/email/ImapEmailService');
jest.mock('../../../../src/infrastructure/firebase/FirestoreCardUsageRepository');
jest.mock('../../../../shared/discord/DiscordNotifier');
jest.mock('../../../../src/usecases/ProcessEmailUseCase');
jest.mock('../../../../src/interfaces/controllers/EmailController');

// Loggerをモック化
jest.mock('../../../../shared/utils/Logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logAppError: jest.fn(),
    updateServiceStatus: jest.fn()
  }
}));

describe('DependencyContainer', () => {
  let dependencyContainer: DependencyContainer;
  let mockImapEmailService: jest.Mocked<ImapEmailService>;
  let mockFirestoreCardUsageRepository: jest.Mocked<FirestoreCardUsageRepository>;
  let mockDiscordNotifier: jest.Mocked<DiscordWebhookNotifier>;
  let mockProcessEmailUseCase: jest.Mocked<ProcessEmailUseCase>;
  let mockEmailController: jest.Mocked<EmailController>;

  // テスト用のモック環境変数にアクセスするための参照を取得
  const mockEnvironment = require('../../../../shared/config/Environment').Environment;

  beforeEach(() => {
    jest.clearAllMocks();

    // 環境変数を初期化
    mockEnvironment.DISCORD_WEBHOOK_URL = 'https://discord.webhook/test';

    // モックの設定
    mockImapEmailService = new ImapEmailService('', '', '') as jest.Mocked<ImapEmailService>;
    mockFirestoreCardUsageRepository = new FirestoreCardUsageRepository() as jest.Mocked<FirestoreCardUsageRepository>;
    mockFirestoreCardUsageRepository.initialize = jest.fn().mockResolvedValue(undefined);
    
    mockDiscordNotifier = new DiscordWebhookNotifier('') as jest.Mocked<DiscordWebhookNotifier>;
    mockProcessEmailUseCase = new ProcessEmailUseCase({} as any, {} as any, {} as any) as jest.Mocked<ProcessEmailUseCase>;
    mockEmailController = new EmailController({} as any, {} as any) as jest.Mocked<EmailController>;

    // コンストラクタのモック
    (ImapEmailService as jest.MockedClass<typeof ImapEmailService>).mockImplementation(
      () => mockImapEmailService
    );
    (FirestoreCardUsageRepository as jest.MockedClass<typeof FirestoreCardUsageRepository>).mockImplementation(
      () => mockFirestoreCardUsageRepository
    );
    (DiscordWebhookNotifier as jest.MockedClass<typeof DiscordWebhookNotifier>).mockImplementation(
      () => mockDiscordNotifier
    );
    (ProcessEmailUseCase as jest.MockedClass<typeof ProcessEmailUseCase>).mockImplementation(
      () => mockProcessEmailUseCase
    );
    (EmailController as jest.MockedClass<typeof EmailController>).mockImplementation(
      () => mockEmailController
    );

    // DependencyContainerのインスタンスを作成
    dependencyContainer = new DependencyContainer();
  });

  describe('initialize', () => {
    test('依存コンポーネントが正しく初期化されること', async () => {
      // 初期化を実行
      await dependencyContainer.initialize();

      // ImapEmailServiceが正しい引数で初期化されることを確認
      expect(ImapEmailService).toHaveBeenCalledWith(
        mockEnvironment.IMAP_SERVER,
        mockEnvironment.IMAP_USER,
        mockEnvironment.IMAP_PASSWORD
      );

      // FirestoreCardUsageRepositoryが初期化されることを確認
      expect(FirestoreCardUsageRepository).toHaveBeenCalled();
      expect(mockFirestoreCardUsageRepository.initialize).toHaveBeenCalled();

      // DiscordWebhookNotifierが正しい引数で初期化されることを確認
      expect(DiscordWebhookNotifier).toHaveBeenCalledWith(
        mockEnvironment.DISCORD_WEBHOOK_URL
      );

      // ProcessEmailUseCaseが正しい引数で初期化されることを確認
      expect(ProcessEmailUseCase).toHaveBeenCalledWith(
        mockImapEmailService,
        mockFirestoreCardUsageRepository,
        mockDiscordNotifier
      );

      // EmailControllerが正しい引数で初期化されることを確認
      expect(EmailController).toHaveBeenCalledWith(
        mockImapEmailService,
        mockProcessEmailUseCase
      );

      // ステータス更新のログが記録されることを確認
      expect(require('../../../../shared/utils/Logger').logger.updateServiceStatus).toHaveBeenCalledWith(
        'FirestoreRepository',
        'online',
        expect.any(String)
      );
      expect(require('../../../../shared/utils/Logger').logger.updateServiceStatus).toHaveBeenCalledWith(
        'DiscordNotifier',
        'online',
        expect.any(String)
      );
    });

    test('Discord Webhook URLが未設定の場合、通知はオフラインとしてマークされること', async () => {
      // Discord Webhook URLを未設定に変更
      mockEnvironment.DISCORD_WEBHOOK_URL = '';
      
      // モックをリセット
      jest.clearAllMocks();
      
      // 新しいインスタンスを作成（環境変数の変更を反映するため）
      const newDependencyContainer = new DependencyContainer();
      
      // 初期化を実行
      await newDependencyContainer.initialize();

      // Discord通知がオフラインとしてマークされることを確認
      expect(require('../../../../shared/utils/Logger').logger.updateServiceStatus).toHaveBeenCalledWith(
        'DiscordNotifier',
        'offline',
        expect.stringContaining('Discord通知無効')
      );
    });
  });

  describe('getEmailController', () => {
    test('初期化後にEmailControllerのインスタンスが取得できること', async () => {
      // まず初期化
      await dependencyContainer.initialize();

      // EmailControllerを取得
      const emailController = dependencyContainer.getEmailController();

      // 正しいインスタンスが返されることを確認
      expect(emailController).toBe(mockEmailController);
    });
  });

  describe('getProcessEmailUseCase', () => {
    test('初期化後にProcessEmailUseCaseのインスタンスが取得できること', async () => {
      // まず初期化
      await dependencyContainer.initialize();

      // ProcessEmailUseCaseを取得
      const processEmailUseCase = dependencyContainer.getProcessEmailUseCase();

      // 正しいインスタンスが返されることを確認
      expect(processEmailUseCase).toBe(mockProcessEmailUseCase);
    });
  });

  describe('getEmailService', () => {
    test('初期化後にImapEmailServiceのインスタンスが取得できること', async () => {
      // まず初期化
      await dependencyContainer.initialize();

      // ImapEmailServiceを取得
      const emailService = dependencyContainer.getEmailService();

      // 正しいインスタンスが返されることを確認
      expect(emailService).toBe(mockImapEmailService);
    });
  });

  describe('getCardUsageRepository', () => {
    test('初期化後にFirestoreCardUsageRepositoryのインスタンスが取得できること', async () => {
      // まず初期化
      await dependencyContainer.initialize();

      // FirestoreCardUsageRepositoryを取得
      const repository = dependencyContainer.getCardUsageRepository();

      // 正しいインスタンスが返されることを確認
      expect(repository).toBe(mockFirestoreCardUsageRepository);
    });
  });

  describe('getDiscordNotifier', () => {
    test('初期化後にDiscordWebhookNotifierのインスタンスが取得できること', async () => {
      // まず初期化
      await dependencyContainer.initialize();

      // DiscordWebhookNotifierを取得
      const notifier = dependencyContainer.getDiscordNotifier();

      // 正しいインスタンスが返されることを確認
      expect(notifier).toBe(mockDiscordNotifier);
    });
  });
});