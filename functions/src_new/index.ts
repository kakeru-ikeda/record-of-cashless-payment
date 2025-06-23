import * as functions from 'firebase-functions';
import { ResponseHelper } from '../../shared/presentation/responses/ResponseHelper';
import { ErrorHandler } from '../../shared/infrastructure/errors/ErrorHandler';
import { DependencyContainer } from './infrastructure/config/DependencyContainer';
import { ReportSchedulingService } from './application/services/ReportSchedulingService';
import { ProcessFirestoreDocumentUseCase } from './application/usecases/ProcessFirestoreDocumentUseCase';
import { ScheduleReportDeliveryUseCase } from './application/usecases/ScheduleReportDeliveryUseCase';

/**
 * Firestoreドキュメント作成時に実行
 */
export const onFirestoreWrite = functions.firestore
    .onDocumentCreated({
        document: 'details/{year}/{month}/{term}/{day}/{timestamp}',
        region: 'asia-northeast1',
    }, async (event) => {
        console.log('🚀 処理開始 - ドキュメントパス:', event.params);

        // パスチェック
        const path = event.data?.ref.path;
        console.log('📂 ドキュメントパス:', path);

        if (path && path.includes('/reports')) {
            console.log('⚠️ レポートドキュメントには処理をスキップします:', path);
            return ResponseHelper.success('レポートドキュメントのため処理をスキップしました', {});
        }

        // エラーハンドリングを使用して安全に処理
        try {
            // 依存関係の取得
            const container = DependencyContainer.getInstance();
            const reportProcessingService = container.reportProcessingService;
            const processUseCase = new ProcessFirestoreDocumentUseCase(reportProcessingService);

            // ユースケースを実行
            return await processUseCase.execute(event);
        } catch (error) {
            console.error('❌ レポート処理でエラーが発生しました:', error);
            return await ErrorHandler.handle(error, 'Firestore ドキュメント作成イベント処理');
        }
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
        try {
            // 依存関係の取得
            const container = DependencyContainer.getInstance();
            const reportSchedulingService = new ReportSchedulingService(
                container.reportUseCase,
                container.notifyReportUseCase
            );
            const scheduleUseCase = new ScheduleReportDeliveryUseCase(reportSchedulingService);

            // スケジュール配信ユースケースを実行
            return await scheduleUseCase.execute(context);
        } catch (error) {
            console.error('❌ 定期レポート送信処理でエラーが発生しました:', error);
            return await ErrorHandler.handle(error, '定期レポート自動送信処理');
        }
    });