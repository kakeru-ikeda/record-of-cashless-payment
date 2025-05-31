import { ImapFlow } from 'imapflow';
import { logger } from '@shared/infrastructure/logging/Logger';
import { AppError, ErrorType } from '@shared/errors/AppError';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';
import { EventEmitter } from 'events';
import { IEmailClient, IImapConnectionConfig } from '@domain/interfaces/infrastructure/email/IEmailClient';

/**
 * IMAP接続管理のための型定義
 */
export interface ImapConnectionConfig extends IImapConnectionConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

/**
 * メールのパース結果の型定義
 */
export interface RawEmailMessage {
  uid: string;
  source: Buffer;
}

/**
 * IMAP接続・管理を専門に行うアダプタークラス
 * ImapFlowライブラリのラッパーとして機能し、接続管理・再接続・メール取得などの低レベル操作を担当
 */
export class ImapEmailClient extends EventEmitter implements IEmailClient {
  private client: ImapFlow | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private currentMailbox: string | null = null;
  private readonly serviceContext: string;

  /**
   * インスタンスを初期化
   * @param config IMAP接続設定
   */
  constructor(private readonly config: ImapConnectionConfig) {
    super();
    this.serviceContext = 'ImapEmailClient';
    logger.updateServiceStatus(this.serviceContext, 'offline', '初期化済み');
  }

