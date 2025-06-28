import { IDiscordNotifier } from '../../../../shared/domain/interfaces/discord/IDiscordNotifier';
import { DiscordNotifier } from '../../../../shared/infrastructure/discord/DiscordNotifier';
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

    private _reportRepository?: FirestoreReportRepository;
    private _discordNotifier?: IDiscordNotifier;
    private _reportUseCase?: FirestoreReportUseCase;
    private _notifyReportUseCase?: NotifyReportUseCase;

    /**
     * プライベートコンストラクタ（シングルトンパターンのため）
     */
    private constructor() {
        // 依存関係の即座の初期化は行わず、遅延初期化を採用
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

    // Getters
    /**
     * レポートリポジトリを取得
     * @returns FirestoreReportRepository
     */
    public get reportRepository(): FirestoreReportRepository {
        if (!this._reportRepository) {
            this._reportRepository = new FirestoreReportRepository();
        }
        return this._reportRepository;
    }

    /**
     * Discord通知器を取得
     * @returns IDiscordNotifier
     */
    public get discordNotifier(): IDiscordNotifier {
        if (!this._discordNotifier) {
            this._discordNotifier = new DiscordNotifier({
                usageWebhookUrl: Environment.getDiscordWebhookUrl(),
                loggingWebhookUrl: Environment.getDiscordLoggingWebhookUrl(),
                alertWeeklyWebhookUrl: Environment.getDiscordAlertWeeklyWebhookUrl(),
                alertMonthlyWebhookUrl: Environment.getDiscordAlertMonthlyWebhookUrl(),
                reportDailyWebhookUrl: Environment.getDiscordReportDailyWebhookUrl(),
                reportWeeklyWebhookUrl: Environment.getDiscordReportWeeklyWebhookUrl(),
                reportMonthlyWebhookUrl: Environment.getDiscordReportMonthlyWebhookUrl(),
            });
        }
        return this._discordNotifier;
    }

    /**
     * レポートユースケースを取得
     * @returns FirestoreReportUseCase
     */
    public get reportUseCase(): FirestoreReportUseCase {
        if (!this._reportUseCase) {
            this._reportUseCase = new FirestoreReportUseCase(this.reportRepository);
        }
        return this._reportUseCase;
    }

    /**
     * 通知レポートユースケースを取得
     * @returns NotifyReportUseCase
     */
    public get notifyReportUseCase(): NotifyReportUseCase {
        if (!this._notifyReportUseCase) {
            this._notifyReportUseCase = new NotifyReportUseCase(this.discordNotifier);
        }
        return this._notifyReportUseCase;
    }

    /**
     * レポート処理サービスを取得
     * @returns ReportProcessingService
     */
    public get reportProcessingService(): ReportProcessingService {
        return new ReportProcessingService(
            this.discordNotifier,
            this.reportUseCase
        );
    }
}
