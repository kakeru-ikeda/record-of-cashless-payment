import { CardCompany } from '../../infrastructure/email/CardUsageExtractor';
import { ParsedEmail } from '../../infrastructure/email/EmailParser';
import { IProcessCardCompanyEmailUseCase } from '../../domain/usecases/email/IProcessCardCompanyEmailUseCase';
import { ProcessEmailUseCase } from './ProcessEmailUseCase';
import { logger } from '../../../shared/utils/Logger';
import { ErrorHandler } from '../../../shared/errors/ErrorHandler';
import { CardUsageNotification } from 'shared/domain/entities/CardUsageNotification';

export class ProcessCardCompanyEmailUseCase implements IProcessCardCompanyEmailUseCase {
  private readonly serviceContext = 'ProcessCardCompanyEmailUseCase';

  constructor(
    private readonly processEmailUseCase: ProcessEmailUseCase
  ) {}

  /**
   * メールからカード会社を判定し、カード利用情報を処理する
   */
  @ErrorHandler.errorDecorator('ProcessCardCompanyEmailUseCase', { 
    defaultMessage: 'カード利用情報の処理中にエラーが発生しました' 
  })
  async execute(email: ParsedEmail): Promise<{
    cardCompany: CardCompany | null;
    usageResult?: {
      usage: CardUsageNotification;
      savedPath: string;
    };
  }> {
    logger.info(`メール処理を開始します: ${email.subject}`, this.serviceContext);
    
    // カード会社を判定
    const detectedCardCompany = this.detectCardCompany(email);
    
    if (!detectedCardCompany) {
      logger.info('カード会社を特定できませんでした', this.serviceContext);
      return { cardCompany: null };
    }
    
    logger.info(`${detectedCardCompany}のメールを検出しました`, this.serviceContext);
    
    // メール本文からカード利用情報を抽出して保存
    const result = await this.processEmailUseCase.execute(email.body, detectedCardCompany);
    
    return {
      cardCompany: detectedCardCompany,
      usageResult: result
    };
  }

  /**
   * カード会社を判定
   */
  private detectCardCompany(email: ParsedEmail): CardCompany | null {
    if (this.isMufgEmail(email)) {
      return CardCompany.MUFG;
    } else if (this.isSmbcEmail(email)) {
      return CardCompany.SMBC;
    }
    return null;
  }
  
  /**
   * 三菱UFJ銀行のメールかどうかを判定
   */
  private isMufgEmail(email: ParsedEmail): boolean {
    const fromCheck = email.from.includes('mufg.jp') || email.from.includes('bk.mufg.jp');
    const subjectCheck = email.subject.includes('UFJ') || email.subject.includes('利用');
    const bodyCheck = email.body.includes('三菱') || email.body.includes('UFJ') || email.body.includes('デビット');
    
    return fromCheck || (subjectCheck && bodyCheck);
  }
  
  /**
   * 三井住友カードのメールかどうかを判定
   */
  private isSmbcEmail(email: ParsedEmail): boolean {
    const fromCheck = email.from.includes('vpass.ne.jp') || email.from.includes('smbc-card.com') || email.from.includes('smbc.co.jp');
    const subjectCheck = email.subject.includes('三井住友') || email.subject.includes('利用');
    const bodyCheck = email.body.includes('三井住友') || email.body.includes('SMBC') || email.body.includes('クレジット');
    
    return fromCheck || (subjectCheck && bodyCheck);
  }
}