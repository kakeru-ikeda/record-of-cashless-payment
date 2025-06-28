import { BaseEventHandler } from '../../../../../../../functions/src/presentation/handlers/base/BaseEventHandler';
import { ResponseHelper, Response } from '../../../../../../../shared/presentation/responses/ResponseHelper';
import { ErrorHandler } from '../../../../../../../shared/infrastructure/errors/ErrorHandler';
import { logger } from '../../../../../../../shared/infrastructure/logging/Logger';
import { AppError, ErrorType } from '../../../../../../../shared/errors/AppError';

// モック
jest.mock('../../../../../../../shared/infrastructure/logging/Logger', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        logAppError: jest.fn(),
        updateServiceStatus: jest.fn()
    }
}));
jest.mock('../../../../../../../shared/infrastructure/errors/ErrorHandler');

describe('BaseEventHandler', () => {
    // テスト用の具象クラス
    class TestEventHandler extends BaseEventHandler<string, string> {
        private shouldThrowError = false;
        private processResult = 'test result';
        private beforeProcessCalled = false;
        private afterProcessCalled = false;

        constructor() {
            super('TestHandler');
        }

        setThrowError(shouldThrow: boolean) {
            this.shouldThrowError = shouldThrow;
        }

        setProcessResult(result: string) {
            this.processResult = result;
        }

        protected async beforeProcess(event: string): Promise<void> {
            this.beforeProcessCalled = true;
        }

        protected async process(event: string): Promise<string> {
            if (this.shouldThrowError) {
                throw new Error('Test error');
            }
            return this.processResult;
        }

        protected async afterProcess(event: string, result: string): Promise<void> {
            this.afterProcessCalled = true;
        }

        // テスト用のゲッター
        get wasBeforeProcessCalled() {
            return this.beforeProcessCalled;
        }

        get wasAfterProcessCalled() {
            return this.afterProcessCalled;
        }
    }

    let handler: TestEventHandler;
    const mockLogger = logger as jest.Mocked<typeof logger>;
    const mockErrorHandler = ErrorHandler as jest.Mocked<typeof ErrorHandler>;

    beforeEach(() => {
        handler = new TestEventHandler();
        jest.clearAllMocks();
    });

    describe('handle', () => {
        it('正常系: イベントを正常に処理する', async () => {
            const event = 'test event';
            const expectedResult = 'test result';
            handler.setProcessResult(expectedResult);

            const result = await handler.handle(event);

            expect(result).toBe(expectedResult);
            expect(handler.wasBeforeProcessCalled).toBe(true);
            expect(handler.wasAfterProcessCalled).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(
                '処理開始',
                'TestHandler',
                { suppressConsole: false }
            );
            expect(mockLogger.info).toHaveBeenCalledWith('処理完了', 'TestHandler');
        });

        it('異常系: エラーが発生した場合にエラーハンドリングが実行される', async () => {
            const event = 'test event';
            const error = new Error('Test error');
            const expectedAppError = new AppError('General error', ErrorType.GENERAL);

            handler.setThrowError(true);
            mockErrorHandler.handle.mockResolvedValue(expectedAppError);

            const result = await handler.handle(event);

            expect(result).toBe(expectedAppError);
            expect(mockLogger.error).toHaveBeenCalledWith(error, 'TestHandler');
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error, 'TestHandler');
            expect(handler.wasBeforeProcessCalled).toBe(true);
            expect(handler.wasAfterProcessCalled).toBe(false);
        });

        it('異常系: beforeProcessでエラーが発生した場合', async () => {
            const event = 'test event';
            const error = new Error('BeforeProcess error');
            const expectedAppError = new AppError('General error', ErrorType.GENERAL);

            // beforeProcessでエラーを投げるように変更
            handler['beforeProcess'] = jest.fn().mockRejectedValue(error);
            mockErrorHandler.handle.mockResolvedValue(expectedAppError);

            const result = await handler.handle(event);

            expect(result).toBe(expectedAppError);
            expect(mockLogger.error).toHaveBeenCalledWith(error, 'TestHandler');
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error, 'TestHandler');
        });

        it('異常系: afterProcessでエラーが発生した場合', async () => {
            const event = 'test event';
            const processResult = 'test result';
            const error = new Error('AfterProcess error');
            const expectedAppError = new AppError('General error', ErrorType.GENERAL);

            handler.setProcessResult(processResult);
            // afterProcessでエラーを投げるように変更
            handler['afterProcess'] = jest.fn().mockRejectedValue(error);
            mockErrorHandler.handle.mockResolvedValue(expectedAppError);

            const result = await handler.handle(event);

            expect(result).toBe(expectedAppError);
            expect(mockLogger.error).toHaveBeenCalledWith(error, 'TestHandler');
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error, 'TestHandler');
        });
    });

    describe('createSuccessResponse', () => {
        it('データなしで成功レスポンスを作成する', () => {
            const message = 'Success message';

            const result = handler['createSuccessResponse'](message);

            expect(result).toEqual({
                status: 200,
                success: true,
                message: message,
                data: {}
            });
        });

        it('データありで成功レスポンスを作成する', () => {
            const message = 'Success message';
            const data = { key: 'value', count: 10 };

            const result = handler['createSuccessResponse'](message, data);

            expect(result).toEqual({
                status: 200,
                success: true,
                message: message,
                data: data
            });
        });
    });

    describe('handleError', () => {
        it('ErrorHandlerを使用してエラーを処理する', async () => {
            const error = new Error('Test error');
            const expectedAppError = new AppError('Validation error', ErrorType.VALIDATION);

            mockErrorHandler.handle.mockResolvedValue(expectedAppError);

            const result = await handler['handleError'](error);

            expect(result).toBe(expectedAppError);
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error, 'TestHandler');
        });

        it('AppErrorを処理する', async () => {
            const appError = new AppError('Not found error', ErrorType.NOT_FOUND);

            mockErrorHandler.handle.mockResolvedValue(appError);

            const result = await handler['handleError'](appError);

            expect(result).toBe(appError);
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(appError, 'TestHandler');
        });
    });

    describe('abstract methods', () => {
        it('processメソッドは抽象メソッドとして定義されている', () => {
            // BaseEventHandlerを直接インスタンス化しようとするとTypeScriptエラーになることをテスト
            // 実際のテストはコンパイル時に行われるため、ここでは具象クラスが正しく動作することを確認
            expect(handler['process']).toBeDefined();
            expect(typeof handler['process']).toBe('function');
        });
    });

    describe('protected methods', () => {
        it('beforeProcessはデフォルトで何もしない', async () => {
            const baseHandler = new (class extends BaseEventHandler<string, string> {
                protected async process(event: string): Promise<string> {
                    return 'result';
                }
            })('TestBase');

            // デフォルトのbeforeProcessは何も例外を投げない
            await expect(baseHandler['beforeProcess']('test')).resolves.toBeUndefined();
        });

        it('afterProcessはデフォルトで何もしない', async () => {
            const baseHandler = new (class extends BaseEventHandler<string, string> {
                protected async process(event: string): Promise<string> {
                    return 'result';
                }
            })('TestBase');

            // デフォルトのafterProcessは何も例外を投げない
            await expect(baseHandler['afterProcess']('test', 'result')).resolves.toBeUndefined();
        });
    });
});
