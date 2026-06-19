// Parse the CSGO de_mirage .nav (v16) fully and rasterize the TRUE walkable floor into a grid in
// radar 0..100 space. The union of all nav-area quads = the real playable surface (and its inverse =
// walls/void), far more accurate than classifying the radar PNG — this is what fixes through-wall
// sightlines like the apartments wood door. Per-area layout per the gonav parser (incl. the trailing
// u8 garbage-count + count*14 bytes that was the earlier desync).
//   npx tsx scripts/parse-nav.ts [path-to.nav]   -> prints stats + writes scratch/nav-walkable.svg
import { readFileSync, writeFileSync } from "node:fs";

export interface NavArea { id: number; nwX: number; nwY: number; seX: number; seY: number; z: number; place: number; }

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
    if (version >= 13) u32(); else if (version >= 9) u16(); else u8(); // attributeFlags
    const nwX = f32(), nwY = f32(); f32();
    const seX = f32(), seY = f32(); const seZ = f32();
    const neZ = f32(); f32(); // neZ, swZ
    for (let d = 0; d < 4; d += 1) { const c = u32(); o += c * 4; } // connections
    const hc = u8(); o += hc * (4 + 12 + 1); // hiding spots
    if (version < 15) { const ac = u8(); o += ac * (4 * 3 + 2); } // approach areas
    const ec = u32(); // encounter paths
    for (let e = 0; e < ec; e += 1) { o += 4 + 1 + 4 + 1; const sc = u8(); o += sc * (4 + 1); }
    const place = u16();
    for (let d = 0; d < 2; d += 1) { const c = u32(); o += c * 4; } // ladder connections
    f32(); f32(); // earliest occupy times
    if (version >= 11) { f32(); f32(); f32(); f32(); } // light intensity
    if (version >= 16) { const vc = u32(); o += vc * (4 + 1); u32(); } // visible areas + inheritVisibilityFrom
    const gc = u8(); o += gc * 14; // trailing "garbage" block (the missing piece)
    areas.push({ id, nwX, nwY, seX, seY, z: (neZ + seZ) / 2, place });
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
