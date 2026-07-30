import { test, expect } from "bun:test";
import { chunk, selectContext, verifyGrounding, supports, keyTerms, shouldRefuse, type Chunk } from "../src/grounding";

const doc = "A".repeat(30) + "B".repeat(30);

test("chunking covers the whole document", () => {
  const chunks = chunk("d1", doc, 20, 5);
  expect(chunks[0].start).toBe(0);
  expect(chunks[chunks.length - 1].end).toBe(doc.length);
  expect(chunks.map((c) => c.text).join("").length).toBeGreaterThanOrEqual(doc.length);
});

test("chunks overlap, so a fact on a boundary is retrievable", () => {
  const chunks = chunk("d1", "0123456789", 5, 2);
  expect(chunks[1].start).toBeLessThan(chunks[0].end);
});

test("chunking rejects settings that would never advance", () => {
  // overlap >= size means an infinite loop on any long document.
  expect(() => chunk("d", doc, 10, 10)).toThrow();
  expect(() => chunk("d", doc, 10, 12)).toThrow();
  expect(() => chunk("d", doc, 0, 0)).toThrow();
});

test("chunk ids are unique and carry the document id", () => {
  const chunks = chunk("report", doc, 20, 5);
  expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length);
  for (const c of chunks) expect(c.docId).toBe("report");
});

const c = (id: string, text: string): Chunk => ({ id, docId: "d", text, start: 0, end: text.length });

test("context selection keeps the highest-scoring chunks under the budget", () => {
  const retrieved = [
    { chunk: c("low", "x".repeat(40)), score: 0.2 },
    { chunk: c("high", "y".repeat(40)), score: 0.9 },
  ];
  // Budget fits one chunk: it must be the better one, not the first in the list.
  expect(selectContext(retrieved, 40).map((x) => x.id)).toEqual(["high"]);
});

test("context selection never emits a partial chunk", () => {
  const retrieved = [{ chunk: c("one", "z".repeat(100)), score: 1 }];
  expect(selectContext(retrieved, 50)).toEqual([]); // half a sentence reads as authoritative
});

test("context selection is deterministic when scores tie", () => {
  const retrieved = [
    { chunk: c("b", "bb"), score: 0.5 },
    { chunk: c("a", "aa"), score: 0.5 },
  ];
  expect(selectContext(retrieved, 100).map((x) => x.id)).toEqual(["a", "b"]);
});

test("an uncited claim is flagged", () => {
  const issues = verifyGrounding({ claims: [{ text: "Latency dropped by 40%", citations: [] }] }, []);
  expect(issues).toEqual([{ kind: "uncited", claim: "Latency dropped by 40%" }]);
});

test("a citation to a chunk that was never in context is flagged", () => {
  const issues = verifyGrounding(
    { claims: [{ text: "Latency dropped by 40%", citations: ["ghost#1"] }] },
    [c("real#1", "Latency dropped by 40% after the cache landed")],
  );
  expect(issues[0].kind).toBe("unknown-citation");
});

test("a citation whose chunk does not contain the claim is flagged", () => {
  // The footnote exists but supports nothing — the most convincing kind of wrong.
  const issues = verifyGrounding(
    { claims: [{ text: "Revenue grew 12% in Brazil", citations: ["c1"] }] },
    [c("c1", "The engineering team moved the build to a new CI provider in March")],
  );
  expect(issues[0].kind).toBe("unsupported");
});

test("a properly grounded answer produces no issues", () => {
  const issues = verifyGrounding(
    { claims: [{ text: "p99 latency dropped 40% after caching", citations: ["c1"] }] },
    [c("c1", "After caching landed, p99 latency dropped 40% across every region")],
  );
  expect(issues).toEqual([]);
});

test("stop-word overlap alone does not count as support", () => {
  expect(supports("the and of to in on for", "the revenue of the Brazil segment grew")).toBe(false);
});

test("keyTerms drops stop words and short tokens", () => {
  const terms = keyTerms("The p99 latency of the service is high");
  expect(terms).toContain("p99");
  expect(terms).toContain("latency");
  expect(terms).not.toContain("the");
  expect(terms).not.toContain("is");
});

test("an empty claim is never considered supported", () => {
  expect(supports("anything at all", "")).toBe(false);
});

test("the service refuses when nothing clears the relevance floor", () => {
  const weak = [{ chunk: c("c1", "unrelated"), score: 0.1 }];
  expect(shouldRefuse(weak, 0.5)).toBe(true);
  expect(shouldRefuse([...weak, { chunk: c("c2", "relevant"), score: 0.8 }], 0.5)).toBe(false);
  expect(shouldRefuse([], 0.5)).toBe(true);
});
