import { Timestamp } from 'firebase-admin/firestore';

/**
 * カード利用情報を表すエンティティ
 */
export interface CardUsage {
  // 利用カード名
  card_name: string;
  
  // 利用日時
  datetime_of_use: Timestamp;
  
  // 利用金額
  amount: number;
  
  // 利用場所
  where_to_use: string;
  
  // データ作成日時
  created_at: Timestamp;
}

/**
 * Discord通知用のデータモデル
 */
export interface CardUsageNotification {
  card_name: string;
  datetime_of_use: string;
  amount: number;
  where_to_use: string;
}

