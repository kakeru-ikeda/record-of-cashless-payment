import { ResponseHelper, Response } from '../../../../../shared/presentation/responses/ResponseHelper';
import { AppError, ErrorType } from '../../../../../shared/errors/AppError';
import { ErrorTypeMapper } from '../../../../../shared/infrastructure/mappers/ErrorTypeMapper';
import { ErrorConfig } from '../../../../../shared/infrastructure/config/ErrorConfig';

// モックの設定
jest.mock('../../../../../shared/infrastructure/mappers/ErrorTypeMapper');
jest.mock('../../../../../shared/infrastructure/config/ErrorConfig');

const mockErrorTypeMapper = ErrorTypeMapper as jest.Mocked<typeof ErrorTypeMapper>;
const mockErrorConfig = ErrorConfig as jest.Mocked<typeof ErrorConfig>;

describe('ResponseHelper', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createResponse', () => {
        it('全てのパラメータでレスポンスを作成できる', () => {
            const response = ResponseHelper.createResponse(200, true, 'Test message', { key: 'value' });

            expect(response).toEqual({
                status: 200,
                success: true,
                message: 'Test message',
                data: { key: 'value' }
            });
        });

        it('dataパラメータなしでレスポンスを作成できる', () => {
            const response = ResponseHelper.createResponse(404, false, 'Not found');

            expect(response).toEqual({
                status: 404,
                success: false,
                message: 'Not found',
                data: undefined
            });
        });

        it('nullのdataでレスポンスを作成できる', () => {
            const response = ResponseHelper.createResponse(200, true, 'Success', null);

            expect(response).toEqual({
                status: 200,
                success: true,
                message: 'Success',
                data: null
            });
        });
    });

    describe('success', () => {
        it('データありで成功レスポンスを作成できる', () => {
            const data = { id: 1, name: 'test' };
            const response = ResponseHelper.success('Operation successful', data);

            expect(response).toEqual({
                status: 200,
                success: true,
                message: 'Operation successful',
                data: data
            });
        });

        it('データなしで成功レスポンスを作成できる', () => {
            const response = ResponseHelper.success('Operation successful');

            expect(response).toEqual({
                status: 200,
                success: true,
                message: 'Operation successful',
                data: undefined
            });
        });

        it('空文字のメッセージで成功レスポンスを作成できる', () => {
            const response = ResponseHelper.success('');

            expect(response).toEqual({
                status: 200,
                success: true,
                message: '',
                data: undefined
            });
        });
    });

    describe('error', () => {
        it('カスタムステータスコードでエラーレスポンスを作成できる', () => {
            const response = ResponseHelper.error(400, 'Bad request', { field: 'email' });

            expect(response).toEqual({
                status: 400,
                success: false,
                message: 'Bad request',
                data: { field: 'email' }
            });
        });

        it('デフォルトステータスコード（500）でエラーレスポンスを作成できる', () => {
            const response = ResponseHelper.error(undefined as any, 'Internal error');

            expect(response).toEqual({
                status: 500,
                success: false,
                message: 'Internal error',
                data: undefined
            });
        });

        it('データなしでエラーレスポンスを作成できる', () => {
            const response = ResponseHelper.error(404, 'Not found');

            expect(response).toEqual({
                status: 404,
                success: false,
                message: 'Not found',
                data: undefined
            });
        });

        it('ステータスコード0を処理できる', () => {
            const response = ResponseHelper.error(0, 'No status');

            expect(response).toEqual({
                status: 0,
                success: false,
                message: 'No status',
                data: undefined
            });
        });
    });

    describe('fromAppError', () => {
        beforeEach(() => {
            mockErrorTypeMapper.toHttpStatusCode.mockReturnValue(404);
            mockErrorConfig.shouldIncludeDetails.mockReturnValue(true);
        });

        it('shouldIncludeDetailsがtrueの場合、詳細情報付きでAppErrorをレスポンスに変換できる', () => {
            const appError = new AppError('Resource not found', ErrorType.NOT_FOUND, { resourceId: '123' });
            mockErrorConfig.shouldIncludeDetails.mockReturnValue(true);

            const response = ResponseHelper.fromAppError(appError);

            expect(mockErrorTypeMapper.toHttpStatusCode).toHaveBeenCalledWith(ErrorType.NOT_FOUND);
            expect(mockErrorConfig.shouldIncludeDetails).toHaveBeenCalled();
            expect(response).toEqual({
                status: 404,
                success: false,
                message: 'Resource not found',
                data: { resourceId: '123' }
            });
        });

        it('shouldIncludeDetailsがfalseの場合、詳細情報なしでAppErrorをレスポンスに変換できる', () => {
            const appError = new AppError('Resource not found', ErrorType.NOT_FOUND, { resourceId: '123' });
            mockErrorConfig.shouldIncludeDetails.mockReturnValue(false);

            const response = ResponseHelper.fromAppError(appError);

            expect(mockErrorTypeMapper.toHttpStatusCode).toHaveBeenCalledWith(ErrorType.NOT_FOUND);
            expect(mockErrorConfig.shouldIncludeDetails).toHaveBeenCalled();
            expect(response).toEqual({
                status: 404,
                success: false,
                message: 'Resource not found',
                data: undefined
            });
        });

        it('詳細情報なしのAppErrorを処理できる', () => {
            const appError = new AppError('Validation failed', ErrorType.VALIDATION);
            mockErrorTypeMapper.toHttpStatusCode.mockReturnValue(400);
            mockErrorConfig.shouldIncludeDetails.mockReturnValue(true);

            const response = ResponseHelper.fromAppError(appError);

            expect(response).toEqual({
                status: 400,
                success: false,
                message: 'Validation failed',
                data: undefined
            });
        });

        it('異なるエラータイプを正しく処理できる', () => {
            const appError = new AppError('Authentication failed', ErrorType.AUTHENTICATION);
            mockErrorTypeMapper.toHttpStatusCode.mockReturnValue(401);
            mockErrorConfig.shouldIncludeDetails.mockReturnValue(false);

            const response = ResponseHelper.fromAppError(appError);

            expect(mockErrorTypeMapper.toHttpStatusCode).toHaveBeenCalledWith(ErrorType.AUTHENTICATION);
            expect(response.status).toBe(401);
            expect(response.message).toBe('Authentication failed');
        });
    });

    describe('notFound', () => {
        it('カスタムメッセージで404レスポンスを作成できる', () => {
            const response = ResponseHelper.notFound('User not found');

            expect(response).toEqual({
                status: 404,
                success: false,
                message: 'User not found',
                data: undefined
            });
        });

        it('デフォルトメッセージで404レスポンスを作成できる', () => {
            const response = ResponseHelper.notFound();

            expect(response).toEqual({
                status: 404,
                success: false,
                message: 'リソースが見つかりません',
                data: undefined
            });
        });

        it('空文字のメッセージで404レスポンスを作成できる', () => {
            const response = ResponseHelper.notFound('');

            expect(response).toEqual({
                status: 404,
                success: false,
                message: '',
                data: undefined
            });
        });
    });

    describe('validationError', () => {
        it('カスタムメッセージとエラー情報で400レスポンスを作成できる', () => {
            const errors = { email: 'Invalid format', name: 'Required' };
            const response = ResponseHelper.validationError('Validation failed', errors);

            expect(response).toEqual({
                status: 400,
                success: false,
                message: 'Validation failed',
                data: errors
            });
        });

        it('デフォルトメッセージで400レスポンスを作成できる', () => {
            const response = ResponseHelper.validationError();

            expect(response).toEqual({
                status: 400,
                success: false,
                message: '入力データが不正です',
                data: undefined
            });
        });

        it('デフォルトメッセージとエラー情報で400レスポンスを作成できる', () => {
            const errors = { field: 'error' };
            const response = ResponseHelper.validationError(undefined as any, errors);

            expect(response).toEqual({
                status: 400,
                success: false,
                message: '入力データが不正です',
                data: errors
            });
        });
    });

    describe('unauthorized', () => {
        it('カスタムメッセージとデータで401レスポンスを作成できる', () => {
            const data = { reason: 'Token expired' };
            const response = ResponseHelper.unauthorized('Access denied', data);

            expect(response).toEqual({
                status: 401,
                success: false,
                message: 'Access denied',
                data: data
            });
        });

        it('デフォルトメッセージで401レスポンスを作成できる', () => {
            const response = ResponseHelper.unauthorized();

            expect(response).toEqual({
                status: 401,
                success: false,
                message: '認証が必要です',
                data: undefined
            });
        });

        it('カスタムメッセージのみで401レスポンスを作成できる', () => {
            const response = ResponseHelper.unauthorized('Invalid credentials');

            expect(response).toEqual({
                status: 401,
                success: false,
                message: 'Invalid credentials',
                data: undefined
            });
        });
    });

    describe('invalidToken', () => {
        it('カスタムメッセージとデータで401レスポンスを作成できる', () => {
            const data = { tokenType: 'JWT', expiredAt: '2023-12-31' };
            const response = ResponseHelper.invalidToken('Token is invalid', data);

            expect(response).toEqual({
                status: 401,
                success: false,
                message: 'Token is invalid',
                data: data
            });
        });

        it('デフォルトメッセージで401レスポンスを作成できる', () => {
            const response = ResponseHelper.invalidToken();

            expect(response).toEqual({
                status: 401,
                success: false,
                message: '認証トークンが無効または期限切れです',
                data: undefined
            });
        });

        it('空文字のメッセージで401レスポンスを作成できる', () => {
            const response = ResponseHelper.invalidToken('');

            expect(response).toEqual({
                status: 401,
                success: false,
                message: '',
                data: undefined
            });
        });
    });

    describe('forbidden', () => {
        it('カスタムメッセージとデータで403レスポンスを作成できる', () => {
            const data = { requiredRole: 'admin', userRole: 'user' };
            const response = ResponseHelper.forbidden('Insufficient permissions', data);

            expect(response).toEqual({
                status: 403,
                success: false,
                message: 'Insufficient permissions',
                data: data
            });
        });

        it('デフォルトメッセージで403レスポンスを作成できる', () => {
            const response = ResponseHelper.forbidden();

            expect(response).toEqual({
                status: 403,
                success: false,
                message: 'この操作を実行する権限がありません',
                data: undefined
            });
        });

        it('nullのデータで403レスポンスを作成できる', () => {
            const response = ResponseHelper.forbidden('Access denied', null);

            expect(response).toEqual({
                status: 403,
                success: false,
                message: 'Access denied',
                data: null
            });
        });
    });

    describe('Responseインターフェース準拠', () => {
        it('全てのメソッドがResponseインターフェースに準拠したオブジェクトを返す', () => {
            const responses: Response[] = [
                ResponseHelper.success('Success'),
                ResponseHelper.error(500, 'Error'),
                ResponseHelper.notFound(),
                ResponseHelper.validationError(),
                ResponseHelper.unauthorized(),
                ResponseHelper.invalidToken(),
                ResponseHelper.forbidden()
            ];

            responses.forEach(response => {
                expect(response).toHaveProperty('status');
                expect(response).toHaveProperty('success');
                expect(response).toHaveProperty('message');
                expect(response).toHaveProperty('data');

                expect(typeof response.status).toBe('number');
                expect(typeof response.success).toBe('boolean');
                expect(typeof response.message).toBe('string');
            });
        });
    });

    describe('エッジケース', () => {
        it('undefinedのメッセージを適切に処理できる', () => {
            const response = ResponseHelper.createResponse(200, true, undefined as any);

            expect(response.message).toBeUndefined();
        });

        it('nullのメッセージを適切に処理できる', () => {
            const response = ResponseHelper.createResponse(200, true, null as any);

            expect(response.message).toBeNull();
        });

        it('非常に大きなステータスコードを処理できる', () => {
            const response = ResponseHelper.error(999, 'Custom error');

            expect(response.status).toBe(999);
        });

        it('負のステータスコードを処理できる', () => {
            const response = ResponseHelper.error(-1, 'Invalid status');

            expect(response.status).toBe(-1);
        });

        it('複雑なデータオブジェクトを処理できる', () => {
            const complexData = {
                nested: {
                    array: [1, 2, 3],
                    object: { key: 'value' }
                },
                date: new Date(),
                regexp: /test/g
            };

            const response = ResponseHelper.success('Complex data', complexData);

            expect(response.data).toEqual(complexData);
        });
    });
});
