# A Service systemd Trusts

Anyone can write a script that runs. The job is to make it a service the operating system will keep alive, restart sanely, log honestly, and box in when it misbehaves. You take a small daemon from 'works when I run it in my terminal' to a real systemd unit — started at boot, watched by PID 1, its logs in journald, its blast radius capped. This is the difference between code and a service.

**Difficulty:** intermediate · **Est. days:** 7 · **Stack:** systemd, systemctl, journalctl, Type=notify / sd_notify, cgroups v2, a daemon in any language (bash, Python, Go, or Node) · **Tracks:** linux

## Deliverable

A long-running daemon installed as a systemd service that starts on boot, restarts on crash with backoff, streams structured logs to journald, runs under a memory and CPU budget, exposes a health signal, reloads config without a full restart, and is sandboxed with NoNewPrivileges and ProtectSystem.

## Why this project

On a Linux box, the unit of operational reality isn't a script — it's a service. systemd is the contract between your code and the machine: it decides when your process starts, what happens when it dies, where its logs go, how much memory it may eat, and what it's allowed to touch. Most engineers learn just enough to paste an ExecStart and move on, then get paged when the thing leaks memory, eats /tmp, ignores SIGTERM, or scrolls an unfilterable wall of logs. This project makes you write the unit the way an operator wishes everyone did: foreground daemon, honest signals, journald-native logging, a real cgroup budget, a readiness and watchdog story, a deny-by-default sandbox, and a timer that inherits all of it. Do it once by hand and you'll never again ship a service that 'works on my machine' but falls apart under PID 1.

## Skills

- writing a daemon that behaves under an init system
- authoring and installing a systemd unit file
- logging to journald and reading it back
- restart policy, watchdog, and graceful reload
- capping resources with cgroup directives
- sandboxing a service with systemd hardening
- running a periodic job with a systemd timer

## Milestones

### 1. A daemon that behaves

Write the smallest program worth supervising: a process that stays in the foreground, does a tiny unit of work on a loop, and writes a line of output each pass. The instinct from scripting is to fork into the background and detach — resist it. Under systemd the right shape is the opposite: stay attached, let the init system own your lifecycle, and write logs to stdout/stderr instead of opening your own file. Then prove the part everyone skips: catch SIGTERM and shut down cleanly. A service that ignores SIGTERM gets a SIGKILL after the stop timeout, losing whatever it was mid-way through. Make termination a deliberate, handled event, not a guillotine.

**Definition of done:**

- The daemon runs in the foreground, loops doing work, and prints a line to stdout each cycle (no detaching, no self-managed log file).
- Sending SIGTERM makes it finish the current step, print a shutdown line, and exit 0 within a couple of seconds.

### 2. Wrap it in a unit

Now hand the daemon to systemd. Write a unit file under /etc/systemd/system, declare [Unit], [Service], and [Install] sections, point ExecStart at your binary, and learn the daemon-reload / enable / start dance that trips up everyone the first time — systemd caches unit files, so edits do nothing until you reload. Pick the right service Type: a plain foreground loop is Type=simple, but the moment you want systemd to know your service is actually ready (not just spawned) you'll reach for Type=notify and a readiness signal. Set a Restart policy and a RestartSec, then kill the process by hand and watch PID 1 bring it back. This is the core promise of an init system: a crash is not the end, it's an event with a defined response.

**Definition of done:**

- systemctl enable --now starts the service, and it comes back automatically after a reboot.
- Killing the process (e.g. kill -9 the PID) triggers a restart per the Restart= policy, visible in systemctl status.

### 3. Logs you can actually read

