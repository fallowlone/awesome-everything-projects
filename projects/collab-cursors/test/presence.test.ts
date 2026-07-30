import { test, expect } from "bun:test";
import { Room, CoalescingThrottle, reconnectDelayMs, type Peer } from "../src/presence";

const peer = (id: string, at = 0): Peer => ({
  id,
  name: id.toUpperCase(),
  color: "#123456",
  cursor: { x: 0, y: 0, at },
});

test("a joining peer appears in the snapshot", () => {
  const room = new Room();
  room.join(peer("a"));
  room.join(peer("b"));
  expect(room.snapshot().map((p) => p.id)).toEqual(["a", "b"]);
});

test("a move updates the peer's cursor", () => {
  const room = new Room();
  room.join(peer("a"));
  expect(room.move("a", { x: 10, y: 20, at: 100 })).toBe(true);
  expect(room.snapshot()[0].cursor).toEqual({ x: 10, y: 20, at: 100 });
});

test("a stale frame never teleports a cursor backwards", () => {
  // Two tabs, a proxy buffer and a reconnect are enough to deliver an older frame
  // after a newer one.
  const room = new Room();
  room.join(peer("a"));
  room.move("a", { x: 10, y: 10, at: 200 });
  expect(room.move("a", { x: 1, y: 1, at: 100 })).toBe(false);
  expect(room.snapshot()[0].cursor.x).toBe(10);
  // An identical timestamp is not newer either.
  expect(room.move("a", { x: 5, y: 5, at: 200 })).toBe(false);
});

test("a move from an unknown peer is ignored, not auto-joined", () => {
  const room = new Room();
  expect(room.move("ghost", { x: 1, y: 1, at: 1 })).toBe(false);
  expect(room.size).toBe(0);
});

test("fan-out excludes the sender", () => {
  const room = new Room();
  room.join(peer("a"));
  room.join(peer("b"));
  room.join(peer("c"));
  expect(room.others("a").map((p) => p.id).sort()).toEqual(["b", "c"]);
});

test("leaving removes the peer from the room", () => {
  const room = new Room();
  room.join(peer("a"));
  room.leave("a");
  expect(room.size).toBe(0);
  expect(room.others("b")).toHaveLength(0);
});

test("silent peers expire so no ghost cursor is left behind", () => {
  // A mobile tab suspending or a dead NAT entry never fires `close`.
  const room = new Room();
  room.join(peer("fresh", 10_000));
  room.join(peer("ghost", 1_000));
  expect(room.expire(11_000, 5_000)).toEqual(["ghost"]);
  expect(room.snapshot().map((p) => p.id)).toEqual(["fresh"]);
});

test("expiry is exclusive at the boundary — a peer exactly at the TTL survives", () => {
  const room = new Room();
  room.join(peer("edge", 5_000));
  expect(room.expire(10_000, 5_000)).toEqual([]);
  expect(room.size).toBe(1);
});

test("the throttle sends the first move immediately", () => {
  const t = new CoalescingThrottle(50);
  expect(t.offer({ x: 1, y: 1, at: 0 }, 0)).not.toBeNull();
});

test("intermediate moves are coalesced, not dropped", () => {
  // The last position is the one that matters; discarding it leaves the cursor
  // short of where the pointer actually stopped.
  const t = new CoalescingThrottle(50);
  t.offer({ x: 1, y: 1, at: 0 }, 0);
  expect(t.offer({ x: 2, y: 2, at: 10 }, 10)).toBeNull();
  expect(t.offer({ x: 3, y: 3, at: 20 }, 20)).toBeNull();
  expect(t.held).toEqual({ x: 3, y: 3, at: 20 }); // newest kept, older ones discarded

  const flushed = t.flush(60);
  expect(flushed).toEqual({ x: 3, y: 3, at: 20 });
  expect(t.held).toBeNull();
});

test("the throttle sends again once the interval has elapsed", () => {
  const t = new CoalescingThrottle(50);
  t.offer({ x: 1, y: 1, at: 0 }, 0);
  expect(t.offer({ x: 9, y: 9, at: 50 }, 50)).toEqual({ x: 9, y: 9, at: 50 });
});

test("flushing with nothing held sends nothing", () => {
  const t = new CoalescingThrottle(50);
  expect(t.flush(100)).toBeNull();
});

test("reconnect backoff doubles and caps", () => {
  expect(reconnectDelayMs(1, { baseMs: 250, capMs: 8000 })).toBe(250);
  expect(reconnectDelayMs(2, { baseMs: 250, capMs: 8000 })).toBe(500);
  expect(reconnectDelayMs(3, { baseMs: 250, capMs: 8000 })).toBe(1000);
  expect(reconnectDelayMs(20, { baseMs: 250, capMs: 8000 })).toBe(8000);
});

test("jitter spreads reconnects so one deploy does not re-storm the server", () => {
  const low = reconnectDelayMs(5, { baseMs: 250, capMs: 8000, rand: () => 0 });
  const high = reconnectDelayMs(5, { baseMs: 250, capMs: 8000, rand: () => 0.99 });
  expect(low).toBe(0);
  expect(high).toBeLessThanOrEqual(4000);
  expect(high).toBeGreaterThan(low);
});
