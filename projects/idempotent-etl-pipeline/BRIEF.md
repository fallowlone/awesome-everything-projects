# Idempotent ETL Pipeline

Pipelines don't fail gracefully — they fail at 3 a.m., halfway through a load, and someone re-runs them. This project teaches the one property that separates a hobby script from production data engineering: a run you can repeat any number of times and still land exactly one copy of each row. You'll build batch ingestion, an idempotent load, a watermark for incremental pulls, and the data-quality gates that stop bad data before it poisons everything downstream.

**Difficulty:** advanced · **Est. days:** 9 · **Stack:** python, postgres, SQL (INSERT ... ON CONFLICT / MERGE), a source table or CSV/Parquet drop · **Tracks:** data-engineering, backend, databases, sql-postgres

## Deliverable

A runnable ETL job that ingests a source into a warehouse table, can be re-run on the same input without creating duplicates (verified by row counts), advances a stored watermark to pull only new rows on the next run, and aborts with a clear report when a data-quality check fails.

## Why this project

Almost every data platform is a tower of pipelines, and the ones that survive contact with production all share the same spine: they can be re-run without fear. Idempotency, a durable watermark, and quality gates aren't advanced extras — they're the minimum bar for a pipeline you can trust at 3 a.m. when a scheduler fires a retry and you're asleep. Build this once by hand and you'll understand what every orchestration tool — Airflow, dbt, Dagster — is really automating: the discipline of computing the same correct answer no matter how many times the work runs. The moment your duplicate count stays at zero through a re-run, a crash, and a backfill is the moment you stop writing scripts and start engineering data.

## Skills

- designing idempotent loads with upsert/merge keys
- incremental extraction with a durable watermark
- writing data-quality assertions that gate a load
- reasoning about at-least-once delivery and re-runs
- backfilling a date range without double-counting
- handling late-arriving and out-of-order data

## Milestones

### 1. Ingest a source as a batch

Start with the boring, honest version: read every row from a source — a table, a CSV, or a Parquet file — and insert it into a staging table in your warehouse. No incremental logic yet, no dedup, just a full load you can read end to end. The point of starting here is to make the shape of the data and the contract of the source explicit before you optimize anything: what is the natural key of a row, what column tells you when it changed, and is the source a snapshot or an append-only log? Those three answers decide every later decision, and getting them wrong is the most expensive mistake in the whole pipeline. Keep extract, transform, and load as separate steps so you can reason about each one; resist folding them into a single clever query.

**Definition of done:**

- A single command reads the full source and lands every row in a staging table, and you can state the row's natural key and its change-timestamp column.
- Extract, transform, and load are distinct steps, each independently runnable and inspectable.

### 2. Make the load idempotent

Now run your full load twice and watch the duplicates pile up — that's the bug this milestone exists to kill. An idempotent load produces the same final table whether it runs once or five times, which means the load must be keyed, not appended. Replace the blind INSERT with an upsert: INSERT ... ON CONFLICT (natural_key) DO UPDATE in Postgres, or a MERGE. The deep idea is that pipelines live in an at-least-once world — schedulers retry, operators re-run, a partial failure leaves you mid-load — so correctness can't depend on a job running exactly once. Decide deliberately what 'conflict' means: is a re-seen key a no-op, a last-writer-wins update, or an error? Each choice encodes a different truth about your source, and the wrong one silently corrupts history.

**Definition of done:**

- Running the same load twice on identical input leaves the target table with the same row count both times — proven with a count query.
- The upsert's conflict behavior (no-op vs. update vs. error) is a documented, deliberate choice tied to the source's semantics.

### 3. Go incremental with a watermark

Reloading the entire source every run is fine at 10k rows and a disaster at 10 billion. The fix is a watermark: a small piece of durable state — the max change-timestamp (or sequence id) you've successfully processed — that lets the next run extract only rows newer than that mark. Store it transactionally so the watermark advances only if the load it covers actually committed; otherwise a crash between 'load succeeded' and 'watermark saved' will skip data forever. This is where idempotency and incrementality must cooperate: because re-runs can still re-pull a boundary row, the upsert from the previous milestone is what keeps the overlap harmless. Pick your boundary carefully — use a closed interval and accept re-processing the edge, because skipping a row is silent data loss while reprocessing one is free under an idempotent load.

**Definition of done:**

- After a successful run, the next run extracts only rows newer than the stored watermark, and a crash mid-load leaves the watermark un-advanced.
- Re-running across the watermark boundary does not create duplicates, because the load is idempotent on the natural key.

### 4. Gate the load with quality checks

