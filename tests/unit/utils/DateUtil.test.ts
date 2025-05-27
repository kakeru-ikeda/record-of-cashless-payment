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
    });
});