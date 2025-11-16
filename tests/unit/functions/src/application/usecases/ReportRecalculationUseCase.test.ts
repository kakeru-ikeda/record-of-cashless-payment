import { ReportRecalculationUseCase } from '../../../../../../functions/src/application/usecases/ReportRecalculationUseCase';
import { FirestoreDataExplorerService } from '../../../../../../functions/src/infrastructure/services/FirestoreDataExplorerService';
import { ReportRecalculationService } from '../../../../../../functions/src/application/services/ReportRecalculationService';
import {
    ReportRecalculationRequest,
    CardUsageDocument,
} from '../../../../../../functions/src/domain/entities/ReportRecalculation';
import { logger } from '../../../../../../shared/infrastructure/logging/Logger';

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

const mockDataExplorerService: jest.Mocked<FirestoreDataExplorerService> = {
    exploreCardUsageData: jest.fn(),
} as any;

const mockRecalculationService: jest.Mocked<ReportRecalculationService> = {
    recalculateDailyReports: jest.fn(),
    recalculateWeeklyReports: jest.fn(),
    recalculateMonthlyReports: jest.fn(),
} as any;

describe('ReportRecalculationUseCase', () => {
    let useCase: ReportRecalculationUseCase;

    beforeEach(() => {
        useCase = new ReportRecalculationUseCase(
            mockDataExplorerService,
            mockRecalculationService
        );
        jest.clearAllMocks();
    });

    describe('execute', () => {
        const cardUsageDocuments: CardUsageDocument[] = [
            {
                path: 'details/2024/term1/01/1234567890123',
                data: { amount: 1000, datetime_of_use: new Date('2024-01-01') },
                params: { year: '2024', month: '1', term: 'term1', day: '1', timestamp: '1234567890123' },
            },
            {
                path: 'details/2024/term1/02/1234567890124',
                data: { amount: 2000, datetime_of_use: new Date('2024-01-02') },
                params: { year: '2024', month: '1', term: 'term1', day: '2', timestamp: '1234567890124' },
            },
        ];

        const request: ReportRecalculationRequest = {
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31'),
            reportTypes: ['daily', 'weekly', 'monthly'],
            executedBy: 'test-user',
            dryRun: false,
        };

        it('カード利用データが見つからない場合、成功レスポンスを返す', async () => {
            // Given
            mockDataExplorerService.exploreCardUsageData.mockResolvedValue([]);

            // When
            const result = await useCase.execute(request);

            // Then
            expect(result.success).toBe(true);
            expect(result.message).toContain('処理対象のデータが見つかりませんでした');
            expect(mockRecalculationService.recalculateDailyReports).not.toHaveBeenCalled();
        });

        it('ドライランモードの場合、実際の処理を実行しない', async () => {
            // Given
            mockDataExplorerService.exploreCardUsageData.mockResolvedValue(cardUsageDocuments);
            const dryRunRequest = { ...request, dryRun: true };

            // When
            const result = await useCase.execute(dryRunRequest);

            // Then
            expect(result.success).toBe(true);
            expect(result.message).toContain('ドライラン完了');
            expect(mockRecalculationService.recalculateDailyReports).not.toHaveBeenCalled();
            expect(mockRecalculationService.recalculateWeeklyReports).not.toHaveBeenCalled();
            expect(mockRecalculationService.recalculateMonthlyReports).not.toHaveBeenCalled();
        });

        it('デイリーレポートのみを再集計する', async () => {
            // Given
            mockDataExplorerService.exploreCardUsageData.mockResolvedValue(cardUsageDocuments);
            mockRecalculationService.recalculateDailyReports.mockResolvedValue({ created: 2, updated: 0 });
            const dailyOnlyRequest = { ...request, reportTypes: ['daily'] as ('daily' | 'weekly' | 'monthly')[] };

            // When
            const result = await useCase.execute(dailyOnlyRequest);

            // Then
            expect(result.success).toBe(true);
            expect(mockRecalculationService.recalculateDailyReports).toHaveBeenCalledWith(
                cardUsageDocuments,
                'test-user'
            );
            expect(mockRecalculationService.recalculateWeeklyReports).not.toHaveBeenCalled();
            expect(mockRecalculationService.recalculateMonthlyReports).not.toHaveBeenCalled();
        });

        it('ウィークリーレポートのみを再集計する', async () => {
            // Given
            mockDataExplorerService.exploreCardUsageData.mockResolvedValue(cardUsageDocuments);
            mockRecalculationService.recalculateWeeklyReports.mockResolvedValue({ created: 1, updated: 0 });
            const weeklyOnlyRequest = { ...request, reportTypes: ['weekly'] as ('daily' | 'weekly' | 'monthly')[] };

            // When
            const result = await useCase.execute(weeklyOnlyRequest);

            // Then
            expect(result.success).toBe(true);
            expect(mockRecalculationService.recalculateWeeklyReports).toHaveBeenCalledWith(
                cardUsageDocuments,
                'test-user'
            );
            expect(mockRecalculationService.recalculateDailyReports).not.toHaveBeenCalled();
            expect(mockRecalculationService.recalculateMonthlyReports).not.toHaveBeenCalled();
        });

        it('マンスリーレポートのみを再集計する', async () => {
            // Given
            mockDataExplorerService.exploreCardUsageData.mockResolvedValue(cardUsageDocuments);
            mockRecalculationService.recalculateMonthlyReports.mockResolvedValue({ created: 1, updated: 0 });
            const monthlyOnlyRequest = { ...request, reportTypes: ['monthly'] as ('daily' | 'weekly' | 'monthly')[] };

            // When
            const result = await useCase.execute(monthlyOnlyRequest);

            // Then
            expect(result.success).toBe(true);
            expect(mockRecalculationService.recalculateMonthlyReports).toHaveBeenCalledWith(
                cardUsageDocuments,
                'test-user'
            );
            expect(mockRecalculationService.recalculateDailyReports).not.toHaveBeenCalled();
            expect(mockRecalculationService.recalculateWeeklyReports).not.toHaveBeenCalled();
        });

        it('全てのレポートタイプを再集計する', async () => {
            // Given
            mockDataExplorerService.exploreCardUsageData.mockResolvedValue(cardUsageDocuments);
            mockRecalculationService.recalculateDailyReports.mockResolvedValue({ created: 2, updated: 0 });
            mockRecalculationService.recalculateWeeklyReports.mockResolvedValue({ created: 1, updated: 0 });
            mockRecalculationService.recalculateMonthlyReports.mockResolvedValue({ created: 1, updated: 0 });

            // When
            const result = await useCase.execute(request);

            // Then
            expect(result.success).toBe(true);
            expect(mockRecalculationService.recalculateDailyReports).toHaveBeenCalled();
            expect(mockRecalculationService.recalculateWeeklyReports).toHaveBeenCalled();
            expect(mockRecalculationService.recalculateMonthlyReports).toHaveBeenCalled();
            
            const resultData = result.data as any;
            expect(resultData.reportsCreated.daily).toBe(2);
            expect(resultData.reportsCreated.weekly).toBe(1);
            expect(resultData.reportsCreated.monthly).toBe(1);
        });

        it('一部のレポートタイプでエラーが発生しても処理を続行する', async () => {
            // Given
            mockDataExplorerService.exploreCardUsageData.mockResolvedValue(cardUsageDocuments);
            mockRecalculationService.recalculateDailyReports.mockRejectedValue(new Error('Daily report error'));
            mockRecalculationService.recalculateWeeklyReports.mockResolvedValue({ created: 1, updated: 0 });
            mockRecalculationService.recalculateMonthlyReports.mockResolvedValue({ created: 1, updated: 0 });

            // When
            const result = await useCase.execute(request);

            // Then
            expect(mockRecalculationService.recalculateDailyReports).toHaveBeenCalled();
            expect(mockRecalculationService.recalculateWeeklyReports).toHaveBeenCalled();
            expect(mockRecalculationService.recalculateMonthlyReports).toHaveBeenCalled();
            
            const resultData = result.data as any;
            expect(resultData.errors).toHaveLength(1);
            expect(resultData.errors[0].message).toContain('Daily report error');
            expect(resultData.reportsCreated.weekly).toBe(1);
            expect(resultData.reportsCreated.monthly).toBe(1);
        });

        it('エラーが多数発生した場合、successがfalseになる', async () => {
            // Given
            mockDataExplorerService.exploreCardUsageData.mockResolvedValue(cardUsageDocuments);
            mockRecalculationService.recalculateDailyReports.mockRejectedValue(new Error('Daily error'));
            mockRecalculationService.recalculateWeeklyReports.mockRejectedValue(new Error('Weekly error'));
            mockRecalculationService.recalculateMonthlyReports.mockResolvedValue({ created: 1, updated: 0 });

            // When
            const result = await useCase.execute(request);

            // Then
            const resultData = result.data as any;
            expect(resultData.errors).toHaveLength(2);
            expect(resultData.success).toBe(false);
            expect(result.status).toBe(500);
        });

        it('データ探索中にエラーが発生した場合、エラーレスポンスを返す', async () => {
            // Given
            mockDataExplorerService.exploreCardUsageData.mockRejectedValue(new Error('Explore error'));

            // When
            const result = await useCase.execute(request);

            // Then
            expect(result.success).toBe(false);
            expect(result.status).toBe(500);
            expect(mockRecalculationService.recalculateDailyReports).not.toHaveBeenCalled();
        });

        it('処理結果に正しい統計情報が含まれる', async () => {
            // Given
            mockDataExplorerService.exploreCardUsageData.mockResolvedValue(cardUsageDocuments);
            mockRecalculationService.recalculateDailyReports.mockResolvedValue({ created: 2, updated: 1 });
            mockRecalculationService.recalculateWeeklyReports.mockResolvedValue({ created: 0, updated: 1 });
            mockRecalculationService.recalculateMonthlyReports.mockResolvedValue({ created: 1, updated: 0 });

            // When
            const result = await useCase.execute(request);

            // Then
            const resultData = result.data as any;
            expect(resultData.totalCardUsageProcessed).toBe(2);
            expect(resultData.reportsCreated.daily).toBe(2);
            expect(resultData.reportsCreated.weekly).toBe(0);
            expect(resultData.reportsCreated.monthly).toBe(1);
            expect(resultData.reportsUpdated.daily).toBe(1);
            expect(resultData.reportsUpdated.weekly).toBe(1);
            expect(resultData.reportsUpdated.monthly).toBe(0);
            expect(resultData.executedBy).toBe('test-user');
            expect(resultData.dryRun).toBe(false);
        });

        it('ドライランで正しい統計情報が含まれる', async () => {
            // Given
            mockDataExplorerService.exploreCardUsageData.mockResolvedValue(cardUsageDocuments);
            const dryRunRequest = { ...request, dryRun: true };

            // When
            const result = await useCase.execute(dryRunRequest);

            // Then
            const resultData = result.data as any;
            expect(resultData.totalCardUsageProcessed).toBe(2);
            expect(resultData.expectedProcessing).toBeDefined();
            expect(resultData.dateStats).toBeDefined();
        });

        it('ロギングが適切に実行される', async () => {
            // Given
            mockDataExplorerService.exploreCardUsageData.mockResolvedValue(cardUsageDocuments);
            mockRecalculationService.recalculateDailyReports.mockResolvedValue({ created: 2, updated: 0 });
            const dailyOnlyRequest = { ...request, reportTypes: ['daily'] as ('daily' | 'weekly' | 'monthly')[] };

            // When
            await useCase.execute(dailyOnlyRequest);

            // Then
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('レポート再集計開始'),
                'Report Recalculation UseCase'
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('発見されたカード利用データ: 2件'),
                'Report Recalculation UseCase'
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('dailyレポートの再集計を開始'),
                'Report Recalculation UseCase'
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('レポート再集計完了'),
                'Report Recalculation UseCase'
            );
        });
    });
});
