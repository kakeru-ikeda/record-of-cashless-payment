import { ImapFlow } from 'imapflow';
import { htmlToText } from 'html-to-text';
import { simpleParser } from 'mailparser';
import { logger } from '../../../shared/utils/Logger';
import { Environment } from '../../../shared/config/Environment';
import { AppError, ErrorType } from '../../../shared/errors/AppError';

/**
 * メールのパース結果の型定義
 */
export interface ParsedEmail {
  subject: string;
  from: string;
  body: string;
  date: Date;
  uid: string;
}

/**
 * カード会社の種類
 */
export enum CardCompany {
  MUFG = 'MUFG',        // 三菱UFJ銀行
  SMBC = 'SMBC'         // 三井住友カード
}

/**
 * IMAP接続とメール処理のサービス (imapflow実装)
 */
export class ImapEmailService {
  private client: ImapFlow | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;                       // ポーリング用タイマー
  private processedUids = new Set<string>();                               // 既処理UID管理
  private reconnectAttempts = 0;                                            // 再接続試行回数
  private isConnected = false;
  private isMonitoring = false;
  private readonly serviceContext: string;
  
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
  }
  
  /**
   * IMAPサーバーに接続
   * @param mailboxName 接続するメールボックス名
   * @param callback 新しいメールを受信した時のコールバック
   * @returns 接続したクライアント
   */
  async connect(
    mailboxName: string = 'INBOX', // デフォルトでINBOXを使用
    callback: (email: ParsedEmail) => Promise<void>
  ): Promise<ImapFlow> {
    // コンテキストをメールボックス固有に設定
    const context = `${this.serviceContext}:${mailboxName}`;
    logger.info("IMAPサーバーに接続しています...", context);
    
    try {
      // クライアントの初期化
      this.client = new ImapFlow({
        host: this.server,
        port: 993,
        secure: true,
        auth: {
          user: this.user,
          pass: this.password
        },
        logger: false,
        emitLogs: false
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
      
      // メールボックスを開く
      await this.client.mailboxOpen(targetMailbox);
      logger.info(`メールボックス "${targetMailbox}" に接続しました`, context);
      
      this.isConnected = true;
      this.reconnectAttempts = 0; // 成功したらリセット
      logger.updateServiceStatus(context, 'online', `メールボックス "${targetMailbox}" に接続`);
      
      // キープアライブとポーリングを設定
      this.setupKeepAlive(context);
      this.setupPolling(targetMailbox, callback, context);
      
      // 新規メッセージの監視を開始
      this.startMonitoring(targetMailbox, callback, context);
      
      return this.client;
    } catch (error) {
      const appError = new AppError(
        'IMAP接続中にエラーが発生しました',
        ErrorType.EMAIL,
        { mailboxName },
        error instanceof Error ? error : new Error(String(error))
      );
      logger.logAppError(appError, context);
      
      this.isConnected = false;
      logger.updateServiceStatus(context, 'error', `接続エラー: ${error instanceof Error ? error.message : String(error)}`);
      this.scheduleReconnect(mailboxName, callback, context);
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
   * 新規メッセージの監視を開始
   */
  private startMonitoring(mailboxName: string, callback: (email: ParsedEmail) => Promise<void>, context: string): void {
    if (!this.client || this.isMonitoring) return;
    
    this.isMonitoring = true;
    logger.info("メールポーリング監視を開始します（IDLEモードなし）", context);
    
    // 初回は即時実行
    this.fetchUnseenMessages(callback, context).catch(error => {
      const appError = new AppError(
        '初回メール確認中にエラーが発生しました',
        ErrorType.EMAIL,
        { mailboxName },
        error instanceof Error ? error : new Error(String(error))
      );
      logger.logAppError(appError, context);
    });
  }
  
  /**
   * 未読メッセージを取得して処理する
   */
  private async fetchUnseenMessages(callback: (email: ParsedEmail) => Promise<void>, context: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    
    try {
      // 未読メールを検索 (UNSEEN検索フラグを使用)
      const messages = await this.client.search({ seen: false });
      logger.info(`未読メール検索結果: ${messages.length} 件`, context);
      
      for (const seq of messages) {
        const key = seq.toString();
        if (this.processedUids.has(key)) continue;
        
        try {
          // メッセージをフェッチ
          const parsedEmail = await this.processEmail(key, context);
          if (parsedEmail) {
            // コールバックで処理を実行
            await callback(parsedEmail);
            
            // 処理済みとしてマーク
            this.processedUids.add(key);
            
            // メッセージを既読にマーク
            await this.markAsSeen(key, context);
            
            logger.info(`メール処理完了 UID=${key} (既読にマークしました)`, context);
          }
        } catch (error) {
          const appError = new AppError(
            `メール処理失敗 UID=${key}`,
            ErrorType.EMAIL,
            { uid: key },
            error instanceof Error ? error : new Error(String(error))
          );
          logger.logAppError(appError, context);
        }
      }
    } catch (error) {
      const appError = new AppError(
        '未読メール取得中にエラーが発生しました',
        ErrorType.EMAIL,
        null,
        error instanceof Error ? error : new Error(String(error))
      );
      logger.logAppError(appError, context);
      
      // 接続エラーの場合は接続状態を更新
      if (error instanceof Error && (
        (error as any).code === 'NoConnection' || 
        error.message.includes('Connection not available')
      )) {
        this.isConnected = false;
        logger.updateServiceStatus(context, 'error', '接続が切断されました');
      }
    }
  }

  /**
   * メッセージを既読にマークする
   * @param uid メッセージのUID
   */
  private async markAsSeen(uid: string, context: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    
    try {
      // メッセージに既読フラグを設定
      await this.client.messageFlagsAdd(uid, ['\\Seen']);
    } catch (error) {
      const appError = new AppError(
        `メッセージ ${uid} を既読にマークできませんでした`,
        ErrorType.EMAIL,
        { uid },
        error instanceof Error ? error : new Error(String(error))
      );
      logger.logAppError(appError, context);
    }
  }
  
  /**
   * IMAPサーバーに再接続
   */
  private async reconnect(mailboxName: string, callback: (email: ParsedEmail) => Promise<void>, context: string): Promise<void> {
    logger.info(`前回接続をクローズして再接続準備`, context);
    this.isMonitoring = false;
    
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
      await this.connect(mailboxName, callback);
      logger.info('reconnect(): connect() 完了', context);
    } catch (error) {
      const appError = new AppError(
        '再接続に失敗しました',
        ErrorType.EMAIL,
        { mailboxName, reconnectAttempts: this.reconnectAttempts },
        error instanceof Error ? error : new Error(String(error))
      );
      logger.logAppError(appError, context);
      
      // 再接続に失敗した場合はスケジュール
      this.scheduleReconnect(mailboxName, callback, context);
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
          logger.logAppError(appError, context);
          
          this.isConnected = false;
          logger.updateServiceStatus(context, 'error', 'KeepAliveエラー');
        }
      }
    }, 3 * 60 * 1000); // 3分ごと
  }

  /**
   * ポーリングによる未読メール取得 (1分間隔)
   */
  private setupPolling(mailboxName: string, callback: (email: ParsedEmail) => Promise<void>, context: string): void {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    
    // 1分間隔で未読メッセージをチェック
    this.pollingTimer = setInterval(async () => {
      if (this.client && this.isConnected) {
        try {
          logger.info('ポーリング: 未読メールを確認しています', context);
          await this.fetchUnseenMessages(callback, context);
        } catch (error) {
          const appError = new AppError(
            'ポーリング実行エラー',
            ErrorType.EMAIL,
            { mailboxName },
            error instanceof Error ? error : new Error(String(error))
          );
          logger.logAppError(appError, context);
          
          // 接続エラーの場合は再接続を試みる
          if (
            error instanceof Error && (
              (error as any).code === 'ECONNRESET' || 
              error.message.includes('connection') || 
              (error as any).code === 'NoConnection'
            )
          ) {
            this.isConnected = false;
            logger.updateServiceStatus(context, 'error', 'ポーリング中に接続が切断されました');
            this.scheduleReconnect(mailboxName, callback, context);
          }
        }
      } else if (!this.isConnected) {
        logger.info('接続が切れています。再接続を試みます', context);
        logger.updateServiceStatus(context, 'offline', '接続が切断されました');
        this.scheduleReconnect(mailboxName, callback, context);
      }
    }, 1 * 60 * 1000); // 1分ごと
  }

  /**
   * 再接続（指数的バックオフ）
   */
  private scheduleReconnect(mailboxName: string, callback: (email: ParsedEmail) => Promise<void>, context: string): void {
    const delay = Math.min(5 * 60 * 1000, 1000 * Math.pow(2, this.reconnectAttempts));
    logger.info(`${delay/1000}秒後に再接続を試みます (試行回数: ${this.reconnectAttempts})`, context);
    
    setTimeout(async () => {
      logger.info(`再接続処理開始 mailbox=${mailboxName} attempt=${this.reconnectAttempts}`, context);
      this.reconnectAttempts++;
      await this.reconnect(mailboxName, callback, context);
    }, delay);
  }
  
  /**
   * メールを処理してパースする
   * @param uid メッセージのUID
   * @returns パース済みのメール内容
   */
  private async processEmail(uid: string, context: string): Promise<ParsedEmail | null> {
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
        logger.logAppError(appError, context);
        return null;
      }
      
      // メールのパース
      const parsed = await simpleParser(message.source);
      
      // HTMLメールかテキストメールかを確認してボディを抽出
      let body = parsed.text || '';
      
      // HTMLからプレーンテキストに変換
      if (parsed.html) {
        body = this.convertHtmlToPlainText(parsed.html);
      }
      
      return {
        subject: parsed.subject || '',
        from: parsed.from?.text || '',
        body,
        date: parsed.date || new Date(),
        uid: uid
      };
    } catch (error) {
      const appError = new AppError(
        `メール処理中にエラーが発生しました (UID=${uid})`,
        ErrorType.EMAIL,
        { uid },
        error instanceof Error ? error : new Error(String(error))
      );
      logger.logAppError(appError, context);
      return null;
    }
  }
  
  /**
   * HTMLをプレーンテキストに変換
   * @param html HTMLテキスト
   * @returns プレーンテキスト
   */
  private convertHtmlToPlainText(html: string): string {
    return htmlToText(html, {
      wordwrap: false,
    });
  }
  
  /**
   * メールからカード利用情報を抽出
   * @param body メール本文
   * @param cardCompany カード会社の種類
   * @returns 抽出されたカード利用情報
   */
  async parseCardUsageFromEmail(body: string, cardCompany: CardCompany = CardCompany.MUFG): Promise<{
    card_name: string;
    datetime_of_use: string;
    amount: number;
    where_to_use: string;
  }> {
    const context = `${this.serviceContext}:Parser:${cardCompany}`;
    logger.info(`${cardCompany}のカード利用情報を抽出します`, context);
    
    switch (cardCompany) {
      case CardCompany.MUFG:
        return this.parseMufgEmail(body, context);
      case CardCompany.SMBC:
        return this.parseSmbcEmail(body, context);
      default:
        const appError = new AppError(
          `未対応のカード会社: ${cardCompany}`,
          ErrorType.VALIDATION,
          { cardCompany }
        );
        logger.logAppError(appError, context);
        throw appError;
    }
  }

  /**
   * 三菱UFJ銀行のメールからカード利用情報を抽出
   * @param body メール本文
   * @returns 抽出されたカード利用情報
   */
  private parseMufgEmail(body: string, context: string): {
    card_name: string;
    datetime_of_use: string;
    amount: number;
    where_to_use: string;
  } {
    // 正規表現パターン - 新しいメール形式に対応
    const cardNameMatch = body.match(/カード名称\s*：\s*(.+?)(?=\s*\n)/);
    const dateMatch = body.match(/【ご利用日時\(日本時間\)】\s*([\d年月日 :]+)/);
    const amountMatch = body.match(/【ご利用金額】\s*([\d,]+)円/);
    const whereToUseMatch = body.match(/【ご利用先】\s*([^\n]+)/);
    
    // データを抽出・整形
    const datetime_of_use = dateMatch?.[1]?.trim() || '';
    const amountStr = amountMatch?.[1]?.replace(/,/g, '') || '0';
    const card_name = cardNameMatch?.[1]?.trim() || '';
    const where_to_use = whereToUseMatch?.[1]?.trim() || '';
    
    // 抽出結果をログ出力
    logger.debug("抽出データ（MUFG）:", context);
    logger.debug(JSON.stringify({
      card_name,
      datetime_of_use,
      amount: parseInt(amountStr, 10),
      where_to_use,
    }), context);
    
    // 日付文字列をISOフォーマットに変換
    const isoDate = new Date(datetime_of_use.replace(/年|月/g, '-').replace('日', '')).toISOString();
    logger.debug("変換後日時: " + isoDate, context);
    
    return {
      card_name,
      datetime_of_use: isoDate,
      amount: parseInt(amountStr, 10),
      where_to_use,
    };
  }

  /**
   * 三井住友カードのメールからカード利用情報を抽出
   * @param body メール本文
   * @returns 抽出されたカード利用情報
   */
  private parseSmbcEmail(body: string, context: string): {
    card_name: string;
    datetime_of_use: string;
    amount: number;
    where_to_use: string;
  } {
    logger.debug("三井住友カードのメール本文解析", context);
    
    // 三井住友カードのメール形式に合わせたパターン抽出
    const cardNameMatch = body.match(/(.+のカード) 様/);
    const dateMatch = body.match(/ご利用日時：(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2})/);
    
    // より正確な利用場所と金額の抽出
    // カンマを含む金額にも対応（例: 1,500円）
    const fullUsageMatch = body.match(/ご利用日時：\d{4}\/\d{2}\/\d{2} \d{2}:\d{2} (.*?) ([\d,]+)円/);
    
    // データを抽出・整形
    const datetime_of_use = dateMatch?.[1]?.trim() || new Date().toISOString();
    const card_name = cardNameMatch?.[1]?.trim() || '三井住友カード';
    const where_to_use = fullUsageMatch?.[1]?.trim() || '不明';
    
    // 金額からカンマを削除して整数に変換
    const amountStr = fullUsageMatch?.[2]?.replace(/,/g, '') || '0';
    
    // 抽出結果をログ出力
    logger.debug("抽出データ（SMBC）:", context);
    logger.debug(JSON.stringify({
      card_name,
      datetime_of_use,
      amount: parseInt(amountStr, 10),
      where_to_use,
    }), context);
    
    // 日付文字列をISOフォーマットに変換
    let isoDate;
    try {
      // SMBCの日付形式（YYYY/MM/DD HH:MM）をISOフォーマットに変換
      isoDate = new Date(datetime_of_use.replace(/\//g, '-')).toISOString();
    } catch (error) {
      logger.warn('日付変換に失敗しました。現在時刻を使用します', context);
      logger.debug(String(error), context);
      isoDate = new Date().toISOString();
    }
    
    logger.debug("変換後日時（SMBC）: " + isoDate, context);
    
    return {
      card_name,
      datetime_of_use: isoDate,
      amount: parseInt(amountStr, 10),
      where_to_use,
    };
  }
  
  /**
   * 接続を閉じる
   */
  async close(): Promise<void> {
    const context = this.serviceContext;
    this.isMonitoring = false;
    
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    if (this.client) {
      try {
        await this.client.logout();
        logger.info('IMAP接続を安全にクローズしました', context);
        logger.updateServiceStatus(context, 'offline', '接続を閉じました');
      } catch (error) {
        const appError = new AppError(
          'IMAP接続のクローズ中にエラーが発生しました',
          ErrorType.EMAIL,
          null,
          error instanceof Error ? error : new Error(String(error))
        );
        logger.logAppError(appError, context);
      } finally {
        this.client = null;
        this.isConnected = false;
      }
    }
  }
}
