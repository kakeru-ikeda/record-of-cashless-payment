// テスト環境の設定
process.env.NODE_ENV = 'test';

// タイムアウトの設定
jest.setTimeout(10000);

// コンソール出力を抑制（テスト中のノイズを減らすため）
// 必要に応じてコメントアウトを外す
// jest.spyOn(console, 'log').mockImplementation(() => {});
// jest.spyOn(console, 'warn').mockImplementation(() => {});
// jest.spyOn(console, 'error').mockImplementation(() => {});