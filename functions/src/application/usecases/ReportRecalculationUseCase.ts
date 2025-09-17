import { FirestoreDataExplorerService } from '../../infrastructure/services/FirestoreDataExplorerService';
import { ReportProcessingService } from '../services/ReportProcessingService';
import {
    ReportRecalculationRequest,
    ReportRecalculationResult,
    ReportRecalculationError,
    CardUsageDocument,
} from '../../domain/entities/ReportRecalculation';
import { logger } from '../../../../shared/infrastructure/logging/Logger';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { ResponseHelper, Response } from '../../../../shared/presentation/responses/ResponseHelper';

/**
 * レポート再集計ユースケース
 * Firestoreのdetailsデータを探索して、Daily/Weekly/Monthlyレポートを再生成する
 */
export class ReportRecalculationUseCase {
    private readonly serviceContext = 'Report Recalculation UseCase';

    constructor(
        private readonly dataExplorerService: FirestoreDataExplorerService,
        private readonly reportProcessingService: ReportProcessingService
    ) { }

    /**
     * レポート再集計を実行
     * @param request 再集計リクエスト
     * @returns 処理結果
     */
    async execute(request: ReportRecalculationRequest): Promise<Response> {
        const startTime = new Date();
        const result: ReportRecalculationResult = {
            startTime,
            endTime: new Date(),
            totalCardUsageProcessed: 0,
            reportsCreated: { daily: 0, weekly: 0, monthly: 0 },
            reportsUpdated: { daily: 0, weekly: 0, monthly: 0 },
            errors: [],
            success: false,
            executedBy: request.executedBy,
            dryRun: request.dryRun || false,
        };

        try {
            /* eslint-disable-next-line */
            logger.info(`レポート再集計開始: ${request.startDate.toISOString()} - ${request.endDate.toISOString()}`, this.serviceContext);
            logger.info(`対象レポートタイプ: ${request.reportTypes.join(', ')}`, this.serviceContext);
            logger.info(`ドライラン: ${result.dryRun}`, this.serviceContext);

            // 1. カード利用データを探索
            const cardUsageDocuments = await this.dataExplorerService.exploreCardUsageData(
                request.startDate,
                request.endDate
            );

            logger.info(`発見されたカード利用データ: ${cardUsageDocuments.length}件`, this.serviceContext);
            result.totalCardUsageProcessed = cardUsageDocuments.length;

            if (cardUsageDocuments.length === 0) {
                logger.warn('処理対象のカード利用データが見つかりませんでした', this.serviceContext);
                result.endTime = new Date();
                result.success = true;

                return ResponseHelper.success('処理対象のデータが見つかりませんでした', result);
            }

            // 2. ドライランの場合は処理詳細を表示して終了
            if (result.dryRun) {
                return this.handleDryRun(cardUsageDocuments, request, result);
            }

            // 3. 各カード利用データに対してレポート処理を実行
            let processedCount = 0;
            const batchSize = 50; // バッチサイズ

            for (let i = 0; i < cardUsageDocuments.length; i += batchSize) {
                const batch = cardUsageDocuments.slice(i, i + batchSize);

                /* eslint-disable-next-line */
                logger.info(`バッチ処理 ${Math.floor(i / batchSize) + 1}/${Math.ceil(cardUsageDocuments.length / batchSize)}: ${batch.length}件`, this.serviceContext);

                for (const cardUsage of batch) {
                    try {
                        await this.processCardUsageDocument(cardUsage, request, result);
                        processedCount++;
                    } catch (error) {
                        const errorInfo: ReportRecalculationError = {
                            documentPath: cardUsage.path,
                            message: error instanceof Error ? error.message : String(error),
                            details: error instanceof AppError ? error.details : undefined,
                        };
                        result.errors.push(errorInfo);
                        logger.error(error as Error, this.serviceContext);
                    }
                }

                // バッチ間での短い待機
                if (i + batchSize < cardUsageDocuments.length) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
            }

            result.endTime = new Date();
            result.success = result.errors.length === 0 || result.errors.length < cardUsageDocuments.length * 0.1;

            const duration = result.endTime.getTime() - result.startTime.getTime();
            logger.info(`レポート再集計完了: ${duration}ms`, this.serviceContext);
            logger.info(`処理済み: ${processedCount}件, エラー: ${result.errors.length}件`, this.serviceContext);
            /* eslint-disable-next-line */
            logger.info(`作成レポート - Daily: ${result.reportsCreated.daily}, Weekly: ${result.reportsCreated.weekly}, Monthly: ${result.reportsCreated.monthly}`, this.serviceContext);
            /* eslint-disable-next-line */
            logger.info(`更新レポート - Daily: ${result.reportsUpdated.daily}, Weekly: ${result.reportsUpdated.weekly}, Monthly: ${result.reportsUpdated.monthly}`, this.serviceContext);

            if (result.success) {
                return ResponseHelper.success('レポート再集計が完了しました', result);
            } else {
                return ResponseHelper.createResponse(500, false, 'レポート再集計中に多数のエラーが発生しました', result);
            }
        } catch (error) {
            result.endTime = new Date();
            result.success = false;

            const appError = new AppError(
                'レポート再集計中に予期しないエラーが発生しました',
                ErrorType.GENERAL,
                request,
                error instanceof Error ? error : undefined
            );

            logger.error(appError, this.serviceContext);
            return ResponseHelper.createResponse(500, false, appError.message, result);
        }
    }

