const tsConfigPaths = require('tsconfig-paths');
const tsConfig = require('./tsconfig.json');

// tsconfig.jsonからbaseUrlとpathsを取得
const { baseUrl, paths } = tsConfig.compilerOptions;

// パス解決の登録
tsConfigPaths.register({
    baseUrl,
    paths,
});