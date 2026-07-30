# Command palette

A ⌘K command palette with fuzzy ranking, async action sources, and complete keyboard control (arrows, Enter, Escape, scoping) — the interaction layer every power-user tool needs.

**Difficulty:** intermediate · **Est. days:** 3 · **Stack:** preact, typescript · **Tracks:** frontend

## Deliverable

A palette that opens with ⌘K, fuzzy-filters registered commands as you type, supports nested scoping (e.g., entering a 'Theme >' submenu), and is fully keyboard-only operable.

## Why this project

Command palettes are deceptively small but touch a surprising range of hard problems: fuzzy scoring that feels right, async sources without race conditions, nested navigation state, and accessible keyboard control. Build it once properly and you'll never reach for a library again — and you'll understand why every library gets one of these details wrong.

## Skills

- fuzzy search / scoring (fzf-style)
- async data sources with debounce
- focus trap + ARIA combobox
- command registry pattern

## Milestones

### 1. Registry + keyboard control

Build a command registry with synchronous commands, open/close via ⌘K, and arrow + Enter + Escape keyboard handling.

**Definition of done:**

- ⌘K opens/closes the palette; Arrow keys move the active item, Enter runs it, Escape closes — all without the mouse.
- Focus is trapped inside the open palette and restored to the trigger on close.

### 2. Fuzzy ranking

Add fuzzy filtering with a scoring function that ranks exact-prefix matches above scattered matches, highlighting matched characters.

**Definition of done:**

- Typing ranks exact-prefix matches above scattered subsequence matches, and matched characters are highlighted.
- An empty query shows all commands; no match shows an explicit empty state.

### 3. Async sources with debounce

Support async action sources (e.g., a search API) with debouncing, a loading indicator, and graceful cancellation of stale requests.

**Definition of done:**

- An async source is debounced, shows a loading state, and a stale in-flight request is cancelled when input changes.
- Results from a cancelled request never overwrite results from the latest query.

## Rubric

### Match quality

- **Junior:** Filters items by substring inclusion; all matching items surface regardless of position in the string.
- **Mid:** Implements subsequence matching (not substring) and ranks prefix / contiguous matches above scattered ones so the intended item appears first.
- **Senior:** Scoring function is pure and separately testable; ties are broken deterministically; the function handles Unicode boundaries correctly and its time complexity is stated and justified (O(n·m) per item, total O(N·m log N)).

### Keyboard model correctness

- **Junior:** Arrow keys move the selection and Enter triggers the highlighted item; wrapping is absent or breaks at boundaries.
- **Mid:** Selection wraps correctly in both directions including with a single-item or empty list; reduce is a pure function with no side effects.
- **Senior:** Reducer is the single source of truth for all keyboard state; focus management (trap on open, restore on close) is wired outside the reducer so the pure logic remains testable in Node without a DOM; edge cases (empty list, rapid key presses) are covered by unit tests.

### Performance under load

- **Junior:** Re-ranks the full list on every keypress synchronously; no noticeable issue with short lists (< 50 items).
- **Mid:** Async sources are debounced; the ranking function is memoized or skipped when the query is unchanged; stale in-flight requests are cancelled.
- **Senior:** A list of 10 000+ commands renders without jank: either virtualized (only visible rows in the DOM) or pre-indexed (trie / inverted index built once on registration so per-keystroke work is sub-linear). The choice is justified with a measured trade-off between memory and CPU.

## Senior stretch

- Add scoping: a command can push a new context (e.g., 'Switch project >') with its own filtered list, with breadcrumb navigation and Backspace to pop the scope.
- Make the palette accessible: correct ARIA combobox + listbox roles, live region announcements for result count, and a focus trap that restores focus on close.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/command-palette
