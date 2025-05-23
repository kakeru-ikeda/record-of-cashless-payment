import * as admin from 'firebase-admin';
import { CardUsage } from '@domain/entities/CardUsage';
import { CardUsageNotification } from '@shared/domain/entities/CardUsageNotification';
import { ICardUsageRepository } from '@domain/repositories/ICardUsageRepository';
import { IProcessEmailUseCase } from '@domain/usecases/email/IProcessEmailUseCase';
import { ImapEmailService } from '@infrastructure/email/ImapEmailService';
import { logger } from '@shared/infrastructure/logging/Logger';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';
import { CardCompany } from '@domain/entities/card/CardTypes';

/**
 * メール処理のユースケース
 */
export class ProcessEmailUseCase implements IProcessEmailUseCase {
  private readonly serviceContext = 'ProcessEmailUseCase';

  /**
   * コンストラクタ
   * @param emailService メールサービス
   * @param cardUsageRepository カード利用情報リポジトリ
   */
  constructor(
    private readonly emailService: ImapEmailService,
    private readonly cardUsageRepository: ICardUsageRepository
  ) {
    logger.updateServiceStatus(this.serviceContext, 'online', '初期化完了');
  }

  /**
   * メール本文を処理してカード利用情報を抽出・保存する
   * @param emailBody メール本文
   * @param cardCompany カード会社の種類
   * @returns 処理されたカード利用情報と保存パス
   */
  @ErrorHandler.errorDecorator('ProcessEmailUseCase', {
    defaultMessage: 'メール処理中にエラーが発生しました'
  })
  async execute(emailBody: string, cardCompany: CardCompany = CardCompany.MUFG): Promise<{ usage: CardUsageNotification, savedPath: string }> {
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

    // 処理したカード利用情報と保存パスを返す
    return { usage, savedPath };
  }

  /**
   * サンプルメールでのテスト実行
   * @param emailBody テスト用のメール本文
   * @param cardCompany カード会社の種類
   * @returns 処理結果
   */
  @ErrorHandler.errorDecorator('ProcessEmailUseCase', {
    defaultMessage: 'テスト実行中にエラーが発生しました'
  })
  async executeTest(emailBody: string, cardCompany: CardCompany = CardCompany.MUFG): Promise<{
    parsedData: CardUsageNotification;
    savedPath: string;
  }> {
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

    return {
      parsedData: usage,
      savedPath
    };
  }
}