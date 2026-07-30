# Homelab Secure Stack

Stand up a self-hosted media and home-server stack on nas01.example where five services share a single VPN container's network namespace — the kill-switch drops all traffic the moment the tunnel dies, a split-tunnel whitelist carves out LAN access, and three layered access rings (localhost / LAN 10.0.0.0/24 / mesh-VPN 100.64.0.30) keep the right doors open to the right people. Harden the host with SSH key-only auth, fail2ban, and unattended security upgrades; write a rotating, age-encrypted off-site backup; and walk away knowing the stack stays dark if anything breaks.

**Difficulty:** advanced · **Est. days:** 5 · **Stack:** Docker Compose, WireGuard (commercial VPN), ufw / nftables, systemd, age, fail2ban, unattended-upgrades, cron · **Tracks:** docker, networking, security-defensive, cli

## Deliverable

A running Docker Compose stack on nas01.example where all five services route through a VPN container with kill-switch and split-tunnel; a ufw host firewall that survives reboots without locking you out; SSH hardened to key-only with no root login and fail2ban banning brute-force attempts; unattended-upgrades configured for automatic security patches; and a cron-driven backup script that rotates old archives, encrypts each with age before off-site upload, and logs every run.

## Why this project

This is the homelab capstone. You will tie together container networking, host security, and operational scripting into one production-grade home server. The central pattern is VPN-gated sidecar networking: a single WireGuard container holds the VPN tunnel and the kill-switch, and every other service in the compose file joins its network namespace via `network_mode: "service:vpn"` — so if the tunnel drops, no service can reach the internet, period. You layer three access rings on top: services bind on localhost only for same-host tooling, the LAN ring (10.0.0.0/24) is carved out via split-tunnel so local clients reach the stack without going through the VPN, and the mesh-VPN ring (100.64.0.30) gives you remote access without forwarding any port to the public internet. The host firewall (ufw) enforces the same rings at the OS level — critically, you allow SSH on port 22 before you run `ufw enable`, because the order matters and getting it wrong locks you out. SSH itself gets hardened: password auth off, root login off, fail2ban on with aggressive jail timers. Unattended-upgrades handles the patch surface automatically. Finally you write and test a backup script: tar the data directories, rotate to keep the last N archives, encrypt each tarball with age before uploading off-site, and cron it nightly with a log you can check in the morning.

## Skills

- docker-compose
- vpn-kill-switch
- split-tunnel
- network-namespace-sharing
- ufw
- ssh-hardening
- fail2ban
- unattended-upgrades
- backup-encryption
- age-encryption
- cron-automation

## Milestones

### 1. Compose the VPN-gated stack

Write a Docker Compose file where a WireGuard VPN container is the network gateway for all other services. Each sidecar joins the VPN container's network namespace via `network_mode: "service:vpn"`, so they share one network interface and one routing table — the WireGuard container's. Add a healthcheck to the VPN service that pings the VPN provider's DNS or a known IP over the tunnel; make every dependent service `depends_on` the VPN with `condition: service_healthy`. Verify that a curl from inside any sidecar goes out through the VPN interface (check the exit IP), and that stopping the VPN container cuts network access for all sidecars immediately.

**Definition of done:**

- All five services declare `network_mode: "service:vpn"` and the VPN service has a working healthcheck; `docker compose ps` shows all services healthy.
- A `curl ifconfig.me` from inside any sidecar returns the VPN exit IP, not the host's public IP.
- Stopping the VPN container (`docker compose stop vpn`) causes all sidecar services to lose internet connectivity within seconds.

### 2. Lock the network: kill-switch, split-tunnel, and ufw rings

Add a kill-switch to the WireGuard container so that if the tunnel goes down, the container cannot route traffic anywhere — implement this with iptables rules inside the container (or PostDown/PreUp hooks in the WireGuard config) that drop all forwarded traffic when the wg0 interface is absent. Carve out a split-tunnel exception for 10.0.0.0/24 so LAN clients can reach the services directly without going through the VPN. Configure ufw on the host to enforce three access rings: localhost (127.0.0.1) for same-host tooling, LAN (10.0.0.0/24) for local clients, and mesh-VPN peer (100.64.0.30) for remote access. Be aware that Docker bypasses ufw's FORWARD rules by default — use `DOCKER-USER` chain entries or `--iptables=false` plus manual rules to close that gap.

