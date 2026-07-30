import { test, expect } from "bun:test";
import { Disk, WAL } from "../src/wal";

// ── helpers ──────────────────────────────────────────────────────────────────

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
function dec(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

// ── (a) round-trip: several appended records replay back in order, byte-identical ──

test("replays multiple records in order", () => {
  const disk = new Disk();
  const wal = new WAL(disk);

  wal.append("alpha");
  wal.append(enc("beta"));
  wal.append("gamma");

  const out = wal.replay();
  expect(out.length).toBe(3);
  expect(dec(out[0])).toBe("alpha");
  expect(dec(out[1])).toBe("beta");
  expect(dec(out[2])).toBe("gamma");
});

// ── (b) torn tail: crashTruncate partway through the last record's body ──────
//    → that record is dropped; all earlier ones survive

test("drops a torn-tail record but keeps earlier records", () => {
  const disk = new Disk();
  const wal = new WAL(disk);

  wal.append("first");
  wal.append("second");

  const sizeAfterTwo = disk.size;
  wal.append("third"); // write the third record

  // Truncate partway through the third record's body (header is 8 bytes, body follows)
  // Cut 2 bytes into the body so the frame is incomplete
  disk.crashTruncate(sizeAfterTwo + 8 + 2);

  const out = wal.replay();
  expect(out.length).toBe(2);
  expect(dec(out[0])).toBe("first");
  expect(dec(out[1])).toBe("second");
});

// ── (c) flipped byte in body causes CRC mismatch; replay stops there ─────────
//    → records before the corrupt frame still returned

test("stops replay at a CRC-corrupt frame, returns earlier records", () => {
  const disk = new Disk();
  const wal = new WAL(disk);

  wal.append("ok1");
  const offsetBeforeCorrupt = disk.size;
  wal.append("ok2"); // this will be corrupted
  wal.append("ok3"); // this should never be seen

  // Flip a byte in ok2's body (offset = offsetBeforeCorrupt + 8 [header] + 0 [first body byte])
  const raw = disk.data;
  raw[offsetBeforeCorrupt + 8] ^= 0xff;

  const out = wal.replay();
  expect(out.length).toBe(1);
  expect(dec(out[0])).toBe("ok1");
});

// ── (d) after checkpoint(), replay returns only records appended after it ────

test("checkpoint makes earlier records invisible to replay", () => {
  const disk = new Disk();
  const wal = new WAL(disk);

  wal.append("before1");
  wal.append("before2");
  wal.checkpoint();
  wal.append("after1");
  wal.append("after2");

  const out = wal.replay();
  expect(out.length).toBe(2);
  expect(dec(out[0])).toBe("after1");
  expect(dec(out[1])).toBe("after2");
});

// ── (e) compact() reclaims pre-checkpoint prefix; replay still correct ────────

test("compact() shrinks the buffer and replay still returns only post-checkpoint records", () => {
  const disk = new Disk();
  const wal = new WAL(disk);

  wal.append("pre1");
  wal.append("pre2");
  wal.checkpoint();
  wal.append("post1");

  const sizeBeforeCompact = disk.size;
  wal.compact();
  const sizeAfterCompact = disk.size;

  // Buffer must have shrunk
  expect(sizeAfterCompact).toBeLessThan(sizeBeforeCompact);

  // Replay still returns only post-checkpoint records
  const out = wal.replay();
  expect(out.length).toBe(1);
  expect(dec(out[0])).toBe("post1");
});
