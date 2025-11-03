/**
 * ウィークリーレポート通知用のデータモデル
 * カード利用通知とは異なり、週次集計情報を格納する
 */
export interface WeeklyReportNotificationDTO {
    // レポートタイトル（例: 2025年4月 第2週 レポート）
    title: string;

    // 対象期間（例: 2025/04/01 〜 2025/04/07）
    period: string;

    // 合計金額
    totalAmount: number;

    // 利用件数
    totalCount: number;

    // アラートレベル（0: 通常、1: 1000円超過、2: 5000円超過、3: 10000円超過）
    alertLevel: number;

    // 当月累計金額（オプショナル）
    monthToDateAmount?: number;

    // 追加情報（任意）
    additionalInfo?: string;
}

/**
 * デイリーレポート通知用のデータモデル
 */
export interface DailyReportNotificationDTO {
    // レポートタイトル（例: 2025年4月19日 デイリーレポート）
    title: string;

    // 対象日付（例: 2025/04/19）
    date: string;

    // 合計金額
    totalAmount: number;

    // 利用件数
    totalCount: number;

    // 当月累計金額（オプショナル）
    monthToDateAmount?: number;

    // 追加情報（任意）
    additionalInfo?: string;
}

/**
 * マンスリーレポート通知用のデータモデル
 */
export interface MonthlyReportNotificationDTO {
    // レポートタイトル（例: 2025年4月 マンスリーレポート）
    title: string;

    // 対象期間（例: 2025/04/01 〜 2025/04/30）
    period: string;

    // 合計金額
    totalAmount: number;

    // 利用件数
    totalCount: number;

    // アラートレベル（0: 通常、1: 4000円超過、2: 20000円超過、3: 40000円超過）
    alertLevel: number;

    // 追加情報（任意）
    additionalInfo?: string;
}
