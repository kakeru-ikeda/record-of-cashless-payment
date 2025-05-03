/* eslint-disable camelcase */
import { Request, Response } from 'express';
import { FirestoreService } from '../../../../shared/firebase/FirestoreService';
import { CardUsage } from '../../../../src/domain/entities/CardUsage';
import { DateUtil } from '../../../../shared/utils/DateUtil';
import { ResponseHelper } from '../../../../shared/utils/ResponseHelper';
import { Timestamp } from 'firebase-admin/firestore';
import { DailyReportService } from '../../services/reports/DailyReportService';
import { WeeklyReportService } from '../../services/reports/WeeklyReportService';
import { MonthlyReportService } from '../../services/reports/MonthlyReportService';
import { DiscordWebhookNotifier } from '../../../../shared/discord/DiscordNotifier';

/**
 * カード利用データを操作するためのコントローラークラス
 */
export class CardUsageController {
    private firestoreService: FirestoreService;
    private dailyReportService: DailyReportService;
    private weeklyReportService: WeeklyReportService;
    private monthlyReportService: MonthlyReportService;
    private discordNotifier: DiscordWebhookNotifier;

    /**
     * コンストラクタ
     * FirestoreServiceのインスタンスを取得し、Cloud Functionsモードを設定
     */
    constructor() {
        this.firestoreService = FirestoreService.getInstance();
        this.firestoreService.setCloudFunctions(true);
        this.firestoreService.initialize();

        let DISCORD_ALERT_WEEKLY_WEBHOOK_URL = '';
        let DISCORD_ALERT_MONTHLY_WEBHOOK_URL = '';

        try {
            // 環境変数からWebhook URLを取得
            DISCORD_ALERT_WEEKLY_WEBHOOK_URL = process.env.DISCORD_ALERT_WEEKLY_WEBHOOK_URL || '';
            DISCORD_ALERT_MONTHLY_WEBHOOK_URL = process.env.DISCORD_ALERT_MONTHLY_WEBHOOK_URL || '';

            if (DISCORD_ALERT_WEEKLY_WEBHOOK_URL) {
                console.log('✅ 環境変数から週次アラート通知用のDISCORD_ALERT_WEEKLY_WEBHOOK_URLを取得しました');
            }

            if (DISCORD_ALERT_MONTHLY_WEBHOOK_URL) {
                console.log('✅ 環境変数から月次アラート通知用のDISCORD_ALERT_MONTHLY_WEBHOOK_URLを取得しました');
            }
        } catch (error) {
            console.error('環境変数の取得中にエラーが発生しました:', error);
        }

        this.discordNotifier = new DiscordWebhookNotifier(
            '', // 利用明細通知用（Cloud Functionsでは使用しない）
            DISCORD_ALERT_WEEKLY_WEBHOOK_URL, // 週次アラート通知用
            DISCORD_ALERT_MONTHLY_WEBHOOK_URL, // 月次アラート通知用
        );

        // レポートサービスの初期化
        this.dailyReportService = new DailyReportService(this.firestoreService, this.discordNotifier);
        this.weeklyReportService = new WeeklyReportService(this.firestoreService, this.discordNotifier);
        this.monthlyReportService = new MonthlyReportService(this.firestoreService, this.discordNotifier);
    }

    /**
     * パスからレポート更新のために必要なパラメータを抽出するヘルパーメソッド
     * @param path ドキュメントパス（例: details/2025/05/term1/03/1714713600000）
     */
    private extractPathParams(path: string): { year: string; month: string; term: string; day: string } | null {
        try {
            // パスの形式: details/{year}/{month}/{term}/{day}/{id}
            const parts = path.split('/');
            if (parts.length < 6) return null;

            const year = parts[1];
            const month = parts[2];
            const term = parts[3];
            const day = parts[4];

            return { year, month, term, day };
        } catch (error) {
            console.error('パスの解析に失敗しました:', error);
            return null;
        }
    }

