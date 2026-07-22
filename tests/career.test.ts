import { test } from "node:test";
import assert from "node:assert/strict";

import {
  POTENTIAL_MODEL_VERSION,
  ageAfterMajor,
  careerMetaForPlayer,
  developPlayer,
  expectedRating,
  pickTransferCandidates,
  placementLabel,
  placementTier,
  playerValue,
  prizeForPlacement,
  rollCareerMeta,
  transferDelta,
} from "../src/career";
import type { Player, PlayerStats } from "../src/gameData";
import type { Role } from "../src/gameData";

// Minimal fixtures — the career math only reads ovr/role/id/handle/stats.
const baseStats: PlayerStats = { aim: 80, clutch: 80, consistency: 80, awp: 60, igl: 60 };
function mk(id: string, role: Role, ovr: number, handle = id): Player {
  return { id, handle, role, ovr, stats: { ...baseStats } } as Player;
}

// A deterministic rng cycling through given values (for candidate-pick tests).
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

test("playerValue is convex in OVR (each tier up is worth more than the last)", () => {
  const v70 = playerValue(mk("a", "Rifler", 70));
  const v80 = playerValue(mk("b", "Rifler", 80));
  const v90 = playerValue(mk("c", "Rifler", 90));
  assert.ok(v70 < v80 && v80 < v90, "monotonic in OVR");
  assert.ok(v90 - v80 > v80 - v70, "convex — upgrades near the top cost more");
});

test("a young proven superstar commands a multi-million transfer value", () => {
  const superstar = { ...mk("superstar", "Entry", 99), age: 19, potential: 99, hltvRating: 1.45 };
  assert.ok(playerValue(superstar) >= 2_000_000);
  assert.ok(playerValue(superstar) > playerValue(mk("elite", "Entry", 90)) * 2.5);
});

test("transferDelta is signed: pay for an upgrade, bank the surplus on a downgrade", () => {
  const star = mk("star", "AWP", 90);
  const role = mk("role", "AWP", 75);
  assert.ok(transferDelta(star, role) > 0, "buying a better player costs money");
  assert.ok(transferDelta(role, star) < 0, "selling a better player refunds money");
  assert.equal(transferDelta(star, mk("star2", "AWP", 90)), 0, "even swap is free");
});

test("prizeForPlacement tiers are strictly ordered", () => {
  const tiers = ["champion", "runner-up", "top4", "top8", "swiss"] as const;
  const prizes = tiers.map((tier) => prizeForPlacement(tier));
  for (let i = 1; i < prizes.length; i++) {
    assert.ok(prizes[i - 1] > prizes[i], `${tiers[i - 1]} pays more than ${tiers[i]}`);
  }
});

test("placementTier maps run end-state to a finish", () => {
  assert.equal(placementTier({ champion: true, reachedPlayoffs: true, playoffRound: "final" }), "champion");
  assert.equal(placementTier({ champion: false, reachedPlayoffs: true, playoffRound: "final" }), "runner-up");
  assert.equal(placementTier({ champion: false, reachedPlayoffs: true, playoffRound: "semifinal" }), "top4");
  assert.equal(placementTier({ champion: false, reachedPlayoffs: true, playoffRound: "quarterfinal" }), "top8");
  assert.equal(placementTier({ champion: false, reachedPlayoffs: false, playoffRound: "quarterfinal" }), "swiss");
  assert.equal(placementLabel("swiss", { wins: 2, losses: 3 }), "Swiss exit (2-3)");
});

test("rollCareerMeta: younger players get more headroom toward a higher potential", () => {
  const young = rollCareerMeta(80, undefined, () => 0); // age 18 -> +8
  const old = rollCareerMeta(80, undefined, () => 0.99); // age ~32 -> +0
  assert.ok(young.age < old.age);
  assert.ok(young.potential > old.potential);
  assert.equal(old.potential, 80, "a veteran is at his ceiling");
  assert.ok(rollCareerMeta(95, undefined, () => 0).potential <= 96, "global cap respected");
  // A known (real) age is used verbatim rather than randomised.
  assert.equal(rollCareerMeta(82, 19).age, 19);
  assert.equal(rollCareerMeta(82, 19).potential, 89); // 19 -> +7
  assert.equal(rollCareerMeta(82, 31).potential, 82); // veteran -> no headroom
  assert.equal(rollCareerMeta(80, 18, () => 0, 3).potential, 91, "a top 18-year-old prospect can grow from 80 to 91");
});

