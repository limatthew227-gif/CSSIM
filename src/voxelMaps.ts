import type { MapId } from "./gameData";
import { bakedVoxelMaps, VOXEL_DATA_PATCH } from "./voxelMapData";

export type VoxelPalette = {
  ground: string[];
  lowerGround: string;
  wall: string[];
  backdrop: string;
  fog: string;
  crate: string;
  base: string;
  metalness: number;
};

export type VoxelProp =
  | {
      type: "crate" | "pillar" | "silo";
      x: number;
      y: number;
      width?: number;
      depth?: number;
      height?: number;
      color?: string;
    }
  | {
      type: "train" | "water" | "bridge";
      x: number;
      y: number;
      width: number;
      depth: number;
      height?: number;
      rotation?: number;
      color?: string;
    };

export type VoxelMapProfile = {
  id: MapId;
  identity: string;
  palette: VoxelPalette;
  lowerZones?: Array<{ x: number; y: number; radius: number }>;
  props: VoxelProp[];
};

export type DecodedVoxelMap = {
  res: number;
  occupied: Uint8Array;
  heights: Uint8Array;
  lowerOccupied?: Uint8Array;
  lowerHeights?: Uint8Array;
  navRes: number;
  navOccupied: Uint8Array;
  navHeights: Uint8Array;
  walls?: Uint8Array;
  wallHeights?: Uint8Array;
  referenceZ: number;
  heightStep: number;
  navVersion: number;
};

const palettes = {
  sandstone: {
    ground: ["#a7885c", "#96784f", "#b29466", "#8a704e"],
    lowerGround: "#66523c",
    wall: ["#765f42", "#66523c", "#8a714e"],
    backdrop: "#14202a",
    fog: "#14202a",
    crate: "#6d4d2e",
    base: "#1f3126",
    metalness: 0,
  },
  cobble: {
    ground: ["#846f57", "#78624e", "#947a5c", "#6c5d4e"],
    lowerGround: "#4d423a",
    wall: ["#664d3f", "#765847", "#57463f"],
    backdrop: "#172028",
    fog: "#172028",
    crate: "#74502e",
    base: "#243027",
    metalness: 0,
  },
  desert: {
    ground: ["#ad9368", "#9f845c", "#bca278", "#8f7959"],
    lowerGround: "#6f5d46",
    wall: ["#806b4d", "#6f5d46", "#927b56"],
    backdrop: "#17232d",
    fog: "#17232d",
    crate: "#715033",
    base: "#273228",
    metalness: 0,
  },
  industrial: {
    ground: ["#69747a", "#59666e", "#788188", "#4e5a61"],
    lowerGround: "#303a40",
    wall: ["#4a5459", "#3d474c", "#5b6569"],
    backdrop: "#101b22",
    fog: "#101b22",
    crate: "#7e5c31",
    base: "#1f2c2a",
    metalness: 0.18,
  },
  jungle: {
    ground: ["#64745a", "#56664c", "#75806a", "#4e5d48"],
    lowerGround: "#3f493c",
    wall: ["#4f5946", "#626851", "#3f493c"],
    backdrop: "#12201c",
    fog: "#12201c",
    crate: "#6a5130",
    base: "#1c3125",
    metalness: 0,
  },
  nile: {
    ground: ["#a08059", "#92724c", "#b08f62", "#856c50"],
    lowerGround: "#5e5948",
    wall: ["#71583f", "#604b38", "#826849"],
    backdrop: "#12232a",
    fog: "#12232a",
    crate: "#6f4f2d",
    base: "#1b3430",
    metalness: 0,
  },
  rail: {
    ground: ["#646d70", "#596265", "#747b7c", "#50595c"],
    lowerGround: "#354045",
    wall: ["#424d52", "#354045", "#566167"],
    backdrop: "#111b22",
    fog: "#111b22",
    crate: "#745132",
    base: "#20302d",
    metalness: 0.24,
  },
} satisfies Record<string, VoxelPalette>;

