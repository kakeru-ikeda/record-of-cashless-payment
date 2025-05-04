# Test stage
FROM node:18 AS test
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm test

# ベースイメージとして公式のNode.jsイメージを使用
FROM node:22 AS build
WORKDIR /usr/src/app

# 環境変数を設定 - Cloud Runは8080ポートを使用
ENV PORT=8080
ENV TZ=Asia/Tokyo

# パッケージ定義ファイルをコピーして、依存関係をインストール
COPY package*.json ./
RUN npm install

# ソースコードをコピー
COPY . .

# TypeScript をコンパイル
RUN npm run build
# コンテナ起動時に公開するポート
EXPOSE 8080

# アプリケーションを起動
CMD ["node", "dist/src/index.js"]
