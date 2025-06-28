/**
 * レポートのしきい値定数
 * アラート機能で使用される金額のしきい値を定義
 */
export const REPORT_THRESHOLDS = {
    WEEKLY: {
        LEVEL1: 1000,
        LEVEL2: 5000,
        LEVEL3: 10000,
    },
    MONTHLY: {
        LEVEL1: 4000,
        LEVEL2: 20000,
        LEVEL3: 40000,
    },
} as const;

/**
 * しきい値レベルの型定義
 */
export type ThresholdLevel = 1 | 2 | 3;

/**
 * レポート種別の型定義
 */
export type ReportType = 'WEEKLY' | 'MONTHLY';
