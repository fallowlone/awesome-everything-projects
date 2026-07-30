# Async Python service — starter

Implement `pipeline.py` until the acceptance suite passes:

    python3 -m unittest discover -p "test_*.py"

Stdlib only — no pytest, no FastAPI. The suite is deliberately about the semantics a
framework will not give you:

- **A timed-out stage is cancelled *and awaited*.** `task.cancel()` only requests
  cancellation; returning before the task finishes leaves work running against state
  the caller already tore down. This is the cancellation leak behind "p99 climbs and
  never recovers while CPU looks idle".
- **Fan-out is bounded and order-preserving.** Unbounded concurrency turns a spike
  into a herd against a dependency that is already hurting.
- **A critical section can be shielded** so a commit is not abandoned halfway —
  but only that small window, or the service stops answering SIGTERM.
- **Shutdown drains**: cancel and await, so no dead frames accumulate.
- **Admission sheds when full** and releases its slot even when the work raises.

Green suite = the concurrency core is correct. Then build the service on the project
page: the FastAPI intake with Pydantic bounds, per-stage timeouts wired to a request
budget, pyproject + lockfile, a container that handles PID 1 signals, structured
logs with a request id, and the event-loop-starvation post-mortem.
