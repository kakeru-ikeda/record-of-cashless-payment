import { DependencyContainer } from '../../infrastructure/config/DependencyContainer';
import { ProcessFirestoreDocumentUseCase } from '../../application/usecases/ProcessFirestoreDocumentUseCase';
import { ScheduleReportDeliveryUseCase } from '../../application/usecases/ScheduleReportDeliveryUseCase';
import { ReportRecalculationUseCase } from '../../application/usecases/ReportRecalculationUseCase';
import { ReportSchedulingService } from '../../application/services/ReportSchedulingService';
import { ReportRecalculationService } from '../../application/services/ReportRecalculationService';
import { FirestoreDataExplorerService } from '../../infrastructure/services/FirestoreDataExplorerService';
import { FirestoreDocumentCreatedHandler } from './FirestoreDocumentCreatedHandler';
import { DailyReportScheduleHandler } from './DailyReportScheduleHandler';
import { ReportRecalculationScheduleHandler } from './ReportRecalculationScheduleHandler';
import { ProcessFirestoreDocumentHttpHandler } from './http/ProcessFirestoreDocumentHttpHandler';
import { DailyReportScheduleHttpHandler } from './http/DailyReportScheduleHttpHandler';
import { ReportRecalculationHttpHandler } from './http/ReportRecalculationHttpHandler';
import { SendWeeklyReportHttpHandler } from './http/SendWeeklyReportHttpHandler';

/**
 * イベントハンドラーファクトリー
 * 各種イベントハンドラーのインスタンスを生成・管理
 */
export class EventHandlerFactory {
    private static instance: EventHandlerFactory;
    private container: DependencyContainer;
    private initialized = false;

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
     * 初期化を確実に行う
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.container.initialize();
            this.initialized = true;
        }
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

    /**
     * Firestoreドキュメント処理HTTPハンドラーを作成
     */
    createProcessFirestoreDocumentHttpHandler(): ProcessFirestoreDocumentHttpHandler {
        const processUseCase = new ProcessFirestoreDocumentUseCase(
            this.container.reportProcessingService
        );
        return new ProcessFirestoreDocumentHttpHandler(processUseCase);
    }

    /**
     * 日次レポートスケジュールHTTPハンドラーを作成
     */
    createDailyReportScheduleHttpHandler(): DailyReportScheduleHttpHandler {
        const reportSchedulingService = new ReportSchedulingService(
            this.container.reportUseCase,
            this.container.notifyReportUseCase
        );
        const scheduleUseCase = new ScheduleReportDeliveryUseCase(reportSchedulingService);
        return new DailyReportScheduleHttpHandler(scheduleUseCase);
    }

    /**
     * 週次レポート送信HTTPハンドラーを作成
     */
    createSendWeeklyReportHttpHandler(): SendWeeklyReportHttpHandler {
        const reportSchedulingService = new ReportSchedulingService(
            this.container.reportUseCase,
            this.container.notifyReportUseCase
        );
        return new SendWeeklyReportHttpHandler(reportSchedulingService);
    }

    /**
     * レポート再集計HTTPハンドラーを作成
     */
    async createReportRecalculationHttpHandler(): Promise<ReportRecalculationHttpHandler> {
        await this.ensureInitialized();

        const dataExplorerService = new FirestoreDataExplorerService(
            this.container.firestoreService
        );
        const recalculationService = new ReportRecalculationService(
            this.container.reportUseCase
        );
        const recalculationUseCase = new ReportRecalculationUseCase(
            dataExplorerService,
            recalculationService
        );
        return new ReportRecalculationHttpHandler(recalculationUseCase);
    }

    /**
     * レポート再集計スケジュールハンドラーを作成
     */
    async createReportRecalculationScheduleHandler(): Promise<ReportRecalculationScheduleHandler> {
        await this.ensureInitialized();

        const dataExplorerService = new FirestoreDataExplorerService(
            this.container.firestoreService
        );
        const recalculationService = new ReportRecalculationService(
            this.container.reportUseCase
        );
        const recalculationUseCase = new ReportRecalculationUseCase(
            dataExplorerService,
            recalculationService
        );
        return new ReportRecalculationScheduleHandler(recalculationUseCase);
    }
}
