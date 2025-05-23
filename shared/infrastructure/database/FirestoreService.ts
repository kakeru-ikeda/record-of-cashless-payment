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
    private isCloudFunctions: boolean = false;
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
     * Cloud Functions環境かどうかを設定する
     * @param isCloudFunctions Cloud Functions環境の場合はtrue
     */
    public setCloudFunctions(isCloudFunctions: boolean): void {
        this.isCloudFunctions = isCloudFunctions;
    }

    /**
     * ログを出力する
     * @param message ログメッセージ
     * @param level ログレベル
     */
    private log(message: string, level: 'info' | 'error' = 'info'): void {
        const logMessage = `[${this.serviceContext}] ${message}`;

        if (this.isCloudFunctions) {
            if (level === 'info') {
                console.log(logMessage);
            } else {
                console.warn(logMessage);
            }
        } else {
            if (level === 'info') {
                logger.info(message, this.serviceContext);
            } else {
                logger.warn(message, this.serviceContext);
            }
        }
    }

    /**
     * エラーログを出力する
     * @param error AppErrorオブジェクト
     */
    private logError(error: AppError): void {
        if (this.isCloudFunctions) {
            console.error(`[${this.serviceContext}] ${error.message}`, error);
        } else {
            logger.error(error, this.serviceContext);
        }
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
            // Firebase初期化がまだの場合のみ初期化
            if (!admin.apps || admin.apps.length === 0) {
                if (this.isCloudFunctions) {
                    // Cloud Functions環境では自動的に初期化される
                    admin.initializeApp();
                    this.log('Cloud Functions環境でFirestoreに接続しました');
                } else if (serviceAccountPath) {
                    // ローカル環境では秘密鍵ファイルで初期化
                    try {
                        admin.initializeApp({
                            credential: admin.credential.cert(
                                JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
                            )
                        });
                        this.log('ローカル環境でFirestoreに接続しました');
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
            }

            // Firestoreインスタンスを返す
            this.db = admin.firestore();
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

            this.logError(appError);
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
            this.log(`ドキュメントを保存しました: ${path}`);
        } catch (error) {
            const appError = new AppError(
                `ドキュメント保存エラー (${path})`,
                ErrorType.FIREBASE,
                { path, data },
                error instanceof Error ? error : undefined
            );
            this.logError(appError);
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
            this.log(`ドキュメントを更新しました: ${path}`);
        } catch (error) {
            const appError = new AppError(
                `ドキュメント更新エラー (${path})`,
                ErrorType.FIREBASE,
                { path, data },
                error instanceof Error ? error : undefined
            );
            this.logError(appError);
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
                this.log(`ドキュメントが見つかりません: ${path}`);
                return null;
            }
        } catch (error) {
            const appError = new AppError(
                `ドキュメント取得エラー (${path})`,
                ErrorType.FIREBASE,
                { path },
                error instanceof Error ? error : undefined
            );
            this.logError(appError);
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
            this.logError(appError);
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
            this.log(`ドキュメントを削除しました: ${path}`);
        } catch (error) {
            const appError = new AppError(
                `ドキュメント削除エラー (${path})`,
                ErrorType.FIREBASE,
                { path },
                error instanceof Error ? error : undefined
            );
            this.logError(appError);
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
            this.logError(appError);
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