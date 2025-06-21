# Record of Cashless Payment API仕様書

## 概要
この文書では、Record of Cashless Payment (RoCP) アプリケーションのAPI仕様を定義します。このAPIはキャッシュレス決済の利用履歴を管理するためのエンドポイントを提供します。

**2025年6月21日統合**: API実装をFirebase Functionsからメインプログラムに完全統合し、パフォーマンスと保守性を向上させました。

## アーキテクチャ概要
- **認証**: Firebase Authentication
- **データベース**: Cloud Firestore
- **通知**: Discord Webhook
- **プラットフォーム**: Express.js (TypeScript)
- **アーキテクチャ**: Clean Architecture（DDD）
- **統合アプローチ**: メインアプリケーションサーバーでAPI提供

## 認証
すべてのAPIリクエストは（ヘルスチェック・モニタリングを除く）、Firebase Authentication経由の認証が必要です。認証済みのユーザーのトークンをAuthorizationヘッダーに含める必要があります。

```
Authorization: Bearer {firebase_auth_token}
```

## レスポンススキーマ
すべてのエンドポイントは以下の形式でJSONレスポンスを返します：

```json
{
  "status": 200,
  "success": true,
  "message": "処理成功メッセージ",
  "data": {
    // レスポンスデータ
  }
}
```

エラー時のレスポンス：

```json
{
  "status": 400,
  "success": false,
  "message": "エラーメッセージ",
  "error": {
    // エラー詳細情報
  }
}
```

## エンドポイント

### ヘルスチェック・モニタリング

#### GET /health
基本的なヘルスチェック。認証は不要です。

**レスポンス**:
```json
{
  "status": "OK",
  "timestamp": "2025-06-21T13:12:02.000Z"
}
```

#### GET /monitoring/health
詳細なサービスヘルスチェック。認証は不要です。

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "Server is running",
  "data": {
    "timestamp": "2025-06-21T13:12:02.000Z"
  }
}
```

#### GET /monitoring/status
サービスステータス詳細情報。認証は不要です。

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "サービスステータスを取得しました",
  "data": {
    "timestamp": "2025-06-21T13:12:02.000Z",
    "services": [
      {
        "name": "FirestoreService",
        "status": "online",
        "message": "正常稼働中",
        "lastUpdated": "2025-06-21T13:12:02.000Z",
        "errorCount": 0
      }
    ]
  }
}
```

#### GET /monitoring/errors
エラーログ履歴。認証は不要です。

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "エラーログを取得しました",
  "data": {
    "timestamp": "2025-06-21T13:12:02.000Z",
    "errors": [
      {
        "timestamp": "2025-06-21T13:10:00.000Z",
        "service": "API",
        "message": "エラーメッセージ",
        "details": {}
      }
    ]
  }
}
```

#### GET /monitoring/dashboard
HTMLダッシュボード。認証は不要です。ブラウザでアクセス可能なモニタリング画面を表示します。

### サービス管理API

#### GET /api/services
利用可能なサービス一覧を取得します。認証が必要です。

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "サービス一覧を取得しました",
  "data": [
    {
      "id": "email-monitoring",
      "name": "メール監視サービス",
      "description": "カード利用通知メールの監視サービス",
      "status": "active",
      "actions": ["start", "stop", "restart"]
    }
  ]
}
```

#### POST /api/services/:id
指定されたサービスを制御します（開始・停止・再起動）。認証が必要です。

**パラメータ**:
- `id`: サービスID（例: email-monitoring）

**リクエストボディ**:
```json
{
  "action": "start" // "start", "stop", "restart"
}
```

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "メール監視サービスを開始しました",
  "data": {
    "id": "email-monitoring",
    "status": "active"
  }
}
```

### カード利用情報API

#### GET /api/card-usages
年月を指定してすべてのカード利用データを取得します。認証が必要です。

**クエリパラメータ**:
- `year` (必須): 年（例: 2025）
- `month` (必須): 月（例: 5）

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "カード利用情報の取得に成功しました",
  "data": [
    {
      "id": "1719838800000",
      "path": "details/2025/05/term1/03/1719838800000",
      "card_name": "楽天カード",
      "datetime_of_use": {"_seconds": 1719838800, "_nanoseconds": 0},
      "amount": 5000,
      "where_to_use": "セブンイレブン 新宿店",
      "memo": "昼食代",
      "is_active": true,
      "created_at": {"_seconds": 1719838800, "_nanoseconds": 0}
    }
  ]
}
```

