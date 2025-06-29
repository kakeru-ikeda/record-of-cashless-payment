# 週次レポート送信APIテストガイド

## 概要

このドキュメントでは、週次レポート送信機能のテスト方法について説明します。本テスト環境では、本番Firestoreデータをエミュレーターにクローンし、任意の日付で週次レポート送信をテストできます。

## 前提条件

- Firebaseエミュレーター（Functions + Firestore）が起動していること
- 本番Firestoreへのアクセス権限（`firebase-admin-key.json`）があること
- Node.js環境が構築されていること

## セットアップ手順

### 1. エミュレーター起動

```bash
cd functions
firebase emulators:start --only functions,firestore
```

エミュレーターが起動すると以下のエンドポイントが利用可能になります：
- **Cloud Functions**: `http://127.0.0.1:5002`
- **Firestore**: `http://127.0.0.1:8100`
- **エミュレーターUI**: `http://127.0.0.1:4002`

### 2. 本番データクローン

```bash
# 全てのreportsコレクションをクローン
npx ts-node scripts/clone-firestore-data.ts --collections=reports

# エミュレーターをクリアしてからクローン
npx ts-node scripts/clone-firestore-data.ts --clear --collections=reports

# ドライランで確認
npx ts-node scripts/clone-firestore-data.ts --collections=reports --dry-run
```

## テスト実行

### 週次レポート送信テスト

**エンドポイント**: `POST /send-weekly-report`

**リクエスト形式**:
```json
{
  "year": 2025,
  "month": 6,
  "day": 10
}
```

**実行例**:
```bash
# 6月10日（第2週）のテスト
curl -X POST "http://127.0.0.1:5002/mufg-usage-details-mailbot/asia-northeast1/api/send-weekly-report" \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 6, "day": 10}'

# 6月22日（第4週）のテスト  
curl -X POST "http://127.0.0.1:5002/mufg-usage-details-mailbot/asia-northeast1/api/send-weekly-report" \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 6, "day": 22}'
```

**成功レスポンス例**:
```json
{
  "status": 200,
  "success": true,
  "message": "週次レポートを送信しました",
  "data": {
    "year": 2025,
    "month": 6,
    "day": 10,
    "term": 2,
    "targetDate": {
      "date": "2025-06-10T00:00:00.000Z",
      "year": 2025,
      "month": 6,
      "day": 10,
      "weekNumber": 2,
      "term": 2,
      "weekStartDate": "2025-06-07T15:00:00.000Z",
      "weekEndDate": "2025-06-14T14:59:59.000Z",
      "timestamp": 1749513600000,
      "isLastDayOfTerm": false,
      "isLastDayOfMonth": false
    },
    "timestamp": "2025-06-29T08:04:23.721Z"
  }
}
```

## ログ確認

### 正常処理ログ

```
> 2025-06-29T08:04:23.710Z ℹ️ INFO [Send Weekly Report HTTP Handler] HTTP処理開始
> 2025-06-29T08:04:23.710Z ℹ️ INFO [Send Weekly Report HTTP Handler] 週次レポート送信テスト: 2025年6月10日 (第2週) - 2025/6/10
> 2025-06-29T08:04:23.710Z ℹ️ INFO [ReportUseCase] 週次レポート取得: 2025年06月term2
> 2025-06-29T08:04:23.710Z ℹ️ INFO [FirestoreReportRepository] 週次レポート取得: パス=reports/weekly/2025-06/term2
> 2025-06-29T08:04:23.721Z ℹ️ INFO [Report Scheduling Service] 週次レポート取得: 35356円, 件数: 14, hasReportSent: true
> 2025-06-29T08:04:23.721Z ℹ️ INFO [Report Scheduling Service] ウィークリーレポートは送信済みのためスキップします
```

### エラーログ（データが見つからない場合）

```
> 2025-06-29T08:01:18.538Z ℹ️ INFO [FirestoreService] ドキュメントが見つかりません: reports/weekly/2025-06/term2
> 2025-06-29T08:01:18.538Z ❌ ERROR [ReportUseCase] 2025年06月term2の週次レポートが見つかりません
> 2025-06-29T08:01:18.538Z ⚠️ WARN [Report Scheduling Service] ウィークリーレポートが見つかりません。送信をスキップします
```

## トラブルシューティング

### 1. データが見つからない

**症状**: `ドキュメントが見つかりません` エラー

**原因**: 
- エミュレーターにデータがクローンされていない
- クローンスクリプトと Cloud Functions で異なるプロジェクトIDを使用

**対処法**:
```bash
# エミュレーターをクリアして再クローン
npx ts-node scripts/clone-firestore-data.ts --clear --collections=reports

# データが正しくクローンされているか確認
npx ts-node scripts/clone-firestore-data.ts --explore
```

### 2. エミュレーター接続エラー

**症状**: `Failed to connect to localhost port 5002`

**対処法**:
```bash
# エミュレーターが起動しているか確認
firebase emulators:start --only functions,firestore

# ポートが使用中の場合はプロセスを終了
pkill -f firebase
```

### 3. プロジェクトID不整合

**症状**: APIは成功を返すがログでエラーが出る

**対処法**:
- `clone-firestore-data.ts` でターゲットプロジェクトIDが `mufg-usage-details-mailbot` になっているか確認
- エミュレーターとクローンスクリプトが同じプロジェクト空間を使用しているか確認

## 利用可能なテストケース

### テスト対象週

以下の週次レポートがテスト可能です（本番データに依存）：

| 日付例 | 週番号 | Firestoreパス |
|--------|--------|---------------|
| 6月1日 | term1 | `reports/weekly/2025-06/term1` |
| 6月10日 | term2 | `reports/weekly/2025-06/term2` |
| 6月15日 | term3 | `reports/weekly/2025-06/term3` |
| 6月22日 | term4 | `reports/weekly/2025-06/term4` |

### 週番号の計算ロジック

- 月の第1週から第4週までを `term1` から `term4` として管理
- `DateUtil.getDateInfo()` で指定された日付から週番号を自動計算
- 週の開始は日曜日（日本時間）

## 関連ファイル

- **APIハンドラー**: `functions/src/presentation/handlers/http/SendWeeklyReportHttpHandler.ts`
- **サービス層**: `functions/src/application/services/ReportSchedulingService.ts`
- **リポジトリ**: `shared/infrastructure/database/repositories/FirestoreReportRepository.ts`
- **ユースケース**: `shared/usecases/database/FirestoreReportUseCase.ts`
- **クローンスクリプト**: `scripts/clone-firestore-data.ts`

## 修正履歴

### 2025-06-29: 週次レポートパス生成バグ修正

**問題**: `FirestoreReportRepository.getWeeklyReportByTerm` で常に `term1` のパスが生成される

**原因**: 
- `validateYearMonth` が常に月の1日を返すため、週番号が第1週になってしまう
- `updateReportSentFlag` で存在しない `pathInfo.weekNumber` を参照

**修正内容**:
1. `getWeeklyReportByTerm`: 引数の `term` を直接使用してパス生成
2. `updateWeeklyReport`: 引数の `term` を直接使用してパス生成  
3. `updateReportSentFlag`: `pathInfo.weekNumber` → `pathInfo.term` に修正

**修正後の動作**:
- ✅ 指定日付から正しい週番号（term）を計算
- ✅ 正しいFirestoreパスでドキュメント検索
- ✅ 週次レポートの取得・送信が正常動作

## 参考

- [Firebase Emulator Suite Documentation](https://firebase.google.com/docs/emulator-suite)
- [Cloud Functions Local Development](https://firebase.google.com/docs/functions/local-emulator)
- [Firestore Emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore)
