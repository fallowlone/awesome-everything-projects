# Regex engine

Build a regular expression engine from scratch using Thompson NFA construction and subset simulation — the same technique that makes grep and re2 immune to catastrophic backtracking.

**Difficulty:** advanced · **Est. days:** 7 · **Stack:** typescript · **Tracks:** algorithms, js-engine

## Deliverable

A regex engine that compiles patterns to a Thompson NFA and matches via set-of-states simulation, supports concatenation, alternation `|`, `*`, `+`, `?`, grouping `()`, and `.`, runs full-string match in O(m·n) time, and provably never hangs on pathological inputs like `(a*)*b` against a long string of 'a's.

## Why this project

Building a regex engine from scratch with Thompson NFA construction is one of the clearest paths through automata theory to a working artifact that outperforms the production tools in the one dimension that matters most: safety. Every major production regex library — re2, Google's RE2, grep, Rust's regex crate — uses this approach because it eliminates catastrophic backtracking by design. You will parse a pattern into an AST, convert the AST to an NFA using Thompson's fragment-composition rules, then simulate the NFA by tracking all possible states in parallel rather than one path at a time. The result is provably linear in the product of pattern length and input length — no pathological input can make it hang.

## Skills

- recursive-descent parsing
- NFA construction (Thompson)
- epsilon-closure
- subset simulation
- linear-time guarantee

## Milestones

### 1. Parse the pattern into an AST

Before any automaton, you need a concrete syntax tree. A regex pattern is a context-free grammar: alternation (`a|b`) binds loosest, then concatenation (juxtaposition), then postfix quantifiers (`*`, `+`, `?`), then atoms (literal, `.`, or group `(...)`). A clean recursive-descent parser handles this in four mutually recursive functions — parseAlternation, parseConcatenation, parseQuantifier, parseAtom — with the precedence built into the call stack, not a precedence table. Why not a hand-rolled precedence-climbing or Pratt parser? Because this grammar is small enough that recursive descent is self-documenting and the call depth mirrors the precedence hierarchy perfectly. The AST nodes you need: Literal(char), AnyChar, Concat(left, right), Alter(left, right), Star(child), Plus(child), Optional(child). Keep the tree purely structural with no regex-specific logic — that belongs in the NFA builder, not the parser.

**Definition of done:**

- The parser correctly handles nested groups, all quantifiers, alternation with multiple branches, and `.`; it rejects unbalanced parentheses and unknown tokens with a clear error message.
- The AST for `(ab|cd)*` is inspectable in a test: a Star wrapping an Alter of two Concats, with no NFA state IDs or transitions present at this layer.

**Self-review:** Walk the parser through `a?b|c+` and trace which recursive function handles each character; a senior reviewer checks that precedence is correct (quantifier binds tighter than concat, concat tighter than alter) and that the grammar does not use a global precedence table.

### 2. Build a Thompson NFA from the AST

Thompson's 1968 construction converts a regex AST to an NFA by composing small, well-defined NFA fragments: each node type produces a fragment with exactly one start state and one accept state, connected by labeled transitions (character or epsilon). The composition rules are: Literal — one transition on that char; Concat(A, B) — epsilon from A's accept to B's start; Alter(A, B) — a new start with epsilons to both A and B starts, and epsilons from both accepts to a new accept; Star(A) — a new start/accept plus epsilons that let you skip A entirely or loop back; Plus(A) = Concat(A, Star(A)); Optional(A) = Alter(A, ε-fragment). The result is always an NFA with O(m) states and O(m) transitions for a pattern of length m. Never generate more than 2 states per AST node — Thompson's construction guarantees this bound. The construction must be purely data (states + transitions); the simulator comes next.

**Definition of done:**

- Each AST node type maps to an NFA fragment with at most 2 new states; you can dump the state/transition table for a small pattern and trace every epsilon and character edge by hand.
- The NFA for `(ab|cd)*` has at most 18 states (2 per character, 2 per Alter, 2 per Star) — confirm the count in a test.

**Self-review:** Draw the NFA fragment for `a|b` — two character transitions, a shared start, a shared accept — and explain why Thompson's construction never needs more than 2 new states per operator; a senior reviewer checks no state is reused across fragments (fresh state IDs only).

### 3. Simulate: epsilon-closure and set-of-states

