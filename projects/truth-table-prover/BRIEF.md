# Truth-Table Prover

Turn the logic you learned on paper into a working engine: parse a propositional formula into a tree, walk every assignment to build its truth table, and decide whether it is a tautology, satisfiable, or equivalent to another formula. Logic is where rigor becomes mechanical — and writing the machine that checks an argument is the surest way to understand why the argument holds. By the end you'll have a small but honest theorem checker that you trust because you built every step.

**Difficulty:** advanced · **Est. days:** 8 · **Stack:** typescript or python, a unit-test runner (vitest or pytest) · **Tracks:** logic, algorithms

## Deliverable

A command-line tool that reads a propositional formula in a small syntax (variables, ¬, ∧, ∨, →, ↔), prints its full truth table, reports tautology / satisfiable / contradiction, decides equivalence of two formulas, and — as a stretch — answers satisfiability via a DPLL-style search and checks a short natural-deduction proof.

## Why this project

Logic is the one subject where you can build the judge. A truth-table prover compresses an entire course — connectives, validity, equivalence, the bridge from semantics to proof — into code you can run and trust. Build it in honest layers: first a parser that respects precedence, then an evaluator, then the three decision procedures, and only then the smarter search and the proof checker. Along the way you'll feel two ideas that outlast this project: brute force is correct but exponential, and a smarter search trades enumeration for reasoning; and a true statement and a provable statement are not the same thing until your rules make them so. That is exactly the gap every type checker, query planner, and SMT solver lives inside.

## Skills

- tokenizing and parsing an expression grammar
- building and evaluating an abstract syntax tree
- enumerating boolean assignments
- deciding tautology, satisfiability, and equivalence
- backtracking search (DPLL) over partial assignments
- encoding inference rules as checkable conditions

## Milestones

### 1. From text to a tree

A formula like (p → q) ∧ ¬r is just a string until you give it structure. Tokenize it, then parse it into an abstract syntax tree where each node is a connective and its children are the subformulas it joins. The hard part is precedence and association: ¬ binds tightest, then ∧, then ∨, then →, then ↔, and → associates to the right. Get this wrong and p → q → r quietly means the wrong thing — so write down your grammar before you write the parser, and reject malformed input loudly instead of guessing. This tree is the spine of everything that follows; every later stage just walks it.

**Definition of done:**

- Parsing (p → q) ∧ ¬r yields a tree whose root is ∧, matching the documented precedence and right-associative →.
- Malformed input (unbalanced parentheses, a dangling operator) raises a clear parse error instead of returning a wrong tree.

### 2. Evaluate under an assignment, then tabulate

Now make the tree mean something. Write an evaluator that, given a truth assignment for the variables, walks the tree bottom-up and returns true or false for the whole formula. Then enumerate all 2^n assignments for the n distinct variables and collect a row per assignment — that is the truth table. Two cautions worth meeting now: the table is exponential, so n is small on purpose; and you must collect the variables from the tree, in a stable order, so columns line up. When you print the full table for ¬(p ∧ q) and read it against your own head, the engine stops being a guess.

**Definition of done:**

- Given a formula and an explicit assignment, the evaluator returns the correct boolean by recursing over the tree.
- Printing the table for a 2- or 3-variable formula shows all 2^n rows with variable columns in a stable order and a result column.

### 3. Decide tautology, satisfiability, equivalence

Three of the most important questions in logic fall straight out of the table. A formula is a tautology if every row is true, a contradiction if every row is false, and satisfiable if at least one row is true. Two formulas are equivalent exactly when A ↔ B is a tautology — the cleanest definition you'll meet. Implement all four on top of your enumerator, and return a witnessing assignment when something is satisfiable, because 'yes, and here's why' beats a bare yes. This is the moment the tool earns its name: it now decides arguments, not just describes them.

**Definition of done:**

- tautology, contradiction, and satisfiable agree with the table for known cases (p ∨ ¬p, p ∧ ¬p, p ∧ q).
- equivalent(A, B) returns true exactly when A ↔ B is a tautology, and satisfiable returns a witnessing assignment.

### 4. Search smarter: a tiny DPLL

