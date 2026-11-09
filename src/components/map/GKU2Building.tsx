import { Instance, Instances } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";
import { siteLayout } from "../../config/mapConfig";
import type { Position3D } from "../../types/map";
import { SceneLabel } from "./SceneLabel";
import { paintMural, useCanvasTexture } from "./textures";

type Vec2 = readonly [number, number];

const gku2 = siteLayout.gku2;
const FLOOR_HEIGHT = gku2.floorHeight;
const BUILDING_HEIGHT = gku2.floors * FLOOR_HEIGHT;
const CORRIDOR = gku2.corridorDepth;
const TARGET_BAY_WIDTH = 3.3;
const UPPER_FLOORS = Array.from({ length: gku2.floors - 1 }, (_, index) => index + 1);
const ENTRANCE_FACADES = new Set<number>(gku2.entranceFacades);

const colors = {
  wall: "#eceeeb",
  column: "#575e66",
  slab: "#dadddf",
  rail: "#2b3036",
  fascia: "#c9ced2",
  coping: "#8d4a3b",
  deck: "#b3ac9f",
  frame: "#fbfbf9",
  glass: "#4f626d",
  stairwell: "#3d454d",
  ac: "#e2e4e5",
  metal: "#87919a",
  plinth: "#9ca1a5",
} as const;

interface Facade {
  index: number;
  mid: Vec2;
  dir: Vec2;
  normal: Vec2;
  angle: number;
  length: number;
  extendStart: number;
  extendEnd: number;
  bays: number;
  entranceBay: number | null;
}

interface Placement {
  position: Position3D;
  rotation: number;
  scale?: Position3D;
}

function turn(a: Vec2, b: Vec2, c: Vec2) {
  return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
}

function createFacades(): Facade[] {
  const outline: readonly Vec2[] = gku2.outline;

  return outline.map((start, index) => {
    const count = outline.length;
    const end = outline[(index + 1) % count];
    const previous = outline[(index + count - 1) % count];
    const next = outline[(index + 2) % count];
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const dir: Vec2 = [(end[0] - start[0]) / length, (end[1] - start[1]) / length];
    const bays = Math.max(1, Math.round(length / TARGET_BAY_WIDTH));

    return {
      index,
      mid: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
      dir,
      // Urutan titik membuat sumbu +z lokal setiap fasad mengarah ke luar gedung.
      normal: [-dir[1], dir[0]],
      angle: Math.atan2(-dir[1], dir[0]),
      length,
      // Koridor hanya diteruskan melewati sudut cembung; sudut cekung sudah tertutup fasad sebelahnya.
      extendStart: turn(previous, start, end) < 0 ? CORRIDOR : 0,
      extendEnd: turn(start, end, next) < 0 ? CORRIDOR : 0,
      bays,
      entranceBay: ENTRANCE_FACADES.has(index) ? Math.floor(bays / 2) : null,
    };
  });
}

function createFacadeDetails(facades: readonly Facade[]) {
  const details = {
    plinths: [] as Placement[],
    slabs: [] as Placement[],
    rails: [] as Placement[],
    fasciae: [] as Placement[],
    copings: [] as Placement[],
    columns: [] as Placement[],
    frames: [] as Placement[],
    panes: [] as Placement[],
    mullions: [] as Placement[],
    stairwells: [] as Placement[],
    acUnits: [] as Placement[],
  };

  for (const facade of facades) {
    const bay = facade.length / facade.bays;
    const start = -facade.length / 2;
    const place = (u: number, y: number, v: number, scale?: Position3D): Placement => ({
      position: [
        facade.mid[0] + facade.dir[0] * u + facade.normal[0] * v,
        y,
        facade.mid[1] + facade.dir[1] * u + facade.normal[1] * v,
      ],
      rotation: facade.angle,
      scale,
    });

    // Pelat koridor, railing, dan lisplang memakai kotak satuan yang diskalakan sepanjang fasad.
    const span = facade.length + facade.extendStart + facade.extendEnd;
    const spanCenter = (facade.extendEnd - facade.extendStart) / 2;
    details.plinths.push(place(spanCenter, 0.12, CORRIDOR / 2, [span, 0.24, CORRIDOR]));
    for (const floor of UPPER_FLOORS) {
      const level = floor * FLOOR_HEIGHT;
      details.slabs.push(place(spanCenter, level, CORRIDOR / 2, [span, 0.2, CORRIDOR]));
      for (const height of [0.55, 0.98]) {
        details.rails.push(place(spanCenter, level + height, CORRIDOR - 0.06, [span, 0.06, 0.06]));
      }
    }
    details.fasciae.push(place(spanCenter, BUILDING_HEIGHT + 0.5, CORRIDOR - 0.12, [span, 1, 0.3]));
    details.copings.push(place(spanCenter, BUILDING_HEIGHT + 1.04, CORRIDOR - 0.12, [span, 0.08, 0.36]));

    if (facade.extendStart > 0) {
      details.columns.push(place(start - facade.extendStart + 0.2, BUILDING_HEIGHT / 2, CORRIDOR - 0.2));
    }
    for (let column = 0; column <= facade.bays; column++) {
      details.columns.push(place(start + column * bay, BUILDING_HEIGHT / 2, CORRIDOR - 0.2));
    }

    for (let bayIndex = 0; bayIndex < facade.bays; bayIndex++) {
      const center = start + (bayIndex + 0.5) * bay;
      for (let floor = 0; floor < gku2.floors; floor++) {
        const windowY = floor * FLOOR_HEIGHT + 1.08;
        if (bayIndex === facade.entranceBay) {
          if (floor > 0) details.stairwells.push(place(center, windowY - 0.05, 0.04));
          continue;
        }
        for (const offset of [-0.24, 0.24]) {
          details.frames.push(place(center + offset * bay, windowY, 0.03));
          details.panes.push(place(center + offset * bay, windowY, 0.05));
          details.mullions.push(place(center + offset * bay, windowY, 0.08));
        }
        if ((bayIndex * 5 + floor * 3 + facade.index) % 4 === 0) {
          details.acUnits.push(place(center, floor * FLOOR_HEIGHT + 0.5, 0.2));
        }
      }
    }
  }

  return details;
}

