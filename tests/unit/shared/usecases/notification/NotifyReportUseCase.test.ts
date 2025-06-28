import { NotifyReportUseCase } from '../../../../../shared/usecases/notification/NotifyReportUseCase';
import { IDiscordNotifier } from '../../../../../shared/domain/interfaces/discord/IDiscordNotifier';
import { DailyReportNotificationDTO, WeeklyReportNotificationDTO, MonthlyReportNotificationDTO } from '../../../../../shared/domain/dto/ReportNotificationDTOs';

// Loggerをモック化
jest.mock('../../../../../shared/infrastructure/logging/Logger', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        logAppError: jest.fn(),
        updateServiceStatus: jest.fn()
    }
}));

// ErrorHandlerをモック化
jest.mock('../../../../../shared/infrastructure/errors/ErrorHandler', () => ({
    ErrorHandler: {
        errorDecorator: () => () => (
            _target: any,
            _propertyKey: string | symbol,
            descriptor: PropertyDescriptor
        ) => descriptor,
        handle: jest.fn(),
        extractErrorInfoFromArgs: jest.fn()
    }
}));

describe('NotifyReportUseCase', () => {
    let notifyReportUseCase: NotifyReportUseCase;
    let mockDiscordNotifier: jest.Mocked<IDiscordNotifier>;

    // テスト用データ
    const sampleDailyReportNotification: DailyReportNotificationDTO = {
        title: '2024年06月15日のデイリーレポート',
        date: '2024-06-15',
        totalAmount: 5000,
        totalCount: 3,
        additionalInfo: 'テスト用のデイリーレポート'
    };

    const sampleWeeklyReportNotification: WeeklyReportNotificationDTO = {
        title: '2024年06月第3週のウィークリーレポート',
        period: '2024/06/15 〜 2024/06/21',
        totalAmount: 25000,
        totalCount: 15,
        alertLevel: 1,
        additionalInfo: 'テスト用のウィークリーレポート'
    };

    const sampleMonthlyReportNotification: MonthlyReportNotificationDTO = {
        title: '2024年06月のマンスリーレポート',
        period: '2024/06/01 〜 2024/06/30',
        totalAmount: 100000,
        totalCount: 50,
        alertLevel: 2,
        additionalInfo: 'テスト用のマンスリーレポート'
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // DiscordNotifierのモックを作成
        mockDiscordNotifier = {
            notifyCardUsage: jest.fn(),
            notifyDailyReport: jest.fn(),
            notifyWeeklyReport: jest.fn(),
            notifyMonthlyReport: jest.fn(),
            notifyError: jest.fn(),
            notifyLogging: jest.fn()
        };

        notifyReportUseCase = new NotifyReportUseCase(mockDiscordNotifier);
    });

    describe('notifyDailyReport', () => {
        test('正常系: デイリーレポートが正常に通知されること', async () => {
            // モックの設定
            mockDiscordNotifier.notifyDailyReport.mockResolvedValueOnce(true);

            // 実行
            await notifyReportUseCase.notifyDailyReport(sampleDailyReportNotification);

            // 検証
            expect(mockDiscordNotifier.notifyDailyReport).toHaveBeenCalledWith(sampleDailyReportNotification);
            expect(mockDiscordNotifier.notifyDailyReport).toHaveBeenCalledTimes(1);
        });

        test('異常系: Discord通知でエラーが発生した場合、エラーがスローされること', async () => {
            // モックの設定
            const error = new Error('Discord API エラー');
            mockDiscordNotifier.notifyDailyReport.mockRejectedValueOnce(error);

            // 実行と検証
            await expect(notifyReportUseCase.notifyDailyReport(sampleDailyReportNotification))
                .rejects.toThrow('Discord API エラー');
            expect(mockDiscordNotifier.notifyDailyReport).toHaveBeenCalledWith(sampleDailyReportNotification);
        });
    });

    describe('notifyWeeklyReport', () => {
        test('正常系: ウィークリーレポートが正常に通知されること', async () => {
            // モックの設定
            mockDiscordNotifier.notifyWeeklyReport.mockResolvedValueOnce(true);

            // 実行
            await notifyReportUseCase.notifyWeeklyReport(sampleWeeklyReportNotification);

            // 検証
            expect(mockDiscordNotifier.notifyWeeklyReport).toHaveBeenCalledWith(sampleWeeklyReportNotification);
            expect(mockDiscordNotifier.notifyWeeklyReport).toHaveBeenCalledTimes(1);
        });

        test('異常系: Discord通知でエラーが発生した場合、エラーがスローされること', async () => {
            // モックの設定
            const error = new Error('ネットワークエラー');
            mockDiscordNotifier.notifyWeeklyReport.mockRejectedValueOnce(error);

            // 実行と検証
            await expect(notifyReportUseCase.notifyWeeklyReport(sampleWeeklyReportNotification))
                .rejects.toThrow('ネットワークエラー');
            expect(mockDiscordNotifier.notifyWeeklyReport).toHaveBeenCalledWith(sampleWeeklyReportNotification);
        });
    });

    describe('notifyMonthlyReport', () => {
        test('正常系: マンスリーレポートが正常に通知されること', async () => {
            // モックの設定
            mockDiscordNotifier.notifyMonthlyReport.mockResolvedValueOnce(true);

            // 実行
            await notifyReportUseCase.notifyMonthlyReport(sampleMonthlyReportNotification);

            // 検証
            expect(mockDiscordNotifier.notifyMonthlyReport).toHaveBeenCalledWith(sampleMonthlyReportNotification);
            expect(mockDiscordNotifier.notifyMonthlyReport).toHaveBeenCalledTimes(1);
        });

        test('異常系: Discord通知でエラーが発生した場合、エラーがスローされること', async () => {
            // モックの設定
            const error = new Error('サーバーエラー');
            mockDiscordNotifier.notifyMonthlyReport.mockRejectedValueOnce(error);

            // 実行と検証
            await expect(notifyReportUseCase.notifyMonthlyReport(sampleMonthlyReportNotification))
                .rejects.toThrow('サーバーエラー');
            expect(mockDiscordNotifier.notifyMonthlyReport).toHaveBeenCalledWith(sampleMonthlyReportNotification);
        });
    });

    describe('通知内容の検証', () => {
        test('デイリーレポート通知のデータ構造が正しいこと', () => {
            expect(sampleDailyReportNotification).toHaveProperty('title');
            expect(sampleDailyReportNotification).toHaveProperty('date');
            expect(sampleDailyReportNotification).toHaveProperty('totalAmount');
            expect(sampleDailyReportNotification).toHaveProperty('totalCount');
            expect(sampleDailyReportNotification).toHaveProperty('additionalInfo');
        });

        test('ウィークリーレポート通知のデータ構造が正しいこと', () => {
            expect(sampleWeeklyReportNotification).toHaveProperty('title');
            expect(sampleWeeklyReportNotification).toHaveProperty('period');
            expect(sampleWeeklyReportNotification).toHaveProperty('totalAmount');
            expect(sampleWeeklyReportNotification).toHaveProperty('totalCount');
            expect(sampleWeeklyReportNotification).toHaveProperty('alertLevel');
            expect(sampleWeeklyReportNotification.alertLevel).toBe(1);
        });

        test('マンスリーレポート通知のデータ構造が正しいこと', () => {
            expect(sampleMonthlyReportNotification).toHaveProperty('title');
            expect(sampleMonthlyReportNotification).toHaveProperty('period');
            expect(sampleMonthlyReportNotification).toHaveProperty('totalAmount');
            expect(sampleMonthlyReportNotification).toHaveProperty('totalCount');
            expect(sampleMonthlyReportNotification).toHaveProperty('alertLevel');
            expect(sampleMonthlyReportNotification.alertLevel).toBe(2);
        });
    });
});
