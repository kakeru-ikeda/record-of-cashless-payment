import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { EventHandlerFactory } from './presentation/handlers/EventHandlerFactory';
import { createExpressApp } from './presentation/api/ExpressApp';

// Cloud Functions環境でのFirebase Admin SDK初期化
if (!admin.apps.length) {
    admin.initializeApp();
}

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
        await handler.handle(context);

        // Firebase Functions のスケジューラーは戻り値を期待しないため、明示的にvoidを返す
        return;
    });

/**
 * 毎日日本時間深夜3時に実行される関数
 * レポートデータの再集計を行い、データの整合性を保つ
 */
export const reportRecalculationSchedule = functions.scheduler
    .onSchedule({
        schedule: '0 3 * * *',
        timeZone: 'Asia/Tokyo',
        region: 'asia-northeast1',
    }, async (context) => {
        // イベントハンドラーファクトリーから適切なハンドラーを取得
        const factory = EventHandlerFactory.getInstance();
        const handler = factory.createReportRecalculationScheduleHandler();

        // ハンドラーでイベントを処理
        await handler.handle(context);

        // Firebase Functions のスケジューラーは戻り値を期待しないため、明示的にvoidを返す
        return;
    });

/**
 * HTTP API Functions
 * 各種処理をHTTP経由で実行するためのエンドポイント
 */
export const api = functions.https
    .onRequest({
        region: 'asia-northeast1',
    }, createExpressApp());
