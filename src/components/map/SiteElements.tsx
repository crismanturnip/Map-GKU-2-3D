import { Edges, RoundedBox } from "@react-three/drei";
import { Shape } from "three";
import { gridDivisions, mapBounds, palette, siteLayout } from "../../config/mapConfig";
import { SceneLabel } from "./SceneLabel";
import { paintGrass, paintPaving, useCanvasTexture } from "./textures";

const PAVING_TILE = 4;
const GRASS_TILE = 8;
const plazaTrees = [-5.5, 5.5, 11, 16.5] as const;
// Deretan pohon berjarak tetap dari fasad depan, bukan dari tepi pelataran yang kini jauh lebih lebar.
const TREE_ROW_OFFSET = 11.5;
const ARROW_SPACING = 14;
const MEDIAN_TREE_SPACING = 8;
const ROAD_TOP = 0.17;
const ROUNDABOUT_TOP = ROAD_TOP + 0.01;
// Jalan masuk berlanjut di atas pelataran, jadi permukaannya sedikit di atas pelataran.
const BRANCH_TOP = siteLayout.gku2.plaza.height + 0.01;
const BRANCH_DASH = { length: 1.6, gap: 1.4 } as const;
const ROUNDABOUT_ARROW_ANGLES = [0.55, 2.2, 3.85, 5.3] as const;
const MARKING_COLOR = "#d6dce1";

// Panah lajur menghadap +x pada bidang XY; mesh diputar rata ke tanah lalu dibalik untuk arah -x.
const laneArrowShape = new Shape()
  .moveTo(-1.5, -0.16)
  .lineTo(0.35, -0.16)
  .lineTo(0.35, -0.55)
  .lineTo(1.5, 0)
  .lineTo(0.35, 0.55)
  .lineTo(0.35, 0.16)
  .lineTo(-1.5, 0.16)
  .closePath();

function Tree({ position }: { position: readonly [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 1.8, 6]} />
        <meshStandardMaterial color="#6b5137" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 2.3, 0]}>
        <icosahedronGeometry args={[1.1, 0]} />
        <meshStandardMaterial color="#4f7a34" roughness={0.85} flatShading />
      </mesh>
    </group>
  );
}

