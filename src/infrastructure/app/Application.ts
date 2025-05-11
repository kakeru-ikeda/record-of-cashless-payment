import { Server } from 'http';
import { AppConfig } from '../config/AppConfig';
import { DependencyContainer } from '../config/DependencyContainer';
import { TestRunner } from '../test/TestRunner';
import { logger } from '../../../shared/utils/Logger';
import { CardCompany } from '../email/ImapEmailService';

/**
 * アプリケーションのライフサイクル管理を担当するクラス
 */
export class Application {
  private server: Server | null = null;
  private dependencyContainer: DependencyContainer;
  private appConfig: AppConfig;
  
  constructor() {
    this.dependencyContainer = new DependencyContainer();
    this.appConfig = new AppConfig();
  }
  
  /**
   * アプリケーションを初期化
   */
  public async initialize(): Promise<void> {
    // 依存関係を初期化
    await this.dependencyContainer.initialize();
    
    // モニタリングルートを設定
    this.appConfig.setupMonitoringRoutes();
    
    // サービスルートを設定
    const emailController = this.dependencyContainer.getEmailController();
    this.appConfig.setupServiceRoutes(emailController);
    
    // サーバーを起動
    this.server = this.appConfig.startServer();
  }
  
  /**
   * テストモードでアプリケーションを実行
   */
  public async runInTestMode(cardCompany: CardCompany): Promise<void> {
    logger.info('メール通知サービスをテストモードで起動します', 'App');
    
    const testRunner = new TestRunner(
      this.dependencyContainer.getProcessEmailUseCase()
    );
    
    await testRunner.runSampleMailTest(cardCompany);
  }
  
  /**
   * 通常モードでアプリケーションを実行（メール監視）
   */
  public async runInNormalMode(): Promise<void> {
    logger.info('メール監視モードで実行しています...', 'App');
    
    // すべてのメールボックス（三菱UFJ銀行、三井住友カード）を監視
    const emailController = this.dependencyContainer.getEmailController();
    await emailController.startAllMonitoring();
    
    // プロセス終了時のクリーンアップ
    this.setupShutdownHooks();
    
    // 最後にステータスダッシュボードを表示（コンパクトモードの場合）
    this.renderStatusDashboardIfCompactMode();
  }
  
  /**
   * シャットダウン時の処理を設定
   */
  private setupShutdownHooks(): void {
    process.on('SIGINT', async () => {
      await this.shutdown();
    });
    
    process.on('SIGTERM', async () => {
      await this.shutdown();
    });
  }
  
  /**
   * アプリケーションのシャットダウン処理
   */
  public async shutdown(): Promise<void> {
    logger.info('アプリケーションを終了しています...', 'App');
    
    try {
      // メール監視を停止
      const emailController = this.dependencyContainer.getEmailController();
      await emailController.stopMonitoring();
      
      // HTTPサーバーを停止
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server!.close(() => {
            logger.info('HTTPサーバーを停止しました', 'HttpServer');
            resolve();
          });
        });
      }
      
      logger.info('アプリケーションが正常に終了しました', 'App');
    } catch (error) {
      logger.error('シャットダウン中にエラーが発生しました', error, 'App');
    }
  }
  
  /**
   * コンパクトモードの場合にステータスダッシュボードを表示
   */
  private renderStatusDashboardIfCompactMode(): void {
    if (process.env.COMPACT_LOGS === 'true') {
      // 少し待ってからダッシュボードを表示（すべてのステータスが更新される時間を与える）
      setTimeout(() => {
        logger.renderStatusDashboard();
      }, 1000);
    }
  }
}