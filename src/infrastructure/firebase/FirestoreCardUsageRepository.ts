import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import { CardUsage } from '../../domain/entities/CardUsage';
import { ICardUsageRepository } from '../../domain/repositories/ICardUsageRepository';
import { Environment } from '../config/environment';

/**
 * Firestoreを使用したカード利用情報リポジトリの実装
 */
export class FirestoreCardUsageRepository implements ICardUsageRepository {
  private db: Firestore | null = null;

  /**
   * Firestoreへの接続を初期化する
   */
  async initialize(): Promise<Firestore> {
    if (this.db) {
      return this.db;
    }

    try {
      // サービスアカウントの秘密鍵のパスを取得
      const serviceAccountPath = Environment.FIREBASE_ADMIN_KEY_PATH;

      // Firebaseの初期化（まだ初期化されていない場合）
      if (!admin.apps || admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(
            JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
          )
        });
        console.log('✅ Firestoreに正常に接続しました');
      }

      // Firestoreインスタンスを返す
      this.db = admin.firestore();
      return this.db;
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
  static getFirestorePath(date: Date): {
    year: string;
    month: string;
    term: string;
    day: string;
    timestamp: string;
    path: string;
    weekReportPath: string;
  } {
    const year = date.getFullYear().toString();
    // 月は0から始まるので、+1して2桁になるよう整形
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    // 日を2桁で整形
    const day = date.getDate().toString().padStart(2, '0');

    // 週番号の計算
    // 月の最初の日を取得
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    // 月初の曜日 (0: 日曜, 1: 月曜, ...)
    const startOfMonthDay = firstDayOfMonth.getDay();
    // 現在の日の月内週番号を計算
    const weekNumber = Math.ceil((date.getDate() + startOfMonthDay) / 7);
    const term = `term${weekNumber}`;

    // タイムスタンプはミリ秒単位のUNIX時間（プログラム実行時刻）を使用
    const timestamp = new Date().getTime().toString();

    // 新しいパス形式
    const path = `details/${year}/${month}/${term}/${day}/${timestamp}`;
    // 週次レポートのパス
    const weekReportPath = `details/${year}/${month}/${term}`;

    return {
      year,
      month,
      term,
      day,
      timestamp,
      path,
      weekReportPath
    };
  }

  /**
   * カード利用情報を保存する
   * @param cardUsage カード利用情報
   * @returns 保存されたパス
   */
  async save(cardUsage: CardUsage): Promise<string> {
    const db = await this.initialize();

    // 日付オブジェクトを作成
    const dateObj = cardUsage.datetime_of_use.toDate();

    // パス情報を取得
    const pathInfo = FirestoreCardUsageRepository.getFirestorePath(dateObj);
    console.log(`🗂 保存先: ${pathInfo.path}`);

    try {
      // 階層的なパスを使用してドキュメントを保存
      const docRef = db.doc(pathInfo.path);
      await docRef.set(cardUsage);

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
    const db = await this.initialize();

    // タイムスタンプから日付を取得
    const date = new Date(parseInt(timestamp));

    // パス情報を生成
    const pathInfo = FirestoreCardUsageRepository.getFirestorePath(date);

    try {
      // 新しいパス構造に基づいてドキュメントを取得
      const docRef = db.doc(pathInfo.path);
      const doc = await docRef.get();

      if (doc.exists) {
        return doc.data() as CardUsage;
      } else {
        console.log(`ドキュメントが見つかりません: ${pathInfo.path}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Firestoreからのデータ取得に失敗しました:', error);
      throw error;
    }
  }
}

