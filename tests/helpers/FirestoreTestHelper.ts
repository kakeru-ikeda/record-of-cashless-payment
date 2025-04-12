import * as admin from 'firebase-admin';
import { Firestore, DocumentReference, DocumentSnapshot, Timestamp } from 'firebase-admin/firestore';
import { CardUsage } from '../../src/domain/entities/CardUsage';

// インメモリのドキュメントストア（モック用）
const mockDocumentStore: { [path: string]: any } = {};

// firebase-adminのモック
jest.mock('firebase-admin', () => {
  const apps = [];
  const firestoreInstance = {
    doc: (path: string) => createMockDocumentReference(path),
    collection: (path: string) => ({
      doc: (id: string) => createMockDocumentReference(`${path}/${id}`),
    }),
  };

  return {
    apps,
    initializeApp: jest.fn(() => {
      apps.push({});
      return {};
    }),
    credential: {
      cert: jest.fn(() => ({})),
    },
    firestore: jest.fn(() => firestoreInstance),  // 関数として明示的に定義
  };
});

// Firestoreタイムスタンプのモック化ヘルパー
export const mockTimestamp = (date: Date): Timestamp => {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
    isEqual: (other: Timestamp) => other.toMillis() === date.getTime(),
    valueOf: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: (date.getTime() % 1000) * 1000000,
  } as unknown as Timestamp;
};

/**
 * モックのドキュメントリファレンスを生成する
 * @param path ドキュメントパス
 * @returns モックドキュメントリファレンス
 */
const createMockDocumentReference = (path: string): DocumentReference => {
  return {
    path,
    id: path.split('/').pop() || '',
    set: jest.fn((data) => {
      mockDocumentStore[path] = { ...data };
      return Promise.resolve();
    }),
    get: jest.fn(() => {
      const data = mockDocumentStore[path];
      return Promise.resolve({
        exists: !!data,
        data: () => data,
        id: path.split('/').pop() || '',
      } as DocumentSnapshot);
    }),
    update: jest.fn((data) => {
      mockDocumentStore[path] = { ...(mockDocumentStore[path] || {}), ...data };
      return Promise.resolve();
    }),
    delete: jest.fn(() => {
      delete mockDocumentStore[path];
      return Promise.resolve();
    }),
  } as unknown as DocumentReference;
};

/**
 * テスト用のカード利用情報を生成する
 * @param overrides 上書きしたいプロパティ
 * @returns カード利用情報オブジェクト
 */
export function createMockCardUsage(overrides?: Partial<CardUsage>): CardUsage {
  const now = new Date();

  return {
    card_name: 'テストカード',
    datetime_of_use: mockTimestamp(now),
    amount: 1000,
    where_to_use: 'テスト店舗',
    created_at: mockTimestamp(now),
    ...overrides,
  };
}

/**
 * テスト開始前のセットアップ
 */
export function setupFirestoreMock(): void {
  jest.clearAllMocks();
  // モックデータストアをクリア
  Object.keys(mockDocumentStore).forEach(key => delete mockDocumentStore[key]);
}

/**
 * テスト終了後のクリーンアップ
 */
export function teardownFirestoreMock(): void {
  jest.clearAllMocks();
  // モックデータストアをクリア
  Object.keys(mockDocumentStore).forEach(key => delete mockDocumentStore[key]);
}

/**
 * モックアップされた Firestore インスタンスを取得する
 * @returns Firestore のモックインスタンス
 */
export function getMockFirestore(): Firestore {
  return admin.firestore() as unknown as Firestore;
}

/**
 * Firestore に格納されているドキュメントを取得する
 * @param path ドキュメントパス
 * @returns ドキュメントデータ (存在しない場合は undefined)
 */
export function getMockDocument(path: string): any {
  return mockDocumentStore[path];
}

/**
 * モックファイルシステムをセットアップする
 * @param mockFiles モックファイルのパスと内容のマップ
 */
export function setupMockFileSystem(mockFiles: { [path: string]: string }): void {
  const fs = require('fs');
  jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn((path: string) => !!mockFiles[path]),
    readFileSync: jest.fn((path: string, encoding: string) => {
      if (!mockFiles[path]) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }
      return mockFiles[path];
    }),
  }));
}

