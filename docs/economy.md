# Economy model and edge cases

The money/buy system lives in `src/sim.ts`, mainly in `getAutoBuyState` (the buy *decision*) and
`spendMoney` (the buy *execution*), with income applied at the end of `playRound`. It is a CS2-flavored
approximation, not a faithful simulation — several behaviors are deliberate simplifications and a couple
are arguably bugs. They are all documented here. Line numbers are approximate.

## Money lifecycle in one round

1. Start of round: seed money from previous round's end state (or \$800 at match start / halftime;
   \$10,000 at overtime start).
2. `getAutoBuyState` decides each team's buy state for the round: `ECO | FORCE | FULL` (unless the tactic
   forces it, or it's a fresh-half/OT buy).
3. `spendMoney` turns money + carried gear into final `weapons`, `armor`, and post-buy `money`.
4. The round plays out; **kill rewards** are added to killers' money.
5. End of round: **income** is added (win bonus, loss bonus, plant bonus, MVP), then everything is clamped
   to `[0, 10000]`.

## Constants

| Thing | Value |
|---|---|
| Pistol-round start money | \$800 |
| Full-buy threshold | **CT \$4,700 / T \$4,200** (CT costs more: M4 + kit) |
| Round win income | \$3,250 / player |
| Loss bonus | `1400 + min(lossStreak, 4) * 500` → \$1,400 … \$3,400 |
| Plant bonus (on a *lost* round) | \$800 |
| MVP bonus | \$300 to a random player on the winning team |
| Kill reward | **AWP \$100**, SMG (MP9/MAC-10) \$600, everything else \$300 |
| Money clamp | \$0 … \$10,000 |
| Overtime start money | \$10,000 + full rifles + helmet |
| Grenade costs | flash \$200, smoke \$300, HE \$300, molotov \$400 (T) / incendiary \$600 (CT) |

## `getAutoBuyState` decision order (≈595)

```
avg = mean(player money for the side)
threshold = side === "CT" ? 4700 : 4200
1. if avg >= threshold                       -> FULL
2. else if wonPrevRound                       -> FORCE
3. else (lost prev round):
   lossBonus = 1400 + min(lossStreak,4)*500
   if avg + lossBonus >= threshold            -> ECO       (anticipatory save)
   else                                        -> avg >= 2000 ? FORCE : ECO
```

### Edge cases / quirks in the buy decision

- **Winners never save.** Rule 2 short-circuits to `FORCE` before any save logic. A team that just won
  but is below the full-buy threshold will always force-buy, never eco. (Realistic for keeping pressure,
  but it means a poor team on a win streak keeps half-buying instead of resetting.)
- **Anticipatory eco (rule 3a).** If the side is close enough that *this round's loss bonus* would push
  them over the threshold, they save now to guarantee a full buy next round. This is the main "save" path.
- **The \$2,000 force line.** A team that lost, can't anticipatory-save, but has avg ≥ \$2,000 will `FORCE`
  rather than fully eco. Below \$2,000 they full eco.
- **Threshold is per *current* side.** Because CT and T thresholds differ, the same bankroll can read as a
  full buy on T but a force on CT.

Tactic overrides (set in the UI) bypass this entirely: `save` → `ECO`, `force` → `FORCE`.
Fresh-half buys (round 13) and OT starts (round 25, 31, …) also bypass it.

## `spendMoney` execution (≈616) — the buy itself

Per buy state:

- **FULL**: AWPers buy/keep an `AWP`; others keep an existing rifle or buy M4A4 (CT) / AK-47 (T) + helmet.
- **FORCE**: AWPers try an AWP at descending armor tiers (\$5,750 helmet → \$5,400 kevlar → \$4,750 none),
  else keep a rifle/SMG, else buy a Famas/Galil or MP9/MAC-10 + kevlar. Others keep a rifle/SMG or buy a
  mid-tier gun + kevlar.
- **ECO**: keep an existing rifle/SMG for free; otherwise maybe (money ≥ \$1,000) buy a Deagle/P250, else
  stay on the starter pistol.

### Edge cases / quirks in the buy execution

- **Drop system (FULL only).** If a player can't afford their full buy, a teammate who can afford their
  *own* buy plus the needy player's weapon cost will "drop" them a gun.
- **Receive priority: AWP > high-OVR > … > IGL.** The needy list is sorted so the AWPer is armed first and
  star (high-OVR) players are prioritized; the IGL is helped last.
- **The IGL is the designated sacrifice.** Free droppers prefer the IGL. If there's no free dropper and the
  needy player isn't the IGL, the IGL **gives up their own buy** (downgrades to the starter pistol, no armor)
  to arm the teammate.
- **Post-drop SMG pickup.** A player left on the starter pistol after dropping/sacrificing (e.g. the IGL)
  will spend leftover money on an MP9/MAC-10 (+kevlar) or an upgraded pistol — so a sacrificing IGL usually
  isn't completely naked.
