import { FirestoreService } from '../../../../shared/infrastructure/database/FirestoreService';
import { logger } from '../../../../shared/infrastructure/logging/Logger';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { CardUsageDocument } from '../../domain/entities/ReportRecalculation';

/**
 * Firestoreデータ探索サービス
 * details階層を探索してカード利用データを取得する
 */
export class FirestoreDataExplorerService {
    private readonly serviceContext = 'Firestore Data Explorer Service';

    constructor(
        private readonly firestoreService: FirestoreService
    ) { }

    /**
     * 指定された日付範囲のカード利用データを探索
     * @param startDate 開始日
     * @param endDate 終了日
     * @returns カード利用データのリスト
     */
    async exploreCardUsageData(startDate: Date, endDate: Date): Promise<CardUsageDocument[]> {
        logger.info(`カード利用データ探索開始: ${startDate.toISOString()} - ${endDate.toISOString()}`, this.serviceContext);

        const cardUsageDocuments: CardUsageDocument[] = [];
        const errors: string[] = [];

        try {
            // Cloud Functions環境では、デバッグ調査をスキップ（ログが冗長になるため）
            const isCloudFunctions = process.env.FUNCTIONS_EMULATOR === 'true' ||
                process.env.FUNCTION_TARGET != null ||
                process.env.K_SERVICE != null;
            if (!isCloudFunctions) {
                // まず、detailsコレクションの構造を確認
                await this.debugFirestoreStructure();
            }

            // 年月のリストを生成
            const yearMonthPairs = this.generateYearMonthPairs(startDate, endDate);
            logger.info(`生成された年月ペア: ${JSON.stringify(yearMonthPairs)}`, this.serviceContext);

            for (const { year, month } of yearMonthPairs) {
                logger.info(`処理中: ${year}年${month}月`, this.serviceContext);

                try {
                    const monthData = await this.exploreMonthData(year, month, startDate, endDate);
                    logger.info(`${year}年${month}月から取得したデータ: ${monthData.length}件`, this.serviceContext);
                    cardUsageDocuments.push(...monthData);
                } catch (error) {
                    /* eslint-disable-next-line */
                    const errorMessage = `${year}年${month}月の処理中にエラー: ${error instanceof Error ? error.message : String(error)}`;
                    logger.error(new Error(errorMessage), this.serviceContext);
                    errors.push(errorMessage);
                }
            }

            logger.info(`カード利用データ探索完了: ${cardUsageDocuments.length}件取得`, this.serviceContext);

            if (errors.length > 0) {
                logger.warn(`探索中に${errors.length}件のエラーが発生しました`, this.serviceContext);
                errors.forEach((error) => logger.warn(error, this.serviceContext));
            }

            return cardUsageDocuments;
        } catch (error) {
            const appError = new AppError(
                'カード利用データ探索中にエラーが発生しました',
                ErrorType.FIREBASE,
                { startDate, endDate },
                error instanceof Error ? error : undefined
            );
            logger.error(appError, this.serviceContext);
            throw appError;
        }
    }

    /**
     * 指定された年月のデータを探索
     */
    private async exploreMonthData(
        year: string,
        month: string,
        startDate: Date,
        endDate: Date
    ): Promise<CardUsageDocument[]> {
        const cardUsageDocuments: CardUsageDocument[] = [];

        // termのリストを探索（通常はterm1〜term5だが、動的に探索）
        const detailsBasePath = `details/${year}/${month}`;
        logger.info(`月データ探索開始: ${detailsBasePath}`, this.serviceContext);

        try {
            // 利用可能なterm（週）を取得
            const terms = await this.getAvailableTerms(detailsBasePath);
            logger.info(`発見されたterm: ${JSON.stringify(terms)} (パス: ${detailsBasePath})`, this.serviceContext);

            if (terms.length === 0) {
                logger.warn(`termが見つかりませんでした: ${detailsBasePath}`, this.serviceContext);
                return cardUsageDocuments;
            }

            for (const term of terms) {
                const termPath = `${detailsBasePath}/${term}`;
                logger.info(`term処理開始: ${termPath}`, this.serviceContext);

                try {
                    const termData =
                        await this.exploreTermData(termPath, year, month, term, startDate, endDate);
                    logger.info(`${termPath}から取得したデータ: ${termData.length}件`, this.serviceContext);
                    cardUsageDocuments.push(...termData);
                } catch (error) {
                    /* eslint-disable-next-line */
                    logger.warn(`${termPath}の処理中にエラー: ${error instanceof Error ? error.message : String(error)}`, this.serviceContext);
                }
            }
        } catch (error) {
            /* eslint-disable-next-line */
            logger.warn(`${detailsBasePath}のterm探索中にエラー: ${error instanceof Error ? error.message : String(error)}`, this.serviceContext);
        }

        /* eslint-disable-next-line */
        logger.info(`月データ探索完了: ${detailsBasePath} - ${cardUsageDocuments.length}件取得`, this.serviceContext);
        return cardUsageDocuments;
    }

