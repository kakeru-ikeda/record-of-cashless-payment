import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@shared/infrastructure/logging/Logger';
import { ProcessEmailUseCase } from '@usecase/email/ProcessEmailUseCase';
import { CardCompany } from '@domain/entities/card/CardTypes';

/**
 * テストモードの実行を担当するクラス
 */
export class TestRunner {
  private processEmailUseCase: ProcessEmailUseCase;

  constructor(processEmailUseCase: ProcessEmailUseCase) {
    this.processEmailUseCase = processEmailUseCase;
  }

  /**
   * サンプルメールを使ったテスト実行
   * @param cardCompany テスト対象のカード会社
   */
  public async runSampleMailTest(cardCompany: CardCompany = CardCompany.MUFG): Promise<any> {
    logger.info('テストモードで実行しています...', 'TestMode');

    try {
      // サンプルメールファイルを読み込む
      const sampleMailPath = path.resolve(__dirname, '../../../../samplemail.txt');
      logger.info('サンプルメールを読み込んでいます: ' + sampleMailPath, 'TestMode');

      // ファイルが存在するか確認
      if (!fs.existsSync(sampleMailPath)) {
        throw new Error(`サンプルメールファイルが見つかりません: ${sampleMailPath}`);
      }

      const sampleMailContent = fs.readFileSync(sampleMailPath, 'utf8');
      logger.info(`${cardCompany}のサンプルメールでテスト実行します...`, 'TestMode');

      // テスト実行
      const result = await this.processEmailUseCase.executeTest(sampleMailContent, cardCompany);
      logger.info('テスト結果: ' + JSON.stringify(result), 'TestMode');
      return result;
    } catch (error) {
      throw error;
    }
  }
}