/**
 * ビルド後のJavaScriptファイルの相対パスを修正するスクリプト
 */
const fs = require('fs');
const path = require('path');

// 修正対象のファイル
const targetFile = path.join(__dirname, 'lib', 'index.js');
const cardUsageControllerFile = path.join(__dirname, 'lib', 'functions', 'src', 'api', 'controllers', 'CardUsageController.js');
const cardUsageMapperFile = path.join(__dirname, 'lib', 'functions', 'src', 'shared', 'domain', 'mappers', 'CardUsageMapper.js');

console.log('🔧 インポートパスを修正中...');

// index.jsファイルを修正
try {
    let content = fs.readFileSync(targetFile, 'utf8');

    // discord関連のインポートパスを修正
    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/discord\/DiscordNotifier"\)/g,
        'require("./shared/discord/DiscordNotifier")'
    );

    // domain関連のインポートパスを修正
    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/domain\/entities\/ReportNotifications"\)/g,
        'require("./shared/domain/entities/ReportNotifications")'
    );

    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/domain\/entities\/CardUsageNotification"\)/g,
        'require("./shared/domain/entities/CardUsageNotification")'
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

    // 認証ミドルウェアのインポートパスを修正
    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/firebase\/AuthMiddleware"\)/g,
        'require("./shared/firebase/AuthMiddleware")'
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

    // mappers関連のインポートパスを修正
    content = content.replace(
        /require\("\.\.\/\.\.\/shared\/domain\/mappers\/CardUsageMapper"\)/g,
        'require("./shared/domain/mappers/CardUsageMapper")'
    );

    // レポートサービス関連のインポートパスを修正 - ビルド後のパスに合わせて変更
    content = content.replace(
        /require\("\.\/services\/reports\/BaseReportService"\)/g,
        'require("./functions/src/services/reports/BaseReportService")'
    );

    content = content.replace(
        /require\("\.\/services\/reports\/DailyReportService"\)/g,
        'require("./functions/src/services/reports/DailyReportService")'
    );

    content = content.replace(
        /require\("\.\/services\/reports\/WeeklyReportService"\)/g,
        'require("./functions/src/services/reports/WeeklyReportService")'
    );

    content = content.replace(
        /require\("\.\/services\/reports\/MonthlyReportService"\)/g,
        'require("./functions/src/services/reports/MonthlyReportService")'
    );

    // API関連のインポートパスを修正
    content = content.replace(
        /require\("\.\/api\/app\"\)/g,
        'require("./functions/src/api/app")'
    );

    content = content.replace(
        /require\("\.\/api\/controllers\/cardUsageController"\)/g,
        'require("./functions/src/api/controllers/cardUsageController")'
    );

    content = content.replace(
        /require\("\.\/api\/routes\/cardUsageRoutes"\)/g,
        'require("./functions/src/api/routes/cardUsageRoutes")'
    );

    content = content.replace(
        /require\("\.\/api\/middlewares\/"\)/g,
        'require("./functions/src/api/middlewares/")'
    );

    // 修正内容を書き込む
    fs.writeFileSync(targetFile, content);
    console.log('✅ index.jsのインポートパスの修正が完了しました');
} catch (error) {
    console.error('❌ index.jsのインポートパスの修正に失敗しました:', error);
    process.exit(1);
}

// CardUsageController.jsファイルを修正
try {
    if (fs.existsSync(cardUsageControllerFile)) {
        let content = fs.readFileSync(cardUsageControllerFile, 'utf8');

        // CardUsageController内のDiscordNotifierのインポートパスを修正
        content = content.replace(
            /require\("shared\/discord\/DiscordNotifier"\)/g,
            'require("../../../shared/discord/DiscordNotifier")'
        );

        // 他の相対パスも必要に応じて修正
        content = content.replace(
            /require\("shared\/firebase\/FirestoreService"\)/g,
            'require("../../../shared/firebase/FirestoreService")'
        );

        content = content.replace(
            /require\("shared\/utils\/DateUtil"\)/g,
            'require("../../../shared/utils/DateUtil")'
        );

        content = content.replace(
            /require\("shared\/utils\/ResponseHelper"\)/g,
            'require("../../../shared/utils/ResponseHelper")'
        );

        content = content.replace(
            /require\("shared\/errors\/AppError"\)/g,
            'require("../../../shared/errors/AppError")'
        );

        content = content.replace(
            /require\("shared\/domain\/entities\/ReportNotifications"\)/g,
            'require("../../../shared/domain/entities/ReportNotifications")'
        );

        // CardUsageMapperのインポートパス修正（複数のパターンに対応）
        content = content.replace(
            /require\("shared\/domain\/mappers\/CardUsageMapper"\)/g,
            'require("../../../shared/domain/mappers/CardUsageMapper")'
        );

        // コンパイル後のCardUsageMapperの間違ったパスを修正
        content = content.replace(
            /require\("\.\.\/\.\.\/\.\.\/shared\/domain\/mappers\/CardUsageMapper"\)/g,
            'require("../../../../shared/domain/mappers/CardUsageMapper")'
        );

        // 既にコンパイルされたJSファイルでも間違ったパスになっていたら修正
        content = content.replace(
            /require\("\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\/domain\/mappers\/CardUsageMapper"\)/g,
            'require("../../../../shared/domain/mappers/CardUsageMapper")'
        );

        // 修正内容を書き込む
        fs.writeFileSync(cardUsageControllerFile, content);
        console.log('✅ CardUsageController.jsのインポートパスの修正が完了しました');
    } else {
        console.warn('⚠️ CardUsageController.jsファイルが見つかりません');
    }
} catch (error) {
    console.error('❌ CardUsageController.jsのインポートパスの修正に失敗しました:', error);
}

// CardUsageMapper.jsファイルを修正
try {
    if (fs.existsSync(cardUsageMapperFile)) {
        let content = fs.readFileSync(cardUsageMapperFile, 'utf8');

        // CardUsageMapperのインポートパスを修正
        content = content.replace(
            /require\("\.\.\/\.\.\/\.\.\/src\/domain\/entities\/CardUsage"\)/g,
            'require("../entities/CardUsage")'
        );

        // 修正内容を書き込む
        fs.writeFileSync(cardUsageMapperFile, content);
        console.log('✅ CardUsageMapper.jsのインポートパスの修正が完了しました');
    } else {
        console.warn('⚠️ CardUsageMapper.jsファイルが見つかりません');
    }
} catch (error) {
    console.error('❌ CardUsageMapper.jsのインポートパスの修正に失敗しました:', error);
}