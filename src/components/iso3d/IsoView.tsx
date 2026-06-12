// src/components/iso3d/IsoView.tsx — WebGL scenery + SVG interaction overlay
import { Canvas } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  areaOfCells,
  centroidOfCells,
  polygonCells,
  rectInsideCells,
} from '../../model/cells';
import { wallItemSegment } from '../../model/geometry';
import { KIND_HEIGHTS, makeIsoProjection, type ViewRotation } from '../../model/iso';
import { useApp } from '../../model/store';
import { buildScene3D, isTiledRoom } from '../../model/scene3d';
import {
  boxSilhouette,
  FurnCountBadge,
  IsoRoomDimensions,
  projectPath,
  projectRectPoints,
} from '../IsoScene';
import { usePlanPointer, type ShapeOp, type Tool, type View } from '../usePlanPointer';
import { IsoCamera } from './IsoCamera';
import { Floors } from './Floors';
import { Walls } from './Walls';
import { WallOpenings } from './WallOpenings';
import { FurnitureMeshes } from './FurnitureMeshes';
import { usePalette } from './palette';

export interface IsoViewProps {
  view: View;
  setView: (v: View) => void;
  size: { w: number; h: number };
  tool: Tool;
  furnitureKind: import('../../model/types').FurnitureKind;
  armedShapeOp: ShapeOp | null;
  onShapeOpDone: (ok: boolean) => void;
  onOpenFurniture: (id: string) => void;
  onMissWall: () => void;
  onPlaced?: () => void;
  browse?: boolean;
  rotation?: ViewRotation;
}

