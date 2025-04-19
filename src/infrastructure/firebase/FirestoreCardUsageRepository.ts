import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import { CardUsage } from '../../domain/entities/CardUsage';
import { ICardUsageRepository } from '../../domain/repositories/ICardUsageRepository';
import { Environment } from '../config/environment';
import { DateUtil } from '../../../shared/utils/DateUtil';
import { FirestoreService } from '../../../shared/firebase/FirestoreService';

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
      const serviceAccountPath = Environment.FIREBASE_ADMIN_KEY_PATH;

      // ローカル環境として初期化
      this.firestoreService.setCloudFunctions(false);
      return await this.firestoreService.initialize(serviceAccountPath);
    } catch (error) {
      console.error('❌ Firestoreへの接続に失敗しました:', error);
      throw error;
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
    // Firestoreへの接続を初期化
    await this.initialize();

    // 日付オブジェクトを作成
    const dateObj = cardUsage.datetime_of_use.toDate();

    // パス情報を取得
    const pathInfo = FirestoreCardUsageRepository.getFirestorePath(dateObj);
    console.log(`🗂 保存先: ${pathInfo.path}`);

    try {
      // 共通サービスを使用してドキュメントを保存
      await this.firestoreService.saveDocument(pathInfo.path, cardUsage);

      console.log('✅ カード利用データをFirestoreに保存しました');
      return pathInfo.path;
    } catch (error) {
      console.error('❌ Firestoreへのデータ保存に失敗しました:', error);
      throw error;
    }
  }

  /**
   * カード利用情報をタイムスタンプから取得する
   * @param timestamp タイムスタンプ
   * @returns カード利用情報
   */
  async getByTimestamp(timestamp: string): Promise<CardUsage | null> {
    // Firestoreへの接続を初期化
    await this.initialize();

    // タイムスタンプから日付を取得
    const date = new Date(parseInt(timestamp));

    // パス情報を生成
    const pathInfo = FirestoreCardUsageRepository.getFirestorePath(date);

    try {
      // 共通サービスを使用してドキュメントを取得
      return await this.firestoreService.getDocument<CardUsage>(pathInfo.path);
    } catch (error) {
      console.error('❌ Firestoreからのデータ取得に失敗しました:', error);
      throw error;
    }
  }
}

