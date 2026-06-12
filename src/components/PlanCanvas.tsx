import { useMemo, useRef } from 'react';
import {
  areaOfCells,
  centroidOfCells,
  polygonCells,
  polygonEdges,
  rectInsideCells,
} from '../model/cells';
import { wallItemSegment } from '../model/geometry';
import { type Projection } from '../model/iso';
import { useApp } from '../model/store';
import type { FurnitureKind, Room, WallItem } from '../model/types';
import { FurnitureDeco } from './furnitureIcons';
import { usePlanPointer, type ShapeOp, type Tool, type View } from './usePlanPointer';

const WALL_W = 0.15;

function polygonPath(polygon: Room['polygon']): string {
  return polygon.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
}

function WallItemShape({ w, room, selected }: { w: WallItem; room: Room; selected: boolean }) {
  const seg = wallItemSegment(w, room.polygon);
  if (!seg) return null;
  const { from, to, inward } = seg;
  if (w.type === 'window') {
    return (
      <g>
        <line className="wall-gap" x1={from.x} y1={from.y} x2={to.x} y2={to.y} strokeWidth={WALL_W * 1.4} />
        <line
          className={selected ? 'window-glass window-glass-selected' : 'window-glass'}
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          strokeWidth={0.07}
        />
      </g>
    );
  }
  if (w.type === 'opening') {
    return (
      <g>
        <line className="wall-gap" x1={from.x} y1={from.y} x2={to.x} y2={to.y} strokeWidth={WALL_W * 1.4} />
        <line
          className={selected ? 'opening-line opening-line-selected' : 'opening-line'}
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          strokeWidth={0.04}
          strokeDasharray="0.12 0.1"
        />
      </g>
    );
  }
  // the leaf hangs on the hinge jamb and swings to the latch side; both are
  // flippable per door
  const hinge = w.hingeAtEnd ? to : from;
  const latch = w.hingeAtEnd ? from : to;
  const swing = w.swingOutward ? { x: -inward.x || 0, y: -inward.y || 0 } : inward;
  const leafEnd = { x: hinge.x + swing.x * w.length, y: hinge.y + swing.y * w.length };
  const along = { x: latch.x - hinge.x, y: latch.y - hinge.y };
  const sweep = along.x * swing.y - along.y * swing.x > 0 ? 1 : 0;
  const leafClass = selected ? 'door-leaf door-leaf-selected' : 'door-leaf';
  return (
    <g>
      <line className="wall-gap" x1={from.x} y1={from.y} x2={to.x} y2={to.y} strokeWidth={WALL_W * 1.4} />
      <line className={leafClass} x1={hinge.x} y1={hinge.y} x2={leafEnd.x} y2={leafEnd.y} strokeWidth={0.06} />
      <path
        className={leafClass}
        d={`M ${latch.x} ${latch.y} A ${w.length} ${w.length} 0 0 ${sweep} ${leafEnd.x} ${leafEnd.y}`}
        fill="none"
        strokeWidth={0.03}
        strokeDasharray="0.1 0.07"
      />
    </g>
  );
}

const fmtLen = (v: number) => Math.round(v * 100) / 100;

/** True when a room is too tight for labels on every wall. */
function isSmallRoom(polygon: Room['polygon']): boolean {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  return Math.max(...xs) - Math.min(...xs) < 2.2 || Math.max(...ys) - Math.min(...ys) < 2.2;
}

/**
 * Wall length labels + edge midpoint handles for the selected room. Small
 * rooms get one label per orientation, placed outside the walls — inside
 * they'd pile up on each other.
 */
