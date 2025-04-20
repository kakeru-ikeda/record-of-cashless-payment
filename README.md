# RoCP (Record of cashless payment)

このアプリケーションは、三菱UFJ銀行をはじめとしたクレジット・デビットカード利用通知メールを監視し、利用明細情報を抽出して Firebase Firestore に保存し、Discord に通知するシステムです。

## システム構成

このシステムは2つの主要コンポーネントで構成されています：

1. **メインプログラム** - メールボックスのモニタリングと即時通知
   - 指定したメールボックス（Gmail など）のモニタリング
   - 三菱UFJ銀行のデビットカード利用通知メールの自動検出
   - メールからのカード利用情報（金額、店舗、日時）の抽出
   - Firebase Firestore へのデータ保存
   - Discord Webhook を使った利用の即時通知

2. **Firebase Functions** - データ分析とレポート生成
   - Firestore のモニタリング（新規データ検出）
   - デイリー／ウィークリー／マンスリーレポートの自動生成
   - 予算のしきい値超過時のアラート通知
   - 定期レポートの Discord への自動送信

## アーキテクチャ

このプロジェクトはクリーンアーキテクチャに準拠して設計されています：

- **ドメイン層** - ビジネスエンティティとロジック
- **ユースケース層** - アプリケーションの主要機能
- **インフラストラクチャ層** - 外部サービスとの連携
- **インターフェース層** - 外部とのインターフェース

## 環境構築

### 前提条件

- Node.js 18以上
- npm または yarn
- Gmail アカウント（IMAP アクセス有効）
- Firebase プロジェクト（Firestore と Functions）
- Discord Webhook（通知用、アラート用、レポート用）

### Firebase の設定

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを作成
2. Firestore Database を有効化
3. Firebase Functions を有効化
4. プロジェクト設定 > サービスアカウント から新しい秘密鍵を生成
5. ダウンロードしたJSONファイルを firebase-admin-key.json としてプロジェクトルートに配置

### 環境変数の設定

.env ファイルをプロジェクトルートに作成：

```
IMAP_SERVER=imap.gmail.com
IMAP_USER=あなたのメールアドレス@gmail.com
IMAP_PASSWORD=あなたのアプリパスワード
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/あなたのウェブフックURL
GOOGLE_APPLICATION_CREDENTIALS=./firebase-admin-key.json
```

.env ファイルを /functions ディレクトリ配下に作成：

```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/あなたのウェブフックURL
DISCORD_ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/アラート用ウェブフックURL
DISCORD_REPORT_WEBHOOK_URL=https://discord.com/api/webhooks/レポート用ウェブフックURL
```

> **注意**: Gmail を使用する場合は、アプリパスワードの発行が必要です。

## 使い方

### インストール

```bash
npm install
```

### メインプログラム実行モード

#### 通常モード（メール監視）

```bash
npm start
```

#### テストモード（サンプルメールでのテスト）

サンプルメールを samplemail.txt としてプロジェクトルートに配置し、以下を実行：

```bash
npm start -- --test
```

### APIエンドポイント

アプリケーションには以下のAPIエンドポイントが実装されています：

#### GET /health
システムのヘルスチェックを行います。システムが正常に動作していることを確認できます。

**レスポンス例**:
```json
{
  "status": 200,
  "message": "システムは正常に稼働しています",
  "data": {
    "timestamp": "2025/04/20 12:34:56",
    "monitoring": true
  }
}
```

#### GET /status
メール監視の現在の状態を取得します。

**レスポンス例**:
```json
{
  "status": 200,
  "message": "メール監視の状態",
  "data": {
    "status": "monitoring",
    "startTime": "2025/04/20 10:15:30"
  }
}
```

#### POST /start
メール監視を手動で開始します。Cloud Run環境では自動的に開始されますが、ローカル環境では手動でこのエンドポイントを呼び出す必要があります。

**レスポンス例**:
```json
{
  "status": 200,
  "message": "メール監視を開始しました",
  "data": {
    "startTime": "2025/04/20 14:25:10"
  }
}
```

### Firebase Functionsのデプロイ

```bash
cd functions
npm install
npm run deploy
```

### テスト

```bash
npm test
```

## 機能詳細

### メインプログラム
- メール受信の自動検知
- カード利用情報の抽出と構造化
- Firestoreへのデータ保存
- リアルタイム通知の送信

### Firebase Functions
- **onFirestoreWrite**: 新しいカード利用情報が追加された時に実行
  - デイリー/ウィークリー/マンスリーレポートの生成
  - 支出のしきい値超過アラートの送信
- **dailyReportSchedule**: 毎日0時に実行される定期タスク
  - 前日のデイリーレポート送信
  - 週初めの場合は先週のウィークリーレポート送信
  - 月初めの場合は先月のマンスリーレポート送信

## セキュリティ上の注意

- **`firebase-admin-key.json` をGitリポジトリにコミットしないでください**
- .env ファイルには機密情報が含まれるため、リポジトリに追加しないでください
- 本番環境では環境変数や安全なシークレット管理を使用してください

## トラブルシューティング

- **メールが検出されない場合**: IMAPの設定を確認し、メールボックス名が正しいか確認してください
- **Firestoreへの接続エラー**: firebase-admin-key.jsonのパスと権限を確認してください
- **Discord通知が届かない**: Webhook URLの有効性を確認してください
- **Functionsが動作しない**: Firebaseのログを確認し、環境変数が正しく設定されているか確認してください

## ライセンス

このプロジェクトはプライベートで使用することを前提としており、個人的なカード利用通知の管理のための参考実装です.