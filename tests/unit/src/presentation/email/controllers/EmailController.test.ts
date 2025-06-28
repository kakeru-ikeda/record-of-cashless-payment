import { EmailController } from '../../../../../../src/presentation/email/controllers/EmailController';
import { ImapEmailService } from '../../../../../../src/infrastructure/email/ImapEmailService';
import { ProcessCardCompanyEmailUseCase } from '../../../../../../src/usecases/email/ProcessCardCompanyEmailUseCase';
import { NotifyCardUsageUseCase } from '../../../../../../src/usecases/notification/NotifyCardUsageUseCase';
import { ParsedEmail } from '../../../../../../src/infrastructure/email/EmailParser';
import { CardCompany } from '../../../../../../src/domain/enums/CardCompany';

// 依存コンポーネントをモック
jest.mock('../../../../../../src/infrastructure/email/ImapEmailService');
jest.mock('../../../../../../src/usecases/email/ProcessCardCompanyEmailUseCase');
jest.mock('../../../../../../src/usecases/notification/NotifyCardUsageUseCase');
jest.mock('../../../../../../shared/infrastructure/config/Environment', () => ({
    Environment: {
        IMAP_SERVER: 'imap.example.com',
        IMAP_USER: 'user@example.com',
        IMAP_PASSWORD: 'password',
        DISCORD_WEBHOOK_URL: 'https://discord.webhook/test',
        DISCORD_LOGGING_WEBHOOK_URL: 'https://discord.webhook/test_logging'
    }
}));

