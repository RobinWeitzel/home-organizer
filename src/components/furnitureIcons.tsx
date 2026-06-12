import { furnitureFacing } from '../model/scene3d';
import type { Furniture } from '../model/types';

/**
 * Kind-specific line decoration drawn inside the furniture rect. The shapes
 * are authored for a south-facing piece; DecoShapes receives a virtual rect
 * in that frame and the wrapper rotates it onto the real footprint.
 */
export function FurnitureDeco({ f }: { f: Furniture }) {
  const facing = furnitureFacing(f);
  if (facing === 0) return <DecoShapes f={f} />;
  const cx = f.x + f.w / 2;
  const cy = f.y + f.h / 2;
  const sideways = facing % 2 === 1;
  const lw = sideways ? f.h : f.w;
  const lh = sideways ? f.w : f.h;
  const vf = { ...f, x: cx - lw / 2, y: cy - lh / 2, w: lw, h: lh };
  return (
    <g transform={`rotate(${facing * 90} ${cx} ${cy})`}>
      <DecoShapes f={vf} />
    </g>
  );
}

function DecoShapes({ f }: { f: Furniture }) {
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
    case 'monitor':
      return (
        <g className="furniture-deco" strokeWidth={0.05}>
          <line x1={f.x + 0.04} y1={f.y + f.h / 2} x2={f.x + f.w - 0.04} y2={f.y + f.h / 2} />
        </g>
      );
    case 'fridge':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <rect x={f.x + 0.08} y={f.y + 0.08} width={Math.max(0.1, f.w - 0.16)} height={Math.max(0.1, f.h - 0.16)} />
          <line x1={f.x + 0.08} y1={f.y + f.h / 2} x2={f.x + f.w - 0.08} y2={f.y + f.h / 2} />
        </g>
      );
    case 'counter':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <rect x={f.x + 0.06} y={f.y + 0.06} width={Math.max(0.1, f.w - 0.12)} height={Math.max(0.1, f.h - 0.12)} />
        </g>
      );
    case 'stove': {
      const rx = Math.min(0.12, f.w * 0.18);
      const ox = f.w * 0.27;
      const oy = f.h * 0.27;
      const cx = f.x + f.w / 2;
      const cy = f.y + f.h / 2;
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <circle cx={cx - ox} cy={cy - oy} r={rx} />
          <circle cx={cx + ox} cy={cy - oy} r={rx} />
          <circle cx={cx - ox} cy={cy + oy} r={rx} />
          <circle cx={cx + ox} cy={cy + oy} r={rx} />
        </g>
      );
    }
    case 'sink':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <rect
            x={f.x + 0.1}
            y={f.y + 0.1}
            width={Math.max(0.1, f.w - 0.2)}
            height={Math.max(0.1, f.h - 0.2)}
            rx={0.06}
          />
          <circle cx={f.x + f.w / 2} cy={f.y + 0.16} r={0.04} />
        </g>
      );
    case 'washbasin':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <ellipse cx={f.x + f.w / 2} cy={f.y + f.h / 2 + 0.02} rx={Math.max(0.08, f.w / 2 - 0.1)} ry={Math.max(0.06, f.h / 2 - 0.1)} />
          <circle cx={f.x + f.w / 2} cy={f.y + 0.08} r={0.035} />
        </g>
      );
    case 'toilet': {
      const tank = f.y + Math.min(0.18, f.h * 0.3);
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <line x1={f.x + 0.05} y1={tank} x2={f.x + f.w - 0.05} y2={tank} />
          <ellipse
            cx={f.x + f.w / 2}
            cy={tank + (f.y + f.h - tank) / 2}
            rx={Math.max(0.06, f.w / 2 - 0.08)}
            ry={Math.max(0.06, (f.y + f.h - tank) / 2 - 0.08)}
          />
        </g>
      );
    }
    case 'shower':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <line x1={f.x + 0.06} y1={f.y + 0.06} x2={f.x + f.w - 0.06} y2={f.y + f.h - 0.06} strokeDasharray="0.1 0.08" />
          <circle cx={f.x + Math.min(0.22, f.w * 0.25)} cy={f.y + Math.min(0.22, f.h * 0.25)} r={0.07} />
        </g>
      );
    case 'plant':
      return (
        <g className="furniture-deco" strokeWidth={sw}>
          <circle cx={f.x + f.w / 2} cy={f.y + f.h / 2} r={Math.max(0.06, Math.min(f.w, f.h) / 2 - 0.06)} />
          <circle cx={f.x + f.w / 2} cy={f.y + f.h / 2} r={Math.max(0.03, Math.min(f.w, f.h) / 5)} />
        </g>
      );
    default:
      return null;
  }
}
