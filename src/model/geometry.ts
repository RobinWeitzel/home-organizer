import { polygonEdges } from './cells';
import type { Pt, Rect, WallItem } from './types';

export function snap(v: number, grid = 1): number {
  // canonical 2-decimal double: grids are multiples of 0.01, but neither they
  // nor their products are exact in binary — without this, snapped values
  // like 2.0500000000000003 end up stored
  return Math.round(Math.round(v / grid) * grid * 100) / 100;
}

export function normalizeRect(x1: number, y1: number, x2: number, y2: number, min = 1): Rect {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return { x, y, w: Math.max(min, Math.abs(x2 - x1)), h: Math.max(min, Math.abs(y2 - y1)) };
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/**
 * Nearest polygon edge within tolerance of the point, with the offset of the
 * point's projection measured along the edge direction.
 */
export function wallHitPolygon(
  polygon: Pt[],
  px: number,
  py: number,
  tolerance: number,
): { edge: number; offset: number } | null {
  let best: { edge: number; offset: number; dist: number } | null = null;
  const edges = polygonEdges(polygon);
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const dx = Math.sign(e.b.x - e.a.x);
    const dy = Math.sign(e.b.y - e.a.y);
    const t = Math.min(Math.max(0, (px - e.a.x) * dx + (py - e.a.y) * dy), e.len);
    const dist = Math.hypot(px - (e.a.x + dx * t), py - (e.a.y + dy * t));
    if (dist <= tolerance && (!best || dist < best.dist)) {
      best = { edge: i, offset: t, dist };
    }
  }
  return best ? { edge: best.edge, offset: best.offset } : null;
}

export function clampWallOffset(edgeLen: number, offset: number, length: number): number {
  return Math.min(Math.max(0, offset), Math.max(0, edgeLen - length));
}

/** World-space segment of a wall item on its room polygon, plus the inward normal. */
export function wallItemSegment(
  w: Pick<WallItem, 'edge' | 'offset' | 'length'>,
  polygon: Pt[],
): { from: Pt; to: Pt; inward: Pt } | null {
  const edges = polygonEdges(polygon);
  const e = edges[w.edge];
  if (!e) return null;
  const dx = Math.sign(e.b.x - e.a.x);
  const dy = Math.sign(e.b.y - e.a.y);
  return {
    from: { x: e.a.x + dx * w.offset, y: e.a.y + dy * w.offset },
    to: { x: e.a.x + dx * (w.offset + w.length), y: e.a.y + dy * (w.offset + w.length) },
    inward: e.inward,
  };
}
