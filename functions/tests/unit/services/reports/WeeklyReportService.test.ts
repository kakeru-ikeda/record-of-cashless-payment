import { WeeklyReportService } from '../../../../src/services/reports/WeeklyReportService';
import { FirestoreService } from '../../../../../shared/firebase/FirestoreService';
import { DiscordWebhookNotifier } from '../../../../../shared/discord/DiscordNotifier';
import { mockDateUtil } from '../../../mocks/DateUtilMock';

// モックの作成
jest.mock('../../../../../shared/firebase/FirestoreService');
jest.mock('../../../../../shared/discord/DiscordNotifier');

describe('WeeklyReportService', () => {
    // テスト用のモックデータとインスタンス
    let mockFirestoreService: jest.Mocked<FirestoreService>;
    let mockDiscordNotifier: jest.Mocked<DiscordWebhookNotifier>;
    let weeklyReportService: WeeklyReportService;

    // サーバータイムスタンプとDateタイムスタンプのモック
    const mockServerTimestamp = { _seconds: 1234567890, _nanoseconds: 0 };
    const mockDateTimestamp = { _seconds: 1234567890, _nanoseconds: 0 };

    // 実際のコードと同じパス形式
    const weeklyReportPath = 'reports/weekly/2025-05/term1';
    const weeklyTargetPath = 'reports/target/2025-05/term1';

    // テスト前の準備
    beforeEach(() => {
        // モックの初期化
        jest.clearAllMocks();

        // FirestoreServiceのモック
        mockFirestoreService = {
            getInstance: jest.fn().mockReturnThis(),
            setCloudFunctions: jest.fn(),
            initialize: jest.fn(),
            getServerTimestamp: jest.fn().mockReturnValue(mockServerTimestamp),
            getTimestampFromDate: jest.fn().mockReturnValue(mockDateTimestamp),
            getDocument: jest.fn(),
            saveDocument: jest.fn(),
            updateDocument: jest.fn(),
        } as unknown as jest.Mocked<FirestoreService>;

        // DiscordNotifierのモック
        mockDiscordNotifier = {
            notifyWeeklyReport: jest.fn().mockResolvedValue(true),
            notifyWeeklyAlert: jest.fn().mockResolvedValue(true),
        } as unknown as jest.Mocked<DiscordWebhookNotifier>;

        // DateUtilのモックパス設定
        mockDateUtil.getFirestorePath.mockReturnValue({
            weeklyReportPath: weeklyReportPath,
            weeklyTargetPath: weeklyTargetPath,
        });

        mockDateUtil.formatDateRange.mockReturnValue('2025/05/01-2025/05/07');
        mockDateUtil.getTermDateRange.mockReturnValue({
            start: new Date(2025, 4, 1),
            end: new Date(2025, 4, 7)
        });

        // モックデータをさらに追加（日付処理関連のエラー対策）
        mockDateUtil.formatDate = jest.fn().mockReturnValue('2025/05/01');

        // テスト対象のインスタンスを生成
        weeklyReportService = new WeeklyReportService(mockFirestoreService, mockDiscordNotifier);
    });

    describe('processReport', () => {
        test('新規週次レポート作成の場合', async () => {
            // モックの設定
            mockFirestoreService.getDocument.mockResolvedValue(null);

            // テストデータ
            const mockDocument = {
                ref: { path: 'details/2025/05/term1/06/123456789' }
            } as any;

            const mockData = {
                amount: 1500
            };

            const mockParams = {
                year: '2025',
                month: '05',
                term: 'term1',
                day: '06'
            };

            // テスト実行
            const result = await weeklyReportService.processReport(mockDocument, mockData, mockParams);

            // 検証
            expect(mockFirestoreService.getDocument).toHaveBeenCalledWith(weeklyReportPath);
            expect(mockFirestoreService.saveDocument).toHaveBeenCalledWith(
                weeklyReportPath,
                expect.objectContaining({
                    totalAmount: 1500,
                    totalCount: 1,
                    lastUpdated: mockServerTimestamp,
                    documentIdList: ['details/2025/05/term1/06/123456789'],
                    termStartDate: mockDateTimestamp,
                    termEndDate: mockDateTimestamp,
                    hasReportSent: false,
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false
                })
            );

            expect(result).toEqual(
                expect.objectContaining({
                    totalAmount: 1500,
                    totalCount: 1,
                    lastUpdated: mockServerTimestamp,
                    lastUpdatedBy: 'system',
                    documentIdList: ['details/2025/05/term1/06/123456789']
                })
            );
        });

        test('既存週次レポート更新の場合', async () => {
            // 既存レポートのモック
            const existingReport = {
                totalAmount: 3000,
                totalCount: 3,
                lastUpdated: { _seconds: 1234500000, _nanoseconds: 0 },
                lastUpdatedBy: 'system',
                documentIdList: ['details/2025/05/term1/01/111111', 'details/2025/05/term1/02/222222'],
                termStartDate: { _seconds: 1234500000, _nanoseconds: 0 },
                termEndDate: { _seconds: 1234500000, _nanoseconds: 0 },
                hasReportSent: false,
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false
            };

            mockFirestoreService.getDocument.mockResolvedValue(existingReport);

            // テストデータ
            const mockDocument = {
                ref: { path: 'details/2025/05/term1/06/333333' }
            } as any;

            const mockData = {
                amount: 2000
            };

            const mockParams = {
                year: '2025',
                month: '05',
                term: 'term1',
                day: '06'
            };

            // テスト実行
            const result = await weeklyReportService.processReport(mockDocument, mockData, mockParams);

            // 検証
            expect(mockFirestoreService.getDocument).toHaveBeenCalledWith(weeklyReportPath);
            expect(mockFirestoreService.updateDocument).toHaveBeenCalledWith(
                weeklyReportPath,
                expect.objectContaining({
                    totalAmount: 5000, // 3000 + 2000
                    totalCount: 4,     // 3 + 1
                    lastUpdated: mockServerTimestamp,
                    documentIdList: ['details/2025/05/term1/01/111111', 'details/2025/05/term1/02/222222', 'details/2025/05/term1/06/333333']
                })
            );
        });
    });

    describe('sendWeeklyReport', () => {
        test('レポートが存在しない場合', async () => {
            mockFirestoreService.getDocument.mockResolvedValue(null);

            // テスト実行
            const result = await weeklyReportService.sendWeeklyReport('2025', '05', 'term1');

            // 検証
            expect(mockDiscordNotifier.notifyWeeklyReport).not.toHaveBeenCalled();
            expect(mockFirestoreService.updateDocument).not.toHaveBeenCalled();

            expect(result).toEqual({
                success: false,
                message: expect.stringContaining('ウィークリーレポートが存在しません'),
            });
        });
    });
});