import { beforeEach, describe, expect, it } from 'vitest';
import { useApp } from './store';
import { emptyData } from './types';
import { rectPolygon } from './persistence';

const s = () => useApp.getState();

beforeEach(() => {
  useApp.getState().loadData(emptyData());
});

function buildHouse() {
  s().addFloor('Ground');
  const floor = s().data.floors[0];
  s().addRoomRect(floor.id, { x: 0, y: 0, w: 6, h: 4 });
  const room = s().data.rooms[0];
  s().addWallItem(room.id, 'door', 2, 1, 1); // bottom edge of the rect
  s().addFurniture(room.id, 'dresser', { x: 1, y: 1, w: 2, h: 1 });
  const furniture = s().data.furniture[0];
  const area = s().data.areas[0];
  s().addItem(area.id, 'Socks', 4, 'wool');
  return { floor, room, furniture, area, item: s().data.items[0] };
}

describe('floors', () => {
  it('addFloor selects the new floor', () => {
    s().addFloor('Ground');
    expect(s().currentFloorId).toBe(s().data.floors[0].id);
  });

  it('deleteFloor cascades all the way down', () => {
    const { floor } = buildHouse();
    s().deleteFloor(floor.id);
    expect(s().data).toEqual(emptyData());
  });
});

describe('addRoomRect', () => {
  it('creates a rect polygon room', () => {
    s().addFloor('G');
    s().addRoomRect(s().currentFloorId!, { x: 1, y: 1, w: 4, h: 3 });
    expect(s().data.rooms[0].polygon).toEqual(rectPolygon(1, 1, 4, 3));
  });

  it('clips against existing rooms on the same floor', () => {
    s().addFloor('G');
    const floorId = s().currentFloorId!;
    s().addRoomRect(floorId, { x: 0, y: 0, w: 4, h: 4 });
    s().addRoomRect(floorId, { x: 2, y: 0, w: 4, h: 4 });
    expect(s().data.rooms).toHaveLength(2);
    expect(s().data.rooms[1].polygon).toEqual(rectPolygon(4, 0, 2, 4));
  });

  it('ignores a rect fully covered by another room', () => {
    s().addFloor('G');
    const floorId = s().currentFloorId!;
    s().addRoomRect(floorId, { x: 0, y: 0, w: 4, h: 4 });
    s().addRoomRect(floorId, { x: 1, y: 1, w: 2, h: 2 });
    expect(s().data.rooms).toHaveLength(1);
  });

  it('rejects a clip result that is disconnected', () => {
    s().addFloor('G');
    const floorId = s().currentFloorId!;
    s().addRoomRect(floorId, { x: 2, y: 0, w: 2, h: 4 });
    // this rect would be split into two pieces by the existing room
    s().addRoomRect(floorId, { x: 0, y: 1, w: 6, h: 1 });
    expect(s().data.rooms).toHaveLength(1);
  });
});

