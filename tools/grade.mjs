#!/usr/bin/env bun
// grade — run a project's acceptance suite plus static checks for its stack.
//
//   bun tools/grade.mjs lru-cache [more-slugs…]   grade named projects
//   bun tools/grade.mjs --all                     grade every project
//   bun tools/grade.mjs --changed <baseRef>       grade projects touched since baseRef
//
// Exit 0 only when every graded project passes. The test suite is the gate; the static
// checks are advisory-but-blocking on things a reviewer would reject outright (a file
// that does not compile, unformatted Go, a leftover TODO(you) marker).
import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const PROJECTS = join(ROOT, "projects");
const TIMEOUT_MS = 120_000;

const STACKS = {
  "bun-ts": {
    test: ["bun", ["test"]],
    probe: ["bun", ["--version"]],
    install: "https://bun.sh",
    checks: [typecheckTs],
  },
  python: {
    test: ["python3", ["-m", "unittest", "discover", "-s", ".", "-p", "test_*.py"]],
    probe: ["python3", ["--version"]],
    install: "https://www.python.org/downloads/",
    env: { PYTHONDONTWRITEBYTECODE: "1" },
    checks: [lintPython],
  },
  go: {
    test: ["go", ["test", "./..."]],
    probe: ["go", ["version"]],
    install: "https://go.dev/dl/",
    checks: [lintGo],
  },
};

function run(cmd, args, cwd, extraEnv = {}) {
  const r = spawnSync(cmd, args, {
    cwd, timeout: TIMEOUT_MS, encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
  return { code: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

const has = (cmd, args) => run(cmd, args, ROOT).code === 0;

function walk(dir, pred, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "__pycache__" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, pred, acc);
    else if (pred(e.name)) acc.push(p);
  }
  return acc;
}

// --- static checks -----------------------------------------------------------
// Each returns { name, ok, out }.

// tsc with every flag on the command line: passing files explicitly makes tsc ignore
// any stray tsconfig, so a learner's editor config cannot loosen the grading bar.
function typecheckTs(dir) {
  const files = walk(dir, (f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
  if (!files.length) return { name: "tsc", ok: true, out: "no .ts files" };
  if (!has("bunx", ["tsc", "--version"])) return { name: "tsc", ok: true, out: "SKIPPED — tsc unavailable" };
  const r = run("bunx", [
    "tsc", "--noEmit", "--strict", "--skipLibCheck",
    "--target", "esnext", "--module", "esnext", "--moduleResolution", "bundler",
    "--types", "bun",
    ...files.map((f) => relative(ROOT, f)),
  ], ROOT);
  return { name: "tsc --strict", ok: r.code === 0, out: r.out };
}

function lintPython(dir) {
  if (has("ruff", ["--version"])) {
    // Bug-only rule set (syntax errors, undefined names, bad comparisons) selected on the
    // command line. Ruff's defaults flag import formatting in the SHIPPED test files —
    // grading a learner on style they did not write is noise, not signal.
    const r = run("ruff", ["check", "--no-cache", "--select", "E9,F63,F7,F82", "."], dir);
    return { name: "ruff (bug rules)", ok: r.code === 0, out: r.out };
  }
  const r = run("python3", ["-m", "compileall", "-q", "."], dir);
  return { name: "compileall", ok: r.code === 0, out: r.out };
}

function lintGo(dir) {
  const fmt = run("gofmt", ["-l", "."], dir);
  if (fmt.out.trim()) return { name: "gofmt", ok: false, out: `unformatted:\n${fmt.out}` };
  const vet = run("go", ["vet", "./..."], dir);
  return { name: "gofmt + go vet", ok: vet.code === 0, out: vet.out };
}

// A scaffold ships stub markers. Leaving them in a submission means the work is not
// finished even if the suite somehow passes.
function noStubMarkers(dir) {
  const files = walk(dir, (f) => /\.(ts|js|py|go)$/.test(f));
  const hits = files.filter((f) => readFileSync(f, "utf8").includes("TODO(you)"));
  return {
    name: "no TODO(you) left",
    ok: hits.length === 0,
    out: hits.map((f) => relative(ROOT, f)).join("\n"),
  };
}

// --- grading -----------------------------------------------------------------
function gradeOne(slug) {
  const dir = join(PROJECTS, slug);
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) return { slug, ok: false, lines: [`no such project: ${slug}`] };

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const stack = STACKS[manifest.stack];
  if (!stack) return { slug, ok: false, lines: [`unsupported stack "${manifest.stack}"`] };

  const [probeCmd, probeArgs] = stack.probe;
  if (!has(probeCmd, probeArgs)) {
    return { slug, ok: false, lines: [`toolchain missing: ${probeCmd} — install it (${stack.install})`] };
  }

  const [cmd, args] = stack.test;
  const t = run(cmd, args, dir, stack.env ?? {});
  const lines = [`tests: ${t.code === 0 ? "PASS" : "FAIL"}`];
  if (t.code !== 0) lines.push(t.out.slice(-4000));

  let ok = t.code === 0;
  for (const check of [...stack.checks, noStubMarkers]) {
    const r = check(dir);
    lines.push(`${r.name}: ${r.ok ? "ok" : "FAIL"}`);
    if (!r.ok) { lines.push(r.out.slice(-2000)); ok = false; }
  }
  return { slug, ok, lines };
}

function allSlugs() {
  if (!existsSync(PROJECTS)) return [];
  return readdirSync(PROJECTS)
    .filter((d) => statSync(join(PROJECTS, d)).isDirectory() && existsSync(join(PROJECTS, d, "manifest.json")))
    .sort();
}

function changedSlugs(baseRef) {
  const r = run("git", ["diff", "--name-only", baseRef, "HEAD"], ROOT);
  if (r.code !== 0) {
    console.error(`grade: git diff against "${baseRef}" failed, grading everything instead`);
    return allSlugs();
  }
  const known = new Set(allSlugs());
  const touched = new Set();
  for (const line of r.out.split("\n")) {
    const m = line.match(/^projects\/([^/]+)\//);
    if (m && known.has(m[1])) touched.add(m[1]);
  }
  return [...touched].sort();
}

const argv = process.argv.slice(2);
let targets;
if (argv.includes("--all")) targets = allSlugs();
else if (argv.includes("--changed")) targets = changedSlugs(argv[argv.indexOf("--changed") + 1] ?? "HEAD~1");
else targets = argv.filter((a) => !a.startsWith("-"));

if (!targets.length) {
  console.log("grade: nothing to grade. Usage: bun tools/grade.mjs <slug…> | --all | --changed <ref>");
  process.exit(0);
}

const summary = [];
let failed = 0;
for (const slug of targets) {
  const r = gradeOne(slug);
  console.log(`\n${r.ok ? "✓" : "✗"} ${r.slug}`);
  for (const l of r.lines) console.log(`   ${l.replace(/\n/g, "\n   ")}`);
  summary.push(`| \`${r.slug}\` | ${r.ok ? "✅ pass" : "❌ fail"} |`);
  if (!r.ok) failed++;
}

console.log(`\n${failed ? `grade FAILED (${failed}/${targets.length})` : `grade OK (${targets.length}/${targets.length})`}`);

// GitHub Actions surfaces this file as the run summary.
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## Grading\n\n| Project | Result |\n|---|---|\n${summary.join("\n")}\n\n`
    + (failed ? "Open the job log for the failing assertions.\n" : "All graded projects pass.\n"));
}

process.exit(failed ? 1 : 0);
