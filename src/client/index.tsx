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
  const [copySuccess, setCopySuccess] = useState(""); // State for copy success message
  const { room } = useParams();

  const socket = usePartySocket({
    party: "chat",
    room,
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
      } else {
        setMessages(message.messages);
      }
    },
  });

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
    
    try {
      // document.execCommand is the recommended method for iframes
      const successful = document.execCommand('copy');
      if (successful) {
        setCopySuccess('Copied to clipboard!');
      } else {
        setCopySuccess('Failed to copy');
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setCopySuccess('Failed to copy');
    }

    window.getSelection()?.removeAllRanges();
    document.body.removeChild(tempElement);

    setTimeout(() => {
      setCopySuccess('');
    }, 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 p-4 font-sans">
      <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
        Chat Room:
      </h2>
      <div className="flex-grow overflow-y-auto bg-white p-4 rounded-lg shadow-inner mb-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="flex space-x-2 relative group">
            <div className="font-bold text-blue-600 w-1/5 shrink-0 text-right pr-2">
              {message.user}
            </div>
            <div className="text-gray-800 w-4/5 break-words">
              {/* DANGER: Using dangerouslySetInnerHTML to render HTML from the Quill editor.
                          In a real-world app, you should sanitize this content on the server. */}
              <div dangerouslySetInnerHTML={{ __html: message.content }} />
            </div>
            {/* Copy button with an SVG icon */}
            <button
              onClick={() => copyToClipboard(message.content)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer p-1 rounded-full bg-gray-200 hover:bg-gray-300"
              title="Copy message"
            >
               copy
            </button>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Copy success message box */}
      {copySuccess && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in-out">
          {copySuccess}
        </div>
      )}

      <form
        className="flex space-x-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (quillContent.trim() === "") return;

          const chatMessage: ChatMessage = {
            id: nanoid(8),
            content: quillContent,
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
            placeholder={`Hello ${name}! Type a rich message...`}
            className="w-full rounded-lg shadow-md bg-white"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// Router setup to create a unique room for each session
const root = createRoot(document.getElementById("root")!);
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
      <Route path="/:room" element={<App />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>
);

export default App;
