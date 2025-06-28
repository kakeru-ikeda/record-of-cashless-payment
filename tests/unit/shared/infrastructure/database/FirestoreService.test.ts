import * as admin from 'firebase-admin';
import * as fs from 'fs';
import { FirestoreService } from '../../../../../shared/infrastructure/database/FirestoreService';
import { AppError } from '../../../../../shared/errors/AppError';
import { logger } from '../../../../../shared/infrastructure/logging/Logger';

// firebase-adminのモック
const mockDoc = {
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined)
};

const mockCollection = {
    doc: jest.fn().mockReturnValue(mockDoc),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn()
};

const mockFirestore = {
    doc: jest.fn().mockReturnValue(mockDoc),
    collection: jest.fn().mockReturnValue(mockCollection)
};

jest.mock('firebase-admin', () => ({
    apps: [],
    initializeApp: jest.fn(),
    credential: {
        cert: jest.fn().mockReturnValue('mock-credential')
    },
    firestore: jest.fn().mockImplementation(() => mockFirestore)
}));

// fsのモック
jest.mock('fs', () => ({
    readFileSync: jest.fn()
}));

// Loggerをモック化
jest.mock('../../../../../shared/infrastructure/logging/Logger', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('FirestoreService', () => {
    let firestoreService: FirestoreService;

    beforeEach(() => {
        // FirestoreServiceのシングルトンインスタンスをリセット
        (FirestoreService as any).instance = undefined;

        // モックをリセット
        jest.clearAllMocks();

        // admin.appsを空にリセット
        (admin.apps as any).length = 0;

        // 静的メソッドのモック
        (admin.firestore as any).FieldValue = {
            serverTimestamp: jest.fn().mockReturnValue('server-timestamp')
        };
        (admin.firestore as any).Timestamp = {
            fromDate: jest.fn().mockImplementation((date: Date) => ({
                seconds: Math.floor(date.getTime() / 1000),
                nanoseconds: 0
            }))
        };

        // コンソールログをモック化
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'warn').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();

        firestoreService = FirestoreService.getInstance();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getInstance', () => {
        it('シングルトンパターンで同一インスタンスを返すこと', () => {
            const instance1 = FirestoreService.getInstance();
            const instance2 = FirestoreService.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('setCloudFunctions', () => {
        it('Cloud Functions環境フラグを設定できること', () => {
            firestoreService.setCloudFunctions(true);
            expect(firestoreService['_isCloudFunctions']).toBe(true);

            firestoreService.setCloudFunctions(false);
            expect(firestoreService['_isCloudFunctions']).toBe(false);
        });
    });

    describe('initialize', () => {
        describe('Cloud Functions環境', () => {
            beforeEach(() => {
                firestoreService.setCloudFunctions(true);
            });

            it('Cloud Functions環境でFirestoreを初期化できること', async () => {
                const result = await firestoreService.initialize();

                expect(admin.initializeApp).toHaveBeenCalledWith();
                expect(admin.firestore).toHaveBeenCalled();
                expect(result).toBe(mockFirestore);
                expect(logger.info).toHaveBeenCalledWith('Cloud Functions環境でFirestoreに接続しました', 'FirestoreService');
            });

            it('既に初期化済みの場合は既存のインスタンスを返すこと', async () => {
                // 最初の初期化
                await firestoreService.initialize();

                // モックをクリア
                jest.clearAllMocks();

                // 2回目の初期化
                const result = await firestoreService.initialize();

                expect(admin.initializeApp).not.toHaveBeenCalled();
                expect(result).toBe(mockFirestore);
            });
        });

        describe('ローカル環境', () => {
            const serviceAccountPath = '/path/to/service-account.json';
            const mockServiceAccount = {
                type: 'service_account',
                project_id: 'test-project'
            };

            beforeEach(() => {
                firestoreService.setCloudFunctions(false);
                (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockServiceAccount));
            });

            it('サービスアカウントキーでFirestoreを初期化できること', async () => {
                const result = await firestoreService.initialize(serviceAccountPath);

                expect(fs.readFileSync).toHaveBeenCalledWith(serviceAccountPath, 'utf8');
                expect(admin.credential.cert).toHaveBeenCalledWith(mockServiceAccount);
                expect(admin.initializeApp).toHaveBeenCalledWith({
                    credential: 'mock-credential'
                });
                expect(admin.firestore).toHaveBeenCalled();
                expect(result).toBe(mockFirestore);
                expect(logger.info).toHaveBeenCalledWith('ローカル環境でFirestoreに接続しました', 'FirestoreService');
            });

            it('サービスアカウントキーのパスが指定されていない場合はエラーを投げること', async () => {
                await expect(firestoreService.initialize()).rejects.toThrow(AppError);
                await expect(firestoreService.initialize()).rejects.toThrow('サービスアカウントキーのパスが指定されていません');
            });

            it('サービスアカウントキーの読み込みに失敗した場合はエラーを投げること', async () => {
                (fs.readFileSync as jest.Mock).mockImplementation(() => {
                    throw new Error('File not found');
                });

                await expect(firestoreService.initialize(serviceAccountPath)).rejects.toThrow(AppError);
                await expect(firestoreService.initialize(serviceAccountPath)).rejects.toThrow('サービスアカウントキーでの初期化に失敗しました');
            });
        });

        describe('既にFirebaseアプリが初期化済みの場合', () => {
            beforeEach(() => {
                // 既に初期化済みの状態をシミュレート
                (admin.apps as any).length = 1;
            });

            it('再初期化せずにFirestoreインスタンスを返すこと', async () => {
                const result = await firestoreService.initialize();

                expect(admin.initializeApp).not.toHaveBeenCalled();
                expect(admin.firestore).toHaveBeenCalled();
                expect(result).toBe(mockFirestore);
            });
        });
    });

    describe('getDb', () => {
        it('初期化済みの場合はFirestoreインスタンスを返すこと', async () => {
            // 初期化
            firestoreService.setCloudFunctions(true);
            await firestoreService.initialize();

            const result = await firestoreService.getDb();
            expect(result).toBe(mockFirestore);
        });

        it('未初期化の場合はエラーを投げること', async () => {
            await expect(firestoreService.getDb()).rejects.toThrow(AppError);
            await expect(firestoreService.getDb()).rejects.toThrow('Firestoreが初期化されていません。initialize()を先に呼び出してください。');
        });
    });

    describe('saveDocument', () => {
        beforeEach(async () => {
            firestoreService.setCloudFunctions(true);
            await firestoreService.initialize();
        });

        it('ドキュメントを保存できること', async () => {
            const path = 'users/user1';
            const data = { name: 'Test User', age: 30 };

            await firestoreService.saveDocument(path, data);

            expect(mockFirestore.doc).toHaveBeenCalledWith(path);
            expect(mockDoc.set).toHaveBeenCalledWith(data);
            expect(logger.info).toHaveBeenCalledWith('ドキュメントを保存しました: users/user1', 'FirestoreService');
        });

        it('保存エラーの場合はAppErrorを投げること', async () => {
            const path = 'users/user1';
            const data = { name: 'Test User' };
            const error = new Error('Firestore error');

            mockDoc.set.mockRejectedValue(error);

            await expect(firestoreService.saveDocument(path, data)).rejects.toThrow(AppError);
        });
    });

    describe('updateDocument', () => {
        beforeEach(async () => {
            firestoreService.setCloudFunctions(true);
            await firestoreService.initialize();
        });

        it('ドキュメントを更新できること', async () => {
            const path = 'users/user1';
            const data = { age: 31 };

            await firestoreService.updateDocument(path, data);

            expect(mockFirestore.doc).toHaveBeenCalledWith(path);
            expect(mockDoc.update).toHaveBeenCalledWith(data);
            expect(logger.info).toHaveBeenCalledWith('ドキュメントを更新しました: users/user1', 'FirestoreService');
        });

        it('更新エラーの場合はAppErrorを投げること', async () => {
            const path = 'users/user1';
            const data = { age: 31 };
            const error = new Error('Firestore error');

            mockDoc.update.mockRejectedValue(error);

            await expect(firestoreService.updateDocument(path, data)).rejects.toThrow(AppError);
        });
    });

    describe('getDocument', () => {
        beforeEach(async () => {
            firestoreService.setCloudFunctions(true);
            await firestoreService.initialize();
        });

        it('ドキュメントが存在する場合はデータを返すこと', async () => {
            const path = 'users/user1';
            const expectedData = { name: 'Test User', age: 30 };

            mockDoc.get.mockResolvedValue({
                exists: true,
                data: () => expectedData
            });

            const result = await firestoreService.getDocument<typeof expectedData>(path);

            expect(mockFirestore.doc).toHaveBeenCalledWith(path);
            expect(mockDoc.get).toHaveBeenCalled();
            expect(result).toEqual(expectedData);
        });

        it('ドキュメントが存在しない場合はnullを返すこと', async () => {
            const path = 'users/nonexistent';

            mockDoc.get.mockResolvedValue({
                exists: false
            });

            const result = await firestoreService.getDocument(path);

            expect(result).toBeNull();
            expect(logger.info).toHaveBeenCalledWith('ドキュメントが見つかりません: users/nonexistent', 'FirestoreService');
        });

        it('取得エラーの場合はAppErrorを投げること', async () => {
            const path = 'users/user1';
            const error = new Error('Firestore error');

            mockDoc.get.mockRejectedValue(error);

            await expect(firestoreService.getDocument(path)).rejects.toThrow(AppError);
        });
    });

    describe('getDocumentRef', () => {
        beforeEach(async () => {
            firestoreService.setCloudFunctions(true);
            await firestoreService.initialize();
        });

        it('ドキュメント参照を取得できること', async () => {
            const path = 'users/user1';

            const result = await firestoreService.getDocumentRef(path);

            expect(mockFirestore.doc).toHaveBeenCalledWith(path);
            expect(result).toBe(mockDoc);
        });
    });

    describe('deleteDocument', () => {
        beforeEach(async () => {
            firestoreService.setCloudFunctions(true);
            await firestoreService.initialize();
        });

        it('ドキュメントを削除できること', async () => {
            const path = 'users/user1';

            await firestoreService.deleteDocument(path);

            expect(mockFirestore.doc).toHaveBeenCalledWith(path);
            expect(mockDoc.delete).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('ドキュメントを削除しました: users/user1', 'FirestoreService');
        });

        it('削除エラーの場合はAppErrorを投げること', async () => {
            const path = 'users/user1';
            const error = new Error('Firestore error');

            mockDoc.delete.mockRejectedValue(error);

            await expect(firestoreService.deleteDocument(path)).rejects.toThrow(AppError);
        });
    });

    describe('query', () => {
        beforeEach(async () => {
            firestoreService.setCloudFunctions(true);
            await firestoreService.initialize();
        });

        it('クエリを実行して結果を返すこと', async () => {
            const collectionPath = 'users';
            const queryFn = (collection: any) => collection.where('age', '>=', 18);

            const mockSnapshot = {
                docs: [
                    {
                        id: 'doc1',
                        data: jest.fn().mockReturnValue({ field1: 'value1' })
                    },
                    {
                        id: 'doc2',
                        data: jest.fn().mockReturnValue({ field2: 'value2' })
                    }
                ]
            };

            const mockQuery = {
                get: jest.fn().mockResolvedValue(mockSnapshot)
            };

            mockCollection.where.mockReturnValue(mockQuery);

            const result = await firestoreService.query(collectionPath, queryFn);

            expect(mockFirestore.collection).toHaveBeenCalledWith(collectionPath);
            expect(mockQuery.get).toHaveBeenCalled();
            expect(result).toEqual([
                { id: 'doc1', field1: 'value1' },
                { id: 'doc2', field2: 'value2' }
            ]);
        });

        it('クエリエラーの場合はAppErrorを投げること', async () => {
            const collectionPath = 'users';
            const queryFn = (collection: any) => collection.where('age', '>=', 18);
            const error = new Error('Query error');

            const mockQuery = {
                get: jest.fn().mockRejectedValue(error)
            };

            mockCollection.where.mockReturnValue(mockQuery);

            await expect(firestoreService.query(collectionPath, queryFn)).rejects.toThrow(AppError);
        });
    });

    describe('getServerTimestamp', () => {
        it('サーバータイムスタンプを取得できること', () => {
            const result = firestoreService.getServerTimestamp();

            expect(admin.firestore.FieldValue.serverTimestamp).toHaveBeenCalled();
            expect(result).toBe('server-timestamp');
        });
    });

    describe('getTimestampFromDate', () => {
        it('日付からタイムスタンプを作成できること', () => {
            const date = new Date('2025-05-30T10:00:00Z');

            const result = firestoreService.getTimestampFromDate(date);

            expect(admin.firestore.Timestamp.fromDate).toHaveBeenCalledWith(date);
            expect(result).toEqual({
                seconds: Math.floor(date.getTime() / 1000),
                nanoseconds: 0
            });
        });
    });
});
