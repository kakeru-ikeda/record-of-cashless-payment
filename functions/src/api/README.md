# Record of Cashless Payment API仕様書

## 概要
この文書では、Record of Cashless Payment (RoCP) アプリケーションのAPI仕様を定義します。このAPIはキャッシュレス決済の利用履歴を管理するためのエンドポイントを提供します。

## ベースURL
```
https://api-wxn2tlzhia-an.a.run.app/api/v1
```

## 認証
すべてのAPIリクエストは（ヘルスチェックを除く）、Firebase Authentication経由の認証が必要です。認証済みのユーザーのトークンをAuthorizationヘッダーに含める必要があります。

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

### ヘルスチェック

#### GET /api/health
APIが正常に動作しているかを確認します。認証は不要です。

**レスポンス**:
```json
{
  "status": "ok",
  "message": "API is running",
  "timestamp": "2025-05-03T09:00:00.000Z"
}
```

### カード利用情報API

#### GET /api/v1/card-usages
年月を指定してすべてのカード利用データを取得します。

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
      "id": "1714713600000",
      "path": "details/2025/05/term1/03/1714713600000",
      "card_name": "カード名",
      "datetime_of_use": {"_seconds": 1714713600, "_nanoseconds": 0},
      "amount": 5000,
      "where_to_use": "利用店舗",
      "memo": "メモ",
      "is_active": true,
      "created_at": {"_seconds": 1714713600, "_nanoseconds": 0}
    }
  ]
}
```

#### GET /api/v1/card-usages/:id
IDでカード利用データを取得します。

**パラメータ**:
- `id`: カード利用データのID

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "カード利用情報の取得に成功しました",
  "data": {
    "id": "1714713600000",
    "path": "details/2025/05/term1/03/1714713600000",
    "card_name": "カード名",
    "datetime_of_use": {"_seconds": 1714713600, "_nanoseconds": 0},
    "amount": 5000,
    "where_to_use": "利用店舗",
    "memo": "メモ",
    "is_active": true,
    "created_at": {"_seconds": 1714713600, "_nanoseconds": 0}
  }
}
```

#### POST /api/v1/card-usages
新しいカード利用データを作成します。

**リクエストボディ**:
```json
{
  "card_name": "カード名",
  "datetime_of_use": "2025-05-03T10:00:00.000Z", // ISO8601形式の日付文字列
  "amount": 5000,
  "where_to_use": "利用店舗",
  "memo": "メモ"
}
```

**レスポンス**:
```json
{
  "status": 201,
  "success": true,
  "message": "カード利用情報の作成に成功しました",
  "data": {
    "id": "1714713600000",
    "path": "details/2025/05/term1/03/1714713600000",
    "card_name": "カード名",
    "datetime_of_use": {"_seconds": 1714713600, "_nanoseconds": 0},
    "amount": 5000,
    "where_to_use": "利用店舗",
    "memo": "メモ",
    "is_active": true,
    "created_at": {"_seconds": 1714713600, "_nanoseconds": 0}
  }
}
```

#### PUT /api/v1/card-usages/:id
IDでカード利用データを更新します。

**パラメータ**:
- `id`: カード利用データのID

**リクエストボディ**:
```json
{
  "amount": 6000,
  "memo": "更新されたメモ"
}
```

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "カード利用情報の更新に成功しました",
  "data": {
    "id": "1714713600000",
    "path": "details/2025/05/term1/03/1714713600000",
    "card_name": "カード名",
    "datetime_of_use": {"_seconds": 1714713600, "_nanoseconds": 0},
    "amount": 6000,
    "where_to_use": "利用店舗",
    "memo": "更新されたメモ",
    "is_active": true,
    "created_at": {"_seconds": 1714713600, "_nanoseconds": 0}
  }
}
```

#### DELETE /api/v1/card-usages/:id
IDでカード利用データを論理削除します（`is_active`を`false`に設定）。

**パラメータ**:
- `id`: カード利用データのID

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "カード利用情報の削除に成功しました",
  "data": {
    "id": "1714713600000",
    "path": "details/2025/05/term1/03/1714713600000"
  }
}
```

### レポートAPI

