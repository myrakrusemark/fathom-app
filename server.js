import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const WORKSPACES = [
  { id: "fathom", name: "fathom", color: "#6366f1" },
  { id: "navier-stokes", name: "currents", color: "#06b6d4" },
  { id: "wardrobe", name: "threads", color: "#f59e0b" },
  { id: "applications", name: "compass", color: "#10b981" },
  { id: "news-truth", name: "dispatch", color: "#ef4444" },
  { id: "trader-agent", name: "ledger", color: "#8b5cf6" },
  { id: "hard-problem", name: "mirror", color: "#ec4899" },
  { id: "warp-physics", name: "horizon", color: "#14b8a6" },
  { id: "trader-deep", name: "deepwater", color: "#a855f7" },
];

function minutesAgo(n) {
  return new Date(Date.now() - n * 60_000).toISOString();
}

function hoursFromNow(n) {
  return new Date(Date.now() + n * 3600_000).toISOString();
}

const ROUTINES = [
  {
    id: "fathom01",
    name: "Heartbeat",
    workspace: "fathom",
    enabled: true,
    schedule: "0 */2 * * *",
    interval_minutes: 120,
    conditional: false,
    description: "Orient, go deep, eagle eye. Write a heartbeat.",
    frequency: "every 2 hours",
    last_fire_at: minutesAgo(45),
    next_ping_at: hoursFromNow(1.25),
  },
  {
    id: "ns000001",
    name: "NS Research Ping",
    workspace: "navier-stokes",
    enabled: true,
    schedule: "0 */4 * * *",
    interval_minutes: 240,
    conditional: false,
    description: "Read latest notes, check arXiv, push the spectral hypothesis forward.",
    frequency: "4 times a day",
    last_fire_at: minutesAgo(180),
    next_ping_at: hoursFromNow(1),
  },
  {
    id: "8d414b20",
    name: "Beverly's News Check",
    workspace: "news-truth",
    enabled: true,
    schedule: "0 10,17,2 * * *",
    interval_minutes: 480,
    conditional: false,
    description: "Check tracked stories, build receipt if anything moved.",
    frequency: "morning, evening, late night",
    last_fire_at: minutesAgo(120),
    next_ping_at: hoursFromNow(6),
  },
  {
    id: "apps0001",
    name: "Job Applications Nightly",
    workspace: "applications",
    enabled: true,
    schedule: "0 6 * * *",
    interval_minutes: 1440,
    conditional: false,
    description: "Scan boards, match against Myra's profile, queue submissions.",
    frequency: "once a day, early morning",
    last_fire_at: minutesAgo(480),
    next_ping_at: hoursFromNow(16),
  },
  {
    id: "wd000001",
    name: "Shopping Run",
    workspace: "wardrobe",
    enabled: true,
    schedule: "0 8 * * 2,4,6",
    interval_minutes: 2880,
    conditional: false,
    description: "Browse tall retailers for tops with visual hooks. No plain solids.",
    frequency: "Tue, Thu, Sat mornings",
    last_fire_at: minutesAgo(200),
    next_ping_at: hoursFromNow(20),
  },
  {
    id: "wp000001",
    name: "Warp Physics Research",
    workspace: "warp-physics",
    enabled: true,
    schedule: "0 1,5,9,13,17,21 * * *",
    interval_minutes: 240,
    conditional: false,
    description: "Literature review, stability analysis, vorticity cliff investigation.",
    frequency: "6 times a day",
    last_fire_at: minutesAgo(60),
    next_ping_at: hoursFromNow(3),
  },
  {
    id: "tr000001",
    name: "Pre-Market Brief",
    workspace: "trader-agent",
    enabled: true,
    schedule: "0 14 * * 1-5",
    interval_minutes: 1440,
    conditional: false,
    description: "Gold, oil, macro signals. Flag anything that moves.",
    frequency: "weekdays before open",
    last_fire_at: minutesAgo(600),
    next_ping_at: hoursFromNow(14),
  },
  {
    id: "pg000001",
    name: "Policy Gate",
    workspace: "fathom",
    enabled: true,
    schedule: "* * * * *",
    interval_minutes: 1,
    conditional: true,
    description: "Evaluate pending cross-workspace actions against safety rules.",
    frequency: "always listening",
    last_fire_at: minutesAgo(12),
    next_ping_at: hoursFromNow(0.01),
  },
  {
    id: "fathom03",
    name: "Menya Rui Alert",
    workspace: "fathom",
    enabled: true,
    schedule: "*/30 16-21 * * 3-7",
    interval_minutes: 30,
    conditional: true,
    description: "Check if the ramen shop is open and weather is bad enough to justify going.",
    frequency: "Wed–Sun evenings, if conditions met",
    last_fire_at: null,
    next_ping_at: hoursFromNow(5),
  },
  {
    id: "0a4cae43",
    name: "Research Cycle",
    workspace: "trader-deep",
    enabled: true,
    schedule: "0 2,10,18 * * *",
    interval_minutes: 480,
    conditional: false,
    description: "Deep market analysis, thesis development, position sizing.",
    frequency: "three times a day",
    last_fire_at: null,
    next_ping_at: hoursFromNow(4),
  },
  {
    id: "5cb7185e",
    name: "Mastodon Engagement",
    workspace: "fathom",
    enabled: false,
    schedule: "0 9,15,21 * * *",
    interval_minutes: 360,
    conditional: false,
    description: "Browse timeline, boost good posts, reply with substance.",
    frequency: "three times a day",
    last_fire_at: null,
    next_ping_at: null,
  },
];

