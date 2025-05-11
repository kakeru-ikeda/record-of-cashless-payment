import { ProcessEmailUseCase } from '../../../src/usecases/ProcessEmailUseCase';
import { MockEmailService } from '../../mocks/MockEmailService';
import { MockCardUsageRepository } from '../../mocks/MockCardUsageRepository';
import { MockDiscordNotifier } from '../../mocks/MockDiscordNotifier';
import { TestHelper } from '../../helpers/TestHelper';
import { mockLogger } from '../../mocks/MockLogger';
import { AppError, ErrorType } from '../../../shared/errors/AppError';
import * as admin from 'firebase-admin';

// Loggerをモック化
jest.mock('../../../shared/utils/Logger', () => require('../../mocks/Logger'));

describe('ProcessEmailUseCase', () => {
    // テスト用のモックオブジェクト
    let emailService: MockEmailService;
    let repository: MockCardUsageRepository;
    let notifier: MockDiscordNotifier;
    
    // テスト対象のユースケース
    let useCase: ProcessEmailUseCase;
    
    // テスト用のサンプルメール
    let sampleEmail: string;

    // 各テスト前の準備
    beforeEach(() => {
        // モックロガーをクリア
        mockLogger.clear();
        
        // モックオブジェクトを初期化
        emailService = new MockEmailService();
        repository = new MockCardUsageRepository();
        notifier = new MockDiscordNotifier();
        
        // テスト対象のユースケースを作成
        useCase = new ProcessEmailUseCase(emailService, repository, notifier);
        
        // サンプルメールを読み込む
        try {
            sampleEmail = TestHelper.loadSampleEmail();
        } catch (error) {
            // サンプルメールが読み込めない場合はダミーテキストを使用
            console.warn('サンプルメールが読み込めませんでした。ダミーテキストを使用します。');
            sampleEmail = 'ダミーメール本文';
        }
        
        // Firestoreのモック設定
        jest.spyOn(admin.firestore, 'Timestamp').mockReturnValue({
            toDate: () => new Date('2025-01-21T03:08:00.000Z'),
            toMillis: () => new Date('2025-01-21T03:08:00.000Z').getTime(),
            isEqual: () => true,
            valueOf: () => ({} as any),
            toJSON: () => ({} as any),
            _seconds: 0,
            _nanoseconds: 0
        } as any);

        jest.spyOn(admin.firestore.FieldValue, 'serverTimestamp').mockReturnValue({
            _methodName: 'serverTimestamp'
        } as any);

        // メールパース結果のモック
        jest.spyOn(emailService, 'parseCardUsageFromEmail').mockResolvedValue({
            card_name: 'Ｄ　三菱ＵＦＪ－ＪＣＢデビット',
            datetime_of_use: '2025-01-21T03:08:00.000Z',
            amount: 390,
            where_to_use: 'マツヤ'
        });
    });

    test('正常系: メール処理が正常に完了すること', async () => {
        // メール処理を実行
        const result = await useCase.execute(sampleEmail);
        
        // データが保存されたことを検証
        expect(result).toBeDefined();
        expect(result).toMatch(/^details\/\d{4}\/\d{2}\/\d+$/);
        
        // リポジトリにデータが保存されたか検証
        expect(repository.getItemCount()).toBe(1);
        
        // Discord通知が送信されたか検証
        expect(notifier.getNotifications().length).toBe(1);
        const notification = notifier.getLastNotification();
        expect(notification).toBeDefined();
        expect(notification?.amount).toBe(390);
        expect(notification?.where_to_use).toBe('マツヤ');
        
        // ログ出力を検証 - 特定のメッセージが含まれているか確認
        const infoMessages = mockLogger.messages.filter(m => m.level === 'info');
        expect(infoMessages.some(m => m.message.includes('カード利用情報を保存しました'))).toBe(true);
        expect(infoMessages.some(m => m.message.includes('Discord通知を送信しました'))).toBe(true);
    });

    test('異常系: メールのパースに失敗した場合', async () => {
        // パースエラーを発生させる
        const parseError = new Error('パースエラー');
        jest.spyOn(emailService, 'parseCardUsageFromEmail')
            .mockRejectedValueOnce(parseError);
        
        // エラーがスローされることを検証
        await expect(useCase.execute('invalid email'))
            .rejects.toThrow('パースエラー');
        
        // データが保存されていないことを検証
        expect(repository.getItemCount()).toBe(0);
        
        // 通知が送信されていないことを検証
        expect(notifier.getNotifications().length).toBe(0);
        
        // エラーログを検証 - AppErrorが記録されていることを確認
        expect(mockLogger.appErrors.length).toBeGreaterThan(0);
        expect(mockLogger.appErrors[0].error.message).toContain('メール処理中にエラーが発生しました');
    });

    test('異常系: データ保存に失敗した場合', async () => {
        // 保存エラーを発生させる
        const saveError = new AppError(
            'データ保存エラー',
            ErrorType.DATA_ACCESS,
            { test: true }
        );
        jest.spyOn(repository, 'save')
            .mockRejectedValueOnce(saveError);
        
        // エラーがスローされることを検証
        await expect(useCase.execute(sampleEmail))
            .rejects.toThrow('データ保存エラー');
        
        // 通知が送信されていないことを検証
        expect(notifier.getNotifications().length).toBe(0);
        
        // AppErrorが記録されていることを検証
        expect(mockLogger.appErrors.length).toBeGreaterThan(0);
        expect(mockLogger.appErrors[0].error.type).toBe(ErrorType.DATA_ACCESS);
    });

    test('異常系: Discord通知に失敗した場合でもデータは保存されること', async () => {
        // 通知が失敗するよう設定
        notifier.setShouldFail(true);
        
        // エラーがスローされることを検証
        await expect(useCase.execute(sampleEmail))
            .rejects.toThrow('Discord通知の送信に失敗しました');
        
        // データは保存されているはず
        expect(repository.getItemCount()).toBe(1);
        
        // エラーログが出力されていることを検証
        expect(mockLogger.appErrors.length).toBeGreaterThan(0);
        expect(mockLogger.appErrors[0].error.message).toContain('カード利用通知の送信に失敗しました');
    });
});
