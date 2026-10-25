// Runs latency fetches off the main thread, so page rendering (WebGL,
// animations) can't delay when a response is noticed and inflate samples.
import { timedFetch } from './timed-fetch';

export type WorkerRequest =
  | { type: 'time'; id: number; url: string; mode: RequestMode; timeoutMs: number }
  | { type: 'abort'; id: number };
export interface WorkerResponse { id: number; sample: import('./timed-fetch').Sample }

const inflight = new Map<number, AbortController>();

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'abort') {
    inflight.get(msg.id)?.abort();
    return;
  }
  const ctrl = new AbortController();
  inflight.set(msg.id, ctrl);
  const sample = await timedFetch(msg.url, msg.mode, ctrl.signal, msg.timeoutMs);
  inflight.delete(msg.id);
  (self as unknown as Worker).postMessage({ id: msg.id, sample } satisfies WorkerResponse);
};
