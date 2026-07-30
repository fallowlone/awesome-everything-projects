# Authorized recon-to-remediation lab — starter

This workbench grades **your engagement record**: the authorization, the scope, what
you did, what you found, and what you fixed.

1. Fill in `artifact/engagement.json`.
2. Run the checks:

       bun test

`src/engagement.ts` is the grader; you do not edit it.

**The first check is not a technical one.** Scope and written authorization are what
separate security work from a crime. The grader refuses:

- an engagement with no authorization record, no grantor, or no end date — permission
  without an end is not permission;
- any activity dated before it started or after it expired, and any undated activity,
  since an undated action cannot be shown to have been authorised;
- any activity or finding whose target is outside the declared scope. A finding against
  a host you were not authorised to touch is not a finding, it is an admission;
- anything explicitly excluded for that target, and anything destructive — this is
  recon and remediation, not damage.

Then the reporting discipline: every finding needs reproducible evidence (a command, a
request, a scan reference), a remediation with an owner, and — if you call it fixed —
a re-verification date.

The scope matcher is deliberately conservative (exact host, `*.domain`, or a /24):
a grader that guessed wider than your authorisation would be the exact mistake this
project exists to prevent.
