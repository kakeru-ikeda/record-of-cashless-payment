import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

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
      name: 'Test User'
    };
    next();
    return;
  }

  try {
    // ヘッダーからトークンを取得
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: '認証ヘッダーがありません',
        data: null
      });
      return;
    }

    // ヘッダー形式を確認 (Bearer token)
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        success: false,
        message: '認証ヘッダーの形式が無効です',
        data: null
      });
      return;
    }

    const token = parts[1];

    // Firebaseでトークンを検証
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // ユーザー情報をリクエストに設定
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      name: decodedToken.name || ''
    };
    
    // 処理を続行
    next();
  } catch (error) {
    console.error('認証エラー:', error);
    res.status(401).json({
      success: false,
      message: '無効なトークンです',
      data: null
    });
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
      };
    }
  }
}