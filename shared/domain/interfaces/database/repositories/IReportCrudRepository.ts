import { DailyReport, WeeklyReport, MonthlyReport } from '@shared/domain/entities/Reports';

/**
 * レポート情報のCRUD操作を提供するリポジトリインターフェース
 * Create(保存)、Read(取得)、Update(更新)、Delete(削除)を行う
 */
export interface IReportCrudRepository {
    /**
     * 初期化処理
     */
    initialize(): Promise<any>;

    /**
     * 日次レポートを取得する（特定の日）
     * @param year 年
     * @param month 月
     * @param day 日
     * @returns 日次レポート情報
     */
    getDailyReport(year: string, month: string, day: string): Promise<DailyReport | null>;

    /**
     * 月内の全日次レポートを取得する
     * @param year 年
     * @param month 月
     * @returns 日次レポート情報の配列
     */
    getMonthlyDailyReports(year: string, month: string): Promise<DailyReport[]>;

    /**
     * 月次レポートを取得する
     * @param year 年
     * @param month 月
     * @returns 月次レポート情報
     */
    getMonthlyReport(year: string, month: string): Promise<MonthlyReport | null>;

    /**
     * 週次レポートを取得する（特定の週）
     * @param year 年
     * @param month 月
     * @param term ターム（週番号）
     * @returns 週次レポート情報
     */
    getWeeklyReportByTerm(year: string, month: string, term: string): Promise<WeeklyReport | null>;

    /**
     * 月内の全週次レポートを取得する
     * @param year 年
     * @param month 月
     * @returns 週次レポート情報の配列
     */
    getMonthlyWeeklyReports(year: string, month: string): Promise<WeeklyReport[]>;

    /**
     * 日次レポートを保存する
     * @param report 日次レポート情報
     * @param year 年
     * @param month 月
     * @param day 日
     * @returns 保存されたパス
     */
    saveDailyReport(report: DailyReport, year: string, month: string, day: string): Promise<string>;

    /**
     * 週次レポートを保存する
     * @param report 週次レポート情報
     * @param year 年
     * @param month 月
     * @param term ターム（週番号）
     * @returns 保存されたパス
     */
    saveWeeklyReport(report: WeeklyReport, year: string, month: string): Promise<string>;

    /**
     * 月次レポートを保存する
     * @param report 月次レポート情報
     * @param year 年
     * @param month 月
     * @returns 保存されたパス
     */
    saveMonthlyReport(report: MonthlyReport, year: string, month: string): Promise<string>;

    // Update Operations
    /**
     * 日次レポートを更新する
     * @param report 日次レポート情報
     * @param year 年
     * @param month 月
     * @param day 日
     * @returns 更新されたパス
     */
    updateDailyReport(report: Partial<DailyReport>, year: string, month: string, day: string): Promise<string>;

    /**
     * 週次レポートを更新する
     * @param report 週次レポート情報
     * @param year 年
     * @param month 月
     * @param term ターム（週番号）
     * @returns 更新されたパス
     */
    updateWeeklyReport(report: Partial<WeeklyReport>, year: string, month: string, term: string): Promise<string>;

    /**
     * 月次レポートを更新する
     * @param report 月次レポート情報
     * @param year 年
     * @param month 月
     * @returns 更新されたパス
     */
    updateMonthlyReport(report: Partial<MonthlyReport>, year: string, month: string): Promise<string>;
}
