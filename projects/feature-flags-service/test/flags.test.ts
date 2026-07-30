import { test, expect } from "bun:test";
import { flagOn, inRollout, bucketOf, rulesetEtag, type Flag } from "../src/flags";

const flag = (over: Partial<Flag> = {}): Flag => ({
  key: "new-checkout",
  enabled: true,
  default: false,
  ...over,
});

test("a killed flag is off for everyone, whatever the rules say", () => {
  const f = flag({
    enabled: false,
    default: true,
    rules: [{ kind: "percentage", percent: 100, value: true }],
  });
  expect(flagOn(f, { id: "u1" })).toBe(false);
});

test("with no rules the default decides", () => {
  expect(flagOn(flag({ default: true }), { id: "u1" })).toBe(true);
  expect(flagOn(flag({ default: false }), { id: "u1" })).toBe(false);
});

test("an attribute rule matches any listed value and wins over the default", () => {
  const f = flag({
    default: false,
    rules: [{ kind: "attribute", attribute: "plan", anyOf: ["pro", "enterprise"], value: true }],
  });
  expect(flagOn(f, { id: "u1", plan: "pro" })).toBe(true);
  expect(flagOn(f, { id: "u1", plan: "enterprise" })).toBe(true);
  expect(flagOn(f, { id: "u1", plan: "free" })).toBe(false);
  expect(flagOn(f, { id: "u1" })).toBe(false); // attribute absent → no match
});

test("the first matching rule wins", () => {
  const f = flag({
    default: false,
    rules: [
      { kind: "attribute", attribute: "plan", anyOf: ["free"], value: false },
      { kind: "percentage", percent: 100, value: true },
    ],
  });
  expect(flagOn(f, { id: "u1", plan: "free" })).toBe(false); // earlier rule short-circuits
  expect(flagOn(f, { id: "u1", plan: "pro" })).toBe(true);
});

test("rollout is deterministic for the same user and flag", () => {
  const a = inRollout("user-42", "new-checkout", 50);
  for (let i = 0; i < 20; i++) expect(inRollout("user-42", "new-checkout", 50)).toBe(a);
});

test("0% includes nobody and 100% includes everybody", () => {
  for (const id of ["a", "b", "c", "user-42", "user-1000"]) {
    expect(inRollout(id, "f", 0)).toBe(false);
    expect(inRollout(id, "f", 100)).toBe(true);
  }
});

test("a 50% rollout lands within a couple of points of 50% over 10k users", () => {
  let on = 0;
  const n = 10_000;
  for (let i = 0; i < n; i++) if (inRollout(`user-${i}`, "new-checkout", 50)) on++;
  const pct = (on / n) * 100;
  expect(pct).toBeGreaterThan(47);
  expect(pct).toBeLessThan(53);
});

test("the same user is not bucketed identically across different flags", () => {
  // Hashing the id alone would put one unlucky slice of users in every rollout,
  // correlating experiments that are supposed to be independent.
  const buckets = new Set(["flag-a", "flag-b", "flag-c", "flag-d"].map((k) => bucketOf("user-42", k)));
  expect(buckets.size).toBeGreaterThan(1);
});

test("growing a rollout only adds users — nobody flips back off", () => {
  // Monotonicity: a user inside 10% must still be inside 20%. Without it, raising
  // the percentage takes the feature away from people who already had it.
  const ids = Array.from({ length: 500 }, (_, i) => `user-${i}`);
  const at10 = new Set(ids.filter((id) => inRollout(id, "f", 10)));
  const at20 = ids.filter((id) => inRollout(id, "f", 20));
  for (const id of at10) expect(at20).toContain(id);
});

test("the ETag is stable for the same ruleset and changes when a rule changes", () => {
  const a: Flag[] = [flag({ key: "a" }), flag({ key: "b", default: true })];
  const reordered: Flag[] = [flag({ key: "b", default: true }), flag({ key: "a" })];
  expect(rulesetEtag(a)).toBe(rulesetEtag(a));
  expect(rulesetEtag(a)).toBe(rulesetEtag(reordered)); // order is not content
  expect(rulesetEtag(a)).not.toBe(rulesetEtag([flag({ key: "a", default: true }), flag({ key: "b", default: true })]));
});
