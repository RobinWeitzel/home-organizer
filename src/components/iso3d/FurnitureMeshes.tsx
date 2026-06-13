// src/components/iso3d/FurnitureMeshes.tsx
import { useMemo } from 'react';
import { Color } from 'three';
import { FURNITURE_COLORS, shiftColor } from '../../model/furnitureColors';
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
  // the local frame fronts +z; rotate it to the piece's facing
  // (0 = plan south, 1 = west, 2 = north, 3 = east)
  const sideways = f.facing % 2 === 1;
  const W = sideways ? f.box.h : f.box.w;
  const D = sideways ? f.box.w : f.box.h;
  const stacked = f.z0 > 1e-6;
  const parts = useMemo(() => {
    const built = buildFurnitureParts(f.kind, W, D, f.height, f.id, stacked);
    if (!f.color) return built;
    // re-tint relative to the palette's main colour (the first tintable part)
    const ref = built.find((p) => !p.fixed)?.color;
    if (!ref) return built;
    const target = FURNITURE_COLORS[f.color].hex;
    return built.map((p) => (p.fixed ? p : { ...p, color: shiftColor(p.color, ref, target) }));
  }, [f.kind, W, D, f.height, f.id, f.color, stacked]);
  return (
    <group
      position={[f.box.x + f.box.w / 2, f.z0, f.box.y + f.box.h / 2]}
      rotation-y={(-f.facing * Math.PI) / 2}
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
