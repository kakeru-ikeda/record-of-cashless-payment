import { Router } from 'express';
import { MonitoringController } from '@presentation/api/controllers/MonitoringController';

/**
 * モニタリングルーター - サーバー稼働状況を監視するためのエンドポイント
 */
export class MonitoringRoutes {
  private router: Router;
  private monitoringController: MonitoringController;

  constructor() {
    // eslint-disable-next-line new-cap
    this.router = Router();
    this.monitoringController = new MonitoringController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // ヘルスチェックエンドポイント - サーバーの基本的な稼働状況を確認
    this.router.get('/health', this.monitoringController.healthCheck);

    // ステータスダッシュボードエンドポイント - 詳細なサービスステータスをJSON形式で提供
    this.router.get('/status', this.monitoringController.getServiceStatus);

    // エラーログエンドポイント - 最近のエラーログを取得
    this.router.get('/errors', this.monitoringController.getErrorLogs);

    // HTMLダッシュボードビュー - ブラウザでの確認用
    this.router.get('/dashboard', this.monitoringController.renderDashboard);
  }

  public getRouter(): Router {
    return this.router;
  }
}
