import assert from "node:assert/strict";
import { test } from "node:test";

import {
  advanceCircuit,
  circuitEventById,
  circuitFieldLabel,
  circuitPointsAward,
  circuitPrize,
  circuitQualificationLabel,
  circuitWorldRank,
  isCircuitEligible,
  pickCircuitRosters,
  qualifiesForNextEvent,
} from "../src/circuit";
import type { Roster } from "../src/gameData";

function roster(id: string, rank?: number): Roster {
  return { id, rank } as Roster;
}

test("Open Cup only selects lower-ranked and unranked teams when the pool can fill it", () => {
  const event = circuitEventById("open-cup");
  const pool = Array.from({ length: 24 }, (_, index) => roster(`team-${index + 1}`, index + 1));
  pool.push(roster("custom-unranked"));
  const field = pickCircuitRosters(pool, event, 16, () => 0.42);
  assert.equal(field.length, 16);
  assert.ok(field.every((team) => isCircuitEligible(team, event)));
  assert.ok(field.every((team) => team.rank == null || team.rank >= 6));
  assert.equal(circuitFieldLabel(event), "HLTV #6+ and unranked");
  assert.equal(circuitQualificationLabel(event), "Top 8 to advance");
});

test("Circuit qualification advances on the required finish and repeats after an early exit", () => {
  const open = circuitEventById("open-cup");
  assert.equal(qualifiesForNextEvent(open, "top8"), true);
  assert.equal(qualifiesForNextEvent(open, "swiss"), false);

  const promoted = advanceCircuit("open-cup", "top8", 1, 0);
  assert.equal(promoted.nextEventId, "challenger");
  assert.equal(promoted.qualified, true);

  const repeat = advanceCircuit("open-cup", "swiss", 1, 0);
  assert.equal(repeat.nextEventId, "open-cup");
  assert.equal(repeat.qualified, false);
  assert.ok(repeat.points > 0, "an early exit still earns some ranking progress");
});

test("Regional Finals require top four while the qualifier awards a Major place at top eight", () => {
  assert.equal(qualifiesForNextEvent(circuitEventById("regional"), "top8"), false);
  assert.equal(qualifiesForNextEvent(circuitEventById("regional"), "top4"), true);
  assert.equal(advanceCircuit("major-qualifier", "top8", 1, 120).nextEventId, "major");
});

test("Major completion starts a new season with seeding based on the finish", () => {
  const deepRun = advanceCircuit("major", "top4", 2, 300);
  assert.equal(deepRun.season, 3);
  assert.equal(deepRun.nextEventId, "major-qualifier");
  assert.equal(deepRun.seasonComplete, true);
  assert.ok(deepRun.points < 300 + deepRun.pointsEarned, "off-season decay is applied");

  const swissExit = advanceCircuit("major", "swiss", 1, 180);
  assert.equal(swissExit.nextEventId, "challenger");
});

test("Higher-tier events award more points and prize money", () => {
  const open = circuitEventById("open-cup");
  const major = circuitEventById("major");
  assert.ok(circuitPointsAward(major, "top4") > circuitPointsAward(open, "top4"));
  assert.ok(circuitPrize(major, "champion") > circuitPrize(open, "champion"));
  assert.ok(circuitWorldRank(180) < circuitWorldRank(20));
});
