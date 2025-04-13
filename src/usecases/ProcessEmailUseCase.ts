import * as admin from 'firebase-admin';
import { CardUsage } from '../domain/entities/CardUsage';
import { CardUsageNotification } from '../../shared/types/CardUsageNotification';
import { ICardUsageRepository } from '../domain/repositories/ICardUsageRepository';
import { ImapEmailService } from '../infrastructure/email/ImapEmailService';
import { DiscordNotifier } from '../../shared/discord/DiscordNotifier';

/**
 * メール処理のユースケース
 */
export class ProcessEmailUseCase {
  /**
   * コンストラクタ
   * @param emailService メールサービス
   * @param cardUsageRepository カード利用情報リポジトリ
   * @param discordNotifier Discord通知
   */
  constructor(
    private readonly emailService: ImapEmailService,
    private readonly cardUsageRepository: ICardUsageRepository,
    private readonly discordNotifier: DiscordNotifier
  ) { }

  /**
   * メール本文を処理してカード利用情報を抽出・保存・通知する
   * @param emailBody メール本文
   * @returns 保存されたパス
   */
  async execute(emailBody: string): Promise<string> {
    try {
      console.log('📨 メール本文の解析を開始します...');

      // メール本文からカード利用情報を抽出
      const usage = await this.emailService.parseCardUsageFromEmail(emailBody);

      // Firestoreのタイムスタンプに変換
      const firestoreTimestamp = admin.firestore.Timestamp.fromDate(new Date(usage.datetime_of_use));

      // カード利用情報エンティティを作成
      const cardUsageEntity: CardUsage = {
        card_name: usage.card_name,
        datetime_of_use: firestoreTimestamp,
        amount: usage.amount,
        where_to_use: usage.where_to_use,
        created_at: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      // リポジトリを通じてFirestoreに保存
      const savedPath = await this.cardUsageRepository.save(cardUsageEntity);
      console.log('💾 カード利用情報を保存しました:', savedPath);

      // Discord通知を送信
      await this.discordNotifier.notify({
        card_name: usage.card_name,
        datetime_of_use: usage.datetime_of_use,
        amount: usage.amount,
        where_to_use: usage.where_to_use
      });

      return savedPath;
    } catch (error) {
      console.error('❌ メール処理中にエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * サンプルメールでのテスト実行
   * @param emailBody テスト用のメール本文
   * @returns 処理結果
   */
  async executeTest(emailBody: string): Promise<{
    parsedData: CardUsageNotification;
    savedPath: string;
    notificationSent: boolean;
  }> {
    try {
      console.log('🧪 テストモードでメール処理を実行します');

      // メール本文からカード利用情報を抽出
      const usage = await this.emailService.parseCardUsageFromEmail(emailBody);

      // Firestoreのタイムスタンプに変換
      const firestoreTimestamp = admin.firestore.Timestamp.fromDate(new Date(usage.datetime_of_use));

      // カード利用情報エンティティを作成
      const cardUsageEntity: CardUsage = {
        card_name: usage.card_name,
        datetime_of_use: firestoreTimestamp,
        amount: usage.amount,
        where_to_use: usage.where_to_use,
        created_at: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      // リポジトリを通じてFirestoreに保存
      const savedPath = await this.cardUsageRepository.save(cardUsageEntity);
      console.log('💾 カード利用情報を保存しました:', savedPath);

      // Discord通知を送信
      const notificationSent = await this.discordNotifier.notify({
        card_name: usage.card_name,
        datetime_of_use: usage.datetime_of_use,
        amount: usage.amount,
        where_to_use: usage.where_to_use
      });

      return {
        parsedData: usage,
        savedPath,
        notificationSent
      };
    } catch (error) {
      console.error('❌ テスト実行中にエラーが発生しました:', error);
      throw error;
    }
  }
}
