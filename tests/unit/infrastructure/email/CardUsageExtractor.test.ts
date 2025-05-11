import { CardUsageExtractor, CardCompany } from '../../../../src/infrastructure/email/CardUsageExtractor';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';

// Loggerをモック化
jest.mock('../../../../shared/utils/Logger', () => {
  return {
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      logAppError: jest.fn(),
      updateServiceStatus: jest.fn()
    }
  };
});

describe('CardUsageExtractor', () => {
  let extractor: CardUsageExtractor;

  beforeEach(() => {
    extractor = new CardUsageExtractor();
  });

  describe('MUFG（三菱UFJ銀行）のメール解析', () => {
    test('正常系: 正しいフォーマットのメールからカード情報を抽出できること', () => {
      // テスト用のメール本文
      const emailBody = `
カード名称：Ｄ　三菱ＵＦＪ－ＪＣＢデビット
デビットカード取引確認メール

【ご利用日時(日本時間)】 2025年5月10日 15:30:00
【ご利用金額】 1,234円
【ご利用先】 コンビニエンスストア東京
【カード番号末尾4桁】 1234
      `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.MUFG);

      // 抽出結果を検証
      expect(result).toBeDefined();
      expect(result.card_name).toBe('Ｄ　三菱ＵＦＪ－ＪＣＢデビット');
      expect(result.amount).toBe(1234);
      expect(result.where_to_use).toBe('コンビニエンスストア東京');
      
      // 日付変換が正しく行われていることを検証（イレギュラーな日付のため一部柔軟に）
      const extractedDate = new Date(result.datetime_of_use);
      expect(extractedDate.getFullYear()).toBe(2025);
      expect(extractedDate.getMonth()).toBe(4); // 5月は4
      expect(extractedDate.getDate()).toBe(10);
    });

    test('異常系: 必要な情報が不足しているメールの場合、デフォルト値が設定されること', () => {
      // 情報が不足したメール本文
      const incompleteEmailBody = `
カード名称：Ｄ　三菱ＵＦＪ－ＪＣＢデビット
デビットカード取引確認メール

【カード番号末尾4桁】 1234
      `;

      // カード情報を抽出（例外は発生しない）
      const result = extractor.extractFromEmailBody(incompleteEmailBody, CardCompany.MUFG);

      // デフォルト値が設定されていることを検証
      expect(result).toBeDefined();
      expect(result.card_name).toBe('Ｄ　三菱ＵＦＪ－ＪＣＢデビット');
      expect(result.amount).toBe(0);
      expect(result.where_to_use).toBe('');
      
      // 日付はデフォルト値（現在時刻のISO文字列）
      expect(result.datetime_of_use).toBeDefined();
    });

    test('正常系: カンマを含む金額が正しく数値変換されること', () => {
      // カンマを含む金額のメール本文
      const emailBody = `
カード名称：Ｄ　三菱ＵＦＪ－ＪＣＢデビット
デビットカード取引確認メール

【ご利用日時(日本時間)】 2025年5月10日 15:30:00
【ご利用金額】 12,345円
【ご利用先】 百貨店
【カード番号末尾4桁】 1234
      `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.MUFG);

      // 金額のカンマが除去されて数値になっていることを検証
      expect(result.amount).toBe(12345);
    });
  });

  describe('SMBC（三井住友カード）のメール解析', () => {
    test('正常系: 正しいフォーマットのメールからカード情報を抽出できること', () => {
      // テスト用のメール本文
      const emailBody = `
三井住友カード 様

三井住友カードの利用のお知らせ
ご利用日時：2025/05/10 15:30 スーパーマーケット 2,468円
      `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.SMBC);

      // 抽出結果を検証
      expect(result).toBeDefined();
      expect(result.card_name).toBe('三井住友カード');
      expect(result.amount).toBe(2468);
      expect(result.where_to_use).toBe('スーパーマーケット');
      
      // 日付変換が正しく行われていることを検証
      const extractedDate = new Date(result.datetime_of_use);
      expect(extractedDate.getFullYear()).toBe(2025);
      expect(extractedDate.getMonth()).toBe(4); // 5月は4
      expect(extractedDate.getDate()).toBe(10);
    });

    test('異常系: 必要な情報が不足しているメールの場合、デフォルト値が設定されること', () => {
      // 情報が不足したメール本文
      const incompleteEmailBody = `
三井住友カードの利用のお知らせ
      `;

      // カード情報を抽出（例外は発生しない）
      const result = extractor.extractFromEmailBody(incompleteEmailBody, CardCompany.SMBC);

      // デフォルト値が設定されていることを検証
      expect(result).toBeDefined();
      expect(result.card_name).toBe('三井住友カード'); // デフォルト値
      expect(result.amount).toBe(0);
      expect(result.where_to_use).toBe('不明');
      
      // 日付はデフォルト値（現在時刻のISO文字列）
      expect(result.datetime_of_use).toBeDefined();
    });
  });

  test('未対応のカード会社の場合、例外がスローされること', () => {
    const emailBody = 'テスト本文';
    
    // @ts-ignore - テスト用に非対応の値を渡す
    expect(() => extractor.extractFromEmailBody(emailBody, 'UNKNOWN'))
      .toThrow(AppError);
  });
});