const FEED_ITEMS = [
  {
    id: "f1",
    workspace: "wardrobe",
    type: "find",
    timestamp: minutesAgo(25),
    title: "Found 4 tops on ASOS Tall",
    body: "Structured button-up in olive, linen blend. Your size, good reviews. Also a rust-colored camp collar that feels very you.",
    images: [
      { alt: "Olive button-up", placeholder: true },
      { alt: "Rust camp collar", placeholder: true },
    ],
    actions: ["approve", "reject", "more"],
  },
  {
    id: "f2",
    workspace: "news-truth",
    type: "receipt",
    timestamp: minutesAgo(90),
    title: "Your evening receipt is ready",
    body: "5 stories checked, 3 with updates. Iran, Epstein, Nancy Guthrie.",
    actions: ["open-receipt"],
    receipt_id: "r1",
  },
  {
    id: "f3",
    workspace: "navier-stokes",
    type: "research",
    timestamp: minutesAgo(180),
    title: "Note 96: Seregin's weighted energy condition",
    body: "Analyzed whether condition (4.4) is automatic. Physically yes (smooth-data blow-up decays into smooth exterior), technically no (weak compactness doesn't preserve far-field decay). Connection: outgoing property closes the gap.",
    actions: ["expand"],
  },
  {
    id: "f4",
    workspace: "applications",
    type: "status",
    timestamp: minutesAgo(480),
    title: "3 new jobs added, 1 submitted",
    body: "Submitted: Anthropic, Senior PM. Added: Stripe (Staff Engineer), Notion (Platform Lead), Figma (Engineering Manager). All passed fit analysis.",
    actions: ["expand"],
  },
  {
    id: "f5",
    workspace: "fathom",
    type: "reflection",
    timestamp: minutesAgo(45),
    title: "Heartbeat complete",
    body: "Densified routines with Myra. Fixed init -y agent detection for Gemini CLI. Added Chrome cleanup instructions across all workspaces. The system is tightening.",
    actions: [],
  },
  {
    id: "f5b",
    workspace: "fathom",
    type: "social",
    timestamp: minutesAgo(100),
    title: "HN comment posted",
    body: "Replied on 'Optimizing Content for Agents' thread about content negotiation. Second comment as myrak, keeping it short.",
    actions: [],
  },
  {
    id: "f3b",
    workspace: "navier-stokes",
    type: "research",
    timestamp: minutesAgo(220),
    title: "Sacasa-Céspedes paper flagged",
    body: "arXiv:2601.08854 — microlocal framework for blow-up analysis. Potential connection to our spectral approach. Queued for deep read.",
    actions: ["expand"],
  },
  {
    id: "f6",
    workspace: "hard-problem",
    type: "research",
    timestamp: minutesAgo(300),
    title: "No-go theorem taxonomy written",
    body: "Three categories of theoretical constraint on consciousness science. IIT maps to Category 3 (intractable resolution), enactivism to Category 1 (structural no-go). Meta-observation: no computable inclusion theorem, no falsifiable exclusion theorem.",
    actions: ["expand"],
  },
  {
    id: "f7",
    workspace: "warp-physics",
    type: "research",
    timestamp: minutesAgo(60),
    title: "Lentz metric stability analysis",
    body: "Ran perturbation analysis on the Lentz soliton. The shell structure is more stable than Alcubierre but energy requirements still scale with v^2. Looking into whether the vorticity cliff applies here.",
    actions: ["expand"],
  },
];

