import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildReplayTimeline,
  replayRoundDuration,
  visibleEntries,
  isRenderableEvent,
  FALLBACK_STEP,
  TAIL_PAD,
} from "../src/replayTimeline";
import type { MatchEvent } from "../src/matchEvents";

test("buildReplayTimeline: timed kills reveal at their own timestamp, in order", () => {
  const events = [kill("a", { time: 8 }), kill("b", { time: 21 }), kill("c", { time: 35 })];
  const timeline = buildReplayTimeline(events, "mirage");
  assert.deepEqual(
    timeline.map((entry) => entry.revealAt),
    [8, 21, 35],
  );
});

test("buildReplayTimeline: untimed kills fall back to even index spacing", () => {
  const events = [kill("a"), kill("b"), kill("c")];
  const timeline = buildReplayTimeline(events, "inferno");
  assert.deepEqual(
    timeline.map((entry) => entry.revealAt),
    [FALLBACK_STEP, FALLBACK_STEP * 2, FALLBACK_STEP * 3],
  );
});

test("buildReplayTimeline: a zero/NaN time falls back per-event", () => {
  const events = [kill("a", { time: 10 }), kill("b", { time: 0 }), kill("c", { time: 30 })];
  const timeline = buildReplayTimeline(events, "mirage");
  // index 1 has time 0 -> falls back to (1+1)*FALLBACK_STEP
  assert.deepEqual(
    timeline.map((entry) => entry.revealAt),
    [10, 2 * FALLBACK_STEP, 30],
  );
});

test("isRenderableEvent: only kills render off-mirage; bomb events render on mirage", () => {
  assert.ok(isRenderableEvent(kill("a"), "inferno"));
  assert.ok(!isRenderableEvent(bomb("plant"), "inferno"));
  assert.ok(isRenderableEvent(bomb("plant"), "mirage"));
  assert.ok(isRenderableEvent(bomb("defuse"), "mirage"));
  assert.ok(!isRenderableEvent({ ...kill("x"), actorId: undefined }, "inferno")); // kill needs both ids
});

test("buildReplayTimeline: off-mirage produces a feed-only timeline (no bomb entries)", () => {
  const events = [kill("a"), bomb("plant"), kill("b"), bomb("explode")];
  const timeline = buildReplayTimeline(events, "inferno");
  assert.equal(timeline.length, 2);
  assert.ok(timeline.every((entry) => entry.event.type === "kill"));
});

test("replayRoundDuration: last reveal + tail, extended to round_over time when later", () => {
  const events = [kill("a", { time: 10 }), kill("b", { time: 40 })];
  const timeline = buildReplayTimeline(events, "mirage");
  assert.equal(replayRoundDuration(timeline, events), 40 + TAIL_PAD);

  const withOver = [...events, over(70)];
  assert.equal(replayRoundDuration(timeline, withOver), 70); // round_over is later than last kill + tail
});

test("visibleEntries: grows monotonically with the playhead", () => {
  const events = [kill("a", { time: 5 }), kill("b", { time: 15 }), kill("c", { time: 25 })];
  const timeline = buildReplayTimeline(events, "mirage");
  assert.equal(visibleEntries(timeline, 0).length, 0);
  assert.equal(visibleEntries(timeline, 5).length, 1);
  assert.equal(visibleEntries(timeline, 16).length, 2);
  assert.equal(visibleEntries(timeline, 999).length, 3);
});

function kill(id: string, extra: Partial<MatchEvent> = {}): MatchEvent {
  return {
    id,
    round: 1,
    type: "kill",
    team: "left",
    actorId: `k-${id}`,
    actor: `K${id}`,
    targetId: `v-${id}`,
    target: `V${id}`,
    ...extra,
  };
}

function bomb(type: "plant" | "defuse" | "explode"): MatchEvent {
  return { id: `bomb-${type}`, round: 1, type, team: "neutral" };
}

function over(time: number): MatchEvent {
  return { id: "over", round: 1, type: "round_over", team: "left", time };
}
