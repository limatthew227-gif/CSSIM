import assert from "node:assert/strict";
import test from "node:test";
import {
  appendVrsEvent,
  calculateVrs,
  createVrsProfile,
  vrsAgeWeight,
  vrsBountyCurve,
  vrsPointsForRank,
  vrsRankForPoints,
  type VrsEventEvidence,
} from "../src/vrs";

function event(opponentPoints: number): VrsEventEvidence {
  return {
    id: `major-${opponentPoints}`,
    eventId: "major",
    eventName: "Major",
    completedOn: "2026-07-20",
    prizePool: 1_250_000,
    prizeWon: 500_000,
    lan: true,
    prestige: 1,
    matches: Array.from({ length: 5 }, (_, index) => ({
      id: `match-${opponentPoints}-${index}`,
      opponentId: `opponent-${index}`,
      opponentName: `Opponent ${index}`,
      opponentPoints,
      won: true,
    })),
  };
}

test("VRS uses the current six-month linear age window", () => {
  assert.equal(vrsAgeWeight("2026-07-20", "2026-07-20"), 1);
  assert.equal(vrsAgeWeight("2026-07-20", "2026-10-18"), 0.5);
  assert.equal(vrsAgeWeight("2026-07-20", "2027-01-16"), 0);
});

test("VRS bounty curve and rank scale match the published model shape", () => {
  assert.equal(vrsBountyCurve(1), 1);
  assert.equal(vrsBountyCurve(0), 0);
  assert.equal(vrsPointsForRank(1), 2_000);
  assert.equal(vrsPointsForRank(64), 400);
  assert.equal(vrsRankForPoints(2_000), 1);
  assert.equal(vrsRankForPoints(400), 64);
});

test("an inherited snapshot decays instead of remaining permanent", () => {
  const profile = createVrsProfile("2026-07-20", 16);
  const fresh = calculateVrs(profile, "2026-07-20");
  const halfway = calculateVrs(profile, "2026-10-18");
  const expired = calculateVrs(profile, "2027-01-16");
  assert.ok(fresh.points > halfway.points);
  assert.ok(halfway.points > expired.points);
  assert.equal(expired.points, 400);
});

test("recent LAN wins and prize bounty replenish all four seed factors", () => {
  const baseline = createVrsProfile("2026-07-20", 32);
  const before = calculateVrs(baseline, "2026-07-20");
  const after = calculateVrs(appendVrsEvent(baseline, event(1_600)), "2026-07-20");
  assert.ok(after.points > before.points);
  assert.ok(after.bountyOffered > before.bountyOffered);
  assert.ok(after.bountyCollected > before.bountyCollected);
  assert.ok(after.opponentNetwork > before.opponentNetwork);
  assert.ok(after.lanWins > before.lanWins);
  assert.equal(after.activeEvents, 1);
  assert.equal(after.activeMatches, 5);
});

test("defeating a stronger opponent is worth more than defeating a weak one", () => {
  const profile = createVrsProfile("2026-07-20", 32);
  const weak = calculateVrs(appendVrsEvent(profile, event(600)), "2026-07-20");
  const strong = calculateVrs(appendVrsEvent(profile, event(1_900)), "2026-07-20");
  assert.ok(strong.bountyCollected > weak.bountyCollected);
  assert.ok(strong.headToHead > weak.headToHead);
  assert.ok(strong.points > weak.points);
});

test("a 1-6 tournament record cannot increase VRS", () => {
  const profile = createVrsProfile("2026-07-20", 24);
  const losingEvent: VrsEventEvidence = {
    ...event(1_750),
    id: "one-and-six",
    prizeWon: 50_000,
    matches: Array.from({ length: 7 }, (_, index) => ({
      id: `one-and-six-${index}`,
      opponentId: `top-opponent-${index}`,
      opponentName: `Top opponent ${index}`,
      opponentPoints: 1_750,
      won: index === 0,
    })),
  };
  const before = calculateVrs(profile, "2026-07-20");
  const after = calculateVrs(appendVrsEvent(profile, losingEvent), "2026-07-20");
  assert.ok(after.points < before.points);
  assert.ok(after.headToHead < 0);
  assert.equal(after.activeMatches, 7);
});

test("expired event evidence leaves the active ranking window", () => {
  const profile = appendVrsEvent(createVrsProfile("2026-07-20", 32), event(1_600));
  const expired = calculateVrs(profile, "2027-01-16");
  assert.equal(expired.activeEvents, 0);
  assert.equal(expired.activeMatches, 0);
  assert.equal(expired.points, 400);
});
