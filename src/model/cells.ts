import type { Rect } from './types';

/**
 * Grid-cell geometry for rectilinear room shapes.
 * A shape is a set of GRID-sized cells keyed by packed integer grid
 * coordinates; the public API speaks metres throughout. The canonical stored
 * form is the clockwise (screen coords, y down) outline polygon produced by
 * traceOutline, also in metres. GRID is not exactly representable in binary,
 * so every coordinate leaving this module is canonicalised with roundCoord —
 * two coordinates that mean the same place are then bit-identical, keeping
 * the exact-equality checks elsewhere (wall reattachment, mesh dedup) sound.
 */
export type CellSet = Set<number>;

/** room-drawing resolution in metres */
export const GRID = 0.05;

/** canonical double for a grid-aligned metre coordinate (2 decimals) */
export const roundCoord = (v: number): number => Math.round(v * 100) / 100;

export interface Pt {
  x: number;
  y: number;
}

// packed integer keys: ±32768 grid units (±1.6 km at 5 cm) per axis
const OFFSET = 32768;
const SPAN = 65536;
const key = (x: number, y: number) => (x + OFFSET) * SPAN + (y + OFFSET);
const parse = (k: number): Pt => {
  const y = (k % SPAN) - OFFSET;
  return { x: (k - (k % SPAN)) / SPAN - OFFSET, y };
};

const EPS = 1e-9;

export function rectCells(rect: Rect): CellSet {
  const cells: CellSet = new Set();
  const x0 = Math.round(rect.x / GRID);
  const y0 = Math.round(rect.y / GRID);
  for (let x = x0; x < x0 + Math.round(rect.w / GRID); x++) {
    for (let y = y0; y < y0 + Math.round(rect.h / GRID); y++) {
      cells.add(key(x, y));
    }
  }
  return cells;
}

export function union(a: CellSet, b: CellSet): CellSet {
  const out = new Set(a);
  for (const c of b) out.add(c);
  return out;
}

export function subtract(a: CellSet, b: CellSet): CellSet {
  const out = new Set(a);
  for (const c of b) out.delete(c);
  return out;
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export function isConnected(cells: CellSet): boolean {
  if (cells.size === 0) return false;
  const seen = new Set<number>();
  const stack = [cells.values().next().value as number];
  seen.add(stack[0]);
  while (stack.length) {
    const { x, y } = parse(stack.pop()!);
    for (const [dx, dy] of NEIGHBOURS) {
      const k = key(x + dx, y + dy);
      if (cells.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push(k);
      }
    }
  }
  return seen.size === cells.size;
}

/** bounds in grid units, for the flood fill */
function gridBounds(cells: CellSet): Rect {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const k of cells) {
    const { x, y } = parse(k);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + 1);
    maxY = Math.max(maxY, y + 1);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function boundsOfCells(cells: CellSet): Rect {
  const b = gridBounds(cells);
  return { x: b.x * GRID, y: b.y * GRID, w: b.w * GRID, h: b.h * GRID };
}

export function hasHole(cells: CellSet): boolean {
  if (cells.size === 0) return false;
  const b = gridBounds(cells);
  const x0 = b.x - 1,
    y0 = b.y - 1,
    x1 = b.x + b.w,
    y1 = b.y + b.h;
  // flood the complement from outside the shape
  const seen = new Set<number>([key(x0, y0)]);
  const stack = [key(x0, y0)];
  while (stack.length) {
    const { x, y } = parse(stack.pop()!);
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const k = key(nx, ny);
      if (!cells.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push(k);
      }
    }
  }
  const totalComplement = (b.w + 2) * (b.h + 2) - cells.size;
  return seen.size !== totalComplement;
}

/**
 * Trace the clockwise outline of a connected, hole-free cell set.
 * Boundary edges are oriented so the interior is on the right.
 */
