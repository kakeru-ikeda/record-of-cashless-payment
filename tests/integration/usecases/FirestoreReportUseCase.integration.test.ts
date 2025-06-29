import '../integration.setup';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { FirestoreReportUseCase } from '../../../shared/usecases/database/FirestoreReportUseCase';
import { MockReportRepository } from '../mocks/MockReportRepository';
import { DailyReport, WeeklyReport, MonthlyReport } from '../../../shared/domain/entities/Reports';
import { AppError, ErrorType } from '../../../shared/errors/AppError';

describe('FirestoreReportUseCase Integration Tests', () => {
    let useCase: FirestoreReportUseCase;
    let mockRepository: MockReportRepository;

    beforeEach(async () => {
        // モックリポジトリを初期化
        mockRepository = new MockReportRepository();
        await mockRepository.initialize();

        // ユースケースを初期化
        useCase = new FirestoreReportUseCase(mockRepository);

        // テストデータを作成
        mockRepository.createTestData();
    });

    afterEach(() => {
        // テストデータをクリア
        mockRepository.clearAll();
    });

    describe('日次レポート取得', () => {
        it('正常にレポートを取得できること', async () => {
            // Given
            const year = '2024';
            const month = '6';
            const day = '15';

            // When
            const result = await useCase.getDailyReport(year, month, day);

            // Then
            expect(result).toBeDefined();
            expect(result.totalAmount).toBe(5000);
            expect(result.totalCount).toBe(3);
            expect(result.documentIdList).toEqual(['doc1', 'doc2', 'doc3']);
            expect(result.hasNotified).toBe(false);
        });

        it('存在しないレポートを取得しようとした場合にエラーを投げること', async () => {
            // Given
            const year = '2024';
            const month = '6';
            const day = '20'; // 存在しない日

            // When & Then
            await expect(useCase.getDailyReport(year, month, day))
                .rejects
                .toThrow(AppError);
        });

        it('不正な日付でエラーを投げること', async () => {
            // Given
            const year = '2024';
            const month = '13'; // 不正な月
            const day = '15';

            // When & Then
            await expect(useCase.getDailyReport(year, month, day))
                .rejects
                .toThrow();
        });
    });

    describe('週次レポート取得', () => {
        it('正常にレポートを取得できること', async () => {
            // Given
            const year = '2024';
            const month = '6';
            const term = '3';

            // When
            const result = await useCase.getWeeklyReport(year, month, term);

            // Then
            expect(result).toBeDefined();
            expect(result.totalAmount).toBe(35000);
            expect(result.totalCount).toBe(21);
            expect(result.documentIdList).toEqual(['doc1', 'doc2', 'doc3', 'doc4', 'doc5']);
            expect(result.hasNotifiedLevel1).toBe(false);
            expect(result.hasNotifiedLevel2).toBe(false);
            expect(result.hasNotifiedLevel3).toBe(false);
        });

        it('存在しないレポートを取得しようとした場合にエラーを投げること', async () => {
            // Given
            const year = '2024';
            const month = '6';
            const term = '5'; // 存在しないターム

            // When & Then
            await expect(useCase.getWeeklyReport(year, month, term))
                .rejects
                .toThrow(AppError);
        });
    });

    describe('月次レポート取得', () => {
        it('正常にレポートを取得できること', async () => {
            // Given
            const year = '2024';
            const month = '6';

            // When
            const result = await useCase.getMonthlyReport(year, month);

            // Then
            expect(result).toBeDefined();
            expect(result.totalAmount).toBe(150000);
            expect(result.totalCount).toBe(90);
            expect(result.documentIdList).toEqual(['doc1', 'doc2', 'doc3', 'doc4', 'doc5', 'doc6']);
            expect(result.hasNotifiedLevel1).toBe(false);
            expect(result.hasNotifiedLevel2).toBe(false);
            expect(result.hasNotifiedLevel3).toBe(false);
        });

        it('存在しないレポートを取得しようとした場合にエラーを投げること', async () => {
            // Given
            const year = '2024';
            const month = '12'; // 存在しない月

            // When & Then
            await expect(useCase.getMonthlyReport(year, month))
                .rejects
                .toThrow(AppError);
        });
    });

    describe('月内の日次レポート一覧取得', () => {
        it('正常にレポート一覧を取得できること', async () => {
            // Given
            const year = '2024';
            const month = '6';

            // 追加のテストデータを作成
            const additionalReport: DailyReport = {
                totalAmount: 3000,
                totalCount: 2,
                lastUpdated: FieldValue.serverTimestamp(),
                lastUpdatedBy: 'test-system',
                documentIdList: ['doc4', 'doc5'],
                date: Timestamp.now(),
                hasNotified: true
            };
            await mockRepository.saveDailyReport(additionalReport, year, month, '16');

            // When
            const result = await useCase.getMonthlyDailyReports(year, month);

            // Then
            expect(result).toBeDefined();
            expect(result).toHaveLength(2);
            expect(result[0].totalAmount).toBe(5000); // 最初のレポート
            expect(result[1].totalAmount).toBe(3000); // 追加したレポート
        });

        it('レポートが存在しない月は空配列を返すこと', async () => {
            // Given
            const year = '2024';
            const month = '7'; // レポートが存在しない月

            // When
            const result = await useCase.getMonthlyDailyReports(year, month);

            // Then
            expect(result).toBeDefined();
            expect(result).toHaveLength(0);
        });
    });

    describe('月内の週次レポート一覧取得', () => {
        it('正常にレポート一覧を取得できること', async () => {
            // Given
            const year = '2024';
            const month = '6';

            // When
            const result = await useCase.getMonthlyWeeklyReports(year, month);

            // Then
            expect(result).toBeDefined();
            expect(result).toHaveLength(1);
            expect(result[0].totalAmount).toBe(35000);
        });
    });

    describe('レポート作成', () => {
        it('日次レポートを正常に作成できること', async () => {
            // Given
            const year = '2024';
            const month = '6';
            const day = '20';

            const newReport: DailyReport = {
                totalAmount: 7500,
                totalCount: 5,
                lastUpdated: FieldValue.serverTimestamp(),
                lastUpdatedBy: 'test-system',
                documentIdList: ['doc7', 'doc8'],
                date: Timestamp.now(),
                hasNotified: false
            };

            // When
            const path = await useCase.createDailyReport(newReport, year, month, day);

            // Then
            expect(path).toBe(`reports/${year}/${month}/daily/${day}`);

            // 作成されたレポートを取得して確認
            const savedReport = await useCase.getDailyReport(year, month, day);
            expect(savedReport).toBeDefined();
            expect(savedReport!.totalAmount).toBe(7500);
        });

        it('週次レポートを正常に作成できること', async () => {
            // Given
            const year = '2024';
            const month = '6';

            const newReport: WeeklyReport = {
                totalAmount: 42000,
                totalCount: 28,
                lastUpdated: FieldValue.serverTimestamp(),
                lastUpdatedBy: 'test-system',
                documentIdList: ['doc9', 'doc10'],
                termStartDate: Timestamp.now(),
                termEndDate: Timestamp.now(),
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
                hasReportSent: false
            };

            // When
            const path = await useCase.createWeeklyReport(newReport, year, month);

            // Then
            expect(path).toContain(`reports/${year}/${month}/weekly/`);
        });

        it('月次レポートを正常に作成できること', async () => {
            // Given
            const year = '2024';
            const month = '7';

            const newReport: MonthlyReport = {
                totalAmount: 180000,
                totalCount: 120,
                lastUpdated: FieldValue.serverTimestamp(),
                lastUpdatedBy: 'test-system',
                documentIdList: ['doc11', 'doc12'],
                monthStartDate: Timestamp.now(),
                monthEndDate: Timestamp.now(),
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
                hasReportSent: false
            };

            // When
            const path = await useCase.createMonthlyReport(newReport, year, month);

            // Then
            expect(path).toBe(`reports/${year}/${month}/monthly`);

            // 作成されたレポートを取得して確認
            const savedReport = await useCase.getMonthlyReport(year, month);
            expect(savedReport).toBeDefined();
            expect(savedReport!.totalAmount).toBe(180000);
        });
    });

    describe('レポート更新', () => {
        it('日次レポートを正常に更新できること', async () => {
            // Given
            const year = '2024';
            const month = '6';
            const day = '15';

            const updateData: Partial<DailyReport> = {
                totalAmount: 6000,
                hasNotified: true
            };

            // When
            const path = await useCase.updateDailyReport(updateData, year, month, day);

            // Then
            expect(path).toBe(`reports/${year}/${month}/daily/${day}`);

            // 更新されたレポートを取得して確認
            const updatedReport = await useCase.getDailyReport(year, month, day);
            expect(updatedReport).toBeDefined();
            expect(updatedReport!.totalAmount).toBe(6000);
            expect(updatedReport!.hasNotified).toBe(true);
            expect(updatedReport!.totalCount).toBe(3); // 元の値が保持されている
        });
    });

    describe('レポート作成または更新', () => {
        it('存在しないレポートは新規作成されること', async () => {
            // Given
            const year = '2024';
            const month = '6';
            const day = '25';

            const reportData: DailyReport = {
                totalAmount: 8000,
                totalCount: 6,
                lastUpdated: FieldValue.serverTimestamp(),
                lastUpdatedBy: 'test-system',
                documentIdList: ['doc13'],
                date: Timestamp.now(),
                hasNotified: false
            };

            // When
            const path = await useCase.createOrUpdateDailyReport(reportData, year, month, day);

            // Then
            expect(path).toBe(`reports/${year}/${month}/daily/${day}`);

            // 作成されたレポートを確認
            const report = await useCase.getDailyReport(year, month, day);
            expect(report).toBeDefined();
            expect(report!.totalAmount).toBe(8000);
        });

        it('既存のレポートは更新されること', async () => {
            // Given
            const year = '2024';
            const month = '6';
            const day = '15'; // 既存のレポートがある日

            const reportData: DailyReport = {
                totalAmount: 9000,
                totalCount: 7,
                lastUpdated: FieldValue.serverTimestamp(),
                lastUpdatedBy: 'test-system-updated',
                documentIdList: ['doc14', 'doc15'],
                date: Timestamp.now(),
                hasNotified: true
            };

            // When
            const path = await useCase.createOrUpdateDailyReport(reportData, year, month, day);

            // Then
            expect(path).toBe(`reports/${year}/${month}/daily/${day}`);

            // 更新されたレポートを確認
            const report = await useCase.getDailyReport(year, month, day);
            expect(report).toBeDefined();
            expect(report!.totalAmount).toBe(9000);
            expect(report!.lastUpdatedBy).toBe('test-system-updated');
        });
    });

    describe('エラーハンドリング', () => {
        it('初期化されていないリポジトリを使用した場合にエラーを投げること', async () => {
            // Given
            const uninitializedRepository = new MockReportRepository();
            const uninitializedUseCase = new FirestoreReportUseCase(uninitializedRepository);

            // When & Then
            await expect(uninitializedUseCase.getDailyReport('2024', '6', '15'))
                .rejects
                .toThrow('日次レポートの取得に失敗しました');
        });

        it('存在しないレポートの更新でエラーを投げること', async () => {
            // Given
            const year = '2024';
            const month = '6';
            const day = '30'; // 存在しない日

            const updateData: Partial<DailyReport> = {
                totalAmount: 1000
            };

            // When & Then
            await expect(useCase.updateDailyReport(updateData, year, month, day))
                .rejects
                .toThrow();
        });
    });

    /**
     * 実際のFirestoreエミュレータを使用したインテグレーションテスト
     * 注意: Firestoreエミュレータが起動している必要があります
     * 
     * ```bash
     * firebase emulators:start --only firestore
     * ```
     */
    describe('実際のFirestore操作（エミュレータ必須）', () => {
        let realUseCase: FirestoreReportUseCase;

        beforeEach(async () => {
            const { FirestoreReportRepository } = await import('../../../shared/infrastructure/database/repositories/FirestoreReportRepository');
            const realRepository = new FirestoreReportRepository();
            await realRepository.initialize();
            realUseCase = new FirestoreReportUseCase(realRepository);
        });

        describe('日次レポートのhasNotifiedフィールドのテスト', () => {
            it('hasNotifiedフィールドの更新がUseCaseレイヤーで正常に動作すること', async () => {
                // Given
                const year = '2024';
                const month = '9';
                const day = '01';

                const reportData: DailyReport = {
                    totalAmount: 3000,
                    totalCount: 3,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'usecase-test',
                    documentIdList: ['uc-doc1', 'uc-doc2'],
                    date: Timestamp.now(),
                    hasNotified: false
                };

                // When - 初期レポート作成
                await realUseCase.createOrUpdateDailyReport(reportData, year, month, day);
                const initialReport = await realUseCase.getDailyReport(year, month, day);

                // Then - 初期状態確認
                expect(initialReport.hasNotified).toBe(false);

                // When - hasNotifiedを更新
                await realUseCase.updateDailyReport({ hasNotified: true }, year, month, day);
                const updatedReport = await realUseCase.getDailyReport(year, month, day);

                // Then - 更新後状態確認
                expect(updatedReport.hasNotified).toBe(true);
                expect(updatedReport.totalAmount).toBe(3000); // 他のフィールドは保持
            });
        });

        describe('週次レポートの通知フラグテスト', () => {
            it('週次レポートの複数通知フラグが正常に動作すること', async () => {
                // Given
                const year = '2024';
                const month = '9';
                const termNumber = '2';

                const reportData: WeeklyReport = {
                    totalAmount: 20000,
                    totalCount: 20,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'usecase-test',
                    documentIdList: ['uc-week-doc1'],
                    termStartDate: Timestamp.now(),
                    termEndDate: Timestamp.now(),
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                    hasReportSent: false
                };

                // When - 初期レポート作成
                await realUseCase.createOrUpdateWeeklyReport(reportData, year, month, termNumber);

                // 段階的に通知フラグを更新
                await realUseCase.updateWeeklyReport({ hasNotifiedLevel1: true }, year, month, termNumber);
                const level1Report = await realUseCase.getWeeklyReport(year, month, termNumber);

                await realUseCase.updateWeeklyReport({
                    hasNotifiedLevel2: true,
                    hasReportSent: true
                }, year, month, termNumber);
                const finalReport = await realUseCase.getWeeklyReport(year, month, termNumber);

                // Then
                expect(level1Report.hasNotifiedLevel1).toBe(true);
                expect(level1Report.hasNotifiedLevel2).toBe(false);
                expect(finalReport.hasNotifiedLevel2).toBe(true);
                expect(finalReport.hasReportSent).toBe(true);
            });
        });

        describe('月次レポートの通知フラグテスト', () => {
            it('月次レポートの全通知フラグが正常に動作すること', async () => {
                // Given
                const year = '2024';
                const month = '9';

                const reportData: MonthlyReport = {
                    totalAmount: 100000,
                    totalCount: 100,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'usecase-test',
                    documentIdList: ['uc-month-doc1'],
                    monthStartDate: Timestamp.now(),
                    monthEndDate: Timestamp.now(),
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                    hasReportSent: false
                };

                // When - 初期レポート作成
                await realUseCase.createOrUpdateMonthlyReport(reportData, year, month);

                // 全フラグを一度に更新
                await realUseCase.updateMonthlyReport({
                    hasNotifiedLevel1: true,
                    hasNotifiedLevel2: true,
                    hasNotifiedLevel3: true,
                    hasReportSent: true
                }, year, month);

                const updatedReport = await realUseCase.getMonthlyReport(year, month);

                // Then
                expect(updatedReport.hasNotifiedLevel1).toBe(true);
                expect(updatedReport.hasNotifiedLevel2).toBe(true);
                expect(updatedReport.hasNotifiedLevel3).toBe(true);
                expect(updatedReport.hasReportSent).toBe(true);
                expect(updatedReport.totalAmount).toBe(100000); // 元のデータは保持
            });
        });

        describe('レポート一覧操作の高度なテスト', () => {
            it('複数の日次レポートでhasNotifiedフィールドの状態を確認できること', async () => {
                // Given
                const year = '2024';
                const month = '9';

                // 複数のレポートを作成（通知状態が異なる）
                await realUseCase.createOrUpdateDailyReport({
                    totalAmount: 1000,
                    totalCount: 1,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'usecase-test',
                    documentIdList: ['list-test-1'],
                    date: Timestamp.now(),
                    hasNotified: false
                }, year, month, '10');

                await realUseCase.createOrUpdateDailyReport({
                    totalAmount: 2000,
                    totalCount: 2,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'usecase-test',
                    documentIdList: ['list-test-2'],
                    date: Timestamp.now(),
                    hasNotified: true
                }, year, month, '11');

                await realUseCase.createOrUpdateDailyReport({
                    totalAmount: 3000,
                    totalCount: 3,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'usecase-test',
                    documentIdList: ['list-test-3'],
                    date: Timestamp.now(),
                    hasNotified: false
                }, year, month, '12');

                // When
                const monthlyReports = await realUseCase.getMonthlyDailyReports(year, month);

                // Then
                expect(monthlyReports).toHaveLength(4);

                const notifiedReports = monthlyReports.filter(r => r.hasNotified === true);
                const unnotifiedReports = monthlyReports.filter(r => r.hasNotified === false);

                expect(notifiedReports).toHaveLength(2);
                expect(unnotifiedReports).toHaveLength(2);

                // 具体的な値も確認
                expect(notifiedReports[0].totalAmount).toBe(3000);
                expect(unnotifiedReports.some(r => r.totalAmount === 1000)).toBe(true);
                expect(unnotifiedReports.some(r => r.totalAmount === 3000)).toBe(true);
            });

            it('週次レポート一覧で通知レベルの状態を確認できること', async () => {
                // Given
                const year = '2024';
                const month = '9';

                // 複数の週次レポートを作成（通知レベルが異なる）
                await realUseCase.createOrUpdateWeeklyReport({
                    totalAmount: 10000,
                    totalCount: 10,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'usecase-test',
                    documentIdList: ['weekly-list-1'],
                    termStartDate: Timestamp.now(),
                    termEndDate: Timestamp.now(),
                    hasNotifiedLevel1: true,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                    hasReportSent: false
                }, year, month, '1');

                await realUseCase.createOrUpdateWeeklyReport({
                    totalAmount: 20000,
                    totalCount: 20,
                    lastUpdated: FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'usecase-test',
                    documentIdList: ['weekly-list-2'],
                    termStartDate: Timestamp.now(),
                    termEndDate: Timestamp.now(),
                    hasNotifiedLevel1: true,
                    hasNotifiedLevel2: true,
                    hasNotifiedLevel3: false,
                    hasReportSent: true
                }, year, month, '2');

                // When
                const weeklyReports = await realUseCase.getMonthlyWeeklyReports(year, month);

                // Then
                expect(weeklyReports).toHaveLength(1);

                const sentReports = weeklyReports.filter(r => r.hasReportSent === true);
                const level2NotifiedReports = weeklyReports.filter(r => r.hasNotifiedLevel2 === true);

                expect(sentReports).toHaveLength(1);
                expect(level2NotifiedReports).toHaveLength(1);
                expect(sentReports[0].totalAmount).toBe(20000);
            });
        });

        describe('エラーハンドリングの実際のDBテスト', () => {
            it('存在しないレポートの更新で適切なエラーが発生すること', async () => {
                // Given
                const year = '2024';
                const month = '9';
                const day = '99'; // 存在しない日

                // When & Then
                await expect(realUseCase.updateDailyReport({ hasNotified: true }, year, month, day))
                    .rejects
                    .toThrow();
            });

            it('不正な日付でエラーが発生すること', async () => {
                // When & Then
                await expect(realUseCase.getDailyReport('invalid', '9', '15'))
                    .rejects
                    .toThrow('年、月、日は数値で指定してください');
            });
        });
    });

});