    /**
     * 指定されたterm（週）のデータを探索
     */
    private async exploreTermData(
        termPath: string,
        year: string,
        month: string,
        term: string,
        startDate: Date,
        endDate: Date
    ): Promise<CardUsageDocument[]> {
        const cardUsageDocuments: CardUsageDocument[] = [];

        try {
            // 利用可能な日を取得
            const days = await this.getAvailableDays(termPath);
            logger.info(`${termPath}で発見された日: ${JSON.stringify(days)}`, this.serviceContext);

            for (const day of days) {
                // 日付フィルタリング
                const currentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                if (currentDate < startDate || currentDate > endDate) {
                    /* eslint-disable-next-line */
                    logger.info(`日付フィルタで除外: ${year}/${month}/${day} (${currentDate.toISOString()})`, this.serviceContext);
                    continue;
                }

                const dayPath = `${termPath}/${day}`;
                logger.info(`日データ処理開始: ${dayPath}`, this.serviceContext);

                try {
                    const dayData = await this.exploreDayData(dayPath, year, month, term, day);
                    logger.info(`${dayPath}から取得したデータ: ${dayData.length}件`, this.serviceContext);
                    cardUsageDocuments.push(...dayData);
                } catch (error) {
                    /* eslint-disable-next-line */
                    logger.warn(`${dayPath}の処理中にエラー: ${error instanceof Error ? error.message : String(error)}`, this.serviceContext);
                }
            }
        } catch (error) {
            /* eslint-disable-next-line */
            logger.warn(`${termPath}の日探索中にエラー: ${error instanceof Error ? error.message : String(error)}`, this.serviceContext);
        }

        return cardUsageDocuments;
    }

    /**
     * 指定された日のデータを探索
     */
    private async exploreDayData(
        dayPath: string,
        year: string,
        month: string,
        term: string,
        day: string
    ): Promise<CardUsageDocument[]> {
        const cardUsageDocuments: CardUsageDocument[] = [];

        try {
            // その日のタイムスタンプドキュメントを全て取得
            const timestamps = await this.getAvailableTimestamps(dayPath);

            for (const timestamp of timestamps) {
                const documentPath = `${dayPath}/${timestamp}`;

                try {
                    // Firestoreのパス構造に合わせてドキュメントを取得
                    const db = await this.firestoreService.getDb();
                    const yearDocRef = db.collection('details').doc(year);
                    const monthCollectionRef = yearDocRef.collection(month);
                    const termDocRef = monthCollectionRef.doc(term);
                    const dayCollectionRef = termDocRef.collection(day);
                    const timestampDocRef = dayCollectionRef.doc(timestamp);

                    const doc = await timestampDocRef.get();
                    const documentData = doc.exists ? doc.data() : null;

                    if (documentData && typeof documentData.amount === 'number') {
                        cardUsageDocuments.push({
                            path: documentPath,
                            data: {
                                ...documentData,
                                amount: documentData.amount,
                                datetime_of_use: documentData.datetime_of_use?.toDate
                                    ? documentData.datetime_of_use.toDate()
                                    : new Date(documentData.datetime_of_use),
                            },
                            params: {
                                year,
                                month,
                                term,
                                day,
                                timestamp,
                            },
                        });
                    }
                } catch (error) {
                    /* eslint-disable-next-line */
                    logger.warn(`${documentPath}の取得中にエラー: ${error instanceof Error ? error.message : String(error)}`, this.serviceContext);
                }
            }
        } catch (error) {
            /* eslint-disable-next-line */
            logger.warn(`${dayPath}のタイムスタンプ探索中にエラー: ${error instanceof Error ? error.message : String(error)}`, this.serviceContext);
        }

        return cardUsageDocuments;
    }

    /**
     * 利用可能なterm（週）を取得
     */
    private async getAvailableTerms(basePath: string): Promise<string[]> {
        try {
            logger.info(`term探索開始: ${basePath}`, this.serviceContext);
            const db = await this.firestoreService.getDb();

            // basePath例: "details/2024/09"
            // これは details/{year}/{month} の形式
            const pathParts = basePath.split('/');
            if (pathParts.length !== 3) {
                logger.warn(`無効なbasePath: ${basePath}`, this.serviceContext);
                return [];
            }

            const [collectionName, year, month] = pathParts;

            // details/{year} をドキュメント参照、{month}をサブコレクションとして扱う
            const yearDocRef = db.collection(collectionName).doc(year);
            const monthCollectionRef = yearDocRef.collection(month);
            const termDocs = await monthCollectionRef.listDocuments();
            const termIds = termDocs.map((doc) => doc.id).sort();

            logger.info(`term探索結果: ${JSON.stringify(termIds)} (パス: ${basePath})`, this.serviceContext);
            return termIds;
        } catch (error) {
            // コレクションが存在しない場合は空配列を返す
            /* eslint-disable-next-line */
            logger.warn(`term探索エラー: ${basePath} - ${error instanceof Error ? error.message : String(error)}`, this.serviceContext);
            return [];
        }
    }

