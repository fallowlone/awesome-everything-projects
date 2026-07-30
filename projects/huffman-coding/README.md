# Huffman Coding — starter

Implement the four functions in `src/huffman.ts` so the acceptance suite passes.

    bun test

Rules: `build` constructs a Huffman tree from a frequency map, `codes` derives the
prefix-free code table, `encode` maps a string to bits, `decode` recovers the original.
Break priority-queue ties deterministically (lower symbol wins). The suite checks
prefix-free property, frequency-vs-length order, round-trip, single-symbol edge case,
and compression ratio vs fixed-width. When it is green, read the rubric and push to
the senior bar (canonical codes, entropy bound analysis, bit-packing).
