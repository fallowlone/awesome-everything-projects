// TODO(you): implement a Thompson NFA regex engine.
//
// Public API (do NOT change these signatures):
//   compile(pattern: string): NFA   — parse pattern and build an NFA via Thompson construction
//   match(nfa: NFA, input: string): boolean — full-string match via set-of-states simulation
//
// Requirements:
//   - Supported operators: concatenation, alternation |, *, +, ?, grouping (), . (any char)
//   - Full-string match: the entire input must match, not a prefix
//   - MUST use set-of-states simulation (NOT recursive backtracking)
//   - Catastrophic-backtracking safety: (a*)*b on 30 'a's must return false in < 100 ms

export type NFA = unknown; // TODO: replace with your NFA data structure

export function compile(pattern: string): NFA {
  void pattern;
  throw new Error("TODO: implement Thompson NFA construction");
}

export function match(nfa: NFA, input: string): boolean {
  void nfa; void input;
  throw new Error("TODO: implement set-of-states simulation");
}
