# Concurrent Go service — starter

Implement `pool.go` until the acceptance suite passes:

    go test ./...

Standard library only. The suite is about the four behaviours that decide whether a
Go service survives its own traffic:

- **Shed, don't buffer.** A full queue returns `ErrQueueFull` immediately so the
  handler can answer 503 with a `Retry-After`. An unbounded channel converts a
  latency problem into a memory problem and replies too late to be useful.
- **Bounded concurrency.** Live workers never exceed the configured count.
- **Draining shutdown.** SIGTERM finishes accepted work; a second `Shutdown` is a
  no-op, and a submit afterwards fails instead of panicking on a closed channel.
- **Retries inside the caller's budget.** Each attempt's deadline comes from the
  request context, and a cancelled context stops the loop at once — retrying work
  nobody awaits is pure load on a dependency that is already failing.

Green suite = the concurrency core is right. Then build the service on the project
page: the HTTP intake, `log/slog` with a trace id, pprof and metrics endpoints, a
distroless image, and the goroutine-leak post-mortem.
