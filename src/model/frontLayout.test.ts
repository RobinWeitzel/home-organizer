import { describe, expect, it } from 'vitest';
import { frontGeometry, frontRegions, groupBand, placementAt, placementLine } from './frontLayout';
import type { Furniture, StorageArea } from './types';

const dresser: Furniture = { id: 'f', roomId: 'r', kind: 'dresser', name: 'D', x: 0, y: 0, w: 1, h: 0.5 };
const wardrobe: Furniture = { ...dresser, kind: 'wardrobe', w: 1.5, h: 0.6 };

function area(id: string, group: number, order = 0): StorageArea {
  return { id, furnitureId: 'f', name: id, group, order };
}

/** three stacked drawers */
const stacked = [area('a', 0), area('b', 1), area('c', 2)];

describe('frontRegions', () => {
  it('stacks groups and splits shared groups side by side', () => {
    const geom = frontGeometry(dresser, [area('a', 0), area('b', 1), area('c', 1, 1)]);
    const regions = frontRegions(geom);
    const byId = Object.fromEntries(regions.map((r) => [r.area.id, r]));
    expect(byId.a.w).toBeCloseTo(geom.innerW);
    expect(byId.b.y).toBeCloseTo(byId.c.y); // same band
    expect(byId.b.x).toBeLessThan(byId.c.x); // side by side
    expect(byId.b.w).toBeCloseTo(byId.c.w);
  });

  it('runs groups left-to-right for wardrobes and stacks members', () => {
    const geom = frontGeometry(wardrobe, [area('a', 0), area('b', 1), area('c', 1, 1)]);
    const byId = Object.fromEntries(frontRegions(geom).map((r) => [r.area.id, r]));
    expect(byId.a.h).toBeCloseTo(geom.innerH); // full-height column
    expect(byId.b.x).toBeCloseTo(byId.c.x); // same column
    expect(byId.b.y).toBeLessThan(byId.c.y); // stacked
  });
});

describe('placementAt', () => {
  const geom = frontGeometry(dresser, stacked);
  const bandH = (geom.innerH - 0.028 * 2) / 3;
  const bandMid = (gi: number) => geom.innerY + gi * (bandH + 0.028) + bandH / 2;
  const midX = geom.innerX + geom.innerW / 2;

  it('the middle of a band drops into that group', () => {
    // cross position picks the insertion side relative to the member's centre
    expect(placementAt(geom, geom.innerX + geom.innerW * 0.9, bandMid(1))).toEqual({ group: 1, index: 1 });
    expect(placementAt(geom, geom.innerX + 0.01, bandMid(1))).toEqual({ group: 1, index: 0 });
  });

  it('band edges and seams drop as a new group at that boundary', () => {
    expect(placementAt(geom, midX, geom.innerY + bandH * 0.1)).toEqual({ newGroupIndex: 0 });
    expect(placementAt(geom, midX, bandMid(0) + bandH * 0.45)).toEqual({ newGroupIndex: 1 });
    expect(placementAt(geom, midX, geom.innerY - 0.05)).toEqual({ newGroupIndex: 0 });
    expect(placementAt(geom, midX, geom.innerY + geom.innerH + 0.05)).toEqual({ newGroupIndex: 3 });
  });

  it('splits a shared band by member centres', () => {
    const shared = frontGeometry(dresser, [area('a', 0), area('b', 0, 1)]);
    const mid = shared.innerY + shared.innerH / 2;
    expect(placementAt(shared, shared.innerX + shared.innerW * 0.1, mid)).toEqual({ group: 0, index: 0 });
    expect(placementAt(shared, shared.innerX + shared.innerW * 0.5, mid)).toEqual({ group: 0, index: 1 });
    expect(placementAt(shared, shared.innerX + shared.innerW * 0.9, mid)).toEqual({ group: 0, index: 2 });
  });

  it('uses the horizontal axis for wardrobe columns', () => {
    const geom2 = frontGeometry(wardrobe, [area('a', 0), area('b', 1)]);
    const colW = (geom2.innerW - 0.028) / 2;
    const midY = geom2.innerY + geom2.innerH / 2;
    expect(placementAt(geom2, geom2.innerX + colW / 2, geom2.innerY + geom2.innerH * 0.9)).toEqual({
      group: 0,
      index: 1,
    });
    expect(placementAt(geom2, geom2.innerX + colW + 0.014, midY)).toEqual({ newGroupIndex: 1 });
  });
});

describe('placementLine', () => {
  const geom = frontGeometry(dresser, stacked);

  it('draws seams across the face and in-group lines along the band', () => {
    const seam = placementLine(geom, { newGroupIndex: 1 });
    expect(seam.y1).toBeCloseTo(seam.y2); // horizontal
    expect(seam.x2 - seam.x1).toBeCloseTo(geom.innerW);

    const inGroup = placementLine(geom, { group: 1, index: 0 });
    expect(inGroup.x1).toBeCloseTo(inGroup.x2); // vertical
  });

  it('groupBand covers a full band and matches its regions', () => {
    const band = groupBand(geom, 1);
    const region = frontRegions(geom).find((r) => r.area.id === 'b')!;
    expect(band.y).toBeCloseTo(region.y);
    expect(band.h).toBeCloseTo(region.h);
    expect(band.w).toBeCloseTo(geom.innerW);
  });
});
