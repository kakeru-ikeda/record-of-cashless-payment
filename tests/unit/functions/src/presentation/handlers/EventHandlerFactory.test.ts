import { EventHandlerFactory } from '../../../../../../functions/src/presentation/handlers/EventHandlerFactory';
import { DependencyContainer } from '../../../../../../functions/src/infrastructure/config/DependencyContainer';
import { FirestoreDocumentCreatedHandler } from '../../../../../../functions/src/presentation/handlers/FirestoreDocumentCreatedHandler';
import { DailyReportScheduleHandler } from '../../../../../../functions/src/presentation/handlers/DailyReportScheduleHandler';
import { ProcessFirestoreDocumentHttpHandler } from '../../../../../../functions/src/presentation/handlers/http/ProcessFirestoreDocumentHttpHandler';
import { DailyReportScheduleHttpHandler } from '../../../../../../functions/src/presentation/handlers/http/DailyReportScheduleHttpHandler';

// Loggerのモック化
jest.mock('../../../../../../shared/infrastructure/logging/Logger', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        logAppError: jest.fn(),
        updateServiceStatus: jest.fn()
    }
}));

// DependencyContainerのモック化
jest.mock('../../../../../../functions/src/infrastructure/config/DependencyContainer');

describe('EventHandlerFactory', () => {
    let factory: EventHandlerFactory;
    let mockContainer: jest.Mocked<DependencyContainer>;

    beforeEach(() => {
        // DependencyContainerのモックを作成
        mockContainer = {
            reportProcessingService: {} as any,
            reportUseCase: {} as any,
            notifyReportUseCase: {} as any,
        } as jest.Mocked<DependencyContainer>;

        // DependencyContainer.getInstance()のモック
        (DependencyContainer.getInstance as jest.Mock).mockReturnValue(mockContainer);

        // EventHandlerFactoryインスタンスを取得
        factory = EventHandlerFactory.getInstance();
    });

    afterEach(() => {
        jest.clearAllMocks();
        // シングルトンのリセット
        (EventHandlerFactory as any).instance = undefined;
    });

    describe('getInstance', () => {
        it('シングルトンインスタンスを返すこと', () => {
            const instance1 = EventHandlerFactory.getInstance();
            const instance2 = EventHandlerFactory.getInstance();

            expect(instance1).toBe(instance2);
            expect(instance1).toBeInstanceOf(EventHandlerFactory);
        });

        it('DependencyContainerのインスタンスを取得すること', () => {
            EventHandlerFactory.getInstance();

            expect(DependencyContainer.getInstance).toHaveBeenCalledTimes(1);
        });
    });

    describe('createFirestoreDocumentCreatedHandler', () => {
        it('FirestoreDocumentCreatedHandlerのインスタンスを作成すること', () => {
            const handler = factory.createFirestoreDocumentCreatedHandler();

            expect(handler).toBeInstanceOf(FirestoreDocumentCreatedHandler);
        });

        it('必要な依存関係を注入してハンドラーを作成すること', () => {
            const handler = factory.createFirestoreDocumentCreatedHandler();

            expect(handler).toBeDefined();
            expect(mockContainer.reportProcessingService).toBeDefined();
        });
    });

    describe('createDailyReportScheduleHandler', () => {
        it('DailyReportScheduleHandlerのインスタンスを作成すること', () => {
            const handler = factory.createDailyReportScheduleHandler();

            expect(handler).toBeInstanceOf(DailyReportScheduleHandler);
        });

        it('必要な依存関係を注入してハンドラーを作成すること', () => {
            const handler = factory.createDailyReportScheduleHandler();

            expect(handler).toBeDefined();
            expect(mockContainer.reportUseCase).toBeDefined();
            expect(mockContainer.notifyReportUseCase).toBeDefined();
        });
    });

    describe('createProcessFirestoreDocumentHttpHandler', () => {
        it('ProcessFirestoreDocumentHttpHandlerのインスタンスを作成すること', () => {
            const handler = factory.createProcessFirestoreDocumentHttpHandler();

            expect(handler).toBeInstanceOf(ProcessFirestoreDocumentHttpHandler);
        });

        it('必要な依存関係を注入してハンドラーを作成すること', () => {
            const handler = factory.createProcessFirestoreDocumentHttpHandler();

            expect(handler).toBeDefined();
            expect(mockContainer.reportProcessingService).toBeDefined();
        });
    });

    describe('createDailyReportScheduleHttpHandler', () => {
        it('DailyReportScheduleHttpHandlerのインスタンスを作成すること', () => {
            const handler = factory.createDailyReportScheduleHttpHandler();

            expect(handler).toBeInstanceOf(DailyReportScheduleHttpHandler);
        });

        it('必要な依存関係を注入してハンドラーを作成すること', () => {
            const handler = factory.createDailyReportScheduleHttpHandler();

            expect(handler).toBeDefined();
            expect(mockContainer.reportUseCase).toBeDefined();
            expect(mockContainer.notifyReportUseCase).toBeDefined();
        });
    });

    describe('複数回のインスタンス作成', () => {
        it('同じファクトリーから複数回ハンドラーを作成できること', () => {
            const handler1 = factory.createFirestoreDocumentCreatedHandler();
            const handler2 = factory.createFirestoreDocumentCreatedHandler();

            expect(handler1).toBeInstanceOf(FirestoreDocumentCreatedHandler);
            expect(handler2).toBeInstanceOf(FirestoreDocumentCreatedHandler);
            expect(handler1).not.toBe(handler2); // 別のインスタンス
        });

        it('異なる種類のハンドラーを作成できること', () => {
            const firestoreHandler = factory.createFirestoreDocumentCreatedHandler();
            const scheduleHandler = factory.createDailyReportScheduleHandler();
            const httpFirestoreHandler = factory.createProcessFirestoreDocumentHttpHandler();
            const httpScheduleHandler = factory.createDailyReportScheduleHttpHandler();

            expect(firestoreHandler).toBeInstanceOf(FirestoreDocumentCreatedHandler);
            expect(scheduleHandler).toBeInstanceOf(DailyReportScheduleHandler);
            expect(httpFirestoreHandler).toBeInstanceOf(ProcessFirestoreDocumentHttpHandler);
            expect(httpScheduleHandler).toBeInstanceOf(DailyReportScheduleHttpHandler);
        });
    });
});
