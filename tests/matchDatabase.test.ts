import { test } from "node:test";
import assert from "node:assert/strict";

import { initMatch, playRound, recalculateHltvStyleRating, type FieldTeam, type PlayerLine } from "../src/sim";
import { MatchDatabase, memoryStorage, teamRef, type RecordMatchInput, type StorageAdapter } from "../src/matchDatabase";
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

  const version = db.getMatch("r1")!.players.find((ref) => ref.handle === "star")!.versionKey;
  const career = db.playerCareer(version)!;

  assert.equal(career.matches, 2);
  assert.equal(career.teamIds.length, 2); // appeared for two teams

  // The career line must equal a manual per-map aggregation of the stored stats — same data, same
  // rating formula — so the all-time vault agrees with the player card and "career this run" panels.
  const expected = emptyLine();
  ["r1", "r2"].forEach((id) => {
    const match = db.getMatch(id)!;
    const ref = match.players.find((entry) => entry.versionKey === version)!;
    addLine(expected, match.box[ref.id]);
  });
  assert.equal(career.line.kills, expected.kills);
  assert.equal(career.line.deaths, expected.deaths);
  assert.equal(career.line.rounds, expected.rounds);
  assert.equal(career.line.adr, expected.adr);
  assert.equal(career.line.rating, expected.rating);
});

test("MatchDatabase: keeps different eras of the same player separate (FalleN 2018 vs 2026)", () => {
  const db = new MatchDatabase(memoryStorage());
  const classic = teamWithStarYear("navi-2018", "navi-2018-star", "2018");
  const modern = teamWithStarYear("navi-2026", "navi-2026-star", "2026");
  db.recordMatch(matchInput("c1", "2026-06-01T00:00:00Z", classic, makeTeam("oppA", 80), 3));
  db.recordMatch(matchInput("m1", "2026-06-02T00:00:00Z", modern, makeTeam("oppB", 80), 4));

  // Same handle/realName/country, but the two eras are distinct registry entries.
  const stars = db.listPlayers().filter((p) => p.handle === "star");
  assert.equal(stars.length, 2, "the 2018 and 2026 versions should be two separate records");
  assert.deepEqual([...new Set(stars.map((p) => p.year))].sort(), ["2018", "2026"]);

  const v2018 = db.getMatch("c1")!.players.find((r) => r.handle === "star")!.versionKey;
  const v2026 = db.getMatch("m1")!.players.find((r) => r.handle === "star")!.versionKey;
  assert.notEqual(v2018, v2026);
  assert.equal(db.playerCareer(v2018)!.matches, 1); // not merged with the 2026 self
  assert.equal(db.playerCareer(v2026)!.matches, 1);
});

function teamWithStarYear(id: string, starId: string, year: string): FieldTeam {
  const team = makeTeam(id, 84);
  team.players = [makeStar(starId, year), ...team.players.slice(1)];
  return team;
}

function emptyLine(): PlayerLine {
  return { kills: 0, deaths: 0, assists: 0, damage: 0, adr: 0, kastRounds: 0, rounds: 0, impact: 0, firstKills: 0, firstDeaths: 0, multiKills: 0, clutchWins: 0, rating: 1 };
}

function addLine(target: PlayerLine, incoming: PlayerLine) {
  target.kills += incoming.kills;
  target.deaths += incoming.deaths;
  target.assists += incoming.assists;
  target.damage += incoming.damage;
  target.kastRounds += incoming.kastRounds;
  target.rounds += incoming.rounds;
  target.firstKills += incoming.firstKills;
  target.firstDeaths += incoming.firstDeaths;
  target.multiKills += incoming.multiKills;
  target.clutchWins += incoming.clutchWins;
  recalculateHltvStyleRating(target);
}

test("MatchDatabase: clear empties both the registry and the log store", () => {
  const db = new MatchDatabase(memoryStorage());
  db.recordMatch(matchInput("x", "2026-06-01T00:00:00Z", makeTeam("you", 84), makeTeam("opp", 84), 5, { keepLog: true }));
  assert.equal(db.count(), 1);
  assert.equal(db.eventLogIds().size, 1);
  db.clear();
  assert.equal(db.count(), 0);
  assert.equal(db.eventLogIds().size, 0);
});

test("MatchDatabase: event logs live in a separate store, not the registry blob", () => {
  const storage = memoryStorage();
  const db = new MatchDatabase(storage);
  db.recordMatch(matchInput("m1", "2026-06-01T00:00:00Z", makeTeam("you", 84), makeTeam("opp", 84), 5, { keepLog: true }));

  const registryRaw = storage.getItem("cssim-match-db-v1")!;
  assert.ok(!registryRaw.includes('"events"'), "the large event log must not be embedded in the registry blob");
  assert.equal(db.getMatch("m1")!.eventLog, undefined);
  assert.ok(db.hasEventLog("m1"));
  assert.equal(db.getEventLog("m1")!.map, "inferno");
});

