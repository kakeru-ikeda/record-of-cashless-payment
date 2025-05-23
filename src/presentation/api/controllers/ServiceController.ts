import { Request, Response } from 'express';
import { logger } from '../../../../shared/infrastructure/logging/Logger';
import { EmailController } from '../../email/controllers/EmailController';
import { AppError, ErrorType } from '../../../../shared/infrastructure/errors/AppError';
import { ErrorHandler } from '../../../../shared/infrastructure/errors/ErrorHandler';
import { ResponseHelper } from '../../../../shared/utils/ResponseHelper';

/**
 * サービス管理コントローラー
 * アプリケーションの各サービスの起動・停止・再起動を制御
 */
export class ServiceController {
    private emailController: EmailController | null = null;

    /**
     * EmailControllerを設定
     * @param emailController メールコントローラーのインスタンス
     */
    public setEmailController(emailController: EmailController): void {
        this.emailController = emailController;
    }

    /**
     * サービス一覧を取得
     */
    public getServices = async (req: Request, res: Response): Promise<void> => {
        try {
            // 現在利用可能なサービスのリストを返す
            const services = [
                {
                    id: 'email-monitoring',
                    name: 'メール監視サービス',
                    description: 'カード利用通知メールの監視サービス',
                    status: this.emailController?.isMonitoring() ? 'active' : 'inactive',
                    actions: ['start', 'stop', 'restart']
                }
            ];

            const response = ResponseHelper.success('サービス一覧を取得しました', services);
            res.status(response.status).json(response);
        } catch (error) {
            const appError = error instanceof AppError
                ? error
                : new AppError(
                    'サービス一覧の取得中にエラーが発生しました',
                    ErrorType.GENERAL,
                    { endpoint: 'getServices' },
                    error instanceof Error ? error : undefined
                );

            logger.error(appError, 'ServiceController');

            const errorResponse = ErrorHandler.handleApiError(error, 'ServiceController.getServices');
            res.status(errorResponse.status).json(errorResponse);
        }
    };

    /**
     * サービスの状態変更（起動・停止・再起動）
     */
    public controlService = async (req: Request, res: Response): Promise<void> => {
        try {
            const serviceId = req.params.id;
            const action = req.body.action;

            if (!['start', 'stop', 'restart'].includes(action)) {
                throw new AppError('無効なアクション', ErrorType.VALIDATION, { action });
            }

            if (serviceId === 'email-monitoring') {
                if (!this.emailController) {
                    throw new AppError('EmailControllerが初期化されていません', ErrorType.CONFIGURATION);
                }

                switch (action) {
                    case 'start':
                        if (this.emailController.isMonitoring()) {
                            throw new AppError('メール監視サービスは既に起動しています', ErrorType.VALIDATION, { serviceId });
                        }
                        await this.emailController.startAllMonitoring();
                        logger.info('メール監視サービスを開始しました', 'ServiceController');
                        break;

                    case 'stop':
                        if (!this.emailController.isMonitoring()) {
                            throw new AppError('メール監視サービスは既に停止しています', ErrorType.VALIDATION, { serviceId });
                        }
                        await this.emailController.stopMonitoring();
                        logger.info('メール監視サービスを停止しました', 'ServiceController');
                        break;

                    case 'restart':
                        await this.emailController.stopMonitoring();
                        await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
                        await this.emailController.startAllMonitoring();
                        logger.info('メール監視サービスを再起動しました', 'ServiceController');
                        break;
                }

                const message = `メール監視サービスを${action === 'start' ? '開始' : action === 'stop' ? '停止' : '再起動'}しました`;
                const data = {
                    id: 'email-monitoring',
                    status: this.emailController.isMonitoring() ? 'active' : 'inactive'
                };

                const response = ResponseHelper.success(message, data);
                res.status(response.status).json(response);
            } else {
                throw new AppError('指定されたサービスが見つかりません', ErrorType.NOT_FOUND, { serviceId });
            }
        } catch (error) {
            const appError = error instanceof AppError
                ? error
                : new AppError(
                    'サービス制御中にエラーが発生しました',
                    ErrorType.GENERAL,
                    {
                        serviceId: req.params.id,
                        action: req.body.action
                    },
                    error instanceof Error ? error : undefined
                );

            logger.error(appError, 'ServiceController');

            const errorResponse = ErrorHandler.handleApiError(error, 'ServiceController.controlService');
            res.status(errorResponse.status).json(errorResponse);
        }
    };
}