**Definition of done:**

- Bringing down the wg0 interface inside the VPN container (`ip link set wg0 down`) causes all outbound traffic from sidecars to drop immediately; LAN traffic to 10.0.0.0/24 continues to flow.
- A port scan from a host outside all three rings (not localhost, not 10.0.0.0/24, not 100.64.0.30) returns all ports filtered; the mesh-VPN peer at 100.64.0.30 can reach the services.

### 3. Harden the host: SSH, fail2ban, and automatic patches

Lock down the host nas01.example so that SSH is the only remote entry point and it is hardened against brute force and credential theft. Disable password authentication and root login in `/etc/ssh/sshd_config`; install the operator user's public key; set `MaxAuthTries 3` and `LoginGraceTime 30`. Install fail2ban and configure a jail that bans an IP after 5 failed SSH attempts in 5 minutes for 1 hour. Enable unattended-upgrades for automatic security patches — restrict it to the security pocket only so it never auto-updates packages that might break services. Verify that a password-based SSH attempt from a test machine is refused, and that 6 rapid failed attempts trigger a ban visible in `fail2ban-client status sshd`.

**Definition of done:**

- `ssh operator@nas01.example` works with the private key; `ssh -o PubkeyAuthentication=no operator@nas01.example` is refused with "Permission denied (publickey)".
- After 6 rapid failed login attempts from a test IP, `fail2ban-client status sshd` lists that IP in the banned set.
- `unattended-upgrade --dry-run` reports that security updates are eligible and non-security packages are skipped.

### 4. Remote access without a public surface

Give yourself remote access to all five services from outside the LAN without opening a single port on the router. Use a mesh-VPN or overlay tunnel (such as Tailscale, Headscale, or a self-hosted WireGuard mesh) so that your remote device receives the address 100.64.0.30 and can reach every service directly via that address. The host nas01.example should have no public TCP or UDP ports forwarded from the router — verify this with an external port scan. Access controls should be enforced at the mesh layer: only enrolled devices with valid keys can join the mesh; all others are silently dropped.

**Definition of done:**

- An external port scan of nas01.example's public IP shows no open ports (all filtered); from the remote device at 100.64.0.30, all five services are reachable by their mesh-IP addresses.
- A device with an invalid or absent mesh key cannot reach any service (connection refused or timed out at the mesh layer).

### 5. Rotating, age-encrypted off-site backup

Write a shell script that backs up all service data directories on nas01.example, keeps only the last N archives on disk (delete the oldest when count exceeds N), encrypts each tarball with `age` before uploading off-site, and writes a timestamped log entry for every run — success or failure. The age public key is the only secret needed at runtime; the private key lives off-site. Wire the script to a cron job that runs nightly; test it by running it manually twice and confirming that only N archives remain and that each archive decrypts cleanly with the matching private key.

**Definition of done:**

- Running the backup script twice leaves exactly N archives in the backup directory; the oldest has been pruned.
- Each archive is an age-encrypted file; `age --decrypt -i private-key.txt backup.tar.gz.age` extracts the original tarball without errors.
- The log file contains a timestamped entry for each run showing success or the error reason, and the cron job is listed in `crontab -l`.

## Rubric

### VPN kill-switch and network namespace isolation

