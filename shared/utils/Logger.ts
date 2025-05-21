import { DiscordNotifier } from '../discord/DiscordNotifier';
import { AppError, ErrorType } from '../errors/AppError';

/**
 * ログレベルの列挙型
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
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
 * エラー履歴の型定義
 */
export interface ErrorRecord {
  timestamp: Date;
  service: string;
  message: string;
  errorType?: ErrorType;
  details?: any;
}

/**
 * ログ設定のインタフェース
 */
export interface LoggerConfig {
  level: LogLevel;
  suppressPolling: boolean;
  compactMode: boolean;
  statusRefreshInterval: number;
  errorHistorySize: number; // 保持するエラー履歴の数
  errorStatsTimeWindow: number; // エラー統計の時間枠（ミリ秒）
}

/**
 * ログ通知オプションのインターフェース
 */
export interface LogNotifyOptions {
  notify?: boolean;       // Discord通知を行うかどうか
  title?: string;         // 通知のタイトル
  suppressConsole?: boolean; // コンソール出力を抑制するかどうか
}


/**
 * ロガークラス - アプリケーションの標準化されたログ出力を提供
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private services: Map<string, ServiceStatus> = new Map();
  private lastStatusRender: number = 0;
  private suppressedMessages: Map<string, { count: number, lastTime: number }> = new Map();
  private suppressionInterval: number = 60000; // 1分間
  private dashboardTimer: NodeJS.Timeout | null = null;
  private dashboardRendered: boolean = false;

  // エラー統計と履歴
  private errorHistory: ErrorRecord[] = [];
  private serviceErrorStats: Map<string, { count: number, times: Date[] }> = new Map();

  // Discordの通知機能
  private discordNotifier: DiscordNotifier | null = null;

  /**
   * コンストラクタ - シングルトンパターン
   */
  private constructor() {
    // 環境変数からログレベルを取得（デフォルトはINFO）
    const logLevelStr = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    const logLevelMap: Record<string, LogLevel> = {
      'DEBUG': LogLevel.DEBUG,
      'INFO': LogLevel.INFO,
      'WARN': LogLevel.WARN,
      'ERROR': LogLevel.ERROR,
      'NONE': LogLevel.NONE
    };

    this.config = {
      level: logLevelMap[logLevelStr] ?? LogLevel.INFO,
      suppressPolling: process.env.SUPPRESS_POLLING_LOGS === 'true',
      compactMode: process.env.COMPACT_LOGS === 'true',
      statusRefreshInterval: parseInt(process.env.STATUS_REFRESH_INTERVAL || '30000', 10),
      errorHistorySize: parseInt(process.env.ERROR_HISTORY_SIZE || '10', 10),
      errorStatsTimeWindow: parseInt(process.env.ERROR_STATS_TIME_WINDOW || '3600000', 10) // デフォルト1時間
    };

    // ステータスダッシュボード定期更新
    if (this.config.compactMode) {
      // 既存のタイマーを停止してから新しいタイマーを設定
      this.setupDashboardRefresh();
    }

    // エラー統計のクリーンアップタイマー設定
    setInterval(() => this.cleanupErrorStats(), this.config.errorStatsTimeWindow / 2);
  }

  /**
   * DiscordNotifierを設定
   */
  public setDiscordNotifier(discordNotifier: DiscordNotifier): void {
    this.discordNotifier = discordNotifier;
    logger.info('DiscordNotifierが設定されました', 'Logger');
  }
  
  /**
   * Discord通知が有効かどうかを確認
   */
  private isDiscordNotificationEnabled(): boolean {
    return this.discordNotifier !== null;
  }

  /**
   * ダッシュボードの更新タイマーを設定
   */
  private setupDashboardRefresh(): void {
    if (this.dashboardTimer) {
      clearInterval(this.dashboardTimer);
      this.dashboardTimer = null;
    }

    this.dashboardTimer = setInterval(() => {
      this.renderStatusDashboard();
    }, this.config.statusRefreshInterval);
  }

  /**
   * 古いエラー統計をクリーンアップ
   */
  private cleanupErrorStats(): void {
    const cutoffTime = new Date(Date.now() - this.config.errorStatsTimeWindow);

    // サービスごとのエラー統計をクリーンアップ
    for (const [service, stats] of this.serviceErrorStats.entries()) {
      // 指定された時間枠より古いエラー時刻を削除
      stats.times = stats.times.filter(time => time > cutoffTime);
      stats.count = stats.times.length;

      // 統計情報を更新
      if (stats.count === 0) {
        this.serviceErrorStats.delete(service);
      } else {
        this.serviceErrorStats.set(service, stats);
      }
    }

    // 該当するサービスのステータスも更新
    for (const [name, status] of this.services.entries()) {
      const errorStats = this.serviceErrorStats.get(name);
      if (status.errorCount && (!errorStats || errorStats.count === 0)) {
        status.errorCount = 0;
        this.services.set(name, status);
      }
    }
  }

  /**
   * ロガーインスタンスを取得
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 設定を更新
   */
  public setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };

    // コンパクトモード設定が変更された場合、タイマーを再設定
    if ('compactMode' in config || 'statusRefreshInterval' in config) {
      this.setupDashboardRefresh();
    }
  }

  /**
   * DEBUGレベルのログを出力（任意でDiscord通知）
   */
  public debug(message: string, context?: string, options?: LogNotifyOptions): void {
    if (this.config.level <= LogLevel.DEBUG) {
      // コンソールログ（抑制オプションがある場合は出力しない）
      if (!options?.suppressConsole) {
        this.log(message, context, 'debug');
      }
      
      // Discord通知（非同期で実行、プロミスは無視）
      if (options?.notify && this.isDiscordNotificationEnabled()) {
        this.discordNotifier!.notifyLogging(message, options.title || 'デバッグ情報', context)
          .catch(err => console.warn(`Discord通知エラー: ${err instanceof Error ? err.message : String(err)}`));
      }
    }
  }

  /**
   * INFOレベルのログを出力（任意でDiscord通知）
   */
  public info(message: string, context?: string, options?: LogNotifyOptions): void {
    if (this.config.level <= LogLevel.INFO) {
      // ポーリングログの抑制
      if (!options?.suppressConsole && this.config.suppressPolling && message.includes('ポーリング')) {
        this.handleSuppression('polling', message, context, 'info');
      } else if (!options?.suppressConsole) {
        this.log(message, context, 'info');
      }
      
      // Discord通知（非同期で実行、プロミスは無視）
      if (options?.notify && this.isDiscordNotificationEnabled()) {
        this.discordNotifier!.notifyLogging(message, options.title || 'お知らせ', context)
          .catch(err => console.warn(`Discord通知エラー: ${err instanceof Error ? err.message : String(err)}`));
      }
    }
  }

  /**
   * WARNレベルのログを出力（任意でDiscord通知）
   */
  public warn(message: string, context?: string, options?: LogNotifyOptions): void {
    if (this.config.level <= LogLevel.WARN) {
      // コンソールログ
      if (!options?.suppressConsole) {
        this.log(message, context, 'warn');
      }
      
      // Discord通知（非同期で実行、プロミスは無視）
      if (options?.notify && this.isDiscordNotificationEnabled()) {
        this.discordNotifier!.notifyLogging(message, options.title || '⚠️ 警告', context)
          .catch(err => console.warn(`Discord通知エラー: ${err instanceof Error ? err.message : String(err)}`));
      }
    }
  }

  /**
   * ERRORレベルのログを出力（任意でDiscord通知）
   */
  public error(
    message: string,
    error?: AppError | Error,
    context?: string, 
    notify: boolean = true
  ): void {
    // エラーオブジェクトがAppErrorでない場合は新規作成
    if (!(error instanceof AppError)) {
      error = new AppError(
        message,
        ErrorType.GENERAL,
        {},
        error instanceof Error ? error : undefined
      );
    }

    // コンソールログ
    if (this.config.level <= LogLevel.ERROR) {
      this.log(error.message, context, 'error');
      console.error((error as AppError).toLogString());
    }

    // エラー統計の更新
    if (context) {
      this.updateErrorStats(context);
    }

    // エラー履歴に追加
    this.addErrorRecord({
      timestamp: new Date(),
      service: context || 'unknown',
      message: error.message,
      errorType: (error as AppError).type,
      details: (error as AppError).details
    });

    // サービスステータスを更新
    if (context) {
      this.updateServiceStatus(context, 'error', error.message);
    }

    // Discord通知（非同期で実行、プロミスは無視）
    if (notify && this.isDiscordNotificationEnabled()) {
      this.discordNotifier!.notifyError(error as AppError, context)
        .catch(err => console.warn(`Discord通知エラー: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  /**
   * サービスのステータスを更新
   */
  public updateServiceStatus(
    name: string,
    status: ServiceStatus['status'],
    message?: string
  ): void {
    // 既存のステータスを取得または新規作成
    const existingStatus = this.services.get(name) || {
      name,
      status: 'offline',
      lastUpdated: new Date()
    };

    // 既存のエラー統計を維持
    const errorStats = this.serviceErrorStats.get(name);

    this.services.set(name, {
      ...existingStatus,
      name,
      status,
      message,
      lastUpdated: new Date(),
      errorCount: errorStats?.count || existingStatus.errorCount || 0,
      lastErrorTime: status === 'error' ? new Date() : existingStatus.lastErrorTime
    });

    // コンパクトモードの場合、状態が変わったら即時描画
    if (this.config.compactMode) {
      const now = Date.now();
      // 最後の描画から500ms以上経っていれば再描画（描画の頻度を制限）
      if (now - this.lastStatusRender > 500) {
        this.lastStatusRender = now;
        // 初回または前回の描画から十分な時間が経った場合のみ描画
        if (!this.dashboardRendered) {
          this.renderStatusDashboard();
        }
      }
    }
  }

  /**
   * エラー統計を更新
   */
  private updateErrorStats(serviceName: string): void {
    const now = new Date();
    const stats = this.serviceErrorStats.get(serviceName) || { count: 0, times: [] };

    // エラー発生時間を記録
    stats.times.push(now);

    // 時間枠外の古いエントリを削除
    const cutoffTime = new Date(Date.now() - this.config.errorStatsTimeWindow);
    stats.times = stats.times.filter(time => time > cutoffTime);

    // カウントを更新
    stats.count = stats.times.length;

    // 統計を保存
    this.serviceErrorStats.set(serviceName, stats);

    // サービスの状態も更新
    const service = this.services.get(serviceName);
    if (service) {
      service.errorCount = stats.count;
      service.lastErrorTime = now;
      this.services.set(serviceName, service);
    }
  }

  /**
   * エラー履歴に新しいエラーを追加
   */
  private addErrorRecord(record: ErrorRecord): void {
    this.errorHistory.unshift(record); // 最新のエラーを先頭に追加

    // 履歴サイズの制限
    if (this.errorHistory.length > this.config.errorHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.config.errorHistorySize);
    }
  }

  /**
   * 実際のログ出力処理
   */
  private log(message: string, context?: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const emoji = this.getLogEmoji(level);

    let contextStr = context ? `[${context}]` : '';

    // コンパクトモードではなければ通常のログ出力
    if (!this.config.compactMode) {
      console.log(`${timestamp} ${emoji} ${level.toUpperCase()} ${contextStr} ${message}`);
    }

    // サービスステータスの更新（エラー以外）
    if (context && level !== 'error') {
      const statusMap = {
        'debug': 'online',
        'info': 'online',
        'warn': 'warning'
      } as const;

      this.updateServiceStatus(context, statusMap[level], level === 'warn' ? message : undefined);
    }
  }

  /**
   * ログレベルに応じた絵文字を返す
   */
  private getLogEmoji(level: string): string {
    const emojiMap: Record<string, string> = {
      'debug': '🔍',
      'info': 'ℹ️',
      'warn': '⚠️',
      'error': '❌'
    };
    return emojiMap[level] || '';
  }

  /**
   * 重複ログの抑制処理
   */
  private handleSuppression(key: string, message: string, context?: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
    const now = Date.now();
    const record = this.suppressedMessages.get(key);

    if (!record) {
      // 初めてのメッセージは記録して通常出力
      this.suppressedMessages.set(key, { count: 1, lastTime: now });
      this.log(message, context, level);
      return;
    }

    // カウントを増やす
    record.count++;

    // 一定時間経過後に集計を出力
    if (now - record.lastTime > this.suppressionInterval) {
      this.log(`${key}メッセージが${record.count}回抑制されました（最後の1分間）`, context, level);
      record.count = 0;
      record.lastTime = now;
    }
  }

  /**
   * ステータスダッシュボードの描画
   */
  public renderStatusDashboard(): void {
    if (!this.config.compactMode || this.services.size === 0) return;

    this.dashboardRendered = true;

    // コンソール出力をクリアするための特殊な対応
    // Docker環境でconsole.clearが機能しない問題に対処
    if (process.stdout.isTTY) {
      // 通常のターミナルの場合はコンソールクリア
      console.clear();
    } else {
      // Dockerなどの非TTYターミナルではセパレータを出力するだけ
      console.log('\n\n\n');
    }

    // ダッシュボードのヘッダー
    console.log('==== サービスステータスダッシュボード ====');
    console.log(`最終更新: ${new Date().toLocaleString('ja-JP')}`);
    console.log('');

    const statusIcons = {
      'online': '🟢', // オンライン：緑の丸
      'offline': '⚪', // オフライン：白い丸
      'error': '🔴',   // エラー：赤い丸
      'warning': '🟡'  // 警告：黄色い丸
    };

    // サービスをステータスでソート
    const sortedServices = Array.from(this.services.values())
      .sort((a, b) => {
        // エラー > 警告 > オフライン > オンライン の順
        const statusOrder = { 'error': 0, 'warning': 1, 'offline': 2, 'online': 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      });

    sortedServices.forEach(service => {
      const statusIcon = statusIcons[service.status];
      let line = `${statusIcon} ${service.name}: ${this.getStatusText(service.status)}`;

      if (service.message) {
        line += ` - ${service.message}`;
      }

      // エラー回数があれば表示
      if (service.errorCount && service.errorCount > 0) {
        line += ` [エラー: ${service.errorCount}回/1h]`;
      }

      // 最後のエラー発生時刻があれば表示
      if (service.lastErrorTime) {
        const timeAgo = this.getTimeAgo(service.lastErrorTime);
        line += ` (最終エラー: ${timeAgo})`;
      }

      console.log(line);
    });

    console.log('');

    // 最近のエラーサマリーを表示
    if (this.errorHistory.length > 0) {
      console.log('最近のエラー:');

      // 最新の5件のエラーを表示
      const recentErrors = this.errorHistory.slice(0, 5);
      recentErrors.forEach((error, i) => {
        const timeStr = error.timestamp.toLocaleTimeString('ja-JP');
        const dateStr = error.timestamp.toLocaleDateString('ja-JP');
        console.log(`${i + 1}. [${timeStr} ${dateStr}] ${error.service}: ${error.message}`);
      });

      if (this.errorHistory.length > 5) {
        console.log(`...他 ${this.errorHistory.length - 5} 件のエラーは省略されました`);
      }

      console.log('');
    }

    console.log('─'.repeat(40));
  }

  /**
   * 経過時間を人間が読みやすい形式で返す
   */
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return `${diffSec}秒前`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}分前`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}時間前`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}日前`;
  }

  /**
   * ステータスに応じたテキストを返す
   */
  private getStatusText(status: ServiceStatus['status']): string {
    const statusTexts = {
      'online': 'オンライン',
      'offline': 'オフライン',
      'error': 'エラー',
      'warning': '警告'
    };
    return statusTexts[status] || '';
  }

  /**
   * AppErrorからエラータイプに対応するエラーメッセージを生成
   */
  public createAppError(message: string, type: ErrorType, details?: any, originalError?: Error): AppError {
    return new AppError(message, type, details, originalError);
  }

  /**
   * エラー統計のリセット
   */
  public resetErrorStats(): void {
    this.serviceErrorStats.clear();
    this.errorHistory = [];

    // サービスのエラー統計もクリア
    for (const [name, service] of this.services.entries()) {
      if (service.errorCount) {
        service.errorCount = 0;
        service.lastErrorTime = undefined;
        this.services.set(name, service);
      }
    }
  }

  /**
   * サービスステータスの一覧を取得
   * モニタリングAPIから利用するためのパブリックメソッド
   */
  public getServiceStatuses(): ServiceStatus[] {
    return Array.from(this.services.values());
  }

  /**
   * エラー履歴を取得
   * モニタリングAPIから利用するためのパブリックメソッド
   */
  public getErrorHistory(): ErrorRecord[] {
    return [...this.errorHistory];
  }
}

// 使いやすいようにエクスポート
export const logger = Logger.getInstance();