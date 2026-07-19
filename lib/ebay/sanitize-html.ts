import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "div",
  "span",
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "img",
];

const ALLOWED_ATTR = ["style", "src", "alt", "width", "height", "colspan", "rowspan"];

export function sanitizeEbayHtml(html: string): string {
  try {
    const cleaned = DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: [
        "script",
        "iframe",
        "form",
        "input",
        "button",
        "video",
        "audio",
        "object",
        "embed",
        "link",
        "style",
      ],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
    });
    // Keep Description as a single CSV cell (Seller Hub / Excel friendly).
    return cleaned.replace(/\s+/g, " ").trim();
  } catch {
    // DOMPurify/jsdom can fail in some serverless runtimes — never crash export.
    return String(html || "")
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }
}
