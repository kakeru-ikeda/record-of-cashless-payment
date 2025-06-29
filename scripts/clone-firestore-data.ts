import * as admin from 'firebase-admin';
import * as path from 'path';

interface CloneOptions {
    sourceProject: string;
    targetEmulator?: boolean;
    targetEmulatorHost?: string;
    targetEmulatorPort?: number;
    collections?: string[];
    dryRun?: boolean;
}

/**
 * Firestoreデータクローンサービス
 * 本番環境から開発環境へのデータ移行を行う
 */
export class FirestoreCloneService {
    private sourceDb: admin.firestore.Firestore;
    private targetDb: admin.firestore.Firestore;
    private options: CloneOptions;

    constructor(options: CloneOptions) {
        this.options = options;
        this.initializeFirebaseInstances();
    }

    /**
     * Firebase Admin SDKインスタンスを初期化
     */
    private initializeFirebaseInstances(): void {
        // ソース（本番）Firestore初期化
        const sourceServiceAccountPath = path.join(__dirname, '../firebase-admin-key.json');
        const sourceApp = admin.initializeApp({
            credential: admin.credential.cert(sourceServiceAccountPath),
            projectId: this.options.sourceProject
        }, 'source');
        this.sourceDb = sourceApp.firestore();

        // ターゲット（開発）Firestore初期化
        if (this.options.targetEmulator) {
            const emulatorHost = this.options.targetEmulatorHost || '127.0.0.1';
            const emulatorPort = this.options.targetEmulatorPort || 8100;
            process.env.FIRESTORE_EMULATOR_HOST = `${emulatorHost}:${emulatorPort}`;
            
            const targetApp = admin.initializeApp({
                projectId: this.options.sourceProject // 本番と同じプロジェクトIDを使用
            }, 'target');
            this.targetDb = targetApp.firestore();
        } else {
            throw new Error('現在はエミュレーターターゲットのみサポートされています');
        }

        console.log('🔗 Firebase Admin SDK インスタンスを初期化しました');
        console.log(`📤 ソース: ${this.options.sourceProject} (本番)`);
        console.log(`📥 ターゲット: エミュレーター (${process.env.FIRESTORE_EMULATOR_HOST})`);
    }

    /**
     * 指定されたコレクションをクローン
     */
    async cloneCollections(): Promise<void> {
        const collections = this.options.collections || await this.getAvailableCollections();
        
        console.log(`📋 クローン対象コレクション: ${collections.join(', ')}`);
        
        if (this.options.dryRun) {
            console.log('🔍 ドライランモード: 実際の書き込みは行いません');
        }

        for (const collectionPath of collections) {
            if (collectionPath === 'details') {
                await this.cloneDetailsHierarchy();
            } else if (collectionPath === 'reports') {
                await this.cloneReportsHierarchy();
            } else {
                await this.cloneCollection(collectionPath);
            }
        }

        console.log('✅ 全てのコレクションのクローンが完了しました');
    }

