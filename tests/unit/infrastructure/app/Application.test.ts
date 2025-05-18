import { Application } from '../../../../src/infrastructure/app/Application';
import { HttpAppConfig } from '../../../../src/infrastructure/config/HttpAppConfig';
import { DependencyContainer } from '../../../../src/infrastructure/config/DependencyContainer';
import { EmailController } from '../../../../src/interfaces/controllers/EmailController';
import { TestRunner } from '../../../../src/infrastructure/test/TestRunner';
import { CardCompany } from '../../../../src/infrastructure/email/ImapEmailService';
import { ProcessEmailUseCase } from '../../../../src/usecases/email/ProcessEmailUseCase';
import { Server } from 'http';

// 依存コンポーネントをモック化
jest.mock('../../../../src/infrastructure/config/HttpAppConfig');
jest.mock('../../../../src/infrastructure/config/DependencyContainer');
jest.mock('../../../../src/interfaces/controllers/EmailController');
jest.mock('../../../../src/infrastructure/test/TestRunner');

// Loggerをモック化
jest.mock('../../../../shared/utils/Logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logAppError: jest.fn(),
    updateServiceStatus: jest.fn(),
    renderStatusDashboard: jest.fn()
  }
}));

describe('Application', () => {
  let application: Application;
  let mockHttpAppConfig: jest.Mocked<HttpAppConfig>;
  let mockDependencyContainer: jest.Mocked<DependencyContainer>;
  let mockEmailController: jest.Mocked<EmailController>;
  let mockTestRunner: jest.Mocked<TestRunner>;
  let mockServer: Partial<Server>;

  beforeEach(() => {
    // すべてのモックをリセット
    jest.clearAllMocks();
    
    // モックサーバー
    mockServer = {
      close: jest.fn().mockImplementation((callback: () => void) => {
        callback();
        return mockServer as Server;
      })
    };

    // AppConfigのモックを設定
    mockHttpAppConfig = new HttpAppConfig() as jest.Mocked<HttpAppConfig>;
    (mockHttpAppConfig.setupMonitoringRoutes as jest.Mock).mockReturnValue(undefined);
    (mockHttpAppConfig.setupServiceRoutes as jest.Mock).mockReturnValue(undefined);
    (mockHttpAppConfig.startServer as jest.Mock).mockReturnValue(mockServer);

    // EmailControllerのモックを設定
    mockEmailController = new EmailController(
      {} as any,
      {} as any
    ) as jest.Mocked<EmailController>;
    (mockEmailController.startAllMonitoring as jest.Mock).mockResolvedValue(undefined);
    (mockEmailController.stopMonitoring as jest.Mock).mockResolvedValue(undefined);

    // ProcessEmailUseCaseのモック
    const mockProcessEmailUseCase = {
      execute: jest.fn(),
      executeTest: jest.fn()
    } as unknown as ProcessEmailUseCase;

    // DependencyContainerのモック設定
    mockDependencyContainer = new DependencyContainer() as jest.Mocked<DependencyContainer>;
    (mockDependencyContainer.initialize as jest.Mock).mockResolvedValue(undefined);
    (mockDependencyContainer.getEmailController as jest.Mock).mockReturnValue(mockEmailController);
    (mockDependencyContainer.getProcessEmailUseCase as jest.Mock).mockReturnValue(mockProcessEmailUseCase);

    // TestRunnerのモック設定
    mockTestRunner = new TestRunner({} as any) as jest.Mocked<TestRunner>;
    (mockTestRunner.runSampleMailTest as jest.Mock).mockResolvedValue({
      parsedData: {},
      savedPath: 'test/path',
      notificationSent: true
    });

    // TestRunnerのコンストラクタをモック
    (TestRunner as unknown as jest.Mock).mockImplementation(() => mockTestRunner);

    // DependencyContainerとAppConfigのコンストラクタをモック
    (DependencyContainer as unknown as jest.Mock).mockImplementation(() => mockDependencyContainer);
    (HttpAppConfig as unknown as jest.Mock).mockImplementation(() => mockHttpAppConfig);

    // Applicationのインスタンスを作成
    application = new Application();
  });

  describe('initialize', () => {
    test('正常系: アプリケーションが正常に初期化されること', async () => {
      await application.initialize();

      // DependencyContainerのinitializeが呼ばれることを確認
      expect(mockDependencyContainer.initialize).toHaveBeenCalled();

      // AppConfigのメソッドが正しく呼ばれることを確認
      expect(mockHttpAppConfig.setupMonitoringRoutes).toHaveBeenCalled();
      expect(mockHttpAppConfig.setupServiceRoutes).toHaveBeenCalledWith(mockEmailController);
      expect(mockHttpAppConfig.startServer).toHaveBeenCalled();
    });

    test('異常系: 初期化中にエラーが発生した場合、例外がスローされること', async () => {
      // DependencyContainerの初期化でエラーが発生する場合
      (mockDependencyContainer.initialize as jest.Mock).mockRejectedValueOnce(
        new Error('初期化エラー')
      );

      // エラーがスローされることを確認
      await expect(application.initialize()).rejects.toThrow('初期化エラー');
    });
  });

  describe('runInNormalMode', () => {
    test('正常系: 通常モードで実行するとメール監視が開始されること', async () => {
      await application.runInNormalMode();

      // EmailControllerのstartAllMonitoringが呼ばれることを確認
      expect(mockEmailController.startAllMonitoring).toHaveBeenCalled();
    });
  });

  describe('runInTestMode', () => {
    test('正常系: テストモードで実行するとサンプルメールテストが実行されること', async () => {
      await application.runInTestMode(CardCompany.MUFG);

      // TestRunnerが作成され、runSampleMailTestが呼ばれることを確認
      expect(TestRunner).toHaveBeenCalledWith(
        mockDependencyContainer.getProcessEmailUseCase()
      );
      expect(mockTestRunner.runSampleMailTest).toHaveBeenCalledWith(CardCompany.MUFG);
    });

    test('異常系: テスト実行中にエラーが発生した場合、例外がスローされること', async () => {
      // テスト実行でエラーが発生する場合
      (mockTestRunner.runSampleMailTest as jest.Mock).mockRejectedValueOnce(
        new Error('テスト実行エラー')
      );

      // エラーがスローされることを確認
      await expect(application.runInTestMode(CardCompany.MUFG)).rejects.toThrow('テスト実行エラー');
    });
  });

  describe('shutdown', () => {
    test('正常系: シャットダウン時にメール監視とサーバーが停止されること', async () => {
      // まず初期化してサーバーを設定
      await application.initialize();
      
      // シャットダウンを実行
      await application.shutdown();

      // EmailControllerのstopMonitoringが呼ばれることを確認
      expect(mockEmailController.stopMonitoring).toHaveBeenCalled();
      
      // サーバーのcloseが呼ばれることを確認
      expect(mockServer.close).toHaveBeenCalled();
    });

    test('異常系: シャットダウン中にエラーが発生しても処理が継続されること', async () => {
      // サーバー初期化
      await application.initialize();
      
      // EmailControllerのstopMonitoringでエラーが発生する場合
      (mockEmailController.stopMonitoring as jest.Mock).mockRejectedValueOnce(
        new Error('監視停止エラー')
      );

      // エラーがキャッチされ、正常に戻ることを確認
      await expect(application.shutdown()).resolves.not.toThrow();
    });
  });

  describe('renderStatusDashboardIfCompactMode', () => {
    beforeEach(() => {
      // タイマーをモック化
      jest.useFakeTimers();
    });
    
    afterEach(() => {
      // テスト後にモックタイマーをリセット
      jest.useRealTimers();
    });
    
    test('コンパクトモードの場合、ステータスダッシュボードが表示されること', async () => {
      // コンパクトモードを有効化
      process.env.COMPACT_LOGS = 'true';

      // 通常モードで実行
      await application.runInNormalMode();
      
      // タイマーを実行（全ての非同期タイマーを実行）
      jest.runAllTimers();

      // renderStatusDashboardが呼ばれることを確認
      expect(require('../../../../shared/utils/Logger').logger.renderStatusDashboard).toHaveBeenCalled();
      
      // 環境変数をリセット
      delete process.env.COMPACT_LOGS;
    });
  });
});