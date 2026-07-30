// Package ingest holds the concurrency core of the service. TODO(you): implement it.
//
// The acceptance suite drives the production failures this project is about:
//   - a full queue must SHED (return ErrQueueFull) instead of blocking — an
//     unbounded channel swallows a spike until memory dies;
//   - live concurrency must never exceed the worker count;
//   - Shutdown must DRAIN accepted work, be idempotent, and reject new submits
//     afterwards (without panicking on a closed channel);
//   - retries must derive their budget from the CALLER's context, so three attempts
//     cannot triple a request's latency, and a cancelled context stops immediately.
package ingest

import (
	"context"
	"errors"
	"time"
)

// ErrQueueFull is returned when admission sheds instead of queueing.
var ErrQueueFull = errors.New("queue full: shedding")

// Job is a unit of accepted work.
type Job func(ctx context.Context)

// Pool is a fixed set of workers fed by a bounded queue.
type Pool struct {
	// TODO: queue channel, WaitGroup, counters, closed flag + mutex.
}

// NewPool starts `workers` goroutines behind a queue of `capacity` slots.
func NewPool(workers, capacity int) *Pool {
	_ = workers
	_ = capacity
	return &Pool{} // TODO
}

// TrySubmit enqueues without blocking.
func (p *Pool) TrySubmit(job Job) error {
	_ = job
	return errors.New("TODO")
}

// Stats reports admission counters.
func (p *Pool) Stats() (accepted, shed, done int) {
	return 0, 0, 0 // TODO
}

// Shutdown stops accepting work, then waits for accepted work to finish.
func (p *Pool) Shutdown(ctx context.Context) bool {
	_ = ctx
	return false // TODO
}

// CallWithRetry retries `call` with exponential backoff, never outliving ctx.
func CallWithRetry(
	ctx context.Context,
	attempts int,
	backoff time.Duration,
	call func(ctx context.Context) error,
) error {
	_ = ctx
	_ = attempts
	_ = backoff
	_ = call
	return errors.New("TODO")
}