test("careerMetaForPlayer migrates legacy ceilings once without compounding them", () => {
  const legacy = { ...mk("prospect", "Rifler", 82), age: 18, potential: 86 };
  const migrated = careerMetaForPlayer(legacy, 3);
  assert.equal(migrated.potential, 91);
  assert.equal(migrated.potentialModelVersion, POTENTIAL_MODEL_VERSION);

  const reloaded = careerMetaForPlayer({ ...legacy, ...migrated }, 3);
  assert.deepEqual(reloaded, migrated, "loading a migrated save does not add the bonus again");
});

test("players age six months after a Major and source data stays unchanged", () => {
  const source = { ...mk("young", "Rifler", 80), age: 18 };
  const saveCopy = { ...source, ...careerMetaForPlayer(source, 3) };
  const afterMajor = { ...saveCopy, age: ageAfterMajor(saveCopy.age) };

  assert.equal(afterMajor.age, 18.5);
  assert.equal(ageAfterMajor(afterMajor.age), 19);
  assert.equal(source.age, 18, "career progression only changed the save's copy");
});

test("expectedRating rises with OVR", () => {
  assert.ok(expectedRating(90) > expectedRating(80) && expectedRating(80) > expectedRating(70));
});

test("developPlayer: overperformers rise (capped +2 and by potential), underperformers fall", () => {
  const p = mk("rifle", "Rifler", 80);
  const up = developPlayer({ player: p, rating: 1.4, placement: "top8", potential: 90 });
  assert.equal(up.ovrDelta, 2, "big overperformance is capped at +2");
  assert.equal(up.ovr, 82);
  assert.equal(up.stats.aim, 82, "headline stat tracks the change");

  const down = developPlayer({ player: p, rating: 0.7, placement: "top8", potential: 90 });
  assert.equal(down.ovrDelta, -2, "big underperformance is capped at -2");

  const capped = developPlayer({ player: mk("star", "Rifler", 90), rating: 1.5, placement: "champion", potential: 90 });
  assert.equal(capped.ovrDelta, 0, "cannot develop past potential");

  const minor = developPlayer({ player: p, rating: 1.4, placement: "champion", potential: 90, maxGain: 1, maxIglGain: 1 });
  assert.equal(minor.ovrDelta, 1, "lower-tier events can use a slower development cap");
});

test("developPlayer: IGLs are placement-driven and don't drop OVR on a non-flop", () => {
  const igl = mk("igl", "IGL", 78);
  const champ = developPlayer({ player: igl, rating: 0.95, placement: "champion", potential: 90 });
  assert.equal(champ.iglDelta, 2, "a title bumps the IGL stat");
  assert.equal(champ.ovr, 80);
  assert.equal(champ.stats.igl, 62, "IGL stat rose");

  const quiet = developPlayer({ player: igl, rating: 0.95, placement: "swiss", potential: 90 });
  assert.equal(quiet.ovrDelta, 0, "a modest IGL showing at a bad event does NOT drop OVR");

  const flop = developPlayer({ player: igl, rating: 0.6, placement: "swiss", potential: 90 });
  assert.equal(flop.ovrDelta, -1, "a genuine flop dents the IGL");
});

test("pickTransferCandidates: distinct pros of roles you field, none already yours", () => {
  const roster = [mk("me-awp", "AWP", 82), mk("me-igl", "IGL", 78), mk("me-rifle", "Rifler", 85)];
  const pool = [
    mk("p1", "AWP", 88),
    mk("p2", "IGL", 80),
    mk("p3", "Rifler", 90),
    mk("p4", "Support", 84), // wrong role — never eligible
    mk("me-awp", "AWP", 82), // already on roster (same id)
    mk("dupe", "AWP", 86, "p1"), // same handle as p1 — de-duped
    mk("p5", "Rifler", 79),
  ];
  const picks = pickTransferCandidates(roster, pool, 5, seqRng([0.1, 0.4, 0.7, 0.2, 0.9, 0.5]));
  assert.ok(picks.length > 0 && picks.length <= 5);
  const roles = new Set(roster.map((p) => p.role));
  const handles = new Set<string>();
  for (const pick of picks) {
    assert.ok(roles.has(pick.role), `${pick.id} has a role you field`);
    assert.notEqual(pick.role, "Support", "no off-role candidates");
    assert.ok(!roster.some((p) => p.id === pick.id), "not already on your roster");
    assert.ok(!handles.has(pick.handle), "no duplicate handles");
    handles.add(pick.handle);
  }
});
