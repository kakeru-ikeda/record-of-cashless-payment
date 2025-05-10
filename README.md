# RoCP (Record of Cashless Payment)

このアプリケーションは、三菱UFJ銀行をはじめとしたクレジット・デビットカード利用通知メールを監視し、利用明細情報を抽出して Firebase Firestore に保存し、Discord に通知するシステムです。

## システム構成

このシステムは3つの主要コンポーネントで構成されています：

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
   - RESTful API の提供

3. **Webフロントエンド** - データの可視化と対話的な操作
   - カード利用履歴の確認
   - レポートの閲覧
   - データの追加・編集・削除
   - レスポンシブデザイン

## 関連リポジトリ

- **バックエンド**: このリポジトリ
- **フロントエンド**: [record-of-cashless-payment-webfront](https://github.com/kakeru-ikeda/record-of-cashless-payment-webfront)
- **Discord BOT**: [record-of-cashless-payment-bot](https://github.com/kakeru-ikeda/record-of-cashless-payment-bot)

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
# アラート通知用Webhook URLs
DISCORD_ALERT_WEEKLY_WEBHOOK_URL=https://discord.com/api/webhooks/ウィークリーアラート用ウェブフックURL
DISCORD_ALERT_MONTHLY_WEBHOOK_URL=https://discord.com/api/webhooks/マンスリーアラート用ウェブフックURL

# レポート通知用Webhook URLs
DISCORD_REPORT_DAILY_WEBHOOK_URL=https://discord.com/api/webhooks/デイリーレポート用ウェブフックURL
DISCORD_REPORT_WEEKLY_WEBHOOK_URL=https://discord.com/api/webhooks/ウィークリーレポート用ウェブフックURL
DISCORD_REPORT_MONTHLY_WEBHOOK_URL=https://discord.com/api/webhooks/マンスリーレポート用ウェブフックURL
```

> **注意**: 利用明細通知用のWebhook URLはCloud Functionsでは使用しません。メインプログラムの.envファイルに設定してください。

> **注意**: Gmail を使用する場合は、アプリパスワードの発行が必要です。

## 機能詳細

### メインシステム
- メール受信の自動検知
- カード利用情報の抽出と構造化
- Firestoreへのデータ保存
- リアルタイム通知の送信

#### メインシステムAPI
サーバーが提供するサービスへダイレクトにアクセスするためのAPI実装
- **モニタリングAPI**: サービス状態確認、ヘルスチェック（`/monitoring/*`）
- **サービス管理API**: メール監視の制御、強制実行（`/api/services/*`）

### Firebase Functions
- **onFirestoreWrite**: 新しいカード利用情報が追加された時に実行
  - デイリー/ウィークリー/マンスリーレポートの生成
  - 支出のしきい値超過アラートの送信
- **dailyReportSchedule**: 毎日0時に実行される定期タスク
  - 前日のデイリーレポート送信
  - 週初めの場合は先週のウィークリーレポート送信
  - 月初めの場合は先月のマンスリーレポート送信
- **api**: フロントエンドとの情報疎通のためにサーバーレスで実装
  - カード利用情報のCRUD操作
  - 日次/週次/月次レポートの取得
  - ヘルスチェック
  - 詳細な仕様についてはドキュメントを参照してください：[API仕様書](/functions/src/api/readme.md)

APIセットは共通の認証基盤（Firebase Authentication）を使用しており、一元化された権限管理を実現しています。

## 運用

### 対応金融機関
現在、以下の金融機関からのカード利用通知メールに対応しています：
- 三菱UFJ銀行（デビットカード）
- 三井住友カード（クレジットカード）

カード会社ごとに専用のパーサーが実装されており、メール形式の違いに対応しています。新しいカード会社の追加は、対応するパーサーを実装することで容易に行えます。

### メール処理パイプライン

1. **メール検出**: IMAP接続で未読メールを監視
2. **カード会社判別**: メールヘッダーとコンテンツから送信元カード会社を特定
3. **データ抽出**: カード会社専用のパーサーでメール本文から情報を抽出
4. **データ変換**: 抽出データを標準形式に変換（CardUsageエンティティ）
5. **データ検証**: 金額、日時、店舗名などの必須データの存在確認
6. **重複チェック**: 同一取引の重複登録防止
7. **データ保存**: Firestoreの年/月/日付構造に従って保存
8. **通知生成**: Discordへの通知メッセージ作成と送信

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

## CI/CD

このプロジェクトはJenkinsを使用した継続的インテグレーション/デプロイメントを実装しています。

### 自動デプロイ

- `main`ブランチにコードがマージされると、Jenkinsパイプラインが自動的に起動します
- ビルド、テスト、デプロイが自動的に実行されます
- デプロイ状態はJenkinsダッシュボードで確認できます

### デプロイフロー

1. コードがmainブランチにマージされる
2. Jenkinsが変更を検知し、パイプラインを起動
3. Dockerイメージのビルド
4. テストの実行
5. 成功した場合、本番環境へのデプロイ
6. Discordへの通知（成功/失敗）


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
