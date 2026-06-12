import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { ISO_X, ISO_Y, ISO_Z } from '../../model/iso';
import type { View } from '../usePlanPointer';

export function IsoCamera({ view, size }: { view: View; size: { w: number; h: number } }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const k = 0.002;
    const sx = (2 * view.scale) / size.w;
    const sy = (2 * view.scale) / size.h;
    camera.matrixAutoUpdate = false;
    camera.matrixWorld.identity();
    camera.matrixWorldInverse.identity();
    camera.projectionMatrix.set(
      sx * ISO_X, 0,            -sx * ISO_X, -sx * view.cx,
      -sy * ISO_Y, sy * ISO_Z,  -sy * ISO_Y,  sy * view.cy,
      -k, (-2 * ISO_Y * k) / ISO_Z, -k, 0,
      0, 0, 0, 1,
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    invalidate();
  }, [camera, invalidate, view.cx, view.cy, view.scale, size.w, size.h]);
  return null;
}
