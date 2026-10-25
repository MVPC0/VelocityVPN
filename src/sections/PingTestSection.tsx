import React, { useState, useRef, useEffect, useCallback } from 'react';
import SectionHeader from '@/components/SectionHeader';
import Button from '@/components/Button';
import CountUp from 'react-countup';
import WorldDotMap from '@/components/WorldDotMap';
import { useClosestServer } from '@/hooks/useGeoLocation';
import { MAP_CITIES } from '@/lib/world-map';
import type { MapCity } from '@/lib/world-map';
import { getPingTarget, pingTargetLabel } from '@/data/ping-targets';
import type { PingTarget } from '@/data/ping-targets';
import { MapPin, Zap, RefreshCw } from 'lucide-react';

type PingState = 'idle' | 'testing' | 'result';

const WARMUP_COUNT = 1;
const SAMPLE_COUNT = 5;
const SAMPLE_TIMEOUT_MS = 4000;
const RUN_TIMEOUT_MS = 15000;

type PingMethod = 'resource-timing' | 'wall-clock';

interface PingResult {
  /** Minimum RTT across timed samples (ms), or null if none succeeded. */
  min: number | null;
  /** max - min across timed samples (ms). */
  jitter: number | null;
  ok: number;
  method: PingMethod;
}

const EMPTY_RESULT: PingResult = { min: null, jitter: null, ok: 0, method: 'wall-clock' };

function getPingColor(ping: number | null): string {
  if (ping === null) return '#9CA3AF';
  if (ping < 40) return '#4ADE80';
  if (ping < 80) return '#A3E635';
  if (ping < 130) return '#FBBF24';
  return '#EF4444';
}

function getPingLabel(ping: number | null): string {
  if (ping === null) return 'No response';
  if (ping < 40) return 'Excellent';
  if (ping < 80) return 'Good';
  if (ping < 130) return 'Fair';
  return 'Poor';
}

const hostOf = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

/**
 * One HTTP round trip to the datacenter on an already-warm connection.
 * Uses Resource Timing (responseStart - requestStart) when the server
 * exposes it, otherwise wall-clock time until response headers arrive.
 * Resolves null on error/timeout; never rejects.
 */
