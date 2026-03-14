import { useRef, useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { isConnected } from "../lib/connection.js";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function NavBar({ onChatOpen, onVoiceResult, onSettingsOpen }) {
  const [listening, setListening] = useState(false);
  const holdTimer = useRef(null);
  const recognitionRef = useRef(null);
  const isHolding = useRef(false);
  const didLongPress = useRef(false);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      onChatOpen();
      return;
    }

    setListening(true);
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setListening(false);
      if (transcript.trim()) {
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

  function handlePointerDown(e) {
    e.preventDefault();
    isHolding.current = true;
    didLongPress.current = false;

    holdTimer.current = setTimeout(() => {
      if (isHolding.current) {
        didLongPress.current = true;
        startListening();
      }
    }, 400);
  }

  function handlePointerUp(e) {
    e.preventDefault();
    isHolding.current = false;

    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }

    if (didLongPress.current) {
      stopListening();
      didLongPress.current = false;
    } else {
      onChatOpen();
    }
  }

  function handlePointerCancel() {
    isHolding.current = false;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    stopListening();
    didLongPress.current = false;
  }

  return (
    <nav className="nav-bar">
      <NavLink to="/" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} end>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
        </svg>
        <span>Feed</span>
      </NavLink>
      <button
        className={`nav-chat-btn ${listening ? "listening" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
        aria-label="Talk to Fathom"
      >
        <span className="nav-chat-badge">4</span>
        {listening ? (
          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
            <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
            <path d="M19 11a7 7 0 01-14 0" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 19v3m-3 0h6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>
      <NavLink to="/routines" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span>Routines</span>
      </NavLink>
      <button className="nav-settings-btn" onClick={onSettingsOpen} aria-label="Settings">
        <span className={`connection-dot ${isConnected() ? "connected" : "disconnected"}`} />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
    </nav>
  );
}
