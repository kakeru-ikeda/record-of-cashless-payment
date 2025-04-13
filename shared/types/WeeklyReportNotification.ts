/**
 * 週次レポート通知用のデータモデル
 * カード利用通知とは異なり、週次集計情報を格納する
 */
export interface WeeklyReportNotification {
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

    // 追加情報（任意）
    additionalInfo?: string;
}