async function measureRtt(target: PingTarget): Promise<{ ms: number; method: PingMethod } | null> {
  const url = `${target.url}?t=${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SAMPLE_TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      mode: target.mode,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    const headersAt = performance.now();
    await res.arrayBuffer().catch(() => undefined);
    const entry = performance.getEntriesByName(url).pop() as PerformanceResourceTiming | undefined;
    if (entry && entry.requestStart > 0 && entry.responseStart > entry.requestStart) {
      return { ms: entry.responseStart - entry.requestStart, method: 'resource-timing' };
    }
    return { ms: headersAt - start, method: 'wall-clock' };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

const PingTestSection: React.FC = () => {
  const { location, closestServer, distance, loading: geoLoading, detect } = useClosestServer(MAP_CITIES);
  const [state, setState] = useState<PingState>('idle');
  const [selected, setSelected] = useState<MapCity | null>(null);
  const [result, setResult] = useState<PingResult>(EMPTY_RESULT);
  const [warming, setWarming] = useState(false);
  const [samplesDone, setSamplesDone] = useState(0);
  const sparkleCanvasRef = useRef<HTMLCanvasElement>(null);
  const runIdRef = useRef(0);
  const hasAutoRun = useRef(false);

  const closestId = closestServer?.id ?? null;
  const isClosest = (city: MapCity) => closestId === city.id;

  const runPingTest = useCallback(async (city: MapCity) => {
    const runId = ++runIdRef.current;
    const current = () => runIdRef.current === runId;
    setSelected(city);
    setState('testing');
    setSamplesDone(0);

    setWarming(true);
    const target = getPingTarget(city.id);

    const samples: number[] = [];
    let method: PingMethod = 'wall-clock';
    const sampling = (async () => {
      if (!target) return;
      // Warm-up: opens DNS + TCP + TLS so timed samples measure only the
      // network round trip, like a game's already-open connection.
      for (let i = 0; i < WARMUP_COUNT && current(); i++) await measureRtt(target);
      if (!current()) return;
      setWarming(false);
      for (let i = 0; i < SAMPLE_COUNT && current(); i++) {
        const sample = await measureRtt(target);
        if (!current()) return;
        if (sample) {
          samples.push(sample.ms);
          if (sample.method === 'resource-timing') method = 'resource-timing';
        }
        setSamplesDone(i + 1);
        if (i < SAMPLE_COUNT - 1) await new Promise((r) => window.setTimeout(r, 60));
      }
    })();

    let capTimer = 0;
    try {
      await Promise.race([
        sampling,
        new Promise<void>((r) => { capTimer = window.setTimeout(r, RUN_TIMEOUT_MS); }),
      ]);
    } catch {
      // measureRtt never rejects; keep whatever samples we have
    } finally {
      window.clearTimeout(capTimer);
      if (current()) {
        const min = samples.length ? Math.min(...samples) : null;
        const max = samples.length ? Math.max(...samples) : null;
        setResult({
          min: min === null ? null : Math.max(1, Math.round(min)),
          jitter: min === null || max === null ? null : Math.round(max - min),
          ok: samples.length,
          method,
        });
        setWarming(false);
        setState('result');
      }
    }
  }, []);

  // Auto-test the closest city once, after location detection
  useEffect(() => {
    if (!closestServer || hasAutoRun.current || state !== 'idle') return;
    const city = MAP_CITIES.find((c) => c.id === closestServer.id);
    if (!city) return;
    hasAutoRun.current = true;
    const t = window.setTimeout(() => runPingTest(city), 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closestServer]);

  // Cancel any in-flight run on unmount
  useEffect(() => () => { runIdRef.current++; }, []);

  // Small burst when a result lands (skipped for reduced motion)
  useEffect(() => {
    if (state !== 'result' || result.min === null) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = sparkleCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = 200;
    canvas.height = 200;
    const color = getPingColor(result.min);
    const particles = Array.from({ length: 12 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      const speed = 1 + Math.random() * 2;
      return { x: 100, y: 100, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, alpha: 1, size: 2 + Math.random() * 2 };
    });
    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, 200, 200);
      let alive = false;
      for (const p of particles) {
        if (p.alpha <= 0) continue;
        alive = true;
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.02; p.size *= 0.98;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (alive) frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, [state, result.min]);

  const testing = state === 'testing';
  const target = selected ? getPingTarget(selected.id) : undefined;
  const pingResult = result.min;

  return (
    <section
      id="ping-test"
      // Positioned above the fixed hero globe canvas (z-index 1) so it can't bleed through.
      className="relative z-[2] w-full py-20 md:py-28 bg-[#0A0A0F] border-t border-[rgba(255,255,255,0.08)]"
    >
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
        <SectionHeader
          eyebrow="PING TEST"
          title="Test Your Connection"
          subtitle="Estimate of round-trip latency to a cloud datacenter near that city (typically within a few ms of in-game ping to servers hosted there), not ICMP."
        />

        <div className="mt-6 text-center">
          {geoLoading ? (
            <div className="inline-flex items-center gap-2 text-sm text-[#6B7280]">
              <MapPin size={14} className="motion-safe:animate-pulse" />
              Detecting your location...
            </div>
          ) : closestServer ? (
            <div className="inline-flex items-center gap-2 text-sm text-[#4ADE80] bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.2)] px-4 py-2 rounded-full">
              <Zap size={14} />
              Closest city: <strong>{closestServer.city}</strong> ({distance}mi away)
            </div>
          ) : (
            <div className="text-sm text-[#6B7280]">
              <MapPin size={14} className="inline mr-1" />
              Tap a city below to run a browser timing sample, or
              <button
                onClick={() => detect()}
                className="ml-1 text-[#E85D4E] hover:underline bg-transparent border-0 cursor-pointer"
              >
                try detecting your location
              </button>
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-col lg:flex-row gap-10 lg:gap-12">
          {/* Map */}
          <div className="lg:w-[60%] relative">
            <div className="relative w-full bg-[#050507] rounded-xl border border-[rgba(255,255,255,0.08)] overflow-hidden shadow-[inset_0_0_60px_rgba(155,109,255,0.04)] p-2 sm:p-3">
              <WorldDotMap
                cities={MAP_CITIES}
                closestId={closestId}
                selectedId={selected?.id ?? null}
                onSelect={(city) => { if (!testing) runPingTest(city); }}
                you={location ? { lat: location.lat, lng: location.lon } : null}
                showRoute
                aspect={2.2}
              />
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:w-[40%]">
            <div className="bg-[#050507] rounded-2xl border border-[rgba(255,255,255,0.08)] p-8 lg:p-10 min-h-[320px] flex flex-col justify-center shadow-[0_0_40px_rgba(0,0,0,0.35)]">
              {state === 'idle' && (
                <div className="py-4">
                  <div className="text-center mb-8">
                    <div className="text-4xl mb-3">🌐</div>
                    <p className="text-[#9CA3AF] text-sm leading-relaxed max-w-[280px] mx-auto">
                      {closestServer
                        ? `Closest: ${closestServer.city} (${distance}mi) - tap a city to test`
                        : 'Tap a city to run a timing sample'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {MAP_CITIES.map((city) => (
                      <button
                        key={city.id}
                        onClick={() => runPingTest(city)}
                        className={`px-3.5 py-1.5 border rounded-full text-sm transition-all active:scale-95 ${
                          isClosest(city)
                            ? 'bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.3)] text-[#4ADE80] hover:bg-[rgba(74,222,128,0.2)]'
                            : 'bg-[#111118] border-[rgba(255,255,255,0.08)] text-[#D1D5DB] hover:border-[#E85D4E] hover:text-white'
                        }`}
                      >
                        <span className="mr-1">{city.flag}</span>
                        {city.city}
                        {isClosest(city) && <span className="ml-1 text-[10px]">★</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {state !== 'idle' && selected && (
                <div className="relative" aria-live="polite" aria-busy={testing}>
                  <canvas ref={sparkleCanvasRef} className="absolute -top-10 left-1/2 -translate-x-1/2 pointer-events-none" style={{ width: 200, height: 200 }} />
                  <div className="text-center">
                    {isClosest(selected) && (
                      <div className="mb-3 inline-flex items-center gap-1 text-xs text-[#4ADE80] bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.2)] px-3 py-1 rounded-full">
                        <Zap size={12} /> Closest city to you
                      </div>
                    )}
                    {testing ? (
                      <div className="py-2">
                        <div className="font-['JetBrains_Mono'] text-[#E85D4E] text-lg">{warming ? 'Warming up connection…' : 'Measuring…'}</div>
                        <div className="mt-4 w-full h-1.5 bg-[#111118] rounded-full overflow-hidden">
                          <div className="h-full bg-[#E85D4E] rounded-full transition-all duration-300" style={{ width: `${((samplesDone + 0.3) / (SAMPLE_COUNT + 0.3)) * 100}%` }} />
                        </div>
                        <div className="mt-2 text-xs text-[#6B7280] font-['JetBrains_Mono']">{warming ? 'Warm-up (not counted)' : `Sample ${Math.min(samplesDone + 1, SAMPLE_COUNT)} of ${SAMPLE_COUNT}`}</div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-center">
                          {pingResult !== null ? (
                            <>
                              <span className="font-['JetBrains_Mono'] text-6xl md:text-7xl" style={{ color: getPingColor(pingResult) }}>
                                <CountUp end={pingResult} duration={0.5} />
                              </span>
                              <span className="font-['JetBrains_Mono'] text-lg text-[#9CA3AF] ml-2">ms</span>
                            </>
                          ) : (
                            <span className="font-['JetBrains_Mono'] text-5xl text-[#9CA3AF]">--</span>
                          )}
                        </div>
                        <div className="mt-2 text-sm font-medium uppercase tracking-wider" style={{ color: getPingColor(pingResult) }}>
                          {getPingLabel(pingResult)}
                        </div>
                        {pingResult !== null && result.jitter !== null && (
                          <div className="mt-1 text-xs text-[#9CA3AF] font-['JetBrains_Mono']">{result.jitter} ms jitter</div>
                        )}
                      </>
                    )}
                    <div className="mt-8 space-y-3.5 text-left bg-[#111118] rounded-xl p-5 border border-[rgba(255,255,255,0.04)]">
                      <div className="flex justify-between items-center gap-3">
                        <span className="text-[#6B7280] text-sm">City</span>
                        <span className="text-white text-sm">{selected.flag} {selected.city}</span>
                      </div>
                      <div className="flex justify-between items-start gap-3">
                        <span className="text-[#6B7280] text-sm shrink-0">Datacenter</span>
                        <span className="text-right">
                          <span className="block text-[#A3B8D4] text-sm font-['JetBrains_Mono']">
                            {target ? pingTargetLabel(target) : '—'}
                          </span>
                          {target && !target.inCity && (
                            <span className="block text-[11px] text-[#6B7280]">Nearest region — none in {selected.city}</span>
                          )}
                        </span>
                      </div>
                      {state === 'result' && (
                        <>
                          <div className="flex justify-between items-center gap-3">
                            <span className="text-[#6B7280] text-sm">Jitter</span>
                            <span className="text-white text-sm font-['JetBrains_Mono']">{result.jitter !== null ? `${result.jitter} ms` : '—'}</span>
                          </div>
                          <div className="flex justify-between items-center gap-3">
                            <span className="text-[#6B7280] text-sm">Samples</span>
                            <span className="text-[#9CA3AF] text-sm font-['JetBrains_Mono']">{result.ok}/{SAMPLE_COUNT} ok · min shown</span>
                          </div>
                          <div className="flex justify-between items-center gap-3">
                            <span className="text-[#6B7280] text-sm">Method</span>
                            <span className="text-[#9CA3AF] text-sm font-['JetBrains_Mono']">
                              {result.method === 'resource-timing' ? 'Resource Timing' : 'Warm fetch'}
                            </span>
                          </div>
                        </>
                      )}
                      {target && (
                        <div className="flex justify-between items-center gap-3">
                          <span className="text-[#6B7280] text-sm">Endpoint</span>
                          <span className="text-[#9CA3AF] text-xs font-['JetBrains_Mono'] truncate max-w-[200px]" title={target.url}>{hostOf(target.url)}</span>
                        </div>
                      )}
                      {distance !== null && isClosest(selected) && (
                        <div className="flex justify-between items-center gap-3">
                          <span className="text-[#6B7280] text-sm">Distance</span>
                          <span className="text-[#4ADE80] text-sm font-['JetBrains_Mono']">{distance}mi from you</span>
                        </div>
                      )}
                    </div>
                    <p className="mt-4 text-[11px] text-[#6B7280] leading-relaxed px-1">
                      Lowest of {SAMPLE_COUNT} HTTP round trips on a warm connection (1 warm-up discarded) to
                      {target ? ` ${pingTargetLabel(target)}` : ' a cloud datacenter'}. An estimate of round-trip latency to a cloud
                      datacenter near that city (typically within a few ms of in-game ping to servers hosted there), not ICMP.
                    </p>
                    <div className="mt-5 flex flex-col items-center gap-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={testing}
                        onClick={() => runPingTest(selected)}
                      >
                        <RefreshCw size={14} className={`mr-1.5 inline ${testing ? 'motion-safe:animate-spin' : ''}`} />
                        {testing ? 'Testing…' : 'Test Again'}
                      </Button>
                      <button
                        type="button"
                        disabled={testing}
                        onClick={() => setState('idle')}
                        className="text-xs text-[#9CA3AF] hover:text-white bg-transparent border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Pick another city
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PingTestSection;
