# Test stage
FROM node:18 AS test
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm test

# ベースイメージとして公式のNode.jsイメージを使用
FROM node:18 AS build
WORKDIR /usr/src/app

# 環境変数を設定
ENV PORT=3000
ENV TZ=Asia/Tokyo

# ログ関連の環境変数
ENV LOG_LEVEL=INFO
ENV COMPACT_LOGS=false
ENV SUPPRESS_POLLING_LOGS=true
ENV STATUS_REFRESH_INTERVAL=30000

# パッケージ定義ファイルをコピーして、依存関係をインストール
COPY package*.json ./
RUN npm install

# ソースコードをコピー
COPY . .

# TypeScript をコンパイル
RUN npm run build
# コンテナ起動時に公開するポート
EXPOSE 3000

# アプリケーションを起動
CMD ["node", "dist/src/index.js"]
