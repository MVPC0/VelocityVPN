import { afterEach, describe, expect, it, vi } from 'vitest';
import { assessSamples, median, medianAbsoluteDeviation, measureCityLatency, MIN_OK_SAMPLES, TOTAL_REQUESTS } from './latency';
import { cityLatencyTargets } from '@/data/ping-targets';

const ok = (ms: number) => ({ ms });
const fail = (error = 'timeout') => ({ ms: null, error });

describe('stats', () => {
  it('median and MAD', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    // one huge outlier barely moves median or MAD
    const v = [20, 21, 19, 20, 22, 20, 21, 20, 900];
    expect(median(v)).toBe(20);
    expect(medianAbsoluteDeviation(v)).toBe(1);
  });

  it('accepts 9 good samples', () => {
    const r = assessSamples([20, 21, 19, 20, 22, 20, 21, 20, 23].map(ok));
    expect(r.failure).toBeNull();
    expect(r.inconsistent).toBe(false);
    expect(r.stats).toMatchObject({ median: 20, mad: 1, min: 19, ok: 9, attempted: 9 });
  });

  it(`fails below ${MIN_OK_SAMPLES} successful samples`, () => {
    const r = assessSamples([...[20, 21, 19, 20, 22].map(ok), fail(), fail(), fail(), fail()]);
    expect(r.stats).toBeNull();
    expect(r.failure).toMatch(/5\/9/);
  });

  it('rejects implausibly fast (cached/blocked) responses', () => {
    const r = assessSamples(Array.from({ length: 9 }, () => ok(0.2)));
    expect(r.stats).toBeNull();
    expect(r.failure).toMatch(/implausibly fast/);
  });

  it('flags wildly inconsistent samples', () => {
    const r = assessSamples([10, 200, 15, 300, 12, 250, 20, 180, 400].map(ok));
    expect(r.stats).not.toBeNull();
    expect(r.inconsistent).toBe(true);
  });
});

describe('measureCityLatency', () => {
  afterEach(() => vi.unstubAllGlobals());

  const fakeFetch = (dead: (url: string) => boolean) =>
    vi.fn(async (url: string) => {
      if (dead(url)) throw new TypeError('Failed to fetch');
      await new Promise((r) => setTimeout(r, 2));
      return { ok: true, status: 200, type: 'cors', arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Response;
    });

  it('uses the primary target, 10 requests, first dropped', async () => {
    const f = fakeFetch(() => false);
    vi.stubGlobal('fetch', f);
    const r = await measureCityLatency(3);
    expect(r.status).toBe('ok');
    expect(r.viaFallback).toBe(false);
    expect(r.target).toBe(cityLatencyTargets(3)[0]);
    expect(r.stats?.attempted).toBe(9);
    expect(f).toHaveBeenCalledTimes(TOTAL_REQUESTS);
    const urls = f.mock.calls.map((c) => c[0]);
    expect(new Set(urls).size).toBe(TOTAL_REQUESTS); // every request cache-busted
  });

  it('falls back when the primary is blocked', async () => {
    vi.stubGlobal('fetch', fakeFetch((u) => u.includes('amazonaws.com')));
    const r = await measureCityLatency(3);
    expect(r.status).toBe('ok');
    expect(r.viaFallback).toBe(true);
    expect(r.target?.provider).toBe('Azure');
  });

  it('is unavailable (no number) when everything fails', async () => {
    vi.stubGlobal('fetch', fakeFetch(() => true));
    const r = await measureCityLatency(3);
    expect(r.status).toBe('unavailable');
    expect(r.stats).toBeNull();
    expect(r.attempts).toHaveLength(2);
  });
});
