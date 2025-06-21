import { FirestorePathUtil } from '../../../../shared/utils/FirestorePathUtil';
import { DateUtil } from '../../../../shared/utils/DateUtil';

// DateUtilをモック化（必要に応じて実際の実装を使用）
jest.mock('../../../../shared/utils/DateUtil');

describe('FirestorePathUtil', () => {
  const mockDateUtil = DateUtil as jest.Mocked<typeof DateUtil>;

  beforeEach(() => {
    jest.clearAllMocks();
    // モックのリセット
    jest.resetAllMocks();
  });

  describe('getFirestorePath', () => {
    test('正常系: 2024年6月15日のFirestoreパスが正常に生成されること', () => {
      const testDate = new Date('2024-06-15T10:30:00');
      
      // DateUtil.getDateInfoのモック設定
      const mockDateInfo = {
        date: testDate,
        year: 2024,
        month: 6,
        day: 15,
        term: 3,
        weekNumber: 3,
        timestamp: testDate.getTime(),
        weekStartDate: new Date('2024-06-09'),
        weekEndDate: new Date('2024-06-15'),
        isLastDayOfTerm: false,
        isLastDayOfMonth: false
      };
      
      mockDateUtil.getDateInfo.mockReturnValue(mockDateInfo);

      // 実行
      const result = FirestorePathUtil.getFirestorePath(testDate);

      // 検証
      expect(mockDateUtil.getDateInfo).toHaveBeenCalledWith(testDate);
      expect(result.year).toBe(2024);
      expect(result.month).toBe(6);
      expect(result.day).toBe(15);
      expect(result.term).toBe(3);
      expect(result.path).toMatch(/^details\/2024\/06\/term3\/15\/\d+$/);
      expect(result.weeklyReportPath).toBe('reports/weekly/2024-06/term3');
      expect(result.dailyReportPath).toBe('reports/daily/2024-06/15');
      expect(result.monthlyReportPath).toBe('reports/monthly/2024/06');
    });

    test('正常系: 2024年1月1日のFirestoreパスが正常に生成されること（1桁の月日）', () => {
      const testDate = new Date('2024-01-01T10:30:00');
      
      // DateUtil.getDateInfoのモック設定
      const mockDateInfo = {
        date: testDate,
        year: 2024,
        month: 1,
        day: 1,
        term: 1,
        weekNumber: 1,
        timestamp: testDate.getTime(),
        weekStartDate: new Date('2024-01-01'),
        weekEndDate: new Date('2024-01-06'),
        isLastDayOfTerm: false,
        isLastDayOfMonth: false
      };
      
      mockDateUtil.getDateInfo.mockReturnValue(mockDateInfo);

      // 実行
      const result = FirestorePathUtil.getFirestorePath(testDate);

      // 検証 - 月と日が2桁でフォーマットされることを確認
      expect(result.path).toMatch(/^details\/2024\/01\/term1\/1\/\d+$/);
      expect(result.weeklyReportPath).toBe('reports/weekly/2024-01/term1');
      expect(result.dailyReportPath).toBe('reports/daily/2024-01/01');
      expect(result.monthlyReportPath).toBe('reports/monthly/2024/01');
    });

    test('正常系: 2024年12月31日のFirestoreパスが正常に生成されること', () => {
      const testDate = new Date('2024-12-31T23:59:59');
      
      // DateUtil.getDateInfoのモック設定
      const mockDateInfo = {
        date: testDate,
        year: 2024,
        month: 12,
        day: 31,
        term: 5,
        weekNumber: 5,
        timestamp: testDate.getTime(),
        weekStartDate: new Date('2024-12-29'),
        weekEndDate: new Date('2024-12-31'),
        isLastDayOfTerm: true,
        isLastDayOfMonth: true
      };
      
      mockDateUtil.getDateInfo.mockReturnValue(mockDateInfo);

      // 実行
      const result = FirestorePathUtil.getFirestorePath(testDate);

      // 検証
      expect(result.path).toMatch(/^details\/2024\/12\/term5\/31\/\d+$/);
      expect(result.weeklyReportPath).toBe('reports/weekly/2024-12/term5');
      expect(result.dailyReportPath).toBe('reports/daily/2024-12/31');
      expect(result.monthlyReportPath).toBe('reports/monthly/2024/12');
      expect(result.isLastDayOfTerm).toBe(true);
      expect(result.isLastDayOfMonth).toBe(true);
    });

    test('正常系: タイムスタンプがpathに含まれることを確認', () => {
      const testDate = new Date('2024-06-15T10:30:00');
      const fixedTimestamp = 1718441400000; // 固定値
      
      // 現在時刻をモック化
      const mockNow = jest.spyOn(Date.prototype, 'getTime').mockReturnValue(fixedTimestamp);
      
      // DateUtil.getDateInfoのモック設定
      const mockDateInfo = {
        date: testDate,
        year: 2024,
        month: 6,
        day: 15,
        term: 3,
        weekNumber: 3,
        timestamp: testDate.getTime(),
        weekStartDate: new Date('2024-06-09'),
        weekEndDate: new Date('2024-06-15'),
        isLastDayOfTerm: false,
        isLastDayOfMonth: false
      };
      
      mockDateUtil.getDateInfo.mockReturnValue(mockDateInfo);

      // 実行
      const result = FirestorePathUtil.getFirestorePath(testDate);

      // 検証
      expect(result.path).toBe(`details/2024/06/term3/15/${fixedTimestamp}`);
      
      // モックをクリーンアップ
      mockNow.mockRestore();
    });

    test('正常系: 複数の週番号（term）でのパス生成を確認', () => {
      const testCases = [
        { term: 1, expected: 'term1' },
        { term: 2, expected: 'term2' },
        { term: 3, expected: 'term3' },
        { term: 4, expected: 'term4' },
        { term: 5, expected: 'term5' }
      ];

      testCases.forEach(({ term, expected }) => {
        const testDate = new Date('2024-06-15T10:30:00');
        
        // DateUtil.getDateInfoのモック設定
        const mockDateInfo = {
          date: testDate,
          year: 2024,
          month: 6,
          day: 15,
          term,
          weekNumber: term,
          timestamp: testDate.getTime(),
          weekStartDate: new Date('2024-06-09'),
          weekEndDate: new Date('2024-06-15'),
          isLastDayOfTerm: false,
          isLastDayOfMonth: false
        };
        
        mockDateUtil.getDateInfo.mockReturnValue(mockDateInfo);

        // 実行
        const result = FirestorePathUtil.getFirestorePath(testDate);

        // 検証
        expect(result.path).toContain(expected);
        expect(result.weeklyReportPath).toContain(expected);
      });
    });

    test('正常系: 返り値にDateUtilの全ての情報が含まれることを確認', () => {
      const testDate = new Date('2024-06-15T10:30:00');
      
      // DateUtil.getDateInfoのモック設定
      const mockDateInfo = {
        date: testDate,
        year: 2024,
        month: 6,
        day: 15,
        weekNumber: 3,
        term: 3,
        weekStartDate: new Date('2024-06-09'),
        weekEndDate: new Date('2024-06-15'),
        timestamp: testDate.getTime(),
        isLastDayOfTerm: false,
        isLastDayOfMonth: false
      };
      
      mockDateUtil.getDateInfo.mockReturnValue(mockDateInfo);

      // 実行
      const result = FirestorePathUtil.getFirestorePath(testDate);

      // 検証 - DateUtilの全ての情報が含まれることを確認
      expect(result).toEqual(expect.objectContaining(mockDateInfo));
      
      // 追加されたパス情報も含まれることを確認
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('weeklyReportPath');
      expect(result).toHaveProperty('dailyReportPath');
      expect(result).toHaveProperty('monthlyReportPath');
    });

    test('正常系: レポートパスの形式が正しいことを確認', () => {
      const testDate = new Date('2024-06-15T10:30:00');
      
      // DateUtil.getDateInfoのモック設定
      const mockDateInfo = {
        date: testDate,
        year: 2024,
        month: 6,
        day: 15,
        term: 3,
        weekNumber: 3,
        timestamp: testDate.getTime(),
        weekStartDate: new Date('2024-06-09'),
        weekEndDate: new Date('2024-06-15'),
        isLastDayOfTerm: false,
        isLastDayOfMonth: false
      };
      
      mockDateUtil.getDateInfo.mockReturnValue(mockDateInfo);

      // 実行
      const result = FirestorePathUtil.getFirestorePath(testDate);

      // 検証 - レポートパスの形式
      expect(result.weeklyReportPath).toMatch(/^reports\/weekly\/\d{4}-\d{2}\/term\d+$/);
      expect(result.dailyReportPath).toMatch(/^reports\/daily\/\d{4}-\d{2}\/\d{2}$/);
      expect(result.monthlyReportPath).toMatch(/^reports\/monthly\/\d{4}\/\d{2}$/);
    });

    test('正常系: 月の境界値でのパス生成（1月と12月）', () => {
      const testCases = [
        {
          date: new Date('2024-01-15T10:30:00'),
          expectedMonth: '01',
          expectedMonthPath: '01'
        },
        {
          date: new Date('2024-12-15T10:30:00'),
          expectedMonth: '12',
          expectedMonthPath: '12'
        }
      ];

      testCases.forEach(({ date, expectedMonth, expectedMonthPath }) => {
        // DateUtil.getDateInfoのモック設定
        const mockDateInfo = {
          date: date,
          year: 2024,
          month: parseInt(expectedMonth),
          day: 15,
          term: 3,
          weekNumber: 3,
          timestamp: date.getTime(),
          weekStartDate: new Date(date.getTime() - 6 * 24 * 60 * 60 * 1000),
          weekEndDate: date,
          isLastDayOfTerm: false,
          isLastDayOfMonth: false
        };
        
        mockDateUtil.getDateInfo.mockReturnValue(mockDateInfo);

        // 実行
        const result = FirestorePathUtil.getFirestorePath(date);

        // 検証
        expect(result.path).toContain(`2024/${expectedMonth}/`);
        expect(result.weeklyReportPath).toContain(`2024-${expectedMonth}/`);
        expect(result.dailyReportPath).toContain(`2024-${expectedMonth}/`);
        expect(result.monthlyReportPath).toContain(`2024/${expectedMonthPath}`);
      });
    });
  });
});
