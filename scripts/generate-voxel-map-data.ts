/**
 * Build compact visual and movement grids from Awpy's parsed CS2 navigation meshes.
 *
 * Awpy exposes the original nav-area corner coordinates as JSON and the radar overview transform
 * separately. This script joins them once at build time, rasterizes a 56×56 observer surface and a
 * denser 112×112 navigation/elevation surface for the seven Major Draft Lab maps, then writes a
 * browser-friendly TypeScript module. No Valve textures or models are bundled.
 *
 * Usage:
 *   npm run generate:voxel-maps -- --download
 *   npm run generate:voxel-maps -- --awpy-root ~/.awpy
 *   npm run generate:voxel-maps -- --nav-zip navs.zip --maps-zip maps.zip --tri-zip tris.zip
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const AWPY_PATCH = 17595823;
const RADAR_PIXELS = 1024;
const RESOLUTION = 56;
const NAV_RESOLUTION = 112;
const HEIGHT_STEP_UNITS = 72;
const MULTI_LEVEL_GAP_UNITS = 80;
const MAP_IDS = ["mirage", "inferno", "nuke", "ancient", "anubis", "dust2", "train"] as const;

type MapId = (typeof MAP_IDS)[number];
type Corner = { x: number; y: number; z: number };
type NavArea = { corners: Corner[] };
type NavJson = { areas: Record<string, NavArea>; version: number; sub_version?: number };
type MapTransform = {
  pos_x: number;
  pos_y: number;
  scale: number;
  rotate: number | null;
  zoom: number | null;
  lower_level_max_units: number;
};

type Args = {
  awpyRoot: string;
  download: boolean;
  navZip?: string;
  mapsZip?: string;
  triZip?: string;
  output: string;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const valueAfter = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    awpyRoot: resolve(valueAfter("--awpy-root") ?? join(homedir(), ".awpy")),
    download: args.includes("--download"),
    navZip: valueAfter("--nav-zip"),
    mapsZip: valueAfter("--maps-zip"),
    triZip: valueAfter("--tri-zip"),
    output: resolve(valueAfter("--output") ?? "src/voxelMapData.ts"),
  };
}

function unzipJson<T>(zipPath: string, filename: string): T {
  return JSON.parse(
    execFileSync("unzip", ["-p", zipPath, filename], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    }),
  ) as T;
}

function unzipBuffer(zipPath: string, filename: string) {
  return execFileSync("unzip", ["-p", zipPath, filename], {
    encoding: "buffer",
    maxBuffer: 160 * 1024 * 1024,
  });
}

function loadJson<T>(directory: string, filename: string): T {
  return JSON.parse(readFileSync(join(directory, filename), "utf8")) as T;
}

async function download(url: string, output: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  writeFileSync(output, Buffer.from(await response.arrayBuffer()));
}

function pointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index];
    const b = polygon[previous];
    const crosses = a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function bitpack(cells: Uint8Array) {
  const bytes = new Uint8Array(Math.ceil(cells.length / 8));
  for (let index = 0; index < cells.length; index += 1) {
    if (cells[index]) bytes[index >> 3] |= 1 << (7 - (index & 7));
  }
  return Buffer.from(bytes).toString("base64");
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * fraction)))];
}

function distanceToSegment(
  x: number,
  y: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared));
  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
}

function rasterizePhysics(
  triBuffer: Buffer | undefined,
  transform: MapTransform,
  occupied: Uint8Array,
  upperWorldHeights: Float32Array,
) {
  if (!triBuffer) return undefined;
  const wallCells = new Uint8Array(RESOLUTION * RESOLUTION);
  const wallHeights = new Uint8Array(RESOLUTION * RESOLUTION);
  const nearestFloor = new Int32Array(RESOLUTION * RESOLUTION).fill(-1);
  const cellSize = 100 / RESOLUTION;

  for (let row = 0; row < RESOLUTION; row += 1) {
    for (let col = 0; col < RESOLUTION; col += 1) {
      const index = row * RESOLUTION + col;
      if (occupied[index]) continue;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
          const floorRow = row + rowOffset;
          const floorCol = col + colOffset;
          if (
            floorRow < 0 ||
            floorCol < 0 ||
            floorRow >= RESOLUTION ||
            floorCol >= RESOLUTION
          ) {
            continue;
          }
          const floorIndex = floorRow * RESOLUTION + floorCol;
          if (!occupied[floorIndex]) continue;
          const distance = Math.hypot(rowOffset, colOffset);
          if (distance < bestDistance) {
            bestDistance = distance;
            nearestFloor[index] = floorIndex;
          }
        }
      }
    }
  }

  const radarPoint = (x: number, y: number) => ({
    x: (((x - transform.pos_x) / transform.scale) / RADAR_PIXELS) * 100,
    y: (((transform.pos_y - y) / transform.scale) / RADAR_PIXELS) * 100,
  });

  for (let offset = 0; offset + 36 <= triBuffer.length; offset += 36) {
    const vertices = [0, 12, 24].map((vertexOffset) => ({
      x: triBuffer.readFloatLE(offset + vertexOffset),
      y: triBuffer.readFloatLE(offset + vertexOffset + 4),
      z: triBuffer.readFloatLE(offset + vertexOffset + 8),
    }));
    if (vertices.some((vertex) => !Number.isFinite(vertex.x + vertex.y + vertex.z))) continue;
    const ab = {
      x: vertices[1].x - vertices[0].x,
      y: vertices[1].y - vertices[0].y,
      z: vertices[1].z - vertices[0].z,
    };
    const ac = {
      x: vertices[2].x - vertices[0].x,
      y: vertices[2].y - vertices[0].y,
      z: vertices[2].z - vertices[0].z,
    };
    const normal = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x,
    };
    const normalLength = Math.hypot(normal.x, normal.y, normal.z);
    if (normalLength < 1 || Math.abs(normal.z) / normalLength > 0.48) continue;

    const polygon = vertices.map((vertex) => radarPoint(vertex.x, vertex.y));
    if (
      polygon.every((point) => point.x < -2 || point.x > 102 || point.y < -2 || point.y > 102)
    ) {
      continue;
    }
    const minX = Math.max(
      0,
      Math.floor((Math.min(...polygon.map((point) => point.x)) / 100) * RESOLUTION) - 1,
    );
    const maxX = Math.min(
      RESOLUTION - 1,
      Math.ceil((Math.max(...polygon.map((point) => point.x)) / 100) * RESOLUTION) + 1,
    );
    const minY = Math.max(
      0,
      Math.floor((Math.min(...polygon.map((point) => point.y)) / 100) * RESOLUTION) - 1,
    );
    const maxY = Math.min(
      RESOLUTION - 1,
      Math.ceil((Math.max(...polygon.map((point) => point.y)) / 100) * RESOLUTION) + 1,
    );
    const zMin = Math.min(...vertices.map((vertex) => vertex.z));
    const zMax = Math.max(...vertices.map((vertex) => vertex.z));

    for (let row = minY; row <= maxY; row += 1) {
      for (let col = minX; col <= maxX; col += 1) {
        const index = row * RESOLUTION + col;
        const floorIndex = nearestFloor[index];
        if (occupied[index] || floorIndex < 0) continue;
        const x = ((col + 0.5) / RESOLUTION) * 100;
        const y = ((row + 0.5) / RESOLUTION) * 100;
        const touchesProjection =
          pointInPolygon(x, y, polygon) ||
          polygon.some((point, pointIndex) =>
            distanceToSegment(x, y, point, polygon[(pointIndex + 1) % polygon.length]) <=
              cellSize * 0.58,
          );
        if (!touchesProjection) continue;
        const floorZ = upperWorldHeights[floorIndex];
        if (zMax < floorZ + 20 || zMin > floorZ + 360) continue;
        const visibleTop = Math.min(zMax, floorZ + 300);
        if (visibleTop - Math.max(zMin, floorZ) < 24) continue;
        const height = Math.min(4, Math.max(1, Math.ceil((visibleTop - floorZ) / 76)));
        wallCells[index] = 1;
        wallHeights[index] = Math.max(wallHeights[index], height);
      }
    }
  }

  const wallCount = wallCells.reduce((sum, value) => sum + value, 0);
  return {
    walls: bitpack(wallCells),
    wallHeights: Buffer.from(wallHeights).toString("base64"),
    wallCount,
  };
}

function rasterizeNavAreas(nav: NavJson, transform: MapTransform, resolution: number) {
  const heightsByCell: number[][] = Array.from(
    { length: resolution * resolution },
    () => [],
  );
  let acceptedAreas = 0;

  for (const area of Object.values(nav.areas)) {
    if (area.corners.length < 3) continue;
    const polygon = area.corners.map((corner) => ({
      x: (((corner.x - transform.pos_x) / transform.scale) / RADAR_PIXELS) * 100,
      y: (((transform.pos_y - corner.y) / transform.scale) / RADAR_PIXELS) * 100,
    }));
    if (
      polygon.every((point) => point.x < -2 || point.x > 102 || point.y < -2 || point.y > 102)
    ) {
      continue;
    }

    const z = area.corners.reduce((sum, corner) => sum + corner.z, 0) / area.corners.length;
    const minX = Math.max(
      0,
      Math.floor((Math.min(...polygon.map((point) => point.x)) / 100) * resolution),
    );
    const maxX = Math.min(
      resolution - 1,
      Math.ceil((Math.max(...polygon.map((point) => point.x)) / 100) * resolution),
    );
    const minY = Math.max(
      0,
      Math.floor((Math.min(...polygon.map((point) => point.y)) / 100) * resolution),
    );
    const maxY = Math.min(
      resolution - 1,
      Math.ceil((Math.max(...polygon.map((point) => point.y)) / 100) * resolution),
    );

    let used = false;
    for (let row = minY; row <= maxY; row += 1) {
      for (let col = minX; col <= maxX; col += 1) {
        const x = ((col + 0.5) / resolution) * 100;
        const y = ((row + 0.5) / resolution) * 100;
        if (!pointInPolygon(x, y, polygon)) continue;
        heightsByCell[row * resolution + col].push(z);
        used = true;
      }
    }
    if (used) acceptedAreas += 1;
  }

  return { heightsByCell, acceptedAreas };
}

function rasterize(
  mapId: MapId,
  nav: NavJson,
  transform: MapTransform,
  triBuffer?: Buffer,
) {
  const { heightsByCell, acceptedAreas } = rasterizeNavAreas(
    nav,
    transform,
    RESOLUTION,
  );

  const occupied = new Uint8Array(RESOLUTION * RESOLUTION);
  const lowerOccupied = new Uint8Array(RESOLUTION * RESOLUTION);
  const upperWorldHeights = new Float32Array(RESOLUTION * RESOLUTION);
  const lowerWorldHeights = new Float32Array(RESOLUTION * RESOLUTION);
  const allUpperHeights: number[] = [];

  heightsByCell.forEach((values, index) => {
    if (!values.length) return;
    values.sort((a, b) => a - b);
    const upper = values[values.length - 1];
    const lower = values[0];
    occupied[index] = 1;
    upperWorldHeights[index] = upper;
    allUpperHeights.push(upper);
    if (upper - lower >= MULTI_LEVEL_GAP_UNITS) {
      lowerOccupied[index] = 1;
      lowerWorldHeights[index] = lower;
    }
  });

  // Source nav areas overlap and carry tiny Z variations. A local median removes single-cell spikes
  // while preserving real stairs, ramps, and separated floors.
  const smoothedUpperHeights = new Float32Array(upperWorldHeights);
  for (let row = 0; row < RESOLUTION; row += 1) {
    for (let col = 0; col < RESOLUTION; col += 1) {
      const index = row * RESOLUTION + col;
      if (!occupied[index]) continue;
      const center = upperWorldHeights[index];
      const neighborhood: number[] = [];
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
          const nextRow = row + rowOffset;
          const nextCol = col + colOffset;
          if (
            nextRow < 0 ||
            nextCol < 0 ||
            nextRow >= RESOLUTION ||
            nextCol >= RESOLUTION
          ) {
            continue;
          }
          const nextIndex = nextRow * RESOLUTION + nextCol;
          const value = upperWorldHeights[nextIndex];
          if (occupied[nextIndex] && Math.abs(value - center) <= 150) neighborhood.push(value);
        }
      }
      if (neighborhood.length >= 3) {
        neighborhood.sort((a, b) => a - b);
        smoothedUpperHeights[index] = neighborhood[Math.floor(neighborhood.length / 2)];
      }
    }
  }
  upperWorldHeights.set(smoothedUpperHeights);

  const referenceZ = Math.round(percentile(allUpperHeights, 0.45));
  const encodeHeight = (worldHeight: number) =>
    Math.min(255, Math.max(0, 128 + Math.round((worldHeight - referenceZ) / HEIGHT_STEP_UNITS)));
  const upperHeights = new Uint8Array(RESOLUTION * RESOLUTION);
  const lowerHeights = new Uint8Array(RESOLUTION * RESOLUTION);
  let occupiedCount = 0;
  let lowerCount = 0;
  for (let index = 0; index < occupied.length; index += 1) {
    if (occupied[index]) {
      upperHeights[index] = encodeHeight(upperWorldHeights[index]);
      occupiedCount += 1;
    }
    if (lowerOccupied[index]) {
      lowerHeights[index] = encodeHeight(lowerWorldHeights[index]);
      lowerCount += 1;
    }
  }

  // A denser copy of the same Source 2 nav surface drives live player movement. Keeping this
  // separate from the visible 56×56 voxels preserves narrow doors, bridges, and tunnels without
  // increasing the rendered block count.
  const navigation = rasterizeNavAreas(nav, transform, NAV_RESOLUTION);
  const navOccupied = new Uint8Array(NAV_RESOLUTION * NAV_RESOLUTION);
  const navHeights = new Uint8Array(NAV_RESOLUTION * NAV_RESOLUTION);
  let navOccupiedCount = 0;
  navigation.heightsByCell.forEach((values, index) => {
    if (!values.length) return;
    values.sort((a, b) => a - b);
    navOccupied[index] = 1;
    navHeights[index] = encodeHeight(values[values.length - 1]);
    navOccupiedCount += 1;
  });

  console.log(
    `${mapId}: ${acceptedAreas} nav areas → ${occupiedCount} surface cells, ${lowerCount} lower-level cells, ${navOccupiedCount} movement cells, reference z ${referenceZ}`,
  );
  const physics = rasterizePhysics(triBuffer, transform, occupied, upperWorldHeights);
  if (physics) console.log(`${mapId}: ${physics.wallCount} collision-derived wall cells`);
  return {
    res: RESOLUTION,
    occupied: bitpack(occupied),
    heights: Buffer.from(upperHeights).toString("base64"),
    lowerOccupied: lowerCount ? bitpack(lowerOccupied) : undefined,
    lowerHeights: lowerCount ? Buffer.from(lowerHeights).toString("base64") : undefined,
    referenceZ,
    heightStep: HEIGHT_STEP_UNITS,
    navVersion: nav.version,
    navRes: NAV_RESOLUTION,
    navOccupied: bitpack(navOccupied),
    navHeights: Buffer.from(navHeights).toString("base64"),
    walls: physics?.walls,
    wallHeights: physics?.wallHeights,
  };
}

async function main() {
  const args = parseArgs();
  let navZip = args.navZip ? resolve(args.navZip) : undefined;
  let mapsZip = args.mapsZip ? resolve(args.mapsZip) : undefined;
  let triZip = args.triZip ? resolve(args.triZip) : undefined;
  const navDirectory = join(args.awpyRoot, "navs");
  const mapsDirectory = join(args.awpyRoot, "maps");
  const triDirectory = join(args.awpyRoot, "tris");

  if (args.download) {
    const temp = mkdtempSync(join(tmpdir(), "mdl-awpy-"));
    navZip = join(temp, "navs.zip");
    mapsZip = join(temp, "maps.zip");
    triZip = join(temp, "tris.zip");
    console.log(`Downloading Awpy patch ${AWPY_PATCH} resources…`);
    await Promise.all([
      download(`https://awpycs.com/${AWPY_PATCH}/navs.zip`, navZip),
      download(`https://awpycs.com/${AWPY_PATCH}/maps.zip`, mapsZip),
      download(`https://awpycs.com/${AWPY_PATCH}/tris.zip`, triZip),
    ]);
  }

  const useZips = Boolean(navZip && mapsZip);
  if (!useZips && (!existsSync(navDirectory) || !existsSync(mapsDirectory))) {
    throw new Error(
      `Awpy resources not found at ${args.awpyRoot}. Run with --download, or run "awpy get navs" and "awpy get maps" first.`,
    );
  }

  const mapData = useZips
    ? unzipJson<Record<string, MapTransform>>(mapsZip!, "map-data.json")
    : loadJson<Record<string, MapTransform>>(mapsDirectory, "map-data.json");

  const generated = Object.fromEntries(
    MAP_IDS.map((mapId) => {
      const awpyId = `de_${mapId}`;
      const nav = useZips
        ? unzipJson<NavJson>(navZip!, `${awpyId}.json`)
        : loadJson<NavJson>(navDirectory, `${awpyId}.json`);
      const triBuffer = triZip
        ? unzipBuffer(triZip, `${awpyId}.tri`)
        : existsSync(join(triDirectory, `${awpyId}.tri`))
          ? readFileSync(join(triDirectory, `${awpyId}.tri`))
          : undefined;
      return [mapId, rasterize(mapId, nav, mapData[awpyId], triBuffer)];
    }),
  );

  const output = `// AUTO-GENERATED by scripts/generate-voxel-map-data.ts — do not edit by hand.
// Awpy patch ${AWPY_PATCH}: parsed CS2 nav-area footprints/elevations transformed into radar space.
// The browser receives only compact numeric grids; no original game textures or models are bundled.
import type { MapId } from "./gameData";

export type BakedVoxelMap = {
  res: number;
  occupied: string;
  heights: string;
  lowerOccupied?: string;
  lowerHeights?: string;
  referenceZ: number;
  heightStep: number;
  navVersion: number;
  navRes: number;
  navOccupied: string;
  navHeights: string;
  walls?: string;
  wallHeights?: string;
};

export const VOXEL_DATA_PATCH = ${AWPY_PATCH};

export const bakedVoxelMaps: Record<MapId, BakedVoxelMap> = ${JSON.stringify(generated, null, 2)};
`;
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, output);
  console.log(`Wrote ${args.output}`);
}

await main();
