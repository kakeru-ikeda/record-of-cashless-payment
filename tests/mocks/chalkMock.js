// chalkのモック - カラーコードを無効化してプレーンテキストを返す
const chalkMock = {
  // デフォルト関数は単に文字列をそのまま返す
  default: (text) => text,
};

// チェーン可能にするためのプロキシ
const handler = {
  get(target, prop) {
    if (typeof prop === 'string') {
      // 色やスタイル関数をシミュレート
      return new Proxy(function(text) { return text; }, handler);
    }
    return target[prop];
  },
  apply(target, thisArg, args) {
    // 関数として呼び出された場合は引数をそのまま返す
    return args[0];
  }
};

// 全てのchalkメソッドに対してプロキシを適用
const proxiedChalk = new Proxy(
  function(text) { return text; },
  handler
);

// プロパティの追加
proxiedChalk.red = proxiedChalk;
proxiedChalk.green = proxiedChalk;
proxiedChalk.blue = proxiedChalk;
proxiedChalk.yellow = proxiedChalk;
proxiedChalk.cyan = proxiedChalk;
proxiedChalk.bold = proxiedChalk;
proxiedChalk.gray = proxiedChalk;

// 組み合わせ可能なスタイル
proxiedChalk.red.bold = proxiedChalk;
proxiedChalk.green.bold = proxiedChalk;
proxiedChalk.yellow.bold = proxiedChalk;
proxiedChalk.blue.bold = proxiedChalk;
proxiedChalk.cyan.bold = proxiedChalk;

module.exports = proxiedChalk;
module.exports.default = proxiedChalk;