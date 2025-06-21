import { Request, Response } from 'express';
import { FirestoreService } from '@shared/infrastructure/database/FirestoreService';
import { CardUsage } from '@shared/domain/entities/CardUsage';
import { ResponseHelper } from '@shared/presentation/responses/ResponseHelper';
import { Timestamp } from 'firebase-admin/firestore';
import { DiscordNotifier } from '@shared/infrastructure/discord/DiscordNotifier';
import { AppError, ErrorType } from '@shared/errors/AppError';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';
import { CardUsageMapper } from '@shared/infrastructure/mappers/CardUsageMapper';
import { FirestoreCardUsageRepository } from '@infrastructure/firebase/FirestoreCardUsageRepository';

/**
 * カード利用データを操作するためのコントローラークラス
 */
export class CardUsageController {
    private firestoreService: FirestoreService;
    private discordNotifier: DiscordNotifier;

    /**
     * コンストラクタ
     * @param discordNotifier Discord通知サービス（依存性注入）
     */
    constructor(discordNotifier: DiscordNotifier) {
        this.firestoreService = FirestoreService.getInstance();
        this.firestoreService.setCloudFunctions(false); // メインシステムではfalse
        this.firestoreService.initialize();

        this.discordNotifier = discordNotifier;
    }

    /**
     * カード利用情報を全て取得する
     */
    public getCardUsagesByDate = async (req: Request, res: Response): Promise<void> => {
        try {
            const year = req.query.year as string;
            const month = req.query.month as string;

            if (!year || !month) {
                throw new AppError('年と月のパラメータが必要です', ErrorType.VALIDATION);
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
                throw new AppError('データ取得中にエラーが発生しました', ErrorType.DATA_ACCESS, error);
            }

            const response = ResponseHelper.success('カード利用情報の取得に成功しました', usages);
            res.status(response.status).json(response);
        } catch (error) {
            const response = await ErrorHandler.handle(error, 'CardUsageController.getAllCardUsages');
            res.status(500).json(ResponseHelper.fromAppError(response));
        }
    };

    /**
     * IDによるカード利用情報の取得
     */
    public getCardUsageById = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            if (!id) {
                throw new AppError('IDが必要です', ErrorType.VALIDATION);
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
                throw new AppError('指定されたIDのカード利用情報が見つかりません', ErrorType.NOT_FOUND);
            } catch (error) {
                if (error instanceof AppError) throw error;
                throw new AppError('データ検索中にエラーが発生しました', ErrorType.DATA_ACCESS, error);
            }
        } catch (error) {
            const response = await ErrorHandler.handle(error, 'CardUsageController.getCardUsageById');
            res.status(500).json(ResponseHelper.fromAppError(response));
        }
    };

    /**
     * カード利用情報の新規作成
     */
    public createCardUsage = async (req: Request, res: Response): Promise<void> => {
        try {
            const cardUsageData = req.body;

            if (!cardUsageData || !cardUsageData.datetime_of_use || !cardUsageData.amount || !cardUsageData.card_name) {
                throw new AppError('必須フィールドが不足しています', ErrorType.VALIDATION);
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
                    throw new AppError('日付形式が無効です', ErrorType.VALIDATION);
                }
            } catch (error) {
                if (error instanceof AppError) throw error;
                throw new AppError('日付形式が無効です', ErrorType.VALIDATION, error);
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
            const pathInfo = FirestoreCardUsageRepository.getFirestorePath(datetime_of_use.toDate());

            // Firestoreにデータ保存
            await this.firestoreService.saveDocument(pathInfo.path, cardUsage);

            // 作成日時のタイムスタンプをIDとして使用（getByIdメソッドとの一貫性を確保）
            const id = created_at.toDate().getTime().toString();

            const responseData = {
                ...cardUsage,
                id: id,
                path: pathInfo.path,
            };

            // Discord通知
            await this.discordNotifier.notifyCardUsage(CardUsageMapper.toNotification(cardUsage));
            console.log('✅ カード利用情報が正常に作成されました:', responseData);

            const response = ResponseHelper.createResponse(201, true, 'カード利用情報の作成に成功しました', responseData);
            res.status(response.status).json(response);
        } catch (error) {
            const response = await ErrorHandler.handle(error, 'CardUsageController.createCardUsage');
            res.status(500).json(ResponseHelper.fromAppError(response));
        }
    };

    /**
     * カード利用情報の更新
     */
    public updateCardUsage = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            if (!id) {
                throw new AppError('IDが必要です', ErrorType.VALIDATION);
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
                throw new AppError('指定されたIDのカード利用情報が見つかりません', ErrorType.NOT_FOUND);
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
            const response = await ErrorHandler.handle(error, 'CardUsageController.updateCardUsage');
            res.status(500).json(ResponseHelper.fromAppError(response));
        }
    };

    /**
     * カード利用情報の削除（論理削除 - is_activeをfalseに設定）
     */
    public deleteCardUsage = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            if (!id) {
                throw new AppError('IDが必要です', ErrorType.VALIDATION);
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
                throw new AppError('指定されたIDのカード利用情報が見つかりません', ErrorType.NOT_FOUND);
            }

            // 論理削除（is_activeをfalseに設定）
            await this.firestoreService.updateDocument(docPath, { is_active: false });

            const responseData = { id, path: docPath };
            const response = ResponseHelper.success('カード利用情報の削除に成功しました', responseData);
            res.status(response.status).json(response);
        } catch (error) {
            const response = await ErrorHandler.handle(error, 'CardUsageController.deleteCardUsage');
            res.status(500).json(ResponseHelper.fromAppError(response));
        }
    };
}