#### GET /api/v1/reports/daily/:year/:month/:day
特定の日の日次レポートを取得します。

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
      "カード名A": 2,
      "カード名B": 1
    },
    "card_amounts": {
      "カード名A": 10000,
      "カード名B": 5000
    }
  }
}
```

#### GET /api/v1/reports/daily/:year/:month
月内の全ての日次レポートを取得します。

**パラメータ**:
- `year`: 年（例: 2025）
- `month`: 月（例: 5）

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "2025年5月の日次レポートを取得しました",
  "data": {
    "01": {
      "total_amount": 12000,
      "card_counts": {"カード名A": 1, "カード名B": 1},
      "card_amounts": {"カード名A": 7000, "カード名B": 5000}
    },
    "02": {
      "total_amount": 8000,
      "card_counts": {"カード名A": 1},
      "card_amounts": {"カード名A": 8000}
    },
    "03": {
      "total_amount": 15000,
      "card_counts": {"カード名A": 2, "カード名B": 1},
      "card_amounts": {"カード名A": 10000, "カード名B": 5000}
    }
  }
}
```

#### GET /api/v1/reports/weekly/:year/:month/:term
特定の週の週次レポートを取得します。

**パラメータ**:
- `year`: 年（例: 2025）
- `month`: 月（例: 5）
- `term`: 週（例: term1）

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "週次レポートを取得しました",
  "data": {
    "total_amount": 35000,
    "card_counts": {
      "カード名A": 4,
      "カード名B": 2
    },
    "card_amounts": {
      "カード名A": 25000,
      "カード名B": 10000
    },
    "daily_amounts": {
      "01": 12000,
      "02": 8000,
      "03": 15000
    }
  }
}
```

#### GET /api/v1/reports/weekly/:year/:month
月内の全ての週次レポートを取得します。

**パラメータ**:
- `year`: 年（例: 2025）
- `month`: 月（例: 5）

**レスポンス**:
```json
{
  "status": 200,
  "success": true,
  "message": "2025年5月の週次レポートを取得しました",
  "data": {
    "term1": {
      "total_amount": 35000,
      "card_counts": {"カード名A": 4, "カード名B": 2},
      "card_amounts": {"カード名A": 25000, "カード名B": 10000},
      "daily_amounts": {"01": 12000, "02": 8000, "03": 15000}
    },
    "term2": {
      "total_amount": 42000,
      "card_counts": {"カード名A": 3, "カード名B": 3},
      "card_amounts": {"カード名A": 22000, "カード名B": 20000},
      "daily_amounts": {"08": 12000, "09": 15000, "10": 15000}
    }
  }
}
```

#### GET /api/v1/reports/monthly/:year/:month
月次レポートを取得します。

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
      "カード名A": 12,
      "カード名B": 8,
      "カード名C": 5
    },
    "card_amounts": {
      "カード名A": 65000,
      "カード名B": 40000,
      "カード名C": 15000
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
      "04": 0,
      "05": 0,
      "06": 0,
      "07": 0,
      "08": 12000,
      "31": 5000
    }
  }
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
  id?: string;               // ドキュメントID
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
  total_amount: number;           // 合計金額
  card_counts: Record<string, number>; // カード別利用回数
  card_amounts: Record<string, number>; // カード別利用金額
}
```

### 日次レポート
```typescript
interface DailyReport extends BaseReport {
  // BaseReportのフィールドに加え、日次固有のフィールドがある場合ここに追加
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
  weekly_amounts: Record<string, number>; // 週別金額
  daily_amounts: Record<string, number>;  // 日別金額
}
```

## API利用例

### カード利用データの取得
```javascript
const apiClient = new ApiClient();
const result = await apiClient.get('/card-usages', { 
  params: { year: '2025', month: '5' } 
});
```

### カード利用データの作成
```javascript
const apiClient = new ApiClient();
const newCardUsage = {
  card_name: "クレジットカードA",
  datetime_of_use: "2025-05-03T10:00:00.000Z",
  amount: 5000,
  where_to_use: "スーパー",
  memo: "食料品"
};
const result = await apiClient.post('/card-usages', newCardUsage);
```

### 月次レポートの取得
```javascript
const apiClient = new ApiClient();
const result = await apiClient.get('/reports/monthly/2025/5');
```

---

この仕様書で定義されるAPIは、RoCPアプリケーションのバックエンドとして動作し、フロントエンドアプリケーションとの連携に使用されます。