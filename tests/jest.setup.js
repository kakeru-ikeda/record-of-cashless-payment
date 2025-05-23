// テスト環境の設定
process.env.NODE_ENV = 'test';

// タイムアウトの設定
jest.setTimeout(10000);

// コンソール出力を抑制（テスト中のノイズを減らすため）
// 必要に応じてコメントアウトを外す
// jest.spyOn(console, 'log').mockImplementation(() => {});
// jest.spyOn(console, 'warn').mockImplementation(() => {});
// jest.spyOn(console, 'error').mockImplementation(() => {});

// グローバルな afterAll フックを追加
afterAll(() => {
  // NodeJS のタイマープールをクリア
  jest.useRealTimers();
  const activeTimers = process._getActiveHandles().filter(handle => 
    handle.constructor && 
    (handle.constructor.name === 'Timeout' || handle.constructor.name === 'Interval')
  );
  
  // 有効なタイマーの数をログに出す（デバッグ用）
  if (activeTimers.length > 0) {
    console.warn(`警告: ${activeTimers.length}個の未解決タイマーが検出されました`);
  }
});