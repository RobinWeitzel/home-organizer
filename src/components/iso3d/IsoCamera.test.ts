/**
 * IsoCamera projection-matrix unit test.
 *
 * Replicates the exact Matrix4 that IsoCamera.tsx builds and verifies:
 *  1. NDC x/y matches the reference isoProjection.project() + viewBox math.
 *  2. Depth ordering: the point nearer to the viewer (larger d = X+Z+(2·ISO_Y/ISO_Z)·H)
 *     gets a more-negative ndc_z and therefore wins the z-buffer.
 *
 * No React, no jsdom — pure matrix arithmetic.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ISO_Y, ISO_Z, makeIsoProjection, type ViewRotation } from '../../model/iso';
import { isoMatrixValues } from './IsoCamera';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Build the projectionMatrix from the component's shared builder. */
function buildProjectionMatrix(
  view: { cx: number; cy: number; scale: number },
  size: { w: number; h: number },
  rotation: ViewRotation = 0,
): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  // Matrix4.set takes ROW-MAJOR arguments
  m.set(...(isoMatrixValues(view, size, rotation) as Parameters<THREE.Matrix4['set']>));
  return m;
}

/**
 * Apply the projection matrix to a world point (X, H, Z) — Three.js convention
 * where X = plan-x, H = vertical height, Z = plan-y.
 *
 * Returns the resulting NDC (x, y, z, w).
 */
function project(m: THREE.Matrix4, X: number, H: number, Z: number) {
  const v = new THREE.Vector4(X, H, Z, 1);
  v.applyMatrix4(m);
  return v; // w is 1 since bottom row is [0,0,0,1]
}

/**
 * Reference NDC x/y from isoProjection.project(planX, planY, height) plus
 * the viewBox formula described in the task spec.
 *
 *   ndcX = (px − cx) · 2·scale / w
 *   ndcY = −(py − cy) · 2·scale / h
 *
 * isoProjection.project(x, y, z) — note: z is height, y is plan-y.
 * World point (X, H, Z): planX=X, planY=Z, height=H.
 */
function referenceNDC(
  planX: number, planY: number, height: number,
  view: { cx: number; cy: number; scale: number },
  size: { w: number; h: number },
  rotation: ViewRotation = 0,
) {
  const p = makeIsoProjection(rotation).project(planX, planY, height);
  const ndcX = (p.x - view.cx) * (2 * view.scale) / size.w;
  const ndcY = -(p.y - view.cy) * (2 * view.scale) / size.h;
  return { ndcX, ndcY };
}

// ── test cases ────────────────────────────────────────────────────────────────

const VIEW = { cx: 1.5, cy: 0.8, scale: 60 };
const SIZE = { w: 800, h: 600 };

/** World points as [planX, height, planZ] (Three.js: X=planX, Y=height, Z=planZ) */
const POINTS: [number, number, number][] = [
  [0,   0,   0  ],
  [1,   0,   1  ],
  [3.5, 1.1, 2  ],
  [-2,  0.6, 5  ],
];

describe('IsoCamera projection matrix', () => {
  const mat = buildProjectionMatrix(VIEW, SIZE);

  describe('NDC x/y match isoProjection reference at every rotation', () => {
    for (const rotation of [0, 1, 2, 3] as const) {
      const rmat = buildProjectionMatrix(VIEW, SIZE, rotation);
      for (const [X, H, Z] of POINTS) {
        it(`rot ${rotation}: (${X}, ${H}, ${Z})`, () => {
          const ndc = project(rmat, X, H, Z);
          const ref = referenceNDC(X, Z, H, VIEW, SIZE, rotation);
          expect(ndc.x).toBeCloseTo(ref.ndcX, 10);
          expect(ndc.y).toBeCloseTo(ref.ndcY, 10);
        });
      }
    }
  });

  describe('depth ordering: nearer viewer (larger d) → more-negative ndc_z', () => {
    /**
     * d = X + Z + (2·ISO_Y/ISO_Z)·H
     * From the matrix row 2: ndc_z = −k·(X + Z + (2·ISO_Y/ISO_Z)·H) = −k·d
     * So larger d → more-negative ndc_z → nearer to viewer → wins z-buffer.
     */
    const pairs: [[number, number, number], [number, number, number]][] = [
      // clearly different d values
      [[0,  0, 0], [1, 0, 1]],   // d=0 vs d=2
      [[1,  0, 1], [3.5, 1.1, 2]], // d=2 vs d=5.5+(2*ISO_Y/ISO_Z)*1.1
      [[-2, 0.6, 5], [3.5, 1.1, 2]], // compare sign via computed d
    ];

    for (const [pA, pB] of pairs) {
      const [XA, HA, ZA] = pA;
      const [XB, HB, ZB] = pB;
      it(`(${XA},${HA},${ZA}) vs (${XB},${HB},${ZB})`, () => {
        const dA = XA + ZA + (2 * ISO_Y / ISO_Z) * HA;
        const dB = XB + ZB + (2 * ISO_Y / ISO_Z) * HB;
        if (Math.abs(dA - dB) < 1e-9) return; // skip equal-depth pairs

        const ndcA = project(mat, XA, HA, ZA);
        const ndcB = project(mat, XB, HB, ZB);

        if (dA > dB) {
          // A is nearer → A has more-negative ndc_z
          expect(ndcA.z).toBeLessThan(ndcB.z);
        } else {
          // B is nearer → B has more-negative ndc_z
          expect(ndcB.z).toBeLessThan(ndcA.z);
        }
      });
    }
  });
});
