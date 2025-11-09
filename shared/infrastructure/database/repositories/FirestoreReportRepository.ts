import { Firestore } from 'firebase-admin/firestore';
import { DailyReport, WeeklyReport, MonthlyReport } from '@shared/domain/entities/Reports';
import { IReportCrudRepository } from '@shared/domain/interfaces/database/repositories/IReportCrudRepository';
import { Environment } from '@shared/infrastructure/config/Environment';
import { FirestoreService } from '@shared/infrastructure/database/FirestoreService';
import { FirestorePathUtil } from '@shared/utils/FirestorePathUtil';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';
import { logger } from '@shared/infrastructure/logging/Logger';

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
        defaultMessage: 'Firestoreの初期化に失敗しました',
    })
    async initialize(): Promise<Firestore> {
        // Cloud Functions環境の判定
        const isCloudFunctions = Environment.isCloudFunctions();
        this.firestoreService.setCloudFunctions(isCloudFunctions);

        if (isCloudFunctions) {
            // Cloud Functions環境ではサービスアカウントキーは不要
            return await this.firestoreService.initialize();
        } else {
            // ローカル環境ではサービスアカウントキーが必要
            const serviceAccountPath = Environment.getFirebaseAdminKeyPath();
            return await this.firestoreService.initialize(serviceAccountPath);
        }
    }

    /**
     * 日次レポートを取得する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '日次レポートの取得に失敗しました',
    })
    async getDailyReport(year: string, month: string, day: string): Promise<DailyReport | null> {
        await this.initialize();

        // パス情報を取得（直接string引数を渡す）
        const dailyReportPath = FirestorePathUtil.getDailyReportPath(year, month, day);

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
        defaultMessage: '月内の日次レポート一覧の取得に失敗しました',
    })
    async getMonthlyDailyReports(year: string, month: string): Promise<DailyReport[]> {
        await this.initialize();

        // FirestorePathUtilを使用してベースパスを取得
// eslint-disable-next-line max-len
        const dailyReportBasePath = FirestorePathUtil.getDailyReportPath(year, month, '01').replace(/\/\d{2}$/, ''); // 月単位のパスに変更

        // 月内の全ての日次レポートを取得
        const reports = await this.firestoreService.query(
            dailyReportBasePath,
            (collection) => collection.orderBy('date', 'asc')
        );

        logger.info(`月内の日次レポート一覧を取得: ${year}年${month}月 (${reports.length}件)`, this.serviceContext);
        return reports as DailyReport[];
    }

    /**
     * 月次レポートを取得する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '月次レポートの取得に失敗しました',
    })
    async getMonthlyReport(year: string, month: string): Promise<MonthlyReport | null> {
        await this.initialize();

        // パス情報を取得（直接string引数を渡す）
        const monthlyReportPath = FirestorePathUtil.getMonthlyReportPath(year, month);

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
        defaultMessage: '週次レポートの取得に失敗しました',
    })
    async getWeeklyReport(year: string, month: string, term: string): Promise<WeeklyReport | null> {
        await this.initialize();

        const weeklyReportPath = `reports/weekly/${year}-${month.padStart(2, '0')}/term${term}`;
        logger.info(`週次レポート取得: パス=${weeklyReportPath}`, this.serviceContext);

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
        defaultMessage: '月内の週次レポート一覧の取得に失敗しました',
    })
    async getMonthlyWeeklyReports(year: string, month: string): Promise<WeeklyReport[]> {
        await this.initialize();

        // FirestorePathUtilを使用してベースパスを取得
// eslint-disable-next-line max-len
        const weeklyReportBasePath = FirestorePathUtil.getWeeklyReportPath(year, month, '01').replace(/\/term\d+$/, ''); // 月単位のパスに変更

        // 月内の全ての週次レポートを取得
        const reports = await this.firestoreService.query(
            weeklyReportBasePath,
            (collection) => collection.orderBy('termStartDate', 'asc')
        );

        logger.info(`月内の週次レポート一覧を取得: ${year}年${month}月 (${reports.length}件)`, this.serviceContext);
        return reports as WeeklyReport[];
    }

    /**
     * 日次レポートを保存する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '日次レポートの保存に失敗しました',
    })
    async saveDailyReport(report: DailyReport, year: string, month: string, day: string): Promise<string> {
        await this.initialize();

        // パス情報を取得（直接string引数を渡す）
        const dailyReportPath = FirestorePathUtil.getDailyReportPath(year, month, day);

        await this.firestoreService.saveDocument(dailyReportPath, report);
        logger.info(`日次レポートをFirestoreに保存しました: ${dailyReportPath}`, this.serviceContext);
        return dailyReportPath;
    }

    /**
     * 週次レポートを保存する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '週次レポートの保存に失敗しました',
    })
    async saveWeeklyReport(report: WeeklyReport, year: string, month: string, term: string): Promise<string> {
        await this.initialize();

        // パス情報を取得（実際の日付を使用）
        const weeklyReportPath = `reports/weekly/${year}-${month.padStart(2, '0')}/term${term}`;

        await this.firestoreService.saveDocument(weeklyReportPath, report);
        logger.info(`週次レポートをFirestoreに保存しました: ${weeklyReportPath}`, this.serviceContext);
        return weeklyReportPath;
    }

    /**
     * 月次レポートを保存する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '月次レポートの保存に失敗しました',
    })
    async saveMonthlyReport(report: MonthlyReport, year: string, month: string): Promise<string> {
        await this.initialize();

        // パス情報を取得（直接string引数を渡す）
        const monthlyReportPath = FirestorePathUtil.getMonthlyReportPath(year, month);

        await this.firestoreService.saveDocument(monthlyReportPath, report);
        logger.info(`月次レポートをFirestoreに保存しました: ${monthlyReportPath}`, this.serviceContext);
        return monthlyReportPath;
    }


    // Update Operations
    /**
     * 日次レポートを更新する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '日次レポートの更新に失敗しました',
    })
    async updateDailyReport(report: Partial<DailyReport>, year: string, month: string, day: string): Promise<string> {
        await this.initialize();

        // パス情報を取得（直接string引数を渡す）
        const documentPath = FirestorePathUtil.getDailyReportPath(year, month, day);

        logger.info(`日次レポート更新: ${documentPath}`, this.serviceContext);

        await this.firestoreService.updateDocument(documentPath, report);

        logger.info(`日次レポートを更新しました: ${documentPath}`, this.serviceContext);
        return documentPath;
    }

    /**
     * 週次レポートを更新する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '週次レポートの更新に失敗しました',
    })
// eslint-disable-next-line max-len
    async updateWeeklyReport(report: Partial<WeeklyReport>, year: string, month: string, term: string): Promise<string> {
        await this.initialize();

        // パス情報を取得（実際の日付を使用）
        const weeklyReportPath = `reports/weekly/${year}-${month.padStart(2, '0')}/term${term}`;

        logger.info(`週次レポート更新: ${weeklyReportPath}`, this.serviceContext);

        await this.firestoreService.updateDocument(weeklyReportPath, report);

        logger.info(`週次レポートを更新しました: ${weeklyReportPath}`, this.serviceContext);
        return weeklyReportPath;
    }

    /**
     * 月次レポートを更新する
     */
    @ErrorHandler.errorDecorator('FirestoreReportRepository', {
        defaultMessage: '月次レポートの更新に失敗しました',
    })
    async updateMonthlyReport(report: Partial<MonthlyReport>, year: string, month: string): Promise<string> {
        await this.initialize();

        // パス情報を取得（直接string引数を渡す）
        const documentPath = FirestorePathUtil.getMonthlyReportPath(year, month);

        logger.info(`月次レポート更新: ${documentPath}`, this.serviceContext);

        await this.firestoreService.updateDocument(documentPath, report);

        logger.info(`月次レポートを更新しました: ${documentPath}`, this.serviceContext);
        return documentPath;
    }
}