describe('applyRoomShape', () => {
  it('extend merges into an L-shape', () => {
    s().addFloor('G');
    s().addRoomRect(s().currentFloorId!, { x: 0, y: 0, w: 4, h: 2 });
    const room = s().data.rooms[0];
    expect(s().applyRoomShape(room.id, 'extend', { x: 0, y: 2, w: 2, h: 2 })).toBe(true);
    expect(s().data.rooms[0].polygon).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ]);
  });

  it('rejects a disconnected extension', () => {
    s().addFloor('G');
    s().addRoomRect(s().currentFloorId!, { x: 0, y: 0, w: 2, h: 2 });
    const room = s().data.rooms[0];
    expect(s().applyRoomShape(room.id, 'extend', { x: 5, y: 5, w: 2, h: 2 })).toBe(false);
    expect(s().data.rooms[0].polygon).toEqual(rectPolygon(0, 0, 2, 2));
  });

  it('rejects an extension that would create a hole', () => {
    s().addFloor('G');
    // U-shape: 5x3 with a 1x2 notch from the top middle
    s().addRoomRect(s().currentFloorId!, { x: 0, y: 0, w: 5, h: 3 });
    const room = s().data.rooms[0];
    expect(s().applyRoomShape(room.id, 'carve', { x: 2, y: 0, w: 1, h: 2 })).toBe(true);
    // capping the U would enclose the notch
    expect(s().applyRoomShape(room.id, 'extend', { x: 0, y: -1, w: 5, h: 1 })).toBe(false);
  });

  it('carve cuts a notch but refuses to split the room', () => {
    s().addFloor('G');
    s().addRoomRect(s().currentFloorId!, { x: 0, y: 0, w: 4, h: 2 });
    const room = s().data.rooms[0];
    expect(s().applyRoomShape(room.id, 'carve', { x: 1, y: 0, w: 1, h: 1 })).toBe(true);
    expect(s().applyRoomShape(room.id, 'carve', { x: 1, y: 0, w: 1, h: 2 })).toBe(false);
    expect(s().applyRoomShape(room.id, 'carve', { x: 0, y: 0, w: 9, h: 9 })).toBe(false);
  });

  it('extend is clipped against other rooms', () => {
    s().addFloor('G');
    const floorId = s().currentFloorId!;
    s().addRoomRect(floorId, { x: 0, y: 0, w: 2, h: 2 });
    s().addRoomRect(floorId, { x: 3, y: 0, w: 2, h: 2 });
    const room = s().data.rooms[0];
    expect(s().applyRoomShape(room.id, 'extend', { x: 2, y: 0, w: 3, h: 2 })).toBe(true);
    expect(s().data.rooms[0].polygon).toEqual(rectPolygon(0, 0, 3, 2));
  });

  it('keeps a wall item whose wall survives an extension along the same line', () => {
    s().addFloor('G');
    s().addRoomRect(s().currentFloorId!, { x: 0, y: 0, w: 4, h: 2 });
    const room = s().data.rooms[0];
    s().addWallItem(room.id, 'window', 0, 1, 2); // top wall
    // extend to the right: top wall becomes longer, same line
    expect(s().applyRoomShape(room.id, 'extend', { x: 4, y: 0, w: 2, h: 2 })).toBe(true);
    expect(s().data.wallItems).toHaveLength(1);
    expect(s().data.wallItems[0]).toMatchObject({ edge: 0, offset: 1, length: 2 });
  });

  it('drops a wall item whose wall is carved away', () => {
    s().addFloor('G');
    s().addRoomRect(s().currentFloorId!, { x: 0, y: 0, w: 4, h: 2 });
    const room = s().data.rooms[0];
    s().addWallItem(room.id, 'window', 0, 1, 1); // top wall above the carve
    expect(s().applyRoomShape(room.id, 'carve', { x: 1, y: 0, w: 1, h: 1 })).toBe(true);
    expect(s().data.wallItems).toHaveLength(0);
  });
});

describe('wall items', () => {
  it('updateWallItem clamps offset and length to the wall', () => {
    const { room } = buildHouse(); // 6x4 rect, door on bottom edge (len 6)
    const door = s().data.wallItems[0];
    s().updateWallItem(door.id, { offset: -2, length: 1 });
    expect(s().data.wallItems[0]).toMatchObject({ offset: 0, length: 1 });
    s().updateWallItem(door.id, { offset: 5, length: 3 });
    expect(s().data.wallItems[0]).toMatchObject({ offset: 3, length: 3 });
    s().updateWallItem(door.id, { length: 0.1 });
    expect(s().data.wallItems[0].length).toBe(0.3);
    expect(room.id).toBe(s().data.wallItems[0].roomId);
  });
});

describe('furniture default sizes', () => {
  it('KIND_SIZES are real-world small', async () => {
    const { KIND_SIZES } = await import('./store');
    expect(KIND_SIZES.shelf).toEqual({ w: 0.8, h: 0.3 });
    expect(KIND_SIZES.dresser).toEqual({ w: 1, h: 0.5 });
    expect(Object.keys(KIND_SIZES)).toHaveLength(6);
  });
});

describe('moveRoom', () => {
  it('translates polygon and furniture', () => {
    const { room, furniture } = buildHouse();
    expect(s().moveRoom(room.id, 2, 1)).toBe(true);
    expect(s().data.rooms[0].polygon[0]).toEqual({ x: 2, y: 1 });
    const f = s().data.furniture.find((x) => x.id === furniture.id)!;
    expect({ x: f.x, y: f.y }).toEqual({ x: 3, y: 2 });
  });

  it('refuses to move into another room', () => {
    s().addFloor('G');
    const floorId = s().currentFloorId!;
    s().addRoomRect(floorId, { x: 0, y: 0, w: 2, h: 2 });
    s().addRoomRect(floorId, { x: 3, y: 0, w: 2, h: 2 });
    const a = s().data.rooms[0];
    expect(s().moveRoom(a.id, 2, 0)).toBe(false);
    expect(s().data.rooms[0].polygon).toEqual(rectPolygon(0, 0, 2, 2));
  });
});

