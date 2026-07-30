# Virtual Data Grid — starter

Implement `visibleRange` in `src/grid.ts` so the acceptance suite passes.

    bun test

Rules: pure windowing math — no DOM, no network, no npm deps.
Given scroll position, row height, viewport size, total row count, and overscan,
return `{ start, end, padTop, padBottom }` where `end` is exclusive.

The suite checks top clamping, middle windowing, bottom clamping, the spacer
invariant (`padTop + renderedH + padBottom === total * rowHeight`), and the
zero-rowHeight guard. When it is green, read the project page's rubric and push
to the senior bar (variable row heights, overscan tuning, scroll-stutter incident).
