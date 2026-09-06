// src/lib/cloud-texture.ts — ADR-033. Procedural, painterly puff textures
// drawn on an offscreen canvas: no external asset, no CDN, no licensing
// question (unlike the moon's real photo texture — see
// MOON-TEXTURE-LICENSE.txt). Two shapes sharing one technique: a clean
// single blob for the moon's glow sprite, and a lumpier multi-blob cluster
// for drei <Cloud>'s texture prop (a single perfect circle reads as a glow
// dot, not a cloud). Untestable in jsdom (no 2D canvas context there, same
// "no WebGL/canvas in jsdom" split the rest of this app's rendering code
// already draws) — verified live instead, like MoonPhase3D/HomeScene.
import * as THREE from 'three';

function drawRadialBlob(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.4, color);
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function createCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d') };
}

/** A clean single soft halo — the moon's glow sprite, bridging its photoreal
 * texture into the stylized sky around it. */
export function createGlowTexture(color = '#ffffff', size = 128): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(size);
  if (ctx) drawRadialBlob(ctx, size / 2, size / 2, size / 2, color);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** An organic multi-blob puff cluster for drei <Cloud>'s texture prop —
 * several overlapping soft circles read as a cloud silhouette; one circle
 * alone reads as a glow dot. Layout has a little randomness per call so
 * multiple <Cloud> instances don't look identical — purely decorative, no
 * assertion anywhere depends on the exact pixels. */
export function createCloudPuffTexture(color = '#ffffff', size = 256): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(size);
  if (ctx) {
    const blobCount = 5;
    for (let i = 0; i < blobCount; i++) {
      const angle = (i / blobCount) * Math.PI * 2;
      const spread = size * 0.22;
      const x = size / 2 + Math.cos(angle) * spread * (0.4 + Math.random() * 0.6);
      const y = size / 2 + Math.sin(angle) * spread * 0.5 * (0.4 + Math.random() * 0.6);
      const radius = size * (0.28 + Math.random() * 0.14);
      drawRadialBlob(ctx, x, y, radius, color);
    }
    drawRadialBlob(ctx, size / 2, size / 2, size * 0.34, color);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
