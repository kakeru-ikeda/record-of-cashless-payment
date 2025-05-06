import inbox from 'inbox';
import * as quotedPrintable from 'quoted-printable';
import * as Encoding from 'encoding-japanese';
import { htmlToText } from 'html-to-text';
import { Environment } from '../config/environment';

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
 * IMAP接続とメール処理のサービス
 */
export class ImapEmailService {
  private client: any = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;                       // ポーリング用タイマー
  private processedUids = new Set<string>();                               // 既処理UID管理
  private reconnectAttempts = 0;                                            // 再接続試行回数
  
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
    mailboxName: string = '&TgmD8WdxTqw-UFJ&koCITA-', // 三菱東京UFJ銀行
    callback: (email: ParsedEmail) => Promise<void>
  ): Promise<any> {
    console.log("IMAPサーバーに接続しています...");
    
    this.client = inbox.createConnection(993, this.server, {
      secureConnection: true,
      auth: {
        user: this.user,
        pass: this.password
      },
    });
    
    // 接続を開始
    this.client.connect();
    
    // キープアライブタイマーを設定
    this.setupKeepAlive();
    this.setupPolling(callback);                         // ポーリング開始
    
    // 接続イベント
    this.client.on("connect", () => {
      this.reconnectAttempts = 0;                        // 成功時にリセット
      this.client.listMailboxes((err: any, mailboxes: string[]) => {
        if (err) {
          console.error("❌ メールボックスの一覧取得に失敗しました:", err);
        } else {
          // console.log("📬 利用可能なメールボックス:", mailboxes);
        }
      });
      
      this.client.openMailbox(mailboxName, (err: any) => {
        if (err) console.log(err);
        console.log(`✅ メールボックスに接続しました: ${mailboxName}`);
      });
    });
    
    // 新着メールイベント
    this.client.on('new', async (message: any) => {
      console.log("📩 新しいメールを受信しました");
      
      try {
        const parsedEmail = await this.processEmail(message);
        
        if (parsedEmail) {
          await callback(parsedEmail);
        }
      } catch (error) {
        console.error('❌ メール処理中にエラーが発生しました:', error);
      }
    });
    
    // エラーイベント
    this.client.on("error", (error: any) => {
      console.error("❌ IMAPエラー:", error);
      if (error.code === 'ETIMEDOUT') {
        this.scheduleReconnect(mailboxName, callback);
      }
    });
    
    // 切断イベント
    this.client.on("close", () => {
      console.log("🔒 IMAP接続が閉じられました");
      if (this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
      if (this.pollingTimer) {
        clearInterval(this.pollingTimer);
        this.pollingTimer = null;
      }
      this.scheduleReconnect(mailboxName, callback);
    });
    
    return this.client;
  }
  
  /**
   * IMAPサーバーに再接続
   */
  private async reconnect(mailboxName: string, callback: (email: ParsedEmail) => Promise<void>): Promise<void> {
    console.log(`🔌 reconnect(): 前回接続をクローズして再接続準備`);
    if (this.client) {
      try {
        this.client.close();
        console.log('🔌 既存クライアントをクローズしました');
      } catch (error) {
        console.warn('⚠️ クライアントクローズ中に警告:', error);
      }
      this.client = null;
    }
    await this.connect(mailboxName, callback);
    console.log('🔌 reconnect(): connect() 完了');
  }
  
  /**
   * キープアライブタイマーを設定 (1分間隔)
   */
  private setupKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }
    
    this.keepAliveTimer = setInterval(() => {
      if (this.client && this.client._state === 'logged in') {
        console.log('🔔 KeepAlive ping送信');
        this.client.listMailboxes(() => {});
      }
    }, 1 * 60 * 1000); // 1分ごと
  }

  /**
   * ポーリングによる未読メール取得 (3分間隔)
   */
  private setupPolling(callback: (email: ParsedEmail) => Promise<void>): void {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.pollingTimer = setInterval(() => {
      if (this.client && this.client._state === 'logged in') {
        console.log('🔎 ポーリング実行: UNSEEN 検索開始');
        this.client.search(['UNSEEN'], async (err: any, uids: number[]) => {
          if (err) {
            console.error('❌ Polling search error:', err);
            return;
          }
          console.log(`🔎 Polling search: 見つかった未読数=${uids.length}`, uids);
          if (!uids.length) return;
          for (const uid of uids) {
            const key = uid.toString();
            if (this.processedUids.has(key)) continue;
            console.log(`⚙️ PollingでUID=${key}を処理開始`);
            try {
              const parsed = await this.processEmail({ UID: uid, title: '', from: { address: '' }, date: Date.now() });
              if (parsed) {
                await callback(parsed);
                this.processedUids.add(key);
                console.log(`✅ Polling処理完了 UID=${key}`);
              }
            } catch (error) {
              console.error(`❌ Polling処理失敗 UID=${key}:`, error);
              // 処理失敗は次回再試行
            }
          }
        });
      }
    }, 3 * 60 * 1000);
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
   * @param message メールメッセージ
   * @returns パース済みのメール内容
   */
  private async processEmail(message: any): Promise<ParsedEmail | null> {
    return new Promise((resolve, reject) => {
      const stream = this.client.createMessageStream(message.UID);
      let body = "";
      
      stream.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      
      stream.on("end", () => {
        try {
          // メール本文をデコード
          const decodedBuffer = quotedPrintable.decode(body);
          const decodedBody = Encoding.convert(decodedBuffer, {
            to: 'UNICODE',
            from: 'JIS',
            type: 'string'
          });
          
          // HTMLをプレーンテキストに変換
          const plainTextBody = this.convertHtmlToPlainText(decodedBody);
          
          resolve({
            subject: message.title || '',
            from: message.from?.address || '',
            body: plainTextBody,
            date: new Date(message.date || Date.now()),
            uid: message.UID
          });
        } catch (error) {
          console.error('❌ メールのデコード中にエラーが発生しました:', error);
          reject(error);
        }
      });
      
      stream.on("error", (error: any) => {
        console.error('❌ メールのストリーム取得中にエラーが発生しました:', error);
        reject(error);
      });
    });
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
    
    // 初期段階では三井住友カードのメールの形式が不明なため、ログ出力のみ行う
    // 実際のメールの形式を確認した後に正確なパターンを実装する
    
    // 汎用的なパターンで試行（三井住友カードのメール形式は実際のメールを見て調整が必要）
    const cardNameMatch = body.match(/カード(?:名|番号)[　\s]*[：:][　\s]*(.+?)(?=[\s\n]|$)/);
    const dateMatch = body.match(/(?:利用|ご利用)(?:日|日時)[　\s]*[：:][　\s]*([\d年月日/: ]+)/);
    const amountMatch = body.match(/(?:金額|ご利用金額)[　\s]*[：:][　\s]*[\¥]?([0-9,.]+)/);
    const whereToUseMatch = body.match(/(?:ご利用店舗|利用先|店舗名)[　\s]*[：:][　\s]*([^\n]+)/);
    
    // データを抽出・整形
    const datetime_of_use = dateMatch?.[1]?.trim() || new Date().toISOString();
    const amountStr = amountMatch?.[1]?.replace(/[,\.]/g, '') || '0';
    const card_name = cardNameMatch?.[1]?.trim() || '三井住友カード';
    const where_to_use = whereToUseMatch?.[1]?.trim() || '不明';
    
    // 抽出結果をログ出力
    console.log("抽出データ（SMBC仮）:", {
      card_name,
      datetime_of_use,
      amount: parseInt(amountStr, 10),
      where_to_use,
    });
    
    // 日付文字列をISOフォーマットに変換（三井住友カードの日付形式に合わせて調整が必要）
    let isoDate;
    try {
      // 日付形式を検出して変換を試みる
      if (datetime_of_use.includes('年')) {
        isoDate = new Date(datetime_of_use.replace(/年|月/g, '-').replace('日', '')).toISOString();
      } else if (datetime_of_use.includes('/')) {
        isoDate = new Date(datetime_of_use.replace(/\//g, '-')).toISOString();
      } else {
        isoDate = new Date(datetime_of_use).toISOString();
      }
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
  close(): void {
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
        this.client.close();
      } catch (error) {
        console.error('❌ IMAP接続のクローズ中にエラーが発生しました:', error);
      }
      this.client = null;
    }
  }
}
