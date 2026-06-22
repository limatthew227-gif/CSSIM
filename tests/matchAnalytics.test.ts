import { test } from "node:test";
import assert from "node:assert/strict";

import { eventLogFromFeed } from "../src/matchEvents";
import { analyzeEventLog, analyzeEventLogs, matchInsightLeaders } from "../src/matchAnalytics";
import type { FeedLine } from "../src/sim";

// L1 single-handedly turns a 1v4 into an ace clutch, trading two teammate deaths on the way.
test("match analytics: derives aces, clutches, trades, openings, and headshot rate from one round", () => {
  const log = eventLogFromFeed("mirage", [
    start(1),
    kill(1, { killer: "R1", victim: "L2", first: true }), // opening duel: R1 over L2
    kill(1, { killer: "R1", victim: "L3" }),
    kill(1, { killer: "L1", victim: "R1" }), // trades L3's death
    kill(1, { killer: "R2", victim: "L4" }),
    kill(1, { killer: "R2", victim: "L5" }), // L1 is now alone vs 4
    kill(1, { killer: "L1", victim: "R2", headshot: true }), // trades L5's death
    kill(1, { killer: "L1", victim: "R3", headshot: true }),
    kill(1, { killer: "L1", victim: "R4" }),
    kill(1, { killer: "L1", victim: "R5" }),
    over(1, "you"),
  ]);

  const a = analyzeEventLog(log);
  const L1 = a.byId["L1"];

  assert.equal(a.rounds, 1);
  assert.equal(L1.kills, 5);
  assert.equal(L1.deaths, 0);
  assert.equal(L1.aces, 1);
  assert.equal(L1.multiKills.k5, 1);
  assert.equal(L1.multiKillRounds, 1);

  assert.equal(L1.clutches.won, 1);
  assert.equal(L1.clutchesByType[4].won, 1);

  assert.equal(L1.tradeKills, 2);
  assert.equal(a.byId["L3"].tradedDeaths, 1);
  assert.equal(a.byId["L5"].tradedDeaths, 1);

  assert.equal(L1.headshotKills, 2);
  assert.equal(L1.headshotPct, 0.4);

  assert.equal(a.byId["R1"].openingKills, 1);
  assert.equal(a.byId["L2"].openingDeaths, 1);
  assert.equal(a.byId["L2"].openingWinRate, 0);
});

// A lone survivor that fails to win is a clutch LOST, bucketed by the enemies that were alive.
test("match analytics: counts a failed 1v2 as a clutch lost", () => {
  const log = eventLogFromFeed("inferno", [
    start(1),
    kill(1, { killer: "L1", victim: "R1" }),
    kill(1, { killer: "L1", victim: "R2" }),
    kill(1, { killer: "L1", victim: "R3" }), // right down to R4, R5
    kill(1, { killer: "R4", victim: "L2" }),
    kill(1, { killer: "R4", victim: "L3" }),
    kill(1, { killer: "R5", victim: "L4" }),
    kill(1, { killer: "R4", victim: "L5" }), // L1 alone vs 2
    kill(1, { killer: "R4", victim: "L1" }),
    over(1, "opponent"),
  ]);

  const L1 = analyzeEventLog(log).byId["L1"];
  assert.equal(L1.clutches.won, 0);
  assert.equal(L1.clutches.lost, 1);
  assert.equal(L1.clutchesByType[2].lost, 1);
  assert.equal(L1.multiKills.k3, 1); // the three early picks
});

// A BO-style merge sums per-player aggregates and round counts across maps.
test("match analytics: merges multiple maps for a series view", () => {
  const map1 = eventLogFromFeed("mirage", [
    start(1),
    kill(1, { killer: "L1", victim: "R1", first: true }),
    over(1, "you"),
  ]);
  const map2 = eventLogFromFeed("nuke", [
    start(1),
    kill(1, { killer: "L1", victim: "R2", first: true }),
    kill(1, { killer: "L1", victim: "R3" }),
    over(1, "you"),
  ]);

  const a = analyzeEventLogs([map1, map2]);
  assert.equal(a.rounds, 2);
  assert.deepEqual(a.maps, ["mirage", "nuke"]);
  assert.equal(a.byId["L1"].kills, 3);
  assert.equal(a.byId["L1"].openingKills, 2);
  assert.equal(a.byId["L1"].openingWinRate, 1);
  assert.equal(a.byId["L1"].multiKills.k2, 1); // the 2K only happened on map2
});

test("match analytics: surfaces highlight leaders only for categories with a real leader", () => {
  const log = eventLogFromFeed("mirage", [
    start(1),
    kill(1, { killer: "L1", victim: "R1", first: true }),
    kill(1, { killer: "L1", victim: "R2" }),
    over(1, "you"),
  ]);

  const leaders = matchInsightLeaders(analyzeEventLog(log));
  const keys = leaders.map((leader) => leader.key);
  assert.ok(keys.includes("opening"));
  assert.ok(keys.includes("multikill"));
  // Nobody clutched or traded here, so those cards are omitted entirely.
  assert.ok(!keys.includes("clutch"));
  assert.ok(!keys.includes("trade"));
});

function start(round: number): FeedLine {
  return base({ round, type: "round_start", team: "neutral" });
}

function over(round: number, winner: "you" | "opponent"): FeedLine {
  return base({ round, type: "round_over", team: winner, reason: "Round over" });
}

// Side is inferred from the player-name prefix: "L*" are on your team, "R*" the opponent.
function kill(
  round: number,
  opts: { killer: string; victim: string; first?: boolean; headshot?: boolean },
): FeedLine {
  return base({
    round,
    type: "kill",
    team: opts.killer.startsWith("L") ? "you" : "opponent",
    killer: opts.killer,
    killerId: opts.killer,
    victim: opts.victim,
    victimId: opts.victim,
    weapon: "AK-47",
    first: !!opts.first,
    isHeadshot: !!opts.headshot,
  });
}

function base(line: Partial<FeedLine>): FeedLine {
  return {
    round: 1,
    killer: "",
    killerId: "",
    victim: "",
    victimId: "",
    weapon: "",
    team: "neutral",
    first: false,
    ...line,
  };
}
