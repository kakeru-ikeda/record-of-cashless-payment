import { ServiceController } from '../../../../../src/infrastructure/service/controllers/ServiceController';
import { EmailController } from '../../../../../src/interfaces/controllers/EmailController';
import { Request, Response } from 'express';
import { AppError } from '../../../../../shared/errors/AppError';

// EmailControllerをモック
jest.mock('../../../../../src/interfaces/controllers/EmailController');

// Loggerをモック化
jest.mock('../../../../../shared/utils/Logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logAppError: jest.fn(),
    updateServiceStatus: jest.fn()
  }
}));

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
  return res as Response;
};

describe('ServiceController', () => {
  let serviceController: ServiceController;
  let mockEmailController: jest.Mocked<EmailController>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // EmailControllerのモック設定
    mockEmailController = {
      isMonitoring: jest.fn().mockReturnValue(false),
      startAllMonitoring: jest.fn().mockResolvedValue(undefined),
      stopMonitoring: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<EmailController>;
    
    // ServiceControllerのインスタンス作成
    serviceController = new ServiceController();
    serviceController.setEmailController(mockEmailController);
  });

  describe('setEmailController', () => {
    test('EmailControllerが正しく設定されること', () => {
      // 新しいインスタンスを作成してEmailControllerを設定
      const controller = new ServiceController();
      controller.setEmailController(mockEmailController);
      
      // getServicesを呼び出してEmailControllerが使用されることを確認
      const req = mockRequest();
      const res = mockResponse();
      
      controller.getServices(req, res);
      
      // EmailControllerのisMonitoringが呼ばれたことを確認
      expect(mockEmailController.isMonitoring).toHaveBeenCalled();
    });
  });

  describe('getServices', () => {
    test('正常系: サービス一覧が返されること', async () => {
      // リクエスト/レスポンスのモック
      const req = mockRequest();
      const res = mockResponse();
      
      // EmailControllerのモック設定
      mockEmailController.isMonitoring.mockReturnValueOnce(true);
      
      // getServicesを実行
      await serviceController.getServices(req, res);
      
      // レスポンスが正しいことを確認
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'サービス一覧を取得しました',
        data: [
          expect.objectContaining({
            id: 'email-monitoring',
            status: 'active',
            actions: ['start', 'stop', 'restart']
          })
        ]
      });
    });

    test('異常系: エラーが適切に処理されること', async () => {
      // リクエスト/レスポンスのモック
      const req = mockRequest();
      const res = mockResponse();
      
      // EmailControllerからエラーが発生するように設定
      mockEmailController.isMonitoring.mockImplementationOnce(() => {
        throw new Error('テストエラー');
      });
      
      // getServicesを実行
      await serviceController.getServices(req, res);
      
      // エラーレスポンスが返されることを確認
      expect(res.status).toHaveBeenCalledWith(expect.any(Number));
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String),
          status: expect.any(Number)
        })
      );
      
      // エラーがログに記録されることを確認
      expect(require('../../../../../shared/utils/Logger').logger.logAppError).toHaveBeenCalled();
    });
  });

  describe('controlService', () => {
    test('正常系: メール監視サービスが起動できること', async () => {
      // サービスID: email-monitoring、アクション: start のリクエスト
      const req = mockRequest({ id: 'email-monitoring' }, { action: 'start' });
      const res = mockResponse();
      
      // サービスが停止中であることをモック
      mockEmailController.isMonitoring.mockReturnValue(false);
      
      // controlServiceを実行
      await serviceController.controlService(req, res);
      
      // startAllMonitoringが呼ばれることを確認
      expect(mockEmailController.startAllMonitoring).toHaveBeenCalled();
      
      // 成功レスポンスが返されることを確認
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'メール監視サービスを開始しました',
        data: expect.any(Object)
      });
    });

    test('正常系: メール監視サービスが停止できること', async () => {
      // サービスID: email-monitoring、アクション: stop のリクエスト
      const req = mockRequest({ id: 'email-monitoring' }, { action: 'stop' });
      const res = mockResponse();
      
      // サービスが実行中であることをモック
      mockEmailController.isMonitoring.mockReturnValue(true);
      
      // controlServiceを実行
      await serviceController.controlService(req, res);
      
      // stopMonitoringが呼ばれることを確認
      expect(mockEmailController.stopMonitoring).toHaveBeenCalled();
      
      // 成功レスポンスが返されることを確認
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'メール監視サービスを停止しました',
        data: expect.any(Object)
      });
    });

    test('正常系: メール監視サービスが再起動できること', async () => {
      // サービスID: email-monitoring、アクション: restart のリクエスト
      const req = mockRequest({ id: 'email-monitoring' }, { action: 'restart' });
      const res = mockResponse();
      
      // controlServiceを実行
      await serviceController.controlService(req, res);
      
      // stopMonitoringとstartAllMonitoringが呼ばれることを確認
      expect(mockEmailController.stopMonitoring).toHaveBeenCalled();
      expect(mockEmailController.startAllMonitoring).toHaveBeenCalled();
      
      // 成功レスポンスが返されることを確認
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'メール監視サービスを再起動しました',
        data: expect.any(Object)
      });
    });
    
    test('異常系: 無効なアクションの場合、エラーがスローされること', async () => {
      // 不正なアクションを指定
      const req = mockRequest({ id: 'email-monitoring' }, { action: 'invalid' });
      const res = mockResponse();
      
      // controlServiceを実行
      await serviceController.controlService(req, res);
      
      // エラーレスポンスが返されることを確認
      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('無効なアクション')
        })
      );
    });

    test('異常系: 存在しないサービスIDの場合、エラーがスローされること', async () => {
      // 存在しないサービスIDを指定
      const req = mockRequest({ id: 'non-existent-service' }, { action: 'start' });
      const res = mockResponse();
      
      // controlServiceを実行
      await serviceController.controlService(req, res);
      
      // エラーレスポンスが返されることを確認
      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('指定されたサービスが見つかりません')
        })
      );
    });

    test('異常系: サービスが既に起動している場合、起動アクションでエラーとなること', async () => {
      // サービスID: email-monitoring、アクション: start のリクエスト
      const req = mockRequest({ id: 'email-monitoring' }, { action: 'start' });
      const res = mockResponse();
      
      // サービスが既に起動中であることをモック
      mockEmailController.isMonitoring.mockReturnValue(true);
      
      // controlServiceを実行
      await serviceController.controlService(req, res);
      
      // エラーレスポンスが返されることを確認
      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('既に起動しています')
        })
      );
    });

    test('異常系: サービスが既に停止している場合、停止アクションでエラーとなること', async () => {
      // サービスID: email-monitoring、アクション: stop のリクエスト
      const req = mockRequest({ id: 'email-monitoring' }, { action: 'stop' });
      const res = mockResponse();
      
      // サービスが既に停止中であることをモック
      mockEmailController.isMonitoring.mockReturnValue(false);
      
      // controlServiceを実行
      await serviceController.controlService(req, res);
      
      // エラーレスポンスが返されることを確認
      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('既に停止しています')
        })
      );
    });

    test('異常系: EmailController未設定の場合、エラーとなること', async () => {
      // EmailControllerが設定されていないServiceControllerを作成
      const controllerWithoutEmail = new ServiceController();
      
      // サービスID: email-monitoring、アクション: start のリクエスト
      const req = mockRequest({ id: 'email-monitoring' }, { action: 'start' });
      const res = mockResponse();
      
      // controlServiceを実行
      await controllerWithoutEmail.controlService(req, res);
      
      // エラーレスポンスが返されることを確認
      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('EmailControllerが初期化されていません')
        })
      );
    });
  });
});