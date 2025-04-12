
import { ParsedEmail, ImapEmailService } from '../../infrastructure/email/ImapEmailService';
import { ProcessEmailUseCase } from '../../usecases/ProcessEmailUseCase';

/**
 * メール処理のコントローラー
 */
export class EmailController {
  /**
   * コンストラクタ
   * @param emailService メールサービス
   * @param processEmailUseCase メール処理ユースケース
   */
  constructor(
    private readonly emailService: ImapEmailService,
    private readonly processEmailUseCase: ProcessEmailUseCase
  ) {}
  
  /**
   * メール監視を開始
   * @param mailboxName 監視対象のメールボックス名
   */
  async startMonitoring(mailboxName?: string): Promise<void> {
    console.log('📧 メール監視を開始します...');
    
    await this.emailService.connect(mailboxName, async (email: ParsedEmail) => {
      try {
        // 三菱UFJ銀行のメールかどうかを判断
        if (this.isMufgEmail(email)) {
          console.log('🏦 三菱UFJ銀行のメールを検出しました');
          
          // メール本文からカード利用情報を抽出して保存
          await this.processEmailUseCase.execute(email.body);
        }
      } catch (error) {
        console.error('❌ メール処理中にエラーが発生しました:', error);
      }
    });
  }
  
  /**
   * 三菱UFJ銀行のメールかどうかを判定
   * @param email パース済みメール
   * @returns 三菱UFJ銀行のメールならtrue
   */
  private isMufgEmail(email: ParsedEmail): boolean {
    const fromCheck = email.from.includes('mufg.jp') || email.from.includes('bk.mufg.jp');
    const subjectCheck = email.subject.includes('UFJ') || email.subject.includes('利用');
    const bodyCheck = email.body.includes('三菱') || email.body.includes('UFJ') || email.body.includes('デビット');
    
    return fromCheck || (subjectCheck && bodyCheck);
  }
  
  /**
   * メール監視を停止
   */
  stopMonitoring(): void {
    this.emailService.close();
    console.log('📧 メール監視を停止しました');
  }
}

