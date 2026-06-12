// src/components/iso3d/Walls.tsx
import type { Box3D } from '../../model/scene3d';
import type { Palette } from './palette';

export function Walls({ boxes, palette }: { boxes: Box3D[]; palette: Palette }) {
  const top = palette['--wall-top'];
  const front = palette['--wall-front']; // +z faces (plan +y) and -x
  const side = palette['--wall-side'];   // +x faces
  return (
    <>
      {boxes.map((b) => (
        <mesh
          key={`${b.x}_${b.y}_${b.z0}_${b.w}_${b.h}_${b.height}`} castShadow receiveShadow frustumCulled={false}
          position={[b.x + b.w / 2, b.z0 + b.height / 2, b.y + b.h / 2]}
        >
          <boxGeometry args={[b.w, b.height, b.h]} />
          <meshLambertMaterial attach="material-0" color={side} />
          <meshLambertMaterial attach="material-1" color={front} />
          <meshLambertMaterial attach="material-2" color={top} />
          <meshLambertMaterial attach="material-3" color={front} />
          <meshLambertMaterial attach="material-4" color={front} />
          <meshLambertMaterial attach="material-5" color={side} />
        </mesh>
      ))}
    </>
  );
}
