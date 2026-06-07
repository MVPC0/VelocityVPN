import React, { useRef, useEffect, useCallback } from 'react';
import SectionHeader from '@/components/SectionHeader';
import CountUp from 'react-countup';
import { useInView } from '@/hooks/useInView';

// Simplified world map dot positions (normalized 0-1)
// This creates a recognizable world map silhouette
function generateWorldDots(): Array<{ x: number; y: number; isCity: boolean; cityName?: string }> {
  const dots: Array<{ x: number; y: number; isCity: boolean; cityName?: string }> = [];

  // Continent shapes using simple region definitions
  const regions = [
    // North America
    { x1: 0.12, y1: 0.15, x2: 0.35, y2: 0.55, density: 0.7 },
    // South America
    { x1: 0.22, y1: 0.55, x2: 0.35, y2: 0.88, density: 0.6 },
    // Europe
    { x1: 0.44, y1: 0.15, x2: 0.58, y2: 0.42, density: 0.8 },
    // Africa
    { x1: 0.44, y1: 0.35, x2: 0.58, y2: 0.78, density: 0.5 },
    // Asia
    { x1: 0.55, y1: 0.12, x2: 0.88, y2: 0.58, density: 0.7 },
    // Australia
    { x1: 0.75, y1: 0.65, x2: 0.90, y2: 0.85, density: 0.5 },
  ];

  const step = 0.018;
  for (const region of regions) {
    for (let x = region.x1; x < region.x2; x += step) {
      for (let y = region.y1; y < region.y2; y += step) {
        // Create rough continent edges with noise
        const edgeNoise = 0.03;
        const dx = (x - region.x1) / (region.x2 - region.x1);
        const dy = (y - region.y1) / (region.y2 - region.y1);
        const distFromCenter = Math.sqrt((dx - 0.5) ** 2 + (dy - 0.5) ** 2);
        const threshold = region.density * (1 - distFromCenter * 0.3);

        if (Math.random() < threshold) {
          dots.push({
            x: x + (Math.random() - 0.5) * edgeNoise,
            y: y + (Math.random() - 0.5) * edgeNoise,
            isCity: false,
          });
        }
      }
    }
  }

  // Server cities
  const cities = [
    { x: 0.25, y: 0.35, name: 'New York' },
    { x: 0.48, y: 0.30, name: 'London' },
    { x: 0.51, y: 0.32, name: 'Frankfurt' },
    { x: 0.85, y: 0.35, name: 'Tokyo' },
    { x: 0.75, y: 0.55, name: 'Singapore' },
    { x: 0.88, y: 0.72, name: 'Sydney' },
    { x: 0.30, y: 0.72, name: 'Sao Paulo' },
    { x: 0.60, y: 0.45, name: 'Dubai' },
  ];

  for (const city of cities) {
    dots.push({ x: city.x, y: city.y, isCity: true, cityName: city.name });
  }

  return dots;
}

interface Arc {
  from: { x: number; y: number };
  to: { x: number; y: number };
  progress: number;
  speed: number;
  alpha: number;
}

const cities = [
  { x: 0.25, y: 0.35, name: 'New York' },
  { x: 0.48, y: 0.30, name: 'London' },
  { x: 0.51, y: 0.32, name: 'Frankfurt' },
  { x: 0.85, y: 0.35, name: 'Tokyo' },
  { x: 0.75, y: 0.55, name: 'Singapore' },
  { x: 0.88, y: 0.72, name: 'Sydney' },
  { x: 0.30, y: 0.72, name: 'Sao Paulo' },
  { x: 0.60, y: 0.45, name: 'Dubai' },
];