Simulation is the payoff of Thompson's construction. Instead of following one path at a time (recursive backtracking), you maintain a set of all states the NFA could currently be in and advance the entire set together on each input character. The algorithm: (1) compute the epsilon-closure of the start state — all states reachable by zero or more epsilon transitions; (2) for each character in the input, find all states reachable by a character transition from any state in the current set, then take the epsilon-closure of the result; (3) after consuming the whole input, accept iff the accept state is in the final set. The set-of-states representation is what delivers linear time: each state is visited at most once per input character, so total work is O(m·n) where m is the number of NFA states and n is the input length. No recursion, no backtracking, no stack — just BFS over the epsilon edges and a bitset or Set of state IDs. Full-string match means you must consume all characters and end in the accept state; do not accept a prefix.

**Definition of done:**

- Literal patterns match exactly and reject near-misses; `.` matches any single character; the empty string is correctly handled (accepted or rejected based on the pattern).
- `a*` matches the empty string and any run of 'a's; `a+` rejects the empty string and matches one or more 'a's; `a?b` matches both 'b' and 'ab'.

**Self-review:** Trace the set-of-states evolution for matching 'ab' against pattern `(a|b)*` — list the exact set after each character; a senior reviewer checks the epsilon-closure is computed after every character step, not just at the start.

### 4. Quantifiers: `*`, `+`, `?` and their edge cases

Each quantifier has a subtly different NFA shape and a different set of inputs that must be proven correct. `*` (zero or more) must accept the empty string, 'a', 'aaa', and 'aaabbb' against `(ab)*` — the last must reject because 'aaabbb' is not a sequence of 'ab' pairs. `+` (one or more) is Concat(A, Star(A)) in the NFA: it must reject the empty string but accept 'a' and 'aaa'. `?` (zero or one) is Alter(A, empty): must match 'b' and 'ab' against `a?b`, but reject 'aab'. The edge cases that catch bugs: a quantifier over a group, e.g. `(ab)+`, which requires the group's NFA fragment to be used exactly once in Plus but the loop to wrap the whole group; nested quantifiers, e.g. `a*?` or `(a+)*`; and the empty-pattern case. Work through each quantifier with at least three acceptance and three rejection inputs before declaring done.

**Definition of done:**

- `(ab|cd)*` matches the empty string, 'ab', 'cdab', 'abcdab'; it rejects 'abc', 'a', 'abcd' (not a complete pair sequence).
- Nested quantifier `(a+)*` is handled without error — the NFA is built, simulation terminates, and inputs are matched correctly.

**Self-review:** Show the Thompson NFA fragment for `a+` as a state diagram — explain how Plus reuses the fragment for `a` rather than copying it, and why that matters for state-count linearity; a senior reviewer checks Plus is Concat(fragment, Star(fragment)) using the same physical states, not a copy.

### 5. Alternation `|` and grouping `()`

Alternation is the operator that most clearly demonstrates why Thompson NFA beats backtracking. A backtracking engine evaluating `(a|a)*b` against a long input of 'a's followed by no 'b' tries every exponential combination of which branch to take on each iteration before failing. The Thompson NFA collapses all branches into a single set of states: when the current set expands via an Alter node's epsilon transitions, both branches are added at once — the engine never commits to one branch and never backtracks. The implementation of Alter: one new start state with epsilon transitions to both A and B starts, and one new accept state with epsilon transitions from both A and B accepts. Groups `(...)` are transparent to NFA construction: parse them into a subtree and pass to the builder recursively; no special 'group' node is needed (capture groups are a separate concern you are explicitly not implementing). Test that `(cat|dog)` matches 'cat' and 'dog', rejects 'ca' and 'cats', and that deeply nested alternation like `((a|b)|(c|d))` is handled.

**Definition of done:**

- `(cat|dog)` matches 'cat' and 'dog'; rejects 'ca', 'cats', 'do', 'dogs'.
- Alternation inside a Star, e.g. `(ab|cd)*`, works correctly for inputs of mixed pairs — proving the set-of-states approach handles the cross-product of branch choices without enumeration.

**Self-review:** Explain why `(a|b)*` against input 'abba' visits exactly 4 · (NFA states) operations and not 2^4 — trace which states are in the set after each character; a senior reviewer checks the set never grows to contain duplicate state IDs and that alternation branches coexist in one set rather than being explored sequentially.

### 6. Linear-time guarantee: no catastrophic backtracking

