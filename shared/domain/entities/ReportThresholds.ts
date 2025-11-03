/**
 * レポートのしきい値エンティティ
 * Firestoreから取得される金額のしきい値を表現
 */
export interface ThresholdLevels {
    level1: number;
    level2: number;
    level3: number;
}

/**
 * レポートしきい値設定
 */
export interface ReportThresholds {
    weekly: ThresholdLevels;
    monthly: ThresholdLevels;
}
