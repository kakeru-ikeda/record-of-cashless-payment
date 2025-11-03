import { ReportThresholds } from '@shared/domain/entities/ReportThresholds';

/**
 * 設定情報リポジトリのインターフェース
 */
export interface IConfigRepository {
    /**
     * レポートのしきい値設定を取得する
     * @returns レポートしきい値設定
     */
    getReportThresholds(): Promise<ReportThresholds>;
}
