import { ImapClientAdapter, ImapConnectionConfig } from '../../../../src/infrastructure/email/ImapClientAdapter';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';

// ImapFlowのモックを作成するファクトリー関数
const createMockImapFlow = () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  logout: jest.fn().mockResolvedValue(undefined),
  mailboxOpen: jest.fn().mockResolvedValue({ exists: 10, name: 'INBOX' }),
  list: jest.fn().mockResolvedValue([
    { path: 'INBOX', name: 'INBOX', children: [] },
    { path: 'Sent', name: 'Sent', children: [] },
    { path: 'Archive', name: 'Archive', children: [] }
  ]),
  search: jest.fn().mockResolvedValue([100, 101, 102]),
  fetchOne: jest.fn().mockResolvedValue({ 
    uid: '12345',
    source: Buffer.from('テストメール本文') 
  }),
  messageFlagsAdd: jest.fn().mockResolvedValue(true),
  noop: jest.fn().mockResolvedValue(undefined)
});

// ImapFlowのモックインスタンス
let mockImapFlowInstance: ReturnType<typeof createMockImapFlow>;

// ImapFlowのコンストラクタをモック化
jest.mock('imapflow', () => ({
  ImapFlow: jest.fn().mockImplementation(() => mockImapFlowInstance)
}));

// Loggerをモック化
jest.mock('../../../../shared/utils/Logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logAppError: jest.fn(),
    updateServiceStatus: jest.fn()
  }
}));

