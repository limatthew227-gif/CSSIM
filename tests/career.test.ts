import { test } from "node:test";
import assert from "node:assert/strict";

import { playerValue, transferDelta, prizeForPlacement, placementTier, placementLabel, pickTransferCandidates } from "../src/career";
import type { Player } from "../src/gameData";
import type { Role } from "../src/gameData";

// Minimal fixtures — the career math only reads ovr/role/id/handle.
function mk(id: string, role: Role, ovr: number, handle = id): Player {
  return { id, handle, role, ovr } as Player;
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
