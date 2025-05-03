import { Request, Response } from 'express';
import { FirestoreService } from '../../../../shared/firebase/FirestoreService';
import { ResponseHelper } from '../../../../shared/utils/ResponseHelper';

/**
 * レポートデータを操作するためのコントローラークラス
 */
export class ReportController {
    private firestoreService: FirestoreService;

    /**
     * コンストラクタ
     * 必要なサービスのインスタンスを取得・初期化
     */
    constructor() {
        this.firestoreService = FirestoreService.getInstance();
        this.firestoreService.setCloudFunctions(true);
        this.firestoreService.initialize();
    }

    /**
     * デイリーレポートを取得する
     */
    async getDailyReports(req: Request, res: Response): Promise<void> {
        try {
            const { year, month, term, day } = req.query as Record<string, string>;

            // バリデーション
            if (!year || !month) {
                const response = ResponseHelper.validationError('年と月のパラメータが必要です');
                res.status(response.status).json(response);
                return;
            }

            const paddedMonth = month.padStart(2, '0');
            const reports = [];
            const db = await this.firestoreService.getDb();

            try {
                // 特定の日のレポートを取得
                if (term && day) {
                    const paddedDay = day.padStart(2, '0');
                    const dailyReportPath = `reports/${year}/${paddedMonth}/${term}/${paddedDay}`;
                    const docSnapshot = await db.doc(dailyReportPath).get();

                    if (docSnapshot.exists) {
                        reports.push({
                            id: docSnapshot.id,
                            path: dailyReportPath,
                            ...docSnapshot.data(),
                        });
                    }
                } else if (term) {
                    // 特定の週のすべての日のレポートを取得
                    const termRef = db.collection(`reports/${year}/${paddedMonth}`).doc(term);
                    const daysSnapshot = await termRef.collection('/').listDocuments();

                    for (const dayDoc of daysSnapshot) {
                        const docSnapshot = await dayDoc.get();
                        if (docSnapshot.exists) {
                            reports.push({
                                id: docSnapshot.id,
                                path: docSnapshot.ref.path,
                                ...docSnapshot.data(),
                            });
                        }
                    }
                } else {
                    // 特定の月のすべての日のレポートを取得
                    const monthRef = db.collection(`reports/${year}/${paddedMonth}`);
                    const termsSnapshot = await monthRef.listDocuments();

                    for (const termDoc of termsSnapshot) {
                        const term = termDoc.id;
                        const daysSnapshot = await termDoc.collection('/').listDocuments();

                        for (const dayDoc of daysSnapshot) {
                            const docSnapshot = await dayDoc.get();
                            if (docSnapshot.exists) {
                                reports.push({
                                    id: dayDoc.id,
                                    path: dayDoc.path,
                                    term,
                                    ...docSnapshot.data(),
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('デイリーレポート取得中にエラーが発生しました:', error);
            }

            const response = ResponseHelper.success('デイリーレポートの取得に成功しました', reports);
            res.status(response.status).json(response);
        } catch (error) {
            console.error('デイリーレポート取得中にエラーが発生しました:', error);
            const errorMessage = error instanceof Error ? error.message : '不明なエラー';
            const response = ResponseHelper.error(500, 'デイリーレポート取得中にエラーが発生しました', { error: errorMessage });
            res.status(response.status).json(response);
        }
    }

    /**
     * ウィークリーレポートを取得する
     */
    async getWeeklyReports(req: Request, res: Response): Promise<void> {
        try {
            const { year, month, term } = req.query as Record<string, string>;

            // バリデーション
            if (!year || !month) {
                const response = ResponseHelper.validationError('年と月のパラメータが必要です');
                res.status(response.status).json(response);
                return;
            }

            const paddedMonth = month.padStart(2, '0');
            const reports = [];
            const db = await this.firestoreService.getDb();

            try {
                let weekReportPath;

                // 特定の週のレポートを取得
                if (term) {
                    weekReportPath = `reports/weekly/${year}-${paddedMonth}/${term}`;
                    const docSnapshot = await db.doc(weekReportPath).get();

                    if (docSnapshot.exists) {
                        reports.push({
                            id: docSnapshot.id,
                            path: weekReportPath,
                            ...docSnapshot.data(),
                        });
                    }
                } else {
                    // 特定の月のすべての週レポートを取得
                    const weeklyReportsPath = `reports/weekly/${year}-${paddedMonth}`;
                    const weeklyCollectionRef = db.collection(weeklyReportsPath);
                    const weeklyDocsSnapshot = await weeklyCollectionRef.get();

                    weeklyDocsSnapshot.forEach((doc) => {
                        reports.push({
                            id: doc.id,
                            path: doc.ref.path,
                            ...doc.data(),
                        });
                    });
                }
            } catch (error) {
                console.error('ウィークリーレポート取得中にエラーが発生しました:', error);
            }

            const response = ResponseHelper.success('ウィークリーレポートの取得に成功しました', reports);
            res.status(response.status).json(response);
        } catch (error) {
            console.error('ウィークリーレポート取得中にエラーが発生しました:', error);
            const errorMessage = error instanceof Error ? error.message : '不明なエラー';
            const response = ResponseHelper.error(500, 'ウィークリーレポート取得中にエラーが発生しました', { error: errorMessage });
            res.status(response.status).json(response);
        }
    }

    /**
     * マンスリーレポートを取得する
     */
    async getMonthlyReports(req: Request, res: Response): Promise<void> {
        try {
            const { year, month } = req.query as Record<string, string>;

            // バリデーション
            if (!year) {
                const response = ResponseHelper.validationError('年のパラメータが必要です');
                res.status(response.status).json(response);
                return;
            }

            const reports = [];
            const db = await this.firestoreService.getDb();

            try {
                let monthlyReportPath;

                // 特定の月のレポートを取得
                if (month) {
                    const paddedMonth = month.padStart(2, '0');
                    monthlyReportPath = `reports/${year}/${paddedMonth}/monthly`;
                    const docSnapshot = await db.doc(monthlyReportPath).get();

                    if (docSnapshot.exists) {
                        reports.push({
                            id: docSnapshot.id,
                            path: monthlyReportPath,
                            ...docSnapshot.data(),
                        });
                    }
                } else {
                    // 特定の年のすべての月のレポートを取得
                    const yearRef = db.collection(`reports/${year}`);
                    const monthsSnapshot = await yearRef.listDocuments();

                    for (const monthDoc of monthsSnapshot) {
                        const monthId = monthDoc.id;
                        const monthlyDocRef = db.doc(`reports/${year}/${monthId}/monthly`);
                        const docSnapshot = await monthlyDocRef.get();

                        if (docSnapshot.exists) {
                            reports.push({
                                id: 'monthly', // 月次レポートのIDは常に "monthly"
                                month: monthId,
                                path: docSnapshot.ref.path,
                                ...docSnapshot.data(),
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('マンスリーレポート取得中にエラーが発生しました:', error);
            }

            const response = ResponseHelper.success('マンスリーレポートの取得に成功しました', reports);
            res.status(response.status).json(response);
        } catch (error) {
            console.error('マンスリーレポート取得中にエラーが発生しました:', error);
            const errorMessage = error instanceof Error ? error.message : '不明なエラー';
            const response = ResponseHelper.error(500, 'マンスリーレポート取得中にエラーが発生しました', { error: errorMessage });
            res.status(response.status).json(response);
        }
    }
}
