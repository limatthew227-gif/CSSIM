import assert from "node:assert/strict";
import { test } from "node:test";

import { decideAutoCoach } from "../src/autoCoach";

test("Auto Coach changes to the recommended tactic", () => {
  const decision = decideAutoCoach({
    currentTactic: "standard",
    recommendedTactic: "cautious",
    recommendationLabel: "Stop run",
    recommendationReason: "Stabilize first contact.",
    timeoutRecommended: false,
    timeoutPriority: "good",
    timeoutLabel: "Hold timeout",
    timeoutReason: "Keep the pause.",
    availableTimeouts: 2,
    timeoutRounds: 0,
    roundsPlayed: 5,
  });

  assert.equal(decision.tactic, "cautious");
  assert.equal(decision.changedTactic, true);
  assert.equal(decision.callTimeout, false);
});

test("Auto Coach calls a recommended timeout when one is available", () => {
  const decision = decideAutoCoach({
    currentTactic: "standard",
    recommendedTactic: "cautious",
    recommendationLabel: "Map point hold",
    recommendationReason: "Slow the opener.",
    timeoutRecommended: true,
    timeoutPriority: "bad",
    timeoutLabel: "Call timeout",
    timeoutReason: "The opponent has three straight.",
    availableTimeouts: 1,
    timeoutRounds: 0,
    roundsPlayed: 8,
  });

  assert.equal(decision.callTimeout, true);
  assert.match(decision.status, /Call timeout/);
});

test("Auto Coach never stacks a timeout over an active plan", () => {
  const decision = decideAutoCoach({
    currentTactic: "cautious",
    recommendedTactic: "cautious",
    recommendationLabel: "Stop run",
    recommendationReason: "Keep the shape.",
    timeoutRecommended: true,
    timeoutPriority: "bad",
    timeoutLabel: "Call timeout",
    timeoutReason: "The opponent is threatening.",
    availableTimeouts: 2,
    timeoutRounds: 3,
    roundsPlayed: 10,
  });

  assert.equal(decision.changedTactic, false);
  assert.equal(decision.callTimeout, false);
});

test("Auto Coach conserves advisory timeouts until the late game", () => {
  const early = decideAutoCoach({
    currentTactic: "standard",
    recommendedTactic: "standard",
    recommendationLabel: "Default",
    recommendationReason: "Keep shape.",
    timeoutRecommended: true,
    timeoutPriority: "neutral",
    timeoutLabel: "Prep timeout",
    timeoutReason: "Use the coach edge.",
    availableTimeouts: 2,
    timeoutRounds: 0,
    roundsPlayed: 6,
  });
  const late = decideAutoCoach({
    ...earlyInput(),
    roundsPlayed: 21,
  });

  assert.equal(early.callTimeout, false);
  assert.equal(late.callTimeout, true);
});

function earlyInput() {
  return {
    currentTactic: "standard" as const,
    recommendedTactic: "standard" as const,
    recommendationLabel: "Default",
    recommendationReason: "Keep shape.",
    timeoutRecommended: true,
    timeoutPriority: "neutral" as const,
    timeoutLabel: "Prep timeout",
    timeoutReason: "Use the coach edge.",
    availableTimeouts: 2,
    timeoutRounds: 0,
    roundsPlayed: 6,
  };
}
