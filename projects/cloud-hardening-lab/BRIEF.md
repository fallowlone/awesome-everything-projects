# Cloud Hardening Lab

Take a cloud account you own and drag it from 'it works' to 'it's defensible'. You'll measure the posture you actually have, tighten IAM to least privilege without breaking the app, lock down the network and secrets, and prove every change with a before/after diff. This is the core of cloud security work: not adding features, but removing the standing access and quiet misconfigurations that an attacker would have used.

**Difficulty:** advanced · **Est. days:** 9 · **Stack:** a cloud account you own (AWS / GCP / Azure), the cloud CLI, Prowler or ScoutSuite (open-source CSPM), tfsec or Checkov (IaC scanning), Open Policy Agent / Rego, the provider's secrets manager + KMS · **Tracks:** security-cloud, security-foundations, security-defensive

## Deliverable

A hardened cloud environment in an account you own, with a committed before/after report: a baseline posture scan, scoped-down IAM policies, closed network paths, secrets moved into a managed store with rotation, audit logging enabled, and a remediation log mapping each finding to the change that fixed it.

## Why this project

Cloud security in the real world is rarely about exotic exploits; it's about the unglamorous work of removing standing access, closing forgotten paths, and making misconfigurations impossible to ship. This lab is deliberately defensive and run only against an account you own — the skill being trained is remediation under the constraint that the app must keep working, which is exactly what makes it hard. Anyone can lock everything down and break production. The senior move is to tighten until it's defensible, prove each change with a before/after, and then encode the lesson as a guardrail so the same mistake can't come back. When the second scan comes up clean and your CI refuses the bad change on its own, you'll have built the thing most accounts never get: a posture that defends itself.

## Skills

- reading and scoping IAM policies to least privilege
- running and triaging a cloud posture (CSPM) scan
- closing over-permissive network paths
- migrating secrets into a managed store with rotation
- enabling and validating audit logging
- writing policy-as-code guardrails (OPA / SCP)

## Milestones

### 1. Measure what you actually have

You can't harden what you haven't measured, and 'I think it's fine' is not a baseline. Point an open-source CSPM tool like Prowler or ScoutSuite at your own account and let it enumerate the posture: public buckets, wide-open security groups, users without MFA, unencrypted volumes, stale access keys. Don't fix anything yet — your only job here is an honest snapshot. Export the findings, sort them by blast radius rather than by tool-assigned severity, and write down the three that would hurt most if exploited. This snapshot is the 'before' half of every claim you'll make later; without it, you can only assert that you improved things, you can't show it.

**Definition of done:**

- A CSPM scan of your own account is saved to the repo, with raw output committed as the baseline.
- The top three findings are documented with a one-line rationale for why each is the highest blast radius.

### 2. Scope IAM to least privilege

Most cloud breaches are an identity problem wearing a network costume: a role with '*' on actions and resources, a long-lived key that should have been a short-lived assumed role. Find the over-broad grants the scan flagged and rewrite them. Replace wildcard actions with the specific calls the workload actually makes — read the access logs or CloudTrail to learn what it really uses, rather than guessing. Prefer short-lived role assumption over static keys, and remove standing admin from humans who only need it occasionally. The hard part isn't tightening; it's tightening without breaking the running app, so change one principal at a time and verify the workload still functions after each cut.

**Definition of done:**

- At least one wildcard or admin policy is replaced with a scoped policy, and the workload still passes a smoke test.
- A re-scan shows the flagged over-privileged identities no longer appear, with the before/after policy JSON committed.

### 3. Close the open paths

A 0.0.0.0/0 on a database port is an invitation, and 'we'll restrict it later' is how later never comes. Walk the network exposure the scan found: security groups, firewall rules, public IPs on things that should be private, and management ports (SSH, RDP, database) reachable from the whole internet. Pull each one back to the smallest source that actually needs it — a bastion, a VPN range, a specific service. The instructive tension is that least-exposure and convenience pull in opposite directions: the moment you close a port, something you forgot about may stop working, and that breakage is the map of your real dependencies. Document each path you close and what now reaches it.

**Definition of done:**

- No management or database port is reachable from 0.0.0.0/0; access is restricted to a named source range or bastion.
- A connectivity test confirms the intended path still works while the closed path is now refused.

### 4. Get secrets out of plaintext

Secrets in environment variables, committed config, or a sticky note in user-data leak the first time someone reads a snapshot or a log. Find the credentials your app passes around in the clear and move them into the provider's managed secrets store, fetched at runtime by an identity rather than baked into an image. Encrypt data at rest with KMS and confirm the key has its own tight policy — a secrets store guarded by a wide-open KMS key is theater. Then do the part everyone skips: rotate at least one secret and prove the app survives the rotation. A secret you can't rotate is a secret you can't revoke when it leaks, which means it's already a liability, not a control.

**Definition of done:**

- At least one hardcoded secret is removed from code/config and fetched at runtime from the managed store.
- One secret is rotated end-to-end and the app keeps working, with the rotation step documented.

