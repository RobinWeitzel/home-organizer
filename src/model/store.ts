import { create } from 'zustand';
import { newId } from './ids';
import {
  hasHole,
  isConnected,
  polygonCells,
  polygonEdges,
  rectCells,
  subtract,
  traceOutline,
  union,
  type CellSet,
} from './cells';
import { clampWallOffset, wallItemSegment } from './geometry';
import { groupAreas, normalizeAreas } from './areaLayout';
import type { AreaPlacement } from './frontLayout';
import type {
  AppData,
  Floor,
  Furniture,
  FurnitureKind,
  Item,
  Pt,
  Rect,
  Room,
  StorageArea,
  WallItem,
} from './types';
import { emptyData } from './types';

export type Tab = 'plan' | 'items' | 'settings';

export type Selection =
  | { kind: 'room'; id: string }
  | { kind: 'furniture'; id: string }
  | { kind: 'wallItem'; id: string }
  | null;

export interface ItemLocation {
  floor: Floor;
  room: Room;
  furniture: Furniture;
  area: StorageArea;
}

const DEFAULT_AREAS: Record<FurnitureKind, { prefix: string; count: number }> = {
  shelf: { prefix: 'Shelf', count: 3 },
  dresser: { prefix: 'Drawer', count: 3 },
  wardrobe: { prefix: 'Section', count: 2 },
  cabinet: { prefix: 'Shelf', count: 2 },
  chest: { prefix: 'Inside', count: 1 },
  other: { prefix: 'Area', count: 1 },
};

export const KIND_LABELS: Record<FurnitureKind, string> = {
  shelf: 'Shelf',
  dresser: 'Dresser',
  wardrobe: 'Wardrobe',
  cabinet: 'Cabinet',
  chest: 'Chest',
  other: 'Storage',
};

/** Real-world spawn footprints in metres. */
export const KIND_SIZES: Record<FurnitureKind, { w: number; h: number }> = {
  shelf: { w: 0.8, h: 0.3 },
  dresser: { w: 1, h: 0.5 },
  wardrobe: { w: 1.2, h: 0.6 },
  cabinet: { w: 0.8, h: 0.4 },
  chest: { w: 0.9, h: 0.5 },
  other: { w: 1, h: 0.5 },
};

export const MIN_WALL_ITEM_LENGTH = 0.3;

interface AppState {
  data: AppData;
  history: AppData[];
  future: AppData[];
  currentFloorId: string | null;
  activeTab: Tab;
  selected: Selection;
  /** the plan is browse-first; editing tools only appear when this is on */
  planEditing: boolean;
  openFurnitureId: string | null;
  highlightFurnitureId: string | null;
  highlightAreaId: string | null;
  highlightItemId: string | null;
  /** bumped on every reveal so the plan re-centers even on the same furniture */
  highlightNonce: number;
  persistenceError: boolean;

  setTab: (tab: Tab) => void;
  setSelected: (sel: Selection) => void;
  setPlanEditing: (v: boolean) => void;
  setOpenFurniture: (id: string | null) => void;
  setCurrentFloor: (id: string) => void;
  /** jump to the plan, highlight the furniture holding the item and open its detail */
  revealItem: (itemId: string) => void;
  /** like revealItem, but for a whole furniture piece (no area focus) */
  revealFurniture: (furnitureId: string) => void;
  clearHighlight: () => void;
  setPersistenceError: (v: boolean) => void;

  /** Replace data without history (initial load). */
  loadData: (data: AppData) => void;
  /** Replace data, undoable (import, erase). */
  replaceData: (data: AppData) => void;
  /** Replace data from a remote sync, undoable; keeps the current view where possible. */
  applyExternalData: (data: AppData) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  addFloor: (name: string) => void;
  renameFloor: (id: string, name: string) => void;
  deleteFloor: (id: string) => void;

  addRoomRect: (floorId: string, rect: Rect) => void;
  applyRoomShape: (id: string, op: 'extend' | 'carve', rect: Rect) => boolean;
  moveRoom: (id: string, dx: number, dy: number) => boolean;
  renameRoom: (id: string, name: string) => void;
  deleteRoom: (id: string) => void;
  roomCells: (id: string) => CellSet;

