// Interest → workspace/routine mapping for first-landing feed
// Each onboarding interest creates either a new workspace or a routine on fathom

const WORKSPACE_COLORS = {
  ledger: "#22c55e",
  compass: "#3b82f6",
  threads: "#ec4899",
  fathom: "#6366f1",
};

const INTEREST_MAP = [
  {
    id: "finance",
    createsWorkspace: true,
    workspaceId: "ledger",
    displayName: "Ledger",
    color: WORKSPACE_COLORS.ledger,
    welcomeMessage:
      "Pre-market briefs, position tracking, macro signals. I'll flag anything that moves.",
  },
  {
    id: "jobs",
    createsWorkspace: true,
    workspaceId: "compass",
    displayName: "Compass",
    color: WORKSPACE_COLORS.compass,
    welcomeMessage:
      "Job search tracker online. I'll scan boards, match roles to your profile, and queue submissions.",
  },
  {
    id: "shopping",
    createsWorkspace: true,
    workspaceId: "threads",
    displayName: "Threads",
    color: WORKSPACE_COLORS.threads,
    welcomeMessage:
      "I'll browse your favorite retailers on a schedule. Tell me what you're looking for.",
  },
  {
    id: "news",
    createsWorkspace: false,
    displayName: "News Check",
    color: WORKSPACE_COLORS.fathom,
    welcomeMessage:
      "News monitoring added. Tell me which stories to track and I'll build daily briefings.",
  },
  {
    id: "weather",
    createsWorkspace: false,
    displayName: "Weather Alerts",
    color: WORKSPACE_COLORS.fathom,
    welcomeMessage:
      "Weather alerts active. I'll flag anything unusual for your area.",
  },
  {
    id: "calendar",
    createsWorkspace: false,
    displayName: "Calendar Sync",
    color: WORKSPACE_COLORS.fathom,
    welcomeMessage: "Calendar reminders ready. I'll keep you on track.",
  },
  {
    id: "health",
    createsWorkspace: false,
    displayName: "Wellness Check",
    color: WORKSPACE_COLORS.fathom,
    welcomeMessage:
      "Wellness check-ins added. I'll help you stay consistent.",
  },
  {
    id: "cooking",
    createsWorkspace: false,
    displayName: "Recipe Finder",
    color: WORKSPACE_COLORS.fathom,
    welcomeMessage:
      "Recipe finder ready. Tell me what you like and I'll find things to try.",
  },
  {
    id: "travel",
    createsWorkspace: false,
    displayName: "Travel Planner",
    color: WORKSPACE_COLORS.fathom,
    welcomeMessage:
      "Travel planning ready. I'll track prices and build itineraries.",
  },
  {
    id: "learning",
    createsWorkspace: false,
    displayName: "Learning Digest",
    color: WORKSPACE_COLORS.fathom,
    welcomeMessage:
      "Learning digest active. I'll surface courses and papers in your areas.",
  },
  {
    id: "home",
    createsWorkspace: false,
    displayName: "Errands Tracker",
    color: WORKSPACE_COLORS.fathom,
    welcomeMessage:
      "Errands tracker ready. I'll help you stay on top of the house stuff.",
  },
  {
    id: "research",
    createsWorkspace: false,
    displayName: "Research Digest",
    color: WORKSPACE_COLORS.fathom,
    welcomeMessage:
      "Research digest active. Tell me your areas and I'll watch for new papers.",
  },
];

export { INTEREST_MAP, WORKSPACE_COLORS };
