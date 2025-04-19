import * as admin from 'firebase-admin';

/**
 * ウィークリーレポートデータ
 */
export interface WeeklyReport {
    totalAmount: number;
    totalCount: number;
    lastUpdated: admin.firestore.FieldValue;
    lastUpdatedBy: string;
    documentIdList: string[];
    termStartDate: admin.firestore.Timestamp;
    termEndDate: admin.firestore.Timestamp;
    hasNotifiedLevel1: boolean;
    hasNotifiedLevel2: boolean;
    hasNotifiedLevel3: boolean;
    hasReportSent?: boolean; // 定期レポートとして送信済みかどうか
}

/**
 * デイリーレポートデータ
 */
export interface DailyReport {
    totalAmount: number;
    totalCount: number;
    lastUpdated: admin.firestore.FieldValue;
    lastUpdatedBy: string;
    documentIdList: string[];
    date: admin.firestore.Timestamp;
    hasNotified: boolean;
}

/**
 * マンスリーレポートデータ
 */
export interface MonthlyReport {
    totalAmount: number;
    totalCount: number;
    lastUpdated: admin.firestore.FieldValue;
    lastUpdatedBy: string;
    documentIdList: string[];
    monthStartDate: admin.firestore.Timestamp;
    monthEndDate: admin.firestore.Timestamp;
    hasNotifiedLevel1: boolean;
    hasNotifiedLevel2: boolean;
    hasNotifiedLevel3: boolean;
    hasReportSent?: boolean; // 定期レポートとして送信済みかどうか
}

/**
 * レポートの通知しきい値
 */
export const THRESHOLD = {
    LEVEL1: 1000,
    LEVEL2: 5000,
    LEVEL3: 10000,
};