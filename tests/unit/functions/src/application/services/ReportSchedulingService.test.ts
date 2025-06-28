import { ReportSchedulingService } from '../../../../../../functions/src/application/services/ReportSchedulingService';
import { FirestoreReportUseCase } from '../../../../../../shared/usecases/database/FirestoreReportUseCase';
import { NotifyReportUseCase } from '../../../../../../shared/usecases/notification/NotifyReportUseCase';
import { DateInfo } from '../../../../../../shared/utils/DateUtil';
import { DailyReport, WeeklyReport, MonthlyReport } from '../../../../../../shared/domain/entities/Reports';

// ReportNotificationMapperをモック
jest.mock('../../../../../../shared/infrastructure/mappers/ReportNotificationMapper', () => ({
    ReportNotificationMapper: {
        toDailyScheduledNotification: jest.fn().mockReturnValue({
            title: 'Mock Daily Report',
            additionalInfo: '',
        }),
        toWeeklyScheduledNotification: jest.fn().mockReturnValue({
            title: 'Mock Weekly Report',
            additionalInfo: '',
        }),
        toMonthlyScheduledNotification: jest.fn().mockReturnValue({
            title: 'Mock Monthly Report',
            additionalInfo: '',
        }),
    },
}));

// DateUtilをモック
jest.mock('../../../../../../shared/utils/DateUtil', () => ({
    DateUtil: {
        getJSTDate: jest.fn().mockReturnValue(new Date('2024-01-16')),
        getDateInfo: jest.fn().mockReturnValue({
            date: new Date('2024-01-15'),
            year: 2024,
            month: 1,
            day: 15,
            weekNumber: 3,
            term: 3,
            weekStartDate: new Date('2024-01-15'),
            weekEndDate: new Date('2024-01-21'),
            timestamp: Date.now(),
            isLastDayOfTerm: false,
            isLastDayOfMonth: false,
        }),
    },
}));

// FirestorePathUtilをモック
jest.mock('../../../../../../shared/utils/FirestorePathUtil', () => ({
    FirestorePathUtil: {
        getFirestorePath: jest.fn().mockReturnValue({
            weekNumber: 3,
        }),
    },
}));

// Mocks
const mockReportUseCase: jest.Mocked<FirestoreReportUseCase> = {
    getDailyReport: jest.fn(),
    updateDailyReport: jest.fn(),
    getWeeklyReport: jest.fn(),
    updateWeeklyReport: jest.fn(),
    getMonthlyReport: jest.fn(),
    updateMonthlyReport: jest.fn(),
    createDailyReport: jest.fn(),
    createWeeklyReport: jest.fn(),
    createMonthlyReport: jest.fn(),
} as any;

const mockNotifyReportUseCase: jest.Mocked<NotifyReportUseCase> = {
    notifyDailyReport: jest.fn(),
    notifyWeeklyReport: jest.fn(),
    notifyMonthlyReport: jest.fn(),
} as any;

// Mock 日付情報
const mockDateInfo: DateInfo = {
    date: new Date('2024-01-15'),
    year: 2024,
    month: 1,
    day: 15,
    weekNumber: 3,
    term: 3,
    weekStartDate: new Date('2024-01-15'),
    weekEndDate: new Date('2024-01-21'),
    timestamp: Date.now(),
    isLastDayOfTerm: false,
    isLastDayOfMonth: false,
};

