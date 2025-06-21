import { Firestore } from 'firebase-admin/firestore';
import { DailyReport, WeeklyReport, MonthlyReport } from '@shared/domain/entities/Report';
import { IReportCrudRepository } from '@shared/domain/interfaces/database/repositories/IReportCrudRepository';
import { Environment } from '@shared/infrastructure/config/Environment';
import { FirestoreService } from '@shared/infrastructure/database/FirestoreService';
import { FirestorePathUtil } from '@shared/utils/FirestorePathUtil';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';
import { logger } from '@shared/infrastructure/logging/Logger';
import { AppError, ErrorType } from '@shared/errors/AppError';

/**
 * Firestoreを使用したレポート情報リポジトリの実装
 */
export class FirestoreReportRepository implements IReportCrudRepository {
    private firestoreService: FirestoreService;
    private readonly serviceContext = 'FirestoreReportRepository';

    constructor() {
        this.firestoreService = FirestoreService.getInstance();
    }

    /**
     * Firestoreへの接続を初期化する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: 'Firestoreの初期化に失敗しました'
    })
    async initialize(): Promise<Firestore> {
        // サービスアカウントの秘密鍵のパスを取得
        const serviceAccountPath = Environment.getFirebaseAdminKeyPath();

        // ローカル環境として初期化
        this.firestoreService.setCloudFunctions(Environment.isCloudFunctions());
        return await this.firestoreService.initialize(serviceAccountPath);
    }

    /**
     * 日次レポートを取得する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '日次レポートの取得に失敗しました'
    })
    async getDailyReport(year: string, month: string, day: string): Promise<DailyReport | null> {
        await this.initialize();

        // 日付のバリデーション
        const date = this.validateDate(year, month, day);

        // パス情報を取得
        const pathInfo = FirestorePathUtil.getFirestorePath(date);
        const dailyReportPath = pathInfo.dailyReportPath;

        // レポートデータを取得
        const reportData = await this.firestoreService.getDocument<DailyReport>(dailyReportPath);

        if (!reportData) {
            logger.info(`日次レポートが見つかりません: ${year}年${month}月${day}日`, this.serviceContext);
            return null;
        }

        return reportData;
    }

    /**
     * 月内の全日次レポートを取得する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '月内の日次レポート一覧の取得に失敗しました'
    })
    async getMonthlyDailyReports(year: string, month: string): Promise<DailyReport[]> {
        await this.initialize();

        // 年月のバリデーション
        const date = this.validateYearMonth(year, month);
        // FirestorePathUtilを使用してベースパスを取得
        const pathInfo = FirestorePathUtil.getFirestorePath(date);
        const baseReportPath = pathInfo.dailyReportPath.replace(/\/\d{2}$/, ''); // 月単位のパスに変更

        // 月内の全ての日次レポートを取得
        const reports = await this.firestoreService.query(
            baseReportPath,
            (collection) => collection.orderBy('date', 'asc')
        );

        logger.info(`月内の日次レポート一覧を取得: ${year}年${month}月 (${reports.length}件)`, this.serviceContext);
        return reports as DailyReport[];
    }

    /**
     * 月次レポートを取得する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '月次レポートの取得に失敗しました'
    })
    async getMonthlyReport(year: string, month: string): Promise<MonthlyReport | null> {
        await this.initialize();

        // 年月のバリデーション
        const date = this.validateYearMonth(year, month);

        // パス情報を取得
        const pathInfo = FirestorePathUtil.getFirestorePath(date);
        const monthlyReportPath = pathInfo.monthlyReportPath;

        // レポートデータを取得
        const reportData = await this.firestoreService.getDocument<MonthlyReport>(monthlyReportPath);

        if (!reportData) {
            logger.info(`月次レポートが見つかりません: ${year}年${month}月`, this.serviceContext);
            return null;
        }

        return reportData;
    }

    /**
     * 週次レポートを取得する（特定の週）
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '週次レポートの取得に失敗しました'
    })
    async getWeeklyReportByTerm(year: string, month: string, term: string): Promise<WeeklyReport | null> {
        await this.initialize();

        // 年月の日付を作成してFirestorePathUtilを使用
        const date = this.validateYearMonth(year, month);
        const pathInfo = FirestorePathUtil.getFirestorePath(date);

        // FirestorePathUtilのweeklyReportPathを使用
        const weeklyReportPath = pathInfo.weeklyReportPath;

        // レポートデータを取得
        const reportData = await this.firestoreService.getDocument<WeeklyReport>(weeklyReportPath);

        if (!reportData) {
            logger.info(`週次レポートが見つかりません: ${year}年${month}月term${term}`, this.serviceContext);
            return null;
        }

        return reportData;
    }

    /**
     * 月内の全週次レポートを取得する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '月内の週次レポート一覧の取得に失敗しました'
    })
    async getMonthlyWeeklyReports(year: string, month: string): Promise<WeeklyReport[]> {
        await this.initialize();

        // 年月のバリデーション
        const date = this.validateYearMonth(year, month);

        // FirestorePathUtilを使用してベースパスを取得
        const pathInfo = FirestorePathUtil.getFirestorePath(date);
        const baseReportPath = pathInfo.weeklyReportPath.replace(/\/term\d+$/, ''); // 月単位のパスに変更

        // 月内の全ての週次レポートを取得
        const reports = await this.firestoreService.query(
            baseReportPath,
            (collection) => collection.orderBy('termStartDate', 'asc')
        );

        logger.info(`月内の週次レポート一覧を取得: ${year}年${month}月 (${reports.length}件)`, this.serviceContext);
        return reports as WeeklyReport[];
    }

    /**
     * 日次レポートを保存する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '日次レポートの保存に失敗しました'
    })
    async saveDailyReport(report: DailyReport, year: string, month: string, day: string): Promise<string> {
        await this.initialize();

        // 日付のバリデーション
        const date = this.validateDate(year, month, day);

        // パス情報を取得
        const pathInfo = FirestorePathUtil.getFirestorePath(date);
        const dailyReportPath = pathInfo.dailyReportPath;

        await this.firestoreService.saveDocument(dailyReportPath, report);
        logger.info(`日次レポートをFirestoreに保存しました: ${dailyReportPath}`, this.serviceContext);
        return dailyReportPath;
    }

    /**
     * 週次レポートを保存する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '週次レポートの保存に失敗しました'
    })
    async saveWeeklyReport(report: WeeklyReport, year: string, month: string): Promise<string> {
        await this.initialize();

        // 年月のバリデーション
        const date = this.validateYearMonth(year, month);

        // パス情報を取得
        const pathInfo = FirestorePathUtil.getFirestorePath(date);
        const weeklyReportPath = pathInfo.weeklyReportPath;

        await this.firestoreService.saveDocument(weeklyReportPath, report);
        logger.info(`週次レポートをFirestoreに保存しました: ${weeklyReportPath}`, this.serviceContext);
        return weeklyReportPath;
    }

    /**
     * 月次レポートを保存する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '月次レポートの保存に失敗しました'
    })
    async saveMonthlyReport(report: MonthlyReport, year: string, month: string): Promise<string> {
        await this.initialize();

        // 年月のバリデーション
        const date = this.validateYearMonth(year, month);

        // パス情報を取得
        const pathInfo = FirestorePathUtil.getFirestorePath(date);
        const monthlyReportPath = pathInfo.monthlyReportPath;

        await this.firestoreService.saveDocument(monthlyReportPath, report);
        logger.info(`月次レポートをFirestoreに保存しました: ${monthlyReportPath}`, this.serviceContext);
        return monthlyReportPath;
    }

    // プライベートメソッド

    /**
     * 日付のバリデーション
     */
    private validateDate(year: string, month: string, day: string): Date {
        const yearNum = parseInt(year, 10);
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);

