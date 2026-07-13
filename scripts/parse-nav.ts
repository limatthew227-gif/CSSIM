// Parse the CSGO de_mirage .nav (v16) fully and rasterize the TRUE walkable floor into a grid in
// radar 0..100 space. The union of all nav-area quads = the real playable surface (and its inverse =
// walls/void), far more accurate than classifying the radar PNG — this is what fixes through-wall
// sightlines like the apartments wood door. Per-area layout per the gonav parser (incl. the trailing
// u8 garbage-count + count*14 bytes that was the earlier desync).
//   npx tsx scripts/parse-nav.ts [path-to.nav]   -> prints stats + writes scratch/nav-walkable.svg
import { readFileSync, writeFileSync } from "node:fs";

export interface NavHidingSpot {
  id: number;
  x: number;
  y: number;
  z: number;
  flags: number;
}

export interface NavEncounterPath {
  fromAreaId: number;
  fromDirection: number;
  toAreaId: number;
  toDirection: number;
  spots: Array<{ areaId: number; order: number }>;
}

export interface NavVisibleArea {
  id: number;
  attributes: number;
}

export interface NavArea {
  id: number;
  attributeFlags: number;
  nwX: number;
  nwY: number;
  nwZ: number;
  seX: number;
  seY: number;
  seZ: number;
  neZ: number;
  swZ: number;
  z: number;
  place: number;
  connections: number[][];
  hidingSpots: NavHidingSpot[];
  encounterPaths: NavEncounterPath[];
  ladderConnections: [number[], number[]];
  earliestOccupy: [number, number];
  lightIntensity: [number, number, number, number];
  visibleAreas: NavVisibleArea[];
  inheritVisibilityFrom: number;
}

