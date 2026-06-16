/**
 * Deterministic regression harness for the simulation engine.
 *
 * Run with:  npm test           (→ tsx tests/sim.test.ts)
 *
 * The engine leans on Math.random everywhere, so every test that touches the
 * engine runs inside `withSeed(...)`, which swaps in a seeded PRNG (mulberry32)
 * and restores the real Math.random afterwards. Same seed → identical match,
 * which is what makes these checks repeatable.
 *
 * Coverage:
 *   1. Pure economy unit tests (lossBonusForStreak, roundIncome, getKillReward,
 *      getAutoBuyState) — fast, exact, and balance-tuning-independent.
 *   2. Full-match invariants over many seeds — money bounds, score progression,
 *      MR12 termination, side swaps.
 *   3. Determinism and gross balance sanity (favourite beats underdog; mirror is
 *      roughly even).
 *
 * NOTE: the `roundIncome` block is the canonical regression for the
 *       "T-side survivors got no loss bonus" bug. It tests the exact function the
 *       engine now uses for end-of-round payouts, so if anyone reintroduces a
 *       survival-based payout it fails here.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { defaultSettings, difficulties, mapPool } from "../src/gameData";
import type { Coach, MapId, Player, Role, Style } from "../src/gameData";
import {
  initMatch,
  playRound,
  generateDynamicRound,
  roundIncome,
  lossBonusForStreak,
  getAutoBuyState,
  getKillReward,
  spendMoney,
  utilityRating,
  utilFactor,
} from "../src/sim";
import type { FieldTeam } from "../src/sim";
import { getNavGrid, hasLineOfSight } from "../src/mapGeometry";

// ---------------------------------------------------------------------------
// Seeded RNG
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function withSeed<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  Math.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

// ---------------------------------------------------------------------------
// Deterministic team builders (synthetic — independent of balance data tuning)
// ---------------------------------------------------------------------------

function makePlayer(id: string, role: Role, ovr: number, style: Style = "Balanced", awp = 60): Player {
  const maps = mapPool.reduce((acc, m) => {
    acc[m.id] = ovr;
    return acc;
  }, {} as Record<MapId, number>);
  return {
    id,
    handle: id,
    realName: id,
    country: "US",
    role,
    style,
    traits: [role],
    stats: { aim: ovr, clutch: ovr, consistency: ovr, awp, igl: role === "IGL" ? 90 : 55 },
    ovr,
    source: { tag: "TST", name: `${id}-src`, country: "US", era: "CS2", year: "2026", accent: "#ffffff" },
    maps,
  };
}

/** A full, role-complete 5-man so composition bonuses/penalties are stable. */
function makeTeam(id: string, ovr: number, rank = 10): FieldTeam {
  return {
    id,
    tag: id.slice(0, 3).toUpperCase(),
    name: id,
    country: "US",
    era: "CS2",
    year: "2026",
    accent: "#ffffff",
    rank,
    players: [
      makePlayer(`${id}-igl`, "IGL", ovr),
      makePlayer(`${id}-awp`, "AWP", ovr, "Balanced", 90),
      makePlayer(`${id}-entry`, "Entry", ovr, "Aggressive"),
      makePlayer(`${id}-support`, "Support", ovr, "Passive"),
      makePlayer(`${id}-rifler`, "Rifler", ovr, "Balanced"),
    ],
  };
}

function playMatch(seed: number, you: FieldTeam, opp: FieldTeam, map: MapId = "mirage") {
  return withSeed(seed, () => {
    let state = initMatch(map, you, opp);
    let guard = 0;
    while (!state.ended && guard < 200) {
      state = playRound(state, you, opp, defaultSettings, difficulties[0], "standard", 0, true);
      guard += 1;
    }
    return state;
  });
}

// ===========================================================================
// 1. Pure economy unit tests
// ===========================================================================

