import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import { FirestoreCardUsageRepository } from '../../../../src/infrastructure/database/repositories/FirestoreCardUsageRepository';
import { CardUsage } from '../../../../shared/domain/entities/CardUsage';
import { FirestoreService } from '../../../../shared/infrastructure/database/FirestoreService';
import { DateUtil } from '../../../../shared/utils/DateUtil';
import { Environment } from '../../../../shared/infrastructure/config/Environment';
import { CardUsageMapper } from '../../../../shared/infrastructure/mappers/CardUsageMapper';
import { AppError } from '../../../../shared/errors/AppError';
import { FirestorePathUtil } from '../../../../shared/utils/FirestorePathUtil';

// モック
jest.mock('../../../../shared/infrastructure/database/FirestoreService');
jest.mock('../../../../shared/infrastructure/config/Environment');
jest.mock('../../../../shared/utils/DateUtil');
jest.mock('../../../../shared/infrastructure/mappers/CardUsageMapper');
jest.mock('firebase-admin/firestore');

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

describe('FirestoreCardUsageRepository', () => {
  let firestoreCardUsageRepository: FirestoreCardUsageRepository;
  let mockFirestoreService: jest.Mocked<FirestoreService>;

  // テスト用データ
  const testDate = new Date('2025-05-10T15:30:00');
  const testTimestamp = admin.firestore.Timestamp.fromDate(testDate);
  const testMockTimestamp = 1715350200000; // 2025-05-10T15:30:00のタイムスタンプ値

  const testCardUsage: CardUsage = {
    card_name: 'テストカード',
    datetime_of_use: testTimestamp,
    amount: 1500,
    where_to_use: 'テスト店舗',
    is_active: true,
    created_at: testTimestamp
  };

  const testPathInfo = {
    path: `details/2025/05/term2/10/${testMockTimestamp}`,
    weeklyReportPath: 'reports/weekly/2025-05/term2',
    dailyReportPath: 'reports/daily/2025-05/10',
    monthlyReportPath: 'reports/monthly/2025/05'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // FirestoreServiceのモック
    mockFirestoreService = {
      getInstance: jest.fn().mockReturnThis(),
      setCloudFunctions: jest.fn(),
      initialize: jest.fn().mockResolvedValue({} as Firestore),
      saveDocument: jest.fn().mockResolvedValue({}),
      getDocument: jest.fn()
    } as unknown as jest.Mocked<FirestoreService>;

    // FirestoreServiceのgetInstanceメソッドをモック
    (FirestoreService.getInstance as jest.Mock).mockReturnValue(mockFirestoreService);

    // Environmentのモック
    (Environment.getFirebaseAdminKeyPath as jest.Mock).mockReturnValue('/path/to/key.json');
    (Environment.isCloudFunctions as jest.Mock).mockReturnValue(false);

    // CardUsageMapperのtoNotificationメソッドをモック
    (CardUsageMapper.toNotification as jest.Mock).mockReturnValue({
      card_name: testCardUsage.card_name,
      datetime_of_use: testDate.toISOString(),
      amount: testCardUsage.amount,
      where_to_use: testCardUsage.where_to_use,
      memo: '',
      is_active: true
    });

    // DateUtilのモック化（getDateInfo関数の戻り値を設定）
    const mockDateInfo = {
      date: new Date(2025, 4, 10), // 5月10日
      year: 2025,
      month: 5,
      day: 10,
      weekNumber: 2,
      term: 2,
      weekStartDate: new Date(2025, 4, 4),
      weekEndDate: new Date(2025, 4, 10),
      timestamp: testMockTimestamp,
      isLastDayOfTerm: false,
      isLastDayOfMonth: false
    };

    // DateUtil.getDateInfoのモック実装を設定
    (DateUtil.getDateInfo as jest.Mock).mockReturnValue(mockDateInfo);

    // getFirestorePathメソッドのモックを追加
    jest.spyOn(FirestorePathUtil, 'getFirestorePath').mockImplementation(() => {
      return {
        // testPathInfoの既存のプロパティ
        path: testPathInfo.path,
        weeklyReportPath: testPathInfo.weeklyReportPath,
        dailyReportPath: testPathInfo.dailyReportPath,
        monthlyReportPath: testPathInfo.monthlyReportPath,
        // DateUtilのmockDateInfoから追加が必要なプロパティ
        date: mockDateInfo.date,
        year: mockDateInfo.year,
        month: mockDateInfo.month,
        day: mockDateInfo.day,
        weekNumber: mockDateInfo.weekNumber,
        term: mockDateInfo.term,
        weekStartDate: mockDateInfo.weekStartDate,
        weekEndDate: mockDateInfo.weekEndDate,
        timestamp: mockDateInfo.timestamp,
        isLastDayOfTerm: mockDateInfo.isLastDayOfTerm,
        isLastDayOfMonth: mockDateInfo.isLastDayOfMonth
      };
    });

    // FirestoreCardUsageRepositoryのインスタンスを作成
    firestoreCardUsageRepository = new FirestoreCardUsageRepository();
  });

  describe('initialize', () => {
    test('正常系: Firestoreへの接続が初期化されること', async () => {
      // 初期化を実行
      await firestoreCardUsageRepository.initialize();

      // Environmentから設定が取得されることを確認
      expect(Environment.getFirebaseAdminKeyPath).toHaveBeenCalled();
      expect(Environment.isCloudFunctions).toHaveBeenCalled();

      // FirestoreServiceの初期化が呼ばれることを確認
      expect(mockFirestoreService.setCloudFunctions).toHaveBeenCalledWith(false);
      expect(mockFirestoreService.initialize).toHaveBeenCalledWith('/path/to/key.json');
    });

    test('異常系: 初期化中にエラーが発生した場合、AppErrorがスローされること', async () => {
      // FirestoreServiceのinitializeがエラーをスロー
      mockFirestoreService.initialize.mockRejectedValueOnce(new Error('初期化エラー'));

      // エラーがスローされることを確認
      await expect(firestoreCardUsageRepository.initialize()).rejects.toThrow(AppError);
    });
  });

  describe('getFirestorePathFromDate', () => {
    test('正常系: 日付からFirestoreのパスが正しく生成されること', () => {
      // スパイを元に戻す（このテストでは実際の実装を使用するため）
      jest.spyOn(FirestorePathUtil, 'getFirestorePath').mockRestore();

      // Date.nowをモック化してタイムスタンプを固定
      const originalNow = Date.now;
      Date.now = jest.fn().mockReturnValue(testMockTimestamp);

      try {
        const sampleDate = new Date('2025-05-10T15:30:00');
        const result = FirestorePathUtil.getFirestorePath(sampleDate);

        // タイムスタンプ部分以外の構造を検証
        expect(result.path).toMatch(`details/2025/05/term2/10/`);
        // pathが数値で終わることを確認（タイムスタンプ部分）
        expect(result.path.match(/\/\d+$/)).toBeTruthy();

        expect(result.weeklyReportPath).toBe('reports/weekly/2025-05/term2');
        expect(result.dailyReportPath).toBe('reports/daily/2025-05/10');
        expect(result.monthlyReportPath).toBe('reports/monthly/2025/05');
      } finally {
        // モックをクリーンアップ
        Date.now = originalNow;
      }
    });
  });

  describe('save', () => {
    test('正常系: カード利用情報がFirestoreに保存されること', async () => {
      // 保存を実行
      const result = await firestoreCardUsageRepository.save(testCardUsage);

      // FirestoreServiceのメソッドが呼ばれることを確認
      expect(mockFirestoreService.saveDocument).toHaveBeenCalledWith(
        testPathInfo.path,
        expect.objectContaining({
          ...testCardUsage,
          memo: '' // デフォルト値が設定される
        })
      );

      // 保存パスが返されることを確認
      expect(result).toBe(testPathInfo.path);
    });

    test('memoが未定義の場合、空文字列がデフォルト値として設定されること', async () => {
      // memoフィールドがないカード利用情報
      const cardUsageWithoutMemo: CardUsage = { ...testCardUsage };
      delete cardUsageWithoutMemo.memo;

      // 保存を実行
      await firestoreCardUsageRepository.save(cardUsageWithoutMemo);

      // FirestoreServiceのsaveDocumentが正しいデータで呼ばれることを確認
      expect(mockFirestoreService.saveDocument).toHaveBeenCalledWith(
        testPathInfo.path,
        expect.objectContaining({
          memo: '' // デフォルト値
        })
      );
    });

    test('is_activeが未定義の場合、trueがデフォルト値として設定されること', async () => {
      // is_activeフィールドがないカード利用情報
      const cardUsageWithoutIsActive: CardUsage = { ...testCardUsage };
      delete cardUsageWithoutIsActive.is_active;

      // 保存を実行
      await firestoreCardUsageRepository.save(cardUsageWithoutIsActive);

      // FirestoreServiceのsaveDocumentが正しいデータで呼ばれることを確認
      expect(mockFirestoreService.saveDocument).toHaveBeenCalledWith(
        testPathInfo.path,
        expect.objectContaining({
          is_active: true // デフォルト値
        })
      );
    });

    test('異常系: 保存中にエラーが発生した場合、AppErrorがスローされること', async () => {
      // saveDocumentでエラーが発生する場合
      mockFirestoreService.saveDocument.mockRejectedValueOnce(new Error('保存エラー'));

      // エラーがスローされることを確認
      await expect(firestoreCardUsageRepository.save(testCardUsage)).rejects.toThrow(AppError);
    });
  });

  describe('getByTimestamp', () => {
    test('正常系: タイムスタンプからカード利用情報が取得できること', async () => {
      // getDocumentの戻り値を設定
      mockFirestoreService.getDocument.mockResolvedValueOnce(testCardUsage);

      // タイムスタンプから取得を実行
      const result = await firestoreCardUsageRepository.getByTimestamp('1715350200000'); // 2025-05-10T15:30:00

      // FirestoreServiceのgetDocumentが呼ばれることを確認
      expect(mockFirestoreService.getDocument).toHaveBeenCalledWith(testPathInfo.path);

      // 結果が正しいことを確認
      expect(result).toEqual(testCardUsage);
    });

    test('正常系: 存在しないタイムスタンプの場合、nullが返されること', async () => {
      // getDocumentがnullを返す場合
      mockFirestoreService.getDocument.mockResolvedValueOnce(null);

      // タイムスタンプから取得を実行
      const result = await firestoreCardUsageRepository.getByTimestamp('1715350200000');

      // 結果がnullであることを確認
      expect(result).toBeNull();
    });

    test('異常系: 取得中にエラーが発生した場合、AppErrorがスローされること', async () => {
      // getDocumentでエラーが発生する場合
      mockFirestoreService.getDocument.mockRejectedValueOnce(new Error('取得エラー'));

      // エラーがスローされることを確認
      await expect(firestoreCardUsageRepository.getByTimestamp('1715350200000')).rejects.toThrow(AppError);
    });
  });
});
