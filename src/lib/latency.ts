// ─── Shared HTTP latency measurement ──────────────────────────
// One measurement path for the landing page and the dashboard, so both
// report the same number, method and datacenter for a city.
//
// Method (identical for every provider):
//   - TOTAL_REQUESTS small GETs to one host, sequential, so the browser
//     reuses one keep-alive connection. The first request opens DNS +
//     TCP + TLS and is dropped.
//   - Each request is cache-busted (unique `?t=`) and `cache: 'no-store'`.
//   - Each sample is wall-clock time from fetch() to response headers,
//     timed in a Web Worker when available (see sampleRequest).
//     (Neither provider sends Timing-Allow-Origin, so Resource Timing
//     can't break it down further; using one clock for both keeps
//     providers comparable.)
//   - Headline = median of the kept samples; spread = median absolute
//     deviation (MAD); min is kept as a secondary detail.
// This is HTTP round-trip time from the browser, not ICMP ping.

import { cityLatencyTargets, latencyTargetLabel, type LatencyTarget } from '@/data/ping-targets';
import { timedFetch, type Sample } from './timed-fetch';
import { pauseAnimationsForMeasurement } from './animation-pause';
import type { WorkerRequest, WorkerResponse } from './latency.worker';

export const TOTAL_REQUESTS = 10;
export const DROPPED_REQUESTS = 1;
export const TIMED_REQUESTS = TOTAL_REQUESTS - DROPPED_REQUESTS;
/** Fewer successful timed samples than this and the target is treated as failed. */
export const MIN_OK_SAMPLES = 6;
export const SAMPLE_TIMEOUT_MS = 4000;
/** Hard cap for one target (all requests). */
export const TARGET_TIMEOUT_MS = 20000;
const SAMPLE_GAP_MS = 60;
/** No HTTPS round trip to a cloud region from a browser is this fast; it means a cache or a block. */
export const MIN_PLAUSIBLE_MS = 1;

// ─── Speed-of-light floor ─────────────────────────────────────
// Light in optical fibre travels at ~c/1.47 ≈ 204,000 km/s, i.e. ~200 km
// per ms one way. A round trip over great-circle distance d therefore
// can't take less than 2·d / 200 km/ms = d / 100 ms (≈ 1 ms per 100 km of
// distance; real routes are longer, so real RTTs sit well above this).
// Any sample below PHYSICS_FLOOR_FACTOR × floor is rejected as impossible
// (a cache, a nearby interceptor, or a wrong location estimate).
/** One-way signal speed in fibre, km per millisecond. */
export const FIBER_KM_PER_MS = 200;
/** Samples below this fraction of the physics floor are rejected. */
export const PHYSICS_FLOOR_FACTOR = 0.9;
/** IP geolocation can be off by hundreds of km (mobile carriers often geolocate to a regional hub), so subtract this from the distance first; it only makes the floor more lenient. */
export const GEO_SLACK_KM = 500;

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Great-circle (haversine) distance in km. */
export function greatCircleKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Minimum physically possible RTT (ms) from `from` to `to`; 0 when the visitor location is unknown. */
export function physicsFloorMs(from: GeoPoint | null | undefined, to: GeoPoint): number {
  if (!from) return 0;
  const km = Math.max(0, greatCircleKm(from, to) - GEO_SLACK_KM);
  return (2 * km) / FIBER_KM_PER_MS;
}

/** Fastest sample we accept for a target with the given physics floor. */
export function minAcceptableMs(floorMs: number): number {
  return Math.max(MIN_PLAUSIBLE_MS, PHYSICS_FLOOR_FACTOR * floorMs);
}

// ─── Timer resolution / spread display ────────────────────────

let timerRes: number | null = null;

/** Observed performance.now() granularity in ms (Chrome ~0.1, Firefox/Safari ~1). */
export function timerResolutionMs(): number {
  if (timerRes !== null) return timerRes;
  let best = Infinity;
  for (let k = 0; k < 10; k++) {
    const a = performance.now();
    let b = a;
    let n = 0;
    while ((b = performance.now()) === a && n++ < 1e6) { /* spin until the clock ticks */ }
    if (b > a) best = Math.min(best, b - a);
  }
  timerRes = Number.isFinite(best) ? best : 1;
  return timerRes;
}

export const MAD_EXPLANATION = '± is median absolute deviation (typical spread around the median), not standard deviation.';

/**
 * Spread text: `± 3.2 ms`, or `< 1 ms` when it's below what the headline
 * (whole ms) and the browser's timer can resolve.
 */
