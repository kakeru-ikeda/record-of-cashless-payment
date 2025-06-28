import { FirestoreDocumentCreatedHandler } from '../../../../../../functions/src/presentation/handlers/FirestoreDocumentCreatedHandler';
import { ProcessFirestoreDocumentUseCase } from '../../../../../../functions/src/application/usecases/ProcessFirestoreDocumentUseCase';
import { FirestoreDocumentCreatedEvent } from '../../../../../../functions/src/domain/types/FirebaseFunctionTypes';
import { Response } from '../../../../../../shared/presentation/responses/ResponseHelper';

// Loggerのモック化
jest.mock('../../../../../../shared/infrastructure/logging/Logger', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        logAppError: jest.fn(),
        updateServiceStatus: jest.fn()
    }
}));

// ProcessFirestoreDocumentUseCaseのモック化
jest.mock('../../../../../../functions/src/application/usecases/ProcessFirestoreDocumentUseCase');

describe('FirestoreDocumentCreatedHandler', () => {
    let handler: FirestoreDocumentCreatedHandler;
    let mockProcessUseCase: jest.Mocked<ProcessFirestoreDocumentUseCase>;
    let mockEvent: FirestoreDocumentCreatedEvent;
    let mockResponse: Response;

    beforeEach(() => {
        // ProcessFirestoreDocumentUseCaseのモック作成
        mockProcessUseCase = {
            execute: jest.fn(),
            reportProcessingService: {} as any,
        } as unknown as jest.Mocked<ProcessFirestoreDocumentUseCase>;

        // ハンドラーインスタンス作成
        handler = new FirestoreDocumentCreatedHandler(mockProcessUseCase);

        // モックレスポンス
        mockResponse = {
            status: 200,
            success: true,
            message: 'テスト成功',
            data: {}
        };

        // モックイベント（通常のドキュメントパス）
        mockEvent = {
            data: {
                ref: {
                    path: 'details/2024/term1/01/1234567890123'
                }
            }
        } as FirestoreDocumentCreatedEvent;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('ハンドラー名が正しく設定されること', () => {
            expect(handler['handlerName']).toBe('Firestore Document Created Handler');
        });

        it('ProcessFirestoreDocumentUseCaseが正しく注入されること', () => {
            expect(handler['processUseCase']).toBe(mockProcessUseCase);
        });
    });

    describe('handle', () => {
        it('正常なドキュメント作成イベントを処理できること', async () => {
            // Arrange
            mockProcessUseCase.execute.mockResolvedValue(mockResponse);

            // Act
            const result = await handler.handle(mockEvent);

            // Assert
            expect(result).toEqual(mockResponse);
            expect(mockProcessUseCase.execute).toHaveBeenCalledWith(mockEvent);
            expect(mockProcessUseCase.execute).toHaveBeenCalledTimes(1);
        });

        it('レポートドキュメントパスの場合は処理をスキップすること', async () => {
            // Arrange
            const reportEvent = {
                data: {
                    ref: {
                        path: 'collections/reports/daily/2024-01/01'
                    }
                }
            } as FirestoreDocumentCreatedEvent;

            // Act
            const result = await handler.handle(reportEvent);

            // Assert
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.message).toBe('レポートドキュメントのため処理をスキップ');
            expect(mockProcessUseCase.execute).not.toHaveBeenCalled();
        });

        it('レポートドキュメントパス（weekly）の場合は処理をスキップすること', async () => {
            // Arrange
            const reportEvent = {
                data: {
                    ref: {
                        path: 'collections/reports/weekly/2024-01/01'
                    }
                }
            } as FirestoreDocumentCreatedEvent;

            // Act
            const result = await handler.handle(reportEvent);

            // Assert
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.message).toBe('レポートドキュメントのため処理をスキップ');
            expect(mockProcessUseCase.execute).not.toHaveBeenCalled();
        });

        it('レポートドキュメントパス（monthly）の場合は処理をスキップすること', async () => {
            // Arrange
            const reportEvent = {
                data: {
                    ref: {
                        path: 'collections/reports/monthly/2024/01'
                    }
                }
            } as FirestoreDocumentCreatedEvent;

            // Act
            const result = await handler.handle(reportEvent);

            // Assert
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.message).toBe('レポートドキュメントのため処理をスキップ');
            expect(mockProcessUseCase.execute).not.toHaveBeenCalled();
        });
    });

    describe('beforeProcess', () => {
        it('通常のドキュメントパスの場合はエラーをスローしないこと', async () => {
            // Act & Assert
            await expect(handler['beforeProcess'](mockEvent)).resolves.toBeUndefined();
        });

        it('レポートドキュメントパスの場合はSkipProcessingErrorをスローすること', async () => {
            // Arrange
            const reportEvent = {
                data: {
                    ref: {
                        path: 'collections/reports/daily/2024-01/01'
                    }
                }
            } as FirestoreDocumentCreatedEvent;

            // Act & Assert
            await expect(handler['beforeProcess'](reportEvent)).rejects.toThrow('レポートドキュメントのため処理をスキップ');
        });

        it('dataが未定義の場合でもエラーをスローしないこと', async () => {
            // Arrange
            const undefinedDataEvent = {
                data: undefined
            } as FirestoreDocumentCreatedEvent;

            // Act & Assert
            await expect(handler['beforeProcess'](undefinedDataEvent)).resolves.toBeUndefined();
        });

        it('pathが未定義の場合でもエラーをスローしないこと', async () => {
            // Arrange
            const undefinedPathEvent = {
                data: {
                    ref: {
                        path: undefined
                    }
                }
            } as any;

            // Act & Assert
            await expect(handler['beforeProcess'](undefinedPathEvent)).resolves.toBeUndefined();
        });
    });

    describe('process', () => {
        it('ProcessFirestoreDocumentUseCaseを正しく呼び出すこと', async () => {
            // Arrange
            mockProcessUseCase.execute.mockResolvedValue(mockResponse);

            // Act
            const result = await handler['process'](mockEvent);

            // Assert
            expect(result).toEqual(mockResponse);
            expect(mockProcessUseCase.execute).toHaveBeenCalledWith(mockEvent);
        });

        it('ユースケースからエラーが投げられた場合は適切に伝播すること', async () => {
            // Arrange
            const error = new Error('ユースケースエラー');
            mockProcessUseCase.execute.mockRejectedValue(error);

            // Act & Assert
            await expect(handler['process'](mockEvent)).rejects.toThrow('ユースケースエラー');
        });
    });

    describe('handleError', () => {
        it('SkipProcessingError以外のエラーの場合は基底クラスのhandleErrorを呼び出すこと', async () => {
            // Arrange
            const error = new Error('一般的なエラー');
            const baseHandlerSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(handler)), 'handleError');
            baseHandlerSpy.mockResolvedValue(mockResponse);

            // Act
            const result = await handler['handleError'](error);

            // Assert
            expect(result).toEqual(mockResponse);
            expect(baseHandlerSpy).toHaveBeenCalledWith(error);
        });
    });

    describe('エラーハンドリングの統合テスト', () => {
        it('ユースケース実行中にエラーが発生した場合は適切にハンドリングされること', async () => {
            // Arrange
            const error = new Error('ユースケース実行エラー');
            mockProcessUseCase.execute.mockRejectedValue(error);

            // BaseEventHandlerのhandleErrorメソッドをモック
            const baseHandlerSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(handler)), 'handleError');
            const errorResponse = {
                status: 500,
                success: false,
                message: 'エラーが発生しました',
                data: {}
            };
            baseHandlerSpy.mockResolvedValue(errorResponse);

            // Act
            const result = await handler.handle(mockEvent);

            // Assert
            expect(result).toEqual(errorResponse);
            expect(baseHandlerSpy).toHaveBeenCalledWith(error);
        });
    });
});
