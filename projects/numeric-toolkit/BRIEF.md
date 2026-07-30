# Numeric Toolkit

Build the small library every numerical program secretly depends on: vectors, matrices, a linear-system solver, and descriptive statistics — written by you, checked against answers you can verify by hand. This is where the algebra you learned stops being homework and becomes code that other code calls. You'll feel why floating-point arithmetic lies a little, why solving Ax = b is harder than the textbook suggests, and how to prove your own numbers are right.

**Difficulty:** advanced · **Est. days:** 8 · **Stack:** typescript or python, a test runner (vitest / pytest), a reference implementation for cross-checking (numpy or a known closed-form) · **Tracks:** math, algorithms

## Deliverable

A self-contained numeric library exposing vector/matrix types with arithmetic, a Gaussian-elimination solver for Ax = b, and mean/variance/std functions — all covered by a test suite that asserts against hand-computed and reference results, including at least one ill-conditioned case that exposes numerical error.

## Why this project

Every data tool, simulation, and machine-learning model rests on a layer exactly like this one — vectors, matrices, a linear solver, and a few statistics — and almost no working engineer has ever built it from scratch. Doing so converts symbols you manipulated in algebra into machinery other programs depend on, and it teaches the lesson that no amount of clean mathematics can give you: the computer does not store the real numbers, it stores approximations, and a correct algorithm run on those approximations can still produce a wrong answer. When you watch partial pivoting rescue a solve that the naive version botched, and watch a stable variance formula stay sane where the textbook one went negative, you stop trusting numerical code blindly and start understanding why the libraries you'll lean on for the rest of your career are written the careful way they are.

## Skills

- representing vectors and matrices as data
- implementing matrix arithmetic correctly
- Gaussian elimination with partial pivoting
- computing mean, variance, and standard deviation numerically stably
- writing tests against verifiable reference answers
- reasoning about floating-point error and conditioning

## Milestones

### 1. Vectors and matrices as data

Before you can solve anything, you need a way to hold the numbers. Decide how a vector and a matrix live in memory — a flat array with a row count, or nested arrays — and build the small operations everything else stands on: add, scale, dot product, and matrix-times-vector. The dot product is where most beginners first meet a silent bug, because the loop bounds and the index pairing have to line up exactly; get one wrong and the answer is plausible but false. Keep your operations pure: take inputs, return a new vector or matrix, never mutate the arguments, so that a later step can't corrupt an earlier one. The reward for getting this layer boring and correct is that every harder thing on top of it inherits that correctness.

**Definition of done:**

- Vector add, scale, and dot product return correct results on hand-checked inputs, and reject mismatched lengths instead of producing garbage.
- Matrix-times-vector produces a result you can verify by hand for a 3x3 example, and operations return new objects rather than mutating inputs.

### 2. Solve Ax = b by elimination

Now make the toolkit do real work: solve a system of linear equations. Implement Gaussian elimination — turn the matrix into upper-triangular form by subtracting scaled rows, then back-substitute to read off the unknowns. This is the same procedure you did by hand in algebra, but the machine forces you to be precise about the order of operations and the bookkeeping of which row scales which. Start with the naive version on a well-behaved 3x3 system where you already know the answer, so a wrong result is obviously wrong. You will discover that the algorithm has a cost of roughly n-cubed operations, which is why solving a thousand-equation system is a real expense and not free — the complexity you studied stops being abstract the moment your solver gets slow.

**Definition of done:**

- The solver returns the correct x for a 3x3 system whose solution you computed by hand.
- Substituting the returned x back into Ax reproduces b within a small tolerance, confirming the solution rather than assuming it.

### 3. Make the solver survive bad rows

The naive solver breaks the first time a pivot is zero — you divide by it and get infinity or NaN — and it quietly loses accuracy when a pivot is merely tiny. The fix is partial pivoting: before eliminating a column, swap in the row with the largest absolute value in that column so you always divide by the biggest available number. Build a small example that makes the naive version produce a wildly wrong answer, then watch pivoting rescue it; that contrast is the whole lesson. This is your first real encounter with the idea that a mathematically correct algorithm can still be numerically wrong, and that the floating-point numbers on the number line are not the exact reals you reasoned about on paper.

**Definition of done:**

- A system that puts a zero or tiny value on the diagonal no longer crashes or returns NaN — pivoting reorders rows and produces the right answer.
- A test demonstrates a concrete case where the naive solver is wrong and the pivoting solver is right, side by side.

