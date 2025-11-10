import { CardUsageNotificationDTO } from '@shared/domain/dto/CardUsageNotificationDTO';
import {
  ICardUsageCrudRepository,
} from '@domain/interfaces/infrastructure/database/repositories/ICardUsageCrudRepository';
import { IProcessEmailUseCase } from '@domain/interfaces/usecases/email/IProcessEmailUseCase';
import { ImapEmailService } from '@infrastructure/email/ImapEmailService';
import { logger } from '@shared/infrastructure/logging/Logger';
import { ErrorHandler } from '@shared/infrastructure/errors/ErrorHandler';
import { CardCompany } from '@domain/enums/CardCompany';
import { CardUsageMapper } from '@shared/infrastructure/mappers/CardUsageMapper';

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
    private readonly cardUsageRepository: ICardUsageCrudRepository
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
    defaultMessage: 'メール処理中にエラーが発生しました',
  })
  async execute(
    emailBody: string,
    cardCompany: CardCompany = CardCompany.MUFG,
  ): Promise<{ usage: CardUsageNotificationDTO, savedPath: string }> {
    logger.info(`${cardCompany}のメール本文の解析を開始します...`, this.serviceContext);

    // メール本文からカード利用情報を抽出
    const cardUsage = await this.emailService.parseCardUsageFromEmail(emailBody, cardCompany);
    logger.debug(`パース結果: ${JSON.stringify(cardUsage)}`, this.serviceContext);

    // リポジトリを通じてFirestoreに保存
    const savedPath = await this.cardUsageRepository.save(cardUsage);
    logger.info(`カード利用情報を保存しました: ${savedPath}`, this.serviceContext);

    // 処理したカード利用情報と保存パスを返す
    const usage = CardUsageMapper.toNotification(cardUsage);
    return { usage, savedPath };
  }

  /**
   * サンプルメールでのテスト実行
   * @param emailBody テスト用のメール本文
   * @param cardCompany カード会社の種類
   * @returns 処理結果
   */
  @ErrorHandler.errorDecorator('ProcessEmailUseCase', {
    defaultMessage: 'テスト実行中にエラーが発生しました',
  })
  async executeTest(emailBody: string, cardCompany: CardCompany = CardCompany.MUFG): Promise<{
    parsedData: CardUsageNotificationDTO;
    savedPath: string;
  }> {
    logger.info(`テストモードで${cardCompany}のメール処理を実行します`, this.serviceContext);

    // メール本文からカード利用情報を抽出
    const cardUsage = await this.emailService.parseCardUsageFromEmail(emailBody, cardCompany);
    logger.debug(`テストパース結果: ${JSON.stringify(cardUsage)}`, this.serviceContext);

    // リポジトリを通じてFirestoreに保存
    const savedPath = await this.cardUsageRepository.save(cardUsage);
    logger.info('カード利用情報を保存しました: ' + savedPath, this.serviceContext);

    // 処理したカード利用情報を通知形式に変換
    const usage = CardUsageMapper.toNotification(cardUsage);
    return {
      parsedData: usage,
      savedPath,
    };
  }
}
