import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { HLTV } = require("hltv");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "src", "hltvPlayerAges2026.ts");
const cachePath = path.join(root, "data", "hltv-player-ages-2026-07-13.json");
const snapshot = { year: 2026, month: "july", day: 13 };
const forceRefresh = process.argv.includes("--refresh");

function key(value) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "");
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withRetry(label, worker) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const value = await worker();
      await wait(650);
      return value;
    } catch (error) {
      lastError = error;
      await wait(attempt * 2000);
    }
  }
  throw new Error(`${label}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function concurrent(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

function seedHandles(source) {
  const handles = new Set();
  for (const match of source.matchAll(/\bhandle:\s*"([^"]+)"/g)) handles.add(match[1]);
  for (const match of source.matchAll(/\bplayer\(\s*"([^"]+)"/g)) handles.add(match[1]);
  return handles;
}

let cachedProfiles = [];
try {
  const cached = JSON.parse(await fs.readFile(cachePath, "utf8"));
  cachedProfiles = Array.isArray(cached.players) ? cached.players : [];
} catch {
  cachedProfiles = [];
}

async function saveCache() {
  await fs.writeFile(
    cachePath,
    `${JSON.stringify({ source: "HLTV player profiles", snapshot: "2026-07-13", players: cachedProfiles }, null, 2)}\n`,
  );
}

const useCachedRanking = cachedProfiles.length >= 200 && !forceRefresh;
const ranking = useCachedRanking ? [] : await withRetry("team ranking", () => HLTV.getTeamRanking(snapshot));
const selectedTeams = ranking.filter(({ place }) => (place >= 1 && place <= 20) || (place >= 27 && place <= 50));
const teams = await concurrent(selectedTeams, 1, async ({ team, place }) => {
  const profile = await withRetry(team.name, () => HLTV.getTeam({ id: team.id }));
  return {
    place,
    name: profile.name,
    players: profile.players.filter((player) => player.type === "Starter").slice(0, 5),
  };
});

const profileTargets = useCachedRanking
  ? cachedProfiles
  : teams.flatMap((team) =>
      team.players.map((player) => ({ id: player.id, ign: player.name, team: team.name, rank: team.place })),
    );
const profiles = await concurrent(profileTargets, 1, async (target) => {
  const cached = cachedProfiles.find((profile) => profile.id === target.id);
  if (cached && !forceRefresh) return cached;
  try {
    const profile = await withRetry(target.ign, () => HLTV.getPlayer({ id: target.id }));
    const row = { ...target, ign: profile.ign, age: profile.age };
    if (row.age != null) {
      const cachedIndex = cachedProfiles.findIndex((item) => item.id === row.id);
      if (cachedIndex >= 0) cachedProfiles[cachedIndex] = row;
      else cachedProfiles.push(row);
      await saveCache();
    }
    return row;
  } catch (error) {
    console.warn(`Could not fetch ${target.ign}: ${error instanceof Error ? error.message : String(error)}`);
    return { ...target, age: undefined };
  }
});

const ages = new Map();
for (const profile of profiles) {
  if (profile.age != null) ages.set(key(profile.ign), profile.age);
}

const sourceFiles = ["src/hltvTop20.ts", "src/hltvRanked27To50.ts"];
const handles = new Set();
for (const file of sourceFiles) {
  const source = await fs.readFile(path.join(root, file), "utf8");
  seedHandles(source).forEach((handle) => handles.add(handle));
}

const missing = [...handles].filter((handle) => !ages.has(key(handle)));
await concurrent(missing, 1, async (handle) => {
  try {
    const profile = await HLTV.getPlayerByName({ name: handle });
    await wait(650);
    if (profile.age != null && key(profile.ign) === key(handle)) {
      ages.set(key(handle), profile.age);
      if (!cachedProfiles.some((row) => row.id === profile.id)) {
        cachedProfiles.push({ id: profile.id, ign: profile.ign, age: profile.age, team: profile.team?.name, rank: null });
        await saveCache();
      }
    }
  } catch (error) {
    console.warn(`No exact age match for ${handle}: ${error instanceof Error ? error.message : String(error)}`);
    await wait(650);
  }
});

const entries = [...ages.entries()].sort(([left], [right]) => left.localeCompare(right));
const source = `// Generated from HLTV player profiles on July 13, 2026.\n// Refresh with: npm run scrape:hltv-ages\nexport const hltvPlayerAges2026: Readonly<Record<string, number>> = {\n${entries
  .map(([handle, age]) => `  ${JSON.stringify(handle)}: ${age},`)
  .join("\n")}\n};\n\nexport function hltvPlayerAge2026(handle: string) {\n  const key = handle.toLowerCase().replace(/[^a-z0-9-]+/g, "");\n  return hltvPlayerAges2026[key];\n}\n`;

await fs.writeFile(outputPath, source);
console.log(`Wrote ${entries.length} verified player ages to ${path.relative(root, outputPath)}.`);
