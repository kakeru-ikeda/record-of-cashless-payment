import * as admin from 'firebase-admin';
import { CardUsage } from '../domain/entities/CardUsage';
import { CardUsageNotification } from '../../shared/types/CardUsageNotification';
import { CardUsageMapper } from '../domain/mappers/CardUsageMapper';
import { ICardUsageRepository } from '../domain/repositories/ICardUsageRepository';
import { ImapEmailService, CardCompany } from '../infrastructure/email/ImapEmailService';
import { DiscordNotifier } from '../../shared/discord/DiscordNotifier';
import { logger } from '../../shared/utils/Logger';
import { AppError, ErrorType } from '../../shared/errors/AppError';

/**
 * メール処理のユースケース
 */
export class ProcessEmailUseCase {
  private readonly serviceContext = 'ProcessEmailUseCase';

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
  ) { 
    logger.updateServiceStatus(this.serviceContext, 'online', '初期化完了');
  }

  /**
   * メール本文を処理してカード利用情報を抽出・保存・通知する
   * @param emailBody メール本文
   * @param cardCompany カード会社の種類
   * @returns 保存されたパス
   */
  async execute(emailBody: string, cardCompany: CardCompany = CardCompany.MUFG): Promise<string> {
    try {
      logger.info(`${cardCompany}のメール本文の解析を開始します...`, this.serviceContext);

      // メール本文からカード利用情報を抽出（既にCardUsageMapperを使用）
      const usage = await this.emailService.parseCardUsageFromEmail(emailBody, cardCompany);
      
      logger.debug(`パース結果: ${JSON.stringify(usage)}`, this.serviceContext);

      // Firestoreのタイムスタンプに変換
      const firestoreTimestamp = admin.firestore.Timestamp.fromDate(new Date(usage.datetime_of_use));

      // カード利用情報エンティティを作成
      const cardUsageEntity: CardUsage = {
        card_name: usage.card_name,
        datetime_of_use: firestoreTimestamp,
        amount: usage.amount,
        where_to_use: usage.where_to_use,
        memo: usage.memo,
        is_active: usage.is_active,
        created_at: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      // リポジトリを通じてFirestoreに保存
      const savedPath = await this.cardUsageRepository.save(cardUsageEntity);
      logger.info(`カード利用情報を保存しました: ${savedPath}`, this.serviceContext);

      try {
        // Discord通知を送信
        await this.discordNotifier.notify(usage);
        logger.info('Discord通知を送信しました', this.serviceContext);
      } catch (notifyError) {
        // 通知エラーはログに記録するが処理は続行
        const appError = new AppError(
          'Discord通知の送信に失敗しました',
          ErrorType.DISCORD,
          { usage },
          notifyError instanceof Error ? notifyError : new Error(String(notifyError))
        );
        logger.logAppError(appError, this.serviceContext);
        throw appError;
      }

      return savedPath;
    } catch (error) {
      // AppErrorかどうかを確認
      if (error instanceof AppError) {
        logger.logAppError(error, this.serviceContext);
      } else {
        const appError = new AppError(
          'メール処理中にエラーが発生しました',
          ErrorType.GENERAL,
          { emailBodyLength: emailBody.length, cardCompany },
          error instanceof Error ? error : new Error(String(error))
        );
        logger.logAppError(appError, this.serviceContext);
      }
      throw error;
    }
  }

  /**
   * サンプルメールでのテスト実行
   * @param emailBody テスト用のメール本文
   * @param cardCompany カード会社の種類
   * @returns 処理結果
   */
  async executeTest(emailBody: string, cardCompany: CardCompany = CardCompany.MUFG): Promise<{
    parsedData: CardUsageNotification;
    savedPath: string;
    notificationSent: boolean;
  }> {
    try {
      logger.info(`テストモードで${cardCompany}のメール処理を実行します`, this.serviceContext);

      // メール本文からカード利用情報を抽出
      const usage = await this.emailService.parseCardUsageFromEmail(emailBody, cardCompany);
      logger.debug(`テストパース結果: ${JSON.stringify(usage)}`, this.serviceContext);

      // Firestoreのタイムスタンプに変換
      const firestoreTimestamp = admin.firestore.Timestamp.fromDate(new Date(usage.datetime_of_use));

      // カード利用情報エンティティを作成
      const cardUsageEntity: CardUsage = {
        card_name: usage.card_name,
        datetime_of_use: firestoreTimestamp,
        amount: usage.amount,
        where_to_use: usage.where_to_use,
        memo: usage.memo,
        is_active: usage.is_active,
        created_at: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      // リポジトリを通じてFirestoreに保存
      const savedPath = await this.cardUsageRepository.save(cardUsageEntity);
      logger.info('カード利用情報を保存しました: ' + savedPath, this.serviceContext);

      // Discord通知を送信
      const notificationSent = await this.discordNotifier.notify(usage);
      logger.info('Discord通知を送信しました', this.serviceContext);

      return {
        parsedData: usage,
        savedPath,
        notificationSent
      };
    } catch (error) {
      const appError = new AppError(
        `${cardCompany}のテスト実行中にエラーが発生しました`,
        ErrorType.GENERAL,
        { emailBodyLength: emailBody.length },
        error instanceof Error ? error : new Error(String(error))
      );
      logger.logAppError(appError, this.serviceContext);
      throw error;
    }
  }
}
