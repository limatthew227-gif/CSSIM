import { test } from "node:test";
import assert from "node:assert/strict";

import {
  hltvProspectPotentialBonus,
  hltvProspectReports2026,
  hltvProspectSignal,
  normalizeProspectHandle,
} from "../src/hltvProspects2026";

test("each HLTV prospect report contains 50 unique handles", () => {
  for (const report of hltvProspectReports2026) {
    assert.equal(report.rankedHandles.length, 50, `${report.month} has a complete top 50`);
    const unique = new Set(report.rankedHandles.map(normalizeProspectHandle));
    assert.equal(unique.size, 50, `${report.month} does not contain duplicate handles`);
  }
});

test("prospect potential rewards repeated high rankings", () => {
  const leader = hltvProspectSignal("dziugss");
  assert.deepEqual(leader.ranks, [1, 1, 1]);
  assert.equal(leader.potentialBonus, 3);

  const riser = hltvProspectSignal("xelex");
  assert.deepEqual(riser.ranks, [17, 17, 4]);
  assert.equal(riser.score, 40.5);
  assert.equal(riser.potentialBonus, 3);
});

test("a single report appearance gives a small signal and handles are normalized", () => {
  const newcomer = hltvProspectSignal("s1zzi");
  assert.deepEqual(newcomer.ranks, [32]);
  assert.equal(newcomer.appearances, 1);
  assert.equal(newcomer.potentialBonus, 1);
  assert.equal(hltvProspectPotentialBonus("nut nut"), hltvProspectPotentialBonus("nut-nut"));
  assert.equal(hltvProspectPotentialBonus("unknown-player"), 0);
});
