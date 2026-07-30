# Crash-safe key-value store with a WAL

Build a tiny on-disk KV store that survives a kill -9 mid-write by appending to a write-ahead log before touching the main file.

**Difficulty:** advanced · **Est. days:** 7 · **Stack:** — · **Tracks:** databases, distributed

## Deliverable

A KV store where every mutation is durable after the call returns, verified by a crash-injection test harness.

## Why this project

Every durable storage system — Postgres, RocksDB, SQLite — is built on the same uncomfortable fact: a write(2) call does not mean the data is on disk. It means the OS accepted the bytes into its page cache, and they will hit persistent media whenever the kernel feels like it. A write-ahead log is the mechanism that turns that lie into a contract: you append the mutation to a durable log and fsync it before you touch the main data structure, so a kill -9 at any point leaves you either with an intact record to replay or a torn tail you can detect and discard. Building it from scratch forces you through every lesson that storage engineers spend careers learning: self-describing record framing, the ack-after-fsync ordering invariant, group commit's throughput multiplier, the torn-tail problem in crash recovery, checkpoint sequencing, and why a lying filesystem can still violate durability no matter how correct your code is.

## Skills

- append-only log
- fsync semantics
- crash recovery
- checkpointing

## Milestones

### 1. Append-only log: record framing and format

Before durability, design the on-disk format. A WAL is a sequence of self-describing records appended to one growing file, and every later milestone — recovery, checksums, truncation — depends on being able to walk that byte stream record by record. Frame each record as length-prefix + type + payload (and reserve a trailing slot for a CRC you add in milestone 5), because without a length you cannot find where the next record starts, and a torn tail becomes indistinguishable from real data. Decide your append unit: small records (one mutation each) keep latency low but waste header bytes; larger batched records amortize framing overhead. A real WAL record is tens of bytes of header over a payload, and at, say, 64-byte values you want framing overhead under ~20% so the log doesn't double your write volume. Build a writer that appends frames and a reader that walks them, with zero durability guarantees yet — that is the next milestone's job.

**Definition of done:**

- A record carries an explicit length so the reader can find the next record's offset without scanning for a delimiter.
- The writer appends frames and the reader walks the full log back into the same ordered list of records.
- You can state your per-record framing overhead in bytes and at what value size it stays acceptable.

**Self-review:** A senior reviewer checks that the frame is self-describing (length-prefixed) and forward-compatible — a CRC and version/type field have a place reserved, so milestone 5 is a format extension, not a rewrite.

### 2. fsync durability and group commit

Now make 'the call returned' mean 'the data survives power loss'. A write(2) only copies bytes into the OS page cache; until fsync(2) (or fdatasync) forces them to stable storage, a crash loses them silently. So the durability contract is: append the frame, fsync, then acknowledge — never ack before the fsync returns. The catch is cost: a single fsync to an SSD is ~0.5–3 ms and to spinning disk 5–10+ ms, so a naive one-fsync-per-write design caps you at a few hundred to low-thousands of writes/sec no matter how fast your CPU is. Group commit fixes this: buffer concurrent writers, fsync once for the whole batch, then ack them all together. One fsync amortized over a batch of 100 turns ~1000 fsyncs/sec of headroom into ~100k acks/sec — at the cost of added latency (a writer waits up to the batch window). Tune the batch window (e.g. 1–5 ms or N pending) and measure the throughput-vs-latency curve you just bought.

**Definition of done:**

- Every acknowledged write is fsync'd before its ack returns, proven by a test that asserts no ack precedes its fsync.
- Group commit batches concurrent writers into one fsync, and you report writes/sec with batching on vs off.
- You measured single-fsync latency on your disk and can state the batch window you chose and why.

**Self-review:** A senior reviewer checks the ack-after-fsync ordering holds under group commit (a batched writer is not acked until the shared fsync completes) and that fdatasync vs fsync was a deliberate choice, not an accident.

### 3. Crash recovery: replay and the torn tail

