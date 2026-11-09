import { Canvas } from "@react-three/fiber";
import { Suspense, useState } from "react";
import { zones } from "../../config/mapConfig";
import type { StandConfig, ZoneConfig } from "../../types/map";
import { KExpoScene } from "./KExpoScene";
import { SpaceBackground } from "./SpaceBackground";
import { SpaceBackdrop } from "./SpaceBackdrop";
import { ZoneInfoPanel } from "./ZoneInfoPanel";

export interface KExpoMap3DProps {
  className?: string;
  onZoneSelect?: (zone: ZoneConfig | null) => void;
  onStandSelect?: (stand: StandConfig | null) => void;
  selectionAnnouncement?: string;
}

export function KExpoMap3D({
  className = "",
  onZoneSelect,
  onStandSelect,
  selectionAnnouncement,
}: KExpoMap3DProps) {
  const [resetSignal, setResetSignal] = useState(0);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedStandId, setSelectedStandId] = useState<string | null>(null);
  const [internalAnnouncement, setInternalAnnouncement] = useState("Belum ada objek dipilih");
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? null;

  const selectZone = (zone: ZoneConfig) => {
    setSelectedZoneId(zone.id);
    setSelectedStandId(null);
    setInternalAnnouncement(zone.name);
    onStandSelect?.(null);
    onZoneSelect?.(zone);
  };

  const selectStand = (stand: StandConfig) => {
    setSelectedStandId(stand.id);
    setSelectedZoneId(null);
    setInternalAnnouncement(`${stand.id} · ${stand.name}`);
    onZoneSelect?.(null);
    onStandSelect?.(stand);
  };

  const clearSelection = () => {
    setSelectedZoneId(null);
    setSelectedStandId(null);
    setInternalAnnouncement("Belum ada objek dipilih");
    onZoneSelect?.(null);
    onStandSelect?.(null);
  };

  return (
    <section className={`map-viewport ${selectedZone ? "has-zone-panel" : ""} ${className}`} aria-label="Peta 3D interaktif kawasan GKU 2">
      <SpaceBackground />

      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [50, 145, 58], fov: 40, near: 1, far: 500 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onPointerMissed={clearSelection}
      >
        <SpaceBackdrop />
        <Suspense fallback={null}>
          <KExpoScene
            resetSignal={resetSignal}
            selectedZoneId={selectedZoneId}
            selectedStandId={selectedStandId}
            onZoneSelect={selectZone}
            onStandSelect={selectStand}
          />
        </Suspense>
      </Canvas>

      <div className="map-hud map-hud--brand">
        <img
          className="map-brand-logo"
          src={`${import.meta.env.BASE_URL}branding/kemahasiswaan-expo-itera.png`}
          alt="Kemahasiswaan Expo ITERA"
          width={1909}
          height={528}
          draggable={false}
        />
      </div>

      <button
        className="reset-button"
        type="button"
        onClick={() => {
          clearSelection();
          setResetSignal((value) => value + 1);
        }}
        aria-label="Kembalikan kamera ke tampilan awal"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.8 8.5A8 8 0 1 1 4 14h2.1a6 6 0 1 0 .35-4.05L9 12.5H3v-6l1.8 2Z" />
        </svg>
        Reset view
      </button>

      <div className={`selection-pill${selectedZoneId || selectedStandId ? " selection-pill--name" : ""}`} role="status" aria-live="polite">
        <span className="selection-dot" />
        {selectionAnnouncement ?? internalAnnouncement}
      </div>

      {selectedZone && <ZoneInfoPanel zone={selectedZone} onClose={clearSelection} />}
    </section>
  );
}

export default KExpoMap3D;
