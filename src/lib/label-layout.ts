// Greedy, collision-aware label placement for small point maps.
// Each label tries 8 positions next to its dot; if all collide and
// leaders are allowed it moves further out with a leader line.

export interface LabelPoint {
  id: string;
  x: number;
  y: number;
  text: string;
  /** Placed first and never hidden (selected / closest / you). */
  forced?: boolean;
}

export interface PlacedLabel {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Leader line end on the label box, when the label sits away from its dot. */
  leader: { x1: number; y1: number; x2: number; y2: number } | null;
}

interface Rect { l: number; t: number; r: number; b: number }

const DIRS: Array<[number, number, number]> = [
  // dx, dy, preference cost
  [1, 0, 0], [-1, 0, 1], [0, 1, 2], [0, -1, 2],
  [1, -1, 3], [-1, -1, 3], [1, 1, 3], [-1, 1, 3],
];

export function estimateLabelSize(text: string, fontSize: number) {
  // JetBrains Mono advance is ~0.6em; emoji/star glyphs a bit wider.
  const chars = Array.from(text).length;
  return { width: Math.ceil(chars * fontSize * 0.62 + 12), height: Math.ceil(fontSize + 7) };
}

const overlaps = (a: Rect, b: Rect, pad = 2) =>
  a.l < b.r + pad && a.r + pad > b.l && a.t < b.b + pad && a.b + pad > b.t;

function segmentHitsRect(x1: number, y1: number, x2: number, y2: number, r: Rect): boolean {
  // Liang-Barsky clip
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.l, r.r - x1, y1 - r.t, r.b - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return t1 - t0 > 0.02;
}

function rectAt(x: number, y: number, dx: number, dy: number, d: number, w: number, h: number): Rect {
  const diag = dx !== 0 && dy !== 0 ? 0.75 : 1;
  const ox = dx * d * diag, oy = dy * d * diag;
  const l = dx > 0 ? x + ox : dx < 0 ? x + ox - w : x - w / 2;
  const t = dy > 0 ? y + oy : dy < 0 ? y + oy - h : y - h / 2;
  return { l, t, r: l + w, b: t + h };
}

function rectDist(r: Rect, x: number, y: number) {
  const dx = Math.max(r.l - x, 0, x - r.r);
  const dy = Math.max(r.t - y, 0, y - r.b);
  return Math.hypot(dx, dy);
}

function nearestOnRect(x: number, y: number, r: Rect) {
  return { x: Math.min(r.r, Math.max(r.l, x)), y: Math.min(r.b, Math.max(r.t, y)) };
}