describe('ReportSchedulingService', () => {
    let service: ReportSchedulingService;

    beforeEach(() => {
        service = new ReportSchedulingService(mockReportUseCase, mockNotifyReportUseCase);
        jest.clearAllMocks();
    });

    describe('sendDailyReport', () => {
        it('デイリーレポートが存在し未送信の場合、送信処理を実行する', async () => {
            // Given
            const dailyReport = {
                totalAmount: 1500,
                totalCount: 3,
                hasNotified: false,
            } as DailyReport;
            mockReportUseCase.getDailyReport.mockResolvedValue(dailyReport);
            mockReportUseCase.updateDailyReport.mockResolvedValue('path/to/report');
            mockNotifyReportUseCase.notifyDailyReport.mockResolvedValue(undefined);

            // When
            await service.sendDailyReport(mockDateInfo);

            // Then
            expect(mockReportUseCase.getDailyReport).toHaveBeenCalledWith('2024', '01', '15');
            expect(mockNotifyReportUseCase.notifyDailyReport).toHaveBeenCalled();
            expect(mockReportUseCase.updateDailyReport).toHaveBeenCalled();
        });

        it('デイリーレポートが送信済みの場合、送信処理をスキップする', async () => {
            // Given
            const dailyReport = {
                totalAmount: 1500,
                totalCount: 3,
                hasNotified: true,
            } as DailyReport;
            mockReportUseCase.getDailyReport.mockResolvedValue(dailyReport);

            // When
            await service.sendDailyReport(mockDateInfo);

            // Then
            expect(mockReportUseCase.getDailyReport).toHaveBeenCalled();
            expect(mockNotifyReportUseCase.notifyDailyReport).not.toHaveBeenCalled();
            expect(mockReportUseCase.updateDailyReport).not.toHaveBeenCalled();
        });

        it('デイリーレポートが存在しない場合、処理をスキップする', async () => {
            // Given
            mockReportUseCase.getDailyReport.mockRejectedValue(new Error('Not found'));

            // When
            await service.sendDailyReport(mockDateInfo);

            // Then
            expect(mockReportUseCase.getDailyReport).toHaveBeenCalled();
            expect(mockNotifyReportUseCase.notifyDailyReport).not.toHaveBeenCalled();
            expect(mockReportUseCase.updateDailyReport).not.toHaveBeenCalled();
        });
    });

    describe('sendWeeklyReport', () => {
        it('ウィークリーレポートが存在し未送信の場合、送信処理を実行する', async () => {
            // Given
            const weeklyReport = {
                totalAmount: 10000,
                totalCount: 10,
                hasReportSent: false,
            } as WeeklyReport;
            mockReportUseCase.getWeeklyReport.mockResolvedValue(weeklyReport);
            mockReportUseCase.updateWeeklyReport.mockResolvedValue('path/to/weekly');
            mockNotifyReportUseCase.notifyWeeklyReport.mockResolvedValue(undefined);

            // When
            await service.sendWeeklyReport(mockDateInfo);

            // Then
            expect(mockReportUseCase.getWeeklyReport).toHaveBeenCalledWith('2024', '01', '3');
            expect(mockNotifyReportUseCase.notifyWeeklyReport).toHaveBeenCalled();
            expect(mockReportUseCase.updateWeeklyReport).toHaveBeenCalled();
        });

        it('ウィークリーレポートが送信済みの場合、送信処理をスキップする', async () => {
            // Given
            const weeklyReport = {
                totalAmount: 10000,
                totalCount: 10,
                hasReportSent: true,
            } as WeeklyReport;
            mockReportUseCase.getWeeklyReport.mockResolvedValue(weeklyReport);

            // When
            await service.sendWeeklyReport(mockDateInfo);

            // Then
            expect(mockReportUseCase.getWeeklyReport).toHaveBeenCalled();
            expect(mockNotifyReportUseCase.notifyWeeklyReport).not.toHaveBeenCalled();
            expect(mockReportUseCase.updateWeeklyReport).not.toHaveBeenCalled();
        });
    });

    describe('sendMonthlyReport', () => {
        it('マンスリーレポートが存在し未送信の場合、送信処理を実行する', async () => {
            // Given
            const monthlyReport = {
                totalAmount: 40000,
                totalCount: 30,
                hasReportSent: false,
            } as MonthlyReport;
            mockReportUseCase.getMonthlyReport.mockResolvedValue(monthlyReport);
            mockReportUseCase.updateMonthlyReport.mockResolvedValue('path/to/monthly');
            mockNotifyReportUseCase.notifyMonthlyReport.mockResolvedValue(undefined);

            // When
            await service.sendMonthlyReport(mockDateInfo);

            // Then
            expect(mockReportUseCase.getMonthlyReport).toHaveBeenCalledWith('2024', '01');
            expect(mockNotifyReportUseCase.notifyMonthlyReport).toHaveBeenCalled();
            expect(mockReportUseCase.updateMonthlyReport).toHaveBeenCalled();
        });

        it('マンスリーレポートが送信済みの場合、送信処理をスキップする', async () => {
            // Given
            const monthlyReport = {
                totalAmount: 40000,
                totalCount: 30,
                hasReportSent: true,
            } as MonthlyReport;
            mockReportUseCase.getMonthlyReport.mockResolvedValue(monthlyReport);

            // When
            await service.sendMonthlyReport(mockDateInfo);

            // Then
            expect(mockReportUseCase.getMonthlyReport).toHaveBeenCalled();
            expect(mockNotifyReportUseCase.notifyMonthlyReport).not.toHaveBeenCalled();
            expect(mockReportUseCase.updateMonthlyReport).not.toHaveBeenCalled();
        });
    });

    describe('executeScheduledReports', () => {
        it('通常の日に日次レポートのみ送信する', async () => {
            // Given
            const dailyReport = {
                hasNotified: false,
                totalAmount: 1000,
                totalCount: 1,
            } as DailyReport;
            mockReportUseCase.getDailyReport.mockResolvedValue(dailyReport);
            mockReportUseCase.updateDailyReport.mockResolvedValue('path/to/daily');
            mockNotifyReportUseCase.notifyDailyReport.mockResolvedValue(undefined);

            // When
            await service.executeScheduledReports();

            // Then
            expect(mockNotifyReportUseCase.notifyDailyReport).toHaveBeenCalled();
            expect(mockNotifyReportUseCase.notifyWeeklyReport).not.toHaveBeenCalled();
            expect(mockNotifyReportUseCase.notifyMonthlyReport).not.toHaveBeenCalled();
        });
    });
});
