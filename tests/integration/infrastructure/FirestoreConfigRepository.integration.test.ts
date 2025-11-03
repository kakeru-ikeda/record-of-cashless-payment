import '../integration.setup';
import { FirestoreConfigRepository } from '../../../shared/infrastructure/database/repositories/FirestoreConfigRepository';
import { FirestoreService } from '../../../shared/infrastructure/database/FirestoreService';
import { ReportThresholds } from '../../../shared/domain/entities/ReportThresholds';

describe('FirestoreConfigRepository Integration Tests', () => {
    let repository: FirestoreConfigRepository;
    let firestoreService: FirestoreService;

    const testThresholds: ReportThresholds = {
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

    beforeEach(async () => {
        repository = new FirestoreConfigRepository();
        firestoreService = FirestoreService.getInstance();

        // Firestoreを初期化
        await repository.initialize();

        // テストデータをセットアップ
        const db = await firestoreService.getDb();
        await db.doc('config/report_thresholds').set(testThresholds);
    });

    afterEach(async () => {
        // キャッシュをクリア
        repository.clearCache();

        // テストデータをクリーンアップ
        const db = await firestoreService.getDb();
        await db.doc('config/report_thresholds').delete();
    });

    describe('Repository初期化', () => {
        it('正常に初期化できること', async () => {
            // When & Then
            await expect(repository.initialize()).resolves.not.toThrow();
        });
    });

    describe('しきい値の取得', () => {
        it('Firestoreからしきい値を取得できること', async () => {
            // When
            const result = await repository.getReportThresholds();

            // Then
            expect(result).toEqual(testThresholds);
        });

        it('キャッシュが機能すること', async () => {
            // Given - 1回目の取得
            const result1 = await repository.getReportThresholds();

            // Firestoreのデータを変更
            const db = await firestoreService.getDb();
            await db.doc('config/report_thresholds').update({
                'weekly.level1': 2000,
            });

            // When - 2回目の取得（キャッシュから）
            const result2 = await repository.getReportThresholds();

            // Then - キャッシュから取得されるため、元の値のまま
            expect(result1).toEqual(testThresholds);
            expect(result2).toEqual(testThresholds);
        });

        it('キャッシュクリア後は最新のデータを取得できること', async () => {
            // Given - 1回目の取得
            await repository.getReportThresholds();

            // Firestoreのデータを変更
            const updatedThresholds = {
                ...testThresholds,
                weekly: {
                    level1: 2000,
                    level2: 6000,
                    level3: 12000,
                },
            };
            const db = await firestoreService.getDb();
            await db.doc('config/report_thresholds').set(updatedThresholds);

            // キャッシュをクリア
            repository.clearCache();

            // When - 2回目の取得
            const result = await repository.getReportThresholds();

            // Then - 最新のデータが取得される
            expect(result).toEqual(updatedThresholds);
        });
    });

    describe('バリデーション', () => {
        it('不正な順序のしきい値を検出すること', async () => {
            // Given
            const invalidThresholds = {
                weekly: {
                    level1: 10000, // level1 > level2 になっている
                    level2: 5000,
                    level3: 1000,
                },
                monthly: testThresholds.monthly,
            };

            const db = await firestoreService.getDb();
            await db.doc('config/report_thresholds').set(invalidThresholds);

            // キャッシュをクリア
            repository.clearCache();

            // When & Then
            await expect(repository.getReportThresholds()).rejects.toThrow('level1 < level2 < level3の順序である必要があります');
        });

        it('欠けているフィールドを検出すること', async () => {
            // Given
            const invalidThresholds = {
                weekly: {
                    level1: 1000,
                    level2: 5000,
                    // level3が欠けている
                },
                monthly: testThresholds.monthly,
            } as any;

            const db = await firestoreService.getDb();
            await db.doc('config/report_thresholds').set(invalidThresholds);

            // キャッシュをクリア
            repository.clearCache();

            // When & Then
            await expect(repository.getReportThresholds()).rejects.toThrow();
        });
    });
});
