// TODO(you): implement fuzzy ranking and keyboard-state reducer for a command palette.
// No DOM, no browser APIs, no npm deps — pure TypeScript logic only.

/**
 * Returns only the items whose characters contain `query` as a subsequence
 * (case-insensitive), sorted best-first.
 * A prefix / contiguous match ranks above a scattered subsequence.
 * Empty query returns a copy of items in their original order.
 */
export function fuzzyRank(items: string[], query: string): string[] {
  void items; void query;
  return []; // TODO
}

export type PaletteState = { items: string[]; selected: number };
export type Action = { type: "down" } | { type: "up" } | { type: "enter" };

/**
 * Pure reducer for palette keyboard navigation.
 * down:  selected = items.length ? (selected + 1) % items.length : 0
 * up:    selected = items.length ? (selected - 1 + items.length) % items.length : 0
 * enter: no-op (commit is handled outside)
 * Must never throw or produce NaN / out-of-range selected.
 */
export function reduce(state: PaletteState, action: Action): PaletteState {
  void action;
  return state; // TODO
}
