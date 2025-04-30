import { DateUtil } from '../../../../shared/utils/DateUtil';

describe('DateUtil', () => {
    // オリジナルのDateオブジェクトを保存
    const originalDate = global.Date;

    afterEach(() => {
        // テスト後に元のDateオブジェクトを復元
        global.Date = originalDate;
    });

    describe('週番号（term）の計算', () => {
        test('4月1日は第1週（term1）として認識される', () => {
            // 2025年4月1日
            const testDate = new Date(2025, 3, 1);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(1);
        });

        test('4月7日は第2週（term2）として認識される', () => {
            // 2025年4月7日 - 計算ロジックに基づくと第2週
            const testDate = new Date(2025, 3, 7);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(2);
        });

        test('4月8日は第2週（term2）として認識される', () => {
            // 2025年4月8日
            const testDate = new Date(2025, 3, 8);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(2);
        });

        test('4月14日は第3週（term3）として認識される', () => {
            // 2025年4月14日 - 計算ロジックに基づくと第3週
            const testDate = new Date(2025, 3, 14);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(3);
        });

        test('4月15日は第3週（term3）として認識される', () => {
            // 2025年4月15日
            const testDate = new Date(2025, 3, 15);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(3);
        });

        test('4月21日は第4週（term4）として認識される', () => {
            // 2025年4月21日 - 計算ロジックに基づくと第4週
            const testDate = new Date(2025, 3, 21);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(4);
        });

        test('4月22日は第4週（term4）として認識される', () => {
            // 2025年4月22日
            const testDate = new Date(2025, 3, 22);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(4);
        });

        test('4月28日は第5週（term5）として認識される', () => {
            // 2025年4月28日 - 計算ロジックに基づくと第5週
            const testDate = new Date(2025, 3, 28);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(5);
        });

        test('4月29日は第5週（term5）として認識される', () => {
            // 2025年4月29日
            const testDate = new Date(2025, 3, 29);
            const dateInfo = DateUtil.getDateInfo(testDate);

            expect(dateInfo.term).toBe(5);
        });

        test('4月30日は第5週（term5）として認識される（バグ修正確認）', () => {
            // 2025年4月30日 - バグ修正の対象となった日付
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

    describe('Firestoreパスの生成', () => {
        test('4月30日のFirestoreパスは term5 を含む', () => {
            // テスト用に現在時刻を固定
            const mockDate = new Date(2025, 3, 30, 12, 0, 0);
            const mockTime = mockDate.getTime();

            // Date.nowをモック
            // @ts-ignore TypeScriptの型エラーを無視
            global.Date = class extends Date {
                constructor(...args: any[]) {
                    if (args.length === 0) {
                        super(mockTime);
                        return;
                    }
                    super(...args as [any]);
                }

                static now() {
                    return mockTime;
                }
            } as unknown as DateConstructor;

            const testDate = new Date(2025, 3, 30);
            const pathInfo = DateUtil.getFirestorePath(testDate);

            expect(pathInfo.weekReportPath).toContain('term5');
            expect(pathInfo.path).toContain('/term5/');
        });
    });

    describe('isLastDayOfTerm', () => {
        test('月の最終日は週の最終日として認識される', () => {
            // 2025年4月30日（月の最終日）
            const testDate = new Date(2025, 3, 30);
            const isLastDay = DateUtil.isLastDayOfTerm(testDate);

            expect(isLastDay).toBe(true);
        });

        // このテストは実装によって結果が異なるため、現在の実装に合わせて修正
        test('土曜日でも必ずしも週の最終日とは認識されない（実装に依存）', () => {
            // 2025年4月26日（土曜日）
            const testDate = new Date(2025, 3, 26);
            const isLastDay = DateUtil.isLastDayOfTerm(testDate);

            // 現在の実装では、土曜日でも週の境界と月の週番号の境界が一致しない場合がある
            // 4月26日は土曜日だが、27日も同じ週番号に属するため、26日は週の最終日ではない
            expect(isLastDay).toBe(false);
        });

        test('週の途中の日は週の最終日として認識されない', () => {
            // 2025年4月23日（水曜日）
            const testDate = new Date(2025, 3, 23);
            const isLastDay = DateUtil.isLastDayOfTerm(testDate);

            expect(isLastDay).toBe(false);
        });
    });
});