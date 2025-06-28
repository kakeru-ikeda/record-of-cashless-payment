import { CardUsageFactory } from '../../../../../shared/domain/factories/CardUsageFactory';
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

describe('CardUsageFactory', () => {
    beforeEach(() => {
        // 各テストの前にモックをクリア
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('必須パラメータでCardUsageエンティティを作成できること', () => {
            // Arrange
            const card_name = 'テストカード';
            const datetime_of_use = '2025-05-30T14:30:00Z';
            const amount = 1500;
            const where_to_use = 'テストストア';

            // Act
            const result = CardUsageFactory.create(
                card_name,
                datetime_of_use,
                amount,
                where_to_use
            );

            // Assert
            expect(result.card_name).toBe(card_name);
            expect(result.amount).toBe(amount);
            expect(result.where_to_use).toBe(where_to_use);
            expect(result.memo).toBeUndefined();
            expect(result.is_active).toBe(true); // デフォルト値

            // Timestampの変換が正しく行われていることを確認
            expect(Timestamp.fromDate).toHaveBeenCalledWith(new Date(datetime_of_use));
            expect(Timestamp.fromDate).toHaveBeenCalledWith(expect.any(Date)); // created_at用

            // Timestampオブジェクトが正しく設定されていることを確認
            expect(result.datetime_of_use).toHaveProperty('toDate');
            expect(result.created_at).toHaveProperty('toDate');
        });

        it('全パラメータでCardUsageエンティティを作成できること', () => {
            // Arrange
            const card_name = '楽天カード';
            const datetime_of_use = '2025-05-29T20:15:30Z';
            const amount = 3000;
            const where_to_use = 'コンビニエンスストア';
            const memo = 'テスト購入';
            const is_active = false;

            // Act
            const result = CardUsageFactory.create(
                card_name,
                datetime_of_use,
                amount,
                where_to_use,
                memo,
                is_active
            );

            // Assert
            expect(result.card_name).toBe(card_name);
            expect(result.amount).toBe(amount);
            expect(result.where_to_use).toBe(where_to_use);
            expect(result.memo).toBe(memo);
            expect(result.is_active).toBe(is_active);

            // Timestampの変換が正しく行われていることを確認
            expect(Timestamp.fromDate).toHaveBeenCalledWith(new Date(datetime_of_use));
            expect(Timestamp.fromDate).toHaveBeenCalledWith(expect.any(Date)); // created_at用
        });

        it('memoがundefinedの場合も正しく作成できること', () => {
            // Arrange
            const card_name = 'Visaカード';
            const datetime_of_use = '2025-05-28T12:00:00Z';
            const amount = 2500;
            const where_to_use = 'レストラン';
            const memo = undefined;
            const is_active = true;

            // Act
            const result = CardUsageFactory.create(
                card_name,
                datetime_of_use,
                amount,
                where_to_use,
                memo,
                is_active
            );

            // Assert
            expect(result.card_name).toBe(card_name);
            expect(result.amount).toBe(amount);
            expect(result.where_to_use).toBe(where_to_use);
            expect(result.memo).toBeUndefined();
            expect(result.is_active).toBe(is_active);
        });

        it('is_activeのデフォルト値がtrueであること', () => {
            // Arrange
            const card_name = 'マスターカード';
            const datetime_of_use = '2025-05-27T18:45:00Z';
            const amount = 800;
            const where_to_use = 'カフェ';
            const memo = 'コーヒー代';

            // Act
            const result = CardUsageFactory.create(
                card_name,
                datetime_of_use,
                amount,
                where_to_use,
                memo
                // is_activeを指定しない
            );

            // Assert
            expect(result.is_active).toBe(true);
        });

        it('不正な日付文字列でもTimestamp.fromDateに渡されること', () => {
            // Arrange
            const card_name = 'テストカード';
            const datetime_of_use = 'invalid-date-string';
            const amount = 1000;
            const where_to_use = 'テスト場所';

            // Act
            const result = CardUsageFactory.create(
                card_name,
                datetime_of_use,
                amount,
                where_to_use
            );

            // Assert
            // Timestamp.fromDateが2回呼ばれることを確認（datetime_of_use用とcreated_at用）
            expect(Timestamp.fromDate).toHaveBeenCalledTimes(2);

            // モックの呼び出し引数を取得
            const calls = (Timestamp.fromDate as jest.MockedFunction<typeof Timestamp.fromDate>).mock.calls;

            // 最初の呼び出しが不正な日付オブジェクトであることを確認（NaNを含む）
            expect(calls[0][0]).toBeInstanceOf(Date);
            expect(isNaN(calls[0][0].getTime())).toBe(true); // 不正な日付はNaNになる

            // 2回目の呼び出しが有効な現在時刻であることを確認
            expect(calls[1][0]).toBeInstanceOf(Date);
            expect(isNaN(calls[1][0].getTime())).toBe(false); // 有効な日付

            expect(result.card_name).toBe(card_name);
            expect(result.amount).toBe(amount);
            expect(result.where_to_use).toBe(where_to_use);
        });

        it('金額が0の場合も正しく作成できること', () => {
            // Arrange
            const card_name = 'デビットカード';
            const datetime_of_use = '2025-05-30T10:00:00Z';
            const amount = 0;
            const where_to_use = 'ポイント利用';

            // Act
            const result = CardUsageFactory.create(
                card_name,
                datetime_of_use,
                amount,
                where_to_use
            );

            // Assert
            expect(result.amount).toBe(0);
            expect(result.card_name).toBe(card_name);
            expect(result.where_to_use).toBe(where_to_use);
        });

        it('負の金額でも作成できること', () => {
            // Arrange
            const card_name = 'クレジットカード';
            const datetime_of_use = '2025-05-30T11:00:00Z';
            const amount = -500;
            const where_to_use = '返金処理';

            // Act
            const result = CardUsageFactory.create(
                card_name,
                datetime_of_use,
                amount,
                where_to_use
            );

            // Assert
            expect(result.amount).toBe(-500);
            expect(result.card_name).toBe(card_name);
            expect(result.where_to_use).toBe(where_to_use);
        });
    });

    describe('reconstruct', () => {
        it('必須フィールドのみでCardUsageエンティティを復元できること', () => {
            // Arrange
            const testDate = new Date('2025-05-30T14:30:00Z');
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

            const data = {
                card_name: '復元テストカード',
                datetime_of_use: mockTimestamp,
                amount: 2000,
                where_to_use: '復元テストストア',
                created_at: mockCreatedTimestamp,
            };

            // Act
            const result = CardUsageFactory.reconstruct(data);

            // Assert
            expect(result.card_name).toBe(data.card_name);
            expect(result.datetime_of_use).toBe(data.datetime_of_use);
            expect(result.amount).toBe(data.amount);
            expect(result.where_to_use).toBe(data.where_to_use);
            expect(result.created_at).toBe(data.created_at);
            expect(result.memo).toBeUndefined();
            expect(result.is_active).toBe(true); // デフォルト値
        });

        it('全フィールドでCardUsageエンティティを復元できること', () => {
            // Arrange
            const testDate = new Date('2025-05-29T16:20:00Z');
            const createdDate = new Date('2025-05-29T10:00:00Z');

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

            const data = {
                card_name: '完全復元テストカード',
                datetime_of_use: mockTimestamp,
                amount: 5000,
                where_to_use: '完全復元テストストア',
                memo: '復元テストメモ',
                is_active: false,
                created_at: mockCreatedTimestamp,
            };

            // Act
            const result = CardUsageFactory.reconstruct(data);

            // Assert
            expect(result.card_name).toBe(data.card_name);
            expect(result.datetime_of_use).toBe(data.datetime_of_use);
            expect(result.amount).toBe(data.amount);
            expect(result.where_to_use).toBe(data.where_to_use);
            expect(result.memo).toBe(data.memo);
            expect(result.is_active).toBe(data.is_active);
            expect(result.created_at).toBe(data.created_at);
        });

        it('is_activeがundefinedの場合はtrueになること', () => {
            // Arrange
            const testDate = new Date('2025-05-28T09:15:00Z');
            const createdDate = new Date('2025-05-28T08:00:00Z');

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

            const data = {
                card_name: 'is_active未定義テストカード',
                datetime_of_use: mockTimestamp,
                amount: 1200,
                where_to_use: 'テストストア',
                memo: 'is_activeテスト',
                // is_activeは未定義
                created_at: mockCreatedTimestamp,
            };

            // Act
            const result = CardUsageFactory.reconstruct(data);

            // Assert
            expect(result.is_active).toBe(true);
            expect(result.memo).toBe(data.memo);
        });

        it('is_activeがfalseの場合はfalseが保持されること', () => {
            // Arrange
            const testDate = new Date('2025-05-27T13:30:00Z');
            const createdDate = new Date('2025-05-27T12:00:00Z');

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

            const data = {
                card_name: 'is_active=falseテストカード',
                datetime_of_use: mockTimestamp,
                amount: 800,
                where_to_use: 'テストストア',
                memo: 'falseテスト',
                is_active: false,
                created_at: mockCreatedTimestamp,
            };

            // Act
            const result = CardUsageFactory.reconstruct(data);

            // Assert
            expect(result.is_active).toBe(false);
        });

        it('memoがundefinedの場合はundefinedが保持されること', () => {
            // Arrange
            const testDate = new Date('2025-05-26T07:45:00Z');
            const createdDate = new Date('2025-05-26T07:00:00Z');

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

            const data = {
                card_name: 'memo未定義テストカード',
                datetime_of_use: mockTimestamp,
                amount: 600,
                where_to_use: 'テストストア',
                // memoは未定義
                is_active: true,
                created_at: mockCreatedTimestamp,
            };

            // Act
            const result = CardUsageFactory.reconstruct(data);

            // Assert
            expect(result.memo).toBeUndefined();
            expect(result.is_active).toBe(true);
        });

        it('Timestampオブジェクトがそのまま保持されること', () => {
            // Arrange
            const testDate = new Date('2025-05-25T19:00:00Z');
            const createdDate = new Date('2025-05-25T18:00:00Z');

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

            const data = {
                card_name: 'Timestampテストカード',
                datetime_of_use: mockTimestamp,
                amount: 1800,
                where_to_use: 'テストストア',
                created_at: mockCreatedTimestamp,
            };

            // Act
            const result = CardUsageFactory.reconstruct(data);

            // Assert
            // Timestampオブジェクトがそのまま参照されていることを確認
            expect(result.datetime_of_use).toBe(mockTimestamp);
            expect(result.created_at).toBe(mockCreatedTimestamp);

            // Timestamp.fromDateは呼ばれていないことを確認（復元時は既存のTimestampを使用）
            expect(Timestamp.fromDate).not.toHaveBeenCalled();
        });
    });

    describe('createとreconstructの組み合わせテスト', () => {
        it('createで作成したエンティティをreconstructで復元できること', () => {
            // Arrange
            const card_name = '組み合わせテストカード';
            const datetime_of_use = '2025-05-30T15:30:00Z';
            const amount = 4500;
            const where_to_use = '組み合わせテストストア';
            const memo = '組み合わせテスト';
            const is_active = false;

            // Act
            const createdEntity = CardUsageFactory.create(
                card_name,
                datetime_of_use,
                amount,
                where_to_use,
                memo,
                is_active
            );

            // createしたエンティティの構造をreconstructに渡す
            const reconstructedEntity = CardUsageFactory.reconstruct({
                card_name: createdEntity.card_name,
                datetime_of_use: createdEntity.datetime_of_use,
                amount: createdEntity.amount,
                where_to_use: createdEntity.where_to_use,
                memo: createdEntity.memo,
                is_active: createdEntity.is_active,
                created_at: createdEntity.created_at,
            });

            // Assert
            expect(reconstructedEntity.card_name).toBe(createdEntity.card_name);
            expect(reconstructedEntity.datetime_of_use).toBe(createdEntity.datetime_of_use);
            expect(reconstructedEntity.amount).toBe(createdEntity.amount);
            expect(reconstructedEntity.where_to_use).toBe(createdEntity.where_to_use);
            expect(reconstructedEntity.memo).toBe(createdEntity.memo);
            expect(reconstructedEntity.is_active).toBe(createdEntity.is_active);
            expect(reconstructedEntity.created_at).toBe(createdEntity.created_at);
        });
    });
});
