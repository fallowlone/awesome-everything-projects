# Write-Ahead Log — starter

Implement `Disk`, `WAL`, and the CRC32 helper in `src/wal.ts` so the suite passes.

    bun test

Rules: the "disk" is an in-memory byte buffer (no real I/O). Every record is
framed as `[u32 length][u32 crc32(body)][body bytes]`. `WAL.replay()` walks
frames from the start, verifying each CRC, and stops at the first incomplete
or corrupt frame. `WAL.checkpoint()` marks a replay floor; records before it
are invisible to replay. When it is green, read the rubric and extend to a
real on-disk store with fsync and crash-injection tests.
