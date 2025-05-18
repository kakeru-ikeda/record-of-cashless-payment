import request from 'supertest';
import express from 'express';
import { ServiceController } from '../../../../src/presentation/api/controllers/ServiceController';
import { MonitoringRoutes } from '../../../../src/presentation/api/routes/MonitoringRoutes';
import { ServiceRoutes } from '../../../../src/presentation/api/routes/ServiceRoutes';
import { EmailController } from '../../../../src/presentation/email/controllers/EmailController';

// 認証ミドルウェアをモック化して常に認証を通すようにする
jest.mock('../../../../shared/firebase/AuthMiddleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => next()
}));

// Loggerをモック化
jest.mock('../../../../shared/utils/Logger', () => {
  // サービスのモックデータを作成
  const mockServices = new Map();
  mockServices.set('TestService', {
    name: 'TestService',
    status: 'online',
    message: 'テスト用サービス',
    lastUpdated: new Date(),
    errorCount: 0
  });
  
  // エラー履歴のモックデータを作成
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
      errorHistory: mockErrorHistory
    }
  };
});

// EmailControllerをモック
jest.mock('../../../../src/presentation/email/controllers/EmailController');

describe('HTTP統合テスト', () => {
  let app: express.Application;
  let mockEmailController: jest.Mocked<EmailController>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Expressアプリケーションの初期化
    app = express();
    app.use(express.json());
    
    // EmailControllerのモック設定
    mockEmailController = {
      isMonitoring: jest.fn().mockReturnValue(false),
      startAllMonitoring: jest.fn().mockResolvedValue(undefined),
      stopMonitoring: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<EmailController>;
    
    // モニタリングルートの設定
    const monitoringRoutes = new MonitoringRoutes();
    app.use('/monitoring', monitoringRoutes.getRouter());
    
    // サービスルートの設定
    const serviceController = new ServiceController();
    serviceController.setEmailController(mockEmailController);
    const serviceRoutes = new ServiceRoutes(serviceController);
    app.use('/api/services', serviceRoutes.getRouter());
  });

  describe('モニタリングエンドポイント', () => {
    test('GET /monitoring/health: 正常なヘルスチェックレスポンスを返すこと', async () => {
      const response = await request(app).get('/monitoring/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Server is running');
      expect(response.body).toHaveProperty('data');
    });

    test('GET /monitoring/status: サービスステータス情報を返すこと', async () => {
      const response = await request(app).get('/monitoring/status');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('services');
      expect(response.body.data.services).toBeInstanceOf(Array);
    });

    test('GET /monitoring/errors: エラーログ情報を返すこと', async () => {
      const response = await request(app).get('/monitoring/errors');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('errors');
      expect(response.body.data.errors).toBeInstanceOf(Array);
    });

    test('GET /monitoring/dashboard: HTMLダッシュボードを返すこと', async () => {
      const response = await request(app).get('/monitoring/dashboard');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });
  });

  describe('サービス管理エンドポイント', () => {
    test('GET /api/services: サービス一覧を返すこと', async () => {
      const response = await request(app).get('/api/services');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
    });

    test('POST /api/services/email-monitoring: サービスの起動操作が正常に処理されること', async () => {
      const response = await request(app)
        .post('/api/services/email-monitoring')
        .send({ action: 'start' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(mockEmailController.startAllMonitoring).toHaveBeenCalled();
    });

    test('POST /api/services/email-monitoring: サービスの停止操作が正常に処理されること', async () => {
      // サービスが実行中の状態をシミュレート
      mockEmailController.isMonitoring.mockReturnValue(true);
      
      const response = await request(app)
        .post('/api/services/email-monitoring')
        .send({ action: 'stop' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(mockEmailController.stopMonitoring).toHaveBeenCalled();
    });

    test('POST /api/services/email-monitoring: サービスの再起動操作が正常に処理されること', async () => {
      // サービスが実行中の状態をシミュレート
      mockEmailController.isMonitoring.mockReturnValue(true);
      
      const response = await request(app)
        .post('/api/services/email-monitoring')
        .send({ action: 'restart' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(mockEmailController.stopMonitoring).toHaveBeenCalled();
      expect(mockEmailController.startAllMonitoring).toHaveBeenCalled();
    });

    test('POST /api/services/email-monitoring: 無効なアクションを指定した場合エラーを返すこと', async () => {
      const response = await request(app)
        .post('/api/services/email-monitoring')
        .send({ action: 'invalid-action' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });

    test('POST /api/services/unknown-service: 存在しないサービスIDを指定した場合エラーを返すこと', async () => {
      const response = await request(app)
        .post('/api/services/unknown-service')
        .send({ action: 'start' });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
    });
  });
});
