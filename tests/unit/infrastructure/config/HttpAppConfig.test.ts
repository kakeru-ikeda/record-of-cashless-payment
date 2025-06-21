import { HttpAppConfig } from '../../../../src/infrastructure/config/HttpAppConfig';
import { MonitoringRoutes } from '../../../../src/presentation/api/routes/MonitoringRoutes';
import { ServiceRoutes } from '../../../../src/presentation/api/routes/ServiceRoutes';
import { CardUsageRoutes } from '../../../../src/presentation/api/routes/CardUsageRoutes';
import { ReportsRoutes } from '../../../../src/presentation/api/routes/ReportsRoutes';
import { ServiceController } from '../../../../src/presentation/api/controllers/ServiceController';
import { CardUsageController } from '../../../../src/presentation/api/controllers/CardUsageController';
import { ReportController } from '../../../../src/presentation/api/controllers/ReportController';
import { EmailController } from '../../../../src/presentation/email/controllers/EmailController';
import { IDependencyContainer } from '../../../../src/domain/interfaces/infrastructure/config/IDependencyContainer';
import { IDiscordNotifier } from '../../../../shared/domain/interfaces/discord/IDiscordNotifier';
import { Server } from 'http';

// 依存コンポーネントをモック
jest.mock('../../../../src/presentation/api/routes/MonitoringRoutes');
jest.mock('../../../../src/presentation/api/routes/ServiceRoutes');
jest.mock('../../../../src/presentation/api/routes/CardUsageRoutes');
jest.mock('../../../../src/presentation/api/routes/ReportsRoutes');
jest.mock('../../../../src/presentation/api/controllers/ServiceController');
jest.mock('../../../../src/presentation/api/controllers/CardUsageController');
jest.mock('../../../../src/presentation/api/controllers/ReportController');
jest.mock('express', () => {
  const mockRouter = {
    use: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    post: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis()
  };

  const mockExpress: any = jest.fn(() => mockRouter);
  mockExpress.json = jest.fn().mockReturnValue('json-parser-middleware');

  return mockExpress;
});

// Loggerをモック化
jest.mock('../../../../shared/infrastructure/logging/Logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logAppError: jest.fn(),
    updateServiceStatus: jest.fn()
  }
}));

// ResponseHelperをモック化
jest.mock('../../../../shared/presentation/responses/ResponseHelper', () => ({
  ResponseHelper: {
    success: jest.fn().mockReturnValue({ status: 200, data: {} }),
    error: jest.fn().mockReturnValue({ status: 500, error: {} }),
    notFound: jest.fn().mockReturnValue({ status: 404, error: {} })
  }
}));

