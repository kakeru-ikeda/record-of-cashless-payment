import chalk from 'chalk';
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
   * DEBUGレベルのログを出力
   */
  public debug(message: string, context?: string): void {
    if (this.config.level <= LogLevel.DEBUG) {
      this.log(message, context, 'debug');
    }
  }
  
  /**
   * INFOレベルのログを出力
   */
  public info(message: string, context?: string): void {
    if (this.config.level <= LogLevel.INFO) {
      // ポーリングログの抑制
      if (this.config.suppressPolling && message.includes('ポーリング')) {
        this.handleSuppression('polling', message, context);
        return;
      }
      this.log(message, context, 'info');
    }
  }
  
  /**
   * WARNレベルのログを出力
   */
  public warn(message: string, context?: string): void {
    if (this.config.level <= LogLevel.WARN) {
      this.log(message, context, 'warn');
    }
  }
  
  /**
   * ERRORレベルのログを出力
   * @param message エラーメッセージ
   * @param error エラーオブジェクトまたはエラーメッセージ
   * @param context エラーのコンテキスト
   */
  public error(message: string, error?: Error | string | null, context?: string): void {
    if (this.config.level <= LogLevel.ERROR) {
      this.log(message, context, 'error');
      
      // エラー統計の更新
      if (context) {
        this.updateErrorStats(context);
      }
      
      // エラー履歴に追加
      this.addErrorRecord({
        timestamp: new Date(),
        service: context || 'unknown',
        message,
        details: error instanceof Error ? error.message : error
      });
      
      // エラーオブジェクトの処理
      if (error) {
        if (error instanceof AppError) {
          // AppErrorの場合は専用のフォーマットを使用
          console.error(chalk.red(error.toLogString()));
        } else if (error instanceof Error) {
          // 通常のErrorオブジェクト
          console.error(chalk.red(error.stack || error.message));
        } else {
          // 文字列の場合
          console.error(chalk.red(error));
        }
      }
      
      // サービスステータスを更新
      if (context) {
        this.updateServiceStatus(context, 'error', message);
      }
    }
  }

  /**
   * AppErrorを使ったエラーログ出力
   * @param appError AppErrorオブジェクト
   * @param context コンテキスト
   */
  public logAppError(appError: AppError, context?: string): void {
    if (this.config.level <= LogLevel.ERROR) {
      this.log(appError.message, context, 'error');
      console.error(chalk.red(appError.toLogString()));
      
      const serviceContext = context || 'unknown';
      
      // エラー統計の更新
      this.updateErrorStats(serviceContext);
      
      // エラー履歴に追加
      this.addErrorRecord({
        timestamp: new Date(),
        service: serviceContext,
        message: appError.message,
        errorType: appError.type,
        details: appError.details
      });
      
      if (context) {
        this.updateServiceStatus(context, 'error', appError.message);
      }
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
    const colorMap = {
      'debug': chalk.blue,
      'info': chalk.green,
      'warn': chalk.yellow,
      'error': chalk.red
    };
    const emoji = this.getLogEmoji(level);
    
    let colorFunc = colorMap[level];
    let contextStr = context ? `[${context}]` : '';
    
    // コンパクトモードではなければ通常のログ出力
    if (!this.config.compactMode) {
      console.log(`${colorFunc(timestamp)} ${emoji} ${colorFunc(level.toUpperCase())} ${chalk.cyan(contextStr)} ${message}`);
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
  private handleSuppression(key: string, message: string, context?: string): void {
    const now = Date.now();
    const record = this.suppressedMessages.get(key);
    
    if (!record) {
      // 初めてのメッセージは記録して通常出力
      this.suppressedMessages.set(key, { count: 1, lastTime: now });
      this.log(message, context, 'debug');
      return;
    }
    
    // カウントを増やす
    record.count++;
    
    // 一定時間経過後に集計を出力
    if (now - record.lastTime > this.suppressionInterval) {
      this.log(`${key}メッセージが${record.count}回抑制されました（最後の1分間）`, context, 'debug');
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
    console.log(chalk.bold.cyan('==== サービスステータスダッシュボード ===='));
    console.log(`${chalk.gray('最終更新:')} ${new Date().toLocaleString('ja-JP')}`);
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
      let line = `${statusIcon} ${chalk.bold(service.name)}: ${this.getStatusText(service.status)}`;
      
      if (service.message) {
        line += ` - ${service.message}`;
      }
      
      // エラー回数があれば表示
      if (service.errorCount && service.errorCount > 0) {
        line += ` ${chalk.red(`[エラー: ${service.errorCount}回/1h]`)}`;
      }
      
      // 最後のエラー発生時刻があれば表示
      if (service.lastErrorTime) {
        const timeAgo = this.getTimeAgo(service.lastErrorTime);
        line += ` ${chalk.gray(`(最終エラー: ${timeAgo})`)}`;
      }
      
      console.log(line);
    });
    
    console.log('');
    
    // 最近のエラーサマリーを表示
    if (this.errorHistory.length > 0) {
      console.log(chalk.red.bold('最近のエラー:'));
      
      // 最新の5件のエラーを表示
      const recentErrors = this.errorHistory.slice(0, 5);
      recentErrors.forEach((error, i) => {
        const timeStr = error.timestamp.toLocaleTimeString('ja-JP');
        const dateStr = error.timestamp.toLocaleDateString('ja-JP');
        console.log(chalk.red(`${i+1}. [${timeStr} ${dateStr}] ${error.service}: ${error.message}`));
      });
      
      if (this.errorHistory.length > 5) {
        console.log(chalk.gray(`...他 ${this.errorHistory.length - 5} 件のエラーは省略されました`));
      }
      
      console.log('');
    }
    
    console.log(chalk.gray('─'.repeat(40)));
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
      'online': chalk.green('オンライン'),
      'offline': chalk.gray('オフライン'),
      'error': chalk.red('エラー'),
      'warning': chalk.yellow('警告')
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