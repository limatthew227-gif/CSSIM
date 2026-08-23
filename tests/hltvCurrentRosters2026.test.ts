import assert from "node:assert/strict";
import { test } from "node:test";

import "../scripts/register-stub.mjs";

test("July 20/23 current roster snapshot is complete, playable, and identity-safe", async () => {
  const { hltvCurrentRosters2026, hltvCurrentRosterSnapshot2026 } = await import("../src/hltvCurrentRosters2026");
  const current = hltvCurrentRosters2026.filter((roster) => roster.era === "CS2");
  const players = current.flatMap((roster) => roster.players);

  assert.equal(current.length, 56);
  assert.equal(hltvCurrentRosterSnapshot2026.length, 56);
  assert.equal(hltvCurrentRosters2026.filter((roster) => roster.era !== "CS2").length, 3);
  assert.equal(current.every((roster) => roster.players.length === 5), true);
  assert.equal(new Set(players.map((player) => player.id)).size, players.length);
  assert.equal(players.every((player) => player.source.name === current.find((roster) => roster.players.includes(player))?.name), true);
});

test("requested and previously missing teams use their verified active lineups", async () => {
  const { hltvCurrentRosters2026 } = await import("../src/hltvCurrentRosters2026");
  const lineup = (name: string) => hltvCurrentRosters2026
    .find((roster) => roster.name === name)!
    .players
    .map((player) => player.handle);

  assert.deepEqual(lineup("TYLOO"), ["JamYoung", "Jee", "Mercury", "Moseyuh", "Zero"]);
  assert.deepEqual(lineup("BC.Game"), ["s1mple", "electroNic", "Magisk", "Senzu", "mzinho"]);
  assert.deepEqual(lineup("100 Thieves"), ["device", "rain", "Gizmy", "sirah", "poiii"]);
  assert.deepEqual(lineup("9z"), ["max", "dgt", "meyern", "luchov", "HUASOPEEK"]);
  assert.deepEqual(lineup("FUT"), ["xfl0ud", "dem0n", "Krabeni", "cmtry", "dziugss"]);
});

test("9z uses the verified roles, restrained cards, and playoff-pressure trait", async () => {
  const { hltvCurrentRosters2026 } = await import("../src/hltvCurrentRosters2026");
  const team = hltvCurrentRosters2026.find((roster) => roster.name === "9z")!;
  const byHandle = new Map(team.players.map((player) => [player.handle, player]));

  assert.equal(byHandle.get("meyern")?.role, "AWP");
  assert.equal(byHandle.get("luchov")?.role, "Support");
  assert.deepEqual(
    team.players.map((player) => [player.handle, player.ovr, player.hltvRating]),
    [
      ["max", 71, 0.96],
      ["dgt", 85, 1.16],
      ["meyern", 71, 1.01],
      ["luchov", 84, 1.19],
      ["HUASOPEEK", 77, 1.13],
    ],
  );
  team.players.forEach((player) => {
    assert.equal(player.traits.includes("Playoff nerves"), true);
    assert.equal(player.playoffNerves?.initialPenalty, 0.08);
    assert.equal(player.playoffNerves?.fadePerYear, 0.02);
  });
});

test("Jimpphat and kyxsan use the requested restrained OVR values", async () => {
  const { hltvCurrentRosters2026 } = await import("../src/hltvCurrentRosters2026");
  const aurora = hltvCurrentRosters2026.find((roster) => roster.name === "Aurora")!;
  const byHandle = new Map(aurora.players.map((player) => [player.handle, player]));

  assert.equal(byHandle.get("Jimpphat")?.ovr, 77);
  assert.equal(byHandle.get("kyxsan")?.ovr, 73);
});

test("BC.Game uses the executive recalibration and role-correct cards", async () => {
  const { hltvCurrentRosters2026 } = await import("../src/hltvCurrentRosters2026");
  const bcGame = hltvCurrentRosters2026.find((roster) => roster.name === "BC.Game")!;

  assert.deepEqual(
    bcGame.players.map((player) => [player.handle, player.role, player.ovr]),
    [
      ["s1mple", "AWP", 85],
      ["electroNic", "Lurker", 71],
      ["Magisk", "IGL", 75],
      ["Senzu", "Entry", 87],
      ["mzinho", "Support", 79],
    ],
  );
  assert.equal(bcGame.players.find((player) => player.handle === "mzinho")?.style, "Passive");
});

test("confirmed benched players do not remain on active club lineups", async () => {
  const { hltvCurrentRosters2026 } = await import("../src/hltvCurrentRosters2026");
  const { createManagerFreeAgentPool } = await import("../src/managerMarket");
  const activeHandles = new Set(
    hltvCurrentRosters2026
      .filter((roster) => roster.era === "CS2")
      .flatMap((roster) => roster.players.map((player) => player.handle.toLowerCase())),
  );
  const confirmedBench = [
    "lauNX",
    "broky",
    "MAJ3R",
    "soulfly",
    "SunPayus",
    "cobrazera",
    "nota",
    "urban0",
    "DANK1NG",
    "Krimbo",
    "skullz",
    "levi",
    "Lucaozy",
    "Ag1l",
    "jkaem",
    "aragornN",
    "yxngstxr",
  ];
  const freeAgents = new Set(createManagerFreeAgentPool("bench-audit", 30).map((candidate) => candidate.player.handle));

  confirmedBench.forEach((handle) => {
    assert.equal(activeHandles.has(handle.toLowerCase()), false, `${handle} should not be active`);
    assert.equal(freeAgents.has(handle), true, `${handle} should be a free transfer`);
  });
});
