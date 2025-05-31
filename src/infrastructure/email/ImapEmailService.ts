import { logger } from '@shared/infrastructure/logging/Logger';
import { Environment } from '@shared/infrastructure/config/Environment';
import { AppError, ErrorType } from '@shared/errors/AppError';
import { ImapEmailClient, ImapConnectionConfig } from '@infrastructure/email/ImapEmailClient';
import { EmailParser, ParsedEmail } from '@infrastructure/email/EmailParser';
import { CardUsageExtractor } from '@infrastructure/email/CardUsageExtractor';
import { IEmailService } from '@domain/interfaces/infrastructure/email/IEmailService';
import { CardCompany } from '@domain/enums/CardCompany';
import { CardUsage } from '@shared/domain/entities/CardUsage';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';

/**
 * IMAP接続とメール処理のサービス
 * メール監視、メール解析、カード利用情報抽出のフローを調整
 */
export class ImapEmailService implements IEmailService {
  private imapClient: ImapEmailClient;
  private emailParser: EmailParser;
  private cardUsageExtractor: CardUsageExtractor;
  private pollingTimer: NodeJS.Timeout | null = null;
  private processedUids = new Set<string>();
  private isMonitoring = false;
  private readonly serviceContext: string;

  // 再接続のために最後の接続情報を保持
  private _lastConnectedMailbox: string | null = null;
  private _lastCallback: ((email: ParsedEmail) => Promise<void>) | null = null;

  /**
   * インスタンスを初期化
   * @param server IMAPサーバー
   * @param user ユーザー名
   * @param password パスワード
   */
  constructor(
    private readonly server: string = Environment.IMAP_SERVER,
    private readonly user: string = Environment.IMAP_USER,
    private readonly password: string = Environment.IMAP_PASSWORD
  ) {
    this.serviceContext = 'ImapEmailService';
    logger.updateServiceStatus(this.serviceContext, 'offline', '初期化済み');

    // 依存オブジェクトの初期化
    const config: ImapConnectionConfig = {
      host: this.server,
      port: 993,
      secure: true,
      auth: {
        user: this.user,
        pass: this.password
      }
    };

    this.imapClient = new ImapEmailClient(config);
    this.emailParser = new EmailParser();
    this.cardUsageExtractor = new CardUsageExtractor();

    // 接続イベントの監視
    this.imapClient.on('connectionLost', (mailboxName) => {
      logger.warn(`接続が切断されました: ${mailboxName}`, this.serviceContext);

      // 接続状態を更新
      this.isMonitoring = false;

      // ポーリングタイマーが動いていれば停止（再接続後に再設定する）
      if (this.pollingTimer) {
        clearInterval(this.pollingTimer);
        this.pollingTimer = null;
      }

      // ImapEmailClientの自動再接続機能が動作するため、
      // ここでは追加のアクションは不要です。
      // ImapEmailClientはscheduleReconnectメソッドを内部で呼び出し、
      // 指数バックオフに基づいて再接続を試みます。
      // 再接続成功時にreconnectedイベントが発火します。
      logger.info(`IMAPクライアントの自動再接続プロセスが開始されるのを待機しています: ${mailboxName}`, this.serviceContext);
    });

    this.imapClient.on('reconnected', (mailboxName) => {
      logger.info(`再接続に成功しました: ${mailboxName}`, this.serviceContext);

      // 再接続後に監視を再開
      if (this._lastConnectedMailbox && this._lastCallback) {
        logger.info(`メール監視を再開します: ${mailboxName}`, this.serviceContext);
        this.startMonitoring(this._lastCallback, `${this.serviceContext}:${this._lastConnectedMailbox}`);

        // 再接続後に即時メール確認を実行
        this.pollForNewMessages(this._lastCallback, `${this.serviceContext}:${this._lastConnectedMailbox}`)
          .catch(error => {
            const appError = new AppError(
              '再接続後のメール確認中にエラーが発生しました',
              ErrorType.EMAIL,
              { mailboxName },
              error instanceof Error ? error : new Error(String(error))
            );
            logger.error(appError, this.serviceContext);
          });
      } else {
        logger.warn('前回の接続情報がないため、監視を再開できません', this.serviceContext);
      }
    });
  }

