/**
 * インテグレーションテスト用の設定
 * 実際のFirestoreエミュレータまたはテスト用データベースとの接続を行う
 */

// テスト環境の設定
process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8100';

// Firebase Admin初期化用のモック認証
process.env.FIREBASE_ADMIN_KEY_PATH = './firebase-admin-key.json';

// Logger出力を抑制
const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// Loggerをモック化
jest.mock('../../shared/infrastructure/logging/Logger', () => ({
    logger
}));

export { logger };
