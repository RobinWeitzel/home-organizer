import { describe, expect, it } from 'vitest';
import {
  buildWallLines,
  insetAgainstWalls,
  mergeCollinearGaps,
  type WallSlab,
  flatProjection,
  ISO_Y,
  isoProjection,
  makeIsoProjection,
  pointInLiftedRect,
  solidSpans,
  tapLiftRange,
  WALL_H,
} from './iso';

describe('projection', () => {
  it('round-trips floor points', () => {
    for (const [x, y] of [
      [0, 0],
      [3, 5],
      [-2.5, 7.25],
    ]) {
      const s = isoProjection.project(x, y);
      const w = isoProjection.unprojectFloor(s.x, s.y);
      expect(w.x).toBeCloseTo(x, 10);
      expect(w.y).toBeCloseTo(y, 10);
    }
  });

  it('lifts points up-screen with height, same screen x', () => {
    const base = isoProjection.project(2, 3, 0);
    const top = isoProjection.project(2, 3, 2);
    expect(top.x).toBeCloseTo(base.x, 10);
    expect(top.y).toBeLessThan(base.y);
    expect(base.y - top.y).toBeCloseTo(isoProjection.lift(2), 10);
  });

  it('flat projection is identity with zero lift', () => {
    expect(flatProjection.project(4, 7, 2)).toEqual({ x: 4, y: 7 });
    expect(flatProjection.unprojectFloor(4, 7)).toEqual({ x: 4, y: 7 });
    expect(flatProjection.lift(2)).toBe(0);
  });
});

describe('solidSpans', () => {
  it('returns the whole edge without gaps', () => {
    expect(solidSpans(5, [])).toEqual([{ from: 0, to: 5 }]);
  });
  it('splits around a gap', () => {
    expect(solidSpans(5, [{ from: 2, to: 3 }])).toEqual([
      { from: 0, to: 2 },
      { from: 3, to: 5 },
    ]);
  });
  it('clamps and merges overlapping gaps', () => {
    expect(
      solidSpans(5, [
        { from: -1, to: 2 },
        { from: 1.5, to: 3 },
      ]),
    ).toEqual([{ from: 3, to: 5 }]);
  });
  it('returns nothing when fully gapped', () => {
    expect(solidSpans(2, [{ from: 0, to: 2 }])).toEqual([]);
  });
});

describe('pointInLiftedRect', () => {
  const r = { x: 2, y: 2, w: 1, h: 1 };
  it('hits inside the base', () => {
    expect(pointInLiftedRect(isoProjection, { x: 2.5, y: 2.5 }, r, 2)).toBe(true);
  });
  it('hits diagonally behind the base within the lift range', () => {
    const t = tapLiftRange(isoProjection, 2) / 2;
    expect(pointInLiftedRect(isoProjection, { x: 2.5 - t, y: 2.5 - t }, r, 2)).toBe(true);
  });
  it('misses beyond the lift range', () => {
    const t = tapLiftRange(isoProjection, 2) + 1.2;
    expect(pointInLiftedRect(isoProjection, { x: 2.5 - t, y: 2.5 - t }, r, 2)).toBe(false);
  });
  it('is a plain rect test in flat mode', () => {
    expect(pointInLiftedRect(flatProjection, { x: 1.9, y: 1.9 }, r, 2)).toBe(false);
    expect(pointInLiftedRect(flatProjection, { x: 2.1, y: 2.1 }, r, 2)).toBe(true);
  });
});

