import { ReportRecalculationService } from '../../../../../../functions/src/application/services/ReportRecalculationService';
import { FirestoreReportUseCase } from '../../../../../../shared/usecases/database/FirestoreReportUseCase';
import { CardUsageDocument } from '../../../../../../functions/src/domain/entities/ReportRecalculation';
import { DailyReport, WeeklyReport, MonthlyReport } from '../../../../../../shared/domain/entities/Reports';

// Mock FirestoreReportUseCase
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
} as any;

describe('ReportRecalculationService', () => {
    let service: ReportRecalculationService;

    beforeEach(() => {
        service = new ReportRecalculationService(mockReportUseCase);
        jest.clearAllMocks();
    });

    describe('recalculateDailyReports', () => {
        const cardUsageDocuments: CardUsageDocument[] = [
            {
                path: 'details/2024/term1/01/1234567890123',
                data: { amount: 1000, datetime_of_use: new Date('2024-01-01') },
                params: { year: '2024', month: '1', term: 'term1', day: '1', timestamp: '1234567890123' },
            },
            {
                path: 'details/2024/term1/01/1234567890124',
                data: { amount: 2000, datetime_of_use: new Date('2024-01-01') },
                params: { year: '2024', month: '1', term: 'term1', day: '1', timestamp: '1234567890124' },
            },
            {
                path: 'details/2024/term1/02/1234567890125',
                data: { amount: 1500, datetime_of_use: new Date('2024-01-02') },
                params: { year: '2024', month: '1', term: 'term1', day: '2', timestamp: '1234567890125' },
            },
        ];

        it('既存レポートがない場合、新規レポートを作成する', async () => {
            // Given
            mockReportUseCase.getDailyReport.mockRejectedValue(new Error('Not found'));

            // When
            const result = await service.recalculateDailyReports(cardUsageDocuments, 'test-user');

            // Then
            expect(mockReportUseCase.createDailyReport).toHaveBeenCalledTimes(2); // 2024-01-01 and 2024-01-02
            expect(result.created).toBe(2);
            expect(result.updated).toBe(0);
        });

        it('既存レポートがある場合、レポートを更新する', async () => {
            // Given
            const existingReport: DailyReport = {
                date: { toDate: () => new Date('2024-01-01') },
                totalAmount: 500,
                totalCount: 1,
                documentIdList: ['old-doc'],
                hasNotified: false,
                lastUpdatedBy: 'old-user',
            } as any;
            mockReportUseCase.getDailyReport.mockResolvedValue(existingReport);

            // When
            const result = await service.recalculateDailyReports(cardUsageDocuments, 'test-user');

            // Then
            expect(mockReportUseCase.updateDailyReport).toHaveBeenCalledTimes(2);
            expect(result.created).toBe(0);
            expect(result.updated).toBe(2);
        });

        it('同じ日付のデータを正しく集計する', async () => {
            // Given
            mockReportUseCase.getDailyReport.mockRejectedValue(new Error('Not found'));

            // When
            await service.recalculateDailyReports(cardUsageDocuments, 'test-user');

            // Then
            const call = mockReportUseCase.createDailyReport.mock.calls.find((c) => c[1] === '2024' && c[2] === '01' && c[3] === '01');
            expect(call).toBeDefined();
            const report = call![0];
            expect(report.totalAmount).toBe(3000); // 1000 + 2000
            expect(report.totalCount).toBe(2);
            expect(report.documentIdList).toHaveLength(2);
        });

        it('既存のhasNotifiedフラグを保持する', async () => {
            // Given
            const existingReport: DailyReport = {
                date: { toDate: () => new Date('2024-01-01') },
                totalAmount: 500,
                totalCount: 1,
                documentIdList: ['old-doc'],
                hasNotified: true,
                lastUpdatedBy: 'old-user',
            } as any;
            mockReportUseCase.getDailyReport.mockResolvedValue(existingReport);

            // When
            await service.recalculateDailyReports(cardUsageDocuments, 'test-user');

            // Then
            const call = mockReportUseCase.updateDailyReport.mock.calls[0];
            expect(call[0].hasNotified).toBe(true);
        });

        it('エラーが発生した場合、適切なエラーを投げる', async () => {
            // Given
            mockReportUseCase.getDailyReport.mockRejectedValue(new Error('Not found'));
            mockReportUseCase.createDailyReport.mockRejectedValue(new Error('Database error'));

            // When / Then
            await expect(service.recalculateDailyReports(cardUsageDocuments, 'test-user'))
                .rejects.toThrow('デイリーレポート再集計エラー');
        });
    });

    describe('recalculateWeeklyReports', () => {
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
            {
                path: 'details/2024/term2/08/1234567890125',
                data: { amount: 1500, datetime_of_use: new Date('2024-01-08') },
                params: { year: '2024', month: '1', term: 'term2', day: '8', timestamp: '1234567890125' },
            },
        ];

        it('既存レポートがない場合、新規レポートを作成する', async () => {
            // Given
            mockReportUseCase.getWeeklyReport.mockRejectedValue(new Error('Not found'));

            // When
            const result = await service.recalculateWeeklyReports(cardUsageDocuments, 'test-user');

            // Then
            expect(mockReportUseCase.createWeeklyReport).toHaveBeenCalledTimes(2); // term1 and term2
            expect(result.created).toBe(2);
            expect(result.updated).toBe(0);
        });

        it('既存レポートがある場合、レポートを更新する', async () => {
            // Given
            const existingReport: WeeklyReport = {
                termStartDate: { toDate: () => new Date('2024-01-01') },
                termEndDate: { toDate: () => new Date('2024-01-07') },
                totalAmount: 500,
                totalCount: 1,
                documentIdList: ['old-doc'],
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
                hasReportSent: false,
                lastUpdatedBy: 'old-user',
            } as any;
            mockReportUseCase.getWeeklyReport.mockResolvedValue(existingReport);

            // When
            const result = await service.recalculateWeeklyReports(cardUsageDocuments, 'test-user');

            // Then
            expect(mockReportUseCase.updateWeeklyReport).toHaveBeenCalledTimes(2);
            expect(result.created).toBe(0);
            expect(result.updated).toBe(2);
        });

        it('同じ週のデータを正しく集計する', async () => {
            // Given
            mockReportUseCase.getWeeklyReport.mockRejectedValue(new Error('Not found'));

            // When
            await service.recalculateWeeklyReports(cardUsageDocuments, 'test-user');

            // Then
            const call = mockReportUseCase.createWeeklyReport.mock.calls.find((c) => c[1] === '2024' && c[2] === '01' && c[3] === '1');
            expect(call).toBeDefined();
            const report = call![0];
            expect(report.totalAmount).toBe(3000); // 1000 + 2000
            expect(report.totalCount).toBe(2);
        });

        it('既存の通知フラグを保持する', async () => {
            // Given
            const existingReport: WeeklyReport = {
                termStartDate: { toDate: () => new Date('2024-01-01') },
                termEndDate: { toDate: () => new Date('2024-01-07') },
                totalAmount: 500,
                totalCount: 1,
                documentIdList: ['old-doc'],
                hasNotifiedLevel1: true,
                hasNotifiedLevel2: true,
                hasNotifiedLevel3: false,
                hasReportSent: true,
                lastUpdatedBy: 'old-user',
            } as any;
            mockReportUseCase.getWeeklyReport.mockResolvedValue(existingReport);

            // When
            await service.recalculateWeeklyReports(cardUsageDocuments, 'test-user');

            // Then
            const call = mockReportUseCase.updateWeeklyReport.mock.calls[0];
            expect(call[0].hasNotifiedLevel1).toBe(true);
            expect(call[0].hasNotifiedLevel2).toBe(true);
            expect(call[0].hasNotifiedLevel3).toBe(false);
            expect(call[0].hasReportSent).toBe(true);
        });
    });

    describe('recalculateMonthlyReports', () => {
        const cardUsageDocuments: CardUsageDocument[] = [
            {
                path: 'details/2024/term1/01/1234567890123',
                data: { amount: 1000, datetime_of_use: new Date('2024-01-01') },
                params: { year: '2024', month: '1', term: 'term1', day: '1', timestamp: '1234567890123' },
            },
            {
                path: 'details/2024/term1/15/1234567890124',
                data: { amount: 2000, datetime_of_use: new Date('2024-01-15') },
                params: { year: '2024', month: '1', term: 'term3', day: '15', timestamp: '1234567890124' },
            },
            {
                path: 'details/2024/term1/01/1234567890125',
                data: { amount: 1500, datetime_of_use: new Date('2024-02-01') },
                params: { year: '2024', month: '2', term: 'term1', day: '1', timestamp: '1234567890125' },
            },
        ];

        it('既存レポートがない場合、新規レポートを作成する', async () => {
            // Given
            mockReportUseCase.getMonthlyReport.mockRejectedValue(new Error('Not found'));

            // When
            const result = await service.recalculateMonthlyReports(cardUsageDocuments, 'test-user');

            // Then
            expect(mockReportUseCase.createMonthlyReport).toHaveBeenCalledTimes(2); // Jan and Feb
            expect(result.created).toBe(2);
            expect(result.updated).toBe(0);
        });

        it('既存レポートがある場合、レポートを更新する', async () => {
            // Given
            const existingReport: MonthlyReport = {
                monthStartDate: { toDate: () => new Date('2024-01-01') },
                monthEndDate: { toDate: () => new Date('2024-01-31') },
                totalAmount: 500,
                totalCount: 1,
                documentIdList: ['old-doc'],
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
                hasReportSent: false,
                lastUpdatedBy: 'old-user',
            } as any;
            mockReportUseCase.getMonthlyReport.mockResolvedValue(existingReport);

            // When
            const result = await service.recalculateMonthlyReports(cardUsageDocuments, 'test-user');

            // Then
            expect(mockReportUseCase.updateMonthlyReport).toHaveBeenCalledTimes(2);
            expect(result.created).toBe(0);
            expect(result.updated).toBe(2);
        });

        it('同じ月のデータを正しく集計する', async () => {
            // Given
            mockReportUseCase.getMonthlyReport.mockRejectedValue(new Error('Not found'));

            // When
            await service.recalculateMonthlyReports(cardUsageDocuments, 'test-user');

            // Then
            const call = mockReportUseCase.createMonthlyReport.mock.calls.find((c) => c[1] === '2024' && c[2] === '01');
            expect(call).toBeDefined();
            const report = call![0];
            expect(report.totalAmount).toBe(3000); // 1000 + 2000
            expect(report.totalCount).toBe(2);
        });

        it('既存の通知フラグを保持する', async () => {
            // Given
            const existingReport: MonthlyReport = {
                monthStartDate: { toDate: () => new Date('2024-01-01') },
                monthEndDate: { toDate: () => new Date('2024-01-31') },
                totalAmount: 500,
                totalCount: 1,
                documentIdList: ['old-doc'],
                hasNotifiedLevel1: true,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: true,
                hasReportSent: false,
                lastUpdatedBy: 'old-user',
            } as any;
            mockReportUseCase.getMonthlyReport.mockResolvedValue(existingReport);

            // When
            await service.recalculateMonthlyReports(cardUsageDocuments, 'test-user');

            // Then
            const call = mockReportUseCase.updateMonthlyReport.mock.calls[0];
            expect(call[0].hasNotifiedLevel1).toBe(true);
            expect(call[0].hasNotifiedLevel2).toBe(false);
            expect(call[0].hasNotifiedLevel3).toBe(true);
        });
    });
});
