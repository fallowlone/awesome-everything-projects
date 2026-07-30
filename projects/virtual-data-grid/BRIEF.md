# Virtual data grid

Render and smooth-scroll 100k rows at 60fps with windowing/virtualization, sticky headers, and full keyboard navigation — no library, just math.

**Difficulty:** advanced · **Est. days:** 5 · **Stack:** preact, typescript · **Tracks:** frontend, performance

## Deliverable

A grid that loads 100k rows in under 200ms, scrolls at a steady 60fps measured in DevTools, and supports arrow-key cell focus with row selection.

## Why this project

Most grids reach for a library and hide the hard part: DOM recycling, scroll-position math, and accessibility. You'll build the whole thing from primitives — virtualization loop, overscan, sticky headers, and a proper ARIA grid role with full keyboard control. The Fenwick tree stretch turns it from a demo into a production component.

## Skills

- DOM virtualization
- overscan tuning
- scroll event batching
- keyboard accessibility (ARIA grid)

## Milestones

### 1. Window the rows: render only what's on screen

A naive table mounts one DOM node per cell, so 100k rows × 8 columns is 800k+ nodes — layout alone blows past the 16ms frame budget and the tab stalls before the first paint. Windowing fixes this: a tall scroll spacer reserves total height (rowCount × rowHeight), an absolutely-positioned viewport renders only the slice the scrollTop intersects, and you recompute startIndex = floor(scrollTop / rowHeight) on each scroll. With a 600px viewport and 32px rows that's ~19 visible rows; add an overscan buffer of 4–8 rows above and below so a fast flick doesn't expose blank gaps before the next frame paints. The whole point is keeping the live node count near 30 instead of 800k, so each frame's style+layout+paint fits inside 16ms.

**Definition of done:**

- At any scroll position the DOM holds only visible rows plus the overscan buffer (verify the node count in DevTools — it stays flat, not 100k).
- The scrollbar reflects the full 100k-row height and startIndex maps scrollTop to the correct first row with no drift after a long scroll.

**Self-review:** A senior reviewer scrolls to row 90,000, opens the DevTools element count, and confirms it's still ~30 nodes; they check that overscan is symmetric and that a fast flick never paints a blank band.

### 2. Variable row heights with a measurement cache

Real rows wrap text and grow, so the fixed-rowHeight math breaks: floor(scrollTop / rowHeight) no longer points at the right row, and total height is a guess. You need a measurement cache — measure each row's real height once (after it mounts, via ResizeObserver or offsetHeight), store it, and use an estimated height for rows you haven't seen yet. Map scrollTop → startIndex with a prefix-sum/binary search instead of division; a Fenwick (binary-indexed) tree gives O(log n) offset queries and O(log n) updates when one row remeasures, versus O(n) for a flat prefix array rebuilt on every change. The tradeoff: estimates make the scrollbar 'breathe' as real heights land, so anchor the visible row on remeasure to avoid scroll jumps, and cap the cache (100k entries × a few bytes is fine; don't also retain detached DOM).

**Definition of done:**

- Rows of differing heights position correctly and the offset query for any index is O(log n) (Fenwick tree or equivalent), not a full prefix-array rebuild.
- Remeasuring a visible row keeps it anchored under the viewport (no scroll jump), and the measurement cache holds heights only — no retained detached nodes.

**Self-review:** A senior reviewer drops in rows of mixed heights, scrolls deep, and checks the scrollbar doesn't jump on remeasure; they inspect the offset-query complexity and confirm the cache isn't pinning detached DOM (heap snapshot).

### 3. Column virtualization and frozen columns

A wide grid (say 60 columns) hits the same node explosion horizontally: 30 visible rows × 60 columns is 1,800 cells, but only ~12 columns are on screen. Virtualize the X axis the same way — track scrollLeft, compute the visible column window, and offset each cell by its column's cumulative left. Frozen (pinned) columns are the hard part: the first one or two columns must stay put while the rest scroll, so they live in a sticky layer with a higher z-index and the scrolling body's left padding accounts for their width. The tradeoff is composability — frozen + horizontal virtualization means two coordinate systems (pinned vs scrolling) that must agree on row height and selection, and a wrong z-index or transform makes pinned cells bleed under the body during a fast scroll.

**Definition of done:**

- Only the horizontally visible columns (plus overscan) render, and scrolling left/right recycles cells the same way rows do.
- One or two frozen columns stay pinned during both vertical and horizontal scroll, with no z-index bleed and correct alignment to the scrolling rows.

**Self-review:** A senior reviewer scrolls diagonally at speed and checks pinned columns never tear or bleed under the body, that horizontal recycling matches vertical, and that pinned and scrolling layers agree on row height and selection.

### 4. Server-side data: paging, sort, and filter

100k rows in the browser is fine for a demo; in production the data lives on a server and you can't ship it all. Switch to windowed fetching: as the visible window moves, request the slice you need (offset/limit or, better, keyset/cursor pagination so deep pages don't degrade), keep a page cache keyed by range, and render skeleton rows for ranges in flight so scrolling never blocks on the network. Push sort and filter to the server — sorting 100k rows client-side is an O(n log n) main-thread stall, and the server can ride an index — which means a sort/filter change invalidates your cached pages and resets the window. The tradeoff is latency vs. correctness: prefetch the next window to hide round-trips, but debounce filter input and cancel stale requests so a fast typer doesn't render results from an abandoned query.

