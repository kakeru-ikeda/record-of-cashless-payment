import { DiscordWebhookNotifier } from '../../../shared/discord/DiscordNotifier';
import { TestHelper } from '../../helpers/TestHelper';
import axios from 'axios';

// axiosをモック化
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DiscordWebhookNotifier', () => {
    // テスト対象のインスタンス
    let notifier: DiscordWebhookNotifier;

    // テスト用の定数
    const validWebhookUrl = 'https://discord.com/api/webhooks/test';
    const mockData = TestHelper.getMockCardUsageData();

    // 各テスト前の準備
    beforeEach(() => {
        // テスト対象のインスタンスを作成
        notifier = new DiscordWebhookNotifier(validWebhookUrl);
        // モックをリセット
        jest.clearAllMocks();
    });

    test('有効なWebhookURLで通知が成功すること', async () => {
        // axiosのレスポンスをモック
        mockedAxios.post.mockResolvedValueOnce({ status: 204 });

        // テスト対象のメソッドを実行
        const result = await notifier.notify(mockData);

        // 期待する結果の検証
        expect(result).toBe(true);
        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
        expect(mockedAxios.post).toHaveBeenCalledWith(
            validWebhookUrl,
            expect.objectContaining({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        title: '利用情報',
                        fields: expect.arrayContaining([
                            expect.objectContaining({ value: 'マツヤ' })
                        ])
                    })
                ])
            })
        );
    });

    test('WebhookURLが設定されていない場合、通知がスキップされること', async () => {
        // 空のWebhookURLでインスタンスを作成
        notifier = new DiscordWebhookNotifier('');

        // テスト対象のメソッドを実行
        const result = await notifier.notify(mockData);

        // 期待する結果の検証
        expect(result).toBe(false);
        expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    test('無効なWebhookURLの場合、通知が失敗すること', async () => {
        // 無効なWebhookURLでインスタンスを作成
        notifier = new DiscordWebhookNotifier('invalid-url');

        // テスト対象のメソッドを実行
        const result = await notifier.notify(mockData);

        // 期待する結果の検証
        expect(result).toBe(false);
        expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    test('通知送信中にエラーが発生した場合、falseを返すこと', async () => {
        // axiosがエラーをスローするようにモック
        mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

        // テスト対象のメソッドを実行
        const result = await notifier.notify(mockData);

        // 期待する結果の検証
        expect(result).toBe(false);
    });
});

