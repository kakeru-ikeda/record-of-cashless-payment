import { ReportProcessingService } from '../../../../../../functions/src/application/services/ReportProcessingService';
import { IDiscordNotifier } from '../../../../../../shared/domain/interfaces/discord/IDiscordNotifier';
import { IConfigRepository } from '../../../../../../shared/domain/interfaces/database/repositories/IConfigRepository';
import { FirestoreReportUseCase } from '../../../../../../shared/usecases/database/FirestoreReportUseCase';
import { DailyReport, WeeklyReport, MonthlyReport } from '../../../../../../shared/domain/entities/Reports';
import { ReportThresholds } from '../../../../../../shared/domain/entities/ReportThresholds';

// Mocks
const mockThresholds: ReportThresholds = {
    weekly: {
        level1: 1000,
        level2: 5000,
        level3: 10000,
    },
    monthly: {
        level1: 4000,
        level2: 20000,
        level3: 40000,
    },
};

const mockDiscordNotifier: jest.Mocked<IDiscordNotifier> = {
    notifyCardUsage: jest.fn(),
    notifyDailyReport: jest.fn(),
    notifyWeeklyReport: jest.fn(),
    notifyMonthlyReport: jest.fn(),
    notifyError: jest.fn(),
    notifyLogging: jest.fn(),
};

const mockConfigRepository: jest.Mocked<IConfigRepository> = {
    getReportThresholds: jest.fn().mockResolvedValue(mockThresholds),
};

const mockReportUseCase: jest.Mocked<FirestoreReportUseCase> = {
    getDailyReport: jest.fn(),
    createDailyReport: jest.fn(),
    updateDailyReport: jest.fn(),
    getWeeklyReport: jest.fn(),
    createWeeklyReport: jest.fn(),
    updateWeeklyReport: jest.fn(),
    getMonthlyReport: jest.fn(),
    createMonthlyReport: jest.fn(),
    updateMonthlyReport: jest.fn(),
} as any; // Firebase Functions の型チェックを回避

// Mock Firebase Functions DocumentSnapshot
const mockDocument = {
    ref: {
        path: 'details/2024/term1/01/1234567890123',
    },
} as any;

describe('ReportProcessingService', () => {
    let service: ReportProcessingService;

    beforeEach(() => {
        service = new ReportProcessingService(mockDiscordNotifier, mockReportUseCase, mockConfigRepository);
        jest.clearAllMocks();
    });

    describe('processDailyReport', () => {
        const params = { year: '2024', month: '1', day: '1' };
        const data = { amount: 1000 };

        it('既存のデイリーレポートが存在しない場合、新規作成する', async () => {
            // Given
            mockReportUseCase.getDailyReport.mockRejectedValue(new Error('Not found'));

            // When
            const result = await service.processDailyReport(mockDocument, data, params);

            // Then
            expect(mockReportUseCase.getDailyReport).toHaveBeenCalledWith('2024', '01', '01');
            expect(mockReportUseCase.createDailyReport).toHaveBeenCalled();
            expect(result.totalAmount).toBe(1000);
            expect(result.totalCount).toBe(1);
        });

        it('既存のデイリーレポートが存在する場合、更新する', async () => {
            // Given
            const existingReport = {
                totalAmount: 500,
                totalCount: 1,
                documentIdList: ['existing-doc'],
            } as DailyReport;
            mockReportUseCase.getDailyReport.mockResolvedValue(existingReport);

            // When
            const result = await service.processDailyReport(mockDocument, data, params);

            // Then
            expect(mockReportUseCase.updateDailyReport).toHaveBeenCalled();
            expect(result.totalAmount).toBe(1500);
            expect(result.totalCount).toBe(2);
            expect(result.documentIdList).toContain(mockDocument.ref.path);
        });
    });

    describe('processWeeklyReport', () => {
        const params = { year: '2024', month: '1', day: '7' };
        const data = { amount: 2000 };

        it('既存のウィークリーレポートが存在しない場合、新規作成する', async () => {
            // Given
            mockReportUseCase.getWeeklyReport.mockRejectedValue(new Error('Not found'));

            // When
            const result = await service.processWeeklyReport(mockDocument, data, params);

            // Then
            expect(mockReportUseCase.createWeeklyReport).toHaveBeenCalled();
            expect(result.totalAmount).toBe(2000);
            expect(result.totalCount).toBe(1);
        });

        it('既存のウィークリーレポートが存在する場合、更新する', async () => {
            // Given
            const existingReport = {
                totalAmount: 3000,
                totalCount: 2,
                documentIdList: ['existing-doc'],
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
            } as WeeklyReport;
            mockReportUseCase.getWeeklyReport.mockResolvedValue(existingReport);

            // When
            const result = await service.processWeeklyReport(mockDocument, data, params);

            // Then
            expect(mockReportUseCase.updateWeeklyReport).toHaveBeenCalled();
            expect(result.totalAmount).toBe(5000);
            expect(result.totalCount).toBe(3);
        });
    });

    describe('processMonthlyReport', () => {
        const params = { year: '2024', month: '1' };
        const data = { amount: 3000 };

        it('既存のマンスリーレポートが存在しない場合、新規作成する', async () => {
            // Given
            mockReportUseCase.getMonthlyReport.mockRejectedValue(new Error('Not found'));

            // When
            const result = await service.processMonthlyReport(mockDocument, data, params);

            // Then
            expect(mockReportUseCase.createMonthlyReport).toHaveBeenCalled();
            expect(result.totalAmount).toBe(3000);
            expect(result.totalCount).toBe(1);
        });

        it('既存のマンスリーレポートが存在する場合、更新する', async () => {
            // Given
            const existingReport = {
                totalAmount: 15000,
                totalCount: 5,
                documentIdList: ['existing-doc'],
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
            } as MonthlyReport;
            mockReportUseCase.getMonthlyReport.mockResolvedValue(existingReport);

            // When
            const result = await service.processMonthlyReport(mockDocument, data, params);

            // Then
            expect(mockReportUseCase.updateMonthlyReport).toHaveBeenCalled();
            expect(result.totalAmount).toBe(18000);
            expect(result.totalCount).toBe(6);
        });
    });
});

