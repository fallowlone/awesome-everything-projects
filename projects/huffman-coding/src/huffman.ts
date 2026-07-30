// TODO(you): implement Huffman coding.
//
// Types — do not change the signatures; the test suite imports them.

/** A Huffman tree node. Leaf nodes have `symbol` set; internal nodes do not. */
export type HuffTree =
  | { kind: "leaf"; symbol: string; freq: number }
  | { kind: "internal"; freq: number; left: HuffTree; right: HuffTree };

/**
 * Build a Huffman tree from a frequency map.
 * Tie-breaking rule (REQUIRED for determinism): when two nodes have equal
 * frequency, the node whose minimum symbol is lexicographically smaller wins.
 * For leaves that means the symbol itself; for internal nodes use the smallest
 * symbol reachable from that subtree.
 * Single-distinct-symbol edge case: return a leaf node directly (no merge needed).
 */
export function build(freqs: Record<string, number>): HuffTree {
  void freqs;
  // TODO: implement min-heap + greedy merge
  throw new Error("not implemented");
}

/**
 * Derive the prefix-free code table from a Huffman tree.
 * Returns a map from symbol to bit-string (e.g. { "a": "0", "b": "10", "c": "11" }).
 * Single-symbol tree: assign code "0".
 */
export function codes(tree: HuffTree): Record<string, string> {
  void tree;
  // TODO: DFS — left → "0", right → "1", emit at leaves
  throw new Error("not implemented");
}

/**
 * Encode a string to a bit-string using a pre-built code table.
 * Each character of the result is "0" or "1".
 */
export function encode(s: string, codeTable: Record<string, string>): string {
  void s; void codeTable;
  // TODO: concatenate code(s[i]) for each character
  throw new Error("not implemented");
}

/**
 * Decode a bit-string back to the original string by walking the Huffman tree.
 * Single-symbol tree (root is a leaf): emit the symbol for every bit.
 */
export function decode(bits: string, tree: HuffTree): string {
  void bits; void tree;
  // TODO: follow left/right branches, emit on leaf, reset to root
  throw new Error("not implemented");
}
