import { DailyReport, WeeklyReport, MonthlyReport } from '@shared/domain/entities/Reports';
import { IReportCrudRepository } from '@shared/domain/interfaces/database/repositories/IReportCrudRepository';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';
import { logger } from '@shared/infrastructure/logging/Logger';
import { AppError, ErrorType } from '@shared/errors/AppError';

/**
 * レポート機能のユースケースクラス
 */
export class ReportUseCase {
    private reportRepository: IReportCrudRepository;
    private readonly serviceContext = 'ReportUseCase';

    constructor(reportRepository: IReportCrudRepository) {
        this.reportRepository = reportRepository;
    }

    /**
     * 日次レポートを取得する
     * @param year 年
     * @param month 月
     * @param day 日
     * @returns 日次レポート情報
     */
    @ErrorHandler.errorDecorator('ReportUseCase', {
        defaultMessage: '日次レポートの取得に失敗しました'
    })
    async getDailyReport(year: string, month: string, day: string): Promise<DailyReport> {
        logger.info(`日次レポート取得: ${year}年${month}月${day}日`, this.serviceContext);

        const report = await this.reportRepository.getDailyReport(year, month, day);

        if (!report) {
            throw new AppError(`${year}年${month}月${day}日のレポートが見つかりません`, ErrorType.NOT_FOUND);
        }

        return report;
    }

    /**
     * 月次レポートを取得する
     * @param year 年
     * @param month 月
     * @returns 月次レポート情報
     */
    @ErrorHandler.errorDecorator('ReportUseCase', {
        defaultMessage: '月次レポートの取得に失敗しました'
    })
    async getMonthlyReport(year: string, month: string): Promise<MonthlyReport> {
        logger.info(`月次レポート取得: ${year}年${month}月`, this.serviceContext);

        const report = await this.reportRepository.getMonthlyReport(year, month);

        if (!report) {
            throw new AppError(`${year}年${month}月のレポートが見つかりません`, ErrorType.NOT_FOUND);
        }

        return report;
    }

    /**
     * 週次レポートを取得する
     * @param year 年
     * @param month 月
     * @param term ターム（週番号）
     * @returns 週次レポート情報
     */
    @ErrorHandler.errorDecorator('ReportUseCase', {
        defaultMessage: '週次レポートの取得に失敗しました'
    })
    async getWeeklyReport(year: string, month: string, term: string): Promise<WeeklyReport> {
        logger.info(`週次レポート取得: ${year}年${month}月term${term}`, this.serviceContext);

        const report = await this.reportRepository.getWeeklyReportByTerm(year, month, term);

        if (!report) {
            throw new AppError(`${year}年${month}月term${term}の週次レポートが見つかりません`, ErrorType.NOT_FOUND);
        }

        return report;
    }

    /**
     * 月内の全日次レポートを取得する
     * @param year 年
     * @param month 月
     * @returns 日次レポート情報の配列
     */
    @ErrorHandler.errorDecorator('ReportUseCase', {
        defaultMessage: '月内日次レポート一覧の取得に失敗しました'
    })
    async getMonthlyDailyReports(year: string, month: string): Promise<DailyReport[]> {
        logger.info(`月内日次レポート一覧取得: ${year}年${month}月`, this.serviceContext);

        const reports = await this.reportRepository.getMonthlyDailyReports(year, month);

        return reports;
    }

    /**
     * 月内の全週次レポートを取得する
     * @param year 年
     * @param month 月
     * @returns 週次レポート情報の配列
     */
    @ErrorHandler.errorDecorator('ReportUseCase', {
        defaultMessage: '月内週次レポート一覧の取得に失敗しました'
    })
    async getMonthlyWeeklyReports(year: string, month: string): Promise<WeeklyReport[]> {
        logger.info(`月内週次レポート一覧取得: ${year}年${month}月`, this.serviceContext);

        const reports = await this.reportRepository.getMonthlyWeeklyReports(year, month);

        return reports;
    }

