/**
 * HTTPアプリケーション設定を管理するインターフェース
 * サーバー設定、ミドルウェア設定、ルート設定を定義する
 */
import { Application } from "express";
import { Server } from "http";
import { EmailController } from "@presentation/email/controllers/EmailController";

export interface IHttpAppConfig {
    /**
     * モニタリングルートを設定する
     * ヘルスチェック、ステータス確認などのエンドポイントを追加
     */
    setupMonitoringRoutes(): void;

    /**
     * サービス管理APIルートを設定する
     * サービスの起動、停止、設定などのエンドポイントを追加
     * 
     * @param emailController メール処理コントローラー
     */
    setupServiceRoutes(emailController: EmailController): void;

    /**
     * サーバーを起動する
     * 
     * @returns 起動したHTTPサーバー
     */
    startServer(): Server;

    /**
     * Expressアプリケーションを取得する
     * 
     * @returns Expressアプリケーションインスタンス
     */
    getApp(): Application;
}
