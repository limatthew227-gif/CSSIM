import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { deleteRunSlot, loadRunSlots, saveRunSlot } from "../src/runDatabase";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
      },
    },
  });
});

test("run database: saves, updates, sorts and deletes run slots", () => {
  const first = saveRunSlot({ round: 1 }, summary("My Five", "Swiss"));
  const second = saveRunSlot({ round: 2 }, summary("Spectator run", "Playoffs"));
  assert.equal(loadRunSlots().length, 2);

  const updated = saveRunSlot({ round: 3 }, summary("My Five", "Final"), first.id);
  const slots = loadRunSlots<{ round: number }>();
  assert.equal(slots.length, 2);
  assert.equal(slots[0].id, updated.id);
  assert.equal(slots[0].snapshot.round, 3);
  assert.equal(slots[0].summary.detail, "Final");
  assert.equal(slots[1].id, second.id);

  deleteRunSlot(updated.id);
  const remaining = loadRunSlots();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, second.id);
});

function summary(teamName: string, detail: string) {
  return {
    teamName,
    mode: "classic",
    runKind: "player",
    phase: "swiss",
    screen: "swiss",
    recordLabel: "1-0",
    matchCount: 1,
    detail,
  };
}
