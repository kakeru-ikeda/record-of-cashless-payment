import { Request, Response } from 'express';
import { FirestoreService } from '@shared/infrastructure/database/FirestoreService';
import { AppError, ErrorType } from '@shared/errors/AppError';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';
import { ResponseHelper } from '@shared/presentation/responses/ResponseHelper';
import { FirestoreCardUsageRepository } from '@infrastructure/firebase/FirestoreCardUsageRepository';

/**
 * レポートデータを操作するためのコントローラークラス
 */
export class ReportController {
    private firestoreService: FirestoreService;

    /**
     * コンストラクタ
     */
    constructor() {
        this.firestoreService = FirestoreService.getInstance();
    }

    /**
     * 日次レポート取得（特定の日）
     */
    public getDailyReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const { year, month, day } = req.params;

            // 日付のバリデーション
            const date = this.validateDate(year, month, day);

            // FirestoreCardUsageRepositoryを使用してパスを取得
            const pathInfo = FirestoreCardUsageRepository.getFirestorePath(date);
            const dailyReportPath = pathInfo.dailyReportPath;

            // レポートデータを取得
            const reportData = await this.firestoreService.getDocument(dailyReportPath);

            if (!reportData) {
                const errorResponse = ResponseHelper.notFound(`${year}年${month}月${day}日のレポートが見つかりません`);
                res.status(errorResponse.status).json(errorResponse);
                return;
            }

            const response = ResponseHelper.success('日次レポートを取得しました', reportData);
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

            // 年月のバリデーション
            const date = this.validateYearMonth(year, month);

            // FirestoreCardUsageRepositoryを使用してパスを取得
            const pathInfo = FirestoreCardUsageRepository.getFirestorePath(date);
            const monthlyReportPath = pathInfo.monthlyReportPath;

            // レポートデータを取得
            const reportData = await this.firestoreService.getDocument(monthlyReportPath);

            if (!reportData) {
                const errorResponse = ResponseHelper.notFound(`${year}年${month}月のレポートが見つかりません`);
                res.status(errorResponse.status).json(errorResponse);
                return;
            }

            const response = ResponseHelper.success('月次レポートを取得しました', reportData);
            res.status(response.status).json(response);
        } catch (error) {
            const appError = await ErrorHandler.handle(error, 'ReportController.getMonthlyReport');
            const errorResponse = ResponseHelper.fromAppError(appError);
            res.status(errorResponse.status).json(errorResponse);
        }
    }

    /**
     * 週次レポート取得
     */
    public getWeeklyReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const { year, weekNumber } = req.params;

            // 年・週番号のバリデーション
            const validatedYear = this.validateYear(year);
            const validatedWeekNumber = this.validateWeekNumber(weekNumber);

            // 週次レポートパスを構築
            const weeklyReportPath = `reports/weekly/${validatedYear}/week_${validatedWeekNumber}`;

            // レポートデータを取得
            const reportData = await this.firestoreService.getDocument(weeklyReportPath);

            if (!reportData) {
                const errorResponse = ResponseHelper.notFound(`${year}年第${weekNumber}週のレポートが見つかりません`);
                res.status(errorResponse.status).json(errorResponse);
                return;
            }

            const response = ResponseHelper.success('週次レポートを取得しました', reportData);
            res.status(response.status).json(response);
        } catch (error) {
            const appError = await ErrorHandler.handle(error, 'ReportController.getWeeklyReport');
            const errorResponse = ResponseHelper.fromAppError(appError);
            res.status(errorResponse.status).json(errorResponse);
        }
    }

    /**
     * レポート一覧取得
     */
    public getReports = async (req: Request, res: Response): Promise<void> => {
        try {
            const { type = 'daily', limit = 10, offset = 0 } = req.query;

            // クエリパラメータのバリデーション
            const validatedLimit = this.validateLimit(limit as string);
            const validatedOffset = this.validateOffset(offset as string);
            const reportType = this.validateReportType(type as string);

            // レポートタイプに基づいてコレクションパスを決定
            let collectionPath: string;
            switch (reportType) {
                case 'daily':
                    collectionPath = 'reports/daily';
                    break;
                case 'weekly':
                    collectionPath = 'reports/weekly';
                    break;
                case 'monthly':
                    collectionPath = 'reports/monthly';
                    break;
                default:
                    throw new AppError('無効なレポートタイプです', ErrorType.VALIDATION);
            }

            // レポート一覧を取得（queryメソッドを直接使用）
            const reports = await this.firestoreService.query(
                collectionPath,
                (collection) => collection
                    .orderBy('createdAt', 'desc') // 作成日時の降順でソート
                    .offset(validatedOffset)
                    .limit(validatedLimit)
            );

            const response = ResponseHelper.success(
                `${reportType}レポート一覧を取得しました`,
                {
                    reports,
                    pagination: {
                        limit: validatedLimit,
                        offset: validatedOffset,
                        total: reports.length
                    }
                }
            );
            res.status(response.status).json(response);
        } catch (error) {
            const appError = await ErrorHandler.handle(error, 'ReportController.getReports');
            const errorResponse = ResponseHelper.fromAppError(appError);
            res.status(errorResponse.status).json(errorResponse);
        }
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

    /**
     * 年のバリデーション
     */
    private validateYear(year: string): number {
        const yearNum = parseInt(year, 10);

        if (isNaN(yearNum)) {
            throw new AppError('年は数値で指定してください', ErrorType.VALIDATION);
        }

        if (yearNum < 2000 || yearNum > 2100) {
            throw new AppError('年は2000年から2100年の間で指定してください', ErrorType.VALIDATION);
        }

        return yearNum;
    }

    /**
     * 週番号のバリデーション
     */
    private validateWeekNumber(weekNumber: string): number {
        const weekNum = parseInt(weekNumber, 10);

        if (isNaN(weekNum)) {
            throw new AppError('週番号は数値で指定してください', ErrorType.VALIDATION);
        }

        if (weekNum < 1 || weekNum > 53) {
            throw new AppError('週番号は1から53の間で指定してください', ErrorType.VALIDATION);
        }

        return weekNum;
    }

    /**
     * limitパラメータのバリデーション
     */
    private validateLimit(limit: string): number {
        const parsedLimit = parseInt(limit, 10);
        if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
            throw new AppError('limitは1から100の間で指定してください', ErrorType.VALIDATION);
        }
        return parsedLimit;
    }

    /**
     * offsetパラメータのバリデーション
     */
    private validateOffset(offset: string): number {
        const parsedOffset = parseInt(offset, 10);
        if (isNaN(parsedOffset) || parsedOffset < 0) {
            throw new AppError('offsetは0以上で指定してください', ErrorType.VALIDATION);
        }
        return parsedOffset;
    }

    /**
     * レポートタイプのバリデーション
     */
    private validateReportType(type: string): string {
        const validTypes = ['daily', 'weekly', 'monthly'];
        if (!validTypes.includes(type)) {
            throw new AppError('typeはdaily、weekly、monthlyのいずれかを指定してください', ErrorType.VALIDATION);
        }
        return type;
    }
}