test("MatchDatabase: the log store is ring-buffered to its cap while box scores persist", () => {
  const db = new MatchDatabase(memoryStorage());
  for (let i = 0; i < 45; i += 1) {
    db.recordMatch(miniLoggedInput(`log-${String(i).padStart(2, "0")}`));
  }
  assert.equal(db.eventLogIds().size, 40); // capped
  assert.equal(db.getEventLog("log-00"), undefined); // oldest evicted
  assert.ok(db.getEventLog("log-44")); // newest kept
  assert.equal(db.count(), 45); // every box score persisted (well under MAX_MATCHES)
});

test("MatchDatabase: a log-store quota failure never aborts the box-score write", () => {
  const base = memoryStorage();
  const storage: StorageAdapter = {
    getItem: (k) => base.getItem(k),
    removeItem: (k) => base.removeItem(k),
    setItem: (k, v) => {
      if (k === "cssim-match-logs-v1") throw new Error("QuotaExceededError");
      base.setItem(k, v);
    },
  };
  const db = new MatchDatabase(storage);
  db.recordMatch(matchInput("q1", "2026-06-01T00:00:00Z", makeTeam("you", 84), makeTeam("opp", 84), 5, { keepLog: true }));
  assert.ok(db.getMatch("q1"), "box score must still persist");
  assert.equal(db.getEventLog("q1"), undefined, "the log was dropped silently");
});

test("MatchDatabase: teamProfile aggregates record, roster, head-to-head, per-map and history", () => {
  const db = new MatchDatabase(memoryStorage());
  const you = makeTeam("you", 88);
  const oppA = makeTeam("oppA", 78);
  const oppB = makeTeam("oppB", 80);
  db.recordMatch(matchInput("t1", "2026-06-01T00:00:00Z", you, oppA, 1, { map: "inferno" }));
  db.recordMatch(matchInput("t2", "2026-06-02T00:00:00Z", you, oppB, 2, { map: "nuke" }));
  db.recordMatch(matchInput("t3", "2026-06-03T00:00:00Z", you, oppA, 3, { map: "mirage", keepLog: true }));

  const profile = db.teamProfile("you")!;
  assert.equal(profile.matches, 3);
  assert.equal(profile.wins + profile.losses, 3);
  assert.equal(profile.roster.length, 5); // the five players who turned out
  assert.ok(profile.roster.every((row) => row.maps === 3));
  assert.ok(profile.roster.every((row, i, arr) => i === 0 || arr[i - 1].line.rating >= row.line.rating)); // best first

  const vsA = profile.headToHead.find((row) => row.team.id === "oppA")!;
  assert.equal(vsA.wins + vsA.losses, 2);
  assert.deepEqual(profile.byMap.map((row) => row.map).sort(), ["inferno", "mirage", "nuke"]);

  assert.equal(profile.history.length, 3);
  assert.equal(profile.history[0].matchId, "t3"); // newest first
  assert.equal(profile.history[0].opponent.id, "oppA");
  assert.ok(profile.streak && profile.streak.count >= 1);

  assert.equal(db.teamProfile("nope"), undefined);
});

test("MatchDatabase: recordMany commits a batch in one pass, dedupes within it, and keeps logs", () => {
  const db = new MatchDatabase(memoryStorage());
  const you = makeTeam("you", 84);
  const opp = makeTeam("opp", 84);
  db.recordMany([
    matchInput("b1", "2026-06-01T00:00:00Z", you, opp, 1),
    matchInput("b2", "2026-06-02T00:00:00Z", you, opp, 2, { keepLog: true }),
    matchInput("b1", "2026-06-03T00:00:00Z", you, opp, 3), // same id later in the batch -> last wins, no dup
  ]);
  assert.equal(db.count(), 2);
  assert.ok(db.getEventLog("b2"));
});

test("MatchDatabase: map filter narrows a career to one map", () => {
  const db = new MatchDatabase(memoryStorage());
  const you = makeTeam("you", 86);
  const opp = makeTeam("opp", 80);
  db.recordMatch(matchInput("inf", "2026-06-01T00:00:00Z", you, opp, 3, { map: "inferno" }));
  db.recordMatch(matchInput("nuk", "2026-06-02T00:00:00Z", you, opp, 4, { map: "nuke" }));
  const v = db.getMatch("inf")!.players.find((r) => r.id === you.players[0].id)!.versionKey;

  assert.equal(db.playerCareer(v)!.matches, 2);
  assert.equal(db.playerCareer(v, { map: "inferno" })!.matches, 1);
  assert.equal(db.playerCareer(v, { map: "nuke" })!.matches, 1);
});

