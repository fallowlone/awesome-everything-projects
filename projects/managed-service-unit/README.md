# A service systemd trusts — starter

This workbench grades **your unit file**, not your implementation of a library.

1. Put your unit in `artifact/app.service`.
2. Run the checks:

       bun test

`src/unit.ts` is the grader (a systemd parser plus the acceptance rules) — you do not
need to change it. What starts in `artifact/app.service` is the unit almost everyone
writes first: it starts, and nothing else. It runs as root, never restarts, has no
budget, and none of systemd's hardening is on.

Each failing check names an incident rather than a style preference:

- `Restart=no` (the default) means one crash ends the service until a human notices.
- No `MemoryMax`/`CPUQuota` means a leak or a runaway loop takes the whole host.
- No `User=` means root.
- `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem`, `ProtectHome` are off by default,
  and off is a decision you did not make on purpose.
- Writing to a logfile instead of journald throws away rotation and rate limiting.

The grader also knows systemd's quirks: last-one-wins for scalar directives,
accumulation for repeatable ones, and an empty assignment (`ReadWritePaths=`) that
RESETS a list — the usual way a hardening line gets silently undone.

Green suite = the unit is defensible. Then do the parts a file cannot prove on the
project page: install it, watch `systemctl status` and `journalctl -u`, trip the
memory cap on purpose, and verify graceful reload.