**Definition of done:**

- Scrolling fetches only the visible range (cursor/keyset paging), shows skeletons for in-flight ranges, and serves repeat ranges from a page cache.
- Sort and filter run server-side; changing them invalidates the cache, resets the window, and stale in-flight responses are cancelled (no flicker of abandoned results).

**Self-review:** A senior reviewer types fast into the filter and changes sort mid-scroll, then checks the network panel for cancelled stale requests, no abandoned-result flicker, and that cached ranges aren't re-fetched.

### 5. Editing, selection, and an accessible ARIA grid

A virtualized grid is hostile to screen readers and keyboards by default: rows that aren't in the DOM don't exist to assistive tech, and focus vanishes when the focused cell scrolls out and unmounts. Build the real ARIA grid pattern — role="grid" / "row" / "gridcell", aria-rowcount/aria-colcount set to the full 100k (not the rendered slice), and aria-rowindex on each rendered row so a reader announces "row 90,000 of 100,000". Implement roving tabindex: exactly one cell is tabbable, arrow keys / Page Up-Down / Home-End move focus, and when the focused cell scrolls out you must restore focus to its element when it remounts (track focus by row/col index, not by DOM node). Layer range/multi-row selection (Shift+click, Shift+Arrow, Ctrl/Cmd toggle) and inline cell editing (Enter to edit, Escape to cancel, commit on blur) on top. The tradeoff senior engineers miss: virtualization and accessibility fight each other, and the fix is making focus and selection live in data state, with the DOM as a disposable projection of it.

**Definition of done:**

- The grid exposes role/aria-rowcount/aria-colcount/aria-rowindex for the full dataset, and a screen reader announces the absolute row number, not the rendered index.
- Keyboard focus survives scrolling: focusing a cell, scrolling it out and back, restores focus to it via roving tabindex (focus tracked by index, not node).
- Range/multi-row selection and inline edit (Enter/Escape/commit-on-blur) work entirely from the keyboard and persist across virtualization unmounts.

**Self-review:** A senior reviewer navigates the whole grid with the keyboard only and a screen reader on, checking absolute row announcements, focus restoration after scroll-out, and that selection/edit state lives in data — not lost when a row unmounts.

### 6. 100k-row perf budget: profile, INP, and a scroll-stutter incident

