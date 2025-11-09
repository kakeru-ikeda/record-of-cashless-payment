import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { ResponseHelper } from '@shared/presentation/responses/ResponseHelper';

/**
 * Firebase IDトークンを検証する認証ミドルウェア
 * Authorization: Bearer <token> 形式のヘッダーからトークンを抽出し検証する
 *
 * テスト環境では API_TEST_MODE が true の場合、認証をバイパスできる
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // テストモードの場合は認証をスキップ
  const isTestMode = process.env.API_TEST_MODE === 'true';
  const apiTestToken = process.env.API_TEST_TOKEN || 'test-token';

  // テスト用のトークンがある場合は認証をバイパス
  if (isTestMode && req.headers.authorization === `Bearer ${apiTestToken}`) {
    console.log('🧪 テスト環境のため認証をバイパスします');
    req.user = {
      uid: 'test-user',
      email: 'test@example.com',
      name: 'Test User',
    };
    next();
    return;
  }

  try {
    // ヘッダーからトークンを取得
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      const response = ResponseHelper.unauthorized('認証ヘッダーがありません');
      res.status(response.status).json(response);
      return;
    }

    // ヘッダー形式を確認 (Bearer token)
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      const response = ResponseHelper.unauthorized('認証ヘッダーの形式が無効です');
      res.status(response.status).json(response);
      return;
    }

    const token = parts[1];

    // Firebaseでトークンを検証
    const decodedToken = await admin.auth().verifyIdToken(token);

    // ユーザー情報をリクエストに設定
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      name: decodedToken.name || '',
    };

    // 処理を続行
    next();
  } catch (error) {
    console.error('認証エラー:', error);

    // エラータイプに基づいて適切なレスポンスを返す
    if (error instanceof Error) {
      // トークン有効期限切れ
      if (error.message.includes('auth/id-token-expired')) {
        const response = ResponseHelper.invalidToken('認証トークンの有効期限が切れています');
        res.status(response.status).json(response);
        return;
      }

      // トークン無効化
      if (error.message.includes('auth/id-token-revoked')) {
        const response = ResponseHelper.invalidToken('認証トークンが無効化されています');
        res.status(response.status).json(response);
        return;
      }

      // 不正なトークン
      if (error.message.includes('auth/invalid-id-token')) {
        const response = ResponseHelper.invalidToken('不正な認証トークンです');
        res.status(response.status).json(response);
        return;
      }

      // ユーザーが無効化されている
      if (error.message.includes('auth/user-disabled')) {
        const response = ResponseHelper.forbidden('このユーザーアカウントは無効化されています');
        res.status(response.status).json(response);
        return;
      }

      // ユーザーが存在しない
      if (error.message.includes('auth/user-not-found')) {
        const response = ResponseHelper.unauthorized('このユーザーは存在しません');
        res.status(response.status).json(response);
        return;
      }

      // トークンフォーマットエラー
      if (error.message.includes('auth/argument-error')) {
        const response = ResponseHelper.invalidToken('トークンの形式が正しくありません');
        res.status(response.status).json(response);
        return;
      }
    }

    // その他の認証エラー
    const response = ResponseHelper.unauthorized('認証に失敗しました');
    res.status(response.status).json(response);
  }
};

/**
 * リクエストにユーザー情報を追加するための型拡張
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string;
        name: string;
        roles?: string[]; // ユーザーロールの配列
      };
    }
  }
}
