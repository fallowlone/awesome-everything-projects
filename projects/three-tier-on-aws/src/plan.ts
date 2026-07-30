/**
 * Grader for a Terraform plan.
 *
 * You do not implement this file — it is the checker. Your work is
 * `artifact/plan.json`, produced from your own repo:
 *
 *     terraform plan -out=tfplan && terraform show -json tfplan > artifact/plan.json
 *
 * Grading the plan rather than the applied account is a deliberate trade. It cannot
 * prove the stack boots, but it CAN prove the properties that get people paged —
 * a database reachable from the internet, an admin-everything IAM policy, storage
 * without encryption — and it does so without credentials, spend, or a live account.
 * The parts a file cannot show are listed at the end of the README.
 */
export type PlanResource = {
  address: string;
  type: string;
  name: string;
  values: Record<string, any>;
};

export type Finding = { id: string; severity: "error" | "warn"; message: string };

/**
 * Flatten `terraform show -json` into the resources it will create.
 *
 * Both shapes are accepted: `planned_values.root_module` (with nested
 * `child_modules`, because anything real is behind modules) and the flat
 * `resource_changes` list.
 */
export function parsePlan(json: any): PlanResource[] {
  const out: PlanResource[] = [];

  const walkModule = (mod: any): void => {
    for (const r of mod?.resources ?? []) {
      out.push({ address: r.address ?? "", type: r.type ?? "", name: r.name ?? "", values: r.values ?? {} });
    }
    for (const child of mod?.child_modules ?? []) walkModule(child);
  };

  if (json?.planned_values?.root_module) walkModule(json.planned_values.root_module);

  if (out.length === 0) {
    for (const rc of json?.resource_changes ?? []) {
      // Ignore pure deletes: they describe what is going away, not the target state.
      const actions: string[] = rc?.change?.actions ?? [];
      if (actions.length === 1 && actions[0] === "delete") continue;
      out.push({
        address: rc.address ?? "",
        type: rc.type ?? "",
        name: rc.name ?? "",
        values: rc?.change?.after ?? {},
      });
    }
  }
  return out;
}

const byType = (resources: PlanResource[], type: string): PlanResource[] => resources.filter((r) => r.type === type);

/** Ingress rules on a security group, from either resource style Terraform allows. */
function ingressRules(resources: PlanResource[]): { address: string; cidrs: string[]; from: number; to: number }[] {
  const rules: { address: string; cidrs: string[]; from: number; to: number }[] = [];

  for (const sg of byType(resources, "aws_security_group")) {
    for (const rule of sg.values.ingress ?? []) {
      rules.push({
        address: sg.address,
        cidrs: [...(rule.cidr_blocks ?? []), ...(rule.ipv6_cidr_blocks ?? [])],
        from: Number(rule.from_port ?? 0),
        to: Number(rule.to_port ?? 0),
      });
    }
  }
  for (const rule of byType(resources, "aws_security_group_rule")) {
    if (rule.values.type !== "ingress") continue;
    rules.push({
      address: rule.address,
      cidrs: [...(rule.values.cidr_blocks ?? []), ...(rule.values.ipv6_cidr_blocks ?? [])],
      from: Number(rule.values.from_port ?? 0),
      to: Number(rule.values.to_port ?? 0),
    });
  }
  for (const rule of byType(resources, "aws_vpc_security_group_ingress_rule")) {
    rules.push({
      address: rule.address,
      cidrs: [rule.values.cidr_ipv4, rule.values.cidr_ipv6].filter(Boolean),
      from: Number(rule.values.from_port ?? 0),
      to: Number(rule.values.to_port ?? 0),
    });
  }
  return rules;
}

const OPEN_CIDRS = new Set(["0.0.0.0/0", "::/0"]);
const covers = (r: { from: number; to: number }, port: number): boolean => r.from <= port && port <= r.to;

/** IAM policy documents are JSON-in-a-string in a plan; both forms appear. */
function policyStatements(values: Record<string, any>): any[] {
  const raw = values.policy ?? values.assume_role_policy ?? values.policy_document;
  if (!raw) return [];
  const doc = typeof raw === "string" ? safeJson(raw) : raw;
  const stmt = doc?.Statement ?? doc?.statement;
  if (!stmt) return [];
  return Array.isArray(stmt) ? stmt : [stmt];
}

function safeJson(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}

