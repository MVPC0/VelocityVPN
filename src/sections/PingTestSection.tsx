import React, { useState, useRef, useEffect, useCallback } from 'react';
import SectionHeader from '@/components/SectionHeader';
import Button from '@/components/Button';
import CountUp from 'react-countup';

type PingState = 'idle' | 'connecting' | 'testing' | 'result';

interface Server {
  name: string;
  flag: string;
  x: number;
  y: number;
  pingMin: number;
  pingMax: number;
  jitter: string;
}

const servers: Server[] = [
  { name: 'New York', flag: '🇺🇸', x: 22, y: 38, pingMin: 15, pingMax: 25, jitter: '1-3ms' },
  { name: 'London', flag: '🇬🇧', x: 47, y: 30, pingMin: 20, pingMax: 30, jitter: '2-4ms' },
  { name: 'Frankfurt', flag: '🇩🇪', x: 50, y: 32, pingMin: 18, pingMax: 28, jitter: '1-3ms' },
  { name: 'Tokyo', flag: '🇯🇵', x: 84, y: 38, pingMin: 35, pingMax: 50, jitter: '3-5ms' },
  { name: 'Singapore', flag: '🇸🇬', x: 76, y: 58, pingMin: 40, pingMax: 55, jitter: '3-6ms' },
  { name: 'Sydney', flag: '🇦🇺', x: 87, y: 74, pingMin: 50, pingMax: 70, jitter: '4-7ms' },
  { name: 'Sao Paulo', flag: '🇧🇷', x: 30, y: 74, pingMin: 60, pingMax: 80, jitter: '5-8ms' },
  { name: 'Dubai', flag: '🇦🇪', x: 60, y: 47, pingMin: 45, pingMax: 65, jitter: '4-6ms' },
];

function getPingColor(ping: number): string {
  if (ping < 50) return '#4ADE80';
  if (ping < 100) return '#FBBF24';
  return '#EF4444';
}

function getPingLabel(ping: number): string {
  if (ping < 50) return 'Excellent';
  if (ping < 100) return 'Good';
  return 'Fair';
}

