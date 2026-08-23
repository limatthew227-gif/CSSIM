import assert from "node:assert/strict";
import { test } from "node:test";

import { estimateSeriesWinProbability, matchRevealScore } from "../src/matchChoice";

test("an even matchup is displayed as a coin flip", () => {
  assert.equal(estimateSeriesWinProbability(0, 1), 0.5);
  assert.equal(estimateSeriesWinProbability(0, 3), 0.5);
  assert.equal(estimateSeriesWinProbability(0, 5), 0.5);
});

test("the stronger team receives the higher estimated chance", () => {
  assert.ok(estimateSeriesWinProbability(4, 3) > 0.5);
  assert.ok(estimateSeriesWinProbability(-4, 3) < 0.5);
});

test("a longer series rewards the stronger team", () => {
  const bestOfOne = estimateSeriesWinProbability(3, 1);
  const bestOfThree = estimateSeriesWinProbability(3, 3);
  const bestOfFive = estimateSeriesWinProbability(3, 5);

  assert.ok(bestOfThree > bestOfOne);
  assert.ok(bestOfFive > bestOfThree);
});

test("extreme mismatches retain an upset chance", () => {
  assert.equal(estimateSeriesWinProbability(100, 1), 0.92);
  assert.equal(estimateSeriesWinProbability(-100, 1), 0.08);
  assert.ok(estimateSeriesWinProbability(100, 5) <= 0.96);
  assert.ok(estimateSeriesWinProbability(-100, 5) >= 0.04);
});

test("BO1 reveal displays the actual Counter-Strike map score", () => {
  const maps = [{ leftScore: 13, rightScore: 4, winnerId: "left" }];

  assert.deepEqual(matchRevealScore(maps, "left", 1, 0), { left: 0, right: 0 });
  assert.deepEqual(matchRevealScore(maps, "left", 1, 1), { left: 13, right: 4 });
});

test("multi-map reveal displays maps won as the series score", () => {
  const maps = [
    { leftScore: 13, rightScore: 8, winnerId: "left" },
    { leftScore: 10, rightScore: 13, winnerId: "right" },
    { leftScore: 13, rightScore: 6, winnerId: "left" },
  ];

  assert.deepEqual(matchRevealScore(maps, "left", 3, 1), { left: 1, right: 0 });
  assert.deepEqual(matchRevealScore(maps, "left", 3, 2), { left: 1, right: 1 });
  assert.deepEqual(matchRevealScore(maps, "left", 3, 3), { left: 2, right: 1 });
});