const GlobalMapSection: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: sectionRef, isInView } = useInView(0.1);
  const dotsRef = useRef(generateWorldDots());
  const arcsRef = useRef<Arc[]>([]);
  const animFrameRef = useRef(0);
  const revealProgressRef = useRef(0);
  const streamsActiveRef = useRef(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw dots with reveal animation
    const dots = dotsRef.current;
    const revealProgress = revealProgressRef.current;

    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      const dotReveal = Math.min(1, Math.max(0, (revealProgress * dots.length - i) / 50));
      if (dotReveal <= 0) continue;

      const px = dot.x * w;
      const py = dot.y * h;

      if (dot.isCity) {
        // City dot with pulse
        const pulseScale = 1 + Math.sin(Date.now() * 0.003 + i) * 0.3;
        ctx.beginPath();
        ctx.arc(px, py, 4 * pulseScale * dotReveal, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${dotReveal})`;
        ctx.fill();

        // Pulse ring
        const ringAlpha = (1 - pulseScale + 1) * 0.3 * dotReveal;
        ctx.beginPath();
        ctx.arc(px, py, 8 * pulseScale, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${ringAlpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(px, py, 1.5 * dotReveal, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(155, 109, 255, ${0.5 * dotReveal})`;
        ctx.fill();
      }
    }

    // Draw arcs
    if (streamsActiveRef.current) {
      const arcs = arcsRef.current;
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        arc.progress += arc.speed;

        if (arc.progress >= 1) {
          arc.alpha -= 0.02;
          if (arc.alpha <= 0) {
            arcs.splice(i, 1);
            continue;
          }
        }

        const fx = arc.from.x * w;
        const fy = arc.from.y * h;
        const tx = arc.to.x * w;
        const ty = arc.to.y * h;

        // Control point for quadratic bezier (arch upward)
        const cx = (fx + tx) / 2;
        const cy = Math.min(fy, ty) - Math.abs(tx - fx) * 0.15;

        // Draw arc path
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.quadraticCurveTo(cx, cy, tx, ty);
        ctx.strokeStyle = `rgba(232, 93, 78, ${0.25 * arc.alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Traveling dot
        if (arc.progress < 1) {
          const t = arc.progress;
          const invT = 1 - t;
          const dotX = invT * invT * fx + 2 * invT * t * cx + t * t * tx;
          const dotY = invT * invT * fy + 2 * invT * t * cy + t * t * ty;

          ctx.beginPath();
          ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(232, 93, 78, ${arc.alpha})`;
          ctx.fill();

          // Glow
          ctx.beginPath();
          ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(232, 93, 78, ${0.15 * arc.alpha})`;
          ctx.fill();
        }
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const container = canvas.parentElement;
      if (!container) return;
      const dpr = Math.min(window.devicePixelRatio, 2);
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      // Update reveal progress
      if (isInView && revealProgressRef.current < 1) {
        revealProgressRef.current += 0.003;
        if (revealProgressRef.current >= 1) {
          revealProgressRef.current = 1;
          setTimeout(() => {
            streamsActiveRef.current = true;
          }, 500);
        }
      }

      // Spawn new arcs
      if (streamsActiveRef.current && Math.random() < 0.02 && arcsRef.current.length < 12) {
        const from = cities[Math.floor(Math.random() * cities.length)];
        let to = cities[Math.floor(Math.random() * cities.length)];
        while (to === from) {
          to = cities[Math.floor(Math.random() * cities.length)];
        }
        arcsRef.current.push({
          from: { x: from.x, y: from.y },
          to: { x: to.x, y: to.y },
          progress: 0,
          speed: 0.005 + Math.random() * 0.005,
          alpha: 0.6 + Math.random() * 0.4,
        });
      }

      draw();
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isInView, draw]);

  const stats = [
    { value: 90, suffix: '+', label: 'Server Cities', color: 'text-[#9B6DFF]' },
    { value: 6, suffix: '', label: 'Continents', color: 'text-[#A3B8D4]' },
    { value: 10, suffix: 'Gbps', label: 'Network Backbone', color: 'text-[#E85D4E]' },
    { value: 0, suffix: 'ms', label: 'Added Latency', color: 'text-[#4ADE80]' },
  ];

  return (
    <section
      id="global-map"
      ref={sectionRef}
      className="w-full py-24 md:py-36"
      style={{
        boxShadow: 'inset 0 0 200px rgba(155, 109, 255, 0.05)',
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
        <SectionHeader
          eyebrow="GLOBAL NETWORK"
          title="90+ Cities, One Goal"
          subtitle="Gaming-optimized servers on every continent. Smart routing finds the fastest path, every time."
        />

        {/* Map Canvas */}
        <div className="mt-16 relative w-full aspect-[16/9] max-w-[1200px] mx-auto">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />
          {/* City Labels */}
          {cities.map((city) => (
            <div
              key={city.name}
              className="absolute font-['JetBrains_Mono'] text-[10px] text-[#6B7280] whitespace-nowrap pointer-events-none"
              style={{
                left: `${city.x * 100}%`,
                top: `${city.y * 100 + 3}%`,
                transform: 'translateX(-50%)',
              }}
            >
              {city.name}
            </div>
          ))}
        </div>

        {/* Stats Bar */}
        <div
          ref={useInView(0.3).ref}
          className="mt-12 flex flex-wrap justify-center gap-8 md:gap-16"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className={`font-['JetBrains_Mono'] text-3xl md:text-4xl ${stat.color}`}>
                {isInView ? (
                  <CountUp end={stat.value} duration={2} suffix={stat.suffix} />
                ) : (
                  `0${stat.suffix}`
                )}
              </div>
              <div className="text-eyebrow mt-2 text-[10px] text-[#6B7280]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GlobalMapSection;
