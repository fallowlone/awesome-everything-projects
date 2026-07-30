# Trie autocomplete engine

Build a prefix tree that powers ranked autocomplete — insert words with weights, walk every prefix in O(prefix length + results), and handle tie-breaking deterministically without a database.

**Difficulty:** intermediate · **Est. days:** 4 · **Stack:** typescript · **Tracks:** algorithms, frontend

## Deliverable

A Trie class that inserts words with integer weights, answers has/startsWith in O(k), returns the top-k completions for a prefix ranked by weight descending then lexicographic ascending, and handles weight updates and missing prefixes correctly.

## Why this project

A trie is the textbook data structure for autocomplete, but building one correctly exposes three separate engineering challenges: getting the node design and memory layout right before any traversal, writing DFS that accumulates candidates without blowing the call stack on long strings, and producing a deterministic ranked output that stays correct when weights change without rebuilding. The memory trade-off analysis at the end bridges the algorithm to a real product decision — knowing when a flat Map beats a trie prevents over-engineering.

## Skills

- trie / prefix tree
- DFS traversal
- priority queue / heap
- lexicographic ordering
- weight aggregation

## Milestones

### 1. Design the node: children map, end flag, weight

Before any traversal, settle on the shape of a single TrieNode. The classic representation stores children as a fixed 26-slot array; the practical one uses a Map<string, TrieNode> (or a plain object) so the alphabet is open and memory scales with the actual character set, not the worst-case one. Each node needs three things: its children, a boolean that marks it as the terminus of a valid word, and the weight associated with that word (zero or absent when the node is not a terminus). The weight lives on the terminal node, not on the edge leading to it, because a prefix shares edges with many words and you cannot record all their weights on one edge. Choosing the wrong representation here forces a full rewrite in the next milestone, so reason through memory layout explicitly: a 26-slot array wastes 26 × pointer_size for every interior node even when only one child is present, which is fine at thousands of words but painful at millions. Document your choice and its trade-off before writing the class.

**Definition of done:**

- A TrieNode type or class is defined with children (Map or equivalent), an isEnd boolean, and a numeric weight field, and you have written a one-paragraph comment explaining why you chose your children representation over the alternative.
- The node design supports an open alphabet (non-ASCII characters can be stored) without code change, and you can argue why this matters for a real product autocomplete.

**Self-review:** Show your TrieNode definition and the comment justifying your children representation; a senior reviewer checks you accounted for memory per non-terminal node and that the weight field is on the terminal node, not spread across edges.

### 2. Insert and point lookup: insert, has, startsWith

Implement the three simplest operations and get their complexity guarantees exactly right. insert(word, weight) walks from the root, creating nodes as needed, then marks the final node as a terminus and records its weight. has(word) walks the same path and returns true only if the last node exists and is marked as a terminus — returning true for a stored prefix but not a full word is the classic off-by-one bug here. startsWith(prefix) is identical to has but stops at the prefix node and returns true if that node exists at all, regardless of isEnd — this is the operation that makes tries efficient for autocomplete. All three are O(k) where k is the length of the input string; a recursive implementation is fine but an iterative one avoids call-stack pressure for long strings. Weight update semantics: if insert is called twice on the same word, overwrite the weight rather than accumulating it — the test suite asserts this.

**Definition of done:**

- insert, has, and startsWith all pass the unit tests; has returns false for a word that is a strict prefix of a stored word (e.g. insert('apple'), then has('app') === false).
- Inserting the same word twice with different weights leaves the second weight, not the sum; you stated this update semantic in a comment.

**Self-review:** Walk the path for has('ap') after inserting only 'app' and 'apple'; a senior reviewer checks the return is false because 'ap' is not a terminus, and that startsWith('ap') returns true for the same trie because the 'p' node exists.

### 3. Collect all words under a prefix with DFS

