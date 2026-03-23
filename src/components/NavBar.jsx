import { useRef, useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { Home, MessageCircle, Mic, Settings, PanelLeft } from "lucide-react";
import { isConnected } from "../lib/connection.js";
import { sendVoice } from "../api/client.js";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function NavBar({ onChatOpen, onVoiceResult, onSettingsOpen, unreadCount = 0, showBackstage = false }) {
  const [listening, setListening] = useState(false);
  const holdTimer = useRef(null);
  const recognitionRef = useRef(null);
  const didLongPress = useRef(false);
  const listenStart = useRef(null);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      onChatOpen();
      return;
    }

    setListening(true);
    listenStart.current = Date.now();
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const duration = Math.round((Date.now() - (listenStart.current || Date.now())) / 1000);
      setListening(false);
      if (transcript.trim()) {
        sendVoice(transcript.trim(), duration).catch(() => {});
        onVoiceResult(transcript.trim());
      }
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  }, [onChatOpen, onVoiceResult]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  // Touch: hold to record (mobile only)
  function handleTouchStart() {
    didLongPress.current = false;
    holdTimer.current = setTimeout(() => {
      didLongPress.current = true;
      startListening();
    }, 400);
  }

  function handleTouchEnd(e) {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (didLongPress.current) {
      e.preventDefault(); // prevent click from also firing after long press
      stopListening();
      didLongPress.current = false;
    }
  }

  // Click: open chat (works on both desktop and mobile tap)
  function handleClick() {
    if (didLongPress.current) return; // long press already handled
    onChatOpen();
  }

  return (
    <nav className="nav-bar">
      <NavLink to="/" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} end>
        <Home size={24} />
        <span>Feed</span>
      </NavLink>
      <button
        className={`nav-chat-btn ${listening ? "listening" : ""}`}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-label="Talk to Fathom"
      >
        {unreadCount > 0 && <span className="nav-chat-badge">{unreadCount}</span>}
        {listening ? (
          <Mic size={22} />
        ) : (
          <MessageCircle size={22} />
        )}
      </button>
      {showBackstage && (
        <NavLink to="/backstage" className={({ isActive }) => isActive ? "nav-item backstage-tab active" : "nav-item backstage-tab"}>
          <PanelLeft size={24} />
          <span>Backstage</span>
        </NavLink>
      )}
      <button className="nav-settings-btn" onClick={onSettingsOpen} aria-label="Settings">
        <span className={`connection-dot ${isConnected() ? "connected" : "disconnected"}`} />
        <Settings size={18} />
      </button>
    </nav>
  );
}