    /**
     * details階層を専用の方法でクローン
     */
    private async cloneDetailsHierarchy(): Promise<void> {
        console.log('📂 details階層をクローン中...');
        
        // detailsの実際の構造: details/{year}/{month}/term{term}/{day}/{timestamp}
        const years = ['2025'];
        const months = ['04', '06'];
        const terms = ['term1', 'term2', 'term3', 'term4'];
        
        for (const year of years) {
            console.log(`📅 ${year}年のデータを処理中...`);
            
            for (const month of months) {
                console.log(`📅 ${year}年${month}月のデータを処理中...`);
                
                for (const term of terms) {
                    try {
                        const termCollectionPath = `details/${year}/${month}/${term}`;
                        console.log(`🔍 パス確認: ${termCollectionPath}`);
                        
                        const termCollectionRef = this.sourceDb.collection(termCollectionPath);
                        const daysSnapshot = await termCollectionRef.get();
                        
                        if (!daysSnapshot.empty) {
                            console.log(`� ${termCollectionPath}: ${daysSnapshot.size} 日のデータ発見`);
                            
                            for (const dayDoc of daysSnapshot.docs) {
                                const dayCollectionPath = `${termCollectionPath}/${dayDoc.id}`;
                                console.log(`� ${dayCollectionPath} を処理中...`);
                                
                                const dayCollectionRef = this.sourceDb.collection(dayCollectionPath);
                                const timestampSnapshot = await dayCollectionRef.get();
                                
                                if (!timestampSnapshot.empty) {
                                    console.log(`📄 ${dayCollectionPath}: ${timestampSnapshot.size} 件の利用データ`);
                                    
                                    if (!this.options.dryRun) {
                                        // エミュレーター側にも同じ構造でコピー
                                        const targetCollectionRef = this.targetDb.collection(dayCollectionPath);
                                        const batch = this.targetDb.batch();
                                        
                                        for (const timestampDoc of timestampSnapshot.docs) {
                                            const targetDocRef = targetCollectionRef.doc(timestampDoc.id);
                                            batch.set(targetDocRef, timestampDoc.data());
                                        }
                                        
                                        await batch.commit();
                                        console.log(`💾 ${dayCollectionPath} の ${timestampSnapshot.size} ドキュメントを書き込みました`);
                                    } else {
                                        for (const timestampDoc of timestampSnapshot.docs) {
                                            const data = timestampDoc.data();
                                            console.log(`🔍 [ドライラン] ${dayCollectionPath}/${timestampDoc.id} (${Object.keys(data).length} フィールド)`);
                                        }
                                    }
                                }
                            }
                        } else {
                            console.log(`📄 ${termCollectionPath}: 空`);
                        }
                    } catch (error) {
                        console.log(`❌ ${year}/${month}/${term} 処理でエラー: ${error instanceof Error ? error.message : error}`);
                    }
                }
            }
        }
    }

    /**
     * reports階層を専用の方法でクローン
     */
    private async cloneReportsHierarchy(): Promise<void> {
        console.log('📂 reports階層をクローン中...');
        
        // reportsの実際の構造: reports/reportType/year-month/documentId
        const reportTypes = ['daily', 'weekly', 'monthly'];
        const yearMonths = ['2025-04', '2025-06'];
        
        for (const reportType of reportTypes) {
            console.log(`📊 ${reportType}レポート階層を処理中...`);
            
            for (const yearMonth of yearMonths) {
                try {
                    const reportCollectionPath = `reports/${reportType}/${yearMonth}`;
                    console.log(`🔍 パス確認: ${reportCollectionPath}`);
                    
                    const reportCollectionRef = this.sourceDb.collection(reportCollectionPath);
                    const snapshot = await reportCollectionRef.get();
                    
                    if (!snapshot.empty) {
                        console.log(`� ${reportCollectionPath}: ${snapshot.size} ドキュメント発見`);
                        
                        if (!this.options.dryRun) {
                            // エミュレーター側にも同じ構造でコピー
                            const targetCollectionRef = this.targetDb.collection(reportCollectionPath);
                            const batch = this.targetDb.batch();
                            
                            for (const doc of snapshot.docs) {
                                const targetDocRef = targetCollectionRef.doc(doc.id);
                                batch.set(targetDocRef, doc.data());
                            }
                            
                            await batch.commit();
                            console.log(`💾 ${reportCollectionPath} の ${snapshot.size} ドキュメントを書き込みました`);
                        } else {
                            for (const doc of snapshot.docs) {
                                const data = doc.data();
                                console.log(`🔍 [ドライラン] ${reportCollectionPath}/${doc.id} (${Object.keys(data).length} フィールド)`);
                            }
                        }
                    } else {
                        console.log(`� ${reportCollectionPath}: 空`);
                    }
                } catch (error) {
                    console.log(`❌ ${reportType}/${yearMonth} 処理でエラー: ${error instanceof Error ? error.message : error}`);
                }
            }
        }
    }

