package ingest

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestPoolRunsSubmittedWork(t *testing.T) {
	p := NewPool(2, 4)
	var ran atomic.Int32
	var wg sync.WaitGroup
	wg.Add(3)
	for i := 0; i < 3; i++ {
		if err := p.TrySubmit(func(context.Context) { ran.Add(1); wg.Done() }); err != nil {
			t.Fatalf("submit: %v", err)
		}
	}
	wg.Wait()
	if got := ran.Load(); got != 3 {
		t.Fatalf("ran = %d, want 3", got)
	}
	if !p.Shutdown(context.Background()) {
		t.Fatal("shutdown did not complete")
	}
}

func TestFullQueueShedsInsteadOfBlocking(t *testing.T) {
	// The wrong answer is an unbounded channel that swallows a spike until memory
	// dies; the right one is an explicit reject the caller can turn into a 503.
	release := make(chan struct{})
	p := NewPool(1, 1)
	defer p.Shutdown(context.Background())

	// Occupy the single worker.
	if err := p.TrySubmit(func(context.Context) { <-release }); err != nil {
		t.Fatalf("first submit: %v", err)
	}
	// Fill the single queue slot. This may race with the worker picking it up, so
	// keep submitting until one lands.
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if err := p.TrySubmit(func(context.Context) { <-release }); err == nil {
			break
		}
	}

	// Now a further submit must shed rather than block.
	done := make(chan error, 1)
	go func() { done <- p.TrySubmit(func(context.Context) {}) }()
	select {
	case err := <-done:
		if !errors.Is(err, ErrQueueFull) {
			t.Fatalf("err = %v, want ErrQueueFull", err)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("TrySubmit blocked; it must shed when full")
	}

	_, shed, _ := p.Stats()
	if shed == 0 {
		t.Fatal("shed counter not incremented — shedding must be observable")
	}
	close(release)
}

func TestConcurrencyNeverExceedsWorkerCount(t *testing.T) {
	const workers = 3
	p := NewPool(workers, 32)
	defer p.Shutdown(context.Background())

	var mu sync.Mutex
	current, peak := 0, 0
	var wg sync.WaitGroup

	for i := 0; i < 20; i++ {
		wg.Add(1)
		for p.TrySubmit(func(context.Context) {
			mu.Lock()
			current++
			if current > peak {
				peak = current
			}
			mu.Unlock()
			time.Sleep(5 * time.Millisecond)
			mu.Lock()
			current--
			mu.Unlock()
			wg.Done()
		}) != nil {
			time.Sleep(time.Millisecond)
		}
	}
	wg.Wait()

	mu.Lock()
	defer mu.Unlock()
	if peak > workers {
		t.Fatalf("peak concurrency = %d, want <= %d", peak, workers)
	}
}

func TestShutdownDrainsAcceptedWork(t *testing.T) {
	// SIGTERM must finish work already accepted, not drop it.
	p := NewPool(2, 8)
	var ran atomic.Int32
	for i := 0; i < 6; i++ {
		if err := p.TrySubmit(func(context.Context) {
			time.Sleep(10 * time.Millisecond)
			ran.Add(1)
		}); err != nil {
			t.Fatalf("submit: %v", err)
		}
	}
	if !p.Shutdown(context.Background()) {
		t.Fatal("shutdown did not complete")
	}
	if got := ran.Load(); got != 6 {
		t.Fatalf("completed = %d, want 6 — accepted work must not be dropped", got)
	}
}

func TestSubmitAfterShutdownIsRejected(t *testing.T) {
	p := NewPool(1, 1)
	p.Shutdown(context.Background())
	if err := p.TrySubmit(func(context.Context) {}); err == nil {
		t.Fatal("submit after shutdown must fail, not panic on a closed channel")
	}
}

func TestShutdownIsIdempotent(t *testing.T) {
	p := NewPool(1, 1)
	if !p.Shutdown(context.Background()) {
		t.Fatal("first shutdown failed")
	}
	if !p.Shutdown(context.Background()) {
		t.Fatal("second shutdown must be a no-op, not a double close")
	}
}

func TestRetrySucceedsAfterTransientFailures(t *testing.T) {
	calls := 0
	err := CallWithRetry(context.Background(), 3, time.Millisecond, func(context.Context) error {
		calls++
		if calls < 3 {
			return errors.New("transient")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if calls != 3 {
		t.Fatalf("calls = %d, want 3", calls)
	}
}

func TestRetryStopsAtTheAttemptLimit(t *testing.T) {
	calls := 0
	err := CallWithRetry(context.Background(), 2, time.Millisecond, func(context.Context) error {
		calls++
		return errors.New("always")
	})
	if err == nil {
		t.Fatal("want the last error, got nil")
	}
	if calls != 2 {
		t.Fatalf("calls = %d, want exactly 2", calls)
	}
}

func TestRetryRespectsTheCallerBudget(t *testing.T) {
	// Retries that ignore the request budget turn one slow dependency into a pinned
	// pool: three attempts must not triple the request's latency.
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Millisecond)
	defer cancel()

	calls := 0
	start := time.Now()
	err := CallWithRetry(ctx, 10, 20*time.Millisecond, func(context.Context) error {
		calls++
		return errors.New("slow dependency")
	})
	elapsed := time.Since(start)

	if err == nil {
		t.Fatal("want an error once the budget is spent")
	}
	if elapsed > 300*time.Millisecond {
		t.Fatalf("elapsed = %v — retries outlived the caller's context", elapsed)
	}
	if calls >= 10 {
		t.Fatalf("calls = %d — retrying past the deadline is pure load", calls)
	}
}

func TestRetryStopsImmediatelyOnCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	calls := 0
	err := CallWithRetry(ctx, 5, time.Millisecond, func(context.Context) error {
		calls++
		return nil
	})
	if err == nil {
		t.Fatal("a cancelled context must not be treated as success")
	}
	if calls != 0 {
		t.Fatalf("calls = %d — nobody is waiting for this work", calls)
	}
}

func TestRetryRejectsNonPositiveAttempts(t *testing.T) {
	if err := CallWithRetry(context.Background(), 0, time.Millisecond, func(context.Context) error { return nil }); err == nil {
		t.Fatal("attempts <= 0 must be an error, not a silent no-op")
	}
}
