// ─── Shared HTTP latency measurement ──────────────────────────
// One measurement path for the landing page and the dashboard, so both
// report the same number, method and datacenter for a city.
//
// Method (identical for every provider):
//   - TOTAL_REQUESTS small GETs to one host, sequential, so the browser
//     reuses one keep-alive connection. The first request opens DNS +
//     TCP + TLS and is dropped.
//   - Each request is cache-busted (unique `?t=`) and `cache: 'no-store'`.
//   - Each sample is wall-clock time from fetch() to response headers.
//     (Neither provider sends Timing-Allow-Origin, so Resource Timing
//     can't break it down further; using one clock for both keeps
//     providers comparable.)
//   - Headline = median of the kept samples; spread = median absolute
//     deviation (MAD); min is kept as a secondary detail.
// This is HTTP round-trip time from the browser, not ICMP ping.

import { cityLatencyTargets, latencyTargetLabel, type LatencyTarget } from '@/data/ping-targets';

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

/** Per-request outcome. `ms` is null when the request failed. */
export interface Sample {
  ms: number | null;
  error?: string;
}

/**
 * Turn raw samples (first one already dropped) into stats, or a failure
 * reason when the data can't be trusted at all.
 */
export function assessSamples(samples: Sample[]): { stats: LatencyStats | null; failure: string | null; inconsistent: boolean } {
  const attempted = samples.length;
  const errors = samples.filter((s) => s.ms === null);
  const tooFast = samples.filter((s) => s.ms !== null && s.ms < MIN_PLAUSIBLE_MS).length;
  const good = samples.map((s) => s.ms).filter((ms): ms is number => ms !== null && ms >= MIN_PLAUSIBLE_MS);

  if (tooFast > attempted / 2) {
    return { stats: null, failure: 'implausibly fast responses (cached or blocked)', inconsistent: false };
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

/** One cache-busted GET; wall-clock ms to response headers. Never rejects. */
export async function timeRequest(target: LatencyTarget, signal?: AbortSignal): Promise<Sample> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), SAMPLE_TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(bustedUrl(target), {
      cache: 'no-store',
      mode: target.mode,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    const ms = performance.now() - start;
    // Drain the tiny body so the connection is free for the next request.
    await res.arrayBuffer().catch(() => undefined);
    // CORS responses are readable: reject HTTP errors. Opaque (no-cors)
    // responses hide the status; the plausibility checks cover those.
    if (res.type !== 'opaque' && !res.ok) return { ms: null, error: `HTTP ${res.status}` };
    return { ms };
  } catch {
    return { ms: null, error: controller.signal.aborted && !signal?.aborted ? 'timeout' : 'network error' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
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
    const s = await timeRequest(target, signal);
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
  const targets = cityLatencyTargets(cityId);
  const attempts: TargetAttempt[] = [];
  let shaky: TargetAttempt | null = null;

  for (let i = 0; i < targets.length; i++) {
    if (opts.signal?.aborted) break;
    const target = targets[i];
    const samples = await measureTarget(target, { ...opts, targetIndex: i });
    const { stats, failure, inconsistent } = assessSamples(samples);
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
  return {
    status: 'unavailable',
    stats: null,
    target: last?.target ?? targets[0] ?? null,
    viaFallback: false,
    attempts,
    note: attempts.length
      ? `No reliable response from ${attempts.map((a) => latencyTargetLabel(a.target)).join(' or ')}.`
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