export function formatSpread(mad: number, resolutionMs: number = timerResolutionMs()): string {
  const floor = Math.max(1, resolutionMs);
  if (mad < floor) return `< ${Math.round(floor)} ms`;
  return `± ${mad} ms`;
}

/** Spread text that always leads with ±: `± 3.2 ms` or `± < 1 ms` (used under the big number). */
export function formatSpreadPm(mad: number, resolutionMs: number = timerResolutionMs()): string {
  const t = formatSpread(mad, resolutionMs);
  return t.startsWith('±') ? t : `± ${t}`;
}

export interface LatencyStats {
  /** Median of kept samples (ms, rounded). */
  median: number;
  /** Median absolute deviation (ms, 1 decimal). */
  mad: number;
  /** Fastest kept sample (ms, rounded). */
  min: number;
  /** Successful timed samples. */
  ok: number;
  /** Timed requests attempted. */
  attempted: number;
}

export type LatencyStatus = 'ok' | 'unreliable' | 'unavailable';

export interface TargetAttempt {
  target: LatencyTarget;
  stats: LatencyStats | null;
  /** Why this target was rejected, if it was. */
  failure: string | null;
}

export interface LatencyResult {
  status: LatencyStatus;
  /** Present for `ok` and `unreliable`; never set for `unavailable`. */
  stats: LatencyStats | null;
  /** The target the numbers came from (or the last one tried). */
  target: LatencyTarget | null;
  /** True when the primary target failed and a fallback produced the numbers. */
  viaFallback: boolean;
  attempts: TargetAttempt[];
  /** Short user-facing reason for `unreliable` / `unavailable`. */
  note: string | null;
}

export interface MeasureProgress {
  target: LatencyTarget;
  /** 0-based index into the city's target list (0 = primary). */
  targetIndex: number;
  /** Requests finished for this target, including the dropped one. */
  done: number;
  total: number;
}

export interface MeasureOptions {
  signal?: AbortSignal;
  /** Visitor's approximate location, for the speed-of-light floor. */
  from?: GeoPoint | null;
  onProgress?: (p: MeasureProgress) => void;
}

// ─── Pure helpers (unit-tested) ───────────────────────────────

