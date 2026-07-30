// TODO(you): model Nest's request pipeline and provider scopes.
//
// No Nest, no decorators — the point is the SEMANTICS the framework gives you, which
// is exactly what people get wrong:
//   - guards run BEFORE pipes, so an unauthenticated caller is never validated (flip
//     them and you parse attacker-supplied bodies you are about to reject);
//   - guards run in declaration order and short-circuit;
//   - interceptors straddle the handler on both sides, outermost first, so a logging
//     interceptor only observes a guard rejection when it sits outside the guard;
//   - a rejection is an HTTP status, not a crash;
//   - a REQUEST-scoped provider injected into a SINGLETON bubbles the scope up. A
//     container that silently allows it freezes the first request's instance forever,
//     which is how one tenant's state leaks to everybody else.
export type Ctx = { path: string; user?: { id: string; roles: string[] }; body?: unknown; log: string[] };

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export type Guard = { name: string; canActivate: (ctx: Ctx) => boolean };
export type Pipe = { name: string; transform: (body: unknown) => unknown };
export type Interceptor = { name: string; wrap: (ctx: Ctx, next: () => unknown) => unknown };
export type Handler = (ctx: Ctx) => unknown;

/** Push "guard:<name>", "pipe:<name>", "handler", "interceptor:<name>:before|after"
 *  onto ctx.log so the order is observable. */
export function runPipeline(
  ctx: Ctx,
  handler: Handler,
  opts: { guards?: Guard[]; pipes?: Pipe[]; interceptors?: Interceptor[] },
): unknown {
  void ctx; void handler; void opts;
  throw new Error("TODO");
}

export const rolesGuard = (required: string[]): Guard => ({
  name: "roles",
  canActivate: () => {
    void required;
    return false; // TODO
  },
});

export const authGuard: Guard = { name: "auth", canActivate: () => false }; // TODO

export type Scope = "singleton" | "request" | "transient";

export class Container {
  register(token: string, scope: Scope, factory: () => unknown, deps: string[] = []): void {
    void token; void scope; void factory; void deps; // TODO
  }
  /** Scope after bubbling: depending on something narrower widens yours. */
  effectiveScope(token: string): Scope {
    void token;
    return "singleton"; // TODO
  }
  resolve(token: string, requestId?: string, cache?: Map<string, unknown>): unknown {
    void token; void requestId; void cache;
    throw new Error("TODO");
  }
}