    /**
     * ドライラン処理
     */
    private async handleDryRun(
        cardUsageDocuments: CardUsageDocument[],
        request: ReportRecalculationRequest,
        result: ReportRecalculationResult
    ): Promise<Response> {
        logger.info('=== ドライラン結果 ===', this.serviceContext);

        // 日付別の統計
        const dateStats = new Map<string, { count: number; totalAmount: number }>();

        cardUsageDocuments.forEach((doc) => {
            const dateKey = `${doc.params.year}-${doc.params.month}-${doc.params.day}`;
            const existing = dateStats.get(dateKey) || { count: 0, totalAmount: 0 };
            existing.count++;
            existing.totalAmount += doc.data.amount;
            dateStats.set(dateKey, existing);
        });

        // レポートタイプ別の予想処理数
        const expectedProcessing = {
            daily: request.reportTypes.includes('daily') ? dateStats.size : 0,
            weekly: 0,
            monthly: 0,
        };

        if (request.reportTypes.includes('weekly')) {
            const weekStats = new Set<string>();
            cardUsageDocuments.forEach((doc) => {
                weekStats.add(`${doc.params.year}-${doc.params.month}-${doc.params.term}`);
            });
            expectedProcessing.weekly = weekStats.size;
        }

        if (request.reportTypes.includes('monthly')) {
            const monthStats = new Set<string>();
            cardUsageDocuments.forEach((doc) => {
                monthStats.add(`${doc.params.year}-${doc.params.month}`);
            });
            expectedProcessing.monthly = monthStats.size;
        }

        /* eslint-disable-next-line */
        logger.info(`処理予定 - Daily: ${expectedProcessing.daily}, Weekly: ${expectedProcessing.weekly}, Monthly: ${expectedProcessing.monthly}`, this.serviceContext);

        // 日付別詳細（上位10件）
        const sortedDates = Array.from(dateStats.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(0, 10);

        sortedDates.forEach(([date, stats]) => {
            logger.info(`${date}: ${stats.count}件, 合計金額: ${stats.totalAmount}円`, this.serviceContext);
        });

        if (dateStats.size > 10) {
            logger.info(`... 他 ${dateStats.size - 10}日分`, this.serviceContext);
        }

        result.endTime = new Date();
        result.success = true;

        return ResponseHelper.success('ドライラン完了', {
            ...result,
            expectedProcessing,
            dateStats: Object.fromEntries(Array.from(dateStats.entries())),
        });
    }

    /**
     * 単一のカード利用ドキュメントを処理
     */
    private async processCardUsageDocument(
        cardUsage: CardUsageDocument,
        request: ReportRecalculationRequest,
        result: ReportRecalculationResult
    ): Promise<void> {
        // Firestoreドキュメントスナップショットを模擬
        const mockDocument = {
            ref: { path: cardUsage.path },
            data: () => cardUsage.data,
        } as any;

        const data = { amount: cardUsage.data.amount };
        const params = cardUsage.params;

        // 各レポートタイプを処理
        for (const reportType of request.reportTypes) {
            try {
                switch (reportType) {
                    case 'daily':
                        await this.reportProcessingService.processDailyReport(mockDocument, data, params);
                        result.reportsCreated.daily++; // 実際は作成/更新を区別する必要があるが、簡略化
                        break;

                    case 'weekly':
                        await this.reportProcessingService.processWeeklyReport(mockDocument, data, params);
                        result.reportsCreated.weekly++;
                        break;

                    case 'monthly':
                        await this.reportProcessingService.processMonthlyReport(mockDocument, data, params);
                        result.reportsCreated.monthly++;
                        break;
                }
            } catch (error) {
                throw new AppError(
                    `${reportType}レポート処理中にエラー`,
                    ErrorType.GENERAL,
                    { cardUsage, reportType },
                    error instanceof Error ? error : undefined
                );
            }
        }
    }
}
