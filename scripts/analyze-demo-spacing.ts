/**
 * Measure real team spacing from one or more CS2 demos in the same 0..100 radar space used by the
 * simulator.
 *
 *   npm run analyze:demo-spacing -- /path/to/map.dem [/path/to/another.dem]
 *
 * The overview scales are from the same pinned Awpy/Source 2 resources used by
 * generate-voxel-map-data.ts. Results are grouped into spawn, default, contact, execute, and
 * post-plant phases so tactical formation constants can be calibrated from real rounds.
 */
import { parseEvents, parseHeader, parseTicks } from "@laihoe/demoparser2";

type Phase = "spawn" | "default" | "contact" | "execute" | "post";
type Side = "T" | "CT";
type Point = { x: number; y: number };
type Sample = {
  nearest: number[];
  spread: number;
  maxPack: number;
};

const RADAR_PIXELS = 1024;
const TICK_RATE = 64;
const SAMPLE_STEP = 32;
const PACK_RADIUS = 4;

// Awpy patch 17595823 map-data.json — the same transform source as the voxel generator.
const OVERVIEW_SCALE: Record<string, number> = {
  de_ancient: 5,
  de_anubis: 5.22,
  de_dust2: 4.4,
  de_inferno: 4.9,
  de_mirage: 5,
  de_nuke: 7,
  de_train: 4.082077,
};

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

function radarDistance(worldDistance: number, scale: number) {
  return (worldDistance / (scale * RADAR_PIXELS)) * 100;
}

function phaseAt(tick: number, freezeTick: number, plantTick?: number): Phase {
  const elapsed = (tick - freezeTick) / TICK_RATE;
  if (elapsed < 2) return "spawn";
  if (plantTick != null && tick >= plantTick) return "post";
  if (plantTick != null && tick >= plantTick - TICK_RATE * 8) return "execute";
  if (elapsed < 18) return "default";
  return "contact";
}

function measure(points: Point[]): Sample {
  const nearest: number[] = [];
  let spread = 0;
  let maxPack = 1;
  for (let left = 0; left < points.length; left += 1) {
    let nearestDistance = Number.POSITIVE_INFINITY;
    let localPack = 1;
    for (let right = 0; right < points.length; right += 1) {
      if (left === right) continue;
      const distance = Math.hypot(
        points[left].x - points[right].x,
        points[left].y - points[right].y,
      );
      nearestDistance = Math.min(nearestDistance, distance);
      spread = Math.max(spread, distance);
      if (distance < PACK_RADIUS) localPack += 1;
    }
    if (Number.isFinite(nearestDistance)) nearest.push(nearestDistance);
    maxPack = Math.max(maxPack, localPack);
  }
  return { nearest, spread, maxPack };
}

const demoPaths = process.argv.slice(2);
if (!demoPaths.length) {
  console.error("usage: npm run analyze:demo-spacing -- /path/to/map.dem [...]");
  process.exit(1);
}

const aggregate = new Map<string, Sample[]>();

for (const demoPath of demoPaths) {
  const header = parseHeader(demoPath) as { map_name?: string };
  const mapName = header.map_name ?? "";
  const scale = OVERVIEW_SCALE[mapName];
  if (!scale) {
    console.warn(`Skipping ${demoPath}: no pinned overview scale for ${mapName || "unknown map"}`);
    continue;
  }

  const events = parseEvents(demoPath, [
    "round_freeze_end",
    "bomb_planted",
    "round_end",
  ]) as Array<{ event_name: string; tick: number }>;
  const freezeTicks = events
    .filter((event) => event.event_name === "round_freeze_end")
    .map((event) => event.tick)
    .sort((a, b) => a - b);
  const endTicks = events
    .filter((event) => event.event_name === "round_end")
    .map((event) => event.tick)
    .sort((a, b) => a - b);
  const plantTicks = events
    .filter((event) => event.event_name === "bomb_planted")
    .map((event) => event.tick)
    .sort((a, b) => a - b);
  const wantedTicks: number[] = [];
  const rounds: Array<{ freeze: number; end: number; plant?: number }> = [];
  for (const freeze of freezeTicks) {
    const end = endTicks.find((tick) => tick > freeze);
    if (end == null) continue;
    const plant = plantTicks.find((tick) => tick >= freeze && tick <= end);
    rounds.push({ freeze, end, plant });
    for (let tick = freeze; tick <= end; tick += SAMPLE_STEP) wantedTicks.push(tick);
  }

  const rows = parseTicks(
    demoPath,
    ["X", "Y", "is_alive", "team_num", "player_name"],
    wantedTicks,
  ) as Array<{
    X?: number;
    Y?: number;
    is_alive?: boolean;
    team_num?: number;
    tick: number;
  }>;
  const byTick = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = byTick.get(row.tick) ?? [];
    list.push(row);
    byTick.set(row.tick, list);
  }

  for (const round of rounds) {
    for (
      let tick = round.freeze;
      tick <= round.end;
      tick += SAMPLE_STEP
    ) {
      const phase = phaseAt(tick, round.freeze, round.plant);
      const tickRows = byTick.get(tick) ?? [];
      for (const [teamNum, side] of [[2, "T"], [3, "CT"]] as const) {
        const points = tickRows
          .filter(
            (row) =>
              row.team_num === teamNum &&
              row.is_alive !== false &&
              row.X != null &&
              row.Y != null,
          )
          .map((row) => ({
            x: radarDistance(row.X!, scale),
            y: radarDistance(row.Y!, scale),
          }));
        if (points.length < 2) continue;
        const key = `${mapName}:${side}:${phase}`;
        const samples = aggregate.get(key) ?? [];
        samples.push(measure(points));
        aggregate.set(key, samples);
      }
    }
  }
}

console.log("map       side phase     nearest p25 / p50 / p75   team spread p50   pack>=3");
for (const [key, samples] of [...aggregate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const [mapName, side, phase] = key.split(":") as [string, Side, Phase];
  const nearest = samples.flatMap((sample) => sample.nearest);
  const spreads = samples.map((sample) => sample.spread);
  const clumped = samples.filter((sample) => sample.maxPack >= 3).length / samples.length;
  console.log(
    `${mapName.replace("de_", "").padEnd(10)} ${side.padEnd(4)} ${phase.padEnd(9)} ` +
      `${percentile(nearest, 0.25).toFixed(1).padStart(5)} / ` +
      `${percentile(nearest, 0.5).toFixed(1).padStart(5)} / ` +
      `${percentile(nearest, 0.75).toFixed(1).padStart(5)}      ` +
      `${percentile(spreads, 0.5).toFixed(1).padStart(6)}          ` +
      `${(clumped * 100).toFixed(1).padStart(5)}%`,
  );
}
