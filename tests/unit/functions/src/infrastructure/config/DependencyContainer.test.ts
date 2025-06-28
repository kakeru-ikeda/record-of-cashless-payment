import { DependencyContainer } from '../../../../../../functions/src/infrastructure/config/DependencyContainer';
import { FirestoreService } from '../../../../../../shared/infrastructure/database/FirestoreService';
import { FirestoreReportRepository } from '../../../../../../shared/infrastructure/database/repositories/FirestoreReportRepository';
import { DiscordNotifier } from '../../../../../../shared/infrastructure/discord/DiscordNotifier';
import { FirestoreReportUseCase } from '../../../../../../shared/usecases/database/FirestoreReportUseCase';
import { NotifyReportUseCase } from '../../../../../../shared/usecases/notification/NotifyReportUseCase';
import { ReportProcessingService } from '../../../../../../functions/src/application/services/ReportProcessingService';
import { Environment } from '../../../../../../shared/infrastructure/config/Environment';

// モックの作成
jest.mock('../../../../../../shared/infrastructure/database/FirestoreService');
jest.mock('../../../../../../shared/infrastructure/database/repositories/FirestoreReportRepository');
jest.mock('../../../../../../shared/infrastructure/discord/DiscordNotifier');
jest.mock('../../../../../../shared/usecases/database/FirestoreReportUseCase');
jest.mock('../../../../../../shared/usecases/notification/NotifyReportUseCase');
jest.mock('../../../../../../functions/src/application/services/ReportProcessingService');
jest.mock('../../../../../../shared/infrastructure/config/Environment');

