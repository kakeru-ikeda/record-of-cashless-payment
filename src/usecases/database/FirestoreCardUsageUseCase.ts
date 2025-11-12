import { CardUsage } from '@shared/domain/entities/CardUsage';
import {
  ICardUsageCrudRepository,
} from '@domain/interfaces/infrastructure/database/repositories/ICardUsageCrudRepository';
import { AppError, ErrorType } from '@shared/errors/AppError';
import { Timestamp } from 'firebase-admin/firestore';
import { DiscordNotifier } from '@shared/infrastructure/discord/DiscordNotifier';
import { CardUsageMapper } from '@shared/infrastructure/mappers/CardUsageMapper';

/**
 * カード利用情報作成用のDTO
 */
interface CreateCardUsageDTO {
  card_name: string;
  datetime_of_use: string | Timestamp;
  amount: number;
  where_to_use: string;
  memo?: string;
  is_active?: boolean;
}

/**
 * カード利用情報更新用のDTO
 */
interface UpdateCardUsageDTO {
  card_name?: string;
  datetime_of_use?: string | Timestamp;
  amount?: number;
  where_to_use?: string;
  memo?: string;
  is_active?: boolean;
}

/**
 * Firestoreを使用したカード利用情報のユースケース
 * カード利用情報の取得、作成、更新、削除を行う
 */
export class FirestoreCardUsageUseCase {
    constructor(
        private cardUsageRepository: ICardUsageCrudRepository,
        private discordNotifier: DiscordNotifier
    ) { }

    /**
     * 指定された年月のカード利用情報を取得する
     * @param year 年
     * @param month 月
     * @returns カード利用情報の配列
     */
    async getCardUsagesByYearMonth(year: string, month: string): Promise<(CardUsage & { id: string, path: string })[]> {
        if (!year || !month) {
            throw new AppError('年と月のパラメータが必要です', ErrorType.VALIDATION);
        }

        return await this.cardUsageRepository.getByYearMonth(year, month);
    }

    /**
     * IDによるカード利用情報の取得
     * @param id カード利用情報のID
     * @returns カード利用情報
     */
    async getCardUsageById(id: string): Promise<(CardUsage & { id: string, path: string })> {
        if (!id) {
            throw new AppError('IDが必要です', ErrorType.VALIDATION);
        }

        const cardUsage = await this.cardUsageRepository.getById(id);
        if (!cardUsage) {
            throw new AppError('指定されたIDのカード利用情報が見つかりません', ErrorType.NOT_FOUND);
        }

        return cardUsage;
    }

    /**
     * カード利用情報を作成する
     * @param cardUsageData カード利用情報
     * @returns 作成されたカード利用情報
     */
    async createCardUsage(cardUsageData: CreateCardUsageDTO): Promise<CardUsage & { id: string, path: string }> {
        // バリデーション
        if (!cardUsageData || !cardUsageData.datetime_of_use || !cardUsageData.amount || !cardUsageData.card_name) {
            throw new AppError('必須フィールドが不足しています', ErrorType.VALIDATION);
        }

        /* eslint-disable camelcase */
        // 日付文字列をタイムスタンプに変換
        let datetime_of_use: Timestamp;
        try {
            if (typeof cardUsageData.datetime_of_use === 'string') {
                const dateObj = new Date(cardUsageData.datetime_of_use);
                if (isNaN(dateObj.getTime())) {
                    throw new Error('Invalid date string');
                }
                datetime_of_use = Timestamp.fromDate(dateObj);
            } else if (cardUsageData.datetime_of_use instanceof Timestamp) {
                // Already a Timestamp object
                datetime_of_use = cardUsageData.datetime_of_use;
            } else if (cardUsageData.datetime_of_use &&
                typeof cardUsageData.datetime_of_use === 'object' &&
                'seconds' in cardUsageData.datetime_of_use) {
                // Timestamp-like object, convert to Timestamp
                type TimestampLike = {seconds: number; nanoseconds?: number};
                const seconds = (cardUsageData.datetime_of_use as TimestampLike).seconds;
                const nanoseconds = (cardUsageData.datetime_of_use as TimestampLike).nanoseconds || 0;
                const milliseconds = seconds * 1000 + Math.floor(nanoseconds / 1000000);
                datetime_of_use = Timestamp.fromMillis(milliseconds);
            } else {
                throw new AppError('日付形式が無効です', ErrorType.VALIDATION);
            }
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError('日付形式が無効です', ErrorType.VALIDATION, error);
        }

        // 作成日時として現在のタイムスタンプを設定
        const created_at = Timestamp.now();

        // 保存用のCardUsageオブジェクトを作成
        const cardUsage: CardUsage = {
            card_name: cardUsageData.card_name,
            datetime_of_use: datetime_of_use,
            amount: Number(cardUsageData.amount),
            where_to_use: cardUsageData.where_to_use || '',
            memo: cardUsageData.memo || '',
            is_active: cardUsageData.is_active !== undefined ? cardUsageData.is_active : true,
            created_at: created_at,
        };
        /* eslint-enable camelcase */

        // リポジトリ経由で保存
        const savedPath = await this.cardUsageRepository.save(cardUsage);

        // Discord通知
        await this.discordNotifier.notifyCardUsage(CardUsageMapper.toNotification(cardUsage));

        /* eslint-disable camelcase */
        // 作成日時のタイムスタンプをIDとして使用
        const id = created_at.toDate().getTime().toString();
        /* eslint-enable camelcase */

        return {
            ...cardUsage,
            id: id,
            path: savedPath,
        };
    }

    /**
     * カード利用情報を更新する
     * @param id カード利用情報のID
     * @param updateData 更新データ
     * @returns 更新されたカード利用情報
     */
    async updateCardUsage(
        id: string,
        updateData: UpdateCardUsageDTO
    ): Promise<CardUsage & { id: string, path: string }> {
        if (!id) {
            throw new AppError('IDが必要です', ErrorType.VALIDATION);
        }

        // 更新用のデータを構築
        const updateFields: Partial<CardUsage> = {};

        if (updateData.card_name !== undefined) {
            updateFields.card_name = updateData.card_name;
        }

        if (updateData.amount !== undefined) {
            updateFields.amount = Number(updateData.amount);
        }

        if (updateData.where_to_use !== undefined) {
            updateFields.where_to_use = updateData.where_to_use;
        }

        if (updateData.memo !== undefined) {
            updateFields.memo = updateData.memo;
        }

        if (updateData.is_active !== undefined) {
            updateFields.is_active = updateData.is_active;
        }

        const updatedCardUsage = await this.cardUsageRepository.update(id, updateFields);
        if (!updatedCardUsage) {
            throw new AppError('指定されたIDのカード利用情報が見つかりません', ErrorType.NOT_FOUND);
        }

        return updatedCardUsage;
    }

    /**
     * カード利用情報を削除する（論理削除）
     * @param id カード利用情報のID
     * @returns 削除されたカード利用情報のIDとパス
     */
    async deleteCardUsage(id: string): Promise<{ id: string, path: string }> {
        if (!id) {
            throw new AppError('IDが必要です', ErrorType.VALIDATION);
        }

        const result = await this.cardUsageRepository.delete(id);
        if (!result) {
            throw new AppError('指定されたIDのカード利用情報が見つかりません', ErrorType.NOT_FOUND);
        }

        return result;
    }
}