test("lossBonusForStreak: $1400 base, +$500 per loss, capped at streak 4", () => {
  assert.equal(lossBonusForStreak(0), 1400);
  assert.equal(lossBonusForStreak(1), 1900);
  assert.equal(lossBonusForStreak(2), 2400);
  assert.equal(lossBonusForStreak(4), 3400);
  assert.equal(lossBonusForStreak(9), 3400); // capped
});

test("roundIncome: a win pays $3250 regardless of side or plant", () => {
  assert.equal(roundIncome({ won: true, side: "T", planted: false, lossBonus: 2400 }), 3250);
  assert.equal(roundIncome({ won: true, side: "CT", planted: true, lossBonus: 2400 }), 3250);
});

test("roundIncome: REGRESSION — losing team always gets the loss bonus (incl. T-side survivors)", () => {
  // Bug history: a T-side player who survived an unplanted lost round received $0.
  // The fix pays the loss bonus to the whole losing team, every side, every player.
  assert.equal(roundIncome({ won: false, side: "T", planted: false, lossBonus: 2400 }), 2400);
  assert.equal(roundIncome({ won: false, side: "CT", planted: false, lossBonus: 2400 }), 2400);
});

test("roundIncome: T plant bonus adds $800 on a lost round; CT never gets it", () => {
  assert.equal(roundIncome({ won: false, side: "T", planted: true, lossBonus: 1400 }), 2200);
  assert.equal(roundIncome({ won: false, side: "CT", planted: true, lossBonus: 1400 }), 1400);
});

test("getKillReward: AWP cheap ($100), SMG rich ($600), everything else $300", () => {
  assert.equal(getKillReward("AWP"), 100);
  assert.equal(getKillReward("MP9"), 600);
  assert.equal(getKillReward("MAC-10"), 600);
  assert.equal(getKillReward("AK-47"), 300);
  assert.equal(getKillReward("USP-S"), 300);
});

test("getAutoBuyState: full buy when avg >= side threshold (CT 4700 / T 4200)", () => {
  assert.equal(getAutoBuyState([4700, 4700, 4700, 4700, 4700], "CT", 0, false), "FULL");
  // $4300 clears the T threshold but not the CT one
  assert.equal(getAutoBuyState([4300, 4300, 4300, 4300, 4300], "T", 0, false), "FULL");
  // Won the previous round but below the CT full-buy line → force, never eco
  assert.equal(getAutoBuyState([4300, 4300, 4300, 4300, 4300], "CT", 0, true), "FORCE");
});

test("getAutoBuyState: anticipatory eco vs force vs full save (lost previous round)", () => {
  // avg + lossBonus(1400) = 4800 >= 4700 → save now, guaranteed full buy next round
  assert.equal(getAutoBuyState([3400, 3400, 3400, 3400, 3400], "CT", 0, false), "ECO");
  // can't anticipatory-save, but avg >= 2000 → force
  assert.equal(getAutoBuyState([2200, 2200, 2200, 2200, 2200], "CT", 0, false), "FORCE");
  // too poor to do anything meaningful → full eco
  assert.equal(getAutoBuyState([1200, 1200, 1200, 1200, 1200], "CT", 0, false), "ECO");
});

// ===========================================================================
// 2. Full-match invariants (seeded)
// ===========================================================================

test("initMatch: pistol round starts both teams at $800 with starter pistols", () => {
  const you = makeTeam("you", 80);
  const opp = makeTeam("opp", 80);
  const s = withSeed(1, () => initMatch("mirage", you, opp));
  assert.equal(s.round, 1);
  assert.equal(s.side, "CT");
  for (const p of you.players) {
    assert.equal(s.yourMoney?.[p.id], 800);
    assert.equal(s.yourWeapons?.[p.id], "USP-S");
  }
  for (const p of opp.players) {
    assert.equal(s.opponentMoney?.[p.id], 800);
    assert.equal(s.opponentWeapons?.[p.id], "Glock-18");
  }
});

