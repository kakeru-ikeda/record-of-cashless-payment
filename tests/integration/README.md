# インテグレーションテスト

このプロジェクトでは、ユースケースとリポジトリの連携を確認するためのインテグレーションテストを実装しています。

## テスト構成

### 1. モックリポジトリを使用したテスト
- `tests/integration/usecases/FirestoreReportUseCase.integration.test.ts`
- モックリポジトリ（MockReportRepository）を使用してビジネスロジックをテスト
- 実際のデータベース接続は不要

### 2. 実際のリポジトリを使用したテスト
- `tests/integration/infrastructure/FirestoreReportRepository.integration.test.ts`
- 実際のFirestoreRepositoryを使用
- データベース接続やパス生成などの動作を確認

## テスト実行方法

### 基本的なインテグレーションテスト
```bash
# インテグレーションテストのみ実行
npm run test:integration

# カバレッジ付きでインテグレーションテスト実行
npm run test:integration:coverage

# すべてのテスト（ユニット + インテグレーション）を実行
npm run test:all
```

### Firestoreエミュレータを使用したテスト
実際のFirestore操作をテストする場合は、事前にFirestoreエミュレータを起動してください：

```bash
# Firebaseエミュレータを起動
firebase emulators:start --only firestore

# 別のターミナルでテスト実行
npm run test:integration
```

## テストケース

### FirestoreReportUseCase Integration Tests
- 日次レポート取得
- 週次レポート取得  
- 月次レポート取得
- 月内の日次レポート一覧取得
- 月内の週次レポート一覧取得
- レポート作成（日次・週次・月次）
- レポート更新
- レポート作成または更新（upsert）
- エラーハンドリング

### FirestoreReportRepository Integration Tests
- Repository初期化
- 日付バリデーション
- CRUD操作（存在しないデータの場合）
- Usecase経由での操作
- FirestorePathUtilとの連携
- エラーハンドリング
- 実際のFirestore操作（スキップされているテスト）

## テストファイル構成

```
tests/
├── integration/
│   ├── integration.setup.ts              # インテグレーションテスト用設定
│   ├── mocks/
│   │   └── MockReportRepository.ts       # モックリポジトリ
│   ├── usecases/
│   │   └── FirestoreReportUseCase.integration.test.ts
│   └── infrastructure/
│       └── FirestoreReportRepository.integration.test.ts
└── ...
```

## 注意事項

1. **モックテスト**: データベース接続不要で高速実行
2. **実際のリポジトリテスト**: Firestoreエミュレータまたは実際のFirestoreが必要
3. **スキップされたテスト**: `describe.skip`でマークされたテストは実際のFirestore操作が必要
4. **タイムアウト**: インテグレーションテストは30秒のタイムアウトを設定

## エラー対応

### よくあるエラー
- **Repository not initialized**: リポジトリが初期化されていない場合
- **バリデーションエラー**: 不正な日付形式や範囲外の値
- **FirestoreError**: Firestoreエミュレータが起動していない場合

### デバッグ方法
```bash
# 詳細ログ付きでテスト実行
DEBUG=* npm run test:integration

# 特定のテストファイルのみ実行
npx jest tests/integration/usecases/FirestoreReportUseCase.integration.test.ts
```
