/**
 * RoundAI tests: objective selection across phases — pre-plant executes + lurker, post-plant
 * retake (CT) / hold (T), and that RoundState carries the situation through to the pathfinder.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { objectiveFor, roundStateFor, type Situation } from "../src/roundAI";

const sit = (over: Partial<Situation> = {}): Situation => ({
  bombPlanted: false,
  enemyAwperPressure: 0.2,
  hasUtility: false,
  availableUtility: 0,
  saving: false,
  ...over,
});

test("pre-plant CT holds default positions (A / B / mid by index)", () => {
  assert.equal(objectiveFor("CT", 0, 0, sit()), "asite");
  assert.equal(objectiveFor("CT", 3, 0, sit()), "asite");
  assert.equal(objectiveFor("CT", 1, 0, sit()), "bsite");
  assert.equal(objectiveFor("CT", 2, 0, sit()), "mid");
});

test("pre-plant T executes by strategy, with index 4 lurking off-angle", () => {
  // stack A
  assert.equal(objectiveFor("T", 0, 1, sit()), "asite");
  assert.equal(objectiveFor("T", 4, 1, sit()), "connector"); // lurker, not stacking A
  // stack B
  assert.equal(objectiveFor("T", 0, 2, sit()), "bsite");
  assert.equal(objectiveFor("T", 4, 2, sit()), "underpass"); // lurker via underpass
});

test("post-plant: CT rotates to retake the planted site; T holds it; lurker watches the flank", () => {
  const planted = sit({ bombPlanted: true, plantSite: "asite" });
  assert.equal(objectiveFor("CT", 1, 1, planted), "asite", "CT retakes A regardless of default index");
  assert.equal(objectiveFor("CT", 2, 1, planted), "asite");
  assert.equal(objectiveFor("T", 0, 1, planted), "asite", "T holds the plant");
  assert.equal(objectiveFor("T", 4, 1, planted), "connector", "T lurker watches A flank");

  const plantedB = sit({ bombPlanted: true, plantSite: "bsite" });
  assert.equal(objectiveFor("CT", 0, 2, plantedB), "bsite");
  assert.equal(objectiveFor("T", 4, 2, plantedB), "underpass", "T lurker watches B flank");
});

test("roundStateFor passes the situation through to the pathfinder", () => {
  const s = roundStateFor(sit({ bombPlanted: true, enemyAwperPressure: 1, hasUtility: true, availableUtility: 1, saving: true }));
  assert.equal(s.bombPlanted, true);
  assert.equal(s.enemyAwperPressure, 1);
  assert.equal(s.hasUtility, true);
  assert.equal(s.availableUtility, 1);
  assert.equal(s.saving, true);
});
