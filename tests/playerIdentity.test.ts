import { test } from "node:test";
import assert from "node:assert/strict";

import { canonicalPlayerKey, playerInstanceKey, playerVersionKey } from "../src/playerIdentity";
import type { MapId, Player } from "../src/gameData";

test("player identity: drafted copies keep the same canonical player but a separate instance", () => {
  const original = makePlayer("navi-2026-makazze", "makazze", "Drin Shaqiri");
  const drafted = { ...original, id: "user-pick-3-navi-2026-makazze" };

  assert.equal(canonicalPlayerKey(drafted), canonicalPlayerKey(original));
  assert.notEqual(playerInstanceKey({ id: "user" }, drafted), playerInstanceKey({ id: "navi-2026" }, original));
});

test("player identity: historical versions stay distinct from the same human identity", () => {
  const current = makePlayer("navi-2026-s1mple", "s1mple", "Oleksandr Kostyliev", "2026");
  const classic = makePlayer("navi-2018-s1mple", "s1mple", "Oleksandr Kostyliev", "2018");

  assert.equal(canonicalPlayerKey(current), canonicalPlayerKey(classic));
  assert.notEqual(playerVersionKey(current), playerVersionKey(classic));
});

function makePlayer(id: string, handle: string, realName: string, year = "2026"): Player {
  const maps = ["mirage", "inferno", "nuke", "ancient", "anubis", "dust2", "train"].reduce(
    (acc, map) => {
      acc[map as MapId] = 80;
      return acc;
    },
    {} as Record<MapId, number>,
  );

  return {
    id,
    handle,
    realName,
    country: "UA",
    role: "Rifler",
    style: "Balanced",
    traits: [],
    stats: { aim: 80, clutch: 80, consistency: 80, awp: 70, igl: 50 },
    ovr: 80,
    source: { tag: "NAVI", name: "Natus Vincere", country: "UA", era: "CS2", year, accent: "#f3d21b" },
    maps,
  };
}
