import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { timeAgo, timeUntil, formatTimestamp, prettyName, stripChatDecorations } from "../lib/formatters.js";

// Pin Date.now() so time-relative assertions are stable
const NOW = new Date("2026-03-23T12:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("timeAgo", () => {
  it("returns empty string for null/undefined", () => {
    expect(timeAgo(null)).toBe("");
    expect(timeAgo(undefined)).toBe("");
    expect(timeAgo("")).toBe("");
  });

  it('returns "just now" for timestamps < 1 minute ago', () => {
    expect(timeAgo(NOW - 30_000)).toBe("just now");
    expect(timeAgo(NOW)).toBe("just now");
  });

  it("returns minutes ago for timestamps 1–59 min ago", () => {
    expect(timeAgo(NOW - 5 * 60_000)).toBe("5m ago");
    expect(timeAgo(NOW - 59 * 60_000)).toBe("59m ago");
  });

  it("returns hours ago for timestamps 1–23 hours ago", () => {
    expect(timeAgo(NOW - 2 * 3600_000)).toBe("2h ago");
    expect(timeAgo(NOW - 23 * 3600_000)).toBe("23h ago");
  });

  it("returns days ago for timestamps 1+ days ago", () => {
    expect(timeAgo(NOW - 1 * 86400_000)).toBe("1d ago");
    expect(timeAgo(NOW - 7 * 86400_000)).toBe("7d ago");
  });

  it("handles ISO string timestamps", () => {
    const isoTs = new Date(NOW - 10 * 60_000).toISOString();
    expect(timeAgo(isoTs)).toBe("10m ago");
  });

  it("handles Unix epoch seconds (numbers < 1e12)", () => {
    const unixSeconds = Math.floor((NOW - 3 * 3600_000) / 1000);
    expect(timeAgo(unixSeconds)).toBe("3h ago");
  });

  it("handles future timestamps gracefully", () => {
    expect(timeAgo(NOW + 60_000)).toBe("just now");
  });

  describe("short format", () => {
    it('returns "now" for recent timestamps', () => {
      expect(timeAgo(NOW - 30_000, { short: true })).toBe("now");
    });

    it("omits 'ago' suffix", () => {
      expect(timeAgo(NOW - 5 * 60_000, { short: true })).toBe("5m");
      expect(timeAgo(NOW - 2 * 3600_000, { short: true })).toBe("2h");
      expect(timeAgo(NOW - 3 * 86400_000, { short: true })).toBe("3d");
    });
  });
});

describe("timeUntil", () => {
  it("returns empty string for null/undefined", () => {
    expect(timeUntil(null)).toBe("");
    expect(timeUntil(undefined)).toBe("");
  });

  it('returns "overdue" for past timestamps', () => {
    expect(timeUntil(NOW - 60_000)).toBe("overdue");
  });

  it("returns minutes for < 1 hour", () => {
    expect(timeUntil(NOW + 30 * 60_000)).toBe("in 30m");
  });

  it("returns hours for >= 1 hour", () => {
    expect(timeUntil(NOW + 3 * 3600_000)).toBe("in 3h");
  });
});

describe("formatTimestamp", () => {
  it("returns em dash for null/undefined", () => {
    expect(formatTimestamp(null)).toBe("—");
    expect(formatTimestamp(undefined)).toBe("—");
  });

  it("returns a non-empty locale string for valid timestamps", () => {
    const result = formatTimestamp(NOW);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });
});

describe("prettyName", () => {
  it("converts slugs to title case", () => {
    expect(prettyName("my-workspace")).toBe("My Workspace");
    expect(prettyName("navier-stokes")).toBe("Navier Stokes");
    expect(prettyName("fathom")).toBe("Fathom");
  });

  it("handles single-word slugs", () => {
    expect(prettyName("fathom")).toBe("Fathom");
  });
});

describe("stripChatDecorations", () => {
  it("strips @workspace prefix", () => {
    expect(stripChatDecorations("@fathom hello there")).toBe("hello there");
  });

  it("strips trailing context block", () => {
    const text = "What is this?\n\n(Context: reply to notification abc123)";
    expect(stripChatDecorations(text)).toBe("What is this?");
  });

  it("strips both prefix and context block", () => {
    const text = "@fathom What is this?\n\n(Context: reply to notification abc123)";
    expect(stripChatDecorations(text)).toBe("What is this?");
  });

  it("leaves plain messages unchanged", () => {
    expect(stripChatDecorations("just a message")).toBe("just a message");
  });
});
