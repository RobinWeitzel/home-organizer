import type { Furniture } from '../model/types';

/** Kind-specific line decoration drawn inside the furniture rect. */
export function FurnitureDeco({ f }: { f: Furniture }) {
  const sw = 0.04;
  switch (f.kind) {
    case 'dresser':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <line x1={f.x} y1={f.y + f.h / 3} x2={f.x + f.w} y2={f.y + f.h / 3} />
          <line x1={f.x} y1={f.y + (2 * f.h) / 3} x2={f.x + f.w} y2={f.y + (2 * f.h) / 3} />
        </g>
      );
    case 'shelf':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <line x1={f.x + f.w / 3} y1={f.y} x2={f.x + f.w / 3} y2={f.y + f.h} />
          <line x1={f.x + (2 * f.w) / 3} y1={f.y} x2={f.x + (2 * f.w) / 3} y2={f.y + f.h} />
        </g>
      );
    case 'wardrobe':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <line x1={f.x + f.w / 2} y1={f.y} x2={f.x + f.w / 2} y2={f.y + f.h} />
          <circle cx={f.x + f.w / 2 - 0.12} cy={f.y + f.h / 2} r={0.04} />
          <circle cx={f.x + f.w / 2 + 0.12} cy={f.y + f.h / 2} r={0.04} />
        </g>
      );
    case 'cabinet':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <rect x={f.x + 0.12} y={f.y + 0.12} width={Math.max(0.1, f.w - 0.24)} height={Math.max(0.1, f.h - 0.24)} />
        </g>
      );
    case 'chest':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <line x1={f.x} y1={f.y + 0.18} x2={f.x + f.w} y2={f.y + 0.18} />
        </g>
      );
    default:
      return null;
  }
}
