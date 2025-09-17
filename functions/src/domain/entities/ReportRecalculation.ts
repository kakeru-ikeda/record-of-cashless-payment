/**
 * レポート再集計エンティティ
 * 再集計処理の状態と結果を管理
 */
export interface ReportRecalculationRequest {
    /** 処理開始日 */
    startDate: Date;
    /** 処理終了日 */
    endDate: Date;
    /** 再集計対象のレポートタイプ */
    reportTypes: ('daily' | 'weekly' | 'monthly')[];
    /** 実行者 */
    executedBy: string;
    /** ドライランかどうか */
    dryRun?: boolean;
}

/**
 * レポート再集計結果
 */
export interface ReportRecalculationResult {
    /** 処理開始時刻 */
    startTime: Date;
    /** 処理終了時刻 */
    endTime: Date;
    /** 処理されたカード利用データ数 */
    totalCardUsageProcessed: number;
    /** 作成されたレポート数 */
    reportsCreated: {
        daily: number;
        weekly: number;
        monthly: number;
    };
    /** 更新されたレポート数 */
    reportsUpdated: {
        daily: number;
        weekly: number;
        monthly: number;
    };
    /** エラー情報 */
    errors: ReportRecalculationError[];
    /** 成功かどうか */
    success: boolean;
    /** 実行者 */
    executedBy: string;
    /** ドライランかどうか */
    dryRun: boolean;
}

/**
 * レポート再集計エラー
 */
export interface ReportRecalculationError {
    /** エラーが発生したドキュメントパス */
    documentPath: string;
    /** エラーメッセージ */
    message: string;
    /** エラーの詳細 */
    details?: any;
}

/**
 * カード利用データの探索結果
 */
export interface CardUsageDocument {
    /** ドキュメントパス */
    path: string;
    /** ドキュメントデータ */
    data: {
        amount: number;
        datetime_of_use: Date;
        [key: string]: any;
    };
    /** パスパラメータ */
    params: {
        year: string;
        month: string;
        term: string;
        day: string;
        timestamp: string;
    };
}