- **FULL overspend fallback.** If a player is flagged FULL but still can't afford anything after fallbacks,
  the final spend loop resets them to the starter pistol with \$0. A mispriced full buy can leave someone naked.
- **Random weapon picks use `Math.random`** (Deagle vs P250, Famas vs MP9, etc.), so `spendMoney` is *not*
  deterministic without stubbing RNG.

## End-of-round income

Computed by the exported helper **`roundIncome({ won, side, planted, lossBonus })`** (with
`lossBonus = lossBonusForStreak(streak)`), called once per team inside `playRound`:

```
win:  +3250  (every player)
loss: +lossBonus  (every player on the losing team, any side, survivors included)
      + 800 extra to a T-side team that planted the bomb but still lost
MVP (random winner): +300
```

### Edge cases / quirks in income

- **Loss bonus reaches the whole losing team.** Every player on the losing side gets the full loss
  bonus regardless of side or whether they survived. Survivors *additionally* keep their weapons
  (modeled by weapon carry-over). _(Fixed bug: an earlier version paid T-side survivors of an
  unplanted lost round \$0 — see the `roundIncome` regression test in `tests/sim.test.ts`.)_
- **Plant bonus survives a loss.** Ts who planted but lost the round still get `+800` on top of the loss
  bonus, matching real CS2. CT teams never receive it.
- **Kill rewards favor rifles over the AWP.** An AWP kill is only \$100 (anti-AWP-economy, matches real CS2);
  SMG kills are \$600; everything else \$300. AWP-heavy teams accrue less round-to-round cash from fragging.
- **Loss streak is capped at 4** for the bonus (max \$3,400) and is reset at halftime and OT.
- **Everything clamps to \$10,000.**

## `applyEcoUpsetCaps` (economy-adjacent, ≈986)

Not part of buying, but it caps the *win probability* of a genuine eco/save against a genuine full buy
(`hasRealFullBuy`: ≥3 primaries and ≥3 armor). A naked eco is capped lower than an eco holding a pistol/SMG,
and a large strength advantage raises the cap. This is what stops ecos from winning too often regardless of
the buy decisions above.

## Utility (grenades)

Utility is modeled as a real economy cost plus a skill multiplier on round win-probability
(no per-nade physics — that would not fit an outcome-first sim).

**Buying (in `spendMoney`).** After the weapon + armor buy, each player spends *leftover* cash on
nades (cheapest-first: flash → smoke → HE → molotov/incendiary), capped at 4 nades for Support/IGL
and 3 for others on a full buy, 2 on a force, and 0 on an eco. Because it spends only what's left,
a full buy naturally fields lots of util while ecos/forces are util-starved — no separate gating
needed. Nades are consumed each round (not carried), so `finalUtility` is a pure per-round count and
util spend never drives a player below \$0.

**Effect on the round (in `playRound`).**

```
utilEdge = utilityRating(you)      * utilFactor(yourNades)
         - utilityRating(opponent) * utilFactor(oppNades)
utilMod  = clamp(utilEdge * 0.012, -0.04, +0.04)        // added into baseProbability
```

- `utilityRating(team)` (0..4): a money-independent skill score from dedicated Support players, the
  IGL's `igl` stat, average `consistency`, and a Tactical/Discipline coach.
- `utilFactor(nadeCount)` (0..1): `clamp(nadeCount / 12, 0, 1)` — 0 on a full eco, ~1 on a full util
  load. This is what ties util effectiveness to having actually bought nades.
- Net effect: the better-util team gains more from an equivalent buy, and util barely matters on ecos.
  The `±0.04` cap keeps it a nudge (about side-advantage magnitude), not a dominant term.

**Phases shipped:**
- **Phase 1** — economy + win-probability (everything above).
- **Phase 2** — narrative utility events in the live kill feed. `generateDynamicRound` spends each
  team's per-round nade budget on `flash`/`smoke`/`molotov`/`he` feed events (T execute setup, CT area
  denial, and a flash before ~28% of kills which tags the kill `flashAssist`). These are **cosmetic** —
  they never change the round outcome, scores, or player K/D (`createRoundStatPatch` only processes
  kills). Icons live in `src/assets/utility/`, rendered via `utilityIcons` in `App.tsx`.
- **Phase 3** (radar visuals) — not done.

Exports `utilityRating`/`utilFactor`/`spendMoney`/`generateDynamicRound` are covered by `tests/sim.test.ts`.

## If you change the economy

- Keep the side-specific thresholds (`4700`/`4200`) in sync with the full-buy weapon+armor costs in
  `spendMoney`, or `getAutoBuyState` will mis-classify buys.
- The AWP kill reward (\$100) and the side-specific full-buy thresholds are the most surprising knobs —
  call them out in any balance PR.
- Run `npm test` (`tests/sim.test.ts`) — it unit-tests `roundIncome`, `lossBonusForStreak`, `getKillReward`,
  and `getAutoBuyState`, plus seeded full-match money invariants. For interactive spot-checks, adapt
  `test_economy.ts` (it stubs `Math.random` and prints money/weapons per round).
