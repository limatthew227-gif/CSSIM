# Code-constructed maps & navigation

## Why this exists

The radar used to position players over a stretched PNG (`backgroundSize: 100% 100%`) and move them
along ~10 hand-drawn polylines between a handful of nodes (`radarSim.ts`'s `getPathBetween`). A PNG
carries **no walkable data**, the polylines weren't registered to the image, and any movement outside
the predefined node-pairs fell back to a **straight line through walls**. You can't get real navigation
on top of a picture.

So maps are now **defined in code** as vector geometry that is both *rendered* and *navigated* — the
thing you see is the thing players path through, perfectly registered.

## Architecture (`src/mapGeometry.ts`)

```
walkable polygons (square 0..100 space)
        │  rasterize (buildNavGrid)
        ▼
   occupancy grid  ──►  Theta* any-angle pathfinding (findPath)  ──►  smooth routes
        │                                                                  │
        └──► line-of-sight ray-walk (hasLineOfSight) ◄── smokes            └── mollies reroute
```

- **Geometry**: each `MapGeometry` is a set of `walkable` polygons (corridors, sites, connectors,
  spawns), optional `walls` carved out, plus `spawns` / `sites` / `mid` / named `regions`. All in a
  fixed **square** `0..100` space — CS radars are square, which removes the old aspect-ratio stretch.
- **Occupancy grid**: `buildNavGrid(geo, res=160)` samples each cell center for walkability →
  `blockedMove` / `blockedVision` bitmaps. `getNavGrid(mapId)` memoizes per map.
- **Pathfinding**: `findPath(grid, start, goal, { mollies })` runs **Theta\*** (any-angle A\*), so
  routes are straight, corner-hugging, and near-shortest — nav-mesh/funnel-quality motion without the
  cost of runtime mesh editing. Endpoints are pinned exactly; intermediate waypoints never cross a wall.
- **Line of sight**: `hasLineOfSight(grid, a, b, smokes)` ray-walks the vision grid and also tests
  smoke circles.

### Why grid + any-angle instead of a nav-mesh

The goal is dynamic, in-match utility:

| Utility | Effect | Grid cost | Nav-mesh cost |
|---|---|---|---|
| **Molotov** | blocks *movement* in an area | flip cells → re-path (trivial) | cut a hole + re-triangulate + re-funnel (hard) |
| **Smoke** | blocks *line of sight* | ray-walk fails through smoked cells (trivial) | polygon ray-cast (harder) |

Dynamic obstacles are a nav-mesh's weak spot and a grid's strong suit, and Theta\* gives the grid
nav-mesh-looking motion. The authoring input (walkable polygons) is the same either way, so a
triangulated nav-mesh backend remains possible later without re-authoring maps.

## API summary

| Export | Purpose |
|---|---|
| `MapGeometry`, `Vec`, `Circle`, `MapRegion`, `NavGrid` | types |
| `mapGeometries` | `Partial<Record<MapId, MapGeometry>>` — authored maps |
| `buildNavGrid(geo, res?)` / `getNavGrid(id)` | rasterize / memoized grid |
| `findPath(grid, start, goal, { mollies? })` | any-angle route (Vec[]) |
| `hasLineOfSight(grid, a, b, smokes?)` | vision query |
| `isWalkablePoint`, `pointInPolygon`, `pathLength` | helpers |

Determinism: pathfinding uses no `Math.random` (fixed neighbour order, heap tie-break by key), so the
radar stays reproducible.

## Authoring a new map

1. Add a `MapGeometry` to `mapGeometries` keyed by `MapId`: cover the floor with `walkable` rectangles/
   polygons (overlap them generously at junctions so the grid stays connected), set `spawns`/`sites`/
   `mid`/`regions`. Trace the existing radar PNG for proportions.
2. `getNavGrid(id)` picks it up automatically.
3. Sanity-check with a test like the mirage ones (`tests/mapGeometry.test.ts`): spawns/sites walkable,
   a route between them crosses no wall.

## Status / remaining work

- ✅ Nav engine + dynamic util hooks + tests.
- ✅ First map authored: **mirage** (simplified floorplan — refine proportions against the PNG).
- ⏳ **Wire into the radar**: `radarSim.ts` should route via `findPath` (replacing `getPathBetween`,
  with per-segment path caching since `getPlayerPositionAtStep` runs every frame), and `App.tsx`
  should render the geometry as SVG in a square container (PNG demoted to an optional underlay).
- ⏳ Author the other 6 maps (inferno, dust2, nuke, ancient, anubis, train) to the same schema.
- ⏳ (Future) in-match smokes/mollies driving `findPath`/`hasLineOfSight` during a round.
