# Threat-Model and Harden a Small App

Take a small app you fully own and run it through the loop a real security engineer lives in: first map how an attacker would actually break it, then close those paths one by one. You build an attack tree against your own service, then fix authentication, authorization, secrets handling, security headers, and input validation — and write down which fix kills which branch of the tree. This is the whole craft of defensive security in miniature: not a checklist, but a chain from threat to mitigation you can defend out loud.

**Difficulty:** advanced · **Est. days:** 8 · **Stack:** a small app you own (any stack — Node/Express, Flask, or similar), OWASP ZAP or Burp Suite Community, a secrets manager or .env + dotenv-vault / SOPS, a security-headers middleware (helmet or equivalent), a schema validator (zod, pydantic, or similar) · **Tracks:** security-foundations, security, security-defensive

## Deliverable

A self-hosted app you own, hardened across authn/authz, secrets, security headers, and input validation, accompanied by an attack tree and a short writeup that maps each concrete fix to the specific threat it neutralizes.

## Why this project

Security work that isn't tied to a threat is theater — you can spend a week tightening things no attacker cares about while the real hole stays open. This project forces the discipline that fixes that: start from how your app actually breaks, fix the paths that matter, and write down the chain from each threat to its mitigation so you can defend your choices to a reviewer. Doing it against an app you own and control teaches the senior reflex of thinking like an attacker to act like a defender — and the CI gates at the end are what keep the work from quietly decaying the moment you stop looking. When you can point at any line of your hardening and name the exact attack it stops, you've stopped doing checklists and started doing security.

## Skills

- building an attack tree from a real data-flow diagram
- hardening authentication and session handling
- enforcing least-privilege authorization
- moving secrets out of code and rotating them
- configuring security headers and input validation
- writing a threat-to-mitigation traceability matrix

## Milestones

### 1. Draw the attack tree

Before you fix anything, you have to know what you're defending against — and 'all of it' is not an answer. Pick one app you fully own and run only against your own, intentionally-vulnerable, self-hosted copy. Sketch its data-flow diagram: where requests enter, where data crosses a trust boundary, where secrets live. Then put the attacker's goal at the root of a tree — say, 'read another user's data' — and branch downward into the concrete ways to get there: a missing authorization check, a guessable session token, a leaked secret in a git history. Don't try to be exhaustive; be honest. A small tree with three real branches beats a huge one full of threats that can't actually happen against your design.

**Definition of done:**

- A data-flow diagram exists that marks every entry point, trust boundary, and place where secrets or user data live.
- An attack tree with at least one attacker goal at the root and three or more concrete, design-specific leaf attacks.

### 2. Fix who-you-are and what-you-may-do

Most real breaches aren't exotic — they're a session that never expires and an endpoint that forgot to check ownership. Take the authentication and authorization branches of your tree and close them. On the authn side: make sessions or tokens unguessable, short-lived, and properly invalidated on logout, and stop trusting anything the client claims about its own identity. On the authz side, enforce least privilege at the point of every sensitive action — the question is never 'is this user logged in?' but 'is this specific user allowed to touch this specific object?'. The classic bug here is IDOR: GET /orders/123 works for anyone who changes the number. Prove to yourself that changing the id to someone else's now returns 403, not their data.

**Definition of done:**

- Sessions/tokens are short-lived and invalidated on logout; a stale or tampered token is rejected.
- Accessing another user's object by changing an id returns 403/404, demonstrably, not that object's data.

### 3. Get secrets out of the code

A secret committed once is a secret committed forever — git remembers, and so do mirrors and CI logs. Hunt down every credential your app touches: database passwords, API keys, signing keys, the JWT secret. Move them out of source and config files into environment variables backed by a secrets manager (or at minimum an encrypted store like SOPS), and make sure the real values never reach the repo. Then do the part people skip: rotate anything that was ever committed, because removing it from the current file doesn't remove it from history. Treat a leaked key as already compromised. The win condition isn't 'no secrets in the latest commit' — it's 'a fresh clone of the repo contains no live secret, and every previously-exposed one has been rotated'.

**Definition of done:**

- No live secret is present in source, config, or git history; the app reads all secrets from the environment/manager.
- Any credential that was previously committed has been rotated, not just deleted from the current files.

### 4. Headers at the edge, validation at the door

Two cheap layers stop a surprising amount of damage. First, security headers: a Content-Security-Policy that blocks injected scripts, HSTS so the browser refuses to downgrade to HTTP, plus X-Content-Type-Options and a sane Referrer-Policy. Don't cargo-cult a block off the internet — tune the CSP to your app and watch what it breaks. Second, input validation at every trust boundary: every request body, query param, and header is hostile until proven otherwise. Validate against a schema, reject what doesn't fit with a clear 4xx, and never build a query or a shell command by gluing strings to user input. Validation isn't about politeness to good clients; it's the wall that turns 'attacker controls this field' into 'attacker gets a 400'.

**Definition of done:**

- Responses carry a tuned CSP and HSTS plus the baseline headers, verified with a headers scanner.
- Every input crossing a trust boundary is schema-validated; a malformed or injection payload returns 4xx, not a 500 or silent execution.

