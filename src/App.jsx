import { useState, useCallback, useEffect, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { isConnected, detectSameOrigin, saveConnection, getConnection } from "./lib/connection.js";
import { getOnboardingStatus, submitOnboarding, getDmUnreadCount, sendDm, getThemes, readRoom } from "./api/client.js";
import Feed from "./components/Feed.jsx";
import Routines from "./components/Routines.jsx";
import Backstage from "./components/Backstage.jsx";
import ChatSheet from "./components/ChatSheet.jsx";
import NavBar from "./components/NavBar.jsx";
import Onboarding from "./components/Onboarding.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import SetupPackages from "./components/SetupPackages.jsx";
import PermissionToasts from "./components/PermissionToasts.jsx";
import AudioPlayerBar from "./components/AudioPlayerBar.jsx";
import { AudioPlayerProvider } from "./contexts/AudioPlayerContext.jsx";

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
  const [themes, setThemes] = useState([]);
  const [themeName, setThemeName] = useState(() => localStorage.getItem('fathom-theme') || null);
  const appliedVars = useRef([]);
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

  // Load available themes from server
  useEffect(() => {
    if (!connected) return;
    getThemes().then(setThemes).catch(() => {});
  }, [connected]);

  // Wallpaper: fetch latest from #wallpaper room
  const [wallpaper, setWallpaper] = useState(null);

  // Apply selected theme (or revert to default); re-apply wallpaper after since
  // setting body.style.background (shorthand) resets backgroundImage
  useEffect(() => {
    const theme = themes.find((t) => t.id === themeName);
    // Clear previously applied overrides
    for (const prop of appliedVars.current) {
      document.documentElement.style.removeProperty(prop);
    }
    appliedVars.current = [];

    if (!theme) {
      document.body.style.background = "";
      document.body.style.backgroundAttachment = "";
      document.body.style.color = "";
      document.documentElement.style.removeProperty("--text");
      localStorage.removeItem("fathom-theme");
    } else {
      document.body.style.background = theme.bg;
      document.body.style.backgroundAttachment = "fixed";
      document.body.style.color = theme.text || "";
      document.documentElement.style.setProperty("--text", theme.text || "#1a1a2e");
      appliedVars.current.push("--text");
      for (const [prop, val] of Object.entries(theme.variables || {})) {
        document.documentElement.style.setProperty(prop, val);
        appliedVars.current.push(prop);
      }
      localStorage.setItem("fathom-theme", themeName);
    }

    if (wallpaper?.url) {
      document.body.style.backgroundImage = `url(${wallpaper.url})`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundAttachment = "fixed";
    }
  }, [themeName, themes, wallpaper]);

  useEffect(() => {
    if (!connected || setupPhase !== "done") return;
    let cancelled = false;

    function fetchWallpaper() {
      readRoom("wallpaper", 10080) // last 7 days
        .then((res) => {
          const msgs = res?.messages;
          if (cancelled || !msgs || !msgs.length) return;
          const latest = msgs[msgs.length - 1];
          try {
            const data = typeof latest.message === "string"
              ? JSON.parse(latest.message)
              : latest.message;
            if (data?.url) setWallpaper({ ...data, sender: latest.sender, id: latest.id });
          } catch {
            // not JSON or no url field — ignore
          }
        })
        .catch(() => {});
    }

    fetchWallpaper();
    const id = setInterval(fetchWallpaper, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [connected, setupPhase]);

  const prevWallpaperId = useRef(null);

  // Auto-apply theme when a new wallpaper specifies one.
  // backgroundImage is already applied by the theme effect above (which re-runs on wallpaper change).
  useEffect(() => {
    if (!wallpaper?.url || wallpaper.id === prevWallpaperId.current) return;
    prevWallpaperId.current = wallpaper.id;
    if ('theme' in wallpaper) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deriving themeName from wallpaper prop on change is intentional; avoids extra state field
      setThemeName(wallpaper.theme ?? null);
    }
  }, [wallpaper]);

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
    // Submit to server — DMs fathom with user intro and posts welcome to feed
    submitOnboarding(name, interests)
      .then(() => {
        // Update connection with the user's identity so DM rooms resolve correctly
        const conn = getConnection();
        if (conn && name) {
          const humanUser = name.toLowerCase().replace(/\s+/g, "-");
          saveConnection({ ...conn, humanUser, humanDisplayName: name });
        }
        setTimeout(() => setFeedKey((k) => k + 1), 2000);
      })
      .catch(console.error);
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
    <AudioPlayerProvider>
      {showOnboarding && (
        <div
          className={`onboard-overlay ${completing ? "onboard-exit" : ""}`}
          onAnimationEnd={handleOnboardFadeEnd}
        >
          <Onboarding onComplete={handleOnboardComplete} />
        </div>
      )}
      {setupPhase === "done" && showBackstage && <PermissionToasts />}
      <AudioPlayerBar />
      <div className="app">
        <Routes>
          <Route path="/" element={
            <Feed
              key={feedKey}
              onChatOpen={() => { setChatWorkspace(null); setUnreadCount(0); setChatOpen(true); }}
              unreadCount={unreadCount}
              wallpaper={wallpaper}
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
          themes={themes}
          selectedTheme={themeName}
          onThemeChange={setThemeName}
          showBackstage={showBackstage}
          onShowBackstageChange={setShowBackstage}
        />
      </div>
    </AudioPlayerProvider>
  );
}
