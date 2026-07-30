/**
 * Static grader for a hand-written page.
 *
 * You are not asked to implement this file — it is the checker. Your work is
 * `artifact/index.html` (plus `artifact/style.css` and `artifact/main.js` if you
 * split them out). Run `bun test` until every check passes.
 *
 * Everything here is checked by reading the source, not by rendering: no browser,
 * no network. That limits what can be proven — it cannot tell you the page looks
 * good — but it does catch the mistakes that make a first portfolio unusable for
 * some visitors, which is the part beginners cannot see for themselves.
 */
export type Finding = { id: string; severity: "error" | "warn"; message: string };

export type Artifact = { html: string; css: string; js: string };

const tag = (html: string, name: string): RegExpMatchArray[] =>
  [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))];

const hasTag = (html: string, name: string): boolean => tag(html, name).length > 0;

const attrOf = (openTag: string, attr: string): string | undefined =>
  new RegExp(`\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(openTag)?.slice(2).find((v) => v !== undefined);

/** Text with tags and script/style bodies stripped — what a reader actually sees. */
export function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkPage({ html, css, js }: Artifact): Finding[] {
  const findings: Finding[] = [];
  const err = (id: string, message: string) => findings.push({ id, severity: "error", message });
  const warn = (id: string, message: string) => findings.push({ id, severity: "warn", message });
  const all = `${html}\n${css}\n${js}`;

  // ── document basics ──
  if (!/<!doctype html>/i.test(html)) err("doctype", "Missing <!doctype html> — browsers fall back to quirks mode");
  const htmlTag = tag(html, "html")[0]?.[0] ?? "";
  if (!attrOf(htmlTag, "lang")) err("lang", "<html> has no lang attribute — screen readers guess the pronunciation");
  if (!/<title>\s*\S/i.test(html)) err("title", "<title> is empty — the browser tab and search results have nothing to show");
  if (!/<meta[^>]+name=["']?viewport/i.test(html)) {
    err("viewport", "No viewport meta — a phone renders the desktop layout scaled down to unreadable");
  }
  if (!/<meta[^>]+name=["']?description/i.test(html)) {
    warn("description", "No meta description — search results will quote arbitrary page text");
  }

  // ── structure a reader can navigate ──
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  if (h1s.length === 0) err("h1", "No <h1> — the page has no title in its outline");
  if (h1s.length > 1) err("h1-many", `${h1s.length} <h1> elements — one page, one top-level heading`);
  if (h1s.length === 1 && visibleText(h1s[0][1]).length === 0) err("h1-empty", "<h1> is empty");

  for (const [name, why] of [
    ["header", "the page has no banner region"],
    ["main", "assistive tech has no 'skip to the content' target"],
    ["footer", "the page has no contentinfo region"],
  ] as const) {
    if (!hasTag(html, name)) err(`landmark-${name}`, `No <${name}> — ${why}`);
  }
  if (!hasTag(html, "nav")) warn("landmark-nav", "No <nav> — in-page links are harder to find by region");
  if (tag(html, "section").length < 3) {
    err("sections", "Fewer than 3 <section> elements — hero, about, projects and contact should be real sections, not a wall of divs");
  }

  // Heading order: skipping a level breaks outline navigation.
  const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) {
      err("heading-skip", `Heading jumps from h${levels[i - 1]} to h${levels[i]} — do not skip levels`);
      break;
    }
  }

  // ── images and links ──
  for (const [openTag] of tag(html, "img")) {
    if (attrOf(openTag, "alt") === undefined) {
      err("img-alt", "An <img> has no alt attribute (use alt=\"\" if it is purely decorative)");
      break;
    }
  }
  for (const [openTag] of tag(html, "a")) {
    if (attrOf(openTag, "target") === "_blank" && !/noopener/i.test(attrOf(openTag, "rel") ?? "")) {
      err("target-blank", 'A target="_blank" link has no rel="noopener" — the opened page can reach back into yours');
      break;
    }
  }
  const emptyLink = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].find(
    ([full, inner]) => visibleText(inner).length === 0 && !/aria-label|title=/i.test(full) && !/<img/i.test(inner),
  );
  if (emptyLink) err("link-name", "A link has no text and no aria-label — it is announced as just 'link'");

  // ── responsive + interaction ──
  if (!/@media[^{]*\(\s*(max|min)-width/i.test(css)) {
    err("media-query", "No width media query — the layout cannot adapt to a phone");
  }
  if (/\bwidth\s*:\s*\d{3,}px/i.test(css) && !/max-width/i.test(css)) {
    warn("fixed-width", "A fixed pixel width with no max-width will overflow a narrow screen");
  }
  if (!/:focus(-visible)?\b/i.test(css)) {
    err("focus-style", "No :focus / :focus-visible rule — keyboard users cannot see where they are");
  }
  if (/outline\s*:\s*(none|0)/i.test(css) && !/:focus(-visible)?[^{]*\{[^}]*(outline|box-shadow|border)/i.test(css)) {
    err("outline-none", "outline:none with no visible replacement removes the keyboard focus ring entirely");
  }
  if (!/prefers-reduced-motion/i.test(css) && /(transition|animation)\s*:/i.test(css)) {
    warn("reduced-motion", "The page animates but never honours prefers-reduced-motion");
  }

  // ── the one piece of interactivity ──
  if (!/addEventListener\s*\(/.test(js)) {
    err("interactivity", "No addEventListener in your JavaScript — the milestone asks for one real interaction");
  }
  if (/\bonclick\s*=/i.test(html)) {
    warn("inline-handler", "Inline onclick= works but keeps behaviour in markup; move it to a listener");
  }
  if (/document\.write\s*\(/.test(all)) err("document-write", "document.write() blocks parsing and breaks on any real page");
  if (/\binnerHTML\s*=\s*[^;]*\b(value|input|location|search|hash)\b/i.test(js)) {
    err("innerhtml-input", "innerHTML fed from user or URL input is an XSS hole — use textContent");
  }

  return findings;
}

export const errorsOf = (findings: Finding[]): Finding[] => findings.filter((f) => f.severity === "error");
