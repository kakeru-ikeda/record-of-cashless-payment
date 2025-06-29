import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { DailyReport, WeeklyReport, MonthlyReport } from '../../../shared/domain/entities/Reports';
import { IReportCrudRepository } from '../../../shared/domain/interfaces/database/repositories/IReportCrudRepository';

/**
 * インテグレーションテスト用のモックレポートリポジトリ
 * 実際のデータベースアクセスをシミュレートする
 */
export class MockReportRepository implements IReportCrudRepository {
    private dailyReports: Map<string, DailyReport> = new Map();
    private weeklyReports: Map<string, WeeklyReport> = new Map();
    private monthlyReports: Map<string, MonthlyReport> = new Map();
    private initialized = false;

    async initialize(): Promise<any> {
        this.initialized = true;
        return Promise.resolve();
    }

    /**
     * 日次レポートを取得する
     */
    async getDailyReport(year: string, month: string, day: string): Promise<DailyReport | null> {
        if (!this.initialized) {
            throw new Error('Repository not initialized');
        }

        const key = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        return this.dailyReports.get(key) || null;
    }

    /**
     * 月内の全日次レポートを取得する
     */
    async getMonthlyDailyReports(year: string, month: string): Promise<DailyReport[]> {
        if (!this.initialized) {
            throw new Error('Repository not initialized');
        }

        const prefix = `${year}-${month.padStart(2, '0')}`;
        const reports: DailyReport[] = [];

        for (const [key, report] of this.dailyReports.entries()) {
            if (key.startsWith(prefix)) {
                reports.push(report);
            }
        }

        return reports.sort((a, b) => {
            const dateA = a.date as any;
            const dateB = b.date as any;
            return dateA.seconds - dateB.seconds;
        });
    }

    /**
     * 月次レポートを取得する
     */
    async getMonthlyReport(year: string, month: string): Promise<MonthlyReport | null> {
        if (!this.initialized) {
            throw new Error('Repository not initialized');
        }

        const key = `${year}-${month.padStart(2, '0')}`;
        return this.monthlyReports.get(key) || null;
    }

    /**
     * 週次レポートを取得する
     */
    async getWeeklyReportByTerm(year: string, month: string, term: string): Promise<WeeklyReport | null> {
        if (!this.initialized) {
            throw new Error('Repository not initialized');
        }

        const key = `${year}-${month.padStart(2, '0')}-term${term}`;
        return this.weeklyReports.get(key) || null;
    }

    /**
     * 月内の全週次レポートを取得する
     */
    async getMonthlyWeeklyReports(year: string, month: string): Promise<WeeklyReport[]> {
        if (!this.initialized) {
            throw new Error('Repository not initialized');
        }

        const prefix = `${year}-${month.padStart(2, '0')}`;
        const reports: WeeklyReport[] = [];

        for (const [key, report] of this.weeklyReports.entries()) {
            if (key.startsWith(prefix)) {
                reports.push(report);
            }
        }

        return reports.sort((a, b) => {
            const dateA = a.termStartDate as any;
            const dateB = b.termStartDate as any;
            return dateA.seconds - dateB.seconds;
        });
    }

    /**
     * 日次レポートを保存する
     */
    async saveDailyReport(report: DailyReport, year: string, month: string, day: string): Promise<string> {
        if (!this.initialized) {
            throw new Error('Repository not initialized');
        }

        const key = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        const path = `reports/${year}/${month}/daily/${day}`;

        this.dailyReports.set(key, report);
        return path;
    }

    /**
     * 週次レポートを保存する
     */
    async saveWeeklyReport(report: WeeklyReport, year: string, month: string): Promise<string> {
        if (!this.initialized) {
            throw new Error('Repository not initialized');
        }

        // termStartDateからターム番号を計算（簡易版）
        const termStartDate = report.termStartDate as any;
        const day = new Date(termStartDate.seconds * 1000).getDate();
        const term = Math.ceil(day / 7).toString();

        const key = `${year}-${month.padStart(2, '0')}-term${term}`;
        const path = `reports/${year}/${month}/weekly/term${term}`;

        this.weeklyReports.set(key, report);
        return path;
    }

