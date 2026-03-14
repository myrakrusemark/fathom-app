import { useState, useEffect, useRef } from "react";
import { getChat, sendChat } from "../api/client.js";

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    getChat()
      .then((data) => setMessages(data.messages))
      .catch(console.error);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    try {
      const { userMsg, agentMsg } = await sendChat(text);
      setMessages((prev) => [...prev, userMsg, agentMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="page chat-page">
      <header className="page-header">
        <h1>fathom</h1>
        <span className="header-subtitle">talk</span>
      </header>
      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble ${msg.role === "user" ? "user" : "agent"}`}
          >
            <p>{msg.text}</p>
            <span className="chat-time">{timeAgo(msg.timestamp)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input-bar" onSubmit={handleSend}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="say something..."
          disabled={sending}
          autoComplete="off"
        />
        <button type="submit" disabled={!input.trim() || sending}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
