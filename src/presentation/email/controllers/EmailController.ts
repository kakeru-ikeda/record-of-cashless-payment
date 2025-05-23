import { ImapEmailService, CardCompany } from '../../../infrastructure/email/ImapEmailService';
import { ParsedEmail } from '../../../infrastructure/email/EmailParser';
import { Environment } from '../../../../shared/infrastructure/config/Environment';
import { logger } from '../../../../shared/infrastructure/logging/Logger';
import { AppError, ErrorType } from '../../../../shared/infrastructure/errors/AppError';
import { ErrorHandler } from '../../../../shared/infrastructure/errors/ErrorHandler';
import { IProcessCardCompanyEmailUseCase } from '../../../domain/usecases/email/IProcessCardCompanyEmailUseCase';
import { INotifyCardUsageUseCase } from '../../../domain/usecases/notification/INotifyCardUsageUseCase';

/**
 * メール処理のコントローラー
 */
export class EmailController {
  // メールボックス設定
  private readonly mailboxes = {
    [CardCompany.MUFG]: '三菱東京UFJ銀行',
    [CardCompany.SMBC]: '三井住友カード'
  };

  // メールサービスのインスタンス
  private emailServices: Record<string, ImapEmailService> = {};
  private readonly serviceContext = 'EmailController';
  // 監視状態を管理するフラグ
  private isMonitoringActive: boolean = false;

  /**
   * コンストラクタ
   */
  constructor(
    private readonly processCardCompanyEmailUseCase: IProcessCardCompanyEmailUseCase,
    private readonly notifyCardUsageUseCase: INotifyCardUsageUseCase
  ) {
    logger.updateServiceStatus(this.serviceContext, 'offline', '初期化済み');
  }

  /**
   * メール監視が有効かどうかを返す
   */
  public isMonitoring(): boolean {
    return this.isMonitoringActive;
  }

  /**
   * すべてのメールボックスの監視を開始
   */
  @ErrorHandler.errorDecorator('EmailController', {
    defaultMessage: 'メールボックス監視の開始に失敗しました'
  })
  async startAllMonitoring(): Promise<void> {
    logger.info('全メールボックスの監視を開始します...', this.serviceContext);

    // カード会社ごとに別々のインスタンスを作成して監視
    for (const [cardCompany, mailboxName] of Object.entries(this.mailboxes)) {
      try {
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
      } catch (error) {
        // 個別のメールボックスのエラーは全体の処理を止めない
        await ErrorHandler.handleEventError(error, this.serviceContext, {
          defaultMessage: `${cardCompany}のメールボックス監視の開始に失敗しました`,
          additionalInfo: { cardCompany, mailboxName }
        });
      }
    }

    this.isMonitoringActive = true;
    logger.updateServiceStatus(this.serviceContext, 'online', '全メールボックスの監視中');

    // 監視開始のログをDiscordに通知
    logger.info(
      `メールボックス監視を開始しました。監視対象: ${Object.entries(this.mailboxes)
        .map(([company, box]) => `${company}: ${box}`)
        .join(', ')}`,
      this.serviceContext,
      {
        notify: true,
        title: '📬 メール監視開始',
      }
    );
  }

  /**
   * 特定のメールボックスの監視を開始
   */
  @ErrorHandler.errorDecorator('EmailController', {
    defaultMessage: 'メールボックスへの接続に失敗しました'
  })
  private async startMonitoringForMailbox(
    mailboxName: string,
    cardCompany: CardCompany,
    emailService: ImapEmailService
  ): Promise<void> {
    const context = `${this.serviceContext}:${cardCompany}`;
    logger.info(`${cardCompany}のメールボックス "${mailboxName}" の監視を開始します`, context);

    await emailService.connect(mailboxName, async (email: ParsedEmail) => {
      await this.processReceivedEmail(email, context);
    });
  }

  /**
   * 受信したメールを処理
   */
  @ErrorHandler.errorDecorator('EmailController', {
    defaultMessage: 'メール処理中にエラーが発生しました',
  })
  private async processReceivedEmail(email: ParsedEmail, context: string): Promise<void> {
    logger.info(`新しいメールを受信しました: ${email.subject}`, context);
    logger.debug(`送信者: ${email.from}`, context);
    logger.debug(`本文サンプル: ${email.body.substring(0, 100)}...`, context);

    // ユースケースにメール処理を委譲
    const result = await this.processCardCompanyEmailUseCase.execute(email);

    if (result.cardCompany && result.usageResult) {
      // カード利用情報が取得できた場合は通知
      await this.notifyCardUsageUseCase.notifyUsage(result.usageResult.usage);
    } else {
      // カード会社を特定できなかった場合
      const warnAppError = new AppError(
        'カード会社を特定できませんでした',
        ErrorType.EMAIL,
        { subject: email.subject, from: email.from }
      );
      throw warnAppError;
    }
  }

  /**
   * メール監視を停止
   */
  @ErrorHandler.errorDecorator('EmailController', {
    defaultMessage: 'メールボックス監視の停止に失敗しました'
  })
  async stopMonitoring(): Promise<void> {
    logger.info('すべてのメールボックスの監視を停止します', this.serviceContext);

    // 全てのメールサービスインスタンスの接続を閉じる
    for (const [key, service] of Object.entries(this.emailServices)) {
      const context = `${this.serviceContext}:${key}`;
      try {
        await service.close();
        logger.info(`${key}のメール監視を停止しました`, context);
      } catch (error) {
        const appError = await ErrorHandler.handleEventError(error, context, {
          defaultMessage: `${key}のメール監視停止中にエラーが発生しました`,
          additionalInfo: { serviceKey: key },
          suppressNotification: true
        });

        logger.error(appError, context, {
          notify: true,
          title: '🔴 メール監視停止エラー',
        });
      }
    }

    this.isMonitoringActive = false;
    logger.updateServiceStatus(this.serviceContext, 'offline', '監視停止');

    // 監視停止のログをDiscordに通知
    logger.info(
      'すべてのメールボックスの監視を停止しました。',
      this.serviceContext,
      {
        notify: true,
        title: '📭 メール監視停止',
      }
    );
  }
}