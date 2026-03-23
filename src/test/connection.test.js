import { describe, it, expect, beforeEach } from "vitest";

// Mock localStorage before importing the module
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

const { getConnection, saveConnection, clearConnection, isConnected, getHumanUser } =
  await import("../lib/connection.js");

beforeEach(() => localStorageMock.clear());

describe("isConnected", () => {
  it("returns false when no connection saved", () => {
    expect(isConnected()).toBe(false);
  });

  it("returns true when a valid connection exists", () => {
    saveConnection({ serverUrl: "http://localhost:4243", apiKey: "test-key" });
    expect(isConnected()).toBe(true);
  });
});

describe("getConnection / saveConnection", () => {
  it("returns null when no connection saved", () => {
    expect(getConnection()).toBeNull();
  });

  it("stores connection and round-trips it (with defaults filled in)", () => {
    saveConnection({ serverUrl: "http://localhost:4243/", apiKey: "abc", humanUser: "myra" });
    const conn = getConnection();
    expect(conn.serverUrl).toBe("http://localhost:4243"); // trailing slash stripped
    expect(conn.apiKey).toBe("abc");
    expect(conn.humanUser).toBe("myra");
    expect(conn.primaryWorkspace).toBe("fathom");   // default
    expect(conn.humanDisplayName).toBe("User");       // default
  });

  it("strips trailing slashes from serverUrl", () => {
    saveConnection({ serverUrl: "http://localhost:4243///", apiKey: "k" });
    expect(getConnection().serverUrl).toBe("http://localhost:4243");
  });
});

describe("clearConnection", () => {
  it("removes the stored connection", () => {
    saveConnection({ serverUrl: "http://localhost:4243", apiKey: "abc" });
    clearConnection();
    expect(getConnection()).toBeNull();
    expect(isConnected()).toBe(false);
  });
});

describe("getHumanUser", () => {
  it("returns default 'user' when not connected", () => {
    // getHumanUser falls back to "user" when no connection
    expect(getHumanUser()).toBe("user");
  });

  it("returns humanUser from saved connection", () => {
    saveConnection({ serverUrl: "http://localhost:4243", apiKey: "k", humanUser: "myra" });
    expect(getHumanUser()).toBe("myra");
  });

  it("returns default 'user' when humanUser not set", () => {
    saveConnection({ serverUrl: "http://localhost:4243", apiKey: "k" });
    expect(getHumanUser()).toBe("user");
  });
});
