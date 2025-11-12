import { Firestore } from 'firebase-admin/firestore';
import { ReportThresholds, ThresholdLevels } from '@shared/domain/entities/ReportThresholds';
import { IConfigRepository } from '@shared/domain/interfaces/database/repositories/IConfigRepository';
import { Environment } from '@shared/infrastructure/config/Environment';
import { FirestoreService } from '@shared/infrastructure/database/FirestoreService';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';
import { logger } from '@shared/infrastructure/logging/Logger';
import { AppError, ErrorType } from '@shared/errors/AppError';

/**
 * Firestoreを使用した設定情報リポジトリの実装
 */
export class FirestoreConfigRepository implements IConfigRepository {
    private firestoreService: FirestoreService;
    private readonly serviceContext = 'FirestoreConfigRepository';
    private thresholdsCache: ReportThresholds | null = null;
    private cacheTimestamp = 0;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5分間キャッシュ

    constructor() {
        this.firestoreService = FirestoreService.getInstance();
    }

    /**
     * Firestoreへの接続を初期化する
     */
    @ErrorHandler.errorDecorator('FirestoreConfigRepository', {
        defaultMessage: 'Firestoreの初期化に失敗しました',
    })
    async initialize(): Promise<Firestore> {
        // Cloud Functions環境の判定
        const isCloudFunctions = Environment.isCloudFunctions();
        this.firestoreService.setCloudFunctions(isCloudFunctions);

        if (isCloudFunctions) {
            // Cloud Functions環境ではサービスアカウントキーは不要
            return await this.firestoreService.initialize();
        } else {
            // ローカル環境ではサービスアカウントキーが必要
            const serviceAccountPath = Environment.getFirebaseAdminKeyPath();
            return await this.firestoreService.initialize(serviceAccountPath);
        }
    }

    /**
     * レポートのしきい値設定を取得する
     * キャッシュが有効な場合はキャッシュから返す
     */
    @ErrorHandler.errorDecorator('FirestoreConfigRepository', {
        defaultMessage: 'レポートしきい値の取得に失敗しました',
    })
    async getReportThresholds(): Promise<ReportThresholds> {
        // キャッシュが有効な場合は返す
        const now = Date.now();
        if (this.thresholdsCache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
            logger.info('キャッシュからしきい値を取得しました', this.serviceContext);
            return this.thresholdsCache;
        }

        await this.initialize();

        const configPath = 'config/report_thresholds';
        const thresholdsDoc = await this.firestoreService.getDocument<ReportThresholds>(configPath);

        if (!thresholdsDoc) {
            throw new AppError(
                'レポートしきい値の設定が見つかりません',
                ErrorType.NOT_FOUND,
                { configPath }
            );
        }

        // バリデーション
        this.validateThresholds(thresholdsDoc);

        // キャッシュを更新
        this.thresholdsCache = thresholdsDoc;
        this.cacheTimestamp = now;

        logger.info('Firestoreからしきい値を取得しました', this.serviceContext);
        return thresholdsDoc;
    }

    /**
     * しきい値設定のバリデーション
     */
    private validateThresholds(thresholds: ReportThresholds): void {
        if (!thresholds.weekly || !thresholds.monthly) {
            throw new AppError(
                'しきい値設定にweeklyまたはmonthlyが含まれていません',
                ErrorType.VALIDATION,
                { thresholds }
            );
        }

        const validateLevels = (levels: ThresholdLevels, type: string) => {
            if (!levels.level1 || !levels.level2 || !levels.level3) {
                throw new AppError(
                    `${type}のしきい値設定にlevel1、level2、level3が含まれていません`,
                    ErrorType.VALIDATION,
                    { levels, type }
                );
            }

            if (levels.level1 >= levels.level2 || levels.level2 >= levels.level3) {
                throw new AppError(
                    `${type}のしきい値はlevel1 < level2 < level3の順序である必要があります`,
                    ErrorType.VALIDATION,
                    { levels, type }
                );
            }
        };

        validateLevels(thresholds.weekly, 'weekly');
        validateLevels(thresholds.monthly, 'monthly');
    }

    /**
     * キャッシュをクリアする（テスト用）
     */
    public clearCache(): void {
        this.thresholdsCache = null;
        this.cacheTimestamp = 0;
        logger.info('しきい値キャッシュをクリアしました', this.serviceContext);
    }
}
