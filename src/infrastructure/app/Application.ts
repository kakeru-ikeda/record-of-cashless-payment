import { Server } from 'http';
import { HttpAppConfig } from '@infrastructure/config/HttpAppConfig';
import { DependencyContainer } from '@infrastructure/config/DependencyContainer';
import { TestRunner } from '@infrastructure/test/TestRunner';
import { logger } from '@shared/infrastructure/logging/Logger';
import { CardCompany } from '@domain/enums/CardCompany';
import { IApplication } from '@domain/interfaces/app/IApplication';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';

/**
 * アプリケーションのライフサイクル管理を担当するクラス
 */
export class Application implements IApplication {
  private server: Server | null = null;
  private dependencyContainer: DependencyContainer;
  private httpAppConfig: HttpAppConfig;

  constructor() {
    this.dependencyContainer = new DependencyContainer();
    this.httpAppConfig = new HttpAppConfig();
  }

  /**
   * アプリケーションを初期化
   */
  @ErrorHandler.errorDecorator('Application', {
    defaultMessage: 'アプリケーションの初期化に失敗しました'
  })
  public async initialize(): Promise<void> {
    // 依存関係を初期化
    await this.dependencyContainer.initialize();

    // モニタリングルートを設定
    this.httpAppConfig.setupMonitoringRoutes();

    // サービスルートを設定
    const emailController = this.dependencyContainer.getEmailController();
    this.httpAppConfig.setupServiceRoutes(emailController);

    // サーバーを起動
    this.server = this.httpAppConfig.startServer();

    logger.info('システムを起動しています', 'App', {
      notify: true,
      title: '🟢 RoCP System起動'
    });
  }

  /**
   * テストモードでアプリケーションを実行
   */
  @ErrorHandler.errorDecorator('Application', {
    defaultMessage: 'テストモードの実行に失敗しました'
  })
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
  @ErrorHandler.errorDecorator('Application', {
    defaultMessage: '通常モードの実行に失敗しました'
  })
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
  @ErrorHandler.errorDecorator('Application', {
    defaultMessage: 'アプリケーションのシャットダウンに失敗しました',
    suppressNotification: false,  // シャットダウン時のエラーは通知する
    rethrow: false  // シャットダウン時にエラーが発生しても処理を継続する
  })
  public async shutdown(): Promise<void> {
    logger.info('システムが終了処理を開始しました。メールボックス監視を停止します。', 'App', {
      notify: true,
      title: '🔴 RoCP System終了',
    });

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
  }

  /**
   * 未解決のタイマーをクリーンアップ
   */
  @ErrorHandler.errorDecorator('Application', {
    defaultMessage: 'タイマークリーンアップに失敗しました',
    rethrow: false  // クリーンアップ時のエラーは無視して処理を続行
  })
  private cleanupUnresolvedTimers(): void {
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