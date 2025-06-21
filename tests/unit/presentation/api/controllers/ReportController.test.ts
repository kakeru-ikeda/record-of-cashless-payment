import { ReportController } from '../../../../../src/presentation/api/controllers/ReportController';
import { ReportUseCase } from '../../../../../shared/usecases/ReportUseCase';
import { Request, Response } from 'express';
import { ResponseHelper } from '../../../../../shared/presentation/responses/ResponseHelper';
import { ErrorHandler } from '../../../../../shared/infrastructure/errors/ErrorHandler';
import { AppError, ErrorType } from '../../../../../shared/errors/AppError';

// 依存関係をモック
jest.mock('../../../../../shared/usecases/ReportUseCase');
jest.mock('../../../../../shared/presentation/responses/ResponseHelper');
jest.mock('../../../../../shared/infrastructure/errors/ErrorHandler');

describe('ReportController', () => {
    let reportController: ReportController;
    let mockReportUseCase: jest.Mocked<ReportUseCase>;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        // レスポンスモックをセットアップ
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnThis();

        mockRequest = {};
        mockResponse = {
            json: jsonMock,
            status: statusMock
        };

        // モックのセットアップ
        mockReportUseCase = {} as jest.Mocked<ReportUseCase>;

        // コントローラーの作成
        reportController = new ReportController();
        // プライベートプロパティのモック置き換え
        (reportController as any).reportUseCase = mockReportUseCase;

        // ResponseHelperのモック
        (ResponseHelper.success as jest.Mock).mockImplementation((message: string, data?: any) => ({
            status: 200,
            success: true,
            message,
            data
        }));

        (ResponseHelper.fromAppError as jest.Mock).mockImplementation((error: AppError) => {
            // ErrorTypeMapperの実際のマッピングを模倣
            let statusCode = 500;
            if (error.type === ErrorType.NOT_FOUND) statusCode = 404;
            if (error.type === ErrorType.VALIDATION) statusCode = 400;
            if (error.type === ErrorType.AUTHENTICATION) statusCode = 401;
            if (error.type === ErrorType.AUTHORIZATION) statusCode = 403;

            return {
                status: statusCode,
                success: false,
                message: error.message,
                data: undefined
            };
        });

        // ErrorHandlerのモック
        (ErrorHandler.handle as jest.Mock).mockImplementation(async (error: any) => {
            if (error instanceof AppError) return error;
            return new AppError(error.message, ErrorType.GENERAL);
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getDailyReport', () => {
        test('正常に日次レポートを取得できること', async () => {
            // Arrange
            const year = '2023';
            const month = '12';
            const day = '01';
            mockRequest.params = { year, month, day };

            const mockReport = {
                id: 'daily-2023-12-01',
                year: '2023',
                month: '12',
                day: '01',
                totalAmount: 5000,
                usageCount: 3,
                usages: [
                    {
                        id: '1',
                        card_name: 'テストカード',
                        amount: 2000,
                        where_to_use: 'コンビニ',
                        datetime_of_use: new Date(),
                        memo: '',
                        is_active: true,
                        created_at: new Date()
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockReportUseCase.getDailyReport = jest.fn().mockResolvedValue(mockReport);

            // Act
            await reportController.getDailyReport(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockReportUseCase.getDailyReport).toHaveBeenCalledWith(year, month, day);
            expect(ResponseHelper.success).toHaveBeenCalledWith('日次レポートを取得しました', mockReport);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                status: 200,
                success: true,
                message: '日次レポートを取得しました',
                data: mockReport
            });
        });

        test('エラーが発生した場合、適切なエラーレスポンスを返すこと', async () => {
            // Arrange
            mockRequest.params = { year: '2023', month: '12', day: '01' };
            const error = new AppError('日次レポートが見つかりません', ErrorType.NOT_FOUND);

            mockReportUseCase.getDailyReport = jest.fn().mockRejectedValue(error);

            // Act
            await reportController.getDailyReport(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(ErrorHandler.handle).toHaveBeenCalledWith(error, 'ReportController.getDailyReport');
            expect(ResponseHelper.fromAppError).toHaveBeenCalledWith(error);
            expect(statusMock).toHaveBeenCalledWith(404);
            expect(jsonMock).toHaveBeenCalled();
        });
    });

    describe('getMonthlyReport', () => {
        test('正常に月次レポートを取得できること', async () => {
            // Arrange
            const year = '2023';
            const month = '12';
            mockRequest.params = { year, month };

            const mockReport = {
                id: 'monthly-2023-12',
                year: '2023',
                month: '12',
                totalAmount: 50000,
                usageCount: 25,
                dailyReports: [],
                weeklyReports: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockReportUseCase.getMonthlyReport = jest.fn().mockResolvedValue(mockReport);

            // Act
            await reportController.getMonthlyReport(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockReportUseCase.getMonthlyReport).toHaveBeenCalledWith(year, month);
            expect(ResponseHelper.success).toHaveBeenCalledWith('月次レポートを取得しました', mockReport);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                status: 200,
                success: true,
                message: '月次レポートを取得しました',
                data: mockReport
            });
        });

        test('エラーが発生した場合、適切なエラーレスポンスを返すこと', async () => {
            // Arrange
            mockRequest.params = { year: '2023', month: '12' };
            const error = new AppError('月次レポートが見つかりません', ErrorType.NOT_FOUND);

            mockReportUseCase.getMonthlyReport = jest.fn().mockRejectedValue(error);

            // Act
            await reportController.getMonthlyReport(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(ErrorHandler.handle).toHaveBeenCalledWith(error, 'ReportController.getMonthlyReport');
            expect(ResponseHelper.fromAppError).toHaveBeenCalledWith(error);
            expect(statusMock).toHaveBeenCalledWith(404);
            expect(jsonMock).toHaveBeenCalled();
        });
    });

    describe('getWeeklyReport', () => {
        test('正常に週次レポートを取得できること', async () => {
            // Arrange
            const year = '2023';
            const month = '12';
            const term = '1';
            mockRequest.params = { year, month, term };

            const mockReport = {
                id: 'weekly-2023-12-term1',
                year: '2023',
                month: '12',
                term: '1',
                totalAmount: 12000,
                usageCount: 8,
                dailyReports: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockReportUseCase.getWeeklyReport = jest.fn().mockResolvedValue(mockReport);

            // Act
            await reportController.getWeeklyReport(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockReportUseCase.getWeeklyReport).toHaveBeenCalledWith(year, month, term);
            expect(ResponseHelper.success).toHaveBeenCalledWith('週次レポートを取得しました', mockReport);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                status: 200,
                success: true,
                message: '週次レポートを取得しました',
                data: mockReport
            });
        });

        test('エラーが発生した場合、適切なエラーレスポンスを返すこと', async () => {
            // Arrange
            mockRequest.params = { year: '2023', month: '12', term: '1' };
            const error = new AppError('週次レポートが見つかりません', ErrorType.NOT_FOUND);

            mockReportUseCase.getWeeklyReport = jest.fn().mockRejectedValue(error);

            // Act
            await reportController.getWeeklyReport(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(ErrorHandler.handle).toHaveBeenCalledWith(error, 'ReportController.getWeeklyReport');
            expect(ResponseHelper.fromAppError).toHaveBeenCalledWith(error);
            expect(statusMock).toHaveBeenCalledWith(404);
            expect(jsonMock).toHaveBeenCalled();
        });
    });

    describe('getMonthlyDailyReports', () => {
        test('正常に月内の全日次レポートを取得できること', async () => {
            // Arrange
            const year = '2023';
            const month = '12';
            mockRequest.params = { year, month };

            const mockReports = [
                {
                    id: 'daily-2023-12-01',
                    year: '2023',
                    month: '12',
                    day: '01',
                    totalAmount: 5000,
                    usageCount: 3,
                    usages: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    id: 'daily-2023-12-02',
                    year: '2023',
                    month: '12',
                    day: '02',
                    totalAmount: 3000,
                    usageCount: 2,
                    usages: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            mockReportUseCase.getMonthlyDailyReports = jest.fn().mockResolvedValue(mockReports);

            // Act
            await reportController.getMonthlyDailyReports(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockReportUseCase.getMonthlyDailyReports).toHaveBeenCalledWith(year, month);
            expect(ResponseHelper.success).toHaveBeenCalledWith('月内日次レポート一覧を取得しました', mockReports);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                status: 200,
                success: true,
                message: '月内日次レポート一覧を取得しました',
                data: mockReports
            });
        });

        test('エラーが発生した場合、適切なエラーレスポンスを返すこと', async () => {
            // Arrange
            mockRequest.params = { year: '2023', month: '12' };
            const error = new Error('データベースエラー');

            mockReportUseCase.getMonthlyDailyReports = jest.fn().mockRejectedValue(error);

            // Act
            await reportController.getMonthlyDailyReports(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(ErrorHandler.handle).toHaveBeenCalledWith(error, 'ReportController.getMonthlyDailyReports');
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalled();
        });
    });

    describe('getMonthlyWeeklyReports', () => {
        test('正常に月内の全週次レポートを取得できること', async () => {
            // Arrange
            const year = '2023';
            const month = '12';
            mockRequest.params = { year, month };

            const mockReports = [
                {
                    id: 'weekly-2023-12-term1',
                    year: '2023',
                    month: '12',
                    term: '1',
                    totalAmount: 12000,
                    usageCount: 8,
                    dailyReports: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    id: 'weekly-2023-12-term2',
                    year: '2023',
                    month: '12',
                    term: '2',
                    totalAmount: 15000,
                    usageCount: 10,
                    dailyReports: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            mockReportUseCase.getMonthlyWeeklyReports = jest.fn().mockResolvedValue(mockReports);

            // Act
            await reportController.getMonthlyWeeklyReports(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockReportUseCase.getMonthlyWeeklyReports).toHaveBeenCalledWith(year, month);
            expect(ResponseHelper.success).toHaveBeenCalledWith('月内週次レポート一覧を取得しました', mockReports);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                status: 200,
                success: true,
                message: '月内週次レポート一覧を取得しました',
                data: mockReports
            });
        });

        test('エラーが発生した場合、適切なエラーレスポンスを返すこと', async () => {
            // Arrange
            mockRequest.params = { year: '2023', month: '12' };
            const error = new Error('データベースエラー');

            mockReportUseCase.getMonthlyWeeklyReports = jest.fn().mockRejectedValue(error);

            // Act
            await reportController.getMonthlyWeeklyReports(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(ErrorHandler.handle).toHaveBeenCalledWith(error, 'ReportController.getMonthlyWeeklyReports');
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalled();
        });
    });

    // ルートクラスの統合テスト - カバレッジ向上のため
    describe('ReportsRoutes統合テスト', () => {
        test('ReportsRoutesクラスが正常にインスタンス化されること', () => {
            // 実際のReportsRoutesをインポート
            const { ReportsRoutes } = require('../../../../../src/presentation/api/routes/ReportsRoutes');
            
            // ReportsRoutesをインスタンス化してカバレッジを向上
            const reportsRoutes = new ReportsRoutes(reportController);
            
            // getRouterメソッドを呼び出してカバレッジを向上
            const router = reportsRoutes.getRouter();
            expect(router).toBeDefined();
        });
    });
});
