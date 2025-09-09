import {
  type Connection,
  Server,
  type WSMessage,
  routePartykitRequest,
} from "partyserver";

import type { ChatMessage, Message } from "../shared";

export class Chat extends Server<Env> {
  static options = { hibernate: true };

  messages = [] as ChatMessage[];

  broadcastMessage(message: Message, exclude?: string[]) {
    this.broadcast(JSON.stringify(message), exclude);
  }

  onStart() {
    // this is where you can initialize things that need to be done before the server starts
    // for example, load previous messages from a database or a service

    // this.ctx.storage.sql.exec(
    //   `DROP TABLE IF EXISTS messages`,
    // );
    // create the messages table if it doesn't exist
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT,timestamp INTEGER, msgtype TEXT, fileName TEXT, fileType TEXT)`,
    );

    // load the messages from the database
    this.messages = this.ctx.storage.sql
      .exec(`SELECT * FROM messages`)
      .toArray() as ChatMessage[];
  }

  onConnect(connection: Connection) {
    // 每次有新连接时，先清理旧消息
    this.cleanOldMessages();
    connection.send(
      JSON.stringify({
        type: "all",
        messages: this.messages,
      } satisfies Message),
    );
  }
  // 添加一个清理方法
  cleanOldMessages() {
    const oneDayAgo = Date.now() - 4 * 60 * 60 * 1000; // 设置过期时间，例如 1 天

    // 从数据库中删除所有超过 24 小时（1 天）的消息
    this.ctx.storage.sql.exec("DELETE FROM messages WHERE timestamp < ?", ...[oneDayAgo]);

    // 重新加载内存中的消息，以保持同步
    this.messages = this.ctx.storage.sql.exec("SELECT * FROM messages").toArray() as ChatMessage[];
  };
  saveMessage(message: ChatMessage) {
    // check if the message already exists
    const existingMessage = this.messages.find((m) => m.id === message.id);
    if (existingMessage) {
      this.messages = this.messages.map((m) => {
        if (m.id === message.id) {
          return message;
        }
        return m;
      });
    } else {
      this.messages.push(message);
    }

    // this.ctx.storage.sql.exec(
    //   `INSERT INTO messages (id, user, role, content) VALUES ('${
    //     message.id
    //   }', '${message.user}', '${message.role}', ${JSON.stringify(
    //     message.content,
    //   )}) ON CONFLICT (id) DO UPDATE SET content = ${JSON.stringify(
    //     message.content,
    //   )}`,
    // );

    // PartyKit 的 sql.exec 方法支持使用数组参数来安全地绑定值
    // 这里需要为 INSERT 和 UPDATE 语句提供参数
    this.ctx.storage.sql.exec(
      `INSERT INTO messages (id, user, role, content, timestamp, msgtype, fileName, fileType)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET content = ?`,
      ...[message.id, message.user, message.role, message.content,
      message.timestamp, message.msgtype, message.fileName, message.fileType, message.content]
    );
  }

  onMessage(connection: Connection, message: WSMessage) {
    // let's broadcast the raw message to everyone else
    this.broadcast(message);

    // let's update our local messages store
    const parsed = JSON.parse(message as string) as Message;
    if (parsed.type === "add" || parsed.type === "update") {
      // 在保存前，为消息添加时间戳
      parsed.timestamp = Date.now();
      this.saveMessage(parsed);
    }
  }
}
async function handleFileUpload(request: Request, env: Env) {
  // 检查请求方法是否为 POST
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // 确保请求体包含文件
  const contentType = request.headers.get("Content-Type");
  if (!contentType?.includes("multipart/form-data")) {
    return new Response("Invalid Content-Type", { status: 400 });
  }

  try {
    // 从请求体中解析表单数据
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response("No file uploaded", { status: 400 });
    }

    // 在这里处理文件
    // 1. 将文件保存到持久化存储（例如 R2 或其他云存储）
    // 2. 获取文件的 URL
    // 3. 将 URL 发送回客户端

    // 计算过期时间：从现在开始的 1 天后
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 0.5);
    const maxAge = Math.floor((expirationDate.getTime() - Date.now()) / 1000);
    const expiresHeader = expirationDate.toUTCString();

    // 假设你使用 Cloudflare R2
    const key = `${Date.now()}-${file.name}`;
    await env.R2_BUCKET.put(key, file, {
      httpMetadata: {
        cacheControl: `max-age=${maxAge}`, // 设置缓存过期时间为 1 天
        // cacheExpiry: expiresHeader, // 设置 Expires 头,二选一即可
      }
    });
    const fileUrl = `/files/${key}`; // 假设你的 R2 bucket 绑定了 /files 路由

    // 返回文件 URL 给客户端
    return new Response(JSON.stringify({ url: fileUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error handling file upload:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
export default {
  async fetch(request, env) {
    // 路由 /upload 请求到 handleFileUpload 函数
    const url = new URL(request.url);
    if (url.pathname === "/upload" && request.method === "POST") {
      return handleFileUpload(request, env);
    }

    // 如果不是 /upload 请求，则继续使用 partykit 或 ASSETS
    return (
      (await routePartykitRequest(request, { ...env })) ||
      env.ASSETS.fetch(request)
    );
  },
} satisfies ExportedHandler<Env>;