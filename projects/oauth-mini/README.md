# Mini OAuth 2.0 + PKCE — starter

Implement the four modules in `src/` until the acceptance suite passes:

    bun test

- `pkce.ts` — verifier/challenge (S256 only), constant-time `state` check.
- `codes.ts` — one-time authorization codes bound to client + redirect_uri.
- `refresh.ts` — refresh rotation with reuse detection (revoke the family).
- `scopes.ts` — granted = requested ∩ consented; exact-match checks.

The suite deliberately tests the properties a library hides from you: a replayed
code fails even with the right verifier, a wrong verifier still burns the code,
`plain` is refused, and reusing a rotated refresh token kills the whole session.

Green suite = the core is correct. Then go to the project page and push to the
senior bar: real HTTP endpoints, asymmetric-signed JWTs with `kid` rotation,
consent UI, introspection/revocation endpoints, and the threat model with the
telemetry to act on it.