describe('buildWallLines', () => {
  const T = 0.15;
  const rect = (x0: number, y0: number, x1: number, y1: number) => [
    { a: { x: x0, y: y0 }, b: { x: x1, y: y0 } },
    { a: { x: x1, y: y0 }, b: { x: x1, y: y1 } },
    { a: { x: x1, y: y1 }, b: { x: x0, y: y1 } },
    { a: { x: x0, y: y1 }, b: { x: x0, y: y0 } },
  ];
  const find = (slabs: WallSlab[], horizontal: boolean, line: number) =>
    slabs.filter((s) => s.horizontal === horizontal && s.line === line);

  it('miters a single room: horizontal slabs own the corners, verticals abut', () => {
    const slabs = buildWallLines(rect(0, 0, 5, 3), []);
    expect(slabs).toHaveLength(4);
    const [north] = find(slabs, true, 0);
    expect(north.from).toBeCloseTo(-T / 2, 10);
    expect(north.to).toBeCloseTo(5 + T / 2, 10);
    const [west] = find(slabs, false, 0);
    expect(west.from).toBeCloseTo(T / 2, 10);
    expect(west.to).toBeCloseTo(3 - T / 2, 10);
  });

  it('merges collinear edges of adjacent rooms into one slab', () => {
    const edges = [...rect(0, 0, 5, 3), ...rect(1, 3, 4, 6)];
    const shared = find(buildWallLines(edges, []), true, 3);
    expect(shared).toHaveLength(1);
    expect(shared[0].from).toBeCloseTo(-T / 2, 10);
    expect(shared[0].to).toBeCloseTo(5 + T / 2, 10);
  });

  it('shrinks a wall that tees into a continuing perpendicular wall', () => {
    const edges = [...rect(0, 0, 5, 3), ...rect(1, 3, 4, 6)];
    const slabs = buildWallLines(edges, []);
    // room 2's east wall (x=4, y 3..6) tees into the continuing y=3 wall: north end abuts
    const [east] = find(slabs, false, 4);
    expect(east.from).toBeCloseTo(3 + T / 2, 10);
    expect(east.to).toBeCloseTo(6 - T / 2, 10);
  });

  it('cuts door gaps with jambs at the exact gap bounds', () => {
    const slabs = buildWallLines(rect(0, 0, 5, 3), [
      { from: { x: 2.1, y: 3 }, to: { x: 3, y: 3 } },
    ]);
    const south = find(slabs, true, 3).sort((a, b) => a.from - b.from);
    expect(south).toHaveLength(2);
    expect(south[0].to).toBeCloseTo(2.1, 10);
    expect(south[1].from).toBeCloseTo(3, 10);
  });

  it('shrinks a horizontal wall that tees into a continuing vertical wall', () => {
    // rooms side by side: x=3 vertical line runs y 0..6; room 2's south wall (y=3) tees into it
    const edges = [...rect(0, 0, 3, 6), ...rect(3, 0, 6, 3)];
    const slabs = buildWallLines(edges, []);
    const y3 = find(slabs, true, 3).sort((a, b) => a.from - b.from);
    // the y=3 wall spans x 3..6; its west end abuts the continuing x=3 wall
    expect(y3).toHaveLength(1);
    expect(y3[0].from).toBeCloseTo(3 + T / 2, 10);
    expect(y3[0].to).toBeCloseTo(6 + T / 2, 10);
  });
});

describe('insetAgainstWalls', () => {
  const T = 0.15;
  const room = [
    { a: { x: 0, y: 3 }, b: { x: 6, y: 3 } }, // north wall line of the room
    { a: { x: 6, y: 3 }, b: { x: 6, y: 7 } },
    { a: { x: 6, y: 7 }, b: { x: 0, y: 7 } },
    { a: { x: 0, y: 7 }, b: { x: 0, y: 3 } },
  ];

  it('insets a side flush against a wall by half the wall thickness', () => {
    const r = insetAgainstWalls({ x: 2, y: 3, w: 1.2, h: 0.6 }, room);
    expect(r).toEqual({ x: 2, y: 3 + T / 2, w: 1.2, h: 0.6 - T / 2 });
  });

  it('insets multiple flush sides', () => {
    const r = insetAgainstWalls({ x: 0, y: 3, w: 1, h: 1 }, room);
    expect(r).toEqual({ x: T / 2, y: 3 + T / 2, w: 1 - T / 2, h: 1 - T / 2 });
  });

  it('leaves non-flush furniture untouched', () => {
    const r = { x: 2, y: 3.25, w: 1, h: 0.5 };
    expect(insetAgainstWalls(r, room)).toEqual(r);
  });

  it('ignores collinear edges that do not overlap the furniture span', () => {
    const lShape = [{ a: { x: 4, y: 3 }, b: { x: 6, y: 3 } }];
    const r = { x: 1, y: 3, w: 1, h: 0.5 };
    expect(insetAgainstWalls(r, lShape)).toEqual(r);
  });

  it('never collapses tiny furniture', () => {
    const r = insetAgainstWalls({ x: 0, y: 3, w: 0.1, h: 0.1 }, room);
    expect(r.w).toBeGreaterThan(0.04);
    expect(r.h).toBeGreaterThan(0.04);
  });
});

describe('tapLiftRange', () => {
  it('matches lift scaled by 1/(2*ISO_Y)', () => {
    expect(tapLiftRange(isoProjection, WALL_H)).toBeCloseTo(isoProjection.lift(WALL_H) / (2 * ISO_Y), 10);
    expect(tapLiftRange(flatProjection, WALL_H)).toBe(0);
  });
});

