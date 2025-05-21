import { Request, Response } from 'express';
import { logger } from '../../../../shared/utils/Logger';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { ErrorHandler } from '../../../../shared/errors/ErrorHandler';
import { ResponseHelper } from '../../../../shared/utils/ResponseHelper';
import { MonitoringView } from '../views/MonitoringView';

/**
 * モニタリングコントローラー - サーバー状態の監視用エンドポイント実装
 */
export class MonitoringController {
  private readonly monitoringView: MonitoringView;
  
  /**
   * コンストラクタ
   */
  constructor() {
    this.monitoringView = new MonitoringView();
  }
  
  /**
   * シンプルなヘルスチェック - サーバーが稼働中かを確認
   */
  public healthCheck = (req: Request, res: Response): void => {
    const response = ResponseHelper.success('Server is running', {
      timestamp: new Date().toISOString()
    });
    res.status(response.status).json(response);
  };

  /**
   * サービスステータスの取得 - Loggerで追跡している全サービスの状態をJSON形式で返す
   */
  public getServiceStatus = (req: Request, res: Response): void => {
    try {
      // Loggerクラスからサービスステータスマップにアクセスするためのメソッドを呼び出す
      const serviceStatuses = (logger as any).services || new Map();
      
      // レスポンスデータを作成
      const servicesData = Array.from(serviceStatuses.values()).map((service: any) => ({
        name: service.name,
        status: service.status,
        message: service.message || '',
        lastUpdated: service.lastUpdated?.toISOString(),
        errorCount: service.errorCount || 0,
        lastErrorTime: service.lastErrorTime?.toISOString()
      }));
      
      const response = ResponseHelper.success('サービスステータスを取得しました', {
        timestamp: new Date().toISOString(),
        services: servicesData
      });
      
      res.status(response.status).json(response);
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError(
            'サービスステータス取得中にエラーが発生しました',
            ErrorType.GENERAL,
            { endpoint: 'getServiceStatus' },
            error instanceof Error ? error : undefined
          );
      
      logger.error(appError, 'MonitoringController');
      
      const errorResponse = ErrorHandler.handleApiError(error, 'MonitoringController.getServiceStatus');
      res.status(errorResponse.status).json(errorResponse);
    }
  };

  /**
   * エラーログの取得 - 最近のエラーログをJSON形式で返す
   */
  public getErrorLogs = (req: Request, res: Response): void => {
    try {
      // Loggerのエラー履歴にアクセス
      const errorHistory = (logger as any).errorHistory || [];
      
      // エラーデータを作成
      const errorsData = errorHistory.map((error: any) => ({
        timestamp: error.timestamp?.toISOString(),
        service: error.service,
        message: error.message,
        details: error.details
      }));
      
      const response = ResponseHelper.success('エラーログを取得しました', {
        timestamp: new Date().toISOString(),
        errors: errorsData
      });
      
      res.status(response.status).json(response);
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError(
            'エラーログ取得中にエラーが発生しました',
            ErrorType.GENERAL,
            { endpoint: 'getErrorLogs' },
            error instanceof Error ? error : undefined
          );
      
      logger.error(appError, 'MonitoringController');
      
      const errorResponse = ErrorHandler.handleApiError(error, 'MonitoringController.getErrorLogs');
      res.status(errorResponse.status).json(errorResponse);
    }
  };

  /**
   * HTMLダッシュボードのレンダリング - ブラウザで確認できるUI
   */
  public renderDashboard = (req: Request, res: Response): void => {
    try {
      // サービスステータスデータを取得
      const serviceStatuses = (logger as any).services || new Map();
      const errorHistory = (logger as any).errorHistory || [];
      
      // サービスデータを準備
      const servicesData = Array.from(serviceStatuses.values()).map((service: any) => ({
        name: service.name,
        status: service.status,
        message: service.message || '',
        lastUpdated: service.lastUpdated?.toISOString(),
        errorCount: service.errorCount || 0,
        lastErrorTime: service.lastErrorTime?.toISOString()
      }));
      
      // エラーデータを準備
      const errorsData = errorHistory.map((error: any) => ({
        timestamp: error.timestamp?.toISOString(),
        service: error.service,
        message: error.message,
        details: error.details
      }));
      
      // ビューを使用してHTMLをレンダリング
      const renderedHtml = this.monitoringView.renderDashboard(servicesData, errorsData);
      
      // HTMLとして送信
      res.setHeader('Content-Type', 'text/html');
      res.send(renderedHtml);
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError(
            'ダッシュボードレンダリング中にエラーが発生しました',
            ErrorType.GENERAL,
            { endpoint: 'renderDashboard' },
            error instanceof Error ? error : undefined
          );
      
      logger.error(appError, 'MonitoringController');
      
      const errorResponse = ResponseHelper.error(500, 'ダッシュボードレンダリング中にエラーが発生しました');
      res.status(errorResponse.status).send('Error rendering dashboard');
    }
  };
}