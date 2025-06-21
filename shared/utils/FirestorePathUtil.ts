import { DateUtil } from '@shared/utils/DateUtil';

/**
 * Firestoreのパス生成ユーティリティ
 */
export class FirestorePathUtil {
  /**
   * 日付から年、月、週番号、曜日を抽出し、Firestoreのパスを生成する
   * @param date 日付オブジェクト
   * @returns パス情報を含むオブジェクト
   */
  static getFirestorePath(date: Date) {
    const dateInfo = DateUtil.getDateInfo(date);
    const now = new Date();

    // 月と日を2桁でフォーマット
    const monthFormatted = dateInfo.month.toString().padStart(2, '0');
    const dayFormatted = dateInfo.day.toString().padStart(2, '0');

    // カード利用データのパス
    const path = `details/${dateInfo.year}/${monthFormatted}/term${dateInfo.term}/${dateInfo.day}/${now.getTime()}`;

    // 新しいレポートパス形式
    const weeklyReportPath = `reports/weekly/${dateInfo.year}-${monthFormatted}/term${dateInfo.term}`;
    const dailyReportPath = `reports/daily/${dateInfo.year}-${monthFormatted}/${dayFormatted}`;
    const monthlyReportPath = `reports/monthly/${dateInfo.year}/${monthFormatted}`;

    return {
      ...dateInfo,
      path,
      weeklyReportPath,
      dailyReportPath,
      monthlyReportPath
    };
  }
}
