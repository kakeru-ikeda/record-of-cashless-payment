import { ScheduleReportDeliveryUseCase } from '../../../../../../functions/src/application/usecases/ScheduleReportDeliveryUseCase';
import { ReportSchedulingService } from '../../../../../../functions/src/application/services/ReportSchedulingService';
import { ScheduleContext } from '../../../../../../functions/src/domain/types/FirebaseFunctionTypes';
import { AppError, ErrorType } from '../../../../../../shared/errors/AppError';

// Mocks
const mockReportSchedulingService: jest.Mocked<ReportSchedulingService> = {
    executeScheduledReports: jest.fn(),
    sendDailyReport: jest.fn(),
    sendWeeklyReport: jest.fn(),
    sendMonthlyReport: jest.fn(),
} as any;

// Mock ScheduleContext
const createMockScheduleContext = (): ScheduleContext => ({
    timestamp: '2024-01-16T00:00:00.000Z',
    jobName: 'dailyReportSchedule',
    scheduledTime: '2024-01-16T00:00:00.000Z',
} as any);

describe('ScheduleReportDeliveryUseCase', () => {
    let useCase: ScheduleReportDeliveryUseCase;

    beforeEach(() => {
        useCase = new ScheduleReportDeliveryUseCase(mockReportSchedulingService);
        jest.clearAllMocks();
    });

    describe('execute', () => {
        it('正常なスケジュール配信処理を実行する', async () => {
            // Given
            const mockContext = createMockScheduleContext();
            mockReportSchedulingService.executeScheduledReports.mockResolvedValue(undefined);

            // When
            const result = await useCase.execute(mockContext);

            // Then
            expect(mockReportSchedulingService.executeScheduledReports).toHaveBeenCalledTimes(1);
            expect(result.success).toBe(true);
            expect(result.message).toBe('スケジュール配信処理が完了しました');
            expect(result.data?.timestamp).toBeDefined();
            expect(typeof result.data?.timestamp).toBe('string');
        });

        it('ReportSchedulingServiceでエラーが発生した場合はAppErrorを投げる', async () => {
            // Given
            const mockContext = createMockScheduleContext();
            const serviceError = new Error('レポート処理でエラーが発生しました');
            mockReportSchedulingService.executeScheduledReports.mockRejectedValue(serviceError);

            // When & Then
            await expect(useCase.execute(mockContext)).rejects.toThrow(AppError);
            await expect(useCase.execute(mockContext)).rejects.toThrow(
                'スケジュール配信処理でエラーが発生しました: レポート処理でエラーが発生しました'
            );

            // AppErrorの型も確認
            try {
                await useCase.execute(mockContext);
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect((error as AppError).type).toBe(ErrorType.GENERAL);
            }
        });

        it('文字列エラーが発生した場合も適切にハンドリングする', async () => {
            // Given
            const mockContext = createMockScheduleContext();
            const stringError = 'String error message';
            mockReportSchedulingService.executeScheduledReports.mockRejectedValue(stringError);

            // When & Then
            await expect(useCase.execute(mockContext)).rejects.toThrow(AppError);
            await expect(useCase.execute(mockContext)).rejects.toThrow(
                'スケジュール配信処理でエラーが発生しました: String error message'
            );
        });

        it('null/undefinedエラーが発生した場合も適切にハンドリングする', async () => {
            // Given
            const mockContext = createMockScheduleContext();
            mockReportSchedulingService.executeScheduledReports.mockRejectedValue(null);

            // When & Then
            await expect(useCase.execute(mockContext)).rejects.toThrow(AppError);
            await expect(useCase.execute(mockContext)).rejects.toThrow(
                'スケジュール配信処理でエラーが発生しました: null'
            );
        });

        it('サービスが複数回呼ばれないことを確認する', async () => {
            // Given
            const mockContext = createMockScheduleContext();
            mockReportSchedulingService.executeScheduledReports.mockResolvedValue(undefined);

            // When
            await useCase.execute(mockContext);

            // Then
            expect(mockReportSchedulingService.executeScheduledReports).toHaveBeenCalledTimes(1);
            expect(mockReportSchedulingService.sendDailyReport).not.toHaveBeenCalled();
            expect(mockReportSchedulingService.sendWeeklyReport).not.toHaveBeenCalled();
            expect(mockReportSchedulingService.sendMonthlyReport).not.toHaveBeenCalled();
        });

        it('レスポンスのタイムスタンプが有効なISO文字列であることを確認する', async () => {
            // Given
            const mockContext = createMockScheduleContext();
            mockReportSchedulingService.executeScheduledReports.mockResolvedValue(undefined);

            // When
            const result = await useCase.execute(mockContext);

            // Then
            expect(result.data?.timestamp).toBeDefined();
            const timestamp = result.data?.timestamp as string;
            expect(() => new Date(timestamp)).not.toThrow();
            expect(new Date(timestamp).toISOString()).toBe(timestamp);
        });
    });
});
