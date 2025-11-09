import { CardUsageNotificationDTO } from '@shared/domain/dto/CardUsageNotificationDTO';
import { CardCompany } from '@domain/enums/CardCompany';

/**
 * メール処理のユースケースインターフェース
 * メール本文からカード利用情報を抽出・保存する責務を定義
 */
export interface IProcessEmailUseCase {
  /**
   * メール本文を処理してカード利用情報を抽出・保存する
   * @param emailBody メール本文
   * @param cardCompany カード会社の種類
   * @returns 処理されたカード利用情報と保存パス
   */
  execute(emailBody: string, cardCompany: CardCompany): Promise<{
    usage: CardUsageNotificationDTO,
    savedPath: string
  }>;

  /**
   * サンプルメールでのテスト実行
   * @param emailBody テスト用のメール本文
   * @param cardCompany カード会社の種類
   * @returns 処理結果
   */
  executeTest(emailBody: string, cardCompany: CardCompany): Promise<{
    parsedData: CardUsageNotificationDTO;
    savedPath: string;
  }>;
}
