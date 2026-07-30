# Grounded RAG service — starter

Implement `src/grounding.ts` until the acceptance suite passes:

    bun test

No model, no vector database, no network. What the suite tests is the part that makes
a RAG service trustworthy, and it is all deterministic:

- **Overlapping chunks.** A fact that straddles a boundary is otherwise split in half
  and retrieved by nobody. Settings that cannot advance (`overlap >= size`) are
  rejected rather than looping forever on a long document.
- **Budgeted context, best first.** Truncation must drop the least relevant material,
  and a chunk is included whole or not at all — half a sentence reads as authoritative.
- **Verified answers.** Three separate failures: a claim with no citation, a citation
  to a chunk that was never in context (the model invented the source), and a citation
  whose chunk does not contain the claim (a footnote as decoration). Stop-word overlap
  must not count as support.
- **Refusal.** With nothing above the relevance floor, "I don't know" is the correct
  answer. A service that always answers is one whose answers mean nothing.

Green suite = the grounding core is right. Then build the service on the project page:
the embedding store, hybrid retrieval and reranking, the prompt that carries citations
through, and an eval set that measures groundedness rather than vibes.
