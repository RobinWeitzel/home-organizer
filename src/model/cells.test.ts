import { describe, expect, it } from 'vitest';
import {
  areaOfCells,
  boundsOfCells,
  centroidOfCells,
  hasHole,
  isConnected,
  pointInCells,
  polygonCells,
  polygonEdges,
  rectCells,
  rectInsideCells,
  subtract,
  traceOutline,
  union,
} from './cells';

const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

/** L-shape: 4x3 block with the 2x1 top-right corner missing. */
const lShape = () => subtract(rectCells(rect(0, 0, 4, 3)), rectCells(rect(2, 0, 2, 1)));

describe('rectCells', () => {
  it('produces 400 five-centimetre cells per m²', () => {
    expect(rectCells(rect(1, 2, 3, 2)).size).toBe(6 * 400);
    expect(pointInCells(3.9, 3.9, rectCells(rect(1, 2, 3, 2)))).toBe(true);
    expect(pointInCells(4.1, 3.9, rectCells(rect(1, 2, 3, 2)))).toBe(false);
  });

  it('resolves five-centimetre rects', () => {
    expect(rectCells(rect(0, 0, 0.5, 0.75)).size).toBe(10 * 15);
    expect(traceOutline(rectCells(rect(0.25, 0.5, 0.5, 0.25)))).toEqual([
      { x: 0.25, y: 0.5 },
      { x: 0.75, y: 0.5 },
      { x: 0.75, y: 0.75 },
      { x: 0.25, y: 0.75 },
    ]);
  });
});

describe('union / subtract', () => {
  it('unions overlapping rects without double counting', () => {
    const u = union(rectCells(rect(0, 0, 2, 2)), rectCells(rect(1, 0, 2, 2)));
    expect(u.size).toBe(6 * 400);
  });

  it('subtract removes covered cells only', () => {
    const s = subtract(rectCells(rect(0, 0, 3, 3)), rectCells(rect(1, 1, 5, 5)));
    expect(s.size).toBe(5 * 400);
    expect(pointInCells(0.5, 0.5, s)).toBe(true);
    expect(pointInCells(1.5, 1.5, s)).toBe(false);
  });
});

describe('isConnected', () => {
  it('accepts an L-shape', () => {
    expect(isConnected(lShape())).toBe(true);
  });

  it('rejects diagonal-only contact', () => {
    const diag = union(rectCells(rect(0, 0, 1, 1)), rectCells(rect(1, 1, 1, 1)));
    expect(isConnected(diag)).toBe(false);
  });

  it('rejects two separate blocks and accepts empty=false', () => {
    const split = union(rectCells(rect(0, 0, 2, 1)), rectCells(rect(3, 0, 2, 1)));
    expect(isConnected(split)).toBe(false);
    expect(isConnected(new Set())).toBe(false);
  });
});

describe('hasHole', () => {
  it('detects a ring', () => {
    const ring = subtract(rectCells(rect(0, 0, 3, 3)), rectCells(rect(1, 1, 1, 1)));
    expect(hasHole(ring)).toBe(true);
  });

  it('accepts U-shape (no hole)', () => {
    const u = subtract(rectCells(rect(0, 0, 3, 3)), rectCells(rect(1, 0, 1, 2)));
    expect(hasHole(u)).toBe(false);
  });
});

describe('traceOutline', () => {
  it('traces a rect clockwise starting at top-left', () => {
    expect(traceOutline(rectCells(rect(1, 2, 3, 2)))).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 4 },
      { x: 1, y: 4 },
    ]);
  });

  it('traces an L-shape with 6 vertices', () => {
    expect(traceOutline(lShape())).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ]);
  });
});

describe('polygonCells', () => {
  it('is the inverse of traceOutline', () => {
    const shape = lShape();
    expect(polygonCells(traceOutline(shape))).toEqual(shape);
  });
});

describe('polygonEdges', () => {
  it('computes lengths and inward normals for a rect', () => {
    const edges = polygonEdges(traceOutline(rectCells(rect(0, 0, 3, 2))));
    expect(edges).toHaveLength(4);
    expect(edges.map((e) => e.len)).toEqual([3, 2, 3, 2]);
    expect(edges.map((e) => e.inward)).toEqual([
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
      { x: 1, y: 0 },
    ]);
  });
});

describe('rectInsideCells', () => {
  const shape = lShape(); // missing the 2x1 top-right corner

  it('accepts a rect fully inside the arm', () => {
    expect(rectInsideCells(rect(0, 0, 2, 1), shape)).toBe(true);
    expect(rectInsideCells(rect(0.5, 1.5, 3, 1), shape)).toBe(true);
  });

  it('rejects a rect poking into the notch', () => {
    expect(rectInsideCells(rect(1.5, 0, 1, 1), shape)).toBe(false);
    expect(rectInsideCells(rect(3, 0.5, 1, 1), shape)).toBe(false);
  });

  it('rejects a rect outside the bounds', () => {
    expect(rectInsideCells(rect(-1, 0, 1, 1), shape)).toBe(false);
  });
});

describe('pointInCells / bounds / centroid / area', () => {
  it('works on the L-shape', () => {
    const shape = lShape();
    expect(pointInCells(0.5, 0.5, shape)).toBe(true);
    expect(pointInCells(3, 0.5, shape)).toBe(false);
    expect(boundsOfCells(shape)).toEqual({ x: 0, y: 0, w: 4, h: 3 });
    expect(areaOfCells(shape)).toBe(10);
    const c = centroidOfCells(shape);
    expect(c.x).toBeCloseTo(1.8);
    expect(c.y).toBeCloseTo(1.7);
  });
});
