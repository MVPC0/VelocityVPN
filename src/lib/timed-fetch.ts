// Dependency-free timing core, shared by the main thread and the
// latency Web Worker (src/lib/latency.worker.ts).

/** Why a request produced no sample. These are never counted as round trips. */
export type SampleFailure = 'timeout' | 'network error' | 'aborted';

/**
 * Per-request outcome. `ms` is null when the request failed.
 * `status` is the HTTP status when the response was readable (CORS);
 * undefined for opaque (no-cors) responses, whose status is hidden.
 */
export interface Sample {
  ms: number | null;
  error?: SampleFailure;
  status?: number;
}

/**
 * One GET; wall-clock ms to response headers. Never rejects.
 *
 * Classification:
 *  - fetch() resolved with a readable (CORS) response → a real server
 *    answered, so ANY HTTP status (2xx, 4xx, 5xx) is a valid round trip;
 *    the status is recorded on the sample.
 *  - fetch() resolved with an opaque (no-cors) response → the browser got a
 *    real HTTP response from the server (status hidden) → valid round trip.
 *  - fetch() rejected → never a sample:
 *      caller aborted         → 'aborted'
 *      our per-sample timer   → 'timeout'
 *      anything else (TypeError: DNS/TCP/TLS failure, CORS rejection,
 *      blocked by an extension or firewall) → 'network error'
 */
export async function timedFetch(
  url: string,
  mode: RequestMode,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<Sample> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const start = performance.now();
  let res: Response;
  try {
    res = await fetch(url, {
      cache: 'no-store',
      mode,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    if (signal?.aborted) return { ms: null, error: 'aborted' };
    if (timedOut) return { ms: null, error: 'timeout' };
    return { ms: null, error: 'network error' };
  }
  const ms = performance.now() - start;
  try {
    // Drain the tiny body so the connection is free for the next request.
    await res.arrayBuffer().catch(() => undefined);
    if (res.type === 'opaque') return { ms };
    return { ms, status: res.status };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
