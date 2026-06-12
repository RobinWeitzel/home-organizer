import * as THREE from 'three';

/** 2.4m x 0.9m walnut plank tile, 3 staggered courses (mirrors the old SVG pattern) */
export function makeWoodTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 480; c.height = 180; // 200 px/m
  const g = c.getContext('2d')!;
  const px = (m: number) => m * 200;
  g.fillStyle = '#8a5b38'; g.fillRect(0, 0, c.width, c.height);
  const planks: [number, number, number, string][] = [
    [0, 0, 1.3, '#946343'], [1.3, 0, 1.1, '#84552f'],
    [0, 0.3, 0.5, '#8a5a36'], [0.5, 0.3, 1.4, '#9c6b46'], [1.9, 0.3, 0.5, '#7e4f2e'],
    [0, 0.6, 0.9, '#8f5d3b'], [0.9, 0.6, 1.2, '#835432'], [2.1, 0.6, 0.3, '#996845'],
  ];
  for (const [x, y, w, col] of planks) { g.fillStyle = col; g.fillRect(px(x), px(y), px(w), px(0.3)); }
  g.fillStyle = 'rgba(90,58,34,0.85)';
  for (const y of [0, 0.3, 0.6]) g.fillRect(0, px(y), c.width, 2);
  for (const [x, y] of [[1.3, 0], [0.5, 0.3], [1.9, 0.3], [0.9, 0.6], [2.1, 0.6]] as const)
    g.fillRect(px(x), px(y), 2, px(0.3));
  g.fillStyle = 'rgba(245,222,179,0.11)';
  for (const [x, y, w] of [[0.15, 0.08, 0.9], [1.0, 0.47, 1.1], [0.3, 0.74, 0.8]] as const)
    g.fillRect(px(x), px(y), px(w), 2);
  return finish(c, 1 / 2.4, 1 / 0.9);
}

/** 0.62m ceramic tile (mirrors the old SVG pattern) */
export function makeTileTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 124; c.height = 124;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ddd5c8'; g.fillRect(0, 0, 124, 124);
  g.fillStyle = '#e7e0d4'; g.fillRect(2, 2, 120, 120);
  g.fillStyle = '#e3dccf'; g.fillRect(8, 8, 108, 108);
  return finish(c, 1 / 0.62, 1 / 0.62);
}

function finish(c: HTMLCanvasElement, repX: number, repY: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX, repY); // 1 world unit = 1 m; UVs are plan meters
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