#### GET /api/card-usages/:id
IDでカード利用データを取得します。認証が必要です。

**パラメータ**:
- `id`: カード利用データのID（タイムスタンプ）

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "カード利用情報の取得に成功しました",
  "data": {
    "id": "1719838800000",
    "path": "details/2025/05/term1/03/1719838800000",
    "card_name": "楽天カード",
    "datetime_of_use": {"_seconds": 1719838800, "_nanoseconds": 0},
    "amount": 5000,
    "where_to_use": "セブンイレブン 新宿店",
    "memo": "昼食代",
    "is_active": true,
    "created_at": {"_seconds": 1719838800, "_nanoseconds": 0}
  }
}
```

#### POST /api/card-usages
新しいカード利用データを作成します。認証が必要です。

**リクエストボディ**:
```json
{
  "card_name": "楽天カード",
  "datetime_of_use": "2025-06-21T10:00:00.000Z",
  "amount": 5000,
  "where_to_use": "セブンイレブン 新宿店",
  "memo": "昼食代"
}
```

**レスポンス**:
```json
{
  "status": 201,
  "success": true,
  "message": "カード利用情報の作成に成功しました",
  "data": {
    "id": "1719838800000",
    "path": "details/2025/05/term1/03/1719838800000",
    "card_name": "楽天カード",
    "datetime_of_use": {"_seconds": 1719838800, "_nanoseconds": 0},
    "amount": 5000,
    "where_to_use": "セブンイレブン 新宿店",
    "memo": "昼食代",
    "is_active": true,
    "created_at": {"_seconds": 1719838800, "_nanoseconds": 0}
  }
}
```

**備考**: 
- 作成時にDiscord通知が自動で送信されます
- `datetime_of_use`はISO8601形式の文字列またはFirestoreタイムスタンプ形式で指定可能
- `is_active`は省略時に`true`が設定されます

#### PUT /api/card-usages/:id
IDでカード利用データを更新します。認証が必要です。

**パラメータ**:
- `id`: カード利用データのID

**リクエストボディ**（部分更新可能）:
```json
{
  "amount": 6000,
  "memo": "修正：夕食代"
}
```

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "カード利用情報の更新に成功しました",
  "data": {
    "id": "1719838800000",
    "path": "details/2025/05/term1/03/1719838800000",
    "card_name": "楽天カード",
    "datetime_of_use": {"_seconds": 1719838800, "_nanoseconds": 0},
    "amount": 6000,
    "where_to_use": "セブンイレブン 新宿店",
    "memo": "修正：夕食代",
    "is_active": true,
    "created_at": {"_seconds": 1719838800, "_nanoseconds": 0}
  }
}
```

#### DELETE /api/card-usages/:id
IDでカード利用データを論理削除します（`is_active`を`false`に設定）。認証が必要です。

**パラメータ**:
- `id`: カード利用データのID

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "カード利用情報の削除に成功しました",
  "data": {
    "id": "1719838800000",
    "path": "details/2025/05/term1/03/1719838800000"
  }
}
```

### レポートAPI

#### GET /api/reports/daily/:year/:month/:day
特定の日の日次レポートを取得します。認証が必要です。

**パラメータ**:
- `year`: 年（例: 2025）
- `month`: 月（例: 5）
- `day`: 日（例: 3）

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "日次レポートを取得しました",
  "data": {
    "total_amount": 15000,
    "card_counts": {
      "楽天カード": 2,
      "イオンカード": 1
    },
    "card_amounts": {
      "楽天カード": 10000,
      "イオンカード": 5000
    }
  }
}
```

#### GET /api/reports/monthly/:year/:month
月次レポートを取得します。認証が必要です。

