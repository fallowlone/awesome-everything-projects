# Authorized Recon-to-Remediation Lab

Stand up an intentionally-vulnerable target you own — a deliberately-broken app in a local container or a CTF box on your own machine — and run a full offensive engagement against it, end to end, on a scope you signed off yourself. You recon the box, pick one class of vulnerability, prove it with a working exploit in the lab, and then turn around and write the fix and the detection. The point isn't to 'pop a box'; it's to live the whole loop a real engagement runs — scope, evidence, impact, remediation — on a target where nobody gets hurt.

**Difficulty:** advanced · **Est. days:** 8 · **Stack:** Docker / Docker Compose, an intentionally-vulnerable app (e.g. OWASP Juice Shop, DVWA, or a CTF box you own), nmap, Burp Suite or mitmproxy, curl / a scripting language for the PoC · **Tracks:** security-offensive, security-defensive, security-foundations

## Deliverable

A self-hosted vulnerable target running in a container you control, plus a short engagement report that documents the authorized scope, a recon map, one reproducible exploit chain proven in the lab (request/response or PoC script), the concrete code-or-config remediation, and a detection rule that would have caught the attack.

## Why this project

Offensive security is taught as a thrill — find the bug, pop the box — but the job is a loop, and the half nobody films is what actually pays: scope it so you don't cause harm, prove impact so people believe you, fix the root cause, and make sure you'd catch it next time. Running that whole loop against a target you own collapses the gap between 'I can exploit things' and 'I can be trusted with access'. The intentionally-vulnerable lab is the safe place to build that judgment, because the discipline you practice here — write the scope, keep the evidence, stop at the proof, hand back a fix — is exactly the discipline that, off the lab, is the difference between a security engineer and an incident.

## Skills

- defining and honoring an authorized engagement scope
- service enumeration and attack-surface mapping
- identifying and classifying a web or service vulnerability
- building a reproducible proof-of-concept exploit
- writing remediation that closes the root cause
- authoring detection logic for the technique used

## Milestones

### 1. Sign your own rules of engagement

Before a single packet leaves your machine, write the scope down. Stand up an intentionally-vulnerable target inside a container or VM you fully own — Juice Shop, DVWA, a CTF image, your choice — and bind it to localhost or a private bridge network so it can never reach the public internet. Then write a one-page rules-of-engagement note for yourself: exactly which host and ports are in scope, what's explicitly out of scope, and a hard rule that this work touches nothing you don't own. This sounds like paperwork, but it's the single habit that separates a security engineer from a liability. A real engagement lives or dies on its scope document; practicing it on a lab you control is how the discipline becomes muscle memory instead of a thing you'll improvise badly under pressure later.

**Definition of done:**

- The vulnerable target runs in a container/VM you own, reachable only from your host on a private network, never the public internet.
- A written scope note names the in-scope host and ports, the out-of-scope list, and an explicit 'owned-lab-only' rule.

### 2. Map what's actually there

You can't attack what you haven't seen. Enumerate the target the way a real engagement opens: scan the in-scope ports, fingerprint the services and versions behind them, then walk the application's actual surface — routes, parameters, forms, headers, error pages. The goal is a recon map, not a vulnerability yet: a written inventory of every entry point and every place the app takes input from you. Resist the urge to start firing exploits the moment something looks weak. Senior recon is patient and complete, because the finding you miss is almost always on the surface you didn't bother to map. Keep your scan output and your notes — they're the first evidence in your report.

**Definition of done:**

- A recon map lists open ports, identified services/versions, and the app's reachable routes and input points.
- Scan output and notes are saved as evidence, tied to timestamps within your declared scope window.

### 3. Find one real bug and name it

From your recon map, pick one input point and pull on it until something gives. Maybe a parameter reflects unescaped (XSS), maybe an id you change returns someone else's object (IDOR), maybe a field reaches a query or a shell (injection). Pick a single class of vulnerability and confirm it's really there — a flicker on the screen isn't proof, a controlled, repeatable behavior is. The skill being built here is classification: you don't just say 'it broke', you say which weakness this is and why, in the same vocabulary a triage team uses. That precise name is what tells everyone downstream how bad it is and how it gets fixed. Don't try to find everything; find one thing and understand it cold.

**Definition of done:**

- One vulnerability is confirmed with a repeatable trigger, not a one-off observation.
- The finding is classified by its weakness class (e.g. CWE/OWASP category) with a one-line rationale.

