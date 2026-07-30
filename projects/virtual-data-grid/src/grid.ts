// TODO(you): implement the visible-range windowing function for a virtual data grid.
// Given scroll position, row height, viewport size, total row count, and overscan,
// return the slice of rows to render plus top/bottom padding spacers.
// No DOM access — pure math only.
export type GridInput = {
  scrollTop: number;
  rowHeight: number;
  viewportH: number;
  total: number;
  overscan: number;
};

export type GridRange = {
  start: number;   // index of first rendered row (inclusive)
  end: number;     // index after last rendered row (exclusive)
  padTop: number;  // px spacer above the rendered slice
  padBottom: number; // px spacer below the rendered slice
};

export function visibleRange(input: GridInput): GridRange {
  // TODO: implement windowing math.
  // Guard: if rowHeight <= 0 or not finite, return all-zero range (no throw).
  // first = floor(scrollTop / rowHeight)
  // start = max(0, first - overscan)
  // visible = ceil(viewportH / rowHeight)
  // end = min(total, first + visible + overscan)   // exclusive
  // padTop = start * rowHeight
  // padBottom = (total - end) * rowHeight
  // Invariant: padTop + (end - start) * rowHeight + padBottom === total * rowHeight
  void input;
  return { start: 0, end: 0, padTop: 0, padBottom: 0 };
}
