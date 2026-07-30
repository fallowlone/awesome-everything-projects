# Command Palette — starter

Implement `fuzzyRank` and `reduce` in `src/palette.ts` so the acceptance suite passes.

    bun test

Rules: pure TypeScript logic only — no DOM, no browser APIs, no npm packages.

`fuzzyRank` must return only items whose characters contain the query as a
case-insensitive subsequence, sorted so prefix / contiguous matches rank above
scattered ones. Empty query returns all items in original order.

`reduce` must handle `down`, `up`, and `enter` actions with correct wrapping at
both ends and no out-of-range or NaN selected when the items list is empty.

When the suite is green, read the project page's rubric and push to the senior
bar: debounce re-ranking on each keystroke, keep the scoring function pure and
separately testable, and consider virtualizing a long command list.