Because the daemon writes to stdout and runs under systemd, journald already captures every line — for free, no logfile, no rotation cron you have to remember. Spend this milestone learning to interrogate that stream like an operator: journalctl -u your-service, -f to follow live, --since to scope a window, -p err to filter by priority, and -o json to see the structured fields journald attached. Then make your output worth filtering: emit a priority on lines that matter (a warning when the work step fails, an error when it can't recover) so -p warning surfaces signal instead of noise. The goal is that when this service misbehaves at 3am, one journalctl invocation tells the on-call person what happened, in order, with timestamps they can trust.

**Definition of done:**

- journalctl -u <service> shows the daemon's output, and -f follows it live while the service runs.
- At least one log line carries a non-default priority so journalctl -p warning (or higher) filters down to just the meaningful events.

### 4. Budget, health, and graceful reload

An unbounded service is a future incident. Cap it: set MemoryMax and CPUQuota in the unit so a leak or a runaway loop gets throttled or OOM-killed by its own cgroup instead of taking the box down with it — then deliberately blow the memory budget and watch the cgroup, not the kernel's global OOM killer, make the call. Next, give systemd a real definition of 'healthy': switch to Type=notify, send a readiness signal once startup actually finishes, and optionally arm WatchdogSec so a hung daemon that stops pinging gets restarted instead of sitting there alive-but-useless. Finally, wire a reload path — ExecReload plus a SIGHUP handler — so you can change config and re-read it without dropping the process. The lesson is that 'running' and 'working' are different states, and a managed service has to prove the second one.

**Definition of done:**

- MemoryMax/CPUQuota are set and verifiable: pushing the daemon past the memory cap gets it killed by its cgroup, shown in systemctl status / journalctl.
- systemctl reload re-reads config without restarting (PID stays the same), and the new config visibly takes effect.

### 5. Box it in and put it on a clock

A service is also an attack surface, and systemd ships a deny-by-default toolkit most people never turn on. Harden it: NoNewPrivileges=true so a compromise can't escalate via setuid binaries, ProtectSystem=strict to make the whole filesystem read-only except the paths you explicitly grant, PrivateTmp=true for an isolated /tmp, and a tight ReadWritePaths for the one directory it genuinely needs. Run systemd-analyze security on your unit and watch the exposure score drop as each directive lands — treat it like a checklist with a number attached. Then add a second deliverable: a periodic job. Write a small companion unit plus a .timer that runs it on a schedule (say, a nightly cleanup or health snapshot), and understand why a systemd timer beats a cron line here — it inherits the same sandbox, logs to the same journal, and survives missed runs with Persistent=true. By the end you have a service that is supervised, observable, bounded, sandboxed, and scheduled: the full shape of a production-grade unit.

**Definition of done:**

- The unit sets NoNewPrivileges, ProtectSystem=strict (or full), and a minimal ReadWritePaths; the service still works and systemd-analyze security shows an improved score.
- A .timer unit triggers a companion job on schedule, visible in systemctl list-timers and in the journal with its own entries.

## Rubric

### Unit correctness and service type

- **Junior:** A unit file exists and `systemctl start` launches the daemon. Service type is Type=simple (or unset) regardless of whether the process actually signals readiness. The daemon may background itself, causing systemd to mis-track its PID.
- **Mid:** Service type is chosen to match the daemon's behavior: Type=simple for a loop that is ready immediately, Type=notify when the process signals readiness via sd_notify(). The daemon stays in the foreground, writes to stdout/stderr only, and exits 0 on SIGTERM within the stop timeout. `systemctl enable --now` persists across reboots.
- **Senior:** You articulate the difference between 'spawned' and 'ready': a Type=simple service is marked active the moment the process starts, so a dependency that starts before this one can try to connect before it's actually listening. Type=notify with a WatchdogSec makes that gap observable — if the process hangs after startup, PID 1 detects it and restarts. You can trace through what systemd does when WatchdogSec expires on a hung process.

### Restart policy and resource budget

- **Junior:** Restart=always is set. No RestartSec backoff is configured — the service will restart immediately in a tight loop if it crashes repeatedly, potentially flooding the system. MemoryMax and CPUQuota are absent.
- **Mid:** Restart policy is set with a RestartSec backoff (e.g. RestartSec=5). MemoryMax and CPUQuota are set and verified: deliberately exceeding the memory budget is killed by the cgroup (visible in systemctl status and journalctl), not by the kernel's global OOM killer. A deliberate kill -9 triggers a restart visible in systemctl status.
- **Senior:** You explain the cgroup kill advantage over the global OOM killer: cgroup OOM is scoped to the service and does not cause memory pressure across the host, while a global OOM event picks victims heuristically and may kill an unrelated high-priority process. You reason about StartLimitIntervalSec and StartLimitBurst to prevent a crashlooping service from consuming all of PID 1's attention during a failure storm.

### journald observability

- **Junior:** The daemon writes to stdout and logs appear in `journalctl -u <service>`. All output is at the same priority level — there is no way to filter warnings from informational lines.
- **Mid:** At least one meaningful event (a failed work step, a startup warning) carries a non-default priority so `journalctl -p warning` filters to signal. The operator knows how to use --since, -f, and -o json to scope, follow, and machine-parse the log stream.
- **Senior:** You reason about structured logging: if the daemon emits key=value pairs (or JSON) to stdout, journald stores them as indexed fields you can query with `journalctl FIELD=value`. You describe what a 3 a.m. on-call query looks like: the exact journalctl invocation that surfaces the last error from this service since the previous successful run, and what information is missing from an unstructured log line that would require parsing.

### Sandbox directives and blast-radius containment

- **Junior:** The unit runs as root or as the service user with no sandbox directives. systemd-analyze security reports a high exposure score. NoNewPrivileges is absent — a setuid binary reachable from the service could escalate.
- **Mid:** NoNewPrivileges=true, ProtectSystem=strict, and PrivateTmp=true are set. ReadWritePaths is limited to the one directory the service genuinely needs. The service still starts and works after the sandbox is applied. systemd-analyze security shows a meaningfully improved score versus the baseline.
- **Senior:** You reason about the attacker's capability after a compromise: with NoNewPrivileges the process cannot escalate via a setuid binary; with ProtectSystem=strict it cannot write to system paths or drop a replacement binary; with PrivateTmp the /tmp attack surface (temp file races, shared secrets) is eliminated. You identify what the service still can do — write to its one ReadWritePaths directory and make outbound network calls — and name the next directives (RestrictAddressFamilies, IPAddressAllow) that would further reduce those capabilities.

## Senior stretch

- Run the daemon as a dedicated unprivileged user with DynamicUser=true, letting systemd allocate a throwaway UID at runtime and clean up its state directory automatically — then verify it can't read another service's files.
- Add a drop-in override (systemctl edit) instead of editing the unit directly, so your resource and hardening tweaks survive a package update that replaces the original unit file.
- Tighten the sandbox further with SystemCallFilter (e.g. @system-service) and CapabilityBoundingSet, then re-run systemd-analyze security and explain which directive bought which point of exposure reduction.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/managed-service-unit
