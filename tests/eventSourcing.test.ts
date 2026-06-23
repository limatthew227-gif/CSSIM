import { test } from "node:test";
import assert from "node:assert/strict";

import { initMatch, playRound, type FieldTeam } from "../src/sim";
import { eventLogFromMatchState } from "../src/matchEvents";
import { boxScoreFromEventLog } from "../src/eventSourcing";
import { defaultSettings, difficulties, mapPool, type MapId, type Player, type Role } from "../src/gameData";

// The event-sourced box score must reproduce the live counting stats EXACTLY — that's the guarantee
// that makes "store events, derive stats" trustworthy for stats pages and the match database.
const COUNTING_KEYS = ["kills", "deaths", "assists", "firstKills", "firstDeaths", "multiKills", "rounds"] as const;

test("boxScoreFromEventLog: reproduces the live counting stats exactly", () => {
  for (const seed of [1, 7, 23, 99]) {
    const you = makeTeam("you", 86);
    const opp = makeTeam("opp", 81);
    const state = playMatch(seed, you, opp, "inferno");
    const box = boxScoreFromEventLog(eventLogFromMatchState("inferno", state), you.players, opp.players);

    you.players.forEach((player) => {
      for (const key of COUNTING_KEYS) {
        assert.equal(
          box.left[player.id][key],
          state.yourStats[player.id][key],
          `seed ${seed} you ${player.id} ${key}: derived ${box.left[player.id][key]} != live ${state.yourStats[player.id][key]}`,
        );
      }
    });
    opp.players.forEach((player) => {
      for (const key of COUNTING_KEYS) {
        assert.equal(box.right[player.id][key], state.opponentStats[player.id][key], `seed ${seed} opp ${player.id} ${key}`);
      }
    });
  }
});

test("boxScoreFromEventLog: derived ADR/KAST/rating are internally consistent", () => {
  const you = makeTeam("you", 84);
  const opp = makeTeam("opp", 84);
  const state = playMatch(11, you, opp, "mirage");
  const box = boxScoreFromEventLog(eventLogFromMatchState("mirage", state), you.players, opp.players);

  [...you.players, ...opp.players].forEach((player) => {
    const line = box.left[player.id] ?? box.right[player.id];
    assert.ok(line.rounds > 0);
    assert.ok(line.kastRounds >= 0 && line.kastRounds <= line.rounds, `kast ${line.kastRounds}/${line.rounds}`);
    assert.ok(line.damage >= 0);
    assert.ok(line.adr >= 0);
    assert.ok(line.rating >= 0.1 && line.rating <= 2.8, `rating ${line.rating}`);
  });
});

function playMatch(seed: number, you: FieldTeam, opp: FieldTeam, map: MapId) {
  return withSeed(seed, () => {
    let state = initMatch(map, you, opp);
    let guard = 0;
    while (!state.ended && guard < 200) {
      state = playRound(state, you, opp, defaultSettings, difficulties[0], "standard", 0, true);
      guard += 1;
    }
    return state;
  });
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function withSeed<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  Math.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function makeTeam(id: string, ovr: number): FieldTeam {
  return {
    id,
    tag: id.slice(0, 3).toUpperCase(),
    name: id,
    country: "US",
    era: "CS2",
    year: "2026",
    accent: "#ffffff",
    rank: 10,
    players: [
      makePlayer(`${id}-igl`, "IGL", ovr),
      makePlayer(`${id}-awp`, "AWP", ovr),
      makePlayer(`${id}-entry`, "Entry", ovr),
      makePlayer(`${id}-support`, "Support", ovr),
      makePlayer(`${id}-rifler`, "Rifler", ovr),
    ],
  };
}

function makePlayer(id: string, role: Role, ovr: number): Player {
  const maps = mapPool.reduce((acc, map) => ((acc[map.id] = ovr), acc), {} as Record<MapId, number>);
  return {
    id,
    handle: id,
    realName: id,
    country: "US",
    role,
    style: "Balanced",
    traits: [role],
    stats: { aim: ovr, clutch: ovr, consistency: ovr, awp: role === "AWP" ? 90 : 55, igl: role === "IGL" ? 90 : 55 },
    ovr,
    source: { tag: "TST", name: `${id}-src`, country: "US", era: "CS2", year: "2026", accent: "#ffffff" },
    maps,
  };
}
