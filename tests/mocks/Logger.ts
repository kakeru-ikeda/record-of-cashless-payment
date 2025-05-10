import { mockLogger } from './MockLogger';
import { AppError, ErrorType } from '../../shared/errors/AppError';

// 元のLogLevelの定義をエクスポート
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

// ServiceStatusの型定義
export interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'error' | 'warning';
  message?: string;
  lastUpdated: Date;
  errorCount?: number;
  lastErrorTime?: Date;
}

// モックロガーをエクスポート
export const logger = mockLogger;

// LoggerクラスをモックImplementationとして提供
export class Logger {
  private static instance = mockLogger;
  
  static getInstance(): any {
    return Logger.instance;
  }
  
  // その他のメソッドもモックロガーに委譲
  setConfig(config: any): void {
    return mockLogger.setConfig(config);
  }
  
  debug(message: string, context?: string): void {
    return mockLogger.debug(message, context);
  }
  
  info(message: string, context?: string): void {
    return mockLogger.info(message, context);
  }
  
  warn(message: string, context?: string): void {
    return mockLogger.warn(message, context);
  }
  
  error(message: string, error?: any, context?: string): void {
    return mockLogger.error(message, error, context);
  }
  
  logAppError(appError: AppError, context?: string): void {
    return mockLogger.logAppError(appError, context);
  }
  
  updateServiceStatus(name: string, status: string, message?: string): void {
    return mockLogger.updateServiceStatus(name, status, message);
  }
  
  renderStatusDashboard(): void {
    return mockLogger.renderStatusDashboard();
  }
  
  createAppError(message: string, type: ErrorType, details?: any, originalError?: Error): AppError {
    return mockLogger.createAppError(message, type, details, originalError);
  }
}