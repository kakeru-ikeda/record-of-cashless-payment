import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import inbox from "inbox";
import dotenv from "dotenv";
import axios from "axios";
import quotedPrintable from 'quoted-printable';
import * as Encoding from 'encoding-japanese';
import { htmlToText } from 'html-to-text';
dotenv.config();

const server = process.env.IMAP_SERVER || "imap.gmail.com";
const user = process.env.IMAP_USER;
const password = process.env.IMAP_PASSWORD;
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || "";
let keepAliveTimer: NodeJS.Timeout;
let client: any;

async function connectToDatabase() {
    const db = await open({
        filename: '/usr/src/app/db/mufg-usage-details.sqlite',
        driver: sqlite3.Database
    });
    await db.exec(`
      CREATE TABLE IF NOT EXISTS emails (
        id INTEGER PRIMARY KEY,
        card_name TEXT,
        datetime_of_use TEXT,
        amount INTEGER,
        where_to_use TEXT
      )
    `);
    return db;
}

function convertHtmlToPlainText(html: string): string {
    const text = htmlToText(html, {
        wordwrap: false,
    });
    return text;
}

async function parseEmailBody(body: string) {
    const cardNameMatch = body.match(/カード名称[　\s]+：[　\s]+(.+?)(?=(【|$))/);
    const dateMatch = body.match(/【ご利用日時\(日本時間\)】[　\s]+([\d年月日 :]+)/);
    const amountMatch = body.match(/【ご利用金額】[　\s]+([\d,]+)円/);
    const whereToUseMatch = body.match(/【ご利用先】[　\s]+(.+?)(?=(【|$))/);

    const datetime_of_use = dateMatch?.[1]?.trim() || '';
    const amountStr = amountMatch?.[1]?.replace(/,/g, '') || '0';

    console.log("Parsed data:", {
        card_name: cardNameMatch?.[1]?.trim() || '',
        datetime_of_use,
        amount: parseInt(amountStr, 10),
        where_to_use: whereToUseMatch?.[1]?.trim() || '',
    });

    console.log("datetime_of_use:", new Date(datetime_of_use.replace(/年|月/g, '-').replace('日', '')).toISOString());

    return {
        card_name: cardNameMatch?.[1]?.trim() || '',
        datetime_of_use: new Date(datetime_of_use.replace(/年|月/g, '-').replace('日', '')).toISOString(),
        amount: parseInt(amountStr, 10),
        where_to_use: whereToUseMatch?.[1]?.trim() || '',
    };
}

async function sendDiscordNotification(data: {
    card_name: string;
    datetime_of_use: string;
    amount: number;
    where_to_use: string;
}) {
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
                console.error("メールボックスの一覧取得に失敗しました:", err);
            } else {
                console.log("利用可能なメールボックス:", mailboxes);
            }
        });
        client.openMailbox("&TgmD8WdxTqw-UFJ&koCITA-", (err: any) => { // 三菱東京UFJ銀行
            if (err) console.log(err);
            console.log("Connected to mailbox: 三菱東京UFJ銀行");
        });
    });

    client.on('new', async (message: any) => {
        console.log("New email received.");

        const db = await connectToDatabase();

        const stream = client.createMessageStream(message.UID);
        let body = "";
        stream.on("data", (chunk: Buffer) => {
            body += chunk.toString();
        });
        stream.on("end", async () => {
            const decodedBuffer = quotedPrintable.decode(body);
            const decodedBody = Encoding.convert(decodedBuffer, {
                to: 'UNICODE',
                from: 'JIS',
                type: 'string'
            });
            const plainTextBody = convertHtmlToPlainText(decodedBody);
            console.log("Decoded body:", plainTextBody);

            const { card_name, datetime_of_use, amount, where_to_use } = await parseEmailBody(plainTextBody);

            await db.run(
                `INSERT INTO emails (card_name, datetime_of_use, amount, where_to_use) VALUES (?, ?, ?, ?)`,
                [card_name, datetime_of_use, amount, where_to_use]
            );

            await sendDiscordNotification({ card_name, datetime_of_use, amount, where_to_use });
        });
    });

    client.on("error", (error: any) => {
        console.log("IMAP error:", error);
        if (error.code === 'ETIMEDOUT') {
            console.log('Reconnecting...');
            setTimeout(connectToInbox, 5000);
        }
    });

    client.on("close", () => {
        console.log("IMAP connection closed.");
        clearInterval(keepAliveTimer);
        setTimeout(connectToInbox, 5000);
    });
}

connectToInbox();
