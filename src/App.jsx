import { useState, useCallback, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { isConnected } from "./lib/connection.js";
import { getOnboardingStatus, submitOnboarding } from "./api/client.js";
import Feed from "./components/Feed.jsx";
import { ATMOSPHERES } from "./data/atmospheres.js";
import Routines from "./components/Routines.jsx";
import Backstage from "./components/Backstage.jsx";
import ChatSheet from "./components/ChatSheet.jsx";
import NavBar from "./components/NavBar.jsx";
import Onboarding from "./components/Onboarding.jsx";
import SettingsModal from "./components/SettingsModal.jsx";

export default function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatWorkspace, setChatWorkspace] = useState(null);
  const [pendingVoice, setPendingVoice] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [feedKey, setFeedKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connected, setConnected] = useState(isConnected());
  const [unreadCount, setUnreadCount] = useState(0);
  const [atmosphere, setAtmosphere] = useState(0);
  const [showBackstage, setShowBackstage] = useState(() => localStorage.getItem('fathom-show-backstage') === 'true');

  // Persist backstage toggle
  useEffect(() => {
    localStorage.setItem('fathom-show-backstage', showBackstage);
  }, [showBackstage]);

  // Auto-trigger onboarding on mount if connected to a fresh instance
  useEffect(() => {
    if (!connected) return;
    getOnboardingStatus()
      .then((status) => {
        if (!status.complete) setShowOnboarding(true);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply atmosphere to body globally
  useEffect(() => {
    const a = ATMOSPHERES[atmosphere];
    document.body.style.background = a.bg;
    document.body.style.backgroundAttachment = "fixed";
    document.body.style.color = a.text || "";
    document.documentElement.style.setProperty("--text", a.text || "#1a1a2e");
    return () => {
      document.body.style.background = "";
      document.body.style.backgroundAttachment = "";
      document.body.style.color = "";
      document.documentElement.style.setProperty("--text", "#1a1a2e");
    };
  }, [atmosphere]);

  const handleConnectionChange = useCallback(() => {
    const nowConnected = isConnected();
    setConnected(nowConnected);
    // Reset onboarding state — we might be pointing at a different server
    setShowOnboarding(false);
    setCompleting(false);
    // Check if the new server needs onboarding
    if (nowConnected) {
      getOnboardingStatus()
        .then((status) => {
          if (!status.complete) setShowOnboarding(true);
        })
        .catch(() => {});
    }
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
    // Submit to server — creates workspaces/routines and posts welcome to feed
    submitOnboarding(name, interests)
      .then(() => setTimeout(() => setFeedKey((k) => k + 1), 2000))
      .catch(() => {});
    setCompleting(true);
  }

  function handleOnboardFadeEnd(e) {
    if (e.animationName === "onboard-fade-out") {
      setShowOnboarding(false);
      setCompleting(false);
    }
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
              key={feedKey}
              onChatOpen={() => { setChatWorkspace(null); setUnreadCount(0); setChatOpen(true); }}
              onStartTour={() => setShowOnboarding(true)}
              unreadCount={unreadCount}
            />
          } />
          <Route path="/backstage" element={
            <Backstage onOpenChat={(ws) => { setChatWorkspace(ws); setUnreadCount(0); setChatOpen(true); }} />
          } />
          <Route path="/routines" element={<Routines />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <NavBar
          onChatOpen={() => { setChatWorkspace(null); setUnreadCount(0); setChatOpen(true); }}
          onVoiceResult={handleVoiceResult}
          onSettingsOpen={() => setSettingsOpen(true)}
          unreadCount={unreadCount}
          showBackstage={showBackstage}
        />
        <ChatSheet
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          consumeVoice={consumeVoice}
          pendingVoice={pendingVoice}
          onUnread={(count) => setUnreadCount((prev) => prev + count)}
          workspace={chatWorkspace}
        />
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onConnectionChange={handleConnectionChange}
          isGate={false}
          atmosphere={atmosphere}
          onAtmosphereChange={setAtmosphere}
          showBackstage={showBackstage}
          onShowBackstageChange={setShowBackstage}
        />
      </div>
    </>
  );
}
