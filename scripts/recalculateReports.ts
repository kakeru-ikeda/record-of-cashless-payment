/**
 * レポート再集計バッチスクリプト
 * 
 * 日次、週次、月次のレポートデータを再集計するユーティリティスクリプト
 * documentIdListに含まれる実際のドキュメントデータを読み込み、
 * totalAmountとtotalCountを正確に再計算する
 * 
 * 使用方法:
 * $ npx ts-node scripts/recalculateReports.ts
 */

import { Firestore } from 'firebase-admin/firestore';
import { FirestoreService } from '../shared/firebase/FirestoreService';
import { Environment } from '../shared/config/Environment';
import { DailyReport } from '../functions/src/services/reports/DailyReportService';
import { WeeklyReport } from '../functions/src/services/reports/WeeklyReportService';
import { MonthlyReport } from '../functions/src/services/reports/MonthlyReportService';
import { CardUsage } from '../shared/domain/entities/CardUsage';
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

interface RecalculationResult {
    reportPath: string;
    reportType: 'daily' | 'weekly' | 'monthly';
    originalAmount: number;
    recalculatedAmount: number;
    originalCount: number;
    recalculatedCount: number;
    isChanged: boolean;
    isApplied?: boolean; // 変更が適用されたかどうか
}

class ReportRecalculator {
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
     * 個別のドキュメントを取得する
     * @param docPath ドキュメントのパス
     * @returns カード利用データもしくはnull
     */
    private async getCardUsage(docPath: string): Promise<CardUsage | null> {
        try {
            const cardUsage = await this.firestoreService.getDocument<CardUsage>(docPath);
            return cardUsage;
        } catch (error) {
            console.error(`❌ ドキュメント取得中にエラー (${docPath})`, error);
            return null;
        }
    }

    /**
     * レポートを再計算する
     * @param reports レポートリスト
     */
    async recalculateReports(reports: ReportTypeInfo[]): Promise<RecalculationResult[]> {
        const results: RecalculationResult[] = [];

        for (const report of reports) {
            try {
                // レポートデータを取得
                let reportData: DailyReport | WeeklyReport | MonthlyReport | null = null;

                switch (report.reportType) {
                    case 'daily':
                        reportData = await this.firestoreService.getDocument<DailyReport>(report.path);
                        break;
                    case 'weekly':
                        reportData = await this.firestoreService.getDocument<WeeklyReport>(report.path);
                        break;
                    case 'monthly':
                        reportData = await this.firestoreService.getDocument<MonthlyReport>(report.path);
                        break;
                }

                if (!reportData) {
                    console.log(`⚠️ レポートデータが取得できませんでした: ${report.path}`);
                    continue;
                }

                // 元の値を保存
                const originalAmount = reportData.totalAmount;
                const originalCount = reportData.totalCount;

                // 再計算のための新しい値
                let newTotalAmount = 0;
                let newTotalCount = 0;

                // 各ドキュメントを取得して金額を再計算
                for (const docId of report.documentIdList) {
                    const cardUsage = await this.getCardUsage(docId);

                    // カード利用データがあり、かつアクティブな場合のみカウント
                    if (cardUsage && (cardUsage.is_active !== false)) {
                        newTotalAmount += cardUsage.amount;
                        newTotalCount++;
                    }
                }

                // 違いがあれば更新候補として追加
                const isChanged =
                    originalAmount !== newTotalAmount ||
                    originalCount !== newTotalCount;

                // 結果に追加（この時点では適用していない）
                results.push({
                    reportPath: report.path,
                    reportType: report.reportType,
                    originalAmount,
                    recalculatedAmount: newTotalAmount,
                    originalCount,
                    recalculatedCount: newTotalCount,
                    isChanged,
                    isApplied: false
                });
            } catch (error) {
                console.error(`❌ レポート再計算中にエラーが発生しました: ${report.path}`, error);
            }
        }

        return results;
    }

