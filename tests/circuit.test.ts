import assert from "node:assert/strict";
import { test } from "node:test";

import {
  advanceCircuit,
  circuitEventById,
  circuitFieldLabel,
  circuitParticipantIds,
  circuitPointsAward,
  circuitPrize,
  circuitQualificationLabel,
  circuitWorldRank,
  composeCircuitField,
  isCircuitEligible,
  normalizeCircuitEventId,
  pickCircuitDirectInvites,
  pickCircuitRosters,
  qualifiesForNextEvent,
  rankRostersByVrs,
} from "../src/circuit";
import type { Roster } from "../src/gameData";

function roster(id: string, rank?: number): Roster {
  return { id, rank } as Roster;
}

test("MRQ only selects rank 27+ and unranked teams when the pool can fill it", () => {
  const event = circuitEventById("mrq");
  const pool = Array.from({ length: 50 }, (_, index) => roster(`team-${index + 1}`, index + 1));
  pool.push(roster("custom-unranked"));
  const field = pickCircuitRosters(pool, event, 16, () => 0.42);
  assert.equal(field.length, 16);
  assert.ok(field.every((team) => isCircuitEligible(team, event)));
  assert.ok(field.every((team) => team.rank == null || team.rank >= 27));
  assert.equal(circuitFieldLabel(event), "VRS #27+ and unranked");
  assert.equal(circuitQualificationLabel(event), "Top 8 to Stage 1");
});

test("direct invites never recycle a team from any earlier Major stage", () => {
  const event = circuitEventById("stage-2");
  const pool = Array.from({ length: 60 }, (_, index) => roster(`team-${index + 1}`, index + 1));
  const mrqField = [roster("team-29", 29), roster("team-30", 30), roster("team-35", 35)];
  const stageOneField = [roster("team-17", 17), roster("team-18", 18), mrqField[0]];
  const priorParticipants = circuitParticipantIds(mrqField, stageOneField);
  const invites = pickCircuitRosters(pool, event, 8, () => 0.42, priorParticipants);

  assert.equal(invites.length, 8);
  assert.ok(invites.every((team) => !priorParticipants.has(team.id)));
  assert.ok(!invites.some((team) => team.id === "team-30"), "an MRQ elimination cannot return at Stage 2");
});

test("Major direct invites are always accepted in VRS order", () => {
  const event = circuitEventById("stage-3");
  const pool = Array.from({ length: 30 }, (_, index) => ({
    ...roster(`team-${index + 1}`, index + 1),
    vrsPoints: 2_000 - index * 20,
  }));
  const invites = pickCircuitDirectInvites(pool, event, 8, ["team-3"]);

  assert.deepEqual(
    invites.map((team) => team.id),
    ["team-1", "team-2", "team-4", "team-5", "team-6", "team-7", "team-8", "team-9"],
  );
});

test("the next stage preserves qualifiers before filling direct-invite slots", () => {
  const qualifiers = Array.from({ length: 8 }, (_, index) => roster(`qualified-${index + 1}`, 40 + index));
  const invites = Array.from({ length: 10 }, (_, index) => roster(`invite-${index + 1}`, index + 1));
  const field = composeCircuitField(qualifiers, [qualifiers[0], ...invites], 16);

  assert.deepEqual(field.slice(0, 8).map((team) => team.id), qualifiers.map((team) => team.id));
  assert.equal(field.length, 16);
  assert.equal(new Set(field.map((team) => team.id)).size, 16);
});

test("Circuit qualification advances on the required finish and repeats after an early exit", () => {
  const mrq = circuitEventById("mrq");
  assert.equal(qualifiesForNextEvent(mrq, "top8"), true);
  assert.equal(qualifiesForNextEvent(mrq, "swiss"), false);

  const promoted = advanceCircuit("mrq", "top8", 1, 0);
  assert.equal(promoted.nextEventId, "stage-1");
  assert.equal(promoted.qualified, true);

  const repeat = advanceCircuit("mrq", "swiss", 1, 0);
  assert.equal(repeat.nextEventId, "mrq");
  assert.equal(repeat.qualified, false);
  assert.ok(repeat.points > 0, "an early exit still earns some ranking progress");
});

test("Stage 1 and Stage 2 feed the next Swiss stage; only Stage 3 has playoffs", () => {
  const stage1 = circuitEventById("stage-1");
  const stage2 = circuitEventById("stage-2");
  const stage3 = circuitEventById("stage-3");
  assert.equal(stage1.hasPlayoffs, false);
  assert.equal(stage2.hasPlayoffs, false);
  assert.equal(stage3.hasPlayoffs, true);
  assert.equal(advanceCircuit("stage-1", "top8", 1, 60).nextEventId, "stage-2");
  assert.equal(advanceCircuit("stage-2", "top8", 1, 120).nextEventId, "stage-3");
  assert.equal(circuitQualificationLabel(stage3), "Top 8 to playoffs");
});

test("Stage 3 completion starts a new season with seeding based on the finish", () => {
  const deepRun = advanceCircuit("stage-3", "top4", 2, 300);
  assert.equal(deepRun.season, 3);
  assert.equal(deepRun.nextEventId, "stage-3");
  assert.equal(deepRun.seasonComplete, true);
  assert.ok(deepRun.points < 300 + deepRun.pointsEarned, "off-season decay is applied");

  const swissExit = advanceCircuit("stage-3", "swiss", 1, 180);
  assert.equal(swissExit.nextEventId, "stage-1");
  assert.equal(swissExit.qualified, false);
});

test("legacy Circuit save IDs migrate into the Austin path", () => {
  assert.equal(normalizeCircuitEventId("open-cup"), "mrq");
  assert.equal(normalizeCircuitEventId("challenger"), "stage-1");
  assert.equal(normalizeCircuitEventId("regional"), "stage-2");
  assert.equal(normalizeCircuitEventId("major-qualifier"), "stage-3");
  assert.equal(normalizeCircuitEventId("major"), "stage-3");
});

test("Higher-tier events award more points and prize money", () => {
  const mrq = circuitEventById("mrq");
  const stage3 = circuitEventById("stage-3");
  assert.ok(circuitPointsAward(stage3, "top4") > circuitPointsAward(mrq, "top4"));
  assert.ok(circuitPrize(stage3, "champion") > circuitPrize(mrq, "champion"));
  assert.ok(circuitWorldRank(180) < circuitWorldRank(20));
});

test("mixed-era VRS points produce one unique ranking table", () => {
  const ranked = rankRostersByVrs([
    { ...roster("current-one", 1), vrsPoints: 991 },
    { ...roster("historical-one", 1), vrsPoints: 930 },
    { ...roster("current-two", 2), vrsPoints: 712 },
    { ...roster("historical-two", 2), vrsPoints: 850 },
  ]);

  assert.deepEqual(
    ranked.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((team) => [team.id, team.rank]),
    [
      ["current-one", 1],
      ["historical-one", 2],
      ["historical-two", 3],
      ["current-two", 4],
    ],
  );
  assert.equal(new Set(ranked.map((team) => team.rank)).size, ranked.length);
});

test("the user team is ranked against the same VRS point table", () => {
  const field = rankRostersByVrs([
    { ...roster("one", 1), vrsPoints: 900 },
    { ...roster("two", 2), vrsPoints: 500 },
    { ...roster("three", 3), vrsPoints: 100 },
  ]);

  assert.equal(circuitWorldRank(950, field), 1);
  assert.equal(circuitWorldRank(700, field), 2);
  assert.equal(circuitWorldRank(100, field), 4, "equal points still receive a unique deterministic rank");
});
