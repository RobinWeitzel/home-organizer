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
    case 'desk':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <rect
            x={f.x + f.w * 0.62}
            y={f.y + 0.08}
            width={f.w * 0.3}
            height={Math.max(0.1, f.h - 0.16)}
          />
        </g>
      );
    case 'table':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <rect
            x={f.x + 0.12}
            y={f.y + 0.12}
            width={Math.max(0.1, f.w - 0.24)}
            height={Math.max(0.1, f.h - 0.24)}
            rx={0.1}
          />
        </g>
      );
    case 'chair':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <line x1={f.x + 0.05} y1={f.y + 0.1} x2={f.x + f.w - 0.05} y2={f.y + 0.1} />
        </g>
      );
    case 'sofa':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <line x1={f.x + 0.07} y1={f.y + 0.2} x2={f.x + f.w - 0.07} y2={f.y + 0.2} />
          <line x1={f.x + 0.16} y1={f.y + 0.2} x2={f.x + 0.16} y2={f.y + f.h} />
          <line x1={f.x + f.w - 0.16} y1={f.y + 0.2} x2={f.x + f.w - 0.16} y2={f.y + f.h} />
          <line x1={f.x + f.w / 2} y1={f.y + 0.2} x2={f.x + f.w / 2} y2={f.y + f.h - 0.07} />
        </g>
      );
    case 'bed': {
      const pillowLine = f.y + Math.min(0.6, f.h * 0.3);
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <line x1={f.x} y1={pillowLine} x2={f.x + f.w} y2={pillowLine} />
          <rect
            x={f.x + 0.12}
            y={f.y + 0.1}
            width={Math.max(0.1, f.w / 2 - 0.2)}
            height={Math.max(0.08, pillowLine - f.y - 0.2)}
            rx={0.05}
          />
          {f.w > 1.1 && (
            <rect
              x={f.x + f.w / 2 + 0.08}
              y={f.y + 0.1}
              width={Math.max(0.1, f.w / 2 - 0.2)}
              height={Math.max(0.08, pillowLine - f.y - 0.2)}
              rx={0.05}
            />
          )}
        </g>
      );
    }
    case 'tv':
      return (
        <g className="furniture-deco" strokeWidth={0.07}>
          <line x1={f.x + 0.06} y1={f.y + f.h / 2} x2={f.x + f.w - 0.06} y2={f.y + f.h / 2} />
        </g>
      );
    case 'bathtub':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <rect
            x={f.x + 0.1}
            y={f.y + 0.1}
            width={Math.max(0.1, f.w - 0.2)}
            height={Math.max(0.1, f.h - 0.2)}
            rx={Math.min(0.18, f.h / 3)}
          />
          <circle cx={f.x + Math.min(0.3, f.w * 0.18)} cy={f.y + f.h / 2} r={0.05} />
        </g>
      );
    default:
      return null;
  }
}