    /**
     * 月次レポートを保存する
     */
    async saveMonthlyReport(report: MonthlyReport, year: string, month: string): Promise<string> {
        if (!this.initialized) {
            throw new Error('Repository not initialized');
        }

        const key = `${year}-${month.padStart(2, '0')}`;
        const path = `reports/${year}/${month}/monthly`;

        this.monthlyReports.set(key, report);
        return path;
    }

    /**
     * 日次レポートを更新する
     */
    async updateDailyReport(report: Partial<DailyReport>, year: string, month: string, day: string): Promise<string> {
        if (!this.initialized) {
            throw new Error('Repository not initialized');
        }

        const key = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        const existing = this.dailyReports.get(key);

        if (!existing) {
            throw new Error('Report not found');
        }

        const updated = { ...existing, ...report };
        this.dailyReports.set(key, updated);
        return `reports/${year}/${month}/daily/${day}`;
    }

    /**
     * 週次レポートを更新する
     */
    async updateWeeklyReport(report: Partial<WeeklyReport>, year: string, month: string, term: string): Promise<string> {
        if (!this.initialized) {
            throw new Error('Repository not initialized');
        }

        const key = `${year}-${month.padStart(2, '0')}-term${term}`;
        const existing = this.weeklyReports.get(key);

        if (!existing) {
            throw new Error('Report not found');
        }

        const updated = { ...existing, ...report };
        this.weeklyReports.set(key, updated);
        return `reports/${year}/${month}/weekly/term${term}`;
    }

    /**
     * 月次レポートを更新する
     */
    async updateMonthlyReport(report: Partial<MonthlyReport>, year: string, month: string): Promise<string> {
        if (!this.initialized) {
            throw new Error('Repository not initialized');
        }

        const key = `${year}-${month.padStart(2, '0')}`;
        const existing = this.monthlyReports.get(key);

        if (!existing) {
            throw new Error('Report not found');
        }

        const updated = { ...existing, ...report };
        this.monthlyReports.set(key, updated);
        return `reports/${year}/${month}/monthly`;
    }

    // テスト用のヘルパーメソッド

    /**
     * すべてのデータをクリアする
     */
    clearAll(): void {
        this.dailyReports.clear();
        this.weeklyReports.clear();
        this.monthlyReports.clear();
    }

    /**
     * テストデータを作成する
     */
    createTestData(): void {
        const now = Timestamp.now();
        const serverTimestamp = FieldValue.serverTimestamp();

        // 日次レポートのテストデータ
        const dailyReport: DailyReport = {
            totalAmount: 5000,
            totalCount: 3,
            lastUpdated: serverTimestamp,
            lastUpdatedBy: 'test-system',
            documentIdList: ['doc1', 'doc2', 'doc3'],
            date: now,
            hasNotified: false
        };

        // 週次レポートのテストデータ
        const weeklyReport: WeeklyReport = {
            totalAmount: 35000,
            totalCount: 21,
            lastUpdated: serverTimestamp,
            lastUpdatedBy: 'test-system',
            documentIdList: ['doc1', 'doc2', 'doc3', 'doc4', 'doc5'],
            termStartDate: now,
            termEndDate: now,
            hasNotifiedLevel1: false,
            hasNotifiedLevel2: false,
            hasNotifiedLevel3: false,
            hasReportSent: false
        };

        // 月次レポートのテストデータ
        const monthlyReport: MonthlyReport = {
            totalAmount: 150000,
            totalCount: 90,
            lastUpdated: serverTimestamp,
            lastUpdatedBy: 'test-system',
            documentIdList: ['doc1', 'doc2', 'doc3', 'doc4', 'doc5', 'doc6'],
            monthStartDate: now,
            monthEndDate: now,
            hasNotifiedLevel1: false,
            hasNotifiedLevel2: false,
            hasNotifiedLevel3: false,
            hasReportSent: false
        };

        // 2024年6月のテストデータを作成
        this.dailyReports.set('2024-06-15', dailyReport);
        this.weeklyReports.set('2024-06-term3', weeklyReport);
        this.monthlyReports.set('2024-06', monthlyReport);
    }
}
