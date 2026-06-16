# Round lifecycle: tracing one round end-to-end

This walks a single round through the engine, from the UI tick to the updated `MatchState`.
All function names are in `src/sim.ts` unless noted. Line numbers are approximate (`≈`) and will
drift; trust the function names.

## The big picture

A round is produced in **one** call to `playRound(..., instant=false)` and then *replayed* one
event at a time across **many** subsequent calls. The result (who wins) is decided up front; the
kill feed is generated to narrate it.

```
generate round  ──►  drip event  ──►  drip event  ──► … ──►  finalize round
(1 playRound call)   (1 call each, one FeedLine per call)      (last drip call:
 loads pendingEvents                                            advance score/round/side/economy)
```

In **instant** mode (`instant=true`: skip button, AI sims, spectator) all of this collapses into a
single `playRound` call that returns the fully-advanced state.

---

## Step 0 — The UI tick (`src/App.tsx`)

The `useEffect` that watches `screen === "match"` sets a timer whose delay comes from
`getStepDelay(...)` (`radarSim.ts`). When it fires it calls:

```ts
playRound(current, yourTeam, opponent, settings, difficulty, tactic, activeTimeoutBoost, !realTimeRounds)
```

`!realTimeRounds` is the `instant` flag. In normal live play `realTimeRounds` is `true`, so
`instant=false`. A separate effect watches `match.ended` to roll the series forward to the next map.

---

## Step 1 — `playRound` dispatch (≈ line 1026)

`playRound` decides which of three branches it is in:

1. **Instant flush of a half-dripped round** (≈1039): only when `instant=true` *and* there are
   leftover `pendingEvents`. Applies the saved patch and advances immediately. (Happens when you hit
   "skip" mid-round.)
2. **Streaming drip** (≈1133): `instant=false` and `pendingEvents` is non-empty → emit exactly one
   event (Step 4).
3. **New-round simulation** (≈1345): `pendingEvents` is empty → simulate a fresh round (Steps 2–3).

So during live play the *first* call to a round hits branch 3; every call after that hits branch 2
until the queue drains.

---

## Step 2 — Simulating a fresh round (branch 3, ≈1345)

### 2a. Economy setup (≈1346–1424)
- Seed each player's money (default 800), carried weapons, carried armor from the previous round's
  end state.
- **Halftime reset** (round 13): everyone → \$800, starter pistol for the new side, no armor, streaks
  cleared, economy `ECO`.
- **Overtime start** (round 25, 31, …): everyone → \$10,000, full rifles + helmet, economy `FULL`.
- Tactic override: `save` forces `ECO`, `force` forces `FORCE`.
- `spendMoney(...)` runs for both teams → final `weapons`, `armor`, and post-buy `money`.
  (All the buy edge cases — drops, IGL sacrifice, fallbacks — live here; see `docs/economy.md`.)

### 2b. Strength (≈1429–1496)
```
yourStrength      = teamStrength(you) + mapEdge(you, opp, map)
opponentStrength  = teamStrength(opp, difficulty, isOpponent=true) + …
```
then add, per team:
- **AWP-holder bonus**: `+ (ovr * 0.15)/5` for each player whose equipped weapon is `AWP`.
- **Playoff split deltas** (non-Swiss stages): `getPlayoffDelta(player, oppRank) * 6` if `|delta| ≥ 0.13`
  (negative deltas skipped for `donk`/`m0nesy`).
- **Peaking superstars** (`context.peakingPlayers`, chosen in `initMatch`): `+2.0 + (ovr-85)*0.15 + (aim-75)*0.05`.
- **Cold players** (`context.coldPlayers`): `-(2.0 + (ovr-85)*0.10)` — applies in every stage.

### 2c. Win probability (≈1500–1518)
```
luck            = (rand-0.5) * (settings.luck + difficulty.luck) * 0.34
baseProbability = clamp(0.5 + (yourStrength-opponentStrength)/58
                        + economyMod + sideMod + tacticMod + timeoutBoost + luck, 0.16, 0.84)
probability     = applyEcoUpsetCaps(baseProbability, yourLoadout, opponentLoadout, yourStrength, opponentStrength)
```
- `economyMod` = `economyValue(yours) - economyValue(theirs)` (FULL `+0.035`, FORCE `-0.005`, ECO `-0.055`).
- `sideMod` = CT `+0.015`, T `-0.005`. `tacticMod` from the chosen tactic.
- `applyEcoUpsetCaps` clamps how often a real eco/save can beat a real full buy (and the inverse).

---

## Step 3 — `generateDynamicRound` (≈1816): building the feed

This is where `probability` becomes a play-by-play. It is a **logit random walk**.