A WAL is worthless if you can't rebuild state from it after a crash. On startup, replay walks the log from the start, applying each well-formed record to rebuild in-memory state, and stops cleanly at the first record it can't fully parse — the torn tail of a write that was interrupted between append and fsync. The key invariant is that recovery must be idempotent and prefix-deterministic: replaying the same log twice yields identical state, and a torn final record is dropped rather than half-applied, because you only acked writes whose fsync completed, so anything past the last intact record was never promised to the caller. Inject crashes (truncate the file at random offsets, or kill mid-write under a fault harness) and prove the recovered state matches the set of acknowledged writes exactly — no lost acks, no phantom writes from the torn tail. Note recovery time scales with log length: a 1 GB log replayed at, say, a few hundred MB/s is seconds of startup, which is the pressure that forces the next milestone.

**Definition of done:**

- After a kill-9 mid-write, recovered state equals exactly the set of acknowledged writes — torn tail dropped, no ack lost.
- Replaying the same log twice yields byte-identical state (recovery is idempotent).
- You measured replay throughput and can state recovery time at your current and a 10x log size.

**Self-review:** A senior reviewer checks recovery stops at the first un-parseable record (it does not scan past a torn write hunting for valid-looking bytes downstream) and that the recovered set is exactly the acked set under a crash-injection run.

### 4. Checkpointing and log truncation

An unbounded log means unbounded recovery time and unbounded disk. Checkpointing breaks that: periodically flush the current materialized state to a durable snapshot file, record the log offset that snapshot covers, then truncate (or rotate to a new segment and delete old ones) everything before it. Recovery then becomes load-snapshot + replay-only-the-tail, turning a multi-second cold start into a near-constant one. The trade-offs are real: checkpoint too often and you pay snapshot-write I/O that competes with foreground writes; too rarely and recovery and disk balloon. The ordering is a durability landmine — you must fsync the snapshot and the new checkpoint-offset marker before truncating the old log, or a crash mid-checkpoint leaves you with neither a complete snapshot nor the log records you just deleted. Segment the log into fixed-size files so truncation is an atomic unlink of whole segments rather than a risky in-place file rewrite.

**Definition of done:**

- After a checkpoint, recovery loads the snapshot and replays only records after the checkpoint offset, and you show the recovery-time drop.
- The snapshot and offset marker are fsync'd before any old log segment is deleted, proven by a crash-during-checkpoint test that still recovers correctly.

**Self-review:** A senior reviewer checks the checkpoint ordering (snapshot durable → offset marker durable → only then truncate) and that a crash at every step of the checkpoint still recovers the full acked set.

### 5. A KV store on top: memtable and flush

Turn the durable log into a usable key-value store. The pattern is the LSM front door: a write appends a (key, value) record to the WAL for durability, then updates an in-memory memtable (a sorted map) that serves reads — so the WAL is the durability backbone and the memtable is the fast queryable view. The two are kept consistent by ordering: WAL-append + fsync first, memtable update second, so a crash can only lose what was never acked. When the memtable grows past a threshold, flush it as a sorted on-disk table and, critically, only then drop the WAL prefix it covered — flush is just a specialized checkpoint, and the same fsync-before-truncate rule from milestone 4 applies. Get(key) checks the memtable, then falls back to flushed tables. This is the moment the project stops being a log and becomes a storage engine, and it forces you to reason about read-your-writes: an acked write must be visible to the very next read.

**Definition of done:**

- A write is durable in the WAL before the memtable is updated, and an acked write is readable by the immediately following Get (read-your-writes).
- A memtable flush writes a sorted on-disk table and drops only the WAL prefix it covered, and reads correctly fall back from memtable to flushed tables.
- A crash before flush recovers all acked writes by replaying the WAL into a fresh memtable.

**Self-review:** A senior reviewer checks the WAL-then-memtable ordering (never memtable-first) and that flush retires the correct WAL prefix — not too much (losing un-flushed writes) and not too little (replaying flushed data).

### 6. Corruption detection (CRC), observability, and the torn-write incident

