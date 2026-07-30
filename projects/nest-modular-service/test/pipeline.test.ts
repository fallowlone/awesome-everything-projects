import { test, expect } from "bun:test";
import { runPipeline, authGuard, rolesGuard, Container, HttpError, type Ctx, type Pipe, type Interceptor } from "../src/pipeline";

const ctx = (over: Partial<Ctx> = {}): Ctx => ({ path: "/orders", log: [], ...over });
const ok: Pipe = { name: "validate", transform: (b) => b };
const handler = () => "handled";

test("a permitted request reaches the handler", () => {
  const c = ctx({ user: { id: "u1", roles: ["admin"] } });
  expect(runPipeline(c, handler, { guards: [authGuard], pipes: [ok] })).toBe("handled");
  expect(c.log).toContain("handler");
});

test("guards run BEFORE pipes, so a rejected caller is never validated", () => {
  // Flipped, you parse and validate attacker-supplied bodies — CPU spent on traffic
  // you are about to reject, and the validator's surface exposed to it.
  let validated = false;
  const spy: Pipe = { name: "validate", transform: (b) => { validated = true; return b; } };
  const c = ctx();
  expect(() => runPipeline(c, handler, { guards: [authGuard], pipes: [spy] })).toThrow(HttpError);
  expect(validated).toBe(false);
  expect(c.log).toEqual(["guard:auth"]);
});

test("guards short-circuit in declaration order", () => {
  const c = ctx(); // no user
  expect(() => runPipeline(c, handler, { guards: [authGuard, rolesGuard(["admin"])] })).toThrow();
  expect(c.log).toEqual(["guard:auth"]); // the roles guard never runs
});

test("a rejection is a 403, not a crash", () => {
  try {
    runPipeline(ctx(), handler, { guards: [authGuard] });
    throw new Error("expected a rejection");
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).status).toBe(403);
  }
});

test("the roles guard denies a user who is authenticated but not authorised", () => {
  const c = ctx({ user: { id: "u1", roles: ["viewer"] } });
  expect(() => runPipeline(c, handler, { guards: [authGuard, rolesGuard(["admin"])] })).toThrow();
  expect(c.log).toEqual(["guard:auth", "guard:roles"]);
});

test("pipes transform the body in order before the handler sees it", () => {
  const trim: Pipe = { name: "trim", transform: (b) => (b as string).trim() };
  const upper: Pipe = { name: "upper", transform: (b) => (b as string).toUpperCase() };
  const c = ctx({ user: { id: "u", roles: [] }, body: "  hi  " });
  runPipeline(c, (inner) => inner.body, { guards: [authGuard], pipes: [trim, upper] });
  expect(c.body).toBe("HI");
  expect(c.log.filter((l) => l.startsWith("pipe"))).toEqual(["pipe:trim", "pipe:upper"]);
});

test("interceptors straddle the handler on both sides, outermost first", () => {
  const mk = (name: string): Interceptor => ({ name, wrap: (_c, next) => next() });
  const c = ctx({ user: { id: "u", roles: [] } });
  runPipeline(c, handler, { guards: [authGuard], interceptors: [mk("logging"), mk("timing")] });
  expect(c.log).toEqual([
    "interceptor:logging:before",
    "interceptor:timing:before",
    "guard:auth",
    "handler",
    "interceptor:timing:after",
    "interceptor:logging:after",
  ]);
});

test("an interceptor can transform the response", () => {
  const envelope: Interceptor = { name: "envelope", wrap: (_c, next) => ({ data: next() }) };
  const c = ctx({ user: { id: "u", roles: [] } });
  expect(runPipeline(c, handler, { interceptors: [envelope] })).toEqual({ data: "handled" });
});

test("an interceptor outside the guard observes a rejection", () => {
  // A logging interceptor sitting inside the guard never sees the 403 it should log.
  const seen: string[] = [];
  const logging: Interceptor = {
    name: "logging",
    wrap: (_c, next) => {
      try {
        return next();
      } catch (e) {
        seen.push(`rejected:${(e as HttpError).status}`);
        throw e;
      }
    },
  };
  expect(() => runPipeline(ctx(), handler, { guards: [authGuard], interceptors: [logging] })).toThrow();
  expect(seen).toEqual(["rejected:403"]);
});

test("a singleton provider is created once", () => {
  const c = new Container();
  let made = 0;
  c.register("config", "singleton", () => ({ n: ++made }));
  expect(c.resolve("config")).toBe(c.resolve("config"));
  expect(made).toBe(1);
});

test("a transient provider is a fresh instance every time", () => {
  const c = new Container();
  c.register("id", "transient", () => ({}));
  expect(c.resolve("id")).not.toBe(c.resolve("id"));
});

test("a request-scoped provider is one instance per request", () => {
  const c = new Container();
  c.register("tenant", "request", () => ({}));
  const cacheA = new Map<string, unknown>();
  const cacheB = new Map<string, unknown>();
  expect(c.resolve("tenant", "r1", cacheA)).toBe(c.resolve("tenant", "r1", cacheA));
  expect(c.resolve("tenant", "r1", cacheA)).not.toBe(c.resolve("tenant", "r2", cacheB));
});

test("depending on a request-scoped provider bubbles the scope up", () => {
  // The trap: a request-scoped dependency injected into a singleton is resolved once
  // and frozen, so the first request's tenant leaks to everyone after it.
  const c = new Container();
  c.register("tenant", "request", () => ({}));
  c.register("repo", "singleton", () => ({}), ["tenant"]);
  expect(c.effectiveScope("repo")).toBe("request");
  expect(() => c.resolve("repo")).toThrow(/request context/i);
  expect(c.resolve("repo", "r1")).toBeTruthy();
});

test("the container refuses a circular dependency instead of hanging", () => {
  const c = new Container();
  c.register("a", "singleton", () => ({}), ["b"]);
  c.register("b", "singleton", () => ({}), ["a"]);
  expect(() => c.effectiveScope("a")).toThrow(/circular/i);
});

test("an unknown provider is an explicit error", () => {
  expect(() => new Container().resolve("nope")).toThrow(/unknown provider/i);
});
