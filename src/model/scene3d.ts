// src/model/scene3d.ts
import { polygonEdges } from './cells';
import { wallItemSegment } from './geometry';
import {
  buildWallLines, DOOR_H, insetAgainstWalls, KIND_HEIGHTS, mergeCollinearGaps,
  SILL_H, WALL_H, WALL_T, WINDOW_TOP,
} from './iso';
import type { Furniture, FurnitureKind, Pt, Rect, Room, WallItem } from './types';

/** axis-aligned box: footprint rect (plan coords) lifted z0..z0+height */
export interface Box3D extends Rect {
  z0: number;
  height: number;
}

export interface SceneDoor {
  id: string;
  /** merged wall-gap endpoints — jamb casings live here */
  gapFrom: Pt;
  gapTo: Pt;
  /** hinge corner and swing direction (unit, axis-aligned) of the leaf */
  hinge: Pt;
  inward: Pt;
  length: number;
  height: number;
  selected: boolean;
}

export interface SceneWindow {
  id: string;
  from: Pt;
  to: Pt;
  z0: number;
  z1: number;
  selected: boolean;
}

/** a doorless passage — rendered only as selection feedback */
export interface SceneOpening {
  id: string;
  from: Pt;
  to: Pt;
  selected: boolean;
}

export interface SceneFurniture {
  id: string;
  kind: FurnitureKind;
  name: string;
  /** rendered footprint (inset against flush walls) */
  box: Rect;
  height: number;
  invalid: boolean;
}

export interface Scene3D {
  floors: { room: Room; tiled: boolean }[];
  wallBoxes: Box3D[];
  doors: SceneDoor[];
  windows: SceneWindow[];
  openings: SceneOpening[];
  furniture: SceneFurniture[];
}

export const isTiledRoom = (name: string): boolean =>
  /kitchen|bath|wc|toilet|laundry|utility/i.test(name);

export function buildScene3D(
  rooms: Room[],
  wallItems: WallItem[],
  furniture: Furniture[],
  opts: { selectedWallItemId?: string | null; invalidFurnitureIds?: Set<string> } = {},
): Scene3D {
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const allEdges = rooms.flatMap((r) => polygonEdges(r.polygon).map((e) => ({ a: e.a, b: e.b })));
  const segs = wallItems.flatMap((w) => {
    const room = roomById.get(w.roomId);
    const seg = room ? wallItemSegment(w, room.polygon) : null;
    return seg ? [{ item: w, seg }] : [];
  });
  const allGaps = segs.map(({ seg }) => ({ from: seg.from, to: seg.to }));
  // jambs span connected door openings only — a window touching a door on the
  // same wall line keeps its own opening, the door frame must not swallow it
  const doorGaps = segs
    .filter(({ item }) => item.type === 'door')
    .map(({ seg }) => ({ from: seg.from, to: seg.to }));

  // full-height wall slabs with door/window gaps cut out (reuses tested logic)
  const wallBoxes: Box3D[] = buildWallLines(allEdges, allGaps).map((s) => ({
    ...(s.horizontal
      ? { x: s.from, y: s.line - WALL_T / 2, w: s.to - s.from, h: WALL_T }
      : { x: s.line - WALL_T / 2, y: s.from, w: WALL_T, h: s.to - s.from }),
    z0: 0,
    height: WALL_H,
  }));

  const doors: SceneDoor[] = [];
  const windows: SceneWindow[] = [];
  const openings: SceneOpening[] = [];
  for (const { item, seg } of segs) {
    // sill/head strips span exactly the cut gap so they abut the jamb wall
    // faces instead of overlapping them with coplanar geometry
    const strip = (from: Pt, to: Pt): Rect =>
      from.y === to.y
        ? { x: Math.min(from.x, to.x), y: from.y - WALL_T / 2, w: Math.abs(to.x - from.x), h: WALL_T }
        : { x: from.x - WALL_T / 2, y: Math.min(from.y, to.y), w: WALL_T, h: Math.abs(to.y - from.y) };
    if (item.type === 'window') {
      const r = strip(seg.from, seg.to);
      wallBoxes.push({ ...r, z0: 0, height: Math.min(SILL_H, WALL_H) });
      if (WALL_H > WINDOW_TOP) wallBoxes.push({ ...r, z0: WINDOW_TOP, height: WALL_H - WINDOW_TOP });
      if (WALL_H > SILL_H)
        windows.push({
          id: item.id, from: seg.from, to: seg.to,
          z0: SILL_H, z1: Math.min(WINDOW_TOP, WALL_H),
          selected: opts.selectedWallItemId === item.id,
        });
    } else if (item.type === 'opening') {
      // the gap is already cut from the walls; nothing is built in its place
      openings.push({
        id: item.id, from: seg.from, to: seg.to,
        selected: opts.selectedWallItemId === item.id,
      });
    } else {
      const gap = mergeCollinearGaps({ from: seg.from, to: seg.to }, doorGaps);
      doors.push({
        id: item.id, gapFrom: gap.from, gapTo: gap.to,
        hinge: item.hingeAtEnd ? seg.to : seg.from,
        inward: item.swingOutward ? { x: -seg.inward.x || 0, y: -seg.inward.y || 0 } : seg.inward,
        length: item.length,
        height: Math.min(WALL_H, DOOR_H),
        selected: opts.selectedWallItemId === item.id,
      });
    }
  }

  // a shared wall can carry the same opening once per adjoining room; drop the
  // coincident duplicates (identical boxes/glass z-fight in a z-buffer renderer)
  const boxKeys = new Set<string>();
  const dedupedBoxes = wallBoxes.filter((b) => {
    const key = [b.x, b.y, b.w, b.h, b.z0, b.height].map((n) => n.toFixed(6)).join('_');
    if (boxKeys.has(key)) return false;
    boxKeys.add(key);
    return true;
  });
  const windowByKey = new Map<string, SceneWindow>();
  for (const w of windows) {
    const key = [
      Math.min(w.from.x, w.to.x), Math.min(w.from.y, w.to.y),
      Math.max(w.from.x, w.to.x), Math.max(w.from.y, w.to.y),
      w.z0, w.z1,
    ].map((n) => n.toFixed(6)).join('_');
    const prev = windowByKey.get(key);
    if (!prev || (w.selected && !prev.selected)) windowByKey.set(key, w);
  }

  return {
    floors: rooms.map((room) => ({ room, tiled: isTiledRoom(room.name) })),
    wallBoxes: dedupedBoxes,
    doors,
    windows: [...windowByKey.values()],
    openings,
    furniture: furniture.flatMap((f) => {
      const room = roomById.get(f.roomId);
      if (!room) return [];
      return [{
        id: f.id, kind: f.kind, name: f.name,
        box: insetAgainstWalls(f, polygonEdges(room.polygon)),
        height: KIND_HEIGHTS[f.kind],
        invalid: opts.invalidFurnitureIds?.has(f.id) ?? false,
      }];
    }),
  };
}