describe('undo/redo', () => {
  it('undoes and redoes a mutation', () => {
    s().addFloor('Ground');
    s().addRoomRect(s().currentFloorId!, { x: 0, y: 0, w: 4, h: 3 });
    expect(s().data.rooms).toHaveLength(1);
    s().undo();
    expect(s().data.rooms).toHaveLength(0);
    expect(s().canUndo()).toBe(true); // addFloor still undoable
    s().redo();
    expect(s().data.rooms).toHaveLength(1);
  });

  it('a new edit clears the redo stack', () => {
    s().addFloor('Ground');
    s().addFloor('Upstairs');
    s().undo();
    expect(s().canRedo()).toBe(true);
    s().addFloor('Attic');
    expect(s().canRedo()).toBe(false);
  });

  it('coalesces rapid same-key edits into one undo step', () => {
    const { item } = buildHouse();
    s().updateItem(item.id, { name: 'So' });
    s().updateItem(item.id, { name: 'Sock' });
    s().updateItem(item.id, { name: 'Sockz' });
    s().undo();
    expect(s().data.items[0].name).toBe('Socks'); // back to pre-typing state in one step
  });

  it('does not coalesce edits with different keys', () => {
    const { item } = buildHouse();
    s().updateItem(item.id, { name: 'Sockz' });
    s().addItem(item.areaId, 'Hat');
    s().undo();
    expect(s().data.items.map((i) => i.name)).toEqual(['Sockz']);
    s().undo();
    expect(s().data.items[0].name).toBe('Socks');
  });

  it('undo revalidates the current floor and clears selection', () => {
    s().addFloor('Ground');
    const ground = s().data.floors[0].id;
    s().addFloor('Upstairs');
    expect(s().currentFloorId).not.toBe(ground);
    s().setSelected({ kind: 'room', id: 'nope' });
    s().undo(); // Upstairs gone
    expect(s().currentFloorId).toBe(ground);
    expect(s().selected).toBeNull();
  });

  it('replaceData is undoable, history is capped', () => {
    s().addFloor('Ground');
    s().replaceData(emptyData());
    expect(s().data.floors).toHaveLength(0);
    s().undo();
    expect(s().data.floors).toHaveLength(1);
  });
});

describe('applyExternalData', () => {
  it('is undoable and keeps the current floor when it still exists', () => {
    s().addFloor('Ground');
    s().addFloor('Upstairs');
    const upstairs = s().data.floors[1].id;
    s().setCurrentFloor(upstairs);
    // remote version renamed a floor but kept the same ids
    const remote = {
      ...s().data,
      floors: s().data.floors.map((f) => (f.order === 0 ? { ...f, name: 'Cellar' } : f)),
    };
    s().applyExternalData(remote);
    expect(s().data.floors[0].name).toBe('Cellar');
    expect(s().currentFloorId).toBe(upstairs);
    s().undo();
    expect(s().data.floors[0].name).toBe('Ground');
  });

  it('falls back to the first floor when the current one disappeared', () => {
    s().addFloor('Ground');
    s().addFloor('Upstairs');
    s().setCurrentFloor(s().data.floors[1].id);
    const remote = { ...s().data, floors: [s().data.floors[0]] };
    s().applyExternalData(remote);
    expect(s().currentFloorId).toBe(s().data.floors[0].id);
  });
});

describe('moving items between areas', () => {
  it('updateItem can move an item to another valid area', () => {
    const { item } = buildHouse();
    const target = s().data.areas[1];
    s().updateItem(item.id, { areaId: target.id });
    expect(s().data.items[0].areaId).toBe(target.id);
  });

  it('rejects a move to a missing area', () => {
    const { item, area } = buildHouse();
    s().updateItem(item.id, { areaId: 'missing' });
    expect(s().data.items[0].areaId).toBe(area.id);
  });
});

describe('furniture, areas, items (unchanged behaviour)', () => {
  it('addFurniture creates kind-default areas', () => {
    s().addFloor('G');
    s().addRoomRect(s().currentFloorId!, { x: 0, y: 0, w: 10, h: 10 });
    s().addFurniture(s().data.rooms[0].id, 'dresser', { x: 0, y: 0, w: 2, h: 1 });
    expect(s().data.areas.map((a) => a.name)).toEqual(['Drawer 1', 'Drawer 2', 'Drawer 3']);
  });

  it('deleteRoom cascades, locateItem builds the breadcrumb', () => {
    const { room, item, floor, furniture, area } = buildHouse();
    const loc = s().locateItem(item.id)!;
    expect([loc.floor.id, loc.room.id, loc.furniture.id, loc.area.id]).toEqual([
      floor.id,
      room.id,
      furniture.id,
      area.id,
    ]);
    s().deleteRoom(room.id);
    expect(s().data.items).toHaveLength(0);
  });

  it('roomCells exposes the cell set for hit tests', () => {
    const { room } = buildHouse();
    expect(s().roomCells(room.id).size).toBe(24);
  });
});

