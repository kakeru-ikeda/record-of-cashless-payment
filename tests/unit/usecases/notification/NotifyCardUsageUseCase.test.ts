import { NotifyCardUsageUseCase } from '../../../../src/usecases/notification/NotifyCardUsageUseCase';
import { DiscordNotifier } from '../../../../shared/infrastructure/discord/DiscordNotifier';
import { CardUsageNotification } from '../../../../shared/domain/entities/CardUsageNotification';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';

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

describe('NotifyCardUsageUseCase', () => {
  let notifyCardUsageUseCase: NotifyCardUsageUseCase;
  let mockDiscordNotifier: jest.Mocked<DiscordNotifier>;

  // テスト用のサンプルデータ
  const sampleCardUsage: CardUsageNotification = {
    card_name: 'テストカード',
    datetime_of_use: '2025-05-10T06:30:00.000Z',
    amount: 1500,
    where_to_use: 'テスト利用先'
  };

  const sampleAppError = new AppError(
    'テストエラー',
    ErrorType.EMAIL,
    { detail: 'error details' }
  );

  beforeEach(() => {
    jest.clearAllMocks();

    // モックの設定
    mockDiscordNotifier = {
      notify: jest.fn().mockResolvedValue(true),
      notifyError: jest.fn().mockResolvedValue(true),
      notifyLogging: jest.fn().mockResolvedValue(true)
    } as unknown as jest.Mocked<DiscordNotifier>;

    // NotifyCardUsageUseCaseのインスタンスを作成
    notifyCardUsageUseCase = new NotifyCardUsageUseCase(mockDiscordNotifier);
  });

  describe('notifyUsage', () => {
    test('正常系: Discord通知が正しく送信されること', async () => {
      // notifyUsageを実行
      await notifyCardUsageUseCase.notifyUsage(sampleCardUsage);

      // DiscordNotifierのnotifyが呼ばれることを確認
      expect(mockDiscordNotifier.notify).toHaveBeenCalledWith(sampleCardUsage);
    });

    test('異常系: Discord通知に失敗した場合、エラーがスローされること', async () => {
      // notifyが失敗するようにモック
      mockDiscordNotifier.notify.mockRejectedValueOnce(new Error('通知失敗'));

      // エラーがスローされることを確認
      await expect(notifyCardUsageUseCase.notifyUsage(sampleCardUsage))
        .rejects.toThrow('通知失敗');
    });
  });
});