# Huffman coding

Build a lossless compressor from scratch: construct the optimal prefix-free code tree bottom-up, derive the bit strings, and prove the round-trip is exact and the output is shorter than fixed-width encoding.

**Difficulty:** advanced · **Est. days:** 6 · **Stack:** typescript · **Tracks:** algorithms, data-engineering

## Deliverable

A TypeScript library that builds a Huffman tree from symbol frequencies, derives prefix-free codes, encodes a string to a bit string, and decodes it back — with a property test proving no code is a prefix of another and a compression test showing the encoded length beats fixed-width.

## Why this project

Huffman coding is the algorithm that taught the world how to turn frequency into structure: the rarer the symbol, the deeper the leaf, the longer the code — and the exchange argument proves this greedy assignment is information-theoretically optimal. Building it from scratch forces you to implement a min-heap, navigate tree invariants, reason about prefix-free codes, and measure the gap between your expected code length and the entropy lower bound. Every real compressor (DEFLATE, zstd, JPEG) has Huffman or an ANS variant at its core.

## Skills

- priority queue (min-heap)
- greedy tree construction
- prefix-free codes
- bit-string encode/decode
- information-theoretic optimality
- canonical Huffman codes

## Milestones

### 1. Count frequencies and build a min-heap priority queue

Huffman coding is a greedy algorithm that repeatedly merges the two lowest-frequency nodes, so the first structural decision is how to maintain that ordering efficiently. A naïve approach sorts after every merge and costs O(n² log n); a min-heap keeps the minimum at the root and restores the heap property in O(log n) per operation, giving O(n log n) total. Before coding the tree, implement a generic MinHeap<T> parameterised on a comparator — this forces you to separate the priority policy from the node type and makes the heap reusable for any future greedy algorithm. Count symbol frequencies from a plain string by iterating once (O(n)); initialise one heap node per distinct symbol; verify the heap correctly returns the node with the lowest frequency on each extraction. Think about tie-breaking now: if two nodes have identical frequencies the extraction order determines the tree shape and, thus, the code strings. Pick a stable, deterministic rule — for example, prefer the node with the lexicographically smaller symbol, or prefer leaf over internal node — and document it, because the round-trip test will depend on it.

**Definition of done:**

- A MinHeap<T> with insert and extractMin correctly returns nodes in ascending frequency order, with ties broken by a deterministic rule you can state.
- Given the string 'abracadabra', you can produce the frequency map and show the heap extraction order matches the expected greedy merge sequence.

**Self-review:** Show two test cases where different tie-breaking rules produce different trees; a senior reviewer checks you documented the rule and that both trees are valid Huffman trees (optimal for their respective orderings), not just that yours passes.

### 2. Build the Huffman tree by repeated greedy merge

With the min-heap ready, implement the classic Huffman construction: extract the two nodes with the lowest frequencies, create an internal node whose frequency is their sum, push that internal node back into the heap, and repeat until one node remains — that is the root. The algorithm is purely greedy and provably optimal by an exchange argument: if any other tree were better, you could swap its two deepest-sibling leaves with the two lowest-frequency symbols and reduce the expected code length, contradicting the assumption. The edge case that most implementations miss is the single-distinct-symbol alphabet (e.g. 'aaaa'): the loop never fires because only one node ever existed, so the root is a leaf, and you must assign it an explicit code (conventionally '0') so encoding and decoding still work. Another subtle point: your internal nodes do not carry a symbol — only leaves do. Make this a strict type invariant now, because the decode traversal relies on it.

**Definition of done:**

- build(freqs) returns a tree root where every leaf carries a symbol and every internal node has exactly two children, and the total weight (root frequency) equals the sum of all input frequencies.
- The single-distinct-symbol case ('aaaa') produces a tree with a leaf root, and codes() assigns it a valid non-empty code so round-trip works.

**Self-review:** Draw the tree for 'abracadabra' step by step (show each merge); a senior reviewer checks the merge sequence matches the heap ordering, the root weight equals the string length, and the single-symbol edge case is handled by the type system rather than a runtime check.

### 3. Derive prefix-free codes by tree traversal

