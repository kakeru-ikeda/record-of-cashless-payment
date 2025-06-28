import { ResponseHelper } from '../../../../shared/presentation/responses/ResponseHelper';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { logger } from '../../../../shared/infrastructure/logging/Logger';
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
        logger.info('処理開始', 'Firestore Document UseCase');
        logger.debug(`ドキュメントパス: ${JSON.stringify(event.params)}`, 'Firestore Document UseCase');

        // パスチェック
        const path = event.data?.ref.path;
        logger.debug(`ドキュメントパス: ${path}`, 'Firestore Document UseCase');

        if (path && path.includes('/reports')) {
            logger.warn(`レポートドキュメントには処理をスキップします: ${path}`, 'Firestore Document UseCase');
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

        logger.info('レポート処理を開始します', 'Firestore Document UseCase');

        // 1. デイリーレポート処理
        logger.debug('デイリーレポート処理中', 'Firestore Document UseCase');
        const dailyReport = await this.reportProcessingService.processDailyReport(document, data, params);

        // 2. ウィークリーレポート処理
        logger.debug('ウィークリーレポート処理中', 'Firestore Document UseCase');
        const weeklyReport = await this.reportProcessingService.processWeeklyReport(document, data, params);

        // 3. マンスリーレポート処理
        logger.debug('マンスリーレポート処理中', 'Firestore Document UseCase');
        const monthlyReport = await this.reportProcessingService.processMonthlyReport(document, data, params);

        // 処理結果を返す
        return ResponseHelper.success('全てのレポート処理が完了しました', {
            dailyReport: dailyReport,
            weeklyReport: weeklyReport,
            monthlyReport: monthlyReport,
        });
    }
}
