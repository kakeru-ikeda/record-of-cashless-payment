import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import { AppError, ErrorType } from '@shared/errors/AppError';
import { logger } from '@shared/infrastructure/logging/Logger';

/**
 * Firestoreサービスクラス
 * Firestoreへの接続と基本的な操作を提供する共通クラス
 */
export class FirestoreService {
    private static instance: FirestoreService;
    private db: Firestore | null = null;
    private _isCloudFunctions: boolean = false;
    private readonly serviceContext = 'FirestoreService';

    /**
     * シングルトンインスタンスを取得する
     */
    public static getInstance(): FirestoreService {
        if (!FirestoreService.instance) {
            FirestoreService.instance = new FirestoreService();
        }
        return FirestoreService.instance;
    }

    /**
     * コンストラクタ - privateでシングルトンパターンを強制
     */
    private constructor() { }

    /**
     * Cloud Functions環境かどうかを判定する
     * Firebase Cloud Functions環境では FUNCTION_TARGET 環境変数が設定される
     * または NODE_ENV が production で FIREBASE_CONFIG が設定されている場合も Cloud Functions とみなす
     */
    private isCloudFunctions(): boolean {
        // FUNCTION_TARGET環境変数が設定されている場合（Firebase Cloud Functions）
        if (process.env.FUNCTION_TARGET) {
            return true;
        }

        // FIREBASE_CONFIG環境変数が設定されている場合（Firebase環境）
        if (process.env.FIREBASE_CONFIG) {
            return true;
        }

        // GCPのCloud Functions環境変数
        if (process.env.K_SERVICE || process.env.FUNCTION_NAME) {
            return true;
        }

        // FUNCTIONS_EMULATOR環境変数が設定されている場合（Firebase Emulator）
        if (process.env.FUNCTIONS_EMULATOR === 'true') {
            return true;
        }

        // IS_CLOUD_FUNCTIONS環境変数が設定されている場合（手動設定）
        if (process.env.IS_CLOUD_FUNCTIONS === 'true') {
            return true;
        }

        // GCP環境での実行（Google Cloud Run等）
        if (process.env.GOOGLE_CLOUD_PROJECT) {
            return true;
        }

        // Firebase Admin SDK が自動初期化される環境
        // Google Application Default Credentials が利用可能かチェック
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS === undefined &&
            process.env.GCLOUD_PROJECT) {
            return true;
        }

        // setCloudFunctions()で設定されている場合
        if (this._isCloudFunctions) {
            return true;
        }