Implement the subtree traversal that autocomplete is built on: given a prefix, navigate to the prefix node, then run a depth-first search from that node to collect every terminus with its word and weight. This is an O(prefix + subtree_size) operation — the subtree can be large (every word that shares the prefix), so the DFS must not allocate per-node structures beyond the recursion stack or a small queue; just accumulate (word, weight) pairs. Building the candidate word as you recurse is a standard trick: pass the accumulated string down the DFS rather than reconstructing it from the path. A missing prefix (no node for the last character) must return an empty collector, not throw — this is the case autocomplete sees on every keypress before the user has typed a recognized prefix. The output of this step is an unsorted array of all matching (word, weight) pairs; ranking happens in the next milestone.

**Definition of done:**

- A private helper collectFrom(node, prefix) returns every (word, weight) pair reachable from that node via DFS, and autocomplete('', k) returns all inserted words.
- autocomplete on an unknown prefix returns [] without throwing, and the unsorted candidate list for 'ap' after inserting 'apple', 'app', 'apt' contains exactly those three words.

**Self-review:** Show the DFS helper signature and explain why accumulating the word string on the way down is more efficient than reconstructing it from parent pointers; a senior reviewer checks the empty-prefix case returns all words and that a non-existent prefix returns [].

### 4. Rank and cap: autocomplete(prefix, k) with deterministic tie-breaking

Turn the unsorted candidate list from the previous milestone into a ranked, capped result. Sort the collected (word, weight) pairs by weight descending, and when weights are equal, by word lexicographically ascending — this tie-breaking rule is what makes autocomplete output predictable across runs and test-able with exact assertions. Take only the first k pairs and return their words as a string array. The naive approach — collect all, sort all, slice — is correct and fine for thousands of words. At senior depth you should recognize when a min-heap of size k beats the sort: if the subtree has N words, collecting all then sorting is O(N log N); maintaining a k-size heap during the DFS is O(N log k) and avoids materializing the full candidate list, which matters when k << N. Implement the naive sort first, then state the heap alternative as a comment rather than premature-optimizing.

**Definition of done:**

- autocomplete(prefix, k) returns at most k words, sorted by weight descending, with lexicographic ascending as a tiebreaker — the test suite asserts this exact ordering for equal-weight words.
- You added a comment explaining the O(N log k) heap alternative and when it matters, without implementing it yet.

**Self-review:** Give the output of autocomplete('a', 2) after inserting ('apple', 3), ('ant', 3), ('apt', 5); a senior reviewer checks the result is ['apt', 'ant'] — top weight first, then lexicographic among equals, capped at k=2.

### 5. Weight updates and re-ranking consistency

Make the trie respond correctly to weight changes and deletions without rebuilding. Calling insert on an already-stored word must overwrite its weight in place (the node already exists, just update its weight field), and the change must immediately be reflected in the next autocomplete call without any cache invalidation step — because there is no cache; the DFS recomputes rankings on each call. Deletion (if you choose to implement it) is trickier: you must clear the isEnd flag and zero the weight, then optionally prune leaf nodes that have no valid-word descendants to save memory, but pruning is not required for correctness. The subtle bug to avoid is stale aggregate state: some trie implementations cache a 'max weight in subtree' on interior nodes to prune DFS early; if you do that, a weight update must propagate the new maximum up the ancestor chain. Decide upfront whether you want that optimization and what consistency invariant you commit to maintaining.

**Definition of done:**

- Inserting a word twice with different weights reflects the second weight in subsequent autocomplete calls, proven by a test that inserts ('apple', 1), then ('apple', 10), then asserts 'apple' appears first when competing with a weight-5 word.
- You stated in a comment whether the implementation caches any per-subtree aggregate state and, if so, what update propagation rule maintains it.

**Self-review:** Show the test that proves weight re-insertion is a replacement, not an accumulation; a senior reviewer checks the test isolates this by comparing autocomplete output before and after the re-insert and that no rebuild of the trie is performed between the two inserts.

### 6. Memory trade-off analysis: flat Map vs compressed trie

