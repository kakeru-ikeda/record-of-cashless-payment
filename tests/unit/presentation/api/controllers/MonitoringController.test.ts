import { MonitoringController } from '../../../../../src/presentation/api/controllers/MonitoringController';
import { MonitoringView } from '../../../../../src/presentation/api/views/MonitoringView';
import { Request, Response } from 'express';

// MonitoringViewをモック
jest.mock('../../../../../src/presentation/api/views/MonitoringView');

// Loggerをモック
jest.mock('../../../../../shared/utils/Logger', () => ({
  logger: {
    services: new Map([
      ['TestService', {
        name: 'TestService',
        status: 'online',
        message: 'テスト中',
        lastUpdated: new Date(),
        errorCount: 0
      }]
    ]),
    errorHistory: [
      {
        timestamp: new Date(),
        service: 'TestService',
        message: 'テストエラー',
        details: 'エラー詳細'
      }
    ],
    logAppError: jest.fn()
  }
}));

describe('MonitoringController', () => {
  let monitoringController: MonitoringController;
  let mockView: jest.Mocked<MonitoringView>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;
  let setHeaderMock: jest.Mock;

  beforeEach(() => {
    // レスポンスモックをセットアップ
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();
    sendMock = jest.fn();
    setHeaderMock = jest.fn();
    
    mockRequest = {};
    mockResponse = {
      json: jsonMock,
      status: statusMock,
      send: sendMock,
      setHeader: setHeaderMock
    };
    
    // モックビューの設定
    mockView = new MonitoringView() as jest.Mocked<MonitoringView>;
    mockView.renderDashboard.mockReturnValue('<html>...</html>');
    
    // コントローラーの作成
    monitoringController = new MonitoringController();
    // プライベートプロパティのモック置き換え
    (monitoringController as any).monitoringView = mockView;
  });

  describe('healthCheck', () => {
    test('正常なレスポンスを返すこと', () => {
      monitoringController.healthCheck(mockRequest as Request, mockResponse as Response);
      
      // ステータスコードが200であることを確認
      expect(statusMock).toHaveBeenCalledWith(200);
      // JSONレスポンスが正しい形式であることを確認
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
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
    test('サービスステータスを正しく取得すること', () => {
      monitoringController.getServiceStatus(mockRequest as Request, mockResponse as Response);
      
      // ステータスコードが200であることを確認
      expect(statusMock).toHaveBeenCalledWith(200);
      // JSONレスポンスが正しい形式であることを確認
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 200,
          message: 'サービスステータスを取得しました',
          data: expect.objectContaining({
            services: expect.arrayContaining([
              expect.objectContaining({
                name: 'TestService',
                status: 'online'
              })
            ])
          })
        })
      );
    });
  });

  describe('renderDashboard', () => {
    test('ビューを使用してHTMLを生成して返すこと', () => {
      monitoringController.renderDashboard(mockRequest as Request, mockResponse as Response);
      
      // ビューのrenderDashboardメソッドが呼ばれることを確認
      expect(mockView.renderDashboard).toHaveBeenCalled();
      // Content-Typeヘッダーが設定されることを確認
      expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'text/html');
      // レンダリングされたHTMLが送信されることを確認
      expect(sendMock).toHaveBeenCalledWith('<html>...</html>');
    });
  });
});