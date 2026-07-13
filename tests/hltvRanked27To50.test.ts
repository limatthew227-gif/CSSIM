import assert from "node:assert/strict";
import { test } from "node:test";

import "../scripts/register-stub.mjs";

const expectedTeams = [
  "Ninjas in Pyjamas",
  "Liquid",
  "Inner Circle",
  "Lynn Vision",
  "Sharks",
  "Nemesis",
  "3DMAX",
  "FlyQuest",
  "EYEBALLERS",
  "NRG",
  "Wildcard",
  "HEROIC",
  "Acend",
  "Gentle Mates",
  "Echo",
  "Nuclear TigeRES",
  "HOTU",
  "Virtus.pro",
  "SINNERS",
  "FOKUS",
  "TDK",
  "Walczaki",
  "LP",
  "INFINITE",
];

test("July 13 HLTV snapshot contains every team ranked 27 through 50", async () => {
  const { hltvRanked27To50Rosters, hltvRanked27To50Seeds } = await import("../src/hltvRanked27To50");

  assert.deepEqual(hltvRanked27To50Rosters.map((roster) => roster.rank), Array.from({ length: 24 }, (_, index) => index + 27));
  assert.deepEqual(hltvRanked27To50Rosters.map((roster) => roster.name), expectedTeams);
  assert.ok(hltvRanked27To50Seeds.every((team) => team.rankingLabel.includes("July 13, 2026")));
});

test("July 13 teams form complete, unique, playable rosters", async () => {
  const { hltvRanked27To50Coaches, hltvRanked27To50Rosters } = await import("../src/hltvRanked27To50");
  const { validateDataset } = await import("../src/validation");
  const players = hltvRanked27To50Rosters.flatMap((roster) => roster.players);

  assert.equal(hltvRanked27To50Rosters.length, 24);
  assert.ok(hltvRanked27To50Rosters.every((roster) => roster.players.length === 5));
  assert.equal(players.length, 120);
  assert.equal(new Set(players.map((player) => player.id)).size, players.length);
  assert.ok(players.every((player) => player.ovr >= 58 && player.ovr <= 96));
  assert.equal(hltvRanked27To50Coaches.length, 23, "Walczaki had no listed coach in the snapshot");
  assert.equal(validateDataset(hltvRanked27To50Rosters, hltvRanked27To50Coaches).errors, 0);
});