    /**
     * レポート一覧を取得する（廃止予定）
     * @param type レポートタイプ
     * @param limit 取得件数の上限
     * @param offset オフセット
     * @returns レポート情報の配列とページネーション情報
     */
    @ErrorHandler.errorDecorator('ReportUseCase', {
        defaultMessage: 'レポート一覧の取得に失敗しました'
    })
    async getReports(type: 'daily' | 'weekly' | 'monthly', limit: number, offset: number): Promise<{
        reports: (DailyReport | WeeklyReport | MonthlyReport)[];
        pagination: {
            limit: number;
            offset: number;
            total: number;
        };
    }> {
        logger.info(`レポート一覧取得: type=${type}, limit=${limit}, offset=${offset}`, this.serviceContext);

        // バリデーション
        this.validateLimit(limit);
        this.validateOffset(offset);
        this.validateReportType(type);

        // 新しいAPIでは月ごとに取得するため、この機能は廃止予定
        const reports: (DailyReport | WeeklyReport | MonthlyReport)[] = [];

        return {
            reports,
            pagination: {
                limit,
                offset,
                total: reports.length
            }
        };
    }

    /**
     * 日次レポートを作成する
     * @param reportData 日次レポートデータ
     * @param year 年
     * @param month 月
     * @param day 日
     * @returns 保存されたパス
     */
    @ErrorHandler.errorDecorator('ReportUseCase', {
        defaultMessage: '日次レポートの作成に失敗しました'
    })
    async createDailyReport(reportData: DailyReport, year: string, month: string, day: string): Promise<string> {
        logger.info(`日次レポート作成: ${year}年${month}月${day}日`, this.serviceContext);

        const path = await this.reportRepository.saveDailyReport(reportData, year, month, day);
        logger.info(`日次レポートを作成しました: ${path}`, this.serviceContext);

        return path;
    }

    /**
     * 週次レポートを作成する
     * @param reportData 週次レポートデータ
     * @param year 年
     * @param month 月
     * @param term ターム（週番号）
     * @returns 保存されたパス
     */
    @ErrorHandler.errorDecorator('ReportUseCase', {
        defaultMessage: '週次レポートの作成に失敗しました'
    })
    async createWeeklyReport(reportData: WeeklyReport, year: string, month: string): Promise<string> {
        logger.info(`週次レポート作成: ${year}年${month}月`, this.serviceContext);

        const path = await this.reportRepository.saveWeeklyReport(reportData, year, month);
        logger.info(`週次レポートを作成しました: ${path}`, this.serviceContext);

        return path;
    }

    /**
     * 月次レポートを作成する
     * @param reportData 月次レポートデータ
     * @param year 年
     * @param month 月
     * @returns 保存されたパス
     */
    @ErrorHandler.errorDecorator('ReportUseCase', {
        defaultMessage: '月次レポートの作成に失敗しました'
    })
    async createMonthlyReport(reportData: MonthlyReport, year: string, month: string): Promise<string> {
        logger.info(`月次レポート作成: ${year}年${month}月`, this.serviceContext);

        const path = await this.reportRepository.saveMonthlyReport(reportData, year, month);
        logger.info(`月次レポートを作成しました: ${path}`, this.serviceContext);

        return path;
    }

    // プライベートメソッド

    /**
     * limitパラメータのバリデーション
     */
    private validateLimit(limit: number): void {
        if (isNaN(limit) || limit < 1 || limit > 100) {
            throw new AppError('limitは1から100の間で指定してください', ErrorType.VALIDATION);
        }
    }

    /**
     * offsetパラメータのバリデーション
     */
    private validateOffset(offset: number): void {
        if (isNaN(offset) || offset < 0) {
            throw new AppError('offsetは0以上で指定してください', ErrorType.VALIDATION);
        }
    }

    /**
     * レポートタイプのバリデーション
     */
    private validateReportType(type: string): void {
        const validTypes = ['daily', 'weekly', 'monthly'];
        if (!validTypes.includes(type)) {
            throw new AppError('typeはdaily、weekly、monthlyのいずれかを指定してください', ErrorType.VALIDATION);
        }
    }
}