  addWallItem: (roomId: string, type: WallItem['type'], edge: number, offset: number, length: number) => void;
  updateWallItem: (id: string, patch: Partial<Pick<WallItem, 'offset' | 'length'>>) => void;
  deleteWallItem: (id: string) => void;

  addFurniture: (roomId: string, kind: FurnitureKind, rect: Rect) => void;
  updateFurniture: (id: string, patch: Partial<Pick<Furniture, 'name' | 'x' | 'y' | 'w' | 'h'>>) => void;
  deleteFurniture: (id: string) => void;

  addArea: (furnitureId: string, name: string) => void;
  renameArea: (id: string, name: string) => void;
  deleteArea: (id: string) => void;
  /** Drop an area at an explicit spot in its furniture's layout grid. */
  placeArea: (id: string, placement: AreaPlacement) => void;

  addItem: (areaId: string, name: string, quantity?: number, notes?: string) => void;
  updateItem: (id: string, patch: Partial<Pick<Item, 'name' | 'quantity' | 'notes' | 'areaId'>>) => void;
  deleteItem: (id: string) => void;

  locateItem: (itemId: string) => ItemLocation | null;
  countItemsInFurniture: (furnitureId: string) => number;
  countItemsInRoom: (roomId: string) => number;
  countItemsInFloor: (floorId: string) => number;
}

/** Apply a normalization patch (id → group/order) computed from the new array. */
function applyAreaPatch(
  areas: StorageArea[],
  makePatch: (areas: StorageArea[]) => Map<string, { group: number; order: number }>,
): StorageArea[] {
  const patch = makePatch(areas);
  return patch.size ? areas.map((a) => (patch.has(a.id) ? { ...a, ...patch.get(a.id)! } : a)) : areas;
}

function removeRooms(data: AppData, roomIds: Set<string>): AppData {
  const furnitureIds = new Set(data.furniture.filter((f) => roomIds.has(f.roomId)).map((f) => f.id));
  const areaIds = new Set(data.areas.filter((a) => furnitureIds.has(a.furnitureId)).map((a) => a.id));
  return {
    ...data,
    rooms: data.rooms.filter((r) => !roomIds.has(r.id)),
    wallItems: data.wallItems.filter((w) => !roomIds.has(w.roomId)),
    furniture: data.furniture.filter((f) => !furnitureIds.has(f.id)),
    areas: data.areas.filter((a) => !areaIds.has(a.id)),
    items: data.items.filter((i) => !areaIds.has(i.areaId)),
  };
}

function removeFurniture(data: AppData, furnitureIds: Set<string>): AppData {
  const areaIds = new Set(data.areas.filter((a) => furnitureIds.has(a.furnitureId)).map((a) => a.id));
  return {
    ...data,
    furniture: data.furniture.filter((f) => !furnitureIds.has(f.id)),
    areas: data.areas.filter((a) => !areaIds.has(a.id)),
    items: data.items.filter((i) => !areaIds.has(i.areaId)),
  };
}

/** Union of cells of all rooms on the floor except one. */
function neighbourCells(data: AppData, floorId: string, exceptRoomId?: string): CellSet {
  let cells: CellSet = new Set();
  for (const r of data.rooms) {
    if (r.floorId !== floorId || r.id === exceptRoomId) continue;
    cells = union(cells, polygonCells(r.polygon));
  }
  return cells;
}

function isValidShape(cells: CellSet): boolean {
  return cells.size > 0 && isConnected(cells) && !hasHole(cells);
}

/**
 * Re-home wall items after a room shape change: an item survives if a new edge
 * with the same orientation, line and inward normal fully contains its old
 * segment; otherwise it is dropped.
 */
