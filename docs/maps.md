# Maps & navigation

> **Update (current):** Mirage navigation now runs on a **tactical callout graph** (`src/mirageNav.ts`
> + `src/pathfinder.ts`), NOT the radar pixels. A flat 2D grid can't represent Mirage's elevation
> (palace over A, underpass under mid, ramps, connector), so the sim and radar route callout-to-callout
> with weighted A*/Dijkstra; kills are gated to players in contact on the graph. The pixel grid below
> is superseded for mirage (it still flags "render the real PNG"); the sections below describe the
> earlier grid approach and remain accurate for non-graph maps. See **Tactical graph** at the bottom.

## Why this exists

The radar used to position players over a stretched PNG and move them along ~10 hand-drawn polylines
between a handful of nodes (`radarSim.ts`'s `getPathBetween`). A PNG carries **no walkable data**, the
polylines weren't registered to the image, and movement outside the predefined node-pairs fell back to
a **straight line through walls**. So players couldn't actually navigate the map.

Two ways to give a map real navigable structure:

1. **Pixel-accurate grid baked from the radar image** (preferred). The radar PNG *is* the authentic
   map, so we classify its pixels into a walkable occupancy grid. Accurate by construction — no
   eyeballing. This is what **mirage** uses, and the real radar PNG is rendered as the map.
2. **Hand-authored vector polygons** (fallback). Define the floor as polygons in 0..100 space and
   rasterize them. Useful only if a map has no usable radar image; hand-tracing is hard to get right
   (an early hand-traced mirage looked "very off"), so prefer option 1 whenever a radar PNG exists.

Both feed the same grid → pathfinding → line-of-sight engine.

## Architecture (`src/mapGeometry.ts`)

```
radar PNG ──► classify pixels (scripts/derive-navgrid.ts) ──► baked mask (src/navGrids.ts)
                                                                   │  decode
walkable polygons (0..100) ──► rasterize (buildNavGrid) ───────────┤
                                                                   ▼
                                                          occupancy grid (NavGrid)
                                                                   │
                              Theta* any-angle pathfinding (findPath) ──► smooth routes
                                                                   │            └── mollies reroute
                              line-of-sight ray-walk (hasLineOfSight) ◄── smokes
```

- **`getNavGrid(id)`** returns the grid for a map, memoized. It prefers the baked pixel grid
  (`navGrids[id]`); else rasterizes hand polygons (`mapGeometries[id]`); else null.
  `hasPixelNav(id)` reports which path a map uses.
- **NavGrid**: `blockedMove` / `blockedVision` bitmaps over a `res×res` grid (128 for baked maps,
  160 for rasterized polygons).
- **Pathfinding**: `findPath(grid, start, goal, { mollies })` runs **Theta\*** (any-angle A\*) — straight,
  corner-hugging, near-shortest routes (nav-mesh/funnel-quality motion) that never cross a wall.
- **Line of sight**: `hasLineOfSight(grid, a, b, smokes)` ray-walks the vision grid and tests smoke
  circles. Determinism: no `Math.random` anywhere in the nav code, so the radar stays reproducible.

### Why grid + any-angle (not a nav-mesh)

The end goal is dynamic, in-match utility, and that's where a grid wins:

| Utility | Effect | Grid cost | Nav-mesh cost |
|---|---|---|---|
| **Molotov** | blocks *movement* in an area | flip cells → re-path (trivial) | cut a hole + re-triangulate + re-funnel (hard) |
| **Smoke** | blocks *line of sight* | ray-walk fails through smoked cells (trivial) | polygon ray-cast (harder) |

Theta\* gives the grid nav-mesh-looking motion, and a grid drops straight out of the radar pixels.

## Deriving a map from its radar image (preferred)

`scripts/derive-navgrid.ts` reads `src/assets/radar/<map>.png`, classifies each cell (navy floor +
coloured sites/spawns = walkable; black void + white wall lines = blocked), keeps only the connected
component reachable from the spawns/sites (drops the logo and stray blobs), bit-packs the blocked mask
to base64, and writes `src/navGrids.ts`. It also emits `scratch/<map>-navmask.png` (a red overlay on
the radar) so you can confirm the mask matches the floor.

```
npx tsx scripts/derive-navgrid.ts mirage
qlmanage -t -s 760 -o /tmp scratch/mirage-navmask.png   # macOS: rasterize to inspect
```

Then give the map a `MapGeometry` entry with `spawns`/`sites`/`mid` (read from the image) and callout
`labels`, leaving `walkable`/`walls` empty. `MAP_LAYOUTS[map]` in `radarSim.ts` also needs accurate
`tSpawn`/`ctSpawn`/`bombsiteA`/`bombsiteB`/`mid` (it drives where radar players spawn and head). Sites,
spawns and callouts should be cross-checked against web callout guides (e.g. A = triple-box site,
B = market site).

## Rendering

`App.tsx` `MatchMapView`: pixel-nav maps render the real radar PNG with callout labels and player dots
overlaid (no vector floor). Pure-polygon maps render the vector floor as SVG with an optional image
underlay toggle. Legacy maps (no geometry) render the PNG + legacy node movement.

## Line-of-sight kills (mirage)

On pixel-nav maps, `generateDynamicRound` (in `sim.ts`) runs a lightweight position model alongside
the existing OVR/logit simulation: each player advances from spawn → objective (site/mid by role and
T strategy, matching the radar) and then pushes toward the enemy centre. When the round wants a kill,
it only allows killer/victim pairs that have **line of sight** (`hasLineOfSight` on the nav grid);
*who* wins among the visible pairs is still decided by `killWeight`/`deathWeight` (OVRs, roles, form).
If nobody is in sight yet the kill waits (players keep approaching); a cap + low-time + last-player
fallback guarantees the round still resolves via a push/rotation engagement. Kill events carry the
resolved `killerPos`/`victimPos`, which the radar uses to show each duel where it happened. Maps
without a baked grid keep the original position-agnostic kill logic untouched.

## Status

- ✅ Nav engine (grid + Theta\* + LOS) with molly/smoke hooks; tests in `tests/mapGeometry.test.ts`.
- ✅ **mirage**: pixel-accurate grid baked from the radar (`navGrids.ts`), the real radar PNG rendered
  as the map, accurate spawns/sites, and callout labels (A, B, T, CT, Mid, Window, Connector, Jungle,
  Palace, Ramp, Top Mid, Short, Apps, Market). Players route on the real floor.
- ✅ Tools: `scripts/derive-navgrid.ts` (pixel extraction + mask overlay), `scripts/preview-map.ts`
  (`npm run preview:map`, for hand-authored polygon maps).
- ⏳ Bake the other 6 maps (inferno, dust2, nuke, ancient, anubis, train) — run `derive-navgrid.ts`
  per map and add their `MapGeometry` labels/spawns + `MAP_LAYOUTS` coords. Until then they fall back
  to legacy node routing + PNG automatically.
- ⏳ Fine-tune mirage callout label positions if any read slightly off.
- ⏳ (Future) in-match smokes/mollies.

## Tactical graph (mirage — current nav)

> **Calibrated from a real CS2 demo (not eyeballed).** `scripts/calibrate-mirage.ts` parses a demo,
> and because CS2 tags every player tick with its callout (`last_place_name`), each node's radar
> coordinate is the **centroid of real positions** in that callout and each edge is a **real
> player transition** between callouts. This corrected a hand-authored graph that was significantly
> wrong — A/B were swapped and most callouts mirrored. True orientation: **B site upper-left, A site
> bottom-centre, T spawn right, CT spawn lower-left**; the apartments take is `Side Alley → House →
> Back Alley → Apartments → Van → B`. Walk speed (`WALK_SPEED` in `mirageRoundSim.ts`) is the demo's
> measured ~5 radar-units/sec. To recalibrate: `npx tsx scripts/calibrate-mirage.ts <demo.dem>`.

`src/mirageNav.ts` defines the callout graph: **nodes** are the key callouts (`x/y` radar coords,
`z/floor` elevation metadata, `type`), **edges** are real connections with tactical data (`travelTime`, `exposure`, `noise`,
`chokepoint`, `utilityValue`, one-way `drop`s like palace→A, `requires`, `tags`). `src/pathfinder.ts`
provides `edgeCost(edge, roundState)` (exposure × AWP pressure, choke × utility, post-plant rotate
discount, saving) and `findRoute` (weighted Dijkstra), plus `worldToRadar`.

**Wired in (Phase 2):**
- `generateDynamicRound` (sim): each player routes spawn→objective callout via `findRoute` with a
  per-side `RoundState` (AWP pressure, utility, plant). Position interpolates along the route over the
  round; **kills are gated to pairs `areConnected` on the graph** (same/adjacent callout — elevation
  aware, no false 2D sightlines). OVR/role weighting still decides the winner. A no-contact cap/
  cleanup fallback keeps rounds resolving. Kill positions are attached for the radar.
- `simulateRadarPlayers` (radar): player movement routes on the graph (`graphRoute`), never on the
  radar pixels. The PNG is background only.
- The pixel grid (`navGrids.ts` / `getNavGrid` / Theta\*) is **no longer used for pathing** — it only
  survives as the `hasPixelNav` flag that tells the renderer to show the real radar PNG.

**Tests:** `tests/mirageNav.test.ts` (graph connected, A/B routing, one-way palace, round-state cost),
plus the sim's graph-contact engagement test.

**Phase 3 (RoundAI + markers):** `src/roundAI.ts` decides objectives by phase — pre-plant executes
(T by strategy with a lurker taking an off-angle; CT default holds) and **post-plant retake/hold** (CT
rotates to the planted site, T holds it, lurker watches the flank), plus a `saving` bias — and builds
the `RoundState` the pathfinder weights with. `generateDynamicRound` re-plans on the plant event
(re-routing alive players from where they are) and tags the plant with its site; `simulateRadarPlayers`
puts the bomb there. Utility events carry the thrower's position, and the radar renders **smoke clouds
/ molotov fire / flash / HE markers** at those spots.

**Movement polish (done):** each player has a `yaw` (movement direction, falling back to facing their
objective when holding) drawn as a facing tick on the radar. Routes are NOT Chaikin-smoothed — the
any-angle corridor path is already corner-hugging and strictly on the floor, and smoothing shaved it
back into walls (then snapping it out jittered).

**Constant-speed movement (done):** the radar used to give every waypoint leg equal real time, so a
long route crammed into one event-step rendered as a "supersonic" sprint, and the plant handler froze
players at spawn (so some never moved). Now `simulateRadarPlayers` **re-times** each player's waypoints
(step 4c) so every leg spans at least `corridorLength / WALK_SPEED` event-steps — the dot moves at a
constant `WALK_SPEED` (15 radar-units/step), reaching its spot and holding when it has time to spare.
The plant handler sends players to their pre-plant objective (not a spawn freeze), and the post-kill
drift runs over the rest of the round instead of a one-step hop. Measured over 30 rounds: max speed
126 → 15 u/step, supersonic samples 1127 → 0, stuck players 3 → 0.

**Labels:** pixel-nav maps (mirage) render the real radar PNG, which carries its own callouts, so the
overlaid callout labels (which didn't register to the image) are omitted there; vector-floor and
legacy maps still draw theirs.

**Plausible kill rendering + no ghosts (done):** the sim gates kills to graph-adjacent callouts, but
adjacent callouts can be far apart on the radar, so a duel's two route positions could draw a long
trace across (or through) buildings. `radarSim.plausibleEngagement` caps the killer↔victim render
distance (`MAX_ENGAGE`) and, for the longer shots, pulls the victim in until the straight line has
line-of-sight on the vision grid (`hasLineOfSight`) — close-range duels are left alone (grid LOS is
noisy across thin 1-cell walls). Over 40 rounds: rendered trace distance avg 14.7 → 6.0 u, max
56.6 → 19.1, shots >30u 22% → 0%. The sim's kill *selection* (OVR/role/form + graph contact) is
unchanged — this only moves where the duel is *drawn*. Separately, dead players now freeze at the spot
they died (`deathPos`) instead of continuing along their route, which fixed dead "ghost" dots that
kept drifting (42% of dead samples were still moving → 0%).

**Corridor-snap (look fix, done):** so movement doesn't cut across buildings on the PNG, each
callout→callout leg of a route is shaped to hug the real corridor via `pathfinder.corridorPath` —
which routes the segment (any-angle) on the radar's walkable pixel mask (`getNavGrid`/`findPath`).
This is **visual only**: the graph still owns all connectivity, objectives and line-of-sight; the
pixel mask just bends the *drawn* path to follow the floor. Both `radarSim` (movement) and
`generateDynamicRound` (kill positions) use it; kills also carry the engagement's two callouts
(`FeedLine.engage`) so the gating is testable.

**Wall-snap + no teleports (done):** corner-smoothing (Chaikin) could still shave a route into a wall
corner, and a stray kill spot could land just off the floor. `mapGeometry.snapToWalkable(grid, p)`
pushes any blocked point to the nearest free cell (and is a no-op when already on the floor, so smooth
motion is preserved); `radarSim` applies it to every rendered player position, smoothed route vertex,
kill trace and the bomb. Measured over 20 real rounds: rendered positions on a wall went to **0%**.
Separately, two waypoints sharing a step (e.g. a post-kill "head to dest" point colliding with a
second kill on the very next event) made the dot teleport across the map; `radarSim` now collapses
duplicate-step waypoints (latest wins) — **0 teleport jumps** over the same sample.

**Remaining:** economy-driven saves, and extending the graph to the other maps (they still use the
legacy straight-line node paths).

## Mirage: real spatial round (`src/mirageRoundSim.ts`)

The biggest change: on **mirage the round outcome EMERGES from the map**, instead of being a
probability that kills are narrated onto. `simulateMirageRound` runs a time-stepped sim (0.5s ticks,
115s):

- **Navigation + roles.** 10 players route from spawn to role-based objectives (`roundAI.objectiveFor`
  — entry/support/AWP push the execute, the lurker takes an off-angle, CTs spread across sites + mid)
  along corridor-snapped graph routes. They spread across approaches — no funnelling through one choke.
- **LOS duels DRIVE the result.** A kill only happens when two enemies are within range AND have real
  `hasLineOfSight` on the nav grid. A contact starts a duel with a reaction timer (so deaths are paced,
  not instant), then one dies. **Who wins** is skill-weighted (killWeight/deathWeight ratio, compressed
  so a small OVR gap doesn't snowball over a match), plus holder/AWP/crossfire factors and a
  team-strength bias (`initialProbability`) so aggregate win rates still track team strength.
- **Bomb.** A T carrier plants when on-site and uncontested; post-plant everyone re-plans (CT retake /
  T hold / lurker flank). Round ends by elimination, explode, defuse, or time.
- **Output.** The same `FeedLine[]` (economy/stats unchanged) — each kill carries its real
  `killerPos`/`victimPos`/`t` — PLUS a per-player **position timeline**. `playRound` stores the timeline
  on `MatchState.roundTimeline`; `simulateRadarPlayers` plays it back so the radar shows the engine's
  ACTUAL movement and duels (no reconstruction, no funnel/teleport). Non-mirage maps are unchanged.

Measured (real weights): even teams ~51% round win; 5-OVR gap ~79% match, 8-OVR ~92%, upsets still
happen; ~6.8 kills/round; first death ~7.6s; T/CT ~54/46; **0% through-wall kills**. Tunables live at
the top of `mirageRoundSim.ts` (`WALK_SPEED`, `SIGHT_RANGE`, `TTK_BASE`, `SKILL_W`, `TEAM_W`, …).

**AI variety + aggression.** T takes spread across distinct approaches via per-slot route plans
(`tPlan`): ramp, palace, mid→connector→A, mid→cat→short→B, apps, underpass lurk — not one choke. CTs
spread to hold their site/mid (`ctObjective`) and some PUSH out to an extremity (ramp / apps / top-mid)
— aggressive-style riflers always, more of them on an `"aggressive"` round call (`tactic`), capped at
2 so the site isn't abandoned.

**Radar playback pacing.** The map view plays the timeline at a CONSTANT real rate: `getStepDelay`
scales each step by the sim-time gap to the next event (`MS_PER_SIM_SEC`, clamped), so movement no
longer lurches faster/slower with how close kills are. The animation `fraction` is reset synchronously
(`useLayoutEffect`) when a new event lands, killing the one-frame "teleport twitch" where a dot
overshot and snapped back.

> Note: the legacy mirage graph-gating inside `generateDynamicRound` (`routeOf`/`posOf`/`areConnected`
> kill-gating) is now **superseded and unreachable** for mirage (the spatial branch returns first); it
> remains only as dead code pending cleanup. Non-mirage maps never used it.
