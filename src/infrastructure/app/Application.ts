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
    
    // Discordにシステム起動通知を送信
    try {
      const discordNotifier = this.dependencyContainer.getDiscordNotifier();
      await discordNotifier.notifyLogging(
        'システムがメールボックス監視を開始しました。カード利用の通知を待機しています。',
        '📨 メール監視開始',
        'App'
      );
    } catch (error) {
      logger.warn('Discord通知の送信に失敗しました', 'App');
    }
    
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
      // Discordにシステム終了通知を送信
      try {
        const discordNotifier = this.dependencyContainer.getDiscordNotifier();
        await discordNotifier.notifyLogging(
          'システムが終了処理を開始しました。メールボックス監視を停止します。',
          '🛑 システム終了',
          'App'
        );
      } catch (error) {
        logger.warn('Discord終了通知の送信に失敗しました', 'App');
      }
      
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
      
      // 残っているタイマーをクリーンアップ
      this.cleanupUnresolvedTimers();
      
      logger.info('アプリケーションが正常に終了しました', 'App');
    } catch (error) {
      logger.error('シャットダウン中にエラーが発生しました', error, 'App');
    }
  }
  
  /**
   * 未解決のタイマーをクリーンアップ
   */
  private cleanupUnresolvedTimers(): void {
    try {
      // アクティブなハンドルを取得
      // @ts-ignore - process._getActiveHandles は非公開APIだがタイマークリーンアップに必要
      const activeHandles = process._getActiveHandles ? process._getActiveHandles() : [];
      
      // タイマーとインターバルをカウント
      let timersCount = 0;
      
      // タイマーをクリア
      for (const handle of activeHandles) {
        if (handle && typeof handle === 'object' && handle.constructor) {
          // @ts-ignore - 型定義エラーを無視
          if (handle.constructor.name === 'Timeout') {
            // @ts-ignore
            clearTimeout(handle);
            timersCount++;
          } 
          // @ts-ignore
          else if (handle.constructor.name === 'Interval') {
            // @ts-ignore
            clearInterval(handle);
            timersCount++;
          }
        }
      }
      
      if (timersCount > 0) {
        logger.info(`${timersCount}個の未解決タイマーをクリーンアップしました`, 'App');
      }
    } catch (error) {
      logger.warn('タイマークリーンアップ中にエラーが発生しました', 'App');
    }
    
    // 確実にプロセスを終了させるために10秒後に強制終了
    setTimeout(() => {
      logger.info('残っているリソースをクリーンアップするため、プロセスを終了します', 'App');
      process.exit(0);
    }, 10000);
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