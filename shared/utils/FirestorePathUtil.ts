import { DateInfo, DateUtil } from '@shared/utils/DateUtil';

/**
 * Firestoreのパス生成ユーティリティ
 */
export class FirestorePathUtil {
  /**
   * 週次レポートのFirestoreパスを生成する（Dateオブジェクト版）
   * @param date 日付オブジェクト
   * @returns 週次レポートパス
   */
  static getWeeklyReportPath(date: Date): string;
  /**
   * 週次レポートのFirestoreパスを生成する（年月日指定版）
   * @param year 年
   * @param month 月（1-12）
   * @param day 日
   * @returns 週次レポートパス
   */
  /**
   * 週次レポートのFirestoreパスを生成する（年月日指定版・文字列）
   * @param year 年
   * @param month 月（1-12）
   * @param day 日
   * @returns 週次レポートパス
   */
  static getWeeklyReportPath(year: string, month: string, day: string): string;
  static getWeeklyReportPath(
    dateOrYear: Date | number | string,
    month?: number | string,
    day?: number | string,
  ): string {
    let dateInfo: DateInfo;
    if (dateOrYear instanceof Date) {
      dateInfo = DateUtil.getDateInfo(dateOrYear);
    } else {
      const yearNum = typeof dateOrYear === 'string' ? parseInt(dateOrYear, 10) : dateOrYear;
      const monthNum = typeof month === 'string' ? parseInt(month, 10) : month!;
      const dayNum = typeof day === 'string' ? parseInt(day, 10) : day!;
      dateInfo = DateUtil.getDateInfo(new Date(yearNum, monthNum - 1, dayNum));
    }
    const monthFormatted = dateInfo.month.toString().padStart(2, '0');
    return `reports/weekly/${dateInfo.year}-${monthFormatted}/term${dateInfo.term}`;
  }

  /**
   * 日次レポートのFirestoreパスを生成する（Dateオブジェクト版）
   * @param date 日付オブジェクト
   * @returns 日次レポートパス
   */
  static getDailyReportPath(date: Date): string;
  /**
   * 日次レポートのFirestoreパスを生成する（年月日指定版）
   * @param year 年
   * @param month 月（1-12）
   * @param day 日
   * @returns 日次レポートパス
   */
  /**
   * 日次レポートのFirestoreパスを生成する（年月日指定版・文字列）
   * @param year 年
   * @param month 月（1-12）
   * @param day 日
   * @returns 日次レポートパス
   */
  static getDailyReportPath(year: string, month: string, day: string): string;
  static getDailyReportPath(
    dateOrYear: Date | number | string,
    month?: number | string,
    day?: number | string,
  ): string {
    let dateInfo: DateInfo;
    if (dateOrYear instanceof Date) {
      dateInfo = DateUtil.getDateInfo(dateOrYear);
    } else {
      const yearNum = typeof dateOrYear === 'string' ? parseInt(dateOrYear, 10) : dateOrYear;
      const monthNum = typeof month === 'string' ? parseInt(month, 10) : month!;
      const dayNum = typeof day === 'string' ? parseInt(day, 10) : day!;
      dateInfo = DateUtil.getDateInfo(new Date(yearNum, monthNum - 1, dayNum));
    }
    const monthFormatted = dateInfo.month.toString().padStart(2, '0');
    const dayFormatted = dateInfo.day.toString().padStart(2, '0');
    return `reports/daily/${dateInfo.year}-${monthFormatted}/${dayFormatted}`;
  }

  /**
   * 月次レポートのFirestoreパスを生成する（Dateオブジェクト版）
   * @param date 日付オブジェクト
   * @returns 月次レポートパス
   */
  static getMonthlyReportPath(date: Date): string;
  /**
   * 月次レポートのFirestoreパスを生成する（年月指定版）
   * @param year 年
   * @param month 月（1-12）
   * @returns 月次レポートパス
   */
  /**
   * 月次レポートのFirestoreパスを生成する（年月指定版・文字列）
   * @param year 年
   * @param month 月（1-12）
   * @returns 月次レポートパス
   */
  static getMonthlyReportPath(year: string, month: string): string;
  static getMonthlyReportPath(dateOrYear: Date | number | string, month?: number | string): string {
    let dateInfo: DateInfo;
    if (dateOrYear instanceof Date) {
      dateInfo = DateUtil.getDateInfo(dateOrYear);
    } else {
      const yearNum = typeof dateOrYear === 'string' ? parseInt(dateOrYear, 10) : dateOrYear;
      const monthNum = typeof month === 'string' ? parseInt(month, 10) : month!;
      dateInfo = DateUtil.getDateInfo(new Date(yearNum, monthNum - 1, 1));
    }
    const monthFormatted = dateInfo.month.toString().padStart(2, '0');
    return `reports/monthly/${dateInfo.year}/${monthFormatted}`;
  }

  /**
   * カード利用詳細データのFirestoreパスを生成する（Dateオブジェクト版）
   * @param date 日付オブジェクト
   * @returns カード利用詳細データパス
   */
  static getCardUsageDetailsPath(date: Date): string;
  /**
   * カード利用詳細データのFirestoreパスを生成する（年月日指定版）
   * @param year 年
   * @param month 月（1-12）
   * @param day 日
   * @returns カード利用詳細データパス
   */
  /**
   * カード利用詳細データのFirestoreパスを生成する（年月日指定版・文字列）
   * @param year 年
   * @param month 月（1-12）
   * @param day 日
   * @returns カード利用詳細データパス
   */
  static getCardUsageDetailsPath(year: string, month: string, day: string): string;
  static getCardUsageDetailsPath(
    dateOrYear: Date | number | string,
    month?: number | string,
    day?: number | string,
  ): string {
    let dateInfo: DateInfo;
    if (dateOrYear instanceof Date) {
      dateInfo = DateUtil.getDateInfo(dateOrYear);
    } else {
      const yearNum = typeof dateOrYear === 'string' ? parseInt(dateOrYear, 10) : dateOrYear;
      const monthNum = typeof month === 'string' ? parseInt(month, 10) : month!;
      const dayNum = typeof day === 'string' ? parseInt(day, 10) : day!;
      dateInfo = DateUtil.getDateInfo(new Date(yearNum, monthNum - 1, dayNum));
    }
    const now = new Date();
    const monthFormatted = dateInfo.month.toString().padStart(2, '0');
    return `details/${dateInfo.year}/${monthFormatted}/term${dateInfo.term}/${dateInfo.day}/${now.getTime()}`;
  }

  /**
   * 日付から年、月、週番号、曜日を抽出し、Firestoreのパスを生成する
   * @param date 日付オブジェクト
   * @returns パス情報を含むオブジェクト
   * @deprecated 個別のパス生成メソッド（getWeeklyReportPath, getDailyReportPath等）を使用してください
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
      monthlyReportPath,
    };
  }
}
