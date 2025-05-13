/**
 * レポートのドキュメントリスト整合性維持バッチスクリプト
 * 
 * 各種レポート（日次、週次、月次）のdocumentIdListに含まれるが、
 * 実際には存在しないドキュメントの参照を削除するユーティリティスクリプト
 * 
 * 使用方法:
 * $ npx ts-node scripts/cleanupReportDocumentLists.ts
 */

import { Firestore, FieldValue } from 'firebase-admin/firestore';
import { FirestoreService } from '../shared/firebase/FirestoreService';
import { Environment } from '../shared/config/Environment';
import { DailyReport } from '../functions/src/services/reports/DailyReportService';
import { WeeklyReport } from '../functions/src/services/reports/WeeklyReportService';
import { MonthlyReport } from '../functions/src/services/reports/MonthlyReportService';
import * as readline from 'readline';

interface YearMonthRecord {
    year: string;
    month: string;
}

interface ReportTypeInfo {
    reportType: 'daily' | 'weekly' | 'monthly';
    path: string;
    documentIdList: string[];
}

interface CleanupResult {
    reportPath: string;
    reportType: 'daily' | 'weekly' | 'monthly';
    removedDocumentIds: string[];
}

class ReportDocumentListCleaner {
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
     * レポートコレクションを検索してレポートのパスとタイプを取得する
     */
    async findAllReports(): Promise<ReportTypeInfo[]> {
        const allReports: ReportTypeInfo[] = [];

        try {
            if (!this.db) throw new Error('Firestoreが初期化されていません');

            console.log('🔍 日次レポートを検索中...');
            const dailyReports = await this.findDailyReports();
            allReports.push(...dailyReports);
            console.log(`📋 ${dailyReports.length}件の日次レポートが見つかりました`);

            console.log('🔍 週次レポートを検索中...');
            const weeklyReports = await this.findWeeklyReports();
            allReports.push(...weeklyReports);
            console.log(`📋 ${weeklyReports.length}件の週次レポートが見つかりました`);

            console.log('🔍 月次レポートを検索中...');
            const monthlyReports = await this.findMonthlyReports();
            allReports.push(...monthlyReports);
            console.log(`📋 ${monthlyReports.length}件の月次レポートが見つかりました`);

            return allReports;
        } catch (error) {
            console.error('❌ レポートデータの検索中にエラーが発生しました', error);
            throw error;
        }
    }

    /**
     * 日次レポートを検索
     */
    private async findDailyReports(): Promise<ReportTypeInfo[]> {
        const dailyReports: ReportTypeInfo[] = [];

        if (!this.db) throw new Error('Firestoreが初期化されていません');

        // 日次レポートのコレクションを取得
        const reportsRef = this.db.collection('reports');
        const dailyCollRef = reportsRef.doc('daily');
        const yearMonthCollections = await dailyCollRef.listCollections();

        for (const yearMonthColl of yearMonthCollections) {
            const yearMonthId = yearMonthColl.id; // '2025-05'のような形式
            const dayDocs = await yearMonthColl.listDocuments();

            for (const dayDoc of dayDocs) {
                const dayId = dayDoc.id; // '01'のような形式
                const docPath = `reports/daily/${yearMonthId}/${dayId}`;

                const reportData = await this.firestoreService.getDocument<DailyReport>(docPath);
                if (reportData && reportData.documentIdList && reportData.documentIdList.length > 0) {
                    dailyReports.push({
                        reportType: 'daily',
                        path: docPath,
                        documentIdList: reportData.documentIdList,
                    });
                }
            }
        }

        return dailyReports;
    }

    /**
     * 週次レポートを検索
     */
    private async findWeeklyReports(): Promise<ReportTypeInfo[]> {
        const weeklyReports: ReportTypeInfo[] = [];

        if (!this.db) throw new Error('Firestoreが初期化されていません');

        // 週次レポートのコレクションを取得
        const reportsRef = this.db.collection('reports');
        const weeklyCollRef = reportsRef.doc('weekly');
        const yearMonthCollections = await weeklyCollRef.listCollections();

        for (const yearMonthColl of yearMonthCollections) {
            const yearMonthId = yearMonthColl.id; // '2025-05'のような形式
            const termDocs = await yearMonthColl.listDocuments();

            for (const termDoc of termDocs) {
                const termId = termDoc.id; // 'term1'のような形式
                const docPath = `reports/weekly/${yearMonthId}/${termId}`;

                const reportData = await this.firestoreService.getDocument<WeeklyReport>(docPath);
                if (reportData && reportData.documentIdList && reportData.documentIdList.length > 0) {
                    weeklyReports.push({
                        reportType: 'weekly',
                        path: docPath,
                        documentIdList: reportData.documentIdList,
                    });
                }
            }
        }

        return weeklyReports;
    }

    /**
     * 月次レポートを検索
     */
    private async findMonthlyReports(): Promise<ReportTypeInfo[]> {
        const monthlyReports: ReportTypeInfo[] = [];

        if (!this.db) throw new Error('Firestoreが初期化されていません');

        // 月次レポートのコレクションを取得
        const reportsRef = this.db.collection('reports');
        const monthlyCollRef = reportsRef.doc('monthly');
        const yearCollections = await monthlyCollRef.listCollections();

        for (const yearColl of yearCollections) {
            const yearId = yearColl.id; // '2025'のような形式
            const monthDocs = await yearColl.listDocuments();

            for (const monthDoc of monthDocs) {
                const monthId = monthDoc.id; // '05'のような形式
                const docPath = `reports/monthly/${yearId}/${monthId}`;

                const reportData = await this.firestoreService.getDocument<MonthlyReport>(docPath);
                if (reportData && reportData.documentIdList && reportData.documentIdList.length > 0) {
                    monthlyReports.push({
                        reportType: 'monthly',
                        path: docPath,
                        documentIdList: reportData.documentIdList,
                    });
                }
            }
        }

        return monthlyReports;
    }

