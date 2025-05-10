import { Router } from 'express';
import { MonitoringController } from '../controllers/MonitoringController';
import { authMiddleware } from '../../../../shared/firebase/AuthMiddleware';

/**
 * モニタリングルーター - サーバー稼働状況を監視するためのエンドポイント
 */
export class MonitoringRoutes {
  private router: Router;
  private monitoringController: MonitoringController;

  constructor() {
    this.router = Router();
    this.monitoringController = new MonitoringController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // ヘルスチェックエンドポイント - サーバーの基本的な稼働状況を確認
    // ヘルスチェックは認証なしでアクセス可能に（監視システム用）
    this.router.get('/health', this.monitoringController.healthCheck);
    
    // ステータスダッシュボードエンドポイント - 詳細なサービスステータスをJSON形式で提供
    // 認証が必要
    this.router.get('/status', authMiddleware, this.monitoringController.getServiceStatus);
    
    // エラーログエンドポイント - 最近のエラーログを取得
    // 認証が必要
    this.router.get('/errors', authMiddleware, this.monitoringController.getErrorLogs);
    
    // HTMLダッシュボードビュー - ブラウザでの確認用
    this.router.get('/dashboard', this.monitoringController.renderDashboard);
  }

  public getRouter(): Router {
    return this.router;
  }
}