import { AppError } from '@shared/errors/AppError';
import { LoggerConfig } from '@shared/infrastructure/logging/Logger';

/**
 * ログ通知オプションのインターフェース
 */
export interface LogNotifyOptions {
  notify?: boolean;       // Discord通知を行うかどうか
  title?: string;         // 通知のタイトル
  suppressConsole?: boolean; // コンソール出力を抑制するかどうか
}

/**
 * サービス状態の型定義
 */
export interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'error' | 'warning';
  message?: string;
  lastUpdated: Date;
  errorCount?: number; // エラーの発生回数
  lastErrorTime?: Date; // 最後にエラーが発生した時間
}

/**
 * ロギング機能のインターフェース
 * アプリケーション全体で一貫したログ記録のために使用
 */
export interface ILogger {
  /**
   * ログの設定を更新
   */
  setConfig(config: Partial<LoggerConfig>): void;

  /**
   * DiscordNotifierを設定
   */
  setDiscordNotifier(discordNotifier: any): void;

  /**
   * DEBUGレベルのログを出力
   */
  debug(message: string, context?: string, options?: LogNotifyOptions): void;

  /**
   * INFOレベルのログを出力
   */
  info(message: string, context?: string, options?: LogNotifyOptions): void;

  /**
   * WARNレベルのログを出力
   */
  warn(message: string, context?: string, options?: LogNotifyOptions): void;

  /**
   * ERRORレベルのログを出力
   */
  error(error: AppError | Error, context?: string, options?: LogNotifyOptions): void;

  /**
   * サービスのステータスを更新
   */
  updateServiceStatus(
    name: string,
    status: ServiceStatus['status'],
    message?: string
  ): void;

  /**
   * ステータスダッシュボードの描画
   */
  renderStatusDashboard(): void;
}
