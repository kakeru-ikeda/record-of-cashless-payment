/**
 * メールクライアント接続管理のインターフェース
 * IMAP接続・管理を抽象化し、メール取得などの低レベル操作を定義
 */
import { EventEmitter } from "events";
import { RawEmailMessage } from "@infrastructure/email/ImapEmailClient";

export interface IImapConnectionConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
}

export interface IEmailClient extends EventEmitter {
    /**
     * メールサーバーに接続する
     * @param mailboxName 接続するメールボックス名
     * @returns 接続したクライアント
     */
    connect(mailboxName?: string): Promise<any>;

    /**
     * 未読メッセージを取得する
     * @returns 未読メッセージのUID配列
     */
    fetchUnseenMessages(): Promise<string[]>;

    /**
     * メッセージ本体を取得する
     * @param uid メッセージのUID
     * @returns メッセージの内容
     */
    fetchMessage(uid: string): Promise<RawEmailMessage | null>;

    /**
     * メッセージを既読にマークする
     * @param uid メッセージのUID
     * @returns 成功したかどうか
     */
    markAsSeen(uid: string): Promise<boolean>;

    /**
     * 接続がアクティブかどうか確認
     * @returns アクティブであればtrue
     */
    isActive(): boolean;

    /**
     * 接続を閉じる
     */
    close(): Promise<void>;
}