- Convert probability to a logit: `logit = ln(p/(1-p)) * 0.7`. Live win-prob is `getP() = sigmoid(logit)`.
- Push a `round_start` `FeedLine` (round 1 also announces peaking 🔥 / cold ❄️ players).
- Loop while `timeRemaining > 0` and round not ended. Each iteration advances 2–6s (2–5s post-plant):
  - **Bomb timer**: if planted and timer hits 0 → `explode`, T win.
  - **Pick an event type** based on alive counts, site control, and desperation: `plant`, `defuse`,
    `kill`, or `idle`.
  - **Save logic** (not on last round of half / match point): a disadvantaged, well-equipped side may
    decide to save, ending the round (T save → time runs out / CT win; CT save under plant → bomb explodes).
  - **`plant`**: set `tPlantedBomb`, `bombTimer=40`, shove the logit toward the T side, push a `plant` line.
  - **`defuse`**: CT win, push a `defuse` line, end round.
  - **`kill`** (≈2053):
    1. `youGetKillProb = clamp(getP() + playerAdvantage*0.045, 0.05, 0.95)`.
    2. Choose killer side by that prob; killer/victim drawn by `pickWeightedBy` using
       `killWeight` / `deathWeight` (role, style, OVR, AWP-skill, donk special-cases).
    3. Remove victim from `alive`.
    4. Nudge the logit: first kill `±0.35`, trade `±0.25`, normal `±0.18`; extra penalty if a star
       (`ovr ≥ 85`) dies.
    5. ~36% chance of an assist (splitting damage); push a `kill` `FeedLine` (with headshot flag).
    6. If a side is wiped → resolve (bomb explode/defuse if planted, else elimination).
- Push a `round_over` line carrying the new CT/T scores and the reason string.
- Return `{ feed, youWin, tPlantedBomb, bombOutcome, roundReason }`.

Back in `playRound` (≈1544+):
- Add kill rewards to money (`getKillReward`: AWP 100, SMG 600, else 300).
- Build per-player stat deltas with `createRoundStatPatch` (kills/deaths/assists/ADR/KAST/firstKills/
  multiKills/clutch, scaled by `playerPerformanceMultiplier`).
- Update loss streaks; compute end-of-round **income** via `roundIncome` (win = 3250; loss = the loss
  bonus for *every* player on the losing team, +800 for a T-side team that planted; see `docs/economy.md`);
  award a random MVP `+300`.
- Compute next-round weapons/armor (dead players reset to the starter pistol, no armor).

---

## Step 3′ — Commit (instant) vs stash (live)

### Instant (`instant=true`, ≈1700)
Apply patches to stats now, compute `youScore`/`opponentScore`, `isMatchOver`, `nextSideAfterRound`,
next economy (`getAutoBuyState` or fresh-half), and **return the advanced state** in one shot.

### Live (`instant=false`, ≈1769)
Return the state **without advancing the round**. Everything is parked in `pending*` fields and the
pre-round stats are snapshotted into `saved*`:
```
pendingEvents, pendingRoundWinner, pendingRoundReason,
pendingYour/OpponentMoney, …LossStreak, …Weapons, …Armor,
savedYour/OpponentStats (+ side stats), pendingYour/OpponentStatsPatch
```
The score, round number, side, and economy are still last round's values. Nothing visible has changed
except that a queue of events now exists.

---

## Step 4 — Dripping events (branch 2, ≈1133)

Each subsequent `playRound` call:
- Pops `pendingEvents[0]`, prepends it to `feed` (capped at 60).
- For a `kill` event, applies that single kill's effects live: killer +kill/+damage, victim +death,
  assist +assist, money reward, strip the victim's weapon/armor — recomputing `recalculateHltvStyleRating`
  per touched line so the on-screen rating ticks in real time.
- Returns with `pendingEvents` one shorter. The UI re-renders; the radar (`simulateRadarPlayers`) reads
  the current feed to animate positions.

When the **last** event is popped (`nextPending.length === 0`, ≈1237) the round is *finalized*:
- Stats = `saved*` + `pending*StatsPatch` (so the dripped-live numbers are replaced by the authoritative
  patched totals — they reconcile to the same place).
- `youScore`/`opponentScore` updated from `pendingRoundWinner`.
- `ended = isMatchOver(...)`, `winner` set if ended.
- `side = nextSideAfterRound(...)`, economy via fresh-half or `getAutoBuyState(...)`.
- All `pending*`/`saved*` cleared. `round` increments.

The match effect in `App.tsx` then either schedules the next tick (new round → back to Step 1, branch 3)
or, if `ended`, transitions to the result/next-map screen.

---

## One-line summary

> `playRound` once **decides and scripts** the round into `pendingEvents`; it is then called repeatedly to
> **play that script back** one kill at a time, and the final playback call **commits** the score, side,
> and economy. `instant=true` does all three in a single call.
