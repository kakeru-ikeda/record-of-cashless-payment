/**
 * 非アクティブなカード利用情報の物理削除バッチスクリプト
 * 
 * is_active: false となっている（論理削除された）カード利用情報を
 * Firestoreから物理的に削除するためのユーティリティスクリプト
 * 
 * 使用方法:
 * $ npx ts-node scripts/deleteInactiveCardUsages.ts
 */

import { Firestore, FieldValue } from 'firebase-admin/firestore';
import { FirestoreService } from '../shared/firebase/FirestoreService';
import { Environment } from '../shared/config/Environment';
import { CardUsage } from '../src/domain/entities/CardUsage';
import { DailyReport } from '../functions/src/services/reports/DailyReportService';
import { WeeklyReport } from '../functions/src/services/reports/WeeklyReportService';
import { MonthlyReport } from '../functions/src/services/reports/MonthlyReportService';
import * as readline from 'readline';

interface YearMonthRecord {
    year: string;
    month: string;
    termList: string[];
}

interface InactiveDocument {
    path: string;
    data: CardUsage;
}

interface ReportPath {
    dailyReportPath: string;
    weeklyReportPath: string;
    monthlyReportPath: string;
}

class InactiveCardUsageDeleter {
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
     * 特定の年月の非アクティブカード利用データを検索
     */
    async findInactiveDataForMonth(yearMonth: YearMonthRecord): Promise<InactiveDocument[]> {
        try {
            if (!this.db) throw new Error('Firestoreが初期化されていません');
            const { year, month, termList } = yearMonth;
            const inactiveDocuments: InactiveDocument[] = [];

            console.log(`🔍 ${year}年${month}月のデータを検索中...`);

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

                            // 非アクティブなデータを収集
                            if (data.is_active === false) {
                                const fullPath = `details/${year}/${month}/${term}/${day}/${timestamp}`;
                                inactiveDocuments.push({
                                    path: fullPath,
                                    data: data
                                });
                            }
                        }
                    }
                }
            }

            return inactiveDocuments;
        } catch (error) {
            console.error(`❌ ${yearMonth.year}年${yearMonth.month}月のデータ検索中にエラーが発生しました`, error);
            throw error;
        }
    }

    /**
     * 全ての年月の非アクティブデータを検索
     */
    async findAllInactiveData(): Promise<InactiveDocument[]> {
        try {
            // 年月データを取得
            const yearMonths = await this.getAvailableYearMonths();
            console.log(`📊 ${yearMonths.length}年月分のデータが見つかりました`);

            let allInactiveDocuments: InactiveDocument[] = [];

            // 各年月のデータを処理
            for (const yearMonth of yearMonths) {
                const inactiveDocuments = await this.findInactiveDataForMonth(yearMonth);
                allInactiveDocuments = [...allInactiveDocuments, ...inactiveDocuments];
                console.log(`📋 ${yearMonth.year}年${yearMonth.month}月: ${inactiveDocuments.length}件の非アクティブドキュメントが見つかりました`);
            }

            return allInactiveDocuments;
        } catch (error) {
            console.error('❌ 非アクティブデータの検索中にエラーが発生しました', error);
            throw error;
        }
    }

    /**
     * 非アクティブデータのリストを表示
     */
    displayInactiveDocuments(documents: InactiveDocument[]): void {
        console.log('\n===== 削除対象ドキュメント一覧 =====');
        console.log(`合計: ${documents.length}件の非アクティブドキュメントが見つかりました\n`);

        if (documents.length === 0) {
            console.log('削除対象のドキュメントはありません。');
            return;
        }

        // 見やすくするために最大表示件数を設定
        const maxDisplayCount = 20;
        const displayCount = Math.min(documents.length, maxDisplayCount);

        for (let i = 0; i < displayCount; i++) {
            const doc = documents[i];
            const date = doc.data.datetime_of_use.toDate().toLocaleDateString('ja-JP');
            console.log(`${i + 1}. パス: ${doc.path}`);
            console.log(`   金額: ${doc.data.amount}円`);
            console.log(`   利用日: ${date}`);
            console.log(`   利用場所: ${doc.data.where_to_use}`);
            console.log('   ---');
        }

        if (documents.length > maxDisplayCount) {
            console.log(`\n...他 ${documents.length - maxDisplayCount} 件のドキュメントが表示されていません`);
        }

        console.log('\n==================================\n');
    }

    /**
     * ドキュメントパスからパスパラメータを抽出する
     * @param path ドキュメントパス（例: details/2025/05/term1/03/1714713600000）
     * @returns 年月日・期間情報
     */
    private extractPathParams(path: string): { year: string; month: string; term: string; day: string } | null {
        // 日付が1桁の場合も対応できるよう修正
        const regex = /details\/(\d{4})\/(\d{2})\/([^\/]+)\/(\d{1,2})\/\d+/;
        const match = path.match(regex);

        if (!match) {
            console.error(`⚠️ パスのフォーマットが不正です: ${path}`);
            return null;
        }

        // 日付が1桁の場合はゼロパディング
        const day = match[4].padStart(2, '0');

        return {
            year: match[1],
            month: match[2],
            term: match[3],
            day: day
        };
    }

    /**
     * 日付から各種レポートパスを取得
     * @param year 年
     * @param month 月
     * @param term 期間（週）
     * @param day 日
     */
    private getReportPaths(year: string, month: string, term: string, day: string): ReportPath {
        // 月と日を2桁でフォーマット
        const paddedMonth = month.padStart(2, '0');
        const paddedDay = day.padStart(2, '0');

        // 正しいパス形式を使用
        const dailyReportPath = `reports/daily/${year}-${paddedMonth}/${paddedDay}`;
        const weeklyReportPath = `reports/weekly/${year}-${paddedMonth}/${term}`;
        const monthlyReportPath = `reports/monthly/${year}/${paddedMonth}`;

        return {
            dailyReportPath,
            weeklyReportPath,
            monthlyReportPath
        };
    }

    /**
     * レポートからドキュメントIDを削除
     * @param reportPath レポートのパス
     * @param documentPath 削除するドキュメントのパス
     * @param reportType レポートタイプ
     */
    private async updateReportDocumentList(
        reportPath: string,
        documentPath: string,
        reportType: 'daily' | 'weekly' | 'monthly'
    ): Promise<void> {
        try {
            // レポートデータを取得
            let reportData;
            switch (reportType) {
                case 'daily':
                    reportData = await this.firestoreService.getDocument<DailyReport>(reportPath);
                    break;
                case 'weekly':
                    reportData = await this.firestoreService.getDocument<WeeklyReport>(reportPath);
                    break;
                case 'monthly':
                    reportData = await this.firestoreService.getDocument<MonthlyReport>(reportPath);
                    break;
            }

            // レポートが存在しない場合は何もしない
            if (!reportData) {
                return;
            }

            // ドキュメントIDリストからパスを削除
            const updatedDocumentIdList = reportData.documentIdList.filter(id => id !== documentPath);

            // ドキュメントIDリストを更新
            await this.firestoreService.updateDocument(reportPath, {
                documentIdList: updatedDocumentIdList,
                lastUpdated: this.getServerTimestamp(),
                lastUpdatedBy: 'physical-delete-script'
            });

            console.log(`✨ ${reportType}レポート更新完了: ${reportPath}`);
        } catch (error) {
            console.error(`❌ ${reportType}レポート更新中にエラーが発生しました: ${reportPath}`, error);
        }
    }

    /**
     * サーバータイムスタンプを取得
     */
    private getServerTimestamp(): FirebaseFirestore.FieldValue {
        return FieldValue.serverTimestamp();
    }

    /**
     * ドキュメントの削除とレポート更新を実行
     * @param doc 削除対象ドキュメント
     */
    private async deleteDocumentAndUpdateReport(doc: InactiveDocument): Promise<boolean> {
        try {
            // ドキュメントのパスからパラメータを抽出
            const params = this.extractPathParams(doc.path);
            if (!params) {
                return false;
            }

            // レポートのパスを取得
            const { year, month, term, day } = params;
            const reportPaths = this.getReportPaths(year, month, term, day);

            // ドキュメントを削除
            await this.firestoreService.deleteDocument(doc.path);

            // 日次レポートを更新
            await this.updateReportDocumentList(
                reportPaths.dailyReportPath,
                doc.path,
                'daily'
            );

            // 週次レポートを更新
            await this.updateReportDocumentList(
                reportPaths.weeklyReportPath,
                doc.path,
                'weekly'
            );

            // 月次レポートを更新
            await this.updateReportDocumentList(
                reportPaths.monthlyReportPath,
                doc.path,
                'monthly'
            );

            return true;
        } catch (error) {
            console.error(`❌ ドキュメント削除エラー (${doc.path}):`, error);
            return false;
        }
    }

    /**
     * ドキュメントのリストを削除
     */
    async deleteDocuments(documents: InactiveDocument[]): Promise<number> {
        let deletedCount = 0;

        for (const doc of documents) {
            try {
                const success = await this.deleteDocumentAndUpdateReport(doc);
                if (success) {
                    deletedCount++;
                }

                // 進捗を表示（大量のドキュメントを削除する場合に便利）
                if (deletedCount % 10 === 0) {
                    console.log(`⏳ 進捗: ${deletedCount}/${documents.length}件を削除済み...`);
                }
            } catch (error) {
                console.error(`❌ ドキュメント削除エラー (${doc.path}):`, error);
            }
        }

        return deletedCount;
    }

    /**
     * ユーザーに確認を求める
     */
    async confirmDeletion(count: number): Promise<boolean> {
        if (count === 0) {
            console.log('❌ 削除対象のドキュメントがありません');
            return false;
        }

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise<boolean>((resolve) => {
            rl.question(`⚠️ 警告: この操作は${count}件の非アクティブなカード利用データを完全に削除します。\nこの操作は取り消せません。続行しますか？ (y/n): `, (answer) => {
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
        console.log('🚀 非アクティブカード利用データ削除バッチを開始します...');
        const deleter = new InactiveCardUsageDeleter();
        await deleter.initialize();

        // 非アクティブなデータを検索
        const inactiveDocuments = await deleter.findAllInactiveData();

        // 削除対象のドキュメントを表示
        deleter.displayInactiveDocuments(inactiveDocuments);

        // ユーザー確認
        const confirmed = await deleter.confirmDeletion(inactiveDocuments.length);
        if (!confirmed) {
            console.log('❌ 操作がキャンセルされました');
            process.exit(0);
        }

        // 削除実行
        const deletedCount = await deleter.deleteDocuments(inactiveDocuments);

        console.log(`✨ 削除完了! 合計${deletedCount}件の非アクティブドキュメントを削除しました`);
        console.log('   関連するレポートのドキュメントリストも更新しました');
        process.exit(0);
    } catch (error) {
        console.error('❌ バッチ処理中にエラーが発生しました', error);
        process.exit(1);
    }
}

// スクリプト実行
main();