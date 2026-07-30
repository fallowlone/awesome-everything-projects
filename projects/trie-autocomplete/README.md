# Trie Autocomplete — starter

Implement `Trie` in `src/trie.ts` so the acceptance suite passes.

    bun test

Rules: children = Map (open alphabet), weight on terminal node, `has` checks
`isEnd`, `startsWith` ignores it, `autocomplete(prefix, k)` returns ≤k words
ranked weight-DESC then lexicographic-ASC. When green, read the rubric and
push to the senior bar (heap ranking, radix compression, serialisation).
