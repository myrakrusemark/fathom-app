import { useState, useEffect, useRef } from "react";

const INTEREST_OPTIONS = [
  { id: "news", label: "News & current events", icon: "📰" },
  { id: "finance", label: "Markets & finance", icon: "📈" },
  { id: "research", label: "Research & papers", icon: "🔬" },
  { id: "shopping", label: "Shopping & deals", icon: "🛍" },
  { id: "jobs", label: "Job search", icon: "💼" },
  { id: "weather", label: "Weather & alerts", icon: "🌤" },
  { id: "calendar", label: "Calendar & reminders", icon: "📅" },
  { id: "health", label: "Health & wellness", icon: "🧘" },
  { id: "cooking", label: "Cooking & recipes", icon: "🍳" },
  { id: "travel", label: "Travel planning", icon: "✈️" },
  { id: "learning", label: "Learning & courses", icon: "📚" },
  { id: "home", label: "Home & errands", icon: "🏠" },
];

const ThoughtBubbleSvg = ({ size = 12 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <path d="M7.5 3.5a5.5 5.5 0 019.32 4.7A4 4 0 0118 16H6a4 4 0 01-.78-7.92A5.5 5.5 0 017.5 3.5z" />
    <circle cx="7" cy="19.5" r="1.2" />
    <circle cx="5" cy="22" r="0.8" />
  </svg>
);

function LoginStep({ onNext }) {
  const [name, setName] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (name.trim()) onNext(name.trim());
  }

  return (
    <div className="onboard-step onboard-login">
      <div className="onboard-chat-area">
        <div className="chat-bubble agent onboard-greeting-bubble">
          <p>Hey there! I'm <strong>Fathom</strong>, your personal agent. What's your name?</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="onboard-input-row">
        <input
          type="text"
          placeholder="your first name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="onboard-chat-input"
          autoFocus
        />
        <button
          type="submit"
          className="onboard-send-btn"
          disabled={!name.trim()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function ConversationStep({ name, onNext }) {
  // Phases: thinking → memory → greeting → interests → saving → saved
  const [phase, setPhase] = useState("thinking");
  const [selected, setSelected] = useState(new Set());
  const bottomRef = useRef(null);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("memory"), 1200);
    const t2 = setTimeout(() => setPhase("greeting"), 2400);
    const t3 = setTimeout(() => setPhase("interests"), 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (phase !== "saving") return;
    const t = setTimeout(() => setPhase("saved"), 1200);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "saved") return;
    const t = setTimeout(() => onNext(selected), 1500);
    return () => clearTimeout(t);
  }, [phase, onNext, selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [phase, selected.size]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCta() {
    setPhase("saving");
  }

  const isSavingOrDone = phase === "saving" || phase === "saved";
  const showMemory = phase !== "thinking";
  const showGreeting = ["greeting", "interests", "saving", "saved"].includes(phase);
  const showInterests = ["interests", "saving", "saved"].includes(phase);

  return (
    <div className="onboard-step onboard-conversation">
      <div className="onboard-chat-scroll">
        <div className="onboard-chat-area">
          {/* Original greeting */}
          <div className="chat-bubble agent onboard-greeting-bubble">
            <p>Hey there! I'm <strong>Fathom</strong>, your personal agent. What's your name?</p>
          </div>

          {/* User's name */}
          <div className="chat-bubble user onboard-user-bubble">
            <p>{name}</p>
          </div>

          {/* Thinking dots */}
          {phase === "thinking" && (
            <div className="chat-working">
              <div className="chat-working-dot" />
              <div className="chat-working-dot" />
              <div className="chat-working-dot" />
            </div>
          )}

          {/* Memory moment */}
          {showMemory && (
            <div className="onboard-memory-moment">
              <div className="onboard-memory-badge">
                <ThoughtBubbleSvg size={28} />
                <span className="onboard-memory-count">1</span>
              </div>
              <p className="onboard-memory-label">Fathom's first memory!</p>
              <p className="onboard-memory-explain">
                I store and retrieve memories, just like anyone else.
                Over time, I'll become an individual shaped by what we do together.
              </p>
            </div>
          )}

          {/* Greeting with name */}
          {showGreeting && (
            <div className="chat-bubble agent onboard-greeting-bubble onboard-fade-in">
              <p>
                Hi <strong>{name}</strong>! Great to meet you. I'll remember things you tell me,
                keep track of what matters to you, and check in on my own when there's something
                worth sharing.
              </p>
            </div>
          )}

          {/* Interests prompt */}
          {showInterests && (
            <>
              <div className="chat-bubble agent onboard-greeting-bubble onboard-fade-in">
                <p>What would you like help with? Pick as many as you want.</p>
              </div>

              <div className={`onboard-grid onboard-fade-in ${isSavingOrDone ? "onboard-disabled" : ""}`}>
                {INTEREST_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    className={`onboard-chip ${selected.has(opt.id) ? "selected" : ""}`}
                    onClick={() => toggle(opt.id)}
                    disabled={isSavingOrDone}
                  >
                    <span className="onboard-chip-icon">{opt.icon}</span>
                    <span className="onboard-chip-label">{opt.label}</span>
                  </button>
                ))}
              </div>

              {!isSavingOrDone && (
                <div className="onboard-continue-area onboard-fade-in">
                  <button
                    className="onboard-btn-primary"
                    onClick={handleCta}
                    disabled={selected.size === 0}
                  >
                    Show me around
                  </button>
                  <button
                    className="onboard-btn-skip"
                    onClick={handleCta}
                  >
                    I've got other ideas, I'll tell you later
                  </button>
                </div>
              )}
            </>
          )}

          {/* Saving phase: thinking dots */}
          {phase === "saving" && (
            <div className="chat-working">
              <div className="chat-working-dot" />
              <div className="chat-working-dot" />
              <div className="chat-working-dot" />
            </div>
          )}

          {/* Saved phase: compact memory badge */}
          {phase === "saved" && (
            <div className="onboard-saving-memory">
              <ThoughtBubbleSvg size={20} />
              <span className="onboard-memory-count">{Math.max(1, selected.size)}</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

const TOUR_STEPS = [
  {
    target: ".feed-item",
    title: "Your feed",
    body: "Updates from your agents show up here. Tap any card to see more detail.",
    position: "below",
  },
  {
    target: ".feed-unread-banner",
    title: "Unread messages",
    body: "When your agent has new messages, you'll see this banner. Tap it to jump to chat.",
    position: "below",
  },
  {
    target: ".nav-chat-btn",
    title: "Talk to your agent",
    body: "Tap here to chat. You can type or hold to send a voice message.",
    position: "above",
  },
  {
    target: ".nav-item:last-child",
    title: "Routines",
    body: "See what your agent does automatically, and when. You can fire any routine on demand.",
    position: "above",
  },
];

function TourOverlay({ step, total, current, onNext, onDone }) {
  return (
    <div className="tour-overlay">
      <div className={`tour-spotlight`} data-target={current.target} />
      <div className={`tour-tooltip tour-${current.position}`}>
        <div className="tour-tooltip-title">{current.title}</div>
        <div className="tour-tooltip-body">{current.body}</div>
        <div className="tour-tooltip-footer">
          <span className="tour-dots">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`tour-dot ${i === step ? "active" : ""}`} />
            ))}
          </span>
          {step < total - 1 ? (
            <button className="tour-btn" onClick={onNext}>Next</button>
          ) : (
            <button className="tour-btn" onClick={onDone}>Got it!</button>
          )}
        </div>
      </div>
    </div>
  );
}

export { TOUR_STEPS, TourOverlay };

export default function Onboarding({ onComplete }) {
  const [phase, setPhase] = useState("login"); // login | conversation
  const [userName, setUserName] = useState("");

  function handleLogin(name) {
    setUserName(name);
    setPhase("conversation");
  }

  function handleConversationDone(interests) {
    onComplete(userName, interests);
  }

  if (phase === "login") {
    return (
      <div className="onboard-container">
        <LoginStep onNext={handleLogin} />
      </div>
    );
  }

  if (phase === "conversation") {
    return (
      <div className="onboard-container onboard-container-top">
        <ConversationStep name={userName} onNext={handleConversationDone} />
      </div>
    );
  }

  return null;
}