function RoomDimensions({ room, scale }: { room: Room; scale: number }) {
  const edges = polygonEdges(room.polygon);
  const handleR = 8 / scale;
  const small = isSmallRoom(room.polygon);
  let labelled = edges.map((_, i) => i);
  if (small) {
    const longest = (horizontal: boolean) => {
      let best = -1;
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        if ((e.a.y === e.b.y) !== horizontal) continue;
        if (best === -1 || e.len > edges[best].len) best = i;
      }
      return best;
    };
    labelled = [longest(true), longest(false)].filter((i) => i >= 0);
  }
  return (
    <g>
      {edges.map((e, i) => {
        const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
        const dir = small ? -0.42 : 0.42;
        const label = { x: mid.x + e.inward.x * dir, y: mid.y + e.inward.y * dir };
        return (
          <g key={i}>
            {labelled.includes(i) && (
              <text className="dim-label" x={label.x} y={label.y + 0.12} textAnchor="middle">
                {fmtLen(e.len)} m
              </text>
            )}
            <rect
              className="edge-handle"
              x={mid.x - handleR}
              y={mid.y - handleR}
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

interface PlanCanvasProps {
  view: View;
  setView: (v: View) => void;
  size: { w: number; h: number };
  projection: Projection;
  tool: Tool;
  furnitureKind: FurnitureKind;
  armedShapeOp: ShapeOp | null;
  onShapeOpDone: (ok: boolean) => void;
  onOpenFurniture: (id: string) => void;
  onMissWall: () => void;
  onPlaced?: () => void;
  browse?: boolean;
}

export default function PlanCanvas({
  view,
  setView,
  size,
  projection,
  tool,
  furnitureKind,
  armedShapeOp,
  onShapeOpDone,
  onOpenFurniture,
  onMissWall,
  onPlaced,
  browse,
}: PlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const data = useApp((s) => s.data);
  const currentFloorId = useApp((s) => s.currentFloorId);
  const selected = useApp((s) => s.selected);
  const highlightFurnitureId = useApp((s) => s.highlightFurnitureId);
  const countItemsInFurniture = useApp((s) => s.countItemsInFurniture);

  const { ghost, handlers } = usePlanPointer({
    svgRef,
    view,
    setView,
    projection,
    tool,
    furnitureKind,
    armedShapeOp,
    onShapeOpDone,
    onOpenFurniture,
    onMissWall,
    onPlaced,
    browse,
  });

  const rooms = useMemo(
    () => data.rooms.filter((r) => r.floorId === currentFloorId),
    [data.rooms, currentFloorId],
  );
  const roomGeo = useMemo(
    () =>
      new Map(
        rooms.map((r) => {
          const cells = polygonCells(r.polygon);
          return [r.id, { cells, centroid: centroidOfCells(cells), area: areaOfCells(cells) }];
        }),
      ),
    [rooms],
  );
  const roomIds = new Set(rooms.map((r) => r.id));
  // larger footprints first, so stacked pieces (TV on a lowboard) draw on top
  const furniture = data.furniture
    .filter((f) => roomIds.has(f.roomId))
    .sort((a, b) => b.w * b.h - a.w * a.h);
  const wallItems = data.wallItems.filter((w) => roomIds.has(w.roomId));

  const vw = size.w / view.scale;
  const vh = size.h / view.scale;
  const highlight = furniture.find((f) => f.id === highlightFurnitureId);
  const selectedRoom = selected?.kind === 'room' ? rooms.find((r) => r.id === selected.id) : undefined;
  const selectedFurniture =
    selected?.kind === 'furniture' ? furniture.find((f) => f.id === selected.id) : undefined;
  const selectedWallItem =
    selected?.kind === 'wallItem' ? wallItems.find((w) => w.id === selected.id) : undefined;
  const selectedWallSeg = selectedWallItem
    ? wallItemSegment(selectedWallItem, rooms.find((r) => r.id === selectedWallItem.roomId)!.polygon)
    : null;
  const handleR = 9 / view.scale;
  // a small selected room shows its dimensions instead of its name — both
  // together would be unreadable
  const labelsHiddenFor =
    selectedRoom && tool === 'select' && !armedShapeOp && isSmallRoom(selectedRoom.polygon)
      ? selectedRoom.id
      : null;

  return (
    <svg
      ref={svgRef}
      className={highlight ? 'plan-svg plan-dimming' : 'plan-svg'}
      viewBox={`${view.cx - vw / 2} ${view.cy - vh / 2} ${vw} ${vh}`}
      {...handlers}
    >
      {rooms.map((r) => {
        const geo = roomGeo.get(r.id)!;
        return (
          <g key={r.id}>
            <path className="room-rect" d={polygonPath(r.polygon)} strokeWidth={WALL_W} />
            {r.id !== labelsHiddenFor && (
              <>
                <text className="room-label" x={geo.centroid.x} y={geo.centroid.y - 0.1} textAnchor="middle">
                  {r.name}
                </text>
                <text className="area-label" x={geo.centroid.x} y={geo.centroid.y + 0.38} textAnchor="middle">
                  {Math.round(geo.area * 10) / 10} m²
                </text>
              </>
            )}
          </g>
        );
      })}
      {wallItems.map((w) => (
        <WallItemShape
          key={w.id}
          w={w}
          room={rooms.find((r) => r.id === w.roomId)!}
          selected={selected?.kind === 'wallItem' && selected.id === w.id}
        />
      ))}
      {furniture.map((f) => {
        const count = countItemsInFurniture(f.id);
        const cells = roomGeo.get(f.roomId)?.cells;
        const invalid = cells ? !rectInsideCells(f, cells) : false;
        // shrink the label to fit the rect; hide it when it would be unreadable
        const labelSize = Math.min(0.3, f.h * 0.55, (f.w * 1.7) / Math.max(1, f.name.length));
        const dimmed = highlight && f.id !== highlight.id;
        return (
          <g key={f.id} className={dimmed ? 'furn-dim' : undefined}>
            <rect
              className={invalid ? 'furniture-rect furniture-invalid' : 'furniture-rect'}
              x={f.x}
              y={f.y}
              width={f.w}
              height={f.h}
              rx={0.08}
              strokeWidth={0.05}
            />
            <FurnitureDeco f={f} />
            {labelSize >= 0.13 && (
              <text
                className="furniture-label"
                x={f.x + f.w / 2}
                y={f.y + f.h / 2 + labelSize * 0.35}
                textAnchor="middle"
                fontSize={labelSize}
              >
                {f.name}
              </text>
            )}
            {count > 0 && (
              <g pointerEvents="none">
                <circle className="count-badge" cx={f.x + f.w} cy={f.y} r={0.22} />
                <text
                  x={f.x + f.w}
                  y={f.y + 0.11}
                  textAnchor="middle"
                  fontSize={0.26}
                  fill="#fff"
                  fontWeight={700}
                >
                  {count}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {highlight && (
        <rect
          className="pulse"
          x={highlight.x - 0.15}
          y={highlight.y - 0.15}
          width={highlight.w + 0.3}
          height={highlight.h + 0.3}
          rx={0.12}
        />
      )}
      {selectedRoom && (
        <g>
          <path
            className="selected-outline"
            d={polygonPath(selectedRoom.polygon)}
            strokeWidth={0.06}
            strokeDasharray="0.15 0.1"
          />
          {tool === 'select' && !armedShapeOp && <RoomDimensions room={selectedRoom} scale={view.scale} />}
        </g>
      )}
      {selectedFurniture && (
        <g>
          <rect
            className="selected-outline"
            x={selectedFurniture.x}
            y={selectedFurniture.y}
            width={selectedFurniture.w}
            height={selectedFurniture.h}
            strokeWidth={0.06}
            strokeDasharray="0.15 0.1"
          />
          {tool === 'select' &&
            (
              [
                [selectedFurniture.x, selectedFurniture.y],
                [selectedFurniture.x + selectedFurniture.w, selectedFurniture.y],
                [selectedFurniture.x, selectedFurniture.y + selectedFurniture.h],
                [selectedFurniture.x + selectedFurniture.w, selectedFurniture.y + selectedFurniture.h],
              ] as const
            ).map(([cx, cy], i) => (
              <circle key={i} className="handle" cx={cx} cy={cy} r={handleR} strokeWidth={2 / view.scale} />
            ))}
        </g>
      )}
      {selectedWallSeg && tool === 'select' && (
        <g>
          {[selectedWallSeg.from, selectedWallSeg.to].map((p, i) => (
            <circle key={i} className="handle" cx={p.x} cy={p.y} r={handleR} strokeWidth={2 / view.scale} />
          ))}
          <text
            className="dim-label"
            x={(selectedWallSeg.from.x + selectedWallSeg.to.x) / 2 + selectedWallSeg.inward.x * 0.45}
            y={(selectedWallSeg.from.y + selectedWallSeg.to.y) / 2 + selectedWallSeg.inward.y * 0.45 + 0.12}
            textAnchor="middle"
          >
            {selectedWallItem!.length.toFixed(1).replace(/\.0$/, '')} m
          </text>
        </g>
      )}
      {ghost && (
        <g>
          <rect
            className={armedShapeOp === 'carve' ? 'ghost ghost-carve' : 'ghost'}
            x={ghost.x}
            y={ghost.y}
            width={ghost.w}
            height={ghost.h}
            strokeWidth={0.05}
          />
          <text
            className="dim-label"
            x={ghost.x + ghost.w / 2}
            y={ghost.y + ghost.h / 2 + 0.12}
            textAnchor="middle"
          >
            {fmtLen(ghost.w)} × {fmtLen(ghost.h)} m
          </text>
        </g>
      )}
    </svg>
  );
}
