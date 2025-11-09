/**
 * 日付の詳細情報を表すインターフェース
 */
export interface DateInfo {
    date: Date;
    year: number;
    month: number;
    day: number;
    weekNumber: number;
    term: number;
    weekStartDate: Date;
    weekEndDate: Date;
    timestamp: number;
    isLastDayOfTerm: boolean;
    isLastDayOfMonth: boolean;
}

/**
 * 月と週番号の基本情報を表すインターフェース
 */
interface BasicTermInfo {
    month: number;
    term: number;
}

/**
 * 日付ユーティリティクラス
 * 日付に関連する共通処理を提供します
 */
export class DateUtil {
    /**
     * 月と週番号(term)の基本情報だけを取得する
     * 無限再帰防止用の内部メソッド
     * @param date 対象の日付
     * @returns 月と週番号の情報
     * @private
     */
    private static getBasicTermInfo(date: Date): BasicTermInfo {
        const month = date.getMonth() + 1;

        // 週番号の計算
        // 月の最初の日を取得
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        // 月初の曜日 (0: 日曜, 1: 月曜, ...)
        const startOfMonthDay = firstDayOfMonth.getDay();

        // 現在の日の月内週番号を計算
        const dayPosition = date.getDate() + startOfMonthDay;
        const weekNumber = Math.ceil(dayPosition / 7);

        return { month, term: weekNumber };
    }

    /**
     * 日付から週内情報を含む詳細情報を取得
     * @param date 対象の日付
     * @returns 日付の詳細情報
     */
    static getDateInfo(date: Date): DateInfo {
        // 基本的な日付情報
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const timestamp = date.getTime();

        // 週番号の計算
        // 月の最初の日を取得
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        // 月初の曜日 (0: 日曜, 1: 月曜, ...)
        const startOfMonthDay = firstDayOfMonth.getDay();

        // 現在の日の月内週番号を計算 - より堅牢な方法で
        // 日付が月の何日目か + 月初の曜日で、何週目に属するかを計算
        const dayPosition = date.getDate() + startOfMonthDay;
        const weekNumber = Math.ceil(dayPosition / 7);
        const term = weekNumber;

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
        // 日本時間で比較するため、UTCから日本時間に変換して判定
        const weekStartJST = new Date(weekStartDate.getTime() + 9 * 60 * 60 * 1000);
        const currentMonth = date.getMonth();

        if (weekStartJST.getMonth() !== currentMonth) {
            // 週の開始日が前月の場合は、今月の1日から計算し直す（日本時間の午前0時）
            weekStartDate = new Date(Date.UTC(
                date.getFullYear(),
                currentMonth,
                1,
                -9, 0, 0
            ));
        }

        // 週の終了日が翌月の場合、終了日を今月の最終日に設定（日本時間の23:59:59）
        const lastDayOfMonthDate = new Date(Date.UTC(
            date.getFullYear(),
            date.getMonth() + 1,
            0,
            14, 59, 59
        ));

        if (weekEndDate > lastDayOfMonthDate) {
            weekEndDate = lastDayOfMonthDate;
        }

        // 基本情報にまとめる
        const baseInfo = {
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

        // 最終日の判定情報を追加して返す
        return {
            ...baseInfo,
            isLastDayOfTerm: this.isLastDayOfTerm(date),
            isLastDayOfMonth: this.isLastDayOfMonth(date),
        };
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
    static formatDate(date: Date, format?: string, locale = 'ja-JP'): string {
        if (!format) {
            // フォーマット指定がない場合はISO形式（日本時間）で返す
            return date.toISOString().replace('T', ' ').substring(0, 19);
        }

        // 年、月、日、時、分、秒の値を取得
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();

        // フォーマット文字列を置換
        let result = format;

        // 年の置換
        if (format.includes('yyyy')) {
            result = result.replace('yyyy', year.toString());
        } else if (format.includes('yy')) {
            result = result.replace('yy', year.toString().slice(-2));
        }

        // 月の置換
        if (format.includes('MM')) {
            result = result.replace('MM', month.toString().padStart(2, '0'));
        } else if (format.includes('M')) {
            result = result.replace('M', month.toString());
        }

        // 日の置換
        if (format.includes('dd')) {
            result = result.replace('dd', day.toString().padStart(2, '0'));
        } else if (format.includes('d')) {
            result = result.replace('d', day.toString());
        }

        // 時間の置換（24時間形式）
        if (format.includes('HH')) {
            result = result.replace('HH', hours.toString().padStart(2, '0'));
        } else if (format.includes('H')) {
            result = result.replace('H', hours.toString());
        }

        // 時間の置換（12時間形式）
        if (format.includes('hh')) {
            const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
            result = result.replace('hh', hours12.toString().padStart(2, '0'));
        } else if (format.includes('h')) {
            const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
            result = result.replace('h', hours12.toString());
        }

        // 分の置換
        if (format.includes('mm')) {
            result = result.replace('mm', minutes.toString().padStart(2, '0'));
        } else if (format.includes('m')) {
            result = result.replace('m', minutes.toString());
        }

        // 秒の置換
        if (format.includes('ss')) {
            result = result.replace('ss', seconds.toString().padStart(2, '0'));
        } else if (format.includes('s')) {
            result = result.replace('s', seconds.toString());
        }

        return result;
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
     * 日付期間の表示形式を生成する（例: 2025/04/01 〜 2025/04/07）
     * @param startDate 開始日
     * @param endDate 終了日
     * @param format 日付フォーマット（省略時は 'yyyy/MM/dd'）
     * @returns フォーマットされた期間文字列
     */
    static formatDateRange(startDate: Date, endDate: Date, format = 'yyyy/MM/dd'): string {
        const formattedStart = this.formatDate(startDate, format);
        const formattedEnd = this.formatDate(endDate, format);
        return `${formattedStart} 〜 ${formattedEnd}`;
    }

    /**
     * 指定した日付が属する月の最後の日を取得する
     * @param date 日付
     * @returns 月の最後の日
     */
    static getLastDayOfMonth(date: Date): Date {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }

    /**
     * 指定した日付が属する週（term）の最終日かどうかを判定する
     * @param date 判定する日付
     * @returns 週の最終日の場合はtrue
     */
    static isLastDayOfTerm(date: Date): boolean {
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);

        // 無限再帰を防ぐため、getBasicTermInfoを使用
        const currentInfo = this.getBasicTermInfo(date);
        const nextInfo = this.getBasicTermInfo(nextDay);

        // 次の日のtermが異なる場合、または月が変わる場合は週の最終日
        return currentInfo.term !== nextInfo.term || currentInfo.month !== nextInfo.month;
    }

    /**
     * 指定した日付が月の最終日かどうかを判定する
     * @param date 判定する日付
     * @returns 月の最終日の場合はtrue
     */
    static isLastDayOfMonth(date: Date): boolean {
        const lastDay = this.getLastDayOfMonth(date);
        return date.getDate() === lastDay.getDate();
    }
}
