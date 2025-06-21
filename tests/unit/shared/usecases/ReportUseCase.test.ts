import { ReportUseCase } from '../../../../shared/usecases/ReportUseCase';
import { IReportCrudRepository } from '../../../../shared/domain/interfaces/database/repositories/IReportCrudRepository';
import { DailyReport, WeeklyReport, MonthlyReport } from '../../../../shared/domain/entities/Report';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import * as admin from 'firebase-admin';

// Loggerをモック化
jest.mock('../../../../shared/infrastructure/logging/Logger', () => ({
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
jest.mock('../../../../shared/infrastructure/errors/ErrorHandler', () => ({
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

describe('ReportUseCase', () => {
  let reportUseCase: ReportUseCase;
  let mockReportRepository: jest.Mocked<IReportCrudRepository>;

  // テスト用データ
  const testDate = new Date('2024-06-15T10:30:00');
  const testTimestamp = admin.firestore.Timestamp.fromDate(testDate);
  const testFieldValue = admin.firestore.FieldValue.serverTimestamp();

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

    // リポジトリのモックを作成
    mockReportRepository = {
      initialize: jest.fn(),
      getDailyReport: jest.fn(),
      getMonthlyDailyReports: jest.fn(),
      getMonthlyReport: jest.fn(),
      getWeeklyReportByTerm: jest.fn(),
      getMonthlyWeeklyReports: jest.fn(),
      saveDailyReport: jest.fn(),
      saveWeeklyReport: jest.fn(),
      saveMonthlyReport: jest.fn()
    };

    reportUseCase = new ReportUseCase(mockReportRepository);
  });

  describe('getDailyReport', () => {
    test('正常系: 日次レポートが正常に取得されること', async () => {
      // モックの設定
      mockReportRepository.getDailyReport.mockResolvedValueOnce(sampleDailyReport);

      // 実行
      const result = await reportUseCase.getDailyReport('2024', '06', '15');

      // 検証
      expect(mockReportRepository.getDailyReport).toHaveBeenCalledWith('2024', '06', '15');
      expect(result).toEqual(sampleDailyReport);
    });

    test('異常系: レポートが見つからない場合、AppErrorがスローされること', async () => {
      // モックの設定
      mockReportRepository.getDailyReport.mockResolvedValueOnce(null);

      // 実行と検証
      await expect(reportUseCase.getDailyReport('2024', '06', '15'))
        .rejects.toThrow(AppError);
      await expect(reportUseCase.getDailyReport('2024', '06', '15'))
        .rejects.toThrow('2024年06月15日のレポートが見つかりません');
    });

    test('異常系: リポジトリエラーが発生した場合、エラーがスローされること', async () => {
      // モックの設定
      mockReportRepository.getDailyReport.mockRejectedValueOnce(new Error('データベースエラー'));

      // 実行と検証
      await expect(reportUseCase.getDailyReport('2024', '06', '15'))
        .rejects.toThrow('データベースエラー');
    });
  });

  describe('getMonthlyReport', () => {
    test('正常系: 月次レポートが正常に取得されること', async () => {
      // モックの設定
      mockReportRepository.getMonthlyReport.mockResolvedValueOnce(sampleMonthlyReport);

      // 実行
      const result = await reportUseCase.getMonthlyReport('2024', '06');

      // 検証
      expect(mockReportRepository.getMonthlyReport).toHaveBeenCalledWith('2024', '06');
      expect(result).toEqual(sampleMonthlyReport);
    });

    test('異常系: レポートが見つからない場合、AppErrorがスローされること', async () => {
      // モックの設定
      mockReportRepository.getMonthlyReport.mockResolvedValueOnce(null);

      // 実行と検証
      await expect(reportUseCase.getMonthlyReport('2024', '06'))
        .rejects.toThrow(AppError);
      await expect(reportUseCase.getMonthlyReport('2024', '06'))
        .rejects.toThrow('2024年06月のレポートが見つかりません');
    });
  });

  describe('getWeeklyReport', () => {
    test('正常系: 週次レポートが正常に取得されること', async () => {
      // モックの設定
      mockReportRepository.getWeeklyReportByTerm.mockResolvedValueOnce(sampleWeeklyReport);

      // 実行
      const result = await reportUseCase.getWeeklyReport('2024', '06', '3');

      // 検証
      expect(mockReportRepository.getWeeklyReportByTerm).toHaveBeenCalledWith('2024', '06', '3');
      expect(result).toEqual(sampleWeeklyReport);
    });

    test('異常系: レポートが見つからない場合、AppErrorがスローされること', async () => {
      // モックの設定
      mockReportRepository.getWeeklyReportByTerm.mockResolvedValueOnce(null);

      // 実行と検証
      await expect(reportUseCase.getWeeklyReport('2024', '06', '3'))
        .rejects.toThrow(AppError);
      await expect(reportUseCase.getWeeklyReport('2024', '06', '3'))
        .rejects.toThrow('2024年06月term3の週次レポートが見つかりません');
    });
  });

  describe('getMonthlyDailyReports', () => {
    test('正常系: 月内の全日次レポートが正常に取得されること', async () => {
      const dailyReports = [sampleDailyReport, sampleDailyReport];
      
      // モックの設定
      mockReportRepository.getMonthlyDailyReports.mockResolvedValueOnce(dailyReports);

      // 実行
      const result = await reportUseCase.getMonthlyDailyReports('2024', '06');

      // 検証
      expect(mockReportRepository.getMonthlyDailyReports).toHaveBeenCalledWith('2024', '06');
      expect(result).toEqual(dailyReports);
      expect(result).toHaveLength(2);
    });

    test('正常系: データが存在しない場合、空配列が返されること', async () => {
      // モックの設定
      mockReportRepository.getMonthlyDailyReports.mockResolvedValueOnce([]);

      // 実行
      const result = await reportUseCase.getMonthlyDailyReports('2024', '12');

      // 検証
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('getMonthlyWeeklyReports', () => {
    test('正常系: 月内の全週次レポートが正常に取得されること', async () => {
      const weeklyReports = [sampleWeeklyReport, sampleWeeklyReport];
      
      // モックの設定
      mockReportRepository.getMonthlyWeeklyReports.mockResolvedValueOnce(weeklyReports);

      // 実行
      const result = await reportUseCase.getMonthlyWeeklyReports('2024', '06');

      // 検証
      expect(mockReportRepository.getMonthlyWeeklyReports).toHaveBeenCalledWith('2024', '06');
      expect(result).toEqual(weeklyReports);
      expect(result).toHaveLength(2);
    });

    test('正常系: データが存在しない場合、空配列が返されること', async () => {
      // モックの設定
      mockReportRepository.getMonthlyWeeklyReports.mockResolvedValueOnce([]);

      // 実行
      const result = await reportUseCase.getMonthlyWeeklyReports('2024', '12');

      // 検証
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('getReports (廃止予定)', () => {
    test('正常系: 適切なパラメータでレポート一覧が取得されること', async () => {
      // 実行
      const result = await reportUseCase.getReports('daily', 10, 0);

      // 検証 - 廃止予定のため空配列が返される
      expect(result.reports).toEqual([]);
      expect(result.pagination).toEqual({
        limit: 10,
        offset: 0,
        total: 0
      });
    });

    test('異常系: limitパラメータが無効な場合、AppErrorがスローされること', async () => {
      // limitが範囲外の場合
      await expect(reportUseCase.getReports('daily', 0, 0))
        .rejects.toThrow(AppError);
      await expect(reportUseCase.getReports('daily', 101, 0))
        .rejects.toThrow(AppError);
      await expect(reportUseCase.getReports('daily', 0, 0))
        .rejects.toThrow('limitは1から100の間で指定してください');
    });

    test('異常系: offsetパラメータが無効な場合、AppErrorがスローされること', async () => {
      // offsetが負の値の場合
      await expect(reportUseCase.getReports('daily', 10, -1))
        .rejects.toThrow(AppError);
      await expect(reportUseCase.getReports('daily', 10, -1))
        .rejects.toThrow('offsetは0以上で指定してください');
    });

    test('異常系: typeパラメータが無効な場合、AppErrorがスローされること', async () => {
      // @ts-ignore - テストのため型チェックを無視
      await expect(reportUseCase.getReports('invalid', 10, 0))
        .rejects.toThrow(AppError);
      // @ts-ignore
      await expect(reportUseCase.getReports('invalid', 10, 0))
        .rejects.toThrow('typeはdaily、weekly、monthlyのいずれかを指定してください');
    });
  });

  describe('createDailyReport', () => {
    test('正常系: 日次レポートが正常に作成されること', async () => {
      const expectedPath = 'reports/daily/2024-06/15';
      
      // モックの設定
      mockReportRepository.saveDailyReport.mockResolvedValueOnce(expectedPath);

      // 実行
      const result = await reportUseCase.createDailyReport(sampleDailyReport, '2024', '06', '15');

      // 検証
      expect(mockReportRepository.saveDailyReport).toHaveBeenCalledWith(sampleDailyReport, '2024', '06', '15');
      expect(result).toBe(expectedPath);
    });

    test('異常系: リポジトリエラーが発生した場合、エラーがスローされること', async () => {
      // モックの設定
      mockReportRepository.saveDailyReport.mockRejectedValueOnce(new Error('保存エラー'));

      // 実行と検証
      await expect(reportUseCase.createDailyReport(sampleDailyReport, '2024', '06', '15'))
        .rejects.toThrow('保存エラー');
    });
  });

  describe('createWeeklyReport', () => {
    test('正常系: 週次レポートが正常に作成されること', async () => {
      const expectedPath = 'reports/weekly/2024-06/term3';
      
      // モックの設定
      mockReportRepository.saveWeeklyReport.mockResolvedValueOnce(expectedPath);

      // 実行
      const result = await reportUseCase.createWeeklyReport(sampleWeeklyReport, '2024', '06');

      // 検証
      expect(mockReportRepository.saveWeeklyReport).toHaveBeenCalledWith(sampleWeeklyReport, '2024', '06');
      expect(result).toBe(expectedPath);
    });

    test('異常系: リポジトリエラーが発生した場合、エラーがスローされること', async () => {
      // モックの設定
      mockReportRepository.saveWeeklyReport.mockRejectedValueOnce(new Error('保存エラー'));

      // 実行と検証
      await expect(reportUseCase.createWeeklyReport(sampleWeeklyReport, '2024', '06'))
        .rejects.toThrow('保存エラー');
    });
  });

  describe('createMonthlyReport', () => {
    test('正常系: 月次レポートが正常に作成されること', async () => {
      const expectedPath = 'reports/monthly/2024/06';
      
      // モックの設定
      mockReportRepository.saveMonthlyReport.mockResolvedValueOnce(expectedPath);

      // 実行
      const result = await reportUseCase.createMonthlyReport(sampleMonthlyReport, '2024', '06');

      // 検証
      expect(mockReportRepository.saveMonthlyReport).toHaveBeenCalledWith(sampleMonthlyReport, '2024', '06');
      expect(result).toBe(expectedPath);
    });

    test('異常系: リポジトリエラーが発生した場合、エラーがスローされること', async () => {
      // モックの設定
      mockReportRepository.saveMonthlyReport.mockRejectedValueOnce(new Error('保存エラー'));

      // 実行と検証
      await expect(reportUseCase.createMonthlyReport(sampleMonthlyReport, '2024', '06'))
        .rejects.toThrow('保存エラー');
    });
  });
});