### 5. Map every fix to its threat

A fix you can't trace to a threat is just churn, and a threat with no fix is an open risk you're pretending not to see. Close the loop: build a traceability matrix where every leaf of your attack tree points to the concrete change that neutralizes it — and rank what's left. Some branches you'll fully cut (rotated the leaked key); some you'll only reduce (validation lowers but doesn't erase injection risk); some you'll consciously accept and say why. This writeup is the deliverable that separates a tinkerer from an engineer: it shows you didn't just toggle settings, you reasoned about which threats mattered, what each change bought you, and what residual risk you're knowingly carrying.

**Definition of done:**

- A traceability matrix links every attack-tree leaf to a specific fix, or to a documented accept/defer decision.
- Each remaining risk is ranked (e.g. by likelihood × impact) with a one-line rationale.

### 6. Make the pipeline catch regressions

Manual hardening rots: the next commit re-introduces a secret, bumps a dependency with a known CVE, or quietly drops a header. Turn the work you just did into gates that run on every push. Add a secret scanner so a committed key fails the build, a dependency/SCA check so a vulnerable package blocks merge, and — if your app has tests — an automated header or auth assertion that breaks loudly when protection regresses. Keep it honest: a noisy scanner everyone ignores is worse than a small one with zero false positives that the team actually trusts. The goal isn't a green badge; it's that the day someone re-leaks a secret or pins a bad version, the pipeline says no before it reaches main.

**Definition of done:**

- CI fails the build on a committed secret and on a dependency with a known critical vulnerability.
- A deliberate regression (e.g. removing a header or re-adding a secret) is caught by the pipeline, not by a human.

## Rubric

### Attack-surface enumeration and threat modeling

- **Junior:** A data-flow diagram is sketched and some threat categories are named. The attack tree is shallow — one or two generic leaf threats rather than design-specific exploits. STRIDE categories may be listed but not applied to the specific trust boundaries.
- **Mid:** The data-flow diagram marks entry points and trust boundaries. The attack tree has at least three design-specific leaf attacks (e.g. IDOR on /orders/:id, session token brute-force, JWT secret in git history). Each leaf is linked to a STRIDE category with a one-line rationale.
- **Senior:** Threats are prioritized by likelihood × impact, not just listed. You can name the attacker capability each leaf assumes (unauthenticated internet user vs. authenticated insider vs. compromised internal service) and explain why that assumption determines which mitigations are worth their cost versus which are over-engineering for the actual threat model.

### Authentication and authorization hardening

- **Junior:** Sessions are short-lived and logout invalidates the token. An IDOR check is added but is implemented client-side or in a middleware that can be bypassed by calling the handler directly.
- **Mid:** Authorization is enforced at the handler level on every sensitive operation — not just behind a login gate. Changing an object's id in any request returns 403 or 404 for a different user's resource, demonstrably. Session tokens are cryptographically unguessable, expire, and are invalidated server-side on logout.
- **Senior:** You state the residual risk after the fix: what a legitimate authenticated user could still do if their account were compromised (horizontal privilege escalation). You distinguish between authentication (who you are) and authorization (what you may do) at the code level and can explain why centralizing authorization logic in one place reduces the probability of a missed check on a new endpoint.

### Secrets hygiene and input validation

- **Junior:** Secrets are moved out of the current files. The app reads from environment variables. Previously-committed secrets have not been rotated; the git history still contains them.
- **Mid:** No live secret exists in source, config, or git history. Previously-committed values are rotated. Input is validated against a schema at every trust boundary; malformed or injection payloads return 4xx, not 500 or silent execution. Security headers (CSP, HSTS, X-Content-Type-Options) are present and tuned to the app.
- **Senior:** The CSP is tuned to the app's actual script and style sources, not a permissive fallback. You can demonstrate that a CSP violation fires a report-uri event. You reason about what a leaked API key enables for an attacker: read-only database key vs. write key vs. admin key have very different blast radii, and your secret rotation prioritizes by that ranking, not by alphabetical order.

### Threat-to-mitigation traceability

- **Junior:** Fixes are applied and a list of changes is written. The connection between a specific fix and the specific leaf threat it closes is implicit rather than explicit.
- **Mid:** A traceability matrix links every attack-tree leaf to a specific fix, or a documented accept/defer decision with a rationale. Remaining risks are ranked by likelihood × impact.
- **Senior:** For each accepted risk you state the compensating control (the mitigation that reduces probability without eliminating the attack path) and the tripwire (what event would upgrade this from 'accepted' to 'must fix now'). You distinguish between a fix that removes an attack class and one that only raises the cost of exploitation — and you treat the latter honestly as a risk reduction, not a closure.

## Senior stretch

- Wire a SAST/DAST scan (e.g. OWASP ZAP baseline) into CI against an ephemeral instance of the app, so each PR gets an automated active scan and a diff of new findings.
- Add structured security logging for authn/authz failures and feed it into a simple detection rule, so an attempted IDOR or brute-force shows up as a signal instead of vanishing into noise.
- Re-run your attack tree after hardening and record which branches are now infeasible versus merely harder — a before/after that proves the mitigations actually moved the risk.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/threat-model-and-harden
