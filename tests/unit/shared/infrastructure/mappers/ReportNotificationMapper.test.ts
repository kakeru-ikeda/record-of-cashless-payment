import { ReportNotificationMapper } from '../../../../../shared/infrastructure/mappers/ReportNotificationMapper';
import { DailyReport, WeeklyReport, MonthlyReport } from '../../../../../shared/domain/entities/Reports';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { DateUtil } from '../../../../../shared/utils/DateUtil';

// firebase-adminのTimestampをモック
jest.mock('firebase-admin/firestore', () => ({
    Timestamp: {
        fromDate: jest.fn().mockImplementation((date: Date) => ({
            toDate: () => date,
            seconds: Math.floor(date.getTime() / 1000),
            nanoseconds: (date.getTime() % 1000) * 1000000,
        })),
    },
    FieldValue: {
        serverTimestamp: jest.fn().mockReturnValue({
            _methodName: 'FieldValue.serverTimestamp',
            isEqual: jest.fn().mockReturnValue(true),
        }),
    },
}));

// DateUtilをモック
jest.mock('../../../../../shared/utils/DateUtil', () => ({
    DateUtil: {
        formatDate: jest.fn(),
        formatDateRange: jest.fn(),
    },
}));

describe('ReportNotificationMapper', () => {
    const mockDateUtil = DateUtil as jest.Mocked<typeof DateUtil>;
    const mockFieldValue = {
        _methodName: 'FieldValue.serverTimestamp',
        isEqual: jest.fn().mockReturnValue(true),
    } as FieldValue;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('toDailyNotification', () => {
        it('DailyReportエンティティを通知用DTOに正しく変換すること', () => {
            // Arrange
            const testDate = new Date('2025-05-30T00:00:00Z');
            const mockTimestamp = {
                toDate: () => testDate,
                seconds: Math.floor(testDate.getTime() / 1000),
                nanoseconds: 0,
            } as Timestamp;

            const dailyReport: DailyReport = {
                date: mockTimestamp,
                totalAmount: 5000,
                totalCount: 3,
                documentIdList: ['id1', 'id2', 'id3'],
                lastUpdated: mockFieldValue,
                lastUpdatedBy: 'system',
                hasNotified: false,
            };

            const title = 'テストタイトル';
            const additionalInfo = '追加情報';

            mockDateUtil.formatDate.mockReturnValue('2025/05/30');

            // Act
            const result = ReportNotificationMapper.toDailyNotification(dailyReport, title, additionalInfo);

            // Assert
            expect(result).toEqual({
                title: 'テストタイトル',
                date: '2025/05/30',
                totalAmount: 5000,
                totalCount: 3,
                additionalInfo: '追加情報',
            });

            expect(mockDateUtil.formatDate).toHaveBeenCalledWith(testDate, 'yyyy/MM/dd');
        });

        it('additionalInfoが未指定の場合もundefinedとして正しく変換すること', () => {
            // Arrange
            const testDate = new Date('2025-05-29T00:00:00Z');
            const mockTimestamp = {
                toDate: () => testDate,
                seconds: Math.floor(testDate.getTime() / 1000),
                nanoseconds: 0,
            } as Timestamp;

            const dailyReport: DailyReport = {
                date: mockTimestamp,
                totalAmount: 2500,
                totalCount: 1,
                documentIdList: ['id1'],
                lastUpdated: mockFieldValue,
                lastUpdatedBy: 'system',
                hasNotified: false,
            };

            mockDateUtil.formatDate.mockReturnValue('2025/05/29');

            // Act
            const result = ReportNotificationMapper.toDailyNotification(dailyReport, 'デイリー');

            // Assert
            expect(result).toEqual({
                title: 'デイリー',
                date: '2025/05/29',
                totalAmount: 2500,
                totalCount: 1,
                additionalInfo: undefined,
            });
        });
    });

    describe('toWeeklyNotification', () => {
        it('WeeklyReportエンティティを通知用DTOに正しく変換すること', () => {
            // Arrange
            const startDate = new Date('2025-05-26T00:00:00Z');
            const endDate = new Date('2025-06-01T23:59:59Z');
            const mockStartTimestamp = {
                toDate: () => startDate,
                seconds: Math.floor(startDate.getTime() / 1000),
                nanoseconds: 0,
            } as Timestamp;

            const mockEndTimestamp = {
                toDate: () => endDate,
                seconds: Math.floor(endDate.getTime() / 1000),
                nanoseconds: 0,
            } as Timestamp;

            const weeklyReport: WeeklyReport = {
                termStartDate: mockStartTimestamp,
                termEndDate: mockEndTimestamp,
                totalAmount: 25000,
                totalCount: 15,
                documentIdList: ['daily1', 'daily2'],
                lastUpdated: mockFieldValue,
                lastUpdatedBy: 'system',
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
            };

            const title = 'ウィークリーレポート';
            const alertLevel = 2;
            const additionalInfo = 'アラート情報';

            mockDateUtil.formatDateRange.mockReturnValue('2025/05/26 - 2025/06/01');

            // Act
            const result = ReportNotificationMapper.toWeeklyNotification(
                weeklyReport,
                title,
                alertLevel,
                additionalInfo
            );

            // Assert
            expect(result).toEqual({
                title: 'ウィークリーレポート',
                period: '2025/05/26 - 2025/06/01',
                totalAmount: 25000,
                totalCount: 15,
                alertLevel: 2,
                additionalInfo: 'アラート情報',
            });

            expect(mockDateUtil.formatDateRange).toHaveBeenCalledWith(
                startDate,
                endDate,
                'yyyy/MM/dd'
            );
        });

        it('alertLevelとadditionalInfoが省略された場合もデフォルト値で正しく変換すること', () => {
            // Arrange
            const startDate = new Date('2025-05-19T00:00:00Z');
            const endDate = new Date('2025-05-25T23:59:59Z');
            const mockStartTimestamp = {
                toDate: () => startDate,
            } as Timestamp;

            const mockEndTimestamp = {
                toDate: () => endDate,
            } as Timestamp;

            const weeklyReport: WeeklyReport = {
                termStartDate: mockStartTimestamp,
                termEndDate: mockEndTimestamp,
                totalAmount: 12000,
                totalCount: 8,
                documentIdList: ['daily1'],
                lastUpdated: mockFieldValue,
                lastUpdatedBy: 'system',
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
            };

            mockDateUtil.formatDateRange.mockReturnValue('2025/05/19 - 2025/05/25');

            // Act
            const result = ReportNotificationMapper.toWeeklyNotification(weeklyReport, '週次');

            // Assert
            expect(result).toEqual({
                title: '週次',
                period: '2025/05/19 - 2025/05/25',
                totalAmount: 12000,
                totalCount: 8,
                alertLevel: 0,
                additionalInfo: undefined,
            });
        });
    });

    describe('toMonthlyNotification', () => {
        it('MonthlyReportエンティティを通知用DTOに正しく変換すること', () => {
            // Arrange
            const startDate = new Date('2025-05-01T00:00:00Z');
            const endDate = new Date('2025-05-31T23:59:59Z');
            const mockStartTimestamp = {
                toDate: () => startDate,
            } as Timestamp;

            const mockEndTimestamp = {
                toDate: () => endDate,
            } as Timestamp;

            const monthlyReport: MonthlyReport = {
                monthStartDate: mockStartTimestamp,
                monthEndDate: mockEndTimestamp,
                totalAmount: 80000,
                totalCount: 45,
                documentIdList: ['weekly1', 'weekly2', 'weekly3', 'weekly4'],
                lastUpdated: mockFieldValue,
                lastUpdatedBy: 'system',
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
            };

            const title = 'マンスリーレポート';
            const alertLevel = 3;
            const additionalInfo = '月間アラート';

            mockDateUtil.formatDateRange.mockReturnValue('2025/05/01 - 2025/05/31');

            // Act
            const result = ReportNotificationMapper.toMonthlyNotification(
                monthlyReport,
                title,
                alertLevel,
                additionalInfo
            );

            // Assert
            expect(result).toEqual({
                title: 'マンスリーレポート',
                period: '2025/05/01 - 2025/05/31',
                totalAmount: 80000,
                totalCount: 45,
                alertLevel: 3,
                additionalInfo: '月間アラート',
            });
        });
    });

    describe('toWeeklyAlertNotification', () => {
        it('週次アラート通知用DTOを正しく作成すること', () => {
            // Arrange
            const startDate = new Date('2025-05-26T00:00:00Z');
            const endDate = new Date('2025-06-01T23:59:59Z');
            const mockStartTimestamp = {
                toDate: () => startDate,
            } as Timestamp;

            const mockEndTimestamp = {
                toDate: () => endDate,
            } as Timestamp;

            const weeklyReport: WeeklyReport = {
                termStartDate: mockStartTimestamp,
                termEndDate: mockEndTimestamp,
                totalAmount: 35000,
                totalCount: 20,
                documentIdList: ['daily1', 'daily2'],
                lastUpdated: mockFieldValue,
                lastUpdatedBy: 'system',
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
            };

            mockDateUtil.formatDateRange.mockReturnValue('2025/05/26 - 2025/06/01');

            // Act
            const result = ReportNotificationMapper.toWeeklyAlertNotification(
                weeklyReport,
                2,
                '2025',
                '6',
                1,
                30000
            );

            // Assert
            expect(result).toEqual({
                title: '🚨 週次支出アラート (レベル2) - 2025年6月 第1週',
                period: '2025/05/26 - 2025/06/01',
                totalAmount: 35000,
                totalCount: 20,
                alertLevel: 2,
                additionalInfo: 'しきい値 30,000円 を超過しました',
            });
        });
    });

    describe('toMonthlyAlertNotification', () => {
        it('月次アラート通知用DTOを正しく作成すること', () => {
            // Arrange
            const startDate = new Date('2025-05-01T00:00:00Z');
            const endDate = new Date('2025-05-31T23:59:59Z');
            const mockStartTimestamp = {
                toDate: () => startDate,
            } as Timestamp;

            const mockEndTimestamp = {
                toDate: () => endDate,
            } as Timestamp;

            const monthlyReport: MonthlyReport = {
                monthStartDate: mockStartTimestamp,
                monthEndDate: mockEndTimestamp,
                totalAmount: 120000,
                totalCount: 60,
                documentIdList: ['weekly1', 'weekly2', 'weekly3', 'weekly4'],
                lastUpdated: mockFieldValue,
                lastUpdatedBy: 'system',
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
            };

            mockDateUtil.formatDateRange.mockReturnValue('2025/05/01 - 2025/05/31');

            // Act
            const result = ReportNotificationMapper.toMonthlyAlertNotification(
                monthlyReport,
                3,
                '2025',
                '5',
                100000
            );

            // Assert
            expect(result).toEqual({
                title: '🚨 月次支出アラート (レベル3) - 2025年5月',
                period: '2025/05/01 - 2025/05/31',
                totalAmount: 120000,
                totalCount: 60,
                alertLevel: 3,
                additionalInfo: 'しきい値 100,000円 を超過しました',
            });
        });
    });

    describe('toDailyScheduledNotification', () => {
        it('日次定期通知用DTOを正しく作成すること', () => {
            // Arrange
            const testDate = new Date('2025-05-30T00:00:00Z');
            const mockTimestamp = {
                toDate: () => testDate,
            } as Timestamp;

            const dailyReport: DailyReport = {
                date: mockTimestamp,
                totalAmount: 4500,
                totalCount: 2,
                documentIdList: ['id1', 'id2'],
                lastUpdated: mockFieldValue,
                lastUpdatedBy: 'system',
                hasNotified: false,
            };

            mockDateUtil.formatDate.mockReturnValue('2025/05/30');

            // Act
            const result = ReportNotificationMapper.toDailyScheduledNotification(
                dailyReport,
                '2025',
                '5',
                '30'
            );

            // Assert
            expect(result).toEqual({
                title: '📊 2025年5月30日 デイリーレポート',
                date: '2025/05/30',
                totalAmount: 4500,
                totalCount: 2,
                additionalInfo: undefined,
            });
        });
    });

    describe('toWeeklyScheduledNotification', () => {
        it('週次定期通知用DTOを正しく作成すること', () => {
            // Arrange
            const startDate = new Date('2025-05-26T00:00:00Z');
            const endDate = new Date('2025-06-01T23:59:59Z');
            const mockStartTimestamp = {
                toDate: () => startDate,
            } as Timestamp;

            const mockEndTimestamp = {
                toDate: () => endDate,
            } as Timestamp;

            const weeklyReport: WeeklyReport = {
                termStartDate: mockStartTimestamp,
                termEndDate: mockEndTimestamp,
                totalAmount: 18000,
                totalCount: 12,
                documentIdList: ['daily1', 'daily2'],
                lastUpdated: mockFieldValue,
                lastUpdatedBy: 'system',
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
            };

            mockDateUtil.formatDateRange.mockReturnValue('2025/05/26 - 2025/06/01');

            // Act
            const result = ReportNotificationMapper.toWeeklyScheduledNotification(
                weeklyReport,
                '2025',
                '6',
                1
            );

            // Assert
            expect(result).toEqual({
                title: '📊 2025年6月 第1週 ウィークリーレポート',
                period: '2025/05/26 - 2025/06/01',
                totalAmount: 18000,
                totalCount: 12,
                alertLevel: 0,
                additionalInfo: undefined,
            });
        });
    });

    describe('toMonthlyScheduledNotification', () => {
        it('月次定期通知用DTOを正しく作成すること', () => {
            // Arrange
            const startDate = new Date('2025-05-01T00:00:00Z');
            const endDate = new Date('2025-05-31T23:59:59Z');
            const mockStartTimestamp = {
                toDate: () => startDate,
            } as Timestamp;

            const mockEndTimestamp = {
                toDate: () => endDate,
            } as Timestamp;

            const monthlyReport: MonthlyReport = {
                monthStartDate: mockStartTimestamp,
                monthEndDate: mockEndTimestamp,
                totalAmount: 95000,
                totalCount: 50,
                documentIdList: ['weekly1', 'weekly2', 'weekly3', 'weekly4'],
                lastUpdated: mockFieldValue,
                lastUpdatedBy: 'system',
                hasNotifiedLevel1: false,
                hasNotifiedLevel2: false,
                hasNotifiedLevel3: false,
            };

            mockDateUtil.formatDateRange.mockReturnValue('2025/05/01 - 2025/05/31');

            // Act
            const result = ReportNotificationMapper.toMonthlyScheduledNotification(
                monthlyReport,
                '2025',
                '5'
            );

            // Assert
            expect(result).toEqual({
                title: '📊 2025年5月 マンスリーレポート',
                period: '2025/05/01 - 2025/05/31',
                totalAmount: 95000,
                totalCount: 50,
                alertLevel: 0,
                additionalInfo: undefined,
            });
        });
    });
});