export function median(values: number[]): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function medianAbsoluteDeviation(values: number[]): number {
  if (!values.length) return NaN;
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

export type { Sample, SampleFailure } from './timed-fetch';

/**
 * Turn raw samples (first one already dropped) into stats, or a failure
 * reason when the data can't be trusted at all.
 */
export function assessSamples(
  samples: Sample[],
  floorMs = 0,
): { stats: LatencyStats | null; failure: string | null; inconsistent: boolean } {
  const attempted = samples.length;
  const minOk = minAcceptableMs(floorMs);
  const errors = samples.filter((s) => s.ms === null);
  const tooFast = samples.filter((s) => s.ms !== null && s.ms < minOk);
  const good = samples.map((s) => s.ms).filter((ms): ms is number => ms !== null && ms >= minOk);

  if (tooFast.length > attempted / 2) {
    const subMs = tooFast.filter((s) => (s.ms as number) < MIN_PLAUSIBLE_MS).length;
    return {
      stats: null,
      failure: subMs > attempted / 2
        ? 'implausibly fast responses (cached or blocked)'
        : `faster than physically possible from your approximate location (floor ${Math.round(floorMs)} ms)`,
      inconsistent: false,
    };
  }
  if (good.length < MIN_OK_SAMPLES) {
    const why = errors.find((e) => e.error)?.error ?? 'no response';
    return { stats: null, failure: `${good.length}/${attempted} responses (${why})`, inconsistent: false };
  }
  const med = median(good);
  const mad = medianAbsoluteDeviation(good);
  const stats: LatencyStats = {
    median: Math.max(1, Math.round(med)),
    mad: Math.round(mad * 10) / 10,
    min: Math.max(1, Math.round(Math.min(...good))),
    ok: good.length,
    attempted,
  };
  // Wildly inconsistent: typical deviation is more than half the median (and > 20 ms).
  const inconsistent = mad > 20 && mad > med * 0.5;
  return { stats, failure: null, inconsistent };
}

// ─── Browser measurement ──────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function bustedUrl(target: LatencyTarget): string {
  return `${target.url}?t=${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * One cache-busted GET on the calling thread; wall-clock ms to response
 * headers. Never rejects. See `timedFetch` for how failures and HTTP
 * statuses are classified.
 */
export function timeRequest(
  target: LatencyTarget,
  signal?: AbortSignal,
  timeoutMs: number = SAMPLE_TIMEOUT_MS,
): Promise<Sample> {
  return timedFetch(bustedUrl(target), target.mode, signal, timeoutMs);
}

// ─── Off-main-thread timing ───────────────────────────────────
// A busy main thread (WebGL, animations) delays when a fetch() promise is
// noticed, which inflates samples by up to a frame (measured: +60 ms in
// headless Chromium with software WebGL). A dedicated worker has its own
// event loop, so samples are timed there when Workers are available.
//
// The worker is strictly optional and can never hang a test:
//  - no Worker API, or the constructor throws (CSP worker-src, SecurityError)
//      → main thread
//  - the worker doesn't answer a startup ping within WORKER_START_TIMEOUT_MS
//    (script 404, CSP refusal reported asynchronously, broken bundle)
//      → main thread
//  - the worker errors, or doesn't answer a sample within
//    SAMPLE_TIMEOUT_MS + WORKER_REPLY_GRACE_MS → worker is discarded and that
//    sample is redone on the main thread; later samples use the main thread.
// Once the worker has failed it isn't retried this page load.

/** How long the worker gets to answer its startup ping. */
export const WORKER_START_TIMEOUT_MS = 1500;
/** Extra time over the per-sample timeout before a silent worker is abandoned. */
export const WORKER_REPLY_GRACE_MS = 1000;

type WorkerLike = Pick<Worker, 'postMessage' | 'terminate' | 'addEventListener'>;

const defaultWorkerFactory = (): WorkerLike =>
  new Worker(new URL('./latency.worker.ts', import.meta.url), { type: 'module' });

let workerFactory: (() => WorkerLike) | null = typeof Worker === 'undefined' ? null : defaultWorkerFactory;
let workerReady: Promise<WorkerLike | null> | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, (s: Sample | null) => void>();

function discardWorker(w: WorkerLike | null) {
  workerBroken = true;
  try { w?.terminate(); } catch { /* already gone */ }
  for (const resolve of pending.values()) resolve(null);
  pending.clear();
}

function startWorker(): Promise<WorkerLike | null> {
  if (workerBroken || !workerFactory) return Promise.resolve(null);
  if (workerReady) return workerReady;
  const factory = workerFactory;
  workerReady = new Promise<WorkerLike | null>((resolve) => {
    let w: WorkerLike;
    try {
      w = factory();
    } catch {
      discardWorker(null);
      resolve(null);
      return;
    }
    const timer = setTimeout(() => { discardWorker(w); resolve(null); }, WORKER_START_TIMEOUT_MS);
    w.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      if (e.data?.type === 'pong') {
        clearTimeout(timer);
        resolve(w);
        return;
      }
      const done = pending.get(e.data?.id);
      pending.delete(e.data?.id);
      done?.(e.data.sample ?? null);
    });
    w.addEventListener('error', () => { clearTimeout(timer); discardWorker(w); resolve(null); });
    w.addEventListener('messageerror', () => { clearTimeout(timer); discardWorker(w); resolve(null); });
    try {
      w.postMessage({ type: 'ping' } satisfies WorkerRequest);
    } catch {
      clearTimeout(timer);
      discardWorker(w);
      resolve(null);
    }
  });
  return workerReady;
}

/** Test hook: replace (or with `null`, disable) the latency worker and reset its state. */
export function _setLatencyWorkerFactory(factory: (() => WorkerLike) | null): void {
  workerFactory = factory;
  workerReady = null;
  workerBroken = false;
  pending.clear();
}

/** True if the worker path has been abandoned this page load. */
export function latencyWorkerFailed(): boolean {
  return workerBroken;
}

/** Time one request in the latency worker, falling back to the main thread. */
async function sampleRequest(target: LatencyTarget, signal?: AbortSignal): Promise<Sample> {
  const w = await startWorker();
  if (!w) return timeRequest(target, signal);
  if (signal?.aborted) return { ms: null, error: 'aborted' };
  const id = nextId++;
  const result = await new Promise<Sample | null>((resolve) => {
    const finish = (s: Sample | null) => {
      clearTimeout(watchdog);
      signal?.removeEventListener('abort', onAbort);
      pending.delete(id);
      resolve(s);
    };
    const onAbort = () => {
      try { w.postMessage({ type: 'abort', id } satisfies WorkerRequest); } catch { /* worker gone */ }
      finish({ ms: null, error: 'aborted' });
    };
    // A worker that goes silent is abandoned rather than waited on forever.
    const watchdog = setTimeout(() => { discardWorker(w); }, SAMPLE_TIMEOUT_MS + WORKER_REPLY_GRACE_MS);
    pending.set(id, finish);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      w.postMessage({ type: 'time', id, url: bustedUrl(target), mode: target.mode, timeoutMs: SAMPLE_TIMEOUT_MS } satisfies WorkerRequest);
    } catch {
      discardWorker(w);
    }
  });
  if (signal?.aborted) return { ms: null, error: 'aborted' };
  // null → the worker died or went silent; redo this sample on the main thread.
  return result ?? timeRequest(target, signal);
}

/** All requests to one target: 1 dropped warm-up + TIMED_REQUESTS samples. */
export async function measureTarget(
  target: LatencyTarget,
  opts: MeasureOptions & { targetIndex?: number } = {},
): Promise<Sample[]> {
  const { signal, onProgress, targetIndex = 0 } = opts;
  const samples: Sample[] = [];
  const deadline = performance.now() + TARGET_TIMEOUT_MS;
  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    if (signal?.aborted) break;
    if (performance.now() > deadline) {
      samples.push({ ms: null, error: 'timeout' });
      continue;
    }
    const s = await sampleRequest(target, signal);
    if (i >= DROPPED_REQUESTS) samples.push(s);
    // A dead warm-up usually means a dead host: stop early instead of
    // waiting for nine more timeouts.
    if (i === 0 && s.ms === null) {
      for (let j = 0; j < TIMED_REQUESTS; j++) samples.push({ ms: null, error: s.error });
      onProgress?.({ target, targetIndex, done: TOTAL_REQUESTS, total: TOTAL_REQUESTS });
      break;
    }
    onProgress?.({ target, targetIndex, done: i + 1, total: TOTAL_REQUESTS });
    if (i < TOTAL_REQUESTS - 1) await sleep(SAMPLE_GAP_MS);
  }
  return samples;
}

/**
 * Measure a city: its primary target, then each fallback in order until
 * one gives trustworthy numbers. Never invents a number: if every target
 * fails, the result is `unavailable` with no stats.
 */
export async function measureCityLatency(cityId: number, opts: MeasureOptions = {}): Promise<LatencyResult> {
  const resume = pauseAnimationsForMeasurement();
  try {
    return await measureCityLatencyInner(cityId, opts);
  } finally {
    resume();
  }
}

async function measureCityLatencyInner(cityId: number, opts: MeasureOptions): Promise<LatencyResult> {
  const targets = cityLatencyTargets(cityId);
  const attempts: TargetAttempt[] = [];
  let shaky: TargetAttempt | null = null;

  for (let i = 0; i < targets.length; i++) {
    if (opts.signal?.aborted) break;
    const target = targets[i];
    const samples = await measureTarget(target, { ...opts, targetIndex: i });
    const { stats, failure, inconsistent } = assessSamples(samples, physicsFloorMs(opts.from, target));
    const attempt: TargetAttempt = { target, stats, failure: failure ?? (inconsistent ? 'inconsistent samples' : null) };
    attempts.push(attempt);
    if (stats && !inconsistent) {
      return { status: 'ok', stats, target, viaFallback: i > 0, attempts, note: null };
    }
    if (stats && inconsistent && !shaky) shaky = attempt;
  }

  if (shaky?.stats) {
    return {
      status: 'unreliable',
      stats: shaky.stats,
      target: shaky.target,
      viaFallback: shaky.target !== targets[0],
      attempts,
      note: 'Samples varied a lot — your connection may be busy. Try again.',
    };
  }
  const last = attempts[attempts.length - 1] ?? null;
  const physics = attempts.some((a) => a.failure?.startsWith('faster than physically'));
  return {
    status: 'unavailable',
    stats: null,
    target: last?.target ?? targets[0] ?? null,
    viaFallback: false,
    attempts,
    note: attempts.length
      ? `No reliable response from ${attempts.map((a) => latencyTargetLabel(a.target)).join(' or ')}.` +
        (physics ? ' Some replies were faster than light allows from your approximate location (a cache, proxy, or wrong location estimate).' : '')
      : 'No test endpoint for this city.',
  };
}

// ─── Shared rating copy ───────────────────────────────────────

export function latencyColor(ms: number | null): string {
  if (ms === null) return '#9CA3AF';
  if (ms < 40) return '#4ADE80';
  if (ms < 80) return '#A3E635';
  if (ms < 130) return '#FBBF24';
  return '#EF4444';
}

export function latencyLabel(ms: number | null): string {
  if (ms === null) return 'Unavailable';
  if (ms < 40) return 'Excellent';
  if (ms < 80) return 'Good';
  if (ms < 130) return 'Fair';
  return 'Poor';
}

export const LATENCY_NOTE = 'Measured from your browser over HTTPS, not ICMP ping — may differ from a terminal ping.';
