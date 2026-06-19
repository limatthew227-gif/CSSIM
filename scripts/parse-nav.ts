// Read the CSGO de_mirage .nav (v16) header: version, the 23 named callouts, and validate that the
// official overview transform projects area coordinates onto the radar correctly.
//
// STATUS: header + place table + transform are parsed and validated (area 0 = TSpawn lands exactly on
// T spawn). The full 906-area mesh (corners/connections/elevation) is NOT yet extracted — the v16
// per-area encounter-spot/visibility section layout still needs nailing down before the area table can
// be walked reliably. Finishing it would let us rasterize the TRUE walkable floor (a precise,
// elevation-aware corridor grid) instead of classifying the radar PNG — a future refinement.
//   npx tsx scripts/parse-nav.ts [path-to.nav]
import { readFileSync } from "node:fs";

const path = process.argv[2] || "/Users/matthewli/mirage/de_mirage/maps/de_mirage_custom.nav";
const b = readFileSync(path);
let o = 0;
const u8 = () => b.readUInt8((o += 1) - 1);
const u16 = () => b.readUInt16LE((o += 2) - 2);
const u32 = () => b.readUInt32LE((o += 4) - 4);
const f32 = () => b.readFloatLE((o += 4) - 4);

const magic = u32(), version = u32();
const subVersion = version >= 10 ? u32() : 0;
u32(); // bspSize
u8(); // isAnalyzed
const placeCount = u16();
const places: string[] = [];
for (let i = 0; i < placeCount; i += 1) { const len = u16(); places.push(b.toString("utf8", o, o + len).replace(/\0/g, "")); o += len; }
u8(); // hasUnnamedAreas
const areaCount = u32();
console.log(`magic 0x${magic.toString(16)} v${version}.${subVersion}  places ${placeCount}  areas ${areaCount}`);
console.log("callouts:", places.join(", "));

// Validate the overview transform on area 0 (should be a T-spawn quad).
const id = u32(); u32();
const nwX = f32(), nwY = f32(); f32(); const seX = f32(), seY = f32();
const M = { posX: -3230, posY: 1713, scale: 5, size: 1024 };
const r = (x: number, y: number) => `${(((x - M.posX) / M.scale / M.size) * 100).toFixed(1)},${(((M.posY - y) / M.scale / M.size) * 100).toFixed(1)}`;
console.log(`area0 id=${id}  NW radar ${r(nwX, nwY)}  SE radar ${r(seX, seY)}  (expect ~T spawn 86,37)`);
