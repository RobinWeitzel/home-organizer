import { describe, expect, it } from 'vitest';
import { FURNITURE_COLORS, planTint, shiftColor } from './furnitureColors';

describe('shiftColor', () => {
  it('keeps the reference colour itself close to the target', () => {
    expect(shiftColor('#6e4f3a', '#6e4f3a', FURNITURE_COLORS.black.hex)).toBe(
      FURNITURE_COLORS.black.hex,
    );
  });

  it('preserves relative lightness: faces stay lighter than bodies', () => {
    const target = FURNITURE_COLORS.navy.hex;
    const body = shiftColor('#684a3e', '#684a3e', target); // dresser body
    const face = shiftColor('#94705f', '#684a3e', target); // lighter drawer front
    const l = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    expect(l(face)).toBeGreaterThan(l(body));
  });

  it('clamps instead of blowing out at the extremes', () => {
    const white = FURNITURE_COLORS.white.hex;
    const out = shiftColor('#f4f2ee', '#2e3136', white); // very light part, dark ref
    expect(out.startsWith('#')).toBe(true);
    expect(out.length).toBe(7);
  });
});

describe('planTint', () => {
  it('produces a light wash for every colour', () => {
    for (const key of Object.keys(FURNITURE_COLORS) as (keyof typeof FURNITURE_COLORS)[]) {
      const hex = planTint(key);
      const n = parseInt(hex.slice(1), 16);
      const avg = (((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255)) / 3;
      expect(avg).toBeGreaterThan(150); // readable as a background
    }
  });
});
