/**
 * Parse a CS2 .dem (Mirage) and project real player positions onto the Simple Radar image, so we can
 * calibrate the tactical graph (node positions, routes, movement speed, engagement spots) from REAL
 * play instead of eyeballing. Local-only — demos are gitignored.
 *
 *   npm i -D @laihoe/demoparser2   (already installed)
 *   npx tsx scripts/parse-demo.ts <path-to.dem> [roundIndex]
 *
 * Outputs:
 *   - console: header/map, round ticks, kill count, radar-coord range (sanity for the transform)
 *   - scratch/demo-overlay.svg : real positions (dots by team) + kill traces over the radar PNG
 *   - scratch/demo-samples.json : sampled positions + kills in radar (0..100) coords for calibration
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseHeader, parseEvents, parseTicks } from "@laihoe/demoparser2";
import { mirageNodes, mirageEdges, getNode } from "../src/mirageNav";

// de_mirage radar overview transform (Valve de_mirage.txt). Simple Radar aligns to the same bounds;
// we verify with the overlay and tweak here if the dots don't sit on the floor.
const MIRAGE = { posX: -3230, posY: 1713, scale: 5.0, size: 1024 };
function worldToRadar(x: number, y: number): { x: number; y: number } {
  const px = (x - MIRAGE.posX) / MIRAGE.scale; // 0..1024
  const py = (MIRAGE.posY - y) / MIRAGE.scale;
  return { x: (px / MIRAGE.size) * 100, y: (py / MIRAGE.size) * 100 };
}

const demoPath = process.argv[2];
if (!demoPath) {
  console.error("usage: npx tsx scripts/parse-demo.ts <path-to.dem> [roundIndex]");
  process.exit(1);
}
const roundIndex = Number(process.argv[3] ?? 5);

const header: any = parseHeader(demoPath);
console.log("map:", header.map_name, "| header keys:", Object.keys(header).join(", "));

// Round boundaries + kills (player positions attached as 'extra' fields).
const events: any[] = parseEvents(demoPath, ["round_start", "round_freeze_end", "player_death", "bomb_planted"], ["X", "Y", "Z"], ["X", "Y", "Z"]);
const roundStarts = events.filter((e) => e.event_name === "round_start").map((e) => e.tick).sort((a, b) => a - b);
const deaths = events.filter((e) => e.event_name === "player_death");
console.log(`rounds: ${roundStarts.length}  deaths: ${deaths.length}`);
if (deaths.length) console.log("death event keys:", Object.keys(deaths[0]).join(", "));

const AGG = process.argv[3] === "all";
const step = 16; // tick sampling (CS2 = 64 tick -> 0.25s)
const wantedTicks: number[] = [];
if (AGG) {
  for (let ri = 0; ri < roundStarts.length; ri += 1) {
    const a = roundStarts[ri];
    const b = roundStarts[ri + 1] ?? a + 64 * 80;
    for (let t = a; t < b; t += step) wantedTicks.push(t);
  }
  console.log(`aggregating ALL ${roundStarts.length} rounds: ${wantedTicks.length} sampled ticks`);
} else {
  const rStart = roundStarts[roundIndex] ?? roundStarts[0] ?? 0;
  const rEnd = roundStarts[roundIndex + 1] ?? rStart + 64 * 60;
  for (let t = rStart; t < rEnd; t += step) wantedTicks.push(t);
  console.log(`sampling round ${roundIndex}: ticks ${rStart}..${rEnd}`);
}
const ticks: any[] = parseTicks(demoPath, ["X", "Y", "Z", "is_alive", "team_num", "player_name"], wantedTicks);
if (ticks.length) console.log("tick row keys:", Object.keys(ticks[0]).join(", "));

// --- Movement speed (radar units / sec): consecutive in-round samples per player ---
if (AGG) {
  const TICKRATE = 64;
  const dt = step / TICKRATE;
  const byP = new Map<string, any[]>();
  for (const row of ticks) {
    if (row.X == null) continue;
    const k = row.player_name ?? String(row.steamid);
    if (!byP.has(k)) byP.set(k, []);
    byP.get(k)!.push(row);
  }
  const speeds: number[] = [];
  for (const rows of byP.values()) {
    rows.sort((a, b) => a.tick - b.tick);
    for (let i = 1; i < rows.length; i += 1) {
      if (rows[i].tick - rows[i - 1].tick !== step) continue; // skip round gaps
      if (rows[i].is_alive === false || rows[i - 1].is_alive === false) continue;
      const a = worldToRadar(rows[i - 1].X, rows[i - 1].Y);
      const b = worldToRadar(rows[i].X, rows[i].Y);
      const v = Math.hypot(b.x - a.x, b.y - a.y) / dt;
      if (v > 0.5 && v < 60) speeds.push(v); // exclude standing + teleports
    }
  }
  speeds.sort((a, b) => a - b);
  const pct = (p: number) => speeds[Math.floor(speeds.length * p)] ?? 0;
  console.log(`MOVE SPEED (radar u/s): median ${pct(0.5).toFixed(1)}  p75 ${pct(0.75).toFixed(1)}  p90 ${pct(0.9).toFixed(1)}  (sprint cap ~p90)`);

  // spawns: team centroids at the first sample of each round
  const spawnAcc: Record<number, { x: number; y: number; n: number }> = {};
  for (const rs of roundStarts) {
    for (const row of ticks.filter((r) => r.tick >= rs && r.tick < rs + step && r.X != null)) {
      const r = worldToRadar(row.X, row.Y);
      const t = row.team_num ?? 0;
      spawnAcc[t] ??= { x: 0, y: 0, n: 0 };
      spawnAcc[t].x += r.x; spawnAcc[t].y += r.y; spawnAcc[t].n += 1;
    }
  }
  for (const [t, a] of Object.entries(spawnAcc)) console.log(`spawn team ${t} (${t === "2" ? "T" : t === "3" ? "CT" : "?"}): ${(a.x / a.n).toFixed(1)},${(a.y / a.n).toFixed(1)}`);
  // sites from plants
  for (const p of events.filter((e) => e.event_name === "bomb_planted")) {
    if (p.X != null) { const r = worldToRadar(p.X, p.Y); console.log(`plant @ ${r.x.toFixed(1)},${r.y.toFixed(1)}`); }
  }
}

const S = 7;
const b64 = readFileSync("src/assets/radar/mirage.png").toString("base64");
const teamColor = (t: number) => (t === 2 ? "#ff9b3d" : t === 3 ? "#39d6ff" : "#aaa"); // 2=T, 3=CT
let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
const body: string[] = [];

if (AGG) {
  // Traffic heatmap: every alive sample as a faint dot, so corridors/holds light up across all rounds.
  for (const row of ticks) {
    if (row.X == null || row.is_alive === false) continue;
    const r = worldToRadar(row.X, row.Y);
    minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x); minY = Math.min(minY, r.y); maxY = Math.max(maxY, r.y);
    body.push(`<circle cx="${(r.x * S).toFixed(1)}" cy="${(r.y * S).toFixed(1)}" r="1.5" fill="${teamColor(row.team_num)}" fill-opacity="0.07"/>`);
  }
  // all kills (victim spot) as a brighter scatter = engagement spots
  for (const d of deaths) {
    const vx = d.user_X, vy = d.user_Y;
    if (vx == null) continue;
    const v = worldToRadar(vx, vy);
    body.push(`<circle cx="${(v.x * S).toFixed(1)}" cy="${(v.y * S).toFixed(1)}" r="2.2" fill="#ff4d4d" fill-opacity="0.5"/>`);
  }
} else {
  const byPlayer = new Map<string, { team: number; pts: { x: number; y: number }[] }>();
  for (const row of ticks) {
    if (row.X == null) continue;
    const r = worldToRadar(row.X, row.Y);
    minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x); minY = Math.min(minY, r.y); maxY = Math.max(maxY, r.y);
    const key = row.player_name ?? String(row.steamid ?? "?");
    if (!byPlayer.has(key)) byPlayer.set(key, { team: row.team_num ?? 0, pts: [] });
    if (row.is_alive !== false) byPlayer.get(key)!.pts.push(r);
  }
  for (const [, p] of byPlayer) {
    if (p.pts.length < 2) continue;
    body.push(`<polyline points="${p.pts.map((q) => `${(q.x * S).toFixed(1)},${(q.y * S).toFixed(1)}`).join(" ")}" fill="none" stroke="${teamColor(p.team)}" stroke-width="1.4" stroke-opacity="0.8"/>`);
  }
}
console.log(`radar coord range: x ${minX.toFixed(1)}..${maxX.toFixed(1)}  y ${minY.toFixed(1)}..${maxY.toFixed(1)}  (expect ~0..100)`);

// Overlay the CURRENT tactical-graph nodes/edges so we can see which sit off the real traffic.
const graph: string[] = [];
for (const e of mirageEdges) {
  const a = getNode(e.from)!, b = getNode(e.to)!;
  graph.push(`<line x1="${a.x * S}" y1="${a.y * S}" x2="${b.x * S}" y2="${b.y * S}" stroke="#7fffd4" stroke-width="0.8" stroke-opacity="0.5"/>`);
}
for (const n of mirageNodes) {
  graph.push(`<circle cx="${n.x * S}" cy="${n.y * S}" r="3" fill="#fff" stroke="#000"/>` +
    `<text x="${n.x * S + 4}" y="${n.y * S + 3}" fill="#fff" font-size="9" font-family="sans-serif" style="paint-order:stroke;stroke:#000;stroke-width:2.5px;">${n.callout}</text>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${100 * S}" height="${100 * S}" viewBox="0 0 ${100 * S} ${100 * S}">
<image href="data:image/png;base64,${b64}" x="0" y="0" width="${100 * S}" height="${100 * S}"/>
${body.join("\n")}
${graph.join("\n")}
</svg>`;
writeFileSync("scratch/demo-overlay.svg", svg);
console.log("wrote scratch/demo-overlay.svg");
