import inbox from "inbox";
import dotenv from "dotenv";
import axios from "axios";
import quotedPrintable from 'quoted-printable';
import * as Encoding from 'encoding-japanese';
import { htmlToText } from 'html-to-text';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config();

const server = process.env.IMAP_SERVER || "imap.gmail.com";
const user = process.env.IMAP_USER;
const password = process.env.IMAP_PASSWORD;

// Discord Webhook URLのバリデーション
let discordWebhookUrl = "";
if (process.env.DISCORD_WEBHOOK_URL) {
    // WebhookのURLが有効か確認
    if (process.env.DISCORD_WEBHOOK_URL.startsWith('https://discord.com/api/webhooks/')) {
        discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    } else {
        console.warn('⚠️ Discord WebhookのURLが正しくありません:', 
            process.env.DISCORD_WEBHOOK_URL.substring(0, 30) + '...');
    }
}

let keepAliveTimer: NodeJS.Timeout;
let client: any;

// 環境変数の検証
function validateEnvironmentVariables() {
    const requiredVars = ['IMAP_SERVER', 'IMAP_USER', 'IMAP_PASSWORD'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error('❌ 必須環境変数が設定されていません:', missingVars.join(', '));
        process.exit(1);
    }
    
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.warn('⚠️ GOOGLE_APPLICATION_CREDENTIALSが設定されていません。デフォルトパスを使用します。');
    }
    
    console.log('✅ 環境変数の検証が完了しました');
}

// Firestoreのデータ型定義
interface CardUsage {
  card_name: string;
  datetime_of_use: admin.firestore.Timestamp;
  amount: number;
  where_to_use: string;
  created_at: admin.firestore.Timestamp;
}

/**
 * Firestoreデータベースに接続する関数
 * @returns Firestoreインスタンス
 */
async function initializeFirestore() {
    try {
        // サービスアカウントの秘密鍵のパスを取得
        const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(__dirname, '../firebase-admin-key.json');
        
        // Firebaseの初期化（まだ初期化されていない場合）
        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert(
                    JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
                )
            });
            console.log('✅ Firestoreに正常に接続しました');
        }
        
        // Firestoreインスタンスを返す
        return admin.firestore();
    } catch (error) {
        console.error('❌ Firestoreへの接続に失敗しました:', error);
        throw error;
    }
}

function convertHtmlToPlainText(html: string): string {
    const text = htmlToText(html, {
        wordwrap: false,
    });
    return text;
}

/**
 * メール本文からカード利用情報を抽出する関数
 * @param body メール本文
 * @returns 抽出されたカード利用情報
 */
async function parseEmailBody(body: string) {
    // 改良された正規表現パターン
    const cardNameMatch = body.match(/カード名称[　\s]+：[　\s]+(.+?)(?=[\s\n]いつも|$)/);
    const dateMatch = body.match(/【ご利用日時\(日本時間\)】[　\s]+([\d年月日 :]+)/);
    const amountMatch = body.match(/【ご利用金額】[　\s]+([\d,]+)円/);
    // 利用先は最初の単語または句読点までを抽出
    const whereToUseMatch = body.match(/【ご利用先】[　\s]+([^。\n]+?)(?=[\s\n]ご利用先名等|$)/);

    const datetime_of_use = dateMatch?.[1]?.trim() || '';
    const amountStr = amountMatch?.[1]?.replace(/,/g, '') || '0';
    
    // 抽出したデータを整形
    const card_name = cardNameMatch?.[1]?.trim() || '';
    const where_to_use = whereToUseMatch?.[1]?.trim() || '';

    console.log("抽出データ:", {
        card_name,
        datetime_of_use,
        amount: parseInt(amountStr, 10),
        where_to_use,
    });

    // 日付文字列をISOフォーマットに変換
    const isoDate = new Date(datetime_of_use.replace(/年|月/g, '-').replace('日', '')).toISOString();
    console.log("変換後日時:", isoDate);

    return {
        card_name,
        datetime_of_use: isoDate,
        amount: parseInt(amountStr, 10),
        where_to_use,
    };
}
// Discord通知用のデータ型
interface CardUsageNotification {
    card_name: string;
    datetime_of_use: string;
    amount: number;
    where_to_use: string;
}

