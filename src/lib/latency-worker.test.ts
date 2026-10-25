// The latency worker is optional: whatever goes wrong with it, a test must
// still produce samples (main-thread fallback) or a clean failure — never hang.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _setLatencyWorkerFactory, assessSamples, latencyWorkerFailed, measureCityLatency, measureTarget,
  SAMPLE_TIMEOUT_MS, TOTAL_REQUESTS, WORKER_REPLY_GRACE_MS, WORKER_START_TIMEOUT_MS,
} from './latency';
import { animationsPaused } from './animation-pause';
import { cityLatencyTargets } from '@/data/ping-targets';
import type { WorkerRequest, WorkerResponse } from './latency.worker';

const OHIO_AWS = cityLatencyTargets(3)[0];

type Behaviour = {
  /** answer the startup ping */
  pong?: boolean;
  /** answer this many 'time' requests, then go silent */
  answer?: number;
  /** fire 'error' instead of answering after this many samples */
  errorAfter?: number;
};

class FakeWorker {
  listeners: Record<string, ((e: unknown) => void)[]> = {};
  answered = 0;
  terminated = false;
  private b: Behaviour;
  constructor(b: Behaviour) { this.b = b; }
  addEventListener(type: string, fn: (e: unknown) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  emit(type: string, e: unknown) {
    if (this.terminated) return;
    for (const fn of this.listeners[type] ?? []) fn(e);
  }
  terminate() { this.terminated = true; }
  postMessage(m: WorkerRequest) {
    setTimeout(() => {
      if (m.type === 'ping') {
        if (this.b.pong !== false) this.emit('message', { data: { type: 'pong' } satisfies WorkerResponse });
        return;
      }
      if (m.type !== 'time') return;
      if (this.b.errorAfter !== undefined && this.answered >= this.b.errorAfter) {
        this.emit('error', new Event('error'));
        return;
      }
      if (this.b.answer !== undefined && this.answered >= this.b.answer) return; // silent
      this.answered++;
      this.emit('message', { data: { type: 'sample', id: m.id, sample: { ms: 42 } } satisfies WorkerResponse });
    }, 1);
  }
}

/** Main-thread fetch that answers in ~5 ms. */
const mainFetch = vi.fn(async () => {
  await new Promise((r) => setTimeout(r, 5));
  return { ok: true, status: 200, type: 'cors', arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Response;
});

/** Run a promise to completion under fake timers; fail if it needs more than `limitMs` of timer time. */
async function settle<T>(p: Promise<T>, limitMs: number): Promise<{ value: T; elapsed: number }> {
  let done = false;
  let value!: T;
  p.then((v) => { done = true; value = v; });
  let elapsed = 0;
  while (!done && elapsed <= limitMs) {
    await vi.advanceTimersByTimeAsync(10);
    elapsed += 10;
  }
  if (!done) throw new Error(`still running after ${limitMs} ms of timers — would hang`);
  return { value, elapsed };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.stubGlobal('fetch', mainFetch);
  mainFetch.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  _setLatencyWorkerFactory(null);
});

// Worst case for one target = handshake + one silent sample + main-thread retries.
const BUDGET = WORKER_START_TIMEOUT_MS + SAMPLE_TIMEOUT_MS + WORKER_REPLY_GRACE_MS + 5_000;

describe('latency worker fallback', () => {
  it('uses the worker when it works', async () => {
    _setLatencyWorkerFactory(() => new FakeWorker({}) as unknown as Worker);
    const { value } = await settle(measureTarget(OHIO_AWS), BUDGET);
    expect(assessSamples(value).stats).toMatchObject({ median: 42, ok: TOTAL_REQUESTS - 1 });
    expect(mainFetch).not.toHaveBeenCalled();
    expect(latencyWorkerFailed()).toBe(false);
  });

  it('constructor throws (e.g. CSP worker-src / SecurityError) → main thread', async () => {
    _setLatencyWorkerFactory(() => { throw new DOMException('blocked by CSP', 'SecurityError'); });
    const { value } = await settle(measureTarget(OHIO_AWS), BUDGET);
    expect(assessSamples(value).stats?.ok).toBe(TOTAL_REQUESTS - 1);
    expect(mainFetch).toHaveBeenCalledTimes(TOTAL_REQUESTS);
    expect(latencyWorkerFailed()).toBe(true);
  });

  it('script fails to load (404 / CSP reported async → error event) → main thread', async () => {
    _setLatencyWorkerFactory(() => {
      const w = new FakeWorker({ pong: false });
      setTimeout(() => w.emit('error', new Event('error')), 2);
      return w as unknown as Worker;
    });
    const { value, elapsed } = await settle(measureTarget(OHIO_AWS), BUDGET);
    expect(assessSamples(value).stats?.ok).toBe(TOTAL_REQUESTS - 1);
    expect(elapsed).toBeLessThan(WORKER_START_TIMEOUT_MS); // didn't wait for the handshake timeout
  });

  it('never answers the startup ping → main thread after the handshake timeout', async () => {
    _setLatencyWorkerFactory(() => new FakeWorker({ pong: false }) as unknown as Worker);
    const { value, elapsed } = await settle(measureTarget(OHIO_AWS), BUDGET);
    expect(assessSamples(value).stats?.ok).toBe(TOTAL_REQUESTS - 1);
    expect(elapsed).toBeGreaterThanOrEqual(WORKER_START_TIMEOUT_MS);
    expect(latencyWorkerFailed()).toBe(true);
  });

  it('goes silent mid-run → that sample is redone on the main thread, run completes', async () => {
    _setLatencyWorkerFactory(() => new FakeWorker({ answer: 4 }) as unknown as Worker);
    const { value } = await settle(measureTarget(OHIO_AWS), BUDGET);
    const stats = assessSamples(value).stats;
    expect(stats?.ok).toBe(TOTAL_REQUESTS - 1);
    expect(mainFetch).toHaveBeenCalledTimes(TOTAL_REQUESTS - 4);
    expect(latencyWorkerFailed()).toBe(true);
  });

  it('errors mid-run → remaining samples on the main thread, no wait', async () => {
    _setLatencyWorkerFactory(() => new FakeWorker({ errorAfter: 3 }) as unknown as Worker);
    const { value, elapsed } = await settle(measureTarget(OHIO_AWS), BUDGET);
    expect(assessSamples(value).stats?.ok).toBe(TOTAL_REQUESTS - 1);
    expect(mainFetch).toHaveBeenCalledTimes(TOTAL_REQUESTS - 3);
    expect(elapsed).toBeLessThan(SAMPLE_TIMEOUT_MS); // error event, not the watchdog
  });

  it('a whole city test with a dead worker still completes and resumes animations', async () => {
    _setLatencyWorkerFactory(() => new FakeWorker({ pong: false }) as unknown as Worker);
    const p = measureCityLatency(3);
    expect(animationsPaused()).toBe(true);
    const { value } = await settle(p, BUDGET);
    expect(value.status).toBe('ok');
    expect(animationsPaused()).toBe(false);
  });

  it('animations resume even if the test fails', async () => {
    _setLatencyWorkerFactory(null);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const { value } = await settle(measureCityLatency(3), BUDGET * 4);
    expect(value.status).toBe('unavailable');
    expect(animationsPaused()).toBe(false);
  });
});
