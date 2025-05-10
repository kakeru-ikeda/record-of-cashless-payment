import { Request, Response } from 'express';
import { logger } from '../../../../shared/utils/Logger';
import { EmailController } from '../../../interfaces/controllers/EmailController';

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

            res.status(200).json({
                success: true,
                message: 'サービス一覧を取得しました',
                data: services
            });
        } catch (error) {
            logger.error('サービス一覧の取得中にエラーが発生しました', error, 'ServiceController');
            res.status(500).json({
                success: false,
                message: 'サービス一覧の取得に失敗しました',
                error: error instanceof Error ? error.message : String(error)
            });
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
                res.status(400).json({
                    success: false,
                    message: '無効なアクション',
                    data: null
                });
                return;
            }

            if (serviceId === 'email-monitoring') {
                if (!this.emailController) {
                    throw new Error('EmailControllerが初期化されていません');
                }

                switch (action) {
                    case 'start':
                        if (this.emailController.isMonitoring()) {
                            res.status(400).json({
                                success: false,
                                message: 'メール監視サービスは既に起動しています',
                                data: null
                            });
                            return;
                        }
                        await this.emailController.startAllMonitoring();
                        logger.info('メール監視サービスを開始しました', 'ServiceController');
                        break;
                    
                    case 'stop':
                        if (!this.emailController.isMonitoring()) {
                            res.status(400).json({
                                success: false,
                                message: 'メール監視サービスは既に停止しています',
                                data: null
                            });
                            return;
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

                res.status(200).json({
                    success: true,
                    message: `メール監視サービスを${action === 'start' ? '開始' : action === 'stop' ? '停止' : '再起動'}しました`,
                    data: {
                        id: 'email-monitoring',
                        status: this.emailController.isMonitoring() ? 'active' : 'inactive'
                    }
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: '指定されたサービスが見つかりません',
                    data: null
                });
            }
        } catch (error) {
            logger.error('サービス制御中にエラーが発生しました', error, 'ServiceController');
            res.status(500).json({
                success: false,
                message: 'サービス制御に失敗しました',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    };
}