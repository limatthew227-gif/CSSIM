import { test } from "node:test";
import assert from "node:assert/strict";

import { eventLogFromFeed } from "../src/matchEvents";
import type { FeedLine } from "../src/sim";

test("match events: converts chronological feed lines into stable left/right events", () => {
  const log = eventLogFromFeed("ancient", [
    feed({ round: 1, type: "round_start", team: "neutral" }),
    feed({ round: 1, team: "you", killer: "makazze", killerId: "navi-makazze", victim: "donk", victimId: "spirit-donk", weapon: "AK-47", first: true, t: 12.5, isHeadshot: true }),
    feed({ round: 1, type: "round_over", team: "you", reason: "Target bombed", tScore: 1, ctScore: 0, t: 52 }),
  ]);

  assert.equal(log.schemaVersion, 1);
  assert.equal(log.map, "ancient");
  assert.equal(log.events.length, 3);
  assert.equal(log.events[0].type, "round_start");
  assert.equal(log.events[1].team, "left");
  assert.equal(log.events[1].actorId, "navi-makazze");
  assert.equal(log.events[1].targetId, "spirit-donk");
  assert.equal(log.events[1].firstKill, true);
  assert.equal(log.events[1].headshot, true);
  assert.equal(log.events[2].reason, "Target bombed");
});

test("match events: keeps opponent and neutral events distinct", () => {
  const log = eventLogFromFeed("mirage", [
    feed({ round: 7, team: "opponent", killer: "m0NESY", killerId: "falcons-m0nesy", victim: "b1t", victimId: "navi-bit", weapon: "AWP" }),
    feed({ round: 7, type: "explode", team: "neutral", killer: "Bomb", weapon: "bomb" }),
  ]);

  assert.equal(log.events[0].team, "right");
  assert.equal(log.events[0].type, "kill");
  assert.equal(log.events[1].team, "neutral");
  assert.equal(log.events[1].type, "explode");
});

function feed(line: Partial<FeedLine>): FeedLine {
  return {
    round: 1,
    killer: "",
    killerId: "",
    victim: "",
    victimId: "",
    weapon: "",
    team: "neutral",
    first: false,
    ...line,
  };
}
