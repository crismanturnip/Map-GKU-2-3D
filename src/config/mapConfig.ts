import type { BuildingConfig, StandConfig, ZoneConfig } from "../types/map";

export const palette = {
  void: "#070b12",
  ground: "#111923",
  groundEdge: "#263241",
  grass: "#56703a",
  charcoal: "#1a232d",
  navy: "#273f55",
  roof: "#b9c6cf",
  roofEdge: "#8fa4b4",
  orange: "#ff5a1f",
  cyan: "#13dfd0",
  white: "#f4f7f9",
  muted: "#8c9aa7",
  road: "#262d36",
} as const;

export const mapBounds = {
  width: 112,
  depth: 112,
  panX: 45,
  panZ: 36,
} as const;

export const gridDivisions = 28;
export const gridCellSize = mapBounds.width / gridDivisions;
const gku2RearExtension = 4 * gridCellSize;

export const siteLayout = {
  gku2: {
    position: [1, 2],
    rotation: 0,
    rearExtension: gku2RearExtension,
    floors: 5,
    floorHeight: 1.9,
    corridorDepth: 1,
    // Denah U mengikuti citra satelit: blok depan melintang, sayap barat (+x) panjang, sayap timur pendek,
    // dan celah di antara kedua sayap (dilebarkan menjadi 5,5 satuan agar terbaca di 3D) terbuka ke utara.
    wings: [
      { id: "gku2-wing-south", x: [-15.15, 15.15], z: [-4, 7.2] },
      { id: "gku2-wing-west", x: [3, 15.15], z: [7.2, 36] },
      { id: "gku2-wing-east", x: [-15.15, -2.5], z: [7.2, 18.1] },
    ],
    // Keliling gedung; urutan titik membuat sisi kanan setiap ruas menghadap ke luar.
    outline: [
      [15.15, -4],
      [-15.15, -4],
      [-15.15, 18.1],
      [-2.5, 18.1],
      [-2.5, 7.2],
      [3, 7.2],
      [3, 36],
      [15.15, 36],
    ],
    // Indeks ruas outline: 0 fasad depan, 6 ujung utara sayap barat, 7 sisi barat.
    entranceFacades: [0, 7],
    muralFacade: 6,
    metalRoofs: [
      { x: [4, 11.6], z: [24.5, 35.2] },
      { x: [-12.8, -3.4], z: [7.8, 17.5] },
    ],
    // Pelataran beton (relatif terhadap posisi GKU 2) membentang dari tepi luar area tosca sampai tepi luar
    // area oranye, dari tepi depan area sponsor/photobooth sampai di belakang Stage.
    plaza: { x: [-39, 38.95], z: [-27, 49], height: 0.2 },
  },
  stages: [
    { id: "stage-former-gedung-e", name: "Stage", position: [26, 30 + gku2RearExtension] },
  ],
  // Gerbang berdiri di mulut jalan cabang, tepat di pinggir jalan besar, melintang di atas jalan masuk.
  sentraGate: [-12, -27.25],
  // Jalan masuk dari jalur dekat gedung, melewati Sentra Gate, lalu berlanjut 6 satuan di atas pelataran menuju gedung.
  roads: [{ id: "entrance-branch", position: [-12, -24.25], size: [8, 10.5] }],
  // Jalan dua badan: masing-masing satu arah (lajur kiri) dan dipisah median hijau. `offset` adalah garis tengah
  // median, `from`/`to` rentang sepanjang `axis`. Jalan depan berakhir di bundaran; jalan sisi barat menembusnya.
  dualRoads: {
    laneWidth: 5,
    medianWidth: 3,
    roads: [
      { id: "front", axis: "x", offset: -36, from: -56, to: 47.5 },
      { id: "west-side", axis: "z", offset: 47.5, from: -56, to: 56 },
    ],
  },
  roundabout: { position: [47.5, -36], radius: 8, islandRadius: 3.5 },
} as const;

