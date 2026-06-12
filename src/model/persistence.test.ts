import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, exportJson, importJson, load, rectPolygon, save, validateData } from './persistence';
import type { AppData } from './types';
import { emptyData } from './types';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function sampleData(): AppData {
  return {
    schemaVersion: 3,
    floors: [{ id: 'f1', name: 'Ground', order: 0 }],
    rooms: [{ id: 'r1', floorId: 'f1', name: 'Bedroom', polygon: rectPolygon(0, 0, 5, 4) }],
    wallItems: [{ id: 'w1', roomId: 'r1', type: 'door', edge: 2, offset: 1, length: 1 }],
    furniture: [{ id: 'fu1', roomId: 'r1', kind: 'dresser', name: 'Dresser 1', x: 1, y: 1, w: 2, h: 1 }],
    areas: [{ id: 'a1', furnitureId: 'fu1', name: 'Drawer 1', group: 0, order: 0 }],
    items: [{ id: 'i1', areaId: 'a1', name: 'Socks', quantity: 2, notes: '' }],
  };
}

function sampleV1() {
  return {
    schemaVersion: 1,
    floors: [{ id: 'f1', name: 'Ground', order: 0 }],
    rooms: [{ id: 'r1', floorId: 'f1', name: 'Bedroom', x: 2, y: 3, w: 5, h: 4 }],
    wallItems: [
      { id: 'wN', roomId: 'r1', type: 'window', side: 'N', offset: 1, length: 2 },
      { id: 'wE', roomId: 'r1', type: 'door', side: 'E', offset: 1, length: 1 },
      { id: 'wS', roomId: 'r1', type: 'door', side: 'S', offset: 1, length: 1 },
      { id: 'wW', roomId: 'r1', type: 'window', side: 'W', offset: 1, length: 2 },
    ],
    furniture: [],
    areas: [],
    items: [],
  };
}

describe('save/load', () => {
  it('round-trips through storage', () => {
    const storage = fakeStorage();
    expect(save(sampleData(), storage)).toBe(true);
    expect(load(storage)).toEqual(sampleData());
  });

  it('returns empty data when nothing stored or corrupt', () => {
    expect(load(fakeStorage())).toEqual(emptyData());
    expect(load(fakeStorage({ [STORAGE_KEY]: '{not json' }))).toEqual(emptyData());
  });
});

describe('v1 migration', () => {
  it('migrates rect rooms to polygons', () => {
    const result = validateData(sampleV1());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.schemaVersion).toBe(3);
    expect(result.data.rooms[0].polygon).toEqual([
      { x: 2, y: 3 },
      { x: 7, y: 3 },
      { x: 7, y: 7 },
      { x: 2, y: 7 },
    ]);
  });

  it('maps wall sides to edges, reversing offsets for S and W walls', () => {
    const result = validateData(sampleV1());
    if (!result.ok) throw new Error(result.error);
    const byId = Object.fromEntries(result.data.wallItems.map((w) => [w.id, w]));
    // room is 5 wide, 4 tall
    expect(byId.wN).toMatchObject({ edge: 0, offset: 1, length: 2 });
    expect(byId.wE).toMatchObject({ edge: 1, offset: 1, length: 1 });
    expect(byId.wS).toMatchObject({ edge: 2, offset: 3, length: 1 }); // 5 - 1 - 1
    expect(byId.wW).toMatchObject({ edge: 3, offset: 1, length: 2 }); // 4 - 1 - 2
  });

  it('loading v1 data from storage migrates transparently', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify(sampleV1()) });
    expect(load(storage).schemaVersion).toBe(3);
  });
});

describe('v2 migration', () => {
  it('gives each area its own layout group, in order', () => {
    const v2 = {
      ...sampleData(),
      schemaVersion: 2,
      areas: [
        { id: 'a2', furnitureId: 'fu1', name: 'Drawer 2', order: 1 },
        { id: 'a1', furnitureId: 'fu1', name: 'Drawer 1', order: 0 },
      ],
      items: [],
    };
    const result = validateData(v2);
    if (!result.ok) throw new Error(result.error);
    expect(result.data.schemaVersion).toBe(3);
    const byId = Object.fromEntries(result.data.areas.map((a) => [a.id, a]));
    expect(byId.a1).toMatchObject({ group: 0, order: 0 });
    expect(byId.a2).toMatchObject({ group: 1, order: 0 });
  });
});

describe('validateData', () => {
  it('accepts valid v3 data', () => {
    expect(validateData(sampleData())).toEqual({ ok: true, data: sampleData() });
  });

  it('rejects unknown schema versions and non-objects', () => {
    expect(validateData({ ...sampleData(), schemaVersion: 99 }).ok).toBe(false);
    expect(validateData(null).ok).toBe(false);
  });

  it('rejects out-of-range wall edges and dangling references', () => {
    const badEdge = sampleData();
    badEdge.wallItems[0] = { ...badEdge.wallItems[0], edge: 7 };
    expect(validateData(badEdge).ok).toBe(false);

    const dangling = sampleData();
    dangling.items[0] = { ...dangling.items[0], areaId: 'missing' };
    expect(validateData(dangling).ok).toBe(false);
  });

  it('rejects rooms with invalid polygons', () => {
    const bad = sampleData();
    bad.rooms[0] = { ...bad.rooms[0], polygon: [{ x: 0, y: 0 }] };
    expect(validateData(bad).ok).toBe(false);
  });

  it('rejects areas with invalid layout groups', () => {
    const bad = sampleData();
    bad.areas[0] = { ...bad.areas[0], group: -1 };
    expect(validateData(bad).ok).toBe(false);
  });
});

describe('sample home', () => {
  it('builds valid v3 data with rooms, areas and items', async () => {
    const { buildSampleHome } = await import('./sampleHome');
    const sample = buildSampleHome();
    const result = validateData(sample);
    expect(result.ok).toBe(true);
    expect(sample.floors).toHaveLength(2);
    expect(sample.items.length).toBeGreaterThan(10);
  });
});

describe('export/import', () => {
  it('round-trips', () => {
    expect(importJson(exportJson(sampleData()))).toEqual({ ok: true, data: sampleData() });
  });

  it('rejects invalid JSON', () => {
    expect(importJson('not json').ok).toBe(false);
  });
});
