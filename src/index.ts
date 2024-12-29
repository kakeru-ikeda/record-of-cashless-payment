import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import inbox from "inbox";
import dotenv from "dotenv";
import axios from "axios";
import quotedPrintable from 'quoted-printable';
import * as iconv from 'iconv-lite';
import { htmlToText } from 'html-to-text';
dotenv.config();

const server = process.env.IMAP_SERVER || "imap.gmail.com";
const user = process.env.IMAP_USER;
const password = process.env.IMAP_PASSWORD;
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || "";

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
        amount TEXT,
        where_to_use TEXT
      )
    `);
    return db;
}

function convertHtmlToPlainText(html: string): string {
    const text = htmlToText(html, {
        wordwrap: false,
        // 必要に応じてオプションを追加
    });
    return text;
}

async function parseEmailBody(body: string) {
    const cardNameMatch = body.match(/カード名称　：　(.+)/);
    const dateMatch = body.match(/【ご利用日時\(日本時間\)】　([\d年月日 :]+)/);
    const amountMatch = body.match(/【ご利用金額】　([\d,]+円)/);
    const whereToUseMatch = body.match(/【ご利用先】　(.+)/);

    return {
        card_name: cardNameMatch?.[1]?.trim() || '',
        datetime_of_use: dateMatch?.[1]?.trim() || '',
        amount: amountMatch?.[1]?.trim() || '',
        where_to_use: whereToUseMatch?.[1]?.trim() || '',
    };
}

async function sendDiscordNotification(data: {
    card_name: string;
    datetime_of_use: string;
    amount: string;
    where_to_use: string;
}) {
    if (!discordWebhookUrl) return;
    const embeds = [
        {
            title: "新規利用情報",
            fields: [
                { name: "日時", value: data.datetime_of_use || "不明" },
                { name: "利用金額", value: data.amount || "不明" },
                { name: "利用先", value: data.where_to_use || "不明" },
                { name: "カード名", value: data.card_name || "不明" },
            ]
        }
    ];
    await axios.post(discordWebhookUrl, { embeds });
}

async function connectToInbox() {
    console.log("Connecting to IMAP server...");

    const client = inbox.createConnection(993, server, {
        secureConnection: true,
        auth: {
            user: user,
            pass: password
        },
    });

    client.connect();

    client.on("connect", () => {
        console.log("Connected to IMAP server.");

        client.openMailbox("INBOX", (err: any) => {
            if (err) console.log(err);
            console.log("Connected to mailbox.");
        });
    });

    client.on('new', async (message: any) => {
        console.log("New email received.");

        // 送信元アドレスが該当ドメインでない場合はスキップ
        // if (message.from.address !== "mail@jcbdebit.bk.mufg.jp") return;
        console.log(`address: ${message.from.address}`);

        const db = await connectToDatabase();

        // 本文ストリームでメール内容を取得
        const stream = client.createMessageStream(message.UID);
        let body = "";
        stream.on("data", (chunk: Buffer) => {
            body += chunk.toString();
        });
        stream.on("end", async () => {
            // Quoted-Printableデコード
            const decodedBuffer = quotedPrintable.decode(body);
            const decodedBody = iconv.decode(decodedBuffer, 'UTF-8');
            const plainTextBody = convertHtmlToPlainText(decodedBody);
            console.log("Decoded body:", plainTextBody);

            const { card_name, datetime_of_use, amount, where_to_use } = await parseEmailBody(plainTextBody);

            // DBに登録
            await db.run(
                `INSERT INTO emails (card_name, datetime_of_use, amount, where_to_use) VALUES (?, ?, ?, ?)`,
                [card_name, datetime_of_use, amount, where_to_use]
            );

            // Discord通知
            await sendDiscordNotification({ card_name, datetime_of_use, amount, where_to_use });
        });
    });

    client.on("error", (error: any) => {
        console.log("IMAP error:", error);
    });

    client.on("close", () => {
        console.log("IMAP connection closed.");
    });
}

connectToInbox();