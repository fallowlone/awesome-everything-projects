import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePlan, checkPlan, errorsOf, type PlanResource } from "../src/plan";

const artifact = () => JSON.parse(readFileSync(join(import.meta.dir, "..", "artifact", "plan.json"), "utf8"));

// ── Your work: the plan produced from your own repo ─────────────────────────────
test("YOUR PLAN: artifact/plan.json passes every acceptance check", () => {
  const findings = errorsOf(checkPlan(parsePlan(artifact())));
  const report = findings.map((f) => `  • [${f.id}] ${f.message}`).join("\n");
  expect(findings, `\nPlan not acceptable yet:\n${report}\n`).toEqual([]);
});

test("YOUR PLAN: the database is private, encrypted and backed up", () => {
  const dbs = parsePlan(artifact()).filter((r) => r.type === "aws_db_instance");
  expect(dbs.length, "expected an aws_db_instance in the plan").toBeGreaterThan(0);
  for (const db of dbs) {
    expect(db.values.publicly_accessible).not.toBe(true);
    expect(db.values.storage_encrypted).toBe(true);
    expect(Number(db.values.backup_retention_period)).toBeGreaterThan(0);
  }
});

test("YOUR PLAN: spans two availability zones with private subnets", () => {
  const subnets = parsePlan(artifact()).filter((r) => r.type === "aws_subnet");
  expect(subnets.length).toBeGreaterThanOrEqual(4);
  expect(new Set(subnets.map((s) => s.values.availability_zone)).size).toBeGreaterThanOrEqual(2);
  expect(subnets.some((s) => s.values.map_public_ip_on_launch === false)).toBe(true);
});

// ── The grader itself ──────────────────────────────────────────────────────────
const res = (type: string, name: string, values: Record<string, any>): PlanResource => ({
  address: `${type}.${name}`,
  type,
  name,
  values,
});

test("the parser reads planned_values, including nested modules", () => {
  const json = {
    planned_values: {
      root_module: {
        resources: [{ address: "aws_vpc.main", type: "aws_vpc", name: "main", values: { cidr_block: "10.0.0.0/16" } }],
        child_modules: [
          { resources: [{ address: "module.db.aws_db_instance.pg", type: "aws_db_instance", name: "pg", values: {} }] },
        ],
      },
    },
  };
  expect(parsePlan(json).map((r) => r.type)).toEqual(["aws_vpc", "aws_db_instance"]);
});

test("the parser falls back to resource_changes and ignores pure deletes", () => {
  const json = {
    resource_changes: [
      { address: "aws_s3_bucket.a", type: "aws_s3_bucket", name: "a", change: { actions: ["create"], after: {} } },
      { address: "aws_s3_bucket.old", type: "aws_s3_bucket", name: "old", change: { actions: ["delete"], after: null } },
    ],
  };
  expect(parsePlan(json).map((r) => r.name)).toEqual(["a"]);
});

test("an empty plan is a failure, not a pass", () => {
  expect(errorsOf(checkPlan([])).map((f) => f.id)).toContain("empty-plan");
});

test("the grader catches a publicly accessible database", () => {
  const ids = errorsOf(checkPlan([res("aws_db_instance", "pg", { publicly_accessible: true })])).map((f) => f.id);
  expect(ids).toContain("rds-public");
});

test("the grader catches an unencrypted, unbacked-up database", () => {
  const ids = errorsOf(
    checkPlan([res("aws_db_instance", "pg", { publicly_accessible: false, storage_encrypted: false, backup_retention_period: 0 })]),
  ).map((f) => f.id);
  expect(ids).toContain("rds-unencrypted");
  expect(ids).toContain("rds-backups");
});

test("the grader catches Postgres open to the world in every security-group style", () => {
  const inline = res("aws_security_group", "db", {
    ingress: [{ from_port: 5432, to_port: 5432, cidr_blocks: ["0.0.0.0/0"] }],
  });
  const standalone = res("aws_security_group_rule", "db", {
    type: "ingress",
    from_port: 5432,
    to_port: 5432,
    cidr_blocks: ["0.0.0.0/0"],
  });
  const modern = res("aws_vpc_security_group_ingress_rule", "db", { from_port: 5432, to_port: 5432, cidr_ipv4: "0.0.0.0/0" });
  for (const r of [inline, standalone, modern]) {
    expect(errorsOf(checkPlan([r])).map((f) => f.id)).toContain("open-ingress");
  }
});

test("the grader catches a port range that merely contains the sensitive port", () => {
  // 0-65535 does not mention 22, but it opens it.
  const wide = res("aws_security_group", "all", { ingress: [{ from_port: 0, to_port: 65535, cidr_blocks: ["0.0.0.0/0"] }] });
  const ids = errorsOf(checkPlan([wide])).map((f) => f.id);
  expect(ids).toContain("open-ingress");
  expect(ids).toContain("open-all-ports");
});

test("the grader accepts ingress restricted to a CIDR you control", () => {
  const scoped = res("aws_security_group", "db", {
    ingress: [{ from_port: 5432, to_port: 5432, cidr_blocks: ["10.0.0.0/16"] }],
  });
  expect(errorsOf(checkPlan([scoped])).map((f) => f.id)).not.toContain("open-ingress");
});

test("the grader catches an admin-everything IAM policy, JSON-in-a-string included", () => {
  const policy = res("aws_iam_policy", "admin", {
    policy: JSON.stringify({ Statement: [{ Effect: "Allow", Action: "*", Resource: "*" }] }),
  });
  expect(errorsOf(checkPlan([policy])).map((f) => f.id)).toContain("iam-admin");
});

test("the grader ignores a Deny statement with wildcards", () => {
  const policy = res("aws_iam_policy", "deny", {
    policy: JSON.stringify({ Statement: [{ Effect: "Deny", Action: "*", Resource: "*" }] }),
  });
  expect(errorsOf(checkPlan([policy])).map((f) => f.id)).not.toContain("iam-admin");
});

test("the grader catches a bucket with no public-access block", () => {
  expect(errorsOf(checkPlan([res("aws_s3_bucket", "assets", {})])).map((f) => f.id)).toContain("s3-public-access-block");
});

test("the grader catches a plaintext password in the plan", () => {
  const db = res("aws_db_instance", "pg", {
    publicly_accessible: false,
    storage_encrypted: true,
    backup_retention_period: 7,
    password: "hunter2-in-the-repo",
  });
  expect(errorsOf(checkPlan([db])).map((f) => f.id)).toContain("hardcoded-secret");
});

test("the grader catches an HTTP-only listener", () => {
  const ids = errorsOf(checkPlan([res("aws_lb", "front", {}), res("aws_lb_listener", "http", { port: 80, protocol: "HTTP" })])).map(
    (f) => f.id,
  );
  expect(ids).toContain("tls");
});