    /**
     * 利用可能なコレクション一覧を取得
     */
    private async getAvailableCollections(): Promise<string[]> {
        // よく使用されるコレクションパスを返す
        // 実際の環境では、listCollections() を使用することも可能
        return [
            'details',
            'reports'
        ];
    }

    /**
     * Firestoreの構造を探索して表示
     */
    async exploreStructure(): Promise<void> {
        console.log('🔍 Firestoreの構造を探索中...');
        
        // 既知の階層構造を直接確認
        await this.exploreKnownPaths();
        
        // 一般的な探索も実行
        await this.exploreCollections('', this.sourceDb);
    }

    /**
     * 既知のパス構造を直接確認
     */
    private async exploreKnownPaths(): Promise<void> {
        console.log('📋 既知のパス構造を確認中...');
        
        // details 階層の確認
        const detailsPaths = [
            'details',
            'details/2025',
            'details/2025/04',
            'details/2025/04/term4',
            'details/2025/04/term4/20',
            'details/2025/06',
            'details/2025/06/term4',
            'details/2025/06/term4/22'
        ];

        for (const path of detailsPaths) {
            await this.checkPath(path);
        }

        // reports 階層の確認
        const reportsPaths = [
            'reports',
            'reports/daily',
            'reports/weekly',
            'reports/monthly',
            'reports/daily/2025-04',
            'reports/daily/2025-06',
            'reports/weekly/2025-04',
            'reports/weekly/2025-06',
            'reports/monthly/2025-04',
            'reports/monthly/2025-06'
        ];

        for (const path of reportsPaths) {
            await this.checkPath(path);
        }
    }

    /**
     * 特定のパスを確認
     */
    private async checkPath(path: string): Promise<void> {
        try {
            console.log(`🔍 パス確認: ${path}`);
            
            const pathParts = path.split('/');
            let currentRef: any = this.sourceDb;
            
            for (let i = 0; i < pathParts.length; i++) {
                if (i % 2 === 0) {
                    // コレクション
                    currentRef = currentRef.collection(pathParts[i]);
                } else {
                    // ドキュメント
                    currentRef = currentRef.doc(pathParts[i]);
                }
            }
            
            if (pathParts.length % 2 === 1) {
                // コレクションで終わる場合
                const snapshot = await currentRef.limit(5).get();
                console.log(`  📊 ${path}: ${snapshot.size} ドキュメント`);
                
                for (const doc of snapshot.docs) {
                    console.log(`    📄 ${doc.id}`);
                }
            } else {
                // ドキュメントで終わる場合
                const docSnapshot = await currentRef.get();
                if (docSnapshot.exists) {
                    console.log(`  📄 ${path}: ドキュメント存在`);
                    
                    // サブコレクションを確認
                    const subCollections = await currentRef.listCollections();
                    for (const subCollection of subCollections) {
                        const subSnapshot = await subCollection.limit(3).get();
                        console.log(`    📁 ${subCollection.id}: ${subSnapshot.size} ドキュメント`);
                    }
                } else {
                    console.log(`  ❌ ${path}: ドキュメント不存在`);
                }
            }
            
        } catch (error) {
            console.log(`  ❌ ${path}: エラー - ${error instanceof Error ? error.message : error}`);
        }
    }

    /**
     * コレクション構造を再帰的に探索
     */
    private async exploreCollections(basePath: string, db: admin.firestore.Firestore): Promise<void> {
        const collections = await db.listCollections();
        
        for (const collection of collections) {
            const currentPath = basePath ? `${basePath}/${collection.id}` : collection.id;
            console.log(`📁 コレクション: ${currentPath}`);
            
            // 最初の数件のドキュメントを取得して構造を確認
            const snapshot = await collection.limit(5).get();
            console.log(`  📊 ドキュメント数: ${snapshot.size}`);
            
            for (const doc of snapshot.docs) {
                console.log(`    📄 ドキュメント: ${doc.id}`);
                
                // サブコレクションを探索
                const subCollections = await doc.ref.listCollections();
                for (const subCollection of subCollections) {
                    const subPath = `${currentPath}/${doc.id}/${subCollection.id}`;
                    console.log(`      📁 サブコレクション: ${subPath}`);
                    
                    const subSnapshot = await subCollection.limit(3).get();
                    console.log(`        📊 サブドキュメント数: ${subSnapshot.size}`);
                    
                    for (const subDoc of subSnapshot.docs) {
                        console.log(`          📄 サブドキュメント: ${subDoc.id}`);
                    }
                }
            }
        }
    }

