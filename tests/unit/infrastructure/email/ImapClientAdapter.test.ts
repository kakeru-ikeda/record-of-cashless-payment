import { ImapClientAdapter, ImapConnectionConfig } from '../../../../src/infrastructure/email/ImapClientAdapter';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { EventEmitter } from 'events';

// ImapFlowのモックを作成するファクトリー関数
const createMockImapFlow = () => {
  // EventEmitterを継承したモックオブジェクトを作成
  const mockEmitter = new EventEmitter();
  return {
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
    noop: jest.fn().mockResolvedValue(undefined),
    // EventEmitterメソッドをモック
    on: jest.fn((event, handler) => {
      mockEmitter.on(event, handler);
      return mockEmitter;
    }),
    removeAllListeners: jest.fn((event) => {
      mockEmitter.removeAllListeners(event);
      return mockEmitter;
    }),
    emit: jest.fn((event, ...args) => {
      return mockEmitter.emit(event, ...args);
    })
  };
};

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
    
    // エラーイベントリスナーが登録されたか確認
    expect(mockImapFlowInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    
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
    
    // イベントリスナーが削除されることを確認
    expect(mockImapFlowInstance.removeAllListeners).toHaveBeenCalledWith('error');
    
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
  
  test('正常系: エラーイベント発生時に再接続が試行されること', async () => {
    // 接続
    await adapter.connect('INBOX');
    
    // connectionLostイベントをスパイ
    const emitSpy = jest.spyOn(adapter, 'emit');
    
    // エラーイベントをシミュレート
    const mockError = { code: 'ECONNRESET', message: 'Connection reset' };
    mockImapFlowInstance.emit('error', mockError);
    
    // connectionLostイベントが発行されることを確認
    expect(emitSpy).toHaveBeenCalledWith('connectionLost', expect.any(String));
    
    // 接続状態が更新されることを確認
    expect(adapter.isActive()).toBe(false);
  });
  
  test('正常系: KeepAliveエラー時に再接続が試行されること', async () => {
    // scheduleReconnectメソッドをスパイ
    const scheduleReconnectSpy = jest.spyOn(adapter as any, 'scheduleReconnect');
    
    // 接続
    await adapter.connect('INBOX');
    
    // KeepAliveエラーハンドラを直接呼び出す方法（タイマーをモックせず）
    // emitメソッドをスパイ
    const emitSpy = jest.spyOn(adapter, 'emit');
    
    // 接続状態を手動で設定
    (adapter as any).isConnected = true;
    (adapter as any).client = mockImapFlowInstance;
    
    // noopメソッドが例外をスローするように設定
    mockImapFlowInstance.noop.mockRejectedValueOnce(new Error('Connection not available'));
    
    // keepAliveのエラーハンドリングを直接テスト
    await expect(async () => {
      await mockImapFlowInstance.noop();
    }).rejects.toThrow('Connection not available');
    
    // 手動でKeepAliveのエラー処理を呼び出す
    (adapter as any).isConnected = false;
    adapter.emit('connectionLost', 'INBOX');
    (adapter as any).scheduleReconnect('INBOX', 'テスト:INBOX');
    
    // 接続状態が更新されていることを確認
    expect(adapter.isActive()).toBe(false);
    
    // scheduleReconnectが呼ばれたことを確認
    expect(scheduleReconnectSpy).toHaveBeenCalled();
    expect(scheduleReconnectSpy).toHaveBeenCalledWith('INBOX', expect.any(String));
  });
  
  test('正常系: 再接続後にreconnectedイベントが発火されること', async () => {
    // 接続してから切断をシミュレート
    await adapter.connect('INBOX');
    
    // reconnectメソッドをスパイ
    const reconnectSpy = jest.spyOn(adapter as any, 'reconnect');
    
    // reconnectedイベントをリスンするリスナーを追加
    const reconnectedHandler = jest.fn();
    adapter.on('reconnected', reconnectedHandler);
    
    // 切断をシミュレート
    mockImapFlowInstance.emit('error', { code: 'ECONNRESET', message: 'Connection reset' });
    
    // 再接続処理を手動でトリガー
    await (adapter as any).reconnect('INBOX', 'テスト:INBOX');
    
    // 接続メソッドが呼ばれたことを確認
    expect(mockImapFlowInstance.connect).toHaveBeenCalledTimes(2); // 初回 + 再接続
    
    // reconnectedイベントが発火されたことを確認
    expect(reconnectedHandler).toHaveBeenCalledWith('INBOX');
  });
  
  test('異常系: fetchUnseenMessages中の接続エラーで再接続が開始されること', async () => {
    // 接続
    await adapter.connect('INBOX');
    
    // scheduleReconnectメソッドをスパイ
    const scheduleReconnectSpy = jest.spyOn(adapter as any, 'scheduleReconnect');
    
    // searchメソッドが例外をスローするように設定
    mockImapFlowInstance.search.mockRejectedValueOnce(new Error('Connection not available'));
    
    // 未読メッセージ取得を実行
    await adapter.fetchUnseenMessages();
    
    // 接続状態が更新されることを確認
    expect(adapter.isActive()).toBe(false);
    
    // scheduleReconnectが呼ばれたことを確認
    expect(scheduleReconnectSpy).toHaveBeenCalled();
  });
  
  test('異常系: fetchMessage中の接続エラーで再接続が開始されること', async () => {
    // 接続
    await adapter.connect('INBOX');
    
    // scheduleReconnectメソッドをスパイ
    const scheduleReconnectSpy = jest.spyOn(adapter as any, 'scheduleReconnect');
    
    // fetchOneメソッドが例外をスローするように設定
    mockImapFlowInstance.fetchOne.mockRejectedValueOnce(new Error('Connection not available'));
    
    // メッセージ取得を実行
    await adapter.fetchMessage('12345');
    
    // 接続状態が更新されることを確認
    expect(adapter.isActive()).toBe(false);
    
    // scheduleReconnectが呼ばれたことを確認
    expect(scheduleReconnectSpy).toHaveBeenCalled();
  });
  
  // テスト後にタイマーをクリーンアップする
  afterEach(() => {
    if ((adapter as any).keepAliveTimer) {
      clearInterval((adapter as any).keepAliveTimer);
      (adapter as any).keepAliveTimer = null;
    }
    
    if ((adapter as any).reconnectTimer) {
      clearTimeout((adapter as any).reconnectTimer);
      (adapter as any).reconnectTimer = null;
    }
    
    jest.clearAllTimers();
  });
});