  /**
   * IMAPサーバーに接続し、メールの監視を開始
   * @param mailboxName 接続するメールボックス名
   * @param callback 新しいメールを受信した時のコールバック
   */
  async connect(
    mailboxName: string = 'INBOX', // デフォルトでINBOXを使用
    callback: (email: ParsedEmail) => Promise<void>
  ): Promise<void> {
    // コンテキストをメールボックス固有に設定
    const context = `${this.serviceContext}:${mailboxName}`;

    try {
      // 接続情報を保存（再接続時に使用）
      this._lastConnectedMailbox = mailboxName;
      this._lastCallback = callback;

      // IMAPクライアントで接続
      await this.imapClient.connect(mailboxName);

      // メール監視を開始
      this.startMonitoring(callback, context);
    } catch (error) {
      const appError = new AppError(
        'メール監視サービスの開始に失敗しました',
        ErrorType.EMAIL,
        { mailboxName },
        error instanceof Error ? error : new Error(String(error))
      );
      logger.error(appError, context);
      throw appError;
    }
  }

  /**
   * 新規メッセージの監視を開始
   */
  private startMonitoring(callback: (email: ParsedEmail) => Promise<void>, context: string): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    logger.info("メールポーリング監視を開始します（IDLEモードなし）", context);

    // 初回は即時実行
    this.pollForNewMessages(callback, context).catch(error => {
      const appError = new AppError(
        '初回メール確認中にエラーが発生しました',
        ErrorType.EMAIL,
        {},
        error instanceof Error ? error : new Error(String(error))
      );
      logger.error(appError, context);
    });

    // ポーリングタイマーの設定
    this.setupPolling(callback, context);
  }

  /**
   * ポーリングによる未読メール取得 (1分間隔)
   */
  private setupPolling(callback: (email: ParsedEmail) => Promise<void>, context: string): void {
    if (this.pollingTimer) clearInterval(this.pollingTimer);

    // 1分間隔で未読メッセージをチェック
    this.pollingTimer = setInterval(async () => {
      if (this.imapClient.isActive()) {
        try {
          logger.info('ポーリング: 未読メールを確認しています', context);
          await this.pollForNewMessages(callback, context);
        } catch (error) {
          const appError = new AppError(
            'ポーリング実行エラー',
            ErrorType.EMAIL,
            {},
            error instanceof Error ? error : new Error(String(error))
          );
          logger.error(appError, context);
        }
      }
    }, 1 * 60 * 1000); // 1分ごと
  }

  /**
   * 未読メッセージを取得して処理する
   */
  private async pollForNewMessages(callback: (email: ParsedEmail) => Promise<void>, context: string): Promise<void> {
    // 未読メールのUID一覧を取得
    const messageUids = await this.imapClient.fetchUnseenMessages();

    for (const uid of messageUids) {
      if (this.processedUids.has(uid)) continue;

      try {
        // メッセージ本文を取得
        const rawMessage = await this.imapClient.fetchMessage(uid);
        if (!rawMessage) continue;

        // メールのパース
        const parsedEmail = await this.emailParser.parseEmail(rawMessage);
        if (parsedEmail) {
          // コールバックで処理を実行
          await callback(parsedEmail);

          // 処理済みとしてマーク
          this.processedUids.add(uid);

          // メッセージを既読にマーク
          await this.imapClient.markAsSeen(uid);
        }
      } catch (error) {
        const appError = new AppError(
          `メール処理失敗 UID=${uid}`,
          ErrorType.EMAIL,
          { uid },
          error instanceof Error ? error : new Error(String(error))
        );
        logger.error(appError, context);
      }
    }
  }

  /**
   * メールからカード利用情報を抽出
   * @param emailContent メール本文
   * @param cardCompany カード会社の種類
   * @returns 抽出されたカード利用情報
   */
  @ErrorHandler.errorDecorator('ImapEmailService', {
    defaultMessage: 'メールからカード利用情報の抽出に失敗しました',
    rethrow: true
  })
  async parseCardUsageFromEmail(emailContent: string, cardCompany: CardCompany = CardCompany.MUFG): Promise<CardUsage> {
    // カード利用情報の抽出
    return this.cardUsageExtractor.extractFromEmailBody(emailContent, cardCompany);
  }

  /**
   * 接続を閉じる
   */
  async close(): Promise<void> {
    this.isMonitoring = false;

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    await this.imapClient.close();
    logger.updateServiceStatus(this.serviceContext, 'offline', '接続を閉じました');
  }
}
