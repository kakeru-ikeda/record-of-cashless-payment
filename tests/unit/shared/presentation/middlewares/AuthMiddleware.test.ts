import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { authMiddleware } from '../../../../../shared/presentation/middlewares/AuthMiddleware';
import { ResponseHelper } from '../../../../../shared/presentation/responses/ResponseHelper';

// Firebase Admin SDKをモック
jest.mock('firebase-admin', () => ({
    auth: jest.fn(() => ({
        verifyIdToken: jest.fn(),
        getUser: jest.fn(),
    })),
}));

// ResponseHelperをモック
jest.mock('../../../../../shared/presentation/responses/ResponseHelper', () => ({
    ResponseHelper: {
        unauthorized: jest.fn(),
        invalidToken: jest.fn(),
        forbidden: jest.fn(),
        error: jest.fn(),
    },
}));

// console.logをモック
jest.spyOn(console, 'log').mockImplementation(() => { });
jest.spyOn(console, 'error').mockImplementation(() => { });

describe('AuthMiddleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;
    let mockAuthVerifyIdToken: jest.Mock;
    let mockAuthGetUser: jest.Mock;

    beforeEach(() => {
        // リクエスト・レスポンスのモック初期化
        mockRequest = {
            headers: {},
            user: undefined,
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        mockNext = jest.fn();

        // Firebase Admin SDKのモック初期化
        mockAuthVerifyIdToken = jest.fn();
        mockAuthGetUser = jest.fn();
        (admin.auth as jest.Mock).mockReturnValue({
            verifyIdToken: mockAuthVerifyIdToken,
            getUser: mockAuthGetUser,
        });

        // ResponseHelperのモック初期化
        (ResponseHelper.unauthorized as jest.Mock).mockReturnValue({
            status: 401,
            message: 'Unauthorized',
        });
        (ResponseHelper.invalidToken as jest.Mock).mockReturnValue({
            status: 401,
            message: 'Invalid token',
        });
        (ResponseHelper.forbidden as jest.Mock).mockReturnValue({
            status: 403,
            message: 'Forbidden',
        });
        (ResponseHelper.error as jest.Mock).mockReturnValue({
            status: 500,
            message: 'Internal server error',
        });

        // 環境変数をリセット
        delete process.env.API_TEST_MODE;
        delete process.env.API_TEST_TOKEN;

        // モックをクリア
        jest.clearAllMocks();
    });

    describe('authMiddleware', () => {
        describe('テストモード', () => {
            beforeEach(() => {
                process.env.API_TEST_MODE = 'true';
                process.env.API_TEST_TOKEN = 'test-token-123';
            });

            it('テストモードでテスト用トークンが正しい場合、認証をバイパスする', async () => {
                mockRequest.headers = {
                    authorization: 'Bearer test-token-123',
                };

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(mockRequest.user).toEqual({
                    uid: 'test-user',
                    email: 'test@example.com',
                    name: 'Test User',
                });
                expect(mockNext).toHaveBeenCalledTimes(1);
                expect(mockResponse.status).not.toHaveBeenCalled();
                expect(console.log).toHaveBeenCalledWith('🧪 テスト環境のため認証をバイパスします');
            });

            it('テストモードでテスト用トークンが間違っている場合、通常の認証処理を行う', async () => {
                mockRequest.headers = {
                    authorization: 'Bearer wrong-token',
                };

                mockAuthVerifyIdToken.mockResolvedValue({
                    uid: 'real-user-id',
                    email: 'real@example.com',
                    name: 'Real User',
                });

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(mockAuthVerifyIdToken).toHaveBeenCalledWith('wrong-token');
                expect(mockNext).toHaveBeenCalledTimes(1);
            });

            it('テストモードでAPI_TEST_TOKENが設定されていない場合、デフォルトのtest-tokenを使用する', async () => {
                delete process.env.API_TEST_TOKEN;
                mockRequest.headers = {
                    authorization: 'Bearer test-token',
                };

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(mockRequest.user).toEqual({
                    uid: 'test-user',
                    email: 'test@example.com',
                    name: 'Test User',
                });
                expect(mockNext).toHaveBeenCalledTimes(1);
            });
        });

        describe('通常モード', () => {
            it('認証ヘッダーがない場合、401エラーを返す', async () => {
                mockRequest.headers = {};

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(ResponseHelper.unauthorized).toHaveBeenCalledWith('認証ヘッダーがありません');
                expect(mockResponse.status).toHaveBeenCalledWith(401);
                expect(mockResponse.json).toHaveBeenCalled();
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('認証ヘッダーの形式が無効な場合、401エラーを返す', async () => {
                mockRequest.headers = {
                    authorization: 'InvalidFormat token',
                };

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(ResponseHelper.unauthorized).toHaveBeenCalledWith('認証ヘッダーの形式が無効です');
                expect(mockResponse.status).toHaveBeenCalledWith(401);
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('Bearerキーワードがない場合、401エラーを返す', async () => {
                mockRequest.headers = {
                    authorization: 'token-only',
                };

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(ResponseHelper.unauthorized).toHaveBeenCalledWith('認証ヘッダーの形式が無効です');
                expect(mockResponse.status).toHaveBeenCalledWith(401);
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('有効なトークンの場合、ユーザー情報を設定してnextを呼ぶ', async () => {
                mockRequest.headers = {
                    authorization: 'Bearer valid-token',
                };

                const decodedToken = {
                    uid: 'user-123',
                    email: 'user@example.com',
                    name: 'Test User',
                };
                mockAuthVerifyIdToken.mockResolvedValue(decodedToken);

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(mockAuthVerifyIdToken).toHaveBeenCalledWith('valid-token');
                expect(mockRequest.user).toEqual({
                    uid: 'user-123',
                    email: 'user@example.com',
                    name: 'Test User',
                });
                expect(mockNext).toHaveBeenCalledTimes(1);
                expect(mockResponse.status).not.toHaveBeenCalled();
            });

            it('emailとnameがundefinedの場合、空文字列を設定する', async () => {
                mockRequest.headers = {
                    authorization: 'Bearer valid-token',
                };

                const decodedToken = {
                    uid: 'user-123',
                    email: undefined,
                    name: undefined,
                };
                mockAuthVerifyIdToken.mockResolvedValue(decodedToken);

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(mockRequest.user).toEqual({
                    uid: 'user-123',
                    email: '',
                    name: '',
                });
                expect(mockNext).toHaveBeenCalledTimes(1);
            });
        });

        describe('エラーハンドリング', () => {
            beforeEach(() => {
                mockRequest.headers = {
                    authorization: 'Bearer invalid-token',
                };
            });

            it('トークン有効期限切れの場合、invalidTokenレスポンスを返す', async () => {
                const error = new Error('auth/id-token-expired');
                mockAuthVerifyIdToken.mockRejectedValue(error);

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(ResponseHelper.invalidToken).toHaveBeenCalledWith('認証トークンの有効期限が切れています');
                expect(mockResponse.status).toHaveBeenCalled();
                expect(mockNext).not.toHaveBeenCalled();
                expect(console.error).toHaveBeenCalledWith('認証エラー:', error);
            });

            it('トークン無効化の場合、invalidTokenレスポンスを返す', async () => {
                const error = new Error('auth/id-token-revoked');
                mockAuthVerifyIdToken.mockRejectedValue(error);

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(ResponseHelper.invalidToken).toHaveBeenCalledWith('認証トークンが無効化されています');
                expect(mockResponse.status).toHaveBeenCalled();
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('不正なトークンの場合、invalidTokenレスポンスを返す', async () => {
                const error = new Error('auth/invalid-id-token');
                mockAuthVerifyIdToken.mockRejectedValue(error);

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(ResponseHelper.invalidToken).toHaveBeenCalledWith('不正な認証トークンです');
                expect(mockResponse.status).toHaveBeenCalled();
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('ユーザーが無効化されている場合、forbiddenレスポンスを返す', async () => {
                const error = new Error('auth/user-disabled');
                mockAuthVerifyIdToken.mockRejectedValue(error);

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(ResponseHelper.forbidden).toHaveBeenCalledWith('このユーザーアカウントは無効化されています');
                expect(mockResponse.status).toHaveBeenCalled();
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('ユーザーが存在しない場合、unauthorizedレスポンスを返す', async () => {
                const error = new Error('auth/user-not-found');
                mockAuthVerifyIdToken.mockRejectedValue(error);

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(ResponseHelper.unauthorized).toHaveBeenCalledWith('このユーザーは存在しません');
                expect(mockResponse.status).toHaveBeenCalled();
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('トークンフォーマットエラーの場合、invalidTokenレスポンスを返す', async () => {
                const error = new Error('auth/argument-error');
                mockAuthVerifyIdToken.mockRejectedValue(error);

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(ResponseHelper.invalidToken).toHaveBeenCalledWith('トークンの形式が正しくありません');
                expect(mockResponse.status).toHaveBeenCalled();
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('その他のエラーの場合、unauthorizedレスポンスを返す', async () => {
                const error = new Error('Some other error');
                mockAuthVerifyIdToken.mockRejectedValue(error);

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(ResponseHelper.unauthorized).toHaveBeenCalledWith('認証に失敗しました');
                expect(mockResponse.status).toHaveBeenCalled();
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('Error以外の例外の場合、unauthorizedレスポンスを返す', async () => {
                const error = 'Non-Error exception';
                mockAuthVerifyIdToken.mockRejectedValue(error);

                await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

                expect(ResponseHelper.unauthorized).toHaveBeenCalledWith('認証に失敗しました');
                expect(mockResponse.status).toHaveBeenCalled();
                expect(mockNext).not.toHaveBeenCalled();
            });
        });
    });
});
