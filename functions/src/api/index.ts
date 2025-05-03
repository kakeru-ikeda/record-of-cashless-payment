import express from 'express';
import cors from 'cors';
import { cardUsageRouter } from './routes/cardUsageRoutes';

const app = express();

// JSONパーサーとCORSを有効化
app.use(express.json());
app.use(cors({ origin: true }));

// API バージョン1のルート
app.use('/api/v1/card-usages', cardUsageRouter);

// ヘルスチェック用のルート
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'API is running',
        timestamp: new Date().toISOString(),
    });
});

// 404エラーハンドリング
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Not Found - ${req.originalUrl}`,
    });
});

export { app };
