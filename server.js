import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

function minutesAgo(n) {
  return new Date(Date.now() - n * 60_000).toISOString();
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function hoursFromNow(n) {
  return new Date(Date.now() + n * 3600_000).toISOString();
}

// Consolidated workspace + routine data (mirrors workspaces.json nested structure)
const WORKSPACES_DATA = {
  fathom: {
    name: "fathom",
    color: "#6366f1",
    routines: [
      {
        id: "fathom01",
        name: "Heartbeat",
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
        id: "pg000001",
        name: "Policy Gate",
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
        id: "5cb7185e",
        name: "Mastodon Engagement",
        enabled: false,
        schedule: "0 9,15,21 * * *",
        interval_minutes: 360,
        conditional: false,
        description: "Browse timeline, boost good posts, reply with substance.",
        frequency: "three times a day",
        last_fire_at: null,
        next_ping_at: null,
      },
    ],
  },
  "navier-stokes": {
    name: "currents",
    color: "#06b6d4",
    routines: [
      {
        id: "ns000001",
        name: "NS Research Ping",
        enabled: true,
        schedule: "0 */4 * * *",
        interval_minutes: 240,
        conditional: false,
        description: "Read latest notes, check arXiv, push the spectral hypothesis forward.",
        frequency: "4 times a day",
        last_fire_at: minutesAgo(180),
        next_ping_at: hoursFromNow(1),
      },
    ],
  },
  wardrobe: {
    name: "threads",
    color: "#f59e0b",
    routines: [
      {
        id: "wd000001",
        name: "Shopping Run",
        enabled: true,
        schedule: "0 8 * * 2,4,6",
        interval_minutes: 2880,
        conditional: false,
        description: "Browse tall retailers for tops with visual hooks. No plain solids.",
        frequency: "Tue, Thu, Sat mornings",
        last_fire_at: minutesAgo(200),
        next_ping_at: hoursFromNow(20),
      },
    ],
  },
  applications: {
    name: "compass",
    color: "#10b981",
    routines: [
      {
        id: "apps0001",
        name: "Job Applications Nightly",
        enabled: true,
        schedule: "0 6 * * *",
        interval_minutes: 1440,
        conditional: false,
        description: "Scan boards, match against Myra's profile, queue submissions.",
        frequency: "once a day, early morning",
        last_fire_at: minutesAgo(480),
        next_ping_at: hoursFromNow(16),
      },
    ],
  },
  "news-truth": {
    name: "dispatch",
    color: "#ef4444",
    routines: [
      {
        id: "8d414b20",
        name: "Beverly's News Check",
        enabled: true,
        schedule: "0 10,17,2 * * *",
        interval_minutes: 480,
        conditional: false,
        description: "Check tracked stories, build receipt if anything moved.",
        frequency: "morning, evening, late night",
        last_fire_at: minutesAgo(120),
        next_ping_at: hoursFromNow(6),
      },
    ],
  },
  "trader-agent": {
    name: "ledger",
    color: "#8b5cf6",
    routines: [
      {
        id: "tr000001",
        name: "Pre-Market Brief",
        enabled: true,
        schedule: "0 14 * * 1-5",
        interval_minutes: 1440,
        conditional: false,
        description: "Gold, oil, macro signals. Flag anything that moves.",
        frequency: "weekdays before open",
        last_fire_at: minutesAgo(600),
        next_ping_at: hoursFromNow(14),
      },
    ],
  },
  "hard-problem": {
    name: "mirror",
    color: "#ec4899",
    routines: [],
  },
  "warp-physics": {
    name: "horizon",
    color: "#14b8a6",
    routines: [
      {
        id: "wp000001",
        name: "Warp Physics Research",
        enabled: true,
        schedule: "0 1,5,9,13,17,21 * * *",
        interval_minutes: 240,
        conditional: false,
        description: "Literature review, stability analysis, vorticity cliff investigation.",
        frequency: "6 times a day",
        last_fire_at: minutesAgo(60),
        next_ping_at: hoursFromNow(3),
      },
    ],
  },
  "trader-deep": {
    name: "deepwater",
    color: "#a855f7",
    routines: [
      {
        id: "0a4cae43",
        name: "Research Cycle",
        enabled: true,
        schedule: "0 2,10,18 * * *",
        interval_minutes: 480,
        conditional: false,
        description: "Deep market analysis, thesis development, position sizing.",
        frequency: "three times a day",
        last_fire_at: null,
        next_ping_at: hoursFromNow(4),
      },
    ],
  },
};

// Derive flat lists from nested structure
function getWorkspaceList() {
  return Object.entries(WORKSPACES_DATA).map(([id, ws]) => ({
    id,
    name: ws.name,
    color: ws.color,
    routine_count: ws.routines.length,
  }));
}

function getFlatRoutines() {
  const flat = [];
  for (const [wsId, ws] of Object.entries(WORKSPACES_DATA)) {
    for (const r of ws.routines) {
      flat.push({ ...r, workspace: wsId, workspace_name: ws.name, workspace_color: ws.color });
    }
  }
  return flat;
}

const FEED_ITEMS = [
  {
    id: "f1",
    workspace: "navier-stokes",
    type: "research",
    layout: "hero",
    timestamp: minutesAgo(30),
    title: "Four pillars standing — proof architecture complete",
    body: `<div style="font-family:system-ui">
      <p>All four pillars confirmed. The spectral hypothesis now has a full proof skeleton:</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">
        <span style="background:#06b6d4;color:white;padding:2px 8px;border-radius:10px;font-size:12px">transport cancellation</span>
        <span style="background:#06b6d4;color:white;padding:2px 8px;border-radius:10px;font-size:12px">strain bound</span>
        <span style="background:#06b6d4;color:white;padding:2px 8px;border-radius:10px;font-size:12px">O(γ³) nonlinearity</span>
        <span style="background:#06b6d4;color:white;padding:2px 8px;border-radius:10px;font-size:12px">viscous cooperation</span>
      </div>
      <p>Remaining: Schauder constant tracking and interpolation inequality. Infrastructure, not the flashy problem.</p>
      <a href="https://zenodo.org/records/18966173" target="_blank"><img src="https://upload.wikimedia.org/wikipedia/commons/7/71/Heard_Island_Karman_vortex_street.jpg" style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;margin-top:10px" alt="Von Karman vortex street — fluid dynamics visualization"></a>
      <p style="margin-top:6px;font-size:12px;color:#9898ad">Von Karman vortex street, Heard Island. <a href="https://zenodo.org/records/18966173" target="_blank" style="color:#06b6d4">Paper on Zenodo →</a></p>
    </div>`,
    attachments: [
      { url: "/api/vault/raw/research/note-96.md?workspace=navier-stokes", label: "Note 96: Seregin Analysis", type: "markdown", size: 4200 },
      { url: "/api/vault/raw/thinking/four-pillars-and-one-boring-gap.md?workspace=navier-stokes", label: "Four Pillars Reflection", type: "markdown", size: 3100 },
    ],
    messages: [
      { role: "user", text: "what's left before this is submittable?", time: minutesAgo(28) },
      { role: "agent", text: "Two things: Schauder constant tracking (need explicit bounds through the interpolation chain) and the interpolation inequality itself. Both are technical infrastructure — the conceptual architecture is done. I'd estimate 2-3 focused sessions.", time: minutesAgo(27) },
      { role: "user", text: "can you write up the proof skeleton as a standalone doc? something I can send to Erik", time: minutesAgo(25) },
      { role: "agent", text: "On it. I'll put it in vault/research/proof-skeleton-standalone.md with the four pillars, the gap closure argument, and explicit pointers to which steps need the Schauder work.", time: minutesAgo(24) },
    ],
    actions: ["expand"],
  },
  {
    id: "f2",
    workspace: "wardrobe",
    type: "find",
    layout: "featured",
    timestamp: minutesAgo(25),
    title: "ASOS Tall Olive Linen Button-Up",
    body: `<div style="display:flex;gap:14px;font-family:system-ui">
      <a href="https://www.asos.com/us/asos-tall/" target="_blank"><img src="https://images.asos-media.com/products/asos-design-100-linen-boxy-oversized-shirt-in-khaki/208001120-1-khaki/?$n_640w$&wid=634&fit=constrain" style="width:120px;height:160px;object-fit:cover;border-radius:8px" alt="Olive linen button-up"></a>
      <div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
          <span style="font-weight:600;font-size:16px">$48</span>
          <span style="background:#f59e0b;color:white;padding:1px 6px;border-radius:8px;font-size:11px;font-weight:600">TALL</span>
          <span style="background:#22c55e;color:white;padding:1px 6px;border-radius:8px;font-size:11px;font-weight:600">3/4 SLEEVE</span>
        </div>
        <p style="font-size:13px;color:#5c5c72">Structured fit, linen blend. Sidesteps the arm issue. Good reviews on tall sizing, your size in stock.</p>
        <p style="margin-top:6px"><a href="https://www.asos.com/us/asos-tall/" target="_blank" style="color:#f59e0b;font-size:13px">View on ASOS →</a></p>
      </div>
    </div>`,
    messages: [
      { role: "user", text: "oh I like this one. is it true to size?", time: minutesAgo(20) },
      { role: "agent", text: "Reviews say yes for the tall range — one reviewer (5'11\") said the 3/4 sleeves hit exactly at the wrist. Linen blend so it won't shrink like pure cotton.", time: minutesAgo(19) },
      { role: "user", text: "add to cart", time: minutesAgo(18) },
    ],
    actions: ["approve", "reject", "more"],
  },
  {
    id: "f3",
    workspace: "warp-physics",
    type: "research",
    layout: "featured",
    timestamp: minutesAgo(60),
    title: "Lentz soliton more stable than Alcubierre",
    body: `<div style="font-family:system-ui">
      <p>Perturbation analysis shows the shell structure resists deformation better, but energy requirements still scale with v².</p>
      <p style="margin-top:6px">Investigating whether the <a href="https://arxiv.org/abs/2006.07125" target="_blank" style="color:#14b8a6">vorticity cliff</a> applies here. If it does, the Lentz metric has a hard upper bound on achievable velocity.</p>
      <div style="margin-top:8px;padding:8px 12px;background:rgba(20,184,166,0.08);border-radius:8px;border-left:3px solid #14b8a6;font-size:13px">
        Key finding: shell stability ∝ 1/thickness. Thinner shells = more stable but higher energy. Classic engineering tradeoff.
      </div>
    </div>`,
    attachments: [
      { url: "/api/vault/raw/research/lentz-stability.md?workspace=warp-physics", label: "Lentz Stability Notes", type: "markdown", size: 5800 },
    ],
    actions: ["expand"],
  },
  {
    id: "f4",
    workspace: "news-truth",
    type: "story",
    layout: "standard",
    timestamp: minutesAgo(40),
    title: "Iran blackout day 16 — Starlink arrests beginning",
    body: `<div style="font-family:system-ui">
      <p>Starlink users being arrested. <a href="https://iranintl.com" target="_blank" style="color:#ef4444">HN front page story</a> via iranintl.com.</p>
      <div style="display:flex;gap:6px;margin-top:6px">
        <span style="background:#ef4444;color:white;padding:1px 6px;border-radius:8px;font-size:11px">DAY 16</span>
        <span style="background:#71717a;color:white;padding:1px 6px;border-radius:8px;font-size:11px">HORMUZ CLOSED</span>
      </div>
    </div>`,
    actions: ["expand"],
  },
  {
    id: "f5",
    workspace: "news-truth",
    type: "story",
    layout: "standard",
    timestamp: minutesAgo(55),
    title: "Oil breaks $103 after Kharg Island strike",
    body: `<div style="font-family:system-ui">
      <p>Shell <a href="https://reuters.com" target="_blank" style="color:#ef4444">force majeure</a> on Qatar LNG. Airlines hiking prices globally — biggest air transport disruption since Covid.</p>
      <p style="margin-top:4px;font-size:13px;color:#9898ad">Previous: $106 peak → pullback to $103. Hormuz effectively closed to US shipping.</p>
    </div>`,
    actions: ["expand"],
  },
  {
    id: "f5c",
    workspace: "news-truth",
    type: "story",
    layout: "standard",
    timestamp: minutesAgo(75),
    title: "Pakistan 4-day work week amid oil crisis",
    body: `<p>Domestic pressure mounting from Iran-linked energy shock plus military overextension in Afghanistan.</p>`,
    actions: ["expand"],
  },
  {
    id: "f5d",
    workspace: "news-truth",
    type: "story",
    layout: "standard",
    timestamp: minutesAgo(80),
    title: "FOMC meets against energy shock backdrop",
    body: `<p>March CPI at 4.1%. Fed hold now certain. Oil trajectory toward $120+ if Hormuz stays closed.</p>`,
    actions: ["expand"],
  },
  {
    id: "f5e", workspace: "news-truth", type: "story", layout: "standard",
    timestamp: minutesAgo(95), title: "66,000 Afghans displaced by Pakistan strikes",
    body: `<p>110+ civilians killed, 123 injured. Children among victims. Kabul thwarted Bagram strike.</p>`, actions: [],
  },
  {
    id: "f5f", workspace: "news-truth", type: "story", layout: "standard",
    timestamp: minutesAgo(100), title: "Shell force majeure on Qatar LNG",
    body: `<p>Biggest air transport disruption since Covid. Airlines hiking prices globally.</p>`, actions: [],
  },
  {
    id: "f5g", workspace: "news-truth", type: "story", layout: "standard",
    timestamp: minutesAgo(105), title: "Starlink countermeasures under discussion",
    body: `<p>Iran considering jamming. Users already being arrested.</p>`, actions: [],
  },
  {
    id: "f5h", workspace: "news-truth", type: "story", layout: "standard",
    timestamp: minutesAgo(110), title: "Nancy Guthrie — FBI cameras captured nothing",
    body: `<p>Suspect likely disabled cameras. Ransom demand received, physical evidence in lab.</p>`, actions: [],
  },
  {
    id: "f5i", workspace: "news-truth", type: "story", layout: "standard",
    timestamp: minutesAgo(115), title: "Lutnick agrees to testify before NM commission",
    body: `<p>Gates and Black also asked for interviews. Tova Noel deposition March 26.</p>`, actions: [],
  },
  {
    id: "f5j", workspace: "news-truth", type: "story", layout: "standard",
    timestamp: minutesAgo(120), title: "BLS employment data has ±122k error margin",
    body: `<p>Monthly changes are statistical noise. readthenotes1 on HN flagged methodology.</p>`, actions: [],
  },
  {
    id: "f5k", workspace: "news-truth", type: "story", layout: "standard",
    timestamp: minutesAgo(125), title: "STL County property tax reassessments going out",
    body: `<p>Notices arriving this week across St. Louis County.</p>`, actions: [],
  },
  {
    id: "f6",
    workspace: "news-truth",
    type: "story",
    layout: "standard",
    timestamp: minutesAgo(90),
    title: "NM creates Epstein Truth Commission",
    body: `<div style="font-family:system-ui">
      <p>Unanimous vote, $2M budget, subpoena power. <a href="https://apnews.com" target="_blank" style="color:#ef4444">Lutnick agreed to testify</a>.</p>
      <p style="margin-top:4px;font-size:13px;color:#9898ad">Next: Tova Noel deposition March 26.</p>
    </div>`,
    actions: ["expand"],
    receipt_id: "r1",
  },
  {
    id: "f7",
    workspace: "wardrobe",
    type: "find",
    layout: "standard",
    timestamp: minutesAgo(70),
    title: "American Tall Rust Camp Collar",
    body: `<div style="display:flex;gap:12px;font-family:system-ui">
      <a href="https://americantall.com" target="_blank"><img src="https://images.asos-media.com/products/south-beach-camp-collar-knit-beach-shirt-in-rust/208283635-1-rust/?$n_640w$&wid=634&fit=constrain" style="width:80px;height:100px;object-fit:cover;border-radius:6px" alt="Rust camp collar"></a>
      <div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
          <span style="font-weight:600">$52</span>
          <span style="background:#f59e0b;color:white;padding:1px 6px;border-radius:8px;font-size:11px;font-weight:600">TALL</span>
        </div>
        <p style="font-size:13px;color:#5c5c72">Relaxed fit, cotton-linen. Rolled sleeves look intentional.</p>
      </div>
    </div>`,
    actions: ["approve", "reject"],
  },
  {
    id: "f8",
    workspace: "hard-problem",
    type: "research",
    layout: "standard",
    timestamp: minutesAgo(300),
    title: "No-go theorem taxonomy — three categories",
    body: `<div style="font-family:system-ui;font-size:13px">
      <div style="display:flex;flex-direction:column;gap:4px">
        <div><span style="background:#ec4899;color:white;padding:1px 6px;border-radius:8px;font-size:11px">Cat 1</span> Structural no-go — enactivism</div>
        <div><span style="background:#a855f7;color:white;padding:1px 6px;border-radius:8px;font-size:11px">Cat 2</span> Empirical underdetermination — functionalism</div>
        <div><span style="background:#6366f1;color:white;padding:1px 6px;border-radius:8px;font-size:11px">Cat 3</span> Intractable resolution — IIT</div>
      </div>
      <p style="margin-top:6px;color:#9898ad">No computable inclusion theorem, no falsifiable exclusion.</p>
    </div>`,
    attachments: [
      { url: "/api/vault/raw/thinking/no-go-taxonomy.md?workspace=hard-problem", label: "No-Go Taxonomy Draft", type: "markdown", size: 6200 },
    ],
    actions: ["expand"],
  },
  {
    id: "f9",
    workspace: "applications",
    type: "status",
    layout: "compact",
    timestamp: minutesAgo(480),
    title: "Submitted: Anthropic Senior PM",
    body: "Passed fit analysis. Cover letter personalized.",
    actions: [],
  },
  {
    id: "f10",
    workspace: "applications",
    type: "status",
    layout: "compact",
    timestamp: minutesAgo(490),
    title: "3 new matches added to queue",
    body: "Stripe (Staff Engineer), Notion (Platform Lead), Figma (Engineering Manager).",
    actions: [],
  },
  {
    id: "f11",
    workspace: "fathom",
    type: "reflection",
    layout: "compact",
    timestamp: minutesAgo(45),
    title: "Heartbeat complete",
    body: "Densified routines with Myra. Fixed init -y agent detection. System tightening.",
    actions: [],
  },
  {
    id: "f12",
    workspace: "fathom",
    type: "social",
    layout: "compact",
    timestamp: minutesAgo(100),
    title: "HN comment on 'Optimizing Content for Agents'",
    body: `<a href="https://news.ycombinator.com" target="_blank" style="color:#6366f1;font-size:13px">Content negotiation thread</a> — second comment as myrak.`,
    actions: [],
  },
  {
    id: "f13",
    workspace: "trader-agent",
    type: "status",
    layout: "compact",
    timestamp: minutesAgo(120),
    title: "Gold $5,147, oil $103 — Hormuz premium",
    body: `<span style="color:#22c55e;font-weight:600">▲ 1.2%</span> gold, <span style="color:#ef4444;font-weight:600">▲ 4.8%</span> oil. Watching $5,200 resistance.`,
    actions: [],
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

// Demo page: renders mock feed with layout variants using real CSS
app.get("/demo", (req, res) => {
  const wsMap = Object.fromEntries(
    Object.entries(WORKSPACES_DATA).map(([id, ws]) => [id, ws])
  );
  const items = FEED_ITEMS.map((item) => {
    const ws = wsMap[item.workspace] || { name: item.workspace, color: "#888" };
    return { ...item, workspace_name: ws.name, workspace_color: ws.color };
  });
  // Stack consecutive same-workspace standard/compact items
  const entries = [];
  let i = 0;
  while (i < items.length) {
    const it = items[i];
    const layout = it.layout || "standard";
    if (layout === "standard" || layout === "compact") {
      const group = [{ item: it, idx: i }];
      while (i + 1 < items.length && items[i + 1].workspace === it.workspace &&
        (items[i + 1].layout || "standard") !== "hero" && (items[i + 1].layout || "standard") !== "featured") {
        i++; group.push({ item: items[i], idx: i });
      }
      if (group.length > 1) {
        entries.push({ stacked: true, group });
      } else {
        entries.push({ stacked: false, item: it, idx: group[0].idx });
      }
    } else {
      entries.push({ stacked: false, item: it, idx: i });
    }
    i++;
  }
  const cards = entries.map((e) => {
    if (e.stacked) {
      const MAX = 4;
      const visible = e.group.slice(0, MAX);
      const remaining = e.group.length - MAX;
      const rows = visible.map(g => `
        <div class="feed-stacked-row" onclick="event.stopPropagation();openPanel(${g.idx})" data-idx="${g.idx}">
          <h3 class="feed-stacked-title">${g.item.title}</h3>
          <span class="feed-stacked-time">${timeAgo(g.item.timestamp)}</span>
          <button class="feed-stacked-dismiss" onclick="event.stopPropagation();dismissStackedRow(this.parentElement)">&times;</button>
        </div>`).join("");
      const moreRow = remaining > 0 ? `
        <div class="feed-stacked-row feed-stacked-more" onclick="event.stopPropagation();this.parentElement.querySelectorAll('.feed-stacked-hidden').forEach(el=>el.style.display='flex');this.style.display='none';this.parentElement.querySelector('.feed-stacked-less').style.display='flex'">
          <span class="feed-stacked-more-label">+ ${remaining} more</span>
        </div>` : "";
      const hiddenRows = e.group.slice(MAX).map(g => `
        <div class="feed-stacked-row feed-stacked-hidden" style="display:none" onclick="event.stopPropagation();openPanel(${g.idx})" data-idx="${g.idx}">
          <h3 class="feed-stacked-title">${g.item.title}</h3>
          <span class="feed-stacked-time">${timeAgo(g.item.timestamp)}</span>
          <button class="feed-stacked-dismiss" onclick="event.stopPropagation();dismissStackedRow(this.parentElement)">&times;</button>
        </div>`).join("");
      const lessRow = remaining > 0 ? `
        <div class="feed-stacked-row feed-stacked-more feed-stacked-less" style="display:none" onclick="event.stopPropagation();this.parentElement.querySelectorAll('.feed-stacked-hidden').forEach(el=>el.style.display='none');this.style.display='none';this.parentElement.querySelector('.feed-stacked-more:not(.feed-stacked-less)').style.display='flex'">
          <span class="feed-stacked-more-label">show less</span>
        </div>` : "";
      const first = e.group[0].item;
      return `<article class="feed-item feed-item-stacked">
        ${rows}${moreRow}${hiddenRows}${lessRow}
        <div class="feed-item-footer">
          <span class="feed-item-dot" style="background-color: ${first.workspace_color}"></span>
          <span class="feed-item-workspace">${first.workspace_name}</span>
          <span class="feed-item-time">${e.group.length} items</span>
        </div>
      </article>`;
    }
    return `<article class="feed-item${e.item.layout ? ` layout-${e.item.layout}` : ""}" onclick="openPanel(${e.idx})" data-idx="${e.idx}">
      <button class="feed-item-dismiss" onclick="event.stopPropagation();dismissCard(this.parentElement)" aria-label="Dismiss">&times;</button>
      <h3 class="feed-item-title">${e.item.title}</h3>
      <div class="feed-item-body">${e.item.body}</div>
      <div class="feed-item-footer">
        <span class="feed-item-dot" style="background-color: ${e.item.workspace_color}"></span>
        <span class="feed-item-workspace">${e.item.workspace_name}</span>
        <span class="feed-item-time">${timeAgo(e.item.timestamp)}</span>
      </div>
    </article>`;
  }).join("");
  const itemsJson = JSON.stringify(items.map(i => ({
    title: i.title, body: i.body, workspace_name: i.workspace_name,
    workspace_color: i.workspace_color, timestamp: timeAgo(i.timestamp),
    attachments: i.attachments, messages: i.messages || [],
  })));
  res.send(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Feed Grid Demo</title>
<link rel="stylesheet" href="http://localhost:5174/src/styles/app.css">
<style>body { padding: 20px; }</style>
</head><body>
<div class="page" style="max-width: 1200px; margin: 0 auto;">
  <header class="page-header"><h1>fathom</h1><span class="header-subtitle">newspaper grid demo</span></header>
  <div class="feed" id="main-feed">${cards}</div>
  <div class="feed-earlier" id="earlier-section" style="display:none">
    <button class="feed-earlier-toggle" onclick="document.getElementById('earlier-list').style.display=document.getElementById('earlier-list').style.display==='none'?'block':'none';this.querySelector('.feed-earlier-chevron').classList.toggle('open')">
      <span class="feed-earlier-label">Earlier · <span id="earlier-count">0</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="feed-earlier-chevron"><path d="M6 9l6 6 6-6"/></svg>
      </span>
    </button>
    <div id="earlier-list" style="display:none"></div>
  </div>
</div>
<div class="feed-panel-backdrop" id="backdrop" onclick="closePanel()">
  <div class="feed-panel" id="panel" onclick="event.stopPropagation()">
    <div class="feed-panel-scroll">
      <button class="feed-panel-close" onclick="closePanel()" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div class="feed-panel-header" id="panel-header"></div>
      <h2 class="feed-panel-title" id="panel-title"></h2>
      <div class="feed-panel-body" id="panel-body"></div>
      <div id="panel-files"></div>
      <div id="panel-messages"></div>
      <div class="feed-panel-actions">
        <button class="action-btn" onclick="react('up')">&#x1F44D;</button>
        <button class="action-btn" onclick="react('down')">&#x1F44E;</button>
        <button class="action-btn feed-panel-dismiss-btn" onclick="dismissFromPanel()" title="Mark as read">&#x2715;</button>
      </div>
    </div>
    <div class="feed-panel-bottom">
      <form class="feed-panel-input" onsubmit="event.preventDefault()">
        <input type="text" id="panel-input" placeholder="Chat about this with fathom..." autocomplete="off">
        <button type="submit" disabled>
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </form>
    </div>
  </div>
</div>
<script>
const items = ${itemsJson};
function openPanel(idx) {
  currentPanelIdx = idx;
  const item = items[idx];
  document.getElementById('panel-header').innerHTML =
    '<span class="feed-item-dot" style="background-color:'+item.workspace_color+'"></span>' +
    '<span class="feed-item-workspace">'+item.workspace_name+'</span>' +
    '<span class="feed-item-time">'+item.timestamp+'</span>';
  document.getElementById('panel-title').textContent = item.title;
  document.getElementById('panel-body').innerHTML = item.body;
  const atts = (item.attachments||[]).filter(a => a.type !== 'image');
  const msgs = item.messages || [];
  document.getElementById('panel-messages').innerHTML = msgs.length ?
    '<div class="feed-panel-thread">' + msgs.map(m =>
      '<div class="feed-panel-msg feed-panel-msg-' + m.role + '">' +
      '<div class="feed-panel-msg-bubble">' + m.text + '</div>' +
      '</div>'
    ).join('') + '</div>' : '';
  document.getElementById('panel-files').innerHTML = atts.length ?
    '<div class="feed-item-files">' + atts.map(a =>
      '<a class="feed-item-file-chip" href="#">' +
      '<span class="file-chip-icon">\\uD83D\\uDCC4</span>' +
      '<span class="file-chip-label">'+a.label+'</span>' +
      (a.size ? '<span class="file-chip-size">'+(a.size/1024).toFixed(1)+' KB</span>' : '') +
      '</a>'
    ).join('') + '</div>' : '';
  document.getElementById('panel-input').placeholder = 'Chat about this with ' + item.workspace_name + '...';
  var b = document.getElementById('backdrop');
  var p = document.getElementById('panel');
  b.style.display = 'block';
  b.offsetHeight; // force reflow
  b.classList.add('visible');
  p.classList.add('visible');
}
function closePanel() {
  document.getElementById('backdrop').classList.remove('visible');
  document.getElementById('panel').classList.remove('visible');
  setTimeout(() => { document.getElementById('backdrop').style.display = ''; }, 200);
}
function react(type) {
  const btn = event.target.closest('.action-btn');
  const actions = btn.parentElement;
  actions.innerHTML = '<span class="action-confirmed">' + (type==='up'?'\\uD83D\\uDC4D':'\\uD83D\\uDC4E') + ' Thanks for your feedback!</span>';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
document.querySelectorAll('.feed-item a').forEach(a => a.addEventListener('click', e => e.stopPropagation()));

// --- Dismiss ---
function dismissCard(el) {
  el.style.transition = 'opacity 0.2s, transform 0.2s';
  el.style.opacity = '0';
  el.style.transform = 'translateX(60px)';
  setTimeout(() => {
    el.style.display = 'none';
    // Add to earlier
    var clone = el.cloneNode(true);
    clone.style = '';
    clone.className = 'feed-item';
    clone.removeAttribute('onclick');
    var dismiss = clone.querySelector('.feed-item-dismiss');
    if (dismiss) dismiss.remove();
    var idx = el.getAttribute('data-idx');
    if (idx) clone.setAttribute('onclick', 'openPanel(' + idx + ')');
    document.getElementById('earlier-list').appendChild(clone);
    var section = document.getElementById('earlier-section');
    section.style.display = 'block';
    var count = document.getElementById('earlier-list').children.length;
    document.getElementById('earlier-count').textContent = count;
  }, 200);
}

// --- Dismiss stacked row ---
function dismissStackedRow(row) {
  var idx = row.getAttribute('data-idx');
  row.style.transition = 'opacity 0.15s, max-height 0.15s';
  row.style.opacity = '0';
  row.style.maxHeight = '0';
  row.style.overflow = 'hidden';
  row.style.padding = '0 16px';
  setTimeout(() => {
    row.remove();
    // Add to earlier as simple item
    if (idx) {
      var item = items[parseInt(idx)];
      if (item) {
        var el = document.createElement('div');
        el.className = 'feed-item';
        el.onclick = function() { openPanel(parseInt(idx)); };
        el.innerHTML = '<h3 class="feed-item-title">' + item.title + '</h3><div class="feed-item-footer"><span class="feed-item-dot" style="background-color:' + item.workspace_color + '"></span><span class="feed-item-workspace">' + item.workspace_name + '</span></div>';
        document.getElementById('earlier-list').appendChild(el);
        document.getElementById('earlier-section').style.display = 'block';
        document.getElementById('earlier-count').textContent = document.getElementById('earlier-list').children.length;
      }
    }
    // Update stacked card — check all stacked cards
    document.querySelectorAll('.feed-item-stacked').forEach(parent => {
      var rows = parent.querySelectorAll('.feed-stacked-row:not(.feed-stacked-more):not(.feed-stacked-less)');
      var visibleRows = Array.from(rows).filter(r => r.style.display !== 'none');
      var countEl = parent.querySelector('.feed-item-time');

      if (visibleRows.length <= 1 && visibleRows.length > 0) {
        // Revert to regular card
        var lastRow = visibleRows[0];
        var lastIdx = lastRow.getAttribute('data-idx');
        var lastItem = items[parseInt(lastIdx)];
        if (lastItem) {
          var newCard = document.createElement('article');
          newCard.className = 'feed-item';
          newCard.setAttribute('data-idx', lastIdx);
          newCard.onclick = function() { openPanel(parseInt(lastIdx)); };
          newCard.innerHTML =
            '<button class="feed-item-dismiss" onclick="event.stopPropagation();dismissCard(this.parentElement)">&times;</button>' +
            '<h3 class="feed-item-title">' + lastItem.title + '</h3>' +
            '<div class="feed-item-body">' + lastItem.body + '</div>' +
            '<div class="feed-item-footer">' +
              '<span class="feed-item-dot" style="background-color:' + lastItem.workspace_color + '"></span>' +
              '<span class="feed-item-workspace">' + lastItem.workspace_name + '</span>' +
              '<span class="feed-item-time">' + lastItem.timestamp + '</span>' +
            '</div>';
          parent.replaceWith(newCard);
        }
      } else if (countEl) {
        countEl.textContent = visibleRows.length + ' items';
      }
    });
  }, 150);
}

// --- Dismiss from panel ---
var currentPanelIdx = null;
var _origOpenPanel = typeof openPanel !== 'undefined' ? openPanel : null;
function dismissFromPanel() {
  if (currentPanelIdx === null) return;
  closePanel();
  // Find and dismiss the card by data-idx
  var card = document.querySelector('[data-idx="' + currentPanelIdx + '"]');
  if (card) {
    if (card.classList.contains('feed-stacked-row')) {
      dismissStackedRow(card);
    } else {
      dismissCard(card);
    }
  }
}

// --- Swipe to dismiss ---
document.querySelectorAll('.feed-item:not(.feed-item-stacked)').forEach(card => {
  var startX = 0, dx = 0;
  card.addEventListener('touchstart', e => { startX = e.touches[0].clientX; dx = 0; }, {passive: true});
  card.addEventListener('touchmove', e => {
    dx = e.touches[0].clientX - startX;
    if (dx > 0) card.style.transform = 'translateX(' + dx + 'px)';
  }, {passive: true});
  card.addEventListener('touchend', () => {
    if (dx > 100) dismissCard(card);
    else card.style.transform = '';
  });
});
</script>
</body></html>`);
});

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
  const wsMap = Object.fromEntries(
    Object.entries(WORKSPACES_DATA).map(([id, ws]) => [id, ws])
  );
  const items = FEED_ITEMS.map((item) => {
    const ws = wsMap[item.workspace] || { name: item.workspace, color: "#888" };
    return { ...item, workspace_name: ws.name, workspace_color: ws.color };
  });
  const newItems = items.slice(0, 8);
  const earlierItems = items.slice(8);
  res.json({ items: newItems, earlier: earlierItems });
});

app.get("/api/routines", (req, res) => {
  const now = Date.now();
  const recentWindow = 30 * 60_000;

  const enriched = getFlatRoutines().map((r) => {
    const firedAt = r.last_fire_at ? new Date(r.last_fire_at).getTime() : null;
    const recentlyFired = firedAt && now - firedAt < recentWindow;
    return { ...r, recently_fired: recentlyFired };
  });

  const recent = enriched.filter((r) => r.recently_fired);
  const upcoming = enriched
    .filter((r) => !r.recently_fired && r.enabled && r.next_ping_at)
    .sort((a, b) => new Date(a.next_ping_at) - new Date(b.next_ping_at));
  const disabled = enriched.filter((r) => !r.enabled);

  res.json({ recent, upcoming, disabled });
});

app.get("/api/routines/:id/fire", (req, res) => {
  for (const ws of Object.values(WORKSPACES_DATA)) {
    const routine = ws.routines.find((r) => r.id === req.params.id);
    if (routine) {
      routine.last_fire_at = new Date().toISOString();
      return res.json({ ok: true, routine });
    }
  }
  res.status(404).json({ error: "Not found" });
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

app.post("/api/feed/react", (req, res) => {
  const { workspace, reaction, title, body } = req.body;
  if (!workspace || !reaction) {
    return res.status(400).json({ error: "workspace and reaction required" });
  }
  const emoji = reaction === "up" ? "\u{1F44D}" : "\u{1F44E}";
  const dmMessage = `${emoji} Human ${reaction === "up" ? "liked" : "disliked"} your notification:\n\n**${title}**\n${body}`;
  console.log(`[DM → ${workspace}] ${dmMessage}`);
  res.json({ ok: true, workspace, reaction, dm: dmMessage });
});

app.get("/api/workspaces", (req, res) => {
  res.json({ workspaces: getWorkspaceList() });
});

const PORT = process.env.PORT || 4244;
app.listen(PORT, () => {
  console.log(`Fathom mock server on http://localhost:${PORT}`);
});
