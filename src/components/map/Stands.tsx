import { Edges } from "@react-three/drei";
import { useState } from "react";
import { palette, stands } from "../../config/mapConfig";
import type { StandConfig } from "../../types/map";
import { SceneLabel } from "./SceneLabel";

interface StandMeshProps {
  stand: StandConfig;
  selected: boolean;
  onSelect: (stand: StandConfig) => void;
}

function StandMesh({ stand, selected, onSelect }: StandMeshProps) {
  const [hovered, setHovered] = useState(false);
  const highlighted = hovered || selected;

  return (
    <group
      position={[stand.position[0], 0.35, stand.position[1]]}
      rotation={[0, stand.rotation ?? 0, 0]}
      scale={highlighted ? 1.12 : 1}
      onClick={(event) => {
        event.stopPropagation();
        if (event.delta > 6) return;
        onSelect(stand);
      }}
      onPointerEnter={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
    >
      <mesh castShadow receiveShadow position={[0, 0.55, 0]}>
        <boxGeometry args={[4.3, 1.1, 2.7]} />
        <meshStandardMaterial
          color={highlighted ? palette.orange : stand.color ?? palette.white}
          emissive={highlighted ? palette.orange : "#000000"}
          emissiveIntensity={highlighted ? 0.28 : 0}
          roughness={0.73}
        />
        <Edges color={highlighted ? "#ffffff" : "#71808d"} threshold={18} />
      </mesh>
      <mesh castShadow position={[0, 1.45, 0]}>
        <boxGeometry args={[4.65, 0.22, 3]} />
        <meshStandardMaterial color={highlighted ? "#ff8a58" : palette.charcoal} />
      </mesh>
      {[-1.75, 1.75].map((x) =>
        [-1.05, 1.05].map((z) => (
          <mesh key={`${x}-${z}`} castShadow position={[x, 0.95, z]}>
            <boxGeometry args={[0.14, 1.9, 0.14]} />
            <meshStandardMaterial color={palette.charcoal} />
          </mesh>
        )),
      )}
      {(hovered || selected) && (
        <SceneLabel text={stand.id} position={[0, 3.25, 0]} tone={selected ? "accent" : "default"} compact />
      )}
    </group>
  );
}

interface StandsProps {
  selectedStandId: string | null;
  onSelect: (stand: StandConfig) => void;
}

export function Stands({ selectedStandId, onSelect }: StandsProps) {
  return stands.map((item) => (
    <StandMesh key={item.id} stand={item} selected={selectedStandId === item.id} onSelect={onSelect} />
  ));
}
