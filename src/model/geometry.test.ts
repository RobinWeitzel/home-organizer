import { describe, expect, it } from 'vitest';
import { clampWallOffset, normalizeRect, pointInRect, snap, wallHitPolygon, wallItemSegment } from './geometry';
import type { Pt } from './types';

// L-shape: 4x3 with the 2x1 top-right corner missing
const L: Pt[] = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 1 },
  { x: 4, y: 1 },
  { x: 4, y: 3 },
  { x: 0, y: 3 },
];

describe('snap', () => {
  it('rounds to the nearest grid unit', () => {
    expect(snap(2.4)).toBe(2);
    expect(snap(2.5)).toBe(3);
    expect(snap(2.3, 0.5)).toBe(2.5);
  });
});

describe('normalizeRect', () => {
  it('normalizes a reversed drag with a 1x1 minimum', () => {
    expect(normalizeRect(5, 7, 2, 3)).toEqual({ x: 2, y: 3, w: 3, h: 4 });
    expect(normalizeRect(2, 2, 2, 2)).toEqual({ x: 2, y: 2, w: 1, h: 1 });
  });
});

describe('pointInRect', () => {
  it('includes edges', () => {
    expect(pointInRect(2, 3, { x: 2, y: 3, w: 6, h: 4 })).toBe(true);
    expect(pointInRect(8.1, 5, { x: 2, y: 3, w: 6, h: 4 })).toBe(false);
  });
});

describe('wallHitPolygon', () => {
  it('hits the top edge of the first arm', () => {
    expect(wallHitPolygon(L, 1, 0.2, 0.5)).toEqual({ edge: 0, offset: 1 });
  });

  it('hits the inner notch edge (edge 2, the horizontal step)', () => {
    expect(wallHitPolygon(L, 3, 1.2, 0.5)).toEqual({ edge: 2, offset: 1 });
  });

  it('hits the bottom edge, offset measured east-to-west', () => {
    expect(wallHitPolygon(L, 3, 2.9, 0.5)).toEqual({ edge: 4, offset: 1 });
  });

  it('misses interior points', () => {
    expect(wallHitPolygon(L, 2, 2, 0.4)).toBeNull();
  });
});

describe('clampWallOffset', () => {
  it('keeps the item on the wall', () => {
    expect(clampWallOffset(4, -1, 1)).toBe(0);
    expect(clampWallOffset(4, 3.5, 2)).toBe(2);
    expect(clampWallOffset(4, 1, 1)).toBe(1);
  });
});

describe('wallItemSegment', () => {
  it('places a door on the bottom edge with the inward normal pointing up', () => {
    const seg = wallItemSegment({ edge: 4, offset: 1, length: 1 }, L)!;
    expect(seg.from).toEqual({ x: 3, y: 3 });
    expect(seg.to).toEqual({ x: 2, y: 3 });
    expect(seg.inward).toEqual({ x: 0, y: -1 });
  });

  it('returns null for a missing edge', () => {
    expect(wallItemSegment({ edge: 9, offset: 0, length: 1 }, L)).toBeNull();
  });
});
