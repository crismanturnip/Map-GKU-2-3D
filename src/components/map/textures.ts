import { useEffect, useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import { palette } from "../../config/mapConfig";

type Painter = (context: CanvasRenderingContext2D, size: number, random: () => number) => void;

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

// Tekstur dibuat dari canvas agar scene tetap tanpa aset gambar eksternal.
export function useCanvasTexture(paint: Painter, repeatX = 1, repeatY = 1, size = 256) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable");
    paint(context, size, seededRandom(97));

    const next = new CanvasTexture(canvas);
    next.colorSpace = SRGBColorSpace;
    next.wrapS = RepeatWrapping;
    next.wrapT = RepeatWrapping;
    next.repeat.set(repeatX, repeatY);
    next.anisotropy = 4;
    return next;
  }, [paint, repeatX, repeatY, size]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Paving beton putih krem seperti pelataran di citra satelit; satu canvas mewakili 4 × 4 satuan scene. */
export const paintPaving: Painter = (context, size, random) => {
  context.fillStyle = "#e8d5b4";
  context.fillRect(0, 0, size, size);

  for (let index = 0; index < 2600; index++) {
    const shade = random() > 0.5 ? 255 : 90;
    context.fillStyle = `rgba(${shade}, ${shade - 8}, ${shade - 20}, ${0.05 + random() * 0.08})`;
    context.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2);
  }
  for (let index = 0; index < 5; index++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 18 + random() * 30;
    const stain = context.createRadialGradient(x, y, 0, x, y, radius);
    stain.addColorStop(0, "rgba(214, 190, 150, 0.22)");
    stain.addColorStop(1, "rgba(214, 190, 150, 0)");
    context.fillStyle = stain;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  const tile = size / 4;
  context.strokeStyle = "rgba(160, 142, 112, 0.28)";
  context.lineWidth = 1.5;
  for (let index = 0; index <= 4; index++) {
    context.beginPath();
    context.moveTo(index * tile, 0);
    context.lineTo(index * tile, size);
    context.moveTo(0, index * tile);
    context.lineTo(size, index * tile);
    context.stroke();
  }
};

export const paintGrass: Painter = (context, size, random) => {
  context.fillStyle = palette.grass;
  context.fillRect(0, 0, size, size);

  for (let index = 0; index < 7; index++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 30 + random() * 50;
    const patch = context.createRadialGradient(x, y, 0, x, y, radius);
    const tone = random() > 0.5 ? "120, 140, 70" : "60, 82, 40";
    patch.addColorStop(0, `rgba(${tone}, 0.35)`);
    patch.addColorStop(1, `rgba(${tone}, 0)`);
    context.fillStyle = patch;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  for (let index = 0; index < 5200; index++) {
    const light = random() > 0.45;
    context.fillStyle = light
      ? `rgba(150, 178, 92, ${0.18 + random() * 0.2})`
      : `rgba(42, 62, 28, ${0.18 + random() * 0.22})`;
    context.fillRect(random() * size, random() * size, 1, 2 + random() * 3);
  }
};

/** Panel mural bergaris miring di ujung sayap barat, seperti pada foto samping gedung. */
export const paintMural: Painter = (context, size) => {
  const colors = ["#e9e4d8", "#f0bf2c", "#9aa3ab", "#2f3a44", "#d4473a", "#e9e4d8", "#7c8a96", "#f0bf2c"];
  context.fillStyle = colors[0];
  context.fillRect(0, 0, size, size);
  context.save();
  context.translate(size / 2, size / 2);
  context.rotate(-0.5);
  const band = size / 7;
  for (let index = -8; index < 8; index++) {
    context.fillStyle = colors[(index + 16) % colors.length];
    context.fillRect(index * band, -size, band * 0.92, size * 2);
  }
  context.restore();
};