test("per-round invariants hold across many seeded matches", () => {
  const you = makeTeam("you", 84, 6);
  const opp = makeTeam("opp", 80, 9);

  for (let seed = 1; seed <= 40; seed += 1) {
    withSeed(seed, () => {
      let state = initMatch("inferno", you, opp);
      assert.equal(state.side, "CT");
      let guard = 0;
      let sawTSide = false;

      while (!state.ended && guard < 200) {
        const beforeYou = state.you;
        const beforeOpp = state.opponent;
        state = playRound(state, you, opp, defaultSettings, difficulties[0], "standard", 0, true);
        guard += 1;

        const youInc = state.you - beforeYou;
        const oppInc = state.opponent - beforeOpp;
        assert.ok(
          (youInc === 1 && oppInc === 0) || (youInc === 0 && oppInc === 1),
          `seed ${seed}: exactly one team should score (got +${youInc}/+${oppInc})`,
        );
        assert.equal(state.roundWinners.length, state.you + state.opponent, `seed ${seed}: roundWinners tracks rounds`);

        for (const p of you.players) {
          const m = state.yourMoney?.[p.id] ?? -1;
          assert.ok(m >= 0 && m <= 10000, `seed ${seed}: your money out of bounds (${m})`);
        }
        for (const p of opp.players) {
          const m = state.opponentMoney?.[p.id] ?? -1;
          assert.ok(m >= 0 && m <= 10000, `seed ${seed}: opp money out of bounds (${m})`);
        }

        if (state.side === "T") sawTSide = true;
      }

      assert.ok(state.ended, `seed ${seed}: match should end within the guard`);
      const hi = Math.max(state.you, state.opponent);
      const lo = Math.min(state.you, state.opponent);
      assert.ok(hi >= 13 && hi - lo >= 2, `seed ${seed}: invalid final score ${state.you}-${state.opponent}`);
      assert.ok(sawTSide, `seed ${seed}: your team's side should swap to T by halftime`);
    });
  }
});

// ===========================================================================
// 2b. Utility (Phase 1: economy + win-prob)
// ===========================================================================

const TACTICAL_COACH: Coach = {
  id: "coach",
  handle: "Coach",
  realName: "Coach",
  country: "US",
  style: "Tactical",
  rating: 85,
  text: "",
};

test("utilFactor: 0 with no nades, ramps to 1 at a full util load", () => {
  assert.equal(utilFactor(0), 0);
  assert.ok(utilFactor(6) > 0 && utilFactor(6) < 1);
  assert.equal(utilFactor(12), 1);
  assert.equal(utilFactor(20), 1); // clamped
});

test("utilityRating: bounded to 0..4 and rewards discipline", () => {
  const disciplined = makeTeam("disc", 88); // consistency 88, 1 Support, IGL igl=90
  const raw: FieldTeam = {
    ...makeTeam("raw", 88),
    players: makeTeam("raw", 88).players.map((p) => ({ ...p, stats: { ...p.stats, consistency: 68 } })),
  };
  const dr = utilityRating(disciplined);
  assert.ok(dr >= 0 && dr <= 4, `rating out of bounds: ${dr}`);
  assert.ok(dr > utilityRating(raw), "a more consistent team should use util better");
});

test("utilityRating: a tactical/disciplined coach adds coordination", () => {
  const base = makeTeam("base", 85);
  const coached: FieldTeam = { ...base, coach: TACTICAL_COACH };
  assert.ok(utilityRating(coached) > utilityRating(base));
});

