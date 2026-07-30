// TODO(you): implement a Bloom filter with injected, deterministic hash functions.
//
// BloomFilter(bits: number, hashes: Array<(s: string) => number>)
//   - bits  : total number of bits in the bit array (backed by Uint8Array)
//   - hashes: k hash functions; each maps a string to an integer (may be negative)
//
// Methods:
//   add(s: string): void
//     Set all k bit positions for s: pos_i = (Math.abs(h_i(s)) % bits)
//
//   has(s: string): boolean
//     Return true iff every one of the k bit positions for s is set.
//     A false result guarantees s was never added (no false negatives).
//     A true result means s was probably added (false positives possible).
//
//   fillRatio(): number
//     Return the fraction of set bits in the array: setCount / bits.
//     Must be 0.0 on a fresh filter and increase monotonically with inserts.

export class BloomFilter {
  constructor(_bits: number, _hashes: Array<(s: string) => number>) {
    // TODO: allocate Uint8Array of Math.ceil(_bits / 8) bytes,
    //       store _bits and _hashes for later use.
    void _bits; void _hashes;
  }

  add(_s: string): void {
    // TODO: for each hash function h in this.hashes,
    //       compute pos = (h(_s) >>> 0) % this.m   (or Math.abs(h(_s)) % this.m)
    //       set bit at pos: array[pos >> 3] |= (1 << (pos & 7))
    void _s;
  }

  has(_s: string): boolean {
    // TODO: for each hash function h in this.hashes,
    //       compute pos and check the bit; return false on first unset bit.
    void _s;
    return false;
  }

  fillRatio(): number {
    // TODO: count set bits across the Uint8Array and return count / this.m
    return 0;
  }
}
