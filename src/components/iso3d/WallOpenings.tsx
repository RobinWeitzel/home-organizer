// src/components/iso3d/WallOpenings.tsx
import { WALL_T } from '../../model/iso';
import type { SceneDoor, SceneOpening, SceneWindow } from '../../model/scene3d';

const SELECT = '#2563eb';

/** an opening is just absent wall — only its selection needs a visual */
function OpeningMarker({ o }: { o: SceneOpening }) {
  if (!o.selected) return null;
  const mid = { x: (o.from.x + o.to.x) / 2, y: (o.from.y + o.to.y) / 2 };
  const len = Math.abs(o.to.x - o.from.x) + Math.abs(o.to.y - o.from.y);
  const horizontal = Math.abs(o.to.x - o.from.x) > Math.abs(o.to.y - o.from.y);
  return (
    <mesh frustumCulled={false} position={[mid.x, 0.012, mid.y]}>
      <boxGeometry args={[horizontal ? len : WALL_T, 0.02, horizontal ? WALL_T : len]} />
      <meshLambertMaterial color={SELECT} transparent opacity={0.75} />
    </mesh>
  );
}

function DoorLeaf({ d, wood }: { d: SceneDoor; wood: string }) {
  // leaf: thin box from hinge, extending d.length along inward, swung open 90°
  const lx = d.hinge.x + (d.inward.x * d.length) / 2;
  const ly = d.hinge.y + (d.inward.y * d.length) / 2;
  return (
    <group>
      <mesh castShadow frustumCulled={false} position={[lx, d.height / 2, ly]}>
        <boxGeometry args={[
          Math.abs(d.inward.x) * d.length + Math.abs(d.inward.y) * 0.05,
          d.height,
          Math.abs(d.inward.y) * d.length + Math.abs(d.inward.x) * 0.05,
        ]} />
        <meshLambertMaterial color={d.selected ? SELECT : wood} />
      </mesh>
      {/* handle */}
      <mesh frustumCulled={false} position={[
        d.hinge.x + d.inward.x * d.length * 0.85 + Math.abs(d.inward.y) * 0.05,
        d.height * 0.48,
        d.hinge.y + d.inward.y * d.length * 0.85 + Math.abs(d.inward.x) * 0.05,
      ]}>
        <sphereGeometry args={[0.045, 12, 8]} />
        <meshLambertMaterial color="#e9e2d4" />
      </mesh>
    </group>
  );
}

function WindowMesh({ w }: { w: SceneWindow }) {
  const mid = { x: (w.from.x + w.to.x) / 2, y: (w.from.y + w.to.y) / 2 };
  const len = Math.abs(w.to.x - w.from.x) + Math.abs(w.to.y - w.from.y);
  const horizontal = Math.abs(w.to.x - w.from.x) > Math.abs(w.to.y - w.from.y);
  const glassH = w.z1 - w.z0;
  const bar = (y: number, k: string) => (
    <mesh key={k} frustumCulled={false} position={[mid.x, y, mid.y]}>
      <boxGeometry args={[horizontal ? len : 0.08, 0.05, horizontal ? 0.08 : len]} />
      <meshLambertMaterial color={w.selected ? SELECT : '#f7f7f5'} />
    </mesh>
  );
  return (
    <group>
      <mesh frustumCulled={false} position={[mid.x, w.z0 + glassH / 2, mid.y]}>
        <boxGeometry args={[horizontal ? len : 0.04, glassH, horizontal ? 0.04 : len]} />
        <meshLambertMaterial color="#bcd8ec" transparent opacity={0.55} />
      </mesh>
      {bar(w.z0 + 0.025, 'sillbar')}
      {bar(w.z1 - 0.025, 'headbar')}
      {/* mullion */}
      <mesh frustumCulled={false} position={[mid.x, w.z0 + glassH / 2, mid.y]}>
        <boxGeometry args={[horizontal ? 0.05 : 0.07, glassH, horizontal ? 0.07 : 0.05]} />
        <meshLambertMaterial color={w.selected ? SELECT : '#f7f7f5'} />
      </mesh>
    </group>
  );
}

export function WallOpenings({ doors, windows, openings, wood }: {
  doors: SceneDoor[]; windows: SceneWindow[]; openings: SceneOpening[]; wood: string;
}) {
  // Collect unique jamb positions across all doors to avoid coincident duplicates
  // when two doors share a merged wall gap.
  const jambsSeen = new Set<string>();
  const jambs: React.ReactElement[] = [];
  for (const d of doors) {
    const along = { x: Math.sign(d.gapTo.x - d.gapFrom.x), y: Math.sign(d.gapTo.y - d.gapFrom.y) };
    const axisKey = `${along.x}_${along.y}`;
    const w = Math.abs(along.x) * 0.06 + Math.abs(along.y) * (WALL_T + 0.04);
    const h = d.height;
    const depth = Math.abs(along.y) * 0.06 + Math.abs(along.x) * (WALL_T + 0.04);
    for (const p of [d.gapFrom, d.gapTo]) {
      const key = `${p.x.toFixed(4)}_${p.y.toFixed(4)}_${h.toFixed(4)}_${axisKey}`;
      if (jambsSeen.has(key)) continue;
      jambsSeen.add(key);
      jambs.push(
        <mesh
          key={key} castShadow frustumCulled={false}
          position={[p.x, h / 2, p.y]}
        >
          <boxGeometry args={[w, h, depth]} />
          <meshLambertMaterial color="#f3f1ee" />
        </mesh>
      );
    }
  }

  return (
    <>
      {jambs}
      {doors.map((d) => <DoorLeaf key={d.id} d={d} wood={wood} />)}
      {windows.map((w) => <WindowMesh key={w.id} w={w} />)}
      {openings.map((o) => <OpeningMarker key={o.id} o={o} />)}
    </>
  );
}
