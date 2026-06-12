import type { FurnitureKind, Pt, Rect } from './types';

export const ISO_X = Math.cos(Math.PI / 6);
export const ISO_Y = 0.62; // steeper than 2:1 so walls occlude less interior
export const ISO_Z = 0.38; // flattened height keeps interiors visible

/** uniform miniature-style wall height: consistent everywhere, never hides room contents */
export const WALL_H = 1.1;
export const WALL_T = 0.15;
export const DOOR_H = 2.0;
export const SILL_H = 0.6;
export const WINDOW_TOP = 2.0;

export const KIND_HEIGHTS: Record<FurnitureKind, number> = {
  shelf: 1.8,
  dresser: 1.0,
  wardrobe: 2.0,
  cabinet: 0.9,
  chest: 0.5,
  fridge: 1.8,
  other: 0.8,
  desk: 0.74,
  table: 0.74,
  chair: 0.85,
  sofa: 0.78,
  bed: 0.9,
  tv: 1.1,
  monitor: 0.5,
  counter: 0.9,
  stove: 0.9,
  sink: 0.9,
  washbasin: 0.85,
  toilet: 0.75,
  shower: 2.0,
  bathtub: 0.55,
  plant: 1.1,
};

export interface Projection {
  mode: 'iso' | 'flat';
  project(x: number, y: number, z?: number): Pt;
  /** inverse of project for points on the floor plane (z = 0) */
  unprojectFloor(sx: number, sy: number): Pt;
  /** up-screen displacement of a point raised to height z */
  lift(z: number): number;
  /** floor direction of the camera ray (per unit of lift-walk t) */
  ray: Pt;
}

/** quarter-turn view rotations of the iso camera around the vertical axis */
export type ViewRotation = 0 | 1 | 2 | 3;

const ROT_COS = [1, 0, -1, 0] as const;
const ROT_SIN = [0, 1, 0, -1] as const;

export function makeIsoProjection(rot: ViewRotation = 0): Projection {
  const c = ROT_COS[rot];
  const sn = ROT_SIN[rot];
  return {
    mode: 'iso',
    project: (x, y, z = 0) => {
      const rx = c * x - sn * y;
      const ry = sn * x + c * y;
      return { x: (rx - ry) * ISO_X, y: (rx + ry) * ISO_Y - z * ISO_Z };
    },
    unprojectFloor: (sx, sy) => {
      const u = sx / ISO_X; // rx − ry
      const v = sy / ISO_Y; // rx + ry
      const rx = (u + v) / 2;
      const ry = (v - u) / 2;
      return { x: c * rx + sn * ry, y: -sn * rx + c * ry };
    },
    lift: (z) => z * ISO_Z,
    ray: { x: c + sn, y: c - sn },
  };
}

export const isoProjection: Projection = makeIsoProjection(0);

export const flatProjection: Projection = {
  mode: 'flat',
  project: (x, y) => ({ x, y }),
  unprojectFloor: (sx, sy) => ({ x: sx, y: sy }),
  lift: () => 0,
  ray: { x: 0, y: 0 },
};

/**
 * A screen point on a face of height h unprojects to a floor point displaced
 * by up to (−t, −t) behind the true footprint; this is that maximum t.
 */
export function tapLiftRange(p: Projection, h: number): number {
  return p.lift(h) / (2 * ISO_Y);
}

/** true if the tap at floor point w lands on a box (footprint r, height h) */
export function pointInLiftedRect(p: Projection, w: Pt, r: Rect, h: number): boolean {
  const tMax = tapLiftRange(p, h);
  // the screen point corresponds to floor points w + t·ray for t ∈ [0, tMax]
  const span = (lo: number, hi: number, w0: number, d: number): [number, number] => {
    if (d === 0) return w0 >= lo && w0 <= hi ? [0, Infinity] : [1, -1];
    return d > 0 ? [lo - w0, hi - w0] : [w0 - hi, w0 - lo];
  };
  const sx = span(r.x, r.x + r.w, w.x, p.ray.x);
  const sy = span(r.y, r.y + r.h, w.y, p.ray.y);
  const t0 = Math.max(sx[0], sy[0], 0);
  const t1 = Math.min(sx[1], sy[1], tMax);
  return t0 <= t1;
}

