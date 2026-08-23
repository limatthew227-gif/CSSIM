# Voxel map pipeline

The 3D observer uses the same normalized `0..100` radar coordinate space as the round simulator. Its
terrain is generated from real CS2 navigation areas rather than inferred from screenshots:

```text
Awpy nav JSON + radar transform + Source 2 VPhys collision triangles
                              │
                              ▼
scripts/generate-voxel-map-data.ts
                              │
                              ├── 56×56 walkable surface
                              ├── 112×112 movement + elevation grid
                              ├── smoothed source Z elevation
                              ├── overlapping lower surface (when present)
                              └── sparse wall cells and collision heights
                              │
                              ▼
src/voxelMapData.ts ──► src/voxelMaps.ts ──► MatchVoxelView
```

## Current coverage

Mirage, Inferno, Dust2, Nuke, Ancient, Anubis, and Train all have source-derived floors, elevations,
and wall silhouettes rasterized from Source 2 physical-collision triangles. Nuke retains its
overlapping lower level. A local median pass removes isolated nav-area height spikes, while the
collision pass replaces the earlier noisy "wall around every floor edge" heuristic.

`src/voxelMaps.ts` adds the deliberately Minecraft-like visual treatment: palettes and a small set
of recognizable landmarks such as trains, silos, bridges, canal water, temple pillars, and site
crates.

The generated browser module contains only compact numeric occupancy, elevation, and collision
grids. It does not bundle Valve textures, models, or exported map meshes.

## Regenerate from Awpy

[Awpy](https://github.com/pnxenopoulos/awpy) is MIT-licensed. Its
[navigation-mesh guide](https://awpy.readthedocs.io/en/latest/examples/nav.html) documents
`awpy get navs`, `awpy get maps`, the JSON nav-area format, and each area's 3D corners.

Either let the generator fetch the pinned resource patch:

```bash
npm run generate:voxel-maps -- --download
```

Or use an existing Awpy data directory:

```bash
python3 -m pip install awpy
awpy get navs
awpy get maps
awpy get tris
npm run generate:voxel-maps -- --awpy-root ~/.awpy
```

The default source is pinned to Awpy patch `17595823` so local builds remain deterministic. When
upgrading the source patch, change `AWPY_PATCH` in the generator, regenerate, run the test suite, and
visually check map landmarks before committing.

## Source 2 Viewer reference pass

[Source 2 Viewer / ValveResourceFormat](https://github.com/ValveResourceFormat/ValveResourceFormat)
19.2 is the verified reference tool for this pipeline. Its cross-platform
[command-line utility](https://s2v.app/ValveResourceFormat/guides/command-line.html) can inspect
VPK contents and decompile supported Source 2 resources. The
[map export guide](https://s2v.app/ValveResourceFormat/guides/exporting-maps.html) documents the
official map VPK and `.vmap_c` layout and glTF export workflow.

The current committed wall grid uses Awpy's pinned `.tri` artifacts, which are float32 triangles
parsed from the same Source 2 VPhys collision resources. This keeps regeneration deterministic and
small. When a local CS2 install is available, Source 2 Viewer can be used to export a temporary glTF
reference for a direct visual comparison of silhouette, height transitions, and landmark placement.
Keep these exports in `scratch/`; do not commit extracted Valve textures, models, or meshes.

## Integration contract

- `MAP_LAYOUTS[map]` defines the semantic anchors: spawns, sites, mid, and strategy destinations.
- `getVoxelMap(map)` provides the source-derived visual surface plus a separate dense navigation
  raster in `navOccupied` and `navHeights`.
- `getNavGrid(map)` uses that dense raster as the movement authority for non-Mirage maps. It keeps
  the largest connected walkable surface, checks elevation changes, and routes every simulated
  movement leg around blocked cells instead of interpolating through walls. Mirage retains its
  existing detailed timeline/nav engine.
- `radarSim.ts` assigns every role a phase plan on that same grid: default, contact/execute, and
  post-plant/retake. Entries and traders share a lane at different depths; support and IGL use a
  second lane; the AWP keeps a long sightline. CT defaults use a 2–1–2 shell and retakes reserve
  several approach pockets instead of sending the five players to the bomb marker.
- Phase destinations use deterministic occupancy reservations with a minimum teammate separation.
  This prevents three-player clumps without applying per-frame repulsion, which would reintroduce
  visible jitter.
- `getVoxelMap(map).walls` and `wallHeights` provide the sparse Source 2 collision silhouette.
- `voxelSurfaceAt(map, point)` resolves players, bombs, utility, traces, sites, and spawns to the same
  vertical surface. Nuke's B zone intentionally prefers the generated lower layer.
- `VOXEL_MAP_PROFILES[map]` owns only presentation and recognizable voxel landmarks.
- `tests/voxelMaps.test.ts` guards full map coverage, coordinate registration, wall-safe movement
  routes, and the Nuke lower layer.

The simulation therefore consumes the same spatial source as the 3D observer without coupling game
logic to Three.js or to decorative voxel props.

## Demo spacing calibration

`npm run analyze:demo-spacing -- /path/to/map.dem [...]` samples real CS2 demos at 0.5-second
intervals, transforms world positions with the pinned Awpy overview scale, and reports nearest
teammate distance, full-team spread, and three-player pocket frequency for spawn, default, contact,
execute, and post-plant phases.

A calibration pass over the local NAVI–G2 Dust2/Inferno and 9z–FURIA Dust2 demos found that spawn
packs are naturally tight, but three-player pockets inside four radar units fall to 0–5% during
executes and post-plants. Median nearest-teammate distance during those phases was roughly 8–19
radar units. The runtime therefore allows a close entry/trader pair, reserves separate phase
pockets for everyone else, and deliberately does not apply the same separation rule at spawn.