const asArray = (v: any): any[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function checkPlan(resources: PlanResource[]): Finding[] {
  const findings: Finding[] = [];
  const err = (id: string, message: string) => findings.push({ id, severity: "error", message });
  const warn = (id: string, message: string) => findings.push({ id, severity: "warn", message });

  if (resources.length === 0) {
    err("empty-plan", "The plan contains no resources — did `terraform show -json` run against a real plan file?");
    return findings;
  }

  // ── network shape ──
  const subnets = byType(resources, "aws_subnet");
  if (subnets.length < 4) {
    err("subnets", `Found ${subnets.length} subnets — a two-AZ public/private layout needs at least 4`);
  }
  const azs = new Set(subnets.map((s) => s.values.availability_zone).filter(Boolean));
  if (azs.size > 0 && azs.size < 2) {
    err("multi-az", "All subnets are in one availability zone — a single AZ failure takes the stack down");
  }
  const privateSubnets = subnets.filter((s) => s.values.map_public_ip_on_launch === false);
  if (subnets.length > 0 && privateSubnets.length === 0) {
    err("private-subnets", "No subnet has map_public_ip_on_launch=false — nothing is actually private");
  }

  // ── the database must not be reachable from the internet ──
  for (const db of byType(resources, "aws_db_instance")) {
    if (db.values.publicly_accessible === true) {
      err("rds-public", `${db.address}: publicly_accessible=true — the database is on the internet`);
    }
    if (db.values.storage_encrypted !== true) {
      err("rds-unencrypted", `${db.address}: storage_encrypted is not true — encryption at rest is a one-line default you skipped`);
    }
    if (!db.values.backup_retention_period || Number(db.values.backup_retention_period) < 1) {
      err("rds-backups", `${db.address}: backup_retention_period is 0 — there is no restore point`);
    }
    if (db.values.skip_final_snapshot === true) {
      warn("rds-final-snapshot", `${db.address}: skip_final_snapshot=true — a destroy leaves nothing behind`);
    }
  }

  // ── open ingress ──
  const rules = ingressRules(resources);
  const SENSITIVE: [number, string][] = [
    [22, "SSH"],
    [3389, "RDP"],
    [5432, "Postgres"],
    [3306, "MySQL"],
    [6379, "Redis"],
    [27017, "MongoDB"],
  ];
  for (const rule of rules) {
    const open = rule.cidrs.some((c) => OPEN_CIDRS.has(c));
    if (!open) continue;
    for (const [port, label] of SENSITIVE) {
      if (covers(rule, port)) {
        err("open-ingress", `${rule.address}: ${label} (${port}) open to the world — "we'll restrict it later" is how later never comes`);
      }
    }
    if (rule.from === 0 && rule.to >= 65535) {
      err("open-all-ports", `${rule.address}: every port open to 0.0.0.0/0`);
    }
  }

  // ── object storage ──
  for (const bucket of byType(resources, "aws_s3_bucket")) {
    const address = bucket.address;
    const hasPublicBlock = byType(resources, "aws_s3_bucket_public_access_block").length > 0;
    if (!hasPublicBlock) {
      err("s3-public-access-block", `${address}: no aws_s3_bucket_public_access_block — bucket policy mistakes become public data`);
    }
    const hasEncryption =
      byType(resources, "aws_s3_bucket_server_side_encryption_configuration").length > 0 ||
      bucket.values.server_side_encryption_configuration !== undefined;
    if (!hasEncryption) warn("s3-encryption", `${address}: no server-side encryption configuration declared`);
  }

  // ── IAM: an admin-everything policy is the tutorial smell ──
  const policyResources = [
    ...byType(resources, "aws_iam_policy"),
    ...byType(resources, "aws_iam_role_policy"),
    ...byType(resources, "aws_iam_user_policy"),
  ];
  for (const p of policyResources) {
    for (const st of policyStatements(p.values)) {
      if ((st.Effect ?? st.effect) !== "Allow") continue;
      const actions = asArray(st.Action ?? st.action).map(String);
      const resourcesAttr = asArray(st.Resource ?? st.resource).map(String);
      if (actions.includes("*") && resourcesAttr.includes("*")) {
        err("iam-admin", `${p.address}: Allow Action:* on Resource:* — production runs on the narrowest permissions that still work`);
      } else if (actions.some((a) => a.endsWith(":*")) && resourcesAttr.includes("*")) {
        warn("iam-wide", `${p.address}: a whole-service wildcard (${actions.find((a) => a.endsWith(":*"))}) on Resource:*`);
      }
    }
  }

  // ── load balancer in front, compute behind ──
  const lbs = [...byType(resources, "aws_lb"), ...byType(resources, "aws_alb")];
  if (lbs.length === 0) err("load-balancer", "No aws_lb — the compute tier has no front door to hide behind");
  for (const lb of lbs) {
    if (lb.values.internal === true) continue;
    // An internet-facing LB is expected; it is the one thing that should be public.
  }
  const listeners = [...byType(resources, "aws_lb_listener"), ...byType(resources, "aws_alb_listener")];
  const httpsListener = listeners.some((l) => Number(l.values.port) === 443 || l.values.protocol === "HTTPS");
  if (listeners.length > 0 && !httpsListener) {
    err("tls", "No HTTPS listener — credentials would cross the internet in the clear");
  }

  // ── hardcoded secrets ──
  for (const r of resources) {
    for (const [key, value] of Object.entries(r.values)) {
      if (typeof value !== "string" || value.length < 8) continue;
      if (/^(password|master_password|secret|token|api_key)$/i.test(key) && !/^\$\{|^var\.|^data\./.test(value)) {
        err("hardcoded-secret", `${r.address}.${key} looks like a literal secret in the plan — use a secrets manager or a variable`);
      }
    }
  }

  return findings;
}

export const errorsOf = (findings: Finding[]): Finding[] => findings.filter((f) => f.severity === "error");