**パラメータ**:
- `year`: 年（例: 2025）
- `month`: 月（例: 5）

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "月次レポートを取得しました",
  "data": {
    "total_amount": 120000,
    "card_counts": {
      "楽天カード": 12,
      "イオンカード": 8,
      "三井住友カード": 5
    },
    "card_amounts": {
      "楽天カード": 65000,
      "イオンカード": 40000,
      "三井住友カード": 15000
    },
    "weekly_amounts": {
      "term1": 35000,
      "term2": 42000,
      "term3": 25000,
      "term4": 18000
    },
    "daily_amounts": {
      "01": 12000,
      "02": 8000,
      "03": 15000,
      "31": 5000
    }
  }
}
```

#### GET /api/reports/daily/:year/:month
月内の全日次レポートを取得します。認証が必要です。

**パラメータ**:
- `year`: 年（例: 2025）
- `month`: 月（例: 5）

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "月内日次レポート一覧を取得しました",
  "data": [
    {
      "date": "01",
      "total_amount": 12000,
      "card_counts": {
        "楽天カード": 1,
        "イオンカード": 1
      },
      "card_amounts": {
        "楽天カード": 7000,
        "イオンカード": 5000
      }
    },
    {
      "date": "02",
      "total_amount": 8000,
      "card_counts": {
        "楽天カード": 1
      },
      "card_amounts": {
        "楽天カード": 8000
      }
    }
  ]
}
```

#### GET /api/reports/weekly/:year/:month/:term
特定の週次レポートを取得します。認証が必要です。

**パラメータ**:
- `year`: 年（例: 2025）
- `month`: 月（例: 5）
- `term`: 週番号（term1, term2, term3, term4）

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "週次レポートを取得しました",
  "data": {
    "total_amount": 35000,
    "card_counts": {
      "楽天カード": 4,
      "イオンカード": 2
    },
    "card_amounts": {
      "楽天カード": 25000,
      "イオンカード": 10000
    },
    "daily_amounts": {
      "01": 12000,
      "02": 8000,
      "03": 15000
    }
  }
}
```

#### GET /api/reports/weekly/:year/:month
月内の全週次レポートを取得します。認証が必要です。

**パラメータ**:
- `year`: 年（例: 2025）
- `month`: 月（例: 5）

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "月内週次レポート一覧を取得しました",
  "data": [
    {
      "term": "term1",
      "total_amount": 35000,
      "card_counts": {
        "楽天カード": 4,
        "イオンカード": 2
      },
      "card_amounts": {
        "楽天カード": 25000,
        "イオンカード": 10000
      },
      "daily_amounts": {
        "01": 12000,
        "02": 8000,
        "03": 15000
      }
    },
    {
      "term": "term2",
      "total_amount": 42000,
      "card_counts": {
        "楽天カード": 3,
        "イオンカード": 3
      },
      "card_amounts": {
        "楽天カード": 22000,
        "イオンカード": 20000
      },
      "daily_amounts": {
        "08": 10000,
        "09": 12000,
        "10": 20000
      }
    }
  ]
}
```

## エラーコード

| ステータスコード | 説明 |
|--------------|-----|
| 200 | リクエスト成功 |
| 201 | リソース作成成功 |
| 400 | バリデーションエラー |
| 401 | 認証エラー |
| 403 | アクセス権限エラー |
| 404 | リソースが見つからない |
| 500 | サーバーエラー |

## データモデル

### CardUsage
```typescript
interface CardUsage {
  id?: string;               // ドキュメントID（タイムスタンプ）
  path?: string;             // Firestoreパス
  card_name: string;         // カード名
  datetime_of_use: Timestamp; // 利用日時
  amount: number;            // 金額
  where_to_use: string;      // 利用場所
  memo: string;              // メモ
  is_active: boolean;        // アクティブ状態（falseで論理削除）
  created_at: Timestamp;     // 作成日時
}
```

### レポート共通項目
```typescript
interface BaseReport {
  total_amount: number;                // 合計金額
  card_counts: Record<string, number>; // カード別利用回数
  card_amounts: Record<string, number>; // カード別利用金額
}
```

### 日次レポート
```typescript
interface DailyReport extends BaseReport {
  // BaseReportのフィールドのみ
}
```

