import { DateUtil } from '../../../shared/utils/DateUtil';

describe('DateUtil', () => {
    // オリジナルのDateオブジェクトを保存
    const originalDate = global.Date;

    afterEach(() => {
        // テスト後に元のDateオブジェクトを復元
        global.Date = originalDate;
    });

    describe('getDateInfo', () => {
        test('2025年4月1日の詳細情報を取得できる', () => {
            const testDate = new Date(2025, 3, 1); // 2025年4月1日
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.year).toBe(2025);
            expect(dateInfo.month).toBe(4);
            expect(dateInfo.day).toBe(1);
            expect(dateInfo.term).toBe(1);
            expect(dateInfo.weekStartDate).toEqual(new Date(Date.UTC(2025, 3, 1, -9, 0, 0))); // 4月1日（火曜日）（月初）
            expect(dateInfo.weekEndDate).toEqual(new Date(Date.UTC(2025, 3, 5, 14, 59, 59))); // 4月5日（土曜日）
        });

        test('2025年4月5日の詳細情報を取得できる', () => {
            const testDate = new Date(2025, 3, 5); // 2025年4月5日
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.year).toBe(2025);
            expect(dateInfo.month).toBe(4);
            expect(dateInfo.day).toBe(5);
            expect(dateInfo.term).toBe(1);
            expect(dateInfo.weekStartDate).toEqual(new Date(Date.UTC(2025, 3, 1, -9, 0, 0))); // 4月1日（火曜日）
            expect(dateInfo.weekEndDate).toEqual(new Date(Date.UTC(2025, 3, 5, 14, 59, 59))); // 4月5日（土曜日）
        });

        test('2025年4月6日の詳細情報を取得できる', () => {
            const testDate = new Date(2025, 3, 6); // 2025年4月6日
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.year).toBe(2025);
            expect(dateInfo.month).toBe(4);
            expect(dateInfo.day).toBe(6);
            expect(dateInfo.term).toBe(2);
            expect(dateInfo.weekStartDate).toEqual(new Date(Date.UTC(2025, 3, 6, -9, 0, 0))); // 4月6日（日曜日）
            expect(dateInfo.weekEndDate).toEqual(new Date(Date.UTC(2025, 3, 12, 14, 59, 59))); // 4月12日（土曜日）
        });

        test('2025年4月30日の詳細情報を取得できる', () => {
            const testDate = new Date(2025, 3, 30); // 2025年4月30日
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.year).toBe(2025);
            expect(dateInfo.month).toBe(4);
            expect(dateInfo.day).toBe(30);
            expect(dateInfo.term).toBe(5);
            expect(dateInfo.weekStartDate).toEqual(new Date(Date.UTC(2025, 3, 27, -9, 0, 0))); // 4月27日（日曜日）
            expect(dateInfo.weekEndDate).toEqual(new Date(Date.UTC(2025, 3, 30, 14, 59, 59))); // 4月30日（水曜日）（月の最終日）
        });
    });

    describe('週番号（term）の計算', () => {
        test('4月1日は第1週（term1）として認識される', () => {
            // 2025年4月1日
            const testDate = new Date(2025, 3, 1);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(1);
        });

        test('4月5日は第1週（term1）として認識される', () => {
            // 2025年4月5日
            const testDate = new Date(2025, 3, 5);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(1);
        });

        test('4月6日は第2週（term2）として認識される', () => {
            // 2025年4月6日
            const testDate = new Date(2025, 3, 6);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(2);
        });

        test('4月12日は第2週（term2）として認識される', () => {
            // 2025年4月12日
            const testDate = new Date(2025, 3, 12);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(2);
        });

        test('4月27日は第5週（term5）として認識される', () => {
            // 2025年4月27日
            const testDate = new Date(2025, 3, 27);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(5);
        });

        test('4月30日は第5週（term5）として認識される', () => {
            // 2025年4月30日
            const testDate = new Date(2025, 3, 30);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(5);
        });

        test('5月1日は第1週（term1）として認識される', () => {
            // 2025年5月1日
            const testDate = new Date(2025, 4, 1);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(1);
        });
    });

    describe('term期間の計算', () => {
        test('4月第1週(term1)は4月1日から4月5日までである', () => {
            const testDate = new Date(2025, 3, 1); // 2025年4月1日
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.weekStartDate).toEqual(new Date(Date.UTC(2025, 3, 1, -9, 0, 0))); // 4月1日（火曜日）
            expect(dateInfo.weekEndDate).toEqual(new Date(Date.UTC(2025, 3, 5, 14, 59, 59))); // 4月5日（土曜日）
        });

        test('4月第2週(term2)は4月6日から4月12日までである', () => {
            const testDate = new Date(2025, 3, 7); // 2025年4月6日
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.weekStartDate).toEqual(new Date(Date.UTC(2025, 3, 6, -9, 0, 0))); // 4月6日（日曜日）
            expect(dateInfo.weekEndDate).toEqual(new Date(Date.UTC(2025, 3, 12, 14, 59, 59))); // 4月12日（土曜日）
        });

        test('4月第5週(term5)は4月27日から4月30日までである', () => {
            const testDate = new Date(2025, 3, 27); // 2025年4月27日
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.weekStartDate).toEqual(new Date(Date.UTC(2025, 3, 27, -9, 0, 0))); // 4月27日（日曜日）
            expect(dateInfo.weekEndDate).toEqual(new Date(Date.UTC(2025, 3, 30, 14, 59, 59))); // 4月30日
        });

        test('5月第1週(term1)は5月1日から5月3日までである', () => {
            const testDate = new Date(2025, 4, 1); // 2025年5月1日
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.weekStartDate).toEqual(new Date(Date.UTC(2025, 4, 1, -9, 0, 0))); // 5月1日（木曜日）- 月が変わるので日曜日からではなく月初から
            expect(dateInfo.weekEndDate).toEqual(new Date(Date.UTC(2025, 4, 3, 14, 59, 59))); // 5月3日（土曜日）
        });

        test('5月第5週(term5)は5月25日から5月31日までである', () => {
            const testDate = new Date(2025, 4, 25); // 2025年5月25日
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.weekStartDate).toEqual(new Date(Date.UTC(2025, 4, 25, -9, 0, 0))); // 5月25日（日曜日）
            expect(dateInfo.weekEndDate).toEqual(new Date(Date.UTC(2025, 4, 31, 14, 59, 59))); // 5月31日（土曜日）
        });
    });

    describe('週末の判定', () => {
        test('土曜日は週の最終日として認識される', () => {
            const testDate = new Date(2025, 3, 26); // 2025年4月26日（土曜日）
            const isLastDay = DateUtil.isLastDayOfTerm(testDate);

            expect(isLastDay).toBe(true);
        });

        test('日曜日は週の最終日として認識されない', () => {
            const testDate = new Date(2025, 3, 27); // 2025年4月27日（日曜日）
            const isLastDay = DateUtil.isLastDayOfTerm(testDate);

            expect(isLastDay).toBe(false);
        });
    });

    describe('月末の判定', () => {
        test('4月30日は月の最終日として認識される', () => {
            const testDate = new Date(2025, 3, 30);
            const isLastDay = DateUtil.isLastDayOfMonth(testDate);

            expect(isLastDay).toBe(true);
        });

        test('5月31日は月の最終日として認識される', () => {
            const testDate = new Date(2025, 4, 31);
            const isLastDay = DateUtil.isLastDayOfMonth(testDate);

            expect(isLastDay).toBe(true);
        });

        test('6月1日は月の最終日ではない', () => {
            const testDate = new Date(2025, 5, 1);
            const isLastDay = DateUtil.isLastDayOfMonth(testDate);

            expect(isLastDay).toBe(false);
        });
    });

    describe('isLastDayOfTerm', () => {
        test('月の最終日は週の最終日として認識される', () => {
            // 2025年4月30日（月の最終日）
            const testDate = new Date(2025, 3, 30);
            const isLastDay = DateUtil.isLastDayOfTerm(testDate);

            expect(isLastDay).toBe(true);
        });

        test('週の途中の日は週の最終日として認識されない', () => {
            // 2025年4月23日（水曜日）
            const testDate = new Date(2025, 3, 23);
            const isLastDay = DateUtil.isLastDayOfTerm(testDate);

            expect(isLastDay).toBe(false);
        });

        test('5月31日は月の最終日かつ週の最終日として認識される', () => {
            // 2025年5月31日（月の最終日）
            const testDate = new Date(2025, 4, 31);
            const isLastDay = DateUtil.isLastDayOfTerm(testDate);
            const isLastDayOfMonth = DateUtil.isLastDayOfMonth(testDate);

            expect(isLastDay).toBe(true);
            expect(isLastDayOfMonth).toBe(true);
        });

        test('土曜日（週の最終日）の判定が正確に行われる', () => {
            // 2025年4月5日（土曜日）
            const testDate = new Date(2025, 3, 5);
            const isLastDay = DateUtil.isLastDayOfTerm(testDate);

            expect(isLastDay).toBe(true);
        });

        test('金曜日は週の最終日として認識されない', () => {
            // 2025年4月4日（金曜日）
            const testDate = new Date(2025, 3, 4);
            const isLastDay = DateUtil.isLastDayOfTerm(testDate);

            expect(isLastDay).toBe(false);
        });
    });

    describe('formatDate メソッド', () => {
        test('フォーマット指定なしの場合はISO形式で返される', () => {
            const testDate = new Date(2025, 3, 15, 14, 30, 45); // 2025年4月15日 14:30:45
            const formatted = DateUtil.formatDate(testDate);

            expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        });

        test('yyyy/MM/dd形式でフォーマットできる', () => {
            const testDate = new Date(2025, 3, 15);
            const formatted = DateUtil.formatDate(testDate, 'yyyy/MM/dd');

            expect(formatted).toBe('2025/04/15');
        });

        test('yyyy-MM-dd形式でフォーマットできる', () => {
            const testDate = new Date(2025, 3, 5);
            const formatted = DateUtil.formatDate(testDate, 'yyyy-MM-dd');

            expect(formatted).toBe('2025-04-05');
        });

        test('M/d形式（ゼロパディングなし）でフォーマットできる', () => {
            const testDate = new Date(2025, 3, 5);
            const formatted = DateUtil.formatDate(testDate, 'M/d');

            expect(formatted).toBe('4/5');
        });

        test('時間を含むフォーマット（HH:mm:ss）が正しく動作する', () => {
            const testDate = new Date(2025, 3, 15, 14, 5, 7);
            const formatted = DateUtil.formatDate(testDate, 'yyyy/MM/dd HH:mm:ss');

            expect(formatted).toMatch(/2025\/04\/15 \d{2}:\d{2}:\d{2}/);
        });
    });

    describe('getJSTDate メソッド', () => {
        test('日本時間の現在日時が取得できる', () => {
            const jstDate = DateUtil.getJSTDate();

            expect(jstDate).toBeInstanceOf(Date);
            expect(jstDate.getTime()).toBeGreaterThan(0);
        });

        test('getJSTDateで取得した日付が妥当な範囲内である', () => {
            const jstDate = DateUtil.getJSTDate();
            const currentYear = new Date().getFullYear();

            expect(jstDate.getFullYear()).toBeGreaterThanOrEqual(currentYear - 1);
            expect(jstDate.getFullYear()).toBeLessThanOrEqual(currentYear + 1);
            expect(jstDate.getMonth()).toBeGreaterThanOrEqual(0);
            expect(jstDate.getMonth()).toBeLessThanOrEqual(11);
        });
    });

    describe('getJapaneseDayOfWeek メソッド', () => {
        test('日曜日は「日」が返される', () => {
            const testDate = new Date(2025, 3, 6); // 2025年4月6日（日曜日）
            const dayOfWeek = DateUtil.getJapaneseDayOfWeek(testDate);

            expect(dayOfWeek).toBe('日');
        });

        test('月曜日は「月」が返される', () => {
            const testDate = new Date(2025, 3, 7); // 2025年4月7日（月曜日）
            const dayOfWeek = DateUtil.getJapaneseDayOfWeek(testDate);

            expect(dayOfWeek).toBe('月');
        });

        test('火曜日は「火」が返される', () => {
            const testDate = new Date(2025, 3, 1); // 2025年4月1日（火曜日）
            const dayOfWeek = DateUtil.getJapaneseDayOfWeek(testDate);

            expect(dayOfWeek).toBe('火');
        });

        test('土曜日は「土」が返される', () => {
            const testDate = new Date(2025, 3, 5); // 2025年4月5日（土曜日）
            const dayOfWeek = DateUtil.getJapaneseDayOfWeek(testDate);

            expect(dayOfWeek).toBe('土');
        });
    });

    describe('formatDateRange メソッド', () => {
        test('デフォルトフォーマット（yyyy/MM/dd）で期間文字列が生成される', () => {
            const startDate = new Date(2025, 3, 1);
            const endDate = new Date(2025, 3, 7);
            const formatted = DateUtil.formatDateRange(startDate, endDate);

            expect(formatted).toBe('2025/04/01 〜 2025/04/07');
        });

        test('カスタムフォーマットで期間文字列が生成される', () => {
            const startDate = new Date(2025, 3, 1);
            const endDate = new Date(2025, 3, 7);
            const formatted = DateUtil.formatDateRange(startDate, endDate, 'M/d');

            expect(formatted).toBe('4/1 〜 4/7');
        });

        test('同じ日の範囲でも正しく表示される', () => {
            const startDate = new Date(2025, 3, 15);
            const endDate = new Date(2025, 3, 15);
            const formatted = DateUtil.formatDateRange(startDate, endDate);

            expect(formatted).toBe('2025/04/15 〜 2025/04/15');
        });
    });

    describe('getLastDayOfMonth メソッド', () => {
        test('4月の最終日は30日である', () => {
            const testDate = new Date(2025, 3, 15);
            const lastDay = DateUtil.getLastDayOfMonth(testDate);

            expect(lastDay.getDate()).toBe(30);
            expect(lastDay.getMonth()).toBe(3); // 4月
        });

        test('2月（非うるう年）の最終日は28日である', () => {
            const testDate = new Date(2025, 1, 15); // 2025年2月（非うるう年）
            const lastDay = DateUtil.getLastDayOfMonth(testDate);

            expect(lastDay.getDate()).toBe(28);
            expect(lastDay.getMonth()).toBe(1); // 2月
        });

        test('2月（うるう年）の最終日は29日である', () => {
            const testDate = new Date(2024, 1, 15); // 2024年2月（うるう年）
            const lastDay = DateUtil.getLastDayOfMonth(testDate);

            expect(lastDay.getDate()).toBe(29);
            expect(lastDay.getMonth()).toBe(1); // 2月
        });

        test('12月の最終日は31日である', () => {
            const testDate = new Date(2025, 11, 15);
            const lastDay = DateUtil.getLastDayOfMonth(testDate);

            expect(lastDay.getDate()).toBe(31);
            expect(lastDay.getMonth()).toBe(11); // 12月
        });
    });

    describe('エッジケースのテスト', () => {
        test('年をまたいだterm期間の計算が正確に行われる', () => {
            // 2024年12月31日
            const testDate = new Date(2024, 11, 31);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.year).toBe(2024);
            expect(dateInfo.month).toBe(12);
            expect(dateInfo.day).toBe(31);
            expect(dateInfo.isLastDayOfMonth).toBe(true);
        });

        test('1月1日のterm計算が正確に行われる', () => {
            // 2025年1月1日
            const testDate = new Date(2025, 0, 1);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.year).toBe(2025);
            expect(dateInfo.month).toBe(1);
            expect(dateInfo.day).toBe(1);
            expect(dateInfo.term).toBe(1);
        });

        test('月末かつ土曜日の日付が正しく処理される', () => {
            // 2025年5月31日（土曜日）
            const testDate = new Date(2025, 4, 31);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.isLastDayOfMonth).toBe(true);
            expect(dateInfo.isLastDayOfTerm).toBe(true);
        });

        test('月をまたぐweekStartDateの調整が正しく動作する', () => {
            // 2025年6月1日（日曜日）- 週の開始が前月にまたがる場合
            const testDate = new Date(2025, 5, 1);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.weekStartDate.getMonth()).toBe(5); // 6月
            expect(dateInfo.weekStartDate.getDate()).toBe(1); // 1日から開始
        });

        test('月の途中で始まる第1週の期間が正確に計算される', () => {
            // 2025年7月1日（火曜日）
            const testDate = new Date(2025, 6, 1);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(1);
            expect(dateInfo.weekStartDate.getDate()).toBe(1); // 月初から開始
        });

        test('月末で終わる週の期間が正確に計算される', () => {
            // 2025年9月30日（火曜日）
            const testDate = new Date(2025, 8, 30);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.isLastDayOfMonth).toBe(true);
            expect(dateInfo.weekEndDate.getDate()).toBe(30); // 月末で終了
        });
    });

    describe('termの境界値テスト', () => {
        test('第5週から第1週への切り替わりが正確に判定される', () => {
            // 4月第5週の最終日（4月30日）
            const lastDayOfApril = new Date(2025, 3, 30);
            const isLastDayOfTermApril = DateUtil.isLastDayOfTerm(lastDayOfApril);

            // 5月第1週の開始日（5月1日）
            const firstDayOfMay = new Date(2025, 4, 1);
            const dateInfoMay = DateUtil.getDateInfo(firstDayOfMay);

            expect(isLastDayOfTermApril).toBe(true);
            expect(dateInfoMay.term).toBe(1);
        });

        test('週の最終日と翌週の開始日のterm番号が連続している', () => {
            // 4月第2週の最終日（4月12日）
            const lastDayOfWeek2 = new Date(2025, 3, 12);
            const isLastDay = DateUtil.isLastDayOfTerm(lastDayOfWeek2);

            // 4月第3週の開始日（4月13日）
            const firstDayOfWeek3 = new Date(2025, 3, 13);
            const dateInfo = DateUtil.getDateInfo(firstDayOfWeek3);

            expect(isLastDay).toBe(true);
            expect(dateInfo.term).toBe(3);
        });

        test('月末かつ週の途中で終わる場合の判定が正確に行われる', () => {
            // 2025年6月30日（月曜日）
            const testDate = new Date(2025, 5, 30);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.isLastDayOfMonth).toBe(true);
            expect(dateInfo.isLastDayOfTerm).toBe(true); // 月末なのでtermの最終日でもある
        });
    });
});