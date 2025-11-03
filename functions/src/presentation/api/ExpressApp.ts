import express, { Request, Response } from 'express';
import cors from 'cors';
import { EventHandlerFactory } from '../handlers/EventHandlerFactory';
import { ResponseHelper } from '../../../../shared/presentation/responses/ResponseHelper';

/**
 * Express アプリケーションを作成・設定
 */
export function createExpressApp(): express.Express {
    const app = express();

    // ミドルウェア設定
    app.use(cors({ origin: true })); // CORS対応
    app.use(express.json()); // JSONボディパーサー

    const factory = EventHandlerFactory.getInstance();

    /**
     * POST /process-firestore-document
     * Firestoreドキュメント処理をHTTP経由で実行
     */
    app.post('/process-firestore-document', async (req: Request, res: Response) => {
        const handler = factory.createProcessFirestoreDocumentHttpHandler();
        await handler.handle({ req, res });
    });

    /**
     * POST /daily-report-schedule
     * 日次レポートスケジュール処理をHTTP経由で実行
     */
    app.post('/daily-report-schedule', async (req: Request, res: Response) => {
        const handler = factory.createDailyReportScheduleHttpHandler();
        await handler.handle({ req, res });
    });

    /**
     * POST /send-weekly-report
     * 週次レポート送信処理をHTTP経由で実行
     * リクエストボディ: { year: number, month: number, day: number }
     */
    app.post('/send-weekly-report', async (req: Request, res: Response) => {
        const handler = factory.createSendWeeklyReportHttpHandler();
        await handler.handle({ req, res });
    });

    /**
     * POST /recalculate-reports
     * レポート再集計処理をHTTP経由で実行
     * リクエストボディ: {
     *   startDate: string,
     *   endDate: string,
     *   reportTypes?: ['daily', 'weekly', 'monthly'],
     *   executedBy?: string,
     *   dryRun?: boolean
     * }
     */
    app.post('/recalculate-reports', async (req: Request, res: Response) => {
        const handler = await factory.createReportRecalculationHttpHandler();
        await handler.handle({ req, res });
    });

    /**
     * GET /health
     * ヘルスチェック用エンドポイント
     */
    app.get('/health', (req: Request, res: Response) => {
        const healthResponse = ResponseHelper.success('Functions API is healthy', {
            timestamp: new Date().toISOString(),
        });
        res.status(healthResponse.status).json(healthResponse);
    });

    return app;
}