### 週次レポート
```typescript
interface WeeklyReport extends BaseReport {
  daily_amounts: Record<string, number>; // 日別金額
}
```

### 月次レポート
```typescript
interface MonthlyReport extends BaseReport {
  weekly_amounts: Record<string, number>; // 週別金額（term1, term2, term3, term4）
  daily_amounts: Record<string, number>;  // 日別金額
}
```

### 複数レポート（月内全日次・全週次）
```typescript
interface DailyReportItem extends BaseReport {
  date: string; // 日付（01, 02, ...）
}

interface WeeklyReportItem extends BaseReport {
  term: string; // 週番号（term1, term2, term3, term4）
  daily_amounts: Record<string, number>; // 日別金額
}
```

### サービス情報
```typescript
interface ServiceInfo {
  id: string;           // サービスID
  name: string;         // サービス名
  description: string;  // 説明
  status: 'active' | 'inactive'; // ステータス
  actions: string[];    // 利用可能なアクション
}
```

## API利用例

### カード利用データの取得
```javascript
// 年月指定でのデータ取得
const response = await fetch('/api/card-usages?year=2025&month=6', {
  headers: {
    'Authorization': 'Bearer YOUR_FIREBASE_TOKEN',
    'Content-Type': 'application/json'
  }
});
const result = await response.json();
```

### カード利用データの作成
```javascript
const newCardUsage = {
  card_name: "楽天カード",
  datetime_of_use: "2025-06-21T10:00:00.000Z",
  amount: 5000,
  where_to_use: "セブンイレブン 新宿店",
  memo: "昼食代"
};

const response = await fetch('/api/card-usages', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_FIREBASE_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(newCardUsage)
});
const result = await response.json();
```

### 月次レポートの取得
```javascript
const response = await fetch('/api/reports/monthly/2025/6', {
  headers: {
    'Authorization': 'Bearer YOUR_FIREBASE_TOKEN',
    'Content-Type': 'application/json'
  }
});
const report = await response.json();
```

### 週次レポートの取得（特定の週）
```javascript
const response = await fetch('/api/reports/weekly/2025/6/term2', {
  headers: {
    'Authorization': 'Bearer YOUR_FIREBASE_TOKEN',
    'Content-Type': 'application/json'
  }
});
const report = await response.json();
```

### 月内全日次レポートの取得
```javascript
const response = await fetch('/api/reports/daily/2025/6', {
  headers: {
    'Authorization': 'Bearer YOUR_FIREBASE_TOKEN',
    'Content-Type': 'application/json'
  }
});
const reports = await response.json();
```

### サービスの制御（メール監視の開始）
```javascript
const response = await fetch('/api/services/email-monitoring', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_FIREBASE_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ action: 'start' })
});
const result = await response.json();
```

## 実装詳細

### アーキテクチャパターン
- **Clean Architecture**: ドメイン駆動設計（DDD）
- **依存性注入**: コントローラーレベルでの依存関係管理
- **レイヤー分離**: プレゼンテーション、ユースケース、ドメイン、インフラストラクチャ

### セキュリティ
- Firebase Authentication による認証
- CORS設定済み
- リクエストログ機能

### 通知機能
- Discord Webhook による自動通知
- カード利用情報作成時に自動送信

### モニタリング
- サービスステータス監視
- エラーログ収集
- HTMLダッシュボード提供

### データベース構造
```
details/
  └── {year}/
      └── {month}/
          └── {term}/
              └── {day}/
                  └── {timestamp}/ (CardUsage document)

reports/
  ├── daily/{year}/{month}/{day}
  ├── weekly/{year}/week_{weekNumber}
  └── monthly/{year}/{month}
```

---

**更新履歴**: 
- 2025年6月21日: API実装をFunctionsからメインプログラムに統合
- モニタリング、サービス管理、カード利用情報、レポートAPIを統合実装
- 依存性注入パターンによるコントローラー管理を導入

この仕様書で定義されるAPIは、RoCPアプリケーションのバックエンドとして動作し、フロントエンドアプリケーションとの連携に使用されます。