    /**
     * ユーザーに再計算の確認を求める
     * @param count レポートの数
     */
    async confirmRecalculation(count: number): Promise<boolean> {
        if (count === 0) {
            console.log('❌ 再計算対象のレポートがありません');
            return false;
        }

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise<boolean>((resolve) => {
            rl.question(`⚠️ 警告: この操作は${count}件のレポートを再計算する可能性があります。\n続行しますか？ (y/n): `, (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'y');
            });
        });
    }

    /**
     * 変更適用の確認を求める
     */
    private async confirmChanges(count: number): Promise<boolean> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise<boolean>((resolve) => {
            rl.question(`\n⚠️ 上記の${count}件のレポートに変更を適用しますか？ (y/n): `, (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'y');
            });
        });
    }

    /**
     * 再計算結果を表示し、ユーザーに確認を求める
     * @param results 再計算結果
     */
    async displayAndConfirmChanges(results: RecalculationResult[]): Promise<RecalculationResult[]> {
        // 変更があるレポートだけをフィルタリング
        const changedResults = results.filter(r => r.isChanged);

        if (changedResults.length === 0) {
            console.log('✅ すべてのレポートは正確に計算されていました。更新は必要ありません。');
            return results;
        }

        console.log('\n===== 再計算結果 =====');
        console.log(`${changedResults.length}件のレポートに差異が見つかりました。\n`);

        // レポートタイプごとにグループ化して表示
        const dailyReports = changedResults.filter(r => r.reportType === 'daily');
        const weeklyReports = changedResults.filter(r => r.reportType === 'weekly');
        const monthlyReports = changedResults.filter(r => r.reportType === 'monthly');

        if (dailyReports.length > 0) {
            console.log(`\n【日次レポート】 (${dailyReports.length}件)`);
            dailyReports.forEach((report, index) => {
                console.log(`${index + 1}. ${report.reportPath}`);
                console.log(`   金額: ${report.originalAmount} → ${report.recalculatedAmount} (差分: ${report.recalculatedAmount - report.originalAmount}円)`);
                console.log(`   件数: ${report.originalCount} → ${report.recalculatedCount} (差分: ${report.recalculatedCount - report.originalCount}件)`);
            });
        }

        if (weeklyReports.length > 0) {
            console.log(`\n【週次レポート】 (${weeklyReports.length}件)`);
            weeklyReports.forEach((report, index) => {
                console.log(`${index + 1}. ${report.reportPath}`);
                console.log(`   金額: ${report.originalAmount} → ${report.recalculatedAmount} (差分: ${report.recalculatedAmount - report.originalAmount}円)`);
                console.log(`   件数: ${report.originalCount} → ${report.recalculatedCount} (差分: ${report.recalculatedCount - report.originalCount}件)`);
            });
        }

        if (monthlyReports.length > 0) {
            console.log(`\n【月次レポート】 (${monthlyReports.length}件)`);
            monthlyReports.forEach((report, index) => {
                console.log(`${index + 1}. ${report.reportPath}`);
                console.log(`   金額: ${report.originalAmount} → ${report.recalculatedAmount} (差分: ${report.recalculatedAmount - report.originalAmount}円)`);
                console.log(`   件数: ${report.originalCount} → ${report.recalculatedCount} (差分: ${report.recalculatedCount - report.originalCount}件)`);
            });
        }

        console.log('\n=======================');

        // 合計の差分を表示
        let totalAmountDiff = 0;
        let totalCountDiff = 0;
        changedResults.forEach(result => {
            totalAmountDiff += (result.recalculatedAmount - result.originalAmount);
            totalCountDiff += (result.recalculatedCount - result.originalCount);
        });

        console.log(`\n【合計差分】`);
        console.log(`総額差分: ${totalAmountDiff}円`);
        console.log(`総数差分: ${totalCountDiff}件`);

        // ユーザー確認
        const confirmed = await this.confirmChanges(changedResults.length);
        if (!confirmed) {
            console.log('❌ 変更の適用がキャンセルされました');
            return results;
        }

        // 各レポートに変更を適用
        console.log('変更を適用しています...');
        for (const result of results) {
            if (result.isChanged) {
                try {
                    await this.firestoreService.updateDocument(result.reportPath, {
                        totalAmount: result.recalculatedAmount,
                        totalCount: result.recalculatedCount,
                        lastUpdated: this.firestoreService.getServerTimestamp(),
                        lastUpdatedBy: 'report-recalculation-script'
                    });

                    result.isApplied = true;
                    console.log(`✓ 適用完了: ${result.reportPath}`);
                } catch (error) {
                    console.error(`❌ レポート更新中にエラー: ${result.reportPath}`, error);
                }
            }
        }

        return results;
    }

    /**
     * 再計算結果のサマリーを表示
     */
    displayRecalculationSummary(results: RecalculationResult[]): void {
        // 変更が適用されたレポートのみ抽出
        const appliedResults = results.filter(r => r.isChanged && r.isApplied);

        if (appliedResults.length === 0) {
            console.log('✅ 変更は適用されませんでした。');
            return;
        }

        console.log('\n===== 再計算結果サマリー =====');
        console.log(`合計: ${appliedResults.length}件のレポートが更新されました\n`);

        let dailyReportsCount = 0;
        let weeklyReportsCount = 0;
        let monthlyReportsCount = 0;
        let totalAmountDiff = 0;
        let totalCountDiff = 0;

        appliedResults.forEach(result => {
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
            totalAmountDiff += (result.recalculatedAmount - result.originalAmount);
            totalCountDiff += (result.recalculatedCount - result.originalCount);
        });

        console.log(`日次レポート: ${dailyReportsCount}件`);
        console.log(`週次レポート: ${weeklyReportsCount}件`);
        console.log(`月次レポート: ${monthlyReportsCount}件`);
        console.log(`総額差分: ${totalAmountDiff}円`);
        console.log(`総数差分: ${totalCountDiff}件`);
        console.log('\n==================================\n');
    }
}

/**
 * メイン処理
 */
async function main() {
    try {
        console.log('🚀 レポート再計算バッチを開始します...');
        const recalculator = new ReportRecalculator();
        await recalculator.initialize();

        // すべてのレポートを検索
        const reports = await recalculator.findAllReports();
        console.log(`📊 合計${reports.length}件のレポートが見つかりました`);

        if (reports.length === 0) {
            console.log('✅ レポートが見つからなかったため、処理を終了します');
            process.exit(0);
        }

        // ユーザー確認
        const confirmed = await recalculator.confirmRecalculation(reports.length);
        if (!confirmed) {
            console.log('❌ 操作がキャンセルされました');
            process.exit(0);
        }

        // 再計算実行
        const results = await recalculator.recalculateReports(reports);

        // 変更の表示と確認
        const updatedResults = await recalculator.displayAndConfirmChanges(results);

        // 結果サマリー表示
        recalculator.displayRecalculationSummary(updatedResults);

        console.log('✨ レポートの再計算が完了しました');
        process.exit(0);
    } catch (error) {
        console.error('❌ バッチ処理中にエラーが発生しました', error);
        process.exit(1);
    }
}

// スクリプト実行
main();