test("MatchDatabase: side filter sums only the requested side and skips legacy records", () => {
  const storage = memoryStorage();
  const db = new MatchDatabase(storage);
  const you = makeTeam("you", 84);
  const opp = makeTeam("opp", 84);
  const input = matchInput("s1", "2026-06-01T00:00:00Z", you, opp, 7);
  db.recordMatch(input);
  const ref = db.getMatch("s1")!.players.find((r) => r.id === you.players[0].id)!;

  const ct = db.playerCareer(ref.versionKey, { side: "CT" })!;
  const t = db.playerCareer(ref.versionKey, { side: "T" })!;
  // The CT/T splits partition the combined box exactly (the sim accrues each kill into both).
  assert.equal(ct.line.kills, input.sideStats!.CT[ref.id].kills);
  assert.equal(ct.line.kills + t.line.kills, db.getMatch("s1")!.box[ref.id].kills);

  // Now add a LEGACY record (no sideBox) for the same player version and confirm side queries skip it.
  const legacy = matchInput("s2", "2026-06-02T00:00:00Z", you, opp, 9);
  delete legacy.sideStats;
  db.recordMatch(legacy);
  assert.equal(db.playerCareer(ref.versionKey)!.matches, 2, "combined career counts both");
  assert.equal(db.playerCareer(ref.versionKey, { side: "CT" })!.matches, 1, "CT query skips the legacy record");
});

test("MatchDatabase: v1 records still parse and only contribute to combined (not side) queries", () => {
  const storage = memoryStorage();
  const seed = new MatchDatabase(storage);
  const you = makeTeam("you", 84);
  const opp = makeTeam("opp", 84);
  seed.recordMatch(matchInput("v1", "2026-06-01T00:00:00Z", you, opp, 3));
  // Rewrite the blob to look like a pre-sideBox v1 record.
  const raw = JSON.parse(storage.getItem("cssim-match-db-v1")!);
  raw.schemaVersion = 1;
  raw.matches.forEach((m: { sideBox?: unknown }) => delete m.sideBox);
  storage.setItem("cssim-match-db-v1", JSON.stringify(raw));

  const db = new MatchDatabase(storage);
  assert.ok(db.listPlayers().length > 0, "combined registry still aggregates");
  assert.equal(db.listPlayers({ side: "CT" }).length, 0, "side queries exclude split-less legacy records");
});

function miniLoggedInput(id: string): RecordMatchInput {
  const you = makeTeam("you", 80);
  const opp = makeTeam("opp", 80);
  const stats: Record<string, PlayerLine> = {};
  [...you.players, ...opp.players].forEach((p) => (stats[p.id] = emptyLine()));
  return {
    id,
    recordedAt: "2026-06-01T00:00:00Z",
    map: "inferno",
    left: { team: teamRef(you), players: you.players },
    right: { team: teamRef(opp), players: opp.players },
    leftScore: 13,
    rightScore: 5,
    winnerId: you.id,
    stats,
    eventLog: { schemaVersion: 1, map: "inferno", events: [] },
    keepEventLog: true,
  };
}

function matchInput(
  id: string,
  recordedAt: string,
  left: FieldTeam,
  right: FieldTeam,
  seed: number,
  opts: { map?: MapId; keepLog?: boolean } = {},
): RecordMatchInput {
  const map = opts.map ?? "inferno";
  const state = playMatch(seed, left, right, map);
  return {
    id,
    recordedAt,
    map,
    left: { team: teamRef(left), players: left.players },
    right: { team: teamRef(right), players: right.players },
    leftScore: state.you,
    rightScore: state.opponent,
    winnerId: state.winner === "you" ? left.id : right.id,
    stats: { ...state.yourStats, ...state.opponentStats },
    sideStats: {
      CT: { ...state.yourSideStats.CT, ...state.opponentSideStats.CT },
      T: { ...state.yourSideStats.T, ...state.opponentSideStats.T },
    },
    eventLog: opts.keepLog ? { schemaVersion: 1, map, events: [] } : undefined,
    keepEventLog: opts.keepLog,
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

// A star with a FIXED source (team name + year) so two instances on different teams share one
// player version — unless `year` differs, which makes them distinct eras.
function makeStar(id: string, year = "2026"): Player {
  return makePlayer(id, "Entry", 92, "star", "Star Real", "RU", "Spirit", year);
}

function makePlayer(
  id: string,
  role: Role,
  ovr: number,
  handle = id,
  realName = id,
  country = "US",
  sourceName = `${id}-src`,
  year = "2026",
): Player {
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
    source: { tag: "TST", name: sourceName, country: "US", era: "CS2", year, accent: "#ffffff" },
    maps,
  };
}