interface InstancedBoxesProps {
  items: readonly Placement[];
  size: readonly [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
  castShadow?: boolean;
}

function InstancedBoxes({ items, size, color, roughness = 0.8, metalness = 0, castShadow = false }: InstancedBoxesProps) {
  return (
    <Instances limit={items.length} castShadow={castShadow} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
      {items.map((item, index) => (
        <Instance key={index} position={item.position} rotation={[0, item.rotation, 0]} scale={item.scale ?? 1} />
      ))}
    </Instances>
  );
}

function Entrance({ facade }: { facade: Facade }) {
  if (facade.entranceBay === null) return null;
  const bay = facade.length / facade.bays;
  const center = -facade.length / 2 + (facade.entranceBay + 0.5) * bay;

  return (
    <group position={[facade.mid[0], 0, facade.mid[1]]} rotation={[0, facade.angle, 0]}>
      <group position={[center, 0, 0]}>
        <mesh position={[0, 1.04, 0.05]}>
          <boxGeometry args={[bay * 0.72, 1.6, 0.08]} />
          <meshStandardMaterial color={colors.glass} roughness={0.22} metalness={0.35} />
        </mesh>
        <mesh position={[0, 1.04, 0.1]}>
          <boxGeometry args={[0.07, 1.6, 0.04]} />
          <meshStandardMaterial color={colors.frame} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, FLOOR_HEIGHT - 0.02, CORRIDOR + 0.8]}>
          <boxGeometry args={[bay + 0.6, 0.18, 1.6]} />
          <meshStandardMaterial color={colors.fascia} roughness={0.75} />
        </mesh>
        {[0.24, 0.12].map((height, step) => (
          <mesh key={height} receiveShadow position={[0, height / 2, CORRIDOR + 0.3 + step * 0.6]}>
            <boxGeometry args={[bay + 0.8, height, 0.6]} />
            <meshStandardMaterial color={colors.plinth} roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Mural({ facade }: { facade: Facade }) {
  const texture = useCanvasTexture(paintMural);
  const width = 4.6;
  const height = BUILDING_HEIGHT + 1.08;

  return (
    <group position={[facade.mid[0], 0, facade.mid[1]]} rotation={[0, facade.angle, 0]}>
      <mesh castShadow position={[facade.length / 2 + facade.extendEnd - width / 2, height / 2, CORRIDOR + 0.08]}>
        <boxGeometry args={[width, height, 0.16]} />
        <meshStandardMaterial map={texture} roughness={0.8} />
      </mesh>
    </group>
  );
}

function MetalRoof({ x, z }: { x: readonly [number, number]; z: readonly [number, number] }) {
  const width = x[1] - x[0];
  const length = z[1] - z[0];
  const clerestory = 0.6;
  const geometry = useMemo(() => {
    const rise = Math.min(1.8, width * 0.15);
    const shape = new Shape();
    shape.moveTo(-width / 2 - 0.35, 0);
    shape.lineTo(width / 2 + 0.35, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    return new ExtrudeGeometry(shape, { depth: length + 0.7, bevelEnabled: false });
  }, [length, width]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group position={[(x[0] + x[1]) / 2, BUILDING_HEIGHT + 0.06, z[0]]}>
      <mesh castShadow receiveShadow position={[0, clerestory / 2, length / 2]}>
        <boxGeometry args={[width, clerestory, length]} />
        <meshStandardMaterial color={colors.slab} roughness={0.85} />
      </mesh>
      <mesh castShadow receiveShadow geometry={geometry} position={[0, clerestory, -0.35]}>
        <meshStandardMaterial color={colors.metal} roughness={0.55} metalness={0.3} flatShading />
      </mesh>
    </group>
  );
}

function RooftopDetails() {
  const roof = BUILDING_HEIGHT + 0.06;
  const tanks: readonly Vec2[] = [[-6.6, 1.4], [3, 2.2], [5.4, 2.2], [9, 13]];

  return (
    <group>
      <group position={[-11.4, roof, 0.4]}>
        <mesh castShadow receiveShadow position={[0, 1.2, 0]}>
          <boxGeometry args={[3.2, 2.4, 3.2]} />
          <meshStandardMaterial color={colors.wall} roughness={0.88} />
        </mesh>
        <mesh castShadow position={[0, 2.5, 0]}>
          <boxGeometry args={[3.6, 0.2, 3.6]} />
          <meshStandardMaterial color={colors.fascia} roughness={0.75} />
        </mesh>
      </group>
      {tanks.map(([x, z]) => (
        <mesh key={`${x}-${z}`} castShadow position={[x, roof + 0.55, z]}>
          <cylinderGeometry args={[0.55, 0.55, 1.1, 16]} />
          <meshStandardMaterial color="#d9d4c8" roughness={0.7} />
        </mesh>
      ))}
      <mesh castShadow position={[13.4, roof + 1.9, -2.4]}>
        <cylinderGeometry args={[0.06, 0.09, 3.8, 6]} />
        <meshStandardMaterial color={colors.rail} metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

export function GKU2Building() {
  const facades = useMemo(createFacades, []);
  const details = useMemo(() => createFacadeDetails(facades), [facades]);

  return (
    <group
      position={[gku2.position[0], gku2.plaza.height, gku2.position[1]]}
      rotation={[0, gku2.rotation, 0]}
    >
      {gku2.wings.map((wing, index) => {
        const width = wing.x[1] - wing.x[0];
        const depth = wing.z[1] - wing.z[0];
        return (
          <group key={wing.id} name={wing.id} position={[(wing.x[0] + wing.x[1]) / 2, 0, (wing.z[0] + wing.z[1]) / 2]}>
            <mesh castShadow receiveShadow position={[0, BUILDING_HEIGHT / 2, 0]}>
              <boxGeometry args={[width, BUILDING_HEIGHT, depth]} />
              <meshStandardMaterial color={colors.wall} roughness={0.88} />
            </mesh>
            {/* Dak melebar menutup koridor; tinggi sedikit berbeda agar dak yang bertemu tidak berkedip. */}
            <mesh receiveShadow position={[0, BUILDING_HEIGHT - 0.04 + index * 0.05, 0]}>
              <boxGeometry args={[width + CORRIDOR * 2, 0.2, depth + CORRIDOR * 2]} />
              <meshStandardMaterial color={colors.deck} roughness={0.95} />
            </mesh>
          </group>
        );
      })}

      {facades.map((facade) => (
        <Entrance key={facade.index} facade={facade} />
      ))}
      <Mural facade={facades[gku2.muralFacade]} />

      <InstancedBoxes items={details.plinths} size={[1, 1, 1]} color={colors.plinth} roughness={0.9} />
      <InstancedBoxes items={details.slabs} size={[1, 1, 1]} color={colors.slab} roughness={0.85} castShadow />
      <InstancedBoxes items={details.rails} size={[1, 1, 1]} color={colors.rail} roughness={0.5} metalness={0.4} />
      <InstancedBoxes items={details.fasciae} size={[1, 1, 1]} color={colors.fascia} roughness={0.75} castShadow />
      <InstancedBoxes items={details.copings} size={[1, 1, 1]} color={colors.coping} />
      <InstancedBoxes items={details.columns} size={[0.36, BUILDING_HEIGHT, 0.36]} color={colors.column} castShadow />
      <InstancedBoxes items={details.frames} size={[0.82, 1.04, 0.06]} color={colors.frame} />
      <InstancedBoxes items={details.panes} size={[0.66, 0.88, 0.04]} color={colors.glass} roughness={0.25} metalness={0.3} />
      <InstancedBoxes items={details.mullions} size={[0.05, 0.88, 0.02]} color={colors.frame} />
      <InstancedBoxes items={details.stairwells} size={[2.4, 1.45, 0.05]} color={colors.stairwell} roughness={0.9} />
      <InstancedBoxes items={details.acUnits} size={[0.5, 0.34, 0.26]} color={colors.ac} roughness={0.6} />

      {gku2.metalRoofs.map((roof) => (
        <MetalRoof key={`${roof.x[0]}-${roof.z[0]}`} x={roof.x} z={roof.z} />
      ))}
      <RooftopDetails />
      <SceneLabel text="GKU 2" position={[0, BUILDING_HEIGHT + 5, 12]} tone="accent" />
    </group>
  );
}