A pipeline that loads anything is worse than no pipeline, because it launders bad data into trusted tables that other people build on. Add data-quality assertions that run between transform and load and have the authority to abort: row count is within an expected band, the natural key is unique and non-null in the batch, required columns aren't null, and a numeric column sits inside sane bounds. The hard design question is what 'fail' should do — halt the whole load, or quarantine the offending rows and load the rest? Halting protects correctness but stops the business; quarantining keeps data flowing but needs a path to reprocess what you set aside. Either way the checks must be loud: a silent quality failure is the most dangerous bug in data engineering, because it's discovered weeks later in a dashboard nobody trusts anymore.

**Definition of done:**

- At least three assertions (row-count band, key uniqueness/non-null, value-range) run before load and can abort it with a readable report.
- A deliberately corrupted batch fails the gate and never reaches the target table; the failure is visible, not silent.

### 5. Backfill and late-arriving data

Two senior realities break the tidy forward-only model. First, backfill: someone needs to reload last March because a transform was wrong, so your job must accept an explicit date range and reprocess it without double-counting today's rows or clobbering the live watermark. Second, late-arriving data: a row with yesterday's timestamp shows up after today's watermark has already moved past it, so a naive incremental pull would skip it forever. Both problems are really the same lesson — the watermark is an optimization, not a source of truth, and the load's idempotency is what lets you safely reprocess any window. Solve them by making backfill a bounded, idempotent re-run over a chosen interval, and by widening the incremental window with a small lateness allowance (re-scan a trailing buffer) so out-of-order rows get a second chance to land exactly once.

**Definition of done:**

- A backfill run over an explicit date range reprocesses only that range, produces no duplicates, and leaves the forward watermark intact.
- A row inserted with a timestamp older than the current watermark still lands exactly once, thanks to the lateness buffer plus idempotent upsert.

## Rubric

### Idempotent load

- **Junior:** The load is a blind INSERT; re-running on the same input doubles every row in the target table.
- **Mid:** INSERT ... ON CONFLICT (natural_key) DO UPDATE replaces the blind insert; re-running on identical input leaves row counts unchanged, and the conflict behavior (update vs. no-op) is a documented deliberate choice.
- **Senior:** You reason about what 'conflict' encodes: a no-op means the source is a snapshot (first write wins), an update means last-writer-wins (source reflects current truth), and an error means you expect no re-seen keys. Wrong choice silently corrupts history; you name the source semantics that drive yours.

### Watermark durability

- **Junior:** The watermark is written to a file or memory; a crash between load and save leaves the next run re-pulling already-loaded rows or, worse, skipping rows the failed load never committed.
- **Mid:** The watermark is stored transactionally in the database and advances in the same commit as the load, so a crash leaves it un-advanced and the next run safely re-pulls the window.
- **Senior:** You handle boundary rows: the closed interval deliberately re-pulls the edge row, and the idempotent upsert absorbs the overlap without duplicates. You explain why skipping a row is silent data loss while re-processing one is free — and show the late-arriving-data lateness buffer extends the same principle.

### Data-quality gates

- **Junior:** The pipeline loads whatever arrives; bad rows reach the target table and are discovered later in a dashboard nobody trusts.
- **Mid:** Row-count band, key uniqueness, non-null required columns, and a value-range check run between transform and load; a deliberately corrupted batch fails the gate and never reaches the target — the failure is loud, not silent.
- **Senior:** You have a documented policy for what 'fail' means: halt vs. quarantine. You can articulate why halting protects correctness but stops the business, and why quarantine keeps the lane moving but requires a reprocessing path — and you show the quarantined rows are queryable and have a clear retry mechanism.

### Backfill & late-data handling

- **Junior:** There is no way to reprocess a past date range; a late-arriving row with an old timestamp is silently skipped once the watermark has moved past it.
- **Mid:** Backfill accepts an explicit date range and re-runs idempotently over it without touching the live watermark; a lateness buffer re-scans a trailing window so out-of-order rows get a second chance.
- **Senior:** You can state the tradeoff: widening the lateness buffer increases reprocessing cost per run; you measured the boundary — e.g. a 2-hour buffer re-scans N rows and costs X seconds — and chose a value you can defend against the actual late-data arrival distribution of your source.

## Senior stretch

- Replace the single watermark with per-partition watermarks (e.g. one per source shard) so a slow or backfilling partition can't hold back or skip data in the others.
- Make the pipeline observable: emit per-run metrics (rows in, rows upserted, rows rejected, watermark before/after, duration) and alert when a quality gate trips or row counts drift outside the expected band.
- Add slowly-changing-dimension (SCD Type 2) history to one table so updates create new versioned rows instead of overwriting, and prove the upsert keeps that history idempotent across re-runs.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/idempotent-etl-pipeline
