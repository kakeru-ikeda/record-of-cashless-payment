import { Firestore } from 'firebase-admin/firestore';
import { CardUsage } from '@shared/domain/entities/CardUsage';
import {
  ICardUsageCrudRepository,
} from '@domain/interfaces/infrastructure/database/repositories/ICardUsageCrudRepository';
import { Environment } from '@shared/infrastructure/config/Environment';
import { FirestoreService } from '@shared/infrastructure/database/FirestoreService';
import { FirestorePathUtil } from '@shared/utils/FirestorePathUtil';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';
import { logger } from '@shared/infrastructure/logging/Logger';

/**
 * Firestoreを使用したカード利用情報リポジトリの実装
 */
export class FirestoreCardUsageRepository implements ICardUsageCrudRepository {
  private firestoreService: FirestoreService;
  private readonly serviceContext = 'FirestoreCardUsageRepository';

  constructor() {
    this.firestoreService = FirestoreService.getInstance();
  }

  /**
   * Firestoreへの接続を初期化する
   */
  @ErrorHandler.errorDecorator('FirestoreCardUsageRepository', {
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
   * カード利用情報を保存する
   * @param cardUsage カード利用情報
   * @returns 保存されたパス
   */
  @ErrorHandler.errorDecorator('FirestoreCardUsageRepository', {
    defaultMessage: 'カード利用情報の保存に失敗しました',
  })
  async save(cardUsage: CardUsage): Promise<string> {
    // Firestoreへの接続を初期化
    await this.initialize();

    // 日付オブジェクトを作成
    const dateObj = cardUsage.datetime_of_use.toDate();

    // パス情報を取得
    const pathInfo = FirestorePathUtil.getFirestorePath(dateObj);
    logger.info(`保存先: ${pathInfo.path}`, this.serviceContext);

    // 新しいフィールドのデフォルト値を設定
    const completeCardUsage: CardUsage = {
      ...cardUsage,
      memo: cardUsage.memo || '', // デフォルト値は空文字
      is_active: cardUsage.is_active !== undefined ? cardUsage.is_active : true, // デフォルト値はtrue
    };

    // 共通サービスを使用してドキュメントを保存
    await this.firestoreService.saveDocument(pathInfo.path, completeCardUsage);

    logger.info('カード利用データをFirestoreに保存しました', this.serviceContext);
    return pathInfo.path;
  }

  /**
   * カード利用情報をタイムスタンプから取得する
   * @param timestamp タイムスタンプ
   * @returns カード利用情報
   */
  @ErrorHandler.errorDecorator('FirestoreCardUsageRepository', {
    defaultMessage: 'カード利用情報の取得に失敗しました',
  })
  async getByTimestamp(timestamp: string): Promise<CardUsage | null> {
    // Firestoreへの接続を初期化
    await this.initialize();

    // タイムスタンプから日付を取得
    const date = new Date(parseInt(timestamp));

    // パス情報を生成
    const pathInfo = FirestorePathUtil.getFirestorePath(date);

    // 共通サービスを使用してドキュメントを取得
    const result = await this.firestoreService.getDocument<CardUsage>(pathInfo.path);

    if (!result) {
      logger.info(`カード利用情報が見つかりません: ${timestamp}`, this.serviceContext);
    }

    return result;
  }

  /**
   * IDによるカード利用情報の取得
   * @param id カード利用情報のID
   * @returns カード利用情報（IDとパス情報を含む）
   */
  @ErrorHandler.errorDecorator('FirestoreCardUsageRepository', {
    defaultMessage: 'カード利用情報の取得に失敗しました',
  })
  async getById(id: string): Promise<(CardUsage & { id: string, path: string }) | null> {
    await this.initialize();
    const db = await this.firestoreService.getDb();

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
            const data = docSnapshot.data() as CardUsage;
            return {
              ...data,
              id,
              path: `details/${year}/${month}/${term}/${day}/${id}`,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * 指定された年月のカード利用情報を全て取得する
   * @param year 年
   * @param month 月
   * @returns カード利用情報の配列（IDとパス情報を含む）
   */
  @ErrorHandler.errorDecorator('FirestoreCardUsageRepository', {
    defaultMessage: 'カード利用情報の取得に失敗しました',
  })
  async getByYearMonth(year: string, month: string): Promise<(CardUsage & { id: string, path: string })[]> {
    await this.initialize();
    const db = await this.firestoreService.getDb();
    const usages: (CardUsage & { id: string, path: string })[] = [];
    const paddedMonth = month.padStart(2, '0');

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

    return usages;
  }

  /**
   * カード利用情報を更新する
   * @param id カード利用情報のID
   * @param updateData 更新データ
   * @returns 更新後のカード利用情報（IDとパス情報を含む）
   */
  @ErrorHandler.errorDecorator('FirestoreCardUsageRepository', {
    defaultMessage: 'カード利用情報の更新に失敗しました',
  })
  async update(id: string, updateData: Partial<CardUsage>): Promise<(CardUsage & { id: string, path: string }) | null> {
    await this.initialize();

    // まず対象のドキュメントを検索
    const existingData = await this.getById(id);
    if (!existingData) {
      return null;
    }

    // 更新を実行
    await this.firestoreService.updateDocument(existingData.path, updateData);

    // 更新後のデータを取得
    const updatedData = await this.firestoreService.getDocument<CardUsage>(existingData.path);
    if (!updatedData) {
      return null;
    }

    return {
      ...updatedData,
      id,
      path: existingData.path,
    };
  }

  /**
   * カード利用情報を論理削除する（is_activeをfalseに設定）
   * @param id カード利用情報のID
   * @returns 削除されたカード利用情報のIDとパス
   */
  @ErrorHandler.errorDecorator('FirestoreCardUsageRepository', {
    defaultMessage: 'カード利用情報の削除に失敗しました',
  })
  async delete(id: string): Promise<{ id: string, path: string } | null> {
    await this.initialize();

    // まず対象のドキュメントを検索
    const existingData = await this.getById(id);
    if (!existingData) {
      return null;
    }

    // 論理削除（is_activeをfalseに設定）
    await this.firestoreService.updateDocument(existingData.path, { is_active: false });

    return { id, path: existingData.path };
  }
}
