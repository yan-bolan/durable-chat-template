import {
  type Connection,
  Server,
  type WSMessage,
  routePartykitRequest,
} from "partyserver";

import type { ChatMessage, Message } from "../shared";

function makeSafeR2Key(fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${randomPart}-${safeName}`;
}

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
    const oneDayAgo = Date.now() - 2 * 60 * 60 * 1000; // 设置过期时间，例如 1 天

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

    console.log(`[Upload] Received file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

    // 计算过期时间：从现在开始的 1 天后
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 0.5);
    const maxAge = Math.floor((expirationDate.getTime() - Date.now()) / 1000);

    // 生成文件 key，并使用 URL 安全字符，避免中文路径编码问题
    const key = makeSafeR2Key(file.name);
    
    // 将 File 对象转换为 ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log(`[Upload] ArrayBuffer size after conversion: ${arrayBuffer.byteLength} bytes`);
    
    if (arrayBuffer.byteLength === 0) {
      return new Response(JSON.stringify({ 
        error: "Empty file",
        message: "File is empty after conversion"
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    try {
      await env.R2_BUCKET.put(key, arrayBuffer, {
        httpMetadata: {
          cacheControl: `max-age=${maxAge}`,
          contentType: file.type || "application/octet-stream",
        },
        customMetadata: {
          originalFileName: file.name,
        },
      });
      console.log(`[Upload] File stored in R2 with key: ${key}`);
    } catch (r2Error) {
      console.error("[Upload] R2 upload failed:", r2Error);
      return new Response(JSON.stringify({ 
        error: "R2 Storage Error",
        details: r2Error instanceof Error ? r2Error.message : "Unknown R2 error",
        message: "Check Cloudflare R2 bucket configuration and permissions"
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    // 验证文件是否真的存储了
    try {
      const stored = await env.R2_BUCKET.head(key);
      console.log(`[Upload] Verification - File exists in R2, size: ${stored?.size || 0} bytes`);
    } catch (err) {
      console.error("[Upload] Could not verify file in R2:", err);
    }
    
    const fileUrl = `/files/${key}`;
    console.log(`[Upload] Returning download URL: ${fileUrl}`);

    // 返回文件 URL 给客户端
    return new Response(JSON.stringify({ url: fileUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Upload] Error handling file upload:", error);
    return new Response(JSON.stringify({ 
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

// 处理文件下载
async function handleFileDownload(request: Request, env: Env, key: string) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    console.log(`[Download] Requesting file with key: ${key}`);

    // 从 R2 获取文件
    const object = await env.R2_BUCKET.get(key);

    if (!object) {
      console.error(`[Download] File not found: ${key}`);
      return new Response("File not found", { status: 404 });
    }

    console.log(`[Download] File found, size: ${object.size} bytes`);

    if (object.size === 0) {
      console.error(`[Download] File is empty in R2: ${key}`);
      return new Response(JSON.stringify({ 
        error: "Empty file in storage",
        key: key,
        size: 0
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // 提取文件名，如果存在元数据则使用原始文件名
    const fileName = object.customMetadata?.originalFileName || key.split('-').slice(2).join('-');

    // 返回文件
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
        "Content-Length": object.size.toString(),
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[Download] Error retrieving file:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to download file",
      details: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 路由 /upload POST 请求到 handleFileUpload 函数
    if (url.pathname === "/upload" && request.method === "POST") {
      return handleFileUpload(request, env);
    }

    // 路由 /files/* GET 请求到 handleFileDownload 函数
    if (url.pathname.startsWith("/files/") && request.method === "GET") {
      const key = url.pathname.substring(7); // 移除 "/files/" 前缀
      if (key) {
        return handleFileDownload(request, env, key);
      }
    }

    // 如果不是 /upload 或 /files/* 请求，则继续使用 partykit 或 ASSETS
    return (
      (await routePartykitRequest(request, { ...env })) ||
      env.ASSETS.fetch(request)
    );
  },
} satisfies ExportedHandler<Env>;