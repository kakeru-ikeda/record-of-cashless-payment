import express, { Application } from 'express';
import { MonitoringRoutes } from '@presentation/api/routes/MonitoringRoutes';
import { ServiceRoutes } from '@presentation/api/routes/ServiceRoutes';
import { ServiceController } from '@presentation/api/controllers/ServiceController';
import { logger } from '@shared/infrastructure/logging/Logger';
import { EmailController } from '@presentation/email/controllers/EmailController';
import { IHttpAppConfig } from '@domain/interfaces/infrastructure/config/IHttpAppConfig';

/**
 * アプリケーション設定を管理するクラス
 * サーバー設定、ミドルウェア設定、ルート設定を担当
 */
export class HttpAppConfig implements IHttpAppConfig {
  private app: Application;
  private port: number;

  constructor() {
    // Express.jsサーバーの初期化
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000', 10);

    // 基本ミドルウェアを設定
    this.setupMiddleware();
  }

  /**
   * 基本的なミドルウェアを設定
   */
  private setupMiddleware(): void {
    // JSONボディパーサーを追加 - APIリクエストでJSONを処理するため
    this.app.use(express.json());
  }

  /**
   * モニタリングルートを設定
   */
  public setupMonitoringRoutes(): void {
    const monitoringRoutes = new MonitoringRoutes();
    this.app.use('/monitoring', monitoringRoutes.getRouter());
    logger.updateServiceStatus('Monitoring', 'online', 'モニタリングAPI有効');
  }

  /**
   * サービス管理APIルートを設定
   */
  public setupServiceRoutes(emailController: EmailController): void {
    const serviceController = new ServiceController();
    serviceController.setEmailController(emailController);
    const serviceRoutes = new ServiceRoutes(serviceController);
    this.app.use('/api/services', serviceRoutes.getRouter());
    logger.updateServiceStatus('ServiceManagementAPI', 'online', 'サービス管理API有効');
  }

  /**
   * サーバーを起動
   * @returns 起動したHTTPサーバー
   */
  public startServer(): ReturnType<Application['listen']> {
    const server = this.app.listen(this.port, () => {
      logger.info(`HTTPサーバーがポート${this.port}で起動しました`, 'HttpServer');
      logger.updateServiceStatus('HttpServer', 'online');
    });

    return server;
  }

  /**
   * Expressアプリケーションを取得
   */
  public getApp(): Application {
    return this.app;
  }
}