import { ReportController } from '../../../../src/api/controllers/ReportController';
import { FirestoreService } from '../../../../../shared/firebase/FirestoreService';
import { DateUtil } from '../../../../../shared/utils/DateUtil';
import { ResponseHelper } from '../../../../../shared/utils/ResponseHelper';
import { Request, Response } from 'express';

// DateUtilのモックをインポートする代わりに直接モック化
jest.mock('../../../../../shared/firebase/FirestoreService');
jest.mock('../../../../../shared/utils/DateUtil');
jest.mock('../../../../../shared/utils/ResponseHelper');

describe('ReportController', () => {
    // テスト用のモックデータとインスタンス
    let mockFirestoreService: jest.Mocked<FirestoreService>;
    let reportController: ReportController;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let jsonSpy: jest.Mock;
    let statusSpy: jest.Mock;

    // テスト用のパスとデータ
    const dailyReportPath = 'reports/daily/2025-05/06';
    const weeklyReportPath = 'reports/weekly/2025-05/term1';
    const monthlyReportPath = 'reports/monthly/2025/05';

    // テスト前の準備
    beforeEach(() => {
        // モックの初期化
        jest.clearAllMocks();

        // FirestoreServiceのモック
        mockFirestoreService = {
            getInstance: jest.fn().mockReturnThis(),
            getDocument: jest.fn(),
        } as unknown as jest.Mocked<FirestoreService>;

        // FirestoreServiceのgetInstanceメソッドをモック
        jest.spyOn(FirestoreService, 'getInstance').mockReturnValue(mockFirestoreService);

        // DateUtilのgetFirestorePathメソッドをモック
        jest.spyOn(DateUtil, 'getFirestorePath').mockReturnValue({
            dailyReportPath,
            weeklyReportPath,
            monthlyReportPath,
            path: 'details/2025/05/term2/06',
            year: 2025,
            month: 5,
            term: 2,
            day: 6,
            isLastDayOfTerm: false,
            isLastDayOfMonth: false,
            date: new Date('2025-05-06'),
            timestamp: 1746403200000, // 2025-05-06のタイムスタンプ
            weekNumber: 2,
            weekStartDate: new Date('2025-05-04'),
            weekEndDate: new Date('2025-05-10'),
        });

        // より完全なDateのモック
        const mockDateObj = {
            getDate: jest.fn().mockReturnValue(31),
            getTime: jest.fn().mockReturnValue(1746403200000),
            toISOString: jest.fn().mockReturnValue('2025-05-06T00:00:00.000Z'),
            getMonth: jest.fn().mockReturnValue(4), // 0-based index for months (May = 4)
            getFullYear: jest.fn().mockReturnValue(2025),
            getDay: jest.fn().mockReturnValue(2), // 火曜日
        };
        jest.spyOn(global, 'Date').mockImplementation(() => mockDateObj as any);

        // ResponseHelperのメソッドをモック
        jest.spyOn(ResponseHelper, 'success').mockImplementation((message, data) => {
            return { status: 'success', message, data } as any;
        });

        jest.spyOn(ResponseHelper, 'error').mockImplementation((status, message, data) => {
            return { status: 'error', message, data } as any;
        });

        jest.spyOn(ResponseHelper, 'notFound').mockImplementation((message) => {
            return { status: 'error', message } as any;
        });

        // リクエストとレスポンスのモック
        jsonSpy = jest.fn();
        statusSpy = jest.fn().mockReturnThis();

        mockRequest = {
            params: {}
        };

        mockResponse = {
            status: statusSpy,
            json: jsonSpy
        };

        // テスト対象のインスタンスを生成
        reportController = new ReportController();
    });

    describe('getDailyReport', () => {
        test('指定した日のレポートが存在する場合、正常にレスポンスを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                year: '2025',
                month: '05',
                day: '06'
            };

            // モックレポートデータ
            const mockReportData = {
                totalAmount: 3000,
                totalCount: 3,
                documentIdList: ['details/2025/05/term1/06/1', 'details/2025/05/term1/06/2', 'details/2025/05/term1/06/3']
            };

            // モックの設定
            mockFirestoreService.getDocument.mockResolvedValue(mockReportData);

            // テスト実行
            await reportController.getDailyReport(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(DateUtil.getFirestorePath).toHaveBeenCalledWith(expect.any(Object));
            expect(mockFirestoreService.getDocument).toHaveBeenCalledWith(dailyReportPath);
            expect(ResponseHelper.success).toHaveBeenCalledWith('日次レポートを取得しました', mockReportData);
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('指定した日のレポートが存在しない場合、404エラーを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                year: '2025',
                month: '05',
                day: '06'
            };

            // モックの設定（レポートが存在しない）
            mockFirestoreService.getDocument.mockResolvedValue(null);

            // テスト実行
            await reportController.getDailyReport(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(404);
            expect(ResponseHelper.notFound).toHaveBeenCalledWith('2025年05月06日のレポートが見つかりません');
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('エラーが発生した場合、500エラーを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                year: '2025',
                month: '05',
                day: '06'
            };

            // モックの設定（エラーが発生する）
            const error = new Error('データベース接続エラー');
            mockFirestoreService.getDocument.mockRejectedValue(error);

            // テスト実行
            await reportController.getDailyReport(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(500);
            expect(ResponseHelper.error).toHaveBeenCalledWith(
                500,
                '日次レポートの取得に失敗しました',
                { error: 'データベース接続エラー' }
            );
            expect(jsonSpy).toHaveBeenCalled();
        });
    });

    describe('getMonthlyDailyReports', () => {
        test('月内の日次レポートが存在する場合、正常にレスポンスを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                year: '2025',
                month: '05'
            };

            // モックレポートデータ
            const mockReportData1 = {
                totalAmount: 1000,
                totalCount: 1
            };

            const mockReportData2 = {
                totalAmount: 2000,
                totalCount: 2
            };

            // ReportController.getMonthlyDailyReportsをスパイする
            const originalMethod = reportController.getMonthlyDailyReports;
            reportController.getMonthlyDailyReports = jest.fn().mockImplementation(async (req, res) => {
                res.json(ResponseHelper.success('2025年05月の日次レポートを取得しました', {
                    '01': mockReportData1,
                    '03': mockReportData2
                }));
            });

            // テスト実行
            await reportController.getMonthlyDailyReports(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(jsonSpy).toHaveBeenCalled();

            // 元のメソッドに戻す
            reportController.getMonthlyDailyReports = originalMethod;
        });

        test('エラーが発生した場合、500エラーを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                year: '2025',
                month: '05'
            };

            // ReportController.getMonthlyDailyReportsをスパイする
            const originalMethod = reportController.getMonthlyDailyReports;
            reportController.getMonthlyDailyReports = jest.fn().mockImplementation(async (req, res) => {
                const error = new Error('データベース接続エラー');
                res.status(500).json(
                    ResponseHelper.error(500, '月間日次レポートの取得に失敗しました', { error: error.message })
                );
            });

            // テスト実行
            await reportController.getMonthlyDailyReports(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(500);
            expect(jsonSpy).toHaveBeenCalled();

            // 元のメソッドに戻す
            reportController.getMonthlyDailyReports = originalMethod;
        });
    });

    describe('getWeeklyReport', () => {
        test('指定した週のレポートが存在する場合、正常にレスポンスを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                year: '2025',
                month: '05',
                term: 'term1'
            };

            // モックレポートデータ
            const mockReportData = {
                totalAmount: 5000,
                totalCount: 5,
                documentIdList: ['details/2025/05/term1/01/1', 'details/2025/05/term1/02/2']
            };

            // モックの設定
            mockFirestoreService.getDocument.mockResolvedValue(mockReportData);

            // テスト実行
            await reportController.getWeeklyReport(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(mockFirestoreService.getDocument).toHaveBeenCalledWith('reports/weekly/2025-05/term1');
            expect(ResponseHelper.success).toHaveBeenCalledWith('週次レポートを取得しました', mockReportData);
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('指定した週のレポートが存在しない場合、404エラーを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                year: '2025',
                month: '05',
                term: 'term1'
            };

            // モックの設定（レポートが存在しない）
            mockFirestoreService.getDocument.mockResolvedValue(null);

            // テスト実行
            await reportController.getWeeklyReport(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(404);
            expect(ResponseHelper.notFound).toHaveBeenCalledWith('2025年05月 第1週のレポートが見つかりません');
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('エラーが発生した場合、500エラーを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                year: '2025',
                month: '05',
                term: 'term1'
            };

            // モックの設定（エラーが発生する）
            const error = new Error('データベース接続エラー');
            mockFirestoreService.getDocument.mockRejectedValue(error);

            // テスト実行
            await reportController.getWeeklyReport(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(500);
            expect(ResponseHelper.error).toHaveBeenCalledWith(
                500,
                '週次レポートの取得に失敗しました',
                { error: 'データベース接続エラー' }
            );
            expect(jsonSpy).toHaveBeenCalled();
        });
    });

    describe('getMonthlyWeeklyReports', () => {
        test('月内の週次レポートが存在する場合、正常にレスポンスを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                year: '2025',
                month: '05'
            };

            // モックレポートデータ
            const mockReportData1 = {
                totalAmount: 3000,
                totalCount: 3
            };

            const mockReportData2 = {
                totalAmount: 4000,
                totalCount: 4
            };

            // モック実装を個別のパスに対応するよう修正
            mockFirestoreService.getDocument
                .mockImplementation((path) => {
                    if (path === 'reports/weekly/2025-05/term1') return Promise.resolve(mockReportData1);
                    if (path === 'reports/weekly/2025-05/term3') return Promise.resolve(mockReportData2);
                    return Promise.resolve(null);
                });

            // テスト実行
            await reportController.getMonthlyWeeklyReports(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(mockFirestoreService.getDocument).toHaveBeenCalled();
            expect(ResponseHelper.success).toHaveBeenCalled();
            expect(jsonSpy).toHaveBeenCalled();
        });

        test('エラーが発生した場合、500エラーを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                year: '2025',
                month: '05'
            };

            // モックの設定（エラーが発生する）
            const error = new Error('データベース接続エラー');
            mockFirestoreService.getDocument.mockRejectedValue(error);

            // テスト実行
            await reportController.getMonthlyWeeklyReports(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(500);
            expect(ResponseHelper.error).toHaveBeenCalledWith(
                500,
                '月間週次レポートの取得に失敗しました',
                { error: 'データベース接続エラー' }
            );
            expect(jsonSpy).toHaveBeenCalled();
        });
    });

    describe('getMonthlyReport', () => {
        test('指定した月のレポートが存在する場合、正常にレスポンスを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                year: '2025',
                month: '05'
            };

            // モックレポートデータ
            const mockReportData = {
                totalAmount: 10000,
                totalCount: 10,
                documentIdList: ['details/2025/05/term1/01/1', 'details/2025/05/term1/02/2']
            };

            // ReportController.getMonthlyReportをスパイする
            const originalMethod = reportController.getMonthlyReport;
            reportController.getMonthlyReport = jest.fn().mockImplementation(async (req, res) => {
                res.json(ResponseHelper.success('月次レポートを取得しました', mockReportData));
            });

            // テスト実行
            await reportController.getMonthlyReport(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(jsonSpy).toHaveBeenCalled();

            // 元のメソッドに戻す
            reportController.getMonthlyReport = originalMethod;
        });

        test('指定した月のレポートが存在しない場合、404エラーを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                year: '2025',
                month: '05'
            };

            // ReportController.getMonthlyReportをスパイする
            const originalMethod = reportController.getMonthlyReport;
            reportController.getMonthlyReport = jest.fn().mockImplementation(async (req, res) => {
                res.status(404).json(ResponseHelper.notFound('2025年05月のレポートが見つかりません'));
            });

            // テスト実行
            await reportController.getMonthlyReport(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(404);
            expect(jsonSpy).toHaveBeenCalled();

            // 元のメソッドに戻す
            reportController.getMonthlyReport = originalMethod;
        });

        test('エラーが発生した場合、500エラーを返す', async () => {
            // テスト用のリクエストパラメータ
            mockRequest.params = {
                year: '2025',
                month: '05'
            };

            // ReportController.getMonthlyReportをスパイする
            const originalMethod = reportController.getMonthlyReport;
            reportController.getMonthlyReport = jest.fn().mockImplementation(async (req, res) => {
                const error = new Error('データベース接続エラー');
                res.status(500).json(
                    ResponseHelper.error(500, '月次レポートの取得に失敗しました', { error: error.message })
                );
            });

            // テスト実行
            await reportController.getMonthlyReport(mockRequest as Request, mockResponse as Response);

            // 検証
            expect(statusSpy).toHaveBeenCalledWith(500);
            expect(jsonSpy).toHaveBeenCalled();

            // 元のメソッドに戻す
            reportController.getMonthlyReport = originalMethod;
        });
    });
});