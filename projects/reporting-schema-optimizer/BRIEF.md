# Reporting Schema Optimizer

Reporting is where a database earns or loses its keep: the queries are wide, the tables are big, and 'it's slow' is the most common bug in production analytics. You'll model a sales-and-events domain, write the honest slow versions of the dashboard queries, then make them fast with indexes and materialized views — and you'll read EXPLAIN ANALYZE to prove the speedup instead of guessing at it. This is the heart of the track: turning a vague 'the report is laggy' into a measured, defensible plan change.

**Difficulty:** advanced · **Est. days:** 8 · **Stack:** postgres, psql, EXPLAIN ANALYZE, pgbench or a seed script, materialized views, declarative partitioning · **Tracks:** sql-postgres, databases, data-engineering

## Deliverable

A self-hosted Postgres database with a seeded reporting schema, a file of analytic queries each paired with its before/after EXPLAIN ANALYZE output, a set of indexes and at least one materialized view with a documented refresh strategy, and a short note explaining every plan change you made and why.

## Why this project

Reporting is where most teams first hit the wall: the data outgrows the naive query, the dashboard times out, and someone is told to 'make it faster' with no plan for how. This project rehearses the senior loop for exactly that moment — model deliberately, measure before you touch anything, read the plan instead of guessing, change one thing, and prove the change with numbers. Indexes and materialized views are not magic dust; they are tradeoffs you choose with eyes open, paying in writes and disk and staleness for the reads you care about. Do this once by hand, watching a seq scan become an index scan in EXPLAIN ANALYZE, and you'll never again accept 'it's slow' as a diagnosis or 'it feels faster' as a fix.

## Skills

- dimensional schema modeling for reporting
- writing analytic queries with aggregation and window functions
- reading EXPLAIN ANALYZE plans
- designing and choosing the right indexes
- building and refreshing materialized views
- table partitioning for time-series data
- reasoning about isolation in a write path

## Milestones

### 1. Model the reporting domain

Before you can optimize anything you need a shape worth optimizing. Model a small but realistic sales domain: customers, products, orders, and order_lines, with the foreign keys and constraints that keep the data honest. Reporting schemas live in tension — normalize too hard and every query becomes a six-way join; denormalize too eagerly and you trade write integrity for read speed you might not need yet. Pick a deliberate middle, write the DDL, and add the constraints that let the planner trust your data. A schema the planner trusts is a schema it can optimize; a pile of nullable columns with no keys is one it has to guess about.

**Definition of done:**

- Four related tables exist with primary keys, foreign keys, and at least one NOT NULL / CHECK constraint that encodes a real business rule.
- A seed script loads at least a few hundred thousand order_lines so query plans behave like production, not like a toy.

### 2. Write the slow reports first

Now write the queries a dashboard would actually ask for, and write them naively on purpose: revenue per month, top products by category, repeat-customer rate, a running total of sales over time. Use GROUP BY, aggregates, and a window function or two — the real vocabulary of reporting. Run each one and time it. Resist the urge to optimize yet; you can't prove a speedup without a slow baseline to beat. The discipline here is to capture the honest starting point, because 'it feels faster' is not an engineering claim — a number is.

**Definition of done:**

- At least four analytic queries run correctly and return the expected shape of results.
- Each query has a recorded baseline timing and EXPLAIN ANALYZE output captured before any tuning.

### 3. Read the plan, find the pain

EXPLAIN ANALYZE is the only honest witness to what Postgres actually did. Learn to read it: spot the sequential scans over big tables, the rows estimated wildly differently from rows actually returned, the hash joins and sorts spilling to disk. The gap between estimate and reality is usually where your pain lives — when the planner thinks a step returns 10 rows and it returns 10 million, it picks the wrong strategy for the whole query. For each slow query, write down the single most expensive node and the bad estimate driving it. You're not fixing anything yet; you're diagnosing, because a fix without a diagnosis is just a lucky guess.

**Definition of done:**

- For each slow query you can name the dominant cost node (seq scan, sort, hash join) and whether estimates match actual rows.
- Running ANALYZE on the tables and re-reading a plan shows you the effect of fresh statistics on the planner's choices.

### 4. Index, materialize, and prove it

