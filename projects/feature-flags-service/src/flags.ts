// TODO(you): the flag evaluation core.
//
// The acceptance suite checks the properties that make a flag service trustworthy
// rather than merely working: a kill switch that always wins, first-match rule
// order, deterministic bucketing that is stable across processes, buckets that
// differ per flag, and monotonic rollouts (raising the percentage must never take
// the feature away from someone who already had it).
import { createHash } from "node:crypto";

export type Rule =
  | { kind: "attribute"; attribute: string; anyOf: (string | number | boolean)[]; value: boolean }
  | { kind: "percentage"; percent: number; value: boolean };

export type Flag = {
  key: string;
  enabled: boolean;
  /** Evaluated in order; the first match wins. */
  rules?: Rule[];
  default: boolean;
};

export type User = { id: string; [attr: string]: unknown };

/** Stable bucket in 0..9999. Must depend on the flag key as well as the user. */
export function bucketOf(userId: string, flagKey: string): number {
  void userId; void flagKey; void createHash;
  return 0; // TODO
}

export function inRollout(userId: string, flagKey: string, percent: number): boolean {
  void userId; void flagKey; void percent;
  return false; // TODO
}

export function flagOn(flag: Flag, user: User): boolean {
  void flag; void user;
  return false; // TODO
}

/** Content-addressed ETag: same ruleset ⇒ same tag, regardless of array order. */
export function rulesetEtag(flags: Flag[]): string {
  void flags;
  return ""; // TODO
}
