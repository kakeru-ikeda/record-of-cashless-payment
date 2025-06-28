import axios from 'axios';
import { DiscordNotifier } from '../../../../../shared/infrastructure/discord/DiscordNotifier';
import { CardUsageNotificationDTO } from '../../../../../shared/domain/dto/CardUsageNotificationDTO';
import {
    WeeklyReportNotificationDTO,
    DailyReportNotificationDTO,
    MonthlyReportNotificationDTO,
} from '../../../../../shared/domain/dto/ReportNotificationDTOs';
import { logger } from '../../../../../shared/infrastructure/logging/Logger';
import { AppError, ErrorType } from '../../../../../shared/errors/AppError';

// モックの設定
jest.mock('axios');
jest.mock('../../../../../shared/infrastructure/logging/Logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DiscordNotifier', () => {
    // テスト前にモックをリセット
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // テスト用のDiscordNotifierインスタンス生成関数
    const createDiscordNotifier = (options: any = {}) => {
        const defaultOptions = {
            usageWebhookUrl: 'https://discord.com/api/webhooks/usage',
            alertWeeklyWebhookUrl: 'https://discord.com/api/webhooks/alert-weekly',
            alertMonthlyWebhookUrl: 'https://discord.com/api/webhooks/alert-monthly',
            reportDailyWebhookUrl: 'https://discord.com/api/webhooks/report-daily',
            reportWeeklyWebhookUrl: 'https://discord.com/api/webhooks/report-weekly',
            reportMonthlyWebhookUrl: 'https://discord.com/api/webhooks/report-monthly',
            loggingWebhookUrl: 'https://discord.com/api/webhooks/logging',
            ...options
        };
        return new DiscordNotifier(defaultOptions);
    };

    describe('コンストラクタ', () => {
        it('必須URLのみで初期化できること', () => {
            const notifier = new DiscordNotifier({
                usageWebhookUrl: 'https://discord.com/api/webhooks/usage'
            });
            expect(notifier).toBeTruthy();
        });

        it('すべてのURLで初期化できること', () => {
            const notifier = createDiscordNotifier();
            expect(notifier).toBeTruthy();
        });
    });

    describe('_send', () => {
        it('有効なWebhookURLの場合、正常に送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const result = await (notifier as any)._send(
                'https://discord.com/api/webhooks/test',
                [{ title: 'テスト通知' }],
                'テスト通知'
            );

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalledWith(
                'https://discord.com/api/webhooks/test',
                { embeds: [{ title: 'テスト通知' }] }
            );
            expect(logger.info).toHaveBeenCalledTimes(2);
        });

        it('WebhookのURLがnull/空の場合、送信をスキップすること', async () => {
            const notifier = createDiscordNotifier();

            const result = await (notifier as any)._send(
                '',
                [{ title: 'テスト通知' }],
                'テスト通知'
            );

            expect(result).toBe(false);
            expect(mockedAxios.post).not.toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalled();
        });

        it('無効なWebhookのURLの場合、送信をスキップすること', async () => {
            const notifier = createDiscordNotifier();

            const result = await (notifier as any)._send(
                'https://invalid-url.com',
                [{ title: 'テスト通知' }],
                'テスト通知'
            );

            expect(result).toBe(false);
            expect(mockedAxios.post).not.toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalled();
        });

        it('レスポンスステータスが200以外の場合、エラーログを出力してfalseを返すこと', async () => {
            const notifier = createDiscordNotifier();
            // モックの設定
            (axios.post as jest.Mock).mockResolvedValueOnce({
                status: 400,
                data: 'エラーレスポンス'
            });
            (logger.error as jest.Mock).mockImplementation(() => { });

            // 関数の実行
            const result = await (notifier as any)._send(
                'https://discord.com/api/webhooks/test',
                [{ title: 'テスト通知' }],
                'テスト通知'
            );

            // 結果の検証
            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalled();
        });

        it('例外が発生した場合、エラーログを出力してfalseを返すこと', async () => {
            const notifier = createDiscordNotifier();
            // モックの設定
            (axios.post as jest.Mock).mockRejectedValueOnce(new Error('ネットワークエラー'));
            (logger.error as jest.Mock).mockImplementation(() => { });

            // 関数の実行
            const result = await (notifier as any)._send(
                'https://discord.com/api/webhooks/test',
                [{ title: 'テスト通知' }],
                'テスト通知'
            );

            // 結果の検証
            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('notifyCardUsage', () => {
        it('カード利用通知を正常に送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const cardUsageData: CardUsageNotificationDTO = {
                card_name: 'テストカード',
                where_to_use: 'テスト店舗',
                amount: 1000,
                datetime_of_use: new Date('2023-01-01T10:00:00').toISOString(),
            };

            const result = await notifier.notifyCardUsage(cardUsageData);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            expect(postCall[0]).toBe('https://discord.com/api/webhooks/usage');
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toBe('利用情報');
            expect(postData.embeds[0].description).toContain('1,000円');
        });

        it('例外発生時にエラー処理されること', async () => {
            const notifier = createDiscordNotifier();

            // axios.postをモックして例外をスローさせる方法に変更
            mockedAxios.post.mockRejectedValueOnce(new Error('送信エラー'));

            const cardUsageData: CardUsageNotificationDTO = {
                card_name: 'テストカード',
                where_to_use: 'テスト店舗',
                amount: 1000,
                datetime_of_use: new Date('2023-01-01T10:00:00').toISOString(),
            };

            const result = await notifier.notifyCardUsage(cardUsageData);

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalled();
        });

        it('非Errorオブジェクトの例外発生時にも適切に処理されること', async () => {
            const notifier = createDiscordNotifier();

            // Error以外のオブジェクトを投げる
            mockedAxios.post.mockRejectedValueOnce('文字列エラー');

            const cardUsageData: CardUsageNotificationDTO = {
                card_name: 'テストカード',
                where_to_use: 'テスト店舗',
                amount: 1000,
                datetime_of_use: new Date('2023-01-01T10:00:00').toISOString(),
            };

            const result = await notifier.notifyCardUsage(cardUsageData);

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalled();
            
            // logger.errorの最初の呼び出しを確認
            const errorCall = (logger.error as jest.Mock).mock.calls[0];
            expect(errorCall).toBeDefined();
            expect(errorCall[0]).toBeInstanceOf(AppError);
            expect(errorCall[0].message).toBe('カード利用の通知の送信中にエラーが発生しました');
            expect(errorCall[0].originalError).toBeUndefined();
        });
    });

    describe('notifyWeeklyReport', () => {
        it('通常の週次レポートを正常に送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const reportData: WeeklyReportNotificationDTO = {
                title: 'ウィークリーレポート',
                period: '2023/01/01 - 2023/01/07',
                totalAmount: 5000,
                totalCount: 5,
                alertLevel: 0,
                additionalInfo: 'テスト情報'
            };

            const result = await notifier.notifyWeeklyReport(reportData);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            expect(postCall[0]).toBe('https://discord.com/api/webhooks/report-weekly');
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('ウィークリーレポート');
            expect(postData.embeds[0].description).toContain('5,000円');
        });

        it('アラートレベル1の週次レポートを送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const reportData: WeeklyReportNotificationDTO = {
                title: 'ウィークリーアラート',
                period: '2023/01/01 - 2023/01/07',
                totalAmount: 12000,
                totalCount: 8,
                alertLevel: 1,
                additionalInfo: 'レベル1アラート'
            };

            const result = await notifier.notifyWeeklyReport(reportData);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            expect(postCall[0]).toBe('https://discord.com/api/webhooks/alert-weekly');
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('🔔');
            expect(postData.embeds[0].color).toBe(16766720);
        });

        it('アラートレベル2の週次レポートを送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const reportData: WeeklyReportNotificationDTO = {
                title: 'ウィークリーアラート',
                period: '2023/01/01 - 2023/01/07',
                totalAmount: 15000,
                totalCount: 10,
                alertLevel: 2,
                additionalInfo: 'アラート情報'
            };

            const result = await notifier.notifyWeeklyReport(reportData);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            expect(postCall[0]).toBe('https://discord.com/api/webhooks/alert-weekly');
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('ウィークリーアラート');
        });

        it('アラートレベル3の週次レポートを送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const reportData: WeeklyReportNotificationDTO = {
                title: 'ウィークリーアラート',
                period: '2023/01/01 - 2023/01/07',
                totalAmount: 20000,
                totalCount: 15,
                alertLevel: 3,
                additionalInfo: 'レベル3アラート'
            };

            const result = await notifier.notifyWeeklyReport(reportData);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            expect(postCall[0]).toBe('https://discord.com/api/webhooks/alert-weekly');
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('🚨');
            expect(postData.embeds[0].color).toBe(15158332);
        });

        it('例外発生時にエラー処理されること', async () => {
            const notifier = createDiscordNotifier();
            mockedAxios.post.mockRejectedValueOnce(new Error('送信エラー'));

            const reportData: WeeklyReportNotificationDTO = {
                title: 'ウィークリーレポート',
                period: '2023/01/01 - 2023/01/07',
                totalAmount: 5000,
                totalCount: 5,
                alertLevel: 0
            };

            const result = await notifier.notifyWeeklyReport(reportData);

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('notifyDailyReport', () => {
        it('日次レポートを正常に送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const reportData: DailyReportNotificationDTO = {
                title: 'デイリーレポート',
                date: '2023/01/01',
                totalAmount: 2000,
                totalCount: 2,
                additionalInfo: 'テスト情報'
            };

            const result = await notifier.notifyDailyReport(reportData);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            expect(postCall[0]).toBe('https://discord.com/api/webhooks/report-daily');
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('デイリーレポート');
            expect(postData.embeds[0].description).toContain('2,000円');
        });

        it('例外発生時にエラー処理されること', async () => {
            const notifier = createDiscordNotifier();
            mockedAxios.post.mockRejectedValueOnce(new Error('送信エラー'));

            const reportData: DailyReportNotificationDTO = {
                title: 'デイリーレポート',
                date: '2023/01/01',
                totalAmount: 2000,
                totalCount: 2
            };

            const result = await notifier.notifyDailyReport(reportData);

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('notifyMonthlyReport', () => {
        it('通常の月次レポートを正常に送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const reportData: MonthlyReportNotificationDTO = {
                title: 'マンスリーレポート',
                period: '2023/01',
                totalAmount: 50000,
                totalCount: 20,
                alertLevel: 0,
                additionalInfo: 'テスト情報'
            };

            const result = await notifier.notifyMonthlyReport(reportData);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            expect(postCall[0]).toBe('https://discord.com/api/webhooks/report-monthly');
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('マンスリーレポート');
            expect(postData.embeds[0].description).toContain('50,000円');
        });

        it('アラートレベル1の月次レポートを送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const reportData: MonthlyReportNotificationDTO = {
                title: 'マンスリーアラート',
                period: '2023/01',
                totalAmount: 80000,
                totalCount: 30,
                alertLevel: 1,
                additionalInfo: 'アラート情報'
            };

            const result = await notifier.notifyMonthlyReport(reportData);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            expect(postCall[0]).toBe('https://discord.com/api/webhooks/alert-monthly');
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('🔔');
            expect(postData.embeds[0].color).toBe(16766720);
        });

        it('アラートレベル2の月次レポートを送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const reportData: MonthlyReportNotificationDTO = {
                title: 'マンスリーアラート',
                period: '2023/01',
                totalAmount: 90000,
                totalCount: 40,
                alertLevel: 2,
                additionalInfo: 'アラート情報'
            };

            const result = await notifier.notifyMonthlyReport(reportData);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            expect(postCall[0]).toBe('https://discord.com/api/webhooks/alert-monthly');
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('マンスリーアラート');
            expect(postData.embeds[0].color).toBe(15548997);
        });

        it('アラートレベル付きの月次レポートを送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const reportData: MonthlyReportNotificationDTO = {
                title: 'マンスリーアラート',
                period: '2023/01',
                totalAmount: 100000,
                totalCount: 50,
                alertLevel: 3,
                additionalInfo: 'アラート情報'
            };

            const result = await notifier.notifyMonthlyReport(reportData);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            expect(postCall[0]).toBe('https://discord.com/api/webhooks/alert-monthly');
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('マンスリーアラート');
        });

        it('例外発生時にエラー処理されること', async () => {
            const notifier = createDiscordNotifier();
            mockedAxios.post.mockRejectedValueOnce(new Error('送信エラー'));

            const reportData: MonthlyReportNotificationDTO = {
                title: 'マンスリーレポート',
                period: '2023/01',
                totalAmount: 50000,
                totalCount: 20,
                alertLevel: 0
            };

            const result = await notifier.notifyMonthlyReport(reportData);

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('notifyError', () => {
        it('エラー通知を正常に送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const error = new AppError('テストエラー', ErrorType.VALIDATION);
            const result = await notifier.notifyError(error, 'テストコンテキスト');

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            expect(postCall[0]).toBe('https://discord.com/api/webhooks/logging');
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('エラー発生');
            expect(postData.embeds[0].fields[0].value).toBe('テストエラー');
        });

        it('AUTHENTICATION/AUTHORIZATIONエラーの通知を送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const error = new AppError('認証エラー', ErrorType.AUTHENTICATION);
            const result = await notifier.notifyError(error);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('🔒');
            expect(postData.embeds[0].color).toBe(15548997);
        });

        it('DISCORDエラーの通知を送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const error = new AppError('Discord エラー', ErrorType.DISCORD);
            const result = await notifier.notifyError(error);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('🔌');
            expect(postData.embeds[0].color).toBe(10181046);
        });

        it('EMAILエラーの通知を送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const error = new AppError('メールエラー', ErrorType.EMAIL);
            const result = await notifier.notifyError(error);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('📧');
            expect(postData.embeds[0].color).toBe(3447003);
        });

        it('DATA_ACCESS/FIREBASEエラーの通知を送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const error = new AppError('データアクセスエラー', ErrorType.DATA_ACCESS);
            const result = await notifier.notifyError(error);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('🗄️');
            expect(postData.embeds[0].color).toBe(1752220);
        });

        it('NETWORKエラーの通知を送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const error = new AppError('ネットワークエラー', ErrorType.NETWORK);
            const result = await notifier.notifyError(error);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('🌐');
            expect(postData.embeds[0].color).toBe(12370112);
        });

        it('AUTHORIZATION エラーの通知を送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const error = new AppError('認可エラー', ErrorType.AUTHORIZATION);
            const result = await notifier.notifyError(error);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('🔒');
            expect(postData.embeds[0].color).toBe(15548997);
        });

        it('FIREBASE エラーの通知を送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const error = new AppError('Firebase エラー', ErrorType.FIREBASE);
            const result = await notifier.notifyError(error);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('🗄️');
            expect(postData.embeds[0].color).toBe(1752220);
        });

        it('デフォルトエラー（UNKNOWN）の通知を送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            // 意図的に定義されていないエラータイプを使用
            const error = new AppError('不明なエラー', 'UNKNOWN' as ErrorType);
            const result = await notifier.notifyError(error);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('❌');
            expect(postData.embeds[0].color).toBe(15158332);
        });

        it('詳細情報付きのエラー通知を送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const error = new AppError(
                '詳細エラー',
                ErrorType.NETWORK,
                { userId: '123', operation: 'test' }
            );
            const result = await notifier.notifyError(error);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            const postData = postCall[1] as any;
            const embed = postData.embeds[0];

            // 詳細情報が含まれていることを確認
            const detailsField = embed.fields.find((field: any) => field.name === '詳細情報');
            expect(detailsField).toBeTruthy();
            expect(detailsField.value).toContain('userId');
            expect(detailsField.value).toContain('123');
        });

        it('スタックトレース付きのエラー通知を送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const originalError = new Error('原因エラー');
            originalError.stack = 'Error: 原因エラー\n    at test (file.ts:10:5)\n    at another (file.ts:20:10)';

            const error = new AppError(
                'スタックトレース付きエラー',
                ErrorType.GENERAL,
                {},
                originalError
            );
            const result = await notifier.notifyError(error);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            const postData = postCall[1] as any;
            const embed = postData.embeds[0];

            // スタックトレースが含まれていることを確認
            const stackField = embed.fields.find((field: any) => field.name === 'スタックトレース');
            expect(stackField).toBeTruthy();
            expect(stackField.value).toContain('原因エラー');
        });

        it('長いスタックトレースが適切に切り詰められること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const originalError = new Error('長いスタックトレース');
            // 1000文字を超える長いスタックトレースを作成
            originalError.stack = 'Error: 長いスタックトレース\n' + 'a'.repeat(1200);

            const error = new AppError(
                '長いスタックトレース付きエラー',
                ErrorType.GENERAL,
                {},
                originalError
            );
            const result = await notifier.notifyError(error);

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            const postData = postCall[1] as any;
            const embed = postData.embeds[0];

            // スタックトレースが切り詰められていることを確認
            const stackField = embed.fields.find((field: any) => field.name === 'スタックトレース');
            expect(stackField).toBeTruthy();
            expect(stackField.value).toContain('...(省略)');
            expect(stackField.value.length).toBeLessThan(1100); // 切り詰められて短くなっている
        });

        it('例外発生時に処理を続行すること', async () => {
            const notifier = createDiscordNotifier();

            // スパイを使うのではなく、axiosのモックを直接設定
            mockedAxios.post.mockRejectedValueOnce(new Error('送信エラー'));

            const error = new AppError('テストエラー', ErrorType.NETWORK);
            const result = await notifier.notifyError(error);

            expect(result).toBe(false);
        });
    });

    describe('notifyLogging', () => {
        it('ログメッセージを正常に送信できること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const result = await notifier.notifyLogging('テストメッセージ', 'テストタイトル', 'テストコンテキスト');

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            expect(postCall[0]).toBe('https://discord.com/api/webhooks/logging');
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('テストタイトル');
            expect(postData.embeds[0].fields[0].value).toBe('テストメッセージ');
            expect(postData.embeds[0].fields[1].value).toBe('テストコンテキスト');
        });

        it('タイトルとコンテキスト省略時にデフォルト値を使用すること', async () => {
            const notifier = createDiscordNotifier();
            (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ status: 204 });

            const result = await notifier.notifyLogging('テストメッセージ');

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalled();
            const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
            const postData = postCall[1] as any;
            expect(postData.embeds[0].title).toContain('システムログ');
            expect(postData.embeds[0].fields[1].value).toBe('DiscordNotifier');
        });

        it('例外発生時に処理を続行すること', async () => {
            const notifier = createDiscordNotifier();

            // スパイを使うのではなく、axiosのモックを直接設定
            mockedAxios.post.mockRejectedValueOnce(new Error('送信エラー'));

            const result = await notifier.notifyLogging('テストメッセージ');

            expect(result).toBe(false);
        });
    });
});
