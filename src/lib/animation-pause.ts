// Pauses decorative render loops (3D globe, cube, map arcs) while a latency
// test runs, so the main thread stays idle. Second layer of protection on
// top of timing requests in a Web Worker.

let active = 0;
const resumers = new Set<() => void>();

/** True while any latency measurement is running. */
export function animationsPaused(): boolean {
  return active > 0;
}

/** Mark a latency measurement as running; call the returned function once when it ends. */
export function pauseAnimationsForMeasurement(): () => void {
  active++;
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    active = Math.max(0, active - 1);
    if (active === 0) resumers.forEach((r) => r());
  };
}

/**
 * requestAnimationFrame loop that stops scheduling frames entirely while a
 * latency test runs and restarts when it ends. Returns a stop function.
 */
export function pausableRafLoop(step: () => void): () => void {
  let id = 0;
  let stopped = false;
  const tick = () => {
    id = 0;
    if (stopped || active > 0) return; // paused: no frame scheduled until resume()
    step();
    id = requestAnimationFrame(tick);
  };
  const resume = () => {
    if (!stopped && id === 0) id = requestAnimationFrame(tick);
  };
  resumers.add(resume);
  id = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    if (id) cancelAnimationFrame(id);
    resumers.delete(resume);
  };
}
