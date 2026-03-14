import { useState, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { isConnected } from "./lib/connection.js";
import Feed from "./components/Feed.jsx";
import Routines from "./components/Routines.jsx";
import ChatSheet from "./components/ChatSheet.jsx";
import NavBar from "./components/NavBar.jsx";
import ReceiptDetail from "./components/ReceiptDetail.jsx";
import Onboarding from "./components/Onboarding.jsx";
import SettingsModal from "./components/SettingsModal.jsx";

export default function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [pendingVoice, setPendingVoice] = useState("");
  const [receiptId, setReceiptId] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [feedMode, setFeedMode] = useState("lived");
  const [selectedInterests, setSelectedInterests] = useState(new Set());
  const [userName, setUserName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connected, setConnected] = useState(isConnected());
  const [unreadCount, setUnreadCount] = useState(0);

  const handleConnectionChange = useCallback(() => {
    setConnected(isConnected());
  }, []);

  function handleVoiceResult(text) {
    setPendingVoice(text);
    setUnreadCount(0);
    setChatOpen(true);
  }

  function consumeVoice() {
    const text = pendingVoice;
    setPendingVoice("");
    return text;
  }

  function handleOnboardComplete(name, interests) {
    setUserName(name);
    setSelectedInterests(interests || new Set());
    setFeedMode("fresh");
    setCompleting(true);
  }

  function handleOnboardFadeEnd(e) {
    if (e.animationName === "onboard-fade-out") {
      setShowOnboarding(false);
      setCompleting(false);
    }
  }

  function handleToggleMode() {
    setFeedMode((m) => (m === "fresh" ? "lived" : "fresh"));
  }

  // Gate: show settings as full-screen setup if not connected
  if (!connected) {
    return (
      <SettingsModal
        open={true}
        onClose={() => {}}
        onConnectionChange={handleConnectionChange}
        isGate={true}
      />
    );
  }

  return (
    <>
      {showOnboarding && (
        <div
          className={`onboard-overlay ${completing ? "onboard-exit" : ""}`}
          onAnimationEnd={handleOnboardFadeEnd}
        >
          <Onboarding onComplete={handleOnboardComplete} />
        </div>
      )}
      <div className="app">
        <Routes>
          <Route path="/" element={
            <Feed
              onChatOpen={() => { setUnreadCount(0); setChatOpen(true); }}
              onOpenReceipt={(id) => setReceiptId(id)}
              onStartTour={() => setShowOnboarding(true)}
              feedMode={feedMode}
              onToggleMode={handleToggleMode}
              userName={userName}
              selectedInterests={selectedInterests}
              unreadCount={unreadCount}
            />
          } />
          <Route path="/routines" element={<Routines />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <NavBar
          onChatOpen={() => { setUnreadCount(0); setChatOpen(true); }}
          onVoiceResult={handleVoiceResult}
          onSettingsOpen={() => setSettingsOpen(true)}
          unreadCount={unreadCount}
        />
        <ChatSheet
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          consumeVoice={consumeVoice}
          pendingVoice={pendingVoice}
          feedMode={feedMode}
          onUnread={(count) => setUnreadCount((prev) => prev + count)}
        />
        <ReceiptDetail
          receiptId={receiptId}
          onClose={() => setReceiptId(null)}
        />
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onConnectionChange={handleConnectionChange}
          isGate={false}
        />
      </div>
    </>
  );
}