export default function IsoView(props: IsoViewProps) {
  const { view, tool, armedShapeOp, rotation = 0 } = props;
  const projection = useMemo(() => makeIsoProjection(rotation), [rotation]);
  const palette = usePalette();
  const data = useApp((s) => s.data);
  const currentFloorId = useApp((s) => s.currentFloorId);
  const selected = useApp((s) => s.selected);
  const highlightFurnitureId = useApp((s) => s.highlightFurnitureId);
  const countItemsInFurniture = useApp((s) => s.countItemsInFurniture);
  const selectedWallItemId = selected?.kind === 'wallItem' ? selected.id : null;

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
  const furniture = useMemo(() => {
    const ids = new Set(rooms.map((r) => r.id));
    return data.furniture.filter((f) => ids.has(f.roomId));
  }, [data.furniture, rooms]);
  const wallItems = useMemo(() => {
    const ids = new Set(rooms.map((r) => r.id));
    return data.wallItems.filter((w) => ids.has(w.roomId));
  }, [data.wallItems, rooms]);
  const invalidFurnitureIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of furniture) {
      const cells = roomGeo.get(f.roomId)?.cells;
      if (cells && !rectInsideCells(f, cells)) ids.add(f.id);
    }
    return ids;
  }, [furniture, roomGeo]);
  const scene = useMemo(
    () => buildScene3D(rooms, wallItems, furniture, { selectedWallItemId, invalidFurnitureIds }),
    [rooms, wallItems, furniture, selectedWallItemId, invalidFurnitureIds],
  );
  // keep the floors array identity stable across selection/furniture changes so
  // <Floors> doesn't rebuild its ExtrudeGeometry on every interaction
  const floors = useMemo(
    () => rooms.map((room) => ({ room, tiled: isTiledRoom(room.name) })),
    [rooms],
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const { ghost, handlers } = usePlanPointer({
    svgRef, projection,
    view, setView: props.setView, tool,
    furnitureKind: props.furnitureKind, armedShapeOp,
    onShapeOpDone: props.onShapeOpDone, onOpenFurniture: props.onOpenFurniture,
    onMissWall: props.onMissWall, onPlaced: props.onPlaced, browse: props.browse,
  });

  const proj = projection;
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

  const vw = props.size.w / view.scale;
  const vh = props.size.h / view.scale;
  const vb = { x: view.cx - vw / 2, y: view.cy - vh / 2, w: vw, h: vh };
  return (
    <div className="iso-stack">
      <Canvas
        orthographic
        camera={{ manual: true, position: [0, 0, 0] }}
        shadows="soft"
        flat
        frameloop="demand"
        gl={{ antialias: true }}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <IsoCamera view={view} size={props.size} rotation={rotation} />
        <ambientLight intensity={0.85} />
        <directionalLight
          castShadow position={[-6, 16, -9]} intensity={1.7}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-30} shadow-camera-right={30}
          shadow-camera-top={30} shadow-camera-bottom={-30}
          shadow-camera-near={0.1} shadow-camera-far={60}
        />
        {/* ground plane receives the building's shadow (replaces the fake SVG blob) */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.125} receiveShadow frustumCulled={false}>
          <planeGeometry args={[400, 400]} />
          <shadowMaterial opacity={0.25} />
        </mesh>
        <Floors floors={floors} skirtColor={palette['--floor-skirt']} />
        <Walls boxes={scene.wallBoxes} palette={palette} />
        <WallOpenings doors={scene.doors} windows={scene.windows} openings={scene.openings} wood={palette['--door-wood']} />
        <FurnitureMeshes pieces={scene.furniture} highlightId={highlightFurnitureId} />
      </Canvas>
      <svg
        ref={svgRef}
        className={
          highlight
            ? 'plan-svg plan-svg-iso plan-svg-overlay plan-dimming'
            : 'plan-svg plan-svg-iso plan-svg-overlay'
        }
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        {...handlers}
      >
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="transparent" />
        {rooms.map((r) => {
          const geo = roomGeo.get(r.id)!;
          const c = proj.project(geo.centroid.x, geo.centroid.y);
          const tiled = isTiledRoom(r.name);
          return (
            <g key={r.id}>
              <text
                className={tiled ? 'room-label room-label-tile' : 'room-label'}
                x={c.x}
                y={c.y - 0.1}
                textAnchor="middle"
              >
                {r.name}
              </text>
              <text
                className={tiled ? 'area-label area-label-tile' : 'area-label'}
                x={c.x}
                y={c.y + 0.38}
                textAnchor="middle"
              >
                {Math.round(geo.area * 10) / 10} m²
              </text>
            </g>
          );
        })}
        {furniture.map((f) => {
          const count = countItemsInFurniture(f.id);
          // same readability rule as the 2D view; label sits on the box top face
          const labelSize = Math.min(0.3, f.h * 0.55, (f.w * 1.7) / Math.max(1, f.name.length));
          const top = proj.project(f.x + f.w / 2, f.y + f.h / 2, KIND_HEIGHTS[f.kind]);
          const dimmed = highlight && f.id !== highlight.id;
          return (
            <g key={`furn-${f.id}`} className={dimmed ? 'furn-dim' : undefined}>
              {labelSize >= 0.13 && (
                <text
                  className="furniture-label"
                  x={top.x}
                  y={top.y + labelSize * 0.35}
                  textAnchor="middle"
                  fontSize={labelSize}
                >
                  {f.name}
                </text>
              )}
              {count > 0 && <FurnCountBadge proj={proj} f={f} count={count} />}
            </g>
          );
        })}
        {highlight && (
          <polygon
            className="pulse"
            points={boxSilhouette(
              proj,
              {
                x: highlight.x - 0.15,
                y: highlight.y - 0.15,
                w: highlight.w + 0.3,
                h: highlight.h + 0.3,
              },
              KIND_HEIGHTS[highlight.kind] + 0.1,
            )}
          />
        )}
        {selectedRoom && (
          <g>
            <path
              className="selected-outline"
              d={projectPath(proj, selectedRoom.polygon)}
              strokeWidth={0.06}
              strokeDasharray="0.15 0.1"
            />
            {tool === 'select' && !armedShapeOp && (
              <IsoRoomDimensions proj={proj} room={selectedRoom} scale={view.scale} />
            )}
          </g>
        )}
        {selectedFurniture && (
          <g>
            <polygon
              className="selected-outline"
              points={projectRectPoints(proj, selectedFurniture)}
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
              ).map(([cx, cy], i) => {
                const p = proj.project(cx, cy);
                return (
                  <circle key={i} className="handle" cx={p.x} cy={p.y} r={handleR} strokeWidth={2 / view.scale} />
                );
              })}
          </g>
        )}
        {selectedWallSeg && tool === 'select' && (
          <g>
            {[selectedWallSeg.from, selectedWallSeg.to].map((p, i) => {
              const sp = proj.project(p.x, p.y);
              return (
                <circle key={i} className="handle" cx={sp.x} cy={sp.y} r={handleR} strokeWidth={2 / view.scale} />
              );
            })}
            {(() => {
              const mx = (selectedWallSeg.from.x + selectedWallSeg.to.x) / 2 + selectedWallSeg.inward.x * 0.45;
              const my = (selectedWallSeg.from.y + selectedWallSeg.to.y) / 2 + selectedWallSeg.inward.y * 0.45;
              const lp = proj.project(mx, my);
              return (
                <text className="dim-label" x={lp.x} y={lp.y + 0.12} textAnchor="middle">
                  {selectedWallItem!.length.toFixed(1).replace(/\.0$/, '')} m
                </text>
              );
            })()}
          </g>
        )}
        {ghost && (
          <g>
            <polygon
              className={armedShapeOp === 'carve' ? 'ghost ghost-carve' : 'ghost'}
              points={projectRectPoints(proj, ghost)}
              strokeWidth={0.05}
            />
            {(() => {
              const c = proj.project(ghost.x + ghost.w / 2, ghost.y + ghost.h / 2);
              return (
                <text className="dim-label" x={c.x} y={c.y + 0.12} textAnchor="middle">
                  {Math.round(ghost.w * 100) / 100} × {Math.round(ghost.h * 100) / 100} m
                </text>
              );
            })()}
          </g>
        )}
      </svg>
    </div>
  );
}
