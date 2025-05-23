import { ImapEmailService } from '../../../../src/infrastructure/email/ImapEmailService';
import { ImapClientAdapter } from '../../../../src/infrastructure/email/ImapClientAdapter';
import { EmailParser, ParsedEmail } from '../../../../src/infrastructure/email/EmailParser';
import { CardUsageExtractor, CardCompany } from '../../../../src/infrastructure/email/CardUsageExtractor';
import { CardUsageNotification } from '../../../../shared/domain/entities/CardUsageNotification';

// 依存コンポーネントをモック
jest.mock('../../../../src/infrastructure/email/ImapClientAdapter');
jest.mock('../../../../src/infrastructure/email/EmailParser');
jest.mock('../../../../src/infrastructure/email/CardUsageExtractor');

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

describe('ImapEmailService', () => {
  let emailService: ImapEmailService;
  let mockImapClient: jest.Mocked<ImapClientAdapter>;
  let mockEmailParser: jest.Mocked<EmailParser>;
  let mockCardUsageExtractor: jest.Mocked<CardUsageExtractor>;

  // テスト用のサンプルデータ
  const sampleEmailContent = 'テストメール本文';
  const sampleParsedEmail: ParsedEmail = {
    uid: '123',
    subject: 'テスト件名',
    from: 'test@example.com',
    body: sampleEmailContent,
    date: new Date('2025-05-10T10:00:00.000Z')
  };
  const sampleCardUsageInfo = {
    card_name: 'テストカード',
    datetime_of_use: '2025-05-10T10:00:00.000Z',
    amount: 1000,
    where_to_use: 'テスト店舗'
  };

  // 各テスト前の準備
  beforeEach(() => {
    jest.clearAllMocks();

    // モックの初期化
    mockImapClient = new ImapClientAdapter({ host: '', port: 0, secure: false, auth: { user: '', pass: '' } }) as jest.Mocked<ImapClientAdapter>;
    mockEmailParser = new EmailParser() as jest.Mocked<EmailParser>;
    mockCardUsageExtractor = new CardUsageExtractor() as jest.Mocked<CardUsageExtractor>;

    // ImapClientAdapterのコンストラクタモックを設定
    (ImapClientAdapter as jest.MockedClass<typeof ImapClientAdapter>).mockImplementation(() => {
      mockImapClient.connect = jest.fn().mockResolvedValue({} as any);
      mockImapClient.fetchUnseenMessages = jest.fn().mockResolvedValue(['123', '124']);
      mockImapClient.fetchMessage = jest.fn().mockResolvedValue({ uid: '123', source: Buffer.from(sampleEmailContent) });
      mockImapClient.markAsSeen = jest.fn().mockResolvedValue(true);
      mockImapClient.isActive = jest.fn().mockReturnValue(true);
      mockImapClient.close = jest.fn().mockResolvedValue(undefined);
      mockImapClient.on = jest.fn();
      return mockImapClient;
    });

    // EmailParserのモックを設定
    (EmailParser as jest.MockedClass<typeof EmailParser>).mockImplementation(() => {
      mockEmailParser.parseEmail = jest.fn().mockResolvedValue(sampleParsedEmail);
      return mockEmailParser;
    });

    // CardUsageExtractorのモックを設定
    (CardUsageExtractor as jest.MockedClass<typeof CardUsageExtractor>).mockImplementation(() => {
      mockCardUsageExtractor.extractFromEmailBody = jest.fn().mockReturnValue(sampleCardUsageInfo);
      return mockCardUsageExtractor;
    });

    // テスト対象のサービスを作成
    emailService = new ImapEmailService('imap.example.com', 'testuser', 'testpass');
  });

  // テスト後のクリーンアップ
  afterEach(async () => {
    if (emailService) {
      // クリーンアップに必要なメソッド呼び出し
      if ((emailService as any).pollingTimer) {
        clearInterval((emailService as any).pollingTimer);
        (emailService as any).pollingTimer = null;
      }

      // ImapClientAdapter のタイマーも確実にクリア
      if (mockImapClient) {
        // 明示的に internal タイマーをクリアする
        if ((mockImapClient as any).keepAliveTimer) {
          clearInterval((mockImapClient as any).keepAliveTimer);
          (mockImapClient as any).keepAliveTimer = null;
        }

        if ((mockImapClient as any).reconnectTimer) {
          clearTimeout((mockImapClient as any).reconnectTimer);
          (mockImapClient as any).reconnectTimer = null;
        }

        await emailService.close();
      }
    }
    jest.clearAllTimers();
  });

  describe('connect', () => {
    test('正常系: IMAPクライアントが接続して監視を開始すること', async () => {
      // モック用のコールバック関数
      const mockCallback = jest.fn().mockResolvedValue(undefined);

      // 接続を実行
      await emailService.connect('INBOX', mockCallback);

      // ImapClientAdapterのconnectが呼ばれていることを確認
      expect(mockImapClient.connect).toHaveBeenCalledWith('INBOX');

      // イベントリスナーが登録されていることを確認
      expect(mockImapClient.on).toHaveBeenCalledTimes(2);
      expect(mockImapClient.on).toHaveBeenCalledWith('connectionLost', expect.any(Function));
      expect(mockImapClient.on).toHaveBeenCalledWith('reconnected', expect.any(Function));
    });

    test('異常系: 接続に失敗した場合、例外がスローされること', async () => {
      // 接続に失敗するようにモック
      mockImapClient.connect.mockRejectedValueOnce(new Error('接続エラー'));

      // 接続実行（例外をキャッチ）
      await expect(emailService.connect('INBOX', jest.fn())).rejects.toThrow();
    });
  });

  describe('pollForNewMessages', () => {
    test('正常系: 未読メールが正しく処理されること', async () => {
      // モック用のコールバック関数
      const mockCallback = jest.fn().mockResolvedValue(undefined);

      // まず接続
      await emailService.connect('INBOX', mockCallback);

      // privateなpollForNewMessagesメソッドをテストするために、
      // ポーリング処理を直接シミュレート（内部実装に依存するため注意）

      // ImapClientAdapterがfetchUnseenMessagesを呼び出したときの結果をモック
      mockImapClient.fetchUnseenMessages.mockResolvedValueOnce(['123']);

      // pollForNewMessagesをインスタンスから直接取得して呼び出す（プライベートメソッド）
      const pollForNewMessages = (emailService as any).pollForNewMessages.bind(emailService);
      await pollForNewMessages(mockCallback, 'TestContext');

      // 適切なメソッドが呼ばれていることを確認
      expect(mockImapClient.fetchUnseenMessages).toHaveBeenCalled();
      expect(mockImapClient.fetchMessage).toHaveBeenCalledWith('123');
      expect(mockEmailParser.parseEmail).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(sampleParsedEmail);
      expect(mockImapClient.markAsSeen).toHaveBeenCalledWith('123');
    });
  });

  describe('parseCardUsageFromEmail', () => {
    test('正常系: メール本文からカード利用情報を抽出できること', async () => {
      // カード情報を抽出
      const result = await emailService.parseCardUsageFromEmail(sampleEmailContent);

      // CardUsageExtractorが呼ばれていることを確認
      expect(mockCardUsageExtractor.extractFromEmailBody).toHaveBeenCalledWith(
        sampleEmailContent,
        CardCompany.MUFG // デフォルト値
      );

      // 結果がCardUsageNotificationの形式に変換されていることを確認
      const expected: CardUsageNotification = {
        card_name: sampleCardUsageInfo.card_name,
        datetime_of_use: sampleCardUsageInfo.datetime_of_use,
        amount: sampleCardUsageInfo.amount,
        where_to_use: sampleCardUsageInfo.where_to_use
      };
      expect(result).toEqual(expected);
    });

    test('正常系: 指定したカード会社タイプで抽出できること', async () => {
      // SMBC用のカード情報を抽出
      await emailService.parseCardUsageFromEmail(sampleEmailContent, CardCompany.SMBC);

      // 指定したカード会社タイプで呼ばれていることを確認
      expect(mockCardUsageExtractor.extractFromEmailBody).toHaveBeenCalledWith(
        sampleEmailContent,
        CardCompany.SMBC
      );
    });

    test('異常系: 抽出エラー時はデフォルト値のオブジェクトを返すこと', async () => {
      // 抽出に失敗するようにモック
      mockCardUsageExtractor.extractFromEmailBody.mockImplementationOnce(() => {
        throw new Error('抽出エラー');
      });

      // カード情報を抽出
      const result = await emailService.parseCardUsageFromEmail(sampleEmailContent);

      // デフォルト値のオブジェクトが返されることを確認
      expect(result).toEqual({
        card_name: '',
        datetime_of_use: expect.any(String),
        amount: 0,
        where_to_use: ''
      });
    });
  });

  describe('executeTest', () => {
    test('テスト実行メソッドが正しく動作すること', async () => {
      // テスト実行
      const result = await emailService.executeTest(sampleEmailContent, CardCompany.MUFG);

      // CardUsageExtractorが呼ばれていることを確認
      expect(mockCardUsageExtractor.extractFromEmailBody).toHaveBeenCalledWith(
        sampleEmailContent,
        CardCompany.MUFG
      );

      // 結果を検証
      expect(result).toEqual(sampleCardUsageInfo);
    });
  });

  describe('close', () => {
    test('正常系: 接続を閉じることができること', async () => {
      // 閉じる
      await emailService.close();

      // ImapClientAdapterのcloseが呼ばれていることを確認
      expect(mockImapClient.close).toHaveBeenCalled();
    });
  });

  describe('reconnection', () => {
    test('connectionLostイベント時に監視が停止されること', async () => {
      // モック用のコールバック関数
      const mockCallback = jest.fn().mockResolvedValue(undefined);

      // まず接続
      await emailService.connect('INBOX', mockCallback);

      // connectionLostイベントハンドラを取得
      const connectionLostHandler = (mockImapClient.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connectionLost'
      )[1];

      // ポーリングタイマーを設定（内部実装に依存）
      (emailService as any).pollingTimer = setTimeout(() => { }, 1000);
      (emailService as any).isMonitoring = true;

      // イベントハンドラを手動で呼び出し
      connectionLostHandler('INBOX');

      // 監視状態がfalseになることを確認
      expect((emailService as any).isMonitoring).toBe(false);

      // ポーリングタイマーがクリアされていることを確認
      expect((emailService as any).pollingTimer).toBeNull();
    });

    test('reconnectedイベント時に監視が再開されること', async () => {
      // モック用のコールバック関数
      const mockCallback = jest.fn().mockResolvedValue(undefined);

      // まず接続（これによって_lastConnectedMailboxと_lastCallbackが設定される）
      await emailService.connect('INBOX', mockCallback);

      // startMonitoringメソッドをスパイ
      const startMonitoringSpy = jest.spyOn(emailService as any, 'startMonitoring');

      // reconnectedイベントハンドラを取得
      const reconnectedHandler = (mockImapClient.on as jest.Mock).mock.calls.find(
        call => call[0] === 'reconnected'
      )[1];

      // 監視状態を無効化（接続切断をシミュレート）
      (emailService as any).isMonitoring = false;

      // イベントハンドラを手動で呼び出し
      reconnectedHandler('INBOX');

      // 監視が再開されることを確認
      expect(startMonitoringSpy).toHaveBeenCalled();
      expect(startMonitoringSpy).toHaveBeenCalledWith(mockCallback, expect.stringContaining('INBOX'));
    });

    test('reconnectedイベント時に即時メール確認が実行されること', async () => {
      // モック用のコールバック関数
      const mockCallback = jest.fn().mockResolvedValue(undefined);

      // まず接続
      await emailService.connect('INBOX', mockCallback);

      // pollForNewMessagesメソッドをスパイ
      const pollForNewMessagesSpy = jest.spyOn(emailService as any, 'pollForNewMessages');

      // reconnectedイベントハンドラを取得
      const reconnectedHandler = (mockImapClient.on as jest.Mock).mock.calls.find(
        call => call[0] === 'reconnected'
      )[1];

      // イベントハンドラを手動で呼び出し
      reconnectedHandler('INBOX');

      // 即時メール確認が実行されることを確認
      expect(pollForNewMessagesSpy).toHaveBeenCalled();
      expect(pollForNewMessagesSpy).toHaveBeenCalledWith(mockCallback, expect.stringContaining('INBOX'));
    });
  });
});