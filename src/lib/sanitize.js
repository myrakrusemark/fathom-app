import { defaultSchema } from "rehype-sanitize";

// Allow rich HTML from workspace notifications while stripping dangerous content.
// Based on GitHub's schema but extended for inline styles and layout elements.
export const feedSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "div",
    "span",
    "img",
    "a",
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "pre",
    "code",
    "hr",
    "audio",
    "source",
  ],
  attributes: {
    ...defaultSchema.attributes,
    // "style" is intentionally allowed on all elements: feed notifications from the server
    // use rich inline CSS for card layouts. Content comes from trusted server output, not
    // user input. "class" (not "className") is the correct hast attribute name.
    "*": ["style", "class"],
    a: ["href", "target", "rel"],
    img: ["src", "alt", "loading", "width", "height"],
    audio: ["controls", "preload", "src"],
    source: ["src", "type"],
    td: ["colSpan", "rowSpan"],
    th: ["colSpan", "rowSpan"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["http", "https", "data"],
  },
};
