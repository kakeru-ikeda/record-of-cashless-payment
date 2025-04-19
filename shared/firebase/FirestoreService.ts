import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

/**
 * Firestoreサービスクラス
 * Firestoreへの接続と基本的な操作を提供する共通クラス
 */
export class FirestoreService {
    private static instance: FirestoreService;
    private db: Firestore | null = null;
    private isCloudFunctions: boolean = false;

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
                    console.log('✅ Cloud Functions環境でFirestoreに接続しました');
                } else if (serviceAccountPath) {
                    // ローカル環境では秘密鍵ファイルで初期化
                    admin.initializeApp({
                        credential: admin.credential.cert(
                            JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
                        )
                    });
                    console.log('✅ サービスアカウントキーを使用してFirestoreに接続しました');
                } else {
                    throw new Error('サービスアカウントキーのパスが指定されていません');
                }
            }

            // Firestoreインスタンスを返す
            this.db = admin.firestore();
            return this.db;
        } catch (error) {
            console.error('❌ Firestoreへの接続に失敗しました:', error);
            throw error;
        }
    }

    /**
     * Firestoreインスタンスを取得する
     */
    public async getDb(): Promise<Firestore> {
        if (!this.db) {
            throw new Error('Firestoreが初期化されていません。initialize()を先に呼び出してください。');
        }
        return this.db;
    }

    /**
     * ドキュメントを保存する
     * @param path ドキュメントパス
     * @param data 保存するデータ
     */
    public async saveDocument(path: string, data: any): Promise<void> {
        const db = await this.getDb();
        try {
            await db.doc(path).set(data);
            console.log(`✅ ドキュメントを保存しました: ${path}`);
        } catch (error) {
            console.error(`❌ ドキュメント保存エラー (${path}):`, error);
            throw error;
        }
    }

    /**
     * ドキュメントを更新する
     * @param path ドキュメントパス
     * @param data 更新するデータ
     */
    public async updateDocument(path: string, data: any): Promise<void> {
        const db = await this.getDb();
        try {
            await db.doc(path).update(data);
            console.log(`✅ ドキュメントを更新しました: ${path}`);
        } catch (error) {
            console.error(`❌ ドキュメント更新エラー (${path}):`, error);
            throw error;
        }
    }

    /**
     * ドキュメントを取得する
     * @param path ドキュメントパス
     */
    public async getDocument<T>(path: string): Promise<T | null> {
        const db = await this.getDb();
        try {
            const doc = await db.doc(path).get();
            if (doc.exists) {
                return doc.data() as T;
            } else {
                console.log(`ドキュメントが見つかりません: ${path}`);
                return null;
            }
        } catch (error) {
            console.error(`❌ ドキュメント取得エラー (${path}):`, error);
            throw error;
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