import { DailyReport, WeeklyReport, MonthlyReport } from '@shared/domain/entities/Reports';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * DailyReportエンティティを生成するファクトリークラス
 */
export class DailyReportFactory {
    /**
     * 新しいDailyReportエンティティを作成する
     * @param date 対象日 (ISOフォーマット文字列またはTimestamp)
     * @param totalAmount 総金額
     * @param totalCount 総件数
     * @param lastUpdatedBy 最終更新者
     * @param documentIdList ドキュメントIDリスト
     * @param hasNotified 通知済みフラグ (デフォルトはfalse)
     * @returns 新しいDailyReportエンティティ
     */
    static create(
        date: string | Timestamp,
        totalAmount: number,
        totalCount: number,
        lastUpdatedBy: string,
        documentIdList: string[] = [],
        hasNotified = false
    ): DailyReport {
        return {
            totalAmount,
            totalCount,
            lastUpdated: FieldValue.serverTimestamp(),
            lastUpdatedBy,
            documentIdList,
            date: date instanceof Timestamp ? date : Timestamp.fromDate(new Date(date)),
            hasNotified,
        };
    }

    /**
     * 既存のデータからDailyReportエンティティを復元する
     * @param data 部分的なDailyReportデータ
     * @returns DailyReportエンティティ
     */
    static reconstruct(data: Partial<DailyReport> & {
        totalAmount: number,
        totalCount: number,
        lastUpdatedBy: string,
        documentIdList: string[],
        date: Timestamp,
        hasNotified: boolean
    }): DailyReport {
        return {
            totalAmount: data.totalAmount,
            totalCount: data.totalCount,
            lastUpdated: data.lastUpdated || FieldValue.serverTimestamp(),
            lastUpdatedBy: data.lastUpdatedBy,
            documentIdList: data.documentIdList,
            date: data.date,
            hasNotified: data.hasNotified,
        };
    }

    /**
     * 空のDailyReportエンティティを作成する（初期化用）
     * @param date 対象日
     * @param lastUpdatedBy 作成者
     * @returns 初期化されたDailyReportエンティティ
     */
    static createEmpty(date: string | Timestamp, lastUpdatedBy: string): DailyReport {
        return this.create(date, 0, 0, lastUpdatedBy, [], false);
    }
}

/**
 * WeeklyReportエンティティを生成するファクトリークラス
 */
export class WeeklyReportFactory {
    /**
     * 新しいWeeklyReportエンティティを作成する
     * @param termStartDate 期間開始日 (ISOフォーマット文字列またはTimestamp)
     * @param termEndDate 期間終了日 (ISOフォーマット文字列またはTimestamp)
     * @param totalAmount 総金額
     * @param totalCount 総件数
     * @param lastUpdatedBy 最終更新者
     * @param documentIdList ドキュメントIDリスト
     * @param hasNotifiedLevel1 レベル1通知済みフラグ (デフォルトはfalse)
     * @param hasNotifiedLevel2 レベル2通知済みフラグ (デフォルトはfalse)
     * @param hasNotifiedLevel3 レベル3通知済みフラグ (デフォルトはfalse)
     * @param hasReportSent レポート送信済みフラグ (デフォルトはfalse)
     * @returns 新しいWeeklyReportエンティティ
     */
    static create(
        termStartDate: string | Timestamp,
        termEndDate: string | Timestamp,
        totalAmount: number,
        totalCount: number,
        lastUpdatedBy: string,
        documentIdList: string[] = [],
        hasNotifiedLevel1 = false,
        hasNotifiedLevel2 = false,
        hasNotifiedLevel3 = false,
        hasReportSent = false
    ): WeeklyReport {
        return {
            totalAmount,
            totalCount,
            lastUpdated: FieldValue.serverTimestamp(),
            lastUpdatedBy,
            documentIdList,
// eslint-disable-next-line max-len
            termStartDate: termStartDate instanceof Timestamp ? termStartDate : Timestamp.fromDate(new Date(termStartDate)),
            termEndDate: termEndDate instanceof Timestamp ? termEndDate : Timestamp.fromDate(new Date(termEndDate)),
            hasNotifiedLevel1,
            hasNotifiedLevel2,
            hasNotifiedLevel3,
            hasReportSent,
        };
    }

    /**
     * 既存のデータからWeeklyReportエンティティを復元する
     * @param data 部分的なWeeklyReportデータ
     * @returns WeeklyReportエンティティ
     */
    static reconstruct(data: Partial<WeeklyReport> & {
        totalAmount: number,
        totalCount: number,
        lastUpdatedBy: string,
        documentIdList: string[],
        termStartDate: Timestamp,
        termEndDate: Timestamp,
        hasNotifiedLevel1: boolean,
        hasNotifiedLevel2: boolean,
        hasNotifiedLevel3: boolean
    }): WeeklyReport {
        return {
            totalAmount: data.totalAmount,
            totalCount: data.totalCount,
            lastUpdated: data.lastUpdated || FieldValue.serverTimestamp(),
            lastUpdatedBy: data.lastUpdatedBy,
            documentIdList: data.documentIdList,
            termStartDate: data.termStartDate,
            termEndDate: data.termEndDate,
            hasNotifiedLevel1: data.hasNotifiedLevel1,
            hasNotifiedLevel2: data.hasNotifiedLevel2,
            hasNotifiedLevel3: data.hasNotifiedLevel3,
            hasReportSent: data.hasReportSent || false,
        };
    }