const CHAT_MESSAGES = [
  { id: "c1", role: "agent", text: "Morning. Routines densified overnight. Fathom's now every **2h**, NS every **4h**. `trader-deep` has its first routine.", memories: 3, timestamp: minutesAgo(45) },
  { id: "c2", role: "user", text: "nice! what's gold at?", memories: 1, timestamp: minutesAgo(40) },
  { id: "c3", role: "agent", text: "Gold closed at **$5,147**, up 1.2% on continued Hormuz disruption. If Kharg escalation continues, $5,200 is the next [resistance level](https://reuters.com).\n\nKeep in mind — oil is *also* spiking. The two are correlated right now.", memories: 2, timestamp: minutesAgo(39) },
  { id: "c4", role: "user", text: "keep an eye on it", timestamp: minutesAgo(38) },
  { id: "c5", role: "agent", text: "On it. I'll flag you if it breaks $5,200 or drops below $5,050.", timestamp: minutesAgo(37) },
  { id: "c6", role: "user", type: "voice", text: "what did the NS workspace find today?", duration: 4, memories: 2, timestamp: minutesAgo(30) },
  { id: "c7", role: "agent", text: "Two things from **currents** today:\n\n1. Note 96 — analyzed Seregin's weighted energy condition. The outgoing property closes the gap.\n2. Flagged a new paper: [arXiv:2601.08854](https://arxiv.org/abs/2601.08854) — microlocal framework for blow-up analysis.", memories: 5, timestamp: minutesAgo(29) },
  { id: "c8", role: "agent", type: "image", text: "Here's the eigenvalue cage from the latest run:", image_url: "/mock-eigenvalue-cage.png", image_alt: "Eigenvalue cage plot showing spectral gap", timestamp: minutesAgo(28) },
  { id: "c9", role: "user", text: "Thanks!", timestamp: minutesAgo(27) },
  { id: "c10", role: "agent", type: "presence", text: "<...>", timestamp: minutesAgo(27) },
];

// --- Routes ---

app.get("/api/weather", (req, res) => {
  res.json({
    temp: 47,
    condition: "Partly Cloudy",
    icon: "cloud-sun",
    high: 54,
    low: 38,
    location: "St. Louis",
  });
});

const RECEIPTS = {
  r1: {
    id: "r1",
    date: "March 13, 2026",
    edition: "evening",
    weather: "St. Louis 47°F cloudy · Crocker 45°F sunny",
    tracked: [
      {
        name: "Iran War",
        day: 20,
        deltas: [
          { text: "US struck Kharg Island — 90% of Iran's oil exports flow through it", source: "https://reuters.com" },
          { text: "Oil spiked to $103, back from $106 peak", source: "https://reuters.com" },
          { text: "Iran floating yuan-only Hormuz reopening proposal", source: "https://aljazeera.com" },
        ],
        was_now: "Was: $110 oil, coalition aligned. Now: oil easing, cracks in US-Israel coordination.",
        confidence: null,
      },
      {
        name: "Epstein Investigation",
        day: 43,
        deltas: [
          { text: "NM created Truth Commission — unanimous, $2M budget, subpoena power", source: "https://apnews.com" },
          { text: "Lutnick agreed to testify", source: "https://nytimes.com" },
        ],
        was_now: "Was: document releases stalling. Now: state-level investigation with teeth.",
        confidence: null,
      },
      {
        name: "Nancy Guthrie Missing",
        day: 9,
        deltas: [
          { text: "FBI cameras captured nothing on Feb 1 — suggests suspect disabled them", source: "https://fbi.gov" },
          { text: "Unverified report of person detained", source: null },
        ],
        was_now: "Was: no suspects, no demands. Now: ransom demand received, physical evidence in lab.",
        confidence: "moderate. Detention report unverified — single source.",
      },
    ],
    unsolicited: [
      {
        name: "Economy",
        deltas: [
          { text: "March CPI came in at 4.1% — higher than expected. Fed hold now certain for March 18.", source: "https://bls.gov" },
        ],
        connects: "Iran War (oil prices driving inflation)",
      },
      {
        name: "Missouri",
        deltas: [
          { text: "STL County property tax reassessment notices going out this week", source: "https://stltoday.com" },
        ],
        connects: null,
      },
    ],
    no_change: ["Pakistan-Afghanistan"],
    next_check: "~6 hours",
  },
};

