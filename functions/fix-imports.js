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

    // discord関連のインポートパスを修正
    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/discord\/DiscordNotifier"\)/g,
        'require("./shared/discord/DiscordNotifier")'
    );

    // types関連のインポートパスを修正
    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/types\/WeeklyReportNotification"\)/g,
        'require("./shared/types/WeeklyReportNotification")'
    );

    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/types\/CardUsageNotification"\)/g,
        'require("./shared/types/CardUsageNotification")'
    );

    // utils関連のインポートパスを修正
    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/utils\/DateUtil"\)/g,
        'require("./shared/utils/DateUtil")'
    );

    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/utils\/ResponseHelper"\)/g,
        'require("./shared/utils/ResponseHelper")'
    );

    // firebase関連のインポートパスを修正
    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/firebase\/FirestoreService"\)/g,
        'require("./shared/firebase/FirestoreService")'
    );

    // errors関連のインポートパスを修正
    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/errors\/AppError"\)/g,
        'require("./shared/errors/AppError")'
    );

    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/errors\/ErrorHandler"\)/g,
        'require("./shared/errors/ErrorHandler")'
    );

    // config関連のインポートパスを修正
    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/config\/Environment"\)/g,
        'require("./shared/config/Environment")'
    );

    // 修正内容を書き込む
    fs.writeFileSync(targetFile, content);
    console.log('✅ インポートパスの修正が完了しました');
} catch (error) {
    console.error('❌ インポートパスの修正に失敗しました:', error);
    process.exit(1);
}