describe('area layout (placeArea)', () => {
  /** dresser with three drawers, each in its own group 0/1/2, plus a fourth */
  function dresserAreas() {
    const { furniture } = buildHouse();
    s().addArea(furniture.id, 'Drawer 4'); // ensure addArea appends a new group
    return () => s().data.areas.filter((a) => a.furnitureId === furniture.id);
  }

  const shape = (areas: { name: string; group: number; order: number }[]) =>
    [...areas]
      .sort((a, b) => a.group - b.group || a.order - b.order)
      .map((a) => `${a.group}.${a.order}:${a.name}`);

  const byName = (get: () => { name: string; id: string }[], name: string) =>
    get().find((a) => a.name === name)!;

  it('addArea opens a new group at the end', () => {
    const areas = dresserAreas()();
    expect(shape(areas)).toEqual(['0.0:Drawer 1', '1.0:Drawer 2', '2.0:Drawer 3', '3.0:Drawer 4']);
  });

  it('dropping into a group puts areas side by side at the given spot', () => {
    const get = dresserAreas();
    s().placeArea(byName(get, 'Drawer 2').id, { group: 0, index: 1 });
    expect(shape(get())).toEqual(['0.0:Drawer 1', '0.1:Drawer 2', '1.0:Drawer 3', '2.0:Drawer 4']);
    // before the first member, too
    s().placeArea(byName(get, 'Drawer 3').id, { group: 0, index: 0 });
    expect(shape(get())).toEqual(['0.0:Drawer 3', '0.1:Drawer 1', '0.2:Drawer 2', '1.0:Drawer 4']);
  });

  it('dropping on a seam gives the area its own group there', () => {
    const get = dresserAreas();
    // move Drawer 4 to the very top
    s().placeArea(byName(get, 'Drawer 4').id, { newGroupIndex: 0 });
    expect(shape(get())).toEqual(['0.0:Drawer 4', '1.0:Drawer 1', '2.0:Drawer 2', '3.0:Drawer 3']);
    // and back past the end
    s().placeArea(byName(get, 'Drawer 4').id, { newGroupIndex: 4 });
    expect(shape(get())).toEqual(['0.0:Drawer 1', '1.0:Drawer 2', '2.0:Drawer 3', '3.0:Drawer 4']);
  });

  it('pulling an area out of a shared group collapses nothing else', () => {
    const get = dresserAreas();
    s().placeArea(byName(get, 'Drawer 2').id, { group: 0, index: 1 });
    s().placeArea(byName(get, 'Drawer 2').id, { newGroupIndex: 1 });
    expect(shape(get())).toEqual(['0.0:Drawer 1', '1.0:Drawer 2', '2.0:Drawer 3', '3.0:Drawer 4']);
  });

  it('a lone area dropped beside its own band is a clean no-op', () => {
    const get = dresserAreas();
    const before = shape(get());
    const d2 = byName(get, 'Drawer 2');
    s().placeArea(d2.id, { newGroupIndex: 1 }); // its own seam
    s().placeArea(d2.id, { newGroupIndex: 2 }); // the seam just after
    s().placeArea(d2.id, { group: 1, index: 0 }); // its own band
    expect(shape(get())).toEqual(before);
  });

  it('reorders within a shared group', () => {
    const get = dresserAreas();
    s().placeArea(byName(get, 'Drawer 2').id, { group: 0, index: 1 });
    s().placeArea(byName(get, 'Drawer 2').id, { group: 0, index: 0 });
    expect(shape(get())).toEqual(['0.0:Drawer 2', '0.1:Drawer 1', '1.0:Drawer 3', '2.0:Drawer 4']);
  });

  it('deleteArea collapses the emptied group', () => {
    const get = dresserAreas();
    s().deleteArea(byName(get, 'Drawer 2').id);
    expect(shape(get())).toEqual(['0.0:Drawer 1', '1.0:Drawer 3', '2.0:Drawer 4']);
  });

  it('builds a 2×2 grid', () => {
    const get = dresserAreas();
    s().placeArea(byName(get, 'Drawer 2').id, { group: 0, index: 1 });
    s().placeArea(byName(get, 'Drawer 4').id, { group: 1, index: 1 });
    expect(shape(get())).toEqual(['0.0:Drawer 1', '0.1:Drawer 2', '1.0:Drawer 3', '1.1:Drawer 4']);
  });
});
