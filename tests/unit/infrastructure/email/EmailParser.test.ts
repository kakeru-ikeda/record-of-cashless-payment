import { EmailParser } from '../../../../src/infrastructure/email/EmailParser';
import { RawEmailMessage } from '../../../../src/infrastructure/email/ImapEmailClient';
import { simpleParser } from 'mailparser';

// mailparserのモック化
jest.mock('mailparser', () => ({
  simpleParser: jest.fn()
}));

// Loggerをモック化
jest.mock('../../../../shared/infrastructure/logging/Logger', () => {
  return {
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      logAppError: jest.fn(),
      updateServiceStatus: jest.fn()
    }
  };
});

describe('EmailParser', () => {
  let parser: EmailParser;

  beforeEach(() => {
    parser = new EmailParser();
    jest.clearAllMocks();
  });

  test('正常系: テキストのみのメールを正しくパースすること', async () => {
    // モックの戻り値を設定
    (simpleParser as jest.Mock).mockResolvedValueOnce({
      subject: 'テストメール',
      from: { text: 'test@example.com' },
      text: 'これはテストメールです',
      date: new Date('2025-05-10T10:00:00Z')
    });

    // テスト用のrawEmailMessage
    const rawMessage: RawEmailMessage = {
      uid: '12345',
      source: Buffer.from('テストメール本文')
    };

    // メールをパース
    const result = await parser.parseEmail(rawMessage);

    // 結果を検証
    expect(result).toBeDefined();
    expect(result).toEqual({
      subject: 'テストメール',
      from: 'test@example.com',
      body: 'これはテストメールです',
      date: expect.any(Date),
      uid: '12345'
    });

    // simpleParserが正しく呼ばれたことを確認
    expect(simpleParser).toHaveBeenCalledWith(rawMessage.source);
  });

  test('正常系: HTMLメールをテキストに変換してパースすること', async () => {
    // モックの戻り値を設定（HTMLとテキスト両方含む）
    (simpleParser as jest.Mock).mockResolvedValueOnce({
      subject: 'HTMLテストメール',
      from: { text: 'html@example.com' },
      text: '通常テキスト部分',
      html: '<p>これは<b>HTML</b>メールです</p>',
      date: new Date('2025-05-10T10:00:00Z')
    });

    // スパイを作成して htmlToText が呼ばれることを確認
    const htmlToTextSpy = jest.spyOn(EmailParser.prototype as any, 'convertHtmlToPlainText');
    htmlToTextSpy.mockReturnValue('これはHTMLメールです');

    // テスト用のrawEmailMessage
    const rawMessage: RawEmailMessage = {
      uid: '12346',
      source: Buffer.from('HTMLメール本文')
    };

    // メールをパース
    const result = await parser.parseEmail(rawMessage);

    // 結果を検証
    expect(result).toBeDefined();
    expect(result).toEqual({
      subject: 'HTMLテストメール',
      from: 'html@example.com',
      body: 'これはHTMLメールです', // HTML変換後の結果
      date: expect.any(Date),
      uid: '12346'
    });

    // HTMLの変換メソッドが呼ばれたことを確認
    expect(htmlToTextSpy).toHaveBeenCalled();
  });

  test('異常系: mailparserがエラーをスローした場合、nullを返すこと', async () => {
    // simpleParserがエラーをスローするように設定
    (simpleParser as jest.Mock).mockRejectedValueOnce(new Error('パースエラー'));

    // テスト用のrawEmailMessage
    const rawMessage: RawEmailMessage = {
      uid: '12347',
      source: Buffer.from('不正なメール本文')
    };

    // メールをパース（例外は内部でキャッチされる）
    const result = await parser.parseEmail(rawMessage);

    // nullが返されることを確認
    expect(result).toBeNull();
  });

  test('異常系: パース結果の一部フィールドが欠けている場合、デフォルト値で補完されること', async () => {
    // 一部フィールドが欠けたパース結果を返すように設定
    (simpleParser as jest.Mock).mockResolvedValueOnce({
      // subjectとfromが欠けている
      text: 'フィールド欠けテスト',
      // dateも欠けている
    });

    // テスト用のrawEmailMessage
    const rawMessage: RawEmailMessage = {
      uid: '12348',
      source: Buffer.from('フィールド欠けメール')
    };

    // メールをパース
    const result = await parser.parseEmail(rawMessage);

    // 結果を検証 - 欠けたフィールドがデフォルト値で設定されていること
    expect(result).toBeDefined();
    expect(result?.subject).toBe('');
    expect(result?.from).toBe('');
    expect(result?.body).toBe('フィールド欠けテスト');
    expect(result?.date).toBeInstanceOf(Date);
    expect(result?.uid).toBe('12348');
  });
});