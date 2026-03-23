import { describe, it, expect } from "vitest";
import { feedSanitizeSchema } from "../lib/sanitize.js";

describe("feedSanitizeSchema", () => {
  it("allows expected layout tags", () => {
    const required = ["div", "span", "img", "a", "p", "table", "ul", "ol", "li", "audio"];
    for (const tag of required) {
      expect(feedSanitizeSchema.tagNames).toContain(tag);
    }
  });

  it("allows style attribute on all elements", () => {
    expect(feedSanitizeSchema.attributes["*"]).toContain("style");
  });

  it("uses class (not className) for the hast attribute", () => {
    expect(feedSanitizeSchema.attributes["*"]).toContain("class");
    expect(feedSanitizeSchema.attributes["*"]).not.toContain("className");
  });

  it("allows safe href protocols only", () => {
    const hrefProtocols = feedSanitizeSchema.protocols.href;
    expect(hrefProtocols).toContain("http");
    expect(hrefProtocols).toContain("https");
    expect(hrefProtocols).toContain("mailto");
    expect(hrefProtocols).not.toContain("javascript");
  });

  it("allows img src with http/https/data protocols", () => {
    const srcProtocols = feedSanitizeSchema.protocols.src;
    expect(srcProtocols).toContain("http");
    expect(srcProtocols).toContain("https");
    expect(srcProtocols).toContain("data");
  });

  it("configures audio tag with expected attributes", () => {
    expect(feedSanitizeSchema.attributes.audio).toContain("controls");
    expect(feedSanitizeSchema.attributes.audio).toContain("src");
  });
});
