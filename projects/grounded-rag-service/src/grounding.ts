// TODO(you): the retrieval and grounding core.
//
// The suite drives the parts that decide whether a RAG service can be trusted:
//   - chunks OVERLAP, so a fact on a boundary is still retrievable, and settings that
//     would never advance (overlap >= size) are rejected instead of looping forever;
//   - context is assembled highest-score-first under a budget, and a chunk is either
//     included whole or not at all — half a sentence reads as authoritative and is the
//     cheapest way to invent a fact;
//   - an answer is VERIFIED against the context it was given: a claim with no
//     citation, a citation to a chunk that was never in context, and a citation whose
//     chunk does not contain the claim are three distinct failures;
//   - stop-word overlap must not count as support;
//   - with nothing above the relevance floor, the service refuses rather than guesses.
export type Chunk = { id: string; docId: string; text: string; start: number; end: number };

export function chunk(docId: string, text: string, size: number, overlap: number): Chunk[] {
  void docId; void text; void size; void overlap;
  throw new Error("TODO");
}

export type Retrieved = { chunk: Chunk; score: number };

export function selectContext(retrieved: Retrieved[], budget: number): Chunk[] {
  void retrieved; void budget;
  return []; // TODO
}

export type Claim = { text: string; citations: string[] };
export type Answer = { claims: Claim[]; refused?: boolean };

export type GroundingIssue =
  | { kind: "uncited"; claim: string }
  | { kind: "unknown-citation"; claim: string; citation: string }
  | { kind: "unsupported"; claim: string; citation: string };

export function verifyGrounding(answer: Answer, context: Chunk[]): GroundingIssue[] {
  void answer; void context;
  return []; // TODO
}

/** Content words only — stop-word overlap must not fake support. */
export function keyTerms(text: string): string[] {
  void text;
  return []; // TODO
}

export function supports(chunkText: string, claim: string, threshold = 0.6): boolean {
  void chunkText; void claim; void threshold;
  return false; // TODO
}

export function shouldRefuse(retrieved: Retrieved[], minScore: number): boolean {
  void retrieved; void minScore;
  return false; // TODO
}
