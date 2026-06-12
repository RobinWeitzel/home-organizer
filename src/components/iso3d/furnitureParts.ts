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

    case 'desk':
    case 'table': {
      // slab on four legs; desks read darker and carry a drawer block
      const top = kind === 'desk' ? '#6e4f3a' : '#8a6a4a';
      const leg = kind === 'desk' ? '#56402f' : '#6d5238';
      const t = 0.045;
      const lw = Math.min(0.06, W * 0.12);
      const ld = Math.min(0.06, D * 0.12);
      const lx = Math.max(0.001, W / 2 - 0.05 - lw / 2);
      const lz = Math.max(0.001, D / 2 - 0.05 - ld / 2);
      const legH = H - t;
      const legAt = (x: number, z: number, key: string): FurnPart => ({
        key, size: [lw, legH, ld], pos: [x, legH / 2, z], color: leg,
      });
      const parts: FurnPart[] = [
        { key: 'top', size: [W, t, D], pos: [0, H - t / 2, 0], color: top },
        legAt(-lx, -lz, 'leg0'), legAt(lx, -lz, 'leg1'), legAt(-lx, lz, 'leg2'), legAt(lx, lz, 'leg3'),
      ];
      if (kind === 'desk') {
        const bw = Math.max(0.1, W * 0.3);
        const bh = Math.min(0.3, legH * 0.6);
        parts.push({
          key: 'drawers',
          size: [bw, bh, Math.max(0.05, D - 0.06)],
          pos: [W / 2 - 0.05 - bw / 2, H - t - bh / 2, 0],
          color: leg,
        });
      }
      return parts;
    }

    case 'chair': {
      const wood = '#7a5a3e';
      const seatH = Math.min(0.45, H * 0.55);
      const t = 0.04;
      const lw = Math.min(0.05, W * 0.14);
      const ld = Math.min(0.05, D * 0.14);
      const lx = Math.max(0.001, W / 2 - 0.03 - lw / 2);
      const lz = Math.max(0.001, D / 2 - 0.03 - ld / 2);
      const legAt = (x: number, z: number, key: string): FurnPart => ({
        key, size: [lw, seatH - t, ld], pos: [x, (seatH - t) / 2, z], color: wood,
      });
      return [
        { key: 'seat', size: [W, t, D], pos: [0, seatH - t / 2, 0], color: '#8d6a48' },
        // backrest along the back edge
        { key: 'back', size: [W, H - seatH, 0.045], pos: [0, seatH + (H - seatH) / 2, -(D / 2 - 0.0225)], color: wood },
        legAt(-lx, -lz, 'leg0'), legAt(lx, -lz, 'leg1'), legAt(-lx, lz, 'leg2'), legAt(lx, lz, 'leg3'),
      ];
    }

    case 'sofa': {
      const fabric = '#7d8a96';
      const baseH = H * 0.42;
      const armW = Math.min(0.16, W * 0.12);
      const backD = Math.min(0.18, D * 0.3);
      const seatW = Math.max(0.1, W - 2 * armW);
      const parts: FurnPart[] = [
        { key: 'base', size: [W, baseH, D], pos: [0, baseH / 2, 0], color: '#67737e' },
        { key: 'back', size: [W, H - baseH, backD], pos: [0, baseH + (H - baseH) / 2, -(D / 2 - backD / 2)], color: fabric },
        { key: 'armL', size: [armW, H * 0.85 - baseH, D], pos: [-(W / 2 - armW / 2), baseH + (H * 0.85 - baseH) / 2, 0], color: fabric },
        { key: 'armR', size: [armW, H * 0.85 - baseH, D], pos: [W / 2 - armW / 2, baseH + (H * 0.85 - baseH) / 2, 0], color: fabric },
      ];
      const cushions = seatW > 1.1 ? 2 : 1;
      const cw = (seatW - 0.02 * (cushions - 1)) / cushions;
      for (let i = 0; i < cushions; i++) {
        parts.push({
          key: `cushion${i}`,
          size: [Math.max(0.05, cw - 0.01), 0.09, Math.max(0.05, D - backD - 0.04)],
          pos: [-seatW / 2 + cw / 2 + i * (cw + 0.02), baseH + 0.045, (backD - 0.02) / 2],
          color: '#8b99a6',
        });
      }
      return parts;
    }

    case 'bed': {
      const frame = '#6e4f3a';
      const baseH = H * 0.3;
      const mattressH = H * 0.18;
      const blanketD = Math.max(0.05, (D - 0.08) * 0.62);
      const parts: FurnPart[] = [
        { key: 'frame', size: [W, baseH, D], pos: [0, baseH / 2, 0], color: frame },
        // headboard along the back edge — the head of the bed
        { key: 'headboard', size: [W, H - baseH, 0.05], pos: [0, baseH + (H - baseH) / 2, -(D / 2 - 0.025)], color: frame },
        { key: 'mattress', size: [Math.max(0.05, W - 0.06), mattressH, Math.max(0.05, D - 0.08)], pos: [0, baseH + mattressH / 2, 0.01], color: '#e8e4da' },
        // blanket covers the foot end
        { key: 'blanket', size: [Math.max(0.05, W - 0.05), mattressH * 0.6, blanketD], pos: [0, baseH + mattressH + mattressH * 0.3 - 0.02, D / 2 - 0.04 - blanketD / 2], color: '#9aa9b8' },
      ];
      const pillows = W > 1.1 ? 2 : 1;
      const pw = Math.max(0.05, (W - 0.2 - 0.06 * (pillows - 1)) / pillows);
      const pd = Math.max(0.05, Math.min(0.4, D * 0.2));
      for (let i = 0; i < pillows; i++) {
        parts.push({
          key: `pillow${i}`,
          size: [pw, 0.07, pd],
          pos: [-(W - 0.2) / 2 + pw / 2 + i * (pw + 0.06), baseH + mattressH + 0.035, -(D / 2 - 0.07 - pd / 2)],
          color: '#f3f1ec',
        });
      }
      return parts;
    }

    case 'tv':
    case 'monitor': {
      const metal = '#9aa3ad';
      const standH = H * 0.35;
      const screenD = Math.min(0.06, D * 0.4);
      return [
        { key: 'foot', size: [Math.max(0.08, W * 0.4), 0.03, Math.max(0.05, D * 0.8)], pos: [0, 0.015, 0], color: metal },
        { key: 'neck', size: [Math.max(0.05, W * 0.06), standH, Math.max(0.04, D * 0.25)], pos: [0, standH / 2, 0], color: metal },
        { key: 'screen', size: [W, H - standH, screenD], pos: [0, standH + (H - standH) / 2, 0], color: '#1d2126' },
        // faint panel front so the screen face reads at the iso angle
        { key: 'glow', size: [Math.max(0.05, W - 0.08), Math.max(0.05, H - standH - 0.08), 0.012], pos: [0, standH + (H - standH) / 2, screenD / 2], color: '#3b4654' },
      ];
    }

    case 'bathtub': {
      const rim = 0.07;
      return [
        { key: 'body', size: [W, H, D], pos: [0, H / 2, 0], color: '#f2f1ee' },
        { key: 'basin', size: [Math.max(0.05, W - 2 * rim), 0.02, Math.max(0.05, D - 2 * rim)], pos: [0, H - 0.009, 0], color: '#cfe5ef' },
        { key: 'tap', size: [0.05, 0.07, 0.05], pos: [0, H - 0.005, -(D / 2 - rim / 2)], color: '#c9ccd1' },
      ];
    }


    case 'fridge': {
      const body = '#eceae6';
      const door = '#f4f2ee';
      const split = H * 0.62; // freezer below, fridge above
      return [
        { key: 'body', size: [W, H, D], pos: [0, H / 2, 0], color: body },
        { key: 'doorTop', size: [Math.max(0.08, W - 0.05), Math.max(0.06, H - split - 0.05), 0.028], pos: [0, split + (H - split) / 2, D / 2], color: door },
        { key: 'doorBottom', size: [Math.max(0.08, W - 0.05), Math.max(0.06, split - 0.07), 0.028], pos: [0, split / 2 - 0.01, D / 2], color: door },
        { key: 'handleTop', size: [0.028, Math.min(0.3, (H - split) * 0.5), 0.026], pos: [-(W / 2 - 0.07), split + (H - split) / 2, D / 2 + 0.024], color: '#c4c7cb' },
        { key: 'handleBottom', size: [0.028, Math.min(0.25, split * 0.4), 0.026], pos: [-(W / 2 - 0.07), split / 2, D / 2 + 0.024], color: '#c4c7cb' },
      ];
    }

    case 'counter':
    case 'stove':
    case 'sink': {
      const body = '#e7e4de';
      const worktop = kind === 'stove' ? '#3a3f45' : '#8d8780';
      const parts: FurnPart[] = [
        { key: 'body', size: [W, H - 0.04, D], pos: [0, (H - 0.04) / 2, 0], color: body },
        { key: 'top', size: [W + 0.03, 0.04, D + 0.03], pos: [0, H - 0.02, 0], color: worktop },
        { key: 'plinth', size: [Math.max(0.05, W - 0.06), 0.07, Math.max(0.05, D - 0.06)], pos: [0, 0.035, 0.01], color: '#b9b4ac' },
      ];
      if (kind === 'stove') {
        const bx = Math.min(0.16, W * 0.24);
        const bz = Math.min(0.16, D * 0.24);
        const burner = Math.max(0.05, Math.min(0.14, Math.min(W, D) * 0.26));
        for (const [i, [sx, sz]] of [[-1, -1], [1, -1], [-1, 1], [1, 1]].entries()) {
          parts.push({
            key: `burner${i}`,
            size: [burner, 0.014, burner],
            pos: [sx * bx, H + 0.007, sz * bz],
            color: '#15181b',
          });
        }
        parts.push({
          key: 'ovenDoor',
          size: [Math.max(0.08, W - 0.1), Math.max(0.08, H * 0.45), 0.024],
          pos: [0, H * 0.38, D / 2],
          color: '#2c3137',
        });
      }
      if (kind === 'sink') {
        parts.push({
          key: 'basin',
          size: [Math.max(0.05, W - 0.18), 0.016, Math.max(0.05, D - 0.18)],
          pos: [0, H + 0.008, 0],
          color: '#b9bec4',
        });
        parts.push({ key: 'tap', size: [0.045, 0.06, 0.045], pos: [0, H, -(D / 2 - 0.09)], color: '#c9ccd1' });
      }
      if (kind === 'counter') {
        // drawer fronts so a counter run reads as kitchen cabinets
        parts.push({
          key: 'drawer',
          size: [Math.max(0.08, W - 0.08), Math.max(0.05, (H - 0.04) * 0.18), 0.022],
          pos: [0, H * 0.72, D / 2],
          color: '#dfdbd3',
        });
        parts.push({
          key: 'doorFront',
          size: [Math.max(0.08, W - 0.08), Math.max(0.08, (H - 0.04) * 0.5), 0.022],
          pos: [0, H * 0.34, D / 2],
          color: '#dfdbd3',
        });
      }
      return parts;
    }

    case 'washbasin': {
      return [
        { key: 'pedestal', size: [Math.max(0.06, W * 0.28), H - 0.12, Math.max(0.06, D * 0.32)], pos: [0, (H - 0.12) / 2, -(D * 0.05)], color: '#e8e7e4' },
        { key: 'basin', size: [W, 0.12, D], pos: [0, H - 0.06, 0], color: '#f2f1ee' },
        { key: 'bowl', size: [Math.max(0.05, W - 0.12), 0.014, Math.max(0.05, D - 0.12)], pos: [0, H + 0.007 - 0.012, 0.01], color: '#dfe9ee' },
        { key: 'tap', size: [0.04, 0.05, 0.04], pos: [0, H + 0.005, -(D / 2 - 0.06)], color: '#c9ccd1' },
      ];
    }

    case 'toilet': {
      const tankD = Math.min(0.16, D * 0.3);
      const seatH = H * 0.55;
      return [
        { key: 'tank', size: [Math.max(0.08, W - 0.06), H - 0.06, tankD], pos: [0, (H - 0.06) / 2, -(D / 2 - tankD / 2)], color: '#f2f1ee' },
        { key: 'lid', size: [Math.max(0.08, W - 0.04), 0.03, tankD + 0.02], pos: [0, H - 0.045, -(D / 2 - tankD / 2)], color: '#e8e7e4' },
        { key: 'bowl', size: [Math.max(0.08, W - 0.08), seatH, Math.max(0.08, D - tankD - 0.06)], pos: [0, seatH / 2, tankD / 2 + 0.01], color: '#f2f1ee' },
        { key: 'seat', size: [Math.max(0.08, W - 0.06), 0.025, Math.max(0.08, D - tankD - 0.04)], pos: [0, seatH + 0.0125, tankD / 2 + 0.01], color: '#fbfaf8' },
      ];
    }

    case 'shower': {
      const glass = '#cfe0ea';
      const trayH = 0.06;
      return [
        { key: 'tray', size: [W, trayH, D], pos: [0, trayH / 2, 0], color: '#e8e7e4' },
        // glass on the two open sides; the other two stand at walls
        { key: 'glassFront', size: [W, H - trayH - 0.15, 0.018], pos: [0, trayH + (H - trayH - 0.15) / 2, D / 2 - 0.009], color: glass },
        { key: 'glassRight', size: [0.018, H - trayH - 0.15, D], pos: [W / 2 - 0.009, trayH + (H - trayH - 0.15) / 2, 0], color: glass },
        { key: 'riser', size: [0.035, H - trayH, 0.035], pos: [-(W / 2 - 0.05), (H + trayH) / 2 - 0.03, -(D / 2 - 0.05)], color: '#c9ccd1' },
        { key: 'head', size: [0.14, 0.02, 0.14], pos: [-(W / 2 - 0.14), H - 0.05, -(D / 2 - 0.14)], color: '#c9ccd1' },
      ];
    }

    case 'plant': {
      const rnd = hash(seed);
      const potH = H * 0.28;
      const parts: FurnPart[] = [
        { key: 'pot', size: [W * 0.62, potH, D * 0.62], pos: [0, potH / 2, 0], color: '#a96a48' },
        { key: 'soil', size: [W * 0.5, 0.02, D * 0.5], pos: [0, potH - 0.005, 0], color: '#4a3a2c' },
        { key: 'stem', size: [0.03, H * 0.4, 0.03], pos: [0, potH + H * 0.2, 0], color: '#5a4632' },
      ];
      const GREENS = ['#5d8a4f', '#6f9c5e', '#4f7a43'];
      for (let i = 0; i < 3; i++) {
        const size = (0.9 - i * 0.22) * Math.min(W, D);
        parts.push({
          key: `leaf${i}`,
          size: [size, H * 0.18, size],
          pos: [(rnd() - 0.5) * 0.05, potH + H * (0.22 + i * 0.17), (rnd() - 0.5) * 0.05],
          color: GREENS[i % GREENS.length],
        });
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
