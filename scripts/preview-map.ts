/**
 * Authoring aid: render a map's walkable geometry + a few any-angle routes to an SVG you can open in
 * a browser, so you can eyeball/tune a floorplan without driving a whole match.
 *
 *   npm run preview:map -- mirage      (or: npx tsx scripts/preview-map.ts mirage)
 *
 * Writes scratch/<id>-preview.svg. On macOS, rasterize to view inline:
 *   qlmanage -t -s 700 -o /tmp scratch/mirage-preview.svg
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { mapGeometries, buildNavGrid, findPath, type Vec } from "../src/mapGeometry";

const id = (process.argv[2] || "mirage") as keyof typeof mapGeometries;
const geo = mapGeometries[id];
if (!geo) {
  console.error(`no geometry for "${id}" (have: ${Object.keys(mapGeometries).join(", ") || "none"})`);
  process.exit(1);
}

const S = 7; // scale 0..100 -> px
const grid = buildNavGrid(geo);
const pts = (poly: Vec[]) => poly.map((p) => `${p.x * S},${p.y * S}`).join(" ");
const line = (path: Vec[], color: string) =>
  `<polyline points="${path.map((p) => `${p.x * S},${p.y * S}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" opacity="0.95"/>`;
const dot = (p: Vec, color: string, label: string) =>
  `<circle cx="${p.x * S}" cy="${p.y * S}" r="4" fill="${color}"/><text x="${p.x * S + 6}" y="${p.y * S + 3}" fill="#fff" font-size="11" font-family="sans-serif">${label}</text>`;

const routes: Array<[Vec, Vec, string]> = [
  [geo.spawns.t, geo.sites.a, "#ff5b5b"],
  [geo.spawns.t, geo.sites.b, "#ffb24d"],
  [geo.spawns.ct, geo.sites.a, "#4da6ff"],
  [geo.spawns.ct, geo.sites.b, "#7ee0c0"],
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${100 * S}" height="${100 * S}" viewBox="0 0 ${100 * S} ${100 * S}">
<rect width="100%" height="100%" fill="#11161d"/>
${geo.walkable.map((poly) => `<polygon points="${pts(poly)}" fill="#22303f"/>`).join("\n")}
${geo.walls.map((poly) => `<polygon points="${pts(poly)}" fill="#0a0e13"/>`).join("\n")}
${routes.map(([a, b, c]) => line(findPath(grid, a, b), c)).join("\n")}
${geo.labels
  .filter((lb) => !["A", "B", "T", "CT"].includes(lb.text))
  .map((lb) => `<text x="${lb.at.x * S}" y="${lb.at.y * S}" fill="rgba(230,238,247,0.85)" font-size="11" font-family="sans-serif" text-anchor="middle">${lb.text}</text>`)
  .join("\n")}
${dot(geo.spawns.t, "#ff5b5b", "T")}
${dot(geo.spawns.ct, "#4da6ff", "CT")}
${dot(geo.sites.a, "#ffd23d", "A")}
${dot(geo.sites.b, "#ffd23d", "B")}
</svg>`;

mkdirSync("scratch", { recursive: true });
const out = `scratch/${id}-preview.svg`;
writeFileSync(out, svg);
console.log(`wrote ${out} (${100 * S}x${100 * S}px) — routes: T->A, T->B, CT->A, CT->B`);
