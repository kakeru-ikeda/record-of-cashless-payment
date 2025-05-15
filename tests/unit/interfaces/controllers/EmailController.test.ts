import { EmailController } from '../../../../src/interfaces/controllers/EmailController';
import { ImapEmailService, CardCompany } from '../../../../src/infrastructure/email/ImapEmailService';
import { ProcessEmailUseCase } from '../../../../src/usecases/ProcessEmailUseCase';
import { ParsedEmail } from '../../../../src/infrastructure/email/EmailParser';

// 依存コンポーネントをモック
jest.mock('../../../../src/infrastructure/email/ImapEmailService');
jest.mock('../../../../src/usecases/ProcessEmailUseCase');
jest.mock('../../../../shared/config/Environment', () => ({
  Environment: {
    IMAP_SERVER: 'imap.example.com',
    IMAP_USER: 'user@example.com',
    IMAP_PASSWORD: 'password'
  }
}));

// Loggerをモック化
jest.mock('../../../../shared/utils/Logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logAppError: jest.fn(),
    updateServiceStatus: jest.fn()
  }
}));

describe('EmailController', () => {
  let emailController: EmailController;
  let mockEmailService: jest.Mocked<ImapEmailService>;
  let mockProcessEmailUseCase: jest.Mocked<ProcessEmailUseCase>;
  // コールバック関数を保存する変数
  let emailCallbacks: Record<string, Function> = {};

  // テスト用のサンプルデータ
  const sampleParsedEmail: ParsedEmail = {
    uid: '123',
    subject: 'デビットカード取引確認メール',
    from: 'service@bk.mufg.jp',
    body: `カード名称：Ｄ　三菱ＵＦＪ－ＪＣＢデビット
デビットカード取引確認メール
【ご利用日時(日本時間)】 2025年5月10日 15:30:00
【ご利用金額】 1,500円
【ご利用先】 コンビニ
【カード番号末尾4桁】 1234`,
    date: new Date('2025-05-10T10:00:00.000Z')
  };

  const smbcSampleParsedEmail: ParsedEmail = {
    uid: '456',
    subject: '三井住友カード ご利用のお知らせ',
    from: 'service@smbc-card.com',
    body: `三井住友カード 様

三井住友カードの利用のお知らせ
ご利用日時：2025/05/10 15:30 スーパーマーケット 2,468円`,
    date: new Date('2025-05-10T10:00:00.000Z')
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // コールバック保存用オブジェクトをリセット
    emailCallbacks = {};

    // ImapEmailService コンストラクタをモック化
    (ImapEmailService as jest.Mock).mockImplementation(() => {
      const mockInstance = {
        connect: jest.fn().mockImplementation((mailboxName, callback) => {
          if (mailboxName === '三菱東京UFJ銀行') {
            emailCallbacks['MUFG'] = callback;
          } else if (mailboxName === '三井住友カード') {
            emailCallbacks['SMBC'] = callback;
          } else {
            emailCallbacks['default'] = callback;
          }
          return Promise.resolve();
        }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      return mockInstance;
    });

    // モックの初期化
    mockEmailService = new ImapEmailService(
      'imap.example.com',
      'user',
      'password'
    ) as jest.Mocked<ImapEmailService>;

    mockProcessEmailUseCase = new ProcessEmailUseCase(
      mockEmailService,
      {} as any,
      {} as any
    ) as jest.Mocked<ProcessEmailUseCase>;

    // EmailControllerのインスタンスを作成
    emailController = new EmailController(mockProcessEmailUseCase);
  });

  describe('isMonitoring', () => {
    test('初期状態では監視は無効', () => {
      expect(emailController.isMonitoring()).toBe(false);
    });

    test('startAllMonitoring後は監視有効になる', async () => {
      await emailController.startAllMonitoring();
      expect(emailController.isMonitoring()).toBe(true);
    });
  });

  describe('startAllMonitoring', () => {
    test('正常系: すべてのメールボックス監視が開始される', async () => {
      await emailController.startAllMonitoring();

      // ImapEmailServiceのインスタンスが2回作成されることを確認
      expect(ImapEmailService).toHaveBeenCalledTimes(3);  // デフォルト + MUFG + SMBC

      // connectメソッドが各メールボックスで呼ばれることを確認
      const emailServiceInstances = (ImapEmailService as jest.Mock).mock.results;

      // 実装内で新しく作られるインスタンスのconnectが正しく呼ばれることを確認
      const connectCalls = emailServiceInstances
        .map(result => result.value.connect)
        .filter(connect => typeof connect === 'function')
        .map(connect => connect.mock.calls)
        .flat();

      expect(connectCalls.length).toBe(2);

      // MUFGのコールバックが登録されていること
      expect(emailCallbacks['MUFG']).toBeDefined();
      expect(typeof emailCallbacks['MUFG']).toBe('function');

      // SMBCのコールバックが登録されていること
      expect(emailCallbacks['SMBC']).toBeDefined();
      expect(typeof emailCallbacks['SMBC']).toBe('function');

      expect(emailController.isMonitoring()).toBe(true);
    });

    test('異常系: メールボックス接続に失敗した場合も処理が継続される', async () => {
      // MUFGの接続でエラーを発生させる
      (ImapEmailService as jest.Mock).mockImplementationOnce(() => ({
        connect: jest.fn().mockRejectedValue(new Error('接続エラー')),
        close: jest.fn()
      })).mockImplementationOnce(() => ({
        connect: jest.fn().mockImplementation((mailboxName, callback) => {
          emailCallbacks['SMBC'] = callback;
          return Promise.resolve();
        }),
        close: jest.fn()
      }));

      await emailController.startAllMonitoring();

      // SMBCのコールバックは登録されていること
      expect(emailCallbacks['SMBC']).toBeDefined();
      expect(typeof emailCallbacks['SMBC']).toBe('function');

      expect(emailController.isMonitoring()).toBe(true);
    });
  });

  describe('stopMonitoring', () => {
    test('すべてのメール監視を正常に停止できること', async () => {
      // まず監視開始
      await emailController.startAllMonitoring();
      expect(emailController.isMonitoring()).toBe(true);

      // 監視停止
      await emailController.stopMonitoring();

      // すべてのメールサービスのclose()が呼ばれることを確認
      const closeMethodCalls = (ImapEmailService as jest.Mock).mock.results
        .map(result => result.value.close)
        .filter(close => typeof close === 'function')
        .map(close => close.mock.calls)
        .flat();

      expect(closeMethodCalls.length).toBeGreaterThan(0);
      expect(emailController.isMonitoring()).toBe(false);
    });

    test('異常系: 停止中にエラーが発生しても処理が継続される', async () => {
      // まず監視開始
      await emailController.startAllMonitoring();

      // 1つのインスタンスのcloseでエラーを発生させる
      const instances = (ImapEmailService as jest.Mock).mock.results;
      if (instances.length > 0 && instances[0].value) {
        instances[0].value.close = jest.fn().mockRejectedValue(new Error('停止エラー'));
      }

      // 監視停止（例外は内部でキャッチされる）
      await emailController.stopMonitoring();

      // 監視フラグはfalseになることを確認
      expect(emailController.isMonitoring()).toBe(false);
    });
  });

  describe('メールの処理', () => {
    test('正常系: MUFGのメールが正しく検出され処理される', async () => {
      // 監視開始
      await emailController.startAllMonitoring();

      // MUFGのコールバックを取得して手動で実行
      const callback = emailCallbacks['MUFG'];
      expect(callback).toBeDefined();

      await callback(sampleParsedEmail);

      // ProcessEmailUseCaseのexecuteが呼ばれることを検証
      expect(mockProcessEmailUseCase.execute).toHaveBeenCalledWith(
        sampleParsedEmail.body,
        CardCompany.MUFG
      );
    });

    test('正常系: SMBCのメールが正しく検出され処理される', async () => {
      // 監視開始
      await emailController.startAllMonitoring();

      // SMBCのコールバックを取得して手動で実行
      const callback = emailCallbacks['SMBC'];
      expect(callback).toBeDefined();

      await callback(smbcSampleParsedEmail);

      // ProcessEmailUseCaseのexecuteが呼ばれることを検証
      expect(mockProcessEmailUseCase.execute).toHaveBeenCalledWith(
        smbcSampleParsedEmail.body,
        CardCompany.SMBC
      );
    });

    test('異常系: カード会社が検出できないメールの場合', async () => {
      // 監視開始
      await emailController.startAllMonitoring();

      // カード会社を検出できないメール
      const unknownEmail: ParsedEmail = {
        ...sampleParsedEmail,
        subject: '不明なメール',
        from: 'unknown@example.com',
        body: 'これはカード利用に関係ないメールです。'
      };

      // MUFGのコールバックを取得して手動で実行
      const callback = emailCallbacks['MUFG'];
      expect(callback).toBeDefined();

      await callback(unknownEmail);

      // ProcessEmailUseCaseは呼ばれないことを確認
      expect(mockProcessEmailUseCase.execute).not.toHaveBeenCalled();
    });

    test('異常系: メール処理中にエラーが発生した場合', async () => {
      // 監視開始
      await emailController.startAllMonitoring();

      // ProcessEmailUseCase.executeがエラーをスローするようにモック
      mockProcessEmailUseCase.execute.mockRejectedValueOnce(new Error('処理エラー'));

      // MUFGのコールバックを取得して手動で実行
      const callback = emailCallbacks['MUFG'];
      expect(callback).toBeDefined();

      await callback(sampleParsedEmail);

      // executeは呼ばれるがエラーはキャッチされる
      expect(mockProcessEmailUseCase.execute).toHaveBeenCalled();
    });
  });
});