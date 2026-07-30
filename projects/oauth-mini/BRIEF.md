# Mini OAuth 2.0 + PKCE login

Implement the authorization-code + PKCE flow end to end against a real provider, so you understand every redirect and token instead of trusting a library.

**Difficulty:** starter · **Est. days:** 3 · **Stack:** — · **Tracks:** security, apis

## Deliverable

A working 'Login with X' that exchanges a code for tokens using PKCE, validates state, and stores the session safely.

## Why this project

Most developers use an OAuth library and never look inside. This project is the opposite: you implement the authorization-code + PKCE flow yourself — every redirect, every CSRF defense, every token check — so the threat model is not a list to memorise but a consequence of the code you wrote. PKCE means a stolen authorization code is useless without the verifier generated in the same browser session. Refresh-token rotation means a leaked refresh token self-destructs on first replay. Storing sessions in an httpOnly cookie means XSS cannot steal them. None of this is magic; it is a series of design decisions whose cost is exactly one understanding.

## Skills

- authorization code flow
- PKCE
- state / CSRF defense
- token storage

## Milestones

### 1. Build the authorization endpoint and PKCE start

Stand up the minimal authorization server: an /authorize endpoint that accepts client_id, redirect_uri, response_type=code, scope, and a PKCE code_challenge (S256 only — reject plain), and a client that initiates the flow. The authorization code is a one-time, short-lived bearer of intent: keep its TTL tight (30–60 s, single use) because it travels through the browser and the redirect query string, the most exposed leg of the whole flow. PKCE binds the eventual token exchange to the browser that started it: the client generates a 43–128 char high-entropy code_verifier (≥256 bits from a CSPRNG), sends only its SHA-256 challenge up front, and reveals the verifier at the token step — so an intercepted code is useless without the verifier. The tradeoff: PKCE adds zero server-stored secret (unlike a confidential client secret) which is exactly why it's mandatory for public/native clients that cannot hold a secret.

**Definition of done:**

- /authorize validates redirect_uri against an exact registered allowlist and rejects any unregistered or wildcard-suffix URI.
- The server accepts only S256 code_challenge_method and the issued authorization code is single-use with a TTL ≤ 60 s.
- The client generates a fresh CSPRNG code_verifier (≥256 bits entropy) per flow and never reuses it.

**Self-review:** Show your redirect_uri check; a senior reviewer confirms it is an exact-match allowlist, not a prefix/substring test that an attacker-controlled subpath could satisfy.

### 2. Token endpoint: sign access and refresh tokens

