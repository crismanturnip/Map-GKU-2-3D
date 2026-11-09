import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";
function randomGenerator(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function canvas2D(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");
  return { canvas, context };
}

function asTexture(canvas: HTMLCanvasElement) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  return texture;
}


/** Ported from https://kmhexpo-2026.pages.dev/assets/Scene3D-JafVaRTM.js (OL).
 * Texture dimensions, colors, star counts, sizes and opacity follow the reference. */
export function createSpaceTexture(compact: boolean) {
  const { canvas, context } = canvas2D(compact ? 1024 : 2048, compact ? 512 : 1024);
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#222c38");
  gradient.addColorStop(0.5, "#1a232e");
  gradient.addColorStop(1, "#141b24");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  function glow(x: number, y: number, radius: number, color: string) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const scale = compact ? 0.5 : 1;
  glow(560 * scale, 360 * scale, 420 * scale, "rgba(224,90,50,0.10)");
  glow(1500 * scale, 620 * scale, 480 * scale, "rgba(124,58,237,0.12)");
  glow(1100 * scale, 200 * scale, 360 * scale, "rgba(224,90,50,0.06)");

  for (let index = 0; index < (compact ? 900 : 2200); index++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = Math.random() * 1.2 + 0.25;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = `rgba(238,241,243,${(Math.random() * 0.55 + 0.2).toFixed(2)})`;
    context.fill();
  }
  return asTexture(canvas);
}
/** Ported from the same public bundle (BL), including crater highlights and limb glow. */
export function createMoonTexture(compact: boolean) {
  const { canvas, context } = canvas2D(compact ? 512 : 1024, compact ? 256 : 512);
  const half = canvas.width * 0.5;
  context.fillStyle = "#141b24";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.beginPath();
  context.rect(0, 0, half, canvas.height);
  context.clip();
  const gradient = context.createLinearGradient(0, 0, half, 0);
  gradient.addColorStop(0, "#6f7a86");
  gradient.addColorStop(0.55, "#bcc6ce");
  gradient.addColorStop(0.92, "#e2e8ec");
  gradient.addColorStop(1, "#f2f5f7");
  context.fillStyle = gradient;
  context.fillRect(0, 0, half, canvas.height);

  for (let index = 0; index < (compact ? 30 : 70); index++) {
    const x = Math.random() * half * 0.98;
    const y = Math.random() * canvas.height;
    const radius = Math.random() * 14 + 3;
    const crater = context.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
    crater.addColorStop(0, "rgba(12,18,26,0.35)");
    crater.addColorStop(0.7, "rgba(12,18,26,0.12)");
    crater.addColorStop(1, "rgba(12,18,26,0)");
    context.fillStyle = crater;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(x + radius * 0.25, y + radius * 0.25, radius * 0.85, 0, Math.PI * 2);
    context.fillStyle = "rgba(255,252,240,0.10)";
    context.fill();
  }
  for (let index = 0; index < (compact ? 900 : 2400); index++) {
    context.fillStyle = `rgba(12,18,26,${(Math.random() * 0.06).toFixed(3)})`;
    context.fillRect(Math.random() * half, Math.random() * canvas.height, 2, 1);
  }
  context.restore();
  const limb = context.createLinearGradient(half - 10, 0, half + 2, 0);
  limb.addColorStop(0, "rgba(244,241,230,0)");
  limb.addColorStop(0.85, "rgba(244,241,230,0.55)");
  limb.addColorStop(1, "rgba(244,241,230,0)");
  context.fillStyle = limb;
  context.fillRect(half - 10, 0, 14, canvas.height);
  return asTexture(canvas);
}
/** Screen-space grain, grid and vignette are rendered before the map, never over its labels. */
export function createSpaceOverlay(width: number, height: number) {
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const { canvas, context } = canvas2D(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
  const random = randomGenerator(97);
  const grain = context.createImageData(canvas.width, canvas.height);
  for (let index = 0; index < grain.data.length; index += 4) {
    const value = random() * 255;
    grain.data[index] = value;
    grain.data[index + 1] = value;
    grain.data[index + 2] = value;
    grain.data[index + 3] = 11;
  }
  context.putImageData(grain, 0, 0);
  context.strokeStyle = "rgba(238,241,243,0.055)";
  context.lineWidth = scale;
  context.beginPath();
  for (let index = 1; index < 5; index++) {
    const x = Math.round(canvas.width * index / 5) + 0.5;
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
  }
  for (let index = 1; index < 4; index++) {
    const y = Math.round(canvas.height * index / 4) + 0.5;
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
  }
  context.stroke();
  const vignette = context.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width * 0.22,
    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.72);
  vignette.addColorStop(0, "rgba(10,14,19,0)");
  vignette.addColorStop(1, "rgba(10,14,19,0.45)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return asTexture(canvas);
}