describe('HttpAppConfig', () => {
  let httpAppConfig: HttpAppConfig;
  let mockExpressApp: any;
  let mockMonitoringRoutes: jest.Mocked<MonitoringRoutes>;
  let mockServiceRoutes: jest.Mocked<ServiceRoutes>;
  let mockCardUsageRoutes: jest.Mocked<CardUsageRoutes>;
  let mockReportsRoutes: jest.Mocked<ReportsRoutes>;
  let mockServiceController: jest.Mocked<ServiceController>;
  let mockCardUsageController: jest.Mocked<CardUsageController>;
  let mockReportController: jest.Mocked<ReportController>;
  let mockEmailController: jest.Mocked<EmailController>;
  let mockDependencyContainer: jest.Mocked<IDependencyContainer>;
  let mockDiscordNotifier: jest.Mocked<IDiscordNotifier>;
  let mockServer: Partial<Server>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Expressのモックアプリケーション
    mockExpressApp = require('express')();

    // Serverのモック
    mockServer = {
      address: jest.fn().mockReturnValue({ port: 3000 })
    };
    mockExpressApp.listen = jest.fn().mockImplementation((port, callback) => {
      if (callback) callback();
      return mockServer;
    });

    // MonitoringRoutesのモック
    mockMonitoringRoutes = new MonitoringRoutes() as jest.Mocked<MonitoringRoutes>;
    (mockMonitoringRoutes.getRouter as jest.Mock).mockReturnValue('monitoring-router');
    (MonitoringRoutes as jest.MockedClass<typeof MonitoringRoutes>).mockImplementation(() => mockMonitoringRoutes);

    // ServiceRoutesのモック
    mockServiceRoutes = new ServiceRoutes({} as any) as jest.Mocked<ServiceRoutes>;
    (mockServiceRoutes.getRouter as jest.Mock).mockReturnValue('service-router');
    (ServiceRoutes as jest.MockedClass<typeof ServiceRoutes>).mockImplementation(() => mockServiceRoutes);

    // CardUsageRoutesのモック
    mockCardUsageRoutes = new CardUsageRoutes({} as any) as jest.Mocked<CardUsageRoutes>;
    (mockCardUsageRoutes.getRouter as jest.Mock).mockReturnValue('card-usage-router');
    (CardUsageRoutes as jest.MockedClass<typeof CardUsageRoutes>).mockImplementation(() => mockCardUsageRoutes);

    // ReportsRoutesのモック
    mockReportsRoutes = new ReportsRoutes({} as any) as jest.Mocked<ReportsRoutes>;
    (mockReportsRoutes.getRouter as jest.Mock).mockReturnValue('reports-router');
    (ReportsRoutes as jest.MockedClass<typeof ReportsRoutes>).mockImplementation(() => mockReportsRoutes);

    // ServiceControllerのモック
    mockServiceController = new ServiceController() as jest.Mocked<ServiceController>;
    (mockServiceController.setEmailController as jest.Mock).mockReturnValue(undefined);
    (ServiceController as jest.MockedClass<typeof ServiceController>).mockImplementation(() => mockServiceController);

    // CardUsageControllerのモック
    mockCardUsageController = new CardUsageController({} as any) as jest.Mocked<CardUsageController>;
    (CardUsageController as jest.MockedClass<typeof CardUsageController>).mockImplementation(() => mockCardUsageController);

    // ReportControllerのモック
    mockReportController = new ReportController() as jest.Mocked<ReportController>;
    (ReportController as jest.MockedClass<typeof ReportController>).mockImplementation(() => mockReportController);

    // EmailControllerのモック
    mockEmailController = {} as jest.Mocked<EmailController>;

    // DiscordNotifierのモック
    mockDiscordNotifier = {} as jest.Mocked<IDiscordNotifier>;

    // DependencyContainerのモック
    mockDependencyContainer = {
      getDiscordNotifier: jest.fn().mockReturnValue(mockDiscordNotifier)
    } as unknown as jest.Mocked<IDependencyContainer>;

    // HttpAppConfigのインスタンスを作成
    httpAppConfig = new HttpAppConfig();
  });

  describe('constructor', () => {
    test('Expressアプリケーションが初期化され、ミドルウェアが設定されること', () => {
      // コンストラクタ内で以下が実行されていることを確認
      const express = require('express');
      expect(express).toHaveBeenCalled();
      expect(express.json).toHaveBeenCalled();
      expect(mockExpressApp.use).toHaveBeenCalledWith('json-parser-middleware');

      // ReportControllerが初期化されることを確認
      expect(ReportController).toHaveBeenCalled();

      // CORSミドルウェアが設定されることを確認
      expect(mockExpressApp.use).toHaveBeenCalledWith(expect.any(Function));

      // ヘルスチェックエンドポイントが設定されることを確認
      expect(mockExpressApp.get).toHaveBeenCalledWith('/health', expect.any(Function));

      // リクエストログミドルウェアが設定されることを確認
      expect(mockExpressApp.use).toHaveBeenCalledWith(expect.any(Function));
    });

    test('デフォルトポートは環境変数未設定時に3000になること', () => {
      delete process.env.PORT;
      httpAppConfig = new HttpAppConfig();
      const server = httpAppConfig.startServer();

      expect(mockExpressApp.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    });

    test('環境変数PORTが設定されている場合はその値が使われること', () => {
      process.env.PORT = '4000';
      httpAppConfig = new HttpAppConfig();
      const server = httpAppConfig.startServer();

      expect(mockExpressApp.listen).toHaveBeenCalledWith(4000, expect.any(Function));

      // 環境変数をリセット
      delete process.env.PORT;
    });
  });

  describe('setupMonitoringRoutes', () => {
    test('モニタリングルートが正しく設定されること', () => {
      httpAppConfig.setupMonitoringRoutes();

      // MonitoringRoutesのインスタンスが作成されることを確認
      expect(MonitoringRoutes).toHaveBeenCalled();

      // ルーターが正しいパスでマウントされることを確認
      expect(mockExpressApp.use).toHaveBeenCalledWith('/monitoring', 'monitoring-router');

      // ログに記録されることを確認
      expect(require('../../../../shared/infrastructure/logging/Logger').logger.updateServiceStatus)
        .toHaveBeenCalledWith('Monitoring', 'online', 'モニタリングAPI有効');
    });
  });

  describe('setupServiceRoutes', () => {
    test('サービス管理ルートが正しく設定されること', () => {
      httpAppConfig.setupServiceRoutes(mockEmailController);

      // ServiceControllerとServiceRoutesのインスタンスが作成されることを確認
      expect(ServiceController).toHaveBeenCalled();
      expect(ServiceRoutes).toHaveBeenCalledWith(mockServiceController);

      // EmailControllerが設定されることを確認
      expect(mockServiceController.setEmailController).toHaveBeenCalledWith(mockEmailController);

      // ルーターが正しいパスでマウントされることを確認
      expect(mockExpressApp.use).toHaveBeenCalledWith('/api/services', 'service-router');

      // ログに記録されることを確認
      expect(require('../../../../shared/infrastructure/logging/Logger').logger.updateServiceStatus)
        .toHaveBeenCalledWith('ServiceManagementAPI', 'online', 'サービス管理API有効');
    });
  });

  describe('setupCardUsageRoutes', () => {
    test('カード利用明細ルートが正しく設定されること', () => {
      // まずcontrollerを初期化
      httpAppConfig.initializeControllers(mockDependencyContainer);

      httpAppConfig.setupCardUsageRoutes();

      // CardUsageRoutesのインスタンスが作成されることを確認
      expect(CardUsageRoutes).toHaveBeenCalledWith(mockCardUsageController);

      // ルーターが正しいパスでマウントされることを確認
      expect(mockExpressApp.use).toHaveBeenCalledWith('/api/card-usages', 'card-usage-router');

      // ログに記録されることを確認
      expect(require('../../../../shared/infrastructure/logging/Logger').logger.updateServiceStatus)
        .toHaveBeenCalledWith('CardUsageAPI', 'online', 'カード利用明細API有効');
    });

    test('CardUsageControllerが初期化されていない場合、エラーがスローされること', () => {
      expect(() => {
        httpAppConfig.setupCardUsageRoutes();
      }).toThrow('CardUsageController が初期化されていません。initializeControllersを先に呼び出してください。');
    });
  });

  describe('setupReportRoutes', () => {
    test('レポートルートが正しく設定されること', () => {
      httpAppConfig.setupReportRoutes();

      // ReportsRoutesのインスタンスが作成されることを確認
      expect(ReportsRoutes).toHaveBeenCalledWith(mockReportController);

      // ルーターが正しいパスでマウントされることを確認
      expect(mockExpressApp.use).toHaveBeenCalledWith('/api/reports', 'reports-router');

      // ログに記録されることを確認
      expect(require('../../../../shared/infrastructure/logging/Logger').logger.updateServiceStatus)
        .toHaveBeenCalledWith('ReportAPI', 'online', 'レポートAPI有効');
    });
  });

  describe('setupAllApiRoutes', () => {
    test('すべてのAPIルートが正しく設定されること', () => {
      // まずcontrollerを初期化
      httpAppConfig.initializeControllers(mockDependencyContainer);

      // setupAllApiRoutesを実行
      httpAppConfig.setupAllApiRoutes(mockEmailController);

      // 各ルートが設定されることを確認
      expect(mockExpressApp.use).toHaveBeenCalledWith('/api/services', 'service-router');
      expect(mockExpressApp.use).toHaveBeenCalledWith('/api/card-usages', 'card-usage-router');
      expect(mockExpressApp.use).toHaveBeenCalledWith('/api/reports', 'reports-router');

      // 404ハンドラーが設定されることを確認
      expect(mockExpressApp.use).toHaveBeenCalledWith('*', expect.any(Function));

      // エラーハンドラーが設定されることを確認
      expect(mockExpressApp.use).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('initializeControllers', () => {
    test('依存性注入されたコントローラーが正しく初期化されること', () => {
      httpAppConfig.initializeControllers(mockDependencyContainer);

      // DependencyContainerからDiscordNotifierが取得されることを確認
      expect(mockDependencyContainer.getDiscordNotifier).toHaveBeenCalled();

      // CardUsageControllerが作成されることを確認
      expect(CardUsageController).toHaveBeenCalledWith(mockDiscordNotifier);

      // ログに記録されることを確認
      expect(require('../../../../shared/infrastructure/logging/Logger').logger.updateServiceStatus)
        .toHaveBeenCalledWith('CardUsageController', 'online', '依存性注入で初期化完了');
    });
  });

  describe('startServer', () => {
    test('HTTPサーバーが起動されること', () => {
      const server = httpAppConfig.startServer();

      // listenメソッドが呼ばれることを確認
      expect(mockExpressApp.listen).toHaveBeenCalled();

      // サーバーオブジェクトが返されることを確認
      expect(server).toBe(mockServer);

      // ログに記録されることを確認
      expect(require('../../../../shared/infrastructure/logging/Logger').logger.info)
        .toHaveBeenCalledWith(expect.stringContaining('HTTPサーバーがポート'), 'HttpServer');
      expect(require('../../../../shared/infrastructure/logging/Logger').logger.updateServiceStatus)
        .toHaveBeenCalledWith('HttpServer', 'online');
    });
  });

  describe('getApp', () => {
    test('正常系: Expressアプリケーションインスタンスが返されること', () => {
      const app = httpAppConfig.getApp();
      expect(app).toBe(mockExpressApp);
    });
  });
});