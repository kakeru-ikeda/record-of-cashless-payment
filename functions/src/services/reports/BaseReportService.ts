import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FirestoreService } from '../../../../shared/firebase/FirestoreService';
import { AppError, ErrorType } from '../../../../shared/errors/AppError';
import { DiscordWebhookNotifier } from '../../../../shared/discord/DiscordNotifier';

/**
 * レポート処理の基底クラス
 * 各種レポート処理で共通する機能を提供します
 */
export abstract class BaseReportService {
    protected firestoreService: FirestoreService;
    protected discordNotifier: DiscordWebhookNotifier | null;

    /**
     * コンストラクタ
     * @param firestoreService Firestoreサービス
     * @param discordNotifier Discordの通知クラス（オプショナル）
     */
    constructor(
        firestoreService: FirestoreService,
        discordNotifier?: DiscordWebhookNotifier
    ) {
        this.firestoreService = firestoreService;
        this.discordNotifier = discordNotifier || null;
    }

    /**
     * ドキュメントデータからレポートを処理する抽象メソッド
     * サブクラスで実装する必要があります
     * @param document Firestoreドキュメント
     * @param data ドキュメントデータ
     * @param params パスパラメータ
     */
    abstract processReport(
        document: functions.firestore.DocumentSnapshot,
        data: any,
        params: Record<string, string>
    ): Promise<any>;

    /**
     * サーバータイムスタンプを取得するヘルパーメソッド
     */
    protected getServerTimestamp(): admin.firestore.FieldValue {
        return this.firestoreService.getServerTimestamp();
    }

    /**
     * Date型からFirestoreのTimestampを生成するヘルパーメソッド
     * @param date 日付オブジェクト
     */
    protected getTimestampFromDate(date: Date): admin.firestore.Timestamp {
        return this.firestoreService.getTimestampFromDate(date);
    }

    /**
     * エラー情報を生成するヘルパーメソッド
     * @param message エラーメッセージ
     * @param type エラータイプ
     * @param context コンテキスト情報
     * @param originalError 元のエラー（存在する場合）
     */
    protected createError(
        message: string,
        type: ErrorType,
        context: any,
        originalError?: Error
    ): AppError {
        return new AppError(
            message,
            type,
            context,
            originalError
        );
    }

    /**
     * 金額変更に伴うレポートの更新
     * @param docRef 変更されたドキュメントの参照
     * @param params パスパラメータ（year, month, term, day）
     * @param amountDiff 金額の差分
     */
    public abstract updateReportForAmountChange(
        docRef: admin.firestore.DocumentReference,
        params: Record<string, string>,
        amountDiff: number
    ): Promise<void>;

    /**
     * ドキュメント削除（論理削除）に伴うレポートの更新
     * @param docRef 削除されたドキュメントの参照
     * @param params パスパラメータ（year, month, term, day）
     * @param amountDiff 金額の差分（マイナス値）
     * @param countDiff カウントの差分（通常は -1）
     */
    public abstract updateReportForDeletion(
        docRef: admin.firestore.DocumentReference,
        params: Record<string, string>,
        amountDiff: number,
        countDiff: number
    ): Promise<void>;

    /**
     * 非表示から表示への変更に伴うレポートの更新（再加算）
     * @param docRef 変更されたドキュメントの参照
     * @param params パスパラメータ（year, month, term, day）
     * @param amountToAdd 加算する金額
     * @param countToAdd 加算するカウント数（通常は 1）
     */
    public abstract updateReportForAddition(
        docRef: admin.firestore.DocumentReference,
        params: Record<string, string>,
        amountToAdd: number,
        countToAdd: number
    ): Promise<void>;
}
