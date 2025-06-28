import { DailyReportFactory, WeeklyReportFactory, MonthlyReportFactory } from '../../../../../shared/domain/factories/ReportsFactory';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

// firebase-adminのモック
jest.mock('firebase-admin/firestore', () => {
    // Timestampクラスのモック
    class TimestampMock {
        static fromDate = jest.fn().mockImplementation((date: Date) => ({
            toDate: () => date,
            seconds: Math.floor(date.getTime() / 1000),
            nanoseconds: (date.getTime() % 1000) * 1000000,
        }));
    }

    return {
        Timestamp: TimestampMock,
        FieldValue: {
            serverTimestamp: jest.fn().mockReturnValue('SERVER_TIMESTAMP'),
        },
    };
});

describe('ReportsFactory', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('DailyReportFactory', () => {
        describe('create', () => {
            it('必須パラメータでDailyReportエンティティを作成できること', () => {
                // Arrange
                const date = '2025-05-30';
                const totalAmount = 15000;
                const totalCount = 5;
                const lastUpdatedBy = 'test-user';

                // Act
                const result = DailyReportFactory.create(date, totalAmount, totalCount, lastUpdatedBy);

                // Assert
                expect(result.totalAmount).toBe(totalAmount);
                expect(result.totalCount).toBe(totalCount);
                expect(result.lastUpdatedBy).toBe(lastUpdatedBy);
                expect(result.documentIdList).toEqual([]);
                expect(result.hasNotified).toBe(false);
                expect(result.lastUpdated).toBe('SERVER_TIMESTAMP');
                expect(Timestamp.fromDate).toHaveBeenCalledWith(new Date(date));
            });

            it('全パラメータでDailyReportエンティティを作成できること', () => {
                // Arrange
                const date = '2025-05-29';
                const totalAmount = 25000;
                const totalCount = 8;
                const lastUpdatedBy = 'admin-user';
                const documentIdList = ['doc1', 'doc2', 'doc3'];
                const hasNotified = true;

                // Act
                const result = DailyReportFactory.create(
                    date,
                    totalAmount,
                    totalCount,
                    lastUpdatedBy,
                    documentIdList,
                    hasNotified
                );

                // Assert
                expect(result.totalAmount).toBe(totalAmount);
                expect(result.totalCount).toBe(totalCount);
                expect(result.lastUpdatedBy).toBe(lastUpdatedBy);
                expect(result.documentIdList).toBe(documentIdList);
                expect(result.hasNotified).toBe(hasNotified);
            });

            it('Timestampオブジェクトを受け取って作成できること', () => {
                // Arrange
                const mockTimestamp = new (Timestamp as any)();
                mockTimestamp.toDate = () => new Date('2025-05-28T00:00:00.000Z');
                mockTimestamp.seconds = 1748390400;
                mockTimestamp.nanoseconds = 0;
                
                const totalAmount = 10000;
                const totalCount = 3;
                const lastUpdatedBy = 'system';

                // Act
                const result = DailyReportFactory.create(mockTimestamp, totalAmount, totalCount, lastUpdatedBy);

                // Assert
                expect(result.date).toBe(mockTimestamp);
                expect(result.totalAmount).toBe(totalAmount);
                expect(result.totalCount).toBe(totalCount);
                expect(result.lastUpdatedBy).toBe(lastUpdatedBy);
                expect(Timestamp.fromDate).not.toHaveBeenCalled();
            });
        });

        describe('reconstruct', () => {
            it('既存のデータからDailyReportエンティティを復元できること', () => {
                // Arrange
                const testDate = new Date('2025-05-27T00:00:00.000Z');
                const mockTimestamp = {
                    toDate: () => testDate,
                    seconds: Math.floor(testDate.getTime() / 1000),
                    nanoseconds: (testDate.getTime() % 1000) * 1000000,
                } as Timestamp;

                const data = {
                    totalAmount: 18000,
                    totalCount: 6,
                    lastUpdatedBy: 'restore-user',
                    documentIdList: ['restore1', 'restore2'],
                    date: mockTimestamp,
                    hasNotified: true,
                    lastUpdated: 'EXISTING_TIMESTAMP' as any,
                };

                // Act
                const result = DailyReportFactory.reconstruct(data);

                // Assert
                expect(result.totalAmount).toBe(data.totalAmount);
                expect(result.totalCount).toBe(data.totalCount);
                expect(result.lastUpdatedBy).toBe(data.lastUpdatedBy);
                expect(result.documentIdList).toBe(data.documentIdList);
                expect(result.date).toBe(data.date);
                expect(result.hasNotified).toBe(data.hasNotified);
                expect(result.lastUpdated).toBe('EXISTING_TIMESTAMP');
            });

            it('lastUpdatedが未定義の場合はserverTimestampが設定されること', () => {
                // Arrange
                const testDate = new Date('2025-05-26T00:00:00.000Z');
                const mockTimestamp = {
                    toDate: () => testDate,
                    seconds: Math.floor(testDate.getTime() / 1000),
                    nanoseconds: (testDate.getTime() % 1000) * 1000000,
                } as Timestamp;

                const data = {
                    totalAmount: 12000,
                    totalCount: 4,
                    lastUpdatedBy: 'no-timestamp-user',
                    documentIdList: ['nt1', 'nt2'],
                    date: mockTimestamp,
                    hasNotified: false,
                };

                // Act
                const result = DailyReportFactory.reconstruct(data);

                // Assert
                expect(result.lastUpdated).toBe('SERVER_TIMESTAMP');
                expect(FieldValue.serverTimestamp).toHaveBeenCalled();
            });
        });

        describe('createEmpty', () => {
            it('空のDailyReportエンティティを作成できること', () => {
                // Arrange
                const date = '2025-05-25';
                const lastUpdatedBy = 'empty-user';

                // Act
                const result = DailyReportFactory.createEmpty(date, lastUpdatedBy);

                // Assert
                expect(result.totalAmount).toBe(0);
                expect(result.totalCount).toBe(0);
                expect(result.lastUpdatedBy).toBe(lastUpdatedBy);
                expect(result.documentIdList).toEqual([]);
                expect(result.hasNotified).toBe(false);
            });
        });
    });

    describe('WeeklyReportFactory', () => {
        describe('create', () => {
            it('必須パラメータでWeeklyReportエンティティを作成できること', () => {
                // Arrange
                const termStartDate = '2025-05-26';
                const termEndDate = '2025-06-01';
                const totalAmount = 50000;
                const totalCount = 15;
                const lastUpdatedBy = 'weekly-user';

                // Act
                const result = WeeklyReportFactory.create(
                    termStartDate,
                    termEndDate,
                    totalAmount,
                    totalCount,
                    lastUpdatedBy
                );

                // Assert
                expect(result.totalAmount).toBe(totalAmount);
                expect(result.totalCount).toBe(totalCount);
                expect(result.lastUpdatedBy).toBe(lastUpdatedBy);
                expect(result.documentIdList).toEqual([]);
                expect(result.hasNotifiedLevel1).toBe(false);
                expect(result.hasNotifiedLevel2).toBe(false);
                expect(result.hasNotifiedLevel3).toBe(false);
                expect(result.hasReportSent).toBe(false);
                expect(Timestamp.fromDate).toHaveBeenCalledWith(new Date(termStartDate));
                expect(Timestamp.fromDate).toHaveBeenCalledWith(new Date(termEndDate));
            });

            it('全パラメータでWeeklyReportエンティティを作成できること', () => {
                // Arrange
                const termStartDate = '2025-05-19';
                const termEndDate = '2025-05-25';
                const totalAmount = 75000;
                const totalCount = 20;
                const lastUpdatedBy = 'weekly-admin';
                const documentIdList = ['w1', 'w2', 'w3'];
                const hasNotifiedLevel1 = true;
                const hasNotifiedLevel2 = true;
                const hasNotifiedLevel3 = false;
                const hasReportSent = true;

                // Act
                const result = WeeklyReportFactory.create(
                    termStartDate,
                    termEndDate,
                    totalAmount,
                    totalCount,
                    lastUpdatedBy,
                    documentIdList,
                    hasNotifiedLevel1,
                    hasNotifiedLevel2,
                    hasNotifiedLevel3,
                    hasReportSent
                );

                // Assert
                expect(result.totalAmount).toBe(totalAmount);
                expect(result.totalCount).toBe(totalCount);
                expect(result.lastUpdatedBy).toBe(lastUpdatedBy);
                expect(result.documentIdList).toBe(documentIdList);
                expect(result.hasNotifiedLevel1).toBe(hasNotifiedLevel1);
                expect(result.hasNotifiedLevel2).toBe(hasNotifiedLevel2);
                expect(result.hasNotifiedLevel3).toBe(hasNotifiedLevel3);
                expect(result.hasReportSent).toBe(hasReportSent);
            });
        });

        describe('reconstruct', () => {
            it('既存のデータからWeeklyReportエンティティを復元できること', () => {
                // Arrange
                const startDate = new Date('2025-05-12T00:00:00.000Z');
                const endDate = new Date('2025-05-18T00:00:00.000Z');
                const mockStartTimestamp = {
                    toDate: () => startDate,
                    seconds: Math.floor(startDate.getTime() / 1000),
                    nanoseconds: (startDate.getTime() % 1000) * 1000000,
                } as Timestamp;

                const mockEndTimestamp = {
                    toDate: () => endDate,
                    seconds: Math.floor(endDate.getTime() / 1000),
                    nanoseconds: (endDate.getTime() % 1000) * 1000000,
                } as Timestamp;

                const data = {
                    totalAmount: 32000,
                    totalCount: 10,
                    lastUpdatedBy: 'weekly-restore',
                    documentIdList: ['wr1', 'wr2'],
                    termStartDate: mockStartTimestamp,
                    termEndDate: mockEndTimestamp,
                    hasNotifiedLevel1: true,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                    hasReportSent: true,
                };

                // Act
                const result = WeeklyReportFactory.reconstruct(data);

                // Assert
                expect(result.totalAmount).toBe(data.totalAmount);
                expect(result.totalCount).toBe(data.totalCount);
                expect(result.lastUpdatedBy).toBe(data.lastUpdatedBy);
                expect(result.documentIdList).toBe(data.documentIdList);
                expect(result.termStartDate).toBe(data.termStartDate);
                expect(result.termEndDate).toBe(data.termEndDate);
                expect(result.hasNotifiedLevel1).toBe(data.hasNotifiedLevel1);
                expect(result.hasNotifiedLevel2).toBe(data.hasNotifiedLevel2);
                expect(result.hasNotifiedLevel3).toBe(data.hasNotifiedLevel3);
                expect(result.hasReportSent).toBe(data.hasReportSent);
            });

            it('hasReportSentが未定義の場合はfalseが設定されること', () => {
                // Arrange
                const startDate = new Date('2025-05-05T00:00:00.000Z');
                const endDate = new Date('2025-05-11T00:00:00.000Z');
                const mockStartTimestamp = {
                    toDate: () => startDate,
                    seconds: Math.floor(startDate.getTime() / 1000),
                    nanoseconds: (startDate.getTime() % 1000) * 1000000,
                } as Timestamp;

                const mockEndTimestamp = {
                    toDate: () => endDate,
                    seconds: Math.floor(endDate.getTime() / 1000),
                    nanoseconds: (endDate.getTime() % 1000) * 1000000,
                } as Timestamp;

                const data = {
                    totalAmount: 28000,
                    totalCount: 8,
                    lastUpdatedBy: 'no-report-sent',
                    documentIdList: ['nrs1'],
                    termStartDate: mockStartTimestamp,
                    termEndDate: mockEndTimestamp,
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                };

                // Act
                const result = WeeklyReportFactory.reconstruct(data);

                // Assert
                expect(result.hasReportSent).toBe(false);
            });
        });

        describe('createEmpty', () => {
            it('空のWeeklyReportエンティティを作成できること', () => {
                // Arrange
                const termStartDate = '2025-04-28';
                const termEndDate = '2025-05-04';
                const lastUpdatedBy = 'weekly-empty';

                // Act
                const result = WeeklyReportFactory.createEmpty(termStartDate, termEndDate, lastUpdatedBy);

                // Assert
                expect(result.totalAmount).toBe(0);
                expect(result.totalCount).toBe(0);
                expect(result.lastUpdatedBy).toBe(lastUpdatedBy);
                expect(result.documentIdList).toEqual([]);
                expect(result.hasNotifiedLevel1).toBe(false);
                expect(result.hasNotifiedLevel2).toBe(false);
                expect(result.hasNotifiedLevel3).toBe(false);
                expect(result.hasReportSent).toBe(false);
            });
        });
    });

    describe('MonthlyReportFactory', () => {
        describe('create', () => {
            it('必須パラメータでMonthlyReportエンティティを作成できること', () => {
                // Arrange
                const monthStartDate = '2025-05-01';
                const monthEndDate = '2025-05-31';
                const totalAmount = 200000;
                const totalCount = 60;
                const lastUpdatedBy = 'monthly-user';

                // Act
                const result = MonthlyReportFactory.create(
                    monthStartDate,
                    monthEndDate,
                    totalAmount,
                    totalCount,
                    lastUpdatedBy
                );

                // Assert
                expect(result.totalAmount).toBe(totalAmount);
                expect(result.totalCount).toBe(totalCount);
                expect(result.lastUpdatedBy).toBe(lastUpdatedBy);
                expect(result.documentIdList).toEqual([]);
                expect(result.hasNotifiedLevel1).toBe(false);
                expect(result.hasNotifiedLevel2).toBe(false);
                expect(result.hasNotifiedLevel3).toBe(false);
                expect(result.hasReportSent).toBe(false);
                expect(Timestamp.fromDate).toHaveBeenCalledWith(new Date(monthStartDate));
                expect(Timestamp.fromDate).toHaveBeenCalledWith(new Date(monthEndDate));
            });

            it('全パラメータでMonthlyReportエンティティを作成できること', () => {
                // Arrange
                const monthStartDate = '2025-04-01';
                const monthEndDate = '2025-04-30';
                const totalAmount = 180000;
                const totalCount = 55;
                const lastUpdatedBy = 'monthly-admin';
                const documentIdList = ['m1', 'm2', 'm3', 'm4'];
                const hasNotifiedLevel1 = true;
                const hasNotifiedLevel2 = true;
                const hasNotifiedLevel3 = true;
                const hasReportSent = true;

                // Act
                const result = MonthlyReportFactory.create(
                    monthStartDate,
                    monthEndDate,
                    totalAmount,
                    totalCount,
                    lastUpdatedBy,
                    documentIdList,
                    hasNotifiedLevel1,
                    hasNotifiedLevel2,
                    hasNotifiedLevel3,
                    hasReportSent
                );

                // Assert
                expect(result.totalAmount).toBe(totalAmount);
                expect(result.totalCount).toBe(totalCount);
                expect(result.lastUpdatedBy).toBe(lastUpdatedBy);
                expect(result.documentIdList).toBe(documentIdList);
                expect(result.hasNotifiedLevel1).toBe(hasNotifiedLevel1);
                expect(result.hasNotifiedLevel2).toBe(hasNotifiedLevel2);
                expect(result.hasNotifiedLevel3).toBe(hasNotifiedLevel3);
                expect(result.hasReportSent).toBe(hasReportSent);
            });
        });

        describe('reconstruct', () => {
            it('既存のデータからMonthlyReportエンティティを復元できること', () => {
                // Arrange
                const startDate = new Date('2025-03-01T00:00:00.000Z');
                const endDate = new Date('2025-03-31T00:00:00.000Z');
                const mockStartTimestamp = {
                    toDate: () => startDate,
                    seconds: Math.floor(startDate.getTime() / 1000),
                    nanoseconds: (startDate.getTime() % 1000) * 1000000,
                } as Timestamp;

                const mockEndTimestamp = {
                    toDate: () => endDate,
                    seconds: Math.floor(endDate.getTime() / 1000),
                    nanoseconds: (endDate.getTime() % 1000) * 1000000,
                } as Timestamp;

                const data = {
                    totalAmount: 165000,
                    totalCount: 48,
                    lastUpdatedBy: 'monthly-restore',
                    documentIdList: ['mr1', 'mr2', 'mr3'],
                    monthStartDate: mockStartTimestamp,
                    monthEndDate: mockEndTimestamp,
                    hasNotifiedLevel1: true,
                    hasNotifiedLevel2: true,
                    hasNotifiedLevel3: false,
                    hasReportSent: false,
                };

                // Act
                const result = MonthlyReportFactory.reconstruct(data);

                // Assert
                expect(result.totalAmount).toBe(data.totalAmount);
                expect(result.totalCount).toBe(data.totalCount);
                expect(result.lastUpdatedBy).toBe(data.lastUpdatedBy);
                expect(result.documentIdList).toBe(data.documentIdList);
                expect(result.monthStartDate).toBe(data.monthStartDate);
                expect(result.monthEndDate).toBe(data.monthEndDate);
                expect(result.hasNotifiedLevel1).toBe(data.hasNotifiedLevel1);
                expect(result.hasNotifiedLevel2).toBe(data.hasNotifiedLevel2);
                expect(result.hasNotifiedLevel3).toBe(data.hasNotifiedLevel3);
                expect(result.hasReportSent).toBe(data.hasReportSent);
            });

            it('hasReportSentが未定義の場合はfalseが設定されること', () => {
                // Arrange
                const startDate = new Date('2025-02-01T00:00:00.000Z');
                const endDate = new Date('2025-02-28T00:00:00.000Z');
                const mockStartTimestamp = {
                    toDate: () => startDate,
                    seconds: Math.floor(startDate.getTime() / 1000),
                    nanoseconds: (startDate.getTime() % 1000) * 1000000,
                } as Timestamp;

                const mockEndTimestamp = {
                    toDate: () => endDate,
                    seconds: Math.floor(endDate.getTime() / 1000),
                    nanoseconds: (endDate.getTime() % 1000) * 1000000,
                } as Timestamp;

                const data = {
                    totalAmount: 95000,
                    totalCount: 28,
                    lastUpdatedBy: 'no-monthly-report',
                    documentIdList: ['nmr1'],
                    monthStartDate: mockStartTimestamp,
                    monthEndDate: mockEndTimestamp,
                    hasNotifiedLevel1: false,
                    hasNotifiedLevel2: false,
                    hasNotifiedLevel3: false,
                };

                // Act
                const result = MonthlyReportFactory.reconstruct(data);

                // Assert
                expect(result.hasReportSent).toBe(false);
            });
        });

        describe('createEmpty', () => {
            it('空のMonthlyReportエンティティを作成できること', () => {
                // Arrange
                const monthStartDate = '2025-01-01';
                const monthEndDate = '2025-01-31';
                const lastUpdatedBy = 'monthly-empty';

                // Act
                const result = MonthlyReportFactory.createEmpty(monthStartDate, monthEndDate, lastUpdatedBy);

                // Assert
                expect(result.totalAmount).toBe(0);
                expect(result.totalCount).toBe(0);
                expect(result.lastUpdatedBy).toBe(lastUpdatedBy);
                expect(result.documentIdList).toEqual([]);
                expect(result.hasNotifiedLevel1).toBe(false);
                expect(result.hasNotifiedLevel2).toBe(false);
                expect(result.hasNotifiedLevel3).toBe(false);
                expect(result.hasReportSent).toBe(false);
            });
        });
    });
});
