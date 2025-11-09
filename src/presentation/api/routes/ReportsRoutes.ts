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
        // eslint-disable-next-line new-cap
        this.router = Router();
        this.reportController = reportController;
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        // すべてのエンドポイントに認証ミドルウェアを適用
        this.router.use(authMiddleware);

        /**
         * 日次レポート取得 API (特定の日)
         */
        this.router.get('/daily/:year/:month/:day', this.reportController.getDailyReport);

        /**
         * 日次レポート取得 API (月内の全日)
         */
        this.router.get('/daily/:year/:month', this.reportController.getMonthlyDailyReports);

        /**
         * 週次レポート取得 API (特定の週)
         */
        this.router.get('/weekly/:year/:month/:term', this.reportController.getWeeklyReport);

        /**
         * 週次レポート取得 API (月内の全週)
         */
        this.router.get('/weekly/:year/:month', this.reportController.getMonthlyWeeklyReports);

        /**
         * 月次レポート取得 API
         */
        this.router.get('/monthly/:year/:month', this.reportController.getMonthlyReport);
    }

    public getRouter(): Router {
        return this.router;
    }
}
