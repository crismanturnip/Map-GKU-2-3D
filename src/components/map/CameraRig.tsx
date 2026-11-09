import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { zones } from "../../config/mapConfig";

const HOME_POSITION = [50, 145, 58] as const;
const HOME_TARGET = [0, 0, 0] as const;
const AUTO_ROTATE_DELAY_MS = 4000;
const FOCUS_DURATION_MS = 800;
// Area yang dipilih mengisi kira-kira setengah ruang pandang yang tidak tertutup popup.
const FOCUS_FILL = 0.5;
// Area kecil (sponsor, photobooth) tetap memperlihatkan sekelilingnya sebagai patokan.
const FOCUS_MIN_DISTANCE = 55;
const MAX_DISTANCE = 300;
const FOCUS_MAX_DISTANCE_RATIO = 0.85;
// Ukuran popup mengikuti .zone-panel di styles.css (lebar 360px di kanan, lembar bawah ≤ 58svh di layar sempit).
const PANEL_WIDTH = 360;
const PANEL_GUTTER = 38;
const NARROW_LAYOUT_PX = 640;
const SHEET_HEIGHT_RATIO = 0.58;
const SHEET_MAX_HEIGHT = 430;

type ViewOffset = [x: number, y: number];

interface CameraPose {
  position: Vector3;
  target: Vector3;
  offset: ViewOffset;
}

interface Flight {
  from: CameraPose;
  to: CameraPose;
  start: number;
}

interface CameraRigProps {
  resetSignal: number;
  focusZoneId: string | null;
}

function zoneFocus(zoneId: string | null) {
  const zone = zones.find((item) => item.id === zoneId);
  if (!zone) return null;
  const xs = zone.points.map(([x]) => x);
  const zs = zone.points.map(([, z]) => z);
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  return {
    center: new Vector3(zone.position[0] + (minX + maxX) / 2, 0, zone.position[1] + (minZ + maxZ) / 2),
    extent: Math.max(maxX - minX, maxZ - minZ),
  };
}

/** Geser gambar (px) agar area terpilih berada di tengah ruang yang tidak tertutup popup. */
function panelOffset(width: number, height: number): ViewOffset {
  if (width <= NARROW_LAYOUT_PX) return [0, Math.min(height * SHEET_HEIGHT_RATIO, SHEET_MAX_HEIGHT) / 2];
  return [(Math.min(PANEL_WIDTH, width - 36) + PANEL_GUTTER) / 2, 0];
}

