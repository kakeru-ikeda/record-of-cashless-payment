import { FirestoreCardUsageUseCase } from '../../../../../src/usecases/database/FirestoreCardUsageUseCase';
import { ICardUsageCrudRepository } from '../../../../../src/domain/interfaces/infrastructure/database/repositories/ICardUsageCrudRepository';
import { DiscordNotifier } from '../../../../../shared/infrastructure/discord/DiscordNotifier';
import { CardUsageMapper } from '../../../../../shared/infrastructure/mappers/CardUsageMapper';
import { AppError, ErrorType } from '../../../../../shared/errors/AppError';
import { Timestamp } from 'firebase-admin/firestore';
import { CardUsage } from '../../../../../shared/domain/entities/CardUsage';

// 依存関係をモック
jest.mock('../../../../../shared/infrastructure/discord/DiscordNotifier');
jest.mock('../../../../../shared/infrastructure/mappers/CardUsageMapper');

// firebase-adminのTimestampをモック
jest.mock('firebase-admin/firestore', () => ({
    Timestamp: {
        fromDate: jest.fn().mockImplementation((date: Date) => ({
            toDate: () => date,
            seconds: Math.floor(date.getTime() / 1000),
            nanoseconds: (date.getTime() % 1000) * 1000000,
            valueOf: () => date.toISOString(),
            toMillis: () => date.getTime(),
            isEqual: jest.fn().mockReturnValue(false)
        })),
        fromMillis: jest.fn().mockImplementation((millis: number) => {
            const date = new Date(millis);
            return {
                toDate: () => date,
                seconds: Math.floor(millis / 1000),
                nanoseconds: (millis % 1000) * 1000000,
                valueOf: () => date.toISOString(),
                toMillis: () => millis,
                isEqual: jest.fn().mockReturnValue(false)
            };
        }),
        now: jest.fn().mockImplementation(() => ({
            toDate: () => new Date('2023-12-01T10:00:00Z'),
            seconds: Math.floor(new Date('2023-12-01T10:00:00Z').getTime() / 1000),
            nanoseconds: 0,
            valueOf: () => new Date('2023-12-01T10:00:00Z').toISOString(),
            toMillis: () => new Date('2023-12-01T10:00:00Z').getTime(),
            isEqual: jest.fn().mockReturnValue(false)
        })),
    }
}));

