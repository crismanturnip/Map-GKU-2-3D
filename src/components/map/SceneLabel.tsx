import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, LinearFilter, MathUtils, PerspectiveCamera, Sprite, SRGBColorSpace, Vector3 } from "three";
import type { Position3D } from "../../types/map";

let displayFontLoading: Promise<FontFace[]> | undefined;
const loadDisplayFont = () => displayFontLoading ??= document.fonts.load('400 14px "Ethnocentric"');

interface SceneLabelProps {
  text: string;
  position: Position3D;
  tone?: "default" | "accent";
  compact?: boolean;
}

export function SceneLabel({ text, position, tone = "default", compact = false }: SceneLabelProps) {
  const sprite = useRef<Sprite>(null);
  const [fontReady, setFontReady] = useState(false);
  const worldPosition = useMemo(() => new Vector3(), []);

  useEffect(() => {
    let active = true;
    // Canvas textures must wait for the actual font; CSS font swapping cannot
    // update letters that have already been rasterized into a sprite texture.
    loadDisplayFont().then((faces) => {
      if (active && faces.length > 0) setFontReady(true);
    });
    return () => { active = false; };
  }, []);

  const label = useMemo(() => {
    if (!fontReady) return null;
    const fontSize = compact ? 12 : 14;
    const height = compact ? 27 : 34;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable");

    context.font = `400 ${fontSize}px "Ethnocentric", sans-serif`;
    const width = Math.max(compact ? 56 : 72, Math.ceil(context.measureText(text).width + 26));
    canvas.width = width * 2;
    canvas.height = height * 2;
    context.scale(2, 2);
    context.fillStyle = tone === "accent" ? "#8a351a" : "#0c1520";
    context.beginPath();
    context.roundRect(1, 1, width - 2, height - 2, 6);
    context.fill();
    context.font = `400 ${fontSize}px "Ethnocentric", sans-serif`;
    context.fillStyle = "#f4f7f9";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, width / 2, height / 2 + 0.5);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    return { texture, width, height };
  }, [compact, text, tone, fontReady]);

  useEffect(() => () => label?.texture.dispose(), [label]);

  useFrame(({ camera, size }) => {
    if (!sprite.current || !label || !(camera instanceof PerspectiveCamera)) return;
    sprite.current.getWorldPosition(worldPosition);
    const distance = camera.position.distanceTo(worldPosition);
    const unitsPerPixel = (2 * distance * Math.tan(MathUtils.degToRad(camera.fov) / 2)) / size.height;
    sprite.current.scale.set(label.width * unitsPerPixel, label.height * unitsPerPixel, 1);
  });

  if (!label) return null;

  return (
    <sprite ref={sprite} position={position} renderOrder={20} raycast={() => {}}>
      <spriteMaterial map={label.texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}
