import { ResponseHelper, Response } from '../../../../shared/presentation/responses/ResponseHelper';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { logger } from '../../../../shared/infrastructure/logging/Logger';
import { ReportProcessingService } from '../services/ReportProcessingService';
import { FirestoreDocumentCreatedEvent } from '../../domain/types/FirebaseFunctionTypes';

/**
 * カード利用データの型定義
 */
interface CardUsageData {
    amount: number;
    // 他の必要なプロパティがあれば追加
}

/**
 * Firestoreドキュメント処理ユースケース
 * ドキュメント作成イベントをトリガーとしたレポート処理のビジネスロジックを管理
 */
export class ProcessFirestoreDocumentUseCase {
    /**
     * コンストラクタ
     * @param reportProcessingService レポート処理サービス
     */
    constructor(
        private readonly reportProcessingService: ReportProcessingService
    ) { }

    /**
     * Firestoreドキュメント作成イベントを処理
     * @param event Firestoreイベント
     * @returns 処理結果
     */
    async execute(event: FirestoreDocumentCreatedEvent): Promise<Response> {
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

        // データの型チェック
        const cardUsageData = data as CardUsageData;
        if (typeof cardUsageData.amount !== 'number') {
            throw new AppError('無効なデータ形式：amountが数値ではありません', ErrorType.VALIDATION);
        }

        logger.info('レポート処理を開始します', 'Firestore Document UseCase');

        // 1. デイリーレポート処理
        logger.debug('デイリーレポート処理中', 'Firestore Document UseCase');
        const dailyReport = await this.reportProcessingService.processDailyReport(document, cardUsageData, params);

        // 2. ウィークリーレポート処理
        logger.debug('ウィークリーレポート処理中', 'Firestore Document UseCase');
        const weeklyReport = await this.reportProcessingService.processWeeklyReport(document, cardUsageData, params);

        // 3. マンスリーレポート処理
        logger.debug('マンスリーレポート処理中', 'Firestore Document UseCase');
        const monthlyReport = await this.reportProcessingService.processMonthlyReport(document, cardUsageData, params);

        // 処理結果を返す
        return ResponseHelper.success('全てのレポート処理が完了しました', {
            dailyReport: dailyReport,
            weeklyReport: weeklyReport,
            monthlyReport: monthlyReport,
        });
    }
}
