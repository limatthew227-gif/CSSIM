/**
 * Derive TRUE Mirage callout positions from a CS2 demo: CS2 tags every player tick with the named
 * area it's in (`last_place_name`), so the centroid of all real positions in each callout = that
 * callout's true radar coordinate. Fully data-driven — no eyeballing.
 *
 *   npx tsx scripts/calibrate-mirage.ts <path-to.dem>
 *
 * Prints each callout's centroid (radar 0..100), sample count and spread, and renders the real
 * centroids over the Simple Radar PNG next to the current graph nodes for comparison.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseEvents, parseTicks } from "@laihoe/demoparser2";
import { mirageNodes } from "../src/mirageNav";

const MIRAGE = { posX: -3230, posY: 1713, scale: 5.0, size: 1024 };
const toRadar = (x: number, y: number) => ({ x: ((x - MIRAGE.posX) / MIRAGE.scale / MIRAGE.size) * 100, y: ((MIRAGE.posY - y) / MIRAGE.scale / MIRAGE.size) * 100 });

const demoPaths = process.argv.slice(2);
if (!demoPaths.length) { console.error("usage: npx tsx scripts/calibrate-mirage.ts <demo1.dem> [demo2.dem ...]"); process.exit(1); }

const acc = new Map<string, { x: number; y: number; n: number; xs: number[]; ys: number[] }>();
const trans = new Map<string, number>();
for (const demoPath of demoPaths) {
  const starts = parseEvents(demoPath, ["round_start"]).map((e: any) => e.tick).sort((a: number, b: number) => a - b);
  const ticks: number[] = [];
  for (let ri = 0; ri < starts.length; ri += 1) {
    const a = starts[ri], b = starts[ri + 1] ?? a + 64 * 80;
    for (let t = a; t < b; t += 16) ticks.push(t);
  }
  const rows: any[] = parseTicks(demoPath, ["X", "Y", "last_place_name", "is_alive"], ticks);
  console.error(`  ${demoPath.split("/").pop()}: ${rows.length} samples`);
  for (const r of rows) {
    if (r.X == null || !r.last_place_name || r.is_alive === false) continue;
    const p = toRadar(r.X, r.Y);
    const k = r.last_place_name as string;
    if (!acc.has(k)) acc.set(k, { x: 0, y: 0, n: 0, xs: [], ys: [] });
    const a = acc.get(k)!;
    a.x += p.x; a.y += p.y; a.n += 1; a.xs.push(p.x); a.ys.push(p.y);
  }
  // adjacency: direct callout->callout transitions (consecutive samples, same player), per demo
  const byPlayer = new Map<string, any[]>();
  for (const r of rows) {
    if (!r.last_place_name) continue;
    const k = String(r.steamid ?? r.name);
    if (!byPlayer.has(k)) byPlayer.set(k, []);
    byPlayer.get(k)!.push(r);
  }
  for (const rs of byPlayer.values()) {
    rs.sort((a, b) => a.tick - b.tick);
    for (let i = 1; i < rs.length; i += 1) {
      if (rs[i].tick - rs[i - 1].tick > 48) continue;
      const a = rs[i - 1].last_place_name, b = rs[i].last_place_name;
      if (!a || !b || a === b) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      trans.set(key, (trans.get(key) ?? 0) + 1);
    }
  }
}

const std = (vals: number[], m: number) => Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, vals.length));
const callouts = [...acc.entries()]
  .map(([name, a]) => ({ name, x: a.x / a.n, y: a.y / a.n, n: a.n, sx: std(a.xs, a.x / a.n), sy: std(a.ys, a.y / a.n) }))
  .sort((a, b) => b.n - a.n);

console.log("CALLOUT".padEnd(20), "radarX,Y".padEnd(14), "n".padStart(6), "  spread(x,y)");
for (const c of callouts) console.log(c.name.padEnd(20), `${c.x.toFixed(1)},${c.y.toFixed(1)}`.padEnd(14), String(c.n).padStart(6), `  ${c.sx.toFixed(1)},${c.sy.toFixed(1)}`);

console.log("\nADJACENCY (direct callout transitions, count >= 25):");
const big = new Set(callouts.filter((c) => c.n > 40).map((c) => c.name));
for (const [key, n] of [...trans.entries()].filter(([k, v]) => v >= 25 && k.split("|").every((p) => big.has(p))).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${key.replace("|", " <-> ").padEnd(34)} ${n}`);
}

// Overlay: real callout centroids (yellow) vs current graph nodes (white).
const S = 7;
const b64 = readFileSync("src/assets/radar/mirage.png").toString("base64");
const real = callouts.filter((c) => c.n > 40).map((c) =>
  `<circle cx="${c.x * S}" cy="${c.y * S}" r="3.4" fill="#ffd23d" stroke="#000"/>` +
  `<text x="${c.x * S + 4}" y="${c.y * S - 3}" fill="#ffd23d" font-size="9" font-family="sans-serif" style="paint-order:stroke;stroke:#000;stroke-width:2.5px;">${c.name}</text>`).join("\n");
const mine = mirageNodes.map((n) =>
  `<circle cx="${n.x * S}" cy="${n.y * S}" r="2.6" fill="none" stroke="#39d6ff" stroke-width="1.4"/>` +
  `<text x="${n.x * S + 4}" y="${n.y * S + 8}" fill="#39d6ff" font-size="8" font-family="sans-serif" style="paint-order:stroke;stroke:#000;stroke-width:2px;">${n.id}</text>`).join("\n");
writeFileSync("scratch/calibrate-overlay.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="${100 * S}" height="${100 * S}" viewBox="0 0 ${100 * S} ${100 * S}">
<image href="data:image/png;base64,${b64}" x="0" y="0" width="${100 * S}" height="${100 * S}"/>
${mine}
${real}
</svg>`);
console.log("\nwrote scratch/calibrate-overlay.svg (yellow = real callout centroids, cyan rings = current graph nodes)");