test("spendMoney: full buys purchase utility, ecos buy none", () => {
  const team = makeTeam("t", 85);
  const weapons = team.players.reduce((acc, p) => ((acc[p.id] = ""), acc), {} as Record<string, string>);
  const armor = team.players.reduce(
    (acc, p) => ((acc[p.id] = "none"), acc),
    {} as Record<string, "none" | "kevlar" | "helmet">,
  );

  withSeed(7, () => {
    const rich = team.players.reduce((acc, p) => ((acc[p.id] = 6000), acc), {} as Record<string, number>);
    const full = spendMoney(rich, team.players, "CT", "FULL", weapons, armor);
    const fullUtil = Object.values(full.finalUtility).reduce((a, b) => a + b, 0);
    assert.ok(fullUtil > 0, `a flush full buy should field utility, got ${fullUtil}`);
    // util spend never drives anyone below zero
    for (const p of team.players) assert.ok((full.nextMoney[p.id] ?? -1) >= 0);

    const broke = team.players.reduce((acc, p) => ((acc[p.id] = 200), acc), {} as Record<string, number>);
    const eco = spendMoney(broke, team.players, "CT", "ECO", weapons, armor);
    assert.equal(
      Object.values(eco.finalUtility).reduce((a, b) => a + b, 0),
      0,
      "ecos field no utility",
    );
  });
});

// ===========================================================================
// 2c. Utility feed events (Phase 2)
// ===========================================================================

test("generateDynamicRound: utility events appear only when nades were bought, and never mint kills", () => {
  const you = makeTeam("you", 85);
  const opp = makeTeam("opp", 85);
  const armed = (t: FieldTeam) => t.players.reduce((a, p) => ((a[p.id] = "AK-47"), a), {} as Record<string, string>);
  const helm = (t: FieldTeam) =>
    t.players.reduce((a, p) => ((a[p.id] = "helmet"), a), {} as Record<string, "none" | "kevlar" | "helmet">);
  const money = (t: FieldTeam) => t.players.reduce((a, p) => ((a[p.id] = 4000), a), {} as Record<string, number>);
  const ctx = { map: "mirage", stage: "swiss" } as const;
  const w = () => 1;
  const utilTypes = new Set(["flash", "smoke", "molotov", "he"]);

  const withUtil = withSeed(3, () =>
    generateDynamicRound(5, you, opp, armed(you), armed(opp), "standard", "FULL", "FULL", "CT", 5, 5, ctx, 0, 0, money(you), money(opp), helm(you), helm(opp), 0.5, w, w, 14, 14),
  );
  const utilEvents = withUtil.feed.filter((f) => f.type && utilTypes.has(f.type));
  assert.ok(utilEvents.length > 0, "a full-util round should surface utility events");
  // util is purely narrative — no phantom killers/victims
  assert.ok(utilEvents.every((f) => !f.killerId && !f.victimId), "util events must not carry kill/death ids");

  const noUtil = withSeed(3, () =>
    generateDynamicRound(5, you, opp, armed(you), armed(opp), "standard", "FULL", "FULL", "CT", 5, 5, ctx, 0, 0, money(you), money(opp), helm(you), helm(opp), 0.5, w, w, 0, 0),
  );
  assert.ok(
    !noUtil.feed.some((f) => f.type && utilTypes.has(f.type)),
    "a round with zero nades bought should show no utility events",
  );
});

