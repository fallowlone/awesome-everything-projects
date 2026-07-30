// TODO(you): implement an in-memory CRUD router.
//
// Export:
//   createStore()       — returns a fresh, empty Store
//   handle(req, store)  — dispatches req to the right CRUD handler
//
// Routes (items = { id: string; name: string; [extra fields] }):
//   POST   /items           { name }  → 201, created item (auto-generated string id)
//   POST   /items           (no name) → 400
//   GET    /items                     → 200, array of all items
//   GET    /items/:id                 → 200, item  OR  404
//   PUT    /items/:id       { body }  → 200, updated item  OR  404
//   DELETE /items/:id                 → 200 (or 204), item removed  OR  404
//
// Use a simple incrementing counter for ids so tests are deterministic.
// No Date.now(), no Math.random().

export type Req = { method: "GET" | "POST" | "PUT" | "DELETE"; path: string; body?: any };
export type Res = { status: number; body?: any };

// Opaque store type — callers only ever receive it from createStore().
export type Store = ReturnType<typeof createStore>;

export function createStore() {
  // TODO: return an object/class that holds the item map and a counter.
  return {} as any;
}

export function handle(req: Req, store: Store): Res {
  void req; void store;
  // TODO: parse req.path, branch on req.method, implement each route.
  return { status: 500 };
}
