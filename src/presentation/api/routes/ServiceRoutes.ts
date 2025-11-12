import { Router } from 'express';
import { ServiceController } from '@presentation/api/controllers/ServiceController';
import { authMiddleware } from '@shared/presentation/middlewares/AuthMiddleware';

/**
 * サービス管理ルーター
 * アプリケーションサービスの起動・停止などを制御するAPIエンドポイント
 */
export class ServiceRoutes {
    private router: Router;
    private serviceController: ServiceController;

    constructor(serviceController: ServiceController) {
        // eslint-disable-next-line new-cap
        this.router = Router();
        this.serviceController = serviceController;
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        // すべてのエンドポイントに認証ミドルウェアを適用
        this.router.use(authMiddleware);

        // サービス一覧取得
        this.router.get('/', this.serviceController.getServices);

        // サービス制御（起動・停止・再起動）
        this.router.post('/:id', this.serviceController.controlService);
    }

    public getRouter(): Router {
        return this.router;
    }
}
