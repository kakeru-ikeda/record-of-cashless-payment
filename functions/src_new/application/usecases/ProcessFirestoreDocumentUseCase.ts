import { ResponseHelper } from '../../../../shared/presentation/responses/ResponseHelper';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { ReportProcessingService } from '../services/ReportProcessingService';

/**
 * Firestoreドキュメント処理ユースケース
 * ドキュメント作成イベントをトリガーとしたレポート処理のビジネスロジックを管理
 */
export class ProcessFirestoreDocumentUseCase {
    constructor(
        private readonly reportProcessingService: ReportProcessingService
    ) { }

    /**
     * Firestoreドキュメント作成イベントを処理
     */
    async execute(event): Promise<any> {
        console.log('🚀 処理開始 - ドキュメントパス:', event.params);

        // パスチェック
        const path = event.data?.ref.path;
        console.log('📂 ドキュメントパス:', path);

        if (path && path.includes('/reports')) {
            console.log('⚠️ レポートドキュメントには処理をスキップします:', path);
            return ResponseHelper.success('レポートドキュメントのため処理をスキップしました', {});
        }

        const params = event.params;
        const document = event.data;

        if (!document) {
            throw new AppError('ドキュメントが存在しません', ErrorType.NOT_FOUND);
        }

        const data = document.data();
        if (!data) {
            throw new AppError('ドキュメントデータが存在しません', ErrorType.NOT_FOUND);
        }

        console.log('📊 レポート処理を開始します...');

        // 1. デイリーレポート処理
        console.log('📆 デイリーレポート処理中...');
        const dailyReport = await this.reportProcessingService.processDailyReport(document, data, params);

        // 2. ウィークリーレポート処理
        console.log('📅 ウィークリーレポート処理中...');
        const weeklyReport = await this.reportProcessingService.processWeeklyReport(document, data, params);

        // 3. マンスリーレポート処理
        console.log('📅 マンスリーレポート処理中...');
        const monthlyReport = await this.reportProcessingService.processMonthlyReport(document, data, params);

        // 処理結果を返す
        return ResponseHelper.success('全てのレポート処理が完了しました', {
            dailyReport: dailyReport,
            weeklyReport: weeklyReport,
            monthlyReport: monthlyReport,
        });
    }
}
