# Maps & navigation

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
- ⏳ (Future) in-match smokes/mollies driving `findPath`/`hasLineOfSight` during a round.
