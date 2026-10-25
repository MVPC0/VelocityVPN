import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { measureCityLatency, type LatencyResult, type MeasureProgress } from '@/lib/latency';

// Latest result per city, shared by the landing page and the dashboard so
// both show the same measurement for the same city in a session.
const latest = new Map<number, LatencyResult>();
let snapshot: ReadonlyMap<number, LatencyResult> = new Map();
const listeners = new Set<() => void>();

function publish(cityId: number, result: LatencyResult) {
  latest.set(cityId, result);
  snapshot = new Map(latest);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Latest latency result for every city measured this session. */
export function useLatencyResults(): ReadonlyMap<number, LatencyResult> {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

/** Measure one city (cancels the previous run); result is shared via useLatencyResults. */
export async function runCityLatency(
  cityId: number,
  opts: { signal?: AbortSignal; onProgress?: (p: MeasureProgress) => void } = {},
): Promise<LatencyResult | null> {
  const result = await measureCityLatency(cityId, opts);
  if (opts.signal?.aborted) return null;
  publish(cityId, result);
  return result;
}

/** Single-city runner with progress, for the landing-page test. */
export function useCityLatency() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<MeasureProgress | null>(null);
  const [result, setResult] = useState<LatencyResult | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const run = useCallback(async (cityId: number) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setRunning(true);
    setResult(null);
    setProgress(null);
    const r = await runCityLatency(cityId, {
      signal: c.signal,
      onProgress: (p) => { if (!c.signal.aborted) setProgress(p); },
    });
    if (c.signal.aborted) return null;
    setResult(r);
    setRunning(false);
    return r;
  }, []);

  useEffect(() => () => ctrl.current?.abort(), []);

  return { running, progress, result, run };
}
