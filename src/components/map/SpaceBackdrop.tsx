import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Scene, SphereGeometry, SRGBColorSpace, WebGLRenderTarget } from "three";
import { createMoonTexture, createSpaceOverlay, createSpaceTexture } from "./spaceTextures";

// Camera, geometry, moon placement and turn speed ported from Scene3D-JafVaRTM.js
// at https://kmhexpo-2026.pages.dev/. The reference uses a fixed-origin camera;
// moving the map camera must not scale, reposition, or zoom this background.
const BASE_FOV = 75;
const MIN_ASPECT = 1.3;
const MAX_FOV = 96;
const TURN_SPEED = 0.0009 * 60;
// Start at the 029-degree heading in the user's reference screenshot. The source
// moon position stays untouched; this leaves it visible beside the map at startup.
const INITIAL_HEADING = 29 * Math.PI / 180;

export function SpaceBackdrop() {
  const { width, height } = useThree((state) => state.size);
  const mapScene = useThree((state) => state.scene);
  const compact = width <= 768;
  const reducedMotion = useRef(false);
  const dirty = useRef(true);
  const yaw = useRef(INITIAL_HEADING);
  const backdrop = useMemo(() => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(BASE_FOV, 1, 0.1, 3000);
    camera.rotation.order = "YXZ";
    camera.rotation.x = -0.06;
    const skyTexture = createSpaceTexture(compact);
    const moonTexture = createMoonTexture(compact);
    const sky = new Mesh(
      new SphereGeometry(480, compact ? 24 : 48, compact ? 16 : 32),
      new MeshBasicMaterial({ map: skyTexture, side: BackSide, toneMapped: false }),
    );
    const moon = new Mesh(
      new SphereGeometry(78, compact ? 32 : 64, compact ? 32 : 64),
      new MeshBasicMaterial({ map: moonTexture, toneMapped: false }),
    );
    moon.position.set(90, -18, -360);
    moon.rotation.y = -Math.PI / 2.6;
    const overlay = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({
      transparent: true, toneMapped: false, depthTest: false, depthWrite: false,
    }));
    overlay.position.z = -2;
    overlay.renderOrder = 10;
    camera.add(overlay);
    scene.add(sky, moon, camera);

    // Render the simple sky without multisampling or the map's high pixel ratio.
    // Let R3F perform the final map render normally, instead of taking over its loop.
    const target = new WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false, samples: 0 });
    target.texture.colorSpace = SRGBColorSpace;
    return { scene, camera, sky, moon, overlay, skyTexture, moonTexture, target };
  }, [compact]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = media.matches; dirty.current = true; };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const { camera, overlay, target } = backdrop;
    camera.aspect = width / Math.max(height, 1);
    camera.fov = camera.aspect < MIN_ASPECT
      ? Math.min(MAX_FOV, 2 * Math.atan(Math.tan(BASE_FOV * Math.PI / 360) * MIN_ASPECT / camera.aspect) * 180 / Math.PI)
      : BASE_FOV;
    camera.updateProjectionMatrix();
    const halfHeight = Math.tan(camera.fov * Math.PI / 360);
    overlay.scale.set(4 * halfHeight * camera.aspect, 4 * halfHeight, 1);
    // A 1x sky keeps stars at the reference scale without oversampling the whole sky.
    target.setSize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
    const texture = createSpaceOverlay(width, height);
    overlay.material.map = texture;
    overlay.material.needsUpdate = true;
    dirty.current = true;
    return () => { overlay.material.map = null; texture.dispose(); };
  }, [backdrop, width, height]);

  useEffect(() => {
    const previous = mapScene.background;
    mapScene.background = backdrop.target.texture;
    return () => {
      if (mapScene.background === backdrop.target.texture) mapScene.background = previous;
      backdrop.skyTexture.dispose();
      backdrop.moonTexture.dispose();
      backdrop.target.dispose();
      for (const mesh of [backdrop.sky, backdrop.moon, backdrop.overlay]) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    };
  }, [backdrop, mapScene]);

  // Before map callbacks, render just the sky into its own texture. Negative priority
  // preserves R3F's automatic rendering and the map's lighting/shadow passes.
  useFrame(({ gl }, delta) => {
    if (document.hidden) return;
    const moving = !reducedMotion.current;
    if (!moving && !dirty.current) return;
    if (moving) yaw.current += TURN_SPEED * Math.min(delta, 0.05);
    backdrop.camera.rotation.y = yaw.current;
    const previousTarget = gl.getRenderTarget();
    const autoClear = gl.autoClear;
    try {
      gl.autoClear = true;
      gl.setRenderTarget(backdrop.target);
      gl.render(backdrop.scene, backdrop.camera);
      dirty.current = false;
    } finally {
      gl.setRenderTarget(previousTarget);
      gl.autoClear = autoClear;
    }
  }, -0.5);

  return null;
}
