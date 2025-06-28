import { ProcessFirestoreDocumentUseCase } from '../../../../../../functions/src/application/usecases/ProcessFirestoreDocumentUseCase';
import { ReportProcessingService } from '../../../../../../functions/src/application/services/ReportProcessingService';
import { FirestoreDocumentCreatedEvent } from '../../../../../../functions/src/domain/types/FirebaseFunctionTypes';
import { DailyReport, WeeklyReport, MonthlyReport } from '../../../../../../shared/domain/entities/Reports';
import { AppError, ErrorType } from '../../../../../../shared/errors/AppError';

// Mocks
const mockReportProcessingService: jest.Mocked<ReportProcessingService> = {
    processDailyReport: jest.fn(),
    processWeeklyReport: jest.fn(),
    processMonthlyReport: jest.fn(),
} as any;

// Mock Firebase Functions DocumentSnapshot
const createMockDocument = (data: any, path: string = 'details/2024/term1/01/1234567890123') => ({
    ref: { path },
    data: () => data,
});

// Mock FirestoreDocumentCreatedEvent
const createMockEvent = (
    documentData: any,
    params: Record<string, string> = { year: '2024', month: '01', day: '01' },
    documentPath?: string
): FirestoreDocumentCreatedEvent => ({
    data: documentData ? createMockDocument(documentData, documentPath || 'details/2024/term1/01/1234567890123') : undefined,
    params,
} as any);

