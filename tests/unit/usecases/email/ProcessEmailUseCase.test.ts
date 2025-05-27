import { ProcessEmailUseCase } from '../../../../src/usecases/email/ProcessEmailUseCase';
import { ImapEmailService } from '../../../../src/infrastructure/email/ImapEmailService';
import { ICardUsageRepository } from '../../../../src/domain/interfaces/repositories/ICardUsageRepository';
import { DiscordNotifier } from '../../../../shared/infrastructure/discord/DiscordNotifier';
import { CardUsageNotificationDTO } from '../../../../shared/domain/dto/CardUsageNotificationDTO';
import * as admin from 'firebase-admin';
import { CardCompany } from '../../../../src/domain/enums/CardCompany';

// 依存コンポーネントをモック化
jest.mock('../../../../src/infrastructure/email/ImapEmailService');
jest.mock('../../../../shared/infrastructure/discord/DiscordNotifier');

// firebase-adminのTimestampをモック化
jest.mock('firebase-admin', () => {
  return {
    firestore: {
      Timestamp: {
        fromDate: jest.fn().mockReturnValue('mocked-firebase-timestamp'),
      },
      FieldValue: {
        serverTimestamp: jest.fn().mockReturnValue('mocked-server-timestamp'),
      }
    }
  };
});

jest.mock('../../../../shared/domain/mappers/CardUsageMapper', () => ({
  CardUsageMapper: {
    toNotification: jest.fn().mockReturnValue({
      card_name: 'Ｄ　三菱ＵＦＪ－ＪＣＢデビット',
      datetime_of_use: '2025-05-10T06:30:00.000Z',
      amount: 1500,
      where_to_use: 'コンビニ',
      memo: '',
      is_active: true
    })
  }
}));

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

jest.mock('../../../../shared/infrastructure/errors/ErrorHandler', () => ({
  ErrorHandler: {
    errorDecorator: (context, options) => (target, propertyKey, descriptor) => {
      // オリジナルのメソッドを保存
      const originalMethod = descriptor.value;
      // 新しいメソッドを定義
      descriptor.value = async function (...args) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          // ここでhandleが呼ばれることをシミュレート
          mockhandle(error, context, options);
          throw error;
        }
      };
      return descriptor;
    },
    handle: jest.fn().mockImplementation((error, context, options) => {
      return error;
    })
  }
}));

// モックハンドラ―の参照を保持
const mockhandle = jest.fn();

describe('ProcessEmailUseCase', () => {
  let processEmailUseCase: ProcessEmailUseCase;
  let mockEmailService: jest.Mocked<ImapEmailService>;
  let mockCardUsageRepository: jest.Mocked<ICardUsageRepository>;
  let mockDiscordNotifier: jest.Mocked<DiscordNotifier>;

  // テスト用のサンプルデータ
  const sampleEmailBody = `カード名称：Ｄ　三菱ＵＦＪ－ＪＣＢデビット
  デビットカード取引確認メール
  【ご利用日時(日本時間)】 2025年5月10日 15:30:00
  【ご利用金額】 1,500円
  【ご利用先】 コンビニ
  【カード番号末尾4桁】 1234`;

  const sampleCardUsage: CardUsageNotificationDTO = {
    card_name: 'Ｄ　三菱ＵＦＪ－ＪＣＢデビット',
    datetime_of_use: '2025-05-10T06:30:00.000Z', // UTC時間
    amount: 1500,
    where_to_use: 'コンビニ',
    memo: '',
    is_active: true
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // モックの設定
    mockEmailService = {
      parseCardUsageFromEmail: jest.fn().mockResolvedValue(sampleCardUsage)
    } as unknown as jest.Mocked<ImapEmailService>;

    mockCardUsageRepository = {
      save: jest.fn().mockResolvedValue('users/2025/5/10/card-usage-123')
    } as unknown as jest.Mocked<ICardUsageRepository>;

    mockDiscordNotifier = {
      notify: jest.fn().mockResolvedValue(true)
    } as unknown as jest.Mocked<DiscordNotifier>;

    // ProcessEmailUseCaseのインスタンスを作成 (discordNotifierを除去)
    processEmailUseCase = new ProcessEmailUseCase(
      mockEmailService,
      mockCardUsageRepository
    );
  });

  describe('execute', () => {
    test('正常系: メール本文からカード利用情報を抽出・保存・通知できること', async () => {
      // メソッドを実行
      const result = await processEmailUseCase.execute(sampleEmailBody, CardCompany.MUFG);

      // emailServiceのparseCardUsageFromEmailが呼ばれることを確認
      expect(mockEmailService.parseCardUsageFromEmail).toHaveBeenCalledWith(
        sampleEmailBody,
        CardCompany.MUFG
      );

      // リポジトリのsaveメソッドが適切なデータで呼ばれることを確認
      expect(mockCardUsageRepository.save).toHaveBeenCalledWith({
        card_name: sampleCardUsage.card_name,
        datetime_of_use: '2025-05-10T06:30:00.000Z',
        amount: sampleCardUsage.amount,
        where_to_use: sampleCardUsage.where_to_use,
        memo: sampleCardUsage.memo,
        is_active: sampleCardUsage.is_active,
      });

      // 戻り値が正しいか確認
      expect(result).toEqual({
        usage: sampleCardUsage,  // CardUsageMapper.toNotificationの戻り値を期待
        savedPath: 'users/2025/5/10/card-usage-123'
      });
    });

    test('異常系: メール解析に失敗した場合、エラーがスローされること', async () => {
      // parseCardUsageFromEmailで例外が発生するようモックを設定
      mockEmailService.parseCardUsageFromEmail.mockRejectedValueOnce(
        new Error('メール解析エラー')
      );

      // 例外がスローされることを確認
      await expect(processEmailUseCase.execute(sampleEmailBody, CardCompany.MUFG))
        .rejects.toThrow('メール解析エラー');

      // ErrorHandler.handleが呼ばれたことを確認
      expect(mockhandle).toHaveBeenCalled();
    });

    test('異常系: データ保存に失敗した場合、エラーがスローされること', async () => {
      // saveメソッドで例外が発生するようモックを設定
      mockCardUsageRepository.save.mockRejectedValueOnce(
        new Error('保存エラー')
      );

      // 例外がスローされることを確認
      await expect(processEmailUseCase.execute(sampleEmailBody, CardCompany.MUFG))
        .rejects.toThrow('保存エラー');

      // ErrorHandler.handleが呼ばれたことを確認
      expect(mockhandle).toHaveBeenCalled();
    });

    test('カード会社を指定しない場合、デフォルトでMUFGになること', async () => {
      // カード会社を指定せずに実行
      await processEmailUseCase.execute(sampleEmailBody);

      // MUFGがデフォルト値として使われることを確認
      expect(mockEmailService.parseCardUsageFromEmail).toHaveBeenCalledWith(
        sampleEmailBody,
        CardCompany.MUFG
      );
    });
  });
});