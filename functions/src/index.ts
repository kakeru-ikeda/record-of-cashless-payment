import * as functions from 'firebase-functions';
import { EventHandlerFactory } from './presentation/handlers/EventHandlerFactory';

/**
 * Firestoreドキュメント作成時に実行
 */
export const onFirestoreWrite = functions.firestore
    .onDocumentCreated({
        document: 'details/{year}/{month}/{term}/{day}/{timestamp}',
        region: 'asia-northeast1',
    }, async (event) => {
        // イベントハンドラーファクトリーから適切なハンドラーを取得
        const factory = EventHandlerFactory.getInstance();
        const handler = factory.createFirestoreDocumentCreatedHandler();

        // ハンドラーでイベントを処理
        return await handler.handle(event);
    });

/**
 * 毎日日本時間0時に実行される関数
 * デイリー・ウィークリー・マンスリーレポートを自動的にDiscordに送信する
 */
export const dailyReportSchedule = functions.scheduler
    .onSchedule({
        schedule: '0 0 * * *',
        timeZone: 'Asia/Tokyo',
        region: 'asia-northeast1',
    }, async (context) => {
        // イベントハンドラーファクトリーから適切なハンドラーを取得
        const factory = EventHandlerFactory.getInstance();
        const handler = factory.createDailyReportScheduleHandler();

        // ハンドラーでイベントを処理
        return await handler.handle(context);
    });