export const VOXEL_MAP_PROFILES: Record<MapId, VoxelMapProfile> = {
  mirage: {
    id: "mirage",
    identity: "Sunlit courtyards · Palace · Connector",
    palette: palettes.sandstone,
    props: [
      { type: "crate", x: 55, y: 70, width: 2.4, height: 2 },
      { type: "crate", x: 25, y: 29, width: 2.2, height: 2 },
      { type: "bridge", x: 46, y: 57, width: 3.8, depth: 1.4, height: 2.5 },
      { type: "pillar", x: 70, y: 52, height: 3.5, color: "#8b6d47" },
    ],
  },
  inferno: {
    id: "inferno",
    identity: "Old-world lanes · Banana · Apartments",
    palette: palettes.cobble,
    props: [
      { type: "crate", x: 49, y: 22, width: 2.2, height: 2 },
      { type: "crate", x: 80, y: 68, width: 2.2, height: 2 },
      { type: "bridge", x: 78, y: 45, width: 3.5, depth: 1.4, height: 2.6 },
      { type: "pillar", x: 35, y: 35, height: 2.2, color: "#8d5d43" },
    ],
  },
  nuke: {
    id: "nuke",
    identity: "Industrial stack · Outside · Lower B",
    palette: palettes.industrial,
    lowerZones: [{ x: 57, y: 57, radius: 13 }],
    props: [
      { type: "silo", x: 72, y: 52, width: 2.4, height: 5, color: "#aeb6ba" },
      { type: "silo", x: 77, y: 52, width: 2.1, height: 4, color: "#818b90" },
      { type: "crate", x: 57, y: 49, width: 2.2, height: 2, color: "#d8a529" },
      { type: "crate", x: 57, y: 57, width: 2, height: 2, color: "#476d8f" },
    ],
  },
  ancient: {
    id: "ancient",
    identity: "Temple stone · Donut · Cave",
    palette: palettes.jungle,
    props: [
      { type: "pillar", x: 42, y: 26, height: 4, color: "#66705b" },
      { type: "pillar", x: 42, y: 38, height: 3.3, color: "#5c6653" },
      { type: "crate", x: 30, y: 26, width: 2.2, height: 2 },
      { type: "crate", x: 74, y: 40, width: 2.2, height: 2 },
    ],
  },
  anubis: {
    id: "anubis",
    identity: "Canals · Bridge · Monumental stone",
    palette: palettes.nile,
    props: [
      { type: "water", x: 50, y: 65, width: 5, depth: 17, color: "#2c7f8a" },
      { type: "bridge", x: 62, y: 48, width: 5, depth: 1.7, height: 2.8 },
      { type: "pillar", x: 32, y: 18, height: 3.5, color: "#876c4b" },
      { type: "crate", x: 74, y: 36, width: 2.1, height: 2 },
    ],
  },
  dust2: {
    id: "dust2",
    identity: "Desert lanes · Long · Tunnels",
    palette: palettes.desert,
    props: [
      { type: "bridge", x: 48, y: 30, width: 4.2, depth: 1.5, height: 2.5 },
      { type: "crate", x: 80, y: 17, width: 2.4, height: 2 },
      { type: "crate", x: 21, y: 12, width: 2.4, height: 2 },
      { type: "pillar", x: 32, y: 50, height: 2.6, color: "#846d4d" },
    ],
  },
  train: {
    id: "train",
    identity: "Rail yard · Ivy · Popdog",
    palette: palettes.rail,
    props: [
      { type: "train", x: 57, y: 48, width: 2.4, depth: 11, rotation: -0.08, color: "#7b3f36" },
      { type: "train", x: 65, y: 56, width: 2.4, depth: 10, rotation: 0.04, color: "#456b7d" },
      { type: "train", x: 49, y: 69, width: 2.4, depth: 9, rotation: -0.03, color: "#637451" },
      { type: "crate", x: 53, y: 76, width: 2.1, height: 2 },
    ],
  },
};

