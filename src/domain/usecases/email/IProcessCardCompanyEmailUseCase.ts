import { CardCompany } from '@domain/enums/CardCompany';
import { ParsedEmail } from '@infrastructure/email/EmailParser';
import { CardUsageNotification } from '@shared/domain/entities/CardUsageNotification';

export interface IProcessCardCompanyEmailUseCase {
  /**
   * メールからカード会社情報を判定し、カード利用情報を処理する
   */
  execute(email: ParsedEmail): Promise<{
    cardCompany: CardCompany | null;
    usageResult?: {
      usage: CardUsageNotification;
      savedPath: string;
    };
  }>;
}