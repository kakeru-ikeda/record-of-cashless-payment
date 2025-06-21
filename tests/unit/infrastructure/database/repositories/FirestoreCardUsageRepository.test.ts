import { Firestore } from 'firebase-admin/firestore';
import { FirestoreCardUsageRepository } from '../../../../../src/infrastructure/database/repositories/FirestoreCardUsageRepository';
import { CardUsage } from '../../../../../shared/domain/entities/CardUsage';
import { FirestoreService } from '../../../../../shared/infrastructure/database/FirestoreService';
import { Environment } from '../../../../../shared/infrastructure/config/Environment';
import { FirestorePathUtil } from '../../../../../shared/utils/FirestorePathUtil';
import { AppError } from '../../../../../shared/errors/AppError';
import * as admin from 'firebase-admin';

// モック
jest.mock('../../../../../shared/infrastructure/database/FirestoreService');
jest.mock('../../../../../shared/infrastructure/config/Environment');
jest.mock('../../../../../shared/utils/FirestorePathUtil');

// Loggerをモック化
jest.mock('../../../../../shared/infrastructure/logging/Logger', () => ({
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
  let repository: FirestoreCardUsageRepository;
  let mockFirestoreService: jest.Mocked<FirestoreService>;
  let mockDb: any;

  // テスト用データ
  const testDate = new Date('2024-06-15T10:30:00');
  const testTimestamp = admin.firestore.Timestamp.fromDate(testDate);

  const testCardUsage: CardUsage = {
    card_name: 'テストカード',
    datetime_of_use: testTimestamp,
    amount: 1500,
    where_to_use: 'テスト店舗',
    memo: 'テストメモ',
    is_active: true,
    created_at: testTimestamp
  };

  const testPathInfo = {
    path: 'details/2024/06/term3/15/1718445000000',
    weeklyReportPath: 'reports/weekly/2024-06/term3',
    dailyReportPath: 'reports/daily/2024-06/15',
    monthlyReportPath: 'reports/monthly/2024/06'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Firestore DB
    mockDb = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn(),
      listDocuments: jest.fn(),
      listCollections: jest.fn()
    };

    // FirestoreServiceのモック
    mockFirestoreService = {
      getInstance: jest.fn().mockReturnThis(),
      setCloudFunctions: jest.fn(),
      initialize: jest.fn().mockResolvedValue({} as Firestore),
      saveDocument: jest.fn().mockResolvedValue({}),
      getDocument: jest.fn(),
      updateDocument: jest.fn().mockResolvedValue({}),
      getDb: jest.fn().mockResolvedValue(mockDb)
    } as unknown as jest.Mocked<FirestoreService>;

    // FirestoreServiceのgetInstanceメソッドをモック
    (FirestoreService.getInstance as jest.Mock).mockReturnValue(mockFirestoreService);

    // Environmentのモック
    (Environment.getFirebaseAdminKeyPath as jest.Mock).mockReturnValue('/path/to/key.json');
    (Environment.isCloudFunctions as jest.Mock).mockReturnValue(false);

    // FirestorePathUtilのモック
    (FirestorePathUtil.getFirestorePath as jest.Mock).mockReturnValue(testPathInfo);

    repository = new FirestoreCardUsageRepository();
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

    test('異常系: 初期化中にエラーが発生した場合、AppErrorがスローされること', async () => {
      mockFirestoreService.initialize.mockRejectedValueOnce(new Error('初期化エラー'));

      await expect(repository.initialize()).rejects.toThrow();
    });
  });

  describe('save', () => {
    test('正常系: カード利用情報がFirestoreに保存されること', async () => {
      const result = await repository.save(testCardUsage);

      expect(mockFirestoreService.saveDocument).toHaveBeenCalledWith(
        testPathInfo.path,
        expect.objectContaining({
          ...testCardUsage,
          memo: testCardUsage.memo,
          is_active: true
        })
      );
      expect(result).toBe(testPathInfo.path);
    });

    test('memoが未定義の場合、空文字列がデフォルト値として設定されること', async () => {
      const cardUsageWithoutMemo = { ...testCardUsage };
      delete cardUsageWithoutMemo.memo;

      await repository.save(cardUsageWithoutMemo);

      expect(mockFirestoreService.saveDocument).toHaveBeenCalledWith(
        testPathInfo.path,
        expect.objectContaining({
          memo: ''
        })
      );
    });

    test('is_activeが未定義の場合、trueがデフォルト値として設定されること', async () => {
      const cardUsageWithoutIsActive = { ...testCardUsage };
      delete cardUsageWithoutIsActive.is_active;

      await repository.save(cardUsageWithoutIsActive);

      expect(mockFirestoreService.saveDocument).toHaveBeenCalledWith(
        testPathInfo.path,
        expect.objectContaining({
          is_active: true
        })
      );
    });

    test('異常系: 保存中にエラーが発生した場合、エラーがスローされること', async () => {
      mockFirestoreService.saveDocument.mockRejectedValueOnce(new Error('保存エラー'));

      await expect(repository.save(testCardUsage)).rejects.toThrow();
    });
  });

  describe('getByTimestamp', () => {
    test('正常系: タイムスタンプからカード利用情報が取得できること', async () => {
      mockFirestoreService.getDocument.mockResolvedValueOnce(testCardUsage);

      const result = await repository.getByTimestamp('1718445000000');

      expect(mockFirestoreService.getDocument).toHaveBeenCalledWith(testPathInfo.path);
      expect(result).toEqual(testCardUsage);
    });

    test('正常系: 存在しないタイムスタンプの場合、nullが返されること', async () => {
      mockFirestoreService.getDocument.mockResolvedValueOnce(null);

      const result = await repository.getByTimestamp('1718445000000');

      expect(result).toBeNull();
    });

    test('異常系: 取得中にエラーが発生した場合、エラーがスローされること', async () => {
      mockFirestoreService.getDocument.mockRejectedValueOnce(new Error('取得エラー'));

      await expect(repository.getByTimestamp('1718445000000')).rejects.toThrow();
    });
  });

  describe('getById', () => {
    test('正常系: IDによるカード利用情報の取得が成功すること', async () => {
      const testId = 'test-id';

      // Mock database structure for search through multiple months
      const mockTermDoc = {
        id: 'term3',
        listCollections: jest.fn().mockResolvedValue([
          {
            id: '15',
            doc: jest.fn().mockImplementation((id: string) => {
              if (id === testId) {
                return {
                  get: jest.fn().mockResolvedValue({
                    exists: true,
                    data: () => testCardUsage
                  })
                };
              }
              return {
                get: jest.fn().mockResolvedValue({ exists: false })
              };
            })
          }
        ])
      };

      const mockYearDoc = {
        collection: jest.fn().mockImplementation((month: string) => ({
          listDocuments: jest.fn().mockResolvedValue([mockTermDoc])
        }))
      };

      mockDb.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(mockYearDoc)
      });

      const result = await repository.getById(testId);

      expect(result).toEqual({
        ...testCardUsage,
        id: testId,
        path: expect.stringContaining(`/${testId}`)
      });
    });

    test('正常系: 存在しないIDの場合、nullが返されること', async () => {
      const testId = 'non-existent-id';

      // Mock empty results for all searches
      const mockTermDoc = {
        id: 'term3',
        listCollections: jest.fn().mockResolvedValue([
          {
            id: '15',
            doc: jest.fn().mockImplementation((id: string) => ({
              get: jest.fn().mockResolvedValue({ exists: false })
            }))
          }
        ])
      };

      const mockYearDoc = {
        collection: jest.fn().mockImplementation(() => ({
          listDocuments: jest.fn().mockResolvedValue([mockTermDoc])
        }))
      };

      mockDb.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(mockYearDoc)
      });

      const result = await repository.getById(testId);

      expect(result).toBeNull();
    });
  });

  describe('getByYearMonth', () => {
    test('正常系: 指定された年月のカード利用情報が取得できること', async () => {
      const year = '2024';
      const month = '6';
      const testId = 'test-timestamp';

      // Mock database structure
      const mockTermDoc = {
        id: 'term3',
        listCollections: jest.fn().mockResolvedValue([
          {
            id: '15',
            listDocuments: jest.fn().mockResolvedValue([
              {
                id: testId,
                get: jest.fn().mockResolvedValue({
                  exists: true,
                  data: () => testCardUsage
                })
              }
            ])
          }
        ])
      };

      const mockYearDoc = {
        collection: jest.fn().mockImplementation((monthParam: string) => ({
          listDocuments: jest.fn().mockResolvedValue([mockTermDoc])
        }))
      };

      mockDb.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(mockYearDoc)
      });

      const result = await repository.getByYearMonth(year, month);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...testCardUsage,
        id: testId,
        path: expect.stringContaining(`/${testId}`)
      });
    });

    test('正常系: データが存在しない年月の場合、空配列が返されること', async () => {
      const year = '2024';
      const month = '12';

      // Mock empty results
      const mockYearDoc = {
        collection: jest.fn().mockImplementation(() => ({
          listDocuments: jest.fn().mockResolvedValue([])
        }))
      };

      mockDb.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(mockYearDoc)
      });

      const result = await repository.getByYearMonth(year, month);

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    test('正常系: カード利用情報の更新が成功すること', async () => {
      const testId = 'test-id';
      const updateData = { amount: 2000, memo: '更新されたメモ' };
      const existingData = {
        ...testCardUsage,
        id: testId,
        path: 'details/2024/06/term3/15/test-id'
      };
      const updatedCardUsage = { ...testCardUsage, ...updateData };

      // Mock getById to return existing data
      jest.spyOn(repository, 'getById').mockResolvedValueOnce(existingData);
      mockFirestoreService.getDocument.mockResolvedValueOnce(updatedCardUsage);

      const result = await repository.update(testId, updateData);

      expect(mockFirestoreService.updateDocument).toHaveBeenCalledWith(
        existingData.path,
        updateData
      );
      expect(result).toEqual({
        ...updatedCardUsage,
        id: testId,
        path: existingData.path
      });
    });

    test('正常系: 存在しないIDの場合、nullが返されること', async () => {
      const testId = 'non-existent-id';
      const updateData = { amount: 2000 };

      // Mock getById to return null
      jest.spyOn(repository, 'getById').mockResolvedValueOnce(null);

      const result = await repository.update(testId, updateData);

      expect(result).toBeNull();
      expect(mockFirestoreService.updateDocument).not.toHaveBeenCalled();
    });

    test('異常系: 更新中にエラーが発生した場合、エラーがスローされること', async () => {
      const testId = 'test-id';
      const updateData = { amount: 2000 };
      const existingData = {
        ...testCardUsage,
        id: testId,
        path: 'details/2024/06/term3/15/test-id'
      };

      jest.spyOn(repository, 'getById').mockResolvedValueOnce(existingData);
      mockFirestoreService.updateDocument.mockRejectedValueOnce(new Error('更新エラー'));

      await expect(repository.update(testId, updateData)).rejects.toThrow();
    });
  });

  describe('delete', () => {
    test('正常系: カード利用情報の論理削除が成功すること', async () => {
      const testId = 'test-id';
      const existingData = {
        ...testCardUsage,
        id: testId,
        path: 'details/2024/06/term3/15/test-id'
      };

      // Mock getById to return existing data
      jest.spyOn(repository, 'getById').mockResolvedValueOnce(existingData);

      const result = await repository.delete(testId);

      expect(mockFirestoreService.updateDocument).toHaveBeenCalledWith(
        existingData.path,
        { is_active: false }
      );
      expect(result).toEqual({
        id: testId,
        path: existingData.path
      });
    });

    test('正常系: 存在しないIDの場合、nullが返されること', async () => {
      const testId = 'non-existent-id';

      // Mock getById to return null
      jest.spyOn(repository, 'getById').mockResolvedValueOnce(null);

      const result = await repository.delete(testId);

      expect(result).toBeNull();
      expect(mockFirestoreService.updateDocument).not.toHaveBeenCalled();
    });

    test('異常系: 削除中にエラーが発生した場合、エラーがスローされること', async () => {
      const testId = 'test-id';
      const existingData = {
        ...testCardUsage,
        id: testId,
        path: 'details/2024/06/term3/15/test-id'
      };

      jest.spyOn(repository, 'getById').mockResolvedValueOnce(existingData);
      mockFirestoreService.updateDocument.mockRejectedValueOnce(new Error('削除エラー'));

      await expect(repository.delete(testId)).rejects.toThrow();
    });
  });
});
