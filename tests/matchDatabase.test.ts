import { test } from "node:test";
import assert from "node:assert/strict";

import { initMatch, playRound, type FieldTeam } from "../src/sim";
import { eventLogFromMatchState } from "../src/matchEvents";
import { MatchDatabase, memoryStorage, teamRef, type RecordMatchInput } from "../src/matchDatabase";
import { defaultSettings, difficulties, mapPool, type MapId, type Player, type Role } from "../src/gameData";

test("MatchDatabase: records, persists across instances, and dedupes by id", () => {
  const storage = memoryStorage();
  const db = new MatchDatabase(storage);
  const input = matchInput("m1", "2026-06-01T00:00:00Z", makeTeam("you", 86), makeTeam("opp", 80), 3);
  db.recordMatch(input);
  db.recordMatch(input); // same id -> replace, not duplicate

  assert.equal(db.count(), 1);
  // a fresh instance over the same storage sees the persisted record
  const reopened = new MatchDatabase(storage);
  assert.equal(reopened.count(), 1);
  assert.equal(reopened.getMatch("m1")?.map, "inferno");
});

test("MatchDatabase: team rows tally wins and losses", () => {
  const db = new MatchDatabase(memoryStorage());
  const you = makeTeam("you", 90);
  const opp = makeTeam("opp", 74);
  db.recordMatch(matchInput("a", "2026-06-01T00:00:00Z", you, opp, 1));
  db.recordMatch(matchInput("b", "2026-06-02T00:00:00Z", you, opp, 2));

  const rows = db.listTeams();
  const youRow = rows.find((row) => row.team.id === "you")!;
  assert.equal(youRow.matches, 2);
  assert.equal(youRow.wins + youRow.losses, 2);
});

test("MatchDatabase: playerCareer folds a canonical player across teams and runs", () => {
  const db = new MatchDatabase(memoryStorage());
  // same human (handle/realName/country) under two per-run ids on two different teams
  const drafted = teamWithStar("you", "user-pick-2-spirit-star");
  const realTeam = teamWithStar("spirit", "spirit-star");
  const oppA = makeTeam("oppA", 80);
  const oppB = makeTeam("oppB", 80);

  db.recordMatch(matchInput("r1", "2026-06-01T00:00:00Z", drafted, oppA, 3));
  db.recordMatch(matchInput("r2", "2026-06-02T00:00:00Z", realTeam, oppB, 4));

  const canonical = db.getMatch("r1")!.players.find((ref) => ref.handle === "star")!.canonicalKey;
  const career = db.playerCareer(canonical)!;

  assert.equal(career.matches, 2);
  assert.equal(career.teamIds.length, 2); // appeared for two teams

  // career counting stats == sum of the two matches' stored box scores for that player
  const expected = ["r1", "r2"].reduce(
    (acc, id) => {
      const match = db.getMatch(id)!;
      const ref = match.players.find((entry) => entry.canonicalKey === canonical)!;
      const line = match.box[ref.id];
      acc.kills += line.kills;
      acc.deaths += line.deaths;
      acc.rounds += line.rounds;
      return acc;
    },
    { kills: 0, deaths: 0, rounds: 0 },
  );
  assert.equal(career.line.kills, expected.kills);
  assert.equal(career.line.deaths, expected.deaths);
  assert.equal(career.line.rounds, expected.rounds);
});

test("MatchDatabase: clear empties the store", () => {
  const db = new MatchDatabase(memoryStorage());
  db.recordMatch(matchInput("x", "2026-06-01T00:00:00Z", makeTeam("you", 84), makeTeam("opp", 84), 5));
  assert.equal(db.count(), 1);
  db.clear();
  assert.equal(db.count(), 0);
});

function matchInput(id: string, recordedAt: string, left: FieldTeam, right: FieldTeam, seed: number): RecordMatchInput {
  const state = playMatch(seed, left, right, "inferno");
  return {
    id,
    recordedAt,
    map: "inferno",
    left: { team: teamRef(left), players: left.players },
    right: { team: teamRef(right), players: right.players },
    leftScore: state.you,
    rightScore: state.opponent,
    winnerId: state.winner === "you" ? left.id : right.id,
    eventLog: eventLogFromMatchState("inferno", state),
  };
}

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
    players: ["IGL", "AWP", "Entry", "Support", "Rifler"].map((role, index) =>
      makePlayer(`${id}-${role.toLowerCase()}`, role as Role, ovr, `${id}${index}`),
    ),
  };
}

function teamWithStar(id: string, starId: string): FieldTeam {
  const team = makeTeam(id, 84);
  team.players = [makeStar(starId), ...team.players.slice(1)];
  return team;
}

function makeStar(id: string): Player {
  return makePlayer(id, "Entry", 92, "star", "Star Real", "RU");
}

function makePlayer(id: string, role: Role, ovr: number, handle = id, realName = id, country = "US"): Player {
  const maps = mapPool.reduce((acc, map) => ((acc[map.id] = ovr), acc), {} as Record<MapId, number>);
  return {
    id,
    handle,
    realName,
    country,
    role,
    style: "Balanced",
    traits: [role],
    stats: { aim: ovr, clutch: ovr, consistency: ovr, awp: role === "AWP" ? 90 : 55, igl: role === "IGL" ? 90 : 55 },
    ovr,
    source: { tag: "TST", name: `${id}-src`, country: "US", era: "CS2", year: "2026", accent: "#ffffff" },
    maps,
  };
}
