import { Firestore } from 'firebase-admin/firestore';
import { FirestoreReportRepository } from '../../../../../../shared/infrastructure/database/repositories/FirestoreReportRepository';
import { DailyReport, WeeklyReport, MonthlyReport } from '../../../../../../shared/domain/entities/Reports';
import { FirestoreService } from '../../../../../../shared/infrastructure/database/FirestoreService';
import { Environment } from '../../../../../../shared/infrastructure/config/Environment';
import { FirestorePathUtil } from '../../../../../../shared/utils/FirestorePathUtil';
import { AppError, ErrorType } from '../../../../../../shared/errors/AppError';
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

// ErrorHandlerをモック化
jest.mock('../../../../../../shared/infrastructure/errors/ErrorHandler', () => ({
    ErrorHandler: {
        errorDecorator: () => () => (
            _target: any,
            _propertyKey: string | symbol,
            descriptor: PropertyDescriptor
        ) => descriptor,
        handle: jest.fn(),
        extractErrorInfoFromArgs: jest.fn()
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
            query: jest.fn().mockResolvedValue([])
        } as unknown as jest.Mocked<FirestoreService>;

        // FirestoreServiceのgetInstanceメソッドをモック
        (FirestoreService.getInstance as jest.Mock).mockReturnValue(mockFirestoreService);

        // Environmentのモック
        (Environment.getFirebaseAdminKeyPath as jest.Mock).mockReturnValue('/path/to/key.json');
        (Environment.isCloudFunctions as jest.Mock).mockReturnValue(false);

        // FirestorePathUtilのモック
        (FirestorePathUtil.getFirestorePath as jest.Mock).mockReturnValue(testPathInfo);

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

        test('異常系: 初期化中にエラーが発生した場合、エラーがスローされること', async () => {
            mockFirestoreService.initialize.mockRejectedValueOnce(new Error('初期化エラー'));

            await expect(repository.initialize()).rejects.toThrow('初期化エラー');
        });
    });

    describe('getDailyReport', () => {
        test('正常系: 日次レポートが正常に取得されること', async () => {
            mockFirestoreService.getDocument.mockResolvedValueOnce(sampleDailyReport);

            const result = await repository.getDailyReport('2024', '06', '15');

            expect(FirestorePathUtil.getFirestorePath).toHaveBeenCalled();
            expect(mockFirestoreService.getDocument).toHaveBeenCalledWith(testPathInfo.dailyReportPath);
            expect(result).toEqual(sampleDailyReport);
        });

        test('正常系: レポートが存在しない場合、nullが返されること', async () => {
            mockFirestoreService.getDocument.mockResolvedValueOnce(null);

            const result = await repository.getDailyReport('2024', '06', '15');

            expect(result).toBeNull();
        });

        test('異常系: 無効な日付の場合、AppErrorがスローされること', async () => {
            await expect(repository.getDailyReport('2024', '13', '15'))
                .rejects.toThrow(AppError);
            await expect(repository.getDailyReport('2024', '13', '15'))
                .rejects.toThrow('月は1から12の間で指定してください');
        });

        test('異常系: 無効な日の場合、AppErrorがスローされること', async () => {
            await expect(repository.getDailyReport('2024', '06', '32'))
                .rejects.toThrow(AppError);
            await expect(repository.getDailyReport('2024', '06', '32'))
                .rejects.toThrow('日は1から31の間で指定してください');
        });

        test('異常系: 存在しない日付の場合、AppErrorがスローされること', async () => {
            await expect(repository.getDailyReport('2024', '02', '30'))
                .rejects.toThrow(AppError);
            await expect(repository.getDailyReport('2024', '02', '30'))
                .rejects.toThrow('無効な日付です');
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

        test('異常系: 無効な年月の場合、AppErrorがスローされること', async () => {
            await expect(repository.getMonthlyDailyReports('2024', '13'))
                .rejects.toThrow(AppError);
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

        test('異常系: 無効な年月の場合、AppErrorがスローされること', async () => {
            await expect(repository.getMonthlyReport('1999', '06'))
                .rejects.toThrow(AppError);
            await expect(repository.getMonthlyReport('1999', '06'))
                .rejects.toThrow('年は2000年から2100年の間で指定してください');
        });
    });

    describe('getWeeklyReportByTerm', () => {
        test('正常系: 週次レポートが正常に取得されること', async () => {
            mockFirestoreService.getDocument.mockResolvedValueOnce(sampleWeeklyReport);

            const result = await repository.getWeeklyReportByTerm('2024', '06', '3');

            expect(mockFirestoreService.getDocument).toHaveBeenCalledWith(testPathInfo.weeklyReportPath);
            expect(result).toEqual(sampleWeeklyReport);
        });

        test('正常系: レポートが存在しない場合、nullが返されること', async () => {
            mockFirestoreService.getDocument.mockResolvedValueOnce(null);

            const result = await repository.getWeeklyReportByTerm('2024', '06', '3');

            expect(result).toBeNull();
        });

        test('異常系: 無効な年月の場合、AppErrorがスローされること', async () => {
            await expect(repository.getWeeklyReportByTerm('abc', '06', '3'))
                .rejects.toThrow(AppError);
            await expect(repository.getWeeklyReportByTerm('abc', '06', '3'))
                .rejects.toThrow('年、月は数値で指定してください');
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

        test('異常系: 保存中にエラーが発生した場合、エラーがスローされること', async () => {
            mockFirestoreService.saveDocument.mockRejectedValueOnce(new Error('保存エラー'));

            await expect(repository.saveDailyReport(sampleDailyReport, '2024', '06', '15'))
                .rejects.toThrow('保存エラー');
        });

        test('異常系: 無効な日付の場合、AppErrorがスローされること', async () => {
            await expect(repository.saveDailyReport(sampleDailyReport, '2024', '02', '30'))
                .rejects.toThrow(AppError);
        });
    });

    describe('saveWeeklyReport', () => {
        test('正常系: 週次レポートが正常に保存されること', async () => {
            const result = await repository.saveWeeklyReport(sampleWeeklyReport, '2024', '06');

            expect(mockFirestoreService.saveDocument).toHaveBeenCalledWith(
                testPathInfo.weeklyReportPath,
                sampleWeeklyReport
            );
            expect(result).toBe(testPathInfo.weeklyReportPath);
        });

        test('異常系: 保存中にエラーが発生した場合、エラーがスローされること', async () => {
            mockFirestoreService.saveDocument.mockRejectedValueOnce(new Error('保存エラー'));

            await expect(repository.saveWeeklyReport(sampleWeeklyReport, '2024', '06'))
                .rejects.toThrow('保存エラー');
        });

        test('異常系: 無効な年月の場合、AppErrorがスローされること', async () => {
            await expect(repository.saveWeeklyReport(sampleWeeklyReport, '2024', '0'))
                .rejects.toThrow(AppError);
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

        test('異常系: 保存中にエラーが発生した場合、エラーがスローされること', async () => {
            mockFirestoreService.saveDocument.mockRejectedValueOnce(new Error('保存エラー'));

            await expect(repository.saveMonthlyReport(sampleMonthlyReport, '2024', '06'))
                .rejects.toThrow('保存エラー');
        });

        test('異常系: 無効な年月の場合、AppErrorがスローされること', async () => {
            await expect(repository.saveMonthlyReport(sampleMonthlyReport, '2101', '06'))
                .rejects.toThrow(AppError);
            await expect(repository.saveMonthlyReport(sampleMonthlyReport, '2101', '06'))
                .rejects.toThrow('年は2000年から2100年の間で指定してください');
        });
    });

    describe('validateDate (private method)', () => {
        test('正常系: 有効な日付はバリデーションを通ること', async () => {
            // 有効な日付での操作が成功することで間接的にテスト
            mockFirestoreService.getDocument.mockResolvedValueOnce(sampleDailyReport);

            await expect(repository.getDailyReport('2024', '06', '15'))
                .resolves.toEqual(sampleDailyReport);
        });

        test('異常系: 数値以外の年の場合、AppErrorがスローされること', async () => {
            await expect(repository.getDailyReport('abc', '06', '15'))
                .rejects.toThrow(AppError);
            await expect(repository.getDailyReport('abc', '06', '15'))
                .rejects.toThrow('年、月、日は数値で指定してください');
        });

        test('異常系: 数値以外の月の場合、AppErrorがスローされること', async () => {
            await expect(repository.getDailyReport('2024', 'abc', '15'))
                .rejects.toThrow(AppError);
        });

        test('異常系: 数値以外の日の場合、AppErrorがスローされること', async () => {
            await expect(repository.getDailyReport('2024', '06', 'abc'))
                .rejects.toThrow(AppError);
        });
    });

    describe('validateYearMonth (private method)', () => {
        test('正常系: 有効な年月はバリデーションを通ること', async () => {
            // 有効な年月での操作が成功することで間接的にテスト
            mockFirestoreService.getDocument.mockResolvedValueOnce(sampleMonthlyReport);

            await expect(repository.getMonthlyReport('2024', '06'))
                .resolves.toEqual(sampleMonthlyReport);
        });

        test('異常系: 数値以外の年の場合、AppErrorがスローされること', async () => {
            await expect(repository.getMonthlyReport('abc', '06'))
                .rejects.toThrow(AppError);
            await expect(repository.getMonthlyReport('abc', '06'))
                .rejects.toThrow('年、月は数値で指定してください');
        });

        test('異常系: 数値以外の月の場合、AppErrorがスローされること', async () => {
            await expect(repository.getMonthlyReport('2024', 'abc'))
                .rejects.toThrow(AppError);
        });
    });
});
