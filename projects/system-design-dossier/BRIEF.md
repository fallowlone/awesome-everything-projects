# System Design Dossier

Pick one large system — a URL shortener that has to serve billions of redirects — and write the design document a staff engineer would defend in a review. No running code: the deliverable is rigorous prose, numbers, and diagrams. You move from a vague 'make short links' ask to scoped requirements, a back-of-envelope capacity model, a concrete data model and API, the one bottleneck that actually breaks under load, and an honest map of what you traded away to fix it.

**Difficulty:** advanced · **Est. days:** 8 · **Stack:** Excalidraw or draw.io (diagrams), Markdown or Google Docs (dossier), a spreadsheet for the capacity model · **Tracks:** system-design-cases, system-design

## Deliverable

A written design dossier (8–15 pages) for a single chosen system: scoped functional and non-functional requirements, a back-of-envelope capacity model with stated assumptions, a data model and API surface, an identified primary bottleneck with its fix, an explicit tradeoff ledger, and a failure-mode + scaling section — backed by diagrams (HLD, data flow, and one deep-dive).

## Why this project

System design interviews and real architecture reviews reward the same thing: a defensible argument, not a memorized diagram. This dossier forces the whole chain in writing — scope, numbers, model, API, the bottleneck, the failures, and the tradeoffs — so you can't hide a weak link behind a confident sketch. The discipline that matters is honesty: state your assumptions so they can be challenged, name what you gave up, and admit where the design ends. A senior engineer is the one who can say 'here is what breaks first and here is what I traded to push that further', and mean it. Do the arithmetic out loud, draw the three diagrams, and write the tradeoffs down — that is the artifact that separates an architect from someone who can only recite patterns.

## Skills

- scoping functional vs non-functional requirements
- back-of-envelope capacity estimation
- choosing a data model and storage engine for an access pattern
- designing a read- or write-optimized API
- locating and removing the real bottleneck
- reasoning about failure modes and graceful degradation
- writing a defensible tradeoff argument

## Milestones

### 1. Scope it before you size it

Most failed designs fail here: the candidate starts drawing boxes before deciding what the system actually owes its users. Pick your system and write down what is in scope and — just as important — what is explicitly out. Separate functional requirements ('create a short link', 'resolve a short link to its target', 'expire links') from the non-functional ones that decide the whole shape of the design: target QPS, the read:write ratio, p99 latency budget for a redirect, durability, and how stale a result is allowed to be. For a URL shortener the killer fact is that reads dwarf writes by orders of magnitude — name that ratio explicitly, because every later decision leans on it. Don't hand-wave 'it should be fast and scalable'; turn each adjective into a number you'll be held to.

**Definition of done:**

- The dossier lists functional and non-functional requirements separately, with at least target QPS, read:write ratio, and a p99 latency budget named as concrete numbers.
- An explicit 'out of scope' list states at least two things the design deliberately does not solve (e.g. custom vanity domains, analytics dashboards).

### 2. Do the arithmetic out loud

Now turn the requirements into numbers that constrain the architecture. Estimate writes per day and reads per day from your stated ratio, convert to average and peak QPS, then derive the things that decide cost: how many bytes one record is, how many records accumulate in five years, total storage, and the cache working set that would absorb the hot tail of reads. For the short-code itself, do the key-space math — how many characters of a base-62 code you need so you don't run out of unique links — because that single calculation drives your ID-generation strategy. State every assumption (an average URL is ~100 bytes, a year is ~31.5M seconds) so a reviewer can challenge the inputs, not just the output. The goal isn't a precise forecast; it's an order-of-magnitude model that tells you whether one box or a thousand boxes is the right starting picture.

**Definition of done:**

- The dossier derives peak QPS, five-year storage, and cache working-set size from stated per-record byte sizes and explicit assumptions, each step shown.
- The short-code key-space calculation shows how many base-62 characters are needed to cover the projected number of links with headroom.

### 3. Pick the data model the access pattern demands

The capacity model already told you the shape of the work: a tiny record, an overwhelming read-by-key pattern, and almost no relational joins. Let that drive the data model, not habit. Define the record (short code, long URL, owner, created-at, optional expiry) and decide the primary key, then argue the storage choice on its merits — a key-value store or a single indexed table reads by primary key in O(1)-ish and shards cleanly on the code, whereas a rich relational schema buys you joins you'll never run. Design the API to match: a write path that mints a code and a read path that is a single point lookup returning a redirect. Be deliberate about the redirect itself — 301 is cacheable forever and cheap but blinds you to click counts, 302 keeps every hit coming back to you; that choice is a real product tradeoff, not a detail. Specify request and response shapes and the status codes for the unhappy paths (unknown code, expired link).

**Definition of done:**

- The dossier specifies the record schema, primary key, and a storage engine choice justified against the read-by-key access pattern (not just 'use Postgres').
- The API section defines the create and resolve endpoints with status codes for unknown and expired codes, and explicitly chooses 301 vs 302 with a reason.

### 4. Find the one thing that breaks first

A design at scale is only as good as its understanding of where it falls over. Trace a redirect through your high-level diagram and find the component that saturates first under the peak QPS you computed — for a shortener it is almost always the read path hammering the datastore, or contention on whatever mints new codes. Name it precisely, then fix it precisely. The standard read fix is a cache in front of the store sized to your working set, but a cache forces real decisions: what eviction policy, what TTL, and what happens on a miss or a cold start — a cache stampede on a popular code can be worse than no cache at all. If the bottleneck is ID generation, contrast strategies — a counter handed out in ranges, a hash with collision handling, or pre-generated keys from a pool — and pick one with its failure behavior in mind. End with the new bottleneck your fix exposes, because removing one always reveals the next.