- **Junior:** Services run behind a VPN container and outbound IP is the VPN exit. Kill-switch exists in concept (noted in config) but is not tested — stopping the VPN container may still allow sidecar services to reach the internet via the host's default route.
- **Mid:** All five services share the VPN container's network namespace via `network_mode: "service:vpn"`. Bringing down the VPN or wg0 interface demonstrably cuts outbound internet for all sidecars within seconds. The split-tunnel exception for 10.0.0.0/24 is in place so LAN traffic flows without going through the VPN.
- **Senior:** You explain why shared network namespace is stronger than a custom Docker network with NAT rules: services inherit the routing table and iptables of the VPN container and cannot reach the internet through any other interface. You identify the failure mode that a poorly-ordered iptables rule or a Docker --iptables=true interaction could open an escape path, and you've tested that the DOCKER-USER chain or equivalent closes it.

### Host hardening and access ring enforcement

- **Junior:** SSH password auth is disabled and a key is installed. ufw is enabled. Fail2ban is running. The three access rings (localhost, LAN, mesh-VPN) are conceptually described but not all enforced at the firewall level — the LAN ring may be open to 0.0.0.0/24 rather than the specific /24.
- **Mid:** ufw allows SSH, LAN (10.0.0.0/24), and the mesh-VPN peer (100.64.0.30) and defaults to deny all other inbound. Fail2ban bans an IP after 5 failed SSH attempts, verified by triggering the ban and checking `fail2ban-client status sshd`. ufw rules survive a reboot. SSH allows ssh on port 22 before `ufw enable` is run — the order is documented.
- **Senior:** You reason about the blast radius if the mesh-VPN peer address (100.64.0.30) were compromised: it has access to all five services, which may be more than necessary. You propose how ACL rules at the mesh layer (per-service ports, not blanket mesh access) would reduce that blast radius. You identify that Docker bypasses ufw FORWARD rules by default and document the specific chain (DOCKER-USER) that closes the gap.

### Remote access without public exposure

- **Junior:** Remote access works — services are reachable from outside the LAN. A port is forwarded from the router to achieve this, exposing at least one service port to the public internet.
- **Mid:** Remote access is achieved via a mesh-VPN or overlay tunnel (Tailscale, Headscale, WireGuard mesh). An external port scan of the host's public IP shows all ports filtered. Only enrolled devices with valid keys can reach the services through the mesh.
- **Senior:** You explain why zero open ports is a stronger posture than port-forwarding with fail2ban: an attacker who doesn't know the mesh exists has no TCP surface to probe. You describe the failure scenario where the mesh control plane (e.g. Tailscale DERP relay) is down: does the stack still work for LAN clients? Does remote access degrade gracefully or fail hard? And you document the recovery path.

### Backup encryption, rotation, and recoverability

- **Junior:** A backup script runs and produces archives on disk. Archives are not encrypted before upload; or the private key and the encrypted archive are stored in the same place. Rotation logic is absent — old archives accumulate.
- **Mid:** Each archive is encrypted with age before upload; the private key lives off-site separately. Rotation keeps exactly N archives. A cron job runs the script nightly and a log entry confirms each run. Decryption of a real archive from the backup store is tested and succeeds.
- **Senior:** You reason about the recovery time objective: given that the archive is off-site, how long does full restore take, and what data could be lost in the worst case (the window since the last successful backup)? You verify the script handles a failed upload gracefully (logs the error, does not delete local archives). You identify that the age public key is a non-secret but the age private key is the single point of decryption failure, and you document how you would recover if it were lost.

## Senior stretch

- Deploy Suricata or Zeek as a passive IDS on the LAN bridge interface and wire its alerts to a local log aggregator; tune the rule set to eliminate false positives for normal Docker bridge traffic.
- Add Prometheus + Grafana to the stack (also behind the VPN gateway) and build dashboards for VPN tunnel uptime, ufw drop rates, fail2ban ban events, and backup job success/failure.
- Store the age private key and SSH private key in a self-hosted secrets manager (HashiCorp Vault or similar) and modify the backup script to retrieve the age recipient key at runtime via the Vault API rather than reading a file from disk.
- Write a CI pipeline (GitHub Actions or Gitea Actions) that spins up the compose stack in a Docker-in-Docker runner, runs a kill-switch test (brings wg0 down and asserts no outbound traffic), and blocks merge if the test fails.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/homelab-secure-stack