describe('mergeCollinearGaps', () => {
  const span = { from: { x: 2.6, y: 4 }, to: { x: 3.5, y: 4 } };

  it('returns the span unchanged when no other gaps touch it', () => {
    expect(mergeCollinearGaps(span, [span])).toEqual(span);
  });

  it('extends across an overlapping collinear gap (neighbour-room door)', () => {
    const other = { from: { x: 2.0, y: 4 }, to: { x: 2.9, y: 4 } };
    expect(mergeCollinearGaps(span, [span, other])).toEqual({
      from: { x: 2.0, y: 4 },
      to: { x: 3.5, y: 4 },
    });
  });

  it('merges chains of touching gaps transitively', () => {
    const a = { from: { x: 2.0, y: 4 }, to: { x: 2.7, y: 4 } };
    const b = { from: { x: 1.2, y: 4 }, to: { x: 2.0, y: 4 } };
    expect(mergeCollinearGaps(span, [span, a, b])).toEqual({
      from: { x: 1.2, y: 4 },
      to: { x: 3.5, y: 4 },
    });
  });

  it('ignores disjoint gaps on the same line', () => {
    const far = { from: { x: 0.5, y: 4 }, to: { x: 1.0, y: 4 } };
    expect(mergeCollinearGaps(span, [span, far])).toEqual(span);
  });

  it('ignores gaps on parallel and perpendicular wall lines', () => {
    const parallel = { from: { x: 2.0, y: 6 }, to: { x: 2.9, y: 6 } };
    const perpendicular = { from: { x: 3.0, y: 3.5 }, to: { x: 3.0, y: 4.5 } };
    expect(mergeCollinearGaps(span, [span, parallel, perpendicular])).toEqual(span);
  });

  it('handles vertical walls and preserves span direction', () => {
    const vSpan = { from: { x: 5, y: 3.5 }, to: { x: 5, y: 2.6 } };
    const other = { from: { x: 5, y: 2.9 }, to: { x: 5, y: 2.0 } };
    expect(mergeCollinearGaps(vSpan, [vSpan, other])).toEqual({
      from: { x: 5, y: 3.5 },
      to: { x: 5, y: 2.0 },
    });
  });
});

describe('makeIsoProjection rotations', () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 3.2, y: 1.05 },
    { x: -2, y: 5.5 },
  ];

  it('unprojectFloor inverts project at every rotation', () => {
    for (const rot of [0, 1, 2, 3] as const) {
      const p = makeIsoProjection(rot);
      for (const w of pts) {
        const s = p.project(w.x, w.y);
        const back = p.unprojectFloor(s.x, s.y);
        expect(back.x).toBeCloseTo(w.x, 10);
        expect(back.y).toBeCloseTo(w.y, 10);
      }
    }
  });

  it('rotation 2 mirrors rotation 0 on the floor plane', () => {
    const p0 = makeIsoProjection(0);
    const p2 = makeIsoProjection(2);
    for (const w of pts) {
      const a = p0.project(w.x, w.y);
      const b = p2.project(w.x, w.y);
      expect(b.x).toBeCloseTo(-a.x, 10);
      expect(b.y).toBeCloseTo(-a.y, 10);
    }
  });

  it('the camera ray points at the lifted box from every rotation', () => {
    // a 1×1 box of wall height at the origin; a tap slightly "in front" of it
    // along the ray must hit at every rotation
    const r = { x: 0, y: 0, w: 1, h: 1 };
    for (const rot of [0, 1, 2, 3] as const) {
      const p = makeIsoProjection(rot);
      const t = tapLiftRange(p, WALL_H) / 2;
      const w = { x: 0.5 - t * p.ray.x, y: 0.5 - t * p.ray.y };
      expect(pointInLiftedRect(p, w, r, WALL_H)).toBe(true);
      // and a tap on the far side along the ray must miss
      const back = { x: 0.5 + (1 + t) * p.ray.x, y: 0.5 + (1 + t) * p.ray.y };
      expect(pointInLiftedRect(p, back, r, WALL_H)).toBe(false);
    }
  });

  it('flat projection has a null ray and exact hit testing', () => {
    expect(flatProjection.ray).toEqual({ x: 0, y: 0 });
    expect(pointInLiftedRect(flatProjection, { x: 0.5, y: 0.5 }, { x: 0, y: 0, w: 1, h: 1 }, 2)).toBe(true);
    expect(pointInLiftedRect(flatProjection, { x: 1.5, y: 0.5 }, { x: 0, y: 0, w: 1, h: 1 }, 2)).toBe(false);
  });
});
