import express from 'express';
import cors from 'cors';
import { cardUsageRouter } from './routes/cardUsageRoutes';
import { authMiddleware } from './middlewares/authMiddleware';

const app = express();

// JSONパーサーとCORSを有効化
app.use(express.json());
app.use(cors({ origin: true }));

// ヘルスチェック用のルート（認証不要）
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'API is running',
        timestamp: new Date().toISOString()
    });
});

// 認証が必要なAPIルート
// API バージョン1のルートに認証ミドルウェアを適用
app.use('/api/v1/card-usages', authMiddleware, cardUsageRouter);

// 404エラーハンドリング
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Not Found - ${req.originalUrl}`
    });
});

export { app };