export interface EdgeSpan {
  from: number;
  to: number;
}

/** complement of the (clamped, possibly overlapping) gaps along an edge */
export function solidSpans(edgeLen: number, gaps: EdgeSpan[]): EdgeSpan[] {
  const sorted = gaps
    .map((g) => ({ from: Math.max(0, g.from), to: Math.min(edgeLen, g.to) }))
    .filter((g) => g.to > g.from)
    .sort((a, b) => a.from - b.from);
  const out: EdgeSpan[] = [];
  let pos = 0;
  for (const g of sorted) {
    if (g.from > pos) out.push({ from: pos, to: g.from });
    pos = Math.max(pos, g.to);
  }
  if (pos < edgeLen) out.push({ from: pos, to: edgeLen });
  return out;
}

/**
 * Furniture flush against a room boundary sits on the wall's center line and
 * interpenetrates the slab, so its visible base corner hovers above the wall
 * face's base line ("floating"). Inset flush sides of the RENDERED box by
 * half a wall thickness so it abuts the wall face exactly; the data footprint
 * is untouched.
 */
export function insetAgainstWalls(
  r: Rect,
  edges: { a: Pt; b: Pt }[],
  wallT = WALL_T,
): Rect {
  const eps = 1e-9;
  const out = { ...r };
  const flush = (horizontal: boolean, line: number, lo: number, hi: number): boolean =>
    edges.some((e) => {
      if ((e.a.y === e.b.y) !== horizontal) return false;
      if (Math.abs((horizontal ? e.a.y : e.a.x) - line) > eps) return false;
      const elo = horizontal ? Math.min(e.a.x, e.b.x) : Math.min(e.a.y, e.b.y);
      const ehi = horizontal ? Math.max(e.a.x, e.b.x) : Math.max(e.a.y, e.b.y);
      return ehi > lo + eps && elo < hi - eps;
    });
  // cap the inset so both dimensions keep at least a third of their size
  const dx = Math.min(wallT / 2, r.w / 3);
  const dy = Math.min(wallT / 2, r.h / 3);
  if (flush(true, r.y, r.x, r.x + r.w)) {
    out.y += dy;
    out.h -= dy;
  }
  if (flush(true, r.y + r.h, r.x, r.x + r.w)) out.h -= dy;
  if (flush(false, r.x, r.y, r.y + r.h)) {
    out.x += dx;
    out.w -= dx;
  }
  if (flush(false, r.x + r.w, r.y, r.y + r.h)) out.w -= dx;
  return out;
}

export interface WallSlab {
  horizontal: boolean;
  /** the wall's center line (y for horizontal, x for vertical walls) */
  line: number;
  from: number;
  to: number;
}

/**
 * Floor-wide wall construction. Per-room slabs interpenetrate wherever rooms
 * meet, painting end caps across continuing walls. Instead: merge every
 * room's collinear edges into single intervals per wall line, miter the
 * junction ends so slabs abut rather than cross (a wall teeing into a
 * continuing perpendicular wall shrinks back by half a thickness; at plain
 * corners the horizontal wall owns the corner square), then cut door/window
 * gaps so the jambs land exactly on the gap bounds.
 */
