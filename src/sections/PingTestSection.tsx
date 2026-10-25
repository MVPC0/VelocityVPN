import React, { useState, useRef, useEffect, useCallback } from 'react';
import SectionHeader from '@/components/SectionHeader';
import Button from '@/components/Button';
import CountUp from 'react-countup';
import WorldDotMap from '@/components/WorldDotMap';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useClosestServer } from '@/hooks/useGeoLocation';
import { useCityLatency } from '@/hooks/useCityLatency';
import { MAP_CITIES } from '@/lib/world-map';
import type { MapCity } from '@/lib/world-map';
import { primaryLatencyTarget, latencyTargetLabel, latencyHeadlineLabel, REFERENCE_DC_NOTE } from '@/data/ping-targets';
import MadSpread from '@/components/MadSpread';
import EstimateTag from '@/components/EstimateTag';
import {
  DROPPED_REQUESTS,
  LATENCY_NOTE,
  MIN_OK_SAMPLES,
  TIMED_REQUESTS,
  TOTAL_REQUESTS,
  latencyColor,
  latencyLabel,
} from '@/lib/latency';
import { MapPin, Zap, RefreshCw, AlertTriangle } from 'lucide-react';

type TestState = 'idle' | 'testing' | 'result';

const hostOf = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

const PingTestSection: React.FC = () => {
  const { location, closestServer, distance, loading: geoLoading, detect } = useClosestServer(MAP_CITIES);
  const [state, setState] = useState<TestState>('idle');
  const [selected, setSelected] = useState<MapCity | null>(null);
  const { progress, result, run } = useCityLatency();
  const sparkleCanvasRef = useRef<HTMLCanvasElement>(null);
  const hasAutoRun = useRef(false);

  const closestId = closestServer?.id ?? null;
  const isClosest = (city: MapCity) => closestId === city.id;

  const runTest = useCallback(async (city: MapCity) => {
    setSelected(city);
    setState('testing');
    const r = await run(city.id);
    if (r) setState('result');
  }, [run]);

  // Auto-test the closest city once, after location detection
  useEffect(() => {
    if (!closestServer || hasAutoRun.current || state !== 'idle') return;
    const city = MAP_CITIES.find((c) => c.id === closestServer.id);
    if (!city) return;
    hasAutoRun.current = true;
    const t = window.setTimeout(() => runTest(city), 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closestServer]);

  const headline = state === 'result' && result?.stats ? result.stats.median : null;

  // Small burst when a result lands (skipped for reduced motion)
  useEffect(() => {
    if (headline === null) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = sparkleCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = 200;
    canvas.height = 200;
    const color = latencyColor(headline);
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
  }, [headline]);

  const testing = state === 'testing';
  const primary = selected ? primaryLatencyTarget(selected.id) : undefined;
  // Show the target the numbers came from (a fallback, if one was used).
  const target = state === 'result' && result?.status !== 'unavailable' && result?.target ? result.target : testing && progress ? progress.target : primary;
  const stats = state === 'result' ? result?.stats ?? null : null;
  const status = state === 'result' ? result?.status ?? null : null;
  const viaFallback = state === 'result' && !!result?.viaFallback;
  const reqDone = progress?.done ?? 0;
  const onFallback = (progress?.targetIndex ?? 0) > 0;

  return (
    <section
      id="ping-test"
      // Positioned above the fixed hero globe canvas (z-index 1) so it can't bleed through.
      className="relative z-[2] w-full py-20 md:py-28 bg-[#0A0A0F] border-t border-[rgba(255,255,255,0.08)]"
    >
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
        <SectionHeader
          eyebrow="LATENCY TEST"
          title="Test Your Connection"
          subtitle="HTTP round-trip time from your browser to a cloud datacenter in or near that city — the kind of region game servers are hosted in."
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
              Tap a city below to measure latency, or
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
              <ErrorBoundary
                name="Latency map"
                fallback={
                  // Plain city list if the map canvas can't render; the test itself doesn't need it.
                  <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2">
                    {MAP_CITIES.map((city) => (
                      <li key={city.id}>
                        <button
                          type="button"
                          disabled={testing}
                          onClick={() => runTest(city)}
                          className={`w-full text-left text-sm px-3 py-2 rounded-lg border border-[rgba(255,255,255,0.08)] ${city.id === selected?.id ? 'text-white bg-[rgba(255,255,255,0.06)]' : 'text-[#9CA3AF]'}`}
                        >
                          {city.flag} {city.city}{city.id === closestId ? ' · closest' : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                }
              >
                <WorldDotMap
                  cities={MAP_CITIES}
                  closestId={closestId}
                  selectedId={selected?.id ?? null}
                  onSelect={(city) => { if (!testing) runTest(city); }}
                  you={location ? { lat: location.lat, lng: location.lon } : null}
                  showRoute
                  aspect={2.2}
                />
              </ErrorBoundary>
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
                        : 'Tap a city to measure latency'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {MAP_CITIES.map((city) => (
                      <button
                        key={city.id}
                        onClick={() => runTest(city)}
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
                        <div className="font-['JetBrains_Mono'] text-[#E85D4E] text-lg">
                          {onFallback ? 'Trying fallback…' : reqDone < DROPPED_REQUESTS ? 'Opening connection…' : 'Measuring…'}
                        </div>
                        <div className="mt-4 w-full h-1.5 bg-[#111118] rounded-full overflow-hidden">
                          <div className="h-full bg-[#E85D4E] rounded-full transition-all duration-300" style={{ width: `${((reqDone + 0.3) / (TOTAL_REQUESTS + 0.3)) * 100}%` }} />
                        </div>
                        <div className="mt-2 text-xs text-[#6B7280] font-['JetBrains_Mono']">
                          {reqDone < DROPPED_REQUESTS ? 'Warm-up request (not counted)' : `Sample ${Math.min(reqDone - DROPPED_REQUESTS + 1, TIMED_REQUESTS)} of ${TIMED_REQUESTS}`}
                        </div>
                      </div>
                    ) : null}
                    {!testing && target && status !== 'unavailable' && (
                      <div className="mb-2">
                        <div className="text-sm text-[#D1D5DB] inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                          <span>{latencyHeadlineLabel(target, viaFallback)}</span>
                          <EstimateTag />
                        </div>
                        <p className="mt-1 text-[11px] text-[#6B7280]">{REFERENCE_DC_NOTE}</p>
                      </div>
                    )}
                    {testing ? null : status === 'unavailable' ? (
                      <div className="py-2">
                        <div className="inline-flex items-center gap-2 font-['JetBrains_Mono'] text-3xl text-[#9CA3AF]">
                          <AlertTriangle size={26} className="text-[#FBBF24]" /> Unavailable
                        </div>
                        <p className="mt-3 text-xs text-[#9CA3AF] leading-relaxed">{result?.note}</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-center">
                          {headline !== null ? (
                            <>
                              <span className="font-['JetBrains_Mono'] text-6xl md:text-7xl" style={{ color: latencyColor(headline) }}>
                                <CountUp end={headline} duration={0.5} />
                              </span>
                              <span className="font-['JetBrains_Mono'] text-lg text-[#9CA3AF] ml-2">ms</span>
                            </>
                          ) : (
                            <span className="font-['JetBrains_Mono'] text-5xl text-[#9CA3AF]">--</span>
                          )}
                        </div>
                        <div className="mt-2 text-sm font-medium uppercase tracking-wider" style={{ color: status === 'unreliable' ? '#FBBF24' : latencyColor(headline) }}>
                          {status === 'unreliable' ? 'Unreliable' : latencyLabel(headline)}
                        </div>
                        {stats && (
                          <div className="mt-1 text-xs text-[#9CA3AF] font-['JetBrains_Mono']">
                            <MadSpread mad={stats.mad} align="center" plusMinus />
                          </div>
                        )}
                        {status === 'unreliable' && result?.note && (
                          <p className="mt-2 text-xs text-[#FBBF24]">{result.note}</p>
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
                            {target ? latencyTargetLabel(target) : '—'}
                          </span>
                          {viaFallback && primary && (
                            <span className="block text-[11px] text-[#FBBF24]">via fallback — {latencyTargetLabel(primary)} didn&apos;t respond reliably</span>
                          )}
                          {target && !target.inCity && (
                            <span className="block text-[11px] text-[#6B7280]">Nearest {target.provider} region to {selected.city}</span>
                          )}
                        </span>
                      </div>
                      {stats && (
                        <>
                          <div className="flex justify-between items-center gap-3">
                            <span className="text-[#6B7280] text-sm">Spread (MAD)</span>
                            <span className="text-white text-sm font-['JetBrains_Mono']"><MadSpread mad={stats.mad} /></span>
                          </div>
                          <div className="flex justify-between items-center gap-3">
                            <span className="text-[#6B7280] text-sm">Fastest</span>
                            <span className="text-[#9CA3AF] text-sm font-['JetBrains_Mono']">{stats.min} ms</span>
                          </div>
                          <div className="flex justify-between items-center gap-3">
                            <span className="text-[#6B7280] text-sm">Samples</span>
                            <span className="text-[#9CA3AF] text-sm font-['JetBrains_Mono']">{stats.ok}/{stats.attempted} ok · 1st dropped</span>
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
                      Median of {TIMED_REQUESTS} HTTPS requests on one warm connection (needs {MIN_OK_SAMPLES}+ to respond). {LATENCY_NOTE}
                    </p>
                    <div className="mt-5 flex flex-col items-center gap-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={testing}
                        onClick={() => runTest(selected)}
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
