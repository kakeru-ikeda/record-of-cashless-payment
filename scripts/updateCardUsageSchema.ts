/**
 * カード利用情報のスキーマ更新バッチスクリプト
 * 
 * 既存のCardUsageドキュメントに以下のフィールドを追加:
 * - memo: string (デフォルト: '')
 * - is_active: boolean (デフォルト: true)
 * 
 * 使用方法:
 * $ npx ts-node scripts/updateCardUsageSchema.ts
 */

import { Firestore } from 'firebase-admin/firestore';
import { FirestoreService } from '../shared/firebase/FirestoreService';
import { Environment } from '../shared/config/Environment';
import { CardUsage } from '../src/domain/entities/CardUsage';

interface YearMonthRecord {
    year: string;
    month: string;
    termList: string[];
}

class CardUsageSchemaUpdater {
    private firestoreService: FirestoreService;
    private db: Firestore | null = null;

    constructor() {
        this.firestoreService = FirestoreService.getInstance();
    }

    /**
     * Firestoreへの接続を初期化
     */
    async initialize(): Promise<void> {
        try {
            // サービスアカウントの秘密鍵のパスを取得
            const serviceAccountPath = Environment.getFirebaseAdminKeyPath();

            // 初期化
            this.firestoreService.setCloudFunctions(Environment.isCloudFunctions());
            this.db = await this.firestoreService.initialize(serviceAccountPath);
            console.log('✅ Firestoreへの接続が初期化されました');
        } catch (error) {
            console.error('❌ Firestoreへの接続初期化中にエラーが発生しました', error);
            throw error;
        }
    }

    /**
     * 利用可能な年月の一覧を取得
     */
    async getAvailableYearMonths(): Promise<YearMonthRecord[]> {
        try {
            if (!this.db) throw new Error('Firestoreが初期化されていません');

            // 詳細データの親コレクションを参照
            const detailsRef = this.db.collection('details');
            const yearSnapshot = await detailsRef.listDocuments();

            const yearMonths: YearMonthRecord[] = [];

            // 各年のデータを処理
            for (const yearDoc of yearSnapshot) {
                const year = yearDoc.id;
                const monthSnapshot = await yearDoc.listCollections();

                // 各月のデータを処理
                for (const monthCollection of monthSnapshot) {
                    const month = monthCollection.id;
                    const termSnapshot = await monthCollection.listDocuments();
                    const termList = termSnapshot.map(term => term.id);

                    yearMonths.push({ year, month, termList });
                }
            }

            return yearMonths;
        } catch (error) {
            console.error('❌ 年月データの取得中にエラーが発生しました', error);
            throw error;
        }
    }

    /**
     * 特定の年月のカード利用データを更新
     */
    async updateMonthData(yearMonth: YearMonthRecord): Promise<number> {
        try {
            if (!this.db) throw new Error('Firestoreが初期化されていません');
            const { year, month, termList } = yearMonth;
            let updatedCount = 0;

            console.log(`📅 ${year}年${month}月のデータを処理中...`);

            // 各ターム（週）のデータを処理
            for (const term of termList) {
                const termRef = this.db.collection('details').doc(year).collection(month).doc(term);
                const dayCollections = await termRef.listCollections();

                // 各日のデータを処理
                for (const dayCollection of dayCollections) {
                    const day = dayCollection.id;
                    const daySnapshot = await dayCollection.listDocuments();

                    // 各タイムスタンプ（カード利用データ）を処理
                    for (const timestampDoc of daySnapshot) {
                        const timestamp = timestampDoc.id;
                        const docRef = this.db.collection('details').doc(year).collection(month).doc(term).collection(day).doc(timestamp);
                        const docSnap = await docRef.get();

                        if (docSnap.exists) {
                            const data = docSnap.data() as CardUsage;

                            // フィールドが存在しない場合のみ更新
                            if (data.memo === undefined || data.is_active === undefined) {
                                await docRef.update({
                                    memo: data.memo || '',
                                    is_active: data.is_active !== undefined ? data.is_active : true
                                });
                                updatedCount++;
                            }
                        }
                    }
                }
            }

            return updatedCount;
        } catch (error) {
            console.error(`❌ ${yearMonth.year}年${yearMonth.month}月のデータ更新中にエラーが発生しました`, error);
            throw error;
        }
    }

    /**
     * 全ての年月のデータを更新
     */
    async updateAllData(): Promise<void> {
        try {
            // 年月データを取得
            const yearMonths = await this.getAvailableYearMonths();
            console.log(`🔍 ${yearMonths.length}年月分のデータが見つかりました`);

            let totalUpdated = 0;

            // 各年月のデータを更新
            for (const yearMonth of yearMonths) {
                const updatedCount = await this.updateMonthData(yearMonth);
                totalUpdated += updatedCount;
                console.log(`✅ ${yearMonth.year}年${yearMonth.month}月: ${updatedCount}件のドキュメントを更新しました`);
            }

            console.log(`✨ 更新完了! 合計${totalUpdated}件のドキュメントを更新しました`);
        } catch (error) {
            console.error('❌ データ更新中にエラーが発生しました', error);
            throw error;
        }
    }
}

/**
 * メイン処理
 */
async function main() {
    try {
        console.log('🚀 CardUsageスキーマ更新バッチを開始します...');
        const updater = new CardUsageSchemaUpdater();
        await updater.initialize();
        await updater.updateAllData();
        console.log('✅ バッチ処理が正常に完了しました');
        process.exit(0);
    } catch (error) {
        console.error('❌ バッチ処理中にエラーが発生しました', error);
        process.exit(1);
    }
}

// スクリプト実行
main();