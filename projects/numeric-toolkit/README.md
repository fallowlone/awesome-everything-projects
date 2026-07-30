# Numeric Toolkit — starter

Implement three routines in `src/numeric.ts` so the acceptance suite passes:

    bun test

**Contract:**
- `matmul(A, B)` — matrix multiplication (throws on dimension mismatch)
- `solve(A, b)` — Gaussian elimination with **partial pivoting**; throws on singular
- `variance(xs)` — numerically stable population variance (Welford or two-pass)

The suite checks: a hand-verified product, a 3×3 system with an integer solution,
a zero-first-pivot case that breaks naive elimination, catastrophic cancellation in
naive variance, and a singular-matrix throw.

When it is green, read the project rubric and push toward the senior bar.
