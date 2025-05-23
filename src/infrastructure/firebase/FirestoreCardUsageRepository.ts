import { Firestore } from 'firebase-admin/firestore';
import { CardUsage } from '../../domain/entities/CardUsage';
import { ICardUsageRepository } from '../../domain/repositories/ICardUsageRepository';
import { Environment } from '../../../shared/infrastructure/config/Environment';
import { DateUtil } from '../../../shared/utils/DateUtil';
import { FirestoreService } from '../../../shared/infrastructure/database/FirestoreService';
import { ErrorHandler } from '../../../shared/infrastructure/errors/ErrorHandler';
import { logger } from '../../../shared/infrastructure/logging/Logger';

/**
 * Firestoreを使用したカード利用情報リポジトリの実装
 */
export class FirestoreCardUsageRepository implements ICardUsageRepository {
  private firestoreService: FirestoreService;
  private readonly serviceContext = 'FirestoreCardUsageRepository';

  constructor() {
    this.firestoreService = FirestoreService.getInstance();
  }

  /**
   * Firestoreへの接続を初期化する
   */
  @ErrorHandler.errorDecorator('FirestoreCardUsageRepository', {
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
   * 日付から年、月、週番号、曜日を抽出し、Firestoreのパスを生成する
   * @param date 日付オブジェクト
   * @returns パス情報を含むオブジェクト
   */
  static getFirestorePath(date: Date) {
    return DateUtil.getFirestorePath(date);
  }

  /**
   * カード利用情報を保存する
   * @param cardUsage カード利用情報
   * @returns 保存されたパス
   */
  @ErrorHandler.errorDecorator('FirestoreCardUsageRepository', {
    defaultMessage: 'カード利用情報の保存に失敗しました'
  })
  async save(cardUsage: CardUsage): Promise<string> {
    // Firestoreへの接続を初期化
    await this.initialize();

    // 日付オブジェクトを作成
    const dateObj = cardUsage.datetime_of_use.toDate();

    // パス情報を取得
    const pathInfo = FirestoreCardUsageRepository.getFirestorePath(dateObj);
    logger.info(`保存先: ${pathInfo.path}`, this.serviceContext);

    // 新しいフィールドのデフォルト値を設定
    const completeCardUsage: CardUsage = {
      ...cardUsage,
      memo: cardUsage.memo || '', // デフォルト値は空文字
      is_active: cardUsage.is_active !== undefined ? cardUsage.is_active : true // デフォルト値はtrue
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
    defaultMessage: 'カード利用情報の取得に失敗しました'
  })
  async getByTimestamp(timestamp: string): Promise<CardUsage | null> {
    // Firestoreへの接続を初期化
    await this.initialize();

    // タイムスタンプから日付を取得
    const date = new Date(parseInt(timestamp));

    // パス情報を生成
    const pathInfo = FirestoreCardUsageRepository.getFirestorePath(date);

    // 共通サービスを使用してドキュメントを取得
    const result = await this.firestoreService.getDocument<CardUsage>(pathInfo.path);

    if (!result) {
      logger.info(`カード利用情報が見つかりません: ${timestamp}`, this.serviceContext);
    }

    return result;
  }
}