export function traceOutline(cells: CellSet): Pt[] {
  // directed boundary edges start->end keyed by start vertex
  const edges = new Map<number, Pt[]>();
  const addEdge = (sx: number, sy: number, ex: number, ey: number) => {
    const k = key(sx, sy);
    const list = edges.get(k) ?? [];
    list.push({ x: ex, y: ey });
    edges.set(k, list);
  };
  for (const k of cells) {
    const { x, y } = parse(k);
    if (!cells.has(key(x, y - 1))) addEdge(x, y, x + 1, y); // top, W->E
    if (!cells.has(key(x + 1, y))) addEdge(x + 1, y, x + 1, y + 1); // right, N->S
    if (!cells.has(key(x, y + 1))) addEdge(x + 1, y + 1, x, y + 1); // bottom, E->W
    if (!cells.has(key(x - 1, y))) addEdge(x, y + 1, x, y); // left, S->N
  }
  // start at the topmost-leftmost vertex (its outgoing edge runs east)
  let start: Pt | null = null;
  for (const k of edges.keys()) {
    const p = parse(k);
    if (!start || p.y < start.y || (p.y === start.y && p.x < start.x)) start = p;
  }
  if (!start) return [];

  const path: Pt[] = [start];
  let cur = start;
  let dir: Pt = { x: 0, y: 0 };
  for (let guard = 0; guard < edges.size * 4 + 8; guard++) {
    const outs = edges.get(key(cur.x, cur.y)) ?? [];
    if (outs.length === 0) break;
    // prefer the right-most turn relative to the incoming direction
    let next = outs[0];
    if (outs.length > 1) {
      const turnScore = (to: Pt) => {
        const d = { x: Math.sign(to.x - cur.x), y: Math.sign(to.y - cur.y) };
        const cross = dir.x * d.y - dir.y * d.x; // >0 = right turn in screen coords
        const dot = dir.x * d.x + dir.y * d.y;
        if (cross > 0) return 0;
        if (dot > 0) return 1;
        return 2;
      };
      next = [...outs].sort((a, b) => turnScore(a) - turnScore(b))[0];
    }
    outs.splice(outs.indexOf(next), 1);
    dir = { x: Math.sign(next.x - cur.x), y: Math.sign(next.y - cur.y) };
    if (next.x === start.x && next.y === start.y) break;
    path.push(next);
    cur = next;
  }
  // merge collinear vertices
  const merged: Pt[] = [];
  for (let i = 0; i < path.length; i++) {
    const prev = path[(i - 1 + path.length) % path.length];
    const p = path[i];
    const next = path[(i + 1) % path.length];
    const collinear = (prev.x === p.x && p.x === next.x) || (prev.y === p.y && p.y === next.y);
    if (!collinear) merged.push(p);
  }
  return merged.map((p) => ({ x: roundCoord(p.x * GRID), y: roundCoord(p.y * GRID) }));
}

/** Scanline fill of a rectilinear polygon (metres) back into cells (inverse of traceOutline). */
export function polygonCells(polygonM: Pt[]): CellSet {
  const cells: CellSet = new Set();
  if (polygonM.length < 4) return cells;
  const polygon = polygonM.map((p) => ({ x: Math.round(p.x / GRID), y: Math.round(p.y / GRID) }));
  const ys = polygon.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  for (let y = minY; y < maxY; y++) {
    const cy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      if (a.x === b.x && Math.min(a.y, b.y) < cy && cy < Math.max(a.y, b.y)) {
        xs.push(a.x);
      }
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = xs[i]; x < xs[i + 1]; x++) cells.add(key(x, y));
    }
  }
  return cells;
}

export interface PolyEdge {
  a: Pt;
  b: Pt;
  len: number;
  /** unit vector pointing into the room */
  inward: Pt;
}

export function polygonEdges(polygon: Pt[]): PolyEdge[] {
  return polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    return {
      a,
      b,
      len: Math.abs(b.x - a.x) + Math.abs(b.y - a.y),
      inward: { x: -dy || 0, y: dx },
    };
  });
}

/** True if every cell the rect's (metres) interior touches belongs to the set. */
export function rectInsideCells(rect: Rect, cells: CellSet): boolean {
  if (rect.w <= 0 || rect.h <= 0) return false;
  const x0 = Math.floor(rect.x / GRID + EPS);
  const x1 = Math.ceil((rect.x + rect.w) / GRID - EPS) - 1;
  const y0 = Math.floor(rect.y / GRID + EPS);
  const y1 = Math.ceil((rect.y + rect.h) / GRID - EPS) - 1;
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (!cells.has(key(x, y))) return false;
    }
  }
  return true;
}

export function pointInCells(px: number, py: number, cells: CellSet): boolean {
  return cells.has(key(Math.floor(px / GRID), Math.floor(py / GRID)));
}

/** area in m² */
export function areaOfCells(cells: CellSet): number {
  return cells.size * GRID * GRID;
}

export function centroidOfCells(cells: CellSet): Pt {
  let sx = 0,
    sy = 0;
  for (const k of cells) {
    const { x, y } = parse(k);
    sx += (x + 0.5) * GRID;
    sy += (y + 0.5) * GRID;
  }
  return cells.size ? { x: sx / cells.size, y: sy / cells.size } : { x: 0, y: 0 };
}
