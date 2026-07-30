// TODO(you): implement an in-memory WAL with length-framed, CRC32-verified records.
//
// ARCHITECTURE:
//   Disk  — growable byte buffer with append(bytes), crashTruncate(offset), and a
//           read-only `data` view (Uint8Array).  No real filesystem I/O.
//   WAL   — wraps a Disk; writes [u32 length][u32 crc32(body)][body] per record.
//           replay() walks from checkpointOffset, verifies each CRC, stops at the
//           first incomplete/corrupt frame and returns all valid bodies before it.
//           checkpoint() advances the replay floor to the current end of log;
//           compact() trims the buffer to remove pre-checkpoint bytes.
//
// CRC32: implement inline using polynomial 0xEDB88320 (standard table-driven loop).

export class Disk {
  append(_bytes: Uint8Array): void {
    // TODO: grow the internal buffer.
    void _bytes;
  }
  crashTruncate(_offset: number): void {
    // TODO: lop off everything at or after offset (simulates a torn write).
    void _offset;
  }
  get data(): Uint8Array {
    // NOTE: must return a live view (not a copy) so callers can mutate bytes.
    return new Uint8Array(0); // TODO
  }
  get size(): number {
    return 0; // TODO
  }
}

export class WAL {
  constructor(_disk: Disk) {
    // TODO: store the disk reference and initialise checkpointOffset = 0.
    void _disk;
  }
  append(_body: Uint8Array | string): void {
    // TODO: encode body, compute CRC32, write [u32 len][u32 crc][body] to disk.
    void _body;
  }
  replay(): Uint8Array[] {
    // TODO: walk frames from checkpointOffset, verify each CRC, stop on corrupt/incomplete.
    return [];
  }
  checkpoint(): void {
    // TODO: set checkpointOffset = disk.size.
  }
  compact(): void {
    // TODO: slice off pre-checkpoint bytes from disk and reset checkpointOffset = 0.
  }
  get disk(): Disk {
    return new Disk(); // TODO: return the real disk reference.
  }
}