    /**
     * 空のWeeklyReportエンティティを作成する（初期化用）
     * @param termStartDate 期間開始日
     * @param termEndDate 期間終了日
     * @param lastUpdatedBy 作成者
     * @returns 初期化されたWeeklyReportエンティティ
     */
    static createEmpty(
        termStartDate: string | Timestamp,
        termEndDate: string | Timestamp,
        lastUpdatedBy: string
    ): WeeklyReport {
        return this.create(
            termStartDate,
            termEndDate,
            0,
            0,
            lastUpdatedBy,
            [],
            false,
            false,
            false,
            false
        );
    }
}

/**
 * MonthlyReportエンティティを生成するファクトリークラス
 */
export class MonthlyReportFactory {
    /**
     * 新しいMonthlyReportエンティティを作成する
     * @param monthStartDate 月開始日 (ISOフォーマット文字列またはTimestamp)
     * @param monthEndDate 月終了日 (ISOフォーマット文字列またはTimestamp)
     * @param totalAmount 総金額
     * @param totalCount 総件数
     * @param lastUpdatedBy 最終更新者
     * @param documentIdList ドキュメントIDリスト
     * @param hasNotifiedLevel1 レベル1通知済みフラグ (デフォルトはfalse)
     * @param hasNotifiedLevel2 レベル2通知済みフラグ (デフォルトはfalse)
     * @param hasNotifiedLevel3 レベル3通知済みフラグ (デフォルトはfalse)
     * @param hasReportSent レポート送信済みフラグ (デフォルトはfalse)
     * @returns 新しいMonthlyReportエンティティ
     */
    static create(
        monthStartDate: string | Timestamp,
        monthEndDate: string | Timestamp,
        totalAmount: number,
        totalCount: number,
        lastUpdatedBy: string,
        documentIdList: string[] = [],
        hasNotifiedLevel1 = false,
        hasNotifiedLevel2 = false,
        hasNotifiedLevel3 = false,
        hasReportSent = false
    ): MonthlyReport {
        return {
            totalAmount,
            totalCount,
            lastUpdated: FieldValue.serverTimestamp(),
            lastUpdatedBy,
            documentIdList,
// eslint-disable-next-line max-len
            monthStartDate: monthStartDate instanceof Timestamp ? monthStartDate : Timestamp.fromDate(new Date(monthStartDate)),
            monthEndDate: monthEndDate instanceof Timestamp ? monthEndDate : Timestamp.fromDate(new Date(monthEndDate)),
            hasNotifiedLevel1,
            hasNotifiedLevel2,
            hasNotifiedLevel3,
            hasReportSent,
        };
    }

    /**
     * 既存のデータからMonthlyReportエンティティを復元する
     * @param data 部分的なMonthlyReportデータ
     * @returns MonthlyReportエンティティ
     */
    static reconstruct(data: Partial<MonthlyReport> & {
        totalAmount: number,
        totalCount: number,
        lastUpdatedBy: string,
        documentIdList: string[],
        monthStartDate: Timestamp,
        monthEndDate: Timestamp,
        hasNotifiedLevel1: boolean,
        hasNotifiedLevel2: boolean,
        hasNotifiedLevel3: boolean
    }): MonthlyReport {
        return {
            totalAmount: data.totalAmount,
            totalCount: data.totalCount,
            lastUpdated: data.lastUpdated || FieldValue.serverTimestamp(),
            lastUpdatedBy: data.lastUpdatedBy,
            documentIdList: data.documentIdList,
            monthStartDate: data.monthStartDate,
            monthEndDate: data.monthEndDate,
            hasNotifiedLevel1: data.hasNotifiedLevel1,
            hasNotifiedLevel2: data.hasNotifiedLevel2,
            hasNotifiedLevel3: data.hasNotifiedLevel3,
            hasReportSent: data.hasReportSent || false,
        };
    }

    /**
     * 空のMonthlyReportエンティティを作成する（初期化用）
     * @param monthStartDate 月開始日
     * @param monthEndDate 月終了日
     * @param lastUpdatedBy 作成者
     * @returns 初期化されたMonthlyReportエンティティ
     */
    static createEmpty(
        monthStartDate: string | Timestamp,
        monthEndDate: string | Timestamp,
        lastUpdatedBy: string
    ): MonthlyReport {
        return this.create(
            monthStartDate,
            monthEndDate,
            0,
            0,
            lastUpdatedBy,
            [],
            false,
            false,
            false,
            false
        );
    }
}