export function buildWallLines(
  edges: { a: Pt; b: Pt }[],
  gaps: { from: Pt; to: Pt }[],
  wallT = WALL_T,
): WallSlab[] {
  const eps = 1e-9;
  type Group = { horizontal: boolean; line: number; intervals: [number, number][] };
  const groups = new Map<string, Group>();
  for (const e of edges) {
    const horizontal = e.a.y === e.b.y;
    const line = horizontal ? e.a.y : e.a.x;
    const lo = horizontal ? Math.min(e.a.x, e.b.x) : Math.min(e.a.y, e.b.y);
    const hi = horizontal ? Math.max(e.a.x, e.b.x) : Math.max(e.a.y, e.b.y);
    if (hi - lo < eps) continue;
    const key = `${horizontal ? 'h' : 'v'}:${line}`;
    const g = groups.get(key) ?? { horizontal, line, intervals: [] };
    g.intervals.push([lo, hi]);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    const sorted = [...g.intervals].sort((a, b) => a[0] - b[0]);
    const out: [number, number][] = [];
    for (const [lo, hi] of sorted) {
      const last = out[out.length - 1];
      if (last && lo <= last[1] + eps) last[1] = Math.max(last[1], hi);
      else out.push([lo, hi]);
    }
    g.intervals = out;
  }
  const perpendiculars = (horizontal: boolean, line: number): [number, number][] =>
    groups.get(`${horizontal ? 'h' : 'v'}:${line}`)?.intervals ?? [];

  const slabs: WallSlab[] = [];
  for (const g of groups.values()) {
    for (const [lo, hi] of g.intervals) {
      const adjust = (p: number, isLo: boolean): number => {
        const inward = isLo ? wallT / 2 : -wallT / 2;
        let corner = false;
        for (const [plo, phi] of perpendiculars(!g.horizontal, p)) {
          if (plo < g.line - eps && phi > g.line + eps) return p + inward; // wall continues across: abut it
          if (Math.abs(plo - g.line) < eps || Math.abs(phi - g.line) < eps) corner = true;
        }
        if (corner) return g.horizontal ? p - inward : p + inward; // corners belong to the horizontal wall
        return p;
      };
      const lo2 = adjust(lo, true);
      const hi2 = adjust(hi, false);
      if (hi2 - lo2 < eps) continue;
      const lineGaps: EdgeSpan[] = [];
      for (const s of gaps) {
        const segHorizontal = s.from.y === s.to.y;
        if (segHorizontal !== g.horizontal) continue;
        const segLine = segHorizontal ? s.from.y : s.from.x;
        if (Math.abs(segLine - g.line) > eps) continue;
        const a = segHorizontal ? s.from.x : s.from.y;
        const b = segHorizontal ? s.to.x : s.to.y;
        lineGaps.push({ from: Math.min(a, b) - lo2, to: Math.max(a, b) - lo2 });
      }
      for (const sp of solidSpans(hi2 - lo2, lineGaps)) {
        if (sp.to - sp.from > eps)
          slabs.push({ horizontal: g.horizontal, line: g.line, from: lo2 + sp.from, to: lo2 + sp.to });
      }
    }
  }
  return slabs;
}

/**
 * The wall gap a door sits in is the union of every overlapping wall-item
 * segment on that wall line (a neighbour room's door on the shared wall widens
 * the opening). Frames anchored to the door's own segment would end mid-air
 * inside that union, so grow the span across all transitively touching
 * collinear gaps; the result lands exactly on the cut wall faces.
 */
export function mergeCollinearGaps(
  span: { from: Pt; to: Pt },
  gaps: { from: Pt; to: Pt }[],
): { from: Pt; to: Pt } {
  const eps = 1e-9;
  const horizontal = Math.abs(span.from.y - span.to.y) < eps;
  const line = horizontal ? span.from.y : span.from.x;
  const pos = (p: Pt) => (horizontal ? p.x : p.y);
  let lo = Math.min(pos(span.from), pos(span.to));
  let hi = Math.max(pos(span.from), pos(span.to));
  const intervals: [number, number][] = [];
  for (const g of gaps) {
    if ((Math.abs(g.from.y - g.to.y) < eps) !== horizontal) continue;
    if (Math.abs((horizontal ? g.from.y : g.from.x) - line) > eps) continue;
    intervals.push([Math.min(pos(g.from), pos(g.to)), Math.max(pos(g.from), pos(g.to))]);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const [glo, ghi] of intervals) {
      if (glo <= hi + eps && ghi >= lo - eps && (glo < lo - eps || ghi > hi + eps)) {
        lo = Math.min(lo, glo);
        hi = Math.max(hi, ghi);
        grew = true;
      }
    }
  }
  const mk = (t: number): Pt => (horizontal ? { x: t, y: line } : { x: line, y: t });
  return pos(span.from) > pos(span.to) ? { from: mk(hi), to: mk(lo) } : { from: mk(lo), to: mk(hi) };
}
