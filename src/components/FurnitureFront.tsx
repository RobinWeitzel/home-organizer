import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  frontGeometry,
  frontRegions,
  groupBand,
  placementAt,
  placementLine,
  type AreaPlacement,
} from '../model/frontLayout';
import type { Furniture, FurnitureKind, StorageArea } from '../model/types';

/** wood tones lifted from the 3D furniture parts so the sheet matches the render */
const WOOD: Record<FurnitureKind, { body: string; face: string; plinth: string }> = {
  wardrobe: { body: '#4a2e25', face: '#7a5443', plinth: '#3a231c' },
  dresser: { body: '#684a3e', face: '#94705f', plinth: '#52382f' },
  cabinet: { body: '#8a6244', face: '#ab8260', plinth: '#6d4d35' },
  chest: { body: '#6b4226', face: '#91613a', plinth: '#54341e' },
  // open shelving: faces are the dark interior, like the 3D back panel
  shelf: { body: '#96693f', face: '#5d3f26', plinth: '#7a5532' },
  other: { body: '#998878', face: '#a89786', plinth: '#7d6e5f' },
  // furnishing rarely opens this sheet (no default areas) — sensible tones anyway
  desk: { body: '#56402f', face: '#6e4f3a', plinth: '#463325' },
  table: { body: '#6d5238', face: '#8a6a4a', plinth: '#594330' },
  chair: { body: '#7a5a3e', face: '#8d6a48', plinth: '#634830' },
  sofa: { body: '#67737e', face: '#7d8a96', plinth: '#545e67' },
  bed: { body: '#6e4f3a', face: '#e8e4da', plinth: '#594030' },
  tv: { body: '#1d2126', face: '#3b4654', plinth: '#15181c' },
  monitor: { body: '#1d2126', face: '#3b4654', plinth: '#15181c' },
  fridge: { body: '#d9d7d2', face: '#f4f2ee', plinth: '#b9b7b2' },
  counter: { body: '#c9c4bb', face: '#e7e4de', plinth: '#a8a49c' },
  stove: { body: '#c9c4bb', face: '#3a3f45', plinth: '#a8a49c' },
  sink: { body: '#c9c4bb', face: '#b9bec4', plinth: '#a8a49c' },
  washbasin: { body: '#d9d8d4', face: '#f2f1ee', plinth: '#b9b8b4' },
  toilet: { body: '#d9d8d4', face: '#f2f1ee', plinth: '#b9b8b4' },
  shower: { body: '#b9c6ce', face: '#cfe0ea', plinth: '#9aa6ad' },
  bathtub: { body: '#d9d8d4', face: '#f2f1ee', plinth: '#b9b8b4' },
  plant: { body: '#a96a48', face: '#5d8a4f', plinth: '#8a5538' },
};

const HANDLE = '#e9e2d4';
const DRAG_THRESHOLD_PX = 6;

interface DragState {
  areaId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  /** pointer position in face coordinates */
  x: number;
  y: number;
  active: boolean;
}

/**
 * Front elevation of a furniture piece with its storage areas laid out the way
 * the real thing looks: drawers stacked for dressers, sections side by side
 * for wardrobes, open compartments for shelves. Groups form the main bands
 * (rows for most kinds, columns for wardrobes); areas sharing a group split
 * the band, so larger units can be full grids. Areas are tappable; the one
 * holding a searched item glows. With `editable`, areas can be dragged to a
 * new spot: the middle of a band drops in beside its areas, the seams between
 * bands drop into a band of their own.
 */
