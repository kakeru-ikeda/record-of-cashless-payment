import { ProcessEmailUseCase } from '../../../../src/usecases/email/ProcessEmailUseCase';
import { ImapEmailService, CardCompany } from '../../../../src/infrastructure/email/ImapEmailService';
import { ICardUsageRepository } from '../../../../src/domain/repositories/ICardUsageRepository';
import { DiscordNotifier } from '../../../../shared/discord/DiscordNotifier';
import { CardUsageNotification } from '../../../../shared/domain/entities/CardUsageNotification';
import * as admin from 'firebase-admin';

// 依存コンポーネントをモック化
jest.mock('../../../../src/infrastructure/email/ImapEmailService');
jest.mock('../../../../shared/discord/DiscordNotifier');

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

  const sampleCardUsage: CardUsageNotification = {
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

      // Firestoreのタイムスタンプ変換が呼ばれることを確認
      expect(admin.firestore.Timestamp.fromDate).toHaveBeenCalledWith(
        expect.any(Date)
      );

      // リポジトリのsaveメソッドが適切なデータで呼ばれることを確認
      expect(mockCardUsageRepository.save).toHaveBeenCalledWith({
        card_name: sampleCardUsage.card_name,
        datetime_of_use: 'mocked-firebase-timestamp',
        amount: sampleCardUsage.amount,
        where_to_use: sampleCardUsage.where_to_use,
        memo: sampleCardUsage.memo,
        is_active: sampleCardUsage.is_active,
        created_at: 'mocked-server-timestamp'
      });

      // Discordに通知は行われない (Controllerの責務に移動したため)
      expect(mockDiscordNotifier.notify).not.toHaveBeenCalled();

      // 戻り値が正しいか確認（オブジェクト形式に変更）
      expect(result).toEqual({
        usage: sampleCardUsage,
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
        .rejects.toThrow('メール処理中にエラーが発生しました');

      // エラーがログに記録されることを確認
      expect(require('../../../../shared/utils/Logger').logger.logAppError).toHaveBeenCalled();
    });

    test('異常系: データ保存に失敗した場合、エラーがスローされること', async () => {
      // saveメソッドで例外が発生するようモックを設定
      mockCardUsageRepository.save.mockRejectedValueOnce(
        new Error('保存エラー')
      );

      // 例外がスローされることを確認
      await expect(processEmailUseCase.execute(sampleEmailBody, CardCompany.MUFG))
        .rejects.toThrow('メール処理中にエラーが発生しました');

      // エラーがログに記録されることを確認
      expect(require('../../../../shared/utils/Logger').logger.logAppError).toHaveBeenCalled();
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

  describe('executeTest', () => {
    test('正常系: テストモードでメール処理が実行できること', async () => {
      // テスト実行
      const result = await processEmailUseCase.executeTest(sampleEmailBody, CardCompany.MUFG);

      // emailServiceのparseCardUsageFromEmailが呼ばれることを確認
      expect(mockEmailService.parseCardUsageFromEmail).toHaveBeenCalledWith(
        sampleEmailBody,
        CardCompany.MUFG
      );

      // リポジトリのsaveメソッドが呼ばれることを確認
      expect(mockCardUsageRepository.save).toHaveBeenCalled();

      // Discordに通知されないことを確認（Controllerの責務に移行したため）
      expect(mockDiscordNotifier.notify).not.toHaveBeenCalled();

      // 結果が正しい形式で返されることを確認（notificationSentフィールドが削除された）
      expect(result).toEqual({
        parsedData: sampleCardUsage,
        savedPath: 'users/2025/5/10/card-usage-123'
      });
    });

    test('異常系: テスト実行中にエラーが発生した場合、エラーがスローされること', async () => {
      // parseCardUsageFromEmailで例外が発生するようモックを設定
      mockEmailService.parseCardUsageFromEmail.mockRejectedValueOnce(
        new Error('テスト実行エラー')
      );

      // 例外がスローされることを確認
      await expect(processEmailUseCase.executeTest(sampleEmailBody, CardCompany.MUFG))
        .rejects.toThrow('テスト実行中にエラーが発生しました');

      // エラーがログに記録されることを確認
      expect(require('../../../../shared/utils/Logger').logger.logAppError).toHaveBeenCalled();
    });
  });
});