### 4. Describe a column of numbers

Add the statistics side: given a vector of samples, compute mean, variance, and standard deviation. The mean is easy; variance is where a subtle trap waits. The textbook formula that subtracts the mean-of-squares from the square-of-the-mean is one floating-point pass, but it catastrophically cancels when the numbers are large and close together, returning a negative variance that is mathematically impossible. Implement the numerically honest two-pass version (or Welford's running formula) instead, and prove with a test on big near-equal values that the naive formula fails while yours holds. Decide deliberately between population and sample variance — the divide-by-n versus divide-by-n-minus-one choice is not cosmetic, and a senior engineer states which one they ship and why.

**Definition of done:**

- Mean, variance, and standard deviation match a reference (e.g. numpy or a hand calculation) on a small known dataset.
- A test on large near-equal values shows the naive one-pass variance failing (e.g. going negative) while your implementation stays correct and non-negative.

### 5. Test against known truth

A numeric library you cannot trust is worthless, so this milestone is about earning trust. Build a test suite around answers you can independently verify: solutions you computed by hand, identities that must hold (a matrix times its solution reproduces the right-hand side), and a reference implementation you cross-check against. The discipline here is asserting with a tolerance, not exact equality — floating-point results are almost never bit-identical, so you compare within an epsilon and you choose that epsilon on purpose. Cover the boring happy path, but spend most of your energy on the edges: a singular matrix that has no unique solution, an empty input, a single-element vector. The tests are not an afterthought; they are the only thing standing between 'it looks right' and 'it is right'.

**Definition of done:**

- Every public operation has at least one test that asserts against a verifiable reference within a chosen tolerance, not exact equality.
- Edge cases — a singular matrix, an empty vector, mismatched dimensions — are tested and produce a clear error or documented result instead of silent nonsense.

## Rubric

### Floating-point error awareness

- **Junior:** Knows that floating-point results are not exact and uses a tolerance in assertions rather than strict equality.
- **Mid:** Identifies the specific operation that causes catastrophic cancellation in naive variance (subtracting two large nearly-equal numbers), implements a two-pass or Welford formula to avoid it, and proves the fix with a test on large near-equal values where the naive formula returns a negative variance.
- **Senior:** Can place the naive variance formula's error in the context of relative machine epsilon: for values near magnitude M the absolute error in the subtraction is ~M * epsilon, making the formula correct only when variance >> M^2 * epsilon. Can state when Kahan compensated summation would further reduce accumulated error in dot products or running totals.

### Pivoting and numerical stability

- **Junior:** Implements Gaussian elimination correctly on well-conditioned square systems with no zero pivots; back-substitution produces the right x.
- **Mid:** Adds partial pivoting (swap in the row with the largest absolute value in the current column before each elimination step), builds a test where the naive version produces NaN or wildly wrong output and the pivoting version is accurate.
- **Senior:** Explains why partial pivoting bounds the growth factor to 2^(n-1) in the worst case (making it theoretically possible to construct a pathological matrix) and why this is rarely a problem in practice; can describe the condition number as the ratio of maximum to minimum singular values and state how a condition number of 1e12 means you can trust only ~4 significant digits of the solution in double precision.

### Edge-case handling and test coverage

- **Junior:** Tests the happy path: known 3x3 system with a clean integer solution, mean of small integers, dot product of short vectors.
- **Mid:** Covers the canonical failure modes: a singular matrix (detected and reported, not silently NaN), mismatched vector lengths (rejected with a clear error), an empty input, a single-element vector, and the ill-conditioned near-singular system that exposes floating-point loss.
- **Senior:** Chooses tolerances deliberately: epsilon for the residual check (||Ax - b|| / ||b|| < 1e-10) is different from epsilon for the variance non-negativity check; can state why relative tolerance is almost always correct and absolute tolerance almost always a footgun. Documents which operations return NaN vs throw, and why the contract is deliberate.

## Senior stretch

- Replace repeated elimination with an LU decomposition: factor A once into a lower- and upper-triangular pair, then solve many different right-hand sides cheaply by reusing the factors — the standard move when you solve Ax = b for the same A again and again.
- Add condition-number awareness: estimate how much your matrix amplifies input error and flag when a system is ill-conditioned, so a caller learns 'this answer is fragile' instead of trusting digits that are pure floating-point noise.
- Benchmark your solver as the system size grows and confirm the runtime really does scale like n-cubed, turning the complexity class you studied into a curve you measured yourself.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/numeric-toolkit