Silent corruption is the enemy a checksum exists to catch. Add a CRC32 (the slot you reserved in milestone 1) over each record's header+payload; on replay, recompute and compare, so a torn write, a bit-flip, or a half-written sector is detected rather than applied as if it were real data. This is the line between 'recovers cleanly' and 'rebuilds a corrupted state and serves it forever'. Then make the engine observable: counters for writes/sec, fsync latency p50/p99, group-commit batch size, memtable size and flush count, and recovery time — the same RED-shaped signals a real storage engine emits. Finally, run the incident: simulate a torn write (truncate the active segment mid-record) AND a lost fsync (a fault layer that drops the fsync's effect so acked-looking data never actually hit disk). Show that the CRC catches the torn record and recovery stops at it; then show the lost-fsync case is the genuinely dangerous one — it can lose an acknowledged write — and reason about why fsync-lying disks/filesystems make 'durable' a property of your whole stack, not just your code. Write a short post-mortem: which failure your design survives, which it doesn't, and the one mitigation that isn't 'fsync harder'.

**Definition of done:**

- A per-record CRC detects a corrupted/torn record on replay and recovery stops at it instead of applying garbage.
- The engine emits writes/sec, fsync p50/p99, batch size, and recovery time, and you can read the stampede of misses or a slow fsync off them.
- Your post-mortem distinguishes the torn-write case (CRC catches it, no ack lost) from the lost-fsync case (an ack can be lost) and proposes one non-trivial mitigation.

**Self-review:** A senior reviewer checks the CRC covers header+payload (not payload alone, so a corrupted length field is caught too) and that the post-mortem correctly identifies the lost-fsync case as the one that can violate the durability contract, with a mitigation beyond 'call fsync again'.

## Rubric

### fsync ordering & durability contract

- **Junior:** Writes are acknowledged after write(2) but before fsync; a kill -9 between them drops acknowledged data silently.
- **Mid:** Every ack follows an fsync — append frame, fsync, then ack — and group commit batches concurrent writers into one fsync, with writes/sec measured with batching on vs off.
- **Senior:** You reason about the group-commit latency tradeoff (batch window adds wait time; too small and you pay per-writer fsync cost), measured single-fsync latency on your disk (~0.5–3 ms SSD), and chose the batch window against the p99 write latency budget you are willing to accept.

### Crash recovery & torn-tail handling

- **Junior:** Recovery replays all records it finds; a torn write produces garbage or a parse panic instead of a clean stop.
- **Mid:** Recovery replays intact records and stops at the first un-parseable one (the torn tail is dropped, not half-applied); replaying the same log twice yields byte-identical state.
- **Senior:** A per-record CRC catches a corrupted (not just truncated) tail; the post-mortem distinguishes the torn-write case (CRC catches it, no ack lost) from a lost-fsync (an ack can be lost regardless of CRC) and proposes a non-trivial mitigation — not 'fsync harder' but something like checksumming at a different layer or write-ahead verification.

### Checkpoint sequencing & log truncation

- **Junior:** The log grows without bound; recovery time is proportional to log size and increases every day.
- **Mid:** A checkpoint flushes materialized state to a snapshot, records the log offset, and truncates old segments; recovery becomes snapshot + tail-only replay, and a crash during the checkpoint still recovers correctly.
- **Senior:** The ordering invariant — fsync snapshot, fsync offset marker, only then unlink old segments — is enforced and you prove it with a crash-mid-checkpoint test. You measured recovery time at current and 10x log size and can state the checkpoint frequency that keeps cold-start under your latency budget.

## Senior stretch

- Inject crashes between the WAL write and the fsync; prove no acknowledged write is ever lost across thousands of randomized crash points.
- Add WAL-based replication: stream the log to a follower, apply it in order, and reason about the durability boundary (ack on local fsync vs ack on follower-confirmed) and the throughput cost.
- Add LSM compaction: merge flushed sorted tables to bound read amplification and reclaim space, and measure the write-amplification vs read-latency trade-off.
- Compare O_DIRECT (bypass the page cache, own your buffering) against buffered writes + fsync, and measure the latency and throughput difference under sustained load.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/write-ahead-log