describe('ProcessFirestoreDocumentUseCase', () => {
    let useCase: ProcessFirestoreDocumentUseCase;

    beforeEach(() => {
        useCase = new ProcessFirestoreDocumentUseCase(mockReportProcessingService);
        jest.clearAllMocks();
    });

    describe('execute', () => {
        it('有効なカード利用データでレポート処理を実行する', async () => {
            // Given
            const cardUsageData = { amount: 1500 };
            const mockEvent = createMockEvent(cardUsageData);

            const mockDailyReport = { totalAmount: 1500 } as DailyReport;
            const mockWeeklyReport = { totalAmount: 5000 } as WeeklyReport;
            const mockMonthlyReport = { totalAmount: 20000 } as MonthlyReport;

            mockReportProcessingService.processDailyReport.mockResolvedValue(mockDailyReport);
            mockReportProcessingService.processWeeklyReport.mockResolvedValue(mockWeeklyReport);
            mockReportProcessingService.processMonthlyReport.mockResolvedValue(mockMonthlyReport);

            // When
            const result = await useCase.execute(mockEvent);

            // Then
            expect(mockReportProcessingService.processDailyReport).toHaveBeenCalledWith(
                expect.anything(),
                cardUsageData,
                mockEvent.params
            );
            expect(mockReportProcessingService.processWeeklyReport).toHaveBeenCalledWith(
                expect.anything(),
                cardUsageData,
                mockEvent.params
            );
            expect(mockReportProcessingService.processMonthlyReport).toHaveBeenCalledWith(
                expect.anything(),
                cardUsageData,
                mockEvent.params
            );
            expect(result.success).toBe(true);
            expect(result.message).toBe('全てのレポート処理が完了しました');
            expect(result.data?.dailyReport).toBe(mockDailyReport);
            expect(result.data?.weeklyReport).toBe(mockWeeklyReport);
            expect(result.data?.monthlyReport).toBe(mockMonthlyReport);
        });

        it('レポートドキュメントパスの場合は処理をスキップする', async () => {
            // Given
            const cardUsageData = { amount: 1500 };
            const reportPath = 'reports/daily/2024-01/01';
            const mockEvent = createMockEvent(
                cardUsageData,
                { year: '2024', month: '01', day: '01' },
                reportPath
            );

            // パスが正しく設定されているかを確認
            expect(mockEvent.data?.ref.path).toBe(reportPath);
            expect(mockEvent.data?.ref.path.includes('reports/')).toBe(true);

            // When
            const result = await useCase.execute(mockEvent);

            // Then
            expect(mockReportProcessingService.processDailyReport).not.toHaveBeenCalled();
            expect(mockReportProcessingService.processWeeklyReport).not.toHaveBeenCalled();
            expect(mockReportProcessingService.processMonthlyReport).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.message).toBe('レポートドキュメントのため処理をスキップしました');
        });

        it('ドキュメントが存在しない場合はエラーを投げる', async () => {
            // Given
            const mockEvent = createMockEvent(null);

            // When & Then
            await expect(useCase.execute(mockEvent)).rejects.toThrow(AppError);
            await expect(useCase.execute(mockEvent)).rejects.toThrow('ドキュメントが存在しません');
        });

        it('ドキュメントデータが存在しない場合はエラーを投げる', async () => {
            // Given
            const mockEvent = {
                data: {
                    ref: { path: 'details/2024/term1/01/1234567890123' },
                    data: () => null,
                },
                params: { year: '2024', month: '01', day: '01' },
            } as any;

            // When & Then
            await expect(useCase.execute(mockEvent)).rejects.toThrow(AppError);
            await expect(useCase.execute(mockEvent)).rejects.toThrow('ドキュメントデータが存在しません');
        });

        it('無効なamountデータの場合はエラーを投げる', async () => {
            // Given
            const invalidData = { amount: 'invalid' };
            const mockEvent = createMockEvent(invalidData);

            // When & Then
            await expect(useCase.execute(mockEvent)).rejects.toThrow(AppError);
            await expect(useCase.execute(mockEvent)).rejects.toThrow('無効なデータ形式：amountが数値ではありません');
        });

        it('amountが未定義の場合はエラーを投げる', async () => {
            // Given
            const invalidData = {};
            const mockEvent = createMockEvent(invalidData);

            // When & Then
            await expect(useCase.execute(mockEvent)).rejects.toThrow(AppError);
            await expect(useCase.execute(mockEvent)).rejects.toThrow('無効なデータ形式：amountが数値ではありません');
        });

        it('複数の異なるレポートパスでスキップ処理を確認する', async () => {
            const testCases = [
                'reports/daily/2024-01/01',
                'reports/weekly/2024-01/01',
                'reports/monthly/2024/01'
            ];

            for (const reportPath of testCases) {
                // Given
                const cardUsageData = { amount: 1500 };
                const mockEvent = createMockEvent(
                    cardUsageData,
                    { year: '2024', month: '01', day: '01' },
                    reportPath
                );

                // When
                const result = await useCase.execute(mockEvent);

                // Then
                expect(result.success).toBe(true);
                expect(result.message).toBe('レポートドキュメントのため処理をスキップしました');

                // サービスが呼ばれていないことを確認
                jest.clearAllMocks();
            }
        });

        it('通常のカード利用データパスで処理が実行される', async () => {
            // Given
            const cardUsageData = { amount: 2000 };
            const cardUsagePath = 'details/2024/term1/15/9876543210987';
            const mockEvent = createMockEvent(
                cardUsageData,
                { year: '2024', month: '01', day: '15' },
                cardUsagePath
            );

            const mockDailyReport = { totalAmount: 2000 } as DailyReport;
            const mockWeeklyReport = { totalAmount: 8000 } as WeeklyReport;
            const mockMonthlyReport = { totalAmount: 35000 } as MonthlyReport;

            mockReportProcessingService.processDailyReport.mockResolvedValue(mockDailyReport);
            mockReportProcessingService.processWeeklyReport.mockResolvedValue(mockWeeklyReport);
            mockReportProcessingService.processMonthlyReport.mockResolvedValue(mockMonthlyReport);

            // When
            const result = await useCase.execute(mockEvent);

            // Then
            expect(mockEvent.data?.ref.path).toBe(cardUsagePath);
            expect(mockEvent.data?.ref.path.includes('reports')).toBe(false);
            expect(mockReportProcessingService.processDailyReport).toHaveBeenCalled();
            expect(mockReportProcessingService.processWeeklyReport).toHaveBeenCalled();
            expect(mockReportProcessingService.processMonthlyReport).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });
    });
});
