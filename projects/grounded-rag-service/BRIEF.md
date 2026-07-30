# Grounded RAG Service

A RAG demo that answers from a corpus is easy; a RAG service you'd trust in front of users is not. The hard part isn't retrieval, it's grounding: making the model say only what the retrieved text supports, attaching citations the reader can check, and proving with an eval set that the answers don't drift into confident fiction. You'll build the whole loop — chunk, embed, store, retrieve top-k, ground, cite, score — and feel exactly where it leaks.

**Difficulty:** advanced · **Est. days:** 9 · **Stack:** node or python, an embedding model (OpenAI text-embedding-3, or a local sentence-transformer), a vector store (pgvector, sqlite-vss, or a managed index), an LLM with structured output / tool-calling, a small eval runner (custom or promptfoo/ragas-style) · **Tracks:** ai-llm, backend, databases, observability

## Deliverable

A running service that ingests a corpus into a vector store and exposes a /query endpoint returning a grounded answer with inline citations to the source chunks, plus an eval harness that scores faithfulness over a fixed question set and fails the build when the score drops below a threshold.

## Why this project

RAG is the default way teams put an LLM on top of their own knowledge, and the demo version is deceptively easy — which is exactly why so many shipped RAG features quietly hallucinate. The senior skill isn't wiring an embedding call to a vector store; it's everything downstream of retrieval: enforcing that the answer is grounded, making citations verifiable, and holding a faithfulness number that tells you the truth when you change something. Build this once, watch the model cite a chunk it doesn't actually support, then watch your guardrail catch it — and you'll never again confuse 'the demo answered correctly' with 'this service is trustworthy'.

## Skills

- chunking a corpus with overlap and stable ids
- embedding text and storing vectors with metadata
- top-k similarity retrieval and reranking
- grounding an LLM answer with enforced citations
- building an eval set that scores faithfulness
- writing a guardrail that blocks unsupported claims

## Milestones

### 1. Chunk and embed the corpus

Retrieval quality is decided here, before a single query runs. Take your corpus and split it into chunks that are big enough to carry a complete thought but small enough that a top-k of a few covers a question without burying the model in noise. Naive fixed-size splits cut sentences in half and orphan headings, so respect structure — paragraphs, headings, list items — and add a little overlap so a fact that straddles a boundary survives in at least one chunk. Give every chunk a stable id and keep its source document, position, and any heading path as metadata; you'll need that exact provenance later to cite. Then embed each chunk and confirm the vectors come back with the dimension your store expects. Don't skip eyeballing a few chunks by hand — if they read like garbage to you, they'll retrieve like garbage too.

**Definition of done:**

- The corpus is split into chunks with stable ids, source metadata, and a defined overlap, and a sample of chunks reads as coherent units.
- Every chunk has an embedding vector of the expected dimension, produced reproducibly from the same input.

### 2. Store vectors and retrieve top-k

Now make the vectors queryable. Load each embedding plus its metadata into a vector store, then take an incoming question, embed it the same way, and pull the top-k nearest chunks by cosine or inner-product similarity. The first trap is a metric or normalization mismatch between how you stored vectors and how you query them — distances come back plausible-looking but rank the wrong chunks first, and you won't notice until grounding goes sideways. The second trap is treating top-k as a magic number: too small and the answer's supporting fact is just out of reach, too large and you pad the context with near-misses that tempt the model to wander. Probe it: ask a handful of questions you know the answers to, print the retrieved chunks with their scores, and confirm the right passage actually shows up near the top. This retrieval layer is the foundation every later milestone stands on.

**Definition of done:**

- All chunk vectors and metadata are stored, and a query returns its top-k nearest chunks with similarity scores.
- For a set of known questions, the chunk that actually contains the answer appears within the returned top-k.

### 3. Ground the answer with citations

This is the milestone that turns a search box into a RAG service. Feed the retrieved chunks to the model with a prompt that does two strict things: answer only from the provided context, and cite the chunk id behind each claim. When the context doesn't contain the answer, the correct output is 'I don't know from these sources' — not a confident guess stitched from the model's pretraining. Make citations a contract, not a suggestion: parse the model's output, check that every cited id was actually in the retrieved set, and reject or repair an answer that cites a chunk you never sent. Structured output or tool-calling helps here because free-form 'Sources: ...' text drifts and is painful to verify. Read a few answers against their cited chunks yourself — the moment you catch the model citing chunk 7 for a sentence chunk 7 doesn't support, you understand why grounding has to be enforced, not trusted.

**Definition of done:**

- The /query endpoint returns an answer whose every claim carries a citation to a chunk id from the retrieved set.
- When retrieval yields nothing relevant, the service abstains instead of fabricating an answer.

### 4. Score faithfulness with an eval set

