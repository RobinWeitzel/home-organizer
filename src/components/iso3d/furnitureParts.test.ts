import { describe, expect, it } from 'vitest';
import type { FurnitureKind } from '../../model/types';
import { KIND_HEIGHTS } from '../../model/iso';
import { buildFurnitureParts, PART_TOLERANCE } from './furnitureParts';

const KINDS: FurnitureKind[] = [
  'shelf', 'dresser', 'wardrobe', 'cabinet', 'chest', 'fridge', 'other',
  'desk', 'table', 'chair', 'sofa', 'bed', 'tv', 'monitor',
  'counter', 'stove', 'sink', 'washbasin', 'toilet', 'shower', 'bathtub', 'plant',
];

describe('buildFurnitureParts', () => {
  it.each(KINDS)('%s is more than a single box and stays within its footprint', (kind) => {
    const W = 1.2, D = 0.5, H = KIND_HEIGHTS[kind];
    const parts = buildFurnitureParts(kind, W, D, H, 'piece-1');
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      const [sx, sy, sz] = p.size;
      const [px, py, pz] = p.pos;
      expect(sx).toBeGreaterThan(0);
      expect(sy).toBeGreaterThan(0);
      expect(sz).toBeGreaterThan(0);
      // stays inside footprint + tolerance, above the floor, below the top
      expect(Math.abs(px) + sx / 2).toBeLessThanOrEqual(W / 2 + PART_TOLERANCE);
      expect(Math.abs(pz) + sz / 2).toBeLessThanOrEqual(D / 2 + PART_TOLERANCE);
      expect(py - sy / 2).toBeGreaterThanOrEqual(-1e-9);
      expect(py + sy / 2).toBeLessThanOrEqual(H + PART_TOLERANCE);
    }
  });

  it.each(KINDS)('%s survives a tiny footprint without degenerate boxes', (kind) => {
    const parts = buildFurnitureParts(kind, 0.3, 0.25, KIND_HEIGHTS[kind], 'tiny');
    for (const p of parts) {
      expect(Math.min(...p.size)).toBeGreaterThan(0);
    }
  });

  it('books are deterministic for the same seed and differ across seeds', () => {
    const a = buildFurnitureParts('shelf', 1.2, 0.4, 1.8, 'seed-a');
    const b = buildFurnitureParts('shelf', 1.2, 0.4, 1.8, 'seed-a');
    const c = buildFurnitureParts('shelf', 1.2, 0.4, 1.8, 'seed-b');
    expect(a).toEqual(b);
    expect(a.some((p) => p.key.startsWith('book'))).toBe(true);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(c));
  });

  it('wardrobe and cabinet have two door fronts with knobs', () => {
    for (const kind of ['wardrobe', 'cabinet'] as const) {
      const keys = buildFurnitureParts(kind, 1.2, 0.6, KIND_HEIGHTS[kind], 'x').map((p) => p.key);
      expect(keys).toEqual(expect.arrayContaining(['doorL', 'doorR', 'knobL', 'knobR']));
    }
  });

  it('dresser has three drawer fronts', () => {
    const keys = buildFurnitureParts('dresser', 1.0, 0.5, 1.0, 'x').map((p) => p.key);
    expect(keys.filter((k) => k.startsWith('drawer'))).toHaveLength(3);
  });
});