### 5. Make the account auditable

Hardening that no one can verify after the fact is faith, not security. Turn on the account-wide audit trail (CloudTrail or its equivalent) so that every API call leaves a record, ship those logs somewhere tamper-resistant, and confirm that a deletion or a permission change actually shows up in them. The point isn't to read logs all day — it's that when something goes wrong at 3 a.m., the difference between a five-minute triage and a week of guessing is whether the events were being recorded before the incident. Decide what's worth logging and what's noise, because a trail no one can search is only marginally better than no trail at all.

**Definition of done:**

- An account-wide audit trail is enabled and shipping to durable, access-controlled storage.
- A deliberate test action (e.g. a permission change) is located in the logs, proving the trail captures it.

### 6. Stop the next misconfiguration before it ships

Everything so far fixed the past. This milestone fixes the future, because posture rots the moment a teammate adds a wildcard role or opens a port 'just for testing'. Write a policy-as-code guardrail — an OPA/Rego rule over your Terraform plan, or a Service Control Policy at the org boundary — that refuses the specific bad shapes you just spent days cleaning up. Then prove it has teeth: feed it a deliberately bad change and watch it block, and a good change and watch it pass. This is the difference between security as a one-time cleanup and security as a property the system maintains on its own. A guardrail that never says no is decoration; the value is in the deny you can demonstrate.

**Definition of done:**

- A policy-as-code rule (OPA/Rego or SCP) encodes at least one of the fixes you made earlier in this lab.
- A bad change is rejected by the guardrail and a good change passes, both shown in committed output.

## Rubric

### IAM least-privilege scoping

- **Junior:** Wildcard admin policies are identified and acknowledged. One is removed or restricted, but the replacement is still over-broad (e.g. 'Allow: s3:*' instead of the specific operations needed).
- **Mid:** Access logs or CloudTrail are consulted to learn what each workload actually calls; wildcard actions are replaced with the exact set used. Static long-lived keys are replaced with role assumption where the platform allows it. The workload smoke-test passes after each cut.
- **Senior:** You reason about the blast radius of each remaining permission: what could an attacker do with this role if it were compromised? You use resource-level conditions (e.g. restricting to a specific bucket ARN prefix) rather than action-level scoping alone, and you add a break-glass path that is auditable and time-limited so emergency admin doesn't require restoring standing access.

### Network segmentation and exposure closure

- **Junior:** The CSPM scan flags open paths; some are noted. A 0.0.0.0/0 on a database or management port is identified but not fully resolved — the port is narrowed to 'a smaller range' that is still broader than necessary.
- **Mid:** Every management and database port is restricted to a named source (bastion, VPN range, specific service SG). A connectivity test confirms the intended path works and the closed path is refused. Dependencies discovered when a port breaks (the undocumented caller) are documented.
- **Senior:** You classify the remaining exposure surface by attacker capability: what can an adversary who reaches the network perimeter do versus one who is already inside a private subnet? Segmentation decisions are tied to blast-radius reasoning — a compromised web tier should not be able to query the database directly, and you show the security group rule that enforces that boundary.

### Secrets management and encryption posture

- **Junior:** Plaintext secrets in environment variables or config are identified. At least one is moved into the managed secrets store, but previously-committed secrets have not been rotated.
- **Mid:** All live secrets are fetched at runtime from the managed store. At least one secret is rotated end-to-end and the app survives. KMS key policy is scoped — not 'allow: *'. Audit logging is confirmed to capture the rotation event.
- **Senior:** You reason about what happens after a secret leaks: the rotation SLA (how long between leak and revocation), whether the managed store access itself requires a separate credential that could be stolen, and the blast radius if the KMS key policy were too broad. A wide-open KMS key that guards a secrets store is identified as a layered failure, not independent protection.

### Audit logging and detection coverage

- **Junior:** Account-wide audit logging is turned on. A test action is located in the logs manually, confirming something is being captured.
- **Mid:** Logs ship to tamper-resistant, access-controlled storage. The retention period is set and justified. A deliberate bad action (permission escalation or public access toggle) is found in the logs within a reasonable search — not by scrolling, but by knowing the right filter.
- **Senior:** You identify the events an attacker would try to suppress (CloudTrail stop-logging, log-group deletion) and verify those attempts themselves appear in the trail. You distinguish signal from noise: which event types are high-fidelity indicators versus background API chatter that would hide a real alert. At least one alert rule is wired so a future misconfiguration fires a notification rather than waiting to be found in a scan.

## Senior stretch

- Wire the CSPM scan and the policy-as-code check into a CI pipeline so a pull request that regresses posture fails before merge, not after deploy.
- Quantify the improvement: turn the before/after scans into a small posture-score delta and a short remediation log mapping each finding to the commit that closed it.
- Add a least-privilege break-glass path: a tightly-scoped, audited, time-boxed elevation role so emergencies don't tempt anyone to restore standing admin.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/cloud-hardening-lab