// Loggerをモック化
jest.mock('../../../../../../shared/infrastructure/logging/Logger', () => ({
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
jest.mock('../../../../../../shared/infrastructure/errors/ErrorHandler', () => ({
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

describe('EmailController', () => {
    let emailController: EmailController;
    let mockProcessCardCompanyEmailUseCase: jest.Mocked<ProcessCardCompanyEmailUseCase>;
    let mockNotifyCardUsageUseCase: jest.Mocked<NotifyCardUsageUseCase>;

    // コールバック関数を保存するためのオブジェクト
    let emailCallbacks: Record<string, (email: ParsedEmail) => Promise<void>> = {};

    // テスト用のサンプルメールデータ
    const sampleParsedEmail: ParsedEmail = {
        uid: '123',
        subject: 'デビットカード利用のお知らせ',
        from: 'notification@bk.mufg.jp',
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
        subject: '三井住友カードのご利用のお知らせ',
        from: 'notification@smbc-card.com',
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

        // ProcessCardCompanyEmailUseCaseのモックを設定
        mockProcessCardCompanyEmailUseCase = {
            execute: jest.fn().mockResolvedValue({
                cardCompany: CardCompany.MUFG,
                usageResult: {
                    usage: {
                        card_name: 'テストカード',
                        datetime_of_use: '2025-05-10T06:30:00.000Z',
                        amount: 1500,
                        where_to_use: 'テスト利用先',
                    },
                    savedPath: 'users/2025/5/10/card-usage-123'
                }
            })
        } as unknown as jest.Mocked<ProcessCardCompanyEmailUseCase>;

        // NotifyCardUsageUseCaseのモックを設定
        mockNotifyCardUsageUseCase = {
            notifyUsage: jest.fn().mockResolvedValue(undefined),
            notifyError: jest.fn().mockResolvedValue(undefined),
            notifyLogging: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<NotifyCardUsageUseCase>;

        // EmailControllerのインスタンスを作成
        emailController = new EmailController(
            mockProcessCardCompanyEmailUseCase,
            mockNotifyCardUsageUseCase
        );
    });

    describe('startAllMonitoring', () => {
        test('正常系: すべてのメールボックスの監視を開始できること', async () => {
            await emailController.startAllMonitoring();

            // ImapEmailServiceのインスタンスが2回作成されることを確認
            expect(ImapEmailService).toHaveBeenCalledTimes(2);

            // connectメソッドが各メールボックスで呼ばれることを確認
            const emailServiceInstances = (ImapEmailService as jest.Mock).mock.results;

            // 実装内で新しく作られるインスタンスのconnectが正しく呼ばれることを確認
            expect(emailServiceInstances[0].value.connect).toHaveBeenCalledWith(
                '三菱東京UFJ銀行',
                expect.any(Function)
            );
            expect(emailServiceInstances[1].value.connect).toHaveBeenCalledWith(
                '三井住友カード',
                expect.any(Function)
            );

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

            // エラーが発生してもSMBCの接続は行われる
            expect(emailCallbacks['SMBC']).toBeDefined();

            // 監視フラグはtrueになる
            expect(emailController.isMonitoring()).toBe(true);
        });
    });

    describe('stopMonitoring', () => {
        test('正常系: すべてのメールボックスの監視を停止できること', async () => {
            // まず監視開始
            await emailController.startAllMonitoring();

            // 監視停止
            await emailController.stopMonitoring();

            // すべてのインスタンスのcloseメソッドが呼ばれることを確認
            const instances = (ImapEmailService as jest.Mock).mock.results;
            const closeMethodCalls = instances
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
        test('正常系: メールが正しく処理されること', async () => {
            // 監視開始
            await emailController.startAllMonitoring();

            // MUFGのコールバックを取得して手動で実行
            const callback = emailCallbacks['MUFG'];
            expect(callback).toBeDefined();

            await callback(sampleParsedEmail);

            // ProcessCardCompanyEmailUseCaseのexecuteが呼ばれることを検証
            expect(mockProcessCardCompanyEmailUseCase.execute).toHaveBeenCalledWith(
                sampleParsedEmail
            );

            // NotifyCardUsageUseCaseのnotifyUsageが呼ばれることを確認
            expect(mockNotifyCardUsageUseCase.notifyUsage).toHaveBeenCalledWith(
                expect.objectContaining({
                    card_name: expect.any(String),
                    datetime_of_use: expect.any(String),
                    amount: expect.any(Number),
                    where_to_use: expect.any(String)
                })
            );
        });

        test('異常系: ProcessCardCompanyEmailUseCaseがnullを返す場合の挙動', async () => {
            // カード会社を特定できないケース
            mockProcessCardCompanyEmailUseCase.execute.mockResolvedValueOnce({
                cardCompany: null
            });

            // 監視開始
            await emailController.startAllMonitoring();

            // コールバックを取得して手動で実行
            const callback = emailCallbacks['MUFG'];

            // AppErrorがスローされることを期待する
            await expect(callback(sampleParsedEmail)).rejects.toThrow('カード会社を特定できませんでした');

            // 利用通知は呼ばれないことを確認
            expect(mockNotifyCardUsageUseCase.notifyUsage).not.toHaveBeenCalled();
        });

        test('異常系: ProcessCardCompanyEmailUseCaseでエラーが発生した場合', async () => {
            // 監視開始
            await emailController.startAllMonitoring();

            // エラーをモック
            mockProcessCardCompanyEmailUseCase.execute.mockRejectedValueOnce(new Error('処理エラー'));

            // コールバックを取得
            const callback = emailCallbacks['MUFG'];

            // 例外がスローされることを期待するように変更
            await expect(callback(sampleParsedEmail)).rejects.toThrow('処理エラー');

            // 利用通知は呼ばれないことを確認
            expect(mockNotifyCardUsageUseCase.notifyUsage).not.toHaveBeenCalled();
        });

        test('異常系: NotifyCardUsageUseCaseでエラーが発生した場合', async () => {
            // 監視開始
            await emailController.startAllMonitoring();

            // 通知エラーをモック
            mockNotifyCardUsageUseCase.notifyUsage.mockRejectedValueOnce(new Error('通知エラー'));

            // コールバックを取得
            const callback = emailCallbacks['MUFG'];

            // 例外がスローされることを期待するように変更
            await expect(callback(sampleParsedEmail)).rejects.toThrow('通知エラー');

            // notifyUsageが呼ばれたことを確認
            expect(mockNotifyCardUsageUseCase.notifyUsage).toHaveBeenCalled();
        });
    });
});
