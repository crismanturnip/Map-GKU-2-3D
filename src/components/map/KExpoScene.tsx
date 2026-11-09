import { ContactShadows } from "@react-three/drei";
import { Buildings } from "./Buildings";
import { CameraRig } from "./CameraRig";
import { SiteElements } from "./SiteElements";
import { Stands } from "./Stands";
import { Zones } from "./Zones";
import type { StandConfig, ZoneConfig } from "../../types/map";

interface KExpoSceneProps {
  resetSignal: number;
  selectedZoneId: string | null;
  selectedStandId: string | null;
  onZoneSelect: (zone: ZoneConfig) => void;
  onStandSelect: (stand: StandConfig) => void;
}

export function KExpoScene({
  resetSignal,
  selectedZoneId,
  selectedStandId,
  onZoneSelect,
  onStandSelect,
}: KExpoSceneProps) {
  return (
    <>
      <ambientLight intensity={1.25} color="#b7c8d6" />
      <hemisphereLight args={["#bcecff", "#111722", 1.35]} />
      <directionalLight
        castShadow
        position={[30, 65, 24]}
        intensity={3.1}
        color="#fff4dd"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-72}
        shadow-camera-right={72}
        shadow-camera-top={72}
        shadow-camera-bottom={-72}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-55, 26, -35]} intensity={0.85} color="#2bd9ff" />

      <SiteElements />
      <Zones selectedZoneId={selectedZoneId} onSelect={onZoneSelect} />
      <Buildings />
      <Stands selectedStandId={selectedStandId} onSelect={onStandSelect} />
      <ContactShadows frames={1} position={[0, 0.04, 0]} scale={125} opacity={0.36} blur={2.5} far={30} />
      <CameraRig resetSignal={resetSignal} focusZoneId={selectedZoneId} />
    </>
  );
}
