// Runs latency fetches off the main thread, so page rendering (WebGL,
// animations) can't delay when a response is noticed and inflate samples.
import { timedFetch, type Sample } from './timed-fetch';

export type WorkerRequest =
  | { type: 'ping' }
  | { type: 'time'; id: number; url: string; mode: RequestMode; timeoutMs: number }
  | { type: 'abort'; id: number };
export type WorkerResponse =
  | { type: 'pong'; id?: undefined; sample?: undefined }
  | { type: 'sample'; id: number; sample: Sample };

const inflight = new Map<number, AbortController>();
const post = (m: WorkerResponse) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'ping') {
    post({ type: 'pong' });
    return;
  }
  if (msg.type === 'abort') {
    inflight.get(msg.id)?.abort();
    return;
  }
  const ctrl = new AbortController();
  inflight.set(msg.id, ctrl);
  const sample = await timedFetch(msg.url, msg.mode, ctrl.signal, msg.timeoutMs);
  inflight.delete(msg.id);
  post({ type: 'sample', id: msg.id, sample });
};
