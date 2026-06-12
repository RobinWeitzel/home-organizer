import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject, WheelEvent as ReactWheelEvent } from 'react';
import { GRID, pointInCells, polygonCells, polygonEdges, rectInsideCells, type CellSet, type PolyEdge } from '../model/cells';
import { normalizeRect, snap, wallHitPolygon, wallItemSegment } from '../model/geometry';
import { KIND_HEIGHTS, pointInLiftedRect, tapLiftRange, WALL_H, type Projection } from '../model/iso';
import { KIND_SIZES, MIN_WALL_ITEM_LENGTH, useApp, type Selection } from '../model/store';
import type { Furniture, FurnitureKind, Rect, Room, WallItem } from '../model/types';

export interface View {
  cx: number;
  cy: number;
  scale: number;
}

export type Tool = 'select' | 'room' | 'door' | 'window' | 'furniture';
export type ShapeOp = 'extend' | 'carve';

const TAP_THRESHOLD_PX = 8;
const HANDLE_HIT_PX = 18;
const WALL_TOLERANCE = 0.45;
const MIN_SCALE = 8;
const MAX_SCALE = 300;
const FURNITURE_GRID = 0.25;
const WALL_ITEM_GRID = 0.1;
const DOOR_LENGTH = 0.9;
const WINDOW_LENGTH = 1.2;

interface Pt {
  x: number;
  y: number;
}

type Gesture =
  | { type: 'idle' }
  | { type: 'draw'; startW: Pt; op: ShapeOp | null } // op null = new room
  | { type: 'move-room'; roomId: string; startW: Pt }
  | { type: 'move-furniture'; furnitureId: string; startW: Pt; cells: CellSet }
  | { type: 'resize-furniture'; furnitureId: string; anchor: Pt; cells: CellSet }
  | { type: 'wallitem-slide'; wallItemId: string; edge: PolyEdge; startT: number; startOffset: number }
  | { type: 'wallitem-end'; wallItemId: string; edge: PolyEdge; end: 'start' | 'end' }
  | {
      type: 'edge-drag';
      roomId: string;
      a: Pt;
      b: Pt;
      inward: Pt;
      startW: Pt;
      applied: number;
    }
  | { type: 'pan'; startView: View; startC: Pt }
  | { type: 'pinch'; startView: View; startDist: number; startMidW: Pt };

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function floorRooms(): Room[] {
  const { data, currentFloorId } = useApp.getState();
  return data.rooms.filter((r) => r.floorId === currentFloorId);
}

function floorFurniture(): Furniture[] {
  const rooms = new Set(floorRooms().map((r) => r.id));
  return useApp.getState().data.furniture.filter((f) => rooms.has(f.roomId));
}