Build the /token endpoint that exchanges code + code_verifier for an access token and a refresh token. Verify the verifier (SHA-256(code_verifier) == stored challenge) and consume the code atomically so a replayed code fails. Sign access tokens as JWTs with an asymmetric key (RS256/ES256, not HS256 — resource servers must verify with a public key, never share the signing secret), keep access-token TTL short (5–15 min) so a leaked token expires fast, and make refresh tokens long-lived opaque handles. Publish a JWKS endpoint with a kid in each token header so you can rotate signing keys without downtime: roll in a new key, serve both in JWKS during an overlap window (≥ your max token TTL), then retire the old kid. The tradeoff is self-contained JWTs (no introspection round-trip, but you can't revoke a live one) versus opaque tokens (revocable, but every check is a network hop).

**Definition of done:**

- The token exchange verifies the PKCE verifier and rejects a replayed (already-consumed) authorization code with an invalid_grant error.
- Access tokens are RS256/ES256-signed JWTs carrying a kid, exp, iss, and aud, verifiable against your published JWKS.
- Access-token TTL is ≤ 15 min and refresh tokens are stored hashed, never in plaintext.

**Self-review:** State your algorithm and how a verifier rejects a token signed with alg:none or HS256-with-public-key; a senior reviewer checks you pin the expected algorithm rather than trusting the header.

### 3. Wire the client: callback, state, redirect validation

Connect the relying-party client to your server end to end and validate the ID token before trusting a single claim. The callback handler must check the returned state against the value it stored before redirecting (this is the CSRF defense for the flow — without it, an attacker can stitch their own code into your victim's session), then exchange the code. Validate the ID token's signature against JWKS, plus iss, aud, exp, and nonce — a missing aud check means your app would accept a token minted for a different client. Pin the redirect target: only ever redirect the browser back to a validated, registered URI, because a sloppy 'return to' parameter is the classic open-redirect that turns your login into an attacker's launch pad.

**Definition of done:**

- The callback rejects a mismatched or missing state with a hard error and never proceeds to the token exchange.
- The ID token's signature, iss, aud, exp, and nonce are all checked; a token with the wrong aud is rejected.
- Any post-login redirect target is validated against a registered allowlist, so a crafted 'return to' cannot open-redirect the user.

**Self-review:** Walk through what happens when state is absent on the callback; a senior reviewer checks the request is rejected, not silently allowed because 'the code looked valid'.

### 4. Scopes, consent, and introspection/revocation

Make authorization mean something. Add a consent step where the resource owner approves the specific scopes a client requested, and enforce least privilege: a token granted read:profile must not pass a write:billing check. Issue tokens carrying only the consented scopes, and add two RFC 7662/7009 endpoints — /introspect so a resource server can ask 'is this opaque token still active and what scopes does it carry?', and /revoke so a user or admin can kill a token immediately. This is the answer to the JWT revocation gap from the token milestone: short-lived access JWTs you let expire, plus revocable refresh tokens and opaque tokens you can introspect. The tradeoff is latency — introspection adds a network call per request — so cache active-token results for a few seconds and accept that revocation is eventually-consistent within that window.

**Definition of done:**

- The consent step records the approved scopes and the issued token carries exactly those, no broader.
- /introspect returns active:false for an expired or revoked token, and a resource server denies a request whose token lacks the required scope.
- /revoke immediately invalidates a refresh token so it cannot mint new access tokens.

**Self-review:** Explain how a resource server enforces scope on an opaque token; a senior reviewer checks it consults introspection (or a verified claim) rather than trusting the client's stated scope.

### 5. Refresh rotation and session security

Harden the long-lived part of the flow. Implement refresh-token rotation: every refresh call invalidates the old token and issues a new one, so a refresh token is single-use. The payoff is reuse detection — if an already-rotated (consumed) refresh token is presented again, that means either the legitimate client or a thief is replaying it, so you revoke the entire token family and force re-auth. Set a hard refresh-token absolute lifetime (e.g. 14–30 days) and an idle window so abandoned sessions die. On the browser side, store the session in an httpOnly, Secure, SameSite cookie (not localStorage, which any XSS can read), and scope it tightly. The tradeoff: rotation adds write contention on the refresh store and a race when two tabs refresh at once — handle the race with a short grace window or a single-flight lock rather than nuking a legitimate family.

**Definition of done:**

- Each refresh issues a new token and invalidates the old; presenting a consumed refresh token revokes the whole token family.
- The browser session lives in an httpOnly + Secure + SameSite cookie, and you can justify it versus localStorage.
- A concurrent double-refresh from two tabs does not falsely trip reuse detection and revoke a valid session.

**Self-review:** Describe your reuse-detection trigger and what it revokes; a senior reviewer checks it kills the family on replay but tolerates the benign two-tab race.

### 6. Threat model, observe, and work a token-leak incident

Tie it together with a written threat model and the telemetry to act on it, then survive an incident. Enumerate the flow's attack surface — authorization-code interception, open redirect, CSRF via missing state, token leakage through logs or Referer, and refresh-token theft — and map each to the defense you built. Instrument the auth path with RED metrics (rate, errors, duration on /authorize, /token, /introspect) and structured logs that NEVER record raw tokens, code_verifiers, or client secrets — log a hashed token id at most. Then run the incident: a refresh token leaks (say, it ended up in a server log shipped to a third party). Detect the anomalous reuse from your metrics, revoke the affected token family live, and write a short post-mortem. The real fix is not just 'rotate the leaked token' — it's closing the leak path (redaction, no tokens in URLs) plus rotation so a future leak self-heals on next use.

**Definition of done:**

- A written threat model lists ≥5 attacks (code interception, open redirect, CSRF, token-in-log leak, refresh theft) each mapped to a concrete defense in your code.
- RED metrics cover the auth endpoints and a log audit proves no raw token, verifier, or secret is ever written.
- You reproduced a leaked-refresh-token reuse, revoked the family live, and the post-mortem names the leak path and the prevention (redaction + rotation), not just 'we rotated it'.

**Self-review:** Paste the prevention item from your post-mortem; a senior reviewer checks it closes the leak path (redaction, no tokens in URLs/logs) and relies on rotation, not just a one-off revocation of the known-leaked token.

## Rubric

### PKCE implementation and authorization-code hardening

- **Junior:** The flow redirects to the provider and exchanges a code for tokens but does not implement PKCE or validates only the code_challenge format without verifying it at the token step.
- **Mid:** The client generates a per-flow CSPRNG code_verifier (≥256 bits), sends only its S256 challenge up front, and the token endpoint verifies SHA-256(verifier) == stored challenge atomically consuming the code.
- **Senior:** The server rejects plain code_challenge_method with an explicit error (not a fallback). The authorization code is single-use with a TTL ≤ 60 s; a replay attempt after consumption returns invalid_grant. redirect_uri is validated against an exact-match allowlist — not a prefix check — and you can demonstrate how a wildcard-suffix URI check opens the redirect to an attacker.

### Token signing, algorithm pinning, and JWKS rotation

- **Junior:** Access tokens are signed with HS256 using a shared secret, or the algorithm is read from the JWT header at verification time without pinning.
- **Mid:** Tokens are RS256/ES256-signed JWTs carrying kid, exp, iss, and aud; the verifier pins the expected algorithm and rejects alg:none or a key-confusion attack; a JWKS endpoint publishes the public key for resource servers.
- **Senior:** Signing-key rotation works without downtime: a new kid is introduced, both old and new kids appear in JWKS for an overlap window ≥ the max access-token TTL, then the old kid is retired while live tokens keep verifying. You can state the overlap minimum and why a shorter window would invalidate still-valid tokens.

### State/CSRF defense and token storage security

- **Junior:** The state parameter is generated but not checked on the callback, or the session is stored in localStorage where any XSS can read it.
- **Mid:** The callback rejects a missing or mismatched state with a hard error before proceeding to the token exchange; the browser session lives in an httpOnly + Secure + SameSite cookie.
- **Senior:** The state value is a CSPRNG-generated nonce tied to the browser session so a CSRF attacker cannot predict or forge it. Refresh tokens are stored hashed (not plaintext) so a database dump does not yield live refresh credentials. Any post-login redirect target is validated against a registered allowlist, closing the open-redirect attack surface that would turn your login flow into an attacker's redirect launcher.

### Refresh-token rotation and replay detection

- **Junior:** Refresh tokens are long-lived and reusable; there is no mechanism to detect or respond to a stolen refresh token being replayed.
- **Mid:** Each refresh call invalidates the old token and issues a new one; presenting a consumed refresh token revokes the whole token family and forces re-authentication.
- **Senior:** Concurrent refresh from two tabs (a benign race) does not falsely trip reuse detection — handled with a short grace window or a single-flight lock. The absolute lifetime of a refresh token is bounded (14–30 days) with an idle window so abandoned sessions die. You can name the race condition that causes a false revocation and state the grace window duration you chose and why.

## Senior stretch

- Add sender-constrained tokens with DPoP (or mTLS-bound tokens): bind each access token to a client-held key so a stolen bearer token is useless without proof-of-possession.
- Implement the OAuth 2.0 device authorization grant (device flow) for input-constrained clients, with user_code, verification_uri, and correct slow_down/polling backoff.
- Run a zero-downtime signing-key rotation: publish a new kid in JWKS, overlap old and new past the max token TTL, then retire the old key while live tokens keep verifying.
- Store the session in an httpOnly, SameSite cookie and justify the choice versus localStorage under an XSS threat model.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/oauth-mini
