#!/usr/bin/env npx tsx

/**
 * レポート再集計スクリプト v2
 * 指定された期間のカード利用データからレポートを再生成する
 * 
 * 使用例:
 * npx tsx scripts/recalculateReports.ts 2024-01-01 2024-01-07
 * npx tsx scripts/recalculateReports.ts 2024-01-01 2024-01-07 --dry-run
 * npx tsx scripts/recalculateReports.ts 2024-01-01 2024-01-07 --types=daily,weekly
 */

import { initializeApp } from 'firebase-admin/app';
import { FirestoreDataExplorerService } from '../functions/src/infrastructure/services/FirestoreDataExplorerService';
import { ReportRecalculationUseCase } from '../functions/src/application/usecases/ReportRecalculationUseCase';
import { ReportProcessingService } from '../functions/src/application/services/ReportProcessingService';
import { FirestoreReportUseCase } from '../shared/usecases/database/FirestoreReportUseCase';
import { FirestoreReportRepository } from '../shared/infrastructure/database/repositories/FirestoreReportRepository';
import { DiscordNotifier } from '../shared/infrastructure/discord/DiscordNotifier';
import { Environment } from '../shared/infrastructure/config/Environment';
import { FirestoreService } from '../shared/infrastructure/database/FirestoreService';

function parseArgs() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('❌ 使用方法: npx tsx scripts/recalculateReports.ts <開始日> <終了日> [オプション]');
        console.error('例: npx tsx scripts/recalculateReports.ts 2024-01-01 2024-01-07 --dry-run');
        process.exit(1);
    }

    const startDate = args[0];
    const endDate = args[1];

    const options = {
        startDate,
        endDate,
        dryRun: args.includes('--dry-run'),
        types: 'daily,weekly,monthly',
        executor: 'script-execution'
    };

    // typesオプションの解析
    const typesArg = args.find(arg => arg.startsWith('--types='));
    if (typesArg) {
        options.types = typesArg.split('=')[1];
    }

    // executorオプションの解析
    const executorArg = args.find(arg => arg.startsWith('--executor='));
    if (executorArg) {
        options.executor = executorArg.split('=')[1];
    }

    return options;
}

async function main() {
    const options = parseArgs();

    // 日付バリデーション
    const startDate = new Date(options.startDate);
    const endDate = new Date(options.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('❌ 日付の形式が正しくありません。YYYY-MM-DD形式で指定してください。');
        process.exit(1);
    }

    if (startDate > endDate) {
        console.error('❌ 開始日は終了日より前である必要があります。');
        process.exit(1);
    }

    // 90日制限チェック
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
        console.error('❌ 処理期間は90日以内にしてください。');
        process.exit(1);
    }

    // レポートタイプパース
    const reportTypes = options.types.split(',').map((type: string) => type.trim()) as ('daily' | 'weekly' | 'monthly')[];
    const validTypes: ('daily' | 'weekly' | 'monthly')[] = ['daily', 'weekly', 'monthly'];
    const invalidTypes = reportTypes.filter(type => !validTypes.includes(type));

    if (invalidTypes.length > 0) {
        console.error(`❌ 無効なレポートタイプ: ${invalidTypes.join(', ')}`);
        console.error(`有効なタイプ: ${validTypes.join(', ')}`);
        process.exit(1);
    }

    console.log('🔧 レポート再集計スクリプト v2 開始');
    console.log(`📅 処理期間: ${options.startDate} - ${options.endDate} (${diffDays + 1}日間)`);
    console.log(`📊 レポートタイプ: ${reportTypes.join(', ')}`);
    console.log(`🔍 ドライラン: ${options.dryRun ? 'Yes' : 'No'}`);
    console.log(`👤 実行者: ${options.executor}`);
    console.log('');

    try {
        // Firebase Admin SDK初期化
        if (!initializeApp.length) {
            initializeApp();
        }

        // Firestoreサービスを初期化（環境変数パスまたはデフォルトパスを使用）
        const firestoreService = FirestoreService.getInstance();
        const serviceAccountPath = Environment.getFirebaseAdminKeyPath();
        await firestoreService.initialize(serviceAccountPath);

        const reportRepository = new FirestoreReportRepository();
        const reportUseCase = new FirestoreReportUseCase(reportRepository);

        const discordNotifier = new DiscordNotifier({
            usageWebhookUrl: Environment.getDiscordWebhookUrl(),
            loggingWebhookUrl: Environment.getDiscordLoggingWebhookUrl(),
            alertWeeklyWebhookUrl: Environment.getDiscordAlertWeeklyWebhookUrl(),
            alertMonthlyWebhookUrl: Environment.getDiscordAlertMonthlyWebhookUrl(),
            reportDailyWebhookUrl: Environment.getDiscordReportDailyWebhookUrl(),
            reportWeeklyWebhookUrl: Environment.getDiscordReportWeeklyWebhookUrl(),
            reportMonthlyWebhookUrl: Environment.getDiscordReportMonthlyWebhookUrl(),
        });

        const reportProcessingService = new ReportProcessingService(discordNotifier, reportUseCase);
        const dataExplorerService = new FirestoreDataExplorerService(firestoreService);
        const recalculationUseCase = new ReportRecalculationUseCase(
            dataExplorerService,
            reportProcessingService
        );

        // 再集計実行
        const request = {
            startDate,
            endDate,
            reportTypes,
            executedBy: options.executor,
            dryRun: options.dryRun
        };

        console.log('⏳ 処理を開始します...');
        const startTime = Date.now();

        const result = await recalculationUseCase.execute(request);

        const duration = Date.now() - startTime;

        console.log('');
        console.log('✅ 処理が完了しました');
        console.log(`⏱️  処理時間: ${duration}ms`);
        console.log(`📈 結果: ${result.success ? '成功' : '失敗'}`);
        console.log(`💬 メッセージ: ${result.message}`);

        if (result.data) {
            const data = result.data;
            console.log('');
            console.log('📊 処理結果詳細:');
            console.log(`  💳 処理されたカード利用データ: ${data.totalCardUsageProcessed}件`);

            if (data.reportsCreated) {
                console.log(`  📅 作成されたレポート:`);
                console.log(`    Daily: ${data.reportsCreated.daily}`);
                console.log(`    Weekly: ${data.reportsCreated.weekly}`);
                console.log(`    Monthly: ${data.reportsCreated.monthly}`);
            }

            if (data.errors && data.errors.length > 0) {
                console.log(`  ❌ エラー: ${data.errors.length}件`);
                data.errors.slice(0, 5).forEach((error: any, index: number) => {
                    console.log(`    ${index + 1}. ${error.documentPath}: ${error.message}`);
                });
                if (data.errors.length > 5) {
                    console.log(`    ... 他 ${data.errors.length - 5}件`);
                }
            }
        }

        process.exit(result.success ? 0 : 1);

    } catch (error) {
        console.error('❌ 予期しないエラーが発生しました:', error);
        process.exit(1);
    }
}

// スクリプト実行
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ スクリプト実行エラー:', error);
        process.exit(1);
    });
}