function floorWallItems(): WallItem[] {
  const rooms = new Set(floorRooms().map((r) => r.id));
  return useApp.getState().data.wallItems.filter((w) => rooms.has(w.roomId));
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (len2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
  return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

/** try the floor point and points diagonally in front of it, up to the wall-top lift */
function liftedHit(projection: Projection, w: Pt, test: (p: Pt) => boolean): boolean {
  const tMax = tapLiftRange(projection, WALL_H);
  for (let t = 0; t <= tMax + 1e-9; t += 0.1) {
    if (test({ x: w.x + t, y: w.y + t })) return true;
  }
  return false;
}

/** Find a nearby valid spot for a furniture rect inside the room cells. */
function placeRectInCells(rect: Rect, cells: CellSet): Rect | null {
  if (rectInsideCells(rect, cells)) return rect;
  for (let radius = 0.25; radius <= 2; radius += 0.25) {
    for (const [dx, dy] of [
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [radius, radius],
      [-radius, radius],
      [radius, -radius],
      [-radius, -radius],
    ]) {
      const cand = { ...rect, x: rect.x + dx, y: rect.y + dy };
      if (rectInsideCells(cand, cells)) return cand;
    }
  }
  return null;
}

export function usePlanPointer(opts: {
  svgRef: RefObject<SVGSVGElement | null>;
  view: View;
  setView: (v: View) => void;
  projection: Projection;
  tool: Tool;
  furnitureKind: FurnitureKind;
  armedShapeOp: ShapeOp | null;
  onShapeOpDone: (ok: boolean) => void;
  onOpenFurniture: (id: string) => void;
  onMissWall: () => void;
  /** called after a room/door/window/furniture is successfully placed */
  onPlaced?: () => void;
  /** browse mode: pan/zoom only, a tap on furniture opens its detail */
  browse?: boolean;
}) {
  const { svgRef, setView, projection, tool, furnitureKind, armedShapeOp, onShapeOpDone, onOpenFurniture, onMissWall, onPlaced, browse } =
    opts;
  const viewRef = useRef(opts.view);
  viewRef.current = opts.view;

  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture>({ type: 'idle' });
  const downC = useRef<Pt>({ x: 0, y: 0 });
  const moved = useRef(false);
  const lastTap = useRef<{ time: number; furnitureId: string } | null>(null);
  const [ghost, setGhost] = useState<Rect | null>(null);

  const toScreen = (client: Pt): Pt => {
    const svg = svgRef.current;
    const v = viewRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: v.cx + (client.x - rect.left - rect.width / 2) / v.scale,
      y: v.cy + (client.y - rect.top - rect.height / 2) / v.scale,
    };
  };
  const toWorld = (client: Pt): Pt => {
    const s = toScreen(client);
    return projection.unprojectFloor(s.x, s.y);
  };

  const furnitureHandleAt = (w: Pt): { f: Furniture; anchor: Pt } | null => {
    const sel = useApp.getState().selected;
    if (sel?.kind !== 'furniture') return null;
    const f = useApp.getState().data.furniture.find((x) => x.id === sel.id);
    if (!f) return null;
    const hitR = HANDLE_HIT_PX / viewRef.current.scale;
    const corners: [Pt, Pt][] = [
      [{ x: f.x, y: f.y }, { x: f.x + f.w, y: f.y + f.h }],
      [{ x: f.x + f.w, y: f.y }, { x: f.x, y: f.y + f.h }],
      [{ x: f.x, y: f.y + f.h }, { x: f.x + f.w, y: f.y }],
      [{ x: f.x + f.w, y: f.y + f.h }, { x: f.x, y: f.y }],
    ];
    for (const [corner, anchor] of corners) {
      if (dist(w, corner) <= hitR) return { f, anchor };
    }
    return null;
  };

  const roomEdgeHandleAt = (w: Pt): { room: Room; a: Pt; b: Pt; inward: Pt } | null => {
    const sel = useApp.getState().selected;
    if (sel?.kind !== 'room') return null;
    const room = useApp.getState().data.rooms.find((r) => r.id === sel.id);
    if (!room) return null;
    const hitR = HANDLE_HIT_PX / viewRef.current.scale;
    for (const e of polygonEdges(room.polygon)) {
      const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
      if (dist(w, mid) <= hitR) return { room, a: e.a, b: e.b, inward: e.inward };
    }
    return null;
  };

  const edgeT = (e: PolyEdge, w: Pt): number => {
    const dx = Math.sign(e.b.x - e.a.x);
    const dy = Math.sign(e.b.y - e.a.y);
    return Math.min(Math.max(0, (w.x - e.a.x) * dx + (w.y - e.a.y) * dy), e.len);
  };

  const wallItemGestureAt = (w: Pt): Gesture | null => {
    const sel = useApp.getState().selected;
    if (sel?.kind !== 'wallItem') return null;
    const { data } = useApp.getState();
    const item = data.wallItems.find((x) => x.id === sel.id);
    const room = item && data.rooms.find((r) => r.id === item.roomId);
    if (!item || !room) return null;
    const edge = polygonEdges(room.polygon)[item.edge];
    const seg = wallItemSegment(item, room.polygon);
    if (!edge || !seg) return null;
    const hitR = HANDLE_HIT_PX / viewRef.current.scale;
    if (dist(w, seg.from) <= hitR) return { type: 'wallitem-end', wallItemId: item.id, edge, end: 'start' };
    if (dist(w, seg.to) <= hitR) return { type: 'wallitem-end', wallItemId: item.id, edge, end: 'end' };
    if (distToSegment(w, seg.from, seg.to) <= 0.3) {
      return { type: 'wallitem-slide', wallItemId: item.id, edge, startT: edgeT(edge, w), startOffset: item.offset };
    }
    return null;
  };

  const hitTest = (w: Pt): Exclude<Selection, null> | null => {
    const { data } = useApp.getState();
    for (const wi of floorWallItems()) {
      const room = data.rooms.find((r) => r.id === wi.roomId)!;
      const seg = wallItemSegment(wi, room.polygon);
      if (seg && liftedHit(projection, w, (p) => distToSegment(p, seg.from, seg.to) <= 0.35))
        return { kind: 'wallItem', id: wi.id };
    }
    const furn = [...floorFurniture()]
      .reverse()
      .find((f) => pointInLiftedRect(projection, w, f, KIND_HEIGHTS[f.kind]));
    if (furn) return { kind: 'furniture', id: furn.id };
    const room = [...floorRooms()].reverse().find((r) => pointInCells(w.x, w.y, polygonCells(r.polygon)));
    if (room) return { kind: 'room', id: room.id };
    return null;
  };

  const startPinch = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    gesture.current = {
      type: 'pinch',
      startView: viewRef.current,
      startDist: dist(pts[0], pts[1]),
      startMidW: toScreen(mid),
    };
    setGhost(null);
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events have no active pointer */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      startPinch();
      return;
    }
    if (pointers.current.size > 2) return;
    moved.current = false;
    downC.current = { x: e.clientX, y: e.clientY };
    const w = toWorld(downC.current);
    const store = useApp.getState();

    if (browse) {
      gesture.current = { type: 'pan', startView: viewRef.current, startC: downC.current };
      return;
    }
    if (armedShapeOp) {
      gesture.current = { type: 'draw', startW: w, op: armedShapeOp };
      return;
    }
    if (tool === 'room') {
      gesture.current = { type: 'draw', startW: w, op: null };
      return;
    }
    if (tool === 'select') {
      const wallGesture = wallItemGestureAt(w);
      if (wallGesture) {
        gesture.current = wallGesture;
        return;
      }
      const handle = furnitureHandleAt(w);
      if (handle) {
        const room = store.data.rooms.find((r) => r.id === handle.f.roomId);
        gesture.current = {
          type: 'resize-furniture',
          furnitureId: handle.f.id,
          anchor: handle.anchor,
          cells: room ? polygonCells(room.polygon) : new Set(),
        };
        return;
      }
      const edgeHandle = roomEdgeHandleAt(w);
      if (edgeHandle) {
        gesture.current = {
          type: 'edge-drag',
          roomId: edgeHandle.room.id,
          a: edgeHandle.a,
          b: edgeHandle.b,
          inward: edgeHandle.inward,
          startW: w,
          applied: 0,
        };
        return;
      }
      const hit = hitTest(w);
      if (hit?.kind === 'furniture') {
        store.setSelected(hit);
        const f = store.data.furniture.find((x) => x.id === hit.id)!;
        const room = store.data.rooms.find((r) => r.id === f.roomId);
        gesture.current = {
          type: 'move-furniture',
          furnitureId: hit.id,
          startW: w,
          cells: room ? polygonCells(room.polygon) : new Set(),
        };
        return;
      }
      if (hit?.kind === 'room') {
        store.setSelected(hit);
        gesture.current = { type: 'move-room', roomId: hit.id, startW: w };
        return;
      }
      gesture.current = { type: 'pan', startView: viewRef.current, startC: downC.current };
      return;
    }
    // door / window / furniture act on tap; allow panning meanwhile
    gesture.current = { type: 'pan', startView: viewRef.current, startC: downC.current };
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (g.type === 'pinch') {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const d = dist(pts[0], pts[1]);
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (g.startView.scale * d) / g.startDist));
      setView({
        scale,
        cx: g.startMidW.x - (mid.x - rect.left - rect.width / 2) / scale,
        cy: g.startMidW.y - (mid.y - rect.top - rect.height / 2) / scale,
      });
      return;
    }

    const c = { x: e.clientX, y: e.clientY };
    if (dist(c, downC.current) > TAP_THRESHOLD_PX) moved.current = true;
    const w = toWorld(c);
    const store = useApp.getState();

    if (g.type === 'pan') {
      setView({
        ...g.startView,
        cx: g.startView.cx - (c.x - g.startC.x) / g.startView.scale,
        cy: g.startView.cy - (c.y - g.startC.y) / g.startView.scale,
      });
      return;
    }
    if (g.type === 'draw') {
      if (!moved.current) return;
      setGhost(
        normalizeRect(snap(g.startW.x, GRID), snap(g.startW.y, GRID), snap(w.x, GRID), snap(w.y, GRID), GRID),
      );
      return;
    }
    if (g.type === 'move-room' && moved.current) {
      const dx = snap(w.x - g.startW.x, GRID);
      const dy = snap(w.y - g.startW.y, GRID);
      if ((dx !== 0 || dy !== 0) && store.moveRoom(g.roomId, dx, dy)) {
        gesture.current = { ...g, startW: { x: g.startW.x + dx, y: g.startW.y + dy } };
      }
      return;
    }
    if (g.type === 'move-furniture' && moved.current) {
      const f = store.data.furniture.find((x) => x.id === g.furnitureId);
      if (!f) return;
      const target = {
        x: snap(f.x + (w.x - g.startW.x), FURNITURE_GRID),
        y: snap(f.y + (w.y - g.startW.y), FURNITURE_GRID),
        w: f.w,
        h: f.h,
      };
      if ((target.x !== f.x || target.y !== f.y) && rectInsideCells(target, g.cells)) {
        store.updateFurniture(g.furnitureId, { x: target.x, y: target.y });
        gesture.current = { ...g, startW: { x: g.startW.x + (target.x - f.x), y: g.startW.y + (target.y - f.y) } };
      }
      return;
    }
    if (g.type === 'resize-furniture' && moved.current) {
      const rect = normalizeRect(
        snap(g.anchor.x, FURNITURE_GRID),
        snap(g.anchor.y, FURNITURE_GRID),
        snap(w.x, FURNITURE_GRID),
        snap(w.y, FURNITURE_GRID),
        FURNITURE_GRID,
      );
      if (rectInsideCells(rect, g.cells)) store.updateFurniture(g.furnitureId, rect);
      return;
    }
    if (g.type === 'wallitem-slide' && moved.current) {
      const t = edgeT(g.edge, w);
      store.updateWallItem(g.wallItemId, { offset: snap(g.startOffset + (t - g.startT), WALL_ITEM_GRID) });
      return;
    }
    if (g.type === 'wallitem-end' && moved.current) {
      const item = store.data.wallItems.find((x) => x.id === g.wallItemId);
      if (!item) return;
      const t = snap(edgeT(g.edge, w), WALL_ITEM_GRID);
      if (g.end === 'start') {
        const endPos = item.offset + item.length;
        const offset = Math.max(0, Math.min(t, endPos - MIN_WALL_ITEM_LENGTH));
        store.updateWallItem(g.wallItemId, { offset, length: endPos - offset });
      } else {
        store.updateWallItem(g.wallItemId, { length: Math.max(MIN_WALL_ITEM_LENGTH, t - item.offset) });
      }
      return;
    }
    if (g.type === 'edge-drag' && moved.current) {
      // outward displacement of the pointer relative to the drag start,
      // applied one grid-step strip at a time
      const outward = { x: -g.inward.x, y: -g.inward.y };
      const d = (w.x - g.startW.x) * outward.x + (w.y - g.startW.y) * outward.y;
      const state = { a: g.a, b: g.b, applied: g.applied };
      let steps = Math.round(d / GRID) - state.applied;
      while (steps !== 0) {
        const dir = Math.sign(steps);
        const grow = dir > 0; // outward strip = extend, inward strip = carve
        const horizontal = state.a.y === state.b.y;
        const lo = horizontal ? Math.min(state.a.x, state.b.x) : Math.min(state.a.y, state.b.y);
        const span = horizontal ? Math.abs(state.b.x - state.a.x) : Math.abs(state.b.y - state.a.y);
        const stripDir = grow ? outward : g.inward;
        const line = horizontal ? state.a.y : state.a.x;
        const stripLine = line + (stripDir.x < 0 || stripDir.y < 0 ? -GRID : 0);
        const rect: Rect = horizontal
          ? { x: lo, y: stripLine, w: span, h: GRID }
          : { x: stripLine, y: lo, w: GRID, h: span };
        if (!store.applyRoomShape(g.roomId, grow ? 'extend' : 'carve', rect)) break;
        state.a = { x: state.a.x + stripDir.x * GRID, y: state.a.y + stripDir.y * GRID };
        state.b = { x: state.b.x + stripDir.x * GRID, y: state.b.y + stripDir.y * GRID };
        state.applied += dir;
        steps -= dir;
      }
      gesture.current = { ...g, ...state };
    }
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.type === 'pinch') {
      if (pointers.current.size < 2) gesture.current = { type: 'idle' };
      return;
    }
    gesture.current = { type: 'idle' };
    const store = useApp.getState();
    const w = toWorld({ x: e.clientX, y: e.clientY });

    if (g.type === 'draw') {
      const rect = ghost;
      setGhost(null);
      if (!moved.current || !rect) {
        if (g.op) onShapeOpDone(false);
        return;
      }
      if (g.op) {
        const sel = store.selected;
        const ok = sel?.kind === 'room' ? store.applyRoomShape(sel.id, g.op, rect) : false;
        onShapeOpDone(ok);
      } else if (store.currentFloorId) {
        store.addRoomRect(store.currentFloorId, rect);
        onPlaced?.();
      }
      return;
    }

    if (moved.current) return; // drag gestures already applied

    // taps
    if (browse) {
      // furniture only — door/window bands must not eat taps on wall-adjacent
      // pieces, and rooms aren't interactive here; small inset for fat fingers
      const pad = 0.08;
      const furn = [...floorFurniture()]
        .reverse()
        .find((f) =>
          pointInLiftedRect(
            projection,
            w,
            { x: f.x - pad, y: f.y - pad, w: f.w + 2 * pad, h: f.h + 2 * pad },
            KIND_HEIGHTS[f.kind],
          ),
        );
      if (furn) onOpenFurniture(furn.id);
      return;
    }
    if (tool === 'select') {
      const hit = hitTest(w);
      store.setSelected(hit);
      if (hit?.kind === 'furniture') {
        const now = performance.now();
        if (lastTap.current && lastTap.current.furnitureId === hit.id && now - lastTap.current.time < 350) {
          onOpenFurniture(hit.id);
          lastTap.current = null;
        } else {
          lastTap.current = { time: now, furnitureId: hit.id };
        }
      }
      return;
    }
    if (tool === 'door' || tool === 'window') {
      const length = tool === 'door' ? DOOR_LENGTH : WINDOW_LENGTH;
      for (const room of floorRooms()) {
        let hit: { edge: number; offset: number } | null = null;
        liftedHit(projection, w, (p) => {
          hit = wallHitPolygon(room.polygon, p.x, p.y, WALL_TOLERANCE);
          return hit !== null;
        });
        if (hit) {
          const { edge, offset } = hit as { edge: number; offset: number };
          store.addWallItem(room.id, tool, edge, snap(offset - length / 2, WALL_ITEM_GRID), length);
          const placed = useApp.getState().data.wallItems.at(-1);
          if (placed) useApp.getState().setSelected({ kind: 'wallItem', id: placed.id });
          onPlaced?.();
          return;
        }
      }
      onMissWall();
      return;
    }
    if (tool === 'furniture') {
      const room = [...floorRooms()].reverse().find((r) => pointInCells(w.x, w.y, polygonCells(r.polygon)));
      if (room) {
        const cells = polygonCells(room.polygon);
        const size = KIND_SIZES[furnitureKind];
        const at = (sw: number, sh: number) => ({
          x: snap(w.x - sw / 2, FURNITURE_GRID),
          y: snap(w.y - sh / 2, FURNITURE_GRID),
          w: sw,
          h: sh,
        });
        const rect =
          placeRectInCells(at(size.w, size.h), cells) ?? placeRectInCells(at(0.5, 0.5), cells);
        if (!rect) return;
        store.addFurniture(room.id, furnitureKind, rect);
        const placed = useApp.getState().data.furniture.at(-1);
        if (placed) useApp.getState().setSelected({ kind: 'furniture', id: placed.id });
        onPlaced?.();
      }
    }
  };

  const onPointerCancel = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    gesture.current = { type: 'idle' };
    setGhost(null);
  };

  const onWheel = (e: ReactWheelEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const v = viewRef.current;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * Math.exp(-e.deltaY * 0.002)));
    const wx = v.cx + (e.clientX - rect.left - rect.width / 2) / v.scale;
    const wy = v.cy + (e.clientY - rect.top - rect.height / 2) / v.scale;
    setView({
      scale,
      cx: wx - (e.clientX - rect.left - rect.width / 2) / scale,
      cy: wy - (e.clientY - rect.top - rect.height / 2) / scale,
    });
  };

  return { ghost, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onWheel } };
}
