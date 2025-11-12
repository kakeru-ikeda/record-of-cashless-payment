import { Router } from 'express';
import { CardUsageController } from '@presentation/api/controllers/CardUsageController';
import { authMiddleware } from '@shared/presentation/middlewares/AuthMiddleware';

/**
 * カード利用明細ルーター
 * カード利用明細に関するAPIエンドポイント
 */
export class CardUsageRoutes {
    private router: Router;
    private cardUsageController: CardUsageController;

    constructor(cardUsageController: CardUsageController) {
        // eslint-disable-next-line new-cap
        this.router = Router();
        this.cardUsageController = cardUsageController;
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        // すべてのエンドポイントに認証ミドルウェアを適用
        this.router.use(authMiddleware);

        // カード利用明細一覧取得
        this.router.get('/', this.cardUsageController.getCardUsagesByDate);

        // 特定のカード利用明細取得
        this.router.get('/:id', this.cardUsageController.getCardUsageById);

        // カード利用明細作成
        this.router.post('/', this.cardUsageController.createCardUsage);

        // カード利用明細更新
        this.router.put('/:id', this.cardUsageController.updateCardUsage);

        // カード利用明細削除
        this.router.delete('/:id', this.cardUsageController.deleteCardUsage);
    }

    public getRouter(): Router {
        return this.router;
    }
}
