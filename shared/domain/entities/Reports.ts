import { Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * 日次レポートエンティティ
 */
export interface DailyReport {
    totalAmount: number;
    totalCount: number;
    lastUpdated: FieldValue;
    lastUpdatedBy: string;
    documentIdList: string[];
    date: Timestamp;
    hasNotified: boolean;
}

/**
 * 週次レポートエンティティ
 */
export interface WeeklyReport {
    totalAmount: number;
    totalCount: number;
    lastUpdated: FieldValue;
    lastUpdatedBy: string;
    documentIdList: string[];
    termStartDate: Timestamp;
    termEndDate: Timestamp;
    hasNotifiedLevel1: boolean;
    hasNotifiedLevel2: boolean;
    hasNotifiedLevel3: boolean;
    hasReportSent?: boolean; // 定期レポートとして送信済みかどうか
}

/**
 * 月次レポートエンティティ
 */
export interface MonthlyReport {
    totalAmount: number;
    totalCount: number;
    lastUpdated: FieldValue;
    lastUpdatedBy: string;
    documentIdList: string[];
    monthStartDate: Timestamp;
    monthEndDate: Timestamp;
    hasNotifiedLevel1: boolean;
    hasNotifiedLevel2: boolean;
    hasNotifiedLevel3: boolean;
    hasReportSent?: boolean; // 定期レポートとして送信済みかどうか
}