function reattachWallItems(items: WallItem[], roomId: string, oldPoly: Pt[], newPoly: Pt[]): WallItem[] {
  const newEdges = polygonEdges(newPoly);
  return items.flatMap((w) => {
    if (w.roomId !== roomId) return [w];
    const seg = wallItemSegment(w, oldPoly);
    if (!seg) return [];
    for (let i = 0; i < newEdges.length; i++) {
      const e = newEdges[i];
      if (e.inward.x !== seg.inward.x || e.inward.y !== seg.inward.y) continue;
      const horizontal = e.a.y === e.b.y;
      const [sLo, sHi] = horizontal
        ? [Math.min(seg.from.x, seg.to.x), Math.max(seg.from.x, seg.to.x)]
        : [Math.min(seg.from.y, seg.to.y), Math.max(seg.from.y, seg.to.y)];
      const line = horizontal ? seg.from.y : seg.from.x;
      const eLine = horizontal ? e.a.y : e.a.x;
      if (line !== eLine) continue;
      const [eLo, eHi] = horizontal
        ? [Math.min(e.a.x, e.b.x), Math.max(e.a.x, e.b.x)]
        : [Math.min(e.a.y, e.b.y), Math.max(e.a.y, e.b.y)];
      if (sLo < eLo || sHi > eHi) continue;
      const forward = horizontal ? e.b.x > e.a.x : e.b.y > e.a.y;
      const offset = forward ? sLo - eLo : eHi - sHi;
      return [{ ...w, edge: i, offset }];
    }
    return [];
  });
}

const HISTORY_CAP = 50;

