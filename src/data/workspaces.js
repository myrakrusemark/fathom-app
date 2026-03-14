// Workspace and routine templates for onboarding
// Each interest maps to either a new workspace or a routine on fathom

export const WORKSPACE_TEMPLATES = {
  ledger: {
    displayName: "Ledger",
    color: "#22c55e",
    onboardingId: "finance",
    welcomeMessage:
      "Pre-market briefs, position tracking, macro signals. I'll flag anything that moves.",
    routines: [
      { name: "Pre-Market Brief", frequency: "weekdays", description: "Gold, oil, macro signals. Flag anything that moves." },
    ],
  },
  compass: {
    displayName: "Compass",
    color: "#3b82f6",
    onboardingId: "jobs",
    welcomeMessage:
      "Job search tracker online. I'll scan boards, match roles to your profile, and queue submissions.",
    routines: [
      { name: "Job Applications Nightly", frequency: "once a day", description: "Scan boards, match against profile, queue submissions." },
    ],
  },
  threads: {
    displayName: "Threads",
    color: "#ec4899",
    onboardingId: "shopping",
    welcomeMessage:
      "I'll browse your favorite retailers on a schedule. Tell me what you're looking for.",
    routines: [
      { name: "Shopping Run", frequency: "3x per week", description: "Browse tall retailers for tops with visual hooks." },
    ],
  },
};

export const FATHOM_ROUTINE_TEMPLATES = {
  news: {
    name: "News Check",
    color: "#6366f1",
    onboardingId: "news",
    welcomeMessage:
      "News monitoring added. Tell me which stories to track and I'll build daily briefings.",
  },
  weather: {
    name: "Weather Alerts",
    color: "#6366f1",
    onboardingId: "weather",
    welcomeMessage:
      "Weather alerts active. I'll flag anything unusual for your area.",
  },
  calendar: {
    name: "Calendar Sync",
    color: "#6366f1",
    onboardingId: "calendar",
    welcomeMessage: "Calendar reminders ready. I'll keep you on track.",
  },
  health: {
    name: "Wellness Check",
    color: "#6366f1",
    onboardingId: "health",
    welcomeMessage:
      "Wellness check-ins added. I'll help you stay consistent.",
  },
  cooking: {
    name: "Recipe Finder",
    color: "#6366f1",
    onboardingId: "cooking",
    welcomeMessage:
      "Recipe finder ready. Tell me what you like and I'll find things to try.",
  },
  travel: {
    name: "Travel Planner",
    color: "#6366f1",
    onboardingId: "travel",
    welcomeMessage:
      "Travel planning ready. I'll track prices and build itineraries.",
  },
  learning: {
    name: "Learning Digest",
    color: "#6366f1",
    onboardingId: "learning",
    welcomeMessage:
      "Learning digest active. I'll surface courses and papers in your areas.",
  },
  home: {
    name: "Errands Tracker",
    color: "#6366f1",
    onboardingId: "home",
    welcomeMessage:
      "Errands tracker ready. I'll help you stay on top of the house stuff.",
  },
  research: {
    name: "Research Digest",
    color: "#6366f1",
    onboardingId: "research",
    welcomeMessage:
      "Research digest active. Tell me your areas and I'll watch for new papers.",
  },
};

/**
 * Get interest entries for Feed.jsx staged animation.
 * Returns the same shape the old INTEREST_MAP.filter() provided.
 */
export function getInterestEntries(interestIds) {
  if (!interestIds || interestIds.size === 0) return [];

  const entries = [];

  // Workspace templates
  for (const [wsId, ws] of Object.entries(WORKSPACE_TEMPLATES)) {
    if (interestIds.has(ws.onboardingId)) {
      entries.push({
        id: ws.onboardingId,
        createsWorkspace: true,
        workspaceId: wsId,
        displayName: ws.displayName,
        color: ws.color,
        welcomeMessage: ws.welcomeMessage,
      });
    }
  }

  // Fathom routine templates
  for (const [, rt] of Object.entries(FATHOM_ROUTINE_TEMPLATES)) {
    if (interestIds.has(rt.onboardingId)) {
      entries.push({
        id: rt.onboardingId,
        createsWorkspace: false,
        displayName: rt.name,
        color: rt.color,
        welcomeMessage: rt.welcomeMessage,
      });
    }
  }

  return entries;
}