        return false;
    }

    /**
     * Cloud Functions環境かどうかを設定する（後方互換性のため残す）
     * @param isCloudFunctions Cloud Functions環境の場合はtrue
     * @deprecated 環境変数による自動判定を使用してください
     */
    public setCloudFunctions(isCloudFunctions: boolean): void {
        // 後方互換性のため残すが、環境変数による判定を優先
        logger.warn('setCloudFunctions()は非推奨です。環境変数による自動判定を使用してください。', this.serviceContext);
        this._isCloudFunctions = isCloudFunctions;
    }

    /**
     * Firestoreへの接続を初期化する
     * @param serviceAccountPath サービスアカウントキーのパス（ローカル環境用）
     */
    public async initialize(serviceAccountPath?: string): Promise<Firestore> {
        // 既に初期化されている場合は既存のインスタンスを返す
        if (this.db) {
            return this.db;
        }

        try {
            // 環境変数の状態をログ出力（デバッグ用）
            logger.info(`Firebase初期化: Cloud Functions判定=${this.isCloudFunctions()}, FUNCTION_TARGET=${process.env.FUNCTION_TARGET}, FIREBASE_CONFIG=${process.env.FIREBASE_CONFIG ? '設定済み' : '未設定'}, GOOGLE_CLOUD_PROJECT=${process.env.GOOGLE_CLOUD_PROJECT}`, this.serviceContext);

            if (this.isCloudFunctions()) {
                // Cloud Functions環境では、Firebase Admin SDKが自動初期化されているかチェック
                if (!admin.apps || admin.apps.length === 0) {
                    // 自動初期化されていない場合、手動で初期化
                    admin.initializeApp();
                    logger.info('Cloud Functions環境でFirebase Admin SDKを手動初期化しました', this.serviceContext);
                } else {
                    logger.info('Cloud Functions環境でFirebase Admin SDKは既に初期化されています', this.serviceContext);
                }
            } else {
                // ローカル環境での初期化
                if (!admin.apps || admin.apps.length === 0) {
                    if (serviceAccountPath) {
                        try {
                            admin.initializeApp({
                                credential: admin.credential.cert(
                                    JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
                                )
                            });
                            logger.info('ローカル環境でFirestoreに接続しました', this.serviceContext);
                        } catch (error) {
                            throw new AppError(
                                'サービスアカウントキーでの初期化に失敗しました',
                                ErrorType.FIREBASE,
                                { path: serviceAccountPath },
                                error instanceof Error ? error : undefined
                            );
                        }
                    } else {
                        throw new AppError(
                            'サービスアカウントキーのパスが指定されていません',
                            ErrorType.CONFIGURATION
                        );
                    }
                } else {
                    logger.info('Firebase Admin SDKは既に初期化されています', this.serviceContext);
                }
            }

            // Firestoreインスタンスを作成
            this.db = admin.firestore();
            logger.info('Firestoreインスタンスを正常に作成しました', this.serviceContext);
            return this.db;
        } catch (error) {
            // AppErrorでない場合は変換
            const appError = error instanceof AppError ? error :
                new AppError(
                    'Firestoreへの接続に失敗しました',
                    ErrorType.FIREBASE,
                    { serviceAccountPath },
                    error instanceof Error ? error : undefined
                );

            logger.error(appError, this.serviceContext);
            throw appError;
        }
    }

    /**
     * Firestoreインスタンスを取得する
     */
    public async getDb(): Promise<Firestore> {
        if (!this.db) {
            throw new AppError('Firestoreが初期化されていません。initialize()を先に呼び出してください。', ErrorType.FIREBASE);
        }
        return this.db;
    }

    /**
     * ドキュメントを保存する
     * @param path ドキュメントパス
     * @param data 保存するデータ
     */
    public async saveDocument(path: string, data: any): Promise<void> {
        try {
            const db = await this.getDb();
            await db.doc(path).set(data);
            logger.info(`ドキュメントを保存しました: ${path}`, this.serviceContext);
        } catch (error) {
            const appError = new AppError(
                `ドキュメント保存エラー (${path})`,
                ErrorType.FIREBASE,
                { path, data },
                error instanceof Error ? error : undefined
            );
            logger.error(appError, this.serviceContext);
            throw appError;
        }
    }

    /**
     * ドキュメントを更新する
     * @param path ドキュメントパス
     * @param data 更新するデータ
     */
    public async updateDocument(path: string, data: any): Promise<void> {
        try {
            const db = await this.getDb();
            await db.doc(path).update(data);
            logger.info(`ドキュメントを更新しました: ${path}`, this.serviceContext);
        } catch (error) {
            const appError = new AppError(
                `ドキュメント更新エラー (${path})`,
                ErrorType.FIREBASE,
                { path, data },
                error instanceof Error ? error : undefined
            );
            logger.error(appError, this.serviceContext);
            throw appError;
        }
    }

    /**
     * ドキュメントを取得する
     * @param path ドキュメントパス
     */
    public async getDocument<T>(path: string): Promise<T | null> {
        try {
            const db = await this.getDb();
            const doc = await db.doc(path).get();
            if (doc.exists) {
                return doc.data() as T;
            } else {
                logger.info(`ドキュメントが見つかりません: ${path}`, this.serviceContext);
                return null;
            }
        } catch (error) {
            const appError = new AppError(
                `ドキュメント取得エラー (${path})`,
                ErrorType.FIREBASE,
                { path },
                error instanceof Error ? error : undefined
            );
            logger.error(appError, this.serviceContext);
            throw appError;
        }
    }

    /**
     * ドキュメント参照を取得する
     * @param path ドキュメントパス
     * @returns ドキュメント参照
     */
    public async getDocumentRef(path: string): Promise<admin.firestore.DocumentReference> {
        try {
            const db = await this.getDb();
            return db.doc(path);
        } catch (error) {
            const appError = new AppError(
                `ドキュメント参照取得エラー (${path})`,
                ErrorType.FIREBASE,
                { path },
                error instanceof Error ? error : undefined
            );
            logger.error(appError, this.serviceContext);
            throw appError;
        }
    }

    /**
     * ドキュメントを削除する
     * @param path ドキュメントパス
     */
    public async deleteDocument(path: string): Promise<void> {
        try {
            const db = await this.getDb();
            await db.doc(path).delete();
            logger.info(`ドキュメントを削除しました: ${path}`, this.serviceContext);
        } catch (error) {
            const appError = new AppError(
                `ドキュメント削除エラー (${path})`,
                ErrorType.FIREBASE,
                { path },
                error instanceof Error ? error : undefined
            );
            logger.error(appError, this.serviceContext);
            throw appError;
        }
    }

    /**
     * クエリを実行する
     * @param collectionPath コレクションパス
     * @param queryFn クエリ関数
     */
    public async query<T>(
        collectionPath: string,
        queryFn: (collection: FirebaseFirestore.CollectionReference) => FirebaseFirestore.Query
    ): Promise<T[]> {
        try {
            const db = await this.getDb();
            const collection = db.collection(collectionPath);
            const query = queryFn(collection);
            const snapshot = await query.get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as unknown as T));
        } catch (error) {
            const appError = new AppError(
                `クエリ実行エラー (${collectionPath})`,
                ErrorType.FIREBASE,
                { collectionPath },
                error instanceof Error ? error : undefined
            );
            logger.error(appError, this.serviceContext);
            throw appError;
        }
    }

    /**
     * タイムスタンプを取得する（サーバー時間）
     */
    public getServerTimestamp() {
        return admin.firestore.FieldValue.serverTimestamp();
    }

    /**
     * 日付からタイムスタンプを作成する
     */
    public getTimestampFromDate(date: Date) {
        return admin.firestore.Timestamp.fromDate(date);
    }
}