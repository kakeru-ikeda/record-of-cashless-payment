/* eslint-disable camelcase */
import { Request, Response } from 'express';
import { FirestoreService } from '../../../../shared/firebase/FirestoreService';
import { DateUtil } from '../../../../shared/utils/DateUtil';
import { ResponseHelper } from '../../../../shared/utils/ResponseHelper';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { ErrorHandler } from '../../../../shared/errors/ErrorHandler';

/**
 * レポートデータを操作するためのコントローラークラス
 */
export class ReportController {
    private firestoreService: FirestoreService;

    /**
     * コンストラクタ
     * FirestoreServiceのインスタンスを取得
     */
    constructor() {
        this.firestoreService = FirestoreService.getInstance();
    }

    /**
     * 日次レポート取得（特定の日）
     */
    async getDailyReport(req: Request, res: Response): Promise<void> {
        try {
            const { year, month, day } = req.params;

            // DateUtilを使用してパスを取得
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            const pathInfo = DateUtil.getFirestorePath(dateObj);
            const dailyReportPath = pathInfo.dailyReportPath;

            // レポートデータを取得
            const reportData = await this.firestoreService.getDocument(dailyReportPath);

            if (!reportData) {
                throw new AppError(`${year}年${month}月${day}日のレポートが見つかりません`, ErrorType.NOT_FOUND);
            }

            res.json(ResponseHelper.success('日次レポートを取得しました', reportData));
        } catch (error) {
            const response = ErrorHandler.handle(error, 'ReportController.getDailyReport');
            res.status(response.status).json(response);
        }
    }

    /**
     * 日次レポート取得（月内の全日）
     */
    async getMonthlyDailyReports(req: Request, res: Response): Promise<void> {
        try {
            const { year, month } = req.params;

            const endDate = new Date(parseInt(year), parseInt(month), 0); // 月の最終日
            const reports: { [key: string]: any } = {};

            // 月内の各日のレポートを取得
            for (let day = 1; day <= endDate.getDate(); day++) {
                const dateObj = new Date(parseInt(year), parseInt(month) - 1, day);
                const pathInfo = DateUtil.getFirestorePath(dateObj);
                const dailyReportPath = pathInfo.dailyReportPath;

                // レポートデータを取得
                const reportData = await this.firestoreService.getDocument(dailyReportPath);
                if (reportData) {
                    // 日付をキーとしてレポートを追加
                    reports[day.toString().padStart(2, '0')] = reportData;
                }
            }

            res.json(ResponseHelper.success(`${year}年${month}月の日次レポートを取得しました`, reports));
        } catch (error) {
            const response = ErrorHandler.handle(error, 'ReportController.getMonthlyDailyReports');
            res.status(response.status).json(response);
        }
    }

    /**
     * 週次レポート取得（特定の週）
     */
    async getWeeklyReport(req: Request, res: Response): Promise<void> {
        try {
            const { year, month, term } = req.params;

            const weeklyReportPath = `reports/weekly/${year}-${month}/${term}`;

            // レポートデータを取得
            const reportData = await this.firestoreService.getDocument(weeklyReportPath);

            if (!reportData) {
                throw new AppError(`${year}年${month}月 第${term.replace('term', '')}週のレポートが見つかりません`, ErrorType.NOT_FOUND);
            }

            res.json(ResponseHelper.success('週次レポートを取得しました', reportData));
        } catch (error) {
            const response = ErrorHandler.handle(error, 'ReportController.getWeeklyReport');
            res.status(response.status).json(response);
        }
    }

    /**
     * 週次レポート取得（月内の全週）
     */
    async getMonthlyWeeklyReports(req: Request, res: Response): Promise<void> {
        try {
            const { year, month } = req.params;

            const reports: { [key: string]: any } = {};

            // 月内の週のレポートを取得（最大5週）
            for (let weekNum = 1; weekNum <= 5; weekNum++) {
                // 週番号に対応するディレクトリパスを生成
                const term = `term${weekNum}`;
                const weeklyReportPath = `reports/weekly/${year}-${month}/${term}`;

                // レポートデータを取得
                const reportData = await this.firestoreService.getDocument(weeklyReportPath);
                if (reportData) {
                    // 週番号をキーとしてレポートを追加
                    reports[term] = reportData;
                }
            }

            res.json(ResponseHelper.success(`${year}年${month}月の週次レポートを取得しました`, reports));
        } catch (error) {
            const response = ErrorHandler.handle(error, 'ReportController.getMonthlyWeeklyReports');
            res.status(response.status).json(response);
        }
    }

    /**
     * 月次レポート取得
     */
    async getMonthlyReport(req: Request, res: Response): Promise<void> {
        try {
            const { year, month } = req.params;

            // DateUtilを使用してパスを取得
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
            const pathInfo = DateUtil.getFirestorePath(dateObj);
            const monthlyReportPath = pathInfo.monthlyReportPath;

            // レポートデータを取得
            const reportData = await this.firestoreService.getDocument(monthlyReportPath);

            if (!reportData) {
                throw new AppError(`${year}年${month}月のレポートが見つかりません`, ErrorType.NOT_FOUND);
            }

            res.json(ResponseHelper.success('月次レポートを取得しました', reportData));
        } catch (error) {
            const response = ErrorHandler.handle(error, 'ReportController.getMonthlyReport');
            res.status(response.status).json(response);
        }
    }
}
