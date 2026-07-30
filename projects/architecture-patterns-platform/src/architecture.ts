/**
 * Grader for a platform architecture.
 *
 * You do not implement this file. Your work is `artifact/architecture.json`: the
 * bounded contexts, what talks to what, the ADRs, and the seams you left for change.
 *
 * The checks encode the failures that turn "microservices" into a distributed
 * monolith:
 *
 *  - **A shared database between contexts.** Two services that write the same tables
 *    are one service with a network in the middle and no schema owner.
 *  - **Synchronous coupling in both directions.** A ↔ B synchronous means neither can
 *    deploy or fail independently, which was the entire point of splitting them.
 *  - **A context with no owner.** Ownership is what makes a boundary hold; without it
 *    the boundary erodes at the first deadline.
 *  - **A pattern with no problem.** CQRS, event sourcing and a service mesh all cost
 *    something; a pattern chosen without a stated force is cargo cult.
 *  - **An ADR with no consequences.** The consequences section is where a document
 *    stops being a press release.
 */
export type Context = {
  id: string;
  name: string;
  /** The team or person accountable for it. */
  owner: string;
  /** Datastores this context owns exclusively. */
  ownsData: string[];
  /** The one sentence that says what belongs here and what does not. */
  responsibility: string;
};

export type Integration = {
  from: string;
  to: string;
  style: "sync" | "async" | "shared-db" | "batch";
  /** For sync: what happens when `to` is down. */
  failureBehaviour?: string;
  /** The contract that governs it. */
  contract?: string;
};

export type Pattern = {
  name: string;
  appliedTo: string[];
  /** The force that justifies the cost. */
  problem: string;
  cost: string;
};

export type Adr = {
  id: string;
  title: string;
  status: "proposed" | "accepted" | "superseded";
  context: string;
  decision: string;
  consequences: string;
  supersededBy?: string;
};

export type Architecture = {
  platform: string;
  contexts: Context[];
  integrations: Integration[];
  patterns: Pattern[];
  adrs: Adr[];
};

export type Finding = { id: string; severity: "error" | "warn"; message: string };

const isBlank = (s: string | undefined): boolean => (s ?? "").trim().length === 0;
const isFiller = (s: string | undefined): boolean => /^(tbd|todo|n\/?a|-+|\?+)$/i.test((s ?? "").trim());
const missing = (s: string | undefined): boolean => isBlank(s) || isFiller(s);
const thin = (s: string | undefined, min: number): boolean => missing(s) || (s ?? "").trim().length < min;

export function checkArchitecture(a: Architecture): Finding[] {
  const out: Finding[] = [];
  const err = (id: string, message: string) => out.push({ id, severity: "error", message });
  const warn = (id: string, message: string) => out.push({ id, severity: "warn", message });

  if (missing(a.platform)) err("platform", "The platform is not named");

  const contexts = a.contexts ?? [];
  const byId = new Map(contexts.map((c) => [c.id, c]));
  if (contexts.length < 3) err("contexts", `Only ${contexts.length} bounded context(s) — a platform this size has more seams than that`);

  const dataOwners = new Map<string, string[]>();
  for (const c of contexts) {
    const where = c.id || c.name || "(unnamed context)";
    if (missing(c.owner)) err("context-owner", `${where}: no owner — a boundary without ownership erodes at the first deadline`);
    if (thin(c.responsibility, 25)) {
      err("context-responsibility", `${where}: responsibility is missing or too vague to exclude anything`);
    }
    if ((c.ownsData ?? []).length === 0) warn("context-no-data", `${where}: owns no data — is it a context or a library?`);
    for (const store of c.ownsData ?? []) {
      dataOwners.set(store, [...(dataOwners.get(store) ?? []), c.id]);
    }
  }
  for (const [store, owners] of dataOwners) {
    if (owners.length > 1) {
      err("shared-store", `"${store}" is owned by ${owners.join(" and ")} — two writers of one schema is one service with a network in the middle`);
    }
  }

  const integrations = a.integrations ?? [];
  for (const i of integrations) {
    for (const end of [i.from, i.to]) {
      if (!byId.has(end)) err("integration-unknown", `Integration references unknown context "${end}"`);
    }
    if (i.style === "shared-db") {
      err("integration-shared-db", `${i.from} → ${i.to} integrates through a shared database — that is coupling with extra steps and no schema owner`);
    }
    if (i.style === "sync") {
      if (missing(i.failureBehaviour)) {
        err("integration-no-fallback", `${i.from} → ${i.to} is synchronous with no stated behaviour when ${i.to} is down`);
      }
      const reverse = integrations.find((j) => j.from === i.to && j.to === i.from && j.style === "sync");
      if (reverse) {
        err("integration-sync-cycle", `${i.from} ↔ ${i.to} are synchronously coupled both ways — neither can deploy or fail independently`);
      }
    }
    if (missing(i.contract)) warn("integration-no-contract", `${i.from} → ${i.to} has no named contract`);
  }

  // A context nothing integrates with is either isolated by design or forgotten.
  for (const c of contexts) {
    const touched = integrations.some((i) => i.from === c.id || i.to === c.id);
    if (!touched) warn("context-orphan", `${c.id} has no integrations — say why it stands alone`);
  }

  for (const p of a.patterns ?? []) {
    const where = p.name || "(unnamed pattern)";
    if (thin(p.problem, 25)) {
      err("pattern-no-problem", `${where}: no stated problem — CQRS, event sourcing and a mesh all cost something; a pattern with no force behind it is cargo cult`);
    }
    if (missing(p.cost)) err("pattern-no-cost", `${where}: no cost stated — every pattern buys one property by giving up another`);
    for (const target of p.appliedTo ?? []) {
      if (!byId.has(target)) err("pattern-unknown-target", `${where}: applied to unknown context "${target}"`);
    }
  }

  const adrs = a.adrs ?? [];
  if (adrs.length < 3) err("adrs", `Only ${adrs.length} ADR(s) — the decisions exist whether or not they are written down`);
  const adrIds = new Set(adrs.map((r) => r.id));
  for (const r of adrs) {
    const where = r.id || r.title || "(unnamed ADR)";
    if (thin(r.context, 25)) err("adr-context", `${where}: no context — an ADR without the forces is a press release`);
    if (missing(r.decision)) err("adr-decision", `${where}: no decision recorded`);
    if (thin(r.consequences, 25)) {
      err("adr-consequences", `${where}: no consequences — this is the section that makes an ADR worth writing`);
    }
    if (r.status === "superseded") {
      if (missing(r.supersededBy)) err("adr-superseded-dangling", `${where}: superseded by nothing — say which ADR replaced it`);
      // `missing` is not a type guard, so the optional field is coalesced here rather
      // than asserted — the empty string can never be a known ADR id.
      else if (!adrIds.has(r.supersededBy ?? "")) err("adr-superseded-unknown", `${where}: superseded by unknown ADR "${r.supersededBy}"`);
    }
  }

  return out;
}

export const errorsOf = (findings: Finding[]): Finding[] => findings.filter((f) => f.severity === "error");