Now earn the speedup. Add the indexes your plans asked for — and only those, because every index you add is a tax on every write and a chunk of disk you pay for forever. A composite index in the right column order can turn a sequential scan into an index scan; the wrong order leaves it unused. For the heaviest aggregate reports, build a materialized view that precomputes the rollup, and decide honestly how it gets refreshed: on a schedule, concurrently, or on demand — each choice trades freshness against cost. Then re-run EXPLAIN ANALYZE and put the before and after side by side. The win only counts if the plan changed and the timing dropped, and you can say exactly why.

**Definition of done:**

- At least two queries show a measurably better plan (index scan instead of seq scan, or a cheaper join) with recorded before/after timings.
- At least one materialized view backs a heavy report, with its refresh strategy written down and justified.

### 5. Guard against the regression

A speedup that quietly rots is worse than no speedup, because someone trusts it. Materialized views go stale, statistics drift after big loads, and bloat from churn makes index scans crawl. Wire in the maintenance that keeps your wins alive: a refresh path for the view, an ANALYZE after bulk loads so the planner stays honest, and a check that vacuum is keeping bloat in check. Re-run your benchmark queries one more time and confirm the plans you fought for are still the plans you get. The mark of a senior is not making it fast once — it's making it stay fast when nobody is watching.

**Definition of done:**

- A documented maintenance routine (view refresh + ANALYZE + vacuum check) exists and you have run it once end to end.
- Re-running the benchmark after maintenance confirms the optimized plans still hold.

## Rubric

### EXPLAIN ANALYZE literacy

- **Junior:** Runs EXPLAIN and can name the top-level node type; notices whether a seq scan or an index scan appears.
- **Mid:** Reads actual vs estimated rows per node, identifies the cost-dominant node, and explains why a large estimate gap leads the planner to pick the wrong join strategy.
- **Senior:** Spots spill-to-disk (Batches > 1), correlates bad estimates to stale statistics, and can trigger a plan regression intentionally by removing an index — then read the new plan and explain exactly which node changed and why.

### Index and covering design

- **Junior:** Adds a single-column index on the most obvious filter column and confirms the plan changes from seq scan to index scan.
- **Mid:** Chooses composite index column order by leading-column selectivity, adds a covering index to avoid heap fetches for hot queries, and uses a partial index on a low-cardinality predicate to keep the index lean.
- **Senior:** Audits write amplification: quantifies how many indexes a given INSERT must maintain, removes unused ones, and states the disk-and-write cost per index as an explicit trade-off — not as an afterthought.

### Materialized view freshness strategy

- **Junior:** Creates a materialized view and refreshes it manually when asked.
- **Mid:** Chooses between concurrent and non-concurrent refresh with documented reasoning, schedules it to match the acceptable staleness window, and adds a post-bulk-load ANALYZE so statistics stay honest.
- **Senior:** Plans for scale: states the refresh cost as table-size grows, identifies when incremental refresh via a delta table is cheaper than a full REFRESH CONCURRENTLY, and wires a regression check that fails CI if the view's query plan degrades.

### Regression guarding

- **Junior:** Re-runs queries after changes and notes whether they feel faster.
- **Mid:** Records before/after EXPLAIN ANALYZE output and timing for every optimization, and confirms plans still hold after running ANALYZE and VACUUM.
- **Senior:** Scripts the regression check: captures the plan's node sequence as a fingerprint, fails loudly if a seq scan re-appears, and ties the check to a CI step — turning 'is the report still fast?' from a human judgment into a machine assertion.

## Senior stretch

- Add a transaction-aware audit log: a table that records who changed what and when, written in the same transaction as the change so a rolled-back update leaves no orphan audit row. Reason explicitly about isolation — at READ COMMITTED versus REPEATABLE READ — so the log never disagrees with the data it claims to describe.
- Partition the audit log (or the orders fact table) by time using declarative range partitioning, so old partitions can be detached and archived cheaply and queries that filter by date prune to a single partition instead of scanning the whole history.
- Drive a regression check from a script: capture each query's plan signature and timing, fail loudly if a plan flips back to a sequential scan, and turn 'is the report still fast?' into something CI can answer.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/reporting-schema-optimizer
