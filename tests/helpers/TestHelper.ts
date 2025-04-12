
import * as fs from 'fs';
import * as path from 'path';

/**
 * テストヘルパークラス
 */
export class TestHelper {
  /**
   * サンプルメールのコンテンツを読み込む
   * @returns サンプルメールの内容
   */
  static loadSampleEmail(): string {
    const samplePath = path.resolve(__dirname, '../../..', 'samplemail.txt');
    try {
      return fs.readFileSync(samplePath, 'utf8');
    } catch (error) {
      throw new Error(`サンプルメールの読み込みに失敗しました: ${error.message}`);
    }
  }

  /**
   * テスト用の日付を生成する
   * @returns 固定の日付
   */
  static createMockDate(): Date {
    return new Date('2025-01-21T12:08:00+09:00');
  }

  /**
   * テスト用のカード利用データを取得する
   * @returns カード利用データ
   */
  static getMockCardUsageData() {
    return {
      card_name: 'Ｄ　三菱ＵＦＪ－ＪＣＢデビット',
      datetime_of_use: this.createMockDate().toISOString(),
      amount: 390,
      where_to_use: 'マツヤ'
    };
  }

  /**
   * メール本文からテキスト部分を抽出する
   * @param emailContent メールの全文
   * @returns 抽出されたテキスト部分
   */
  static extractTextFromEmail(emailContent: string): string {
    // HTMLメール本文の部分を抽出（全文から本文部分のみを取得）
    const bodyMatch = emailContent.match(/Content - Type: text \/ plain;[\s\S]+?------/);

    if (bodyMatch && bodyMatch[0]) {
      return bodyMatch[0];
    }

    // 抽出できない場合は元のコンテンツを返す
    return emailContent;
  }
}