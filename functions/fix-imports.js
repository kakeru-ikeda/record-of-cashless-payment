/**
 * ビルド後のJavaScriptファイル構造を修正するスクリプト
 * 
 * 目的: 
 * 1. lib/functions/src/ の内容を lib/ 直下に移動
 * 2. sharedフォルダへの参照パスを修正
 * 3. Firebase Functionsが正しく動作する構造にする
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 ビルド後の構造を修正中...');

// Step 1: lib/functions/src/ の内容を lib/ に移動
console.log('📁 ディレクトリ構造を再構築中...');

const libDir = path.join(__dirname, 'lib');
const functionsDir = path.join(libDir, 'functions');
const srcDir = path.join(functionsDir, 'src');

// lib/functions/src 配下のすべてのファイルとディレクトリを取得
function copyRecursively(source, target) {
    if (!fs.existsSync(source)) {
        console.warn(`⚠️  ソースディレクトリが存在しません: ${source}`);
        return;
    }

    const items = fs.readdirSync(source);

    items.forEach(item => {
        const sourcePath = path.join(source, item);
        const targetPath = path.join(target, item);

        const stat = fs.statSync(sourcePath);

        if (stat.isDirectory()) {
            // ディレクトリの場合
            if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(targetPath, { recursive: true });
            }
            copyRecursively(sourcePath, targetPath);
        } else if (stat.isFile() && item !== 'index.js' && item !== 'index.js.map') {
            // ファイルの場合（index.jsとindex.js.mapは除く、これらは既にfix-pathsでコピー済み）
            if (!fs.existsSync(path.dirname(targetPath))) {
                fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            }
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`📋 コピー: ${path.relative(__dirname, sourcePath)} → ${path.relative(__dirname, targetPath)}`);
        }
    });
}

// functions/src の内容を lib/ 直下にコピー
copyRecursively(srcDir, libDir);

// Step 2.5: lib/functions/src/index.js を lib/index.js にコピー
const sourceIndexPath = path.join(srcDir, 'index.js');
const targetIndexPath = path.join(libDir, 'index.js');
const sourceIndexMapPath = path.join(srcDir, 'index.js.map');
const targetIndexMapPath = path.join(libDir, 'index.js.map');

if (fs.existsSync(sourceIndexPath)) {
    fs.copyFileSync(sourceIndexPath, targetIndexPath);
    console.log(`📋 メインインデックスをコピー: ${path.relative(__dirname, sourceIndexPath)} → ${path.relative(__dirname, targetIndexPath)}`);
}

if (fs.existsSync(sourceIndexMapPath)) {
    fs.copyFileSync(sourceIndexMapPath, targetIndexMapPath);
    console.log(`📋 ソースマップをコピー: ${path.relative(__dirname, sourceIndexMapPath)} → ${path.relative(__dirname, targetIndexMapPath)}`);
}

// Step 2: パスの修正
console.log('🔧 インポートパスを修正中...');

// lib 配下のすべてのJSファイルを取得（index.js含む）
const jsFiles = glob.sync(path.join(libDir, '**', '*.js'));

console.log(`📝 対象ファイル数: ${jsFiles.length}`);

let modifiedCount = 0;

jsFiles.forEach(filePath => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        let modifiedContent = content;
        let hasModifications = false;

        // lib/ からの相対位置を計算
        const relativePath = path.relative(libDir, filePath);
        const depth = relativePath.split(path.sep).length - 1; // ファイル名を除く

        // sharedへの正しい相対パスを構築
        const pathToShared = depth > 0 ? '../'.repeat(depth) + 'shared' : './shared';

        // sharedへの参照パターンを修正
        const sharedPatterns = [
            // @sharedエイリアスを相対パスに変換
            {
                from: /require\("@shared\/(.*?)"\)/g,
                to: `require("${pathToShared}/$1")`
            },
            // 複数階層上がってsharedに行くパターンを統一
            {
                from: /require\("(\.\.\/){2,10}shared\/(.*?)"\)/g,
                to: `require("${pathToShared}/$2")`
            },
            // TypeScriptビルド時に生成される深いパスを修正
            {
                from: /require\("\.\.\/\.\.\/\.\.\/\.\.\/shared\/(.*?)"\)/g,
                to: `require("${pathToShared}/$1")`
            },
            {
                from: /require\("\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\/(.*?)"\)/g,
                to: `require("${pathToShared}/$1")`
            },
            {
                from: /require\("\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\/(.*?)"\)/g,
                to: `require("${pathToShared}/$1")`
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

// Step 3: functions/src ディレクトリを削除（クリーンアップ）
console.log('🧹 不要なディレクトリをクリーンアップ中...');
try {
    if (fs.existsSync(functionsDir)) {
        fs.rmSync(functionsDir, { recursive: true, force: true });
        console.log('✅ functions/ ディレクトリを削除しました');
    }
} catch (error) {
    console.warn(`⚠️  functions/ ディレクトリの削除に失敗: ${error.message}`);
}

console.log(`🎉 処理完了: ${modifiedCount}個のファイルを修正しました`);

// 最終的な構造確認
console.log('\n� 最終的なlib/ディレクトリ構造:');
function showDirectoryStructure(dir, prefix = '') {
    const items = fs.readdirSync(dir).sort();
    items.forEach((item, index) => {
        const itemPath = path.join(dir, item);
        const isLast = index === items.length - 1;
        const currentPrefix = prefix + (isLast ? '└── ' : '├── ');

        console.log(currentPrefix + item);

        if (fs.statSync(itemPath).isDirectory() && prefix.length < 20) { // 深すぎる階層は表示しない
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');
            showDirectoryStructure(itemPath, nextPrefix);
        }
    });
}

try {
    showDirectoryStructure(libDir);
} catch (error) {
    console.warn('⚠️  ディレクトリ構造の表示に失敗しました');
}