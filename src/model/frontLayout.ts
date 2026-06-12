import { columnsKind, groupAreas } from './areaLayout';
import { KIND_HEIGHTS } from './iso';
import { furnitureFacing } from './scene3d';
import type { Furniture, StorageArea } from './types';

/**
 * Geometry of a furniture front elevation: the inner face splits into group
 * bands along the main axis (rows top-to-bottom, or columns left-to-right for
 * wardrobes), and each band splits across for its members. All numbers are in
 * metres, the same space the FurnitureFront SVG draws in.
 */

export const FRAME = 0.05;
export const GAP = 0.028;
const PLINTH_CLEARANCE = 0.04;

export interface FrontGeometry {
  /** full face size */
  W: number;
  H: number;
  innerX: number;
  innerY: number;
  innerW: number;
  innerH: number;
  /** groups run left-to-right instead of top-to-bottom */
  columns: boolean;
  grouped: StorageArea[][];
}

export interface AreaRegion {
  area: StorageArea;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a dragged area would land. */
export type AreaPlacement =
  /** into an existing group, before the member at `index` */
  | { group: number; index: number }
  /** as its own new group, before the group at `newGroupIndex` */
  | { newGroupIndex: number };

export function frontGeometry(furniture: Furniture, areas: StorageArea[]): FrontGeometry {
  // the front face spans the side the piece faces with
  const W = furnitureFacing(furniture) % 2 === 1 ? furniture.h : furniture.w;
  const H = KIND_HEIGHTS[furniture.kind];
  return {
    W,
    H,
    innerX: FRAME,
    innerY: FRAME,
    innerW: W - 2 * FRAME,
    innerH: H - 2 * FRAME - PLINTH_CLEARANCE,
    columns: columnsKind(furniture.kind),
    grouped: groupAreas(areas),
  };
}

export function frontRegions(geom: FrontGeometry): AreaRegion[] {
  const { innerX, innerY, innerW, innerH, columns, grouped } = geom;
  const g = grouped.length;
  return grouped.flatMap((members, gi) => {
    const n = members.length;
    if (columns) {
      const w = (innerW - GAP * (g - 1)) / g;
      const h = (innerH - GAP * (n - 1)) / n;
      return members.map((area, i) => ({ area, x: innerX + gi * (w + GAP), y: innerY + i * (h + GAP), w, h }));
    }
    const h = (innerH - GAP * (g - 1)) / g;
    const w = (innerW - GAP * (n - 1)) / n;
    return members.map((area, i) => ({ area, x: innerX + i * (w + GAP), y: innerY + gi * (h + GAP), w, h }));
  });
}

/** Outer band of each group that reads as "drop between, not into". */
const EDGE_ZONE = 0.28;

/**
 * Hit-test a point against the layout: the middle of a band places into that
 * group (index from the cross-axis position), its outer edges and anything
 * outside the face place a new group at the boundary.
 */
export function placementAt(geom: FrontGeometry, x: number, y: number): AreaPlacement {
  const { innerX, innerY, innerW, innerH, columns, grouped } = geom;
  const g = grouped.length;
  // main = along the group axis, cross = within a band
  const main = columns ? x - innerX : y - innerY;
  const cross = columns ? y - innerY : x - innerX;
  const mainSize = columns ? innerW : innerH;
  const crossSize = columns ? innerH : innerW;
  const band = (mainSize - GAP * (g - 1)) / g;

  if (main < 0) return { newGroupIndex: 0 };
  if (main >= mainSize) return { newGroupIndex: g };
  const gi = Math.min(g - 1, Math.floor(main / (band + GAP)));
  const rel = (main - gi * (band + GAP)) / band;
  if (rel < EDGE_ZONE) return { newGroupIndex: gi };
  if (rel > 1 - EDGE_ZONE) return { newGroupIndex: gi + 1 };

  const members = grouped[gi];
  const slot = (crossSize - GAP * (members.length - 1)) / members.length;
  let index = 0;
  for (let i = 0; i < members.length; i++) {
    if (cross > i * (slot + GAP) + slot / 2) index = i + 1;
  }
  return { group: gi, index };
}

/** The full extent of a group's band, for highlighting a drop-into target. */
export function groupBand(geom: FrontGeometry, gi: number): { x: number; y: number; w: number; h: number } {
  const { innerX, innerY, innerW, innerH, columns, grouped } = geom;
  const g = grouped.length;
  const mainSize = columns ? innerW : innerH;
  const band = (mainSize - GAP * (g - 1)) / g;
  return columns
    ? { x: innerX + gi * (band + GAP), y: innerY, w: band, h: innerH }
    : { x: innerX, y: innerY + gi * (band + GAP), w: innerW, h: band };
}

/** The line to draw for a pending placement, in face coordinates. */
export function placementLine(
  geom: FrontGeometry,
  placement: AreaPlacement,
): { x1: number; y1: number; x2: number; y2: number } {
  const { innerX, innerY, innerW, innerH, columns, grouped } = geom;
  const g = grouped.length;
  const mainSize = columns ? innerW : innerH;
  const band = (mainSize - GAP * (g - 1)) / g;

  if ('newGroupIndex' in placement) {
    const k = placement.newGroupIndex;
    const main = k === 0 ? 0 : k * (band + GAP) - GAP / 2;
    return columns
      ? { x1: innerX + main, y1: innerY, x2: innerX + main, y2: innerY + innerH }
      : { x1: innerX, y1: innerY + main, x2: innerX + innerW, y2: innerY + main };
  }
  const members = grouped[placement.group];
  const crossSize = columns ? innerH : innerW;
  const slot = (crossSize - GAP * (members.length - 1)) / members.length;
  const cross = placement.index === 0 ? 0 : placement.index * (slot + GAP) - GAP / 2;
  const bandStart = placement.group * (band + GAP);
  return columns
    ? { x1: innerX + bandStart, y1: innerY + cross, x2: innerX + bandStart + band, y2: innerY + cross }
    : { x1: innerX + cross, y1: innerY + bandStart, x2: innerX + cross, y2: innerY + bandStart + band };
}
