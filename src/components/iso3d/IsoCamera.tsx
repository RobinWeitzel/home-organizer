import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { ISO_X, ISO_Y, ISO_Z, type ViewRotation } from '../../model/iso';
import type { View } from '../usePlanPointer';

/**
 * Row-major projection matrix values matching makeIsoProjection(rotation)
 * plus the SVG viewBox mapping; shared with the unit test. Depth packs
 * "distance toward the camera" so the z-buffer resolves occlusion.
 */
export function isoMatrixValues(
  view: View,
  size: { w: number; h: number },
  rotation: ViewRotation = 0,
): number[] {
  const k = 0.002;
  const sx = (2 * view.scale) / size.w;
  const sy = (2 * view.scale) / size.h;
  const c = [1, 0, -1, 0][rotation];
  const sn = [0, 1, 0, -1][rotation];
  // rotated plan coords: x' = c·X − s·Z, z' = s·X + c·Z (three Z = plan y)
  // x' − z' = a·X − b·Z and x' + z' = b·X + a·Z with a = c − s, b = c + s
  const a = c - sn;
  const b = c + sn;
  return [
    sx * ISO_X * a, 0,                        -sx * ISO_X * b, -sx * view.cx,
    -sy * ISO_Y * b, sy * ISO_Z,              -sy * ISO_Y * a,  sy * view.cy,
    -k * b, (-2 * ISO_Y * k) / ISO_Z,         -k * a,           0,
    0, 0, 0, 1,
  ];
}

export function IsoCamera({
  view,
  size,
  rotation = 0,
}: {
  view: View;
  size: { w: number; h: number };
  rotation?: ViewRotation;
}) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    camera.matrixAutoUpdate = false;
    camera.matrixWorld.identity();
    camera.matrixWorldInverse.identity();
    camera.projectionMatrix.set(
      ...(isoMatrixValues(view, size, rotation) as Parameters<typeof camera.projectionMatrix.set>),
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    invalidate();
  }, [camera, invalidate, view, size, rotation]);
  return null;
}
