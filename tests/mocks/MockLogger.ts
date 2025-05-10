import { AppError, ErrorType } from '../../shared/errors/AppError';

/**
 * テスト用のモックロガー
 */
export class MockLogger {
  public messages: Array<{level: string, message: string, context?: string}> = [];
  public errors: Array<{message: string, error?: any, context?: string}> = [];
  public appErrors: Array<{error: AppError, context?: string}> = [];
  private services: Map<string, any> = new Map();

  constructor() {
    // 初期化
  }

  setConfig(config: any): void {
    // テスト用なので何もしない
  }

  debug(message: string, context?: string): void {
    this.messages.push({level: 'debug', message, context});
  }

  info(message: string, context?: string): void {
    this.messages.push({level: 'info', message, context});
  }

  warn(message: string, context?: string): void {
    this.messages.push({level: 'warn', message, context});
  }

  error(message: string, error?: Error | string | null, context?: string): void {
    this.errors.push({message, error, context});
    this.messages.push({level: 'error', message, context});
  }

  logAppError(appError: AppError, context?: string): void {
    this.appErrors.push({error: appError, context});
    this.messages.push({level: 'error', message: appError.message, context});
  }

  updateServiceStatus(name: string, status: string, message?: string): void {
    this.services.set(name, {name, status, message, lastUpdated: new Date()});
  }

  renderStatusDashboard(): void {
    // テスト用なので何もしない
  }

  createAppError(message: string, type: ErrorType, details?: any, originalError?: Error): AppError {
    return new AppError(message, type, details, originalError);
  }

  resetErrorStats(): void {
    this.errors = [];
    this.appErrors = [];
  }

  // テスト用のヘルパーメソッド
  getLastMessage(level?: string): string | null {
    if (level) {
      const filtered = this.messages.filter(m => m.level === level);
      return filtered.length > 0 ? filtered[filtered.length - 1].message : null;
    }
    return this.messages.length > 0 ? this.messages[this.messages.length - 1].message : null;
  }

  getMessagesByContext(context: string): Array<{level: string, message: string}> {
    return this.messages
      .filter(m => m.context === context)
      .map(({level, message}) => ({level, message}));
  }

  clear(): void {
    this.messages = [];
    this.errors = [];
    this.appErrors = [];
    this.services.clear();
  }
}

// モックロガーのシングルトンインスタンス
export const mockLogger = new MockLogger();