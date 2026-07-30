# Mini CRUD API — starter

Implement `createStore` and `handle` in `src/api.ts` so the acceptance suite passes.

    bun test

Routes to implement over an in-memory map of `{ id, name }` items:

| Method | Path         | Body     | Success | Error |
|--------|-------------|----------|---------|-------|
| POST   | /items       | `{name}` | 201, item | 400 if no name |
| GET    | /items       | —        | 200, array | — |
| GET    | /items/:id   | —        | 200, item | 404 |
| PUT    | /items/:id   | body     | 200, updated | 404 |
| DELETE | /items/:id   | —        | 200 or 204 | 404 |

Use an incrementing counter (not `Date.now()` or `Math.random()`) so tests stay
deterministic. When the suite is green, read the project page's rubric and push
to the senior bar: validation, error paths, and reasoning about what changes when
the in-memory map becomes a real database.