        if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum)) {
            throw new AppError('年、月、日は数値で指定してください', ErrorType.VALIDATION);
        }

        if (yearNum < 2000 || yearNum > 2100) {
            throw new AppError('年は2000年から2100年の間で指定してください', ErrorType.VALIDATION);
        }

        if (monthNum < 1 || monthNum > 12) {
            throw new AppError('月は1から12の間で指定してください', ErrorType.VALIDATION);
        }

        if (dayNum < 1 || dayNum > 31) {
            throw new AppError('日は1から31の間で指定してください', ErrorType.VALIDATION);
        }

        const date = new Date(yearNum, monthNum - 1, dayNum);
        if (date.getFullYear() !== yearNum || date.getMonth() !== monthNum - 1 || date.getDate() !== dayNum) {
            throw new AppError('無効な日付です', ErrorType.VALIDATION);
        }

        return date;
    }

    /**
     * 年月のバリデーション
     */
    private validateYearMonth(year: string, month: string): Date {
        const yearNum = parseInt(year, 10);
        const monthNum = parseInt(month, 10);

        if (isNaN(yearNum) || isNaN(monthNum)) {
            throw new AppError('年、月は数値で指定してください', ErrorType.VALIDATION);
        }

        if (yearNum < 2000 || yearNum > 2100) {
            throw new AppError('年は2000年から2100年の間で指定してください', ErrorType.VALIDATION);
        }

        if (monthNum < 1 || monthNum > 12) {
            throw new AppError('月は1から12の間で指定してください', ErrorType.VALIDATION);
        }

        return new Date(yearNum, monthNum - 1, 1);
    }
}