export const useApp = create<AppState>()((set, get) => {
  // coalescing: rapid commits with the same key collapse into one undo step
  let lastKey: string | null = null;
  let lastTime = 0;

  const commit = (next: AppData, extra: Partial<AppState> = {}, key?: string) => {
    const now = Date.now();
    const { data, history } = get();
    const coalesce = key !== undefined && key === lastKey && now - lastTime < 1500;
    lastKey = key ?? null;
    lastTime = now;
    set({
      data: next,
      history: coalesce ? history : [...history.slice(-(HISTORY_CAP - 1)), data],
      future: [],
      ...extra,
    });
  };
  const update = (fn: (data: AppData) => AppData, key?: string) => commit(fn(get().data), {}, key);

  /** UI state that must stay consistent with restored data. */
  const sanitizedUi = (data: AppData): Partial<AppState> => {
    const state = get();
    const floors = [...data.floors].sort((a, b) => a.order - b.order);
    const floorOk = state.currentFloorId && data.floors.some((f) => f.id === state.currentFloorId);
    return {
      currentFloorId: floorOk ? state.currentFloorId : (floors[0]?.id ?? null),
      // editing an empty home makes no sense — undo back past the first floor exits it
      planEditing: data.floors.length > 0 ? state.planEditing : false,
      selected: null,
      openFurnitureId:
        state.openFurnitureId && data.furniture.some((f) => f.id === state.openFurnitureId)
          ? state.openFurnitureId
          : null,
      highlightFurnitureId: null,
      highlightAreaId: null,
      highlightItemId: null,
    };
  };

  return {
    data: emptyData(),
    history: [],
    future: [],
    currentFloorId: null,
    activeTab: 'plan',
    selected: null,
    planEditing: false,
    openFurnitureId: null,
    highlightFurnitureId: null,
    highlightAreaId: null,
    highlightItemId: null,
    highlightNonce: 0,
    persistenceError: false,

    setTab: (activeTab) => set({ activeTab }),
    setSelected: (selected) => set({ selected }),
    setPlanEditing: (planEditing) =>
      set(planEditing ? { planEditing } : { planEditing, selected: null }),
    setOpenFurniture: (id) =>
      set(
        id
          ? // a manual open must not inherit a stale search highlight
            {
              openFurnitureId: id,
              highlightFurnitureId: null,
              highlightAreaId: null,
              highlightItemId: null,
            }
          : {
              openFurnitureId: null,
              highlightFurnitureId: null,
              highlightAreaId: null,
              highlightItemId: null,
            },
      ),
    setCurrentFloor: (id) => set({ currentFloorId: id, selected: null }),
    revealItem: (itemId) => {
      const loc = get().locateItem(itemId);
      if (!loc) return;
      set({
        activeTab: 'plan',
        planEditing: false,
        currentFloorId: loc.floor.id,
        selected: null,
        openFurnitureId: loc.furniture.id,
        highlightFurnitureId: loc.furniture.id,
        highlightAreaId: loc.area.id,
        highlightItemId: itemId,
        highlightNonce: get().highlightNonce + 1,
      });
    },
    revealFurniture: (furnitureId) => {
      const { data } = get();
      const furniture = data.furniture.find((f) => f.id === furnitureId);
      const room = furniture && data.rooms.find((r) => r.id === furniture.roomId);
      if (!room) return;
      set({
        activeTab: 'plan',
        planEditing: false,
        currentFloorId: room.floorId,
        selected: null,
        openFurnitureId: furnitureId,
        highlightFurnitureId: furnitureId,
        highlightAreaId: null,
        highlightItemId: null,
        highlightNonce: get().highlightNonce + 1,
      });
    },
    clearHighlight: () =>
      set({ highlightFurnitureId: null, highlightAreaId: null, highlightItemId: null }),
    setPersistenceError: (persistenceError) => set({ persistenceError }),

    loadData: (data) => {
      lastKey = null;
      set({
        data,
        history: [],
        future: [],
        currentFloorId: data.floors.length ? [...data.floors].sort((a, b) => a.order - b.order)[0].id : null,
        selected: null,
        openFurnitureId: null,
        highlightFurnitureId: null,
        highlightAreaId: null,
        highlightItemId: null,
      });
    },
    replaceData: (data) =>
      commit(data, {
        currentFloorId: data.floors.length ? [...data.floors].sort((a, b) => a.order - b.order)[0].id : null,
        planEditing: data.floors.length > 0 ? get().planEditing : false,
        selected: null,
        openFurnitureId: null,
        highlightFurnitureId: null,
        highlightAreaId: null,
        highlightItemId: null,
      }),
    applyExternalData: (data) => commit(data, sanitizedUi(data)),

    undo: () => {
      const { history, future, data } = get();
      if (!history.length) return;
      const prev = history[history.length - 1];
      lastKey = null;
      set({
        data: prev,
        history: history.slice(0, -1),
        future: [...future, data],
      });
      set(sanitizedUi(prev));
    },
    redo: () => {
      const { history, future, data } = get();
      if (!future.length) return;
      const next = future[future.length - 1];
      lastKey = null;
      set({
        data: next,
        history: [...history, data],
        future: future.slice(0, -1),
      });
      set(sanitizedUi(next));
    },
    canUndo: () => get().history.length > 0,
    canRedo: () => get().future.length > 0,

    addFloor: (name) => {
      const floor: Floor = { id: newId(), name, order: get().data.floors.length };
      commit({ ...get().data, floors: [...get().data.floors, floor] }, { currentFloorId: floor.id });
    },
    renameFloor: (id, name) =>
      update((d) => ({ ...d, floors: d.floors.map((f) => (f.id === id ? { ...f, name } : f)) }), `floor:${id}`),
    deleteFloor: (id) => {
      const d = get().data;
      const roomIds = new Set(d.rooms.filter((r) => r.floorId === id).map((r) => r.id));
      const next = removeRooms(d, roomIds);
      const floors = next.floors.filter((f) => f.id !== id).map((f, i) => ({ ...f, order: i }));
      commit(
        { ...next, floors },
        {
          currentFloorId:
            get().currentFloorId === id ? (floors.length ? floors[0].id : null) : get().currentFloorId,
          selected: null,
        },
      );
    },

    addRoomRect: (floorId, rect) => {
      const d = get().data;
      const cells = subtract(rectCells(rect), neighbourCells(d, floorId));
      if (!isValidShape(cells)) return;
      const count = d.rooms.filter((r) => r.floorId === floorId).length;
      const room: Room = { id: newId(), floorId, name: `Room ${count + 1}`, polygon: traceOutline(cells) };
      update((data) => ({ ...data, rooms: [...data.rooms, room] }));
    },

    applyRoomShape: (id, op, rect) => {
      const d = get().data;
      const room = d.rooms.find((r) => r.id === id);
      if (!room) return false;
      const current = polygonCells(room.polygon);
      const patch =
        op === 'extend'
          ? subtract(rectCells(rect), neighbourCells(d, room.floorId, id))
          : rectCells(rect);
      const next = op === 'extend' ? union(current, patch) : subtract(current, patch);
      if (!isValidShape(next)) return false;
      if (next.size === current.size && op === 'extend' && patch.size === 0) return false;
      const polygon = traceOutline(next);
      update(
        (data) => ({
          ...data,
          rooms: data.rooms.map((r) => (r.id === id ? { ...r, polygon } : r)),
          wallItems: reattachWallItems(data.wallItems, id, room.polygon, polygon),
        }),
        `shape:${id}`,
      );
      return true;
    },

    moveRoom: (id, dx, dy) => {
      const d = get().data;
      const room = d.rooms.find((r) => r.id === id);
      if (!room || (dx === 0 && dy === 0)) return false;
      const polygon = room.polygon.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      const cells = polygonCells(polygon);
      const others = neighbourCells(d, room.floorId, id);
      for (const c of cells) if (others.has(c)) return false;
      update(
        (data) => ({
          ...data,
          rooms: data.rooms.map((r) => (r.id === id ? { ...r, polygon } : r)),
          furniture: data.furniture.map((f) => (f.roomId === id ? { ...f, x: f.x + dx, y: f.y + dy } : f)),
        }),
        `moveRoom:${id}`,
      );
      return true;
    },

    renameRoom: (id, name) =>
      update((d) => ({ ...d, rooms: d.rooms.map((r) => (r.id === id ? { ...r, name } : r)) }), `room:${id}`),
    deleteRoom: (id) => {
      update((d) => removeRooms(d, new Set([id])));
      set({ selected: null });
    },
    roomCells: (id) => {
      const room = get().data.rooms.find((r) => r.id === id);
      return room ? polygonCells(room.polygon) : new Set();
    },

    addWallItem: (roomId, type, edge, offset, length) => {
      const room = get().data.rooms.find((r) => r.id === roomId);
      const e = room && polygonEdges(room.polygon)[edge];
      if (!e) return;
      const len = Math.min(length, e.len);
      const wallItem: WallItem = {
        id: newId(),
        roomId,
        type,
        edge,
        length: len,
        offset: clampWallOffset(e.len, offset, len),
      };
      update((d) => ({ ...d, wallItems: [...d.wallItems, wallItem] }));
    },
    updateWallItem: (id, patch) =>
      update((d) => {
        const item = d.wallItems.find((w) => w.id === id);
        const room = item && d.rooms.find((r) => r.id === item.roomId);
        const e = room && polygonEdges(room.polygon)[item.edge];
        if (!item || !e) return d;
        const length = Math.min(Math.max(MIN_WALL_ITEM_LENGTH, patch.length ?? item.length), e.len);
        const offset = clampWallOffset(e.len, patch.offset ?? item.offset, length);
        return {
          ...d,
          wallItems: d.wallItems.map((w) => (w.id === id ? { ...w, offset, length } : w)),
        };
      }, `wall:${id}`),
    deleteWallItem: (id) => {
      update((d) => ({ ...d, wallItems: d.wallItems.filter((w) => w.id !== id) }));
      set({ selected: null });
    },

    addFurniture: (roomId, kind, rect) => {
      const id = newId();
      const count = get().data.furniture.filter((f) => f.roomId === roomId).length;
      const furniture: Furniture = { id, roomId, kind, name: `${KIND_LABELS[kind]} ${count + 1}`, ...rect };
      const spec = DEFAULT_AREAS[kind];
      const areas: StorageArea[] = Array.from({ length: spec.count }, (_, i) => ({
        id: newId(),
        furnitureId: id,
        name: spec.count === 1 ? spec.prefix : `${spec.prefix} ${i + 1}`,
        group: i,
        order: 0,
      }));
      update((d) => ({ ...d, furniture: [...d.furniture, furniture], areas: [...d.areas, ...areas] }));
    },
    updateFurniture: (id, patch) =>
      update(
        (d) => ({ ...d, furniture: d.furniture.map((f) => (f.id === id ? { ...f, ...patch } : f)) }),
        `furniture:${id}`,
      ),
    deleteFurniture: (id) => {
      update((d) => removeFurniture(d, new Set([id])));
      set({ selected: null, openFurnitureId: null });
    },

    addArea: (furnitureId, name) => {
      const groups = groupAreas(get().data.areas.filter((a) => a.furnitureId === furnitureId));
      const area: StorageArea = { id: newId(), furnitureId, name, group: groups.length, order: 0 };
      update((d) => ({ ...d, areas: [...d.areas, area] }));
    },
    renameArea: (id, name) =>
      update((d) => ({ ...d, areas: d.areas.map((a) => (a.id === id ? { ...a, name } : a)) }), `area:${id}`),
    deleteArea: (id) =>
      update((d) => {
        const area = d.areas.find((a) => a.id === id);
        if (!area) return d;
        const areas = applyAreaPatch(
          d.areas.filter((a) => a.id !== id),
          (rest) => normalizeAreas(rest.filter((a) => a.furnitureId === area.furnitureId)),
        );
        return { ...d, areas, items: d.items.filter((i) => i.areaId !== id) };
      }),
    placeArea: (id, placement) =>
      update((d) => {
        const area = d.areas.find((a) => a.id === id);
        if (!area) return d;
        // rebuild the furniture's grid: lift the area out (keeping empty
        // bands in place so the placement's indices still line up), drop it
        // in, then renumber
        const groups = groupAreas(d.areas.filter((a) => a.furnitureId === area.furnitureId)).map(
          (g) => g.filter((a) => a.id !== id),
        );
        if ('newGroupIndex' in placement) {
          const k = Math.max(0, Math.min(placement.newGroupIndex, groups.length));
          groups.splice(k, 0, [area]);
        } else {
          const members = groups[placement.group];
          if (!members) return d;
          members.splice(Math.max(0, Math.min(placement.index, members.length)), 0, area);
        }
        const patch = new Map<string, { group: number; order: number }>();
        let gi = 0;
        for (const members of groups) {
          if (!members.length) continue;
          for (const [oi, a] of members.entries()) {
            if (a.group !== gi || a.order !== oi) patch.set(a.id, { group: gi, order: oi });
          }
          gi++;
        }
        if (!patch.size) return d;
        return {
          ...d,
          areas: d.areas.map((a) => (patch.has(a.id) ? { ...a, ...patch.get(a.id)! } : a)),
        };
      }),

    addItem: (areaId, name, quantity = 1, notes = '') => {
      const item: Item = { id: newId(), areaId, name, quantity, notes };
      update((d) => ({ ...d, items: [...d.items, item] }));
    },
    updateItem: (id, patch) =>
      update((d) => {
        const safe = { ...patch };
        if (safe.areaId !== undefined && !d.areas.some((a) => a.id === safe.areaId)) {
          delete safe.areaId;
        }
        return { ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...safe } : i)) };
      }, `item:${id}`),
    deleteItem: (id) => update((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) })),

    locateItem: (itemId) => {
      const { data } = get();
      const item = data.items.find((i) => i.id === itemId);
      const area = item && data.areas.find((a) => a.id === item.areaId);
      const furniture = area && data.furniture.find((f) => f.id === area.furnitureId);
      const room = furniture && data.rooms.find((r) => r.id === furniture.roomId);
      const floor = room && data.floors.find((f) => f.id === room.floorId);
      if (!area || !furniture || !room || !floor) return null;
      return { floor, room, furniture, area };
    },
    countItemsInFurniture: (furnitureId) => {
      const { data } = get();
      const areaIds = new Set(data.areas.filter((a) => a.furnitureId === furnitureId).map((a) => a.id));
      return data.items.filter((i) => areaIds.has(i.areaId)).length;
    },
    countItemsInRoom: (roomId) => {
      const { data } = get();
      return data.furniture
        .filter((f) => f.roomId === roomId)
        .reduce((sum, f) => sum + get().countItemsInFurniture(f.id), 0);
    },
    countItemsInFloor: (floorId) => {
      const { data } = get();
      return data.rooms
        .filter((r) => r.floorId === floorId)
        .reduce((sum, r) => sum + get().countItemsInRoom(r.id), 0);
    },
  };
});
