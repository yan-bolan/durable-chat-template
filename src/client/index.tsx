import { createRoot } from "react-dom/client";
import React, { useState, useEffect, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";
import { usePartySocket } from "partysocket/react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import toast, { Toaster } from 'react-hot-toast';
// import  'styles.css'; //  

// Tailwind CSS is assumed to be available
const TailwindScript = () => (
  <script src="https://cdn.tailwindcss.com"></script>
);

type ChatMessage = {
  id: string;
  content: string;
  user: string;
  role: "user" | "bot";
  // 新增字段
  msgtype?: "text" | "file";
  fileName?: string;
  fileType?: string;
};

type Message =
  | { type: "add"; id: string; content: string; user: string; role: "user" | "bot", msgtype?: "text" | "file"; fileName?: string; fileType?: string }
  | { type: "update"; id: string; content: string; user: string; role: "user" | "bot" }
  | { type: "messages"; messages: ChatMessage[] };

const names = [
  "Alice",
  "Bob",
  "Charlie",
  "Diana",
  "Ethan",
  "Fiona",
  "George",
  "Hannah",
  "Ivan",
  "Jasmine",
];

function App() {
  // Ref to scroll to the bottom of the message list
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [name] = useState(names[Math.floor(Math.random() * names.length)]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quillContent, setQuillContent] = useState("");
  const { room } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const socket = usePartySocket({
    party: "chat",
    room: room || "public",
    onMessage: (evt) => {
      const message = JSON.parse(evt.data as string) as Message;
      if (message.type === "add") {
        const foundIndex = messages.findIndex((m) => m.id === message.id);
        if (foundIndex === -1) {
          setMessages((messages) => [
            ...messages,
            {
              id: message.id,
              content: message.content,
              user: message.user,
              role: message.role,
              msgtype: message.msgtype,
              fileName: message.fileName,
              fileType: message.fileType
            },
          ]);
        } else {
          setMessages((messages) => {
            return messages
              .slice(0, foundIndex)
              .concat({
                id: message.id,
                content: message.content,
                user: message.user,
                role: message.role,
                msgtype: message.msgtype,
                fileName: message.fileName,
                fileType: message.fileType
              })
              .concat(messages.slice(foundIndex + 1));
          });
        }
        notifition(message.role, message.content);// 消息通知
      } else if (message.type === "update") {
        setMessages((messages) =>
          messages.map((m) =>
            m.id === message.id
              ? {
                id: message.id,
                content: message.content,
                user: message.user,
                role: message.role,
              }
              : m,
          ),
        );
        notifition(message.role, message.content);// 消息通知
      } else {
        setMessages(message.messages);
      }
    },
  });
  const editorRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Function to copy text to clipboard
  const copyToClipboard = (text: string) => {
    const tempElement = document.createElement('div');
    tempElement.innerHTML = text;
    document.body.appendChild(tempElement);
    try {
      navigator.clipboard.writeText(tempElement.innerText)
        .then(() => {
          toast.success('copyed！');
          console.log('Content copied to clipboard');
        })
        .catch(err => {
          toast.error('copyed failed！');
          console.error('Failed to copy: ', err);
        });
    } catch (err) {
      toast.error('copyed failed！');
      console.error('Failed to copy: ', err);
    }
    document.body.removeChild(tempElement);
  };
  // 处理文件函数
  const handleFiles_big = async (files: FileList) => {
    // 遍历文件列表
    for (const file of Array.from(files)) {
      // Array.from(files).forEach(async (file) => {
      // 创建一个加载中的 Toast，并保存它的 id
      const toastId = toast.loading(`正在上传 ${file.name}...`);
      console.log("正在处理文件:", file.name, file.type, file.size);
      // 在这里添加将文件发送到服务器的逻辑
      // 例如，你可以将文件名插入到 quillContent 中
      // const messageContent = `上传了文件: ${file.name}`;
      // setQuillContent(messageContent);
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          // Assuming the server responds with a URL to the uploaded file
          const fileUrl = data.url;
          const messageContent = `<a href="${fileUrl}" target="_blank">Uploaded file: ${file.name}</a>`;

          const chatMessage: ChatMessage = {
            id: nanoid(8),
            content: messageContent,
            user: name,
            role: "user",
            msgtype: "file",
            fileName: file.name,
            fileType: file.type
          };

          // Send a message to the chat server about the new file
          socket.send(
            JSON.stringify({
              type: "add",
              ...chatMessage,
            })
          );
          // 上传成功后更新 Toast 为成功提示
          toast.success(`${file.name} 上传成功！`, { id: toastId });
        } else { // 上传失败后更新 Toast 为失败提示
          toast.error(`${file.name} 上传失败！`, { id: toastId }); toast.error('上传失败！');
          console.error("File upload failed.");
        }
      } catch (error) {// 捕获错误后更新 Toast 为失败提示
        toast.error(`${file.name} 上传失败！`, { id: toastId });
        console.error("Error uploading file:", error);
      }
    };
  };
  // 新增或修改 handleFiles 函数
  const handleFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      // 检查文件大小，例如限制为 5MB
      if (file.size > 5 * 1024 * 1024) {

        //如果大于15MB，则不上传
        if (file.size > 15 * 1024 * 1024) {
          toast.error('文件过大，请上传小于 15MB 的文件。');
          return;
        }
        handleFiles_big(files);
        return;
      }
      // 创建一个加载中的 Toast
      const toastId = toast.loading(`正在上传 ${file.name}...`);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Content = event.target?.result as string;

        const chatMessage: ChatMessage = {
          id: nanoid(8),
          content: base64Content,
          user: name,
          role: "user",
          // 添加一个新字段来标识消息类型
          msgtype: "file",
          fileName: file.name,
          fileType: file.type
        };

        // 发送 Base64 编码的文件消息
        socket.send(
          JSON.stringify({
            type: "add",
            ...chatMessage,
          })
        );
      };
      reader.readAsDataURL(file);
      // 发送成功后更新 Toast 为成功提示
      toast.success(`${file.name} 上传成功！`, { id: toastId });
    });
  };
  // 处理文件输入框的 onChange 事件
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    // 阻止默认行为
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    dropZone.addEventListener("dragover", preventDefaults);
    dropZone.addEventListener("drop", (e) => {
      preventDefaults(e);
      if (e.dataTransfer?.files) {
        handleFiles(e.dataTransfer.files);
      }
    });

    return () => {
      // 清除事件监听器
      dropZone.removeEventListener("dragover", preventDefaults);
      dropZone.removeEventListener("drop", preventDefaults);
    };
  }, []);
  // 消息通知
  function notifition(msgtype: string, message: string) {
    if (!("Notification" in window)) {
      console.error("该浏览器不支持桌面通知。");
    } else {
      if (Notification.permission === "granted") {
        const notification = new Notification("有一条新消息，点击复制消息内容", {
          body: message,
          icon: "https://picsum.photos/50"
        });

        notification.onclick = () => {
          copyToClipboard(message);
        };
      } else if (Notification.permission !== "denied") {
        window.Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            const notification = new Notification("通知标题", {
              body: message,
              icon: "https://picsum.photos/50"
            });
            notification.onclick = () => {
              copyToClipboard(message);
            };
          } else {
            console.warn("通知权限被拒绝。");
          }
        });
      } else {
        console.warn("通知权限已被拒绝，无法创建通知。");
      }
    }
  }
  const openInNewWindow = (content: string) => {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (newWindow) {
      // 确保在窗口关闭时释放内存
      newWindow.onunload = () => {
        URL.revokeObjectURL(url);
      };
    }
  };
  return (
    <>
      <TailwindScript />
      {/* This style block fixes the small editor size issue */}
      <style>
        {`
          .ql-editor {
            min-height: 200px;
          }
          .ql-container {
            font-size: 16px;
          }
               /* 为 pre 标签添加样式 */
          pre {
            background-color: #f4f4f4;
            border: 1px solid #ddd;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            word-wrap: break-word;
            overflow:auto;
          }

          /* 为 li 标签添加一条杠杠 */
          li {
            list-style-type: none;
            position: relative;
            padding-left: 20px;
          }

          li::before {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 2px;
            height: 80%;
            background-color: #e2e8f0;
          }
        `}
      </style>
      <div className="flex flex-col h-screen bg-gray-100 p-4 font-sans">
        <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
          Room: {room || "public"}
        </h2>

        <div className="flex-grow overflow-y-auto bg-white p-4 rounded-lg shadow-inner mb-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="flex space-x-2 relative group items-start">
              <div className="font-bold text-blue-600 w-1/5 shrink-0 text-right pr-2">
                {message.user}
              </div>
              <li>
                <div className="w-4/5 break-words">
                  <span className="CopyTip hidden group-hover:block cursor-pointer" onClick={() => copyToClipboard(message.content)}>
                    <svg
                      style={{ display: 'inline' }}
                      data-t="1724328544012"
                      className="icon"
                      viewBox="0 0 1024 1024"
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      data-p-id="1486"
                      width="18"
                      height="18"
                    >
                      <path d="M960 960H256V256h704v704z m-640-64h576V320H320v576z" fill="#727272" data-p-id="1487"></path>
                      <path d="M192 800H64V64h736v128h-64v-64H128v608h64z" fill="#727272" data-p-id="1488"></path>
                      <path d="M752.7 395.7L629.4 672.4h-48.1L460.4 395.7h48.1L598.9 612c3 7.1 5.3 15.4 6.7 24.8h1.1c1.2-8.2 3.7-16.6 7.6-25.2l92.1-216h46.3z" fill="#E6C27C" data-p-id="1489"></path>
                      <path d="M416 736h384v64H416z" fill="#727272" data-p-id="1490"></path>
                    </svg>
                  </span>
                  {/* 新窗口打开图标 */}
                  <span
                    className="OpenTip hidden group-hover:block cursor-pointer ml-2" // 使用 ml-2 添加左侧间距
                   onClick={() => openInNewWindow(message.content)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="#727272"
                    >
                      <path d="M0 0h24v24H0V0z" fill="none" />
                      <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                    </svg>
                  </span>
                  {/* 根据消息类型判断如何渲染 */}
                  {message.msgtype === "file" ? (
                    // 渲染文件链接
                    <div>
                      <a href={message.content} download={message.fileName} className="text-blue-500 hover:underline">
                        {message.fileName}
                      </a>
                    </div>
                  ) : (
                    // 渲染预格式化文本,包含html标签
                    // <pre><div dangerouslySetInnerHTML={{ __html: message.content }} /></pre>
                    // 不使用 dangerouslySetInnerHTML 时，可以直接渲染文本
                    <pre className="msgcontent">{message.content}</pre>
                  )}
                </div>
              </li>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form
          className="flex flex-col space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (quillContent.trim() === "") return;
            var quiall_text = editorRef?.current?.getEditor()?.getText(); // 
            const chatMessage: ChatMessage = {
              id: nanoid(8),
              content: quiall_text || quillContent,
              user: name,
              role: "user",
            };
            setMessages((messages) => [...messages, chatMessage]);
            socket.send(
              JSON.stringify({
                type: "add",
                ...chatMessage,
              } satisfies Message),
            );
            // Clear the rich text editor after sending
            setQuillContent("");
          }}
        >
          <div className="flex-grow">
            <ReactQuill
              theme="snow"
              value={quillContent}
              onChange={setQuillContent}
              ref={editorRef}
              placeholder={`你好 ${name}! 输入你的消息...`}
              className="w-full rounded-lg shadow-md bg-white"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 w-full"
          >
            SEND
          </button>
          <button type="button" id="Browse" className="btn btn-success" onClick={() => fileInputRef.current?.click()}>Browse</button>
          <input type="file" id="f" style={{ display: "none" }} ref={fileInputRef} onChange={handleFileChange} />
          <div id="drop-zone" ref={dropZoneRef} style={{ border: "2px dashed #ccc", padding: "20px", textAlign: "center" }}> Drag and drop files here </div>

        </form>
        <Toaster />
      </div>
    </>
  );
}

// Router setup to create a unique room for each session
const root = createRoot(document.getElementById("root")!);
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/:room" element={<App />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>
);

export default App;