  /**
   * IMAPサーバーに接続
   * @param mailboxName 接続するメールボックス名
   * @returns 接続したクライアント
   */
  async connect(mailboxName: string = 'INBOX'): Promise<ImapFlow> {
    const context = `${this.serviceContext}:${mailboxName}`;
    logger.info("IMAPサーバーに接続しています...", context);

    try {
      // クライアントの初期化
      this.client = new ImapFlow({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.auth.user,
          pass: this.config.auth.pass
        },
        logger: false,
        emitLogs: false
      });

      // エラーイベントをキャッチして、未処理のエラーを防ぐ
      this.client.on('error', async (err) => {
        const appError = new AppError(
          'IMAPクライアントでエラーが発生しました',
          ErrorType.EMAIL,
          { code: err.code, message: err.message },
          err
        );

        // ErrorHandlerを使用してエラーを処理（初期エラーは通知を抑制）
        await ErrorHandler.handle(appError, context, {
          suppressNotification: true, // 頻繁に発生する可能性があるので通知を抑制
          additionalInfo: { mailboxName: this.currentMailbox }
        });

        this.isConnected = false;
        logger.updateServiceStatus(context, 'error', `接続エラー: ${err.message || err}`);

        // connectionLostイベントを発生させ、再接続メカニズムをトリガーする
        this.emit('connectionLost', this.currentMailbox);

        // 明示的に再接続プロセスを開始
        this.scheduleReconnect(this.currentMailbox || mailboxName, context);
      });

      // サーバーに接続
      await this.client.connect();
      logger.info("IMAPサーバーに接続しました", context);

      // 利用可能なメールボックスの一覧を取得
      logger.info("利用可能なメールボックスを確認しています...", context);
      const mailboxes = await this.client.list();

      // 指定されたメールボックス名が存在するか確認
      const validMailboxPath = this.findMailboxPath(mailboxes, mailboxName);

      // 有効なメールボックスパスがあればそれを使用、なければ指定されたものをそのまま使用
      const targetMailbox = validMailboxPath || mailboxName;
      this.currentMailbox = targetMailbox;

      // メールボックスを開く
      await this.client.mailboxOpen(targetMailbox);
      logger.info(`メールボックス "${targetMailbox}" に接続しました`, context);

      this.isConnected = true;
      this.reconnectAttempts = 0; // 成功したらリセット
      logger.updateServiceStatus(context, 'online', `メールボックス "${targetMailbox}" に接続`);

      // キープアライブを設定
      this.setupKeepAlive(context);

      return this.client;
    } catch (error) {
      // ErrorHandlerを使用してエラーを処理
      const appError = await ErrorHandler.handle(
        new AppError(
          'IMAP接続中にエラーが発生しました',
          ErrorType.EMAIL,
          { mailboxName },
          error instanceof Error ? error : new Error(String(error))
        ),
        context,
        { suppressNotification: true } // 初期接続エラーは通知しない
      );

      this.isConnected = false;
      logger.updateServiceStatus(context, 'error', `接続エラー: ${error instanceof Error ? error.message : String(error)}`);
      this.scheduleReconnect(mailboxName, context);
      throw appError;
    }
  }

  /**
   * 指定された名前のメールボックスが利用可能かどうか確認し、パスを返す
   * @param mailboxes メールボックスの一覧
   * @param searchName 検索するメールボックス名
   * @param exactMatch 完全一致で検索するか
   * @returns 見つかった場合はメールボックスのパス、見つからなければnull
   */
  private findMailboxPath(mailboxes: any[], searchName: string, exactMatch: boolean = false): string | null {
    const context = `${this.serviceContext}:${searchName}`;

    if (!mailboxes || !mailboxes.length || !searchName) return null;

    // 検索条件に応じた比較関数
    const matchFunc = exactMatch
      ? (name: string, search: string) => name === search
      : (name: string, search: string) => name.toLowerCase().includes(search.toLowerCase());

    for (const mailbox of mailboxes) {
      // パス名または表示名で一致するか確認
      if (matchFunc(mailbox.path, searchName) || matchFunc(mailbox.name, searchName)) {
        logger.info(`メールボックス "${searchName}" が見つかりました: ${mailbox.path}`, context);
        return mailbox.path;
      }

      // 子メールボックスを再帰的に確認
      if (mailbox.children && mailbox.children.length) {
        const childResult = this.findMailboxPath(mailbox.children, searchName, exactMatch);
        if (childResult) {
          return childResult;
        }
      }
    }

    // 見つからなかった場合
    logger.warn(`メールボックス "${searchName}" は見つかりませんでした`, context);
    return null;
  }

  /**
   * 未読メッセージを取得する
   * @returns 未読メッセージの配列
   */
  @ErrorHandler.errorDecorator('fetchUnseenMessages', {
    suppressNotification: true, // 頻繁に発生する可能性がある
    rethrow: false // falseにして内部でハンドリング
  })
  async fetchUnseenMessages(): Promise<string[]> {
    const context = `${this.serviceContext}:${this.currentMailbox}`;
    if (!this.client || !this.isConnected) return [];

    try {
      // 未読メールを検索 (UNSEEN検索フラグを使用)
      const messages = await this.client.search({ seen: false });
      logger.info(`未読メール検索結果: ${messages.length} 件`, context);

      return messages.map(seq => seq.toString());
    } catch (error) {
      const appError = new AppError(
        '未読メール取得中にエラーが発生しました',
        ErrorType.EMAIL,
        null,
        error instanceof Error ? error : new Error(String(error))
      );
      logger.error(appError, context);

      // 接続エラーの場合は接続状態を更新
      if (error instanceof Error && (
        (error as any).code === 'NoConnection' ||
        error.message.includes('Connection not available')
      )) {
        this.isConnected = false;
        logger.updateServiceStatus(context, 'error', '接続が切断されました');
        this.emit('connectionLost', this.currentMailbox);

        // 明示的に再接続プロセスを開始
        this.scheduleReconnect(this.currentMailbox || 'INBOX', context);
      }

      return [];
    }
  }

  /**
   * メッセージ本体を取得する
   * @param uid メッセージのUID
   * @returns メッセージの内容
   */
  @ErrorHandler.errorDecorator('fetchMessage', {
    suppressNotification: true, // 頻繁に発生する可能性がある
    rethrow: false
  })
  async fetchMessage(uid: string): Promise<RawEmailMessage | null> {
    const context = `${this.serviceContext}:${this.currentMailbox}`;
    if (!this.client || !this.isConnected) return null;

    try {
      // メッセージ全体を取得
      const message = await this.client.fetchOne(uid, { source: true });
      if (!message || !message.source) {
        const appError = new AppError(
          `メッセージの取得に失敗しました: ${uid}`,
          ErrorType.EMAIL,
          { uid }
        );
        logger.error(appError, context);
        return null;
      }

      return {
        uid: uid,
        source: message.source
      };
    } catch (error) {
      const appError = new AppError(
        `メール取得中にエラーが発生しました (UID=${uid})`,
        ErrorType.EMAIL,
        { uid },
        error instanceof Error ? error : new Error(String(error))
      );
      logger.error(appError, context);

      // 接続エラーの場合は接続状態を更新
      if (error instanceof Error && (
        (error as any).code === 'NoConnection' ||
        error.message.includes('Connection not available')
      )) {
        this.isConnected = false;
        logger.updateServiceStatus(context, 'error', '接続が切断されました');
        this.emit('connectionLost', this.currentMailbox);

        // 明示的に再接続プロセスを開始
        this.scheduleReconnect(this.currentMailbox || 'INBOX', context);
      }

      return null;
    }
  }

  /**
   * メッセージを既読にマークする
   * @param uid メッセージのUID
   */
  @ErrorHandler.errorDecorator('markAsSeen', {
    suppressNotification: true,
    rethrow: false
  })
  async markAsSeen(uid: string): Promise<boolean> {
    const context = `${this.serviceContext}:${this.currentMailbox}`;
    if (!this.client || !this.isConnected) return false;

    try {
      // メッセージに既読フラグを設定
      await this.client.messageFlagsAdd(uid, ['\\Seen']);
      logger.info(`メール処理完了 UID=${uid} (既読にマークしました)`, context);
      return true;
    } catch (error) {
      const appError = new AppError(
        `メッセージ ${uid} を既読にマークできませんでした`,
        ErrorType.EMAIL,
        { uid },
        error instanceof Error ? error : new Error(String(error))
      );
      logger.error(appError, context);
      return false;
    }
  }

  /**
   * IMAPサーバーに再接続
   */
  @ErrorHandler.errorDecorator('reconnect', {
    suppressNotification: true, // デフォルトで通知を抑制
    rethrow: false // エラーを再スローしない
  })
  private async reconnect(mailboxName: string, context: string): Promise<void> {
    logger.info(`前回接続をクローズして再接続準備`, context);

    // 再接続タイマーをクリア（安全のため）
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      try {
        await this.client.logout();
        logger.info('既存クライアントをクローズしました', context);
      } catch (error) {
        const appError = new AppError(
          'クライアントクローズ中に警告',
          ErrorType.EMAIL,
          { mailboxName },
          error instanceof Error ? error : new Error(String(error))
        );
        logger.warn(appError.message, context);
      }
      this.client = null;
    }

    try {
      await this.connect(mailboxName);
      logger.info(`IMAP再接続処理が正常に完了しました: ${mailboxName}`, context, {
        notify: true,
        title: `🔵 IMAP再接続成功`,
      });

      // 明示的にreconnectedイベントを発火
      // connect()が成功したことを確認してから発火する
      if (this.isConnected && this.client) {
        this.emit('reconnected', mailboxName);
        logger.info(`reconnectedイベントを発火しました: ${mailboxName}`, context);
      } else {
        logger.warn(`接続状態が不安定なため、再接続処理を再試行します: ${mailboxName}`, context);
        this.scheduleReconnect(mailboxName, context);
      }
    } catch (error) {
      // 再接続に失敗した場合
      // エラーを渡して、errorDecorator内でハンドリングさせる
      const appError = new AppError(
        '再接続に失敗しました',
        ErrorType.EMAIL,
        { mailboxName, reconnectAttempts: this.reconnectAttempts },
        error instanceof Error ? error : new Error(String(error))
      );

      // スケジュール設定
      this.scheduleReconnect(mailboxName, context);

      // エラーをスローして上位のerrorDecoratorにキャッチさせる
      throw appError;
    }
  }

  /**
   * キープアライブタイマーを設定 (3分間隔)
   */
  private setupKeepAlive(context: string): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }

    this.keepAliveTimer = setInterval(async () => {
      if (this.client && this.isConnected) {
        try {
          logger.debug('KeepAlive ping送信', context);
          await this.client.noop();
        } catch (error) {
          const appError = new AppError(
            'KeepAlive中にエラーが発生しました',
            ErrorType.EMAIL,
            { command: 'noop' },
            error instanceof Error ? error : new Error(String(error))
          );

          // ErrorHandlerを使用してエラーを処理
          await ErrorHandler.handle(appError, context, {
            suppressNotification: true, // 通常のKeepAliveエラーは通知を抑制
            additionalInfo: { mailboxName: this.currentMailbox }
          });

          this.isConnected = false;
          logger.updateServiceStatus(context, 'error', 'KeepAliveエラー');
          this.emit('connectionLost', this.currentMailbox);

          // 明示的に再接続プロセスを開始
          this.scheduleReconnect(this.currentMailbox || 'INBOX', context);
        }
      }
    }, 3 * 60 * 1000); // 3分ごと
  }

  /**
   * 再接続（指数的バックオフ）
   */
  private scheduleReconnect(mailboxName: string, context: string): void {
    // すでに再接続タイマーが設定されている場合はクリア
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const delay = Math.min(5 * 60 * 1000, 1000 * Math.pow(2, this.reconnectAttempts));
    logger.info(`${delay / 1000}秒後に再接続を試みます (試行回数: ${this.reconnectAttempts})`, context);

    // 再接続試行回数が閾値を超えたらDiscord通知を行う
    if (this.reconnectAttempts >= 3) {
      // 重大な接続問題として通知
      ErrorHandler.handle(
        new AppError(
          '複数回の再接続に失敗しました',
          ErrorType.EMAIL,
          { mailboxName, reconnectAttempts: this.reconnectAttempts }
        ),
        context,
        { suppressNotification: false } // 明示的に通知を有効化
      ).catch(err => {
        logger.warn(`再接続エラー通知中に問題が発生しました: ${err}`, context);
      });
    }

    this.reconnectTimer = setTimeout(async () => {
      logger.info(`再接続処理開始 mailbox=${mailboxName} attempt=${this.reconnectAttempts}`, context);
      this.reconnectAttempts++;
      await this.reconnect(mailboxName, context);
    }, delay);
  }

  /**
   * 接続がアクティブかどうか確認
   */
  isActive(): boolean {
    return this.isConnected;
  }

  /**
   * 接続を閉じる
   */
  async close(): Promise<void> {
    const context = this.serviceContext;

    // キープアライブタイマーをクリア
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }

    // 再接続タイマーをクリア
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      try {
        // エラーイベントリスナーを削除
        this.client.removeAllListeners('error');

        // 接続が既にない場合はlogoutをスキップ
        if (this.isConnected) {
          await this.client.logout();
          logger.info('IMAP接続を安全にクローズしました', context);
        } else {
          logger.info('IMAP接続は既に切断されています', context);
        }
        logger.updateServiceStatus(context, 'offline', '接続を閉じました');
      } catch (error) {
        const appError = new AppError(
          'IMAP接続のクローズ中にエラーが発生しました',
          ErrorType.EMAIL,
          null,
          error instanceof Error ? error : new Error(String(error))
        );
        await ErrorHandler.handle(appError, context, {
          suppressNotification: true // クローズ時のエラーは通知しない
        });
      } finally {
        this.client = null;
        this.isConnected = false;
      }
    }
  }
}