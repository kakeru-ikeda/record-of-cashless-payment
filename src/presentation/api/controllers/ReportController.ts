import { Request, Response } from 'express';
import { ResponseHelper } from '@shared/presentation/responses/ResponseHelper';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';
import { FirestoreReportRepository } from '@shared/infrastructure/database/repositories/FirestoreReportRepository';
import { FirestoreReportUseCase } from '@shared/usecases/database/FirestoreReportUseCase';

/**
 * レポートデータを操作するためのコントローラークラス
 */
export class ReportController {
    private reportUseCase: FirestoreReportUseCase;

    /**
     * コンストラクタ
     */
    constructor() {
        const reportRepository = new FirestoreReportRepository();
        this.reportUseCase = new FirestoreReportUseCase(reportRepository);
    }

    /**
     * 日次レポート取得（特定の日）
     */
    public getDailyReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const { year, month, day } = req.params;

            const report = await this.reportUseCase.getDailyReport(year, month, day);

            const response = ResponseHelper.success('日次レポートを取得しました', report);
            res.status(response.status).json(response);
        } catch (error) {
            const appError = await ErrorHandler.handle(error, 'ReportController.getDailyReport');
            const errorResponse = ResponseHelper.fromAppError(appError);
            res.status(errorResponse.status).json(errorResponse);
        }
    }

    /**
     * 月次レポート取得
     */
    public getMonthlyReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const { year, month } = req.params;

            const report = await this.reportUseCase.getMonthlyReport(year, month);

            const response = ResponseHelper.success('月次レポートを取得しました', report);
            res.status(response.status).json(response);
        } catch (error) {
            const appError = await ErrorHandler.handle(error, 'ReportController.getMonthlyReport');
            const errorResponse = ResponseHelper.fromAppError(appError);
            res.status(errorResponse.status).json(errorResponse);
        }
    }

    /**
     * 週次レポート取得（特定の週）
     */
    public getWeeklyReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const { year, month, term } = req.params;

            const report = await this.reportUseCase.getWeeklyReport(year, month, term);

            const response = ResponseHelper.success('週次レポートを取得しました', report);
            res.status(response.status).json(response);
        } catch (error) {
            const appError = await ErrorHandler.handle(error, 'ReportController.getWeeklyReport');
            const errorResponse = ResponseHelper.fromAppError(appError);
            res.status(errorResponse.status).json(errorResponse);
        }
    }

    /**
     * 月内の全日次レポート取得
     */
    public getMonthlyDailyReports = async (req: Request, res: Response): Promise<void> => {
        try {
            const { year, month } = req.params;

            const reports = await this.reportUseCase.getMonthlyDailyReports(year, month);

            const response = ResponseHelper.success('月内日次レポート一覧を取得しました', reports);
            res.status(response.status).json(response);
        } catch (error) {
            const appError = await ErrorHandler.handle(error, 'ReportController.getMonthlyDailyReports');
            const errorResponse = ResponseHelper.fromAppError(appError);
            res.status(errorResponse.status).json(errorResponse);
        }
    }

    /**
     * 月内の全週次レポート取得
     */
    public getMonthlyWeeklyReports = async (req: Request, res: Response): Promise<void> => {
        try {
            const { year, month } = req.params;

            const reports = await this.reportUseCase.getMonthlyWeeklyReports(year, month);

            const response = ResponseHelper.success('月内週次レポート一覧を取得しました', reports);
            res.status(response.status).json(response);
        } catch (error) {
            const appError = await ErrorHandler.handle(error, 'ReportController.getMonthlyWeeklyReports');
            const errorResponse = ResponseHelper.fromAppError(appError);
            res.status(errorResponse.status).json(errorResponse);
        }
    }
}
