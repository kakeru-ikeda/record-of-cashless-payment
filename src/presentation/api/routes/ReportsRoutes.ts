import { Router } from 'express';
import { ReportController } from '@presentation/api/controllers/ReportController';
import { authMiddleware } from '@shared/presentation/middlewares/AuthMiddleware';

/**
 * レポートルーター
 * レポートに関するAPIエンドポイント
 */
export class ReportsRoutes {
    private router: Router;
    private reportController: ReportController;

    constructor(reportController: ReportController) {
        this.router = Router();
        this.reportController = reportController;
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        // すべてのエンドポイントに認証ミドルウェアを適用
        this.router.use(authMiddleware);

        // レポート一覧取得
        // 将来的に必要な場合は実装
        // this.router.get('/', this.reportController.getReports);

        // 日次レポート取得（特定の日）
        this.router.get('/daily/:year/:month/:day', this.reportController.getDailyReport);

        // 月次レポート取得
        this.router.get('/monthly/:year/:month', this.reportController.getMonthlyReport);

        // 週次レポート取得
        this.router.get('/weekly/:year/:weekNumber', this.reportController.getWeeklyReport);
    }

    public getRouter(): Router {
        return this.router;
    }
}
