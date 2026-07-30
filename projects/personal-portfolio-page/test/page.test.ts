import { test, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkPage, errorsOf, visibleText, type Artifact } from "../src/page";

const read = (name: string): string => {
  const p = join(import.meta.dir, "..", "artifact", name);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
};

/** CSS/JS count whether they are separate files or inlined in the HTML. */
function artifact(): Artifact {
  const html = read("index.html");
  const inlineCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const inlineJs = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join("\n");
  return {
    html,
    css: `${read("style.css")}\n${inlineCss}`,
    js: `${read("main.js")}\n${inlineJs}`,
  };
}

// ── Your work: the page in artifact/ ────────────────────────────────────────────
test("YOUR PAGE: artifact/index.html passes every acceptance check", () => {
  const findings = errorsOf(checkPage(artifact()));
  const report = findings.map((f) => `  • [${f.id}] ${f.message}`).join("\n");
  expect(findings, `\nPage not acceptable yet:\n${report}\n`).toEqual([]);
});

test("YOUR PAGE: has the four sections the brief asks for", () => {
  const text = visibleText(artifact().html).toLowerCase();
  for (const word of ["about", "project", "contact"]) {
    expect(text, `expected the page to mention "${word}"`).toContain(word);
  }
});

test("YOUR PAGE: works on a phone (viewport meta + a width media query)", () => {
  const { html, css } = artifact();
  expect(/<meta[^>]+name=["']?viewport/i.test(html)).toBe(true);
  expect(/@media[^{]*\(\s*(max|min)-width/i.test(css)).toBe(true);
});

test("YOUR PAGE: has one real interaction wired in JavaScript", () => {
  expect(/addEventListener\s*\(/.test(artifact().js)).toBe(true);
});

// ── The grader itself: guards against a checker that always says "fine" ─────────
const good = {
  html: `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Me</title></head>
<body><header><nav><a href="#about">About</a></nav><h1>My name</h1></header>
<main><section id="about"><h2>About</h2><p>Hi.</p></section>
<section id="projects"><h2>Projects</h2><ul><li><a href="#">One</a></li></ul></section>
<section id="contact"><h2>Contact</h2><p>mail@example.com</p></section></main>
<footer><p>© me</p></footer></body></html>`,
  css: `@media (max-width: 600px) { main { padding: 8px } } a:focus-visible { outline: 2px solid }`,
  js: `document.querySelector("button")?.addEventListener("click", () => {});`,
};

test("the grader accepts a minimal but correct page", () => {
  expect(errorsOf(checkPage(good))).toEqual([]);
});

test("the grader catches a missing viewport meta", () => {
  const html = good.html.replace(/<meta name="viewport"[^>]*>/, "");
  expect(errorsOf(checkPage({ ...good, html })).map((f) => f.id)).toContain("viewport");
});

test("the grader catches a missing lang attribute", () => {
  const html = good.html.replace('<html lang="en">', "<html>");
  expect(errorsOf(checkPage({ ...good, html })).map((f) => f.id)).toContain("lang");
});

test("the grader catches an image with no alt", () => {
  const html = good.html.replace("<p>Hi.</p>", '<img src="me.png">');
  expect(errorsOf(checkPage({ ...good, html })).map((f) => f.id)).toContain("img-alt");
  // alt="" is the correct way to mark a decorative image, and must pass.
  const decorative = good.html.replace("<p>Hi.</p>", '<img src="line.png" alt="">');
  expect(errorsOf(checkPage({ ...good, html: decorative })).map((f) => f.id)).not.toContain("img-alt");
});

test("the grader catches target=_blank without rel=noopener", () => {
  const html = good.html.replace('<a href="#about">About</a>', '<a href="https://x.example" target="_blank">X</a>');
  expect(errorsOf(checkPage({ ...good, html })).map((f) => f.id)).toContain("target-blank");
});

test("the grader catches a link with no accessible name", () => {
  const html = good.html.replace('<li><a href="#">One</a></li>', '<li><a href="#"></a></li>');
  expect(errorsOf(checkPage({ ...good, html })).map((f) => f.id)).toContain("link-name");
});

test("the grader catches a skipped heading level", () => {
  const html = good.html.replace("<h2>About</h2>", "<h4>About</h4>");
  expect(errorsOf(checkPage({ ...good, html })).map((f) => f.id)).toContain("heading-skip");
});

test("the grader catches a removed focus ring", () => {
  const css = "@media (max-width: 600px) { main { padding: 8px } } a { outline: none }";
  const ids = errorsOf(checkPage({ ...good, css })).map((f) => f.id);
  expect(ids).toContain("focus-style");
});

test("the grader catches innerHTML fed from input", () => {
  const js = `${good.js}\nel.innerHTML = location.hash;`;
  expect(errorsOf(checkPage({ ...good, js })).map((f) => f.id)).toContain("innerhtml-input");
});

test("the grader counts inlined CSS and JS, not just separate files", () => {
  // A single-file page is a legitimate answer to this brief.
  const single = {
    html: good.html.replace("</head>", `<style>${good.css}</style></head>`).replace("</body>", `<script>${good.js}</script></body>`),
    css: "",
    js: "",
  };
  const inlined = {
    html: single.html,
    css: [...single.html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n"),
    js: [...single.html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join("\n"),
  };
  expect(errorsOf(checkPage(inlined))).toEqual([]);
});
