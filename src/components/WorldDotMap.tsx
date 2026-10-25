import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getLandCells, LAND_COLS, LAND_ROWS, MAP_ASPECT, project } from '@/lib/world-map';
import type { MapCity } from '@/lib/world-map';
import { layoutLabels } from '@/lib/label-layout';
import type { LabelPoint } from '@/lib/label-layout';
import { pausableRafLoop } from '@/lib/animation-pause';

interface WorldDotMapProps {
  cities: MapCity[];
  closestId?: number | null;
  selectedId?: number | null;
  onSelect?: (city: MapCity) => void;
  /** User position, only drawn when known. */
  you?: { lat: number; lng: number } | null;
  /** Draw a line from `you` to the selected city. */
  showRoute?: boolean;
  /** Gentle travelling arcs between cities (off for reduced motion). */
  arcs?: boolean;
  /** Width / height. Defaults to the true equirectangular ratio. */
  aspect?: number;
  className?: string;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

const LAND_COLOR = 'rgba(155, 109, 255, 0.38)';
const CITY_COLOR = '#E85D4E';
const CLOSEST_COLOR = '#4ADE80';

const WorldDotMap: React.FC<WorldDotMapProps> = ({
  cities, closestId = null, selectedId = null, onSelect, you = null,
  showRoute = false, arcs = false, aspect = MAP_ASPECT, className = '',
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const landRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [activeId, setActiveId] = useState<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  // Track container size
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Land dots: drawn once per size change
  useEffect(() => {
    const canvas = landRef.current;
    if (!canvas || !size.w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const sx = size.w / LAND_COLS;
    const sy = size.h / LAND_ROWS;
    const r = Math.max(0.55, Math.min(sx, sy) * 0.34);
    ctx.fillStyle = LAND_COLOR;
    ctx.beginPath();
    for (const [c, row] of getLandCells()) {
      const x = (c + 0.5) * sx;
      const y = (row + 0.5) * sy;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }, [size.w, size.h]);

  const compact = size.w > 0 && size.w < 520;
  const fontSize = compact ? 10.5 : 12;
  const dotRadius = compact ? 3 : 4.5;

  const points = useMemo(() => cities.map((c) => {
    const p = project(c.lat, c.lng);
    return { city: c, x: p.x * size.w, y: p.y * size.h };
  }), [cities, size.w, size.h]);

  const youPt = useMemo(() => {
    if (!you) return null;
    const p = project(you.lat, you.lng);
    return { x: p.x * size.w, y: p.y * size.h };
  }, [you, size.w, size.h]);

  const labelText = (c: MapCity) =>
    c.id === closestId ? `★ ${c.city} · closest` : c.city;

  const labels = useMemo(() => {
    if (!size.w) return new Map();
    const pts: LabelPoint[] = points.map(({ city, x, y }) => ({
      id: String(city.id), x, y, text: labelText(city),
      forced: city.id === selectedId || city.id === closestId,
    }));
    if (youPt) pts.push({ id: 'you', x: youPt.x, y: youPt.y, text: 'You', forced: true });
    return layoutLabels(pts, { width: size.w, height: size.h, fontSize, allowLeaders: !compact, dotRadius });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, youPt, size.w, size.h, fontSize, compact, dotRadius, selectedId, closestId]);

  // Travelling arcs (decorative). Skipped entirely for reduced motion.
  useEffect(() => {
    const canvas = fxRef.current;
    if (!canvas || !size.w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    if (!arcs || reducedMotion || points.length < 2) return;

    type Arc = { ax: number; ay: number; bx: number; by: number; t: number; speed: number };
    const live: Arc[] = [];
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(canvas);

    const tick = () => {
      if (!visible) return;
      if (live.length < 6 && Math.random() < 0.025) {
        const a = points[Math.floor(Math.random() * points.length)];
        const b = points[Math.floor(Math.random() * points.length)];
        if (a !== b) live.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, t: 0, speed: 0.006 + Math.random() * 0.004 });
      }
      ctx.clearRect(0, 0, size.w, size.h);
      for (let i = live.length - 1; i >= 0; i--) {
        const arc = live[i];
        arc.t += arc.speed;
        if (arc.t >= 1.4) { live.splice(i, 1); continue; }
        const mx = (arc.ax + arc.bx) / 2;
        const my = (arc.ay + arc.by) / 2 - Math.hypot(arc.bx - arc.ax, arc.by - arc.ay) * 0.25;
        const head = Math.min(1, arc.t);
        const tail = Math.max(0, arc.t - 0.4);
        ctx.beginPath();
        for (let s = tail; s <= head + 1e-6; s += 0.02) {
          const u = 1 - s;
          const x = u * u * arc.ax + 2 * u * s * mx + s * s * arc.bx;
          const y = u * u * arc.ay + 2 * u * s * my + s * s * arc.by;
          if (s === tail) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(232, 93, 78, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };
    // Stops while a latency test runs (see animation-pause), resumes after.
    const stopLoop = pausableRafLoop(tick);
    return () => { stopLoop(); io.disconnect(); };
  }, [arcs, reducedMotion, points, size.w, size.h]);

  const selected = points.find((p) => p.city.id === selectedId) ?? null;

  return (
    <div
      ref={wrapRef}
      className={`relative w-full select-none ${className}`}
      style={{ aspectRatio: `${aspect}` }}
      onMouseLeave={() => setActiveId(null)}
    >
      <canvas ref={landRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
      <canvas ref={fxRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />

      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" aria-hidden="true">
        {showRoute && youPt && selected && (
          <line
            x1={youPt.x} y1={youPt.y} x2={selected.x} y2={selected.y}
            stroke="rgba(232, 93, 78, 0.6)" strokeWidth={1.5} strokeDasharray="4 4"
          />
        )}
        {[...labels.values()].map((l) => l.leader && (
          <line
            key={`leader-${l.id}`}
            x1={l.leader.x1} y1={l.leader.y1} x2={l.leader.x2} y2={l.leader.y2}
            stroke="rgba(209, 213, 219, 0.35)" strokeWidth={1}
          />
        ))}
      </svg>

      {youPt && (
        <div
          className="absolute pointer-events-none"
          style={{ left: youPt.x, top: youPt.y, transform: 'translate(-50%, -50%)' }}
          aria-hidden="true"
        >
          <div className="relative w-2.5 h-2.5">
            <div className="absolute inset-0 rounded-full bg-white" />
            <div className="absolute inset-0 rounded-full bg-white opacity-40 motion-safe:animate-ping" />
          </div>
        </div>
      )}

      {points.map(({ city, x, y }) => {
        const isSel = city.id === selectedId;
        const isClosest = city.id === closestId;
        const color = isClosest && !isSel ? CLOSEST_COLOR : CITY_COLOR;
        const d = (isSel ? 1.5 : 1) * dotRadius * 2;
        const Tag = onSelect ? 'button' : 'div';
        return (
          <Tag
            key={city.id}
            type={onSelect ? 'button' : undefined}
            className="absolute flex items-center justify-center rounded-full bg-transparent border-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            style={{
              left: x, top: y, width: compact ? 18 : 22, height: compact ? 18 : 22,
              transform: 'translate(-50%, -50%)', cursor: onSelect ? 'pointer' : 'default',
              zIndex: isSel ? 3 : 2,
            }}
            onClick={() => {
              setActiveId(String(city.id));
              onSelect?.(city);
            }}
            onMouseEnter={() => setActiveId(String(city.id))}
            onFocus={() => setActiveId(String(city.id))}
            aria-label={onSelect ? `Measure latency near ${city.city}` : city.city}
            title={city.city}
            tabIndex={onSelect ? undefined : 0}
          >
            <span
              className="relative block rounded-full"
              style={{
                width: d, height: d, background: color,
                boxShadow: `0 0 ${isSel ? 12 : 6}px ${color}`,
                border: isSel ? '1.5px solid #fff' : undefined,
              }}
            >
              {(isSel || isClosest) && (
                <span className="absolute inset-0 rounded-full motion-safe:animate-ping" style={{ background: color, opacity: 0.45 }} />
              )}
            </span>
          </Tag>
        );
      })}

      {[...labels.values()].map((l) => {
        const isYou = l.id === 'you';
        const city = isYou ? null : cities.find((c) => String(c.id) === l.id);
        const isClosest = city?.id === closestId;
        const isSel = city?.id === selectedId;
        return (
          <div
            key={`label-${l.id}`}
            className="absolute font-['JetBrains_Mono'] whitespace-nowrap pointer-events-none rounded flex items-center justify-center"
            style={{
              left: l.left, top: l.top, width: l.width, height: l.height, fontSize,
              lineHeight: 1, zIndex: 4,
              color: isClosest ? CLOSEST_COLOR : isSel || isYou ? '#FFFFFF' : '#D1D5DB',
              background: 'rgba(5, 5, 7, 0.78)',
              border: `1px solid ${isClosest ? 'rgba(74,222,128,0.35)' : isSel ? 'rgba(232,93,78,0.5)' : 'rgba(255,255,255,0.08)'}`,
              fontWeight: isSel || isClosest ? 600 : 400,
            }}
          >
            {isYou ? 'You' : city ? labelText(city) : ''}
          </div>
        );
      })}
      {/* Hover / tap tooltip for cities whose label was hidden to avoid overlap */}
      {activeId && !labels.has(activeId) && (() => {
        const pt = points.find((p) => String(p.city.id) === activeId);
        if (!pt) return null;
        const above = pt.y > 30;
        return (
          <div
            role="tooltip"
            className="absolute font-['JetBrains_Mono'] whitespace-nowrap pointer-events-none rounded px-1.5 py-1"
            style={{
              left: Math.min(Math.max(pt.x, 40), size.w - 40), top: above ? pt.y - 12 : pt.y + 12,
              transform: `translate(-50%, ${above ? '-100%' : '0'})`, fontSize, lineHeight: 1, zIndex: 5,
              color: '#FFFFFF', background: 'rgba(5, 5, 7, 0.92)', border: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            {pt.city.flag} {pt.city.city}
          </div>
        );
      })()}
    </div>
  );
};

export default WorldDotMap;