**Definition of done:**

- The dossier names the primary bottleneck under peak load, explains why it saturates first, and proposes a concrete fix with its own caveats (e.g. cache sizing, stampede handling, eviction policy).
- It states the next bottleneck the fix exposes, showing the design is understood beyond a single layer.

### 5. Map how it fails and how it grows

Senior work is judged on the unhappy path. Write the failure-mode section: what happens when a cache node dies, when the primary datastore replica falls behind, when an availability zone goes dark, and when traffic on one viral link concentrates on a single shard (the hot-key problem). For each, state the blast radius and the graceful degradation — a redirect can survive a stale cache, but minting a brand-new code may have to fail closed rather than risk a duplicate. Then write the scaling section honestly: explain how the read path scales horizontally behind a load balancer and a CDN, how you shard the keyspace by code so growth is just adding shards, and where the design hits a wall that a bigger machine won't solve. Tie it back to the requirements from milestone one: a 99.99% availability target is a budget of roughly 52 minutes of downtime a year, and every failure mode you listed spends against it.

**Definition of done:**

- The dossier has a failure-mode section covering at least cache-node loss, a hot-key/hot-shard, and a zone outage, each with blast radius and a degradation strategy.
- The scaling section explains horizontal read scaling and sharding by code, and names one limit the architecture cannot scale past without redesign.

### 6. Write the tradeoffs down and defend them

Every decision in the dossier closed off an alternative, and a design that pretends otherwise reads as naive. Assemble a tradeoff ledger: for each major call — key-value vs relational store, 301 vs 302, counter-based vs hash-based IDs, strong vs eventual consistency on a freshly created link — state what you chose, what you gave up, and the condition under which you'd choose differently. This is where consistency bites: a user who creates a link and immediately shares it expects it to resolve, so 'eventually consistent reads' is a promise you must qualify. Close the dossier with a short 'if requirements changed' paragraph — what flips if writes suddenly rival reads, or if the product demands per-click analytics — proving the design is a reasoned position, not a memorized template. A reviewer should be able to disagree with a choice and still see that you understood the cost of making it.

**Definition of done:**

- A tradeoff ledger lists at least four major decisions, each with what was chosen, what was given up, and the condition that would flip the choice.
- A closing 'if requirements changed' paragraph shows how the design adapts to a reversed read:write ratio or a new analytics requirement.

## Rubric

### Capacity estimation rigor

- **Junior:** Numbers appear in the dossier (QPS, storage) but the derivation is missing or hand-waved; assumptions are unstated, so a reviewer cannot challenge the inputs.
- **Mid:** Peak QPS, five-year storage, and cache working-set are each derived step by step from explicit per-record sizes and a stated read:write ratio; the key-space calculation shows how many base-62 characters are needed with headroom.
- **Senior:** Every assumption is marked as such and auditable; the model also derives the cache-hit rate needed to keep the datastore under its IOPS limit, and you name the assumption that would most change the architecture if it were off by an order of magnitude.

### Bottleneck identification and fix quality

- **Junior:** A cache is placed in front of the datastore because 'caching helps with reads'; eviction policy, TTL, and cold-start behavior are not addressed.
- **Mid:** The primary bottleneck is traced to the read path on the datastore under peak QPS; the cache is sized to the working set with a named eviction policy and TTL; at least one secondary concern (stampede on a popular key, cold-start) is acknowledged.
- **Senior:** You model the cache-miss amplification under a stampede (N concurrent misses each issuing a datastore read) and propose a mitigation (lock-based coalescing, probabilistic early expiry, or request deduplication); you then name the next bottleneck the cache exposes — typically write fanout or ID-generation contention — proving the design is understood in layers.

### Failure-mode coverage and blast radius

- **Junior:** Failure modes are listed as bullets ('if cache goes down, reads go to DB') without quantifying the blast radius or specifying how the system degrades gracefully.
- **Mid:** At least cache-node loss, a hot-key concentration, and a zone outage are each analyzed: blast radius stated, graceful degradation behavior described, and the decision between fail-open and fail-closed justified for at least one case.
- **Senior:** Each failure mode is tied to the SLO budget: you compute how many minutes per year each mode consumes of a 99.99% availability target (≈52 min/yr) and show which combination of redundancy decisions spends the budget most efficiently.

### Tradeoff articulation and defensibility

- **Junior:** Choices are stated without alternatives considered; the 301 vs. 302 decision is described as a technical detail rather than a product tradeoff between cacheability and analytics visibility.
- **Mid:** A tradeoff ledger covers at least four decisions (storage engine, redirect code, ID strategy, consistency model) with what was chosen, what was given up, and a condition that would flip the choice.
- **Senior:** The 'if requirements changed' section demonstrates that the dossier is a reasoned position: you show how flipping the read:write ratio (chat vs. shortener profile) or adding per-click analytics inverts at least three of the four major choices, and you can name the exact coupling that would need to be cut first.

## Senior stretch

- Write the same dossier for a second system with the opposite profile — a chat backend, which is write-heavy and stateful — and contrast how a reversed read:write ratio inverts almost every decision you made for the shortener.
- Add a quantified availability budget: convert your SLO target into an error budget in minutes per year, then show how each failure mode in your dossier consumes part of it and where you'd spend remaining budget on redundancy.
- Include a 'what I'd measure in production' section: the three or four metrics (p99 redirect latency, cache hit rate, write-path error rate, shard skew) whose dashboards would tell you the design is holding or about to break.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/system-design-dossier
