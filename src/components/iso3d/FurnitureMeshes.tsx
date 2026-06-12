// src/components/iso3d/FurnitureMeshes.tsx
import { useMemo } from 'react';
import { Color } from 'three';
import type { SceneFurniture } from '../../model/scene3d';
import { buildFurnitureParts } from './furnitureParts';

const INVALID = '#f87171';
const HIGHLIGHT = '#f59e0b';
const DIM_TARGET = new Color('#b4b7bd');

/** wash a part color toward neutral gray so a highlighted piece stands out */
function dimColor(hex: string): string {
  return '#' + new Color(hex).lerp(DIM_TARGET, 0.8).getHexString();
}

function Piece({ f, highlighted, dimmed }: { f: SceneFurniture; highlighted: boolean; dimmed: boolean }) {
  // local frame faces the front toward +z (plan south) for wide pieces and
  // toward +x (plan east) for deep ones — both faces the iso camera sees
  const facingX = f.box.h > f.box.w;
  const W = facingX ? f.box.h : f.box.w;
  const D = facingX ? f.box.w : f.box.h;
  const parts = useMemo(
    () => buildFurnitureParts(f.kind, W, D, f.height, f.id),
    [f.kind, W, D, f.height, f.id],
  );
  return (
    <group
      position={[f.box.x + f.box.w / 2, 0, f.box.y + f.box.h / 2]}
      rotation-y={facingX ? Math.PI / 2 : 0}
    >
      {parts.map((p) => (
        <mesh key={p.key} castShadow receiveShadow frustumCulled={false} position={p.pos}>
          <boxGeometry args={p.size} />
          <meshLambertMaterial
            color={f.invalid ? INVALID : dimmed ? dimColor(p.color) : p.color}
            emissive={highlighted ? HIGHLIGHT : '#000000'}
            emissiveIntensity={highlighted ? 0.35 : 0}
          />
        </mesh>
      ))}
    </group>
  );
}

export function FurnitureMeshes({ pieces, highlightId }: { pieces: SceneFurniture[]; highlightId?: string | null }) {
  return (
    <>
      {pieces.map((f) => (
        <Piece
          key={f.id}
          f={f}
          highlighted={f.id === highlightId}
          dimmed={Boolean(highlightId) && f.id !== highlightId}
        />
      ))}
    </>
  );
}
