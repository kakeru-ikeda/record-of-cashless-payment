# テスト戦略・環境構築ガイド

## 概要

本プロジェクトにおけるテスト環境の構築方法と、各種テストの実行方法を説明します。

## テスト環境の種類

### 1. 単体テスト (Unit Tests)
- **場所**: `tests/unit/`
- **対象**: `src/` と `shared/` の個別コンポーネント
- **特徴**: モックを使用した高速テスト

### 2. 統合テスト (Integration Tests)  
- **場所**: `tests/integration/`
- **対象**: 複数コンポーネント間の連携
- **特徴**: エミュレーターを使用した実環境テスト

### 3. API テスト
- **対象**: Cloud Functions のHTTPエンドポイント
- **特徴**: エミュレーター + クローンデータでのテスト

## エミュレーター環境構築

### 必要なエミュレーター

```bash
# 全エミュレーター起動
firebase emulators:start

# 個別起動
firebase emulators:start --only functions,firestore
firebase emulators:start --only firestore
```

### エミュレーター構成

| サービス | ポート | 用途 |
|----------|--------|------|
| Functions | 5002 | Cloud Functions API |
| Firestore | 8100 | データベース |
| UI | 4002 | 管理画面 |
| Hub | 4402 | エミュレーター管理 |

## データ準備

### 1. 本番データクローン

```bash
# 基本クローン
npx ts-node scripts/clone-firestore-data.ts --collections=reports

# エミュレーターリセット後クローン
npx ts-node scripts/clone-firestore-data.ts --clear --collections=reports

# 詳細データも含める
npx ts-node scripts/clone-firestore-data.ts --collections=reports,details
```

### 2. テスト用データ生成

```bash
# テスト用データセット作成（将来実装予定）
npm run create-test-data
```

## API テスト実行方法

### 週次レポート送信テスト

```bash
# 基本テスト
curl -X POST "http://127.0.0.1:5002/mufg-usage-details-mailbot/asia-northeast1/api/send-weekly-report" \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 6, "day": 10}'

# 複数週のテスト
for day in 3 10 17 24; do
  curl -X POST "http://127.0.0.1:5002/mufg-usage-details-mailbot/asia-northeast1/api/send-weekly-report" \
    -H "Content-Type: application/json" \
    -d "{\"year\": 2025, \"month\": 6, \"day\": $day}"
  echo ""
done
```

### 日次レポートスケジュール テスト

```bash
curl -X POST "http://127.0.0.1:5002/mufg-usage-details-mailbot/asia-northeast1/api/daily-report-schedule" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### ヘルスチェック

```bash
curl "http://127.0.0.1:5002/mufg-usage-details-mailbot/asia-northeast1/api/health"
```

## 単体テスト実行

### 全テスト実行

```bash
npm test
```

### 特定テスト実行

```bash
# shared コンポーネントのテスト
npm test -- tests/unit/shared

# 特定ファイルのテスト
npm test -- tests/unit/shared/utils/DateUtil.test.ts
```

### カバレッジ測定

```bash
npm run test:coverage
```

## 統合テスト実行

### 前提条件

1. エミュレーターが起動していること
2. テストデータがセットアップされていること

### 実行方法

```bash
# 統合テスト実行
npm run test:integration

# 特定の統合テスト
npm run test:integration -- --testNamePattern="Weekly Report"
```

## CI/CD での自動テスト

### GitHub Actions 設定例

```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      # エミュレーター起動
      - name: Start Firebase Emulators
        run: |
          npm install -g firebase-tools
          firebase emulators:start --only firestore &
          
      # テスト実行
      - name: Run Tests
        run: |
          npm test
          npm run test:integration
```

## テストデータ管理

### テストデータセット

| データセット | 用途 | 期間 |
|-------------|------|------|
| `2025-04` | 基本機能テスト | 2025年4月 |
| `2025-06` | 週次レポートテスト | 2025年6月 |
| `edge-cases` | エッジケーステスト | 各月末・年末 |

### データ更新方針

1. **本番データクローン**: 最新データでの動作確認
2. **固定テストデータ**: 予測可能な結果での自動テスト
3. **エッジケースデータ**: 境界値・異常系テスト

## モックとスタブ

### Discord通知のモック

```typescript
// tests/unit/mocks/DiscordNotifier.mock.ts
export const mockDiscordNotifier = {
  sendMessage: jest.fn().mockResolvedValue(true),
  sendWeeklyReport: jest.fn().mockResolvedValue(true)
};
```

### Firestore のモック

```typescript
// tests/unit/mocks/Firestore.mock.ts
export const mockFirestore = {
  collection: jest.fn(),
  doc: jest.fn(),
  get: jest.fn(),
  set: jest.fn()
};
```

## デバッグ方法

### ログレベル設定

```typescript
// 開発環境でのログレベル設定
process.env.LOG_LEVEL = 'debug';
```

### エミュレーターデバッグ

```bash
# デバッグモードでエミュレーター起動
firebase emulators:start --debug

# ログファイル確認
tail -f firestore-debug.log
```

### Cloud Functions デバッグ

```bash
# ローカルデバッグ
npm run serve -- --inspect

# VSCode デバッガー接続
# launch.json 設定が必要
```

## パフォーマンステスト

### 負荷テスト

```bash
# Apache Bench を使用した負荷テスト
ab -n 100 -c 10 http://127.0.0.1:5002/mufg-usage-details-mailbot/asia-northeast1/api/health

# より複雑な負荷テスト
npx artillery quick --count 10 --num 5 http://127.0.0.1:5002/mufg-usage-details-mailbot/asia-northeast1/api/health
```

### メモリ・CPU監視

```bash
# Node.js プロセス監視
npm install -g clinic
clinic doctor -- node functions/lib/index.js
```

## トラブルシューティング

### よくある問題

1. **エミュレーター接続エラー**
   - ポート競合の確認
   - プロセス残存の確認

2. **認証エラー**
   - サービスアカウントキーの確認
   - 権限設定の確認

3. **テストデータ不整合**
   - エミュレーターリセット
   - データ再クローン

### デバッグチェックリスト

- [ ] エミュレーターが起動しているか
- [ ] 正しいポートに接続しているか
- [ ] テストデータが存在するか
- [ ] 認証情報が正しく設定されているか
- [ ] 環境変数が適切に設定されているか

## ベストプラクティス

### テスト作成

1. **AAA パターン**: Arrange, Act, Assert
2. **独立性**: テスト間で状態を共有しない
3. **再現性**: 何度実行しても同じ結果
4. **高速性**: 単体テストは高速に実行

### データ管理

1. **クリーンアップ**: テスト後のデータ削除
2. **分離**: 本番データへの影響防止
3. **バージョン管理**: テストデータの変更履歴

### CI/CD

1. **自動化**: プッシュ時の自動テスト実行
2. **早期検出**: 問題の早期発見
3. **品質ゲート**: テスト失敗時のデプロイ停止

## 関連ドキュメント

- [週次レポート送信APIテストガイド](./weekly-report-api-testing.md)
- [Firestoreデータクローンスクリプト使用ガイド](../scripts/firestore-clone-guide.md)
- [Firebase Emulator Suite Documentation](https://firebase.google.com/docs/emulator-suite)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
