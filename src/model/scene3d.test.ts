// src/model/scene3d.test.ts
import { describe, expect, it } from 'vitest';
import { buildScene3D, furnitureFacing } from './scene3d';
import { DOOR_HEAD, SILL_H, WALL_H, WALL_T } from './iso';
import type { Furniture, Room, WallItem } from './types';

const room = (id: string, x0: number, y0: number, x1: number, y1: number): Room => ({
  id, floorId: 'f1', name: id,
  polygon: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }],
});

describe('buildScene3D', () => {
  it('builds full-height wall boxes around a single room', () => {
    const s = buildScene3D([room('r1', 0, 0, 4, 3)], [], []);
    expect(s.wallBoxes.length).toBe(4);
    for (const b of s.wallBoxes) {
      expect(b.z0).toBe(0);
      expect(b.height).toBe(WALL_H);
      expect(Math.min(b.w, b.h)).toBeCloseTo(WALL_T, 10);
    }
    expect(s.floors).toEqual([{ room: expect.objectContaining({ id: 'r1' }), tiled: false }]);
  });

  it('marks kitchen-like rooms as tiled', () => {
    const k = { ...room('r1', 0, 0, 4, 3), name: 'Kitchen' };
    expect(buildScene3D([k], [], []).floors[0].tiled).toBe(true);
  });

  it('cuts a door gap and emits jambs at the merged gap ends', () => {
    const rooms = [room('r1', 0, 0, 4, 4), room('r2', 4, 0, 8, 4)];
    // r1 edge 1 runs (4,0)->(4,4); door at offset 1.5, length 0.9 -> y in [1.5, 2.4]
    const door: WallItem = { id: 'd1', roomId: 'r1', type: 'door', edge: 1, offset: 1.5, length: 0.9 };
    const s = buildScene3D(rooms, [door], []);
    expect(s.doors.length).toBe(1);
    const d = s.doors[0];
    // the leaf is kept below the wall top so a lintel can frame it
    expect(d.height).toBeCloseTo(WALL_H - DOOR_HEAD, 10);
    expect([d.gapFrom, d.gapTo]).toEqual([{ x: 4, y: 1.5 }, { x: 4, y: 2.4 }]);
    // leaf swings into r1: inward is -x
    expect(d.inward).toEqual({ x: -1, y: 0 });
    // the shared wall x=4 is split around the gap at floor level: no floor-
    // standing wall box covers y in (1.5, 2.4) — only the lintel above does
    const onLine = s.wallBoxes.filter((b) => Math.abs(b.x + b.w / 2 - 4) < 1e-6 && b.z0 === 0);
    for (const b of onLine) {
      expect(b.y >= 2.4 - 1e-6 || b.y + b.h <= 1.5 + 1e-6).toBe(true);
    }
    // a lintel fills the wall above the door, spanning the gap
    const lintel = s.wallBoxes.find((b) => Math.abs(b.x + b.w / 2 - 4) < 1e-6 && b.z0 > 0);
    expect(lintel).toBeTruthy();
    expect(lintel!.z0).toBeCloseTo(WALL_H - DOOR_HEAD, 10);
    expect(lintel!.z0 + lintel!.height).toBeCloseTo(WALL_H, 10);
  });

  it('stacks furniture whose footprint sits inside a larger piece', () => {
    const f = (id: string, kind: Furniture['kind'], x: number, y: number, w: number, h: number): Furniture => ({
      id, roomId: 'r1', kind, name: id, x, y, w, h,
    });
    const cabinet = f('cab', 'cabinet', 1, 1, 1.5, 0.4);   // H 0.9
    const tv = f('tv', 'tv', 1.1, 1.05, 1.3, 0.3);         // inside the cabinet
    const aside = f('aside', 'chair', 3, 3, 0.45, 0.45);   // elsewhere
    const s = buildScene3D([room('r1', 0, 0, 6, 6)], [], [cabinet, tv, aside]);
    const byId = Object.fromEntries(s.furniture.map((x) => [x.id, x]));
    expect(byId.cab.z0).toBe(0);
    expect(byId.tv.z0).toBeCloseTo(0.9); // standing on the cabinet
    expect(byId.aside.z0).toBe(0);
  });

  it('flips the door hinge side and swing direction', () => {
    const rooms = [room('r1', 0, 0, 4, 4)];
    // edge 1 runs (4,0)->(4,4); inward is -x
    const base: WallItem = { id: 'd1', roomId: 'r1', type: 'door', edge: 1, offset: 1.5, length: 0.9 };
    const plain = buildScene3D(rooms, [base], []).doors[0];
    expect(plain.hinge).toEqual({ x: 4, y: 1.5 });
    expect(plain.inward).toEqual({ x: -1, y: 0 });

    const flipped = buildScene3D(
      rooms,
      [{ ...base, hingeAtEnd: true, swingOutward: true }],
      [],
    ).doors[0];
    expect(flipped.hinge).toEqual({ x: 4, y: 2.4 });
    expect(flipped.inward).toEqual({ x: 1, y: 0 });
  });

  it('an opening cuts the shared wall without building a door or jambs', () => {
    const rooms = [room('r1', 0, 0, 4, 4), room('r2', 4, 0, 8, 4)];
    // r1 edge 1 runs (4,0)->(4,4); opening at offset 1, length 2 -> y in [1, 3]
    const opening: WallItem = { id: 'o1', roomId: 'r1', type: 'opening', edge: 1, offset: 1, length: 2 };
    const s = buildScene3D(rooms, [opening], [], { selectedWallItemId: 'o1' });
    expect(s.doors).toHaveLength(0);
    expect(s.openings).toEqual([
      { id: 'o1', from: { x: 4, y: 1 }, to: { x: 4, y: 3 }, selected: true },
    ]);
    // the shared wall x=4 is split around the gap: no wall box covers y in (1, 3)
    const onLine = s.wallBoxes.filter((b) => Math.abs(b.x + b.w / 2 - 4) < 1e-6);
    expect(onLine.length).toBeGreaterThan(0);
    for (const b of onLine) {
      expect(b.y >= 3 - 1e-6 || b.y + b.h <= 1 + 1e-6).toBe(true);
    }
  });

  it('emits a sill box and glass quad (no head box below WINDOW_TOP)', () => {
    // WALL_H(1.1) < WINDOW_TOP(2.0) → no head box is emitted
    const win: WallItem = { id: 'w1', roomId: 'r1', type: 'window', edge: 0, offset: 1, length: 1.2 };
    const s = buildScene3D([room('r1', 0, 0, 4, 3)], [win], []);
    expect(s.windows.length).toBe(1);
    const w = s.windows[0];
    expect(w.z0).toBe(SILL_H);
    expect(w.z1).toBe(WALL_H);
    // exactly one wall box should have height < WALL_H — the sill; no head box
    const subHeightBoxes = s.wallBoxes.filter((b) => b.height < WALL_H);
    expect(subHeightBoxes.length).toBe(1);
    const sill = subHeightBoxes[0];
    expect(sill.z0).toBe(0);
    expect(sill.height).toBeCloseTo(SILL_H, 10);
    // sill x-extent: exactly the cut gap (x=1 to x=2.2) so it abuts the jambs
    expect(sill.x).toBeCloseTo(1, 10);
    expect(sill.x + sill.w).toBeCloseTo(2.2, 10);
    expect(sill.y).toBeCloseTo(-WALL_T / 2, 10);
    expect(sill.h).toBeCloseTo(WALL_T, 10);
  });

  it('a door touching a window on the same wall keeps its own gap (frame must not span the window)', () => {
    const r = room('r1', 0, 0, 6, 4);
    // edge 0 runs (0,0)->(6,0): door x in [1, 1.9], window touching at x in [1.9, 3.1]
    const door: WallItem = { id: 'd1', roomId: 'r1', type: 'door', edge: 0, offset: 1, length: 0.9 };
    const win: WallItem = { id: 'w1', roomId: 'r1', type: 'window', edge: 0, offset: 1.9, length: 1.2 };
    const s = buildScene3D([r], [door, win], []);
    const d = s.doors[0];
    const [lo, hi] = d.gapFrom.x <= d.gapTo.x ? [d.gapFrom, d.gapTo] : [d.gapTo, d.gapFrom];
    expect(lo).toEqual({ x: 1, y: 0 });
    expect(hi).toEqual({ x: 1.9, y: 0 });
  });

  it('dedupes coincident windows and sills when both rooms register the same shared-wall opening', () => {
    const rooms = [room('r1', 0, 0, 4, 4), room('r2', 4, 0, 8, 4)];
    // same physical opening on x=4, y in [1, 2.2], registered once per room
    const w1: WallItem = { id: 'w1', roomId: 'r1', type: 'window', edge: 1, offset: 1, length: 1.2 };
    // r2 edge 3 runs (4,4)->(4,0): offset 1.8 -> y in [2.2, 1]
    const w2: WallItem = { id: 'w2', roomId: 'r2', type: 'window', edge: 3, offset: 1.8, length: 1.2 };
    const s = buildScene3D(rooms, [w1, w2], [], { selectedWallItemId: 'w2' });
    expect(s.windows).toHaveLength(1);
    expect(s.windows[0].selected).toBe(true); // the selected duplicate wins
    const sills = s.wallBoxes.filter((b) => b.height < WALL_H);
    expect(sills).toHaveLength(1);
  });

  it('selectedWallItemId sets selected on the matching item only', () => {
    const door: WallItem = { id: 'd1', roomId: 'r1', type: 'door', edge: 1, offset: 1, length: 0.9 };
    const win: WallItem = { id: 'w1', roomId: 'r1', type: 'window', edge: 0, offset: 1, length: 1.2 };
    const r = room('r1', 0, 0, 4, 3);
    const s1 = buildScene3D([r], [door, win], [], { selectedWallItemId: 'd1' });
    expect(s1.doors[0].selected).toBe(true);
    expect(s1.windows[0].selected).toBe(false);
    const s2 = buildScene3D([r], [door, win], [], { selectedWallItemId: 'w1' });
    expect(s2.doors[0].selected).toBe(false);
    expect(s2.windows[0].selected).toBe(true);
  });

  it('invalidFurnitureIds marks matching furniture invalid', () => {
    const f: Furniture = { id: 'f1', roomId: 'r1', kind: 'wardrobe', name: 'W', x: 0, y: 1, w: 0.6, h: 1.5 };
    const r = room('r1', 0, 0, 4, 3);
    const withInvalid = buildScene3D([r], [], [f], { invalidFurnitureIds: new Set(['f1']) });
    expect(withInvalid.furniture[0].invalid).toBe(true);
    const withoutInvalid = buildScene3D([r], [], [f]);
    expect(withoutInvalid.furniture[0].invalid).toBe(false);
  });

  it('drops wallItems and furniture whose roomId does not match any room', () => {
    const door: WallItem = { id: 'd1', roomId: 'missing', type: 'door', edge: 0, offset: 0, length: 0.9 };
    const win: WallItem = { id: 'w1', roomId: 'missing', type: 'window', edge: 0, offset: 0, length: 1.0 };
    const f: Furniture = { id: 'f1', roomId: 'missing', kind: 'wardrobe', name: 'W', x: 0, y: 0, w: 0.6, h: 1.5 };
    const s = buildScene3D([room('r1', 0, 0, 4, 3)], [door, win], [f]);
    expect(s.doors).toHaveLength(0);
    expect(s.windows).toHaveLength(0);
    expect(s.furniture).toHaveLength(0);
  });

  it('two doors sharing a merged wall gap get the same jamb endpoints with opposite inward', () => {
    const rooms = [room('r1', 0, 0, 4, 4), room('r2', 4, 0, 8, 4)];
    // r1 edge 1 runs (4,0)->(4,4); d1: offset=1.5, length=0.9 -> seg y∈[1.5,2.4]
    const d1: WallItem = { id: 'd1', roomId: 'r1', type: 'door', edge: 1, offset: 1.5, length: 0.9 };
    // r2 edge 3 runs (4,4)->(4,0); d2: offset=1.8, length=0.9 -> seg y∈[1.3,2.2]
    const d2: WallItem = { id: 'd2', roomId: 'r2', type: 'door', edge: 3, offset: 1.8, length: 0.9 };
    const s = buildScene3D(rooms, [d1, d2], []);
    expect(s.doors).toHaveLength(2);
    const sd1 = s.doors.find((d) => d.id === 'd1')!;
    const sd2 = s.doors.find((d) => d.id === 'd2')!;

    // Both doors share merged gap x=4, y∈[1.3,2.4]; order-normalize to compare
    const normPair = (d: typeof sd1): [{ x: number; y: number }, { x: number; y: number }] => {
      const a = d.gapFrom, b = d.gapTo;
      return a.y <= b.y ? [a, b] : [b, a];
    };
    const [lo1, hi1] = normPair(sd1);
    const [lo2, hi2] = normPair(sd2);
    expect(lo1.x).toBe(4); expect(lo1.y).toBeCloseTo(1.3, 10);
    expect(hi1.x).toBe(4); expect(hi1.y).toBeCloseTo(2.4, 10);
    expect(lo2.x).toBe(4); expect(lo2.y).toBeCloseTo(1.3, 10);
    expect(hi2.x).toBe(4); expect(hi2.y).toBeCloseTo(2.4, 10);

    // inward directions must be opposite (r1 swings into -x, r2 swings into +x)
    expect(sd1.inward.x + sd2.inward.x).toBe(0);
    expect(sd1.inward.y + sd2.inward.y).toBe(0);
    expect(sd1.inward).toEqual({ x: -1, y: 0 });
    expect(sd2.inward).toEqual({ x: 1, y: 0 });
  });

  it('insets flush furniture and attaches its kind height', () => {
    const f: Furniture = { id: 'f1', roomId: 'r1', kind: 'wardrobe', name: 'W', x: 0, y: 1, w: 0.6, h: 1.5 };
    const s = buildScene3D([room('r1', 0, 0, 4, 3)], [], [f]);
    expect(s.furniture[0].height).toBe(2.0); // KIND_HEIGHTS.wardrobe
    expect(s.furniture[0].box.x).toBeCloseTo(WALL_T / 2, 10); // inset off the x=0 wall
  });
});

describe('furnitureFacing', () => {
  it('defaults to the legacy heuristic and honours an explicit facing', () => {
    expect(furnitureFacing({ w: 2, h: 0.5 })).toBe(0); // wide → south
    expect(furnitureFacing({ w: 0.5, h: 2 })).toBe(3); // deep → east
    expect(furnitureFacing({ w: 2, h: 0.5, facing: 2 })).toBe(2);
    expect(furnitureFacing({ w: 0.5, h: 2, facing: 0 })).toBe(0);
  });
});
