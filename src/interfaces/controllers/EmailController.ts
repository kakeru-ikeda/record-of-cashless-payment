import { ParsedEmail, ImapEmailService, CardCompany } from '../../infrastructure/email/ImapEmailService';
import { ProcessEmailUseCase } from '../../usecases/ProcessEmailUseCase';
import { Environment } from '../../infrastructure/config/environment';
import { logger } from '../../../shared/utils/Logger';

/**
 * メール処理のコントローラー
 */
export class EmailController {
  // メールボックス設定
  private readonly mailboxes = {
    [CardCompany.MUFG]: '三菱東京UFJ銀行',   // 三菱UFJ銀行のメールボックス
    [CardCompany.SMBC]: '三井住友カード'    // 三井住友カードのメールボックス
  };

  // メールサービスのインスタンス
  private emailServices: Record<string, ImapEmailService> = {};
  private readonly serviceContext = 'EmailController';

  /**
   * コンストラクタ
   * @param emailService メールサービス
   * @param processEmailUseCase メール処理ユースケース
   */
  constructor(
    private readonly emailService: ImapEmailService,
    private readonly processEmailUseCase: ProcessEmailUseCase
  ) {
    // デフォルトのメールサービスをセット
    this.emailServices['default'] = emailService;
    logger.updateServiceStatus(this.serviceContext, 'offline', '初期化済み');
  }
  
  /**
   * すべてのメールボックスの監視を開始
   */
  async startAllMonitoring(): Promise<void> {
    logger.info('全メールボックスの監視を開始します...', this.serviceContext);
    
    // カード会社ごとに別々のインスタンスを作成して監視
    for (const [cardCompany, mailboxName] of Object.entries(this.mailboxes)) {
      // 各メールボックス用のImapEmailServiceインスタンスを作成
      const mailboxService = new ImapEmailService(
        Environment.IMAP_SERVER,
        Environment.IMAP_USER,
        Environment.IMAP_PASSWORD
      );
      
      // インスタンスを保存
      this.emailServices[cardCompany] = mailboxService;
      
      // 監視を開始
      await this.startMonitoringForMailbox(mailboxName, cardCompany as CardCompany, mailboxService);
    }
    
    logger.updateServiceStatus(this.serviceContext, 'online', '全メールボックスの監視中');
  }
  
  /**
   * 特定のメールボックスの監視を開始
   * @param mailboxName 監視対象のメールボックス名
   * @param cardCompany カード会社の種類
   * @param emailService 使用するメールサービスインスタンス
   */
  private async startMonitoringForMailbox(
    mailboxName: string,
    cardCompany: CardCompany,
    emailService: ImapEmailService
  ): Promise<void> {
    const context = `${this.serviceContext}:${cardCompany}`;
    logger.info(`${cardCompany}のメールボックス "${mailboxName}" の監視を開始します`, context);
    
    try {
      await emailService.connect(mailboxName, async (email: ParsedEmail) => {
        try {
          logger.info(`新しいメールを受信しました: ${email.subject}`, context);
          logger.debug(`送信者: ${email.from}`, context);
          logger.debug(`本文サンプル: ${email.body.substring(0, 100)}...`, context);

          // 受信したメールのカード会社を判定
          const detectedCardCompany = this.detectCardCompany(email);
          
          if (detectedCardCompany) {
            logger.info(`${detectedCardCompany}のメールを検出しました`, context);
            
            // メール本文からカード利用情報を抽出して保存
            await this.processEmailUseCase.execute(email.body, detectedCardCompany);
          } else {
            logger.warn(`カード会社を特定できませんでした`, context);
          }
        } catch (error) {
          logger.error('メール処理中にエラーが発生しました', error, context);
        }
      });
    } catch (error) {
      logger.error(`メールボックス "${mailboxName}" への接続に失敗しました`, error, context);
      logger.updateServiceStatus(context, 'error', '接続に失敗しました');
    }
  }
  
  /**
   * メール監視を開始 (後方互換性のために残しています)
   * @param mailboxName 監視対象のメールボックス名
   */
  async startMonitoring(mailboxName?: string): Promise<void> {
    const context = `${this.serviceContext}:Legacy`;
    logger.info(`メール監視を開始します: ${mailboxName || 'デフォルトボックス'}`, context);
    
    try {
      await this.emailService.connect(mailboxName, async (email: ParsedEmail) => {
        try {
          logger.info(`新しいメールを受信しました: ${email.subject}`, context);
          logger.debug(`送信者: ${email.from}`, context);
          logger.debug(`本文サンプル: ${email.body.substring(0, 100)}...`, context);

          // カード会社判定
          const cardCompany = this.detectCardCompany(email);
          
          if (cardCompany) {
            logger.info(`${cardCompany}のメールを検出しました`, context);
            
            // メール本文からカード利用情報を抽出して保存
            await this.processEmailUseCase.execute(email.body, cardCompany);
          } else {
            logger.warn('カード会社を特定できませんでした', context);
          }
        } catch (error) {
          logger.error('メール処理中にエラーが発生しました', error, context);
        }
      });
    } catch (error) {
      logger.error(`メールボックス "${mailboxName}" への接続に失敗しました`, error, context);
    }
  }
  
  /**
   * カード会社を判定
   * @param email パース済みメール
   * @returns カード会社の種類、不明の場合はnull
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
   * 三井住友カードのメールかどうかを判定
   * @param email パース済みメール
   * @returns 三井住友カードのメールならtrue
   */
  private isSmbcEmail(email: ParsedEmail): boolean {
    const fromCheck = email.from.includes('vpass.ne.jp') ||email.from.includes('smbc-card.com') || email.from.includes('smbc.co.jp');
    const subjectCheck = email.subject.includes('三井住友') || email.subject.includes('利用');
    const bodyCheck = email.body.includes('三井住友') || email.body.includes('SMBC') || email.body.includes('クレジット');
    
    // 現段階では広めの条件で検出して、実際のメールの形式を確認する
    return fromCheck || (subjectCheck && bodyCheck);
  }
  
  /**
   * メール監視を停止
   */
  async stopMonitoring(): Promise<void> {
    logger.info('すべてのメールボックスの監視を停止します', this.serviceContext);
    
    // 全てのメールサービスインスタンスの接続を閉じる
    for (const [key, service] of Object.entries(this.emailServices)) {
      const context = `${this.serviceContext}:${key}`;
      try {
        await service.close();
        logger.info(`${key}のメール監視を停止しました`, context);
      } catch (error) {
        logger.error(`${key}のメール監視停止中にエラーが発生しました`, error, context);
      }
    }
    
    logger.updateServiceStatus(this.serviceContext, 'offline', '監視停止');
  }
}

