import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import { CardUsage } from '../../domain/entities/CardUsage';
import { ICardUsageRepository } from '../../domain/repositories/ICardUsageRepository';
import { Environment } from '../../../shared/config/Environment';
import { DateUtil } from '../../../shared/utils/DateUtil';
import { FirestoreService } from '../../../shared/firebase/FirestoreService';
import { AppError, ErrorType } from '../../../shared/errors/AppError';
import { ErrorHandler } from '../../../shared/errors/ErrorHandler';

/**
 * Firestoreを使用したカード利用情報リポジトリの実装
 */
export class FirestoreCardUsageRepository implements ICardUsageRepository {
  private firestoreService: FirestoreService;

  constructor() {
    this.firestoreService = FirestoreService.getInstance();
  }

  /**
   * Firestoreへの接続を初期化する
   */
  async initialize(): Promise<Firestore> {
    try {
      // サービスアカウントの秘密鍵のパスを取得
      const serviceAccountPath = Environment.getFirebaseAdminKeyPath();

      // ローカル環境として初期化
      this.firestoreService.setCloudFunctions(Environment.isCloudFunctions());
      return await this.firestoreService.initialize(serviceAccountPath);
    } catch (error) {
      // AppErrorに変換してスロー
      throw ErrorHandler.convertToAppError(error);
    }
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
  async save(cardUsage: CardUsage): Promise<string> {
    try {
      // Firestoreへの接続を初期化
      await this.initialize();

      // 日付オブジェクトを作成
      const dateObj = cardUsage.datetime_of_use.toDate();

      // パス情報を取得
      const pathInfo = FirestoreCardUsageRepository.getFirestorePath(dateObj);
      console.log(`🗂 保存先: ${pathInfo.path}`);

      // 新しいフィールドのデフォルト値を設定
      const completeCardUsage: CardUsage = {
        ...cardUsage,
        memo: cardUsage.memo || '', // デフォルト値は空文字
        is_active: cardUsage.is_active !== undefined ? cardUsage.is_active : true // デフォルト値はtrue
      };

      // 共通サービスを使用してドキュメントを保存
      await this.firestoreService.saveDocument(pathInfo.path, completeCardUsage);

      console.log('✅ カード利用データをFirestoreに保存しました');
      return pathInfo.path;
    } catch (error) {
      // エラー処理を共通化
      throw new AppError(
        'カード利用情報の保存に失敗しました',
        ErrorType.FIREBASE,
        { cardUsage },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * カード利用情報をタイムスタンプから取得する
   * @param timestamp タイムスタンプ
   * @returns カード利用情報
   */
  async getByTimestamp(timestamp: string): Promise<CardUsage | null> {
    try {
      // Firestoreへの接続を初期化
      await this.initialize();

      // タイムスタンプから日付を取得
      const date = new Date(parseInt(timestamp));

      // パス情報を生成
      const pathInfo = FirestoreCardUsageRepository.getFirestorePath(date);

      // 共通サービスを使用してドキュメントを取得
      const result = await this.firestoreService.getDocument<CardUsage>(pathInfo.path);

      if (!result) {
        console.log(`カード利用情報が見つかりません: ${timestamp}`);
      }

      return result;
    } catch (error) {
      // エラー処理を共通化
      throw new AppError(
        'カード利用情報の取得に失敗しました',
        ErrorType.FIREBASE,
        { timestamp },
        error instanceof Error ? error : undefined
      );
    }
  }
}

