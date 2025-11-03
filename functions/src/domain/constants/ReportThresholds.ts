/**
 * レポートのしきい値定数
 * @deprecated Firestoreの config/report_thresholds から取得するようになりました
 * このファイルは型定義のみを残しており、実際の値はFirestoreから取得されます
 */

/**
 * しきい値レベルの型定義
 */
export type ThresholdLevel = 1 | 2 | 3;

/**
 * レポート種別の型定義
 */
export type ReportType = 'WEEKLY' | 'MONTHLY';