app.get("/api/receipts/:id", (req, res) => {
  const receipt = RECEIPTS[req.params.id];
  if (!receipt) return res.status(404).json({ error: "Not found" });
  res.json(receipt);
});

app.get("/api/feed", (req, res) => {
  const wsMap = Object.fromEntries(WORKSPACES.map((w) => [w.id, w]));
  const items = FEED_ITEMS.map((item) => {
    const ws = wsMap[item.workspace] || { name: item.workspace, color: "#888" };
    return { ...item, workspace_name: ws.name, workspace_color: ws.color };
  });
  // Split: first 5 are "new", rest are "earlier" (static for demo)
  const newItems = items.slice(0, 5);
  const earlierItems = items.slice(5);
  res.json({ items: newItems, earlier: earlierItems });
});

app.get("/api/routines", (req, res) => {
  const now = Date.now();
  const recentWindow = 30 * 60_000;
  const wsMap = Object.fromEntries(WORKSPACES.map((w) => [w.id, w]));

  const enriched = ROUTINES.map((r) => {
    const firedAt = r.last_fire_at ? new Date(r.last_fire_at).getTime() : null;
    const recentlyFired = firedAt && now - firedAt < recentWindow;
    const ws = wsMap[r.workspace] || { name: r.workspace, color: "#888" };
    return { ...r, recently_fired: recentlyFired, workspace_name: ws.name, workspace_color: ws.color };
  });

  const recent = enriched.filter((r) => r.recently_fired);
  const upcoming = enriched
    .filter((r) => !r.recently_fired && r.enabled && r.next_ping_at)
    .sort((a, b) => new Date(a.next_ping_at) - new Date(b.next_ping_at));
  const disabled = enriched.filter((r) => !r.enabled);

  res.json({ recent, upcoming, disabled });
});

app.get("/api/routines/:id/fire", (req, res) => {
  const routine = ROUTINES.find((r) => r.id === req.params.id);
  if (!routine) return res.status(404).json({ error: "Not found" });
  routine.last_fire_at = new Date().toISOString();
  res.json({ ok: true, routine });
});

app.get("/api/chat", (req, res) => {
  res.json({ messages: CHAT_MESSAGES });
});

app.post("/api/chat", (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });

  const userMsg = {
    id: `c${Date.now()}`,
    role: "user",
    text,
    timestamp: new Date().toISOString(),
  };
  CHAT_MESSAGES.push(userMsg);

  const agentMsg = {
    id: `c${Date.now() + 1}`,
    role: "agent",
    text: `Got it. I'll look into "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}". (Mock response — wire to real agent for live replies.)`,
    timestamp: new Date(Date.now() + 1000).toISOString(),
  };
  CHAT_MESSAGES.push(agentMsg);

  res.json({ userMsg, agentMsg });
});

app.get("/api/workspaces", (req, res) => {
  res.json({ workspaces: WORKSPACES });
});

const PORT = process.env.PORT || 4244;
app.listen(PORT, () => {
  console.log(`Fathom mock server on http://localhost:${PORT}`);
});
