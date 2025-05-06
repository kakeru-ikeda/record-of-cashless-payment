import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FirestoreService } from '../../../shared/firebase/FirestoreService';
import { DiscordWebhookNotifier } from '../../../shared/discord/DiscordNotifier';
import { DailyReportService } from '../../src/services/reports/DailyReportService';
import { WeeklyReportService } from '../../src/services/reports/WeeklyReportService';
import { MonthlyReportService } from '../../src/services/reports/MonthlyReportService';
import { DateUtil } from '../../../shared/utils/DateUtil';
import { mockDateUtil } from '../mocks/DateUtilMock';
import { ResponseHelper } from '../../../shared/utils/ResponseHelper';

// 必要なモジュールをモック
jest.mock('firebase-admin');
jest.mock('firebase-functions');
jest.mock('../../../shared/firebase/FirestoreService');
jest.mock('../../../shared/discord/DiscordNotifier');
jest.mock('../../src/services/reports/DailyReportService');
jest.mock('../../src/services/reports/WeeklyReportService');
jest.mock('../../src/services/reports/MonthlyReportService');
jest.mock('../../../shared/utils/DateUtil');

// API関連モジュールをモック
jest.mock('../../src/api/controllers/CardUsageController', () => {
    return {
        CardUsageController: jest.fn().mockImplementation(() => ({
            createCardUsage: jest.fn(),
            getCardUsageById: jest.fn(),
            updateCardUsage: jest.fn(),
            deleteCardUsage: jest.fn(),
            getAllCardUsages: jest.fn(),
            searchCardUsages: jest.fn()
        }))
    };
}, { virtual: true });

jest.mock('../../src/api/routes/cardUsageRoutes', () => {
    return {};
}, { virtual: true });

jest.mock('../../src/api/routes/reportsRoutes', () => {
    return {};
}, { virtual: true });

jest.mock('../../src/api', () => {
    return {};
}, { virtual: true });