function decodeBytes(encoded: string) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function unpackBits(res: number, encoded: string) {
  const packed = decodeBytes(encoded);
  const cells = new Uint8Array(res * res);
  for (let index = 0; index < cells.length; index += 1) {
    cells[index] = (packed[index >> 3] >> (7 - (index & 7))) & 1;
  }
  return cells;
}

const decodedCache = new Map<MapId, DecodedVoxelMap>();

export function getVoxelMap(mapId: MapId): DecodedVoxelMap {
  const cached = decodedCache.get(mapId);
  if (cached) return cached;
  const baked = bakedVoxelMaps[mapId];
  const decoded: DecodedVoxelMap = {
    res: baked.res,
    occupied: unpackBits(baked.res, baked.occupied),
    heights: decodeBytes(baked.heights),
    lowerOccupied: baked.lowerOccupied ? unpackBits(baked.res, baked.lowerOccupied) : undefined,
    lowerHeights: baked.lowerHeights ? decodeBytes(baked.lowerHeights) : undefined,
    navRes: baked.navRes,
    navOccupied: unpackBits(baked.navRes, baked.navOccupied),
    navHeights: decodeBytes(baked.navHeights),
    walls: baked.walls ? unpackBits(baked.res, baked.walls) : undefined,
    wallHeights: baked.wallHeights ? decodeBytes(baked.wallHeights) : undefined,
    referenceZ: baked.referenceZ,
    heightStep: baked.heightStep,
    navVersion: baked.navVersion,
  };
  decodedCache.set(mapId, decoded);
  return decoded;
}

export function voxelCellHeight(encodedHeight: number) {
  return Math.max(-2, Math.min(2.7, (encodedHeight - 128) * 0.24));
}

function isLowerZone(mapId: MapId, point: { x: number; y: number }) {
  return Boolean(
    VOXEL_MAP_PROFILES[mapId].lowerZones?.some(
      (zone) => Math.hypot(point.x - zone.x, point.y - zone.y) <= zone.radius,
    ),
  );
}

export function voxelSurfaceAt(mapId: MapId, point: { x: number; y: number }) {
  const map = getVoxelMap(mapId);
  const startCol = Math.min(map.res - 1, Math.max(0, Math.floor((point.x / 100) * map.res)));
  const startRow = Math.min(map.res - 1, Math.max(0, Math.floor((point.y / 100) * map.res)));
  const preferLower = isLowerZone(mapId, point);

  if (preferLower && map.lowerOccupied && map.lowerHeights) {
    for (let radius = 0; radius < 7; radius += 1) {
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
        for (let colOffset = -radius; colOffset <= radius; colOffset += 1) {
          if (Math.max(Math.abs(colOffset), Math.abs(rowOffset)) !== radius) continue;
          const col = startCol + colOffset;
          const row = startRow + rowOffset;
          if (col < 0 || row < 0 || col >= map.res || row >= map.res) continue;
          const index = row * map.res + col;
          if (map.lowerOccupied[index]) return voxelCellHeight(map.lowerHeights[index]);
        }
      }
    }
  }

  for (let radius = 0; radius < 7; radius += 1) {
    for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
      for (let colOffset = -radius; colOffset <= radius; colOffset += 1) {
        if (Math.max(Math.abs(colOffset), Math.abs(rowOffset)) !== radius) continue;
        const col = startCol + colOffset;
        const row = startRow + rowOffset;
        if (col < 0 || row < 0 || col >= map.res || row >= map.res) continue;
        const index = row * map.res + col;
        if (map.occupied[index]) return voxelCellHeight(map.heights[index]);
      }
    }
  }
  return 0;
}

export const VOXEL_SOURCE_LABEL = `SOURCE 2 NAV + VPHYS · PATCH ${VOXEL_DATA_PATCH}`;
