import { CardUsageExtractor } from '../../../../src/infrastructure/email/CardUsageExtractor';
import { AppError } from '../../../../shared/errors/AppError';
import { CardCompany } from '../../../../src/domain/enums/CardCompany';
import { Timestamp } from 'firebase-admin/firestore';

// Loggerをモック化
jest.mock('../../../../shared/infrastructure/logging/Logger', () => {
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

      // 日付変換が正しく行われていることを検証
      expect(result.datetime_of_use).toBeInstanceOf(Timestamp);
      const extractedDate = result.datetime_of_use.toDate();
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

      // 日付はデフォルト値（Timestampオブジェクト）
      expect(result.datetime_of_use).toBeInstanceOf(Timestamp);
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

    test('日付変換エラー: Date オブジェクトがエラーをスローする場合のテスト', () => {
      // Date のコンストラクタをモック化して一度だけエラーをスローさせる
      const originalDate = global.Date;
      const mockDateConstructor = jest.fn()
        .mockImplementationOnce(() => {
          throw new Error('日付変換エラーのテスト');
        })
        .mockImplementation((...args: ConstructorParameters<typeof Date>) => {
          return new originalDate(...args);
        });

      global.Date = mockDateConstructor as any;

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

      // 日付変換エラー時のフォールバック処理が実行されたことを検証
      expect(result.datetime_of_use).toBeInstanceOf(Timestamp);

      // その他のフィールドが正しく抽出されていることを検証
      expect(result.card_name).toBe('Ｄ　三菱ＵＦＪ－ＪＣＢデビット');
      expect(result.amount).toBe(1234);
      expect(result.where_to_use).toBe('コンビニエンスストア東京');

      // モックをリストア
      global.Date = originalDate;
    });

    test('異常系: 金額だけがない場合のテスト', () => {
      // 金額情報が欠けているメール本文
      const emailBody = `
カード名称：Ｄ　三菱ＵＦＪ－ＪＣＢデビット
デビットカード取引確認メール

【ご利用日時(日本時間)】 2025年5月10日 15:30:00
【ご利用先】 コンビニエンスストア東京
【カード番号末尾4桁】 1234
    `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.MUFG);

      // 金額がデフォルト値になっていることを検証
      expect(result.amount).toBe(0);
      expect(result.card_name).toBe('Ｄ　三菱ＵＦＪ－ＪＣＢデビット');
      expect(result.where_to_use).toBe('コンビニエンスストア東京');
      expect(result.datetime_of_use).toBeInstanceOf(Timestamp);
    });

    test('異常系: 利用先だけがない場合のテスト', () => {
      // 利用先情報が欠けているメール本文
      const emailBody = `
カード名称：Ｄ　三菱ＵＦＪ－ＪＣＢデビット
デビットカード取引確認メール

【ご利用日時(日本時間)】 2025年5月10日 15:30:00
【ご利用金額】 1,234円
【カード番号末尾4桁】 1234
    `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.MUFG);

      // 利用先がデフォルト値になっていることを検証
      expect(result.where_to_use).toBe('');
      expect(result.card_name).toBe('Ｄ　三菱ＵＦＪ－ＪＣＢデビット');
      expect(result.amount).toBe(1234);
      expect(result.datetime_of_use).toBeDefined();
    });

    test('異常系: カード名が取得できない場合のテスト', () => {
      // カード名情報が欠けているメール本文
      const emailBody = `
デビットカード取引確認メール

【ご利用日時(日本時間)】 2025年5月10日 15:30:00
【ご利用金額】 1,234円
【ご利用先】 コンビニエンスストア東京
【カード番号末尾4桁】 1234
      `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.MUFG);

      // カード名がデフォルト値（空文字）になっていることを検証
      expect(result.card_name).toBe('');
      expect(result.amount).toBe(1234);
      expect(result.where_to_use).toBe('コンビニエンスストア東京');
      expect(result.datetime_of_use).toBeDefined();
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
      expect(result.datetime_of_use).toBeInstanceOf(Timestamp);
      const extractedDate = result.datetime_of_use.toDate();
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

    test('日付変換エラー: Date オブジェクトがエラーをスローする場合のテスト', () => {
      // Date のコンストラクタをモック化して一度だけエラーをスローさせる
      const originalDate = global.Date;
      const mockDateConstructor = jest.fn()
        .mockImplementationOnce(() => {
          throw new Error('日付変換エラーのテスト');
        })
        .mockImplementation((...args: ConstructorParameters<typeof Date>) => {
          return new originalDate(...args);
        });

      global.Date = mockDateConstructor as any;

      const emailBody = `
三井住友カード 様

三井住友カードの利用のお知らせ
ご利用日時：2025/05/10 15:30 スーパーマーケット 2,468円
    `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.SMBC);

      // 日付変換エラー時のフォールバック処理が実行されたことを検証
      expect(result.datetime_of_use).toBeDefined();

      // その他のフィールドが正しく抽出されていることを検証
      expect(result.card_name).toBe('三井住友カード');
      expect(result.amount).toBe(2468);
      expect(result.where_to_use).toBe('スーパーマーケット');

      // モックをリストア
      global.Date = originalDate;
    });

    test('異常系: 金額のフォーマットが異常な場合のテスト', () => {
      // 金額のフォーマットが異なるメール本文
      const emailBody = `
三井住友カード 様

三井住友カードの利用のお知らせ
ご利用日時：2025/05/10 15:30 スーパーマーケット 金額不正
    `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.SMBC);

      // 金額がデフォルト値になっていることを検証
      expect(result.amount).toBe(0);
      expect(result.card_name).toBe('三井住友カード');
      expect(result.where_to_use).toBe('不明');
      expect(result.datetime_of_use).toBeDefined();
    });

    test('異常系: 日付のフォーマットが異常な場合のテスト', () => {
      // 日付のフォーマットが異なるメール本文
      const emailBody = `
三井住友カード 様

三井住友カードの利用のお知らせ
ご利用日時：不正な日付形式 スーパーマーケット 2,468円
    `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.SMBC);

      // 日付がデフォルト値になり、他の情報は正しく抽出されていることを検証
      expect(result.datetime_of_use).toBeDefined();
      expect(result.card_name).toBe('三井住友カード');
      expect(result.amount).toBe(2468);
      expect(result.where_to_use).toBe('スーパーマーケット');
    });

    test('異常系: カード名が取得できない場合のテスト', () => {
      // カード名が取得できないメール本文
      const emailBody = `
利用のお知らせ
ご利用日時：2025/05/10 15:30 スーパーマーケット 2,468円
    `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.SMBC);

      // カード名がデフォルト値になっていることを検証
      expect(result.card_name).toBe('三井住友カード'); // デフォルト値
      expect(result.amount).toBe(2468);
      expect(result.where_to_use).toBe('スーパーマーケット');
      expect(result.datetime_of_use).toBeDefined();
    });

    test('異常系: 日付のみ存在し、金額と場所の情報がないケース', () => {
      // 日付のみ存在するメール本文
      const emailBody = `
三井住友カード 様

三井住友カードの利用のお知らせ
ご利用日時：2025/05/10 15:30
      `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.SMBC);

      // 日付は正しく抽出され、他の情報はデフォルト値になることを検証
      expect(result.datetime_of_use).toBeInstanceOf(Timestamp);
      const extractedDate = result.datetime_of_use.toDate();
      expect(extractedDate.getFullYear()).toBe(2025);
      expect(extractedDate.getMonth()).toBe(4); // 5月は4
      expect(extractedDate.getDate()).toBe(10);

      expect(result.card_name).toBe('三井住友カード');
      expect(result.amount).toBe(0);
      expect(result.where_to_use).toBe('不明');
    });

    test('異常系: 日付が空の場合、現在時刻が使用されること', () => {
      // 日付が空のメール本文
      const emailBody = `
三井住友カード 様

三井住友カードの利用のお知らせ
ご利用日時： スーパーマーケット 2,468円
      `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.SMBC);

      // 日付が現在時刻になっていることを検証
      expect(result.datetime_of_use).toBeInstanceOf(Timestamp);
      const extractedDate = result.datetime_of_use.toDate();
      const now = new Date();
      expect(extractedDate.getFullYear()).toBe(now.getFullYear());
      expect(extractedDate.getMonth()).toBe(now.getMonth());

      // 他の情報は正しく抽出されていることを確認
      expect(result.card_name).toBe('三井住友カード');
      expect(result.amount).toBe(2468);
      expect(result.where_to_use).toBe('スーパーマーケット');
    });

    test('異常系: 利用場所情報のみがない場合のテスト', () => {
      // 利用場所情報が欠けているメール本文
      const emailBody = `
三井住友カード 様

三井住友カードの利用のお知らせ
ご利用日時：2025/05/10 15:30 2,468円
      `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.SMBC);

      // 利用場所がデフォルト値（不明）になり、他の情報は正しく抽出されていることを検証
      expect(result.where_to_use).toBe('不明');
      expect(result.card_name).toBe('三井住友カード');
      expect(result.amount).toBe(2468);
      expect(result.datetime_of_use).toBeDefined();
    });

    test('異常系: カード名が様で終わらない場合のテスト', () => {
      // カード名の形式が異なるメール本文
      const emailBody = `
三井住友カード

三井住友カードの利用のお知らせ
ご利用日時：2025/05/10 15:30 スーパーマーケット 2,468円
      `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.SMBC);

      // カード名はデフォルト値になり、他の情報は正しく抽出されていることを検証
      expect(result.card_name).toBe('三井住友カード');
      expect(result.amount).toBe(2468);
      expect(result.where_to_use).toBe('スーパーマーケット');
      expect(result.datetime_of_use).toBeDefined();
    });
  });

  describe('日付変換処理の特殊ケース', () => {
    test('MUFGの日付文字列のフォーマット変換テスト', () => {
      // 特殊なフォーマットの日付を含むメール本文
      const emailBody = `
カード名称：Ｄ　三菱ＵＦＪ－ＪＣＢデビット
デビットカード取引確認メール

【ご利用日時(日本時間)】 2025年5月1日 5:3:1
【ご利用金額】 1,234円
【ご利用先】 コンビニエンスストア東京
【カード番号末尾4桁】 1234
    `;

      // カード情報を抽出
      const result = extractor.extractFromEmailBody(emailBody, CardCompany.MUFG);

      // 日付変換が正しく処理されることを検証
      expect(result.datetime_of_use).toBeInstanceOf(Timestamp);

      // 正しい日付に変換されていることを確認
      const extractedDate = result.datetime_of_use.toDate();
      expect(extractedDate.getFullYear()).toBe(2025);
      expect(extractedDate.getMonth()).toBe(4); // 5月は4
      expect(extractedDate.getDate()).toBe(1);
    });
  });

  test('未対応のカード会社の場合、AppError例外がスローされ適切なエラータイプが設定されること', () => {
    const emailBody = 'テスト本文';

    try {
      // @ts-ignore - テスト用に非対応の値を渡す
      extractor.extractFromEmailBody(emailBody, 'UNKNOWN');
      fail('例外が発生するはずです');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.type).toBe('VALIDATION_ERROR');
      expect(appError.message).toContain('未対応のカード会社');
    }
  });
});