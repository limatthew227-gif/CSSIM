import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { deleteRunSlot, loadRunSlots, saveRunSlot, writeAutosave, readAutosave, clearAutosave } from "../src/runDatabase";

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
        removeItem: (key: string) => {
          store.delete(key);
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

test("autosave round-trips snapshot + summary, then clears", () => {
  assert.equal(readAutosave(), null, "no autosave to begin with");

  const written = writeAutosave({ careerMoney: 84000, careerEvent: 2, roster: ["a", "b"] }, summary("My Five", "After Major 1"));
  assert.ok(written, "successful writes return the in-memory autosave");
  const saved = readAutosave<{ careerMoney: number; careerEvent: number; roster: string[] }>();
  assert.ok(saved, "autosave is read back");
  assert.equal(saved!.snapshot.careerMoney, 84000);
  assert.equal(saved!.snapshot.careerEvent, 2);
  assert.deepEqual(saved!.snapshot.roster, ["a", "b"]);
  assert.equal(saved!.summary.teamName, "My Five");
  assert.equal(typeof saved!.updatedAt, "string");

  clearAutosave();
  assert.equal(readAutosave(), null, "cleared");
});

test("autosave still returns the newest state when localStorage is full", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota exceeded");
        },
        removeItem: () => undefined,
      },
    },
  });

  const written = writeAutosave(
    { managerCareer: { season: 3, date: "2027-07-20" } },
    summary("Vitality", "Manager HQ / Jul 20, 2027"),
  );

  assert.equal(written?.snapshot.managerCareer.season, 3);
  assert.equal(written?.summary.detail, "Manager HQ / Jul 20, 2027");
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
