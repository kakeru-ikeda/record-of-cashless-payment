# Firestoreデータクローンスクリプト使用ガイド

## 概要

本番FirestoreからエミュレーターFirestoreへデータをクローンするためのスクリプトです。開発・テスト環境で本番に近いデータを使用して機能をテストできます。

## スクリプトの場所

```
scripts/clone-firestore-data.ts
```

## 基本使用方法

### 1. 全コレクションクローン

```bash
npx ts-node scripts/clone-firestore-data.ts
```

### 2. 特定コレクションのみクローン

```bash
# reportsコレクションのみ
npx ts-node scripts/clone-firestore-data.ts --collections=reports

# detailsコレクションのみ  
npx ts-node scripts/clone-firestore-data.ts --collections=details

# 複数指定
npx ts-node scripts/clone-firestore-data.ts --collections=reports,details
```

### 3. ドライラン（実際の書き込みなし）

```bash
npx ts-node scripts/clone-firestore-data.ts --collections=reports --dry-run
```

### 4. エミュレーターデータクリア

```bash
npx ts-node scripts/clone-firestore-data.ts --clear --collections=reports
```

### 5. Firestore構造探索

```bash
# 本番Firestoreの構造を調査
npx ts-node scripts/clone-firestore-data.ts --explore
```

### 6. 接続テスト

```bash
npx ts-node scripts/clone-firestore-data.ts --test-connection
```

## オプション詳細

| オプション | 説明 | 例 |
|-----------|------|-----|
| `--collections=<list>` | クローン対象コレクションを指定 | `--collections=reports,details` |
| `--dry-run` | 実際の書き込みを行わず、処理内容のみ表示 | `--dry-run` |
| `--clear` | 実行前にエミュレーターのデータをクリア | `--clear` |
| `--explore` | 本番Firestoreの構造を探索・表示 | `--explore` |
| `--test-connection` | 本番・エミュレーター接続テストのみ実行 | `--test-connection` |

## 設定

### プロジェクト設定

```typescript
const options: CloneOptions = {
    sourceProject: 'mufg-usage-details-mailbot', // 本番プロジェクトID
    targetEmulator: true,
    targetEmulatorHost: '127.0.0.1',
    targetEmulatorPort: 8100,
    collections,
    dryRun
};
```

### 認証設定

本番Firestoreへのアクセスには以下のファイルが必要です：

```
firebase-admin-key.json  # プロジェクトルートに配置
```

## 対応データ構造

### details階層

```
details/{year}/{month}/term{term}/{day}/{timestamp}
```

**例**: `details/2025/06/term4/22/1750576022873`

### reports階層

```
reports/{reportType}/{year-month}/{documentId}
```

**例**: 
- `reports/weekly/2025-06/term4`
- `reports/daily/2025-06/22`
- `reports/monthly/2025/06`

## 実行例とログ

### 成功例

```bash
$ npx ts-node scripts/clone-firestore-data.ts --collections=reports

🔗 Firebase Admin SDK インスタンスを初期化しました
📤 ソース: mufg-usage-details-mailbot (本番)
📥 ターゲット: エミュレーター (127.0.0.1:8100)
🚀 Firestoreデータクローンを開始します
⚙️  設定: {
  sourceProject: 'mufg-usage-details-mailbot',
  targetEmulator: '127.0.0.1:8100',
  collections: [ 'reports' ],
  dryRun: 'いいえ',
  clearFirst: 'いいえ',
  testConnection: 'いいえ',
  exploreStructure: 'いいえ'
}
📋 クローン対象コレクション: reports
📂 reports階層をクローン中...
📊 weeklyレポート階層を処理中...
🔍 パス確認: reports/weekly/2025-06
📊 reports/weekly/2025-06: 4 ドキュメント発見
💾 reports/weekly/2025-06 の 4 ドキュメントを書き込みました
✅ 全てのコレクションのクローンが完了しました
🎉 Firestoreデータクローンが正常に完了しました
```

### ドライラン例

```bash
$ npx ts-node scripts/clone-firestore-data.ts --collections=reports --dry-run

🔍 ドライランモード: 実際の書き込みは行いません
📊 weeklyレポート階層を処理中...
🔍 パス確認: reports/weekly/2025-06
📊 reports/weekly/2025-06: 4 ドキュメント発見
🔍 [ドライラン] reports/weekly/2025-06/term1 (11 フィールド)
🔍 [ドライラン] reports/weekly/2025-06/term2 (11 フィールド)
🔍 [ドライラン] reports/weekly/2025-06/term3 (11 フィールド)
🔍 [ドライラン] reports/weekly/2025-06/term4 (11 フィールド)
```

### 構造探索例

```bash
$ npx ts-node scripts/clone-firestore-data.ts --explore

🔍 Firestoreの構造を探索中...
📋 既知のパス構造を確認中...
🔍 パス確認: reports/weekly/2025-06
  📊 reports/weekly/2025-06: 4 ドキュメント
    📄 term1
    📄 term2
    📄 term3
    📄 term4
```

## トラブルシューティング

### 認証エラー

**症状**: 
```
Error: Could not load the default credentials
```

**対処法**:
1. `firebase-admin-key.json` がプロジェクトルートに存在するか確認
2. ファイルの権限を確認
3. サービスアカウントにFirestore権限があるか確認

### エミュレーター接続エラー

**症状**:
```
Error: connect ECONNREFUSED 127.0.0.1:8100
```

**対処法**:
1. Firestoreエミュレーターが起動しているか確認
```bash
firebase emulators:start --only firestore
```

2. ポート8100が使用中でないか確認
```bash
lsof -i :8100
```

### データが表示されない

**原因**:
- Cloud Functionsとクローンスクリプトで異なるプロジェクトIDを使用している

**対処法**:
1. クローンスクリプトの設定を確認
```typescript
projectId: this.options.sourceProject // 本番と同じプロジェクトIDを使用
```

2. エミュレーターの `singleProjectMode` が有効か確認
```json
{
  "emulators": {
    "singleProjectMode": true
  }
}
```

## 制限事項

1. **バッチサイズ**: Firestoreの制限により、一度に500ドキュメントまでバッチ書き込み
2. **ネットワーク**: 本番Firestoreへのネットワークアクセスが必要
3. **権限**: 本番Firestoreの読み取り権限が必要
4. **データサイズ**: 大量データのクローンには時間がかかる場合がある

## パフォーマンス最適化

### バッチ処理

大量のドキュメントがある場合、バッチサイズを調整できます：

```typescript
const batchSize = 500; // デフォルト値
```

### 並列処理

階層ごとに並列でクローンを実行し、処理時間を短縮しています。

## セキュリティ

1. **認証情報**: `firebase-admin-key.json` は Git 管理対象外
2. **ネットワーク**: 本番環境への読み取り専用アクセス
3. **データ範囲**: 明示的に指定したコレクションのみクローン

## 関連ファイル

- **メインスクリプト**: `scripts/clone-firestore-data.ts`
- **Firebase設定**: `firebase.json`
- **認証ファイル**: `firebase-admin-key.json`（要手動配置）
- **エミュレーター設定**: `functions/.env`

## 参考

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Firestore Emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore)
- [Firebase Service Accounts](https://firebase.google.com/docs/admin/setup#initialize-sdk)