describe('DependencyContainer', () => {
    let container: DependencyContainer;
    let mockFirestoreService: jest.Mocked<FirestoreService>;
    let mockReportRepository: jest.Mocked<FirestoreReportRepository>;
    let mockDiscordNotifier: jest.Mocked<DiscordNotifier>;
    let mockReportUseCase: jest.Mocked<FirestoreReportUseCase>;
    let mockNotifyReportUseCase: jest.Mocked<NotifyReportUseCase>;

    beforeEach(() => {
        // モックの初期化
        mockFirestoreService = {
            setCloudFunctions: jest.fn(),
            initialize: jest.fn(),
            getInstance: jest.fn()
        } as any;

        mockReportRepository = {} as jest.Mocked<FirestoreReportRepository>;
        mockDiscordNotifier = {} as jest.Mocked<DiscordNotifier>;
        mockReportUseCase = {} as jest.Mocked<FirestoreReportUseCase>;
        mockNotifyReportUseCase = {} as jest.Mocked<NotifyReportUseCase>;

        // FirestoreService.getInstanceのモック
        (FirestoreService.getInstance as jest.Mock).mockReturnValue(mockFirestoreService);

        // Environmentのモック
        (Environment.getDiscordWebhookUrl as jest.Mock).mockReturnValue('https://discord.com/webhook1');
        (Environment.getDiscordLoggingWebhookUrl as jest.Mock).mockReturnValue('https://discord.com/webhook2');
        (Environment.getDiscordAlertWeeklyWebhookUrl as jest.Mock).mockReturnValue('https://discord.com/webhook3');
        (Environment.getDiscordAlertMonthlyWebhookUrl as jest.Mock).mockReturnValue('https://discord.com/webhook4');
        (Environment.getDiscordReportDailyWebhookUrl as jest.Mock).mockReturnValue('https://discord.com/webhook5');
        (Environment.getDiscordReportWeeklyWebhookUrl as jest.Mock).mockReturnValue('https://discord.com/webhook6');
        (Environment.getDiscordReportMonthlyWebhookUrl as jest.Mock).mockReturnValue('https://discord.com/webhook7');

        // コンストラクタのモック
        (FirestoreReportRepository as jest.Mock).mockImplementation(() => mockReportRepository);
        (DiscordNotifier as jest.Mock).mockImplementation(() => mockDiscordNotifier);
        (FirestoreReportUseCase as jest.Mock).mockImplementation(() => mockReportUseCase);
        (NotifyReportUseCase as jest.Mock).mockImplementation(() => mockNotifyReportUseCase);

        // DependencyContainerのインスタンスを取得
        container = DependencyContainer.getInstance();
    });

    afterEach(() => {
        // シングルトンインスタンスをクリア
        (DependencyContainer as any).instance = undefined;
        jest.clearAllMocks();
    });

    describe('getInstance', () => {
        it('シングルトンインスタンスが取得できること', () => {
            const instance1 = DependencyContainer.getInstance();
            const instance2 = DependencyContainer.getInstance();

            expect(instance1).toBe(instance2);
            expect(instance1).toBeInstanceOf(DependencyContainer);
        });
    });

    describe('遅延初期化', () => {
        it('コンストラクタ時点では依存関係が初期化されないこと', () => {
            // getInstance()時点では依存関係は初期化されない
            expect(FirestoreReportRepository).not.toHaveBeenCalled();
            expect(DiscordNotifier).not.toHaveBeenCalled();
            expect(FirestoreReportUseCase).not.toHaveBeenCalled();
            expect(NotifyReportUseCase).not.toHaveBeenCalled();
        });

        it('reportRepositoryアクセス時にFirestoreReportRepositoryが初期化されること', () => {
            const result = container.reportRepository;
            expect(FirestoreReportRepository).toHaveBeenCalled();
            expect(result).toBe(mockReportRepository);
        });

        it('discordNotifierアクセス時にDiscordNotifierが初期化されること', () => {
            const result = container.discordNotifier;
            expect(DiscordNotifier).toHaveBeenCalledWith({
                usageWebhookUrl: 'https://discord.com/webhook1',
                loggingWebhookUrl: 'https://discord.com/webhook2',
                alertWeeklyWebhookUrl: 'https://discord.com/webhook3',
                alertMonthlyWebhookUrl: 'https://discord.com/webhook4',
                reportDailyWebhookUrl: 'https://discord.com/webhook5',
                reportWeeklyWebhookUrl: 'https://discord.com/webhook6',
                reportMonthlyWebhookUrl: 'https://discord.com/webhook7',
            });
            expect(result).toBe(mockDiscordNotifier);
        });

        it('reportUseCaseアクセス時にFirestoreReportUseCaseが初期化されること', () => {
            const result = container.reportUseCase;
            expect(FirestoreReportUseCase).toHaveBeenCalledWith(mockReportRepository);
            expect(result).toBe(mockReportUseCase);
        });

        it('notifyReportUseCaseアクセス時にNotifyReportUseCaseが初期化されること', () => {
            const result = container.notifyReportUseCase;
            expect(NotifyReportUseCase).toHaveBeenCalledWith(mockDiscordNotifier);
            expect(result).toBe(mockNotifyReportUseCase);
        });
    });

    describe('Getters', () => {
        it('reportRepositoryプロパティが正しく取得できること', () => {
            const result = container.reportRepository;
            expect(result).toBe(mockReportRepository);
        });

        it('discordNotifierプロパティが正しく取得できること', () => {
            const result = container.discordNotifier;
            expect(result).toBe(mockDiscordNotifier);
        });

        it('reportUseCaseプロパティが正しく取得できること', () => {
            const result = container.reportUseCase;
            expect(result).toBe(mockReportUseCase);
        });

        it('notifyReportUseCaseプロパティが正しく取得できること', () => {
            const result = container.notifyReportUseCase;
            expect(result).toBe(mockNotifyReportUseCase);
        });

        it('reportProcessingServiceプロパティが正しく取得できること', () => {
            const result = container.reportProcessingService;

            expect(ReportProcessingService).toHaveBeenCalledWith(
                mockDiscordNotifier,
                mockReportUseCase
            );
            expect(result).toBeInstanceOf(ReportProcessingService);
        });
    });

    describe('エラーハンドリング', () => {
        it('DiscordNotifierの初期化でエラーが発生した場合、エラーが伝播すること', () => {
            const error = new Error('DiscordNotifier initialization failed');
            (DiscordNotifier as jest.Mock).mockImplementation(() => {
                throw error;
            });

            expect(() => {
                container.discordNotifier;
            }).toThrow('DiscordNotifier initialization failed');
        });
    });

    describe('複数回アクセス時の動作', () => {
        it('同一プロパティに複数回アクセスしても、初期化は一度だけ実行されること', () => {
            // 複数回アクセス
            const repo1 = container.reportRepository;
            const repo2 = container.reportRepository;
            const repo3 = container.reportRepository;

            // 同じインスタンスが返される
            expect(repo1).toBe(repo2);
            expect(repo2).toBe(repo3);

            // 初期化は一度だけ
            expect(FirestoreReportRepository).toHaveBeenCalledTimes(1);
        });

        it('異なるプロパティにアクセスしたときは、それぞれ初期化されること', () => {
            // 異なるプロパティにアクセス
            const repo = container.reportRepository;
            const notifier = container.discordNotifier;
            const useCase = container.reportUseCase;

            // それぞれ初期化される
            expect(FirestoreReportRepository).toHaveBeenCalledTimes(1);
            expect(DiscordNotifier).toHaveBeenCalledTimes(1);
            expect(FirestoreReportUseCase).toHaveBeenCalledTimes(1);

            // 正しいインスタンスが返される
            expect(repo).toBe(mockReportRepository);
            expect(notifier).toBe(mockDiscordNotifier);
            expect(useCase).toBe(mockReportUseCase);
        });
    });
});
