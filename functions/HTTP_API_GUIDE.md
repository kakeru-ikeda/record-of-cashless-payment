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

### 3. ヘルスチェック

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

## 開発・デバッグ用途

- **手動テスト**: 特定の処理を手動でトリガーしたい場合
- **データ検証**: 処理結果を直接確認したい場合
- **パフォーマンス測定**: 処理時間を測定したい場合
- **エラー再現**: 特定の条件でエラーを再現したい場合