    /**
     * カード利用情報の更新時にレポートを更新するメソッド
     * @param path ドキュメントパス
     * @param oldData 古いデータ
     * @param newData 新しいデータ
     */
    private async updateReportsForCardUpdate(
        path: string,
        oldData: CardUsage,
        newData: Partial<CardUsage>
    ): Promise<void> {
        const params = this.extractPathParams(path);
        if (!params) return;

        // 金額が更新された場合にのみレポートを更新する
        if (newData.amount !== undefined && newData.amount !== oldData.amount) {
            try {
                // 古い金額を差し引き、新しい金額を加算するための差分を計算
                const amountDiff = newData.amount - oldData.amount;

                // 各レポートサービスの更新メソッドを呼び出す
                const docRef = await this.firestoreService.getDocumentRef(path);
                await this.dailyReportService.updateReportForAmountChange(docRef, params, amountDiff);
                await this.weeklyReportService.updateReportForAmountChange(docRef, params, amountDiff);
                await this.monthlyReportService.updateReportForAmountChange(docRef, params, amountDiff);

                console.log(`✅ 金額の変更 (${oldData.amount} -> ${newData.amount}) により、レポートが更新されました`);
            } catch (error) {
                console.error('レポート更新中にエラーが発生しました:', error);
            }
        }
    }

    /**
     * カード利用情報の削除時にレポートを更新するメソッド
     * @param path ドキュメントパス
     * @param data 削除されるデータ
     */
    private async updateReportsForCardDeletion(path: string, data: CardUsage): Promise<void> {
        const params = this.extractPathParams(path);
        if (!params) return;

        try {
            // 削除されるデータの金額を差し引く（マイナスの金額を渡す）
            const amountDiff = -data.amount;
            const countDiff = -1; // カウントも1減らす

            // 各レポートサービスの更新メソッドを呼び出す
            const docRef = await this.firestoreService.getDocumentRef(path);
            await this.dailyReportService.updateReportForDeletion(docRef, params, amountDiff, countDiff);
            await this.weeklyReportService.updateReportForDeletion(docRef, params, amountDiff, countDiff);
            await this.monthlyReportService.updateReportForDeletion(docRef, params, amountDiff, countDiff);

            console.log(`✅ 論理削除により、レポートが更新されました（金額: ${data.amount}）`);
        } catch (error) {
            console.error('レポート更新中にエラーが発生しました:', error);
        }
    }