export function parseNavAreas(path: string): { version: number; places: string[]; areas: NavArea[]; endedAt: number; size: number } {
  const b = readFileSync(path);
  let o = 0;
  const u8 = () => b.readUInt8((o += 1) - 1);
  const u16 = () => b.readUInt16LE((o += 2) - 2);
  const u32 = () => b.readUInt32LE((o += 4) - 4);
  const f32 = () => b.readFloatLE((o += 4) - 4);

  u32(); // magic
  const version = u32();
  if (version >= 10) u32(); // subVersion
  u32(); // bspSize
  if (version >= 14) u8(); // isAnalyzed
  const placeCount = u16();
  const places: string[] = [""]; // placeID is 1-based
  for (let i = 0; i < placeCount; i += 1) { const len = u16(); places.push(b.toString("utf8", o, o + len).replace(/\0/g, "")); o += len; }
  u8(); // hasUnnamedAreas
  const areaCount = u32();

  const areas: NavArea[] = [];
  for (let i = 0; i < areaCount; i += 1) {
    const id = u32();
    const attributeFlags = version >= 13 ? u32() : version >= 9 ? u16() : u8();
    const nwX = f32(), nwY = f32(), nwZ = f32();
    const seX = f32(), seY = f32(), seZ = f32();
    const neZ = f32(), swZ = f32();
    const connections: number[][] = [];
    for (let d = 0; d < 4; d += 1) {
      const count = u32();
      const direction: number[] = [];
      for (let c = 0; c < count; c += 1) direction.push(u32());
      connections.push(direction);
    }
    const hidingSpots: NavHidingSpot[] = [];
    const hidingSpotCount = u8();
    for (let h = 0; h < hidingSpotCount; h += 1) {
      hidingSpots.push({ id: u32(), x: f32(), y: f32(), z: f32(), flags: u8() });
    }
    if (version < 15) { const ac = u8(); o += ac * (4 * 3 + 2); } // approach areas
    const encounterPaths: NavEncounterPath[] = [];
    const encounterPathCount = u32();
    for (let e = 0; e < encounterPathCount; e += 1) {
      const fromAreaId = u32();
      const fromDirection = u8();
      const toAreaId = u32();
      const toDirection = u8();
      const spots: NavEncounterPath["spots"] = [];
      const spotCount = u8();
      for (let s = 0; s < spotCount; s += 1) spots.push({ areaId: u32(), order: u8() });
      encounterPaths.push({ fromAreaId, fromDirection, toAreaId, toDirection, spots });
    }
    const place = u16();
    const ladderConnections: [number[], number[]] = [[], []];
    for (let d = 0; d < 2; d += 1) {
      const count = u32();
      for (let c = 0; c < count; c += 1) ladderConnections[d].push(u32());
    }
    const earliestOccupy: [number, number] = [f32(), f32()];
    const lightIntensity: [number, number, number, number] = version >= 11
      ? [f32(), f32(), f32(), f32()]
      : [1, 1, 1, 1];
    const visibleAreas: NavVisibleArea[] = [];
    let inheritVisibilityFrom = 0;
    if (version >= 16) {
      const visibleCount = u32();
      for (let v = 0; v < visibleCount; v += 1) visibleAreas.push({ id: u32(), attributes: u8() });
      inheritVisibilityFrom = u32();
    }
    const gc = u8(); o += gc * 14; // trailing "garbage" block (the missing piece)
    areas.push({
      id,
      attributeFlags,
      nwX,
      nwY,
      nwZ,
      seX,
      seY,
      seZ,
      neZ,
      swZ,
      z: (nwZ + neZ + seZ + swZ) / 4,
      place,
      connections,
      hidingSpots,
      encounterPaths,
      ladderConnections,
      earliestOccupy,
      lightIntensity,
      visibleAreas,
      inheritVisibilityFrom,
    });
  }
  return { version, places, areas, endedAt: o, size: b.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2] || "/Users/matthewli/mirage/de_mirage/maps/de_mirage_custom.nav";
  const { version, places, areas, endedAt, size } = parseNavAreas(path);
  console.log(`nav v${version}: ${places.length - 1} places, ${areas.length} areas, ended at ${endedAt}/${size} (${size - endedAt} left)`);
  const xs = areas.flatMap((a) => [a.nwX, a.seX]);
  const ys = areas.flatMap((a) => [a.nwY, a.seY]);
  console.log(`world X ${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)}  Y ${Math.min(...ys).toFixed(0)}..${Math.max(...ys).toFixed(0)}`);

  // rasterize walkable union -> radar 0..100
  const M = { posX: -3230, posY: 1713, scale: 5, size: 1024 };
  const toR = (x: number, y: number) => ({ x: ((x - M.posX) / M.scale / M.size) * 100, y: ((M.posY - y) / M.scale / M.size) * 100 });
  const RES = 160;
  const walk = new Uint8Array(RES * RES);
  for (const a of areas) {
    const p0 = toR(a.nwX, a.nwY), p1 = toR(a.seX, a.seY);
    const gx0 = Math.max(0, Math.floor((Math.min(p0.x, p1.x) / 100) * RES));
    const gx1 = Math.min(RES - 1, Math.ceil((Math.max(p0.x, p1.x) / 100) * RES));
    const gy0 = Math.max(0, Math.floor((Math.min(p0.y, p1.y) / 100) * RES));
    const gy1 = Math.min(RES - 1, Math.ceil((Math.max(p0.y, p1.y) / 100) * RES));
    for (let gy = gy0; gy <= gy1; gy += 1) for (let gx = gx0; gx <= gx1; gx += 1) walk[gy * RES + gx] = 1;
  }
  const free = walk.reduce((s, v) => s + v, 0);
  console.log(`walkable ${RES}x${RES}: ${((free / walk.length) * 100).toFixed(1)}% free`);

  const S = 7;
  const b64 = readFileSync("src/assets/radar/mirage.png").toString("base64");
  const cells: string[] = [];
  const cw = (100 / RES) * S;
  for (let gy = 0; gy < RES; gy += 1) for (let gx = 0; gx < RES; gx += 1) if (walk[gy * RES + gx])
    cells.push(`<rect x="${((gx / RES) * 100 * S).toFixed(1)}" y="${((gy / RES) * 100 * S).toFixed(1)}" width="${cw.toFixed(2)}" height="${cw.toFixed(2)}" fill="#39ff88" fill-opacity="0.3"/>`);
  writeFileSync("scratch/nav-walkable.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="${100 * S}" height="${100 * S}" viewBox="0 0 ${100 * S} ${100 * S}"><image href="data:image/png;base64,${b64}" width="${100 * S}" height="${100 * S}"/>${cells.join("")}</svg>`);
  console.log("wrote scratch/nav-walkable.svg");
}
