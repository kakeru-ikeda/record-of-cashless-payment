// filepath: /Users/kakeru-ikeda/github/record-of-cashless-payment/functions/tests/unit/api/controllers/CardUsageController.test.ts
import { CardUsageController } from '../../../../src/api/controllers/CardUsageController';
import { FirestoreService } from '../../../../../shared/firebase/FirestoreService';
import { DateUtil } from '../../../../../shared/utils/DateUtil';
import { ResponseHelper } from '../../../../../shared/utils/ResponseHelper';
import { Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { CardUsage } from '../../../../../src/domain/entities/CardUsage';
import { DailyReportService } from '../../../../src/services/reports/DailyReportService';
import { WeeklyReportService } from '../../../../src/services/reports/WeeklyReportService';
import { MonthlyReportService } from '../../../../src/services/reports/MonthlyReportService';
import { DiscordWebhookNotifier } from '../../../../../shared/discord/DiscordNotifier';

// 必要なモジュールをモック化
jest.mock('../../../../../shared/firebase/FirestoreService');
jest.mock('../../../../../shared/utils/DateUtil');
jest.mock('../../../../../shared/utils/ResponseHelper');
jest.mock('../../../../src/services/reports/DailyReportService');
jest.mock('../../../../src/services/reports/WeeklyReportService');
jest.mock('../../../../src/services/reports/MonthlyReportService');
jest.mock('../../../../../shared/discord/DiscordNotifier');

describe('CardUsageController', () => {
    // テスト用のモックデータとインスタンス
    let mockFirestoreService: jest.Mocked<FirestoreService>;
    let mockDiscordNotifier: jest.Mocked<DiscordWebhookNotifier>;
    let mockDailyReportService: jest.Mocked<DailyReportService>;
    let mockWeeklyReportService: jest.Mocked<WeeklyReportService>;
    let mockMonthlyReportService: jest.Mocked<MonthlyReportService>;
    let cardUsageController: CardUsageController;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let jsonSpy: jest.Mock;
    let statusSpy: jest.Mock;

    // テスト用のカード利用データ
    const mockCardUsage: CardUsage = {
        card_name: 'テストカード',
        amount: 1500,
        where_to_use: 'テスト店舗',
        memo: 'テスト用のメモ',
        is_active: true,
        datetime_of_use: Timestamp.fromDate(new Date('2025-05-06T10:00:00Z')),
        created_at: Timestamp.fromDate(new Date('2025-05-06T12:00:00Z'))
    };

    // テスト前の準備
    beforeEach(() => {
        // モックのリセット
        jest.clearAllMocks();
        jest.resetModules();

        // FirestoreServiceのモック設定
        mockFirestoreService = {
            getInstance: jest.fn().mockReturnThis(),
            setCloudFunctions: jest.fn(),
            initialize: jest.fn(),
            getDb: jest.fn().mockResolvedValue({
                collection: jest.fn().mockReturnValue({
                    doc: jest.fn().mockReturnValue({
                        collection: jest.fn().mockReturnValue({
                            listDocuments: jest.fn().mockResolvedValue([])
                        }),
                        listDocuments: jest.fn().mockResolvedValue([]),
                        get: jest.fn().mockResolvedValue({
                            exists: true,
                            data: jest.fn().mockReturnValue(mockCardUsage)
                        })
                    })
                })
            }),
            saveDocument: jest.fn().mockResolvedValue({}),
            updateDocument: jest.fn().mockResolvedValue({}),
            getDocument: jest.fn().mockResolvedValue(mockCardUsage),
            getDocumentRef: jest.fn().mockResolvedValue({}),
            getTimestampFromDate: jest.fn().mockReturnValue(Timestamp.fromDate(new Date()))
        } as unknown as jest.Mocked<FirestoreService>;

        // FirestoreService.getInstanceをモック
        jest.spyOn(FirestoreService, 'getInstance').mockReturnValue(mockFirestoreService);

        // DateUtilのgetFirestorePathメソッドをモック
        jest.spyOn(DateUtil, 'getFirestorePath').mockReturnValue({
            path: 'details/2025/05/term2/06/1746403200000',
            year: 2025,
            month: 5,
            term: 2,
            day: 6,
            isLastDayOfTerm: false,
            isLastDayOfMonth: false,
            date: new Date('2025-05-06'),
            timestamp: 1746403200000,
            weekNumber: 2,
            weekStartDate: new Date('2025-05-04'),
            weekEndDate: new Date('2025-05-10'),
            dailyReportPath: 'reports/daily/2025-05/06',
            weeklyReportPath: 'reports/weekly/2025-05/term2',
            monthlyReportPath: 'reports/monthly/2025/05'
        });

        // レポートサービスのモック設定
        mockDailyReportService = {
            processReport: jest.fn().mockResolvedValue({ success: true }),
            updateReportForAmountChange: jest.fn().mockResolvedValue(true),
            updateReportForDeletion: jest.fn().mockResolvedValue(true),
            updateReportForAddition: jest.fn().mockResolvedValue(true)
        } as unknown as jest.Mocked<DailyReportService>;

        mockWeeklyReportService = {
            processReport: jest.fn().mockResolvedValue({ success: true }),
            updateReportForAmountChange: jest.fn().mockResolvedValue(true),
            updateReportForDeletion: jest.fn().mockResolvedValue(true),
            updateReportForAddition: jest.fn().mockResolvedValue(true)
        } as unknown as jest.Mocked<WeeklyReportService>;

        mockMonthlyReportService = {
            processReport: jest.fn().mockResolvedValue({ success: true }),
            updateReportForAmountChange: jest.fn().mockResolvedValue(true),
            updateReportForDeletion: jest.fn().mockResolvedValue(true),
            updateReportForAddition: jest.fn().mockResolvedValue(true)
        } as unknown as jest.Mocked<MonthlyReportService>;

        // DailyReportServiceのコンストラクタをモック
        (DailyReportService as jest.Mock).mockImplementation(() => mockDailyReportService);
        (WeeklyReportService as jest.Mock).mockImplementation(() => mockWeeklyReportService);
        (MonthlyReportService as jest.Mock).mockImplementation(() => mockMonthlyReportService);

        // Discord通知のモック設定
        mockDiscordNotifier = {
            notifyDailyReport: jest.fn().mockResolvedValue(true),
            notifyWeeklyReport: jest.fn().mockResolvedValue(true),
            notifyMonthlyReport: jest.fn().mockResolvedValue(true)
        } as unknown as jest.Mocked<DiscordWebhookNotifier>;

        (DiscordWebhookNotifier as jest.Mock).mockImplementation(() => mockDiscordNotifier);

        // ResponseHelperのメソッドをモック
        jest.spyOn(ResponseHelper, 'success').mockImplementation((message, data) => {
            return { status: 200, success: true, message, data } as any;
        });

        jest.spyOn(ResponseHelper, 'createResponse').mockImplementation((status, success, message, data) => {
            return { status, success, message, data } as any;
        });

        jest.spyOn(ResponseHelper, 'error').mockImplementation((status, message, data) => {
            return { status, success: false, message, data } as any;
        });

        jest.spyOn(ResponseHelper, 'notFound').mockImplementation((message) => {
            return { status: 404, success: false, message } as any;
        });

        jest.spyOn(ResponseHelper, 'validationError').mockImplementation((message, data) => {
            return { status: 400, success: false, message, data } as any;
        });

        // リクエストとレスポンスのモック
        jsonSpy = jest.fn();
        statusSpy = jest.fn().mockReturnThis();

        mockRequest = {
            params: {},
            body: {},
            query: {}
        };

        mockResponse = {
            status: statusSpy,
            json: jsonSpy
        };

        // Timestampのモック
        jest.spyOn(Timestamp, 'now').mockReturnValue(Timestamp.fromDate(new Date('2025-05-06T12:00:00Z')));

        // テスト対象のコントローラーインスタンスを作成
        cardUsageController = new CardUsageController();

        // privateメソッドを直接テストするためにアクセス可能にする
        (cardUsageController as any).firestoreService = mockFirestoreService;
        (cardUsageController as any).dailyReportService = mockDailyReportService;
        (cardUsageController as any).weeklyReportService = mockWeeklyReportService;
        (cardUsageController as any).monthlyReportService = mockMonthlyReportService;
        (cardUsageController as any).discordNotifier = mockDiscordNotifier;
    });

    describe('getAllCardUsages', () => {
        test('年月が提供されている場合、カード利用情報リストを返す', async () => {
            // テスト用のリクエストクエリ
            mockRequest.query = {
                year: '2025',
                month: '5'
            };

            // モックの振る舞いを設定
            const mockTermDoc = {
                id: 'term1',
                listCollections: jest.fn().mockResolvedValue([
                    {
                        id: '01', listDocuments: jest.fn().mockResolvedValue([
                            {
                                id: '1234567890', get: jest.fn().mockResolvedValue({
                                    exists: true,
                                    data: jest.fn().mockReturnValue(mockCardUsage)
                                })
                            }
                        ])
                    }
                ])
            };

            const mockDbResponse = {
                collection: jest.fn().mockReturnValue({
                    doc: jest.fn().mockReturnValue({
                        collection: jest.fn().mockReturnValue({
                            listDocuments: jest.fn().mockResolvedValue([mockTermDoc])
                        })
                    })
                })
            };

            mockFirestoreService.getDb.mockResolvedValue(mockDbResponse as any);

            // テスト実行
            await cardUsageController.getAllCardUsages(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(mockFirestoreService.getDb).toHaveBeenCalled();
            expect(ResponseHelper.success).toHaveBeenCalledWith(
                'カード利用情報の取得に成功しました',
                expect.arrayContaining([
                    expect.objectContaining({
                        amount: 1500,
                        card_name: 'テストカード',
                        id: '1234567890',
                        path: expect.stringMatching(/details\/2025\/05\/term1\/01\/1234567890/)
                    })
                ])
            );
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('年月が提供されていない場合、バリデーションエラーを返す', async () => {
            // テスト用のリクエストクエリ（年月なし）
            mockRequest.query = {};

            // テスト実行
            await cardUsageController.getAllCardUsages(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(400);
            expect(ResponseHelper.validationError).toHaveBeenCalledWith('年と月のパラメータが必要です');
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('データ取得中にエラーが発生した場合、エラーレスポンスを返す', async () => {
            // テスト用のリクエストクエリ
            mockRequest.query = {
                year: '2025',
                month: '5'
            };

            // エラーをシミュレート
            const error = new Error('データベース接続エラー');
            mockFirestoreService.getDb.mockRejectedValue(error);

            // テスト実行
            await cardUsageController.getAllCardUsages(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(500);
            expect(ResponseHelper.error).toHaveBeenCalledWith(
                500,
                'カード利用情報の取得中にエラーが発生しました',
                { error: 'データベース接続エラー' }
            );
            expect(jsonSpy).toHaveBeenCalled();
        });
    });

    describe('getCardUsageById', () => {
        test('有効なIDが提供され、ドキュメントが見つかった場合、カード利用情報を返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                id: '1234567890'
            };

            // モックの振る舞いを設定
            const mockDocSnapshot = {
                exists: true,
                data: jest.fn().mockReturnValue(mockCardUsage)
            };

            const mockDayCollection = {
                doc: jest.fn().mockReturnValue({
                    get: jest.fn().mockResolvedValue(mockDocSnapshot)
                })
            };

            const mockTermDoc = {
                id: 'term1',
                listCollections: jest.fn().mockResolvedValue([
                    { id: '06', ...mockDayCollection }
                ])
            };

            const mockMonthCollection = {
                listDocuments: jest.fn().mockResolvedValue([mockTermDoc])
            };

            const mockYearDoc = {
                collection: jest.fn().mockReturnValue(mockMonthCollection)
            };

            const mockDbResponse = {
                collection: jest.fn().mockReturnValue({
                    doc: jest.fn().mockReturnValue(mockYearDoc)
                })
            };

            mockFirestoreService.getDb.mockResolvedValue(mockDbResponse as any);

            // テスト実行
            await cardUsageController.getCardUsageById(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(mockFirestoreService.getDb).toHaveBeenCalled();
            expect(ResponseHelper.success).toHaveBeenCalledWith(
                'カード利用情報の取得に成功しました',
                expect.objectContaining({
                    amount: 1500,
                    card_name: 'テストカード',
                    id: '1234567890'
                })
            );
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('IDが提供されていない場合、バリデーションエラーを返す', async () => {
            // テスト用のリクエストパラメータ（IDなし）
            mockRequest.params = {};

            // テスト実行
            await cardUsageController.getCardUsageById(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(400);
            expect(ResponseHelper.validationError).toHaveBeenCalledWith('IDが必要です');
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('有効なIDが提供されたが、ドキュメントが見つからない場合、404エラーを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                id: '9999999999'
            };

            // すべての月で検索した結果、何も見つからない場合を模擬
            mockFirestoreService.getDb.mockResolvedValue({
                collection: jest.fn().mockReturnValue({
                    doc: jest.fn().mockReturnValue({
                        collection: jest.fn().mockReturnValue({
                            listDocuments: jest.fn().mockResolvedValue([])
                        })
                    })
                })
            } as any);

            // テスト実行
            await cardUsageController.getCardUsageById(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(404);
            expect(ResponseHelper.notFound).toHaveBeenCalledWith('指定されたIDのカード利用情報が見つかりません');
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('データ取得中にエラーが発生した場合、エラーレスポンスを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                id: '1234567890'
            };

            // エラーをシミュレート
            const error = new Error('データベース接続エラー');
            mockFirestoreService.getDb.mockRejectedValue(error);

            // テスト実行
            await cardUsageController.getCardUsageById(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(500);
            expect(ResponseHelper.error).toHaveBeenCalledWith(
                500,
                'カード利用情報の取得中にエラーが発生しました',
                { error: 'データベース接続エラー' }
            );
            expect(jsonSpy).toHaveBeenCalled();
        });
    });

    describe('createCardUsage', () => {
        test('有効なデータが提供された場合、カード利用情報を作成する', async () => {
            // テスト用のリクエストボディ
            mockRequest.body = {
                card_name: 'テストカード',
                datetime_of_use: '2025-05-06T10:00:00Z',
                amount: 1500,
                where_to_use: 'テスト店舗',
                memo: 'テスト用のメモ'
            };

            // モックタイムスタンプ
            const mockTimestamp = Timestamp.fromDate(new Date('2025-05-06T12:00:00Z'));
            jest.spyOn(Timestamp, 'now').mockReturnValue(mockTimestamp);

            // テスト実行
            await cardUsageController.createCardUsage(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(DateUtil.getFirestorePath).toHaveBeenCalled();
            expect(mockFirestoreService.saveDocument).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    card_name: 'テストカード',
                    amount: 1500,
                    where_to_use: 'テスト店舗',
                    memo: 'テスト用のメモ',
                    is_active: true
                })
            );
            expect(statusSpy).toHaveBeenCalledWith(201);
            expect(ResponseHelper.createResponse).toHaveBeenCalledWith(
                201,
                true,
                'カード利用情報の作成に成功しました',
                expect.objectContaining({
                    card_name: 'テストカード',
                    amount: 1500
                })
            );
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('必須フィールドが欠けている場合、バリデーションエラーを返す', async () => {
            // テスト用のリクエストボディ（必須フィールドなし）
            mockRequest.body = {
                card_name: 'テストカード',
                // datetime_of_use: missing
                amount: 1500
            };

            // テスト実行
            await cardUsageController.createCardUsage(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(400);
            expect(ResponseHelper.validationError).toHaveBeenCalledWith('必須フィールドが不足しています');
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('無効な日付形式が提供された場合、バリデーションエラーを返す', async () => {
            // テスト用のリクエストボディ（無効な日付形式）
            mockRequest.body = {
                card_name: 'テストカード',
                datetime_of_use: 'invalid-date',
                amount: 1500,
                where_to_use: 'テスト店舗'
            };

            // テスト実行
            await cardUsageController.createCardUsage(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(400);
            expect(ResponseHelper.validationError).toHaveBeenCalledWith('日付形式が無効です', expect.anything());
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('データ保存中にエラーが発生した場合、エラーレスポンスを返す', async () => {
            // テスト用のリクエストボディ
            mockRequest.body = {
                card_name: 'テストカード',
                datetime_of_use: '2025-05-06T10:00:00Z',
                amount: 1500,
                where_to_use: 'テスト店舗',
                memo: 'テスト用のメモ'
            };

            // エラーをシミュレート
            const error = new Error('データベース保存エラー');
            mockFirestoreService.saveDocument.mockRejectedValue(error);

            // テスト実行
            await cardUsageController.createCardUsage(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(500);
            expect(ResponseHelper.error).toHaveBeenCalledWith(
                500,
                'カード利用情報の作成中にエラーが発生しました',
                { error: 'データベース保存エラー' }
            );
            expect(jsonSpy).toHaveBeenCalled();
        });
    });

    describe('updateCardUsage', () => {
        test('有効なデータでカード利用情報を更新し、レポートも更新する', async () => {
            // テスト用のリクエストパラメータとボディ
            mockRequest.params = { id: '1234567890' };
            mockRequest.body = {
                amount: 2000, // 金額を変更
                memo: '更新されたメモ'
            };

            // モックの設定（ドキュメントが見つかる）
            // getCardUsageByIdメソッドの一部をシミュレート
            const mockDocSnapshot = {
                exists: true,
                data: jest.fn().mockReturnValue(mockCardUsage)
            };

            const mockDayCollection = {
                doc: jest.fn().mockReturnValue({
                    get: jest.fn().mockResolvedValue(mockDocSnapshot)
                })
            };

            const mockTermDoc = {
                id: 'term1',
                listCollections: jest.fn().mockResolvedValue([
                    { id: '06', ...mockDayCollection }
                ])
            };

            const mockDbResponse = {
                collection: jest.fn().mockReturnValue({
                    doc: jest.fn().mockReturnValue({
                        collection: jest.fn().mockReturnValue({
                            listDocuments: jest.fn().mockResolvedValue([mockTermDoc])
                        })
                    })
                })
            };

            mockFirestoreService.getDb.mockResolvedValue(mockDbResponse as any);
            mockFirestoreService.getDocument.mockResolvedValue({
                ...mockCardUsage,
                amount: 2000,
                memo: '更新されたメモ'
            });

            // extractPathParamsメソッドのモック
            const extractPathParamsSpy = jest.spyOn(cardUsageController as any, 'extractPathParams')
                .mockReturnValue({ year: '2025', month: '05', term: 'term1', day: '06' });

            // 内部メソッドのモック
            const updateReportsForCardUpdateSpy = jest.spyOn(cardUsageController as any, 'updateReportsForCardUpdate')
                .mockResolvedValue(undefined);

            // テスト実行
            await cardUsageController.updateCardUsage(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(mockFirestoreService.getDb).toHaveBeenCalled();
            expect(mockFirestoreService.updateDocument).toHaveBeenCalledWith(
                expect.stringContaining('details/2025/05/term1/06/1234567890'),
                expect.objectContaining({
                    amount: 2000,
                    memo: '更新されたメモ'
                })
            );
            expect(updateReportsForCardUpdateSpy).toHaveBeenCalled();
            expect(ResponseHelper.success).toHaveBeenCalledWith('カード利用情報の更新に成功しました', expect.anything());
            expect(jsonSpy).toHaveBeenCalled();

            // スパイのリストア
            extractPathParamsSpy.mockRestore();
            updateReportsForCardUpdateSpy.mockRestore();
        });

        test('IDが提供されていない場合、バリデーションエラーを返す', async () => {
            // テスト用のリクエストパラメータ（IDなし）
            mockRequest.params = {};
            mockRequest.body = {
                amount: 2000,
                memo: '更新されたメモ'
            };

            // テスト実行
            await cardUsageController.updateCardUsage(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(400);
            expect(ResponseHelper.validationError).toHaveBeenCalledWith('IDが必要です');
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('指定されたIDのドキュメントが見つからない場合、404エラーを返す', async () => {
            // テスト用のリクエストパラメータとボディ
            mockRequest.params = { id: '9999999999' };
            mockRequest.body = {
                amount: 2000,
                memo: '更新されたメモ'
            };

            // すべての月で検索した結果、何も見つからない場合を模擬
            mockFirestoreService.getDb.mockResolvedValue({
                collection: jest.fn().mockReturnValue({
                    doc: jest.fn().mockReturnValue({
                        collection: jest.fn().mockReturnValue({
                            listDocuments: jest.fn().mockResolvedValue([])
                        })
                    })
                })
            } as any);

            // テスト実行
            await cardUsageController.updateCardUsage(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(404);
            expect(ResponseHelper.notFound).toHaveBeenCalledWith('指定されたIDのカード利用情報が見つかりません');
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('データ更新中にエラーが発生した場合、エラーレスポンスを返す', async () => {
            // テスト用のリクエストパラメータとボディ
            mockRequest.params = { id: '1234567890' };
            mockRequest.body = {
                amount: 2000,
                memo: '更新されたメモ'
            };

            // エラーをシミュレート
            const error = new Error('データベース更新エラー');
            mockFirestoreService.getDb.mockRejectedValue(error);

            // テスト実行
            await cardUsageController.updateCardUsage(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(500);
            expect(ResponseHelper.error).toHaveBeenCalledWith(
                500,
                'カード利用情報の更新中にエラーが発生しました',
                { error: 'データベース更新エラー' }
            );
            expect(jsonSpy).toHaveBeenCalled();
        });
    });

    describe('deleteCardUsage', () => {
        test('有効なIDでカード利用情報を論理削除し、レポートを更新する', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = { id: '1234567890' };

            // モックの設定（ドキュメントが見つかる）
            const mockDocSnapshot = {
                exists: true,
                data: jest.fn().mockReturnValue(mockCardUsage)
            };

            const mockDayCollection = {
                doc: jest.fn().mockReturnValue({
                    get: jest.fn().mockResolvedValue(mockDocSnapshot)
                })
            };

            const mockTermDoc = {
                id: 'term1',
                listCollections: jest.fn().mockResolvedValue([
                    { id: '06', ...mockDayCollection }
                ])
            };

            const mockDbResponse = {
                collection: jest.fn().mockReturnValue({
                    doc: jest.fn().mockReturnValue({
                        collection: jest.fn().mockReturnValue({
                            listDocuments: jest.fn().mockResolvedValue([mockTermDoc])
                        })
                    })
                })
            };

            mockFirestoreService.getDb.mockResolvedValue(mockDbResponse as any);

            // 内部メソッドのモック
            const updateReportsForCardDeletionSpy = jest.spyOn(cardUsageController as any, 'updateReportsForCardDeletion')
                .mockResolvedValue(undefined);

            // テスト実行
            await cardUsageController.deleteCardUsage(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(mockFirestoreService.getDb).toHaveBeenCalled();
            expect(mockFirestoreService.updateDocument).toHaveBeenCalledWith(
                expect.stringContaining('details/2025/05/term1/06/1234567890'),
                { is_active: false }
            );
            expect(updateReportsForCardDeletionSpy).toHaveBeenCalled();
            expect(ResponseHelper.success).toHaveBeenCalledWith('カード利用情報の削除に成功しました', expect.anything());
            expect(jsonSpy).toHaveBeenCalled();

            // スパイのリストア
            updateReportsForCardDeletionSpy.mockRestore();
        });

        test('IDが提供されていない場合、バリデーションエラーを返す', async () => {
            // テスト用のリクエストパラメータ（IDなし）
            mockRequest.params = {};

            // テスト実行
            await cardUsageController.deleteCardUsage(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(400);
            expect(ResponseHelper.validationError).toHaveBeenCalledWith('IDが必要です');
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('指定されたIDのドキュメントが見つからない場合、404エラーを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = { id: '9999999999' };

            // すべての月で検索した結果、何も見つからない場合を模擬
            mockFirestoreService.getDb.mockResolvedValue({
                collection: jest.fn().mockReturnValue({
                    doc: jest.fn().mockReturnValue({
                        collection: jest.fn().mockReturnValue({
                            listDocuments: jest.fn().mockResolvedValue([])
                        })
                    })
                })
            } as any);

            // テスト実行
            await cardUsageController.deleteCardUsage(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(404);
            expect(ResponseHelper.notFound).toHaveBeenCalledWith('指定されたIDのカード利用情報が見つかりません');
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('データ削除中にエラーが発生した場合、エラーレスポンスを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = { id: '1234567890' };

            // エラーをシミュレート
            const error = new Error('データベース削除エラー');
            mockFirestoreService.getDb.mockRejectedValue(error);

            // テスト実行
            await cardUsageController.deleteCardUsage(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(500);
            expect(ResponseHelper.error).toHaveBeenCalledWith(
                500,
                'カード利用情報の削除中にエラーが発生しました',
                { error: 'データベース削除エラー' }
            );
            expect(jsonSpy).toHaveBeenCalled();
        });
    });

    describe('extractPathParams', () => {
        test('有効なパスから正しくパラメータを抽出する', () => {
            const path = 'details/2025/05/term1/06/1234567890';
            const result = (cardUsageController as any).extractPathParams(path);
            expect(result).toEqual({
                year: '2025',
                month: '05',
                term: 'term1',
                day: '06'
            });
        });

        test('無効なパスの場合nullを返す', () => {
            const path = 'invalid/path';
            const result = (cardUsageController as any).extractPathParams(path);
            expect(result).toBeNull();
        });
    });

    describe('updateReportsForCardUpdate', () => {
        test('金額が変更されると各レポートサービスを呼び出す', async () => {
            // テスト用のパラメータ
            const path = 'details/2025/05/term1/06/1234567890';
            const oldData: CardUsage = { ...mockCardUsage, amount: 1500 };
            const newData: Partial<CardUsage> = { amount: 2000 };

            // extractPathParamsメソッドのモック
            const extractPathParamsSpy = jest.spyOn(cardUsageController as any, 'extractPathParams')
                .mockReturnValue({ year: '2025', month: '05', term: 'term1', day: '06' });

            // テスト実行
            await (cardUsageController as any).updateReportsForCardUpdate(path, oldData, newData);

            // 検証
            expect(extractPathParamsSpy).toHaveBeenCalledWith(path);
            expect(mockFirestoreService.getDocumentRef).toHaveBeenCalledWith(path);
            expect(mockDailyReportService.updateReportForAmountChange).toHaveBeenCalledWith(
                {}, // モックのgetDocumentRef結果
                { year: '2025', month: '05', term: 'term1', day: '06' },
                500 // 差額: 2000 - 1500
            );
            expect(mockWeeklyReportService.updateReportForAmountChange).toHaveBeenCalled();
            expect(mockMonthlyReportService.updateReportForAmountChange).toHaveBeenCalled();

            // スパイのリストア
            extractPathParamsSpy.mockRestore();
        });

        test('金額が変更されない場合、レポートサービスは呼び出されない', async () => {
            // テスト用のパラメータ
            const path = 'details/2025/05/term1/06/1234567890';
            const oldData: CardUsage = { ...mockCardUsage, amount: 1500 };
            const newData: Partial<CardUsage> = { memo: '更新されたメモ' }; // 金額は変更なし

            // extractPathParamsメソッドのモック
            const extractPathParamsSpy = jest.spyOn(cardUsageController as any, 'extractPathParams')
                .mockReturnValue({ year: '2025', month: '05', term: 'term1', day: '06' });

            // テスト実行
            await (cardUsageController as any).updateReportsForCardUpdate(path, oldData, newData);

            // 検証
            expect(extractPathParamsSpy).toHaveBeenCalledWith(path);
            expect(mockFirestoreService.getDocumentRef).not.toHaveBeenCalled();
            expect(mockDailyReportService.updateReportForAmountChange).not.toHaveBeenCalled();
            expect(mockWeeklyReportService.updateReportForAmountChange).not.toHaveBeenCalled();
            expect(mockMonthlyReportService.updateReportForAmountChange).not.toHaveBeenCalled();

            // スパイのリストア
            extractPathParamsSpy.mockRestore();
        });

        test('無効なパスの場合、何も処理されない', async () => {
            // テスト用のパラメータ
            const path = 'invalid/path';
            const oldData: CardUsage = { ...mockCardUsage, amount: 1500 };
            const newData: Partial<CardUsage> = { amount: 2000 };

            // extractPathParamsメソッドのモック
            const extractPathParamsSpy = jest.spyOn(cardUsageController as any, 'extractPathParams')
                .mockReturnValue(null);

            // テスト実行
            await (cardUsageController as any).updateReportsForCardUpdate(path, oldData, newData);

            // 検証
            expect(extractPathParamsSpy).toHaveBeenCalledWith(path);
            expect(mockFirestoreService.getDocumentRef).not.toHaveBeenCalled();
            expect(mockDailyReportService.updateReportForAmountChange).not.toHaveBeenCalled();
            expect(mockWeeklyReportService.updateReportForAmountChange).not.toHaveBeenCalled();
            expect(mockMonthlyReportService.updateReportForAmountChange).not.toHaveBeenCalled();

            // スパイのリストア
            extractPathParamsSpy.mockRestore();
        });
    });

    describe('updateReportsForCardDeletion', () => {
        test('カード利用情報の削除時に各レポートサービスを呼び出す', async () => {
            // テスト用のパラメータ
            const path = 'details/2025/05/term1/06/1234567890';
            const data: CardUsage = { ...mockCardUsage, amount: 1500 };

            // extractPathParamsメソッドのモック
            const extractPathParamsSpy = jest.spyOn(cardUsageController as any, 'extractPathParams')
                .mockReturnValue({ year: '2025', month: '05', term: 'term1', day: '06' });

            // テスト実行
            await (cardUsageController as any).updateReportsForCardDeletion(path, data);

            // 検証
            expect(extractPathParamsSpy).toHaveBeenCalledWith(path);
            expect(mockFirestoreService.getDocumentRef).toHaveBeenCalledWith(path);
            expect(mockDailyReportService.updateReportForDeletion).toHaveBeenCalledWith(
                {}, // モックのgetDocumentRef結果
                { year: '2025', month: '05', term: 'term1', day: '06' },
                -1500, // マイナス金額
                -1 // カウント-1
            );
            expect(mockWeeklyReportService.updateReportForDeletion).toHaveBeenCalled();
            expect(mockMonthlyReportService.updateReportForDeletion).toHaveBeenCalled();

            // スパイのリストア
            extractPathParamsSpy.mockRestore();
        });

        test('無効なパスの場合、何も処理されない', async () => {
            // テスト用のパラメータ
            const path = 'invalid/path';
            const data: CardUsage = { ...mockCardUsage, amount: 1500 };

            // extractPathParamsメソッドのモック
            const extractPathParamsSpy = jest.spyOn(cardUsageController as any, 'extractPathParams')
                .mockReturnValue(null);

            // テスト実行
            await (cardUsageController as any).updateReportsForCardDeletion(path, data);

            // 検証
            expect(extractPathParamsSpy).toHaveBeenCalledWith(path);
            expect(mockFirestoreService.getDocumentRef).not.toHaveBeenCalled();
            expect(mockDailyReportService.updateReportForDeletion).not.toHaveBeenCalled();
            expect(mockWeeklyReportService.updateReportForDeletion).not.toHaveBeenCalled();
            expect(mockMonthlyReportService.updateReportForDeletion).not.toHaveBeenCalled();

            // スパイのリストア
            extractPathParamsSpy.mockRestore();
        });
    });
});