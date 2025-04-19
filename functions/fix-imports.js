/**
 * ビルド後のJavaScriptファイルの相対パスを修正するスクリプト
 */
const fs = require('fs');
const path = require('path');

// 修正対象のファイル
const targetFile = path.join(__dirname, 'lib', 'index.js');

console.log('🔧 インポートパスを修正中...');

// ファイルの内容を読み込む
try {
    let content = fs.readFileSync(targetFile, 'utf8');

    // 不正なインポートパスを修正
    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/discord\/DiscordNotifier"\)/g,
        'require("./shared/discord/DiscordNotifier")'
    );

    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/types\/WeeklyReportNotification"\)/g,
        'require("./shared/types/WeeklyReportNotification")'
    );

    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/types\/CardUsageNotification"\)/g,
        'require("./shared/types/CardUsageNotification")'
    );

    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/utils\/DateUtil"\)/g,
        'require("./shared/utils/DateUtil")'
    );

    // 新しく追加したFirestoreServiceモジュールのパスを修正
    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/firebase\/FirestoreService"\)/g,
        'require("./shared/firebase/FirestoreService")'
    );

    // 修正内容を書き込む
    fs.writeFileSync(targetFile, content);
    console.log('✅ インポートパスの修正が完了しました');
} catch (error) {
    console.error('❌ インポートパスの修正に失敗しました:', error);
    process.exit(1);
}