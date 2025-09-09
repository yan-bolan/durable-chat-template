export type ChatMessage = {
  id: string;
  content: string;
  user: string;
  role: "user" | "assistant";
  timestamp: number; // 添加时间戳字段
  msgtype?: string;
  // 新增字段
  fileName?: string;
  fileType?: string;
};

export type Message =
  | {
    type: "add";
    id: string;
    content: string;
    user: string;
    role: "user" | "assistant";
    timestamp: number; // 添加时间戳字段
    msgtype?: string;
    // 新增字段
    fileName?: string;
    fileType?: string;
  }
  | {
    type: "update";
    id: string;
    content: string;
    user: string;
    role: "user" | "assistant";
    timestamp: number; // 添加时间戳字段
    msgtype?: string;
    fileName?: string;
    fileType?: string;
  }
  | {
    type: "all";
    messages: ChatMessage[];
  };

export const names = [
  "Alice",
  "Bob",
  "Charlie",
  "David",
  "Eve",
  "Frank",
  "Grace",
  "Heidi",
  "Ivan",
  "Judy",
  "Kevin",
  "Linda",
  "Mallory",
  "Nancy",
  "Oscar",
  "Peggy",
  "Quentin",
  "Randy",
  "Steve",
  "Trent",
  "Ursula",
  "Victor",
  "Walter",
  "Xavier",
  "Yvonne",
  "Zoe",
];