export function layoutLabels(
  points: LabelPoint[],
  opts: { width: number; height: number; fontSize: number; allowLeaders: boolean; dotRadius?: number },
): Map<string, PlacedLabel> {
  const { width, height, fontSize, allowLeaders } = opts;
  const dotR = (opts.dotRadius ?? 4) + 1;
  const dots: Rect[] = points.map((p) => ({ l: p.x - dotR, t: p.y - dotR, r: p.x + dotR, b: p.y + dotR }));
  const placed: Rect[] = [];
  const leaders: Array<[number, number, number, number]> = [];
  const result = new Map<string, PlacedLabel>();

  const neighbourInfo = points.map((p) => {
    let n = 0, cx = 0, cy = 0;
    for (const q of points) {
      if (q === p) continue;
      const dist = Math.hypot(q.x - p.x, q.y - p.y);
      if (dist < 90) { n++; cx += q.x; cy += q.y; }
    }
    return { n, cx: n ? cx / n - p.x : 0, cy: n ? cy / n - p.y : 0 };
  });

  const order = points
    .map((p, i) => ({ p, i }))
    .sort((a, b) =>
      Number(!!b.p.forced) - Number(!!a.p.forced) || neighbourInfo[b.i].n - neighbourInfo[a.i].n);

  const tiers = allowLeaders ? [6, 24, 42, 62, 84, 110] : [6];

  for (const { p, i } of order) {
    const { width: w, height: h } = estimateLabelSize(p.text, fontSize);
    const info = neighbourInfo[i];

    const search = (tierList: number[], relaxed: boolean) => {
      let found: { r: Rect; cost: number; tier: number } | null = null;
      for (let ti = 0; ti < tierList.length && !found; ti++) {
        const leadered = tierList[ti] > 6;
        for (const [dx, dy, pref] of DIRS) {
          const r = rectAt(p.x, p.y, dx, dy, tierList[ti], w, h);
          if (r.l < 2 || r.t < 2 || r.r > width - 2 || r.b > height - 2) continue;
          if (placed.some((o) => overlaps(r, o))) continue;
          if (leaders.some(([a, b, c, d2]) => segmentHitsRect(a, b, c, d2, r))) continue;
          if (!relaxed && dots.some((o, j) => j !== i && overlaps(r, o, 1))) continue;
          if (leadered) {
            const e = nearestOnRect(p.x, p.y, r);
            if (placed.some((o) => segmentHitsRect(p.x, p.y, e.x, e.y, o))) continue;
            if (leaders.some(([a, b, c, d2]) => segmentsCross(p.x, p.y, e.x, e.y, a, b, c, d2))) continue;
            if (!relaxed && dots.some((o, j) => j !== i && segmentHitsRect(p.x, p.y, e.x, e.y, o))) continue;
          } else if (!relaxed) {
            // Without a leader the label must read as belonging to its own dot:
            // no other dot may sit nearer to the label than this one.
            const own = rectDist(r, p.x, p.y);
            if (points.some((q, j) => j !== i && rectDist(r, q.x, q.y) < own + 3)) continue;
          }
          // Prefer pointing away from the local cluster
          const toward = info.n ? (dx * info.cx + dy * info.cy) / (Math.hypot(info.cx, info.cy) || 1) : 0;
          const cost = pref + Math.max(0, toward) * 4;
          if (!found || cost < found.cost) found = { r, cost, tier: ti };
        }
      }
      return found;
    };

    let best = search(tiers, false);
    // Forced labels (selected / closest / you) always show: relax the dot rules
    // and allow a short leader even on small screens.
    if (!best && p.forced) best = search([6, 20, 34, 50, 70], true);
    if (!best) {
      if (!p.forced) continue;
      const r = rectAt(p.x, p.y, p.x > width / 2 ? -1 : 1, 0, 6, w, h);
      const sx = Math.min(0, width - 2 - r.r) + Math.max(0, 2 - r.l);
      const sy = Math.min(0, height - 2 - r.b) + Math.max(0, 2 - r.t);
      best = { r: { l: r.l + sx, t: r.t + sy, r: r.r + sx, b: r.b + sy }, cost: 0, tier: 0 };
    }

    placed.push(best.r);
    let leader: PlacedLabel['leader'] = null;
    const e0 = nearestOnRect(p.x, p.y, best.r);
    if (Math.hypot(e0.x - p.x, e0.y - p.y) > 9) {
      const e = e0;
      leader = { x1: p.x, y1: p.y, x2: e.x, y2: e.y };
      leaders.push([p.x, p.y, e.x, e.y]);
    }
    result.set(p.id, { id: p.id, left: best.r.l, top: best.r.t, width: w, height: h, leader });
  }
  return result;
}

function segmentsCross(
  a1: number, a2: number, b1: number, b2: number,
  c1: number, c2: number, d1: number, d2: number,
): boolean {
  const o = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
  if ((a1 === c1 && a2 === c2) || (b1 === d1 && b2 === d2)) return false;
  return o(a1, a2, b1, b2, c1, c2) !== o(a1, a2, b1, b2, d1, d2) &&
    o(c1, c2, d1, d2, a1, a2) !== o(c1, c2, d1, d2, b1, b2);
}