Now make it provably fast and then break it on purpose. Set a budget: initial mount of 100k rows under 200ms, steady 60fps (≤16ms frames) during a sustained scroll, and INP under 200ms for cell focus/edit interactions. Profile in Chrome Performance — a flamechart of a scroll should show no long tasks (>50ms); the usual culprits are synchronous layout reads inside the scroll handler (layout thrash), per-frame allocations feeding GC pauses, and unbatched state updates. Fix scroll handling by reading scroll state and writing DOM in the right phase (requestAnimationFrame, not on every scroll event), and batch the window recompute. Then the incident: a teammate's 'harmless' change — adding a getBoundingClientRect() read inside the row render, or dropping the rAF batch — reintroduces a scroll-stutter regression that only shows under sustained fast scroll on 100k rows. Reproduce it, catch it in a profile (forced reflow / long task), localize the offending span, fix it, and write a short regression note so it can't silently come back.

**Definition of done:**

- A Chrome Performance trace of a sustained scroll over 100k rows shows steady ≤16ms frames with no long tasks, and you recorded mount time (<200ms) and interaction INP (<200ms).
- You reproduced the scroll-stutter regression, identified the forced-reflow/long-task span in a profile, fixed it (rAF batching / no layout read in render), and confirmed frames returned to budget.
- A short regression note names the trigger (the layout read / missing rAF batch), the symptom (frames over 16ms under fast scroll), and the guard that prevents it recurring.

**Self-review:** Paste your scroll profile and regression note; a senior reviewer checks the flamechart genuinely shows ≤16ms frames with no long tasks, that the root cause names the layout-read/rAF mechanism (not just 'it was slow'), and that the guard would actually catch the regression again.

## Rubric

### Range math correctness

- **Junior:** Computes first and visible count correctly for the happy path at scrollTop=0 with uniform row heights. Overscan is hardcoded or absent.
- **Mid:** Implements first=floor(scrollTop/rowHeight), start=max(0,first-overscan), visible=ceil(viewportH/rowHeight), end=min(total,first+visible+overscan), padTop/padBottom from the row counts. All five acceptance cases pass, including the spacer invariant.
- **Senior:** Justifies the ceil vs floor choice for viewportH/rowHeight (ceil prevents a blank gap at the bottom of the viewport when scrollTop is not row-aligned), states the worst-case rendered count (visible+2*overscan rows), and can prove the spacer invariant algebraically.

### Boundary clamping

- **Junior:** Handles scrollTop=0 without negative start. Does not handle the bottom boundary, so end can exceed total.
- **Mid:** Both clamps are correct: start=max(0,…) prevents a negative index, end=min(total,…) prevents out-of-bounds. padBottom is exactly 0 when end===total. The rowHeight<=0 guard returns a zero range without throwing.
- **Senior:** Defends the guard choice (return zero range rather than throw) for use in a React render path where exceptions bypass error boundaries unexpectedly, and extends the analysis to scrollTop>total*rowHeight showing both clamps activate simultaneously.

### Jank avoidance and overscan tuning

- **Junior:** Adds a fixed overscan (e.g. 2 rows) above and below without reasoning about scroll velocity.
- **Mid:** Recomputes the range only when start or end changes (not on every pixel of scroll), keeping frame work proportional to range changes rather than scroll distance. Explains the tradeoff: larger overscan means more DOM nodes alive but fewer blank flashes on fast scroll.
- **Senior:** Derives an overscan formula from scroll velocity and expected frame budget: overscan_rows >= scrollVelocity_px_per_frame / rowHeight, where scrollVelocity is measured with a rolling average over recent scroll events. Shows how a too-small overscan at 60fps and 30px/frame requires ≥2 rows; at 5× scroll speed it needs ≥10. Also notes that recomputing the range inside requestAnimationFrame (not the scroll handler) keeps the computation off the critical event path.

## Senior stretch

- Render the grid on a canvas (or WebGL) layer instead of DOM cells: you trade ARIA semantics for a single composited surface that never thrashes layout — then reintroduce accessibility via an off-screen DOM mirror.
- Add a virtualized tree/grouping mode: collapsible row groups where expand/collapse mutates the offset index in O(log n) and the measurement cache survives group toggles.
- Support RTL and i18n: mirror the horizontal-scroll and frozen-column math for right-to-left, and handle locale-aware sorting/formatting without breaking the column-virtualization offsets.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/virtual-data-grid
