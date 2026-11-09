import { Edges } from "@react-three/drei";
import { buildings, palette } from "../../config/mapConfig";
import type { BuildingConfig } from "../../types/map";
import { GKU2Building } from "./GKU2Building";
import { SceneLabel } from "./SceneLabel";

interface BlockProps {
  name?: string;
  position: readonly [number, number, number];
  size: readonly [number, number, number];
  wallColor?: string;
  roofColor?: string;
}

function ArchitecturalBlock({ name, position, size, wallColor = palette.navy, roofColor = palette.roof }: BlockProps) {
  const [width, depth, height] = size;

  return (
    <group name={name} position={position}>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={wallColor} roughness={0.83} metalness={0.04} />
        <Edges color="#47647d" threshold={20} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, height + 0.17, 0]}>
        <boxGeometry args={[width + 0.24, 0.34, depth + 0.24]} />
        <meshStandardMaterial color={roofColor} roughness={0.72} />
      </mesh>
    </group>
  );
}

function SimpleBuilding({ config }: { config: BuildingConfig }) {
  const [width, depth, height] = config.size;
  return (
    <group position={[config.position[0], 0.25, config.position[1]]} rotation={[0, config.rotation ?? 0, 0]}>
      <ArchitecturalBlock
        position={[0, 0, 0]}
        size={[width, depth, height]}
        wallColor={config.wallColor}
        roofColor={config.roofColor}
      />
      <SceneLabel text={config.name} position={[0, height + 2.2, 0]} compact />
    </group>
  );
}

export function Buildings() {
  return (
    <>
      <GKU2Building />
      {buildings.map((building) => (
        <SimpleBuilding key={building.id} config={building} />
      ))}
    </>
  );
}
