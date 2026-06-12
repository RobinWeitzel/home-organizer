// Per-kind furniture part layouts for the 3D view. Pure data so the geometry
// is unit-testable: each piece is a list of axis-aligned boxes in a local
// frame — width W along x, depth D along z, the "front" face at +z, the floor
// at y = 0. FurnitureMeshes orients the frame toward the viewer.
import type { FurnitureKind } from '../../model/types';

export interface FurnPart {
  key: string;
  /** box dimensions [w, h, d] in the local frame */
  size: [number, number, number];
  /** box center [x, y, z]; y measured up from the floor */
  pos: [number, number, number];
  color: string;
}

/** how far details (door fronts, lids, rims) may protrude past the footprint */
export const PART_TOLERANCE = 0.04;

const KNOB = '#e9e2d4';

const BOOKS = ['#a85751', '#5d7d9a', '#7d9a5d', '#c4a35a', '#8a6f9e', '#b07a4f', '#6b8e8a'];

/** deterministic per-piece variation (no Math.random — stable across renders) */
function hash(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function doors(W: number, D: number, color: string, y0: number, h: number): FurnPart[] {
  const gap = 0.022;
  const dw = Math.max(0.08, W / 2 - 0.045 - gap / 2);
  const yc = y0 + h / 2;
  return [
    { key: 'doorL', size: [dw, h, 0.032], pos: [-(gap / 2 + dw / 2), yc, D / 2], color },
    { key: 'doorR', size: [dw, h, 0.032], pos: [gap / 2 + dw / 2, yc, D / 2], color },
    { key: 'knobL', size: [0.03, 0.09, 0.026], pos: [-(gap / 2 + 0.035), yc, D / 2 + 0.025], color: KNOB },
    { key: 'knobR', size: [0.03, 0.09, 0.026], pos: [gap / 2 + 0.035, yc, D / 2 + 0.025], color: KNOB },
  ];
}

export function buildFurnitureParts(
  kind: FurnitureKind,
  W: number,
  D: number,
  H: number,
  seed: string,
): FurnPart[] {
  switch (kind) {
    case 'wardrobe': {
      const body = '#4a2e25';
      return [
        { key: 'body', size: [W, H, D], pos: [0, H / 2, 0], color: body },
        ...doors(W, D, '#7a5443', 0.07, H - 0.14),
      ];
    }

    case 'dresser': {
      const body = '#684a3e';
      const parts: FurnPart[] = [{ key: 'body', size: [W, H, D], pos: [0, H / 2, 0], color: body }];
      const rows = 3;
      for (let i = 0; i < rows; i++) {
        const yc = (H * (i + 0.5)) / rows;
        parts.push({
          key: `drawer${i}`,
          size: [Math.max(0.08, W - 0.07), Math.max(0.06, H / rows - 0.05), 0.022],
          pos: [0, yc, D / 2],
          color: '#94705f',
        });
        parts.push({
          key: `knob${i}`,
          size: [0.09, 0.026, 0.026],
          pos: [0, yc, D / 2 + 0.022],
          color: KNOB,
        });
      }
      return parts;
    }

    case 'cabinet': {
      const body = '#8a6244';
      return [
        { key: 'body', size: [W, H - 0.05, D], pos: [0, (H - 0.05) / 2, 0], color: body },
        { key: 'top', size: [W + 0.04, 0.05, D + 0.04], pos: [0, H - 0.025, 0], color: '#b59169' },
        ...doors(W, D, '#ab8260', 0.05, H - 0.22),
      ];
    }

    case 'chest': {
      const body = '#6b4226';
      return [
        { key: 'body', size: [W, H - 0.07, D], pos: [0, (H - 0.07) / 2, 0], color: body },
        { key: 'lid', size: [W + 0.05, 0.07, D + 0.05], pos: [0, H - 0.035, 0], color: '#91613a' },
        // straps wrap the lid so the chest reads from the iso top-down angle
        { key: 'bandL', size: [0.06, 0.082, D + 0.062], pos: [-W * 0.28, H - 0.035, 0], color: '#4d2e16' },
        { key: 'bandR', size: [0.06, 0.082, D + 0.062], pos: [W * 0.28, H - 0.035, 0], color: '#4d2e16' },
        { key: 'strapL', size: [0.06, H - 0.07, 0.016], pos: [-W * 0.28, (H - 0.07) / 2, D / 2], color: '#4d2e16' },
        { key: 'strapR', size: [0.06, H - 0.07, 0.016], pos: [W * 0.28, (H - 0.07) / 2, D / 2], color: '#4d2e16' },
        { key: 'clasp', size: [0.07, 0.09, 0.022], pos: [0, H - 0.1, D / 2], color: KNOB },
      ];
    }

    case 'shelf': {
      // open bookcase: sides + back + boards, with a stylized row of books per shelf
      const frame = '#96693f';
      const boardCol = '#a4754a';
      const side = 0.04;
      const parts: FurnPart[] = [
        { key: 'sideL', size: [side, H, D], pos: [-(W / 2 - side / 2), H / 2, 0], color: frame },
        { key: 'sideR', size: [side, H, D], pos: [W / 2 - side / 2, H / 2, 0], color: frame },
        // back panel darker than the frame: fakes the interior shadow an
        // ambient-lit Lambert scene doesn't produce on its own
        { key: 'back', size: [W, H, 0.03], pos: [0, H / 2, -(D / 2 - 0.015)], color: '#5d3f26' },
      ];
      const innerW = W - 2 * side;
      const boards = 4; // 4 boards → bottom, two middles, top edge handled below
      const levels: number[] = [];
      for (let i = 0; i <= boards; i++) levels.push(0.02 + (H - 0.04) * (i / boards));
      for (let i = 0; i < levels.length; i++) {
        parts.push({
          key: `board${i}`,
          size: [innerW, 0.04, D],
          pos: [0, levels[i], 0],
          color: boardCol,
        });
      }
      // books standing on each opening except the very top
      const rnd = hash(seed);
      for (let i = 0; i + 1 < levels.length; i++) {
        const openH = levels[i + 1] - levels[i] - 0.04;
        if (openH < 0.15 || innerW < 0.2) continue;
        let x = -innerW / 2 + 0.02;
        let b = 0;
        while (x < innerW / 2 - 0.08 && b < 10) {
          const bw = 0.06 + rnd() * 0.05;
          const bh = openH * (0.62 + rnd() * 0.3);
          if (x + bw > innerW / 2 - 0.02) break;
          parts.push({
            key: `book${i}_${b}`,
            size: [bw, bh, D * 0.6],
            pos: [x + bw / 2, levels[i] + 0.02 + bh / 2, 0.03],
            color: BOOKS[Math.floor(rnd() * BOOKS.length)],
          });
          x += bw + 0.008 + rnd() * 0.035;
          b++;
        }
      }
      return parts;
    }

    default: {
      // 'other' — a woven storage basket
      const body = '#998878';
      const band = '#867663';
      return [
        { key: 'body', size: [W, H - 0.04, D], pos: [0, (H - 0.04) / 2, 0], color: body },
        { key: 'rim', size: [W + 0.04, 0.06, D + 0.04], pos: [0, H - 0.03, 0], color: band },
        { key: 'band1', size: [W + 0.012, 0.035, D + 0.012], pos: [0, H * 0.32, 0], color: band },
        { key: 'band2', size: [W + 0.012, 0.035, D + 0.012], pos: [0, H * 0.62, 0], color: band },
      ];
    }
  }
}
