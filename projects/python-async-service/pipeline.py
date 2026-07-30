"""TODO(you): cancellation-correct async pipeline primitives.

Stdlib asyncio only. The acceptance suite drives the failures that make an async
service degrade in ways CPU graphs cannot explain:

* a timed-out stage must be cancelled AND awaited (``task.cancel()`` only requests
  it; returning early leaves work running against torn-down state);
* fan-out must respect a concurrency bound and keep input order;
* a critical section must be able to survive the cancellation that reaches it;
* shutdown must cancel and await every task — a cancelled-but-unawaited task is a
  leak that surfaces as a p99 that never recovers;
* admission must SHED when full, not queue forever, and must release its slot even
  when the work raises.
"""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable, Iterable, Sequence


class StageTimeout(Exception):
    def __init__(self, stage: str, timeout: float) -> None:
        super().__init__(f"stage {stage!r} exceeded {timeout}s")
        self.stage = stage
        self.timeout = timeout


async def stage_with_timeout(stage: str, coro: Awaitable[Any], timeout: float) -> Any:
    raise NotImplementedError("TODO")


async def fan_out(factories: Sequence[Callable[[], Awaitable[Any]]], limit: int) -> list[Any]:
    raise NotImplementedError("TODO")


async def shielded(coro: Awaitable[Any]) -> Any:
    raise NotImplementedError("TODO")


async def drain(tasks: Iterable[asyncio.Task[Any]], timeout: float = 1.0) -> int:
    raise NotImplementedError("TODO")


class Bulkhead:
    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self.in_flight = 0
        self.shed = 0

    async def run(self, factory: Callable[[], Awaitable[Any]]) -> Any:
        raise NotImplementedError("TODO")
