# MUFG 利用明細メールボット

このアプリケーションは、三菱UFJ銀行のカード利用通知メールを監視し、利用明細情報を抽出して Firebase Firestore に保存し、Discord に通知します。

## 機能概要

- 指定したメールボックス（Gmail など）のモニタリング
- 三菱UFJ銀行のデビットカード利用通知メールの自動検出
- メールからのカード利用情報（金額、店舗、日時）の抽出
- Firebase Firestore へのデータ保存
- Discord Webhook を使った利用通知

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
- Firebase プロジェクト
- Discord Webhook（オプション）

### Firebase の設定

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを作成
2. Firestore Database を有効化
3. プロジェクト設定 > サービスアカウント から新しい秘密鍵を生成
4. ダウンロードしたJSONファイルを firebase-admin-key.json としてプロジェクトルートに配置

### 環境変数の設定

.env ファイルをプロジェクトルートに作成：

```
IMAP_SERVER=imap.gmail.com
IMAP_USER=あなたのメールアドレス@gmail.com
IMAP_PASSWORD=あなたのアプリパスワード
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/あなたのウェブフックURL
GOOGLE_APPLICATION_CREDENTIALS=./firebase-admin-key.json
```

> **注意**: Gmail を使用する場合は、アプリパスワードの発行が必要です。

## 使い方

### インストール

```bash
npm install
```

### 実行モード

#### 通常モード（メール監視）

```bash
npm start
```

#### テストモード（サンプルメールでのテスト）

サンプルメールを samplemail.txt としてプロジェクトルートに配置し、以下を実行：

```bash
npm start -- --test
```

### テスト

```bash
npm test
```

## デプロイ

### Docker を使用したデプロイ

```bash
# イメージをビルド
docker build -t mufg-mailbot .

# コンテナを実行
docker run -d --name mufg-mailbot \
  -v /path/to/firebase-admin-key.json:/usr/src/app/firebase-admin-key.json \
  --env-file .env \
  mufg-mailbot
```

### Google Cloud Run へのデプロイ

```bash
# イメージをビルド
npm run docker:build:cloud

# イメージをプッシュ
npm run docker:push

# Cloud Run にデプロイ
npm run gcloud:deploy
```

## セキュリティ上の注意

- **`firebase-admin-key.json` をGitリポジトリにコミットしないでください**
- .env ファイルには機密情報が含まれるため、リポジトリに追加しないでください
- 本番環境では環境変数や安全なシークレット管理を使用してください

## トラブルシューティング

- **メールが検出されない場合**: IMAPの設定を確認し、メールボックス名が正しいか確認してください
- **Firestoreへの接続エラー**: firebase-admin-key.jsonのパスと権限を確認してください
- **Discord通知が届かない**: Webhook URLの有効性を確認してください

## ライセンス

このプロジェクトはプライベートで使用することを前提としており、個人的なカード利用通知の管理のための参考実装です。