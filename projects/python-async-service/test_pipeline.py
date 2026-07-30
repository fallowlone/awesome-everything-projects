"""Acceptance suite: run with `python3 -m unittest discover -p "test_*.py"`.

Stdlib only — no pytest, no FastAPI. The point is the concurrency semantics, which
is exactly the part a framework will not do for you.
"""

from __future__ import annotations

import asyncio
import unittest

from pipeline import Bulkhead, StageTimeout, drain, fan_out, shielded, stage_with_timeout


class StageTimeoutTests(unittest.IsolatedAsyncioTestCase):
    async def test_fast_stage_returns_its_value(self) -> None:
        async def quick() -> str:
            return "ok"

        self.assertEqual(await stage_with_timeout("quick", quick(), 0.5), "ok")

    async def test_slow_stage_raises_stage_timeout_naming_the_stage(self) -> None:
        async def slow() -> None:
            await asyncio.sleep(5)

        with self.assertRaises(StageTimeout) as ctx:
            await stage_with_timeout("enrich", slow(), 0.05)
        self.assertEqual(ctx.exception.stage, "enrich")

    async def test_timed_out_stage_is_actually_cancelled_not_left_running(self) -> None:
        # `task.cancel()` only requests cancellation. Returning before the task has
        # finished leaves work running against state the caller already tore down —
        # this is the cancellation leak that shows up as a p99 that never recovers.
        finished = False

        async def slow() -> None:
            nonlocal finished
            try:
                await asyncio.sleep(5)
                finished = True
            except asyncio.CancelledError:
                raise

        with self.assertRaises(StageTimeout):
            await stage_with_timeout("slow", slow(), 0.05)

        await asyncio.sleep(0.05)
        self.assertFalse(finished)
        self.assertEqual(len([t for t in asyncio.all_tasks() if t is not asyncio.current_task()]), 0)

    async def test_stage_error_propagates_unchanged(self) -> None:
        async def boom() -> None:
            raise ValueError("upstream said no")

        with self.assertRaises(ValueError):
            await stage_with_timeout("boom", boom(), 1.0)


class FanOutTests(unittest.IsolatedAsyncioTestCase):
    async def test_results_keep_input_order(self) -> None:
        async def make(i: int, delay: float) -> int:
            await asyncio.sleep(delay)
            return i

        # Reverse delays: without order preservation the results come back backwards.
        factories = [lambda i=i: make(i, (3 - i) * 0.02) for i in range(4)]
        self.assertEqual(await fan_out(factories, limit=4), [0, 1, 2, 3])

    async def test_concurrency_never_exceeds_the_limit(self) -> None:
        # Unbounded concurrency turns a traffic spike into a thundering herd against
        # a dependency that is already struggling.
        current = 0
        peak = 0

        async def work() -> None:
            nonlocal current, peak
            current += 1
            peak = max(peak, current)
            await asyncio.sleep(0.02)
            current -= 1

        await fan_out([lambda: work() for _ in range(12)], limit=3)
        self.assertLessEqual(peak, 3)
        self.assertGreater(peak, 1)  # and it really did run concurrently

    async def test_zero_limit_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            await fan_out([], limit=0)


class ShieldTests(unittest.IsolatedAsyncioTestCase):
    async def test_shielded_section_completes_despite_cancellation(self) -> None:
        committed = False

        async def commit() -> None:
            nonlocal committed
            await asyncio.sleep(0.05)
            committed = True

        async def caller() -> None:
            await shielded(commit())

        task = asyncio.ensure_future(caller())
        await asyncio.sleep(0.01)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        await asyncio.sleep(0.08)
        self.assertTrue(committed)  # the half-applied write is what we refuse to allow


class DrainTests(unittest.IsolatedAsyncioTestCase):
    async def test_drain_cancels_and_awaits_every_task(self) -> None:
        async def forever() -> None:
            await asyncio.sleep(60)

        tasks = [asyncio.ensure_future(forever()) for _ in range(3)]
        await asyncio.sleep(0.01)
        cancelled = await drain(tasks)
        self.assertEqual(cancelled, 3)
        for t in tasks:
            self.assertTrue(t.done())

    async def test_drain_ignores_already_finished_tasks(self) -> None:
        async def quick() -> None:
            return None

        tasks = [asyncio.ensure_future(quick())]
        await asyncio.sleep(0.01)
        self.assertEqual(await drain(tasks), 0)


class BulkheadTests(unittest.IsolatedAsyncioTestCase):
    async def test_sheds_instead_of_queueing_when_full(self) -> None:
        bulkhead = Bulkhead(capacity=2)
        started = asyncio.Event()

        async def hold() -> str:
            started.set()
            await asyncio.sleep(0.05)
            return "done"

        running = [asyncio.ensure_future(bulkhead.run(hold)) for _ in range(2)]
        await started.wait()
        await asyncio.sleep(0)

        with self.assertRaises(RuntimeError):
            await bulkhead.run(hold)
        self.assertEqual(bulkhead.shed, 1)

        await asyncio.gather(*running)
        self.assertEqual(bulkhead.in_flight, 0)

    async def test_capacity_frees_up_after_completion(self) -> None:
        bulkhead = Bulkhead(capacity=1)

        async def quick() -> str:
            return "ok"

        self.assertEqual(await bulkhead.run(quick), "ok")
        self.assertEqual(await bulkhead.run(quick), "ok")
        self.assertEqual(bulkhead.shed, 0)

    async def test_in_flight_is_released_even_when_the_work_raises(self) -> None:
        bulkhead = Bulkhead(capacity=1)

        async def boom() -> None:
            raise ValueError("no")

        with self.assertRaises(ValueError):
            await bulkhead.run(boom)
        self.assertEqual(bulkhead.in_flight, 0)  # a leaked slot is a slow capacity leak


if __name__ == "__main__":
    unittest.main()