/**
 * Discord Webhookを使用して利用情報を通知する関数
 * @param data カード利用情報
 */
async function sendDiscordNotification(data: CardUsageNotification) {
    if (!discordWebhookUrl) return;
    const formattedDate = new Date(data.datetime_of_use).toLocaleString('ja-JP', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const formattedAmount = data.amount.toLocaleString() + '円';

    const embeds = [
        {
            title: "利用情報",
            description: `# ${formattedAmount}\nお支払いが完了しました\n-`,
            color: 14805795,
            fields: [
                {
                    name: "日時",
                    value: formattedDate || "不明",
                    inline: false
                },
                {
                    name: "利用先",
                    value: data.where_to_use || "不明",
                    inline: false
                },
                {
                    name: "カード名",
                    value: data.card_name || "不明"
                }
            ]
        }
    ];
    await axios.post(discordWebhookUrl, { embeds });
}

function setupKeepAlive() {
    clearInterval(keepAliveTimer);
    keepAliveTimer = setInterval(() => {
        if (client && client._state === 'logged in') {
            client.listMailboxes(() => { });
        }
    }, 5 * 60 * 1000);
}


async function connectToInbox() {
    console.log("Connecting to IMAP server...");

    client = inbox.createConnection(993, server, {
        secureConnection: true,
        auth: {
            user: user,
            pass: password
        },
    });

    client.connect();

    setupKeepAlive();
    client.on("connect", () => {
        client.listMailboxes((err: any, mailboxes: string[]) => {
            if (err) {
                console.error("❌ メールボックスの一覧取得に失敗しました:", err);
            } else {
                console.log("📬 利用可能なメールボックス:", mailboxes);
            }
        });
        client.openMailbox("&TgmD8WdxTqw-UFJ&koCITA-", (err: any) => { // 三菱東京UFJ銀行
            if (err) console.log(err);
            console.log("✅ メールボックスに接続しました: 三菱東京UFJ銀行");
        });
    });
    client.on('new', async (message: any) => {
        console.log("📩 新しいメールを受信しました");

        try {
            // Firestoreに接続
            const db = await initializeFirestore();
            const emailsCollection = db.collection('emails');

            const stream = client.createMessageStream(message.UID);
            let body = "";
            
            stream.on("data", (chunk: Buffer) => {
                body += chunk.toString();
            });
            
            stream.on("end", async () => {
                try {
                    // メール本文をデコード
                    const decodedBuffer = quotedPrintable.decode(body);
                    const decodedBody = Encoding.convert(decodedBuffer, {
                        to: 'UNICODE',
                        from: 'JIS',
                        type: 'string'
                    });
                    const plainTextBody = convertHtmlToPlainText(decodedBody);
                    console.log("📝 デコードされたメール本文:", plainTextBody);

                    // メール本文を解析
                    const { card_name, datetime_of_use, amount, where_to_use } = await parseEmailBody(plainTextBody);

                    // Firestoreのタイムスタンプに変換
                    const firestoreTimestamp = admin.firestore.Timestamp.fromDate(new Date(datetime_of_use));

                    // Firestoreトランザクションを使用してデータを保存
                    await db.runTransaction(async (transaction) => {
                        // 新しいドキュメントデータを準備
                        const docData: CardUsage = {
                            card_name,
                            datetime_of_use: firestoreTimestamp,
                            amount,
                            where_to_use,
                            created_at: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
                        };

                        // 新しいドキュメント参照を作成
                        const docRef = emailsCollection.doc();
                        
                        // トランザクションでドキュメントを設定
                        transaction.set(docRef, docData);
                        
                        return docRef.id;
                    });
                    
                    console.log('✅ カード利用データをFirestoreに保存しました');

                    // Discord通知を送信
                    await sendDiscordNotification({ card_name, datetime_of_use, amount, where_to_use });
                    console.log('✅ Discord通知を送信しました');
                } catch (error) {
                    console.error('❌ メール処理中にエラーが発生しました:', error);
                }
            });
        } catch (error) {
            console.error('❌ データベース接続中にエラーが発生しました:', error);
        }
    });
    client.on("error", (error: any) => {
        console.error("❌ IMAPエラー:", error);
        if (error.code === 'ETIMEDOUT') {
            console.log('🔄 再接続を試みています...');
            setTimeout(connectToInbox, 5000);
        }
    });

    client.on("close", () => {
        console.log("🔒 IMAP接続が閉じられました");
        clearInterval(keepAliveTimer);
        console.log("🔄 5秒後に再接続を試みます");
        setTimeout(connectToInbox, 5000);
    });
}
/**
 * サンプルメールを使ってFirestoreへの保存をテストする関数
 */
async function testFirestoreWithSampleMail() {
    try {
        console.log('🧪 サンプルメールを使用したFirestoreテストを開始します...');
        
        // サンプルメールファイルを読み込む
        const sampleMailPath = path.resolve(__dirname, '../samplemail.txt');
        const mailContent = fs.readFileSync(sampleMailPath, 'utf8');
        
        // HTMLメール本文の部分を抽出（全文から本文部分のみを取得）
        const bodyMatch = mailContent.match(/Content - Type: text \/ plain;[\s\S]+?------/);
        let decodedBody = '';
        
        if (bodyMatch && bodyMatch[0]) {
            decodedBody = bodyMatch[0];
            console.log('📧 メール本文を抽出しました');
        } else {
            console.log('⚠️ メール本文の抽出に失敗しました。サンプルファイル全体を使用します。');
            decodedBody = mailContent;
        }
        
        // メール本文をテキストに変換
        const plainTextBody = convertHtmlToPlainText(decodedBody);
        console.log('📝 デコードされたメール本文のサンプル:', plainTextBody.substring(0, 200) + '...');
        
        // メール本文を解析
        const { card_name, datetime_of_use, amount, where_to_use } = await parseEmailBody(plainTextBody);
        console.log('🔍 解析結果:', { card_name, datetime_of_use, amount, where_to_use });
        
        // Firestoreに接続
        const db = await initializeFirestore();
        const emailsCollection = db.collection('emails');
        
        // Firestoreのタイムスタンプに変換
        const firestoreTimestamp = admin.firestore.Timestamp.fromDate(new Date(datetime_of_use));
        
        // ドキュメントデータを準備
        const docData: CardUsage = {
            card_name,
            datetime_of_use: firestoreTimestamp,
            amount,
            where_to_use,
            created_at: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
        };
        
        // Firestoreにデータを保存
        const docRef = await emailsCollection.add(docData);
        
        console.log('✅ テストデータをFirestoreに保存しました。ドキュメントID:', docRef.id);
        
        // Discord通知を送信（オプション）
        if (process.env.DISCORD_WEBHOOK_URL) {
            await sendDiscordNotification({ card_name, datetime_of_use, amount, where_to_use });
            console.log('✅ Discord通知を送信しました');
        } else {
            console.log('ℹ️ DISCORD_WEBHOOK_URLが設定されていないため、Discord通知はスキップされました');
        }
        
        console.log('🎉 テストが正常に完了しました！');
    } catch (error) {
        console.error('❌ テスト実行中にエラーが発生しました:', error);
    }
}

// コマンドライン引数を解析
const args = process.argv.slice(2);
if (args.includes('--test')) {
    // テストモード
    testFirestoreWithSampleMail();
} else {
    // 通常モード
    connectToInbox();
}
