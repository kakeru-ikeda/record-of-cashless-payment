/**
 * アプリケーションのライフサイクル管理を担当するインターフェース
 * このインターフェースにより、アプリケーションの初期化、実行、終了の抽象化が可能になる
 */
import { CardCompany } from '@domain/enums/CardCompany';

export interface IApplication {
    /**
     * アプリケーションを初期化する
     * 依存関係の注入、ルーティングの設定、サーバーの起動などを行う
     */
    initialize(): Promise<void>;

    /**
     * テストモードでアプリケーションを実行する
     * サンプルデータを使用した動作確認を行う
     *
     * @param cardCompany テスト対象のカード会社
     */
    runInTestMode(cardCompany: CardCompany): Promise<void>;

    /**
     * 通常モードでアプリケーションを実行する
     * メール監視、通知処理などの本番機能を有効化する
     */
    runInNormalMode(): Promise<void>;

    /**
     * アプリケーションのシャットダウン処理を行う
     * リソースの解放、接続のクローズなどを適切に実行する
     */
    shutdown(): Promise<void>;
}
