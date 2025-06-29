import '../integration.setup';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { FirestoreReportRepository } from '../../../shared/infrastructure/database/repositories/FirestoreReportRepository';
import { FirestoreReportUseCase } from '../../../shared/usecases/database/FirestoreReportUseCase';
import { DailyReport, WeeklyReport, MonthlyReport } from '../../../shared/domain/entities/Reports';
import { MockReportRepository } from '../mocks/MockReportRepository';

describe('FirestoreReportRepository Integration Tests', () => {
    let repository: FirestoreReportRepository;
    let useCase: FirestoreReportUseCase;

    beforeEach(async () => {
        // 実際のFirestoreRepositoryを使用（エミュレータ想定）
        repository = new FirestoreReportRepository();
        useCase = new FirestoreReportUseCase(repository);
    });

    describe('Repository初期化', () => {
        it('正常に初期化できること', async () => {
            // When & Then
            await expect(repository.initialize()).resolves.not.toThrow();
        });
    });

    describe('日付バリデーション', () => {
        it('不正な年でエラーを投げること', async () => {
            // Given
            await repository.initialize();

            // When & Then
            await expect(repository.getDailyReport('1999', '6', '15'))
                .rejects
                .toThrow('年は2000年から2100年の間で指定してください');
        });

        it('不正な月でエラーを投げること', async () => {
            // Given
            await repository.initialize();

            // When & Then
            await expect(repository.getDailyReport('2024', '13', '15'))
                .rejects
                .toThrow('月は1から12の間で指定してください');
        });

        it('不正な日でエラーを投げること', async () => {
            // Given
            await repository.initialize();

            // When & Then
            await expect(repository.getDailyReport('2024', '6', '32'))
                .rejects
                .toThrow('日は1から31の間で指定してください');
        });

        it('存在しない日付でエラーを投げること', async () => {
            // Given
            await repository.initialize();

            // When & Then
            await expect(repository.getDailyReport('2024', '2', '30'))
                .rejects
                .toThrow('無効な日付です');
        });
    });

    describe('CRUD操作（モック使用）', () => {
        let mockRepository: MockReportRepository;
        let mockUseCase: FirestoreReportUseCase;

        beforeEach(async () => {
            mockRepository = new MockReportRepository();
            await mockRepository.initialize();
            mockUseCase = new FirestoreReportUseCase(mockRepository);
        });

        it('存在しない日次レポートはnullを返すこと', async () => {
            // When
            const result = await mockRepository.getDailyReport('2024', '6', '15');

            // Then
            expect(result).toBeNull();
        });

        it('存在しない月次レポートはnullを返すこと', async () => {
            // When
            const result = await mockRepository.getMonthlyReport('2024', '6');

            // Then
            expect(result).toBeNull();
        });

        it('存在しない週次レポートはnullを返すこと', async () => {
            // When
            const result = await mockRepository.getWeeklyReportByTerm('2024', '6', '3');

            // Then
            expect(result).toBeNull();
        });

        it('存在しない月の日次レポート一覧は空配列を返すこと', async () => {
            // When
            const result = await mockRepository.getMonthlyDailyReports('2024', '6');

            // Then
            expect(result).toEqual([]);
        });

        it('存在しない月の週次レポート一覧は空配列を返すこと', async () => {
            // When
            const result = await mockRepository.getMonthlyWeeklyReports('2024', '6');

            // Then
            expect(result).toEqual([]);
        });
    });

    describe('Usecase経由での操作（モック使用）', () => {
        let mockRepository: MockReportRepository;
        let mockUseCase: FirestoreReportUseCase;

        beforeEach(async () => {
            mockRepository = new MockReportRepository();
            await mockRepository.initialize();
            mockUseCase = new FirestoreReportUseCase(mockRepository);
        });

        it('存在しない日次レポートを取得しようとした場合にAppErrorを投げること', async () => {
            // When & Then
            await expect(mockUseCase.getDailyReport('2024', '6', '15'))
                .rejects
                .toThrow('2024年6月15日のレポートが見つかりません');
        });

        it('存在しない月次レポートを取得しようとした場合にAppErrorを投げること', async () => {
            // When & Then
            await expect(mockUseCase.getMonthlyReport('2024', '6'))
                .rejects
                .toThrow('2024年6月のレポートが見つかりません');
        });

        it('存在しない週次レポートを取得しようとした場合にAppErrorを投げること', async () => {
            // When & Then
            await expect(mockUseCase.getWeeklyReport('2024', '6', '3'))
                .rejects
                .toThrow('2024年6月term3の週次レポートが見つかりません');
        });

        it('月内の日次レポート一覧は空配列を返すこと', async () => {
            // When
            const result = await mockUseCase.getMonthlyDailyReports('2024', '6');

            // Then
            expect(result).toEqual([]);
        });

        it('月内の週次レポート一覧は空配列を返すこと', async () => {
            // When
            const result = await mockUseCase.getMonthlyWeeklyReports('2024', '6');

            // Then
            expect(result).toEqual([]);
        });
    });

    describe('FirestorePathUtilとの連携（モック使用）', () => {
        let mockRepository: MockReportRepository;

        beforeEach(async () => {
            mockRepository = new MockReportRepository();
            await mockRepository.initialize();
        });

        it('日次レポートのパス生成が正しく動作すること', async () => {
            // Given
            const testReport: DailyReport = {
                totalAmount: 1000,
                totalCount: 1,
                lastUpdated: FieldValue.serverTimestamp(),
                lastUpdatedBy: 'integration-test',
                documentIdList: ['test-doc'],
                date: Timestamp.now(),
                hasNotified: false
            };

            // When
            const path = await mockRepository.saveDailyReport(testReport, '2024', '6', '15');

            // Then
            expect(path).toBe('reports/2024/6/daily/15');
        });

        it('週次レポートのパス生成が正しく動作すること', async () => {
            // Given
            const testReport: WeeklyReport = {
                totalAmount: 7000,
                totalCount: 7,
                lastUpdated: FieldValue.serverTimestamp(),
                lastUpdatedBy: 'integration-test',
                documentIdList: ['test-doc'],
                termStartDate: Timestamp.now(),
                termEndDate: Timestamp.now(),
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
                hasReportSent: false
            };

            // When
            const path = await mockRepository.saveWeeklyReport(testReport, '2024', '6');

            // Then
            expect(path).toMatch(/^reports\/2024\/6\/weekly\/term\d+$/);
        });

        it('月次レポートのパス生成が正しく動作すること', async () => {
            // Given
            const testReport: MonthlyReport = {
                totalAmount: 30000,
                totalCount: 30,
                lastUpdated: FieldValue.serverTimestamp(),
                lastUpdatedBy: 'integration-test',
                documentIdList: ['test-doc'],
                monthStartDate: Timestamp.now(),
                monthEndDate: Timestamp.now(),
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
                hasReportSent: false
            };

            // When
            const path = await mockRepository.saveMonthlyReport(testReport, '2024', '6');

            // Then
            expect(path).toBe('reports/2024/6/monthly');
        });
    });

    describe('エラーハンドリング', () => {
        it('存在しないレポートの更新でエラーを投げること', async () => {
            // Given
            const mockRepository = new MockReportRepository();
            await mockRepository.initialize();

            const updateData = {
                totalAmount: 1000
            };

            // When & Then
            await expect(mockRepository.updateDailyReport(updateData, '2024', '6', '15'))
                .rejects
                .toThrow('Report not found');
        });

        it('バリデーションエラーがAppErrorとして投げられること', async () => {
            // When & Then
            await expect(useCase.getDailyReport('invalid', '6', '15'))
                .rejects
                .toThrow('年、月、日は数値で指定してください');
        });
    });

    /**
     * 注意: 以下のテストは実際のFirestoreエミュレータが必要です
     * 実際の環境では、Firestoreエミュレータを起動してからテストを実行してください:
     * 
     * ```bash
     * firebase emulators:start --only firestore
     * ```
     */
    describe('実際のFirestore操作（エミュレータ必須）', () => {
        describe('日次レポート操作', () => {
            it('日次レポートの保存と取得が正常に動作すること', async () => {
                // Given
                await repository.initialize();

                const testReport: DailyReport = {
                    totalAmount: 2500,
                    totalCount: 2,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'integration-test',
                    documentIdList: ['doc1', 'doc2'],
                    date: Timestamp.now(),
                    hasNotified: false
                };

                // When
                const savePath = await repository.saveDailyReport(testReport, '2024', '6', '15');
                const savedReport = await repository.getDailyReport('2024', '6', '15');

                // Then
                expect(savePath).toBe('reports/daily/2024-06/15');
                expect(savedReport).toBeDefined();
                expect(savedReport!.totalAmount).toBe(2500);
                expect(savedReport!.totalCount).toBe(2);
                expect(savedReport!.documentIdList).toEqual(['doc1', 'doc2']);
                expect(savedReport!.hasNotified).toBe(false);
            });

            it('日次レポートの更新が正常に動作すること', async () => {
                // Given
                await repository.initialize();

                const initialReport: DailyReport = {
                    totalAmount: 1000,
                    totalCount: 1,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'integration-test',
                    documentIdList: ['doc1'],
                    date: Timestamp.now(),
                    hasNotified: false
                };

                // 初期レポートを保存
                await repository.saveDailyReport(initialReport, '2024', '6', '16');

                // When
                const updateData = {
                    totalAmount: 2000,
                    hasNotified: true
                };
                await repository.updateDailyReport(updateData, '2024', '6', '16');
                const updatedReport = await repository.getDailyReport('2024', '6', '16');

                // Then
                expect(updatedReport).toBeDefined();
                expect(updatedReport!.totalAmount).toBe(2000);
                expect(updatedReport!.hasNotified).toBe(true);
                expect(updatedReport!.totalCount).toBe(1); // 更新されていない値は保持
            });

            it('日次レポートのhasNotifiedフィールドの操作が正常に動作すること', async () => {
                // Given
                await repository.initialize();

                const testReport: DailyReport = {
                    totalAmount: 1500,
                    totalCount: 3,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'integration-test',
                    documentIdList: ['doc1', 'doc2', 'doc3'],
                    date: Timestamp.now(),
                    hasNotified: false
                };

                // When - 初期保存
                await repository.saveDailyReport(testReport, '2024', '6', '17');
                const initialReport = await repository.getDailyReport('2024', '6', '17');

                // Then - 初期状態確認
                expect(initialReport!.hasNotified).toBe(false);

                // When - hasNotifiedをtrueに更新
                await repository.updateDailyReport({ hasNotified: true }, '2024', '6', '17');
                const notifiedReport = await repository.getDailyReport('2024', '6', '17');

                // Then - 更新後状態確認
                expect(notifiedReport!.hasNotified).toBe(true);
                expect(notifiedReport!.totalAmount).toBe(1500); // 他のフィールドは変更されない
            });
        });

        describe('週次レポート操作', () => {
            it('週次レポートの保存と取得が正常に動作すること', async () => {
                // Given
                await repository.initialize();

                const testReport: WeeklyReport = {
                    totalAmount: 10000,
                    totalCount: 10,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'integration-test',
                    documentIdList: ['week-doc1', 'week-doc2'],
                    termStartDate: Timestamp.now(),
                    termEndDate: Timestamp.now(),
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                    hasReportSent: false
                };

                // When
                const savePath = await repository.saveWeeklyReport(testReport, '2024', '6');
                const savedReport = await repository.getWeeklyReportByTerm('2024', '6', '1');

                // Then
                expect(savePath).toMatch(/^reports\/weekly\/2024-06\/term\d+$/);
                expect(savedReport).toBeDefined();
                expect(savedReport!.totalAmount).toBe(10000);
                expect(savedReport!.totalCount).toBe(10);
                expect(savedReport!.hasNotifiedLevel1).toBe(false);
                expect(savedReport!.hasNotifiedLevel2).toBe(false);
                expect(savedReport!.hasNotifiedLevel3).toBe(false);
                expect(savedReport!.hasReportSent).toBe(false);
            });

            it('週次レポートの通知フラグ更新が正常に動作すること', async () => {
                // Given
                await repository.initialize();

                const testReport: WeeklyReport = {
                    totalAmount: 15000,
                    totalCount: 15,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'integration-test',
                    documentIdList: ['week-doc3'],
                    termStartDate: Timestamp.now(),
                    termEndDate: Timestamp.now(),
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                    hasReportSent: false
                };

                // When - 初期保存
                const savePath = await repository.saveWeeklyReport(testReport, '2024', '6');
                const termMatch = savePath.match(/term(\d+)$/);
                const termNumber = termMatch ? termMatch[1] : '1';

                // When - 通知フラグを段階的に更新
                await repository.updateWeeklyReport(
                    { hasNotifiedLevel1: true },
                    '2024', '6', termNumber
                );
                const level1Updated = await repository.getWeeklyReportByTerm('2024', '6', termNumber);

                await repository.updateWeeklyReport(
                    { hasNotifiedLevel2: true, hasReportSent: true },
                    '2024', '6', termNumber
                );
                const finalUpdated = await repository.getWeeklyReportByTerm('2024', '6', termNumber);

                // Then
                expect(level1Updated!.hasNotifiedLevel1).toBe(true);
                expect(level1Updated!.hasNotifiedLevel2).toBe(false);
                expect(finalUpdated!.hasNotifiedLevel2).toBe(true);
                expect(finalUpdated!.hasReportSent).toBe(true);
            });
        });

        describe('月次レポート操作', () => {
            it('月次レポートの保存と取得が正常に動作すること', async () => {
                // Given
                await repository.initialize();

                const testReport: MonthlyReport = {
                    totalAmount: 50000,
                    totalCount: 50,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'integration-test',
                    documentIdList: ['month-doc1', 'month-doc2', 'month-doc3'],
                    monthStartDate: Timestamp.now(),
                    monthEndDate: Timestamp.now(),
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                    hasReportSent: false
                };

                // When
                const savePath = await repository.saveMonthlyReport(testReport, '2024', '6');
                const savedReport = await repository.getMonthlyReport('2024', '6');

                // Then
                expect(savePath).toBe('reports/monthly/2024/06');
                expect(savedReport).toBeDefined();
                expect(savedReport!.totalAmount).toBe(50000);
                expect(savedReport!.totalCount).toBe(50);
                expect(savedReport!.hasNotifiedLevel1).toBe(false);
                expect(savedReport!.hasNotifiedLevel2).toBe(false);
                expect(savedReport!.hasNotifiedLevel3).toBe(false);
                expect(savedReport!.hasReportSent).toBe(false);
            });

            it('月次レポートの通知フラグと送信フラグ更新が正常に動作すること', async () => {
                // Given
                await repository.initialize();

                const testReport: MonthlyReport = {
                    totalAmount: 75000,
                    totalCount: 75,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'integration-test',
                    documentIdList: ['month-doc4'],
                    monthStartDate: Timestamp.now(),
                    monthEndDate: Timestamp.now(),
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                    hasReportSent: false
                };

                // When - 初期保存
                await repository.saveMonthlyReport(testReport, '2024', '7');

                // When - 全ての通知フラグを更新
                await repository.updateMonthlyReport({
                    hasNotifiedLevel1: true,
                    hasNotifiedLevel2: true,
                    hasNotifiedLevel3: true,
                    hasReportSent: true
                }, '2024', '7');

                const updatedReport = await repository.getMonthlyReport('2024', '7');

                // Then
                expect(updatedReport).toBeDefined();
                expect(updatedReport!.hasNotifiedLevel1).toBe(true);
                expect(updatedReport!.hasNotifiedLevel2).toBe(true);
                expect(updatedReport!.hasNotifiedLevel3).toBe(true);
                expect(updatedReport!.hasReportSent).toBe(true);
                expect(updatedReport!.totalAmount).toBe(75000); // 他のフィールドは変更されない
            });
        });

        describe('レポート一覧取得操作', () => {
            beforeEach(async () => {
                await repository.initialize();
            });

            it('月内の日次レポート一覧取得が正常に動作すること', async () => {
                // Given - 複数の日次レポートを作成
                const report1: DailyReport = {
                    totalAmount: 1000,
                    totalCount: 1,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'integration-test',
                    documentIdList: ['daily1'],
                    date: Timestamp.now(),
                    hasNotified: false
                };

                const report2: DailyReport = {
                    totalAmount: 2000,
                    totalCount: 2,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'integration-test',
                    documentIdList: ['daily2'],
                    date: Timestamp.now(),
                    hasNotified: true
                };

                // When
                await repository.saveDailyReport(report1, '2024', '8', '01');
                await repository.saveDailyReport(report2, '2024', '8', '02');

                const monthlyReports = await repository.getMonthlyDailyReports('2024', '8');

                // Then
                expect(monthlyReports).toHaveLength(2);
                expect(monthlyReports.some(r => r.hasNotified === false)).toBe(true);
                expect(monthlyReports.some(r => r.hasNotified === true)).toBe(true);
            });

            it('月内の週次レポート一覧取得が正常に動作すること', async () => {
                // Given - 週次レポートを作成
                const weeklyReport: WeeklyReport = {
                    totalAmount: 7000,
                    totalCount: 7,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'integration-test',
                    documentIdList: ['weekly1'],
                    termStartDate: Timestamp.now(),
                    termEndDate: Timestamp.now(),
                    hasNotifiedLevel1: true,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                    hasReportSent: false
                };

                // When
                await repository.saveWeeklyReport(weeklyReport, '2024', '8');
                const monthlyWeeklyReports = await repository.getMonthlyWeeklyReports('2024', '8');

                // Then
                expect(monthlyWeeklyReports).toHaveLength(1);
                expect(monthlyWeeklyReports[0].hasNotifiedLevel1).toBe(true);
                expect(monthlyWeeklyReports[0].hasNotifiedLevel2).toBe(false);
            });
        });
    });
});
