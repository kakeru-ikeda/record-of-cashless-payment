import * as path from 'path';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  setupFirestoreMock,
  teardownFirestoreMock,
  createMockCardUsage,
  getMockDocument,
  mockTimestamp,
  setupMockFileSystem
} from '../../../helpers/FirestoreTestHelper';
import { FirestoreCardUsageRepository } from '../../../../src/infrastructure/firebase/FirestoreCardUsageRepository';
import { Environment } from '../../../../src/infrastructure/config/environment';
import { CardUsage } from '../../../../src/domain/entities/CardUsage';

// モック設定
// jest.mock('firebase-admin');
jest.mock('../../../../src/infrastructure/config/environment', () => ({
  Environment: {
    FIREBASE_ADMIN_KEY_PATH: path.resolve(__dirname, '../../../../firebase-admin-key.json'),
  }
}));

describe('FirestoreCardUsageRepository', () => {
  let repository: FirestoreCardUsageRepository;
  const validConfigContent = JSON.stringify({
    type: 'service_account',
    project_id: 'test-project',
    private_key_id: 'abc123',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7VJTUt9Us8cKj\nMzEfYyjiWA4R4/M2bS1GB4t7NXp98C3SC6dVMvDuictGeurT8jNbvJZHtCSuYEvu\nNMoSfm76oqFvAp8Gy0iz5sxjZmSnXyCdPEovGhLa0VzMaQ8s+CLOyS56YyCFGeJZ\n-----END PRIVATE KEY-----\n',
    client_email: 'firebase-adminsdk@test-project.iam.gserviceaccount.com',
    client_id: '123456789',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk%40test-project.iam.gserviceaccount.com'
  });

  beforeEach(() => {
    // Firestoreモックの設定
    setupFirestoreMock();

    // リポジトリの作成
    repository = new FirestoreCardUsageRepository();
  });

  afterEach(() => {
    // モックのクリーンアップ
    teardownFirestoreMock();
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('initialize', () => {
    test('正常系: 正しく初期化される', async () => {
      // モックファイルシステムのセットアップ
      setupMockFileSystem({
        [Environment.FIREBASE_ADMIN_KEY_PATH]: validConfigContent
      });

      // 実行
      const db = await repository.initialize();

      // 検証
      expect(db).not.toBeNull();
    });

    test('異常系: 設定ファイルが存在しない場合、エラーが発生する', async () => {
      // モックファイルシステムのセットアップ (ファイルが存在しない)
      setupMockFileSystem({});

      // 実行と検証
      await expect(repository.initialize()).rejects.toThrow();
    });

    test('異常系: 設定ファイルの内容が不正な場合、エラーが発生する', async () => {
      // モックファイルシステムのセットアップ (不正なJSON)
      setupMockFileSystem({
        [Environment.FIREBASE_ADMIN_KEY_PATH]: '{invalid json}'
      });

      // 実行と検証
      await expect(repository.initialize()).rejects.toThrow();
    });

    test('正常系: インスタンスが既に初期化されている場合、再初期化しない', async () => {
      // モックファイルシステムのセットアップ
      setupMockFileSystem({
        [Environment.FIREBASE_ADMIN_KEY_PATH]: validConfigContent
      });

      // 1回目の初期化
      const db1 = await repository.initialize();

      // 初期化関数の呼び出し回数をリセット
      jest.clearAllMocks();

      // 2回目の初期化
      const db2 = await repository.initialize();

      // 検証
      expect(db1).toBe(db2);
      expect(admin.initializeApp).not.toHaveBeenCalled();
      expect(admin.firestore).not.toHaveBeenCalled();
    });
  });

  describe('getFirestorePath', () => {
    test('正常系: 日付から正しいパスを生成する', () => {
      // テストデータ
      const testDate = new Date('2023-10-15T12:34:56Z');
      // 日付に基づくタイムスタンプをモック
      const mockCurrentTime = testDate.getTime();
      jest.spyOn(Date.prototype, 'getTime').mockReturnValue(mockCurrentTime);

      // 10月15日は日曜日 (2023年)、月初 (2023-10-01) は日曜日
      // よって、第3週 (term3) になる

      // 実行
      const result = FirestoreCardUsageRepository.getFirestorePath(testDate);

      // 検証
      expect(result.year).toBe('2023');
      expect(result.month).toBe('10');
      expect(result.term).toBe('term3');
      expect(result.day).toBe('15');
      expect(result.timestamp).toBe(mockCurrentTime.toString());
      expect(result.path).toBe(`details/2023/10/term3/15/${mockCurrentTime}`);
      expect(result.weekReportPath).toBe(`details/2023/10/term3`);
    });

    test('境界値: 月と日が1桁の場合に0パディングされる', () => {
      // テストデータ
      const testDate = new Date('2023-01-05T12:34:56Z');
      // 日付に基づくタイムスタンプをモック
      const mockCurrentTime = testDate.getTime();
      jest.spyOn(Date.prototype, 'getTime').mockReturnValue(mockCurrentTime);

      // 1月5日は木曜日 (2023年)、月初 (2023-01-01) は日曜日
      // よって、第1週 (term1) になる

      // 実行
      const result = FirestoreCardUsageRepository.getFirestorePath(testDate);

      // 検証
      expect(result.year).toBe('2023');
      expect(result.month).toBe('01');
      expect(result.term).toBe('term1');
      expect(result.day).toBe('05');
      expect(result.timestamp).toBe(mockCurrentTime.toString());
      expect(result.path).toBe(`details/2023/01/term1/05/${mockCurrentTime}`);
      expect(result.weekReportPath).toBe(`details/2023/01/term1`);
    });

    test('境界値: 月をまたいだ週の場合も正しく計算される', () => {
      // テストデータ - 5月をまたいだ週の6月1日
      const testDate = new Date('2023-06-01T12:34:56Z');
      const mockCurrentTime = testDate.getTime();
      jest.spyOn(Date.prototype, 'getTime').mockReturnValue(mockCurrentTime);

      // 6月1日は木曜日 (2023年)、月初 (2023-06-01) は木曜日
      // よって、第1週 (term1) になる

      // 実行
      const result = FirestoreCardUsageRepository.getFirestorePath(testDate);

      // 検証
      expect(result.term).toBe('term1');
      expect(result.path).toBe(`details/2023/06/term1/01/${mockCurrentTime}`);
    });
  });

  describe('save', () => {
    const setupInitializedRepository = async () => {
      setupMockFileSystem({
        [Environment.FIREBASE_ADMIN_KEY_PATH]: validConfigContent
      });
      await repository.initialize();
      return repository;
    };

    test('正常系: カード利用情報を正しく保存する', async () => {
      // リポジトリの初期化
      await setupInitializedRepository();

      // テストデータ
      const testDate = new Date('2023-05-20T14:30:00Z');
      const cardUsage = createMockCardUsage({
        card_name: 'テストカード',
        datetime_of_use: mockTimestamp(testDate),
        amount: 1500,
        where_to_use: 'テスト店舗',
        created_at: mockTimestamp(new Date())
      });

      // 日付に基づくタイムスタンプをモック
      const mockCurrentTime = new Date().getTime();
      jest.spyOn(Date.prototype, 'getTime').mockReturnValue(mockCurrentTime);

      // 5月20日は土曜日 (2023年)、月初 (2023-05-01) は月曜日
      // よって、第3週 (term3) になる

      // 実行
      const resultPath = await repository.save(cardUsage);

      // 検証
      const expectedPath = `details/2023/05/term3/20/${mockCurrentTime}`;
      expect(resultPath).toBe(expectedPath);

      // ドキュメントが正しく保存されているか確認
      const savedDoc = getMockDocument(expectedPath);
      expect(savedDoc).toBeDefined();
      expect(savedDoc.card_name).toBe('テストカード');
      expect(savedDoc.amount).toBe(1500);
      expect(savedDoc.where_to_use).toBe('テスト店舗');
    });

    test('異常系: Firestoreへの保存が失敗する場合、エラーが発生する', async () => {
      // リポジトリの初期化
      await setupInitializedRepository();

      // テストデータ
      const cardUsage = createMockCardUsage();

      // Firestoreモックがエラーを投げるように設定
      const mockFirestore = admin.firestore();
      const mockDoc = {
        set: jest.fn().mockRejectedValue(new Error('保存に失敗しました'))
      };
      (mockFirestore.doc as jest.Mock).mockReturnValue(mockDoc);

      // 実行と検証
      await expect(repository.save(cardUsage)).rejects.toThrow('保存に失敗しました');
    });
  });

  describe('getByTimestamp', () => {
    const setupInitializedRepository = async () => {
      setupMockFileSystem({
        [Environment.FIREBASE_ADMIN_KEY_PATH]: validConfigContent
      });
      await repository.initialize();
      return repository;
    };

    test('正常系: 存在するデータが正しく取得できる', async () => {
      // リポジトリの初期化
      await setupInitializedRepository();

      // テストデータ
      const testDate = new Date('2023-06-10T09:15:00Z');
      const timestamp = testDate.getTime().toString();
      const cardUsage = createMockCardUsage({
        card_name: 'テストカード2',
        datetime_of_use: mockTimestamp(testDate),
        amount: 2500,
        where_to_use: 'テスト店舗2',
        created_at: mockTimestamp(new Date())
      });

      // データを事前に保存
      await repository.save(cardUsage);

      // 実行
      const result = await repository.getByTimestamp(timestamp);

      // 検証
      expect(result).not.toBeNull();
      expect(result?.card_name).toBe('テストカード2');
      expect(result?.amount).toBe(2500);
      expect(result?.where_to_use).toBe('テスト店舗2');
    });

    test('正常系: 存在しないデータはnullが返される', async () => {
      // リポジトリの初期化
      await setupInitializedRepository();

      // 存在しないタイムスタンプ
      const timestamp = '1672531200000'; // 2023-01-01

      // 実行
      const result = await repository.getByTimestamp(timestamp);

      // 検証
      expect(result).toBeNull();
    });

    test('異常系: Firestoreからの取得が失敗する場合、エラーが発生する', async () => {
      // リポジトリの初期化
      await setupInitializedRepository();

      // テストデータ
      const timestamp = '1686391200000'; // 2023-06-10

      // Firestoreモックがエラーを投げるように設定
      const mockFirestore = admin.firestore();
      const mockDoc = {
        get: jest.fn().mockRejectedValue(new Error('取得に失敗しました'))
      };
      (mockFirestore.doc as jest.Mock).mockReturnValue(mockDoc);

      // 実行と検証
      await expect(repository.getByTimestamp(timestamp)).rejects.toThrow('取得に失敗しました');
    });
  });
});

