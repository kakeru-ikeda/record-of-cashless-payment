import { AppConfig } from '../../../../src/infrastructure/config/AppConfig';
import { MonitoringRoutes } from '../../../../src/infrastructure/monitoring/routes/monitoringRoutes';
import { ServiceRoutes } from '../../../../src/infrastructure/service/routes/ServiceRoutes';
import { ServiceController } from '../../../../src/infrastructure/service/controllers/ServiceController';
import { EmailController } from '../../../../src/interfaces/controllers/EmailController';
import { Application } from 'express';
import { Server } from 'http';

// 依存コンポーネントをモック
jest.mock('../../../../src/infrastructure/monitoring/routes/monitoringRoutes');
jest.mock('../../../../src/infrastructure/service/routes/ServiceRoutes');
jest.mock('../../../../src/infrastructure/service/controllers/ServiceController');
jest.mock('express', () => {
  const mockRouter = {
    use: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    post: jest.fn().mockReturnThis()
  };

  const mockExpress: any = jest.fn(() => mockRouter);
  mockExpress.json = jest.fn().mockReturnValue('json-parser-middleware');

  return mockExpress;
});

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

describe('AppConfig', () => {
  let appConfig: AppConfig;
  let mockExpressApp: any;
  let mockMonitoringRoutes: jest.Mocked<MonitoringRoutes>;
  let mockServiceRoutes: jest.Mocked<ServiceRoutes>;
  let mockServiceController: jest.Mocked<ServiceController>;
  let mockEmailController: jest.Mocked<EmailController>;
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

    // ServiceControllerのモック
    mockServiceController = new ServiceController() as jest.Mocked<ServiceController>;
    (mockServiceController.setEmailController as jest.Mock).mockReturnValue(undefined);
    (ServiceController as jest.MockedClass<typeof ServiceController>).mockImplementation(() => mockServiceController);

    // EmailControllerのモック
    mockEmailController = {} as jest.Mocked<EmailController>;

    // AppConfigのインスタンスを作成
    appConfig = new AppConfig();
  });

  describe('constructor', () => {
    test('Expressアプリケーションが初期化され、ミドルウェアが設定されること', () => {
      // コンストラクタ内で以下が実行されていることを確認
      const express = require('express');
      expect(express).toHaveBeenCalled();
      expect(express.json).toHaveBeenCalled();
      expect(mockExpressApp.use).toHaveBeenCalledWith('json-parser-middleware');
    });

    test('デフォルトポートは環境変数未設定時に3000になること', () => {
      delete process.env.PORT;
      appConfig = new AppConfig();
      const server = appConfig.startServer();
      
      expect(mockExpressApp.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    });

    test('環境変数PORTが設定されている場合はその値が使われること', () => {
      process.env.PORT = '4000';
      appConfig = new AppConfig();
      const server = appConfig.startServer();
      
      expect(mockExpressApp.listen).toHaveBeenCalledWith(4000, expect.any(Function));
      
      // 環境変数をリセット
      delete process.env.PORT;
    });
  });

  describe('setupMonitoringRoutes', () => {
    test('モニタリングルートが正しく設定されること', () => {
      appConfig.setupMonitoringRoutes();

      // MonitoringRoutesのインスタンスが作成されることを確認
      expect(MonitoringRoutes).toHaveBeenCalled();
      
      // ルーターが正しいパスでマウントされることを確認
      expect(mockExpressApp.use).toHaveBeenCalledWith('/monitoring', 'monitoring-router');
      
      // ログに記録されることを確認
      expect(require('../../../../shared/utils/Logger').logger.updateServiceStatus)
        .toHaveBeenCalledWith('Monitoring', 'online', 'モニタリングAPI有効');
    });
  });

  describe('setupServiceRoutes', () => {
    test('サービス管理ルートが正しく設定されること', () => {
      appConfig.setupServiceRoutes(mockEmailController);

      // ServiceControllerとServiceRoutesのインスタンスが作成されることを確認
      expect(ServiceController).toHaveBeenCalled();
      expect(ServiceRoutes).toHaveBeenCalledWith(mockServiceController);
      
      // EmailControllerが設定されることを確認
      expect(mockServiceController.setEmailController).toHaveBeenCalledWith(mockEmailController);
      
      // ルーターが正しいパスでマウントされることを確認
      expect(mockExpressApp.use).toHaveBeenCalledWith('/api/services', 'service-router');
      
      // ログに記録されることを確認
      expect(require('../../../../shared/utils/Logger').logger.updateServiceStatus)
        .toHaveBeenCalledWith('ServiceManagementAPI', 'online', 'サービス管理API有効');
    });
  });

  describe('startServer', () => {
    test('HTTPサーバーが起動されること', () => {
      const server = appConfig.startServer();

      // listenメソッドが呼ばれることを確認
      expect(mockExpressApp.listen).toHaveBeenCalled();
      
      // サーバーオブジェクトが返されることを確認
      expect(server).toBe(mockServer);
      
      // ログに記録されることを確認
      expect(require('../../../../shared/utils/Logger').logger.info)
        .toHaveBeenCalledWith(expect.stringContaining('HTTPサーバーがポート'), 'HttpServer');
      expect(require('../../../../shared/utils/Logger').logger.updateServiceStatus)
        .toHaveBeenCalledWith('HttpServer', 'online');
    });
  });

  describe('getApp', () => {
    test('Expressアプリケーションインスタンスが返されること', () => {
      const app = appConfig.getApp();
      expect(app).toBe(mockExpressApp);
    });
  });
});