export default function FurnitureFront({
  furniture,
  areas,
  selectedAreaId,
  highlightAreaId,
  counts,
  onSelect,
  editable = false,
  onPlace,
}: {
  furniture: Furniture;
  areas: StorageArea[];
  selectedAreaId: string | null;
  highlightAreaId: string | null;
  counts: Map<string, number>;
  onSelect: (id: string) => void;
  editable?: boolean;
  onPlace?: (id: string, placement: AreaPlacement) => void;
}) {
  const kind = furniture.kind;
  const wood = WOOD[kind];
  const open = kind === 'shelf' || kind === 'other';
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const geom = frontGeometry(furniture, areas);
  const { W, H } = geom;
  const regions = frontRegions(geom);

  const facePoint = (e: ReactPointerEvent) => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onAreaPointerDown = (areaId: string) => (e: ReactPointerEvent) => {
    if (!editable || !onPlace) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const { x, y } = facePoint(e);
    setDrag({ areaId, pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, x, y, active: false });
  };

  const onAreaPointerMove = (e: ReactPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { x, y } = facePoint(e);
    const active =
      drag.active ||
      Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY) > DRAG_THRESHOLD_PX;
    setDrag({ ...drag, x, y, active });
  };

  const onAreaPointerEnd = (e: ReactPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.active && e.type === 'pointerup') {
      onPlace?.(drag.areaId, placementAt(geom, drag.x, drag.y));
    }
    setDrag(null);
  };

  const placement = drag?.active ? placementAt(geom, drag.x, drag.y) : null;
  const line = placement ? placementLine(geom, placement) : null;
  // dropping into a band tints the whole band; dropping on a seam shows just the line
  const band = placement && 'group' in placement ? groupBand(geom, placement.group) : null;
  const dragged = drag?.active ? regions.find((r) => r.area.id === drag.areaId) : undefined;

  // scale the rendered height with the piece's real proportions: a wardrobe
  // reads tall, a sideboard low — clamped so the sheet stays balanced
  const heightPx = Math.round(Math.min(215, Math.max(110, 330 * (H / W))));

  const pad = 0.1;
  return (
    <svg
      ref={svgRef}
      className="front-svg"
      viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${H + 2.2 * pad}`}
      style={{ width: '100%', height: heightPx, touchAction: editable ? 'none' : undefined }}
    >
      <defs>
        <filter id="front-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={0.035} />
        </filter>
      </defs>
      {/* the piece floats on a soft shadow, like the 3D scene */}
      <ellipse cx={W / 2} cy={H + 0.045} rx={W * 0.52} ry={0.05} className="front-shadow" filter="url(#front-soft)" />
      <rect x={0} y={0} width={W} height={H} rx={0.025} fill={wood.body} />
      {/* faint top sheen grounds the body */}
      <rect x={0.015} y={0.015} width={W - 0.03} height={0.025} rx={0.012} fill="#ffffff" opacity={0.07} />
      <rect x={0} y={H - 0.045} width={W} height={0.045} rx={0.02} fill={wood.plinth} />
      {regions.map(({ area, x, y, w, h }) => {
        const count = counts.get(area.id) ?? 0;
        const selected = area.id === selectedAreaId;
        const highlighted = area.id === highlightAreaId;
        const lifting = drag?.active && drag.areaId === area.id;
        // the name shrinks to fit, but never below the floor — past that it
        // truncates instead of disappearing (a nameless compartment can't be
        // told apart in the editor)
        const fitSize = (w * 1.45) / Math.max(1, area.name.length);
        const nameSize = Math.min(0.105, h * 0.24, Math.max(fitSize, 0.05));
        const showName = h * 0.24 >= 0.05;
        const maxChars = Math.floor((w * 1.45) / nameSize);
        const label =
          area.name.length <= maxChars ? area.name : `${area.name.slice(0, Math.max(1, maxChars - 1))}…`;
        const countSize = Math.min(0.066, h * 0.16, (w * 1.45) / 8);
        const showCount = count > 0 && countSize >= 0.045 && h > nameSize * 3;
        const cx = x + w / 2;
        const cy = y + h / 2;
        return (
          <g
            key={area.id}
            onClick={() => onSelect(area.id)}
            onPointerDown={onAreaPointerDown(area.id)}
            onPointerMove={onAreaPointerMove}
            onPointerUp={onAreaPointerEnd}
            onPointerCancel={onAreaPointerEnd}
            style={{ cursor: editable ? 'grab' : 'pointer' }}
            opacity={lifting ? 0.35 : 1}
          >
            <rect x={x} y={y} width={w} height={h} rx={0.02} fill={wood.face} />
            {/* depth: shadow line under each front / inside each compartment */}
            {open ? (
              <rect x={x} y={y} width={w} height={0.025} fill="#000" opacity={0.28} />
            ) : (
              <>
                <rect x={x} y={y + h - 0.018} width={w} height={0.018} rx={0.009} fill="#000" opacity={0.18} />
                <rect x={x} y={y} width={w} height={0.014} rx={0.007} fill="#fff" opacity={0.1} />
              </>
            )}
            {kind === 'dresser' || kind === 'chest' ? (
              <rect
                x={cx - Math.min(0.14, w * 0.14)}
                y={y + Math.min(0.06, h * 0.14)}
                width={Math.min(0.28, w * 0.28)}
                height={0.026}
                rx={0.013}
                fill={HANDLE}
                opacity={0.9}
              />
            ) : kind === 'wardrobe' ? (
              <rect
                x={x + w - 0.07}
                y={cy - Math.min(0.14, h * 0.1)}
                width={0.026}
                height={Math.min(0.28, h * 0.2)}
                rx={0.013}
                fill={HANDLE}
                opacity={0.9}
              />
            ) : kind === 'cabinet' ? (
              <circle cx={x + w - 0.06} cy={cy} r={0.024} fill={HANDLE} opacity={0.9} />
            ) : null}
            {highlighted && <rect className="front-glow" x={x} y={y} width={w} height={h} rx={0.02} />}
            {selected && !highlighted && (
              <rect className="front-area-selected" x={x} y={y} width={w} height={h} rx={0.02} />
            )}
            {showName && (
              <text
                className="front-label"
                x={cx}
                y={cy + nameSize * 0.35 - (showCount ? countSize * 0.7 : 0)}
                textAnchor="middle"
                fontSize={nameSize}
              >
                {label}
              </text>
            )}
            {showCount && (
              <text
                className="front-count"
                x={cx}
                y={cy + nameSize * 0.55 + countSize * 0.85}
                textAnchor="middle"
                fontSize={countSize}
              >
                {count} item{count === 1 ? '' : 's'}
              </text>
            )}
          </g>
        );
      })}
      {band && <rect className="front-drop-band" x={band.x} y={band.y} width={band.w} height={band.h} rx={0.02} />}
      {dragged && drag && (
        // a shrunken ghost, so the drop indicator stays visible underneath
        <g pointerEvents="none" opacity={0.85}>
          <rect
            className="front-drag-ghost"
            x={drag.x - dragged.w * 0.275}
            y={drag.y - dragged.h * 0.275}
            width={dragged.w * 0.55}
            height={dragged.h * 0.55}
            rx={0.02}
            fill={wood.face}
          />
          <text
            className="front-label"
            x={drag.x}
            y={drag.y + 0.022}
            textAnchor="middle"
            fontSize={Math.min(0.07, (dragged.w * 0.55 * 1.45) / Math.max(1, dragged.area.name.length))}
          >
            {dragged.area.name}
          </text>
        </g>
      )}
      {line && (
        <line className="front-drop-line" x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
      )}
    </svg>
  );
}
