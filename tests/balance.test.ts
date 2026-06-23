import { test } from "node:test";
import assert from "node:assert/strict";

import { defaultSettings, difficulties, mapPool, ovrBreakdown, rateStatsForRole } from "../src/gameData";
import { assembleRoundProbability, explainRoundProbability } from "../src/sim";
import type { FieldTeam } from "../src/sim";
import type { MapId, Player, Role } from "../src/gameData";

const FULL_LOADOUT = {
  buyState: "FULL" as const,
  primaryWeapons: 5,
  midWeapons: 0,
  upgradedPistols: 0,
  armor: 5,
  nakedEco: false,
};

test("ovrBreakdown: per-stat contributions sum to rateStatsForRole for every role", () => {
  const stats = { aim: 88, clutch: 81, consistency: 79, awp: 72, igl: 64 };
  const roles: Role[] = ["AWP", "IGL", "Entry", "Lurker", "Rifler", "Support"];
  for (const role of roles) {
    const breakdown = ovrBreakdown(stats, role);
    assert.equal(breakdown.ovr, rateStatsForRole(stats, role));
    const summed = breakdown.contributions.reduce((sum, entry) => sum + entry.contribution, 0);
    assert.equal(Math.round(summed), rateStatsForRole(stats, role));
    // contributions arrive sorted high → low
    for (let i = 1; i < breakdown.contributions.length; i++) {
      assert.ok(breakdown.contributions[i - 1].contribution >= breakdown.contributions[i].contribution);
    }
  }
});

test("explainRoundProbability: mirror matchup is a near coin flip and contributions sum to base", () => {
  const a = makeTeam("a", 82);
  const b = makeTeam("b", 82);
  const explanation = explainRoundProbability(a, b, defaultSettings, difficulties[0], {
    side: "CT",
    yourEconomy: "FULL",
    opponentEconomy: "FULL",
  });
  assert.ok(explanation.final > 0.5 && explanation.final < 0.54, `final ${explanation.final}`);
  const summed = explanation.contributions.reduce((sum, entry) => sum + entry.value, 0);
  assert.ok(Math.abs(summed - explanation.base) < 1e-9);
  assert.ok(explanation.final >= 0.05 && explanation.final <= 0.95);
});

test("explainRoundProbability: the stronger team is favoured", () => {
  const strong = makeTeam("strong", 92);
  const weak = makeTeam("weak", 76);
  const explanation = explainRoundProbability(strong, weak, defaultSettings, difficulties[0], {
    side: "CT",
    yourEconomy: "FULL",
    opponentEconomy: "FULL",
  });
  assert.ok(explanation.final > 0.6, `final ${explanation.final}`);
  assert.ok(explanation.final <= 0.95);
});

test("explainRoundProbability: an eco vs a full buy is capped low", () => {
  const a = makeTeam("a", 84);
  const b = makeTeam("b", 84);
  const explanation = explainRoundProbability(a, b, defaultSettings, difficulties[0], {
    side: "T",
    yourEconomy: "ECO",
    opponentEconomy: "FULL",
    buy: "save",
  });
  assert.ok(explanation.final < 0.2, `final ${explanation.final}`);
  assert.ok(explanation.final >= 0.05);
});

test("assembleRoundProbability: symmetric inputs are 0.5; the comeback nudge eases a leader", () => {
  const even = assembleRoundProbability({
    yourStrength: 80,
    opponentStrength: 80,
    economyMod: 0,
    sideMod: 0,
    tacticMod: 0,
    timeoutBoost: 0,
    utilMod: 0,
    luck: 0,
    yourLoadout: FULL_LOADOUT,
    opponentLoadout: FULL_LOADOUT,
    scoreGap: 0,
  });
  assert.equal(even.final, 0.5);

  const leading = assembleRoundProbability({
    yourStrength: 80,
    opponentStrength: 80,
    economyMod: 0,
    sideMod: 0,
    tacticMod: 0,
    timeoutBoost: 0,
    utilMod: 0,
    luck: 0,
    yourLoadout: FULL_LOADOUT,
    opponentLoadout: FULL_LOADOUT,
    scoreGap: 8,
  });
  assert.ok(leading.comeback < 0 && leading.final < 0.5, `comeback ${leading.comeback} final ${leading.final}`);
});

function makeTeam(id: string, ovr: number): FieldTeam {
  return {
    id,
    tag: id.slice(0, 3).toUpperCase(),
    name: id,
    country: "US",
    era: "CS2",
    year: "2026",
    accent: "#ffffff",
    rank: 10,
    players: [
      makePlayer(`${id}-igl`, "IGL", ovr),
      makePlayer(`${id}-awp`, "AWP", ovr),
      makePlayer(`${id}-entry`, "Entry", ovr),
      makePlayer(`${id}-support`, "Support", ovr),
      makePlayer(`${id}-rifler`, "Rifler", ovr),
    ],
  };
}

function makePlayer(id: string, role: Role, ovr: number): Player {
  const maps = mapPool.reduce((acc, map) => ((acc[map.id] = ovr), acc), {} as Record<MapId, number>);
  return {
    id,
    handle: id,
    realName: id,
    country: "US",
    role,
    style: "Balanced",
    traits: [role],
    stats: { aim: ovr, clutch: ovr, consistency: ovr, awp: role === "AWP" ? 90 : 55, igl: role === "IGL" ? 90 : 55 },
    ovr,
    source: { tag: "TST", name: `${id}-src`, country: "US", era: "CS2", year: "2026", accent: "#ffffff" },
    maps,
  };
}
