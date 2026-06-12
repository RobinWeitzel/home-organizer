export type FurnitureKind = 'shelf' | 'dresser' | 'wardrobe' | 'cabinet' | 'chest' | 'other';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Floor {
  id: string;
  name: string;
  order: number;
}

export interface Room {
  id: string;
  floorId: string;
  name: string;
  /** clockwise rectilinear outline on the integer grid (screen coords, y down) */
  polygon: Pt[];
}

export interface WallItem {
  id: string;
  roomId: string;
  type: 'door' | 'window';
  /** index into the room polygon's edge list */
  edge: number;
  offset: number;
  length: number;
}

export interface Furniture {
  id: string;
  roomId: string;
  kind: FurnitureKind;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StorageArea {
  id: string;
  furnitureId: string;
  name: string;
  /**
   * Which band of the front face the area sits in. For most furniture groups
   * are rows (members sit side by side); for wardrobes groups are columns
   * (members stack vertically). Groups are numbered 0..G-1 without gaps.
   */
  group: number;
  /** position within the group */
  order: number;
}

export interface Item {
  id: string;
  areaId: string;
  name: string;
  quantity: number;
  notes: string;
}

export interface AppData {
  schemaVersion: 3;
  floors: Floor[];
  rooms: Room[];
  wallItems: WallItem[];
  furniture: Furniture[];
  areas: StorageArea[];
  items: Item[];
}

export const emptyData = (): AppData => ({
  schemaVersion: 3,
  floors: [],
  rooms: [],
  wallItems: [],
  furniture: [],
  areas: [],
  items: [],
});
