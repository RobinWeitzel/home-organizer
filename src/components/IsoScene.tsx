import { polygonEdges } from '../model/cells';
import { KIND_HEIGHTS, type Projection } from '../model/iso';
import type { Furniture, Pt, Rect, Room } from '../model/types';

const pts = (points: Pt[]) => points.map((p) => `${p.x} ${p.y}`).join(' ');

export function projectPath(proj: Projection, polygon: Pt[]): string {
  return (
    polygon
      .map((p, i) => {
        const s = proj.project(p.x, p.y);
        return `${i === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
      })
      .join(' ') + ' Z'
  );
}

export function projectRectPoints(proj: Projection, r: Rect): string {
  return pts([
    proj.project(r.x, r.y),
    proj.project(r.x + r.w, r.y),
    proj.project(r.x + r.w, r.y + r.h),
    proj.project(r.x, r.y + r.h),
  ]);
}

/** screen silhouette of an extruded box (hexagon; degenerates to the rect at zero lift) */
export function boxSilhouette(proj: Projection, r: Rect, h: number): string {
  const x2 = r.x + r.w;
  const y2 = r.y + r.h;
  return pts([
    proj.project(r.x, r.y, h),
    proj.project(x2, r.y, h),
    proj.project(x2, r.y, 0),
    proj.project(x2, y2, 0),
    proj.project(r.x, y2, 0),
    proj.project(r.x, y2, h),
  ]);
}

/** item-count chip drawn as a UI overlay above the scene so walls never clip it */
export function FurnCountBadge({
  proj,
  f,
  count,
}: {
  proj: Projection;
  f: Furniture;
  count: number;
}) {
  const p = proj.project(f.x + f.w, f.y, KIND_HEIGHTS[f.kind]);
  return (
    <g pointerEvents="none">
      <circle cx={p.x} cy={p.y} r={0.17} className="count-badge" />
      <text x={p.x} y={p.y + 0.075} textAnchor="middle" fontSize={0.2} fill="#fff" fontWeight={700}>
        {count}
      </text>
    </g>
  );
}

/** wall length labels + edge midpoint handles (iso twin of RoomDimensions) */
export function IsoRoomDimensions({
  proj,
  room,
  scale,
}: {
  proj: Projection;
  room: Room;
  scale: number;
}) {
  const handleR = 8 / scale;
  return (
    <g>
      {polygonEdges(room.polygon).map((e, i) => {
        const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
        const lp = proj.project(mid.x + e.inward.x * 0.42, mid.y + e.inward.y * 0.42);
        const hp = proj.project(mid.x, mid.y);
        return (
          <g key={i}>
            <text className="dim-label" x={lp.x} y={lp.y + 0.12} textAnchor="middle">
              {e.len} m
            </text>
            <rect
              className="edge-handle"
              x={hp.x - handleR}
              y={hp.y - handleR}
              width={handleR * 2}
              height={handleR * 2}
              strokeWidth={2 / scale}
            />
          </g>
        );
      })}
    </g>
  );
}
