import { Firestore } from 'firebase-admin/firestore';
import { FirestoreConfigRepository } from '../../../../../../shared/infrastructure/database/repositories/FirestoreConfigRepository';
import { ReportThresholds } from '../../../../../../shared/domain/entities/ReportThresholds';
import { FirestoreService } from '../../../../../../shared/infrastructure/database/FirestoreService';
import { Environment } from '../../../../../../shared/infrastructure/config/Environment';
import { AppError, ErrorType } from '../../../../../../shared/errors/AppError';

// モック
jest.mock('../../../../../../shared/infrastructure/database/FirestoreService');
jest.mock('../../../../../../shared/infrastructure/config/Environment');

// Loggerをモック化
jest.mock('../../../../../../shared/infrastructure/logging/Logger', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    }
}));

describe('FirestoreConfigRepository', () => {
    let repository: FirestoreConfigRepository;
    let mockFirestoreService: jest.Mocked<FirestoreService>;

    const mockThresholds: ReportThresholds = {
        weekly: {
            level1: 1000,
            level2: 5000,
            level3: 10000,
        },
        monthly: {
            level1: 4000,
            level2: 20000,
            level3: 40000,
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // FirestoreServiceのモック
        mockFirestoreService = {
            getInstance: jest.fn(),
            initialize: jest.fn().mockResolvedValue({} as Firestore),
            getDocument: jest.fn(),
            setCloudFunctions: jest.fn(),
        } as any;

        (FirestoreService.getInstance as jest.Mock).mockReturnValue(mockFirestoreService);
        (Environment.isCloudFunctions as jest.Mock).mockReturnValue(false);
        (Environment.getFirebaseAdminKeyPath as jest.Mock).mockReturnValue('/path/to/key.json');

        repository = new FirestoreConfigRepository();
    });

    describe('getReportThresholds', () => {
        it('Firestoreからしきい値を正常に取得できること', async () => {
            // Arrange
            mockFirestoreService.getDocument.mockResolvedValue(mockThresholds);

            // Act
            const result = await repository.getReportThresholds();

            // Assert
            expect(result).toEqual(mockThresholds);
            expect(mockFirestoreService.initialize).toHaveBeenCalled();
            expect(mockFirestoreService.getDocument).toHaveBeenCalledWith('config/report_thresholds');
        });

        it('キャッシュが有効な場合はキャッシュから取得すること', async () => {
            // Arrange
            mockFirestoreService.getDocument.mockResolvedValue(mockThresholds);

            // Act - 1回目の呼び出し
            const result1 = await repository.getReportThresholds();
            // Act - 2回目の呼び出し（キャッシュが有効）
            const result2 = await repository.getReportThresholds();

            // Assert
            expect(result1).toEqual(mockThresholds);
            expect(result2).toEqual(mockThresholds);
            expect(mockFirestoreService.getDocument).toHaveBeenCalledTimes(1); // 1回のみ
        });

        it('キャッシュが期限切れの場合は再取得すること', async () => {
            // Arrange
            mockFirestoreService.getDocument.mockResolvedValue(mockThresholds);
            jest.useFakeTimers();

            // Act - 1回目の呼び出し
            await repository.getReportThresholds();

            // 6分経過（キャッシュTTL: 5分）
            jest.advanceTimersByTime(6 * 60 * 1000);

            // Act - 2回目の呼び出し（キャッシュ期限切れ）
            await repository.getReportThresholds();

            // Assert
            expect(mockFirestoreService.getDocument).toHaveBeenCalledTimes(2);

            jest.useRealTimers();
        });

        it('しきい値が見つからない場合はエラーをスローすること', async () => {
            // Arrange
            mockFirestoreService.getDocument.mockResolvedValue(null);

            // Act & Assert
            await expect(repository.getReportThresholds()).rejects.toThrow(AppError);
            await expect(repository.getReportThresholds()).rejects.toThrow('レポートしきい値の設定が見つかりません');
        });

        it('weeklyまたはmonthlyが欠けている場合はエラーをスローすること', async () => {
            // Arrange
            const invalidThresholds = {
                weekly: mockThresholds.weekly,
                // monthlyが欠けている
            } as any;
            mockFirestoreService.getDocument.mockResolvedValue(invalidThresholds);

            // Act & Assert
            await expect(repository.getReportThresholds()).rejects.toThrow(AppError);
        });

        it('レベル値が不正な順序の場合はエラーをスローすること', async () => {
            // Arrange
            const invalidThresholds = {
                weekly: {
                    level1: 10000, // level1 > level2 になっている
                    level2: 5000,
                    level3: 1000,
                },
                monthly: mockThresholds.monthly,
            };
            mockFirestoreService.getDocument.mockResolvedValue(invalidThresholds);

            // Act & Assert
            await expect(repository.getReportThresholds()).rejects.toThrow(AppError);
            await expect(repository.getReportThresholds()).rejects.toThrow('level1 < level2 < level3の順序である必要があります');
        });
    });

    describe('clearCache', () => {
        it('キャッシュをクリアできること', async () => {
            // Arrange
            mockFirestoreService.getDocument.mockResolvedValue(mockThresholds);

            // Act - 1回目の呼び出し
            await repository.getReportThresholds();

            // キャッシュをクリア
            repository.clearCache();

            // Act - 2回目の呼び出し（キャッシュクリア後）
            await repository.getReportThresholds();

            // Assert
            expect(mockFirestoreService.getDocument).toHaveBeenCalledTimes(2); // 2回呼ばれる
        });
    });

    describe('initialize', () => {
        it('Cloud Functions環境では初期化できること', async () => {
            // Arrange
            (Environment.isCloudFunctions as jest.Mock).mockReturnValue(true);
            mockFirestoreService.getDocument.mockResolvedValue(mockThresholds);

            // Act
            await repository.getReportThresholds();

            // Assert
            expect(mockFirestoreService.setCloudFunctions).toHaveBeenCalledWith(true);
            expect(mockFirestoreService.initialize).toHaveBeenCalledWith();
        });

        it('ローカル環境では初期化できること', async () => {
            // Arrange
            (Environment.isCloudFunctions as jest.Mock).mockReturnValue(false);
            (Environment.getFirebaseAdminKeyPath as jest.Mock).mockReturnValue('/path/to/key.json');
            mockFirestoreService.getDocument.mockResolvedValue(mockThresholds);

            // Act
            await repository.getReportThresholds();

            // Assert
            expect(mockFirestoreService.setCloudFunctions).toHaveBeenCalledWith(false);
            expect(mockFirestoreService.initialize).toHaveBeenCalledWith('/path/to/key.json');
        });
    });
});
