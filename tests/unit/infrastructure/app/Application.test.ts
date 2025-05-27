import { Application } from '../../../../src/infrastructure/app/Application';
import { HttpAppConfig } from '../../../../src/infrastructure/config/HttpAppConfig';
import { DependencyContainer } from '../../../../src/infrastructure/config/DependencyContainer';
import { EmailController } from '../../../../src/presentation/email/controllers/EmailController';
import { TestRunner } from '../../../../src/infrastructure/test/TestRunner';
import { CardCompany } from '../../../../src/domain/enums/CardCompany';
import { ProcessEmailUseCase } from '../../../../src/usecases/email/ProcessEmailUseCase';
import { Server } from 'http';

// 依存コンポーネントをモック化
jest.mock('../../../../src/infrastructure/config/HttpAppConfig');
jest.mock('../../../../src/infrastructure/config/DependencyContainer');
jest.mock('../../../../src/presentation/email/controllers/EmailController');
jest.mock('../../../../src/infrastructure/test/TestRunner');

// Loggerをモック化
jest.mock('../../../../shared/infrastructure/logging/Logger', () => ({
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

// process._getActiveHandles をモック化
const mockActiveHandles: any[] = [];
// Node.jsのプロセスオブジェクトを拡張
declare global {
  namespace NodeJS {
    interface Process {
      _getActiveHandles?: () => any[];
    }
  }
}

Object.defineProperty(process, '_getActiveHandles', {
  value: jest.fn().mockReturnValue(mockActiveHandles),
  configurable: true,
  writable: true
});

describe('Application', () => {
  let application: Application;
  let mockHttpAppConfig: jest.Mocked<HttpAppConfig>;
  let mockDependencyContainer: jest.Mocked<DependencyContainer>;
  let mockEmailController: jest.Mocked<EmailController>;
  let mockTestRunner: jest.Mocked<TestRunner>;
  let mockServer: Partial<Server>;
  let originalExit: typeof process.exit;
  let mockExit: jest.Mock;
  let originalSetTimeout: typeof setTimeout;

  beforeEach(() => {
    jest.clearAllMocks();

    // process.exit をモック化
    originalExit = process.exit;
    mockExit = jest.fn() as jest.Mock;
    process.exit = mockExit as unknown as typeof process.exit;

    // タイムアウトのモック - モックの代わりにspyOnを使用
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

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

  afterEach(() => {
    // テスト後にモックタイマーをリセット
    jest.useRealTimers();
    // process.exit を元に戻す
    process.exit = originalExit;
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
      await expect(application.initialize()).rejects.toThrow('アプリケーションの初期化に失敗しました');
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
      await expect(application.runInTestMode(CardCompany.MUFG)).rejects.toThrow('テストモードの実行に失敗しました');
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

  describe('setupShutdownHooks', () => {
    test('SIGINTシグナルでshutdownが呼び出されること', async () => {
      // shutdownメソッドをスパイ
      const shutdownSpy = jest.spyOn(application, 'shutdown').mockResolvedValue();

      // アプリケーションを初期化して実行
      await application.initialize();
      await application.runInNormalMode();

      // SIGINTイベントをエミュレート
      process.emit('SIGINT');

      // shutdownが呼ばれたことを確認
      expect(shutdownSpy).toHaveBeenCalled();
    });

    test('SIGTERMシグナルでshutdownが呼び出されること', async () => {
      // shutdownメソッドをスパイ
      const shutdownSpy = jest.spyOn(application, 'shutdown').mockResolvedValue();

      // アプリケーションを初期化して実行
      await application.initialize();
      await application.runInNormalMode();

      // SIGTERMイベントをエミュレート
      process.emit('SIGTERM');

      // shutdownが呼ばれたことを確認
      expect(shutdownSpy).toHaveBeenCalled();
    });
  });

  describe('cleanupUnresolvedTimers', () => {
    test('未解決のタイマーをクリーンアップすること', async () => {
      // アクティブハンドルにモックタイマーを追加
      const mockTimeout = { constructor: { name: 'Timeout' } };
      const mockInterval = { constructor: { name: 'Interval' } };
      mockActiveHandles.push(mockTimeout, mockInterval);

      // clearTimeoutとclearIntervalをモック
      global.clearTimeout = jest.fn();
      global.clearInterval = jest.fn();

      // shutdownを呼び出してクリーンアップをトリガー
      await application.shutdown();

      // タイマーが正しくクリアされたことを確認
      expect(global.clearTimeout).toHaveBeenCalledWith(mockTimeout);
      expect(global.clearInterval).toHaveBeenCalledWith(mockInterval);

      // タイマーが設定されたことを確認
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 10000);

      // タイマーを進めてプロセス終了を確認
      jest.advanceTimersByTime(10000);
      expect(mockExit).toHaveBeenCalledWith(0);

      // テスト後にクリア
      mockActiveHandles.length = 0;
    });

    test('_getActiveHandlesが存在しない場合も正常に動作すること', async () => {
      // _getActiveHandlesを一時的に削除
      const originalGetActiveHandles = process._getActiveHandles;
      delete process._getActiveHandles;

      // shutdownを呼び出してクリーンアップをトリガー
      await application.shutdown();

      // タイマーが設定されたことを確認
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 10000);

      // タイマーを進めてプロセス終了を確認
      jest.advanceTimersByTime(10000);
      expect(mockExit).toHaveBeenCalledWith(0);

      // 後処理：_getActiveHandlesを復元
      if (originalGetActiveHandles) {
        process._getActiveHandles = originalGetActiveHandles;
      }
    });

    test('cleanupUnresolvedTimersでエラーが発生しても処理が継続されること', async () => {
      // モックをリセット
      jest.clearAllMocks();

      // _getActiveHandlesをモック化してエラーをスローするようにする
      if (process._getActiveHandles) {
        const originalGetActiveHandles = process._getActiveHandles;
        process._getActiveHandles = jest.fn().mockImplementation(() => {
          throw new Error('_getActiveHandles error');
        });

        try {
          // シャットダウンを実行
          // シャットダウンが例外をスローしないことだけを確認する
          await expect(application.shutdown()).resolves.not.toThrow();

          // ここでは特定のメソッド呼び出しを検証せず、
          // エラーが適切に処理されたことだけを確認する
        } finally {
          // 元に戻す
          process._getActiveHandles = originalGetActiveHandles;
        }
      }
    });
  });

  describe('renderStatusDashboardIfCompactMode', () => {
    test('コンパクトモードの場合、一定時間後にステータスダッシュボードが表示されること', async () => {
      // コンパクトモードを有効化
      process.env.COMPACT_LOGS = 'true';

      // 通常モードで実行
      await application.runInNormalMode();

      // タイマーが設定されたことを確認
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);

      // タイマーを進めて確認
      jest.advanceTimersByTime(1000);

      // renderStatusDashboardが呼ばれることを確認
      expect(require('../../../../shared/infrastructure/logging/Logger').logger.renderStatusDashboard).toHaveBeenCalled();

      // 環境変数をリセット
      delete process.env.COMPACT_LOGS;
    });

    test('コンパクトモードでない場合、ステータスダッシュボードが表示されないこと', async () => {
      // コンパクトモードを無効化
      delete process.env.COMPACT_LOGS;

      // 通常モードで実行
      await application.runInNormalMode();

      // renderStatusDashboardが1000ms後に呼ばれないことを確認
      jest.advanceTimersByTime(1000);
      expect(require('../../../../shared/infrastructure/logging/Logger').logger.renderStatusDashboard).not.toHaveBeenCalled();
    });
  });
});