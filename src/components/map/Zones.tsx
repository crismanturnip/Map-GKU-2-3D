import { Edges } from "@react-three/drei";
import { useMemo, useState } from "react";
import { Shape } from "three";
import { zones } from "../../config/mapConfig";
import type { ZoneConfig } from "../../types/map";
import { SceneLabel } from "./SceneLabel";

interface ZoneMeshProps {
  zone: ZoneConfig;
  selected: boolean;
  onSelect: (zone: ZoneConfig) => void;
}

function ZoneMesh({ zone, selected, onSelect }: ZoneMeshProps) {
  const [hovered, setHovered] = useState(false);
  const shape = useMemo(() => {
    const next = new Shape();
    zone.points.forEach(([x, z], index) => {
      // ShapeGeometry lives in XY; the mesh rotation maps -Y onto world +Z.
      if (index === 0) next.moveTo(x, -z);
      else next.lineTo(x, -z);
    });
    next.closePath();
    return next;
  }, [zone]);

  const highlighted = hovered || selected;

  return (
    <group position={[zone.position[0], 0.22, zone.position[1]]}>
      <mesh
        name={`area-${zone.id}`}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(event) => {
          event.stopPropagation();
          if (event.delta > 6) return;
          onSelect(zone);
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
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color={zone.color}
          transparent={false}
          opacity={1}
          emissive={zone.color}
          emissiveIntensity={highlighted ? 0.34 : 0.08}
          roughness={0.78}
          // Zona hanya 0.02 di atas pelataran; offset mencegah z-fighting dari jarak kamera yang jauh.
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
        <Edges color={selected ? "#ffffff" : zone.color} threshold={8} />
      </mesh>
      {(hovered || selected) && (
        <SceneLabel text={zone.name} position={[0, 2.1, 0]} tone={selected ? "accent" : "default"} compact />
      )}
    </group>
  );
}

interface ZonesProps {
  selectedZoneId: string | null;
  onSelect: (zone: ZoneConfig) => void;
}

export function Zones({ selectedZoneId, onSelect }: ZonesProps) {
  return zones.map((zone) => (
    <ZoneMesh key={zone.id} zone={zone} selected={selectedZoneId === zone.id} onSelect={onSelect} />
  ));
}
