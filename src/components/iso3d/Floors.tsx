// src/components/iso3d/Floors.tsx
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Scene3D } from '../../model/scene3d';
import { makeTileTexture, makeWoodTexture } from './textures';

const FLOOR_SLAB = 0.12;

export function Floors({ floors, skirtColor }: { floors: Scene3D['floors']; skirtColor: string }) {
  const wood = useMemo(makeWoodTexture, []);
  const tile = useMemo(makeTileTexture, []);

  useEffect(() => () => { wood.dispose(); tile.dispose(); }, [wood, tile]);

  const records = useMemo(
    () =>
      floors.map(({ room, tiled }) => {
        const shape = new THREE.Shape(room.polygon.map((p) => new THREE.Vector2(p.x, p.y)));
        const geo = new THREE.ExtrudeGeometry(shape, { depth: FLOOR_SLAB, bevelEnabled: false });
        return { room, tiled, geo };
      }),
    [floors],
  );

  useEffect(() => () => { records.forEach(({ geo }) => geo.dispose()); }, [records]);

  return (
    <>
      {records.map(({ room, tiled, geo }) => (
        <mesh
          key={room.id} geometry={geo} receiveShadow castShadow frustumCulled={false}
          rotation-x={Math.PI / 2} position-y={0}
        >
          {/* ExtrudeGeometry: material 0 = front/back caps, 1 = sides */}
          <meshLambertMaterial attach="material-0" map={tiled ? tile : wood} />
          <meshLambertMaterial attach="material-1" color={skirtColor} />
        </mesh>
      ))}
    </>
  );
}