Benchmark your implementation against a flat Map alternative and articulate when one beats the other. A flat Map<string, number> (word → weight) supports insert and has in O(k) hash time, autocomplete in O(N × k) scan-all time, where N is the total word count. For small dictionaries the flat Map often wins on memory because a trie allocates one node per character, not one entry per word. The trie wins when prefix queries are frequent and the dictionary is large: O(prefix + results) beats O(N) for autocomplete when N >> results. Measure peak node count after inserting a realistic word list (e.g. 5 000 English words), compute approximate memory per node (Map entry ≈ 64 bytes on V8, node with Map children ≈ 96–128 bytes), and write a comment stating the crossover point — the word count and query pattern at which the trie starts paying for itself in query speed vs memory overhead. This is the kind of analysis a senior engineer does before choosing a data structure in production.

**Definition of done:**

- A written comment or brief document states: (a) node count after inserting a representative word list, (b) approximate memory per node vs per flat-Map entry, and (c) the query-pattern or word-count threshold where the trie is the better choice.
- You can name one scenario where a compressed/radix trie would halve the node count compared to your uncompressed implementation and explain the implementation cost of that compression.

**Self-review:** Paste the comment with node count and the crossover threshold; a senior reviewer checks the estimate is backed by a real measurement (not a guess) and that the radix-trie scenario names a concrete input pattern (e.g. long shared prefixes like URLs or file paths) where compression helps.

## Rubric

### Trie structure & lookup

- **Junior:** A TrieNode is defined and insert walks the tree creating nodes; has and startsWith both return true for any word or prefix that was inserted, but has does not distinguish a full word from a stored prefix.
- **Mid:** has checks isEnd on the terminal node so has('ap') is false even when 'apple' is stored; startsWith returns true for any prefix whose node exists regardless of isEnd; insert overwrites the weight on a duplicate rather than accumulating it.
- **Senior:** The node representation is justified in a comment against the 26-slot array alternative with a concrete memory estimate per interior node; you can name the crossover word count where a compressed trie would justify its implementation cost.

### Prefix traversal correctness

- **Junior:** autocomplete navigates to the prefix node and collects words; a non-existent prefix throws or returns undefined instead of [].
- **Mid:** DFS accumulates the word string on the way down; a non-existent prefix returns []; autocomplete('', k) returns all inserted words; the candidate list for a shared prefix contains exactly the right words.
- **Senior:** You stated the O(N log k) heap alternative in a comment and can argue when it beats the sort-all approach; you measured node count after inserting a real word list and derived the trie-vs-flat-Map crossover threshold from it.

### Ranking & scaling

- **Junior:** autocomplete returns words under the prefix, but the order is non-deterministic or always lexicographic without regard to weight.
- **Mid:** Results are sorted weight-descending then lexicographic-ascending; k caps the result count; equal-weight words always appear in a consistent alphabetical order proven by a test with two equal-weight words.
- **Senior:** Weight re-insertion is a replacement (not accumulation) and re-ranks immediately on the next call; you can argue the O(prefix + N log k) total complexity for the heap variant and name a production scenario (fast-updating suggestion corpus) where it matters.

## Senior stretch

- Replace the sort-all ranking with an O(N log k) DFS that maintains a min-heap of size k, so you never materialise the full candidate list — benchmark it against the naive sort on a 100 000-word trie and report the speedup at k=5 vs k=1000.
- Implement a compressed (Patricia/radix) trie variant that merges single-child chains into one edge label, and measure the node-count reduction and the change in insert/lookup complexity for a real English-word corpus.
- Add a delete(word) operation that clears the terminus flag, zeroes the weight, and prunes unreachable leaf nodes — prove that the trie's node count after inserting then deleting N words equals the node count of an empty trie.
- Cache maxWeightInSubtree on every interior node and use it to prune DFS branches that cannot contribute to the top-k result — ensure a weight update propagates the new maximum to all ancestors and write a test that proves a pruned branch would have changed the result without the cache.
- Serialise and deserialise the trie to/from a compact binary format (e.g. a BFS-order array of (parentIndex, character, isEnd, weight) tuples) and benchmark cold-load time vs building from scratch on a 50 000-word dictionary.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/trie-autocomplete