    /**
     * 単一コレクションをクローン
     */
    private async cloneCollection(collectionPath: string, parentDocRef?: admin.firestore.DocumentReference): Promise<void> {
        console.log(`📂 コレクション "${collectionPath}" をクローン中...`);

        let sourceCollectionRef: admin.firestore.CollectionReference;
        let targetCollectionRef: admin.firestore.CollectionReference;

        if (parentDocRef) {
            sourceCollectionRef = this.sourceDb.doc(parentDocRef.path).collection(collectionPath);
            targetCollectionRef = this.targetDb.doc(parentDocRef.path).collection(collectionPath);
            console.log(`🔗 サブコレクションパス: ${parentDocRef.path}/${collectionPath}`);
        } else {
            sourceCollectionRef = this.sourceDb.collection(collectionPath);
            targetCollectionRef = this.targetDb.collection(collectionPath);
            console.log(`🔗 ルートコレクションパス: ${collectionPath}`);
        }

        try {
            console.log(`🔍 ソースからデータを取得中...`);
            const snapshot = await sourceCollectionRef.get();
            console.log(`📊 ${snapshot.size} ドキュメントが見つかりました`);

            if (snapshot.empty) {
                console.log(`ℹ️  コレクション "${collectionPath}" は空です`);
                return;
            }

            const batchSize = 500; // Firestoreのバッチ書き込み制限
            let batch = this.targetDb.batch();
            let operationCount = 0;

            for (const doc of snapshot.docs) {
                const data = doc.data();
                const targetDocRef = targetCollectionRef.doc(doc.id);

                if (!this.options.dryRun) {
                    batch.set(targetDocRef, data);
                    operationCount++;

                    // バッチサイズに達したらコミット
                    if (operationCount >= batchSize) {
                        await batch.commit();
                        console.log(`💾 ${operationCount} ドキュメントを書き込みました`);
                        batch = this.targetDb.batch();
                        operationCount = 0;
                    }
                } else {
                    console.log(`🔍 [ドライラン] ドキュメント: ${doc.id} (${Object.keys(data).length} フィールド)`);
                }

                // サブコレクションも処理
                const subCollections = await doc.ref.listCollections();
                for (const subCollection of subCollections) {
                    console.log(`📁 サブコレクション発見: ${subCollection.id}`);
                    await this.cloneCollection(subCollection.id, doc.ref);
                }
            }

            // 残りのバッチをコミット
            if (!this.options.dryRun && operationCount > 0) {
                await batch.commit();
                console.log(`💾 最終 ${operationCount} ドキュメントを書き込みました`);
            }

            console.log(`✅ コレクション "${collectionPath}" のクローンが完了しました`);

        } catch (error) {
            console.error(`❌ コレクション "${collectionPath}" のクローンに失敗しました:`, error);
            if (error instanceof Error) {
                console.error(`エラー詳細: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * エミュレーターのデータをクリア
     */
    async clearEmulatorData(): Promise<void> {
        console.log('🧹 エミュレーターのデータをクリア中...');

        const collections = ['details', 'reports'];
        
        for (const collectionName of collections) {
            await this.clearCollection(collectionName);
        }

        console.log('✅ エミュレーターデータのクリアが完了しました');
    }

    /**
     * コレクションを再帰的にクリア
     */
    private async clearCollection(collectionPath: string, parentDocRef?: admin.firestore.DocumentReference): Promise<void> {
        let collectionRef: admin.firestore.CollectionReference;

        if (parentDocRef) {
            collectionRef = this.targetDb.doc(parentDocRef.path).collection(collectionPath);
        } else {
            collectionRef = this.targetDb.collection(collectionPath);
        }

        const snapshot = await collectionRef.get();
        
        if (snapshot.empty) {
            return;
        }

        const batch = this.targetDb.batch();
        const deletePromises: Promise<void>[] = [];

        for (const doc of snapshot.docs) {
            // サブコレクションを先に削除
            const subCollections = await doc.ref.listCollections();
            for (const subCollection of subCollections) {
                deletePromises.push(this.clearCollection(subCollection.id, doc.ref));
            }

            batch.delete(doc.ref);
        }

        await Promise.all(deletePromises);
        await batch.commit();
        
        console.log(`🗑️  コレクション "${collectionPath}" から ${snapshot.size} ドキュメントを削除しました`);
    }

    /**
     * Firestore接続確認
     */
    async testConnections(): Promise<void> {
        console.log('🔗 Firestore接続テストを実行中...');
        
        try {
            // ソースFirestore接続テスト
            console.log('📤 ソースFirestore接続テスト...');
            const sourceCollections = await this.sourceDb.listCollections();
            console.log(`✅ ソース接続成功: ${sourceCollections.length} コレクションが利用可能`);
            for (const collection of sourceCollections) {
                console.log(`  - ${collection.id}`);
            }
            
            // ターゲットFirestore接続テスト
            console.log('📥 ターゲットFirestore接続テスト...');
            const targetCollections = await this.targetDb.listCollections();
            console.log(`✅ ターゲット接続成功: ${targetCollections.length} コレクションが利用可能`);
            for (const collection of targetCollections) {
                console.log(`  - ${collection.id}`);
            }
            
        } catch (error) {
            console.error('❌ Firestore接続テストに失敗しました:', error);
            throw error;
        }
    }
}

/**
 * メインクローン実行関数
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const clearFirst = args.includes('--clear');
    const testConnection = args.includes('--test-connection');
    const exploreStructure = args.includes('--explore');
    const collectionsArg = args.find(arg => arg.startsWith('--collections='));
    
    let collections: string[] | undefined;
    if (collectionsArg) {
        collections = collectionsArg.split('=')[1].split(',');
    }

    const options: CloneOptions = {
        sourceProject: 'mufg-usage-details-mailbot', // 本番プロジェクトID
        targetEmulator: true,
        targetEmulatorHost: '127.0.0.1',
        targetEmulatorPort: 8100,
        collections,
        dryRun
    };

    const cloneService = new FirestoreCloneService(options);

    try {
        console.log('🚀 Firestoreデータクローンを開始します');
        console.log(`⚙️  設定:`, {
            sourceProject: options.sourceProject,
            targetEmulator: `${options.targetEmulatorHost}:${options.targetEmulatorPort}`,
            collections: collections || '全て',
            dryRun: dryRun ? 'はい' : 'いいえ',
            clearFirst: clearFirst ? 'はい' : 'いいえ',
            testConnection: testConnection ? 'はい' : 'いいえ',
            exploreStructure: exploreStructure ? 'はい' : 'いいえ'
        });

        // 接続テストのみの場合
        if (testConnection) {
            await cloneService.testConnections();
            console.log('🎉 接続テストが正常に完了しました');
            return;
        }

        // 構造探索のみの場合
        if (exploreStructure) {
            await cloneService.exploreStructure();
            console.log('🎉 構造探索が正常に完了しました');
            return;
        }

        // 必要に応じてエミュレーターデータをクリア
        if (clearFirst && !dryRun) {
            await cloneService.clearEmulatorData();
        }

        // データクローン実行
        await cloneService.cloneCollections();

        console.log('🎉 Firestoreデータクローンが正常に完了しました');

    } catch (error) {
        console.error('💥 Firestoreデータクローンに失敗しました:', error);
        process.exit(1);
    }
}

// スクリプトとして実行された場合のみmain関数を呼び出し
if (require.main === module) {
    main().catch(console.error);
}
