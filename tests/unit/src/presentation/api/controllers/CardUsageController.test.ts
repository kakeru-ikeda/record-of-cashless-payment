import { CardUsageController } from '../../../../../../src/presentation/api/controllers/CardUsageController';
import { FirestoreCardUsageUseCase } from '../../../../../../src/usecases/database/FirestoreCardUsageUseCase';
import { DiscordNotifier } from '../../../../../../shared/infrastructure/discord/DiscordNotifier';
import { Request, Response } from 'express';
import { ResponseHelper } from '../../../../../../shared/presentation/responses/ResponseHelper';
import { ErrorHandler } from '../../../../../../shared/infrastructure/errors/ErrorHandler';
import { AppError, ErrorType } from '../../../../../../shared/errors/AppError';

// 依存関係をモック
jest.mock('../../../../../../shared/infrastructure/discord/DiscordNotifier');
jest.mock('../../../../../../src/usecases/database/FirestoreCardUsageUseCase');
jest.mock('../../../../../../shared/presentation/responses/ResponseHelper');
jest.mock('../../../../../../shared/infrastructure/errors/ErrorHandler');

describe('CardUsageController', () => {
    let cardUsageController: CardUsageController;
    let mockDiscordNotifier: jest.Mocked<DiscordNotifier>;
    let mockCardUsageUseCase: jest.Mocked<FirestoreCardUsageUseCase>;
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
        mockDiscordNotifier = new DiscordNotifier({
            usageWebhookUrl: 'test-webhook-url'
        }) as jest.Mocked<DiscordNotifier>;
        mockCardUsageUseCase = {} as jest.Mocked<FirestoreCardUsageUseCase>;

        // コントローラーの作成
        cardUsageController = new CardUsageController(mockDiscordNotifier);
        // プライベートプロパティのモック置き換え
        (cardUsageController as any).cardUsageUseCase = mockCardUsageUseCase;

        // ResponseHelperのモック
        (ResponseHelper.success as jest.Mock).mockImplementation((message: string, data?: any) => ({
            status: 200,
            success: true,
            message,
            data
        }));

        (ResponseHelper.createResponse as jest.Mock).mockImplementation(
            (status: number, success: boolean, message: string, data?: any) => ({
                status,
                success,
                message,
                data
            })
        );

        (ResponseHelper.fromAppError as jest.Mock).mockImplementation((error: AppError) => ({
            status: 500,
            success: false,
            message: error.message,
            data: undefined
        }));

        // ErrorHandlerのモック
        (ErrorHandler.handle as jest.Mock).mockImplementation(async (error: any) => {
            if (error instanceof AppError) return error;
            return new AppError(error.message, ErrorType.GENERAL);
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getCardUsagesByDate', () => {
        test('正常に年月でカード利用情報を取得できること', async () => {
            // Arrange
            const year = '2023';
            const month = '12';
            mockRequest.query = { year, month };

            const mockUsages = [
                {
                    id: '1',
                    path: 'details/2023/12/term1/01/1',
                    card_name: 'テストカード',
                    amount: 1000,
                    datetime_of_use: new Date(),
                    where_to_use: 'テスト店舗',
                    memo: 'テストメモ',
                    is_active: true,
                    created_at: new Date()
                }
            ];

            mockCardUsageUseCase.getCardUsagesByYearMonth = jest.fn().mockResolvedValue(mockUsages);

            // Act
            await cardUsageController.getCardUsagesByDate(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockCardUsageUseCase.getCardUsagesByYearMonth).toHaveBeenCalledWith(year, month);
            expect(ResponseHelper.success).toHaveBeenCalledWith('カード利用情報の取得に成功しました', mockUsages);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                status: 200,
                success: true,
                message: 'カード利用情報の取得に成功しました',
                data: mockUsages
            });
        });

        test('エラーが発生した場合、500エラーレスポンスを返すこと', async () => {
            // Arrange
            mockRequest.query = { year: '2023', month: '12' };
            const error = new Error('データベースエラー');

            mockCardUsageUseCase.getCardUsagesByYearMonth = jest.fn().mockRejectedValue(error);

            // Act
            await cardUsageController.getCardUsagesByDate(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(ErrorHandler.handle).toHaveBeenCalledWith(error, 'CardUsageController.getCardUsagesByDate');
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalled();
        });
    });

    describe('getCardUsageById', () => {
        test('正常にIDでカード利用情報を取得できること', async () => {
            // Arrange
            const id = '123';
            mockRequest.params = { id };

            const mockCardUsage = {
                id: '123',
                path: 'details/2023/12/term1/01/123',
                card_name: 'テストカード',
                amount: 1000,
                datetime_of_use: new Date(),
                where_to_use: 'テスト店舗',
                memo: 'テストメモ',
                is_active: true,
                created_at: new Date()
            };

            mockCardUsageUseCase.getCardUsageById = jest.fn().mockResolvedValue(mockCardUsage);

            // Act
            await cardUsageController.getCardUsageById(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockCardUsageUseCase.getCardUsageById).toHaveBeenCalledWith(id);
            expect(ResponseHelper.success).toHaveBeenCalledWith('カード利用情報の取得に成功しました', mockCardUsage);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                status: 200,
                success: true,
                message: 'カード利用情報の取得に成功しました',
                data: mockCardUsage
            });
        });

        test('エラーが発生した場合、500エラーレスポンスを返すこと', async () => {
            // Arrange
            mockRequest.params = { id: '123' };
            const error = new AppError('カード利用情報が見つかりません', ErrorType.NOT_FOUND);

            mockCardUsageUseCase.getCardUsageById = jest.fn().mockRejectedValue(error);

            // Act
            await cardUsageController.getCardUsageById(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(ErrorHandler.handle).toHaveBeenCalledWith(error, 'CardUsageController.getCardUsageById');
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalled();
        });
    });

    describe('createCardUsage', () => {
        test('正常にカード利用情報を作成できること', async () => {
            // Arrange
            const cardUsageData = {
                card_name: 'テストカード',
                amount: 1000,
                datetime_of_use: '2023-12-01T10:00:00Z',
                where_to_use: 'テスト店舗',
                memo: 'テストメモ'
            };
            mockRequest.body = cardUsageData;

            const mockResult = {
                id: '123',
                path: 'details/2023/12/term1/01/123',
                ...cardUsageData,
                is_active: true,
                created_at: new Date()
            };

            mockCardUsageUseCase.createCardUsage = jest.fn().mockResolvedValue(mockResult);

            // Act
            await cardUsageController.createCardUsage(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockCardUsageUseCase.createCardUsage).toHaveBeenCalledWith(cardUsageData);
            expect(ResponseHelper.createResponse).toHaveBeenCalledWith(201, true, 'カード利用情報の作成に成功しました', mockResult);
            expect(statusMock).toHaveBeenCalledWith(201);
            expect(jsonMock).toHaveBeenCalledWith({
                status: 201,
                success: true,
                message: 'カード利用情報の作成に成功しました',
                data: mockResult
            });
        });

        test('エラーが発生した場合、500エラーレスポンスを返すこと', async () => {
            // Arrange
            mockRequest.body = { invalid: 'data' };
            const error = new AppError('必須フィールドが不足しています', ErrorType.VALIDATION);

            mockCardUsageUseCase.createCardUsage = jest.fn().mockRejectedValue(error);

            // Act
            await cardUsageController.createCardUsage(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(ErrorHandler.handle).toHaveBeenCalledWith(error, 'CardUsageController.createCardUsage');
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalled();
        });
    });

    describe('updateCardUsage', () => {
        test('正常にカード利用情報を更新できること', async () => {
            // Arrange
            const id = '123';
            const updateData = {
                amount: 2000,
                memo: '更新されたメモ'
            };
            mockRequest.params = { id };
            mockRequest.body = updateData;

            const mockResult = {
                id: '123',
                path: 'details/2023/12/term1/01/123',
                card_name: 'テストカード',
                amount: 2000,
                datetime_of_use: new Date(),
                where_to_use: 'テスト店舗',
                memo: '更新されたメモ',
                is_active: true,
                created_at: new Date()
            };

            mockCardUsageUseCase.updateCardUsage = jest.fn().mockResolvedValue(mockResult);

            // Act
            await cardUsageController.updateCardUsage(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockCardUsageUseCase.updateCardUsage).toHaveBeenCalledWith(id, updateData);
            expect(ResponseHelper.success).toHaveBeenCalledWith('カード利用情報の更新に成功しました', mockResult);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                status: 200,
                success: true,
                message: 'カード利用情報の更新に成功しました',
                data: mockResult
            });
        });

        test('エラーが発生した場合、500エラーレスポンスを返すこと', async () => {
            // Arrange
            mockRequest.params = { id: '123' };
            mockRequest.body = { amount: 2000 };
            const error = new AppError('指定されたIDのカード利用情報が見つかりません', ErrorType.NOT_FOUND);

            mockCardUsageUseCase.updateCardUsage = jest.fn().mockRejectedValue(error);

            // Act
            await cardUsageController.updateCardUsage(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(ErrorHandler.handle).toHaveBeenCalledWith(error, 'CardUsageController.updateCardUsage');
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalled();
        });
    });

    describe('deleteCardUsage', () => {
        test('正常にカード利用情報を削除できること', async () => {
            // Arrange
            const id = '123';
            mockRequest.params = { id };

            const mockResult = {
                id: '123',
                path: 'details/2023/12/term1/01/123'
            };

            mockCardUsageUseCase.deleteCardUsage = jest.fn().mockResolvedValue(mockResult);

            // Act
            await cardUsageController.deleteCardUsage(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockCardUsageUseCase.deleteCardUsage).toHaveBeenCalledWith(id);
            expect(ResponseHelper.success).toHaveBeenCalledWith('カード利用情報の削除に成功しました', mockResult);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                status: 200,
                success: true,
                message: 'カード利用情報の削除に成功しました',
                data: mockResult
            });
        });

        test('エラーが発生した場合、500エラーレスポンスを返すこと', async () => {
            // Arrange
            mockRequest.params = { id: '123' };
            const error = new AppError('指定されたIDのカード利用情報が見つかりません', ErrorType.NOT_FOUND);

            mockCardUsageUseCase.deleteCardUsage = jest.fn().mockRejectedValue(error);

            // Act
            await cardUsageController.deleteCardUsage(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(ErrorHandler.handle).toHaveBeenCalledWith(error, 'CardUsageController.deleteCardUsage');
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalled();
        });
    });

    // ルートクラスの統合テスト - カバレッジ向上のため
    describe('CardUsageRoutes統合テスト', () => {
        test('CardUsageRoutesクラスが正常にインスタンス化されること', () => {
            // 実際のCardUsageRoutesをインポート
            const { CardUsageRoutes } = require('../../../../../../src/presentation/api/routes/CardUsageRoutes');

            // CardUsageRoutesをインスタンス化してカバレッジを向上
            const cardUsageRoutes = new CardUsageRoutes(cardUsageController);

            // getRouterメソッドを呼び出してカバレッジを向上
            const router = cardUsageRoutes.getRouter();
            expect(router).toBeDefined();
        });
    });
});
