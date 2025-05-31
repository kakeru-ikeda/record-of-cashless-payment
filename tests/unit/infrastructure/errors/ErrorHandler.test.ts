import { ErrorHandler } from '../../../../shared/infrastructure/errors/ErrorHandler';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { logger } from '../../../../shared/infrastructure/logging/Logger';

// Loggerをモック化
jest.mock('../../../../shared/infrastructure/logging/Logger', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        logAppError: jest.fn(),
        updateServiceStatus: jest.fn()
    }
}));

describe('ErrorHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('handle', () => {
        it('AppErrorインスタンスをそのまま返すこと', async () => {
            const originalError = new AppError('テストエラー', ErrorType.VALIDATION);

            const result = await ErrorHandler.handle(originalError, 'TestContext');

            expect(result).toBe(originalError);
            expect(logger.error).toHaveBeenCalledWith(originalError, 'TestContext', {
                notify: true
            });
        });

        it('通常のErrorをAppErrorに変換すること', async () => {
            const originalError = new Error('通常のエラー');

            const result = await ErrorHandler.handle(originalError, 'TestContext');

            expect(result).toBeInstanceOf(AppError);
            expect(result.message).toBe('通常のエラー');
            expect(result.type).toBe(ErrorType.GENERAL);
            expect(result.originalError).toBe(originalError);
            expect(logger.error).toHaveBeenCalledWith(result, 'TestContext', {
                notify: true
            });
        });

        it('文字列エラーをAppErrorに変換すること', async () => {
            const errorMessage = 'エラー文字列';

            const result = await ErrorHandler.handle(errorMessage, 'TestContext');

            expect(result).toBeInstanceOf(AppError);
            expect(result.message).toBe('エラー文字列');
            expect(result.type).toBe(ErrorType.GENERAL);
            expect(logger.error).toHaveBeenCalledWith(result, 'TestContext', {
                notify: true
            });
        });

        it('suppressNotificationがtrueの場合、通知を抑制すること', async () => {
            const error = new Error('テストエラー');

            await ErrorHandler.handle(error, 'TestContext', {
                suppressNotification: true
            });

            expect(logger.error).toHaveBeenCalledWith(
                expect.any(AppError),
                'TestContext',
                { notify: false }
            );
        });

        it('defaultMessageが指定された場合、カスタムメッセージを使用すること', async () => {
            const error = new Error('元のエラー');

            const result = await ErrorHandler.handle(error, 'TestContext', {
                defaultMessage: 'カスタムメッセージ'
            });

            expect(result.message).toBe('カスタムメッセージ');
        });

        it('additionalInfoが指定された場合、追加情報を含むこと', async () => {
            const error = new Error('テストエラー');
            const additionalInfo = { userId: '123', action: 'test' };

            const result = await ErrorHandler.handle(error, 'TestContext', {
                additionalInfo
            });

            expect(result.details).toEqual(additionalInfo);
        });
    });

    describe('errorDecorator', () => {
        let testClass: any;

        beforeEach(() => {
            testClass = {
                normalMethod: jest.fn().mockResolvedValue('success'),
                errorMethod: jest.fn().mockRejectedValue(new Error('メソッドエラー')),
                syncMethod: jest.fn().mockReturnValue('sync success')
            };
        });

        it('正常なメソッドは元の結果を返すこと', async () => {
            const decorator = ErrorHandler.errorDecorator('TestContext');
            const descriptor = { value: testClass.normalMethod };

            const decoratedDescriptor = decorator({}, 'testMethod', descriptor);
            const result = await decoratedDescriptor.value();

            expect(result).toBe('success');
            expect(testClass.normalMethod).toHaveBeenCalled();
            expect(logger.error).not.toHaveBeenCalled();
        });

        it('エラーが発生した場合、ErrorHandlerでハンドリングしてエラーを再スローすること', async () => {
            const decorator = ErrorHandler.errorDecorator('TestContext');
            const descriptor = { value: testClass.errorMethod };

            const decoratedDescriptor = decorator({}, 'testMethod', descriptor);

            await expect(decoratedDescriptor.value()).rejects.toThrow(AppError);
            expect(testClass.errorMethod).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(
                expect.any(AppError),
                'TestContext',
                { notify: true }
            );
        });

        it('rethrowがfalseの場合、エラーを再スローせずundefinedを返すこと', async () => {
            const decorator = ErrorHandler.errorDecorator('TestContext', {
                rethrow: false
            });
            const descriptor = { value: testClass.errorMethod };

            const decoratedDescriptor = decorator({}, 'testMethod', descriptor);
            const result = await decoratedDescriptor.value();

            expect(result).toBeUndefined();
            expect(testClass.errorMethod).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalled();
        });

        it('suppressNotificationがtrueの場合、通知を抑制すること', async () => {
            const decorator = ErrorHandler.errorDecorator('TestContext', {
                suppressNotification: true,
                rethrow: false
            });
            const descriptor = { value: testClass.errorMethod };

            const decoratedDescriptor = decorator({}, 'testMethod', descriptor);
            await decoratedDescriptor.value();

            expect(logger.error).toHaveBeenCalledWith(
                expect.any(AppError),
                'TestContext',
                { notify: false }
            );
        });

        it('defaultMessageが指定された場合、カスタムメッセージを使用すること', async () => {
            const decorator = ErrorHandler.errorDecorator('TestContext', {
                defaultMessage: 'カスタムエラーメッセージ',
                rethrow: false
            });
            const descriptor = { value: testClass.errorMethod };

            const decoratedDescriptor = decorator({}, 'testMethod', descriptor);
            await decoratedDescriptor.value();

            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'カスタムエラーメッセージ'
                }),
                'TestContext',
                expect.any(Object)
            );
        });

        it('descriptorのvalueがない場合、元のdescriptorを返すこと', () => {
            const decorator = ErrorHandler.errorDecorator('TestContext');
            const descriptor = {};

            const result = decorator({}, 'testMethod', descriptor as PropertyDescriptor);

            expect(result).toBe(descriptor);
        });
    });

    describe('extractErrorInfoFromArgs', () => {
        it('メール関連の情報を抽出できること', () => {
            const args = [
                { subject: 'テストメール', from: 'test@example.com', body: 'メール本文の内容です' },
                'その他の引数'
            ];

            const result = ErrorHandler.extractErrorInfoFromArgs(args);

            expect(result).toEqual({
                subject: 'テストメール',
                from: 'test@example.com',
                bodyPreview: 'メール本文の内容です'
            });
        });

        it('カード会社情報を抽出できること', () => {
            const args = [
                { cardCompany: 'MUFG', id: '12345' }
            ];

            const result = ErrorHandler.extractErrorInfoFromArgs(args);

            expect(result).toEqual({
                cardCompany: 'MUFG',
                id: '12345'
            });
        });

        it('長い本文を100文字で切り捨てること', () => {
            const longBody = 'a'.repeat(200);
            const args = [
                { body: longBody }
            ];

            const result = ErrorHandler.extractErrorInfoFromArgs(args);

            expect(result.bodyPreview).toBe('a'.repeat(100));
        });

        it('mailboxNameとuidを抽出できること', () => {
            const args = [
                { mailboxName: 'INBOX', uid: 'uid123' }
            ];

            const result = ErrorHandler.extractErrorInfoFromArgs(args);

            expect(result).toEqual({
                mailboxName: 'INBOX',
                uid: 'uid123'
            });
        });

        it('オブジェクトでない引数は無視すること', () => {
            const args = [
                'string argument',
                123,
                null,
                undefined,
                { subject: 'テストメール' }
            ];

            const result = ErrorHandler.extractErrorInfoFromArgs(args);

            expect(result).toEqual({
                subject: 'テストメール'
            });
        });

        it('空の配列の場合、空のオブジェクトを返すこと', () => {
            const result = ErrorHandler.extractErrorInfoFromArgs([]);

            expect(result).toEqual({});
        });
    });

    describe('convertToAppError', () => {
        it('AppErrorはそのまま返すこと', () => {
            const originalError = new AppError('元のエラー', ErrorType.VALIDATION);

            const result = ErrorHandler.convertToAppError(originalError);

            expect(result).toBe(originalError);
        });

        it('AppErrorに追加情報がある場合、新しいインスタンスを作成すること', () => {
            const originalError = new AppError('元のエラー', ErrorType.VALIDATION, { original: 'data' });
            const additionalDetails = { new: 'data' };

            const result = ErrorHandler.convertToAppError(originalError, 'カスタムメッセージ', additionalDetails);

            expect(result).not.toBe(originalError);
            expect(result.message).toBe('カスタムメッセージ');
            expect(result.type).toBe(ErrorType.VALIDATION);
            expect(result.details).toEqual({ original: 'data', new: 'data' });
        });

        it('通常のErrorをAppErrorに変換すること', () => {
            const error = new Error('通常のエラー');

            const result = ErrorHandler.convertToAppError(error);

            expect(result).toBeInstanceOf(AppError);
            expect(result.message).toBe('通常のエラー');
            expect(result.type).toBe(ErrorType.GENERAL);
            expect(result.originalError).toBe(error);
        });

        it('文字列をAppErrorに変換すること', () => {
            const errorString = 'エラー文字列';

            const result = ErrorHandler.convertToAppError(errorString);

            expect(result).toBeInstanceOf(AppError);
            expect(result.message).toBe('エラー文字列');
            expect(result.type).toBe(ErrorType.GENERAL);
        });

        it('オブジェクトをAppErrorに変換すること', () => {
            const errorObject = { message: 'オブジェクトエラー', code: 500 };

            const result = ErrorHandler.convertToAppError(errorObject);

            expect(result).toBeInstanceOf(AppError);
            expect(result.message).toBe('オブジェクトエラー');
            expect(result.type).toBe(ErrorType.GENERAL);
            expect(result.details).toEqual(errorObject);
        });

        it('nullまたはundefinedの場合、デフォルトメッセージを使用すること', () => {
            const result1 = ErrorHandler.convertToAppError(null);
            const result2 = ErrorHandler.convertToAppError(undefined);

            expect(result1.message).toBe('不明なエラーが発生しました');
            expect(result2.message).toBe('不明なエラーが発生しました');
        });

        it('カスタムメッセージが指定された場合、それを使用すること', () => {
            const error = new Error('元のメッセージ');

            const result = ErrorHandler.convertToAppError(error, 'カスタムメッセージ');

            expect(result.message).toBe('カスタムメッセージ');
        });

        it('追加詳細情報が指定された場合、それを含むこと', () => {
            const error = new Error('テストエラー');
            const additionalDetails = { userId: '123', action: 'test' };

            const result = ErrorHandler.convertToAppError(error, undefined, additionalDetails);

            expect(result.details).toEqual(additionalDetails);
        });
    });

    describe('inferErrorType', () => {
        // private メソッドなので、convertToAppError経由でテスト
        it('Firebaseエラーを正しく推測すること', () => {
            const firebaseError = new Error('Firebase error occurred');

            const result = ErrorHandler.convertToAppError(firebaseError);

            expect(result.type).toBe(ErrorType.FIREBASE);
        });

        it('Firestoreエラーを正しく推測すること', () => {
            const firestoreError = new Error('Firestore connection failed');

            const result = ErrorHandler.convertToAppError(firestoreError);

            expect(result.type).toBe(ErrorType.FIREBASE);
        });

        it('ネットワークエラーを正しく推測すること', () => {
            const networkError = new Error('Network timeout occurred');

            const result = ErrorHandler.convertToAppError(networkError);

            expect(result.type).toBe(ErrorType.NETWORK);
        });

        it('接続エラーを正しく推測すること', () => {
            const connectionError = new Error('Connection refused');

            const result = ErrorHandler.convertToAppError(connectionError);

            expect(result.type).toBe(ErrorType.NETWORK);
        });

        it('認証エラーを正しく推測すること', () => {
            const authError = new Error('Authentication failed');

            const result = ErrorHandler.convertToAppError(authError);

            expect(result.type).toBe(ErrorType.AUTHENTICATION);
        });

        it('権限エラーを正しく推測すること', () => {
            const permissionError = new Error('Permission denied');

            const result = ErrorHandler.convertToAppError(permissionError);

            expect(result.type).toBe(ErrorType.AUTHENTICATION);
        });

        it('Not Foundエラーを正しく推測すること', () => {
            const notFoundError = new Error('Resource not found');

            const result = ErrorHandler.convertToAppError(notFoundError);

            expect(result.type).toBe(ErrorType.NOT_FOUND);
        });

        it('日本語のNot Foundエラーを正しく推測すること', () => {
            const notFoundError = new Error('リソースが存在しません');

            const result = ErrorHandler.convertToAppError(notFoundError);

            expect(result.type).toBe(ErrorType.NOT_FOUND);
        });

        it('バリデーションエラーを正しく推測すること', () => {
            const validationError = new Error('Validation failed');

            const result = ErrorHandler.convertToAppError(validationError);

            expect(result.type).toBe(ErrorType.VALIDATION);
        });

        it('不正な値エラーを正しく推測すること', () => {
            const invalidError = new Error('Invalid input provided');

            const result = ErrorHandler.convertToAppError(invalidError);

            expect(result.type).toBe(ErrorType.VALIDATION);
        });

        it('メールエラーを正しく推測すること', () => {
            const emailError = new Error('Email sending failed');

            const result = ErrorHandler.convertToAppError(emailError);

            expect(result.type).toBe(ErrorType.EMAIL);
        });

        it('IMAPエラーを正しく推測すること', () => {
            const imapError = new Error('IMAP connection error');

            const result = ErrorHandler.convertToAppError(imapError);

            expect(result.type).toBe(ErrorType.EMAIL);
        });

        it('Discordエラーを正しく推測すること', () => {
            const discordError = new Error('Discord webhook failed');

            const result = ErrorHandler.convertToAppError(discordError);

            expect(result.type).toBe(ErrorType.DISCORD);
        });

        it('Webhookエラーを正しく推測すること', () => {
            const webhookError = new Error('Webhook delivery failed');

            const result = ErrorHandler.convertToAppError(webhookError);

            expect(result.type).toBe(ErrorType.DISCORD);
        });

        it('エラー名からも推測できること', () => {
            const error = new Error('Some error message');
            error.name = 'NetworkError';

            const result = ErrorHandler.convertToAppError(error);

            expect(result.type).toBe(ErrorType.NETWORK);
        });

        it('不明なエラーはGENERALタイプになること', () => {
            const unknownError = new Error('Some unknown error');

            const result = ErrorHandler.convertToAppError(unknownError);

            expect(result.type).toBe(ErrorType.GENERAL);
        });
    });
});