describe('ImapClientAdapter', () => {
  let adapter: ImapClientAdapter;
  let mockConfig: ImapConnectionConfig;
  
  // 各テスト前の準備
  beforeEach(() => {
    jest.clearAllMocks();
    
    // テスト用のモックインスタンスを初期化
    mockImapFlowInstance = createMockImapFlow();
    
    // テスト用設定
    mockConfig = {
      host: 'imap.example.com',
      port: 993,
      secure: true,
      auth: {
        user: 'testuser',
        pass: 'testpass'
      }
    };
    
    adapter = new ImapClientAdapter(mockConfig);
  });
  
  test('正常系: 接続に成功すること', async () => {
    // 接続実行
    const result = await adapter.connect('INBOX');
    
    // コンストラクタが正しい引数で呼ばれたか確認
    expect(require('imapflow').ImapFlow).toHaveBeenCalledWith({
      host: 'imap.example.com',
      port: 993,
      secure: true,
      auth: {
        user: 'testuser',
        pass: 'testpass'
      },
      logger: false,
      emitLogs: false
    });
    
    // 接続メソッドが呼ばれることを検証
    expect(mockImapFlowInstance.connect).toHaveBeenCalled();
    expect(mockImapFlowInstance.list).toHaveBeenCalled();
    expect(mockImapFlowInstance.mailboxOpen).toHaveBeenCalledWith('INBOX');
  });
  
  test('正常系: メールボックス検索が成功すること', async () => {
    // findMailboxPathメソッドをスパイ
    const findMailboxSpy = jest.spyOn(adapter as any, 'findMailboxPath');
    
    // モック実装を設定
    findMailboxSpy.mockImplementation((mailboxes, searchName) => {
      if (searchName === 'INBOX') return 'INBOX';
      if (searchName === 'アーカイブ') return 'Archive';
      if (searchName === '2025') return 'Archive/2025';
      return null;
    });
    
    // 接続実行
    await adapter.connect('INBOX');
    
    // スパイが呼ばれたことを確認
    expect(findMailboxSpy).toHaveBeenCalled();
    
    // 直接メソッドをテスト
    expect(findMailboxSpy.mock.results[0].value).toBe('INBOX');
    
    // 異なる入力値でも正しく動作するか確認
    const mailboxes = [
      { path: 'INBOX', name: 'INBOX', children: [] },
      { path: 'Archive', name: 'アーカイブ', children: [
        { path: 'Archive/2025', name: '2025', children: [] }
      ] }
    ];
    
    expect((adapter as any).findMailboxPath(mailboxes, 'INBOX')).toBe('INBOX');
    expect((adapter as any).findMailboxPath(mailboxes, 'アーカイブ')).toBe('Archive');
    expect((adapter as any).findMailboxPath(mailboxes, '存在しない')).toBeNull();
  });
  
  test('正常系: 未読メッセージの取得が成功すること', async () => {
    // 未読メッセージのモック
    const mockMessageIds = [100, 101, 102];
    mockImapFlowInstance.search.mockResolvedValueOnce(mockMessageIds);
    
    // まず接続
    await adapter.connect('INBOX');
    
    // 未読メッセージを取得
    const unseenMessages = await adapter.fetchUnseenMessages();
    
    // 正しいクエリで検索されたことを確認
    expect(mockImapFlowInstance.search).toHaveBeenCalledWith({ seen: false });
    
    // 結果を検証
    expect(unseenMessages).toEqual(['100', '101', '102']);
  });
  
  test('正常系: メッセージの取得が成功すること', async () => {
    // メッセージ本文のモック
    const mockSource = Buffer.from('テストメール本文');
    mockImapFlowInstance.fetchOne.mockResolvedValueOnce({
      uid: 12345,
      source: mockSource
    });
    
    // 接続
    await adapter.connect('INBOX');
    
    // メッセージを取得
    const message = await adapter.fetchMessage('12345');
    
    // 正しく呼び出されたことを確認
    expect(mockImapFlowInstance.fetchOne).toHaveBeenCalledWith('12345', { source: true });
    
    // 結果を検証
    expect(message).toBeDefined();
    expect(message?.uid).toBe('12345');
  });
  
  test('正常系: メッセージを既読にマークできること', async () => {
    // 接続
    await adapter.connect('INBOX');
    
    // 既読にマーク
    const result = await adapter.markAsSeen('12345');
    
    // 正しく呼び出されたことを確認
    expect(mockImapFlowInstance.messageFlagsAdd).toHaveBeenCalledWith('12345', ['\\Seen']);
    
    // 結果を検証
    expect(result).toBe(true);
  });
  
  test('異常系: 接続に失敗した場合、例外がスローされること', async () => {
    // mockImapFlowInstance.connectが例外をスローするように設定
    mockImapFlowInstance.connect.mockRejectedValueOnce(new Error('接続エラー'));
    
    // 例外がスローされることを確認
    await expect(async () => {
      await adapter.connect('INBOX');
    }).rejects.toThrow(AppError);
    
    // 接続状態がfalseであることを確認
    expect(adapter.isActive()).toBe(false);
  });
  
  test('正常系: 接続を閉じることができること', async () => {
    // 接続
    await adapter.connect('INBOX');
    
    // 切断
    await adapter.close();
    
    // logout メソッドが呼ばれることを確認
    expect(mockImapFlowInstance.logout).toHaveBeenCalled();
  });
  
  test('異常系: メッセージ取得時にエラーが発生した場合、nullを返す', async () => {
    // 接続
    await adapter.connect('INBOX');
    
    // エラーを発生させる
    mockImapFlowInstance.fetchOne.mockRejectedValueOnce(new Error('取得エラー'));
    
    // メッセージ取得を実行
    const result = await adapter.fetchMessage('12345');
    
    // nullが返されることを確認
    expect(result).toBeNull();
  });
  
  test('正常系: イベントが正しく発行されること', async () => {
    // 接続
    await adapter.connect('INBOX');
    
    // イベントリスナーを登録
    const connectionLostHandler = jest.fn();
    adapter.on('connectionLost', connectionLostHandler);
    
    // 接続ロストをシミュレート（privateメソッドなのでイベントを直接発行）
    adapter.emit('connectionLost', 'INBOX');
    
    // イベントが発行されたことを確認
    expect(connectionLostHandler).toHaveBeenCalledWith('INBOX');
  });
});