function GKU2Plaza() {
  const { position, plaza, wings, corridorDepth } = siteLayout.gku2;
  const [south, west, east] = wings;
  const width = plaza.x[1] - plaza.x[0];
  const depth = plaza.z[1] - plaza.z[0];
  const centerX = (plaza.x[0] + plaza.x[1]) / 2;
  const centerZ = (plaza.z[0] + plaza.z[1]) / 2;
  const paving = useCanvasTexture(paintPaving, width / PAVING_TILE, depth / PAVING_TILE);

  // Taman berada di halaman utara antara kedua sayap U, di luar koridor.
  const garden = {
    x: [east.x[0] + 0.3, west.x[0] - corridorDepth - 0.3],
    z: [east.z[1] + corridorDepth + 0.3, west.z[1] - 0.3],
  } as const;
  const gardenWidth = garden.x[1] - garden.x[0];
  const gardenDepth = garden.z[1] - garden.z[0];
  const grass = useCanvasTexture(paintGrass, gardenWidth / GRASS_TILE, gardenDepth / GRASS_TILE);
  // Kerb depan diberi celah di ujung jalan cabang agar jalan masuk langsung menyambung ke pelataran.
  const frontKerbs = siteLayout.roads
    .filter((road) => {
      const plazaFront = position[1] + plaza.z[0];
      return road.position[1] - road.size[1] / 2 < plazaFront && road.position[1] + road.size[1] / 2 >= plazaFront;
    })
    .map((road): Span => [
      road.position[0] - road.size[0] / 2 - position[0],
      road.position[0] + road.size[0] / 2 - position[0],
    ])
    .reduce((spans, cut) => subtractSpan(spans, cut), [plaza.x as Span]);
  const kerbs = [
    ...frontKerbs.map(([start, end]) => ({
      position: [(start + end) / 2, plaza.z[0] + 0.18],
      size: [end - start, 0.36],
    })),
    { position: [centerX, plaza.z[1] - 0.18], size: [width, 0.36] },
    { position: [plaza.x[0] + 0.18, centerZ], size: [0.36, depth] },
    { position: [plaza.x[1] - 0.18, centerZ], size: [0.36, depth] },
  ] as const;

  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh receiveShadow position={[centerX, plaza.height / 2, centerZ]}>
        <boxGeometry args={[width, plaza.height, depth]} />
        <meshStandardMaterial map={paving} roughness={0.95} />
      </mesh>
      {kerbs.map((kerb) => (
        <mesh key={`${kerb.position[0]}-${kerb.position[1]}`} receiveShadow position={[kerb.position[0], plaza.height + 0.04, kerb.position[1]]}>
          <boxGeometry args={[kerb.size[0], 0.08, kerb.size[1]]} />
          <meshStandardMaterial color="#f1ebdf" roughness={0.9} />
        </mesh>
      ))}

      <group position={[(garden.x[0] + garden.x[1]) / 2, plaza.height, (garden.z[0] + garden.z[1]) / 2]}>
        <mesh receiveShadow position={[0, 0.04, 0]}>
          <boxGeometry args={[gardenWidth, 0.08, gardenDepth]} />
          <meshStandardMaterial map={grass} roughness={1} />
        </mesh>
        <mesh receiveShadow position={[0, 0.09, 0]}>
          <boxGeometry args={[1.2, 0.02, gardenDepth]} />
          <meshStandardMaterial color="#d8d2c4" roughness={0.95} />
        </mesh>
        <mesh receiveShadow position={[0, 0.09, 0]}>
          <boxGeometry args={[gardenWidth, 0.02, 1.2]} />
          <meshStandardMaterial color="#d8d2c4" roughness={0.95} />
        </mesh>
        {[-1, 1].map((side) => (
          <Tree key={side} position={[side * gardenWidth * 0.28, 0.08, side * gardenDepth * 0.25]} />
        ))}
      </group>

      {plazaTrees.map((x) => (
        <Tree key={x} position={[x, plaza.height, south.z[0] - TREE_ROW_OFFSET]} />
      ))}
    </group>
  );
}

interface RoadProps {
  position: readonly [number, number];
  size: readonly [number, number];
  top?: number;
}

function Road({ position, size, top = ROAD_TOP }: RoadProps) {
  return (
    <mesh receiveShadow position={[position[0], (top + 0.01) / 2, position[1]]}>
      <boxGeometry args={[size[0], top - 0.01, size[1]]} />
      <meshStandardMaterial color={palette.road} roughness={0.96} />
    </mesh>
  );
}

type DualRoadConfig = (typeof siteLayout.dualRoads.roads)[number];
type Span = readonly [number, number];

/** Bagian rentang [from, to] di luar lingkaran bundaran untuk garis sejajar sumbu pada jarak `lateral`. */
function spansOutsideRoundabout(from: number, to: number, center: number, lateral: number): Span[] {
  const { radius } = siteLayout.roundabout;
  if (Math.abs(lateral) >= radius) return [[from, to]];
  const halfChord = Math.sqrt(radius * radius - lateral * lateral);
  const spans: Span[] = [
    [from, Math.min(to, center - halfChord)],
    [Math.max(from, center + halfChord), to],
  ];
  return spans.filter(([start, end]) => end - start > 0.01);
}

function subtractSpan(spans: readonly Span[], [cutStart, cutEnd]: Span): Span[] {
  return spans
    .flatMap((span): Span[] => [
      [span[0], Math.min(span[1], cutStart)],
      [Math.max(span[0], cutEnd), span[1]],
    ])
    .filter(([start, end]) => end - start > 0.01);
}

