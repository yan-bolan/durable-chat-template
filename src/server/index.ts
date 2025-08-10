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
      `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT,timestamp INTEGER)`,
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
  const oneDayAgo = Date.now() - 0.1 * 60 * 60 * 1000; // 设置过期时间，例如 1 天
  
  // 从数据库中删除所有超过 24 小时（1 天）的消息
  this.ctx.storage.sql.exec("DELETE FROM messages WHERE timestamp < ?", ...[oneDayAgo]);
  
  // 重新加载内存中的消息，以保持同步
  this.messages = this.ctx.storage.sql.exec("SELECT * FROM messages").toArray() as ChatMessage[];
}
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
      `INSERT INTO messages (id, user, role, content, timestamp)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET content = ?`,
       ...[message.id, message.user, message.role, message.content,message.timestamp, message.content]
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

export default {
  async fetch(request, env) {
    return (
      (await routePartykitRequest(request, { ...env })) ||
      env.ASSETS.fetch(request)
    );
  },
} satisfies ExportedHandler<Env>;
