import { CardUsageMapper } from '../../../../shared/infrastructure/mappers/CardUsageMapper';
import { CardUsage } from '../../../../shared/domain/entities/CardUsage';
import { CardUsageNotificationDTO } from '../../../../shared/domain/dto/CardUsageNotificationDTO';
import { Timestamp } from 'firebase-admin/firestore';

// firebase-adminのTimestampをモック
jest.mock('firebase-admin/firestore', () => ({
    Timestamp: {
        fromDate: jest.fn().mockImplementation((date: Date) => ({
            toDate: () => date,
            seconds: Math.floor(date.getTime() / 1000),
            nanoseconds: (date.getTime() % 1000) * 1000000,
        })),
        now: jest.fn().mockImplementation(() => ({
            toDate: () => new Date('2025-05-30T10:00:00Z'),
            seconds: Math.floor(new Date('2025-05-30T10:00:00Z').getTime() / 1000),
            nanoseconds: 0,
        })),
    },
}));

describe('CardUsageMapper', () => {
    describe('toNotification', () => {
        it('CardUsageエンティティを通知用DTOに正しく変換すること', () => {
            // Arrange
            const testDate = new Date('2025-05-30T09:30:00Z');
            const createdDate = new Date('2025-05-30T10:00:00Z');

            const mockTimestamp = {
                toDate: () => testDate,
                seconds: Math.floor(testDate.getTime() / 1000),
                nanoseconds: 0,
            } as Timestamp;

            const mockCreatedTimestamp = {
                toDate: () => createdDate,
                seconds: Math.floor(createdDate.getTime() / 1000),
                nanoseconds: 0,
            } as Timestamp;

            const cardUsage: CardUsage = {
                card_name: 'テストカード',
                datetime_of_use: mockTimestamp,
                amount: 1500,
                where_to_use: 'テストストア',
                memo: 'テストメモ',
                is_active: true,
                created_at: mockCreatedTimestamp,
            };

            // Act
            const result = CardUsageMapper.toNotification(cardUsage);

            // Assert
            expect(result).toEqual({
                card_name: 'テストカード',
                amount: 1500,
                where_to_use: 'テストストア',
                memo: 'テストメモ',
                is_active: true,
                datetime_of_use: '2025-05-30T09:30:00.000Z',
            });

            // created_atが除外されていることを確認
            expect(result).not.toHaveProperty('created_at');
        });

        it('オプショナルフィールドがundefinedの場合も正しく変換すること', () => {
            // Arrange
            const testDate = new Date('2025-05-29T15:45:00Z');
            const createdDate = new Date('2025-05-30T10:00:00Z');

            const mockTimestamp = {
                toDate: () => testDate,
                seconds: Math.floor(testDate.getTime() / 1000),
                nanoseconds: 0,
            } as Timestamp;

            const mockCreatedTimestamp = {
                toDate: () => createdDate,
                seconds: Math.floor(createdDate.getTime() / 1000),
                nanoseconds: 0,
            } as Timestamp;

            const cardUsage: CardUsage = {
                card_name: '楽天カード',
                datetime_of_use: mockTimestamp,
                amount: 3000,
                where_to_use: 'コンビニエンスストア',
                created_at: mockCreatedTimestamp,
                // memo と is_active は未定義
            };

            // Act
            const result = CardUsageMapper.toNotification(cardUsage);

            // Assert
            expect(result).toEqual({
                card_name: '楽天カード',
                amount: 3000,
                where_to_use: 'コンビニエンスストア',
                datetime_of_use: '2025-05-29T15:45:00.000Z',
            });

            // オプショナルフィールドが除外されていることを確認
            expect(result).not.toHaveProperty('memo');
            expect(result).not.toHaveProperty('is_active');
            expect(result).not.toHaveProperty('created_at');
        });

        it('is_activeがfalseの場合も正しく変換すること', () => {
            // Arrange
            const testDate = new Date('2025-05-28T20:15:30Z');
            const createdDate = new Date('2025-05-30T10:00:00Z');

            const mockTimestamp = {
                toDate: () => testDate,
                seconds: Math.floor(testDate.getTime() / 1000),
                nanoseconds: 0,
            } as Timestamp;

            const mockCreatedTimestamp = {
                toDate: () => createdDate,
                seconds: Math.floor(createdDate.getTime() / 1000),
                nanoseconds: 0,
            } as Timestamp;

            const cardUsage: CardUsage = {
                card_name: 'デビットカード',
                datetime_of_use: mockTimestamp,
                amount: 500,
                where_to_use: 'カフェ',
                memo: '削除予定',
                is_active: false,
                created_at: mockCreatedTimestamp,
            };

            // Act
            const result = CardUsageMapper.toNotification(cardUsage);

            // Assert
            expect(result).toEqual({
                card_name: 'デビットカード',
                amount: 500,
                where_to_use: 'カフェ',
                memo: '削除予定',
                is_active: false,
                datetime_of_use: '2025-05-28T20:15:30.000Z',
            });
        });
    });

    describe('fromNotification', () => {
        beforeEach(() => {
            // 各テストの前にモックをクリア
            jest.clearAllMocks();
        });

        it('通知用DTOをCardUsageエンティティに正しく変換すること', () => {
            // Arrange
            const notificationDTO: CardUsageNotificationDTO = {
                card_name: 'Visaカード',
                amount: 2500,
                where_to_use: 'オンラインショップ',
                memo: 'ネット購入',
                is_active: true,
                datetime_of_use: '2025-05-30T14:20:00.000Z',
            };

            // Act
            const result = CardUsageMapper.fromNotification(notificationDTO);

            // Assert
            expect(result.card_name).toBe('Visaカード');
            expect(result.amount).toBe(2500);
            expect(result.where_to_use).toBe('オンラインショップ');
            expect(result.memo).toBe('ネット購入');
            expect(result.is_active).toBe(true);

            // Timestamp.fromDateが呼ばれていることを確認
            expect(Timestamp.fromDate).toHaveBeenCalledWith(new Date('2025-05-30T14:20:00.000Z'));

            // Timestamp.nowが呼ばれていることを確認
            expect(Timestamp.now).toHaveBeenCalled();

            // datetime_of_useとcreated_atがTimestampオブジェクトであることを確認
            expect(result.datetime_of_use).toHaveProperty('toDate');
            expect(result.created_at).toHaveProperty('toDate');
        });

        it('オプショナルフィールドがないDTOも正しく変換すること', () => {
            // Arrange
            const notificationDTO: CardUsageNotificationDTO = {
                card_name: 'マスターカード',
                amount: 1200,
                where_to_use: 'レストラン',
                datetime_of_use: '2025-05-29T18:30:00.000Z',
                // memo と is_active は未定義
            };

            // Act
            const result = CardUsageMapper.fromNotification(notificationDTO);

            // Assert
            expect(result.card_name).toBe('マスターカード');
            expect(result.amount).toBe(1200);
            expect(result.where_to_use).toBe('レストラン');
            expect(result.memo).toBeUndefined();
            expect(result.is_active).toBeUndefined();

            // Timestampの変換が正しく行われていることを確認
            expect(Timestamp.fromDate).toHaveBeenCalledWith(new Date('2025-05-29T18:30:00.000Z'));
            expect(Timestamp.now).toHaveBeenCalled();
        });

        it('is_activeがfalseのDTOも正しく変換すること', () => {
            // Arrange
            const notificationDTO: CardUsageNotificationDTO = {
                card_name: 'アメックス',
                amount: 8000,
                where_to_use: 'デパート',
                memo: '高額購入',
                is_active: false,
                datetime_of_use: '2025-05-27T11:45:00.000Z',
            };

            // Act
            const result = CardUsageMapper.fromNotification(notificationDTO);

            // Assert
            expect(result.card_name).toBe('アメックス');
            expect(result.amount).toBe(8000);
            expect(result.where_to_use).toBe('デパート');
            expect(result.memo).toBe('高額購入');
            expect(result.is_active).toBe(false);

            // Timestampの変換が正しく行われていることを確認
            expect(Timestamp.fromDate).toHaveBeenCalledWith(new Date('2025-05-27T11:45:00.000Z'));
            expect(Timestamp.now).toHaveBeenCalled();
        });

        it('不正な日付文字列でもTimestamp.fromDateに渡されること', () => {
            // Arrange
            const notificationDTO: CardUsageNotificationDTO = {
                card_name: 'テストカード',
                amount: 1000,
                where_to_use: 'テスト場所',
                datetime_of_use: 'invalid-date-string',
            };

            // Act
            const result = CardUsageMapper.fromNotification(notificationDTO);

            // Assert
            // Timestamp.fromDateが呼ばれていることを確認
            expect(Timestamp.fromDate).toHaveBeenCalledTimes(1);

            // 最後の呼び出しの引数がInvalid Dateであることを確認
            const lastCall = (Timestamp.fromDate as jest.Mock).mock.calls[0];
            const passedDate = lastCall[0];
            expect(passedDate instanceof Date).toBe(true);
            expect(isNaN(passedDate.getTime())).toBe(true); // Invalid Dateの場合はNaN

            expect(result.card_name).toBe('テストカード');
            expect(result.amount).toBe(1000);
            expect(result.where_to_use).toBe('テスト場所');
        });
    });

    describe('相互変換テスト', () => {
        beforeEach(() => {
            // 各テストの前にモックをクリア
            jest.clearAllMocks();
        });

        it('toNotification → fromNotificationの往復変換で主要データが保持されること', () => {
            // Arrange
            const originalDate = new Date('2025-05-30T12:00:00Z');
            const createdDate = new Date('2025-05-30T10:00:00Z');

            const mockTimestamp = {
                toDate: () => originalDate,
                seconds: Math.floor(originalDate.getTime() / 1000),
                nanoseconds: 0,
            } as Timestamp;

            const mockCreatedTimestamp = {
                toDate: () => createdDate,
                seconds: Math.floor(createdDate.getTime() / 1000),
                nanoseconds: 0,
            } as Timestamp;

            const originalCardUsage: CardUsage = {
                card_name: '往復テストカード',
                datetime_of_use: mockTimestamp,
                amount: 5000,
                where_to_use: 'テストショップ',
                memo: '往復変換テスト',
                is_active: true,
                created_at: mockCreatedTimestamp,
            };

            // Act
            const dto = CardUsageMapper.toNotification(originalCardUsage);
            const convertedCardUsage = CardUsageMapper.fromNotification(dto);

            // Assert
            expect(convertedCardUsage.card_name).toBe(originalCardUsage.card_name);
            expect(convertedCardUsage.amount).toBe(originalCardUsage.amount);
            expect(convertedCardUsage.where_to_use).toBe(originalCardUsage.where_to_use);
            expect(convertedCardUsage.memo).toBe(originalCardUsage.memo);
            expect(convertedCardUsage.is_active).toBe(originalCardUsage.is_active);

            // datetime_of_useは変換されるがデータは保持される
            expect(Timestamp.fromDate).toHaveBeenCalledWith(originalDate);

            // created_atは新しく生成される
            expect(Timestamp.now).toHaveBeenCalled();
        });
    });
});