const PingTestSection: React.FC = () => {
  const [state, setState] = useState<PingState>('idle');
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [pingResult, setPingResult] = useState<number>(0);
  const [progress, setProgress] = useState(0);
  const [flashingPing, setFlashingPing] = useState<number | null>(null);
  const [lineProgress, setLineProgress] = useState(0);
  const sparkleCanvasRef = useRef<HTMLCanvasElement>(null);
  const timeoutsRef = useRef<number[]>([]);

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const runPingTest = useCallback((server: Server) => {
    clearTimeouts();
    setSelectedServer(server);
    setState('connecting');
    setProgress(0);
    setLineProgress(0);
    setPingResult(0);

    // Animate line drawing
    const lineDuration = 800;
    const lineStart = Date.now();
    const animateLine = () => {
      const elapsed = Date.now() - lineStart;
      const p = Math.min(1, elapsed / lineDuration);
      setLineProgress(p);
      if (p < 1) requestAnimationFrame(animateLine);
    };
    requestAnimationFrame(animateLine);

    // Phase 1: Connecting (0.5s)
    const t1 = window.setTimeout(() => {
      setState('testing');

      // Flash random pings
      const flashInterval = window.setInterval(() => {
        setFlashingPing(Math.floor(Math.random() * 180) + 20);
      }, 80);

      // Progress bar
      const progressStart = Date.now();
      const animateProgress = () => {
        const elapsed = Date.now() - progressStart;
        const p = Math.min(1, elapsed / 2000);
        setProgress(p);
        if (p < 1) {
          requestAnimationFrame(animateProgress);
        } else {
          clearInterval(flashInterval);
        }
      };
      requestAnimationFrame(animateProgress);

      // Phase 2: Result (after 2s of testing)
      const t2 = window.setTimeout(() => {
        const result = Math.floor(Math.random() * (server.pingMax - server.pingMin + 1)) + server.pingMin;
        setFlashingPing(null);
        setPingResult(result);
        setState('result');

        // Sparkle effect
        drawSparkles();
      }, 2000);

      timeoutsRef.current.push(t2);
    }, 500);

    timeoutsRef.current.push(t1);
  }, [clearTimeouts]);

  const drawSparkles = useCallback(() => {
    const canvas = sparkleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 200;
    canvas.height = 200;

    const particles: Array<{
      x: number; y: number; vx: number; vy: number; alpha: number; size: number;
    }> = [];

    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      const speed = 1 + Math.random() * 2;
      particles.push({
        x: 100, y: 100,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        size: 2 + Math.random() * 2,
      });
    }

    const color = getPingColor(pingResult);

    const animate = () => {
      ctx.clearRect(0, 0, 200, 200);
      let alive = false;

      for (const p of particles) {
        if (p.alpha <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        p.size *= 0.98;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      if (alive) requestAnimationFrame(animate);
    };

    animate();
  }, [pingResult]);

  useEffect(() => {
    return () => clearTimeouts();
  }, [clearTimeouts]);

  return (
    <section
      id="ping-test"
      className="w-full py-16 md:py-24 bg-[#0A0A0F] border-t border-[rgba(255,255,255,0.08)]"
    >
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
        <SectionHeader
          eyebrow="PING TEST"
          title="Test Your Connection"
          subtitle="Select a server to see what your ping could look like with VelocityVPN."
        />

        <div className="mt-12 flex flex-col lg:flex-row gap-8">
          {/* Map */}
          <div className="lg:w-[60%] relative">
            <div className="relative w-full aspect-[4/3] bg-[#050507] rounded-xl border border-[rgba(255,255,255,0.08)] overflow-hidden">
              {/* Grid lines */}
              <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* User location */}
              <div
                className="absolute"
                style={{ left: '12%', top: '42%', transform: 'translate(-50%, -50%)' }}
              >
                <div className="relative">
                  <div className="w-3 h-3 bg-[#E85D4E] rounded-full" />
                  <div className="absolute inset-0 w-3 h-3 bg-[#E85D4E] rounded-full animate-ping opacity-50" />
                  <div className="absolute -inset-2 w-7 h-7 border border-[#E85D4E] rounded-full opacity-30" />
                </div>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#6B7280] mt-1 block text-center">You</span>
              </div>

              {/* Connecting line SVG */}
              {selectedServer && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
                  <line
                    x1="12%"
                    y1="42%"
                    x2={`${selectedServer.x}%`}
                    y2={`${selectedServer.y}%`}
                    stroke="rgba(232, 93, 78, 0.4)"
                    strokeWidth={state === 'result' ? 2 : 1}
                    strokeDasharray="1000"
                    strokeDashoffset={1000 * (1 - lineProgress)}
                    className={state === 'result' ? 'animate-pulse' : ''}
                  />
                </svg>
              )}

              {/* Server pins */}
              {servers.map((server) => (
                <button
                  key={server.name}
                  className={`absolute transition-all duration-200 group ${
                    selectedServer?.name === server.name ? 'z-10' : ''
                  }`}
                  style={{
                    left: `${server.x}%`,
                    top: `${server.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onClick={() => runPingTest(server)}
                  aria-label={`Test ping to ${server.name}`}
                >
                  {/* Touch target - invisible larger area for mobile */}
                  <div className="w-10 h-10 md:w-6 md:h-6 flex items-center justify-center relative">
                    <div
                      className={`w-4 h-4 md:w-3 md:h-3 rounded-full border-2 transition-all ${
                        selectedServer?.name === server.name
                          ? 'bg-[#E85D4E] border-white shadow-[0_0_12px_rgba(232,93,78,0.6)] scale-125'
                          : 'bg-[#E85D4E] border-white/60'
                      }`}
                    >
                      {selectedServer?.name === server.name && (
                        <div className="absolute inset-0 rounded-full border-2 border-white animate-ping" />
                      )}
                    </div>
                  </div>
                  {/* Label - always visible on mobile, hover on desktop */}
                  <span className="absolute top-6 left-1/2 -translate-x-1/2 font-['JetBrains_Mono'] text-[9px] md:text-[10px] text-[#9CA3AF] whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-[rgba(5,5,7,0.8)] px-1.5 py-0.5 rounded">
                    {server.flag} {server.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:w-[40%]">
            <div className="bg-[#050507] rounded-2xl border border-[rgba(255,255,255,0.08)] p-8 lg:p-10">
              {state === 'idle' && (
                <div className="py-6">
                  <div className="text-center mb-6">
                    <div className="text-4xl mb-3">🌐</div>
                    <p className="text-[#9CA3AF]">Tap a server to test your ping</p>
                  </div>
                  {/* Quick-select server pills */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    {servers.map((server) => (
                      <button
                        key={server.name}
                        onClick={() => runPingTest(server)}
                        className="px-4 py-2 bg-[#111118] border border-[rgba(255,255,255,0.08)] rounded-full text-sm text-[#D1D5DB] hover:border-[#E85D4E] hover:text-white transition-all active:scale-95"
                      >
                        <span className="mr-1">{server.flag}</span>
                        {server.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {state === 'connecting' && (
                <div className="py-8">
                  <div className="font-['JetBrains_Mono'] text-[#9CA3AF] text-lg flex items-center gap-2">
                    Connecting
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-[#E85D4E] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-[#E85D4E] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-[#E85D4E] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                  <p className="text-[#6B7280] text-sm mt-2">
                    {selectedServer?.flag} {selectedServer?.name}
                  </p>
                </div>
              )}

              {state === 'testing' && (
                <div className="py-8">
                  <div className="font-['JetBrains_Mono'] text-[#E85D4E] text-lg mb-4">
                    Testing...
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1 bg-[#111118] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E85D4E] rounded-full transition-all"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  {/* Flashing ping */}
                  {flashingPing !== null && (
                    <div className="mt-6 text-center">
                      <span className="font-['JetBrains_Mono'] text-4xl text-[#9CA3AF]">
                        {flashingPing}
                      </span>
                      <span className="font-['JetBrains_Mono'] text-sm text-[#6B7280] ml-1">ms</span>
                    </div>
                  )}
                </div>
              )}

              {state === 'result' && selectedServer && (
                <div className="relative">
                  {/* Sparkle canvas */}
                  <canvas
                    ref={sparkleCanvasRef}
                    className="absolute -top-10 left-1/2 -translate-x-1/2 pointer-events-none"
                    style={{ width: 200, height: 200 }}
                  />

                  {/* Ping result */}
                  <div className="text-center">
                    <div className="flex items-baseline justify-center">
                      <span
                        className="font-['JetBrains_Mono'] text-6xl md:text-7xl"
                        style={{ color: getPingColor(pingResult) }}
                      >
                        <CountUp end={pingResult} duration={0.5} />
                      </span>
                      <span className="font-['JetBrains_Mono'] text-lg text-[#9CA3AF] ml-2">ms</span>
                    </div>

                    <div
                      className="mt-2 text-sm font-medium uppercase tracking-wider"
                      style={{ color: getPingColor(pingResult) }}
                    >
                      {getPingLabel(pingResult)}
                    </div>

                    {/* Server details */}
                    <div className="mt-6 space-y-3 text-left bg-[#111118] rounded-xl p-5">
                      <div className="flex justify-between">
                        <span className="text-[#6B7280] text-sm">Server</span>
                        <span className="text-white text-sm">{selectedServer.flag} {selectedServer.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6B7280] text-sm">Packet Loss</span>
                        <span className="text-[#4ADE80] text-sm font-['JetBrains_Mono']">0%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6B7280] text-sm">Jitter</span>
                        <span
                          className="text-sm font-['JetBrains_Mono']"
                          style={{ color: getPingColor(pingResult) }}
                        >
                          ±{selectedServer.jitter}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-6"
                      onClick={() => {
                        setState('idle');
                        setSelectedServer(null);
                        setPingResult(0);
                        setProgress(0);
                      }}
                    >
                      Test Again
                    </Button>
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
