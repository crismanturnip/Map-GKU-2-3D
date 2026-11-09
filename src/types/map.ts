export type Position2D = readonly [x: number, z: number];
export type Position3D = readonly [x: number, y: number, z: number];

/** Informasi yang ditampilkan di popup saat zona dipilih. */
export interface ZoneInfo {
  category: string;
  description: string;
  highlights: readonly string[];
  schedule: string;
}

export interface ZoneConfig {
  id: string;
  name: string;
  color: string;
  position: Position2D;
  points: readonly Position2D[];
  standIds: readonly string[];
  info?: ZoneInfo;
}

export interface StandConfig {
  id: string;
  name: string;
  zoneId: string;
  position: Position2D;
  rotation?: number;
  color?: string;
}

export interface BuildingConfig {
  id: string;
  name: string;
  position: Position2D;
  size: readonly [width: number, depth: number, height: number];
  rotation?: number;
  wallColor?: string;
  roofColor?: string;
}
