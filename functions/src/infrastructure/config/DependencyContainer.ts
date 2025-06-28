import { IDiscordNotifier } from '../../../../shared/domain/interfaces/discord/IDiscordNotifier';
import { DiscordNotifier } from '../../../../shared/infrastructure/discord/DiscordNotifier';
import { FirestoreService } from '../../../../shared/infrastructure/database/FirestoreService';
import { FirestoreReportRepository } from
    '../../../../shared/infrastructure/database/repositories/FirestoreReportRepository';
import { FirestoreReportUseCase } from '../../../../shared/usecases/database/FirestoreReportUseCase';
import { NotifyReportUseCase } from '../../../../shared/usecases/notification/NotifyReportUseCase';
import { Environment } from '../../../../shared/infrastructure/config/Environment';
import { ReportProcessingService } from '../../application/services/ReportProcessingService';

/**
 * 依存関係コンテナ
 * DI（依存性注入）の役割を果たし、アプリケーション全体で使用される依存関係を管理
 */
export class DependencyContainer {
    private static instance: DependencyContainer;

    private _firestoreService!: FirestoreService;
    private _reportRepository!: FirestoreReportRepository;
    private _discordNotifier!: IDiscordNotifier;
    private _reportUseCase!: FirestoreReportUseCase;
    private _notifyReportUseCase!: NotifyReportUseCase;

    /**
     * プライベートコンストラクタ（シングルトンパターンのため）
     */
    private constructor() {
        this.initializeDependencies();
    }

    /**
     * シングルトンインスタンスを取得
     */
    public static getInstance(): DependencyContainer {
        if (!DependencyContainer.instance) {
            DependencyContainer.instance = new DependencyContainer();
        }
        return DependencyContainer.instance;
    }

    /**
     * 依存関係を初期化
     */
    private initializeDependencies(): void {
        // Firestoreサービスの初期化
        this._firestoreService = FirestoreService.getInstance();
        this._firestoreService.setCloudFunctions(true);
        this._firestoreService.initialize();

        // リポジトリの初期化
        this._reportRepository = new FirestoreReportRepository();

        // Discord通知の設定
        this._discordNotifier = new DiscordNotifier({
            usageWebhookUrl: Environment.getDiscordWebhookUrl(),
            loggingWebhookUrl: Environment.getDiscordLoggingWebhookUrl(),
            alertWeeklyWebhookUrl: Environment.getDiscordAlertWeeklyWebhookUrl(),
            alertMonthlyWebhookUrl: Environment.getDiscordAlertMonthlyWebhookUrl(),
            reportDailyWebhookUrl: Environment.getDiscordReportDailyWebhookUrl(),
            reportWeeklyWebhookUrl: Environment.getDiscordReportWeeklyWebhookUrl(),
            reportMonthlyWebhookUrl: Environment.getDiscordReportMonthlyWebhookUrl(),
        });

        // ユースケースの初期化
        this._reportUseCase = new FirestoreReportUseCase(this._reportRepository);
        this._notifyReportUseCase = new NotifyReportUseCase(this._discordNotifier);
    }

    // Getters
    /**
     * Firestoreサービスを取得
     * @returns FirestoreService
     */
    public get firestoreService(): FirestoreService {
        return this._firestoreService;
    }

    /**
     * レポートリポジトリを取得
     * @returns FirestoreReportRepository
     */
    public get reportRepository(): FirestoreReportRepository {
        return this._reportRepository;
    }

    /**
     * Discord通知器を取得
     * @returns IDiscordNotifier
     */
    public get discordNotifier(): IDiscordNotifier {
        return this._discordNotifier;
    }

    /**
     * レポートユースケースを取得
     * @returns FirestoreReportUseCase
     */
    public get reportUseCase(): FirestoreReportUseCase {
        return this._reportUseCase;
    }

    /**
     * 通知レポートユースケースを取得
     * @returns NotifyReportUseCase
     */
    public get notifyReportUseCase(): NotifyReportUseCase {
        return this._notifyReportUseCase;
    }

    /**
     * レポート処理サービスを取得
     * @returns ReportProcessingService
     */
    public get reportProcessingService(): ReportProcessingService {
        return new ReportProcessingService(
            this._discordNotifier,
            this._reportUseCase
        );
    }
}