### 4. Turn the bug into proof

A vulnerability you can't demonstrate is an opinion. Build a clean, minimal proof-of-concept against your lab target: a saved request/response pair, or a short script, that takes the weakness from 'looks exploitable' to 'here is the impact'. Show what an attacker actually gets — a session read, an object accessed that shouldn't be, a command run — and nothing more; staying inside the impact you need to prove is itself a professional habit. Capture the evidence so a reader who never touched your lab can follow the steps and reach the same result. This is the deliverable that makes an engagement credible: not 'I think this is bad', but a reproducible chain that anyone can replay against the same broken target.

**Definition of done:**

- A PoC (saved requests or a script) reproduces the exploit against the lab target from a clean state.
- The captured evidence shows concrete impact and stops at what's needed to prove it.

### 5. Fix it, then catch it next time

Now switch sides — this is the half most offensive practice skips, and the half that makes you employable on a real team. Write the remediation that closes the root cause, not just the symptom: parameterized queries or output encoding instead of a blacklist, an authorization check instead of a hidden id, a patched version instead of a fragile workaround. Then write the detection: the log line, alert, or rule that would have fired when your own exploit ran. A finding without a fix is a complaint; a fix without detection assumes you'll never miss the next one. Finish by assembling everything — scope, recon, finding, exploit, fix, detection — into a short report that reads the way a professional engagement report reads: evidence first, impact stated plainly, remediation actionable by the team that owns the code.

**Definition of done:**

- A remediation closes the root cause and is verified: re-running the PoC against the fixed target no longer works.
- A detection rule or log/alert is written that would have fired on the original exploit, with a note on its false-positive cost.

## Rubric

### Scope discipline and authorization

- **Junior:** The lab target is isolated in a container or VM you own; work stays on the declared host. No written scope exists beyond 'it's my machine'.
- **Mid:** A written rules-of-engagement note names in-scope hosts, ports, and an explicit 'owned-lab-only' boundary; all evidence is timestamped inside the declared window.
- **Senior:** You can articulate why the scope boundary exists at the network layer (container/VM isolation, no internet path) and how a real-world engagement scope would differ — what clauses protect both tester and target and who signs them.

### Recon methodology and surface coverage

- **Junior:** Ports and obvious routes are identified; recon stops when the first exploitable thing appears. Evidence is partial and unsorted.
- **Mid:** Recon is systematic and complete before exploitation begins: port scan, service fingerprinting, full application surface map with routes, params, headers, and error pages saved as evidence.
- **Senior:** The recon map distinguishes trust boundaries and data flows, not just entry points. You note what you didn't map (out-of-scope services, blind spots) and reason about what an attacker who knew those gaps could reach — the value of the missing surface.

### Exploit proof and footprint discipline

- **Junior:** A vulnerability is found and a one-off observation is noted. The PoC is manual, unrepeatable, and shows more impact than is needed to prove the point.
- **Mid:** A minimal, reproducible PoC (saved request/response or script) demonstrates the exact impact from a clean state, correctly classified by CWE/OWASP category.
- **Senior:** The PoC stops at proof of impact and documents why. You reason about the worst-case chain (what additional access a real attacker gains after this step) and bound the blast radius, not just the trigger. You distinguish 'what I proved' from 'what is possible'.

### Remediation quality and detection logic

- **Junior:** A fix is applied; re-running the PoC fails. The fix targets the symptom (e.g. a blacklist) rather than the root cause. No detection rule exists.
- **Mid:** The remediation closes the root cause (parameterized queries, schema validation, proper authorization check) and is verified by re-running the PoC. A detection rule or alert is written that would have fired on the original exploit.
- **Senior:** You state the false-positive cost of the detection rule (what benign traffic looks the same) and the evasion: what change to the exploit payload would slip past it and what additional telemetry would close that blind spot. Remediation + detection is presented as a chain, not two disconnected items.

## Senior stretch

- Chain two findings into a single higher-impact path — e.g. an information leak that hands you the id an IDOR needs, or an auth bypass that unlocks the endpoint your injection lives behind — and document the chain as one attack story with combined impact.
- Map your exploit to MITRE ATT&CK techniques and write detection guidance per technique: what telemetry is needed, what the detection looks like, and where it would have blind spots.
- Re-run the full engagement against the remediated build to prove the fix holds and the detection fires, then write a short retest section the way a follow-up engagement closes a finding.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/authorized-recon-ctf-lab
