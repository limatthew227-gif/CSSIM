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

const rStart = roundStarts[roundIndex] ?? roundStarts[0] ?? 0;
const rEnd = roundStarts[roundIndex + 1] ?? rStart + 64 * 60;
console.log(`sampling round ${roundIndex}: ticks ${rStart}..${rEnd}`);

// Sample ~every 0.5s (assume 64-tick) within the round.
const step = 32;
const wantedTicks: number[] = [];
for (let t = rStart; t < rEnd; t += step) wantedTicks.push(t);
const ticks: any[] = parseTicks(demoPath, ["X", "Y", "Z", "is_alive", "team_num", "player_name"], wantedTicks);
if (ticks.length) console.log("tick row keys:", Object.keys(ticks[0]).join(", "));

// Group by player, build radar-space trails.
const byPlayer = new Map<string, { team: number; pts: { x: number; y: number }[] }>();
let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
for (const row of ticks) {
  if (row.X == null || row.Y == null) continue;
  const r = worldToRadar(row.X, row.Y);
  minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x); minY = Math.min(minY, r.y); maxY = Math.max(maxY, r.y);
  const key = row.player_name ?? String(row.steamid ?? row.player_steamid ?? "?");
  if (!byPlayer.has(key)) byPlayer.set(key, { team: row.team_num ?? 0, pts: [] });
  if (row.is_alive !== false) byPlayer.get(key)!.pts.push(r);
}
console.log(`radar coord range: x ${minX.toFixed(1)}..${maxX.toFixed(1)}  y ${minY.toFixed(1)}..${maxY.toFixed(1)}  (expect ~0..100)`);

// Render overlay.
const S = 7;
const b64 = readFileSync("src/assets/radar/mirage.png").toString("base64");
const teamColor = (t: number) => (t === 2 ? "#ff9b3d" : t === 3 ? "#39d6ff" : "#aaa"); // 2=T, 3=CT
const trails: string[] = [];
for (const [, p] of byPlayer) {
  if (p.pts.length < 2) continue;
  trails.push(`<polyline points="${p.pts.map((q) => `${(q.x * S).toFixed(1)},${(q.y * S).toFixed(1)}`).join(" ")}" fill="none" stroke="${teamColor(p.team)}" stroke-width="1.4" stroke-opacity="0.8"/>`);
}
const kills: string[] = [];
for (const d of deaths.filter((e) => e.tick >= rStart && e.tick < rEnd)) {
  const ax = d.attacker_X ?? d.attackerX, ay = d.attacker_Y ?? d.attackerY, vx = d.user_X ?? d.X, vy = d.user_Y ?? d.Y;
  if (ax == null || vx == null) continue;
  const a = worldToRadar(ax, ay), v = worldToRadar(vx, vy);
  kills.push(`<line x1="${a.x * S}" y1="${a.y * S}" x2="${v.x * S}" y2="${v.y * S}" stroke="#fff" stroke-width="1" stroke-dasharray="3 2"/>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${100 * S}" height="${100 * S}" viewBox="0 0 ${100 * S} ${100 * S}">
<image href="data:image/png;base64,${b64}" x="0" y="0" width="${100 * S}" height="${100 * S}"/>
${trails.join("\n")}
${kills.join("\n")}
</svg>`;
writeFileSync("scratch/demo-overlay.svg", svg);
writeFileSync("scratch/demo-samples.json", JSON.stringify({ map: header.map_name, transform: MIRAGE, round: roundIndex, players: [...byPlayer.entries()].map(([name, p]) => ({ name, team: p.team, pts: p.pts })), kills: deaths.filter((e) => e.tick >= rStart && e.tick < rEnd) }, null, 0));
console.log("wrote scratch/demo-overlay.svg + scratch/demo-samples.json");
