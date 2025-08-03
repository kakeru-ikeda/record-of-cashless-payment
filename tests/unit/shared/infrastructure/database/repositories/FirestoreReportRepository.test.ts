import { Firestore } from 'firebase-admin/firestore';
import { FirestoreReportRepository } from '../../../../../../shared/infrastructure/database/repositories/FirestoreReportRepository';
import { DailyReport, WeeklyReport, MonthlyReport } from '../../../../../../shared/domain/entities/Reports';
import { FirestoreService } from '../../../../../../shared/infrastructure/database/FirestoreService';
import { Environment } from '../../../../../../shared/infrastructure/config/Environment';
import { FirestorePathUtil } from '../../../../../../shared/utils/FirestorePathUtil';
import * as admin from 'firebase-admin';

// モック
jest.mock('../../../../../../shared/infrastructure/database/FirestoreService');
jest.mock('../../../../../../shared/infrastructure/config/Environment');
jest.mock('../../../../../../shared/utils/FirestorePathUtil');

// Loggerをモック化
jest.mock('../../../../../../shared/infrastructure/logging/Logger', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        logAppError: jest.fn(),
        updateServiceStatus: jest.fn()
    }
}));

describe('FirestoreReportRepository', () => {
    let repository: FirestoreReportRepository;
    let mockFirestoreService: jest.Mocked<FirestoreService>;

    // テスト用データ
    const testDate = new Date('2024-06-15T10:30:00');
    const testTimestamp = admin.firestore.Timestamp.fromDate(testDate);
    const testFieldValue = admin.firestore.FieldValue.serverTimestamp();

    const testPathInfo = {
        path: 'details/2024/06/term3/15/1718445000000',
        weeklyReportPath: 'reports/weekly/2024-06/term3',
        dailyReportPath: 'reports/daily/2024-06/15',
        monthlyReportPath: 'reports/monthly/2024/06'
    };

    const sampleDailyReport: DailyReport = {
        totalAmount: 5000,
        totalCount: 3,
        lastUpdated: testFieldValue,
        lastUpdatedBy: 'system',
        documentIdList: ['doc1', 'doc2', 'doc3'],
        date: testTimestamp,
        hasNotified: false
    };

    const sampleWeeklyReport: WeeklyReport = {
        totalAmount: 25000,
        totalCount: 15,
        lastUpdated: testFieldValue,
        lastUpdatedBy: 'system',
        documentIdList: ['doc1', 'doc2', 'doc3'],
        termStartDate: testTimestamp,
        termEndDate: testTimestamp,
        hasNotifiedLevel1: false,
        hasNotifiedLevel2: false,
        hasNotifiedLevel3: false,
        hasReportSent: false
    };

    const sampleMonthlyReport: MonthlyReport = {
        totalAmount: 100000,
        totalCount: 50,
        lastUpdated: testFieldValue,
        lastUpdatedBy: 'system',
        documentIdList: ['doc1', 'doc2', 'doc3'],
        monthStartDate: testTimestamp,
        monthEndDate: testTimestamp,
        hasNotifiedLevel1: false,
        hasNotifiedLevel2: false,
        hasNotifiedLevel3: false,
        hasReportSent: false
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // FirestoreServiceのモック
        mockFirestoreService = {
            getInstance: jest.fn().mockReturnThis(),
            setCloudFunctions: jest.fn(),
            initialize: jest.fn().mockResolvedValue({} as Firestore),
            saveDocument: jest.fn().mockResolvedValue({}),
            getDocument: jest.fn(),
            updateDocument: jest.fn().mockResolvedValue({}),
            query: jest.fn().mockResolvedValue([])
        } as unknown as jest.Mocked<FirestoreService>;

        // FirestoreServiceのgetInstanceメソッドをモック
        (FirestoreService.getInstance as jest.Mock).mockReturnValue(mockFirestoreService);

        // Environmentのモック
        (Environment.getFirebaseAdminKeyPath as jest.Mock).mockReturnValue('/path/to/key.json');
        (Environment.isCloudFunctions as jest.Mock).mockReturnValue(false);

        // FirestorePathUtilの新しいメソッドをモック
        (FirestorePathUtil.getDailyReportPath as jest.Mock).mockReturnValue(testPathInfo.dailyReportPath);
        (FirestorePathUtil.getWeeklyReportPath as jest.Mock).mockReturnValue(testPathInfo.weeklyReportPath);
        (FirestorePathUtil.getMonthlyReportPath as jest.Mock).mockReturnValue(testPathInfo.monthlyReportPath);

        repository = new FirestoreReportRepository();
    });

    describe('initialize', () => {
        test('正常系: Firestoreへの接続が初期化されること', async () => {
            const result = await repository.initialize();

            expect(Environment.getFirebaseAdminKeyPath).toHaveBeenCalled();
            expect(Environment.isCloudFunctions).toHaveBeenCalled();
            expect(mockFirestoreService.setCloudFunctions).toHaveBeenCalledWith(false);
            expect(mockFirestoreService.initialize).toHaveBeenCalledWith('/path/to/key.json');
            expect(result).toBeDefined();
        });
    });

    describe('getDailyReport', () => {
        test('正常系: 日次レポートが正常に取得されること', async () => {
            mockFirestoreService.getDocument.mockResolvedValueOnce(sampleDailyReport);

            const result = await repository.getDailyReport('2024', '06', '15');

            expect(FirestorePathUtil.getDailyReportPath).toHaveBeenCalled();
            expect(mockFirestoreService.getDocument).toHaveBeenCalledWith(testPathInfo.dailyReportPath);
            expect(result).toEqual(sampleDailyReport);
        });

        test('正常系: レポートが存在しない場合、nullが返されること', async () => {
            mockFirestoreService.getDocument.mockResolvedValueOnce(null);

            const result = await repository.getDailyReport('2024', '06', '15');

            expect(result).toBeNull();
        });
    });

    describe('getMonthlyDailyReports', () => {
        test('正常系: 月内の全日次レポートが取得されること', async () => {
            const dailyReports = [sampleDailyReport, sampleDailyReport];
            mockFirestoreService.query.mockResolvedValueOnce(dailyReports);

            const result = await repository.getMonthlyDailyReports('2024', '06');

            expect(mockFirestoreService.query).toHaveBeenCalledWith(
                expect.stringContaining('reports/daily/2024-06'),
                expect.any(Function)
            );
            expect(result).toEqual(dailyReports);
            expect(result).toHaveLength(2);
        });

        test('正常系: データが存在しない場合、空配列が返されること', async () => {
            mockFirestoreService.query.mockResolvedValueOnce([]);

            const result = await repository.getMonthlyDailyReports('2024', '12');

            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });
    });

    describe('getMonthlyReport', () => {
        test('正常系: 月次レポートが正常に取得されること', async () => {
            mockFirestoreService.getDocument.mockResolvedValueOnce(sampleMonthlyReport);

            const result = await repository.getMonthlyReport('2024', '06');

            expect(mockFirestoreService.getDocument).toHaveBeenCalledWith(testPathInfo.monthlyReportPath);
            expect(result).toEqual(sampleMonthlyReport);
        });

        test('正常系: レポートが存在しない場合、nullが返されること', async () => {
            mockFirestoreService.getDocument.mockResolvedValueOnce(null);

            const result = await repository.getMonthlyReport('2024', '06');

            expect(result).toBeNull();
        });
    });

    describe('getWeeklyReport', () => {
        test('正常系: 週次レポートが正常に取得されること', async () => {
            mockFirestoreService.getDocument.mockResolvedValueOnce(sampleWeeklyReport);

            const result = await repository.getWeeklyReport('2024', '06', '3');

            expect(mockFirestoreService.getDocument).toHaveBeenCalledWith('reports/weekly/2024-06/term3');
            expect(result).toEqual(sampleWeeklyReport);
        });

        test('正常系: レポートが存在しない場合、nullが返されること', async () => {
            mockFirestoreService.getDocument.mockResolvedValueOnce(null);

            const result = await repository.getWeeklyReport('2024', '06', '3');

            expect(result).toBeNull();
        });
    });

    describe('getMonthlyWeeklyReports', () => {
        test('正常系: 月内の全週次レポートが取得されること', async () => {
            const weeklyReports = [sampleWeeklyReport, sampleWeeklyReport];
            mockFirestoreService.query.mockResolvedValueOnce(weeklyReports);

            const result = await repository.getMonthlyWeeklyReports('2024', '06');

            expect(mockFirestoreService.query).toHaveBeenCalledWith(
                expect.stringContaining('reports/weekly/2024-06'),
                expect.any(Function)
            );
            expect(result).toEqual(weeklyReports);
            expect(result).toHaveLength(2);
        });

        test('正常系: データが存在しない場合、空配列が返されること', async () => {
            mockFirestoreService.query.mockResolvedValueOnce([]);

            const result = await repository.getMonthlyWeeklyReports('2024', '12');

            expect(result).toEqual([]);
        });
    });

    describe('saveDailyReport', () => {
        test('正常系: 日次レポートが正常に保存されること', async () => {
            const result = await repository.saveDailyReport(sampleDailyReport, '2024', '06', '15');

            expect(mockFirestoreService.saveDocument).toHaveBeenCalledWith(
                testPathInfo.dailyReportPath,
                sampleDailyReport
            );
            expect(result).toBe(testPathInfo.dailyReportPath);
        });
    });

    describe('saveWeeklyReport', () => {
        test('正常系: 週次レポートが正常に保存されること', async () => {
            const result = await repository.saveWeeklyReport(sampleWeeklyReport, '2024', '06', '3');

            expect(mockFirestoreService.saveDocument).toHaveBeenCalledWith(
                testPathInfo.weeklyReportPath,
                sampleWeeklyReport
            );
            expect(result).toBe(testPathInfo.weeklyReportPath);
        });
    });

    describe('saveMonthlyReport', () => {
        test('正常系: 月次レポートが正常に保存されること', async () => {
            const result = await repository.saveMonthlyReport(sampleMonthlyReport, '2024', '06');

            expect(mockFirestoreService.saveDocument).toHaveBeenCalledWith(
                testPathInfo.monthlyReportPath,
                sampleMonthlyReport
            );
            expect(result).toBe(testPathInfo.monthlyReportPath);
        });
    });

    describe('updateDailyReport', () => {
        test('正常系: 日次レポートが正常に更新されること', async () => {
            const partialReport = { totalAmount: 6000 };

            const result = await repository.updateDailyReport(partialReport, '2024', '06', '15');

            expect(mockFirestoreService.updateDocument).toHaveBeenCalledWith(
                testPathInfo.dailyReportPath,
                partialReport
            );
            expect(result).toBe(testPathInfo.dailyReportPath);
        });
    });

    describe('updateWeeklyReport', () => {
        test('正常系: 週次レポートが正常に更新されること', async () => {
            const partialReport = { hasNotifiedLevel1: true };

            const result = await repository.updateWeeklyReport(partialReport, '2024', '06', '15');

            expect(mockFirestoreService.updateDocument).toHaveBeenCalledWith(
                testPathInfo.weeklyReportPath,
                partialReport
            );
            expect(result).toBe(testPathInfo.weeklyReportPath);
        });
    });

    describe('updateMonthlyReport', () => {
        test('正常系: 月次レポートが正常に更新されること', async () => {
            const partialReport = { hasNotifiedLevel1: true };

            const result = await repository.updateMonthlyReport(partialReport, '2024', '06');

            expect(mockFirestoreService.updateDocument).toHaveBeenCalledWith(
                testPathInfo.monthlyReportPath,
                partialReport
            );
            expect(result).toBe(testPathInfo.monthlyReportPath);
        });
    });
});