describe('FirestoreCardUsageUseCase', () => {
    let firestoreCardUsageUseCase: FirestoreCardUsageUseCase;
    let mockRepository: jest.Mocked<ICardUsageCrudRepository>;
    let mockDiscordNotifier: jest.Mocked<DiscordNotifier>;

    beforeEach(() => {
        // モックのセットアップ
        mockRepository = {
            save: jest.fn(),
            getByTimestamp: jest.fn(),
            getById: jest.fn(),
            getByYearMonth: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        };

        mockDiscordNotifier = {
            notifyCardUsage: jest.fn().mockResolvedValue(true)
        } as unknown as jest.Mocked<DiscordNotifier>;

        // CardUsageMapperのモック
        (CardUsageMapper.toNotification as jest.Mock).mockImplementation((cardUsage: CardUsage) => ({
            card_name: cardUsage.card_name,
            amount: cardUsage.amount,
            where_to_use: cardUsage.where_to_use,
            memo: cardUsage.memo,
            is_active: cardUsage.is_active,
            datetime_of_use: cardUsage.datetime_of_use?.toDate ?
                cardUsage.datetime_of_use.toDate().toISOString() :
                new Date().toISOString()
        }));

        // ユースケースの作成
        firestoreCardUsageUseCase = new FirestoreCardUsageUseCase(mockRepository, mockDiscordNotifier);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getCardUsagesByYearMonth', () => {
        test('正常に年月でカード利用情報を取得できること', async () => {
            // Arrange
            const year = '2023';
            const month = '12';
            const mockUsages = [
                {
                    id: '1',
                    path: 'details/2023/12/term1/01/1',
                    card_name: 'テストカード',
                    amount: 1000,
                    datetime_of_use: {
                        toDate: () => new Date('2023-12-01T00:00:00Z'),
                        seconds: 1701388800,
                        nanoseconds: 0,
                        toMillis: () => 1701388800000,
                        valueOf: () => '2023-12-01T00:00:00.000Z',
                        isEqual: jest.fn().mockReturnValue(false)
                    },
                    where_to_use: 'テスト店舗',
                    memo: 'テストメモ',
                    is_active: true,
                    created_at: {
                        toDate: () => new Date('2023-12-01T00:00:00Z'),
                        seconds: 1701388800,
                        nanoseconds: 0,
                        toMillis: () => 1701388800000,
                        valueOf: () => '2023-12-01T00:00:00.000Z',
                        isEqual: jest.fn().mockReturnValue(false)
                    }
                }
            ];

            mockRepository.getByYearMonth.mockResolvedValue(mockUsages);

            // Act
            const result = await firestoreCardUsageUseCase.getCardUsagesByYearMonth(year, month);

            // Assert
            expect(mockRepository.getByYearMonth).toHaveBeenCalledWith(year, month);
            expect(result).toEqual(mockUsages);
        });

        test('年または月のパラメータが不足している場合、ValidationErrorをスローすること', async () => {
            // Act & Assert
            await expect(firestoreCardUsageUseCase.getCardUsagesByYearMonth('', '12'))
                .rejects.toThrow(new AppError('年と月のパラメータが必要です', ErrorType.VALIDATION));

            await expect(firestoreCardUsageUseCase.getCardUsagesByYearMonth('2023', ''))
                .rejects.toThrow(new AppError('年と月のパラメータが必要です', ErrorType.VALIDATION));

            await expect(firestoreCardUsageUseCase.getCardUsagesByYearMonth('', ''))
                .rejects.toThrow(new AppError('年と月のパラメータが必要です', ErrorType.VALIDATION));
        });
    });

    describe('getCardUsageById', () => {
        test('正常にIDでカード利用情報を取得できること', async () => {
            // Arrange
            const id = '123';
            const mockCardUsage = {
                id: '123',
                path: 'details/2023/12/term1/01/123',
                card_name: 'テストカード',
                amount: 1000,
                datetime_of_use: {
                    toDate: () => new Date('2023-12-01T00:00:00Z'),
                    seconds: 1701388800,
                    nanoseconds: 0,
                    toMillis: () => 1701388800000,
                    valueOf: () => '2023-12-01T00:00:00.000Z',
                    isEqual: jest.fn().mockReturnValue(false)
                },
                where_to_use: 'テスト店舗',
                memo: 'テストメモ',
                is_active: true,
                created_at: {
                    toDate: () => new Date('2023-12-01T00:00:00Z'),
                    seconds: 1701388800,
                    nanoseconds: 0,
                    toMillis: () => 1701388800000,
                    valueOf: () => '2023-12-01T00:00:00.000Z',
                    isEqual: jest.fn().mockReturnValue(false)
                }
            };

            mockRepository.getById.mockResolvedValue(mockCardUsage);

            // Act
            const result = await firestoreCardUsageUseCase.getCardUsageById(id);

            // Assert
            expect(mockRepository.getById).toHaveBeenCalledWith(id);
            expect(result).toEqual(mockCardUsage);
        });

        test('IDが不足している場合、ValidationErrorをスローすること', async () => {
            // Act & Assert
            await expect(firestoreCardUsageUseCase.getCardUsageById(''))
                .rejects.toThrow(new AppError('IDが必要です', ErrorType.VALIDATION));
        });

        test('カード利用情報が見つからない場合、NotFoundErrorをスローすること', async () => {
            // Arrange
            const id = '123';
            mockRepository.getById.mockResolvedValue(null);

            // Act & Assert
            await expect(firestoreCardUsageUseCase.getCardUsageById(id))
                .rejects.toThrow(new AppError('指定されたIDのカード利用情報が見つかりません', ErrorType.NOT_FOUND));
        });
    });

    describe('createCardUsage', () => {
        test('正常にカード利用情報を作成できること', async () => {
            // Arrange
            const cardUsageData = {
                card_name: 'テストカード',
                amount: 1000,
                datetime_of_use: '2023-12-01T10:00:00Z',
                where_to_use: 'テスト店舗',
                memo: 'テストメモ',
                is_active: true
            };

            const savedPath = 'details/2023/12/term1/01/123';
            mockRepository.save.mockResolvedValue(savedPath);

            // Act
            const result = await firestoreCardUsageUseCase.createCardUsage(cardUsageData);

            // Assert
            expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                card_name: 'テストカード',
                amount: 1000,
                where_to_use: 'テスト店舗',
                memo: 'テストメモ',
                is_active: true
            }));
            expect(mockDiscordNotifier.notifyCardUsage).toHaveBeenCalled();
            expect(CardUsageMapper.toNotification).toHaveBeenCalled();
            expect(result).toMatchObject({
                card_name: 'テストカード',
                amount: 1000,
                where_to_use: 'テスト店舗',
                memo: 'テストメモ',
                is_active: true,
                path: savedPath
            });
            expect(result.id).toBeDefined();
        });

        test('Timestampオブジェクト形式の日付でもカード利用情報を作成できること', async () => {
            // Arrange
            const cardUsageData = {
                card_name: 'テストカード',
                amount: 1000,
                datetime_of_use: {
                    seconds: 1701417600,
                    nanoseconds: 0
                },
                where_to_use: 'テスト店舗',
                memo: 'テストメモ'
            };

            const savedPath = 'details/2023/12/term1/01/123';
            mockRepository.save.mockResolvedValue(savedPath);

            // Act
            const result = await firestoreCardUsageUseCase.createCardUsage(cardUsageData);

            // Assert
            expect(mockRepository.save).toHaveBeenCalled();
            expect(result).toMatchObject({
                card_name: 'テストカード',
                amount: 1000,
                where_to_use: 'テスト店舗',
                memo: 'テストメモ',
                is_active: true, // デフォルト値
                path: savedPath
            });
        });

        test('デフォルト値が正しく設定されること', async () => {
            // Arrange
            const cardUsageData = {
                card_name: 'テストカード',
                amount: 1000,
                datetime_of_use: '2023-12-01T10:00:00Z'
                // where_to_use, memo, is_activeは未指定
            };

            const savedPath = 'details/2023/12/term1/01/123';
            mockRepository.save.mockResolvedValue(savedPath);

            // Act
            const result = await firestoreCardUsageUseCase.createCardUsage(cardUsageData);

            // Assert
            expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                where_to_use: '', // デフォルト値
                memo: '', // デフォルト値
                is_active: true // デフォルト値
            }));
            expect(result.where_to_use).toBe('');
            expect(result.memo).toBe('');
            expect(result.is_active).toBe(true);
        });

        test('必須フィールドが不足している場合、ValidationErrorをスローすること', async () => {
            // Arrange
            const incompleteData = {
                card_name: 'テストカード'
                // datetime_of_use, amountが不足
            };

            // Act & Assert
            await expect(firestoreCardUsageUseCase.createCardUsage(incompleteData))
                .rejects.toThrow(new AppError('必須フィールドが不足しています', ErrorType.VALIDATION));

            await expect(firestoreCardUsageUseCase.createCardUsage(null))
                .rejects.toThrow(new AppError('必須フィールドが不足しています', ErrorType.VALIDATION));
        });

        test('不正な日付形式の場合、ValidationErrorをスローすること', async () => {
            // Arrange
            const invalidDateData = {
                card_name: 'テストカード',
                amount: 1000,
                datetime_of_use: 'invalid-date-string'
            };

            // Act & Assert
            await expect(firestoreCardUsageUseCase.createCardUsage(invalidDateData))
                .rejects.toThrow(new AppError('日付形式が無効です', ErrorType.VALIDATION));
        });

        test('日付変換中にエラーが発生した場合、ValidationErrorをスローすること', async () => {
            // Arrange
            const errorData = {
                card_name: 'テストカード',
                amount: 1000,
                datetime_of_use: {} // 無効なオブジェクト
            };

            // Act & Assert
            await expect(firestoreCardUsageUseCase.createCardUsage(errorData))
                .rejects.toThrow(new AppError('日付形式が無効です', ErrorType.VALIDATION));
        });
    });

    describe('updateCardUsage', () => {
        test('正常にカード利用情報を更新できること', async () => {
            // Arrange
            const id = '123';
            const updateData = {
                amount: 2000,
                memo: '更新されたメモ',
                is_active: false
            };

            const updatedCardUsage = {
                id: '123',
                path: 'details/2023/12/term1/01/123',
                card_name: 'テストカード',
                amount: 2000,
                datetime_of_use: {
                    toDate: () => new Date('2023-12-01T00:00:00Z'),
                    seconds: 1701388800,
                    nanoseconds: 0,
                    toMillis: () => 1701388800000,
                    valueOf: () => '2023-12-01T00:00:00.000Z',
                    isEqual: jest.fn().mockReturnValue(false)
                },
                where_to_use: 'テスト店舗',
                memo: '更新されたメモ',
                is_active: false,
                created_at: {
                    toDate: () => new Date('2023-12-01T00:00:00Z'),
                    seconds: 1701388800,
                    nanoseconds: 0,
                    toMillis: () => 1701388800000,
                    valueOf: () => '2023-12-01T00:00:00.000Z',
                    isEqual: jest.fn().mockReturnValue(false)
                }
            };

            mockRepository.update.mockResolvedValue(updatedCardUsage);

            // Act
            const result = await firestoreCardUsageUseCase.updateCardUsage(id, updateData);

            // Assert
            expect(mockRepository.update).toHaveBeenCalledWith(id, {
                amount: 2000,
                memo: '更新されたメモ',
                is_active: false
            });
            expect(result).toEqual(updatedCardUsage);
        });

        test('部分的な更新データでも正しく処理されること', async () => {
            // Arrange
            const id = '123';
            const updateData = {
                card_name: '新しいカード名'
            };

            const updatedCardUsage = {
                id: '123',
                path: 'details/2023/12/term1/01/123',
                card_name: '新しいカード名',
                amount: 1000,
                datetime_of_use: {
                    toDate: () => new Date('2023-12-01T00:00:00Z'),
                    seconds: 1701388800,
                    nanoseconds: 0,
                    toMillis: () => 1701388800000,
                    valueOf: () => '2023-12-01T00:00:00.000Z',
                    isEqual: jest.fn().mockReturnValue(false)
                },
                where_to_use: 'テスト店舗',
                memo: 'テストメモ',
                is_active: true,
                created_at: {
                    toDate: () => new Date('2023-12-01T00:00:00Z'),
                    seconds: 1701388800,
                    nanoseconds: 0,
                    toMillis: () => 1701388800000,
                    valueOf: () => '2023-12-01T00:00:00.000Z',
                    isEqual: jest.fn().mockReturnValue(false)
                }
            };

            mockRepository.update.mockResolvedValue(updatedCardUsage);

            // Act
            const result = await firestoreCardUsageUseCase.updateCardUsage(id, updateData);

            // Assert
            expect(mockRepository.update).toHaveBeenCalledWith(id, {
                card_name: '新しいカード名'
            });
            expect(result).toEqual(updatedCardUsage);
        });

        test('IDが不足している場合、ValidationErrorをスローすること', async () => {
            // Arrange
            const updateData = { amount: 2000 };

            // Act & Assert
            await expect(firestoreCardUsageUseCase.updateCardUsage('', updateData))
                .rejects.toThrow(new AppError('IDが必要です', ErrorType.VALIDATION));
        });

        test('カード利用情報が見つからない場合、NotFoundErrorをスローすること', async () => {
            // Arrange
            const id = '123';
            const updateData = { amount: 2000 };
            mockRepository.update.mockResolvedValue(null);

            // Act & Assert
            await expect(firestoreCardUsageUseCase.updateCardUsage(id, updateData))
                .rejects.toThrow(new AppError('指定されたIDのカード利用情報が見つかりません', ErrorType.NOT_FOUND));
        });
    });

    describe('deleteCardUsage', () => {
        test('正常にカード利用情報を削除できること', async () => {
            // Arrange
            const id = '123';
            const deleteResult = {
                id: '123',
                path: 'details/2023/12/term1/01/123'
            };

            mockRepository.delete.mockResolvedValue(deleteResult);

            // Act
            const result = await firestoreCardUsageUseCase.deleteCardUsage(id);

            // Assert
            expect(mockRepository.delete).toHaveBeenCalledWith(id);
            expect(result).toEqual(deleteResult);
        });

        test('IDが不足している場合、ValidationErrorをスローすること', async () => {
            // Act & Assert
            await expect(firestoreCardUsageUseCase.deleteCardUsage(''))
                .rejects.toThrow(new AppError('IDが必要です', ErrorType.VALIDATION));
        });

        test('カード利用情報が見つからない場合、NotFoundErrorをスローすること', async () => {
            // Arrange
            const id = '123';
            mockRepository.delete.mockResolvedValue(null);

            // Act & Assert
            await expect(firestoreCardUsageUseCase.deleteCardUsage(id))
                .rejects.toThrow(new AppError('指定されたIDのカード利用情報が見つかりません', ErrorType.NOT_FOUND));
        });
    });
});