    /**
     * 利用可能な日を取得
     */
    private async getAvailableDays(termPath: string): Promise<string[]> {
        try {
            const db = await this.firestoreService.getDb();

            // termPath例: "details/2024/09/term1"
            const pathParts = termPath.split('/');
            if (pathParts.length !== 4) {
                return [];
            }

            const [collectionName, year, month, term] = pathParts;

            // details/{year}/{month}/{term} でtermドキュメントのサブコレクション（日）を取得
            const yearDocRef = db.collection(collectionName).doc(year);
            const monthCollectionRef = yearDocRef.collection(month);
            const termDocRef = monthCollectionRef.doc(term);
            const dayCollections = await termDocRef.listCollections();

            return dayCollections.map((collection) => collection.id)
                .sort((a, b) => parseInt(a) - parseInt(b));
        } catch (error) {
            return [];
        }
    }

    /**
     * 利用可能なタイムスタンプを取得
     */
    private async getAvailableTimestamps(dayPath: string): Promise<string[]> {
        try {
            const db = await this.firestoreService.getDb();

            // dayPath例: "details/2024/09/term1/1"
            const pathParts = dayPath.split('/');
            if (pathParts.length !== 5) {
                return [];
            }

            const [collectionName, year, month, term, day] = pathParts;

            // details/{year}/{month}/{term}/{day} でdayコレクション内のドキュメント（タイムスタンプ）を取得
            const yearDocRef = db.collection(collectionName).doc(year);
            const monthCollectionRef = yearDocRef.collection(month);
            const termDocRef = monthCollectionRef.doc(term);
            const dayCollectionRef = termDocRef.collection(day);
            const timestampSnapshot = await dayCollectionRef.get();

            return timestampSnapshot.docs.map((doc) => doc.id).sort();
        } catch (error) {
            return [];
        }
    }

    /**
     * 開始日と終了日から年月のペアを生成
     */
    private generateYearMonthPairs(startDate: Date, endDate: Date): { year: string; month: string }[] {
        const pairs: { year: string; month: string }[] = [];
        const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

        while (current <= end) {
            pairs.push({
                year: current.getFullYear().toString(),
                month: (current.getMonth() + 1).toString().padStart(2, '0'),
            });
            current.setMonth(current.getMonth() + 1);
        }

        return pairs;
    }

    /**
     * Firestoreのdetails構造をデバッグ用に確認
     */
    private async debugFirestoreStructure(): Promise<void> {
        try {
            logger.info('🔍 Firestoreデータ構造調査開始', this.serviceContext);
            const db = await this.firestoreService.getDb();

            // detailsコレクションの存在確認
            const detailsRef = db.collection('details');
            const detailsSnapshot = await detailsRef.listDocuments();

            if (detailsSnapshot.length === 0) {
                logger.warn('⚠️ detailsコレクションが空です', this.serviceContext);
                return;
            }

            /* eslint-disable-next-line */
            logger.info(`📁 detailsコレクション内の年ドキュメント数: ${detailsSnapshot.length}`, this.serviceContext);

            // 最初の数件の年ドキュメントを確認
            const years: string[] = [];
            detailsSnapshot.slice(0, 5).forEach((doc) => {
                years.push(doc.id);
                logger.info(`  📅 年: ${doc.id}`, this.serviceContext);
            });

            // 最初の年のサブコレクション（月）を確認
            if (years.length > 0) {
                const firstYear = years[0];
                const yearDoc = detailsRef.doc(firstYear);
                const monthCollections = await yearDoc.listCollections();
                const months = monthCollections.map((col) => col.id);
                logger.info(`📅 ${firstYear}年の月: ${JSON.stringify(months)}`, this.serviceContext);

                // 最初の月のドキュメント（term）を確認
                if (months.length > 0) {
                    const firstMonth = months[0];
                    const monthCollection = yearDoc.collection(firstMonth);
                    const termDocs = await monthCollection.listDocuments();
                    const terms = termDocs.map((doc) => doc.id);
                    logger.info(`📊 ${firstYear}年${firstMonth}月のterm: ${JSON.stringify(terms)}`, this.serviceContext);
                }
            }
        } catch (error) {
            /* eslint-disable-next-line */
            logger.error(new Error(`Firestore構造調査エラー: ${error instanceof Error ? error.message : String(error)}`), this.serviceContext);
        }
    }
}
