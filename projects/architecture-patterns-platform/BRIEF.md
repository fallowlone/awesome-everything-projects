# B2B Order & Billing Platform Architecture

Design the architecture of a B2B order and billing platform end-to-end: carve bounded contexts from the problem space, assign a structural style to each (layered, hexagonal, or clean/onion), decide where CQRS, event sourcing, and event-driven sagas are warranted, choose between a modular monolith and a set of services while explicitly avoiding the distributed monolith trap, and justify every significant decision with an Architecture Decision Record backed by a fitness function you can actually measure.

**Difficulty:** advanced · **Est. days:** 5 · **Stack:** DDD / Bounded Contexts, Hexagonal Architecture, Clean / Onion Architecture, CQRS, Event Sourcing, Event-Driven (Sagas), Modular Monolith, ADRs · **Tracks:** architecture-patterns

## Deliverable

A written architecture document containing: (1) a context map with at least four bounded contexts and their relationships (conformist, anti-corruption layer, open host, etc.); (2) a per-context table mapping each context to a structural style with a written rationale; (3) a read/write and event strategy section stating which contexts use CQRS, event sourcing, and/or sagas and why; (4) a decomposition decision — modular monolith or services — with an explicit anti-distributed-monolith checklist; (5) at least three ADRs in the standard format (Title / Status / Context / Decision / Consequences); (6) at least one fitness function for the most critical quality attribute, stated as a measurable threshold.

## Why this project

This is the architecture-patterns capstone. You will not write code — you will produce an architecture for a realistic B2B platform that processes orders, applies pricing rules, invoices customers, and tracks payments. The platform is the running example used throughout the track, and here you design it end-to-end. Start with domain discovery: identify at least four bounded contexts (e.g. Ordering, Pricing, Billing, Notifications) using event-storming or a similar technique, and establish a ubiquitous language for each. Draw a context map showing how they integrate — pay attention to the upstream/downstream relationships and choose the integration pattern for each boundary (conformist, anti-corruption layer, open host service, published language). Next, assign a structural style to each context. Not every context deserves a hexagonal or clean architecture — a simple read-only Notifications context may be fine as a layered CRUD service, while the core Ordering and Billing contexts are strong candidates for ports-and-adapters so their domain logic is fully isolated from infrastructure. For Ordering and Billing, decide whether CQRS is warranted: if read and write models diverge significantly (reporting queries vs. command-heavy writes), CQRS is a natural fit. Evaluate event sourcing for Billing — the audit trail requirement makes it a strong candidate, but weigh the operational cost honestly. Model the cross-context workflows (e.g. order placed → pricing applied → invoice generated → payment collected) as event-driven sagas with explicit compensation steps, and document the failure modes. For decomposition, make a concrete recommendation: start as a modular monolith or split into services from day one? Apply the distributed monolith checklist — if you choose services but still share a database, synchronously call across boundaries, or deploy together, you have a distributed monolith and must fix the design. Finally, write three or more ADRs for your most consequential decisions (e.g. 'Use event sourcing for Billing', 'Keep Ordering and Billing in one deployable', 'Use an anti-corruption layer between legacy ERP and Ordering context'). For each major quality attribute (e.g. auditability, availability, latency at the 99th percentile), define a fitness function: a concrete, automated or semi-automated check that can tell you if the architecture is drifting away from what was intended.

## Skills

- bounded-contexts
- ubiquitous-language
- context-mapping
- hexagonal-architecture
- ports-and-adapters
- clean-architecture
- cqrs
- event-sourcing
- event-driven
- saga-pattern
- modular-monolith
- anti-corruption-layer
- adr
- fitness-functions
- tradeoff-analysis
- decomposition

## Milestones

### 1. Map the bounded contexts and establish ubiquitous language

Run a lightweight event-storming session (even solo, on paper or a whiteboard tool) to discover the domain events of the B2B order/billing platform. Group events into at least four bounded contexts. For each context, write a one-paragraph ubiquitous language glossary that defines the key terms as they are used inside that context — pay attention to the same word meaning different things in different contexts (e.g. 'Order' in Ordering vs. Billing). Draw a context map showing the upstream/downstream relationships and label each boundary with its integration pattern.