export function CameraRig({ resetSignal, focusZoneId }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useRef<OrbitControlsImpl>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flight = useRef<Flight | null>(null);
  const overview = useRef<CameraPose | null>(null);
  const viewOffset = useRef<ViewOffset>([0, 0]);
  const focused = useRef(false);
  const lastReset = useRef(resetSignal);
  const [autoRotate, setAutoRotate] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const isNarrow = size.width / size.height < 0.75;
  const focus = useMemo(() => zoneFocus(focusZoneId), [focusZoneId]);

  const pauseRotation = useCallback(() => {
    if (resumeTimer.current !== null) clearTimeout(resumeTimer.current);
    resumeTimer.current = null;
    if (controls.current) controls.current.autoRotate = false;
    setAutoRotate(false);
  }, []);

  const scheduleRotation = useCallback(() => {
    if (resumeTimer.current !== null) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      resumeTimer.current = null;
      // Selama area dipilih kamera tetap diam agar popup bisa dibaca.
      if (!focused.current) setAutoRotate(true);
    }, AUTO_ROTATE_DELAY_MS);
  }, []);

  const currentPose = useCallback(
    (): CameraPose => ({
      position: camera.position.clone(),
      target: controls.current?.target.clone() ?? new Vector3(...HOME_TARGET),
      offset: [...viewOffset.current],
    }),
    [camera],
  );

  const startFlight = useCallback(
    (to: CameraPose) => {
      const control = controls.current;
      if (!control) return;
      // Hentikan sisa inersia drag sebelum kamera diterbangkan.
      control.enableDamping = false;
      control.update();
      control.enabled = false;
      flight.current = { from: currentPose(), to, start: performance.now() };
    },
    [currentPose],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => () => {
    if (resumeTimer.current !== null) clearTimeout(resumeTimer.current);
  }, []);

  useEffect(() => {
    const control = controls.current;
    if (resetSignal > 0) pauseRotation();

    // Reset membatalkan fokus area dan penerbangan kamera yang sedang berjalan.
    flight.current = null;
    overview.current = null;
    viewOffset.current = [0, 0];
    if (camera instanceof PerspectiveCamera) camera.clearViewOffset();

    // Flush any remaining drag inertia before restoring the saved view.
    const wasRotating = control?.autoRotate;
    if (control) {
      control.enabled = true;
      control.enableDamping = false;
      control.autoRotate = false;
      control.update();
    }

    const distanceScale = isNarrow ? 1.7 : 1.15;
    camera.position.set(
      HOME_POSITION[0] * distanceScale,
      HOME_POSITION[1] * distanceScale,
      HOME_POSITION[2] * distanceScale,
    );
    if (camera instanceof PerspectiveCamera) {
      camera.fov = isNarrow ? 60 : 40;
      camera.updateProjectionMatrix();
    }
    if (control) {
      control.target.set(...HOME_TARGET);
      control.update();
      control.enableDamping = true;
      control.autoRotate = resetSignal > 0 ? false : (wasRotating ?? false);
    }
    if (resetSignal > 0) scheduleRotation();
  }, [camera, isNarrow, pauseRotation, resetSignal, scheduleRotation]);

  useEffect(() => {
    // Reset sudah mengembalikan kamera ke tampilan awal pada render yang sama.
    if (resetSignal !== lastReset.current) {
      lastReset.current = resetSignal;
      focused.current = focus !== null;
      return;
    }
    const control = controls.current;
    if (!control || !(camera instanceof PerspectiveCamera)) return;

    if (focus) {
      focused.current = true;
      pauseRotation();
      // Simpan sudut pandang sebelum klik pertama agar bisa kembali ke sana; pindah area tidak menimpanya.
      if (!overview.current) overview.current = currentPose();

      const offset = panelOffset(size.width, size.height);
      const visible = Math.min(size.width - 2 * offset[0], size.height - 2 * offset[1]);
      const unitsPerPixelAtOne = (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2)) / size.height;
      const overviewDistance = overview.current.position.distanceTo(overview.current.target);
      const distance = MathUtils.clamp(
        focus.extent / (FOCUS_FILL * visible * unitsPerPixelAtOne),
        FOCUS_MIN_DISTANCE,
        Math.max(FOCUS_MIN_DISTANCE, overviewDistance * FOCUS_MAX_DISTANCE_RATIO),
      );
      // Kamera mendekat dari arah pandang saat ini agar orientasi pengguna tidak hilang.
      const direction = camera.position.clone().sub(control.target).normalize();
      startFlight({
        position: focus.center.clone().addScaledVector(direction, distance),
        target: focus.center.clone(),
        offset,
      });
    } else if (overview.current) {
      focused.current = false;
      const home = overview.current;
      overview.current = null;
      startFlight(home);
      scheduleRotation();
    }
  }, [camera, currentPose, focus, pauseRotation, resetSignal, scheduleRotation, size, startFlight]);

  useFrame(() => {
    const control = controls.current;
    const active = flight.current;
    if (control && active) {
      const progress = reducedMotion ? 1 : Math.min(1, (performance.now() - active.start) / FOCUS_DURATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      camera.position.lerpVectors(active.from.position, active.to.position, eased);
      control.target.lerpVectors(active.from.target, active.to.target, eased);
      viewOffset.current = [
        MathUtils.lerp(active.from.offset[0], active.to.offset[0], eased),
        MathUtils.lerp(active.from.offset[1], active.to.offset[1], eased),
      ];
      control.update();
      if (progress >= 1) {
        flight.current = null;
        control.enabled = true;
        control.enableDamping = true;
      }
    }

    if (!(camera instanceof PerspectiveCamera)) return;
    const [x, y] = viewOffset.current;
    if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) {
      if (camera.view?.enabled) camera.clearViewOffset();
    } else {
      // Diterapkan setiap frame karena ukuran kanvas bisa berubah saat popup terbuka.
      camera.setViewOffset(size.width, size.height, x, y, size.width, size.height);
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.7}
      enablePan={false}
      enableZoom
      zoomSpeed={0.8}
      minDistance={FOCUS_MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      minPolarAngle={0.25}
      maxPolarAngle={1.5}
      autoRotate={autoRotate && !reducedMotion}
      autoRotateSpeed={0.55}
      onStart={pauseRotation}
      onEnd={scheduleRotation}
    />
  );
}
