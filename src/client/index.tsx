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
import "./client.css";
import toast, { Toaster } from 'react-hot-toast';
// Tailwind CSS is assumed to be available
const TailwindScript = () => (
  <script src="https://cdn.tailwindcss.com"></script>
);

type ChatMessage = {
  id: string;
  content: string;
  user: string;
  role: "user" | "bot";
};

type Message =
  | { type: "add"; id: string; content: string; user: string; role: "user" | "bot" }
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
    const range = document.createRange();
    range.selectNode(tempElement);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    copyContent(tempElement);

  };
  // 消息通知，不是实时通知，刷新
  function notifition(msgtype: string, message: string) {
    //if (window.isSecureContext) {
    //    // 页面在安全上下文中， 
    //    // …
    //    console.log("页面在安全上下文中，可以发送消息");
    //} else {
    //    console.log("页面不在安全上下文中，无法发送消息");
    //}
    // 检查浏览器是否支持 Notifications API
    if (!("Notification" in window)) {
      console.error("该浏览器不支持桌面通知。");
    } else {
      // 根据当前通知权限来执行不同操作
      if (Notification.permission === "granted") {
        // 如果已经获得授权，直接创建通知
        const notification = new Notification("有一条新消息，点击复制消息内容", {
          body: message,
          icon: "https://picsum.photos/50" //chrome必选，否则不显示， firfox里面可选，替换为你的网站图标 URL
        });

        // 点击通知后复制消息文本
        notification.onclick = () => {
          navigator.clipboard.writeText(message)
            .then(() => {
              console.log('消息已成功复制到剪切板');
            })
            .catch(err => {
              console.error('复制消息到剪切板失败:', err);
            });
        };
      } else if (Notification.permission !== "denied") {
        // 如果权限未被拒绝，则请求权限
        window.Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            // 用户同意授权后，创建通知
            const notification = new Notification("通知标题", {
              body: message,
              icon: "https://picsum.photos/50"
            });

            // 点击通知后复制消息文本
            notification.onclick = () => {
              navigator.clipboard.writeText(message)
                .then(() => {
                  console.log('消息已成功复制到剪切板');
                })
                .catch(err => {
                  console.error('复制消息到剪切板失败:', err);
                });
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
  async function copyContent(args: any) {
    let text = args;//.nextElementSibling.textContent;// args.nextElementSibling.textContent;//document.getElementById('myText').innerHTML;
    try {
      await navigator.clipboard.writeText(text);
      console.log('Content copied to clipboard');
      toast.success('copied!');

    } catch (err) {
      console.error('Failed to copy: ', err);
      toast.error('copy failed!');
    }
  }
  return (
    <div className="flex flex-col h-screen bg-gray-100 p-4 font-sans">
      <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
        Room: {room || "public"}
      </h2>


      <form
        className="flex space-x-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (quillContent.trim() === "") return;
          var editorContent = editorRef?.current?.getEditor().getText();
          const chatMessage: ChatMessage = {
            id: nanoid(8),
            content: editorContent || quillContent,
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
          {/* ReactQuill component replaces the text input */}
          <ReactQuill
            theme="snow"
            value={quillContent}
            onChange={setQuillContent}
            ref={editorRef}
            placeholder={`Hello ${name}! Type a rich message...`}
            className="w-full rounded-lg shadow-md bg-white"
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200"
        >
          Send
        </button>
        <button type="button" id="Browse" className="btn btn-success">Browse</button>
        <input type="file" id="f" style={{ display: "none" }} />
        <div id="drop-zone" style={{ border: "2px dashed #ccc", padding: "20px", textAlign: "center" }}> Drag and drop files here </div>
      </form>
      <div className="flex-grow overflow-y-auto bg-white p-4 rounded-lg shadow-inner mb-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="flex space-x-2 relative group">
            <div className="font-bold text-blue-600 w-1/5 shrink-0 text-right pr-2">
              {message.user}
            </div>
            {/* <div className="text-gray-800 w-4/5 break-words"> */}
            {/* DANGER: Using dangerouslySetInnerHTML to render HTML from the Quill editor.
                          In a real-world app, you should sanitize this content on the server. */}
            {/* <div dangerouslySetInnerHTML={{ __html: message.content }} /> */}
            {/* <div>{message.content}</div> */}
            {/* </div> */}
            {/* Copy button with an SVG icon */}
            <ul>
              <li className="lsmsg">
                <span className="CopyTip" onClick={() => copyContent(message.content)}>
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
                    <path style={{ display: 'inline' }} d="M960 960H256V256h704v704z m-640-64h576V320H320v576z" fill="#727272" data-p-id="1487"></path>
                    <path d="M192 800H64V64h736v128h-64v-64H128v608h64z" fill="#727272" data-p-id="1488"></path>
                    <path style={{ display: 'inline' }} d="M752.7 395.7L629.4 672.4h-48.1L460.4 395.7h48.1L598.9 612c3 7.1 5.3 15.4 6.7 24.8h1.1c1.2-8.2 3.7-16.6 7.6-25.2l92.1-216h46.3z" fill="#E6C27C" data-p-id="1489"></path>
                    <path style={{ display: 'inline' }} d="M416 736h384v64H416z" fill="#727272" data-p-id="1490"></path>
                  </svg>
                </span>
                <pre className="msg"> {message.content} </pre>
              </li>
            </ul>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {/* 这是最关键的一步！<Toaster /> 组件必须被渲染在你的应用中，
        它负责监听和显示所有通过 toast() 触发的通知。
      */}
      <Toaster />
    </div>
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
