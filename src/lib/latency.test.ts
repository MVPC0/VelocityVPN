import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assessSamples, formatSpread, formatSpreadPm, median, medianAbsoluteDeviation, measureCityLatency, measureTarget,
  MIN_OK_SAMPLES, physicsFloorMs, timeRequest, TOTAL_REQUESTS, type Sample,
} from './latency';
import { cityLatencyTargets, latencyHeadlineLabel } from '@/data/ping-targets';

const ok = (ms: number): Sample => ({ ms });
const fail = (error: Sample['error'] = 'timeout'): Sample => ({ ms: null, error });
const CHICAGO = { lat: 41.88, lng: -87.63 };
const LONDON_AWS = cityLatencyTargets(8)[0];
const OHIO_AWS = cityLatencyTargets(3)[0];
const AZURE_CHICAGO = cityLatencyTargets(3)[1];

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

describe('speed-of-light floor', () => {
  it('Chicago → London floor is ~59 ms (6,350 km, 500 km geo slack, 200 km/ms)', () => {
    const f = physicsFloorMs(CHICAGO, LONDON_AWS);
    expect(f).toBeGreaterThan(55);
    expect(f).toBeLessThan(62);
  });

  it('rejects a US visitor reading London under ~50 ms', () => {
    const r = assessSamples(Array.from({ length: 9 }, (_, i) => ok(48 + i * 0.3)), physicsFloorMs(CHICAGO, LONDON_AWS));
    expect(r.stats).toBeNull();
    expect(r.failure).toMatch(/faster than physically possible/);
  });

  it('accepts a realistic US → London reading', () => {
    const r = assessSamples([95, 96, 94, 97, 95, 96, 98, 95, 94].map(ok), physicsFloorMs(CHICAGO, LONDON_AWS));
    expect(r.failure).toBeNull();
    expect(r.stats?.median).toBe(95);
  });

  it('drops individual impossible samples but keeps the rest', () => {
    const r = assessSamples([10, 12, 95, 96, 94, 97, 95, 96, 98].map(ok), physicsFloorMs(CHICAGO, LONDON_AWS));
    expect(r.stats).toMatchObject({ ok: 7, median: 96 });
  });

  it('no floor when the visitor location is unknown, nearby targets unaffected', () => {
    expect(physicsFloorMs(null, LONDON_AWS)).toBe(0);
    expect(physicsFloorMs(CHICAGO, OHIO_AWS)).toBe(0); // 440 km < slack
    expect(assessSamples(Array.from({ length: 9 }, () => ok(3)), physicsFloorMs(CHICAGO, OHIO_AWS)).failure).toBeNull();
  });

  it('keeps the absolute <1 ms floor', () => {
    expect(assessSamples(Array.from({ length: 9 }, () => ok(0.4)), 0).failure).toMatch(/implausibly fast/);
  });

  it('city result is unavailable (no number) when every target breaks physics', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => (await new Promise((r) => setTimeout(r, 5)), { ok: true, status: 200, type: 'cors', arrayBuffer: async () => new ArrayBuffer(0) }) as unknown as Response));
    const r = await measureCityLatency(8, { from: CHICAGO });
    vi.unstubAllGlobals();
    expect(r.status).toBe('unavailable');
    expect(r.stats).toBeNull();
    expect(r.note).toMatch(/faster than light/);
  });
});

describe('timeRequest classification', () => {
  afterEach(() => vi.unstubAllGlobals());
  const resp = (status: number, type: ResponseType) =>
    vi.fn(async () => (await new Promise((r) => setTimeout(r, 3)), { ok: status >= 200 && status < 300, status, type, arrayBuffer: async () => new ArrayBuffer(0) }) as unknown as Response);

  it.each([200, 403, 404, 429, 503])('readable CORS HTTP %i is a real round trip (sample kept, status recorded)', async (status) => {
    vi.stubGlobal('fetch', resp(status, 'cors'));
    const s = await timeRequest(OHIO_AWS);
    expect(s.ms).not.toBeNull();
    expect(s.status).toBe(status);
    expect(s.error).toBeUndefined();
  });

  it('opaque no-cors response that resolved is a round trip (status hidden)', async () => {
    vi.stubGlobal('fetch', resp(0, 'opaque'));
    const s = await timeRequest(AZURE_CHICAGO);
    expect(s.ms).not.toBeNull();
    expect(s.status).toBeUndefined();
  });

  it('TypeError (network / CORS rejection / blocked) is a failure, not a sample', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect(await timeRequest(OHIO_AWS)).toEqual({ ms: null, error: 'network error' });
  });

  const hang = () => vi.fn((_u: string, init?: RequestInit) => new Promise<Response>((_, rej) => {
    init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
  }));

  it('per-sample timeout is a failure', async () => {
    vi.stubGlobal('fetch', hang());
    expect(await timeRequest(OHIO_AWS, undefined, 20)).toEqual({ ms: null, error: 'timeout' });
  });

  it('caller abort is a failure', async () => {
    vi.stubGlobal('fetch', hang());
    const c = new AbortController();
    setTimeout(() => c.abort(), 10);
    expect(await timeRequest(OHIO_AWS, c.signal, 5000)).toEqual({ ms: null, error: 'aborted' });
  });

  it('all-503 target still yields round-trip stats; all-TypeError target yields none', async () => {
    vi.stubGlobal('fetch', resp(503, 'cors'));
    expect(assessSamples(await measureTarget(OHIO_AWS)).stats?.ok).toBe(9);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const failed = assessSamples(await measureTarget(OHIO_AWS));
    expect(failed.stats).toBeNull();
    expect(failed.failure).toMatch(/0\/9.*network error/);
  });
});

describe('display copy', () => {
  it('spread below timer resolution / 1 ms shows "< 1 ms"', () => {
    expect(formatSpread(0.5, 1)).toBe('< 1 ms');
    expect(formatSpread(0.5, 0.1)).toBe('< 1 ms');
    expect(formatSpread(2.3, 0.1)).toBe('± 2.3 ms');
    // label under the big number always leads with ±
    expect(formatSpreadPm(0.5, 0.1)).toBe('± < 1 ms');
    expect(formatSpreadPm(2.3, 0.1)).toBe('± 2.3 ms');
  });

  it('result labels name the datacenter honestly', () => {
    expect(latencyHeadlineLabel(LONDON_AWS)).toBe('Latency to AWS London');
    expect(latencyHeadlineLabel(OHIO_AWS)).toBe('Latency to nearest AWS region (Ohio)');
    expect(latencyHeadlineLabel(AZURE_CHICAGO, true)).toBe('Latency to Azure Chicago (fallback)');
  });
});