Turn the tree into a code table by DFS: go left → append '0', go right → append '1', emit (symbol, accumulated-bits) at each leaf. The resulting codes are prefix-free by construction — no code is a prefix of another because codes only live at leaves, and any prefix of a leaf-path is an internal node. Prove this to yourself: if code A were a prefix of code B, you could follow A in the tree and reach a leaf, but then B's remaining bits would have to descend from a leaf, which has no children — contradiction. Write a property test that exhaustively checks all pairs in your code table: for every (a, b) pair where a ≠ b, assert that neither a.startsWith(b) nor b.startsWith(a). This is the most important correctness invariant in the whole project. Also verify that shorter codes go to higher-frequency symbols: Huffman's optimality guarantee states the code-length assignment is monotonically non-increasing with frequency, so if freq(x) > freq(y) then len(code(x)) ≤ len(code(y)). This is a second property test, and it catches tree-construction bugs that a round-trip alone would miss.

**Definition of done:**

- codes(tree) returns a symbol→bit-string map, and an exhaustive pair check confirms no code is a prefix of another for any input with ≥2 distinct symbols.
- For a known frequency distribution, a frequency-vs-length check confirms that a more-frequent symbol's code length is ≤ a rarer symbol's code length.

**Self-review:** Show the code table for 'abracadabra' and demonstrate the prefix-free property for the three pairs that share a common starting bit; a senior reviewer checks the property test covers all O(k²) pairs and not just adjacent ones.

### 4. Encode: map symbols to bit strings

Encoding is the straightforward half: look up each symbol in the code table, concatenate the bit strings, and return the result. The interesting questions are about what happens when you integrate this into a real compressor. First, the bit string you produce here is conceptual — each character is a '0' or '1', not a packed bit — which means your output is 8× larger than the raw bytes before you pack it. For this project a string-of-characters representation is fine because it lets you focus on the algorithm, but document the gap: a production encoder would pack bits into bytes, manage the final partial byte with a pad bit count, and prepend the code table (or a canonical form of it) as a header so the decoder can reconstruct without out-of-band knowledge. Second, your encode function takes a pre-built code table, not the original tree — this is intentional, because decoding needs the tree (to follow branches) while encoding only needs the leaf-label-to-bits map. Keep the two interfaces separate. Third, measure compression: count the total bit length of the encoded output and compare it with a fixed-width baseline of ceil(log2(alphabet_size)) bits per symbol. For any input with a skewed frequency distribution, Huffman's output must be strictly shorter — if it is not, your tree is wrong.

**Definition of done:**

- encode(s, codes) produces a bit-string where every character is '0' or '1', the length equals the sum of code lengths for each symbol in s, and no character outside the input alphabet is referenced.
- On a skewed distribution (e.g. 'a' × 100, 'b' × 50, 'c' × 10, 'd' × 1), the encoded bit length is strictly less than ceil(log2(4)) × 161 = 322 bits.

**Self-review:** Given the skewed frequency test, show the expected bit length calculation step by step (freq × code-length for each symbol, summed) and compare it with the fixed-width baseline; a senior reviewer checks you are computing the information-theoretic optimum, not just 'shorter than something'.

### 5. Decode: walk the tree bit by bit

Decoding is the inverse: start at the root, read one bit, descend left on '0' or right on '1', and emit the leaf's symbol whenever you reach a leaf, then reset back to the root. This traversal is O(output_length × average_code_length) and does not require a hash lookup, which is why the tree is the right data structure for decoding even though the map is right for encoding. The correctness of decoding is guaranteed by the prefix-free property: because no code is a prefix of another, the first leaf you hit is always unambiguously the intended symbol. If your prefix-free test from the previous milestone passes, decode is trivially correct given a correct implementation of the traversal. The interesting failure mode is the single-distinct-symbol case again: the root is a leaf with no children, so the 'descend on bit' loop never fires — you must special-case it to emit the symbol for every bit in the input. Write a round-trip property: for any string s built from a known alphabet, decode(encode(s, codes), tree) === s. This is your integration test, and it subsumes unit tests on both encode and decode individually.

**Definition of done:**

- decode(bits, tree) recovers the original string for a representative multi-symbol input, and the single-distinct-symbol path is exercised and correct.
- A round-trip test asserts decode(encode(s, codes), tree) === s for at least two structurally different inputs (balanced distribution vs skewed).

**Self-review:** Walk the decode loop manually for the first three symbols of 'abracadabra' showing the bit cursor and current tree node at each step; a senior reviewer checks the reset-to-root happens immediately after each leaf, not at the end of the string.

### 6. Optimality proof and canonical Huffman codes