    /**
     * ドキュメントが存在するかどうかをチェック
     * @param path ドキュメントパス
     */
    private async documentExists(path: string): Promise<boolean> {
        try {
            if (!this.db) throw new Error('Firestoreが初期化されていません');

            const doc = await this.db.doc(path).get();
            return doc.exists;
        } catch (error) {
            console.error(`❌ ドキュメント存在確認中にエラー (${path})`, error);
            return false; // エラーが発生した場合も存在しないと判断
        }
    }

    /**
     * レポートのドキュメントIDリストをクリーンアップ
     * @param reports レポート情報のリスト
     */
    async cleanupDocumentLists(reports: ReportTypeInfo[]): Promise<CleanupResult[]> {
        const results: CleanupResult[] = [];

        for (const report of reports) {
            try {
                // 各ドキュメントの存在チェック
                const nonExistentDocuments: string[] = [];

                for (const docId of report.documentIdList) {
                    const exists = await this.documentExists(docId);
                    if (!exists) {
                        nonExistentDocuments.push(docId);
                    }
                }

                // 存在しないドキュメントがある場合は削除
                if (nonExistentDocuments.length > 0) {
                    // 存在するドキュメントのみを残す
                    const updatedDocumentIdList = report.documentIdList.filter(
                        id => !nonExistentDocuments.includes(id)
                    );

                    // レポートを更新
                    await this.firestoreService.updateDocument(report.path, {
                        documentIdList: updatedDocumentIdList,
                        lastUpdated: this.getServerTimestamp(),
                        lastUpdatedBy: 'report-cleanup-script'
                    });

                    results.push({
                        reportPath: report.path,
                        reportType: report.reportType,
                        removedDocumentIds: nonExistentDocuments,
                    });

                    console.log(`✨ ${report.reportType}レポート整理完了: ${report.path}`);
                    console.log(`   削除されたドキュメント参照: ${nonExistentDocuments.length}件`);
                }
            } catch (error) {
                console.error(`❌ レポート更新中にエラーが発生しました: ${report.path}`, error);
            }
        }

        return results;
    }

    /**
     * サーバータイムスタンプを取得
     */
    private getServerTimestamp(): FirebaseFirestore.FieldValue {
        return FieldValue.serverTimestamp();
    }

    /**
     * クリーンアップ結果のサマリーを表示
     */
    displayCleanupSummary(results: CleanupResult[]): void {
        if (results.length === 0) {
            console.log('✅ すべてのレポートのドキュメントリストは正常です。クリーンアップは必要ありません。');
            return;
        }

        console.log('\n===== クリーンアップ結果サマリー =====');
        console.log(`合計: ${results.length}件のレポートがクリーンアップされました\n`);

        let dailyReportsCount = 0;
        let weeklyReportsCount = 0;
        let monthlyReportsCount = 0;
        let totalRemovedReferences = 0;

        results.forEach(result => {
            switch (result.reportType) {
                case 'daily':
                    dailyReportsCount++;
                    break;
                case 'weekly':
                    weeklyReportsCount++;
                    break;
                case 'monthly':
                    monthlyReportsCount++;
                    break;
            }
            totalRemovedReferences += result.removedDocumentIds.length;
        });

        console.log(`日次レポート: ${dailyReportsCount}件`);
        console.log(`週次レポート: ${weeklyReportsCount}件`);
        console.log(`月次レポート: ${monthlyReportsCount}件`);
        console.log(`削除された参照の総数: ${totalRemovedReferences}件`);
        console.log('\n==================================\n');
    }

    /**
     * ユーザーに確認を求める
     */
    async confirmCleanup(count: number): Promise<boolean> {
        if (count === 0) {
            console.log('❌ クリーンアップ対象のレポートがありません');
            return false;
        }

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise<boolean>((resolve) => {
            rl.question(`⚠️ 警告: この操作は${count}件のレポートのdocumentIdListを更新します。\n続行しますか？ (y/n): `, (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'y');
            });
        });
    }
}

/**
 * メイン処理
 */
async function main() {
    try {
        console.log('🚀 レポートドキュメントリスト整理バッチを開始します...');
        const cleaner = new ReportDocumentListCleaner();
        await cleaner.initialize();

        // すべてのレポートを検索
        const reports = await cleaner.findAllReports();
        console.log(`📊 合計${reports.length}件のレポートが見つかりました`);

        if (reports.length === 0) {
            console.log('✅ レポートが見つからなかったため、処理を終了します');
            process.exit(0);
        }

        // ユーザー確認
        const confirmed = await cleaner.confirmCleanup(reports.length);
        if (!confirmed) {
            console.log('❌ 操作がキャンセルされました');
            process.exit(0);
        }

        // クリーンアップ実行
        const results = await cleaner.cleanupDocumentLists(reports);

        // 結果サマリー表示
        cleaner.displayCleanupSummary(results);

        console.log('✨ レポートドキュメントリストのクリーンアップが完了しました');
        process.exit(0);
    } catch (error) {
        console.error('❌ バッチ処理中にエラーが発生しました', error);
        process.exit(1);
    }
}

// スクリプト実行
main();