/** Celah garis tepi di mulut jalan cabang yang menempel ke sisi luar jalan dua badan, dalam koordinat lokal jalan. */
function branchMouths(road: DualRoadConfig) {
  const halfWidth = siteLayout.dualRoads.medianWidth / 2 + siteLayout.dualRoads.laneWidth;
  const toLocal = (x: number, z: number): Span => (road.axis === "x" ? [x, z - road.offset] : [z, -(x - road.offset)]);

  return siteLayout.roads.flatMap((branch) => {
    const [x1, z1] = toLocal(branch.position[0] - branch.size[0] / 2, branch.position[1] - branch.size[1] / 2);
    const [x2, z2] = toLocal(branch.position[0] + branch.size[0] / 2, branch.position[1] + branch.size[1] / 2);
    const span: Span = [Math.min(x1, x2), Math.max(x1, x2)];
    if (Math.abs(Math.min(z1, z2) - halfWidth) < 0.01) return [{ side: 1, span }];
    if (Math.abs(Math.max(z1, z2) + halfWidth) < 0.01) return [{ side: -1, span }];
    return [];
  });
}

function MedianSegment({ span, width }: { span: Span; width: number }) {
  const length = span[1] - span[0];
  const grass = useCanvasTexture(paintGrass, length / GRASS_TILE, 1);
  const treeCount = Math.max(1, Math.floor(length / MEDIAN_TREE_SPACING));
  const spacing = length / treeCount;

  return (
    <group position={[(span[0] + span[1]) / 2, 0, 0]}>
      <mesh receiveShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[length, 0.3, width]} />
        <meshStandardMaterial color="#8d969d" roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[0, 0.31, 0]}>
        <boxGeometry args={[length - 0.5, 0.04, width - 0.5]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      {Array.from({ length: treeCount }, (_, index) => {
        const x = -length / 2 + (index + 0.5) * spacing;
        return (
          <group key={index}>
            <Tree position={[x, 0.33, 0]} />
            {index < treeCount - 1 && (
              <mesh castShadow position={[x + spacing / 2, 0.6, 0]}>
                <icosahedronGeometry args={[0.55, 0]} />
                <meshStandardMaterial color="#5c8a3c" roughness={0.85} flatShading />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function DualRoad({ road }: { road: DualRoadConfig }) {
  const { laneWidth, medianWidth } = siteLayout.dualRoads;
  const roundabout = siteLayout.roundabout.position;
  // Sumbu x lokal mengikuti arah jalan; jalan sumbu z diputar -90° sehingga x lokal = z dunia.
  const alongX = road.axis === "x";
  const groupPosition: [number, number, number] = alongX ? [0, 0, road.offset] : [road.offset, 0, 0];
  const roundaboutCenter = alongX ? roundabout[0] : roundabout[1];
  const length = road.to - road.from;
  const laneCenter = medianWidth / 2 + laneWidth / 2;
  const mouths = branchMouths(road);
  const arrowCount = Math.floor(length / ARROW_SPACING);
  const arrows = Array.from({ length: arrowCount }, (_, index) => road.from + (index + 0.5) * (length / arrowCount)).filter(
    (x) => Math.abs(x - roundaboutCenter) > siteLayout.roundabout.radius + 2,
  );

  return (
    <group position={groupPosition} rotation={[0, alongX ? 0 : -Math.PI / 2, 0]}>
      {[-1, 1].map((side) => {
        const z = side * laneCenter;
        const edges = [z - laneWidth / 2 + 0.35, z + laneWidth / 2 - 0.35];
        const outerEdge = edges[side > 0 ? 1 : 0];
        const edgeSpans = (edge: number) =>
          mouths
            .filter((mouth) => mouth.side === side && edge === outerEdge)
            .reduce(
              (spans, mouth) => subtractSpan(spans, mouth.span),
              spansOutsideRoundabout(road.from, road.to, roundaboutCenter, edge),
            );
        return (
          <group key={side}>
            <Road position={[(road.from + road.to) / 2, z]} size={[length, laneWidth]} />
            {edges.flatMap((edge) =>
              edgeSpans(edge).map(([start, end]) => (
                <mesh
                  key={`${edge}-${start}`}
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={[(start + end) / 2, ROAD_TOP + 0.01, edge]}
                >
                  <planeGeometry args={[end - start, 0.12]} />
                  <meshBasicMaterial color={MARKING_COLOR} transparent opacity={0.55} />
                </mesh>
              )),
            )}
            {/* Lajur kiri: badan jalan di sisi +z lokal selalu menuju -x lokal, berlaku untuk kedua sumbu. */}
            {arrows.map((x) => (
              <mesh key={x} rotation={[-Math.PI / 2, 0, side > 0 ? Math.PI : 0]} position={[x, ROAD_TOP + 0.01, z]}>
                <shapeGeometry args={[laneArrowShape]} />
                <meshBasicMaterial color={MARKING_COLOR} transparent opacity={0.7} />
              </mesh>
            ))}
          </group>
        );
      })}
      {spansOutsideRoundabout(road.from, road.to, roundaboutCenter, medianWidth / 2).map((span) => (
        <MedianSegment key={span[0]} span={span} width={medianWidth} />
      ))}
    </group>
  );
}

function Roundabout() {
  const { position, radius, islandRadius } = siteLayout.roundabout;
  const grass = useCanvasTexture(paintGrass, (islandRadius * 2) / GRASS_TILE, (islandRadius * 2) / GRASS_TILE);
  const laneRadius = (radius + islandRadius) / 2;

  return (
    <group position={[position[0], 0, position[1]]}>
      {/* Hanya 0.01 di atas jalan: cukup menutup ujung jalan tanpa berkedip, tetapi tidak terlihat sebagai undakan. */}
      <mesh receiveShadow position={[0, ROUNDABOUT_TOP / 2, 0]}>
        <cylinderGeometry args={[radius, radius, ROUNDABOUT_TOP, 64]} />
        <meshStandardMaterial color={palette.road} roughness={0.96} />
      </mesh>
      {/* Hanya sisi barat yang tidak dimasuki jalan, jadi garis tepi luar cukup di busur itu. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROUNDABOUT_TOP + 0.01, 0]}>
        <ringGeometry args={[radius - 0.47, radius - 0.35, 32, 1, -0.62, 1.24]} />
        <meshBasicMaterial color={MARKING_COLOR} transparent opacity={0.55} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROUNDABOUT_TOP + 0.01, 0]}>
        <ringGeometry args={[islandRadius + 0.35, islandRadius + 0.47, 64]} />
        <meshBasicMaterial color={MARKING_COLOR} transparent opacity={0.55} />
      </mesh>
      {/* Lajur kiri berputar searah jarum jam dilihat dari atas, yaitu sudut atan2(z, x) yang bertambah. */}
      {ROUNDABOUT_ARROW_ANGLES.map((angle) => (
        <mesh
          key={angle}
          rotation={[-Math.PI / 2, 0, -angle - Math.PI / 2]}
          position={[Math.cos(angle) * laneRadius, ROUNDABOUT_TOP + 0.01, Math.sin(angle) * laneRadius]}
          scale={0.8}
        >
          <shapeGeometry args={[laneArrowShape]} />
          <meshBasicMaterial color={MARKING_COLOR} transparent opacity={0.7} />
        </mesh>
      ))}
      <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[islandRadius, islandRadius, 0.4, 40]} />
        <meshStandardMaterial color="#8d969d" roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[0, 0.42, 0]}>
        <cylinderGeometry args={[islandRadius - 0.3, islandRadius - 0.3, 0.04, 40]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      <Tree position={[0, 0.44, 0]} />
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = (index / 6) * Math.PI * 2 + 0.3;
        return (
          <mesh key={index} castShadow position={[Math.cos(angle) * 2.1, 0.7, Math.sin(angle) * 2.1]}>
            <icosahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial color="#5c8a3c" roughness={0.85} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

function Roads() {
  return (
    <group>
      {siteLayout.roads.map((road) => (
        <group key={road.id}>
          <Road position={road.position} size={road.size} top={BRANCH_TOP} />
          {/* Jalan cabang membentang sepanjang z; garis tepinya menyambung dari jalan besar sampai ke atas pelataran. */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[road.position[0] + side * (road.size[0] / 2 - 0.35), BRANCH_TOP + 0.01, road.position[1]]}
            >
              <planeGeometry args={[0.12, road.size[1]]} />
              <meshBasicMaterial color={MARKING_COLOR} transparent opacity={0.55} />
            </mesh>
          ))}
          {Array.from(
            { length: Math.floor(road.size[1] / (BRANCH_DASH.length + BRANCH_DASH.gap)) },
            (_, index) => road.position[1] - road.size[1] / 2 + BRANCH_DASH.gap + index * (BRANCH_DASH.length + BRANCH_DASH.gap),
          ).map((start) => (
            <mesh
              key={start}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[road.position[0], BRANCH_TOP + 0.01, start + BRANCH_DASH.length / 2]}
            >
              <planeGeometry args={[0.14, BRANCH_DASH.length]} />
              <meshBasicMaterial color={MARKING_COLOR} transparent opacity={0.6} />
            </mesh>
          ))}
        </group>
      ))}
      {siteLayout.dualRoads.roads.map((road) => (
        <DualRoad key={road.id} road={road} />
      ))}
      <Roundabout />
    </group>
  );
}

function Stage({ position, name }: { position: readonly [number, number]; name: string }) {
  return (
    <group position={[position[0], 0.3, position[1]]}>
      <RoundedBox args={[13, 1.3, 7]} radius={0.35} smoothness={3} castShadow>
        <meshStandardMaterial color={palette.charcoal} />
      </RoundedBox>
      <mesh castShadow position={[0, 4, 2.6]}>
        <boxGeometry args={[13, 0.35, 0.5]} />
        <meshStandardMaterial color={palette.orange} emissive={palette.orange} emissiveIntensity={0.22} />
      </mesh>
      {[-6, 6].map((x) => (
        <mesh key={x} castShadow position={[x, 2.3, 2.6]}>
          <boxGeometry args={[0.3, 4, 0.3]} />
          <meshStandardMaterial color={palette.roofEdge} metalness={0.45} />
        </mesh>
      ))}
      <SceneLabel text={name} position={[0, 5.2, 0]} compact tone="accent" />
    </group>
  );
}

function SentraGate() {
  return (
    <group position={[siteLayout.sentraGate[0], 0.2, siteLayout.sentraGate[1]]}>
      {[-5.2, 5.2].map((x) => (
        <mesh key={x} castShadow position={[x, 2.7, 0]}>
          <boxGeometry args={[1, 5.4, 1]} />
          <meshStandardMaterial color={palette.charcoal} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 5.15, 0]}>
        <boxGeometry args={[11.4, 1.15, 1.1]} />
        <meshStandardMaterial color={palette.orange} emissive={palette.orange} emissiveIntensity={0.18} />
      </mesh>
      <SceneLabel text="Sentra Gate" position={[0, 7.1, 0]} compact />
    </group>
  );
}

export function SiteElements() {
  return (
    <>
      <mesh receiveShadow position={[0, -0.1, 0]}>
        <boxGeometry args={[mapBounds.width, 0.2, mapBounds.depth]} />
        <meshStandardMaterial color={palette.ground} roughness={0.98} />
        <Edges color={palette.groundEdge} />
      </mesh>
      <gridHelper args={[mapBounds.width, gridDivisions, "#334353", "#1c2732"]} position={[0, 0.03, 0]} />
      <Roads />
      <GKU2Plaza />
      {siteLayout.stages.map((stage) => (
        <Stage key={stage.id} position={stage.position} name={stage.name} />
      ))}
      <SentraGate />
    </>
  );
}