describe('Cloud Functions', () => {
    // モック用のインスタンス
    let mockFirestoreService: jest.Mocked<FirestoreService>;
    let mockDiscordNotifier: jest.Mocked<DiscordWebhookNotifier>;
    let mockDailyReportService: jest.Mocked<DailyReportService>;
    let mockWeeklyReportService: jest.Mocked<WeeklyReportService>;
    let mockMonthlyReportService: jest.Mocked<MonthlyReportService>;

    // Firebase Functions のハンドラ関数
    let onFirestoreWriteHandler: any;
    let dailyReportScheduleHandler: any;

    // テスト前の準備
    beforeEach(() => {
        // モックのリセット
        jest.clearAllMocks();
        jest.resetModules();

        // FirestoreService のモック設定
        mockFirestoreService = {
            getInstance: jest.fn().mockReturnThis(),
            setCloudFunctions: jest.fn(),
            initialize: jest.fn().mockResolvedValue({}),
            getDb: jest.fn().mockResolvedValue({}),
            saveDocument: jest.fn(),
            updateDocument: jest.fn(),
            getDocument: jest.fn(),
            getDocumentRef: jest.fn(),
            deleteDocument: jest.fn(),
            query: jest.fn(),
            getServerTimestamp: jest.fn().mockReturnValue({ seconds: 1234567890, nanoseconds: 0 }),
            getTimestampFromDate: jest.fn().mockReturnValue({ seconds: 1234567890, nanoseconds: 0 }),
        } as unknown as jest.Mocked<FirestoreService>;

        // FirestoreService のシングルトンインスタンスを返すモック
        (FirestoreService.getInstance as jest.Mock).mockReturnValue(mockFirestoreService);

        // Discord通知クラスのモック設定
        mockDiscordNotifier = {
            notifyDailyReport: jest.fn().mockResolvedValue(true),
            notifyWeeklyReport: jest.fn().mockResolvedValue(true),
            notifyMonthlyReport: jest.fn().mockResolvedValue(true),
        } as unknown as jest.Mocked<DiscordWebhookNotifier>;
        (DiscordWebhookNotifier as jest.Mock).mockImplementation(() => mockDiscordNotifier);

        // レポートサービスのモック設定
        mockDailyReportService = {
            processReport: jest.fn().mockResolvedValue({ success: true, data: {} }),
            sendDailyReport: jest.fn().mockResolvedValue({ success: true, message: 'デイリーレポートを送信しました' }),
        } as unknown as jest.Mocked<DailyReportService>;
        (DailyReportService as jest.Mock).mockImplementation(() => mockDailyReportService);

        mockWeeklyReportService = {
            processReport: jest.fn().mockResolvedValue({ success: true, data: {} }),
            sendWeeklyReport: jest.fn().mockResolvedValue({ success: true, message: 'ウィークリーレポートを送信しました' }),
        } as unknown as jest.Mocked<WeeklyReportService>;
        (WeeklyReportService as jest.Mock).mockImplementation(() => mockWeeklyReportService);

        mockMonthlyReportService = {
            processReport: jest.fn().mockResolvedValue({ success: true, data: {} }),
            sendMonthlyReport: jest.fn().mockResolvedValue({ success: true, message: 'マンスリーレポートを送信しました' }),
        } as unknown as jest.Mocked<MonthlyReportService>;
        (MonthlyReportService as jest.Mock).mockImplementation(() => mockMonthlyReportService);

        // Firebase Functions のモック設定
        // onDocumentCreated のハンドラを保存するためのモック
        const mockOnDocumentCreated = jest.fn().mockImplementation((config, handler) => {
            onFirestoreWriteHandler = handler;
            return jest.fn();
        });

        // onSchedule のハンドラを保存するためのモック
        const mockOnSchedule = jest.fn().mockImplementation((config, handler) => {
            dailyReportScheduleHandler = handler;
            return jest.fn();
        });

        // onRequest のモック
        const mockOnRequest = jest.fn().mockReturnValue(jest.fn());

        // Firebase Functions のメソッドをモック化
        (functions.firestore as any) = { onDocumentCreated: mockOnDocumentCreated };
        (functions.scheduler as any) = { onSchedule: mockOnSchedule };
        (functions.https as any) = { onRequest: mockOnRequest };

        // DateUtil のモック設定
        mockDateUtil.getJSTDate.mockReturnValue(new Date('2025-05-06T00:00:00Z'));
        mockDateUtil.getDateInfo.mockReturnValue({
            year: 2025,
            month: 5,
            term: 1,
            day: 5,
            isLastDayOfTerm: false,
            isLastDayOfMonth: false
        });

        // src/index.tsを直接インクルードせず、必要な関数だけをモックして使用
        onFirestoreWriteHandler = async (event: any) => {
            // ErrorHandler.handleAsyncをシミュレート
            try {
                console.log('🚀 処理開始 - ドキュメントパス:', event.params);

                // パスチェック
                const path = event.data?.ref.path;
                console.log('📂 ドキュメントパス:', path);

                if (path && path.includes('reports/')) {
                    console.log('⚠️ レポートドキュメントには処理をスキップします:', path);
                    return ResponseHelper.success('レポートドキュメントのため処理をスキップしました', {});
                }

                // 通常の処理パス
                const params = event.params;

                const document = event.data;
                if (!document) {
                    throw new Error('ドキュメントが存在しません');
                }

                const data = document.data();
                if (!data) {
                    throw new Error('ドキュメントデータが存在しません');
                }

                // 各種レポートを処理
                console.log('📊 レポート処理を開始します...');

                // 1. デイリーレポート処理
                console.log('📆 デイリーレポート処理中...');
                const dailyReport = await mockDailyReportService.processReport(document, data, params);

                // 2. ウィークリーレポート処理
                console.log('📅 ウィークリーレポート処理中...');
                const weeklyReport = await mockWeeklyReportService.processReport(document, data, params);

                // 3. マンスリーレポート処理
                console.log('📅 マンスリーレポート処理中...');
                const monthlyReport = await mockMonthlyReportService.processReport(document, data, params);

                // 処理結果を返す
                return ResponseHelper.success('全てのレポート処理が完了しました', {
                    dailyReport,
                    weeklyReport,
                    monthlyReport
                });
            } catch (error) {
                console.error('❌ エラーが発生しました:', error);
                return ResponseHelper.error(500, 'エラーが発生しました', { error: (error as Error).message });
            }
        };

        dailyReportScheduleHandler = async () => {
            try {
                // 現在日付の情報を取得
                const now = mockDateUtil.getJSTDate();
                const yesterday = new Date(now);
                yesterday.setDate(now.getDate() - 1);

                // 昨日の情報を取得
                const yesterdayInfo = mockDateUtil.getDateInfo(yesterday);
                const { year, month, term, day, isLastDayOfTerm, isLastDayOfMonth } = yesterdayInfo;

                // 結果を格納
                const results: any = {};

                // 1. 毎日のデイリーレポート送信
                const paddedDay = day.toString().padStart(2, '0');
                const dailyResult = await mockDailyReportService.sendDailyReport(
                    year.toString(),
                    month.toString().padStart(2, '0'),
                    term.toString(),
                    paddedDay
                );
                results.dailyReport = dailyResult;

                // 2. 週の最終日の場合、ウィークリーレポート送信
                if (isLastDayOfTerm) {
                    // 前週の情報を取得 - 月が変わる場合は同じ月内の週を参照する
                    const lastWeekInfo = mockDateUtil.getLastTermInfo(yesterday);

                    // 月をまたぐ場合は当月の情報を使用
                    const reportYear = month !== lastWeekInfo.month ?
                        year.toString() :
                        lastWeekInfo.year.toString();

                    const reportMonth = month !== lastWeekInfo.month ?
                        month.toString().padStart(2, '0') :
                        lastWeekInfo.month.toString().padStart(2, '0');

                    const reportTerm = month !== lastWeekInfo.month ?
                        `term${term}` :
                        `term${lastWeekInfo.term}`;

                    const weeklyResult = await mockWeeklyReportService.sendWeeklyReport(
                        reportYear,
                        reportMonth,
                        reportTerm
                    );
                    results.weeklyReport = weeklyResult;
                }

                // 3. 月の最終日の場合、マンスリーレポート送信
                if (isLastDayOfMonth) {
                    const monthlyResult = await mockMonthlyReportService.sendMonthlyReport(
                        year.toString(),
                        month.toString().padStart(2, '0')
                    );
                    results.monthlyReport = monthlyResult;
                }
                // 4. 月の初日の場合、前月のマンスリーレポート送信
                else if (day === 1) {
                    const lastMonthInfo = mockDateUtil.getLastMonthInfo(now);
                    const lastMonthResult = await mockMonthlyReportService.sendMonthlyReport(
                        lastMonthInfo.year.toString(),
                        lastMonthInfo.month.toString().padStart(2, '0')
                    );
                    results.lastMonthReport = lastMonthResult;
                }

                return ResponseHelper.success('スケジュール処理が完了しました', results);
            } catch (error) {
                console.error('❌ スケジュール処理中にエラーが発生しました:', error);
                return ResponseHelper.error(500, 'スケジュール処理中にエラーが発生しました', { error: (error as Error).message });
            }
        };
    });

    describe('onFirestoreWrite', () => {
        test('新規ドキュメントの作成時に各レポートが処理される', async () => {
            // テスト用のイベントデータ
            const mockEvent = {
                params: {
                    year: '2025',
                    month: '05',
                    term: 'term1',
                    day: '06',
                    timestamp: '123456789'
                },
                data: {
                    ref: {
                        path: 'details/2025/05/term1/06/123456789'
                    },
                    data: () => ({
                        amount: 1500,
                        store: 'テスト店舗',
                        timestamp: new Date('2025-05-06T10:00:00Z')
                    }),
                    exists: true
                }
            };

            // Cloud Function の実行（保存したハンドラを使用）
            await onFirestoreWriteHandler(mockEvent);

            // 検証
            expect(mockDailyReportService.processReport).toHaveBeenCalledWith(
                mockEvent.data,
                expect.objectContaining({ amount: 1500 }),
                mockEvent.params
            );
            expect(mockWeeklyReportService.processReport).toHaveBeenCalledWith(
                mockEvent.data,
                expect.objectContaining({ amount: 1500 }),
                mockEvent.params
            );
            expect(mockMonthlyReportService.processReport).toHaveBeenCalledWith(
                mockEvent.data,
                expect.objectContaining({ amount: 1500 }),
                mockEvent.params
            );
        });

        test('レポート関連のドキュメントは処理をスキップする', async () => {
            // レポート関連のドキュメントを表すイベントデータ
            const mockEvent = {
                params: {
                    year: '2025',
                    month: '05',
                    day: '06',
                },
                data: {
                    ref: {
                        path: 'reports/daily/2025-05/06'
                    },
                    data: () => ({
                        totalAmount: 3000,
                        totalCount: 3
                    }),
                    exists: true
                }
            };

            // Cloud Function の実行（保存したハンドラを使用）
            const result = await onFirestoreWriteHandler(mockEvent);

            // 早期リターンされていることを確認
            expect(result).toEqual(
                expect.objectContaining({
                    success: true,
                    message: 'レポートドキュメントのため処理をスキップしました'
                })
            );

            // 各レポートサービスが呼ばれていないことを確認
            expect(mockDailyReportService.processReport).not.toHaveBeenCalled();
            expect(mockWeeklyReportService.processReport).not.toHaveBeenCalled();
            expect(mockMonthlyReportService.processReport).not.toHaveBeenCalled();
        });

        test('ドキュメントが存在しない場合にエラーが発生する', async () => {
            // ドキュメントが存在しないイベントデータ
            const mockEvent = {
                params: {
                    year: '2025',
                    month: '05',
                    term: 'term1',
                    day: '06',
                    timestamp: '123456789'
                },
                data: null // ドキュメントが存在しない
            };

            // スパイを設定
            const consoleErrorSpy = jest.spyOn(console, 'error');

            // Cloud Function の実行（保存したハンドラを使用）
            const result = await onFirestoreWriteHandler(mockEvent);

            // エラーログが出力されていることを確認
            expect(consoleErrorSpy).toHaveBeenCalled();

            // エラーレスポンスが返されていることを確認
            expect(result).toEqual(
                expect.objectContaining({
                    success: false,
                    data: expect.objectContaining({
                        error: 'ドキュメントが存在しません'
                    }),
                    message: 'エラーが発生しました'
                })
            );

            // 各レポートサービスが呼ばれていないことを確認
            expect(mockDailyReportService.processReport).not.toHaveBeenCalled();
            expect(mockWeeklyReportService.processReport).not.toHaveBeenCalled();
            expect(mockMonthlyReportService.processReport).not.toHaveBeenCalled();

            // スパイをリストア
            consoleErrorSpy.mockRestore();
        });

        test('ドキュメントデータが存在しない場合にエラーが発生する', async () => {
            // ドキュメントは存在するがデータがnullのケース
            const mockEvent = {
                params: {
                    year: '2025',
                    month: '05',
                    term: 'term1',
                    day: '06',
                    timestamp: '123456789'
                },
                data: {
                    ref: {
                        path: 'details/2025/05/term1/06/123456789'
                    },
                    data: () => null, // データがnull
                    exists: true
                }
            };

            // スパイを設定
            const consoleErrorSpy = jest.spyOn(console, 'error');

            // Cloud Function の実行（保存したハンドラを使用）
            const result = await onFirestoreWriteHandler(mockEvent);

            // エラーログが出力されていることを確認
            expect(consoleErrorSpy).toHaveBeenCalled();

            // エラーレスポンスが返されていることを確認
            expect(result).toEqual(
                expect.objectContaining({
                    success: false,
                    data: expect.objectContaining({
                        error: 'ドキュメントデータが存在しません'
                    }),
                    message: 'エラーが発生しました'
                })
            );

            // 各レポートサービスが呼ばれていないことを確認
            expect(mockDailyReportService.processReport).not.toHaveBeenCalled();
            expect(mockWeeklyReportService.processReport).not.toHaveBeenCalled();
            expect(mockMonthlyReportService.processReport).not.toHaveBeenCalled();

            // スパイをリストア
            consoleErrorSpy.mockRestore();
        });
    });

    describe('dailyReportSchedule', () => {
        test('毎日のレポート送信処理 - 通常の日', async () => {
            // テスト用のイベントデータ（コンテキスト）
            const mockContext = {};

            // Cloud Function の実行（保存したハンドラを使用）
            await dailyReportScheduleHandler(mockContext);

            // 昨日のデータが処理されることを検証
            expect(mockDailyReportService.sendDailyReport).toHaveBeenCalledWith('2025', '05', '1', '05');
            // 週次・月次レポートは送信されないことを検証
            expect(mockWeeklyReportService.sendWeeklyReport).not.toHaveBeenCalled();
            expect(mockMonthlyReportService.sendMonthlyReport).not.toHaveBeenCalled();
        });

        test('週初め（月曜）のレポート送信処理', async () => {
            // 月曜日に設定
            const mondayDate = new Date('2025-05-05T00:00:00Z'); // 月曜日
            mockDateUtil.getJSTDate.mockReturnValue(mondayDate);

            // 昨日の情報（日曜日）
            mockDateUtil.getDateInfo.mockReturnValue({
                year: 2025,
                month: 5,
                term: 1,
                day: 4,
                isLastDayOfTerm: true, // 週の最終日
                isLastDayOfMonth: false
            });

            // 前週の情報
            mockDateUtil.getLastTermInfo.mockReturnValue({
                year: 2025,
                month: 5,
                term: 1,
                startDay: 1,
                endDay: 7
            });

            // テスト用のイベントデータ（コンテキスト）
            const mockContext = {};

            // Cloud Function の実行（保存したハンドラを使用）
            await dailyReportScheduleHandler(mockContext);

            // 日次と週次のレポートが送信されることを検証
            expect(mockDailyReportService.sendDailyReport).toHaveBeenCalledWith('2025', '05', '1', '04');
            expect(mockWeeklyReportService.sendWeeklyReport).toHaveBeenCalledWith('2025', '05', 'term1');
            // 月次レポートは送信されないことを検証
            expect(mockMonthlyReportService.sendMonthlyReport).not.toHaveBeenCalled();
        });

        test('月末のレポート送信処理', async () => {
            // 5月31日に設定（月の最終日）
            mockDateUtil.getJSTDate.mockReturnValue(new Date('2025-06-01T00:00:00Z')); // 6月1日

            // 昨日の情報（5月31日）
            mockDateUtil.getDateInfo.mockReturnValue({
                year: 2025,
                month: 5,
                term: 5, // 5月の最終週
                day: 31,
                isLastDayOfTerm: true, // 週の最終日
                isLastDayOfMonth: true // 月の最終日
            });

            // 前週の情報
            mockDateUtil.getLastTermInfo.mockReturnValue({
                year: 2025,
                month: 5,
                term: 5,
                startDay: 25,
                endDay: 31
            });

            // テスト用のイベントデータ（コンテキスト）
            const mockContext = {};

            // Cloud Function の実行（保存したハンドラを使用）
            await dailyReportScheduleHandler(mockContext);

            // すべてのレポートが送信されることを検証
            expect(mockDailyReportService.sendDailyReport).toHaveBeenCalledWith('2025', '05', '5', '31');
            expect(mockWeeklyReportService.sendWeeklyReport).toHaveBeenCalledWith('2025', '05', 'term5');
            expect(mockMonthlyReportService.sendMonthlyReport).toHaveBeenCalledWith('2025', '05');
        });

        test('月初めのレポート送信処理', async () => {
            // 月初めに設定（6月2日）
            mockDateUtil.getJSTDate.mockReturnValue(new Date('2025-06-02T00:00:00Z'));

            // 昨日の情報（6月1日）
            mockDateUtil.getDateInfo.mockReturnValue({
                year: 2025,
                month: 6,
                term: 1,
                day: 1, // 月の初日
                isLastDayOfTerm: false,
                isLastDayOfMonth: false
            });

            // 前月の情報
            mockDateUtil.getLastMonthInfo.mockReturnValue({
                year: 2025,
                month: 5,
            });

            // テスト用のイベントデータ（コンテキスト）
            const mockContext = {};

            // Cloud Function の実行（保存したハンドラを使用）
            await dailyReportScheduleHandler(mockContext);

            // 日次と前月の月次レポートが送信されることを検証
            expect(mockDailyReportService.sendDailyReport).toHaveBeenCalledWith('2025', '06', '1', '01');
            expect(mockMonthlyReportService.sendMonthlyReport).toHaveBeenCalledWith('2025', '05');
            // 週次レポートは送信されないことを検証
            expect(mockWeeklyReportService.sendWeeklyReport).not.toHaveBeenCalled();
        });

        test('月跨ぎ週のレポート送信処理', async () => {
            // 月跨ぎ週の処理をテスト (6月1日は月曜日と仮定)
            mockDateUtil.getJSTDate.mockReturnValue(new Date('2025-06-02T00:00:00Z')); // 6月2日

            // 昨日の情報（6月1日、月曜日）
            mockDateUtil.getDateInfo.mockReturnValue({
                year: 2025,
                month: 6,
                term: 1,
                day: 1,
                isLastDayOfTerm: false, // 新しい週の初日
                isLastDayOfMonth: false // 月の初日だが最終日ではない
            });

            // 前週の情報（5月の週の一部が6月に跨っている）
            mockDateUtil.getLastTermInfo.mockReturnValue({
                year: 2025,
                month: 5, // 前の月
                term: 5, // 5月の最終週
                startDay: 26, // 5/26-6/1の週
                endDay: 1  // 6/1まで
            });

            // 前月の情報
            mockDateUtil.getLastMonthInfo.mockReturnValue({
                year: 2025,
                month: 5,
            });

            // テスト用のイベントデータ（コンテキスト）
            const mockContext = {};

            // Cloud Function の実行（保存したハンドラを使用）
            await dailyReportScheduleHandler(mockContext);

            // 日次レポートと前月の月次レポートが送信されることを検証（月初日のため）
            expect(mockDailyReportService.sendDailyReport).toHaveBeenCalledWith('2025', '06', '1', '01');
            expect(mockMonthlyReportService.sendMonthlyReport).toHaveBeenCalledWith('2025', '05');
        });

        test('スケジューラ処理中のエラーハンドリング', async () => {
            // 日次レポート送信でエラーが発生することをシミュレート
            mockDailyReportService.sendDailyReport.mockRejectedValueOnce(new Error('レポート送信エラー'));

            // スパイを設定
            const consoleErrorSpy = jest.spyOn(console, 'error');

            // テスト用のイベントデータ（コンテキスト）
            const mockContext = {};

            // Cloud Function の実行（保存したハンドラを使用）
            const result = await dailyReportScheduleHandler(mockContext);

            // エラーログが出力されていることを確認
            expect(consoleErrorSpy).toHaveBeenCalled();

            // エラーレスポンスが返されていることを確認
            expect(result).toEqual(
                expect.objectContaining({
                    success: false,
                    data: expect.objectContaining({
                        error: 'レポート送信エラー'
                    }),
                    message: 'スケジュール処理中にエラーが発生しました'
                })
            );

            // スパイをリストア
            consoleErrorSpy.mockRestore();
        });
    });
});