import { ImapEmailService, ParsedEmail } from '../../src/infrastructure/email/ImapEmailService';

/**
 * メールサービスのモック
 */
export class MockEmailService extends ImapEmailService {
  // パース済みメールのキュー
  private emailQueue: ParsedEmail[] = [];

  // パース結果
  private parseResult: {
    card_name: string;
    datetime_of_use: string;
    amount: number;
    where_to_use: string;
  } = {
      card_name: 'テストカード',
      datetime_of_use: new Date().toISOString(),
      amount: 1000,
      where_to_use: 'テスト店舗'
    };

  /**
   * コンストラクタ
   */
  constructor() {
    // 環境変数を使わずに初期化
    super('localhost', 'test', 'test');
  }

  /**
   * 接続をモック
   * @param mailboxName メールボックス名
   * @param callback コールバック関数
   */
  async connect(
    mailboxName: string = 'INBOX',
    callback: (email: ParsedEmail) => Promise<void>
  ): Promise<any> {
    console.log('🧪 モックメールサービスが接続しました');

    // キューにあるメールを順次処理
    for (const email of this.emailQueue) {
      await callback(email);
    }

    return {};
  }

  /**
   * メール処理をモック
   * @param body メール本文
   */
  async parseCardUsageFromEmail(body: string): Promise<{
    card_name: string;
    datetime_of_use: string;
    amount: number;
    where_to_use: string;
  }> {
    console.log('🧪 モックメールサービスがメールを解析しました');
    return this.parseResult;
  }

  /**
   * キューにメールを追加
   * @param email パース済みメール
   */
  addEmail(email: ParsedEmail): void {
    this.emailQueue.push(email);
  }

  /**
   * パース結果を設定
   * @param result パース結果
   */
  setParseResult(result: {
    card_name: string;
    datetime_of_use: string;
    amount: number;
    where_to_use: string;
  }): void {
    this.parseResult = { ...result };
  }

  /**
   * 接続をクローズ
   */
  close(): void {
    console.log('🧪 モックメールサービスが切断されました');
  }
}

