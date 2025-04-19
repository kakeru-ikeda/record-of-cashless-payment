/**
 * 日付ユーティリティクラス
 * 日付に関連する共通処理を提供します
 */
export class DateUtil {
    /**
     * 日付から週内情報を含む詳細情報を取得
     * @param date 対象の日付
     * @returns 日付の詳細情報
     */
    static getDateInfo(date: Date) {
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const timestamp = date.getTime();

        // 週番号の計算
        // 月の最初の日を取得
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        // 月初の曜日 (0: 日曜, 1: 月曜, ...)
        const startOfMonthDay = firstDayOfMonth.getDay();
        // 現在の日の月内週番号を計算
        const weekNumber = Math.ceil((date.getDate() + startOfMonthDay) / 7);
        const term = `term${weekNumber}`;

        // 週の開始日（日曜日）を計算 - 日本時間の午前0時（UTC+9）を設定
        const dayOfWeek = date.getDay(); // 0: 日曜, 1: 月曜, ...
        // 日本時間の午前0時を設定するため、UTCでは前日の15:00に設定
        let weekStartDate = new Date(Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate() - dayOfWeek,
            -9, 0, 0
        ));

        // 週の終了日（土曜日）を計算 - 日本時間の23:59:59（UTC+9）を設定
        // 日本時間の23:59:59を設定するため、UTCでは当日の14:59:59に設定
        let weekEndDate = new Date(Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate() + (6 - dayOfWeek),
            14, 59, 59
        ));

        // 週の開始日が今月の1日より前の場合（月をまたいだ場合）
        if (new Date(weekStartDate.getTime() + 9 * 60 * 60 * 1000).getMonth() !== date.getMonth()) {
            // 週の開始日が前月の場合は、今月の1日から計算し直す（日本時間の午前0時）
            weekStartDate = new Date(Date.UTC(
                date.getFullYear(),
                date.getMonth(),
                1,
                -9, 0, 0
            ));
        }

        // 週の終了日が翌月の場合、終了日を今月の最終日に設定（日本時間の23:59:59）
        const lastDayOfMonth = new Date(Date.UTC(
            date.getFullYear(),
            date.getMonth() + 1,
            0,
            14, 59, 59
        ));

        if (weekEndDate > lastDayOfMonth) {
            weekEndDate = lastDayOfMonth;
        }

        return {
            date,
            year,
            month,
            day,
            weekNumber,
            term,
            weekStartDate,
            weekEndDate,
            timestamp,
        };
    }

    /**
     * 日付から年、月、週番号、曜日を抽出し、Firestoreのパスを生成する
     * @param date 日付オブジェクト
     * @returns パス情報を含むオブジェクト
     */
    static getFirestorePath(date: Date) {
        const dateInfo = this.getDateInfo(date);
        const now = new Date();

        // パス形式を生成
        const path = `details/${dateInfo.year}/${dateInfo.month}/${dateInfo.term}/${dateInfo.day}/${now.getTime()}`;
        // 週次レポートのパス
        const weekReportPath = `details/${dateInfo.year}/${dateInfo.month}/${dateInfo.term}`;

        return {
            ...dateInfo,
            path,
            weekReportPath
        };
    }

    /**
     * 現在の日時から日付情報を取得（タイムゾーン考慮）
     * @returns 現在日付の詳細情報
     */
    static getCurrentDateInfo() {
        // 日本時間の日付を取得
        const now = this.getJSTDate();
        return this.getDateInfo(now);
    }

    /**
     * 現在の日付を日本時間（JST）で取得
     * @returns 日本時間の日付オブジェクト
     */
    static getJSTDate() {
        // 日本時間のオフセット: UTC+9時間
        const jstOffset = 9 * 60 * 60 * 1000; // 9時間をミリ秒に変換
        const utc = new Date().getTime() + (new Date().getTimezoneOffset() * 60 * 1000);
        return new Date(utc + jstOffset);
    }

    /**
     * 日付を指定したフォーマットで文字列に変換する
     * @param date 対象の日付
     * @param format フォーマット（例: 'yyyy-MM-dd'）※省略時はISO形式
     * @param locale ロケール（省略時は'ja-JP'）
     * @returns フォーマットされた日付文字列
     */
    static formatDate(date: Date, format?: string, locale: string = 'ja-JP'): string {
        if (!format) {
            // フォーマット指定がない場合はISO形式（日本時間）で返す
            return date.toISOString().replace('T', ' ').substring(0, 19);
        }

        const options: Intl.DateTimeFormatOptions = {};

        if (format.includes('yyyy')) {
            options.year = 'numeric';
        } else if (format.includes('yy')) {
            options.year = '2-digit';
        }

        if (format.includes('MM')) {
            options.month = '2-digit';
        } else if (format.includes('M')) {
            options.month = 'numeric';
        }

        if (format.includes('dd')) {
            options.day = '2-digit';
        } else if (format.includes('d')) {
            options.day = 'numeric';
        }

        if (format.includes('HH') || format.includes('hh')) {
            options.hour = '2-digit';
            options.hour12 = format.includes('hh');
        } else if (format.includes('H') || format.includes('h')) {
            options.hour = 'numeric';
            options.hour12 = format.includes('h');
        }

        if (format.includes('mm')) {
            options.minute = '2-digit';
        } else if (format.includes('m')) {
            options.minute = 'numeric';
        }

        if (format.includes('ss')) {
            options.second = '2-digit';
        } else if (format.includes('s')) {
            options.second = 'numeric';
        }

        return new Intl.DateTimeFormat(locale, options).format(date);
    }

    /**
     * 日本語の曜日表記を取得する
     * @param date 対象の日付
     * @returns 曜日の文字列（例: '月'）
     */
    static getJapaneseDayOfWeek(date: Date): string {
        const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
        return daysOfWeek[date.getDay()];
    }

    /**
     * 指定した日数を加算した日付を取得する
     * @param date 基準となる日付
     * @param days 加算する日数（負の値も可）
     * @returns 計算後の日付
     */
    static addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    /**
     * 日付期間の表示形式を生成する（例: 2025/04/01 〜 2025/04/07）
     * @param startDate 開始日
     * @param endDate 終了日
     * @param format 日付フォーマット（省略時は 'yyyy/MM/dd'）
     * @returns フォーマットされた期間文字列
     */
    static formatDateRange(startDate: Date, endDate: Date, format: string = 'yyyy/MM/dd'): string {
        const formattedStart = this.formatDate(startDate, format);
        const formattedEnd = this.formatDate(endDate, format);
        return `${formattedStart} 〜 ${formattedEnd}`;
    }

    /**
     * 指定した日付が属する月の最初の日を取得する
     * @param date 日付
     * @returns 月の最初の日
     */
    static getFirstDayOfMonth(date: Date): Date {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    /**
     * 指定した日付が属する月の最後の日を取得する
     * @param date 日付
     * @returns 月の最後の日
     */
    static getLastDayOfMonth(date: Date): Date {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }
}