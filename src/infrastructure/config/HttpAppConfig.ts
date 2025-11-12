import express, { Application } from 'express';
import { MonitoringRoutes } from '@presentation/api/routes/MonitoringRoutes';
import { ServiceRoutes } from '@presentation/api/routes/ServiceRoutes';
import { CardUsageRoutes } from '@presentation/api/routes/CardUsageRoutes';
import { ReportsRoutes } from '@presentation/api/routes/ReportsRoutes';
import { ServiceController } from '@presentation/api/controllers/ServiceController';
import { CardUsageController } from '@presentation/api/controllers/CardUsageController';
import { ReportController } from '@presentation/api/controllers/ReportController';
import { logger } from '@shared/infrastructure/logging/Logger';
import { EmailController } from '@presentation/email/controllers/EmailController';
import { IHttpAppConfig } from '@domain/interfaces/infrastructure/config/IHttpAppConfig';
import { IDependencyContainer } from '@domain/interfaces/infrastructure/config/IDependencyContainer';
import { ResponseHelper } from '@shared/presentation/responses/ResponseHelper';
import { AppError } from '@shared/errors/AppError';

/**
 * アプリケーション設定を管理するクラス
 * サーバー設定、ミドルウェア設定、ルート設定を担当
 */
export class HttpAppConfig implements IHttpAppConfig {
  private app: Application;
  private port: number;
  private cardUsageController: CardUsageController | null = null;
  private reportController: ReportController;

  constructor() {
    // Express.jsサーバーの初期化
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000', 10);

    // ReportControllerは依存関係がないので初期化
    this.reportController = new ReportController();

    // 基本ミドルウェアを設定
    this.setupMiddleware();
  }

  /**
   * 基本的なミドルウェアを設定
   */
  private setupMiddleware(): void {
    // CORS設定
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // JSONボディパーサーを追加 - APIリクエストでJSONを処理するため
    this.app.use(express.json());

    // ヘルスチェックエンドポイント（認証不要）
    this.app.get('/health', (req, res) => {
      const response = ResponseHelper.success('サーバーは正常に動作しています', {
        status: 'OK',
        timestamp: new Date().toISOString(),
      });
      res.status(response.status).json(response);
    });

    // リクエストログ
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, 'API');
      next();
    });
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
   * カード利用明細APIルートを設定
   */
  public setupCardUsageRoutes(): void {
    if (!this.cardUsageController) {
      throw new Error('CardUsageController が初期化されていません。initializeControllersを先に呼び出してください。');
    }
    const cardUsageRoutes = new CardUsageRoutes(this.cardUsageController);
    this.app.use('/api/card-usages', cardUsageRoutes.getRouter());
    logger.updateServiceStatus('CardUsageAPI', 'online', 'カード利用明細API有効');
  }

  /**
   * レポートAPIルートを設定
   */
  public setupReportRoutes(): void {
    const reportsRoutes = new ReportsRoutes(this.reportController);
    this.app.use('/api/reports', reportsRoutes.getRouter());
    logger.updateServiceStatus('ReportAPI', 'online', 'レポートAPI有効');
  }

  /**
   * すべてのAPIルートを一括設定
   */
  public setupAllApiRoutes(emailController: EmailController): void {
    this.setupServiceRoutes(emailController);
    this.setupCardUsageRoutes();
    this.setupReportRoutes();

    // 404ハンドラー
    this.app.use('*', (req, res) => {
      const response = ResponseHelper.notFound(`Route ${req.originalUrl} not found`);
      res.status(response.status).json(response);
    });

    // エラーハンドラー
    this.app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error(error, 'API');

      const statusCode = (error as AppError).statusCode || 500;
      const response = ResponseHelper.error(
          statusCode,
          'Internal Server Error',
          error.message || 'An unexpected error occurred',
      );
      res.status(response.status).json(response);
    });
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

  /**
   * 依存性注入されたコントローラーを初期化
   */
  public initializeControllers(dependencyContainer: IDependencyContainer): void {
    this.cardUsageController = new CardUsageController(dependencyContainer.getDiscordNotifier());
    logger.updateServiceStatus('CardUsageController', 'online', '依存性注入で初期化完了');
  }
}