**Definition of done:**

- A context map exists with at least four named bounded contexts and their boundaries clearly drawn.
- Each bounded context has a short ubiquitous language glossary (at least five key terms defined in that context's dialect).
- Each context boundary on the map is labelled with an integration pattern (conformist, ACL, open host service, shared kernel, or published language).

### 2. Choose a structural style for each bounded context

For each bounded context, evaluate three candidate structural styles — layered N-tier, hexagonal (ports and adapters), and clean/onion — and pick the one that fits the context's complexity and the volatility of its dependencies. A simple CRUD-heavy context may be best served by a layered approach; a core domain context with complex business rules and multiple infrastructure adapters (database, message broker, external APIs) benefits most from hexagonal or clean architecture. Write a per-context table with columns: Context, Style Chosen, Rationale (2–3 sentences), Trade-offs Accepted.

**Definition of done:**

- Every bounded context has a structural style assigned in a written table with a rationale and accepted trade-offs.
- For any context choosing hexagonal or clean architecture, the document identifies at least two ports (primary and secondary) with their adapter examples.
- The rationale for at least one context explicitly explains why a simpler style was preferred over a richer one (or vice versa), with reference to the context's business complexity.

### 3. Decide the read/write and event strategy

For each bounded context, decide whether CQRS (separate command and query models) is warranted, whether event sourcing (events as the system of record) is a good fit, and whether the cross-context workflows should be implemented as event-driven sagas. Apply each pattern only where it earns its complexity. For the Billing context, explicitly evaluate event sourcing against the audit-trail and replay requirements. For the long-running workflow that spans Ordering → Pricing → Billing → Notifications, design a saga: name each step, define the compensation step for each failure mode, and decide between choreography (each context reacts to events from the previous) and orchestration (a central saga coordinator drives the flow).

**Definition of done:**

- A written section states which contexts use CQRS and justifies the decision; contexts that do not use CQRS have a one-sentence explanation of why the added complexity is not warranted.
- The event sourcing evaluation for Billing is documented: a table comparing event sourcing vs. a state-based store on at least three criteria (auditability, query complexity, storage cost, replay capability).
- The cross-context saga is designed with every step named, its compensation step defined, and a choreography vs. orchestration decision made and justified.

### 4. Choose a decomposition and avoid the distributed monolith

Make a concrete deployment decision: start the platform as a modular monolith (all bounded contexts in one deployable with strong module boundaries enforced by the build system) or split into independent services from day one. Apply the distributed monolith checklist explicitly: shared database across context boundaries? synchronous runtime coupling between contexts? joint deployment pipelines? If any of those are present and you still call it microservices, you have a distributed monolith. Write the decision as a structured argument: option A (modular monolith), option B (services), decision, and the specific conditions under which you would migrate from A to B or admit B was wrong.

**Definition of done:**

- The document contains the distributed monolith checklist filled out (shared DB, synchronous cross-context calls, joint deployment) with an explicit pass/fail per criterion.
- A deployment decision is stated (modular monolith or services) with a written rationale referencing the team size, traffic scale, and operational maturity assumptions made.
- The conditions for migrating from the chosen decomposition to the alternative are written as concrete triggers (e.g. 'when a single context's release cadence diverges from the others', 'when team size exceeds N').

### 5. Justify with ADRs and a fitness function

Write at least three Architecture Decision Records in the standard format (Title / Status / Context / Decision / Consequences) for the three most consequential decisions in your architecture — examples: whether to use event sourcing for Billing, where to place the anti-corruption layer between the platform and an external ERP, whether to start as a modular monolith. For the most critical quality attribute of the platform (choose one: auditability, availability, or p99 latency of the order-placement flow), define a fitness function: a concrete test or metric that can be run automatically or semi-automatically and whose failure indicates that the architecture has drifted from the intended quality level. State the threshold clearly (e.g. 'every billing event must be replayable to within 1 second of its original timestamp'; 'no module in the Ordering context may import from the Billing module's internal packages').

**Definition of done:**

- At least three ADRs are written, each with all five standard sections (Title, Status, Context, Decision, Consequences) filled out.
- At least one fitness function is defined with a precise, measurable threshold and a description of how it would be checked (automated test, CI gate, monitoring alert, or manual audit cadence).
- The ADRs and fitness functions are referenced in the overall architecture document, forming a coherent justification trail from requirements → design decisions → quality enforcement.

## Rubric

### Bounded-context boundary quality

- **Junior:** Four contexts are named and drawn on a map, but boundaries follow org structure or intuition rather than domain events; terms bleed across contexts without an explicit translation layer.
- **Mid:** Boundaries emerge from an event-storming pass; each context has a ubiquitous-language glossary and the context map labels every relationship with its integration pattern (conformist, ACL, open host, etc.).
- **Senior:** You can defend why 'Order' means different things in Ordering vs. Billing and point to the anti-corruption layer that prevents the semantic leak; the context map shows upstream/downstream power asymmetry and you justify each boundary as the cheapest seam to change independently.

### Structural style and dependency direction

- **Junior:** Each context gets a style label (layered, hexagonal, clean) and a brief note, but the rationale is generic ('hexagonal is good for testability') rather than tied to that context's specific volatility.
- **Mid:** The per-context table shows concrete ports and adapters for hexagonal choices, names which dependencies are volatile and why, and explains at least one case where a simpler style was preferred because the context lacks domain complexity.
- **Senior:** Dependency arrows in every hexagonal context point inward — no infrastructure type appears inside a domain object; you cite the specific coupling risk avoided (e.g. ORM entity bleeding into domain logic, message-broker type in saga command) and the fitness function that would catch a violation in CI.

### Event strategy and saga failure-mode coverage

- **Junior:** CQRS and event sourcing are applied to every context because they sound powerful; the cross-context flow is sketched as a happy-path sequence with no compensation steps defined.
- **Mid:** CQRS is applied only where read and write models diverge significantly; event sourcing for Billing is evaluated against a state-based store with a comparison table; the saga names each step and its compensation, and the choreography vs. orchestration choice is stated with a rationale.
- **Senior:** You name the operational tax of event sourcing (projection rebuilds, snapshot cadence, storage growth rate) alongside its audit benefit, and you can state the blast radius when a saga's compensation step itself fails — for example, an invoice already sent when the payment step times out — and the fallout handling strategy.

### Decomposition decision and distributed-monolith avoidance

- **Junior:** 'Microservices' is chosen because it is modern; the checklist (shared DB, synchronous cross-context calls, joint deployment) is not applied, so the design has all the drawbacks of distribution with none of the autonomy.
- **Mid:** The distributed-monolith checklist is filled out with a pass/fail per criterion; the deployment decision (modular monolith or services) references concrete assumptions about team size, traffic, and operational maturity; migration triggers are written as measurable conditions.
- **Senior:** You identify the one bounded context whose release cadence, scaling requirement, or team ownership will most likely break the monolith assumption first, specify the extraction sequence that avoids a big-bang split, and name the integration test that would catch a shared-database coupling before extraction begins.

## Senior stretch

- Extend the context map to include a legacy ERP system as an upstream context and design a full anti-corruption layer: define the translation logic between the ERP's data model and the platform's ubiquitous language, specify how you would handle schema changes in the ERP without cascading breakage, and write the ACL ADR.
- Design a multi-tenant architecture extension for the platform: decide whether tenancy is a cross-cutting concern or a bounded context, specify the data isolation strategy (shared schema with tenant_id, schema-per-tenant, or database-per-tenant), and write a fitness function that enforces tenant data isolation in CI.
- Model the platform's event schema as a published language: design a versioning strategy for domain events (version in the event type, envelope versioning, or schema registry), specify the upgrade path when a breaking change is needed, and write a fitness function that prevents unversioned events from being published.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/architecture-patterns-platform