The truth table checks every one of 2^n rows even when the answer is obvious after the first few. Real SAT solvers don't — they search. Convert a formula to CNF (a conjunction of clauses), then write a DPLL-style backtracking search: pick an unassigned variable, try true, propagate the obvious consequences (unit propagation: a one-literal clause forces that literal), and backtrack when a clause becomes empty. It's the same brute force, but pruned — and on formulas where the table would choke, DPLL still answers. Seeing your recursive search return the same satisfiability verdict as the table, only faster, is the payoff: smarter search beats more rows.

**Definition of done:**

- Formulas are converted to CNF and the DPLL search returns the same SAT/UNSAT verdict as the truth-table method on shared test cases.
- Unit propagation and backtracking are implemented so the search visits far fewer states than the full 2^n table on a deliberately chosen formula.

### 5. Check a proof, not just a truth value

Truth tables tell you that a conclusion follows; a proof tells you why, step by step. Build a checker for a few natural-deduction rules — modus ponens (from A and A → B, derive B), and-introduction, and-elimination, maybe assumption discharge for → introduction. The checker reads a list of lines, each citing a rule and the earlier line numbers it depends on, and verifies that every step is a legal application. The deep idea you'll feel here is the gap between semantic truth (the table) and syntactic provability (the proof): a sound rule set never derives a non-tautology, and catching an illegal step is the whole job of a proof checker.

**Definition of done:**

- A correct proof using the supported rules is accepted, and a proof with one illegal step is rejected naming the bad line.
- The conclusion of any accepted proof is checked to actually be a tautology of its premises, cross-validating against the truth-table engine.

## Rubric

### Parser correctness

- **Junior:** Handles variables and a subset of operators but silently produces the wrong tree for edge cases — e.g., mixes up precedence between & and |, or parses -> left-associatively.
- **Mid:** Implements all five operators with the correct precedence chain (! > & > | > -> > <->), right-associative ->, and parentheses. Throws on malformed input — dangling operator, unclosed paren.
- **Senior:** Parser is a clean recursive-descent or shunting-yard implementation with an explicit grammar written down before the code; precedence and associativity are structurally enforced by the grammar, not patched in with special cases. Error messages name the unexpected token and its position. Property tests confirm it round-trips (parse → print → parse) on a large random formula set.

### Evaluation and 2^n enumeration

- **Junior:** Evaluates the three basic connectives (not, and, or) by walking the tree. Can print a truth table for a two-variable formula but variable extraction is ad-hoc and may duplicate columns.
- **Mid:** Evaluates all five connectives correctly, including the vacuous truth of false -> * and the two-sided equality of <->. Extracts variables from the AST in a stable sorted order and generates all 2^n assignments without a third-party library.
- **Senior:** Can state the exact complexity (O(2^n · |formula|) time, O(|formula| + n) space not counting the table), articulate where that stops scaling (n ≈ 20–25 in practice), and identify the BDD or SAT direction for larger n. The assignment generator is a bitmasking loop, not recursive, to avoid stack pressure on large n.

### Classification and equivalence

- **Junior:** classify returns a result based on counting true rows but may conflate satisfiable and contingent, or miss that a zero-row formula is vacuously a tautology.
- **Mid:** classify distinguishes tautology (all rows true), contradiction (all rows false), and contingent (both exist) correctly, including the single-variable edge cases. equivalent short-circuits on the first disagreeing assignment rather than collecting all rows first.
- **Senior:** Can prove that equivalent(a, b) is exactly classify(a <-> b) == tautology — both codepaths are tested to agree on the same formula pairs. Can explain why equivalence is not the same as syntactic identity (a->b and !a|b have different parse trees but identical semantics) and connect this to the role of normal forms: two formulas in the same CNF or DNF are syntactically identical iff semantically equivalent.

## Senior stretch

- Add Tseitin encoding so converting an arbitrary formula to CNF stays linear in size instead of exploding, then feed the result into your DPLL solver.
- Generate a minimal DNF or simplified equivalent from the satisfying rows so the tool can not only decide but also restate a formula in a cleaner form.
- Property-test the DPLL solver against the brute-force table on thousands of random formulas, asserting they always agree on SAT/UNSAT.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/truth-table-prover
