import { DailyReportService } from '../../../../src/services/reports/DailyReportService';
import { FirestoreService } from '../../../../../shared/firebase/FirestoreService';
import { DiscordWebhookNotifier } from '../../../../../shared/discord/DiscordNotifier';
import { mockDateUtil } from '../../../mocks/DateUtilMock';

// モックの作成
jest.mock('../../../../../shared/firebase/FirestoreService');
jest.mock('../../../../../shared/discord/DiscordNotifier');

describe('DailyReportService', () => {
    // テスト用のモックデータとインスタンス
    let mockFirestoreService: jest.Mocked<FirestoreService>;
    let mockDiscordNotifier: jest.Mocked<DiscordWebhookNotifier>;
    let dailyReportService: DailyReportService;
    
    // サーバータイムスタンプとDateタイムスタンプのモック
    const mockServerTimestamp = { _seconds: 1234567890, _nanoseconds: 0 };
    const mockDateTimestamp = { _seconds: 1234567890, _nanoseconds: 0 };
    
    // 実際のコードと同じパス形式
    const dailyReportPath = 'reports/daily/2025-05/06';

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
            notifyDailyReport: jest.fn().mockResolvedValue(true),
        } as unknown as jest.Mocked<DiscordWebhookNotifier>;

        // DateUtilのモックパス設定
        mockDateUtil.getFirestorePath.mockReturnValue({
            dailyReportPath: dailyReportPath,
        });
        
        mockDateUtil.formatDate.mockReturnValue('2025/05/06');
        mockDateUtil.getJapaneseDayOfWeek.mockReturnValue('火');

        // テスト対象のインスタンスを生成
        dailyReportService = new DailyReportService(mockFirestoreService, mockDiscordNotifier);
    });

    describe('processReport', () => {
        test('新規レポート作成の場合', async () => {
            // モックの設定
            mockFirestoreService.getDocument.mockResolvedValue(null);
            
            // テストデータ
            const mockDocument = {
                ref: { path: 'details/2025/05/term1/06/123456789' }
            } as any;
            
            const mockData = {
                amount: 1000
            };
            
            const mockParams = {
                year: '2025',
                month: '05',
                term: 'term1',
                day: '06'
            };

            // テスト実行
            const result = await dailyReportService.processReport(mockDocument, mockData, mockParams);
            
            // 検証
            expect(mockFirestoreService.getDocument).toHaveBeenCalledWith(dailyReportPath);
            expect(mockFirestoreService.saveDocument).toHaveBeenCalledWith(
                dailyReportPath,
                expect.objectContaining({
                    totalAmount: 1000,
                    totalCount: 1,
                    lastUpdated: mockServerTimestamp,
                    documentIdList: ['details/2025/05/term1/06/123456789'],
                    date: mockDateTimestamp,
                    hasNotified: false
                })
            );
            
            expect(result).toEqual({
                totalAmount: 1000,
                totalCount: 1,
                lastUpdated: mockServerTimestamp,
                lastUpdatedBy: 'system',
                documentIdList: ['details/2025/05/term1/06/123456789'],
                date: mockDateTimestamp,
                hasNotified: false
            });
        });

        test('既存レポート更新の場合', async () => {
            // 既存レポートのモック
            const existingReport = {
                totalAmount: 2000,
                totalCount: 2,
                lastUpdated: { _seconds: 1234500000, _nanoseconds: 0 },
                lastUpdatedBy: 'system',
                documentIdList: ['details/2025/05/term1/06/111111', 'details/2025/05/term1/06/222222'],
                date: { _seconds: 1234500000, _nanoseconds: 0 },
                hasNotified: false
            };
            
            mockFirestoreService.getDocument.mockResolvedValue(existingReport);
            
            // テストデータ
            const mockDocument = {
                ref: { path: 'details/2025/05/term1/06/333333' }
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
            const result = await dailyReportService.processReport(mockDocument, mockData, mockParams);
            
            // 検証
            expect(mockFirestoreService.getDocument).toHaveBeenCalledWith(dailyReportPath);
            expect(mockFirestoreService.updateDocument).toHaveBeenCalledWith(
                dailyReportPath,
                expect.objectContaining({
                    totalAmount: 3500, // 2000 + 1500
                    totalCount: 3,     // 2 + 1
                    lastUpdated: mockServerTimestamp,
                    documentIdList: ['details/2025/05/term1/06/111111', 'details/2025/05/term1/06/222222', 'details/2025/05/term1/06/333333']
                })
            );
        });
    });

    describe('sendDailyReport', () => {
        test('レポートが存在し正常に送信される場合', async () => {
            // レポートのモック
            const mockReport = {
                totalAmount: 3000,
                totalCount: 3,
                lastUpdated: { _seconds: 1234500000, _nanoseconds: 0 },
                hasNotified: false
            };
            
            mockFirestoreService.getDocument.mockResolvedValue(mockReport);

            // テスト実行
            const result = await dailyReportService.sendDailyReport('2025', '05', '1', '06');
            
            // 検証
            expect(mockDiscordNotifier.notifyDailyReport).toHaveBeenCalledWith({
                title: '2025年05月06日(火) デイリーレポート',
                date: '2025/05/06',
                totalAmount: 3000,
                totalCount: 3,
                additionalInfo: '平均支出: 1,000円/件'
            });
            
            expect(mockFirestoreService.updateDocument).toHaveBeenCalledWith(
                dailyReportPath,
                expect.objectContaining({
                    hasNotified: true,
                    lastUpdated: mockServerTimestamp
                })
            );
            
            expect(result).toEqual({
                success: true,
                message: 'デイリーレポートを送信しました',
                data: expect.any(Object)
            });
        });

        test('レポートが存在しない場合', async () => {
            mockFirestoreService.getDocument.mockResolvedValue(null);

            // テスト実行
            const result = await dailyReportService.sendDailyReport('2025', '05', '1', '06');
            
            // 検証
            expect(mockDiscordNotifier.notifyDailyReport).not.toHaveBeenCalled();
            expect(mockFirestoreService.updateDocument).not.toHaveBeenCalled();
            
            expect(result).toEqual({
                success: false,
                message: expect.stringContaining('デイリーレポートが存在しません'),
            });
        });
    });
});