import { DependencyContainer } from '../../infrastructure/config/DependencyContainer';
import { ProcessFirestoreDocumentUseCase } from '../../application/usecases/ProcessFirestoreDocumentUseCase';
import { ScheduleReportDeliveryUseCase } from '../../application/usecases/ScheduleReportDeliveryUseCase';
import { ReportSchedulingService } from '../../application/services/ReportSchedulingService';
import { FirestoreDocumentCreatedHandler } from './FirestoreDocumentCreatedHandler';
import { DailyReportScheduleHandler } from './DailyReportScheduleHandler';

/**
 * イベントハンドラーファクトリー
 * 各種イベントハンドラーのインスタンスを生成・管理
 */
export class EventHandlerFactory {
    private static instance: EventHandlerFactory;
    private container: DependencyContainer;

    private constructor() {
        this.container = DependencyContainer.getInstance();
    }

    /**
     * シングルトンインスタンスを取得
     */
    static getInstance(): EventHandlerFactory {
        if (!EventHandlerFactory.instance) {
            EventHandlerFactory.instance = new EventHandlerFactory();
        }
        return EventHandlerFactory.instance;
    }

    /**
     * Firestoreドキュメント作成ハンドラーを作成
     */
    createFirestoreDocumentCreatedHandler(): FirestoreDocumentCreatedHandler {
        const processUseCase = new ProcessFirestoreDocumentUseCase(
            this.container.reportProcessingService
        );
        return new FirestoreDocumentCreatedHandler(processUseCase);
    }

    /**
     * 日次レポートスケジュールハンドラーを作成
     */
    createDailyReportScheduleHandler(): DailyReportScheduleHandler {
        const reportSchedulingService = new ReportSchedulingService(
            this.container.reportUseCase,
            this.container.notifyReportUseCase
        );
        const scheduleUseCase = new ScheduleReportDeliveryUseCase(reportSchedulingService);
        return new DailyReportScheduleHandler(scheduleUseCase);
    }
}
