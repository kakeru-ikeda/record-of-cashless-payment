import { Request, Response } from 'express';
import { ResponseHelper } from '@shared/presentation/responses/ResponseHelper';
import { DiscordNotifier } from '@shared/infrastructure/discord/DiscordNotifier';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';
import { FirestoreCardUsageRepository } from '@infrastructure/database/repositories/FirestoreCardUsageRepository';
import { FirestoreCardUsageUseCase } from '@usecase/database/FirestoreCardUsageUseCase';

/**
 * カード利用データを操作するためのコントローラークラス
 */
export class CardUsageController {
    private cardUsageUseCase: FirestoreCardUsageUseCase;

    /**
     * コンストラクタ
     * @param discordNotifier Discord通知サービス（依存性注入）
     */
    constructor(discordNotifier: DiscordNotifier) {
        const cardUsageRepository = new FirestoreCardUsageRepository();
        this.cardUsageUseCase = new FirestoreCardUsageUseCase(cardUsageRepository, discordNotifier);
    }

    /**
     * カード利用情報を全て取得する
     */
    public getCardUsagesByDate = async (req: Request, res: Response): Promise<void> => {
        try {
            const year = req.query.year as string;
            const month = req.query.month as string;

            const usages = await this.cardUsageUseCase.getCardUsagesByYearMonth(year, month);

            const response = ResponseHelper.success('カード利用情報の取得に成功しました', usages);
            res.status(response.status).json(response);
        } catch (error) {
            const response = await ErrorHandler.handle(error, 'CardUsageController.getCardUsagesByDate');
            res.status(500).json(ResponseHelper.fromAppError(response));
        }
    };

    /**
     * IDによるカード利用情報の取得
     */
    public getCardUsageById = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            const cardUsage = await this.cardUsageUseCase.getCardUsageById(id);

            const response = ResponseHelper.success('カード利用情報の取得に成功しました', cardUsage);
            res.status(response.status).json(response);
        } catch (error) {
            const response = await ErrorHandler.handle(error, 'CardUsageController.getCardUsageById');
            res.status(500).json(ResponseHelper.fromAppError(response));
        }
    };

    /**
     * カード利用情報の新規作成
     */
    public createCardUsage = async (req: Request, res: Response): Promise<void> => {
        try {
            const cardUsageData = req.body;

            const result = await this.cardUsageUseCase.createCardUsage(cardUsageData);

            const response = ResponseHelper.createResponse(201, true, 'カード利用情報の作成に成功しました', result);
            res.status(response.status).json(response);
        } catch (error) {
            const response = await ErrorHandler.handle(error, 'CardUsageController.createCardUsage');
            res.status(500).json(ResponseHelper.fromAppError(response));
        }
    };

    /**
     * カード利用情報の更新
     */
    public updateCardUsage = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const result = await this.cardUsageUseCase.updateCardUsage(id, updateData);

            const response = ResponseHelper.success('カード利用情報の更新に成功しました', result);
            res.status(response.status).json(response);
        } catch (error) {
            const response = await ErrorHandler.handle(error, 'CardUsageController.updateCardUsage');
            res.status(500).json(ResponseHelper.fromAppError(response));
        }
    };

    /**
     * カード利用情報の削除（論理削除 - is_activeをfalseに設定）
     */
    public deleteCardUsage = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            const result = await this.cardUsageUseCase.deleteCardUsage(id);

            const response = ResponseHelper.success('カード利用情報の削除に成功しました', result);
            res.status(response.status).json(response);
        } catch (error) {
            const response = await ErrorHandler.handle(error, 'CardUsageController.deleteCardUsage');
            res.status(500).json(ResponseHelper.fromAppError(response));
        }
    };
}
