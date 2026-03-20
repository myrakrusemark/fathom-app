import { useState, useCallback, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { isConnected, detectSameOrigin, saveConnection } from "./lib/connection.js";
import { getOnboardingStatus, submitOnboarding, getDmUnreadCount, sendDm } from "./api/client.js";
import Feed from "./components/Feed.jsx";
import { ATMOSPHERES } from "./data/atmospheres.js";
import Routines from "./components/Routines.jsx";
import Backstage from "./components/Backstage.jsx";
import ChatSheet from "./components/ChatSheet.jsx";
import NavBar from "./components/NavBar.jsx";
import Onboarding from "./components/Onboarding.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import SetupPackages from "./components/SetupPackages.jsx";
import PermissionToasts from "./components/PermissionToasts.jsx";

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

  // Setup phase: "loading" | "packages" | "onboarding" | "done"
  const [setupPhase, setSetupPhase] = useState("loading");

  // Persist backstage toggle
  useEffect(() => {
    localStorage.setItem('fathom-show-backstage', showBackstage);
  }, [showBackstage]);

  // Background DM unread polling — only when chat is closed
  useEffect(() => {
    if (!connected || setupPhase !== "done") return;
    if (chatOpen && !chatWorkspace) return; // DM chat is open, it handles its own read marking
    const poll = () => {
      getDmUnreadCount()
        .then((count) => setUnreadCount(count))
        .catch(() => {});
    };
    poll(); // initial check
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [connected, setupPhase, chatOpen, chatWorkspace]);

  // On mount: try same-origin auto-connect, then check onboarding status
  useEffect(() => {
    async function init() {
      let nowConnected = isConnected();

      // Try same-origin auto-connect if not already connected
      if (!nowConnected) {
        const origin = await detectSameOrigin();
        if (origin) {
          try {
            const res = await fetch(`${origin}/api/onboarding/status`);
            if (res.ok) {
              const status = await res.json();
              if (!status.complete && status.api_key) {
                // Fresh server, auto-connect using exposed key
                saveConnection({ serverUrl: origin, apiKey: status.api_key });
                nowConnected = true;
                setConnected(true);
              }
              // If complete, auth is enabled — user must enter key manually
            }
          } catch {
            // Can't reach onboarding endpoint — fall through to gate
          }
        }
      }

      if (!nowConnected) {
        setSetupPhase("done"); // Will show connection gate via !connected check
        return;
      }

      // Connected — check what setup step we're at
      try {
        const status = await getOnboardingStatus();
        if (!status.complete && !status.packages_ready) {
          setSetupPhase("packages");
        } else if (!status.complete) {
          setSetupPhase("onboarding");
          setShowOnboarding(true);
        } else {
          setSetupPhase("done");
        }
      } catch {
        setSetupPhase("done");
      }
    }
    init();
  }, []);

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
    // Reset state — we might be pointing at a different server
    setShowOnboarding(false);
    setCompleting(false);
    // Check setup phase for the new server
    if (nowConnected) {
      getOnboardingStatus()
        .then((status) => {
          if (!status.complete && !status.packages_ready) {
            setSetupPhase("packages");
          } else if (!status.complete) {
            setSetupPhase("onboarding");
            setShowOnboarding(true);
          } else {
            setSetupPhase("done");
          }
        })
        .catch(() => setSetupPhase("done"));
    } else {
      setSetupPhase("done");
    }
  }, []);

  function handleVoiceResult(text) {
    if (!chatWorkspace) {
      // DM mode — send voice transcript as DM instead of stream-json injection
      sendDm(text).catch(() => {});
    }
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

  // Loading state
  if (setupPhase === "loading") {
    return null;
  }

  // Packages setup step
  if (setupPhase === "packages") {
    return (
      <SetupPackages
        onComplete={() => {
          setSetupPhase("onboarding");
          setShowOnboarding(true);
        }}
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
      {setupPhase === "done" && showBackstage && <PermissionToasts />}
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
