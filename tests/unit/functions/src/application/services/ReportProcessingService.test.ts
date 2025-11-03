import { ReportProcessingService } from '../../../../../../functions/src/application/services/ReportProcessingService';
import { IDiscordNotifier } from '../../../../../../shared/domain/interfaces/discord/IDiscordNotifier';
import { IConfigRepository } from '../../../../../../shared/domain/interfaces/database/repositories/IConfigRepository';
import { FirestoreReportUseCase } from '../../../../../../shared/usecases/database/FirestoreReportUseCase';
import { DailyReport, WeeklyReport, MonthlyReport } from '../../../../../../shared/domain/entities/Reports';
import { ReportThresholds } from '../../../../../../shared/domain/entities/ReportThresholds';

// Mocks
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

const mockDiscordNotifier: jest.Mocked<IDiscordNotifier> = {
    notifyCardUsage: jest.fn(),
    notifyDailyReport: jest.fn(),
    notifyWeeklyReport: jest.fn(),
    notifyMonthlyReport: jest.fn(),
    notifyError: jest.fn(),
    notifyLogging: jest.fn(),
};

const mockConfigRepository: jest.Mocked<IConfigRepository> = {
    getReportThresholds: jest.fn().mockResolvedValue(mockThresholds),
};

const mockReportUseCase: jest.Mocked<FirestoreReportUseCase> = {
    getDailyReport: jest.fn(),
    createDailyReport: jest.fn(),
    updateDailyReport: jest.fn(),
    getWeeklyReport: jest.fn(),
    createWeeklyReport: jest.fn(),
    updateWeeklyReport: jest.fn(),
    getMonthlyReport: jest.fn(),
    createMonthlyReport: jest.fn(),
    updateMonthlyReport: jest.fn(),
} as any; // Firebase Functions の型チェックを回避

// Mock Firebase Functions DocumentSnapshot
const mockDocument = {
    ref: {
        path: 'details/2024/term1/01/1234567890123',
    },
} as any;

