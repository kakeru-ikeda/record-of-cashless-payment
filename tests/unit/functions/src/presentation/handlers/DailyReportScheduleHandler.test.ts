import { DailyReportScheduleHandler } from '../../../../../../functions/src/presentation/handlers/DailyReportScheduleHandler';
import { ScheduleReportDeliveryUseCase } from '../../../../../../functions/src/application/usecases/ScheduleReportDeliveryUseCase';
import { ScheduleContext } from '../../../../../../functions/src/domain/types/FirebaseFunctionTypes';
import { ResponseHelper } from '../../../../../../shared/presentation/responses/ResponseHelper';
import { logger } from '../../../../../../shared/infrastructure/logging/Logger';
import { ErrorHandler } from '../../../../../../shared/infrastructure/errors/ErrorHandler';

// モック化
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
jest.mock('../../../../../../functions/src/application/usecases/ScheduleReportDeliveryUseCase');
jest.mock('../../../../../../shared/infrastructure/errors/ErrorHandler');

describe('DailyReportScheduleHandler', () => {
    let handler: DailyReportScheduleHandler;
    let mockScheduleUseCase: jest.Mocked<ScheduleReportDeliveryUseCase>;
    let mockContext: ScheduleContext;
    let mockLogger: jest.Mocked<typeof logger>;
    let mockErrorHandler: jest.Mocked<typeof ErrorHandler>;

    beforeEach(() => {
        // モックの作成
        mockScheduleUseCase = {
            execute: jest.fn(),
        } as unknown as jest.Mocked<ScheduleReportDeliveryUseCase>;

        // ロガーモックの取得
        mockLogger = logger as jest.Mocked<typeof logger>;

        // ErrorHandlerモックの取得
        mockErrorHandler = ErrorHandler as jest.Mocked<typeof ErrorHandler>;
        mockErrorHandler.handle = jest.fn().mockResolvedValue(
            ResponseHelper.error(500, 'エラーが発生しました')
        );

        // ハンドラーのインスタンス作成
        handler = new DailyReportScheduleHandler(mockScheduleUseCase);

        // テスト用のスケジュールコンテキスト
        mockContext = {
            eventId: 'test-event-id',
            timestamp: '2024-01-01T00:00:00.000Z',
            eventType: 'google.pubsub.topic.publish',
            resource: 'projects/test-project/topics/test-topic',
            scheduleTime: '2024-01-01T00:00:00.000Z',
            jobName: 'daily-report-schedule',
            data: {
                '@type': 'type.googleapis.com/google.pubsub.v1.PubsubMessage',
                attributes: {},
                data: '',
            },
        } as unknown as ScheduleContext;

        // ロガーモックのリセット
        jest.clearAllMocks();
    });

    describe('handle', () => {
        it('正常なスケジュール配信処理が実行されること', async () => {
            // Arrange
            const expectedResponse = ResponseHelper.success('スケジュール配信完了');
            mockScheduleUseCase.execute.mockResolvedValue(expectedResponse);

            // Act
            const result = await handler.handle(mockContext);

            // Assert
            expect(mockScheduleUseCase.execute).toHaveBeenCalledWith(mockContext);
            expect(result).toEqual(expectedResponse);
            expect(mockLogger.info).toHaveBeenCalledWith('処理開始', 'Daily Report Schedule Handler', { suppressConsole: false });
            expect(mockLogger.info).toHaveBeenCalledWith('スケジュール配信処理が正常に完了しました', 'Daily Report Schedule Handler');
            expect(mockLogger.info).toHaveBeenCalledWith('処理完了', 'Daily Report Schedule Handler');
        });

        it('ユースケースでエラーが発生した場合のエラーハンドリング', async () => {
            // Arrange
            const error = new Error('ユースケースエラー');
            mockScheduleUseCase.execute.mockRejectedValue(error);

            // Act
            const result = await handler.handle(mockContext);

            // Assert
            expect(mockLogger.error).toHaveBeenCalledWith(error, 'Daily Report Schedule Handler');
            // エラーハンドリングにより、結果が返される（例外は投げられない）
            expect(result).toBeDefined();
        });
    });

    describe('beforeProcess', () => {
        it('イベント情報がデバッグログに出力されること', async () => {
            // Act
            await (handler as any).beforeProcess(mockContext);

            // Assert
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringMatching(/^スケジュールイベント実行時刻: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
                'Daily Report Schedule Handler'
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `イベントコンテキスト: ${JSON.stringify(mockContext)}`,
                'Daily Report Schedule Handler'
            );
        });
    });

    describe('process', () => {
        it('ScheduleReportDeliveryUseCaseのexecuteメソッドが呼び出されること', async () => {
            // Arrange
            const expectedResponse = ResponseHelper.success('テストレスポンス');
            mockScheduleUseCase.execute.mockResolvedValue(expectedResponse);

            // Act
            const result = await (handler as any).process(mockContext);

            // Assert
            expect(mockScheduleUseCase.execute).toHaveBeenCalledWith(mockContext);
            expect(result).toEqual(expectedResponse);
        });

        it('ユースケースからエラーが投げられた場合にエラーが伝播されること', async () => {
            // Arrange
            const error = new Error('ユースケース処理エラー');
            mockScheduleUseCase.execute.mockRejectedValue(error);

            // Act & Assert
            await expect((handler as any).process(mockContext)).rejects.toThrow(error);
        });
    });

    describe('afterProcess', () => {
        it('処理完了ログが出力されること', async () => {
            // Arrange
            const mockResponse = ResponseHelper.success('テストレスポンス');

            // Act
            await (handler as any).afterProcess(mockContext, mockResponse);

            // Assert
            expect(mockLogger.info).toHaveBeenCalledWith(
                'スケジュール配信処理が正常に完了しました',
                'Daily Report Schedule Handler'
            );
        });
    });

    describe('constructor', () => {
        it('正しいハンドラー名でインスタンスが作成されること', () => {
            // Act
            const instance = new DailyReportScheduleHandler(mockScheduleUseCase);

            // Assert
            expect((instance as any).handlerName).toBe('Daily Report Schedule Handler');
        });
    });
});
