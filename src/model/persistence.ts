import type { AppData, Pt, Room, StorageArea, WallItem } from './types';
import { emptyData } from './types';

export const STORAGE_KEY = 'home-organizer/v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type ValidationResult = { ok: true; data: AppData } | { ok: false; error: string };

const ARRAY_KEYS = ['floors', 'rooms', 'wallItems', 'furniture', 'areas', 'items'] as const;

interface RoomV1 {
  id: string;
  floorId: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface WallItemV1 {
  id: string;
  roomId: string;
  type: 'door' | 'window';
  side: 'N' | 'E' | 'S' | 'W';
  offset: number;
  length: number;
}

export function rectPolygon(x: number, y: number, w: number, h: number): Pt[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

/** v1 rooms were rects; sides map to the rect polygon's edges 0–3. S and W run reversed. */
function migrateV1(obj: Record<string, unknown>): Record<string, unknown> {
  const roomsV1 = obj.rooms as RoomV1[];
  const rooms: Room[] = roomsV1.map((r) => ({
    id: r.id,
    floorId: r.floorId,
    name: r.name,
    polygon: rectPolygon(r.x, r.y, r.w, r.h),
  }));
  const byId = new Map(roomsV1.map((r) => [r.id, r]));
  const wallItems: WallItem[] = (obj.wallItems as WallItemV1[]).flatMap((w) => {
    const room = byId.get(w.roomId);
    if (!room) return [];
    const edge = { N: 0, E: 1, S: 2, W: 3 }[w.side];
    const edgeLen = w.side === 'N' || w.side === 'S' ? room.w : room.h;
    const length = Math.min(w.length, edgeLen);
    const offset =
      w.side === 'S' || w.side === 'W'
        ? edgeLen - w.offset - length
        : w.offset;
    return [
      {
        id: w.id,
        roomId: w.roomId,
        type: w.type,
        edge,
        offset: Math.min(Math.max(0, offset), edgeLen - length),
        length,
      },
    ];
  });
  return { ...obj, schemaVersion: 2, rooms, wallItems };
}

interface AreaV2 {
  id: string;
  furnitureId: string;
  name: string;
  order: number;
}

/**
 * v2 areas had only a flat order; each becomes its own group so the layout
 * looks exactly as before (stacked rows, or side-by-side wardrobe columns).
 */
function migrateV2(obj: Record<string, unknown>): Record<string, unknown> {
  const byFurniture = new Map<string, AreaV2[]>();
  for (const a of obj.areas as AreaV2[]) {
    const list = byFurniture.get(a.furnitureId) ?? [];
    list.push(a);
    byFurniture.set(a.furnitureId, list);
  }
  const areas: StorageArea[] = [];
  for (const list of byFurniture.values()) {
    list.sort((a, b) => a.order - b.order);
    for (const [i, a] of list.entries()) {
      areas.push({ ...a, group: i, order: 0 });
    }
  }
  return { ...obj, schemaVersion: 3, areas };
}

export function validateData(value: unknown): ValidationResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: 'Not a Home Organizer backup file.' };
  }
  let obj = value as Record<string, unknown>;
  if (obj.schemaVersion !== 1 && obj.schemaVersion !== 2 && obj.schemaVersion !== 3) {
    return { ok: false, error: `Unsupported schema version: ${String(obj.schemaVersion)}.` };
  }
  for (const key of ARRAY_KEYS) {
    if (!Array.isArray(obj[key])) {
      return { ok: false, error: `Missing or invalid "${key}" collection.` };
    }
  }
  if (obj.schemaVersion === 1) {
    obj = migrateV1(obj);
  }
  if (obj.schemaVersion === 2) {
    obj = migrateV2(obj);
  }
  const data = obj as unknown as AppData;
  if (data.areas.some((a) => !Number.isInteger(a.group) || a.group < 0)) {
    return { ok: false, error: 'A storage area has an invalid layout position.' };
  }
  if (data.rooms.some((r) => !Array.isArray(r.polygon) || r.polygon.length < 4)) {
    return { ok: false, error: 'A room has an invalid shape.' };
  }
  const floorIds = new Set(data.floors.map((f) => f.id));
  const rooms = new Map(data.rooms.map((r) => [r.id, r]));
  const furnitureIds = new Set(data.furniture.map((f) => f.id));
  const areaIds = new Set(data.areas.map((a) => a.id));
  if (data.rooms.some((r) => !floorIds.has(r.floorId))) {
    return { ok: false, error: 'A room references a missing floor.' };
  }
  for (const w of data.wallItems) {
    const room = rooms.get(w.roomId);
    if (!room) return { ok: false, error: 'A door/window references a missing room.' };
    if (!Number.isInteger(w.edge) || w.edge < 0 || w.edge >= room.polygon.length) {
      return { ok: false, error: 'A door/window references a missing wall.' };
    }
  }
  if (data.furniture.some((f) => !rooms.has(f.roomId))) {
    return { ok: false, error: 'A furniture piece references a missing room.' };
  }
  if (data.areas.some((a) => !furnitureIds.has(a.furnitureId))) {
    return { ok: false, error: 'A storage area references missing furniture.' };
  }
  if (data.items.some((i) => !areaIds.has(i.areaId))) {
    return { ok: false, error: 'An item references a missing storage area.' };
  }
  return { ok: true, data };
}

export function save(data: AppData, storage: StorageLike = localStorage): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function load(storage: StorageLike = localStorage): AppData {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const result = validateData(JSON.parse(raw));
    return result.ok ? result.data : emptyData();
  } catch {
    return emptyData();
  }
}

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function importJson(text: string): ValidationResult {
  try {
    return validateData(JSON.parse(text));
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
}