describe('ReportProcessingService', () => {
    let service: ReportProcessingService;

    beforeEach(() => {
        service = new ReportProcessingService(mockDiscordNotifier, mockReportUseCase, mockConfigRepository);
        jest.clearAllMocks();
    });

    describe('processDailyReport', () => {
        const params = { year: '2024', month: '1', day: '1' };
        const data = { amount: 1000 };

        it('既存のデイリーレポートが存在しない場合、新規作成する', async () => {
            // Given
            mockReportUseCase.getDailyReport.mockRejectedValue(new Error('Not found'));

            // When
            const result = await service.processDailyReport(mockDocument, data, params);

            // Then
            expect(mockReportUseCase.getDailyReport).toHaveBeenCalledWith('2024', '01', '01');
            expect(mockReportUseCase.createDailyReport).toHaveBeenCalled();
            expect(result.totalAmount).toBe(1000);
            expect(result.totalCount).toBe(1);
        });

        it('既存のデイリーレポートが存在する場合、更新する', async () => {
            // Given
            const existingReport = {
                totalAmount: 500,
                totalCount: 1,
                documentIdList: ['existing-doc'],
            } as DailyReport;
            mockReportUseCase.getDailyReport.mockResolvedValue(existingReport);

            // When
            const result = await service.processDailyReport(mockDocument, data, params);

            // Then
            expect(mockReportUseCase.updateDailyReport).toHaveBeenCalled();
            expect(result.totalAmount).toBe(1500);
            expect(result.totalCount).toBe(2);
            expect(result.documentIdList).toContain(mockDocument.ref.path);
        });
    });

    describe('processWeeklyReport', () => {
        const params = { year: '2024', month: '1', day: '7' };
        const data = { amount: 2000 };

        it('既存のウィークリーレポートが存在しない場合、新規作成する', async () => {
            // Given
            mockReportUseCase.getWeeklyReport.mockRejectedValue(new Error('Not found'));

            // When
            const result = await service.processWeeklyReport(mockDocument, data, params);

            // Then
            expect(mockReportUseCase.createWeeklyReport).toHaveBeenCalled();
            expect(result.totalAmount).toBe(2000);
            expect(result.totalCount).toBe(1);
        });

        it('既存のウィークリーレポートが存在する場合、更新する', async () => {
            // Given
            const existingReport = {
                totalAmount: 3000,
                totalCount: 2,
                documentIdList: ['existing-doc'],
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
            } as WeeklyReport;
            mockReportUseCase.getWeeklyReport.mockResolvedValue(existingReport);

            // When
            const result = await service.processWeeklyReport(mockDocument, data, params);

            // Then
            expect(mockReportUseCase.updateWeeklyReport).toHaveBeenCalled();
            expect(result.totalAmount).toBe(5000);
            expect(result.totalCount).toBe(3);
        });
    });

    describe('processMonthlyReport', () => {
        const params = { year: '2024', month: '1' };
        const data = { amount: 3000 };

        it('既存のマンスリーレポートが存在しない場合、新規作成する', async () => {
            // Given
            mockReportUseCase.getMonthlyReport.mockRejectedValue(new Error('Not found'));

            // When
            const result = await service.processMonthlyReport(mockDocument, data, params);

            // Then
            expect(mockReportUseCase.createMonthlyReport).toHaveBeenCalled();
            expect(result.totalAmount).toBe(3000);
            expect(result.totalCount).toBe(1);
        });

        it('既存のマンスリーレポートが存在する場合、更新する', async () => {
            // Given
            const existingReport = {
                totalAmount: 15000,
                totalCount: 5,
                documentIdList: ['existing-doc'],
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
            } as MonthlyReport;
            mockReportUseCase.getMonthlyReport.mockResolvedValue(existingReport);

            // When
            const result = await service.processMonthlyReport(mockDocument, data, params);

            // Then
            expect(mockReportUseCase.updateMonthlyReport).toHaveBeenCalled();
            expect(result.totalAmount).toBe(18000);
            expect(result.totalCount).toBe(6);
        });
    });

    describe('アラートしきい値チェック - ウィークリー', () => {
        const params = { year: '2024', month: '1', day: '7' };

        it('LEVEL1のしきい値を超えた場合、LEVEL1のフラグのみが更新される', async () => {
            // Given: 初期状態で1500円（LEVEL1: 1000円を超過）
            const data = { amount: 1500 };
            mockReportUseCase.getWeeklyReport.mockRejectedValue(new Error('Not found'));
            mockDiscordNotifier.notifyWeeklyReport.mockResolvedValue(true);

            // When
            await service.processWeeklyReport(mockDocument, data, params);

            // Then
            expect(mockDiscordNotifier.notifyWeeklyReport).toHaveBeenCalled();
            // 新規作成時: createWeeklyReport + updateWeeklyReport（フラグ更新）が呼ばれる
            expect(mockReportUseCase.createWeeklyReport).toHaveBeenCalled();
            expect(mockReportUseCase.updateWeeklyReport).toHaveBeenCalled();
            
            const updateCall = mockReportUseCase.updateWeeklyReport.mock.calls[0];
            expect(updateCall[0].hasNotifiedLevel1).toBe(true);
            expect(updateCall[0].hasNotifiedLevel2).toBe(false);
            expect(updateCall[0].hasNotifiedLevel3).toBe(false);
        });

        it('一撃でLEVEL2のしきい値を超えた場合、LEVEL1とLEVEL2のフラグが更新される', async () => {
            // Given: 初期状態で6000円（LEVEL2: 5000円を超過、LEVEL1も超過）
            const data = { amount: 6000 };
            mockReportUseCase.getWeeklyReport.mockRejectedValue(new Error('Not found'));
            mockDiscordNotifier.notifyWeeklyReport.mockResolvedValue(true);

            // When
            await service.processWeeklyReport(mockDocument, data, params);

            // Then
            expect(mockDiscordNotifier.notifyWeeklyReport).toHaveBeenCalled();
            expect(mockReportUseCase.createWeeklyReport).toHaveBeenCalled();
            expect(mockReportUseCase.updateWeeklyReport).toHaveBeenCalled();
            
            const updateCall = mockReportUseCase.updateWeeklyReport.mock.calls[0];
            expect(updateCall[0].hasNotifiedLevel1).toBe(true);
            expect(updateCall[0].hasNotifiedLevel2).toBe(true);
            expect(updateCall[0].hasNotifiedLevel3).toBe(false);
        });

        it('一撃でLEVEL3のしきい値を超えた場合、全てのフラグが更新される', async () => {
            // Given: 初期状態で15000円（LEVEL3: 10000円を超過、LEVEL1、LEVEL2も超過）
            const data = { amount: 15000 };
            mockReportUseCase.getWeeklyReport.mockRejectedValue(new Error('Not found'));
            mockDiscordNotifier.notifyWeeklyReport.mockResolvedValue(true);

            // When
            await service.processWeeklyReport(mockDocument, data, params);

            // Then
            expect(mockDiscordNotifier.notifyWeeklyReport).toHaveBeenCalled();
            expect(mockReportUseCase.createWeeklyReport).toHaveBeenCalled();
            expect(mockReportUseCase.updateWeeklyReport).toHaveBeenCalled();
            
            const updateCall = mockReportUseCase.updateWeeklyReport.mock.calls[0];
            expect(updateCall[0].hasNotifiedLevel1).toBe(true);
            expect(updateCall[0].hasNotifiedLevel2).toBe(true);
            expect(updateCall[0].hasNotifiedLevel3).toBe(true);
        });

        it('LEVEL1通知済みの状態でLEVEL2を超えた場合、LEVEL2のフラグのみが追加更新される', async () => {
            // Given: LEVEL1通知済み、現在3000円で+3000円追加（合計6000円でLEVEL2超過）
            const existingReport = {
                totalAmount: 3000,
                totalCount: 2,
                documentIdList: ['existing-doc'],
                hasNotifiedLevel1: true,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
                hasReportSent: false,
                termStartDate: { toDate: () => new Date('2024-01-01') },
                termEndDate: { toDate: () => new Date('2024-01-07') },
                lastUpdatedBy: 'system',
            } as any;
            const data = { amount: 3000 };
            mockReportUseCase.getWeeklyReport.mockResolvedValue(existingReport);
            mockDiscordNotifier.notifyWeeklyReport.mockResolvedValue(true);

            // When
            await service.processWeeklyReport(mockDocument, data, params);

            // Then
            expect(mockDiscordNotifier.notifyWeeklyReport).toHaveBeenCalled();
            
            // updateWeeklyReportは2回呼ばれる（1回目: レポート更新、2回目: フラグ更新）
            expect(mockReportUseCase.updateWeeklyReport).toHaveBeenCalledTimes(2);
            
            // 2回目の呼び出し（フラグ更新）を確認
            const flagUpdateCall = mockReportUseCase.updateWeeklyReport.mock.calls[1];
            expect(flagUpdateCall).toBeDefined();
            expect(flagUpdateCall[0].hasNotifiedLevel1).toBe(true);
            expect(flagUpdateCall[0].hasNotifiedLevel2).toBe(true);
            expect(flagUpdateCall[0].hasNotifiedLevel3).toBe(false);
        });

        it('既にLEVEL2通知済みの場合、再度通知されない', async () => {
            // Given: LEVEL2通知済み、現在6000円で+1000円追加（合計7000円だが通知済み）
            const existingReport = {
                totalAmount: 6000,
                totalCount: 3,
                documentIdList: ['existing-doc'],
                hasNotifiedLevel1: true,
                hasNotifiedLevel2: true,
                hasNotifiedLevel3: false,
            } as WeeklyReport;
            const data = { amount: 1000 };
            mockReportUseCase.getWeeklyReport.mockResolvedValue(existingReport);

            // When
            await service.processWeeklyReport(mockDocument, data, params);

            // Then
            expect(mockDiscordNotifier.notifyWeeklyReport).not.toHaveBeenCalled();
        });
    });

    describe('アラートしきい値チェック - マンスリー', () => {
        const params = { year: '2024', month: '1' };

        it('LEVEL1のしきい値を超えた場合、LEVEL1のフラグのみが更新される', async () => {
            // Given: 初期状態で5000円（LEVEL1: 4000円を超過）
            const data = { amount: 5000 };
            mockReportUseCase.getMonthlyReport.mockRejectedValue(new Error('Not found'));
            mockDiscordNotifier.notifyMonthlyReport.mockResolvedValue(true);

            // When
            await service.processMonthlyReport(mockDocument, data, params);

            // Then
            expect(mockDiscordNotifier.notifyMonthlyReport).toHaveBeenCalled();
            expect(mockReportUseCase.createMonthlyReport).toHaveBeenCalled();
            expect(mockReportUseCase.updateMonthlyReport).toHaveBeenCalled();
            
            const updateCall = mockReportUseCase.updateMonthlyReport.mock.calls[0];
            expect(updateCall[0].hasNotifiedLevel1).toBe(true);
            expect(updateCall[0].hasNotifiedLevel2).toBe(false);
            expect(updateCall[0].hasNotifiedLevel3).toBe(false);
        });

        it('一撃でLEVEL2のしきい値を超えた場合、LEVEL1とLEVEL2のフラグが更新される', async () => {
            // Given: 初期状態で25000円（LEVEL2: 20000円を超過、LEVEL1も超過）
            const data = { amount: 25000 };
            mockReportUseCase.getMonthlyReport.mockRejectedValue(new Error('Not found'));
            mockDiscordNotifier.notifyMonthlyReport.mockResolvedValue(true);

            // When
            await service.processMonthlyReport(mockDocument, data, params);

            // Then
            expect(mockDiscordNotifier.notifyMonthlyReport).toHaveBeenCalled();
            expect(mockReportUseCase.createMonthlyReport).toHaveBeenCalled();
            expect(mockReportUseCase.updateMonthlyReport).toHaveBeenCalled();
            
            const updateCall = mockReportUseCase.updateMonthlyReport.mock.calls[0];
            expect(updateCall[0].hasNotifiedLevel1).toBe(true);
            expect(updateCall[0].hasNotifiedLevel2).toBe(true);
            expect(updateCall[0].hasNotifiedLevel3).toBe(false);
        });

        it('一撃でLEVEL3のしきい値を超えた場合、全てのフラグが更新される', async () => {
            // Given: 初期状態で50000円（LEVEL3: 40000円を超過、LEVEL1、LEVEL2も超過）
            const data = { amount: 50000 };
            mockReportUseCase.getMonthlyReport.mockRejectedValue(new Error('Not found'));
            mockDiscordNotifier.notifyMonthlyReport.mockResolvedValue(true);

            // When
            await service.processMonthlyReport(mockDocument, data, params);

            // Then
            expect(mockDiscordNotifier.notifyMonthlyReport).toHaveBeenCalled();
            expect(mockReportUseCase.createMonthlyReport).toHaveBeenCalled();
            expect(mockReportUseCase.updateMonthlyReport).toHaveBeenCalled();
            
            const updateCall = mockReportUseCase.updateMonthlyReport.mock.calls[0];
            expect(updateCall[0].hasNotifiedLevel1).toBe(true);
            expect(updateCall[0].hasNotifiedLevel2).toBe(true);
            expect(updateCall[0].hasNotifiedLevel3).toBe(true);
        });

        it('LEVEL1通知済みの状態で一撃でLEVEL3を超えた場合、LEVEL2とLEVEL3のフラグが追加更新される', async () => {
            // Given: LEVEL1通知済み、現在5000円で+40000円追加（合計45000円でLEVEL3超過）
            const existingReport = {
                totalAmount: 5000,
                totalCount: 2,
                documentIdList: ['existing-doc'],
                hasNotifiedLevel1: true,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
                hasReportSent: false,
                monthStartDate: { toDate: () => new Date('2024-01-01') },
                monthEndDate: { toDate: () => new Date('2024-01-31') },
                lastUpdatedBy: 'system',
            } as any;
            const data = { amount: 40000 };
            mockReportUseCase.getMonthlyReport.mockResolvedValue(existingReport);
            mockDiscordNotifier.notifyMonthlyReport.mockResolvedValue(true);

            // When
            await service.processMonthlyReport(mockDocument, data, params);

            // Then
            expect(mockDiscordNotifier.notifyMonthlyReport).toHaveBeenCalled();
            
            // updateMonthlyReportは2回呼ばれる（1回目: レポート更新、2回目: フラグ更新）
            expect(mockReportUseCase.updateMonthlyReport).toHaveBeenCalledTimes(2);
            
            // 2回目の呼び出し（フラグ更新）を確認
            const flagUpdateCall = mockReportUseCase.updateMonthlyReport.mock.calls[1];
            expect(flagUpdateCall).toBeDefined();
            expect(flagUpdateCall[0].hasNotifiedLevel1).toBe(true);
            expect(flagUpdateCall[0].hasNotifiedLevel2).toBe(true);
            expect(flagUpdateCall[0].hasNotifiedLevel3).toBe(true);
        });

        it('既にLEVEL3通知済みの場合、再度通知されない', async () => {
            // Given: LEVEL3通知済み、現在45000円で+5000円追加（合計50000円だが通知済み）
            const existingReport = {
                totalAmount: 45000,
                totalCount: 5,
                documentIdList: ['existing-doc'],
                hasNotifiedLevel1: true,
                hasNotifiedLevel2: true,
                hasNotifiedLevel3: true,
            } as MonthlyReport;
            const data = { amount: 5000 };
            mockReportUseCase.getMonthlyReport.mockResolvedValue(existingReport);

            // When
            await service.processMonthlyReport(mockDocument, data, params);

            // Then
            expect(mockDiscordNotifier.notifyMonthlyReport).not.toHaveBeenCalled();
        });
    });
});

