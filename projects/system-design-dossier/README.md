# System design dossier — starter

This workbench grades **your design document**.

1. Write it in `artifact/dossier.json`.
2. Run the checks:

       bun test

`src/dossier.ts` is the grader; you do not edit it. What ships in `artifact/` is the
document that gets written when nobody is going to review it: "it needs to scale",
zeroes for every number, one decision with no alternatives, no SLOs, no failure modes.

The checks are the ways a design document actually fails:

- **No numbers.** Without a load estimate the component choice cannot be argued with,
  which is the same as not having made one.
- **Capacity that does not follow from the load.** The grader recomputes storage and
  bandwidth from your own figures and flags anything more than an order of magnitude
  away — rounding is fine, fantasy is not. It also demands the arithmetic in
  `derivation`.
- **A decision with no rejected alternative** is a preference wearing a decision's
  clothes; the rejected options and the reasons are the content.
- **An SLO nobody measures and nothing breaches** is decoration, so every SLO needs a
  measurement and an error-budget consequence.
- **Fewer than three failure modes** means the document describes what happens when
  everything works — the least interesting case. Each one needs a blast radius, a
  mitigation, and how you would DETECT it, because an undetected failure is an outage
  you learn about from users.

Green suite = the dossier is defensible in a design review.