const gku2RearEdge = siteLayout.gku2.position[1] + Math.max(...siteLayout.gku2.wings.map((wing) => wing.z[1]));
const sideAreaHalfWidth = 10.35;
const greenFrontEdge = -5;
const greenCenterZ = (greenFrontEdge + gku2RearEdge) / 2;
const greenHalfDepth = (gku2RearEdge - greenFrontEdge) / 2;

// Koordinat bidang mengikuti sketsa anotasi pengguna dan dapat disesuaikan kembali.
export const zones: readonly ZoneConfig[] = [
  {
    id: "zone-a",
    name: "Zone A",
    color: "#13dfd0",
    position: [-27.65, greenCenterZ],
    points: [
      [-sideAreaHalfWidth, -greenHalfDepth],
      [sideAreaHalfWidth, -greenHalfDepth],
      [sideAreaHalfWidth, greenHalfDepth],
      [-sideAreaHalfWidth, greenHalfDepth],
    ],
    standIds: [],
    // Isi sementara (lorem ipsum); ganti dengan informasi zona sebenarnya.
    info: {
      category: "Lorem ipsum dolor",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis dapibus, posuere velit aliquet.",
      highlights: [
        "Lorem ipsum dolor sit",
        "Consectetur adipiscing elit",
        "Sed do eiusmod tempor",
        "Ut enim ad minim veniam",
      ],
      schedule: "Lorem ipsum · 09.00–17.00",
    },
  },
  {
    id: "zone-b",
    name: "Area Sponsor",
    color: "#f4ed36",
    position: [15, -21.5],
    points: [
      [-5, -3.5],
      [5, -3.5],
      [5, 3.5],
      [-5, 3.5],
    ],
    standIds: [],
    // Isi sementara (lorem ipsum); ganti dengan informasi zona sebenarnya.
    info: {
      category: "Sit amet consectetur",
      description:
        "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam.",
      highlights: [
        "Nemo enim ipsam voluptatem",
        "Quia voluptas sit aspernatur",
        "Neque porro quisquam est",
      ],
      schedule: "Dolor sit · 10.00–16.00",
    },
  },
  {
    id: "zone-c",
    name: "Zone C",
    color: "#ff5a1f",
    position: [34, 11],
    points: [
      [-14.75, gku2RearEdge - 11],
      [-14.75 + 2 * sideAreaHalfWidth, gku2RearEdge - 11],
      [-14.75 + 2 * sideAreaHalfWidth, -13],
      [-14.75, -13],
    ],
    standIds: [],
    // Isi sementara (lorem ipsum); ganti dengan informasi zona sebenarnya.
    info: {
      category: "Adipiscing elit sed",
      description:
        "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.",
      highlights: [
        "Excepteur sint occaecat",
        "Cupidatat non proident",
        "Sunt in culpa qui officia",
        "Deserunt mollit anim",
        "Id est laborum",
      ],
      schedule: "Lorem ipsum · 09.00–18.00",
    },
  },
  {
    id: "zone-e",
    name: "Area Photobooth",
    color: "#5531ff",
    position: [30, -18],
    points: [
      [-10, -6],
      [9, -6],
      [9, 5],
      [1, 5],
      [1, 0],
      [-10, 0],
    ],
    standIds: [],
    // Isi sementara (lorem ipsum); ganti dengan informasi zona sebenarnya.
    info: {
      category: "Eiusmod tempor",
      description:
        "Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus.",
      highlights: [
        "Temporibus autem quibusdam",
        "Et aut officiis debitis",
        "Rerum necessitatibus saepe",
      ],
      schedule: "Amet consectetur · 13.00–20.00",
    },
  },
] as const;

// API stand dan gedung tambahan tetap tersedia untuk data pada tahap berikutnya.
export const stands: readonly StandConfig[] = [];
export const buildings: readonly BuildingConfig[] = [];