    /**
     * カード利用情報を全て取得する
     */
    async getAllCardUsages(req: Request, res: Response): Promise<void> {
        try {
            const year = req.query.year as string;
            const month = req.query.month as string;

            if (!year || !month) {
                const response = ResponseHelper.validationError('年と月のパラメータが必要です');
                res.status(response.status).json(response);
                return;
            }

            // 指定された年月のデータを取得するロジックを実装
            const usages: (CardUsage & { id: string, path: string })[] = [];
            const paddedMonth = month.padStart(2, '0');

            // Firestoreインスタンスを取得
            const db = await this.firestoreService.getDb();

            try {
                // yearとmonthからTerms（週）のコレクションを取得
                const yearDocRef = db.collection('details').doc(year);
                const termCollections = await yearDocRef.collection(paddedMonth).listDocuments();

                // 各ターム（週）のデータを処理
                for (const termDoc of termCollections) {
                    const term = termDoc.id;
                    // 各日付のコレクションを取得
                    const dayCollections = await termDoc.listCollections();

                    // 各日付のデータを処理
                    for (const dayCollection of dayCollections) {
                        const day = dayCollection.id;
                        // 各タイムスタンプのドキュメントを取得
                        const timestampDocs = await dayCollection.listDocuments();

                        // 各タイムスタンプのデータを処理
                        for (const timestampDoc of timestampDocs) {
                            const docSnapshot = await timestampDoc.get();
                            if (docSnapshot.exists) {
                                const data = docSnapshot.data() as CardUsage;
                                if (data) {
                                    usages.push({
                                        ...data,
                                        id: timestampDoc.id,
                                        path: `details/${year}/${paddedMonth}/${term}/${day}/${timestampDoc.id}`,
                                    });
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('データ取得中にエラーが発生しました:', error);
            }

            const response = ResponseHelper.success('カード利用情報の取得に成功しました', usages);
            res.status(response.status).json(response);
        } catch (error) {
            console.error('カード利用情報の取得中にエラーが発生しました:', error);
            const errorMessage = error instanceof Error ? error.message : '不明なエラー';
            const response = ResponseHelper.error(500, 'カード利用情報の取得中にエラーが発生しました', { error: errorMessage });
            res.status(response.status).json(response);
        }
    }

    /**
     * IDによるカード利用情報の取得
     */
    async getCardUsageById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            if (!id) {
                const response = ResponseHelper.validationError('IDが必要です');
                res.status(response.status).json(response);
                return;
            }

            // データを検索するために年月のリストを取得
            const db = await this.firestoreService.getDb();

            try {
                // まずは現在年月のデータから検索
                const today = new Date();

                // 直近3ヶ月分のデータを検索対象にする
                const months = [];
                for (let i = 0; i < 3; i++) {
                    const searchDate = new Date(today);
                    searchDate.setMonth(today.getMonth() - i);
                    const year = searchDate.getFullYear().toString();
                    const month = (searchDate.getMonth() + 1).toString().padStart(2, '0');
                    months.push({ year, month });
                }

                // 各年月のデータから検索
                for (const { year, month } of months) {
                    const yearDocRef = db.collection('details').doc(year);
                    const termCollections = await yearDocRef.collection(month).listDocuments();

                    // 各ターム（週）のデータを検索
                    for (const termDoc of termCollections) {
                        const term = termDoc.id;
                        const dayCollections = await termDoc.listCollections();

                        // 各日付のデータを検索
                        for (const dayCollection of dayCollections) {
                            const day = dayCollection.id;

                            // 指定されたIDのドキュメントを検索
                            const docRef = dayCollection.doc(id);
                            const docSnapshot = await docRef.get();

                            if (docSnapshot.exists) {
                                const data = docSnapshot.data() as CardUsage;
                                const responseData = {
                                    ...data,
                                    id,
                                    path: `details/${year}/${month}/${term}/${day}/${id}`,
                                };
                                const response = ResponseHelper.success('カード利用情報の取得に成功しました', responseData);
                                res.status(response.status).json(response);
                                return;
                            }
                        }
                    }
                }

                // 見つからなかった場合
                const response = ResponseHelper.notFound('指定されたIDのカード利用情報が見つかりません');
                res.status(response.status).json(response);
            } catch (error) {
                console.error('データ検索中にエラーが発生しました:', error);
                throw error;
            }
        } catch (error) {
            console.error('カード利用情報の取得中にエラーが発生しました:', error);
            const errorMessage = error instanceof Error ? error.message : '不明なエラー';
            const response = ResponseHelper.error(500, 'カード利用情報の取得中にエラーが発生しました', { error: errorMessage });
            res.status(response.status).json(response);
        }
    }

    /**
     * カード利用情報の新規作成
     */
    async createCardUsage(req: Request, res: Response): Promise<void> {
        try {
            const cardUsageData = req.body;

            if (!cardUsageData || !cardUsageData.datetime_of_use || !cardUsageData.amount || !cardUsageData.card_name) {
                const response = ResponseHelper.validationError('必須フィールドが不足しています');
                res.status(response.status).json(response);
                return;
            }

            // 日付文字列をタイムスタンプに変換
            let datetime_of_use: Timestamp;
            try {
                if (typeof cardUsageData.datetime_of_use === 'string') {
                    // ISO文字列からDateオブジェクトに変換し、Timestampに変換
                    const dateObj = new Date(cardUsageData.datetime_of_use);
                    datetime_of_use = Timestamp.fromDate(dateObj);
                } else if (cardUsageData.datetime_of_use &&
                    (cardUsageData.datetime_of_use._seconds !== undefined ||
                        cardUsageData.datetime_of_use.seconds !== undefined)) {
                    // フロントエンドから送られてきたTimestamp形式のオブジェクト
                    datetime_of_use = new Timestamp(
                        cardUsageData.datetime_of_use._seconds || cardUsageData.datetime_of_use.seconds,
                        cardUsageData.datetime_of_use._nanoseconds || cardUsageData.datetime_of_use.nanoseconds
                    );
                } else {
                    throw new Error('日付形式が無効です');
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : '不明なエラー';
                const response = ResponseHelper.validationError('日付形式が無効です', { error: errorMessage });
                res.status(response.status).json(response);
                return;
            }

            // 作成日時として現在のタイムスタンプを設定
            const created_at = Timestamp.now();

            // 保存用のCardUsageオブジェクトを作成
            const cardUsage: CardUsage = {
                card_name: cardUsageData.card_name,
                datetime_of_use: datetime_of_use,
                amount: Number(cardUsageData.amount),
                where_to_use: cardUsageData.where_to_use || '',
                memo: cardUsageData.memo || '',
                is_active: cardUsageData.is_active !== undefined ? cardUsageData.is_active : true,
                created_at: created_at,
            };

            // パス情報を生成
            const pathInfo = DateUtil.getFirestorePath(datetime_of_use.toDate());

            // Firestoreにデータ保存
            await this.firestoreService.saveDocument(pathInfo.path, cardUsage);

            // 作成日時のタイムスタンプをIDとして使用（getByIdメソッドとの一貫性を確保）
            const id = created_at.toDate().getTime().toString();

            const responseData = {
                ...cardUsage,
                id: id,
                path: pathInfo.path,
            };

            const response = ResponseHelper.createResponse(201, true, 'カード利用情報の作成に成功しました', responseData);
            res.status(response.status).json(response);
        } catch (error) {
            console.error('カード利用情報の作成中にエラーが発生しました:', error);
            const errorMessage = error instanceof Error ? error.message : '不明なエラー';
            const response = ResponseHelper.error(500, 'カード利用情報の作成中にエラーが発生しました', { error: errorMessage });
            res.status(response.status).json(response);
        }
    }

    /**
     * カード利用情報の更新
     */
    async updateCardUsage(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const updateData = req.body;

            if (!id) {
                const response = ResponseHelper.validationError('IDが必要です');
                res.status(response.status).json(response);
                return;
            }

            // データを検索するためにDBインスタンスを取得
            const db = await this.firestoreService.getDb();
            let docPath = '';
            let existingData: CardUsage | null = null;

            try {
                // 直近3ヶ月分のデータを検索対象にする
                const today = new Date();
                const months = [];
                for (let i = 0; i < 3; i++) {
                    const searchDate = new Date(today);
                    searchDate.setMonth(today.getMonth() - i);
                    const year = searchDate.getFullYear().toString();
                    const month = (searchDate.getMonth() + 1).toString().padStart(2, '0');
                    months.push({ year, month });
                }

                // 各年月のデータから検索
                for (const { year, month } of months) {
                    const yearDocRef = db.collection('details').doc(year);
                    const termCollections = await yearDocRef.collection(month).listDocuments();

                    // 各ターム（週）のデータを検索
                    for (const termDoc of termCollections) {
                        const term = termDoc.id;
                        const dayCollections = await termDoc.listCollections();

                        // 各日付のデータを検索
                        for (const dayCollection of dayCollections) {
                            const day = dayCollection.id;

                            // 指定されたIDのドキュメントを検索
                            const docRef = dayCollection.doc(id);
                            const docSnapshot = await docRef.get();

                            if (docSnapshot.exists) {
                                existingData = docSnapshot.data() as CardUsage;
                                docPath = `details/${year}/${month}/${term}/${day}/${id}`;
                                break;
                            }
                        }
                        if (docPath) break;
                    }
                    if (docPath) break;
                }
            } catch (error) {
                console.error('データ検索中にエラーが発生しました:', error);
                throw error;
            }

            // データが見つからない場合
            if (!existingData || !docPath) {
                const response = ResponseHelper.notFound('指定されたIDのカード利用情報が見つかりません');
                res.status(response.status).json(response);
                return;
            }

            // 更新用のデータを構築
            const updatedData: Partial<CardUsage> = {};

            if (updateData.card_name !== undefined) {
                updatedData.card_name = updateData.card_name;
            }

            if (updateData.amount !== undefined) {
                updatedData.amount = Number(updateData.amount);
            }

            if (updateData.where_to_use !== undefined) {
                updatedData.where_to_use = updateData.where_to_use;
            }

            if (updateData.memo !== undefined) {
                updatedData.memo = updateData.memo;
            }

            if (updateData.is_active !== undefined) {
                updatedData.is_active = updateData.is_active;
            }

            // 更新
            await this.firestoreService.updateDocument(docPath, updatedData);

            // ----------------------------------------
            // レポートの更新処理
            // ----------------------------------------

            // 1. 金額変更の場合はレポート金額を更新
            if (updateData.amount !== undefined && updateData.amount !== existingData.amount) {
                // is_activeがtrueの場合のみレポート金額を更新（非アクティブデータは集計対象外）
                if (existingData.is_active !== false &&
                    (updateData.is_active === undefined || updateData.is_active === true)) {
                    await this.updateReportsForCardUpdate(docPath, existingData, updatedData);
                }
            }

            // 2. is_activeの状態変化に応じたレポート更新
            if (updateData.is_active !== undefined && updateData.is_active !== existingData.is_active) {
                const params = this.extractPathParams(docPath);
                if (params) {
                    const docRef = await this.firestoreService.getDocumentRef(docPath);

                    // is_activeがfalse→true（非表示→表示）に変更された場合：レポートに加算
                    if (updateData.is_active === true && existingData.is_active === false) {
                        console.log(`🔄 表示状態変更: カード利用情報が再アクティブ化されました (${docPath})`);

                        // 金額とカウントを加算（プラスの値を渡す）
                        const amountDiff = existingData.amount;
                        const countDiff = 1;

                        // 各レポートサービスの更新メソッド呼び出し
                        await this.dailyReportService.updateReportForAddition(docRef, params, amountDiff, countDiff);
                        await this.weeklyReportService.updateReportForAddition(docRef, params, amountDiff, countDiff);
                        await this.monthlyReportService.updateReportForAddition(docRef, params, amountDiff, countDiff);
                    } else if (updateData.is_active === false && existingData.is_active !== false) {
                        // is_activeがtrue→false（表示→非表示）に変更された場合：レポートから減算
                        console.log(`🗑️ 論理削除処理: カード利用情報が非アクティブに設定されました (${docPath})`);
                        await this.updateReportsForCardDeletion(docPath, existingData);
                    }
                }
            }

            // 更新後のデータを取得
            const updatedCardUsage = await this.firestoreService.getDocument<CardUsage>(docPath);

            const responseData = {
                ...(updatedCardUsage || {}),
                id,
                path: docPath,
            };

            const response = ResponseHelper.success('カード利用情報の更新に成功しました', responseData);
            res.status(response.status).json(response);
        } catch (error) {
            console.error('カード利用情報の更新中にエラーが発生しました:', error);
            const errorMessage = error instanceof Error ? error.message : '不明なエラー';
            const response = ResponseHelper.error(500, 'カード利用情報の更新中にエラーが発生しました', { error: errorMessage });
            res.status(response.status).json(response);
        }
    }

    /**
     * カード利用情報の削除（論理削除 - is_activeをfalseに設定）
     */
    async deleteCardUsage(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            if (!id) {
                const response = ResponseHelper.validationError('IDが必要です');
                res.status(response.status).json(response);
                return;
            }

            // データを検索するためにDBインスタンスを取得
            const db = await this.firestoreService.getDb();
            let docPath = '';
            let existingData: CardUsage | null = null;

            try {
                // 直近3ヶ月分のデータを検索対象にする
                const today = new Date();
                const months = [];
                for (let i = 0; i < 3; i++) {
                    const searchDate = new Date(today);
                    searchDate.setMonth(today.getMonth() - i);
                    const year = searchDate.getFullYear().toString();
                    const month = (searchDate.getMonth() + 1).toString().padStart(2, '0');
                    months.push({ year, month });
                }

                // 各年月のデータから検索
                for (const { year, month } of months) {
                    const yearDocRef = db.collection('details').doc(year);
                    const termCollections = await yearDocRef.collection(month).listDocuments();

                    // 各ターム（週）のデータを検索
                    for (const termDoc of termCollections) {
                        const term = termDoc.id;
                        const dayCollections = await termDoc.listCollections();

                        // 各日付のデータを検索
                        for (const dayCollection of dayCollections) {
                            const day = dayCollection.id;

                            // 指定されたIDのドキュメントを検索
                            const docRef = dayCollection.doc(id);
                            const docSnapshot = await docRef.get();

                            if (docSnapshot.exists) {
                                existingData = docSnapshot.data() as CardUsage;
                                docPath = `details/${year}/${month}/${term}/${day}/${id}`;
                                break;
                            }
                        }
                        if (docPath) break;
                    }
                    if (docPath) break;
                }
            } catch (error) {
                console.error('データ検索中にエラーが発生しました:', error);
                throw error;
            }

            // データが見つからない場合
            if (!existingData || !docPath) {
                const response = ResponseHelper.notFound('指定されたIDのカード利用情報が見つかりません');
                res.status(response.status).json(response);
                return;
            }

            // 論理削除（is_activeをfalseに設定）
            await this.firestoreService.updateDocument(docPath, { is_active: false });

            // レポートを更新
            await this.updateReportsForCardDeletion(docPath, existingData);

            const responseData = { id, path: docPath };
            const response = ResponseHelper.success('カード利用情報の削除に成功しました', responseData);
            res.status(response.status).json(response);
        } catch (error) {
            console.error('カード利用情報の削除中にエラーが発生しました:', error);
            const errorMessage = error instanceof Error ? error.message : '不明なエラー';
            const response = ResponseHelper.error(500, 'カード利用情報の削除中にエラーが発生しました', { error: errorMessage });
            res.status(response.status).json(response);
        }
    }
}
