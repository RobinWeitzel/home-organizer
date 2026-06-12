import { newId } from './ids';
import { rectPolygon } from './persistence';
import type { AppData, Furniture, FurnitureKind, Item, Pt, Room, StorageArea, WallItem } from './types';

/**
 * A small two-floor example home so new users can explore a filled-in app
 * before drawing their own.
 */
export function buildSampleHome(): AppData {
  const floors = [
    { id: newId(), name: 'Ground floor', order: 0 },
    { id: newId(), name: 'Upstairs', order: 1 },
  ];

  const rooms: Room[] = [];
  const wallItems: WallItem[] = [];
  const furniture: Furniture[] = [];
  const areas: StorageArea[] = [];
  const items: Item[] = [];

  const room = (floorId: string, name: string, polygon: Pt[]): Room => {
    const r = { id: newId(), floorId, name, polygon };
    rooms.push(r);
    return r;
  };

  const wall = (roomId: string, type: 'door' | 'window', edge: number, offset: number, length: number) => {
    wallItems.push({ id: newId(), roomId, type, edge, offset, length });
  };

  // areaNames is a list of groups: names sharing an inner array share a row
  // of the front face (a column for wardrobes)
  const furn = (
    roomId: string,
    kind: FurnitureKind,
    name: string,
    rect: { x: number; y: number; w: number; h: number },
    areaNames: string[][],
    contents: Record<string, [string, number, string?][]>,
  ) => {
    const f = { id: newId(), roomId, kind, name, ...rect };
    furniture.push(f);
    for (const [group, groupNames] of areaNames.entries()) {
      for (const [order, areaName] of groupNames.entries()) {
        const a = { id: newId(), furnitureId: f.id, name: areaName, group, order };
        areas.push(a);
        for (const [itemName, quantity, notes] of contents[areaName] ?? []) {
          items.push({ id: newId(), areaId: a.id, name: itemName, quantity, notes: notes ?? '' });
        }
      }
    }
  };

  // ---- ground floor ----
  const living = room(floors[0].id, 'Living room', [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 5 },
    { x: 3, y: 5 },
    { x: 3, y: 4 },
    { x: 0, y: 4 },
  ]);
  wall(living.id, 'window', 0, 1, 1.6);
  wall(living.id, 'door', 3, 0.4, 0.9); // step wall into hallway

  const kitchen = room(floors[0].id, 'Kitchen', rectPolygon(6, 0, 4, 4));
  wall(kitchen.id, 'window', 0, 1.4, 1.2);
  wall(kitchen.id, 'door', 3, 1.5, 0.9);

  const hallway = room(floors[0].id, 'Hallway', rectPolygon(0, 4, 3, 3));
  wall(hallway.id, 'door', 2, 1, 1);

  furn(
    living.id,
    'shelf',
    'Bookshelf',
    { x: 0.25, y: 0.25, w: 1.5, h: 0.3 },
    [['Top shelf'], ['Middle shelf'], ['Bottom shelf']],
    {
      'Top shelf': [['Novels', 24]],
      'Middle shelf': [['Board games', 6, 'Catan is missing two roads'], ['Photo albums', 3]],
      'Bottom shelf': [['Vinyl records', 31]],
    },
  );
  furn(
    living.id,
    'cabinet',
    'TV cabinet',
    { x: 4, y: 4.5, w: 1.5, h: 0.4 },
    [['Left door', 'Right door']],
    {
      'Left door': [['Game controllers', 4], ['HDMI cables', 5, 'in the shoe box']],
      'Right door': [['Candles', 8]],
    },
  );
  furn(
    kitchen.id,
    'cabinet',
    'Pantry cupboard',
    { x: 9.5, y: 0.25, w: 0.5, h: 1.6 },
    [['Top'], ['Middle'], ['Bottom']],
    {
      Top: [['Pasta', 4, 'penne + spaghetti'], ['Canned tomatoes', 6]],
      Middle: [['Baking supplies', 1, 'flour, sugar, yeast']],
      Bottom: [['Pots and pans', 7]],
    },
  );
  furn(hallway.id, 'other', 'Coat rack bench', { x: 0.25, y: 6.5, w: 1.5, h: 0.4 }, [['Under the bench']], {
    'Under the bench': [['Winter boots', 2], ['Dog leash', 1]],
  });

  // ---- upstairs ----
  const bedroom = room(floors[1].id, 'Bedroom', rectPolygon(0, 0, 5, 4));
  wall(bedroom.id, 'window', 0, 1.7, 1.6);
  wall(bedroom.id, 'door', 2, 0.6, 0.9);

  const bath = room(floors[1].id, 'Bathroom', rectPolygon(5, 0, 3, 4));
  wall(bath.id, 'door', 3, 0.5, 0.8);
  wall(bath.id, 'window', 0, 1, 0.8);

  furn(
    bedroom.id,
    'wardrobe',
    'Wardrobe',
    { x: 0.25, y: 0.25, w: 1.5, h: 0.6 },
    [['Hanging side'], ['Shelf side']],
    {
      'Hanging side': [['Coats', 5], ['Dresses', 7]],
      'Shelf side': [['Sweaters', 9, 'wool ones on top'], ['Spare duvet', 1]],
    },
  );
  furn(bedroom.id, 'dresser', 'Dresser', { x: 3.5, y: 0.25, w: 1, h: 0.5 }, [['Drawer 1'], ['Drawer 2'], ['Drawer 3']], {
    'Drawer 1': [['Socks', 18], ['Underwear', 14]],
    'Drawer 2': [['T-shirts', 12]],
    'Drawer 3': [['Jeans', 4]],
  });
  furn(bath.id, 'cabinet', 'Bathroom cabinet', { x: 7.25, y: 0.5, w: 0.5, h: 1 }, [['Mirror cabinet']], {
    'Mirror cabinet': [['First aid kit', 1, 'plasters need restocking'], ['Spare toothbrushes', 3]],
  });

  return { schemaVersion: 3, floors, rooms, wallItems, furniture, areas, items };
}
