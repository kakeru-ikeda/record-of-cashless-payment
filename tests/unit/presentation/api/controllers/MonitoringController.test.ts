import { MonitoringController } from '../../../../../src/presentation/api/controllers/MonitoringController';
import { Request, Response } from 'express';

// Loggerをモック化
jest.mock('../../../../../shared/utils/Logger', () => {
  const mockServices = new Map();
  mockServices.set('TestService', {
    name: 'TestService',
    status: 'online',
    message: 'テスト用サービス',
    lastUpdated: new Date(),
    errorCount: 0
  });
  
  const mockErrorHistory = [
    {
      timestamp: new Date(),
      service: 'TestService',
      message: 'テストエラー',
      details: 'エラーの詳細'
    }
  ];

  return {
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      logAppError: jest.fn(),
      updateServiceStatus: jest.fn(),
      services: mockServices,
      errorHistory: mockErrorHistory,
      LogLevel: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
      }
    }
  };
});

// Express Request/Responseのモック作成ヘルパー
const mockRequest = (params = {}, body = {}) => {
  return {
    params,
    body
  } as unknown as Request;
};

const mockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe('MonitoringController', () => {
  let monitoringController: MonitoringController;

  beforeEach(() => {
    jest.clearAllMocks();
    monitoringController = new MonitoringController();
  });

  describe('healthCheck', () => {
    test('正常系: 200ステータスとサーバー稼働メッセージを返すこと', () => {
      const req = mockRequest();
      const res = mockResponse();

      monitoringController.healthCheck(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 200,
          message: 'Server is running',
          data: expect.objectContaining({
            timestamp: expect.any(String)
          })
        })
      );
    });
  });

  describe('getServiceStatus', () => {
    test('正常系: 200ステータスとサービスステータス情報を返すこと', () => {
      const req = mockRequest();
      const res = mockResponse();

      monitoringController.getServiceStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 200,
          message: 'サービスステータスを取得しました',
          data: expect.objectContaining({
            services: expect.arrayContaining([
              expect.objectContaining({
                name: 'TestService',
                status: 'online'
              })
            ]),
            timestamp: expect.any(String)
          })
        })
      );
    });

    test('異常系: エラー発生時に適切なエラーレスポンスを返すこと', () => {
      const req = mockRequest();
      const res = mockResponse();
      
      // logger変数を取得
      const { logger } = require('../../../../../shared/utils/Logger');
      
      // serviceデータの取得でエラーを発生させる
      const mockServices = logger.services;
      
      // 一時的にservicesを未定義にしてエラーを発生させる
      logger.services = undefined;
      
      // エラーが発生してもハンドリングされ、適切なレスポンスが返されることを期待
      monitoringController.getServiceStatus(req, res);
      
      // エラーハンドリングが呼ばれたことを確認
      expect(res.status).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      
      // 後始末: servicesを元に戻す
      logger.services = mockServices;
    });
  });

  describe('getErrorLogs', () => {
    test('正常系: 200ステータスとエラーログ情報を返すこと', () => {
      const req = mockRequest();
      const res = mockResponse();

      monitoringController.getErrorLogs(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 200,
          message: 'エラーログを取得しました',
          data: expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                service: 'TestService',
                message: 'テストエラー'
              })
            ]),
            timestamp: expect.any(String)
          })
        })
      );
    });
  });

  describe('renderDashboard', () => {
    test('正常系: HTMLダッシュボードを適切なヘッダーとともに返すこと', () => {
      const req = mockRequest();
      const res = mockResponse();

      monitoringController.renderDashboard(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(res.send).toHaveBeenCalled();
      // HTMLテンプレートの検証は複雑になるため、呼び出しのみ確認
    });
  });
});
