# Functions HTTP API 使用ガイド

## 概要

Firebase Cloud Functionsの処理をHTTP経由で実行できるようになりました。これにより、開発時のテストやデバッグが容易になります。

## 利用可能なエンドポイント

### 1. Firestoreドキュメント処理

**エンドポイント:** `POST /process-firestore-document`

FirestoreDocumentCreatedHandlerと同じ処理をHTTP経由で実行します。

**リクエスト例:**
```bash
curl -X POST https://asia-northeast1-{project-id}.cloudfunctions.net/api/process-firestore-document \
  -H "Content-Type: application/json" \
  -d '{
    "path": "details/2024/01/01/01/1234567890",
    "data": {
      "amount": 1000,
      "description": "テスト購入"
    }
  }'
```

**レスポンス例:**
```json
{
  "status": 200,
  "success": true,
  "message": "全てのレポート処理が完了しました",
  "data": {
    "dailyReport": {
      "totalAmount": 2000,
      "totalCount": 2,
      "lastUpdated": {
        "_seconds": 1751103971,
        "_nanoseconds": 41000000
      },
      "lastUpdatedBy": "system",
      "documentIdList": [
        "details/2024/01/01/01/1234567890",
        "details/2024/01/01/01/1234567890"
      ],
      "date": {
        "_seconds": 1704067200,
        "_nanoseconds": 0
      },
      "hasNotified": false
    },
    "weeklyReport": {
      "totalAmount": 2000,
      "totalCount": 2,
      // 他のフィールド...
    },
    "monthlyReport": {
      "totalAmount": 2000,
      "totalCount": 2,
      // 他のフィールド...
    }
  }
}
```

### 2. 日次レポートスケジュール処理

**エンドポイント:** `POST /daily-report-schedule`

DailyReportScheduleHandlerと同じ処理をHTTP経由で実行します。

**リクエスト例:**
```bash
curl -X POST https://asia-northeast1-{project-id}.cloudfunctions.net/api/daily-report-schedule \
  -H "Content-Type: application/json"
```

**レスポンス例:**
```json
{
  "status": 200,
  "success": true,
  "message": "スケジュール配信処理が完了しました",
  "data": {
    "timestamp": "2025-06-28T09:46:40.196Z"
  }
}
```

### 3. 週次レポート送信

**エンドポイント:** `POST /send-weekly-report`

週次レポートの送信処理をHTTP経由で実行します。

**リクエスト例:**
```bash
curl -X POST https://asia-northeast1-{project-id}.cloudfunctions.net/api/send-weekly-report \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2024,
    "month": 6,
    "day": 28
  }'
```

### 4. レポート再集計

**エンドポイント:** `POST /recalculate-reports`

Firestoreのdetailsデータを探索して、Daily/Weekly/Monthlyレポートを再生成します。

**リクエスト例:**
```bash
# 基本的な再集計（過去7日間）
curl -X POST https://asia-northeast1-{project-id}.cloudfunctions.net/api/recalculate-reports \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-06-01",
    "endDate": "2024-06-07"
  }'

# ドライラン（処理内容を確認するだけ）
curl -X POST https://asia-northeast1-{project-id}.cloudfunctions.net/api/recalculate-reports \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-06-01",
    "endDate": "2024-06-07",
    "dryRun": true
  }'

# 特定のレポートタイプのみ再集計
curl -X POST https://asia-northeast1-{project-id}.cloudfunctions.net/api/recalculate-reports \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-06-01",
    "endDate": "2024-06-07",
    "reportTypes": ["daily", "weekly"],
    "executedBy": "admin-user"
  }'
```

**リクエストパラメータ:**
- `startDate` (必須): 処理開始日 (YYYY-MM-DD形式)
- `endDate` (必須): 処理終了日 (YYYY-MM-DD形式)
- `reportTypes` (オプション): 再集計対象 `["daily", "weekly", "monthly"]` (デフォルト: 全て)
- `executedBy` (オプション): 実行者名 (デフォルト: "http-api")
- `dryRun` (オプション): ドライラン実行 (デフォルト: false)

**レスポンス例:**
```json
{
  "status": 200,
  "success": true,
  "message": "レポート再集計が完了しました",
  "data": {
    "startTime": "2024-06-28T12:00:00.000Z",
    "endTime": "2024-06-28T12:05:30.000Z",
    "totalCardUsageProcessed": 150,
    "reportsCreated": {
      "daily": 7,
      "weekly": 2,
      "monthly": 1
    },
    "reportsUpdated": {
      "daily": 0,
      "weekly": 0,
      "monthly": 0
    },
    "errors": [],
    "success": true,
    "executedBy": "http-api",
    "dryRun": false
  }
}
```

### 5. ヘルスチェック

**エンドポイント:** `GET /health`

API の稼働状況を確認できます。

**リクエスト例:**
```bash
curl https://asia-northeast1-{project-id}.cloudfunctions.net/api/health
```

**レスポンス例:**
```json
{
  "success": true,
  "message": "Functions API is healthy",
  "timestamp": "2024-06-28T12:00:00.000Z"
}
```

## ローカル開発時の使用方法

Firebase Emulatorを使用してローカルで実行する場合：

```bash
# Functions エミュレーターを起動
npm run serve

# エンドポイントを呼び出し
curl -X POST http://localhost:5001/{project-id}/asia-northeast1/api/process-firestore-document \
  -H "Content-Type: application/json" \
  -d '{
    "path": "details/2024/01/01/01/1234567890",
    "data": {
      "amount": 1000,
      "description": "テスト購入"
    }
  }'
```

## 注意事項

1. **認証**: 現在は認証なしでアクセス可能です。本番環境では適切な認証を実装してください。
2. **レート制限**: Firebase Functionsのレート制限に注意してください。
3. **エラーハンドリング**: エラーが発生した場合、500ステータスコードとエラー詳細が返されます。
4. **ログ**: すべてのリクエストはFirebase Functionsのログに記録されます。
5. **レポート再集計の制限**: 
   - 処理期間は90日以内に制限されています
   - 大量のデータを処理する場合は時間がかかる可能性があります
   - ドライランで処理内容を事前確認することをお勧めします

## 開発・デバッグ用途

- **手動テスト**: 特定の処理を手動でトリガーしたい場合
- **データ検証**: 処理結果を直接確認したい場合
- **パフォーマンス測定**: 処理時間を測定したい場合
- **エラー再現**: 特定の条件でエラーを再現したい場合
- **レポート整合性確保**: データの不整合が発生した場合の修復
