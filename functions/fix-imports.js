/**
 * ビルド後のJavaScriptファイルのsharedインポートパスを修正するスクリプト
 * 
 * 目的: sharedフォルダの相対パス参照を、コピーされたsharedフォルダへの正しいパスに変更
 * 構造: lib/functions/src/ から lib/shared/ への参照に変更
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 sharedインポートパスを修正中...');

// lib/functions/src 配下のすべてのJSファイルを取得
const jsFiles = glob.sync(path.join(__dirname, 'lib', 'functions', 'src', '**', '*.js'));

console.log(`� 対象ファイル数: ${jsFiles.length}`);

let modifiedCount = 0;

jsFiles.forEach(filePath => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        let modifiedContent = content;
        let hasModifications = false;

        // パスの深さを計算（lib/functions/src からの相対位置）
        const relativePath = path.relative(path.join(__dirname, 'lib', 'functions', 'src'), filePath);
        const depth = relativePath.split(path.sep).length - 1; // ファイル名を除く

        // shared への相対パスを構築
        const pathToShared = '../'.repeat(depth + 2) + 'shared'; // +2 は functions/src を遡る分

        // sharedへの参照パターンをすべて置換
        const sharedPatterns = [
            // 4階層上がってsharedに行くパターン (lib/functions/src/xxx/ から)
            {
                from: /require\("\.\.\/\.\.\/\.\.\/\.\.\/shared\/(.*?)"\)/g,
                to: `require("../../shared/$1")`
            },
            // 5階層上がってsharedに行くパターン (lib/functions/src/xxx/yyy/ から)
            {
                from: /require\("\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\/(.*?)"\)/g,
                to: `require("../../../shared/$1")`
            },
            // 6階層上がってsharedに行くパターン (lib/functions/src/xxx/yyy/zzz/ から)
            {
                from: /require\("\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\/(.*?)"\)/g,
                to: `require("../../../../shared/$1")`
            }
        ];

        sharedPatterns.forEach(pattern => {
            const beforeReplace = modifiedContent;
            modifiedContent = modifiedContent.replace(pattern.from, pattern.to);
            if (beforeReplace !== modifiedContent) {
                hasModifications = true;
            }
        });

        if (hasModifications) {
            fs.writeFileSync(filePath, modifiedContent);
            modifiedCount++;

            const relativeFilePath = path.relative(__dirname, filePath);
            console.log(`✅ 修正: ${relativeFilePath}`);
        }

    } catch (error) {
        console.error(`❌ ファイル処理エラー: ${filePath}`, error.message);
    }
});

console.log(`🎉 修正完了: ${modifiedCount}個のファイルを修正しました`);

// 修正結果の検証
console.log('\n🔍 修正結果を検証中...');
const verificationFiles = glob.sync(path.join(__dirname, 'lib', 'functions', 'src', '**', '*.js'));
let remainingIssues = 0;

verificationFiles.forEach(filePath => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');

        // 未修正のsharedパスがあるかチェック
        const badPatterns = [
            /require\("\.\.\/\.\.\/\.\.\/\.\.\/shared\//g,
            /require\("\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\//g,
            /require\("\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\//g
        ];

        badPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                remainingIssues += matches.length;
                const relativeFilePath = path.relative(__dirname, filePath);
                console.warn(`⚠️  未修正のパスが残っています: ${relativeFilePath} (${matches.length}箇所)`);
            }
        });

    } catch (error) {
        console.error(`❌ 検証エラー: ${filePath}`, error.message);
    }
});

if (remainingIssues === 0) {
    console.log('✅ すべてのsharedパスが正しく修正されました');
} else {
    console.warn(`⚠️  ${remainingIssues}箇所の未修正パスが残っています`);
}

console.log('\n📋 修正サマリー:');
console.log(`- 対象ファイル: ${jsFiles.length}個`);
console.log(`- 修正済み: ${modifiedCount}個`);
console.log(`- 未修正問題: ${remainingIssues}箇所`);