Until you can measure it, 'the answers look good' is a vibe, not a guarantee — and vibes regress silently the next time you tweak a prompt or swap an embedding model. Build a fixed eval set: a list of questions over your corpus, each paired with the ground-truth supporting passage and an expected gist. Then score each answer for faithfulness — does every claim actually trace to the cited chunk? — alongside cheaper signals like retrieval recall (was the right chunk retrieved at all?) and abstention correctness (did it say 'I don't know' exactly when it should?). You can grade with an LLM judge given the answer and its sources, but pin the judge prompt and spot-check its verdicts, because an unreliable grader just launders the problem. Wire the harness so it runs on demand and emits a single faithfulness number; that number is what lets you change anything in the pipeline and see immediately whether you made it better or quietly worse.

**Definition of done:**

- An eval set of questions with ground-truth sources runs end-to-end and produces a single faithfulness score plus retrieval recall.
- Changing a pipeline knob (chunk size, top-k, prompt) visibly moves the score, and a regression below a chosen threshold is detectable.

### 5. Add hybrid retrieval

Pure vector search has a blind spot: it's strong on meaning but weak on exact tokens — a part number, an error code, a rare proper noun the embedding smears into nearby concepts. Add a lexical retriever (BM25 or your store's full-text search) and fuse its results with the vector hits, for example by reciprocal rank fusion, so a chunk that both means the right thing and contains the exact term rises to the top. Optionally rerank the fused candidates with a cross-encoder for a final precision pass. The discipline here is to prove the hybrid actually helps: re-run the eval set from the previous milestone and show retrieval recall and faithfulness move up, not just sideways. If they don't, you've added latency and complexity for nothing — say so honestly rather than keeping a heavier pipeline because it sounds more sophisticated.

**Definition of done:**

- Retrieval fuses lexical and vector results into a single ranked list returned to the grounding step.
- The eval set shows a measurable improvement (or an honestly reported non-improvement) versus vector-only retrieval.

### 6. Guard against unsupported claims and observe

The eval set catches regressions in batch; a guardrail catches them on the live request before a bad answer reaches a user. Add a verification pass that, given the drafted answer and its cited chunks, checks each claim is actually entailed by what was retrieved — a second-model 'does the source support this?' check, or a stricter parse that drops any sentence whose citation doesn't hold up. When a claim fails, the service must degrade safely: trim the unsupported sentence, lower confidence, or abstain — never ship the fabrication. Then make all of this observable, because a grounded service that fails silently is just a confident liar with extra steps: log per request the retrieved chunk ids and scores, which claims passed or were dropped, whether the guardrail fired, and token cost, so when someone reports a wrong answer you can replay exactly what was retrieved and why the model said what it said. Treat the guardrail trip-rate as a production signal you watch, not a checkbox you set once.

**Definition of done:**

- An answer whose claim isn't supported by its cited chunk is trimmed, flagged, or refused before being returned.
- Each request logs the retrieved chunk ids, guardrail outcome, and token cost in a way that lets you replay a reported failure.

## Rubric

### Chunking strategy and retrieval quality

- **Junior:** Chunks are fixed-size splits that cut mid-sentence; metadata (source doc, position) is not stored, making provenance impossible to trace.
- **Mid:** Chunks respect structural boundaries (paragraphs, headings) with a defined overlap; each chunk carries a stable id, source document, and position; for a set of known questions the correct chunk appears in the top-k.
- **Senior:** Chunk size and overlap are validated against the eval set — not guessed. Hybrid retrieval (BM25 + vector, fused by reciprocal rank fusion) is added and the eval set proves it improves recall for exact-token queries (part numbers, error codes) vs vector-only, or the lack of improvement is honestly reported with the reason.

### Grounding enforcement and citation contract

- **Junior:** The model is asked to answer from context but citations are optional or free-form text that is not verified; the model generates confident answers even when the context does not contain the answer.
- **Mid:** The prompt enforces structured citations (chunk id per claim via structured output or tool-calling); every cited id is verified against the retrieved set; when context is empty or off-topic the service returns an explicit abstention, not a fabrication.
- **Senior:** A post-retrieval guardrail pass checks each claim against its cited chunk (entailment check or strict parse), trims or flags unsupported sentences before they reach the user, and the guardrail trip-rate is logged per request as a production signal — not wired once and never looked at again.

### Faithfulness eval set and regression detection

- **Junior:** Quality is assessed manually by reading a few answers; there is no quantitative measure and no way to tell if a prompt change made things better or worse.
- **Mid:** A fixed eval set of questions with ground-truth supporting passages runs end-to-end and produces a faithfulness score and retrieval recall; changing chunk size or top-k visibly moves both numbers.
- **Senior:** The harness is a CI gate: it runs on every pipeline change and fails below a stated threshold. The LLM judge prompt is pinned and spot-checked against human verdicts to verify it is not itself hallucinating quality. You can state the faithfulness baseline, the threshold, and the knob whose change caused the largest regression during development.

### Observability and stale-context guards

- **Junior:** Failures are visible only in error logs; there is no per-request record of what was retrieved or whether the guardrail fired, making a reported wrong answer unreproducible.
- **Mid:** Each request logs the retrieved chunk ids and scores, guardrail outcome, and token cost; a reported wrong answer can be reproduced by replaying the logged retrieval context.
- **Senior:** Corpus updates re-embed only changed documents and invalidate old vectors atomically (a stale chunk with the same id must not persist after a document edit); the eval set is re-run after each corpus update to confirm no old-context hallucination slipped through. The guardrail trip-rate chart is part of the dashboard, not an afterthought.

## Senior stretch

- Add a corpus-refresh path that re-chunks and re-embeds only changed documents and invalidates their old vectors, so the index stays correct without a full rebuild — and prove with the eval set that stale chunks don't leak into answers.
- Turn the eval harness into a CI gate: run it on every change to the pipeline and fail the build when faithfulness or retrieval recall drops below the agreed threshold, so a 'small prompt tweak' can never silently degrade grounding.
- Stress the guardrail adversarially: craft questions whose answer isn't in the corpus and confirm the service abstains rather than confabulating, and measure how much the verification pass costs in latency and tokens versus the bad answers it prevents.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/grounded-rag-service