The final milestone is proving what you have built, not just that it works on typical inputs but that it cannot be made to hang. Catastrophic backtracking afflicts engines that track one path at a time: `(a*)*b` against 'aaaa...a' (no b) causes exponential exploration because the engine must try every way to partition the 'a's among the nested stars before concluding failure. Your Thompson NFA is immune: the set-of-states simulation visits each state at most once per input character, so the worst case for pattern of m states and input of length n is exactly m·n state-visits. Prove it with a timing or step-count test: compile `(a*)*b` (or `(a|a)*b`) and match it against a string of 30+ 'a's followed by no 'b'; the match must complete and return false without hanging, in linear time, not exponential. Add a comment to the simulation loop explaining why adding a state to the current-set that is already present is a no-op — this is the mechanism that caps the set size at m and makes linear time possible. Compare this explicitly to how a PCRE or JS RegExp `/((a*)*b)/` hangs on the same input.

**Definition of done:**

- A test compiles `(a*)*b` (or `(a|a)*b`) and calls `match(nfa, 'a'.repeat(30))` — it returns `false` within 100 ms on any reasonable machine, proving linear-time behavior.
- The simulation loop contains a guard that skips adding a state already in the current set, and a comment explains that this cap is what prevents exponential blowup.

**Self-review:** Show the timing test result for `(a*)*b` against 'a'.repeat(30) and explain in one paragraph why a PCRE-style backtracking engine is exponential on this input while your NFA simulation is not; a senior reviewer checks the explanation names the state-set deduplication as the mechanism, not just 'NFA is better'.

## Rubric

### Parser & NFA construction

- **Junior:** A hard-coded or ad-hoc parser handles a few cases; the NFA is built by hand or with no clear fragment-composition rules — the construction does not generalize to new operators.
- **Mid:** A recursive-descent parser builds a correct AST with proper operator precedence; the NFA builder applies Thompson's fragment rules for all required operators and generates at most 2 states per AST node.
- **Senior:** You can state the state-count bound O(m) and transition-count bound O(m) for a pattern of length m, verify it with a state-counting test, and explain why Plus reuses the sub-fragment rather than copying it (a copy would double the state count and break the linearity guarantee).

### Simulation correctness

- **Junior:** Matching works for simple literal patterns; it fails or produces wrong results for patterns with quantifiers or alternation applied to groups.
- **Mid:** Epsilon-closure is computed correctly before and after each character step; all operators (`*`, `+`, `?`, `|`, `.`, grouping) match accepted inputs and reject near-misses in the test suite.
- **Senior:** Full-string match is enforced (not prefix match): the simulation consumes all input and checks accept-state membership only at the end. You can trace the set-of-states for a medium pattern character by character and predict the accept/reject outcome before running the code.

### Linear-time guarantee (no catastrophic backtracking)

- **Junior:** The engine uses recursive backtracking or DFS over the NFA — it produces correct results on typical inputs but hangs or is very slow on `(a*)*b` against 30+ 'a's.
- **Mid:** The simulation maintains a deduplicated set of states and advances the full set on each character; `(a*)*b` against 30+ 'a's returns false quickly.
- **Senior:** You provide a timing or step-count test that demonstrates sub-millisecond termination for `(a*)*b` on 30+ 'a's, name the deduplication guard as the mechanism, and explain why a PCRE-style engine is exponential on the same input — citing the specific branching factor (number of ways to partition n 'a's among k nested star levels).

### Code clarity and extensibility

- **Junior:** The parser, NFA builder, and simulator are tangled in one function or module with no clear separation of concerns.
- **Mid:** Parser, AST types, NFA builder, and simulator are in separate, clearly-named functions or classes; the public API is `compile(pattern) → NFA` and `match(nfa, input) → boolean`.
- **Senior:** Adding a new operator (e.g. character classes) requires touching only the parser and NFA builder, not the simulator; the simulator is generic over the transition type and the state representation. You can demonstrate this by sketching the changes needed for `[a-z]` support in fewer than 20 lines.

## Senior stretch

- Add anchors `^` and `$`: instead of full-string match, implement substring search where `^` forces the match to start at index 0 and `$` forces it to end at the last character — and prove the simulation still runs in O(m·n).
- Convert the NFA to a DFA via subset construction, cache the constructed DFA states, and measure the speedup on a regex that would require visiting many NFA states per input character — then explain when NFA simulation beats DFA (large pattern, short input) and when DFA wins (small pattern, long input).
- Implement character classes `[a-z]`, `[^abc]` (negated), and the shorthand `\d`, `\w`, `\s` — extend the AST with a CharClass node and handle the transition in both NFA construction and simulation without blowing up the number of states.
- Add capturing groups `(...)` by tagging epsilon transitions with save slots, implement a parallel simulation that tracks tag assignments alongside state sets (Laurikari's algorithm), and return the captured substrings alongside the match result.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/regex-engine
