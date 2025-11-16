import { ReportRecalculationScheduleHandler } from '../../../../../../functions/src/presentation/handlers/ReportRecalculationScheduleHandler';
import { ReportRecalculationUseCase } from '../../../../../../functions/src/application/usecases/ReportRecalculationUseCase';
import { ScheduleContext } from '../../../../../../functions/src/domain/types/FirebaseFunctionTypes';
import { ResponseHelper } from '../../../../../../shared/presentation/responses/ResponseHelper';
import { logger } from '../../../../../../shared/infrastructure/logging/Logger';
import { ErrorHandler } from '../../../../../../shared/infrastructure/errors/ErrorHandler';

// Mock dependencies
jest.mock('../../../../../../shared/infrastructure/logging/Logger', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        logAppError: jest.fn(),
        updateServiceStatus: jest.fn(),
    },
}));
jest.mock('../../../../../../functions/src/application/usecases/ReportRecalculationUseCase');
jest.mock('../../../../../../shared/infrastructure/errors/ErrorHandler');

describe('ReportRecalculationScheduleHandler', () => {
    let handler: ReportRecalculationScheduleHandler;
    let mockRecalculationUseCase: jest.Mocked<ReportRecalculationUseCase>;
    let mockContext: ScheduleContext;
    let mockLogger: jest.Mocked<typeof logger>;
    let mockErrorHandler: jest.Mocked<typeof ErrorHandler>;

    beforeEach(() => {
        // Mock the use case
        mockRecalculationUseCase = {
            execute: jest.fn(),
        } as unknown as jest.Mocked<ReportRecalculationUseCase>;

        // Get logger mock
        mockLogger = logger as jest.Mocked<typeof logger>;

        // Mock ErrorHandler
        mockErrorHandler = ErrorHandler as jest.Mocked<typeof ErrorHandler>;
        mockErrorHandler.handle = jest.fn().mockResolvedValue(
            ResponseHelper.error(500, 'エラーが発生しました')
        );

        // Create handler instance
        handler = new ReportRecalculationScheduleHandler(mockRecalculationUseCase);

        // Create test schedule context
        mockContext = {
            eventId: 'test-event-id',
            timestamp: '2024-01-15T00:00:00.000Z',
            eventType: 'google.pubsub.topic.publish',
            resource: 'projects/test-project/topics/test-topic',
            scheduleTime: '2024-01-15T00:00:00.000Z',
            jobName: 'report-recalculation-schedule',
            data: {
                '@type': 'type.googleapis.com/google.pubsub.v1.PubsubMessage',
                attributes: {},
                data: '',
            },
        } as unknown as ScheduleContext;

        // Reset all mocks
        jest.clearAllMocks();
    });

    describe('handle', () => {
        it('正常にレポート再集計が実行される', async () => {
            // Arrange
            const expectedResponse = ResponseHelper.success('レポート再集計が完了しました');
            mockRecalculationUseCase.execute.mockResolvedValue(expectedResponse);

            // Act
            const result = await handler.handle(mockContext);

            // Then
            expect(mockRecalculationUseCase.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    reportTypes: ['daily', 'weekly', 'monthly'],
                    executedBy: 'scheduled-task',
                    dryRun: false,
                })
            );
            expect(result).toEqual(expectedResponse);
            expect(mockLogger.info).toHaveBeenCalledWith(
                '処理開始',
                'Report Recalculation Schedule Handler',
                { suppressConsole: false }
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                '処理完了',
                'Report Recalculation Schedule Handler'
            );
        });

        it('過去7日間のデータを対象とする', async () => {
            // Arrange
            const expectedResponse = ResponseHelper.success('完了');
            mockRecalculationUseCase.execute.mockResolvedValue(expectedResponse);

            // Act
            await handler.handle(mockContext);

            // Then
            expect(mockRecalculationUseCase.execute).toHaveBeenCalled();
            const callArgs = mockRecalculationUseCase.execute.mock.calls[0][0];
            
            // 日付の差分を確認（約7日間）
            const diffDays = Math.round(
                (callArgs.endDate.getTime() - callArgs.startDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            expect(diffDays).toBe(7);
            expect(callArgs.endDate.getTime()).toBeGreaterThan(callArgs.startDate.getTime());
        });

        it('ユースケースでエラーが発生した場合のエラーハンドリング', async () => {
            // Arrange
            const error = new Error('再集計エラー');
            mockRecalculationUseCase.execute.mockRejectedValue(error);

            // Act
            const result = await handler.handle(mockContext);

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith(
                error,
                'Report Recalculation Schedule Handler'
            );
            expect(result).toBeDefined();
        });
    });

    describe('beforeProcess', () => {
        it('ログにスケジュール情報が出力される', async () => {
            // Act
            await (handler as any).beforeProcess(mockContext);

            // Then
            expect(mockLogger.info).toHaveBeenCalledWith(
                '定期レポート再集計処理を開始します',
                'Report Recalculation Schedule Handler'
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `スケジュールイベント詳細: ${JSON.stringify(mockContext)}`,
                'Report Recalculation Schedule Handler'
            );
        });
    });

    describe('process', () => {
        it('ReportRecalculationUseCaseのexecuteメソッドが呼び出される', async () => {
            // Arrange
            const expectedResponse = ResponseHelper.success('テストレスポンス');
            mockRecalculationUseCase.execute.mockResolvedValue(expectedResponse);

            // Act
            const result = await (handler as any).process(mockContext);

            // Then
            expect(mockRecalculationUseCase.execute).toHaveBeenCalled();
            expect(result).toEqual(expectedResponse);
        });

        it('適切なリクエストパラメータでユースケースが呼び出される', async () => {
            // Arrange
            const expectedResponse = ResponseHelper.success('テスト');
            mockRecalculationUseCase.execute.mockResolvedValue(expectedResponse);

            // Act
            await (handler as any).process(mockContext);

            // Then
            expect(mockRecalculationUseCase.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    reportTypes: ['daily', 'weekly', 'monthly'],
                    executedBy: 'scheduled-task',
                    dryRun: false,
                })
            );
        });

        it('ユースケースからエラーが投げられた場合にエラーが伝播される', async () => {
            // Arrange
            const error = new Error('ユースケース処理エラー');
            mockRecalculationUseCase.execute.mockRejectedValue(error);

            // Act & Assert
            await expect((handler as any).process(mockContext)).rejects.toThrow(error);
        });

        it('定期実行のログが出力される', async () => {
            // Arrange
            const expectedResponse = ResponseHelper.success('テスト');
            mockRecalculationUseCase.execute.mockResolvedValue(expectedResponse);

            // Act
            await (handler as any).process(mockContext);

            // Then
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('定期再集計実行:'),
                'Report Recalculation Schedule Handler'
            );
        });
    });

    describe('constructor', () => {
        it('正しいハンドラー名でインスタンスが作成される', () => {
            // Act
            const instance = new ReportRecalculationScheduleHandler(mockRecalculationUseCase);

            // Assert
            expect((instance as any).handlerName).toBe('Report Recalculation Schedule Handler');
        });
    });

    describe('全体のフロー', () => {
        it('スケジュール実行が正常に完了する', async () => {
            // Arrange
            const mockResult = {
                totalCardUsageProcessed: 10,
                reportsCreated: { daily: 7, weekly: 1, monthly: 1 },
                reportsUpdated: { daily: 0, weekly: 0, monthly: 0 },
                errors: [],
                success: true,
                startTime: new Date('2024-01-15T00:00:00.000Z'),
                endTime: new Date('2024-01-15T00:01:00.000Z'),
                executedBy: 'scheduled-task',
                dryRun: false,
            };
            const expectedResponse = ResponseHelper.success('レポート再集計が完了しました', mockResult);
            mockRecalculationUseCase.execute.mockResolvedValue(expectedResponse);

            // Act
            const result = await handler.handle(mockContext);

            // Then
            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockResult);
            expect(mockLogger.info).toHaveBeenCalledWith(
                '処理開始',
                'Report Recalculation Schedule Handler',
                { suppressConsole: false }
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                '処理完了',
                'Report Recalculation Schedule Handler'
            );
        });

        it('部分的な失敗でもハンドリングされる', async () => {
            // Arrange
            const mockResult = {
                totalCardUsageProcessed: 10,
                reportsCreated: { daily: 5, weekly: 1, monthly: 1 },
                reportsUpdated: { daily: 0, weekly: 0, monthly: 0 },
                errors: [
                    { documentPath: 'some-path', message: 'エラーメッセージ' },
                ],
                success: false,
                startTime: new Date('2024-01-15T00:00:00.000Z'),
                endTime: new Date('2024-01-15T00:01:00.000Z'),
                executedBy: 'scheduled-task',
                dryRun: false,
            };
            const expectedResponse = ResponseHelper.createResponse(
                500,
                false,
                'レポート再集計中に多数のエラーが発生しました',
                mockResult
            );
            mockRecalculationUseCase.execute.mockResolvedValue(expectedResponse);

            // Act
            const result = await handler.handle(mockContext);

            // Then
            expect(result.success).toBe(false);
            expect(result.status).toBe(500);
            expect((result.data as any).errors).toHaveLength(1);
        });
    });
});
