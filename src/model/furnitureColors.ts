/**
 * Optional furniture colours. A piece without one keeps its kind's built-in
 * palette; picking a colour re-tints the palette while preserving each
 * part's relative light/dark contrast, so drawer fronts stay lighter than
 * bodies and shadows stay shadows. Functional details (knobs, glass,
 * screens, basins, linen) are marked fixed and never re-tint.
 */
export type FurnitureColor = 'brown' | 'oak' | 'white' | 'gray' | 'black' | 'navy';

export const FURNITURE_COLORS: Record<FurnitureColor, { label: string; hex: string }> = {
  brown: { label: 'Brown', hex: '#6e4f3a' },
  oak: { label: 'Oak', hex: '#c69a66' },
  white: { label: 'White', hex: '#e9e7e2' },
  gray: { label: 'Gray', hex: '#878c94' },
  black: { label: 'Black', hex: '#2e3136' },
  navy: { label: 'Navy', hex: '#41566f' },
};

export const FURNITURE_COLOR_KEYS = Object.keys(FURNITURE_COLORS) as FurnitureColor[];

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Re-tint a palette colour: take hue/saturation from the target and keep the
 * part's lightness offset relative to the palette's reference colour.
 */
export function shiftColor(partHex: string, refHex: string, targetHex: string): string {
  const part = hexToHsl(partHex);
  const ref = hexToHsl(refHex);
  const target = hexToHsl(targetHex);
  return hslToHex({
    h: target.h,
    s: target.s,
    l: Math.min(0.96, Math.max(0.05, target.l + (part.l - ref.l))),
  });
}

/** Pale wash of a colour for the 2D plan's furniture fill. */
export function planTint(color: FurnitureColor): string {
  const { h, s, l } = hexToHsl(FURNITURE_COLORS[color].hex);
  return hslToHex({ h, s: Math.min(s, 0.45), l: 0.82 + l * 0.1 });
}
