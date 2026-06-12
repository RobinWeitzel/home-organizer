import type { FurnitureKind, StorageArea } from './types';

/**
 * Whether a furniture kind lays its groups out as columns (side by side,
 * members stacked inside) instead of rows (stacked, members side by side).
 * Wardrobes read as columns — a hanging side next to stacked shelves.
 */
export function columnsKind(kind: FurnitureKind): boolean {
  return kind === 'wardrobe';
}

/** Canonical display sequence: by group, then position within the group. */
export function sortAreas(areas: StorageArea[]): StorageArea[] {
  return [...areas].sort((a, b) => a.group - b.group || a.order - b.order);
}

/** Areas bucketed into their groups, both levels sorted. */
export function groupAreas(areas: StorageArea[]): StorageArea[][] {
  const groups = new Map<number, StorageArea[]>();
  for (const a of sortAreas(areas)) {
    const list = groups.get(a.group) ?? [];
    list.push(a);
    groups.set(a.group, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, list]) => list);
}

/**
 * Compact group numbers to 0..G-1 and orders to 0..n-1 within each group.
 * Returns a patch map (id → {group, order}) for the areas that need to move.
 */
export function normalizeAreas(areas: StorageArea[]): Map<string, { group: number; order: number }> {
  const patch = new Map<string, { group: number; order: number }>();
  for (const [g, members] of groupAreas(areas).entries()) {
    for (const [o, a] of members.entries()) {
      if (a.group !== g || a.order !== o) patch.set(a.id, { group: g, order: o });
    }
  }
  return patch;
}
