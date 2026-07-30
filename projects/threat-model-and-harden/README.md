# Threat-model and harden — starter

This workbench grades **your threat model** as a reviewer would: not "is it long",
but "does it close the loop".

1. Write your model in `artifact/threat-model.json`.
2. Run the checks:

       bun test

`src/model.ts` is the grader; you do not edit it. Three failures make a threat model
theatre, and each is an error here:

- **A threat with no control** — a risk you wrote down and left open.
- **A control with no evidence** — "we added helmet" is a claim; a test name, a scan
  output or a log query is proof. Filler like `TODO` / `n/a` counts as absent.
- **A boundary nobody analysed** — then it was decoration, not a boundary.

It also requires all six STRIDE categories (six XSS entries is not a threat model)
and insists the classes behind most real breaches appear somewhere: session
lifetime, object-ownership/IDOR, secrets handling, input validation, transport and
headers.

Green suite = the document is honest. The hardening itself still has to exist — run
ZAP against the app, rotate the credential you found, and confirm each control from
the outside.
