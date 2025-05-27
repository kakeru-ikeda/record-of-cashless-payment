import { ProcessCardCompanyEmailUseCase } from '../../../../src/usecases/email/ProcessCardCompanyEmailUseCase';
import { ProcessEmailUseCase } from '../../../../src/usecases/email/ProcessEmailUseCase';
import { ParsedEmail } from '../../../../src/infrastructure/email/EmailParser';
import { CardUsageNotificationDTO } from '../../../../shared/domain/dto/CardUsageNotificationDTO';
import { CardCompany } from '../../../../src/domain/enums/CardCompany';

// Loggerをモック化
jest.mock('../../../../shared/infrastructure/logging/Logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logAppError: jest.fn(),
    updateServiceStatus: jest.fn()
  }
}));

// ErrorHandlerをモック化
jest.mock('../../../../shared/infrastructure/errors/ErrorHandler', () => ({
  ErrorHandler: {
    errorDecorator: () => () => (
      _target: any,
      _propertyKey: string | symbol,
      descriptor: PropertyDescriptor
    ) => descriptor,
    handle: jest.fn(),
    extractErrorInfoFromArgs: jest.fn()
  }
}));

describe('ProcessCardCompanyEmailUseCase', () => {
  let processCardCompanyEmailUseCase: ProcessCardCompanyEmailUseCase;
  let mockProcessEmailUseCase: jest.Mocked<ProcessEmailUseCase>;

  // テスト用のサンプルデータ
  const sampleMufgEmail: ParsedEmail = {
    uid: '123',
    subject: 'デビットカード利用のお知らせ',
    from: 'notification@bk.mufg.jp',
    body: `
カード名称：Ｄ　三菱ＵＦＪ－ＪＣＢデビット
デビットカード取引確認メール

【ご利用日時(日本時間)】 2025年5月10日 15:30:00
【ご利用金額】 1,500円
【ご利用先】 コンビニエンスストア東京
【カード番号末尾4桁】 1234
    `,
    date: new Date('2025-05-10T10:00:00.000Z')
  };

  const sampleSmbcEmail: ParsedEmail = {
    uid: '456',
    subject: '三井住友カードのご利用のお知らせ',
    from: 'notification@smbc-card.com',
    body: `
三井住友カード 様

三井住友カードの利用のお知らせ
ご利用日時：2025/05/10 15:30 スーパーマーケット 2,468円
    `,
    date: new Date('2025-05-10T10:00:00.000Z')
  };

  const sampleUnknownEmail: ParsedEmail = {
    uid: '789',
    subject: 'お知らせ',
    from: 'info@example.com',
    body: 'これはカード利用に関係ないメールです。',
    date: new Date('2025-05-10T10:00:00.000Z')
  };

  const sampleCardUsageResult = {
    usage: {
      card_name: 'テストカード',
      datetime_of_use: '2025-05-10T06:30:00.000Z',
      amount: 1500,
      where_to_use: 'テスト利用先'
    } as CardUsageNotificationDTO,
    savedPath: 'details/2025/05/term2/10/1715350200000'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // モックの設定
    mockProcessEmailUseCase = {
      execute: jest.fn().mockResolvedValue(sampleCardUsageResult)
    } as unknown as jest.Mocked<ProcessEmailUseCase>;

    // ProcessCardCompanyEmailUseCaseのインスタンスを作成
    processCardCompanyEmailUseCase = new ProcessCardCompanyEmailUseCase(
      mockProcessEmailUseCase
    );
  });

  describe('execute', () => {
    test('正常系: MUFG銀行のメールを正しく検出して処理できること', async () => {
      // メソッドを実行
      const result = await processCardCompanyEmailUseCase.execute(sampleMufgEmail);

      // 結果を検証
      expect(result.cardCompany).toBe(CardCompany.MUFG);
      expect(result.usageResult).toEqual(sampleCardUsageResult);

      // ProcessEmailUseCase.executeが正しい引数で呼ばれることを確認
      expect(mockProcessEmailUseCase.execute).toHaveBeenCalledWith(
        sampleMufgEmail.body,
        CardCompany.MUFG
      );
    });

    test('正常系: 三井住友カードのメールを正しく検出して処理できること', async () => {
      // メソッドを実行
      const result = await processCardCompanyEmailUseCase.execute(sampleSmbcEmail);

      // 結果を検証
      expect(result.cardCompany).toBe(CardCompany.SMBC);
      expect(result.usageResult).toEqual(sampleCardUsageResult);

      // ProcessEmailUseCase.executeが正しい引数で呼ばれることを確認
      expect(mockProcessEmailUseCase.execute).toHaveBeenCalledWith(
        sampleSmbcEmail.body,
        CardCompany.SMBC
      );
    });

    test('正常系: カード会社が特定できないメールの場合、cardCompanyがnullになること', async () => {
      // メソッドを実行
      const result = await processCardCompanyEmailUseCase.execute(sampleUnknownEmail);

      // 結果を検証
      expect(result.cardCompany).toBeNull();
      expect(result.usageResult).toBeUndefined();

      // ProcessEmailUseCase.executeが呼ばれないことを確認
      expect(mockProcessEmailUseCase.execute).not.toHaveBeenCalled();
    });

    test('異常系: ProcessEmailUseCase.executeでエラーが発生した場合、例外がスローされること', async () => {
      // エラーをスローするように設定
      mockProcessEmailUseCase.execute.mockRejectedValueOnce(
        new Error('処理エラー')
      );

      // 例外がスローされることを確認（ErrorHandler.errorDecoratorによってハンドリングされるが、テストではモック化しているため素のエラーがスローされる）
      await expect(processCardCompanyEmailUseCase.execute(sampleMufgEmail))
        .rejects.toThrow('処理エラー');
    });
  });

  describe('カード会社判定', () => {
    test('MUFG銀行のメールを正しく判定できること - メールアドレスによる判定', () => {
      // メールアドレスのみで判定できるケース
      const result = (processCardCompanyEmailUseCase as any).detectCardCompany({
        ...sampleUnknownEmail,
        from: 'notification@bk.mufg.jp'
      });

      expect(result).toBe(CardCompany.MUFG);
    });

    test('MUFG銀行のメールを正しく判定できること - 件名と本文による判定', () => {
      // メールアドレスではなく件名と本文で判定するケース
      const result = (processCardCompanyEmailUseCase as any).detectCardCompany({
        ...sampleUnknownEmail,
        from: 'other@example.com',
        subject: 'UFJカードのご利用',
        body: 'デビットカード取引確認'
      });

      expect(result).toBe(CardCompany.MUFG);
    });

    test('三井住友カードのメールを正しく判定できること - メールアドレスによる判定', () => {
      // メールアドレスのみで判定できるケース
      const result = (processCardCompanyEmailUseCase as any).detectCardCompany({
        ...sampleUnknownEmail,
        from: 'notification@smbc-card.com'
      });

      expect(result).toBe(CardCompany.SMBC);
    });

    test('三井住友カードのメールを正しく判定できること - 件名と本文による判定', () => {
      // メールアドレスではなく件名と本文で判定するケース
      const result = (processCardCompanyEmailUseCase as any).detectCardCompany({
        ...sampleUnknownEmail,
        from: 'other@example.com',
        subject: '三井住友カードのご利用',
        body: 'クレジットカードのご利用'
      });

      expect(result).toBe(CardCompany.SMBC);
    });

    test('カード会社が特定できないメールの場合、nullを返すこと', () => {
      const result = (processCardCompanyEmailUseCase as any).detectCardCompany(sampleUnknownEmail);

      expect(result).toBeNull();
    });
  });
});