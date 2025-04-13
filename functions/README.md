# Cloud Functions 環境変数設定手順

このプロジェクトのCloud Functionsでは、Discord通知のためのWebhook URLを環境変数から読み込みます。
以下の手順に従って、適切に環境変数を設定してください。

## ローカル開発時の環境変数設定

1. `functions`ディレクトリ内に`.runtimeconfig.json`ファイルを作成します（このファイルはGitにコミットされません）
2. 以下のフォーマットでDiscord Webhook URLを設定します：

```json
{
  "discord": {
    "webhook_url": "https://discord.com/api/webhooks/your-webhook-url"
  }
}
```

## Firebase環境への環境変数のデプロイ

本番環境に環境変数を設定するには、以下のコマンドを実行します：

```bash
firebase functions:config:set discord.webhook_url="https://discord.com/api/webhooks/your-webhook-url"
```

## 現在の環境変数設定の確認

設定されている環境変数を確認するには、以下のコマンドを実行します：

```bash
firebase functions:config:get
```

## 注意事項

- Webhook URLは機密情報です。`.runtimeconfig.json`ファイルをGitにコミットしないように注意してください
- 本番環境の環境変数は、Firebase Consoleでは確認できません。必ずCLIを使用して設定・確認してください