test("generateDynamicRound on mirage: kills are gated to players with line of sight", () => {
  const grid = getNavGrid("mirage");
  assert.ok(grid, "mirage has a nav grid");
  const you = makeTeam("you", 85);
  const opp = makeTeam("opp", 85);
  const armed = (t: FieldTeam) => t.players.reduce((a, p) => ((a[p.id] = "AK-47"), a), {} as Record<string, string>);
  const helm = (t: FieldTeam) =>
    t.players.reduce((a, p) => ((a[p.id] = "helmet"), a), {} as Record<string, "none" | "kevlar" | "helmet">);
  const money = (t: FieldTeam) => t.players.reduce((a, p) => ((a[p.id] = 4000), a), {} as Record<string, number>);
  const ctx = { map: "mirage", stage: "swiss" } as const;
  const w = () => 1;

  let positioned = 0;
  let withLos = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const r = withSeed(seed, () =>
      generateDynamicRound(8, you, opp, armed(you), armed(opp), "standard", "FULL", "FULL", "CT", 6, 6, ctx, 0, 0, money(you), money(opp), helm(you), helm(opp), 0.5, w, w, 0, 0),
    );
    for (const e of r.feed) {
      if ((!e.type || e.type === "kill") && e.killerPos && e.victimPos) {
        positioned += 1;
        if (hasLineOfSight(grid!, e.killerPos, e.victimPos)) withLos += 1;
      }
    }
  }
  assert.ok(positioned > 30, `expected many positioned kills on mirage, got ${positioned}`);
  // The vast majority of kills should be true sightline duels; the small remainder are the
  // push/rotation fallback that keeps rounds from stalling when nobody has LOS.
  assert.ok(withLos / positioned >= 0.8, `most kills should have line of sight, got ${withLos}/${positioned}`);
});

// ===========================================================================
// 3. Determinism & balance sanity
// ===========================================================================

test("same seed produces an identical match", () => {
  const you = makeTeam("you", 83);
  const opp = makeTeam("opp", 81);
  const a = playMatch(123, you, opp);
  const b = playMatch(123, you, opp);
  assert.equal(a.you, b.you);
  assert.equal(a.opponent, b.opponent);
  assert.equal(a.roundWinners.join(","), b.roundWinners.join(","));
});

test("a clear favourite wins the large majority of seeded BO1s", () => {
  const strong = makeTeam("strong", 92, 3);
  const weak = makeTeam("weak", 72, 18);
  const N = 80;
  let strongWins = 0;
  for (let seed = 1; seed <= N; seed += 1) {
    if (playMatch(seed, strong, weak).winner === "you") strongWins += 1;
  }
  assert.ok(strongWins / N >= 0.7, `expected favourite >= 70% win rate, got ${strongWins}/${N}`);
});

test("a mirror match is roughly balanced", () => {
  const a = makeTeam("alpha", 85, 8);
  const b = makeTeam("bravo", 85, 8);
  const N = 100;
  let aWins = 0;
  for (let seed = 1; seed <= N; seed += 1) {
    if (playMatch(seed, a, b).winner === "you") aWins += 1;
  }
  assert.ok(aWins >= 35 && aWins <= 65, `mirror should be ~even, got ${aWins}/${N} for team A`);
});

test("a star on a weak team still frags like a star (not shut down by weak teammates)", () => {
  // One 92-OVR star ("donk") carried by four 70-OVR mates, vs an even 80 team.
  const star: FieldTeam = {
    id: "weak",
    tag: "WK",
    name: "weak",
    country: "US",
    era: "CS2",
    year: "2026",
    accent: "#fff",
    rank: 10,
    players: [
      makePlayer("donk", "Entry", 92, "Aggressive"),
      makePlayer("m-igl", "IGL", 70),
      makePlayer("m-awp", "AWP", 70),
      makePlayer("m-sup", "Support", 70, "Passive"),
      makePlayer("m-rif", "Rifler", 70),
    ],
  };
  const opp = makeTeam("opp", 80, 10);
  const N = 80;
  let rating = 0;
  for (let seed = 1; seed <= N; seed += 1) {
    const final = withSeed(seed * 7 + 1, () => {
      let s = initMatch("inferno", star, opp);
      let guard = 0;
      while (!s.ended && guard < 200) {
        s = playRound(s, star, opp, defaultSettings, difficulties[0], "standard", 0, true);
        guard += 1;
      }
      return s;
    });
    rating += final.yourStats["donk"].rating;
  }
  // Before the carry fix this sat ~0.85 (below average!); a 92-OVR star should clearly outperform.
  assert.ok(rating / N >= 1.05, `star on a weak team should rate well above average, got ${(rating / N).toFixed(2)}`);
});
