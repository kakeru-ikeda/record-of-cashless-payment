import { ImapFlow } from 'imapflow';
import * as quotedPrintable from 'quoted-printable';
import * as Encoding from 'encoding-japanese';
import { htmlToText } from 'html-to-text';
import { Environment } from '../config/environment';
import { simpleParser } from 'mailparser';

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
  ) {}
  
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
    console.log("IMAPサーバーに接続しています...");
    
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
      console.log("✅ IMAPサーバーに接続しました");
      
      // 利用可能なメールボックスの一覧を取得
      console.log("📬 利用可能なメールボックスを確認しています...");
      const mailboxes = await this.client.list();
      
      // 指定されたメールボックス名が存在するか確認
      const validMailboxPath = this.findMailboxPath(mailboxes, mailboxName);
      
      // 有効なメールボックスパスがあればそれを使用、なければ指定されたものをそのまま使用
      const targetMailbox = validMailboxPath || mailboxName;
      
      // メールボックスを開く
      await this.client.mailboxOpen(targetMailbox);
      console.log(`✅ メールボックス "${targetMailbox}" に接続しました`);
      
      this.isConnected = true;
      this.reconnectAttempts = 0; // 成功したらリセット
      
      // キープアライブとポーリングを設定
      this.setupKeepAlive();
      this.setupPolling(targetMailbox, callback);
      
      // 新規メッセージの監視を開始
      this.startMonitoring(targetMailbox, callback);
      
      return this.client;
    } catch (error) {
      console.error('❌ IMAP接続中にエラーが発生しました:', error);
      this.isConnected = false;
      this.scheduleReconnect(mailboxName, callback);
      throw error;
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
    if (!mailboxes || !mailboxes.length || !searchName) return null;
    
    // 検索条件に応じた比較関数
    const matchFunc = exactMatch 
      ? (name: string, search: string) => name === search
      : (name: string, search: string) => name.toLowerCase().includes(search.toLowerCase());
    
    for (const mailbox of mailboxes) {
      // パス名または表示名で一致するか確認
      if (matchFunc(mailbox.path, searchName) || matchFunc(mailbox.name, searchName)) {
        console.log(`✅ メールボックス "${searchName}" が見つかりました: ${mailbox.path}`);
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
    console.log(`⚠️ メールボックス "${searchName}" は見つかりませんでした`);
    return null;
  }
  
  /**
   * 新規メッセージの監視を開始
   */
  private startMonitoring(mailboxName: string, callback: (email: ParsedEmail) => Promise<void>): void {
    if (!this.client || this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // IDLEモードを使用した監視
    (async () => {
      try {
        while (this.isMonitoring && this.client && this.isConnected) {
          try {
            console.log("👀 新規メッセージの監視を開始します");
            const updates = await this.client.idle();
            
            // updatesがtrueの場合は新しいメッセージがある可能性がある
            if (updates) {
              console.log(`📩 新しいメールを検出しました`);
              // 未読メッセージを検索して処理
              await this.fetchUnseenMessages(callback);
            }
          } catch (error) {
            console.error('❌ 監視中にエラーが発生しました:', error);
            if (!this.isConnected) break;
            // 短い待機時間の後に再開
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      } catch (error) {
        console.error('❌ 監視ループでエラーが発生しました:', error);
        this.isMonitoring = false;
        // 接続が切れた場合は再接続
        if (this.isConnected) {
          this.scheduleReconnect(mailboxName, callback);
        }
      }
    })();
  }
  
  /**
   * 未読メッセージを取得して処理する
   */
  private async fetchUnseenMessages(callback: (email: ParsedEmail) => Promise<void>): Promise<void> {
    if (!this.client || !this.isConnected) return;
    
    try {
      // 未読メールを検索 (UNSEEN検索フラグを使用)
      const messages = await this.client.search({ seen: false });
      console.log(`🔎 未読メール検索結果: ${messages.length} 件`);
      
      for (const seq of messages) {
        const key = seq.toString();
        if (this.processedUids.has(key)) continue;
        
        try {
          // メッセージをフェッチ
          const parsedEmail = await this.processEmail(key);
          if (parsedEmail) {
            // コールバックで処理を実行
            await callback(parsedEmail);
            
            // 処理済みとしてマーク
            this.processedUids.add(key);
            
            // メッセージを既読にマーク
            await this.markAsSeen(key);
            
            console.log(`✅ メール処理完了 UID=${key} (既読にマークしました)`);
          }
        } catch (error) {
          console.error(`❌ メール処理失敗 UID=${key}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ 未読メール取得中にエラーが発生しました:', error);
    }
  }

  /**
   * メッセージを既読にマークする
   * @param uid メッセージのUID
   */
  private async markAsSeen(uid: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    
    try {
      // メッセージに既読フラグを設定
      await this.client.messageFlagsAdd(uid, ['\\Seen']);
    } catch (error) {
      console.error(`❌ メッセージ ${uid} を既読にマークできませんでした:`, error);
    }
  }
  
  /**
   * IMAPサーバーに再接続
   */
  private async reconnect(mailboxName: string, callback: (email: ParsedEmail) => Promise<void>): Promise<void> {
    console.log(`🔌 reconnect(): 前回接続をクローズして再接続準備`);
    this.isMonitoring = false;
    
    if (this.client) {
      try {
        await this.client.logout();
        console.log('🔌 既存クライアントをクローズしました');
      } catch (error) {
        console.warn('⚠️ クライアントクローズ中に警告:', error);
      }
      this.client = null;
    }
    
    try {
      await this.connect(mailboxName, callback);
      console.log('🔌 reconnect(): connect() 完了');
    } catch (error) {
      console.error('❌ 再接続に失敗しました:', error);
      // 再接続に失敗した場合はスケジュール
      this.scheduleReconnect(mailboxName, callback);
    }
  }
  
  /**
   * キープアライブタイマーを設定 (3分間隔)
   */
  private setupKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }
    
    this.keepAliveTimer = setInterval(async () => {
      if (this.client && this.isConnected) {
        try {
          console.log('🔔 KeepAlive ping送信');
          await this.client.noop();
        } catch (error) {
          console.error('❌ KeepAlive中にエラーが発生しました:', error);
          this.isConnected = false;
        }
      }
    }, 3 * 60 * 1000); // 3分ごと
  }

  /**
   * ポーリングによる未読メール取得 (3分間隔)
   */
  private setupPolling(mailboxName: string, callback: (email: ParsedEmail) => Promise<void>): void {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    
    this.pollingTimer = setInterval(async () => {
      if (this.client && this.isConnected) {
        try {
          console.log('🔎 ポーリング: 未読メールを確認しています');
          await this.fetchUnseenMessages(callback);
        } catch (error) {
          console.error('❌ ポーリング実行エラー:', error);
          
          // 接続エラーの場合は再接続を試みる
          if (error.code === 'ECONNRESET' || error.message.includes('connection')) {
            this.isConnected = false;
            this.scheduleReconnect(mailboxName, callback);
          }
        }
      } else if (!this.isConnected) {
        console.log('🔌 接続が切れています。再接続を試みます');
        this.scheduleReconnect(mailboxName, callback);
      }
    }, 3 * 60 * 1000); // 3分ごと
  }

  /**
   * 再接続（指数的バックオフ）
   */
  private scheduleReconnect(mailboxName: string, callback: (email: ParsedEmail) => Promise<void>): void {
    const delay = Math.min(5 * 60 * 1000, 1000 * Math.pow(2, this.reconnectAttempts));
    console.log(`🔄 ${delay/1000}秒後に再接続を試みます (試行回数: ${this.reconnectAttempts})`);
    
    setTimeout(async () => {
      console.log(`⚙️ 再接続処理開始 mailbox=${mailboxName} attempt=${this.reconnectAttempts}`);
      this.reconnectAttempts++;
      await this.reconnect(mailboxName, callback);
    }, delay);
  }
  
  /**
   * メールを処理してパースする
   * @param uid メッセージのUID
   * @returns パース済みのメール内容
   */
  private async processEmail(uid: string): Promise<ParsedEmail | null> {
    if (!this.client || !this.isConnected) return null;
    
    try {
      // メッセージ全体を取得
      const message = await this.client.fetchOne(uid, { source: true });
      if (!message || !message.source) {
        console.error(`❌ メッセージの取得に失敗しました: ${uid}`);
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
      console.error(`❌ メール処理中にエラーが発生しました (UID=${uid}):`, error);
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
    console.log(`🔍 ${cardCompany}のカード利用情報を抽出します`);
    
    switch (cardCompany) {
      case CardCompany.MUFG:
        return this.parseMufgEmail(body);
      case CardCompany.SMBC:
        return this.parseSmbcEmail(body);
      default:
        throw new Error(`未対応のカード会社: ${cardCompany}`);
    }
  }

  /**
   * 三菱UFJ銀行のメールからカード利用情報を抽出
   * @param body メール本文
   * @returns 抽出されたカード利用情報
   */
  private parseMufgEmail(body: string): {
    card_name: string;
    datetime_of_use: string;
    amount: number;
    where_to_use: string;
  } {
    // 正規表現パターン
    const cardNameMatch = body.match(/カード名称[　\s]+：[　\s]+(.+?)(?=[\s\n]いつも|$)/);
    const dateMatch = body.match(/【ご利用日時\(日本時間\)】[　\s]+([\d年月日 :]+)/);
    const amountMatch = body.match(/【ご利用金額】[　\s]+([\d,]+)円/);
    const whereToUseMatch = body.match(/【ご利用先】[　\s]+([^。\n]+?)(?=[\s\n]ご利用先名等|$)/);
    
    // データを抽出・整形
    const datetime_of_use = dateMatch?.[1]?.trim() || '';
    const amountStr = amountMatch?.[1]?.replace(/,/g, '') || '0';
    const card_name = cardNameMatch?.[1]?.trim() || '';
    const where_to_use = whereToUseMatch?.[1]?.trim() || '';
    
    // 抽出結果をログ出力
    console.log("抽出データ（MUFG）:", {
      card_name,
      datetime_of_use,
      amount: parseInt(amountStr, 10),
      where_to_use,
    });
    
    // 日付文字列をISOフォーマットに変換
    const isoDate = new Date(datetime_of_use.replace(/年|月/g, '-').replace('日', '')).toISOString();
    console.log("変換後日時:", isoDate);
    
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
  private parseSmbcEmail(body: string): {
    card_name: string;
    datetime_of_use: string;
    amount: number;
    where_to_use: string;
  } {
    console.log("三井住友カードのメール本文:", body);
    
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
    console.log("抽出データ（SMBC）:", {
      card_name,
      datetime_of_use,
      amount: parseInt(amountStr, 10),
      where_to_use,
    });
    
    // 日付文字列をISOフォーマットに変換
    let isoDate;
    try {
      // SMBCの日付形式（YYYY/MM/DD HH:MM）をISOフォーマットに変換
      isoDate = new Date(datetime_of_use.replace(/\//g, '-')).toISOString();
    } catch (error) {
      console.warn('日付変換に失敗しました。現在時刻を使用します:', error);
      isoDate = new Date().toISOString();
    }
    
    console.log("変換後日時（SMBC）:", isoDate);
    
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
        console.log('✅ IMAP接続を安全にクローズしました');
      } catch (error) {
        console.error('❌ IMAP接続のクローズ中にエラーが発生しました:', error);
      } finally {
        this.client = null;
        this.isConnected = false;
      }
    }
  }
}