Now that encode/decode works, reason about what 'optimal' actually means and how to make the code table transmissible without the tree. Huffman's algorithm minimises the expected code length E[L] = Σ freq(x) × len(code(x)), which equals the weighted path length from root to all leaves. The exchange argument proves this: in an optimal tree the two lowest-frequency symbols must be siblings at the deepest level — if they were not, you could swap them with the actual deepest siblings and reduce E[L], contradicting optimality. Entropy H(X) = -Σ p(x) × log₂(p(x)) is the lower bound: no uniquely decodable code can achieve expected length below H(X) bits per symbol. Compute both E[L] and H(X) for 'abracadabra' and compare — Huffman comes within a few percent. Next, canonical Huffman codes: reassign codes so that (a) codes of the same length are contiguous and (b) within a length group symbols are sorted alphabetically, and the codes themselves are assigned as consecutive integers in binary. The canonical form encodes the same lengths as the original tree but with shorter codes on average for transmission — you only need to send the symbol→length mapping (not the tree), and any decoder can reconstruct the canonical codes from that. Implement codes_canonical(tree) returning the canonical bit strings.

**Definition of done:**

- You can compute E[L] and H(X) for a given frequency distribution and show Huffman's E[L] is within 1 bit per symbol of entropy for 'abracadabra'.
- codes_canonical(tree) returns codes that are prefix-free, decode correctly via the standard canonical decode algorithm, and can be reconstructed from the symbol→length map alone.

**Self-review:** State the exchange argument for 'abracadabra' in one paragraph, name the two lowest-frequency symbols, confirm they are siblings in your tree, and explain why swapping them with any other pair would not decrease E[L]; a senior reviewer checks you are arguing about the tree structure, not just the bit strings.

## Rubric

### Tree construction & prefix-free codes

- **Junior:** A Huffman tree is built from sorted frequencies and codes are derived by DFS; ties are broken arbitrarily and the single-symbol edge case crashes or returns an empty code.
- **Mid:** A min-heap drives the merge loop; the tie-breaking rule is documented and deterministic; the single-symbol root gets an explicit '0' code; a prefix-free property test covers all O(k²) pairs.
- **Senior:** The code table is producible in canonical form from the symbol→length map alone; you compute E[L] and H(X) for a test input and show the gap is ≤ 1 bit per symbol; the exchange argument is stated, not just asserted.

### Encode/decode round-trip

- **Junior:** Encoding and decoding work for balanced frequency inputs; the single-symbol case silently produces wrong output and there is no round-trip property test.
- **Mid:** decode(encode(s, codes), tree) === s is asserted for at least two structurally different inputs; the single-symbol path is exercised in the test suite; encoding and decoding use separate data structures (map vs tree) as intended.
- **Senior:** The round-trip holds for adversarial inputs (all same symbol, two-symbol alphabet, 256-symbol alphabet); you can explain why the prefix-free property is both necessary and sufficient for unambiguous decoding — and you have a test that would catch a violation.

### Optimality & compression ratio

- **Junior:** The encoded output is shorter than the raw string in most cases; no comparison to fixed-width or entropy baseline is made.
- **Mid:** A compression test asserts that encoded_length < ceil(log2(|alphabet|)) × len(s) for a skewed distribution; frequency-vs-code-length order is verified: more-frequent symbols get shorter codes.
- **Senior:** E[L] is computed, compared with H(X), and the gap is shown to be ≤ 1 bit per symbol; canonical codes are implemented and verified to decode correctly from the symbol→length map without the original tree.

## Senior stretch

- Pack the bit string into actual bytes (LSB-first or MSB-first — your choice, documented): write a toBits(encoded: string): Uint8Array that packs 8 bits per byte with a pad-bit-count prefix, and a fromBits(data: Uint8Array): string inverse. Show that a compressed 'abracadabra' file is smaller than the raw UTF-8 file on disk.
- Implement a streaming encoder that processes one symbol at a time and flushes complete bytes as they fill — profile it against the batch version on a 1 MB input and reason about whether the algorithm is memory-bounded or CPU-bounded at that scale.
- Implement adaptive Huffman coding (FGK or Vitter algorithm): the tree updates online as symbols arrive, so the encoder and decoder stay in sync without a pre-scanned frequency table. Measure the compression ratio penalty versus two-pass Huffman on natural language text.
- Prove empirically the optimality boundary: generate random strings where the true entropy H(X) approaches log₂(k) (uniform distribution) and show that Huffman's E[L] converges to fixed-width encoding — the algorithm gains nothing on truly uniform input. Plot E[L]/H(X) as a function of frequency skew.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/huffman-coding
