import { MatchState, FieldTeam } from "./sim";
import { MapId, Player } from "./gameData";
import { findRoute, corridorPath } from "./pathfinder";
import { nearestNode } from "./mirageNav";
import { getNavGrid, snapToWalkable, hasLineOfSight } from "./mapGeometry";
import type { TimelineFrame } from "./mirageRoundSim";

const onMapFloor = (mapId: MapId, point: Position): Position => {
  const grid = getNavGrid(mapId);
  return grid ? snapToWalkable(grid, point) : point;
};

// Longest believable engagement on the radar (units, 0..100). Kills resolved farther apart than this
// — or with no clear sightline — get the victim pulled in toward the killer so the trace reads as a
// real duel down a sightline instead of a shot across the whole map through buildings.
const MAX_ENGAGE = 34;
function plausibleEngagement(mapId: MapId, killer: Position, victim: Position): Position {
  const grid = getNavGrid(mapId);
  const safeKiller = grid ? snapToWalkable(grid, killer) : killer;
  const dx = victim.x - safeKiller.x;
  const dy = victim.y - safeKiller.y;
  const d = Math.hypot(dx, dy);
  let v = victim;
  // 1. Cap the distance so nothing reads as a shot across the whole map.
  if (d > MAX_ENGAGE) {
    const k = MAX_ENGAGE / d;
    v = { x: safeKiller.x + dx * k, y: safeKiller.y + dy * k };
  }
  v = onMapFloor(mapId, v);
  // 2. A kill trace is spatial evidence, so it must end on the same walkable surface and share a
  //    real sightline with the shooter. Walk the candidate back along the duel vector first; if a
  //    wall separates the two lanes entirely, choose a nearby visible floor cell around the killer.
  if (grid && !hasLineOfSight(grid, safeKiller, v)) {
    const target = v;
    for (let factor = 0.875; factor >= 0.125; factor -= 0.125) {
      const candidate = snapToWalkable(grid, {
        x: safeKiller.x + (target.x - safeKiller.x) * factor,
        y: safeKiller.y + (target.y - safeKiller.y) * factor,
      });
      if (
        Math.hypot(candidate.x - safeKiller.x, candidate.y - safeKiller.y) > 0.35 &&
        hasLineOfSight(grid, safeKiller, candidate)
      ) {
        return candidate;
      }
    }

    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const directions = [[ux, uy], [-uy, ux], [uy, -ux], [-ux, -uy]];
    for (const radius of [1.2, 2.2, 3.4]) {
      for (const [dirX, dirY] of directions) {
        const candidate = snapToWalkable(grid, {
          x: safeKiller.x + dirX * radius,
          y: safeKiller.y + dirY * radius,
        });
        if (
          Math.hypot(candidate.x - safeKiller.x, candidate.y - safeKiller.y) > 0.35 &&
          hasLineOfSight(grid, safeKiller, candidate)
        ) {
          return candidate;
        }
      }
    }
    return safeKiller;
  }
  return v;
}

export interface Position {
  x: number;
  y: number;
}

const formationCache = new Map<string, Position[]>();

/**
 * Resolve a five-player formation around an anchor using the same walkable grid that owns movement.
 * Desired slots face `toward`, then snap to distinct nearby floor cells. This keeps spawns and site
 * holds from collapsing into one marker without inventing offsets that land inside walls.
 */
function formationSlots(
  mapId: MapId,
  anchor: Position,
  toward: Position,
  count = 5,
  spread = 1,
  minimumSeparation = 1.55,
  searchRadius = 7,
): Position[] {
  const grid = getNavGrid(mapId);
  if (!grid) return Array.from({ length: count }, () => anchor);
  const center = snapToWalkable(grid, anchor);
  const vx = toward.x - center.x;
  const vy = toward.y - center.y;
  const magnitude = Math.hypot(vx, vy) || 1;
  const fx = vx / magnitude;
  const fy = vy / magnitude;
  const rx = -fy;
  const ry = fx;
  const key = `${mapId}:${center.x.toFixed(2)},${center.y.toFixed(2)}>${toward.x.toFixed(2)},${toward.y.toFixed(2)}:${count}:${spread.toFixed(2)}:${minimumSeparation.toFixed(2)}:${searchRadius.toFixed(2)}`;
  const cached = formationCache.get(key);
  if (cached) return cached;

  // Front pair, centre, then a wider back pair — roughly how CS spawn packs fan out.
  const offsets = [
    { forward: 2.6, right: 0 },
    { forward: 1.2, right: -2.2 },
    { forward: 1.2, right: 2.2 },
    { forward: -1.1, right: -1.8 },
    { forward: -1.1, right: 1.8 },
  ];
  const cellSize = 100 / grid.res;
  const centerCol = Math.min(grid.res - 1, Math.max(0, Math.floor((center.x / 100) * grid.res)));
  const centerRow = Math.min(grid.res - 1, Math.max(0, Math.floor((center.y / 100) * grid.res)));
  const radiusCells = Math.ceil(searchRadius / cellSize);
  const candidates: Position[] = [];
  for (let row = Math.max(0, centerRow - radiusCells); row <= Math.min(grid.res - 1, centerRow + radiusCells); row += 1) {
    for (let col = Math.max(0, centerCol - radiusCells); col <= Math.min(grid.res - 1, centerCol + radiusCells); col += 1) {
      if (grid.blockedMove[row * grid.res + col]) continue;
      const point = { x: (col + 0.5) * cellSize, y: (row + 0.5) * cellSize };
      if (Math.hypot(point.x - center.x, point.y - center.y) <= searchRadius) candidates.push(point);
    }
  }

  const selected: Position[] = [];
  const used = new Set<number>();
  for (let slot = 0; slot < count; slot += 1) {
    const offset = offsets[slot % offsets.length];
    const desired = {
      x: center.x + (fx * offset.forward + rx * offset.right) * spread,
      y: center.y + (fy * offset.forward + ry * offset.right) * spread,
    };
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    candidates.forEach((candidate, candidateIndex) => {
      if (used.has(candidateIndex)) return;
      const separation = selected.length
        ? Math.min(...selected.map((point) => Math.hypot(point.x - candidate.x, point.y - candidate.y)))
        : Number.POSITIVE_INFINITY;
      const crowdPenalty =
        separation < minimumSeparation ? (minimumSeparation - separation) * 40 : 0;
      const score = Math.hypot(candidate.x - desired.x, candidate.y - desired.y) + crowdPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = candidateIndex;
      }
    });
    if (bestIndex >= 0) {
      used.add(bestIndex);
      selected.push(candidates[bestIndex]);
    } else {
      selected.push(center);
    }
  }
  formationCache.set(key, selected);
  return selected;
}

export interface MapLayout {
  tSpawn: Position;
  ctSpawn: Position;
  bombsiteA: Position;
  bombsiteB: Position;
  mid: Position;
  chokePoints: Record<string, Position>;
  paths: string[];
  tSpawnToA: Position[];
  tSpawnToB: Position[];
  tSpawnToMid: Position[];
  ctSpawnToA: Position[];
  ctSpawnToB: Position[];
  ctSpawnToMid: Position[];
  midToA: Position[];
  midToB: Position[];
  aToB: Position[];
  bToA: Position[];
}

export const MAP_LAYOUTS: Record<MapId, MapLayout> = {
  mirage: {
    // Calibrated from a real CS2 demo (see scripts/calibrate-mirage.ts): B site upper-left, A site
    // bottom-centre, T spawn right, CT spawn lower-left. Mirage actually plays from the spatial
    // timeline (mirageRoundSim), so these only feed the bomb-icon fallback / legacy path.
    tSpawn: { x: 86.5, y: 36.6 },
    ctSpawn: { x: 31.9, y: 68.7 },
    bombsiteA: { x: 54.4, y: 70.4 },
    bombsiteB: { x: 25.0, y: 28.2 },
    mid: { x: 51.2, y: 48.0 },
    chokePoints: {
      "A Ramp": { x: 65, y: 65 },
      "Palace": { x: 72, y: 52 },
      "Banana": { x: 58, y: 28 },
      "Mid": { x: 50, y: 50 },
      "Connector": { x: 46, y: 58 },
      "Market": { x: 38, y: 48 },
      "Apps": { x: 58, y: 28 }
    },
    paths: [
      "M 88 36 L 80 50 L 65 65 L 54 76",
      "M 88 36 L 80 36 L 72 52 L 54 76",
      "M 88 36 L 70 48 L 60 48 L 50 50",
      "M 28 70 L 44 70 L 54 76",
      "M 28 70 L 35 58 L 46 58 L 50 50",
      "M 28 70 L 38 48 L 38 28 L 23 28",
      "M 50 50 L 45 38 L 38 38 L 23 28",
      "M 88 36 L 80 28 L 58 28 L 23 28"
    ],
    tSpawnToA: [{ x: 88, y: 36 }, { x: 80, y: 50 }, { x: 65, y: 65 }, { x: 54, y: 76 }],
    tSpawnToB: [{ x: 88, y: 36 }, { x: 72, y: 17 }, { x: 36, y: 17 }, { x: 28, y: 24 }, { x: 23, y: 28 }],
    tSpawnToMid: [{ x: 88, y: 36 }, { x: 70, y: 48 }, { x: 60, y: 48 }, { x: 50, y: 50 }],
    ctSpawnToA: [{ x: 28, y: 70 }, { x: 44, y: 76 }, { x: 54, y: 76 }],
    ctSpawnToB: [{ x: 28, y: 70 }, { x: 24, y: 48 }, { x: 23, y: 28 }],
    ctSpawnToMid: [{ x: 28, y: 70 }, { x: 35, y: 58 }, { x: 46, y: 58 }, { x: 50, y: 50 }],
    midToA: [{ x: 50, y: 50 }, { x: 46, y: 58 }, { x: 44, y: 70 }, { x: 54, y: 76 }],
    midToB: [{ x: 50, y: 50 }, { x: 45, y: 38 }, { x: 23, y: 28 }],
    aToB: [{ x: 54, y: 76 }, { x: 44, y: 70 }, { x: 46, y: 58 }, { x: 45, y: 38 }, { x: 23, y: 28 }],
    bToA: [{ x: 23, y: 28 }, { x: 45, y: 38 }, { x: 46, y: 58 }, { x: 44, y: 70 }, { x: 54, y: 76 }]
  },
  inferno: {
    tSpawn: { x: 9, y: 66 },
    ctSpawn: { x: 89, y: 35 },
    bombsiteA: { x: 81, y: 68 },
    bombsiteB: { x: 49, y: 21 },
    mid: { x: 40, y: 55 },
    chokePoints: {
      "A Ramp": { x: 55, y: 55 },
      "Banana": { x: 35, y: 35 },
      "Alt Mid": { x: 28, y: 60 },
      "Arch": { x: 78, y: 45 },
      "Pit": { x: 72, y: 68 }
    },
    paths: [
      "M 9 66 L 20 66 L 28 60 L 45 68 L 58 68 L 81 68",
      "M 9 66 L 20 66 L 40 55 L 55 55 L 68 55 L 81 68",
      "M 89 35 L 82 35 L 78 45 L 68 55 L 81 68",
      "M 89 35 L 80 22 L 72 22 L 49 21",
      "M 9 66 L 20 52 L 35 35 L 49 21",
      "M 89 35 L 81 55 L 81 68"
    ],
    tSpawnToA: [{ x: 9, y: 66 }, { x: 20, y: 66 }, { x: 40, y: 55 }, { x: 68, y: 55 }, { x: 81, y: 68 }],
    tSpawnToB: [{ x: 9, y: 66 }, { x: 20, y: 52 }, { x: 35, y: 35 }, { x: 49, y: 21 }],
    tSpawnToMid: [{ x: 9, y: 66 }, { x: 20, y: 66 }, { x: 40, y: 55 }],
    ctSpawnToA: [{ x: 89, y: 35 }, { x: 81, y: 55 }, { x: 81, y: 68 }],
    ctSpawnToB: [{ x: 89, y: 35 }, { x: 80, y: 22 }, { x: 72, y: 22 }, { x: 49, y: 21 }],
    ctSpawnToMid: [{ x: 89, y: 35 }, { x: 78, y: 45 }, { x: 68, y: 55 }, { x: 40, y: 55 }],
    midToA: [{ x: 40, y: 55 }, { x: 68, y: 55 }, { x: 81, y: 68 }],
    midToB: [{ x: 40, y: 55 }, { x: 35, y: 35 }, { x: 49, y: 21 }],
    aToB: [{ x: 81, y: 68 }, { x: 68, y: 55 }, { x: 78, y: 45 }, { x: 80, y: 22 }, { x: 49, y: 21 }],
    bToA: [{ x: 49, y: 21 }, { x: 72, y: 22 }, { x: 78, y: 45 }, { x: 68, y: 55 }, { x: 81, y: 68 }]
  },
  dust2: {
    tSpawn: { x: 38, y: 90 },
    ctSpawn: { x: 58, y: 21 },
    bombsiteA: { x: 80, y: 17 },
    bombsiteB: { x: 21, y: 12 },
    mid: { x: 48, y: 55 },
    chokePoints: {
      "Long A": { x: 82, y: 50 },
      "Short A": { x: 65, y: 35 },
      "Mid Doors": { x: 48, y: 30 },
      "Upper Tunnel": { x: 20, y: 55 },
      "Lower Tunnel": { x: 32, y: 50 }
    },
    paths: [
      "M 38 90 L 58 90 L 70 80 L 82 80 L 82 50 L 80 17",
      "M 38 90 L 48 72 L 48 55 L 55 42 L 65 35 L 80 17",
      "M 38 90 L 48 55 L 48 30 L 58 21",
      "M 58 21 L 70 21 L 80 17",
      "M 58 21 L 32 21 L 21 12",
      "M 38 90 L 25 80 L 20 55 L 21 12",
      "M 48 55 L 32 50 L 20 55"
    ],
    tSpawnToA: [{ x: 38, y: 90 }, { x: 58, y: 90 }, { x: 70, y: 80 }, { x: 82, y: 80 }, { x: 82, y: 50 }, { x: 80, y: 17 }],
    tSpawnToB: [{ x: 38, y: 90 }, { x: 25, y: 80 }, { x: 20, y: 55 }, { x: 21, y: 12 }],
    tSpawnToMid: [{ x: 38, y: 90 }, { x: 48, y: 72 }, { x: 48, y: 55 }],
    ctSpawnToA: [{ x: 58, y: 21 }, { x: 70, y: 21 }, { x: 80, y: 17 }],
    ctSpawnToB: [{ x: 58, y: 21 }, { x: 32, y: 21 }, { x: 21, y: 12 }],
    ctSpawnToMid: [{ x: 58, y: 21 }, { x: 48, y: 30 }, { x: 48, y: 55 }],
    midToA: [{ x: 48, y: 55 }, { x: 55, y: 42 }, { x: 65, y: 35 }, { x: 80, y: 17 }],
    midToB: [{ x: 48, y: 55 }, { x: 32, y: 50 }, { x: 20, y: 55 }, { x: 21, y: 12 }],
    aToB: [{ x: 80, y: 17 }, { x: 65, y: 35 }, { x: 48, y: 30 }, { x: 32, y: 21 }, { x: 21, y: 12 }],
    bToA: [{ x: 21, y: 12 }, { x: 32, y: 21 }, { x: 48, y: 30 }, { x: 65, y: 35 }, { x: 80, y: 17 }]
  },
  nuke: {
    tSpawn: { x: 20, y: 55 },
    ctSpawn: { x: 81, y: 46 },
    bombsiteA: { x: 57, y: 49 },
    bombsiteB: { x: 57, y: 57 },
    mid: { x: 72, y: 52 },
    chokePoints: {
      "Outside": { x: 72, y: 52 },
      "Secret": { x: 68, y: 58 },
      "Lobby": { x: 42, y: 42 },
      "Ramp": { x: 45, y: 58 },
      "Main": { x: 52, y: 42 }
    },
    paths: [
      "M 20 55 L 35 55 L 42 42 L 48 42 L 57 49",
      "M 20 55 L 35 55 L 42 42 L 48 48 L 57 49",
      "M 20 55 L 32 60 L 52 60 L 72 52 L 68 58 L 57 57",
      "M 81 46 L 72 52",
      "M 81 46 L 68 42 L 52 42 L 57 49",
      "M 81 46 L 65 49 L 45 58 L 57 57"
    ],
    tSpawnToA: [{ x: 20, y: 55 }, { x: 35, y: 55 }, { x: 42, y: 42 }, { x: 48, y: 42 }, { x: 57, y: 49 }],
    tSpawnToB: [{ x: 20, y: 55 }, { x: 32, y: 60 }, { x: 52, y: 60 }, { x: 72, y: 52 }, { x: 68, y: 58 }, { x: 57, y: 57 }],
    tSpawnToMid: [{ x: 20, y: 55 }, { x: 32, y: 60 }, { x: 52, y: 60 }, { x: 72, y: 52 }],
    ctSpawnToA: [{ x: 81, y: 46 }, { x: 68, y: 42 }, { x: 52, y: 42 }, { x: 57, y: 49 }],
    ctSpawnToB: [{ x: 81, y: 46 }, { x: 65, y: 49 }, { x: 45, y: 58 }, { x: 57, y: 57 }],
    ctSpawnToMid: [{ x: 81, y: 46 }, { x: 72, y: 52 }],
    midToA: [{ x: 72, y: 52 }, { x: 68, y: 42 }, { x: 57, y: 49 }],
    midToB: [{ x: 72, y: 52 }, { x: 68, y: 58 }, { x: 57, y: 57 }],
    aToB: [{ x: 57, y: 49 }, { x: 52, y: 42 }, { x: 45, y: 58 }, { x: 57, y: 57 }],
    bToA: [{ x: 57, y: 57 }, { x: 45, y: 58 }, { x: 52, y: 42 }, { x: 57, y: 49 }]
  },
  ancient: {
    tSpawn: { x: 48, y: 86 },
    ctSpawn: { x: 50, y: 12 },
    bombsiteA: { x: 30, y: 26 },
    bombsiteB: { x: 74, y: 40 },
    mid: { x: 50, y: 48 },
    chokePoints: {
      "A Hall": { x: 35, y: 45 },
      "Cheetah": { x: 58, y: 45 },
      "B Main": { x: 68, y: 55 },
      "Temple": { x: 42, y: 26 },
      "Donut": { x: 42, y: 38 }
    },
    paths: [
      "M 48 86 L 30 75 L 30 55 L 35 45 L 30 26",
      "M 48 86 L 50 62 L 50 48 L 58 45 L 74 40",
      "M 48 86 L 68 75 L 68 55 L 74 40",
      "M 50 12 L 42 20 L 42 26 L 30 26",
      "M 50 12 L 68 20 L 68 32 L 74 40",
      "M 50 12 L 50 32 L 42 38 L 30 26"
    ],
    tSpawnToA: [{ x: 48, y: 86 }, { x: 30, y: 75 }, { x: 30, y: 55 }, { x: 35, y: 45 }, { x: 30, y: 26 }],
    tSpawnToB: [{ x: 48, y: 86 }, { x: 68, y: 75 }, { x: 68, y: 55 }, { x: 74, y: 40 }],
    tSpawnToMid: [{ x: 48, y: 86 }, { x: 50, y: 62 }, { x: 50, y: 48 }],
    ctSpawnToA: [{ x: 50, y: 12 }, { x: 42, y: 20 }, { x: 42, y: 26 }, { x: 30, y: 26 }],
    ctSpawnToB: [{ x: 50, y: 12 }, { x: 68, y: 20 }, { x: 68, y: 32 }, { x: 74, y: 40 }],
    ctSpawnToMid: [{ x: 50, y: 12 }, { x: 50, y: 32 }, { x: 50, y: 48 }],
    midToA: [{ x: 50, y: 48 }, { x: 42, y: 38 }, { x: 30, y: 26 }],
    midToB: [{ x: 50, y: 48 }, { x: 58, y: 45 }, { x: 74, y: 40 }],
    aToB: [{ x: 30, y: 26 }, { x: 42, y: 38 }, { x: 50, y: 48 }, { x: 58, y: 45 }, { x: 74, y: 40 }],
    bToA: [{ x: 74, y: 40 }, { x: 58, y: 45 }, { x: 50, y: 48 }, { x: 42, y: 38 }, { x: 30, y: 26 }]
  },
  anubis: {
    tSpawn: { x: 50, y: 88 },
    ctSpawn: { x: 50, y: 12 },
    bombsiteA: { x: 26, y: 36 },
    bombsiteB: { x: 74, y: 36 },
    mid: { x: 50, y: 48 },
    chokePoints: {
      "B Waters": { x: 75, y: 55 },
      "Canal": { x: 50, y: 65 },
      "Bridge": { x: 62, y: 48 },
      "A Main": { x: 22, y: 55 },
      "A Connector": { x: 32, y: 18 }
    },
    paths: [
      "M 50 88 L 70 75 L 75 55 L 74 36",
      "M 50 88 L 50 65 L 50 48 L 62 48 L 74 36",
      "M 50 88 L 28 78 L 22 55 L 26 36",
      "M 50 12 L 68 18 L 74 36",
      "M 50 12 L 32 18 L 26 36",
      "M 50 12 L 50 35 L 38 42 L 26 36"
    ],
    tSpawnToA: [{ x: 50, y: 88 }, { x: 28, y: 78 }, { x: 22, y: 55 }, { x: 26, y: 36 }],
    tSpawnToB: [{ x: 50, y: 88 }, { x: 70, y: 75 }, { x: 75, y: 55 }, { x: 74, y: 36 }],
    tSpawnToMid: [{ x: 50, y: 88 }, { x: 50, y: 65 }, { x: 50, y: 48 }],
    ctSpawnToA: [{ x: 50, y: 12 }, { x: 32, y: 18 }, { x: 26, y: 36 }],
    ctSpawnToB: [{ x: 50, y: 12 }, { x: 68, y: 18 }, { x: 74, y: 36 }],
    ctSpawnToMid: [{ x: 50, y: 12 }, { x: 50, y: 35 }, { x: 50, y: 48 }],
    midToA: [{ x: 50, y: 48 }, { x: 38, y: 42 }, { x: 26, y: 36 }],
    midToB: [{ x: 50, y: 48 }, { x: 62, y: 48 }, { x: 74, y: 36 }],
    aToB: [{ x: 26, y: 36 }, { x: 38, y: 42 }, { x: 50, y: 48 }, { x: 62, y: 48 }, { x: 74, y: 36 }],
    bToA: [{ x: 74, y: 36 }, { x: 62, y: 48 }, { x: 50, y: 48 }, { x: 38, y: 42 }, { x: 26, y: 36 }]
  },
  train: {
    tSpawn: { x: 12, y: 22 },
    ctSpawn: { x: 88, y: 76 },
    bombsiteA: { x: 63, y: 50 },
    bombsiteB: { x: 53, y: 76 },
    mid: { x: 48, y: 48 },
    chokePoints: {
      "Ivy": { x: 72, y: 22 },
      "Popdog": { x: 48, y: 35 },
      "B Ramp": { x: 35, y: 65 },
      "Z Connector": { x: 60, y: 65 },
      "Alley": { x: 80, y: 55 }
    },
    paths: [
      "M 12 22 L 45 22 L 72 22 L 72 35 L 63 50",
      "M 12 22 L 32 35 L 48 35 L 63 50",
      "M 12 22 L 22 35 L 22 60 L 35 65 L 53 76",
      "M 88 76 L 80 76 L 80 55 L 63 50",
      "M 88 76 L 72 76 L 60 65 L 53 76",
      "M 88 76 L 68 85 L 53 76"
    ],
    tSpawnToA: [{ x: 12, y: 22 }, { x: 45, y: 22 }, { x: 72, y: 22 }, { x: 72, y: 35 }, { x: 63, y: 50 }],
    tSpawnToB: [{ x: 12, y: 22 }, { x: 22, y: 35 }, { x: 22, y: 60 }, { x: 35, y: 65 }, { x: 53, y: 76 }],
    tSpawnToMid: [{ x: 12, y: 22 }, { x: 32, y: 35 }, { x: 48, y: 48 }],
    ctSpawnToA: [{ x: 88, y: 76 }, { x: 80, y: 76 }, { x: 80, y: 55 }, { x: 63, y: 50 }],
    ctSpawnToB: [{ x: 88, y: 76 }, { x: 68, y: 85 }, { x: 53, y: 76 }],
    ctSpawnToMid: [{ x: 88, y: 76 }, { x: 72, y: 76 }, { x: 60, y: 65 }, { x: 48, y: 48 }],
    midToA: [{ x: 48, y: 48 }, { x: 63, y: 50 }],
    midToB: [{ x: 48, y: 48 }, { x: 60, y: 65 }, { x: 53, y: 76 }],
    aToB: [{ x: 63, y: 50 }, { x: 80, y: 55 }, { x: 80, y: 76 }, { x: 68, y: 85 }, { x: 53, y: 76 }],
    bToA: [{ x: 53, y: 76 }, { x: 68, y: 85 }, { x: 80, y: 76 }, { x: 80, y: 55 }, { x: 63, y: 50 }]
  }
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export interface SimulatedRadarPlayer extends Player {
  radarKey: string;
  x: number;
  y: number;
  yaw: number; // facing in degrees (0 = +x / east), from movement direction
  alive: boolean;
  side: "CT" | "T";
  team: "you" | "opponent";
}

function teamPlayerKey(team: "you" | "opponent", id: string) {
  return `${team}:${id}`;
}

export function getClosestNodeKey(pos: Position, layout: MapLayout): string {
  const nodes = {
    tSpawn: layout.tSpawn,
    ctSpawn: layout.ctSpawn,
    bombsiteA: layout.bombsiteA,
    bombsiteB: layout.bombsiteB,
    mid: layout.mid,
  };
  let closestKey = "mid";
  let minDist = Infinity;
  for (const [key, nodePos] of Object.entries(nodes)) {
    const dist = Math.hypot(pos.x - nodePos.x, pos.y - nodePos.y);
    if (dist < minDist) {
      minDist = dist;
      closestKey = key;
    }
  }
  return closestKey;
}

export function getPathBetween(n1: string, n2: string, layout: MapLayout): Position[] {
  if (n1 === n2) return [];
  
  if ((n1 === "tSpawn" && n2 === "ctSpawn") || (n1 === "ctSpawn" && n2 === "tSpawn")) {
    const p1 = getPathBetween(n1, "mid", layout);
    const p2 = getPathBetween("mid", n2, layout);
    return [...p1, layout.mid, ...p2];
  }
  
  const pathKeyMap: Record<string, keyof MapLayout> = {
    "tSpawn-bombsiteA": "tSpawnToA" as any,
    "tSpawn-bombsiteB": "tSpawnToB" as any,
    "tSpawn-mid": "tSpawnToMid" as any,
    "ctSpawn-bombsiteA": "ctSpawnToA" as any,
    "ctSpawn-bombsiteB": "ctSpawnToB" as any,
    "ctSpawn-mid": "ctSpawnToMid" as any,
    "mid-bombsiteA": "midToA" as any,
    "mid-bombsiteB": "midToB" as any,
    "bombsiteA-bombsiteB": "aToB" as any,
    "bombsiteB-bombsiteA": "bToA" as any,
  };

  let pathKey = pathKeyMap[`${n1}-${n2}`];
  if (pathKey && layout[pathKey]) {
    return layout[pathKey] as any;
  }
  
  pathKey = pathKeyMap[`${n2}-${n1}`];
  if (pathKey && layout[pathKey]) {
    return [...(layout[pathKey] as any)].reverse();
  }

  return [];
}

export function cleanRoute(route: Position[]): Position[] {
  const cleaned: Position[] = [];
  for (const pos of route) {
    if (cleaned.length === 0) {
      cleaned.push(pos);
    } else {
      const last = cleaned[cleaned.length - 1];
      if (Math.abs(last.x - pos.x) > 0.1 || Math.abs(last.y - pos.y) > 0.1) {
        cleaned.push(pos);
      }
    }
  }
  // Combat endpoints are authoritative. Corridor cleanup may remove an end point less than 0.1
  // units from the preceding grid vertex, but even that tiny mismatch separates the rendered body
  // from the tracer and reads as a wall shot. Always pin the exact final point.
  const finalPoint = route[route.length - 1];
  const cleanedFinal = cleaned[cleaned.length - 1];
  if (
    finalPoint &&
    cleanedFinal &&
    (Math.abs(cleanedFinal.x - finalPoint.x) > 1e-9 ||
      Math.abs(cleanedFinal.y - finalPoint.y) > 1e-9)
  ) {
    cleaned.push(finalPoint);
  }
  return cleaned;
}

function routeLength(route: Position[]): number {
  let length = 0;
  for (let index = 1; index < route.length; index += 1) {
    length += Math.hypot(
      route[index].x - route[index - 1].x,
      route[index].y - route[index - 1].y,
    );
  }
  return length;
}

function interpolate(p1: Position, p2: Position, t: number): Position {
  const clampedT = Math.max(0, Math.min(1, t));
  return {
    x: p1.x + (p2.x - p1.x) * clampedT,
    y: p1.y + (p2.y - p1.y) * clampedT,
  };
}

function getPathPosition(path: Position[], t: number): Position {
  if (path.length === 0) return { x: 50, y: 50 };
  if (path.length === 1) return path[0];

  let totalDist = 0;
  const dists = [0];
  for (let i = 0; i < path.length - 1; i++) {
    const d = Math.hypot(path[i+1].x - path[i].x, path[i+1].y - path[i].y);
    totalDist += d;
    dists.push(totalDist);
  }

  if (totalDist === 0) return path[0];

  const targetDist = t * totalDist;
  for (let i = 0; i < path.length - 1; i++) {
    if (targetDist >= dists[i] && targetDist <= dists[i + 1]) {
      const segmentDist = dists[i + 1] - dists[i];
      const segmentT = segmentDist > 0 ? (targetDist - dists[i]) / segmentDist : 0;
      return interpolate(path[i], path[i + 1], segmentT);
    }
  }
  return path[path.length - 1];
}

interface Waypoint {
  step: number;
  pos: Position;
}

// Cache tactical-graph routes by rounded endpoints (getPlayerPositionAtStep runs every frame per
// player; waypoints are stable nodes/dests so the cache is small).
const graphRouteCache = new Map<string, Position[]>();

function graphRoute(a: Position, b: Position): Position[] {
  const key = `${a.x.toFixed(1)},${a.y.toFixed(1)}>${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  let route = graphRouteCache.get(key);
  if (!route) {
    const r = findRoute(nearestNode(a.x, a.y).id, nearestNode(b.x, b.y).id);
    const corners = r ? [a, ...r.nodes.map((n) => ({ x: n.x, y: n.y })), b] : [a, b];
    // snap each callout->callout leg to the real corridor (walkable mask) so movement hugs the map
    route = corridorPath("mirage", corners);
    if (graphRouteCache.size < 4000) graphRouteCache.set(key, route);
  }
  return route;
}

const voxelRouteCache = new Map<string, Position[]>();

function spatialRoute(mapId: MapId, a: Position, b: Position): Position[] {
  if (mapId === "mirage") return graphRoute(a, b);
  const grid = getNavGrid(mapId);
  if (!grid) return [a, b];
  const start = snapToWalkable(grid, a);
  const end = snapToWalkable(grid, b);
  // The exact endpoint is part of the rendered combat contract. A 0.1-unit cache key allowed two
  // nearby duel anchors to share a route whose final vertex belonged to the earlier fight, leaving
  // the tracer and player body subtly separated at the death frame.
  const key = `${mapId}:${start.x.toFixed(3)},${start.y.toFixed(3)}>${end.x.toFixed(3)},${end.y.toFixed(3)}`;
  let route = voxelRouteCache.get(key);
  if (!route) {
    route = corridorPath(mapId, [start, end]);
    if (voxelRouteCache.size < 8000) voxelRouteCache.set(key, route);
  }
  return route;
}

// Movement speed for spatial maps, in radar units (0..100) per event-step. Short legs reach their
// hold early; long legs consume the whole event interval. The interval itself is distance-paced in
// getStepDelay, so a long rotate takes longer on screen instead of teleporting at the kill frame.
const WALK_SPEED = 15;

/**
 * Resolve a duel on the arena's real corridor rather than trusting narration-only coordinates.
 * The round engine still owns who won; the spatial layer owns where contact was physically possible.
 */
function resolveSpatialDuel(
  mapId: MapId,
  killerIntent: Position,
  victimIntent: Position,
  seed: number,
): { killer: Position; victim: Position } {
  const grid = getNavGrid(mapId);
  if (!grid) {
    const killer = killerIntent;
    return { killer, victim: plausibleEngagement(mapId, killer, victimIntent) };
  }

  const corridor = cleanRoute(spatialRoute(mapId, killerIntent, victimIntent));
  const meeting = snapToWalkable(grid, getPathPosition(corridor, 0.5));
  const baseAngle =
    Math.atan2(victimIntent.y - killerIntent.y, victimIntent.x - killerIntent.x) +
    (((seed % 29) - 14) * Math.PI) / 180;

  // Keep both endpoints on nearby floor cells with a verified clear shot between them.
  for (const radius of [4.6, 3.7, 2.9, 2.2, 1.5]) {
    for (let turn = 0; turn < 8; turn += 1) {
      const angle = baseAngle + (turn * Math.PI) / 4;
      const killer = snapToWalkable(grid, {
        x: meeting.x - Math.cos(angle) * radius * 0.38,
        y: meeting.y - Math.sin(angle) * radius * 0.38,
      });
      const victim = snapToWalkable(grid, {
        x: meeting.x + Math.cos(angle) * radius * 0.62,
        y: meeting.y + Math.sin(angle) * radius * 0.62,
      });
      const distance = Math.hypot(victim.x - killer.x, victim.y - killer.y);
      if (distance >= 0.8 && distance <= MAX_ENGAGE && hasLineOfSight(grid, killer, victim)) {
        return { killer, victim };
      }
    }
  }

  const killer = meeting;
  return { killer, victim: plausibleEngagement(mapId, killer, victimIntent) };
}

function getPlayerPositionAtStep(
  wps: Waypoint[],
  step: number,
  layout: MapLayout,
  mapId: MapId,
  isAlive: boolean = true,
  useSpatialRoutes = false,
): Position {
  if (wps.length === 0) return { x: 50, y: 50 };
  if (wps.length === 1) {
    return useSpatialRoutes ? onMapFloor(mapId, wps[0].pos) : wps[0].pos;
  }
  if (step >= wps[wps.length - 1].step) {
    const last = wps[wps.length - 1].pos;
    return useSpatialRoutes ? onMapFloor(mapId, last) : last;
  }

  let w1 = wps[0];
  let w2 = wps[wps.length - 1];
  for (let i = 0; i < wps.length - 1; i++) {
    if (wps[i].step <= step && wps[i + 1].step >= step) {
      w1 = wps[i];
      w2 = wps[i + 1];
      break;
    }
  }

  const denominator = w2.step - w1.step;
  const t_linear = denominator > 0 ? (step - w1.step) / denominator : 0;

  let cleaned: Position[];
  if (useSpatialRoutes) {
    // Route callout-to-callout on the authoritative walkable surface. Mirage uses its detailed
    // tactical graph; every other map uses the Source 2 voxel occupancy/elevation grid. The
    // any-angle corridor path is already corner-hugging and strictly on the floor; we do NOT Chaikin
    // it (corner-cutting shaved routes back into walls, and snapping those back caused jitter).
    // The pathfinder has already snapped the endpoints and validated every segment. Re-snapping
    // each corner independently can move one corner to the opposite side of a thin wall and create
    // a new, invalid segment between two otherwise valid Source 2 path vertices.
    cleaned = cleanRoute(spatialRoute(mapId, w1.pos, w2.pos));
  } else {
    // Legacy node-graph fallback for maps without code geometry yet.
    const n1 = getClosestNodeKey(w1.pos, layout);
    const n2 = getClosestNodeKey(w2.pos, layout);
    const pathNodes = getPathBetween(n1, n2, layout);
    const fullPath = [w1.pos, ...pathNodes, w2.pos];
    cleaned = cleanRoute(fullPath);
  }

  // Compute total path length to implement constant-velocity-then-hold logic
  let pathLength = 0;
  for (let j = 0; j < cleaned.length - 1; j++) {
    const dx = cleaned[j + 1].x - cleaned[j].x;
    const dy = cleaned[j + 1].y - cleaned[j].y;
    pathLength += Math.sqrt(dx * dx + dy * dy);
  }

  // Walk at a constant speed: cover at most WALK_SPEED units per event-step. For graph maps the
  // waypoint steps have been re-timed (step 4c) so each leg spans >= its length / WALK_SPEED, which
  // makes f_walk≈1 (steady walk); a player who has time to spare reaches the spot early and holds.
  const stepSpan = Math.max(1e-3, w2.step - w1.step);
  const f_walk = pathLength > 0 ? Math.min(1, pathLength / (WALK_SPEED * stepSpan)) : 0;

  let t = 1.0;
  if (f_walk > 0 && t_linear < f_walk) {
    t = t_linear / f_walk;
  }

  // No per-frame wobble here: the old jiggle reseeded every animation frame off the fractional
  // step, which made holding players visibly buzz/vibrate. Holding players now stay put.
  const pos = getPathPosition(cleaned, t);
  // `spatialRoute` is already constructed from movement-clear Source 2 corridor segments. Do not
  // snap this interpolated point again: at a voxel-cell boundary the nearest-free-cell lookup can
  // momentarily choose a cell beside the route, producing a one-frame sideways jump before the
  // player snaps back. Keeping the continuous arc-length interpolation removes that jitter while
  // the route itself remains authoritative for wall avoidance.
  return pos;
}

type Bombsite = "A" | "B";

interface TacticalLaneSet {
  attack: string[];
  defend: string[];
}

interface TacticalPlan {
  setup: Position;
  contact: Position;
  hold: Position;
}

interface TacticalPlayerInput {
  p: Player;
  idx: number;
  key: string;
  side: "CT" | "T";
  team: "you" | "opponent";
}

/**
 * Callout lanes are semantic references; their final coordinates are always snapped and connected
 * by the Source 2 navigation raster. The ordering encodes a normal multi-lane execute/retake:
 * primary contact, secondary trade route, then the long sightline/flank.
 */
const TACTICAL_LANES: Record<MapId, Record<Bombsite, TacticalLaneSet>> = {
  mirage: {
    A: { attack: ["A Ramp", "Palace", "Connector"], defend: ["Connector", "Mid", "Palace"] },
    B: { attack: ["Apps", "Mid", "Market"], defend: ["Market", "Connector", "Apps"] },
  },
  inferno: {
    A: { attack: ["A Ramp", "Alt Mid", "Arch"], defend: ["Pit", "Arch", "A Ramp"] },
    B: { attack: ["Banana", "Alt Mid", "Arch"], defend: ["Arch", "Banana", "Alt Mid"] },
  },
  dust2: {
    A: { attack: ["Long A", "Short A", "Mid Doors"], defend: ["Short A", "Mid Doors", "Long A"] },
    B: { attack: ["Upper Tunnel", "Lower Tunnel", "Mid Doors"], defend: ["Mid Doors", "Lower Tunnel", "Upper Tunnel"] },
  },
  nuke: {
    A: { attack: ["Lobby", "Main", "Outside"], defend: ["Main", "Outside", "Ramp"] },
    B: { attack: ["Ramp", "Secret", "Outside"], defend: ["Secret", "Ramp", "Outside"] },
  },
  ancient: {
    A: { attack: ["A Hall", "Donut", "Cheetah"], defend: ["Temple", "Donut", "A Hall"] },
    B: { attack: ["B Main", "Cheetah", "Donut"], defend: ["Cheetah", "Temple", "B Main"] },
  },
  anubis: {
    A: { attack: ["A Main", "Canal", "Bridge"], defend: ["A Connector", "Bridge", "A Main"] },
    B: { attack: ["B Waters", "Bridge", "Canal"], defend: ["Bridge", "B Waters", "A Connector"] },
  },
  train: {
    A: { attack: ["Popdog", "Ivy", "Z Connector"], defend: ["Alley", "Z Connector", "Ivy"] },
    B: { attack: ["B Ramp", "Popdog", "Z Connector"], defend: ["Z Connector", "Alley", "B Ramp"] },
  },
};

const TACTICAL_ROLE_ORDER: Record<Player["role"], number> = {
  Entry: 0,
  Rifler: 1,
  Support: 2,
  IGL: 3,
  AWP: 4,
  Lurker: 5,
};

function routeProgress(mapId: MapId, from: Position, to: Position, progress: number): Position {
  const route = cleanRoute(spatialRoute(mapId, from, to));
  return onMapFloor(mapId, getPathPosition(route, progress));
}

function calloutPosition(
  mapId: MapId,
  layout: MapLayout,
  name: string | undefined,
  fallback: Position,
): Position {
  return onMapFloor(mapId, (name && layout.chokePoints[name]) || fallback);
}

/**
 * Keep phase destinations personally separated while remaining on real floor cells. This is an
 * occupancy reservation, not a repulsion force, so it cannot cause the per-frame jitter that a
 * boids-style avoidance pass would introduce.
 */
function reserveTacticalPoint(
  mapId: MapId,
  desired: Position,
  toward: Position,
  reserved: Position[],
  minimumSeparation = 3.35,
): Position {
  const safeDesired = onMapFloor(mapId, desired);
  if (
    reserved.every(
      (point) => Math.hypot(point.x - safeDesired.x, point.y - safeDesired.y) >= minimumSeparation,
    )
  ) {
    reserved.push(safeDesired);
    return safeDesired;
  }

  const candidates = formationSlots(
    mapId,
    safeDesired,
    toward,
    5,
    1.75,
    minimumSeparation,
    10,
  );
  let best = candidates[0] ?? safeDesired;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const nearest = reserved.length
      ? Math.min(...reserved.map((point) => Math.hypot(point.x - candidate.x, point.y - candidate.y)))
      : Number.POSITIVE_INFINITY;
    const crowdPenalty =
      nearest < minimumSeparation ? (minimumSeparation - nearest) * 120 : 0;
    const score = Math.hypot(candidate.x - safeDesired.x, candidate.y - safeDesired.y) + crowdPenalty;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  reserved.push(best);
  return best;
}

/**
 * Build phase plans modelled on demo-review concepts rather than sending roles straight to a site:
 * Ts default into lanes, preserve an entry/trader layer, then fan into post-plant crossfires; CTs
 * hold a 2–1–2 shell and retake through several approaches. Source 2 nav still owns every leg.
 */
function buildTacticalPlans(
  mapId: MapId,
  layout: MapLayout,
  players: TacticalPlayerInput[],
  attackSite: Bombsite,
  hasPlant: boolean,
  preparation?: MatchState["context"]["preparation"],
): Map<string, TacticalPlan> {
  const plans = new Map<string, TacticalPlan>();
  const site = onMapFloor(mapId, attackSite === "A" ? layout.bombsiteA : layout.bombsiteB);
  const oppositeSite = onMapFloor(
    mapId,
    attackSite === "A" ? layout.bombsiteB : layout.bombsiteA,
  );
  const attackLanes = TACTICAL_LANES[mapId][attackSite].attack.map((name) =>
    calloutPosition(mapId, layout, name, layout.mid),
  );
  const retakeLanes = TACTICAL_LANES[mapId][attackSite].defend.map((name) =>
    calloutPosition(mapId, layout, name, layout.mid),
  );
  const oppositeLaneName = TACTICAL_LANES[mapId][attackSite === "A" ? "B" : "A"].attack[0];
  const oppositeLane = calloutPosition(mapId, layout, oppositeLaneName, oppositeSite);
  const siteSlots = formationSlots(mapId, site, layout.tSpawn, 5, 2.15, 3.45, 13);

  for (const team of ["you", "opponent"] as const) {
    const members = players
      .filter((player) => player.team === team)
      .sort(
        (a, b) =>
          TACTICAL_ROLE_ORDER[a.p.role] - TACTICAL_ROLE_ORDER[b.p.role] || a.idx - b.idx,
      );
    const setupReserved: Position[] = [];
    const contactReserved: Position[] = [];
    const holdReserved: Position[] = [];

    for (const member of members) {
      if (member.side === "T") {
        const role = member.p.role;
        const primary = attackLanes[0] ?? layout.mid;
        const secondary = attackLanes[1] ?? layout.mid;
        const longLane = attackLanes[2] ?? secondary;
        let setupDesired: Position;
        let contactDesired: Position;
        let holdDesired: Position;

        if (role === "Entry") {
          setupDesired = routeProgress(mapId, layout.tSpawn, primary, 0.98);
          contactDesired = siteSlots[0] ?? site;
          holdDesired = siteSlots[3] ?? site;
        } else if (role === "Rifler") {
          // A trade layer follows the entry's corridor but stays several floor cells behind.
          setupDesired = routeProgress(mapId, layout.tSpawn, primary, 0.77);
          contactDesired = siteSlots[1] ?? site;
          holdDesired = siteSlots[0] ?? site;
        } else if (role === "Support") {
          setupDesired = routeProgress(mapId, layout.tSpawn, secondary, 0.9);
          contactDesired = siteSlots[2] ?? site;
          holdDesired = routeProgress(mapId, site, secondary, 0.46);
        } else if (role === "IGL") {
          setupDesired = routeProgress(mapId, layout.tSpawn, secondary, 0.68);
          contactDesired = routeProgress(mapId, secondary, site, 0.56);
          holdDesired = routeProgress(mapId, site, longLane, 0.42);
        } else if (role === "Lurker") {
          setupDesired = routeProgress(mapId, layout.tSpawn, oppositeLane, 0.9);
          contactDesired = oppositeLane;
          holdDesired = routeProgress(mapId, oppositeLane, oppositeSite, 0.28);
        } else {
          // The AWP keeps the long lane rather than joining the entry pack on the bomb marker.
          setupDesired = routeProgress(mapId, layout.tSpawn, longLane, 0.84);
          contactDesired = longLane;
          holdDesired = routeProgress(mapId, longLane, site, 0.16);
        }

        plans.set(member.key, {
          setup: reserveTacticalPoint(
            mapId,
            setupDesired,
            layout.tSpawn,
            setupReserved,
          ),
          contact: reserveTacticalPoint(
            mapId,
            contactDesired,
            layout.tSpawn,
            contactReserved,
          ),
          hold: reserveTacticalPoint(
            mapId,
            hasPlant ? holdDesired : contactDesired,
            layout.tSpawn,
            holdReserved,
          ),
        });
        continue;
      }

      const role = member.p.role;
      const aLanes = TACTICAL_LANES[mapId].A.defend.map((name) =>
        calloutPosition(mapId, layout, name, layout.bombsiteA),
      );
      const bLanes = TACTICAL_LANES[mapId].B.defend.map((name) =>
        calloutPosition(mapId, layout, name, layout.bombsiteB),
      );
      let setupDesired: Position;
      if (team === "you" && preparation?.plan === "targeted-site-stack") {
        const stackLanes = preparation.targetSite === "A" ? aLanes : bLanes;
        const stackSite = preparation.targetSite === "A" ? layout.bombsiteA : layout.bombsiteB;
        if (role === "AWP") setupDesired = stackLanes[2] ?? layout.mid;
        else if (role === "Lurker") setupDesired = layout.mid;
        else if (role === "Entry") setupDesired = stackLanes[0] ?? stackSite;
        else if (role === "Support") setupDesired = stackLanes[1] ?? stackSite;
        else setupDesired = stackLanes[member.idx % Math.max(1, stackLanes.length)] ?? stackSite;
      } else if (role === "Entry") setupDesired = aLanes[0];
      else if (role === "IGL") setupDesired = aLanes[1] ?? layout.bombsiteA;
      else if (role === "AWP") setupDesired = layout.mid;
      else if (role === "Support") setupDesired = bLanes[1] ?? layout.bombsiteB;
      else setupDesired = bLanes[0];

      const retakeIndex =
        role === "Entry" ? 0 : role === "Rifler" ? 1 : role === "Support" ? 1 : 2;
      const retakeStart = retakeLanes[retakeIndex] ?? layout.mid;
      const retakeProgress =
        role === "Entry"
          ? 0.68
          : role === "Rifler"
            ? 0.52
            : role === "Support"
              ? 0.25
              : role === "IGL"
                ? 0.42
                : 0.1;
      const holdDesired = hasPlant
        ? routeProgress(mapId, retakeStart, site, retakeProgress)
        : setupDesired;

      const setup = reserveTacticalPoint(
        mapId,
        setupDesired,
        layout.ctSpawn,
        setupReserved,
      );
      plans.set(member.key, {
        setup,
        contact: reserveTacticalPoint(
          mapId,
          setup,
          layout.ctSpawn,
          contactReserved,
        ),
        hold: reserveTacticalPoint(
          mapId,
          holdDesired,
          layout.ctSpawn,
          holdReserved,
        ),
      });
    }
  }

  return plans;
}

export interface RadarTrace {
  round: number;
  killerId: string;
  victimId: string;
  killerPos: Position;
  victimPos: Position;
  side: "CT" | "T" | "neutral";
  opacity: number; // fades 1 -> 0 over TRACE_LINGER seconds so old kill lines don't clutter the map
}

export interface RadarSimulationResult {
  players: SimulatedRadarPlayer[];
  traces: RadarTrace[];
  bomb: Position | null;
  flashed: Record<string, number>; // playerId -> blind intensity 0..1 (for the flash-fade overlay)
}

// Shortest-path angle interpolation (degrees) — turns the short way, never spins 359° around 0.
function angleLerp(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180;
  return a + delta * t;
}

// Interpolate a player's position/yaw from the spatial timeline at round-time `time` (seconds).
// Dead players' frames are frozen at their death spot by the engine, so this naturally stops them.
function sampleTimeline(tl: TimelineFrame[], time: number, id: string): { x: number; y: number; yaw: number } | null {
  if (!tl.length) return null;
  if (time <= tl[0].t) {
    const p = tl[0].players.find((q) => q.id === id);
    return p ? { x: p.x, y: p.y, yaw: p.yaw } : null;
  }
  for (let i = 1; i < tl.length; i += 1) {
    if (tl[i].t >= time) {
      const a = tl[i - 1];
      const b = tl[i];
      const f = b.t > a.t ? (time - a.t) / (b.t - a.t) : 0;
      const pa = a.players.find((q) => q.id === id);
      const pb = b.players.find((q) => q.id === id);
      if (!pa || !pb) return pa ?? pb ? { x: (pa ?? pb)!.x, y: (pa ?? pb)!.y, yaw: (pa ?? pb)!.yaw } : null;
      // interpolate facing the short way so the direction tick rotates smoothly between frames
      return { x: pa.x + (pb.x - pa.x) * f, y: pa.y + (pb.y - pa.y) * f, yaw: angleLerp(pa.yaw, pb.yaw, f) };
    }
  }
  const last = tl[tl.length - 1].players.find((q) => q.id === id);
  return last ? { x: last.x, y: last.y, yaw: last.yaw } : null;
}

export function simulateRadarPlayers(
  match: MatchState,
  you: FieldTeam,
  opponent: FieldTeam,
  stepOverride?: number
): RadarSimulationResult {
  const mapId = match.map;
  const layout = MAP_LAYOUTS[mapId] || MAP_LAYOUTS.mirage;
  const useMirageTimeline = mapId === "mirage";
  const useSpatialRoutes = Boolean(getNavGrid(mapId));
  const onFloor = (point: Position) =>
    useSpatialRoutes ? onMapFloor(mapId, point) : point;
  const yourSide = match.side;
  const opponentSide: "CT" | "T" = yourSide === "CT" ? "T" : "CT";

  // Reconstruct round event stream
  const activeRound = match.pendingEvents?.[0]?.round ?? match.feed[0]?.round ?? match.round;
  const completedEvents = match.feed.filter((e) => e.round === activeRound);
  const remainingEvents = (match.pendingEvents || []).filter((e) => e.round === activeRound);
  const allEvents = [...[...completedEvents].reverse(), ...remainingEvents];
  
  const stepIndex = stepOverride !== undefined ? stepOverride : completedEvents.length;
  const totalSteps = Math.max(1, allEvents.length);

  const deadIds = new Set<string>();
  for (let i = 0; i < allEvents.length; i++) {
    const event = allEvents[i];
    if ((!event.type || event.type === "kill") && event.victimId) {
      // Mirage samples a timestamped engine timeline between events. Other maps animate *toward*
      // event i during the interval i..i+1, so the victim remains alive until the interval finishes.
      // Marking them dead at the first fractional frame was the body-teleport bug.
      const occurred = useMirageTimeline ? i < stepIndex : i + 1 <= stepIndex + 1e-6;
      if (occurred) {
        const victimTeam = event.team === "you" ? "opponent" : event.team === "opponent" ? "you" : undefined;
        if (victimTeam) deadIds.add(teamPlayerKey(victimTeam, event.victimId));
      }
    }
  }

  // === Mirage spatial replay: play the engine's real per-player trajectories (set by playRound). ===
  // This is the authoritative movement now — players spread across approaches and only meet where the
  // duels actually happened, so no funnel/teleport and traces are real sightlines.
  if (
    useMirageTimeline &&
    match.roundTimeline &&
    match.roundTimelineRound === activeRound &&
    match.roundTimeline.length
  ) {
    const tl = match.roundTimeline;
    // map the event-step clock onto round-time via each event's timestamp
    const eventT: number[] = allEvents.map((e) => e.t ?? NaN);
    for (let i = 0; i < eventT.length; i += 1) if (Number.isNaN(eventT[i])) eventT[i] = i > 0 ? eventT[i - 1] : 0;
    const si = Math.max(0, Math.min(totalSteps, stepIndex));
    const lo = Math.min(eventT.length - 1, Math.floor(si));
    const hi = Math.min(eventT.length - 1, lo + 1);
    const curT = (eventT[lo] ?? 0) + ((eventT[hi] ?? eventT[lo] ?? 0) - (eventT[lo] ?? 0)) * (si - lo);

    const mk = (players: Player[], side: "CT" | "T", team: "you" | "opponent"): SimulatedRadarPlayer[] =>
      players.map((p) => {
        const radarKey = teamPlayerKey(team, p.id);
        const s = sampleTimeline(tl, curT, radarKey) ?? sampleTimeline(tl, curT, p.id);
        return { ...p, radarKey, x: s?.x ?? 50, y: s?.y ?? 50, yaw: s?.yaw ?? 0, alive: !deadIds.has(radarKey), side, team };
      });
    const players = [...mk(you.players, yourSide, "you"), ...mk(opponent.players, opponentSide, "opponent")];

    // Kill lines fade out over TRACE_LINGER round-seconds, so only recent kills are drawn (not every
    // kill of the round lingering across the map).
    const TRACE_LINGER = 4;
    const traces: RadarTrace[] = [];
    for (let i = 0; i < allEvents.length && i < stepIndex; i += 1) {
      const e = allEvents[i];
      if ((!e.type || e.type === "kill") && e.killerId && e.victimId && e.killerPos && e.victimPos) {
        const age = e.t != null ? curT - e.t : 0;
        if (age < 0 || age > TRACE_LINGER) continue;
        traces.push({ round: activeRound, killerId: e.killerId, victimId: e.victimId, killerPos: e.killerPos, victimPos: e.victimPos, side: e.team === "you" ? yourSide : opponentSide, opacity: Math.max(0.05, 1 - age / TRACE_LINGER) });
      }
    }
    const pe = allEvents.findIndex((e) => e.type === "plant");
    const bomb = pe !== -1 && stepIndex > pe ? allEvents[pe].killerPos ?? null : null;

    // Flash-fade: a flash blinds enemies near where it lands, fading over ~1.4s of round-time.
    const FLASH_DUR = 1.4;
    const FLASH_R = 18;
    const flashed: Record<string, number> = {};
    for (const ev of allEvents) {
      if (ev.type !== "flash" || !ev.targetPos || ev.t == null) continue;
      const dt = curT - ev.t;
      if (dt < 0 || dt > FLASH_DUR) continue;
      const enemyTeam = ev.team === "you" ? "opponent" : "you";
      const fade = 1 - dt / FLASH_DUR;
      for (const p of players) {
        if (p.team !== enemyTeam || !p.alive) continue;
        const d = Math.hypot(p.x - ev.targetPos.x, p.y - ev.targetPos.y);
        if (d < FLASH_R) flashed[p.radarKey] = Math.max(flashed[p.radarKey] ?? 0, fade * (1 - d / FLASH_R));
      }
    }
    return { players, traces: traces.slice(-6), bomb, flashed };
  }

  // Find plant event details
  const plantEventIndex = allEvents.findIndex((e) => e.type === "plant");
  let plantSite: "A" | "B" = "A";
  if (plantEventIndex !== -1) {
    const plantEvent = allEvents[plantEventIndex];
    const seed = activeRound + (plantEvent.killerId ? plantEvent.killerId.length : 0);
    plantSite = seed % 2 === 0 ? "A" : "B";
  }

  // Determine T strategy
  const tTeamName = yourSide === "T" ? you.name : opponent.name;
  const strategySeed = hashString(tTeamName) + activeRound;
  const tStrategy = strategySeed % 3;
  // A narrated plant is authoritative for the called site. Without a plant, rotate the default
  // between A and B. The old independent strategy/plant seeds often made the entire T side reverse
  // direction at the plant event.
  const attackSite: Bombsite =
    plantEventIndex !== -1 ? plantSite : tStrategy === 2 ? "B" : "A";

  // 1. Assign phase plans: default -> contact/execute -> hold/retake.
  const allPlayers = [
    ...you.players.map((p, idx) => ({ p, idx, key: teamPlayerKey("you", p.id), side: yourSide, team: "you" as const })),
    ...opponent.players.map((p, idx) => ({ p, idx, key: teamPlayerKey("opponent", p.id), side: opponentSide, team: "opponent" as const }))
  ];

  const spawnSlotByKey = new Map<string, number>();
  for (const team of ["you", "opponent"] as const) {
    allPlayers
      .filter((player) => player.team === team)
      .sort(
        (a, b) =>
          TACTICAL_ROLE_ORDER[a.p.role] - TACTICAL_ROLE_ORDER[b.p.role] || a.idx - b.idx,
      )
      .forEach((player, slot) => spawnSlotByKey.set(player.key, slot));
  }

  const tacticalPlans = buildTacticalPlans(
    mapId,
    layout,
    allPlayers,
    attackSite,
    plantEventIndex !== -1,
    match.context?.preparation,
  );
  const playerDest = new Map<string, Position>();
  for (const { key } of allPlayers) {
    const plan = tacticalPlans.get(key);
    playerDest.set(key, plan?.hold ?? onFloor(layout.mid));
  }

  // 2. Initialize phase waypoints. Entry reaches contact first, the rifler remains a real trade
  // layer, support/IGL take the second lane, and the AWP keeps a long sightline.
  const playerWaypoints = new Map<string, Waypoint[]>();
  const contactStep =
    plantEventIndex !== -1
      ? plantEventIndex + 1
      : Math.max(0.8, totalSteps * 0.72);
  const setupStep = Math.max(0.48, Math.min(contactStep - 0.24, contactStep * 0.52));
  for (const { p, key, side } of allPlayers) {
    const baseSpawn = side === "CT" ? layout.ctSpawn : layout.tSpawn;
    const toward = layout.mid;
    const slot = spawnSlotByKey.get(key) ?? 0;
    const spawn = formationSlots(mapId, baseSpawn, toward, 5, 1.25, 1.9, 8)[slot];
    const departureDelay = [0, 0.12, 0.26, 0.42, 0.58][slot] ?? 0.58;
    const waypoints: Waypoint[] =
      departureDelay > 0
        ? [{ step: 0, pos: spawn }, { step: departureDelay, pos: spawn }]
        : [{ step: 0, pos: spawn }];
    const plan = tacticalPlans.get(key);
    if (plan) {
      const lastStep = () => waypoints[waypoints.length - 1].step;
      if (setupStep > lastStep() + 0.02) {
        waypoints.push({ step: setupStep, pos: plan.setup });
      }
      const roleLag =
        side === "T"
          ? p.role === "Entry"
            ? -0.1
            : p.role === "Rifler"
              ? 0.04
              : p.role === "Support"
                ? 0.1
                : p.role === "IGL"
                  ? 0.16
                  : 0
          : 0;
      const phasedContactStep = Math.max(
        lastStep() + 0.08,
        Math.min(totalSteps, contactStep + roleLag),
      );
      if (phasedContactStep > lastStep() + 0.02) {
        waypoints.push({ step: phasedContactStep, pos: plan.contact });
      }
      if (totalSteps > lastStep() + 0.02) {
        waypoints.push({ step: totalSteps, pos: plan.hold });
      }
    }
    playerWaypoints.set(key, waypoints);
  }

  const roundTraces: RadarTrace[] = [];
  const deadIdsSet = new Set<string>();
  const deathPos = new Map<string, Position>(); // where each victim died — dead dots freeze here
  const putWaypoint = (waypoints: Waypoint[], step: number, pos: Position) => {
    const existing = waypoints.findIndex((waypoint) => Math.abs(waypoint.step - step) < 1e-9);
    if (existing >= 0) waypoints[existing] = { step, pos };
    else waypoints.push({ step, pos });
    waypoints.sort((a, b) => a.step - b.step);
  };

  // 3. Process events chronologically
  for (let i = 0; i < allEvents.length; i++) {
    const event = allEvents[i];
    const occurrenceStep = i + 1;
    
    if ((!event.type || event.type === "kill") && event.victimId) {
      const victimId = event.victimId;
      const killerId = event.killerId;
      const victimTeam = event.team === "you" ? "opponent" : event.team === "opponent" ? "you" : undefined;
      const killerTeam = event.team === "you" ? "you" : event.team === "opponent" ? "opponent" : undefined;
      const victimKey = victimTeam ? teamPlayerKey(victimTeam, victimId) : victimId;
      const killerKey = killerTeam && killerId ? teamPlayerKey(killerTeam, killerId) : killerId;
      const victimWps = playerWaypoints.get(victimKey);
      const killerWps = killerKey ? playerWaypoints.get(killerKey) : undefined;
      deadIdsSet.add(victimKey);

      // Narration decides who won; the 3D arena decides where the duel can physically happen.
      // Sample each player's CURRENT tactical phase instead of pulling both bodies toward their
      // final site destination. Only the combatants rendezvous; their teammates keep their lanes.
      //
      // A fractional tactical waypoint very near this event used to leave only ~0.1 step to reach
      // the combat point. Remove those in-between stops for the two combatants so their approach is
      // spread over the full event interval rather than compressed into a visible last-frame dash.
      const openCombatInterval = (waypoints: Waypoint[] | undefined) => {
        if (!waypoints) return;
        for (let waypointIndex = waypoints.length - 1; waypointIndex >= 0; waypointIndex -= 1) {
          const waypointStep = waypoints[waypointIndex].step;
          if (waypointStep > occurrenceStep - 1 + 1e-6 && waypointStep < occurrenceStep - 1e-6) {
            waypoints.splice(waypointIndex, 1);
          }
        }
      };
      openCombatInterval(victimWps);
      openCombatInterval(killerWps);

      const intentAtContact = (key: string | undefined, fallback: Position): Position => {
        const wps = key ? playerWaypoints.get(key) : undefined;
        return wps
          ? getPlayerPositionAtStep(
              wps,
              occurrenceStep,
              layout,
              mapId,
              true,
              useSpatialRoutes,
            )
          : onFloor(fallback);
      };
      const victimIntent = intentAtContact(
        victimKey,
        playerDest.get(victimKey) ?? event.victimPos ?? layout.mid,
      );
      const killerIntent = intentAtContact(
        killerKey,
        (killerKey ? playerDest.get(killerKey) : undefined) ??
          event.killerPos ??
          victimIntent,
      );
      const duel = killerId
        ? resolveSpatialDuel(mapId, killerIntent, victimIntent, hashString(`${killerId}:${victimId}:${i}`))
        : { killer: killerIntent, victim: victimIntent };
      const killerFightPos = duel.killer;
      const victimDestination = duel.victim;
      deathPos.set(victimKey, victimDestination); // dead players freeze here (no ghost wandering)

      if (victimWps) {
        putWaypoint(victimWps, occurrenceStep, victimDestination);
        putWaypoint(victimWps, totalSteps, victimDestination); // stay dead
      }

      if (killerId) {
        if (killerWps) {
          putWaypoint(killerWps, occurrenceStep, killerFightPos);

          // After the kill the killer drifts toward their objective over the REST of the round, not
          // in a single step — a one-step hop across the map was the main "supersonic" sprint.
          const killerOwnDest = (killerKey ? playerDest.get(killerKey) : undefined) ?? victimDestination;
          if (occurrenceStep < totalSteps) {
            putWaypoint(killerWps, totalSteps, killerOwnDest);
          }

          const traceSide = event.team === "you" ? yourSide : opponentSide;
          roundTraces.push({
            round: activeRound,
            killerId,
            victimId,
            killerPos: killerFightPos,
            victimPos: victimDestination,
            side: traceSide,
            opacity: 1,
          });
        }
      }
    }
  }

  // 4. Finalize waypoints for survivors
  for (const { key } of allPlayers) {
    if (!deadIdsSet.has(key)) {
      const wps = playerWaypoints.get(key)!;
      const lastStep = wps[wps.length - 1].step;
      if (lastStep < totalSteps) {
        wps.push({ step: totalSteps, pos: playerDest.get(key)! });
      }
    }
  }

  // 4b. Collapse any duplicate-step waypoints (keep the latest write) and sort by step. Two
  // waypoints at the same step — e.g. a post-kill "head to dest" point colliding with a second
  // kill on the next event — would otherwise make the dot teleport across the map within one step.
  for (const { key } of allPlayers) {
    const wps = playerWaypoints.get(key)!;
    const byStep = new Map<number, Position>();
    for (const wp of wps) byStep.set(wp.step, wp.pos); // later writes win
    playerWaypoints.set(
      key,
      [...byStep.entries()].sort((a, b) => a[0] - b[0]).map(([step, pos]) => ({ step, pos })),
    );
  }

  // 5. Calculate final positions (+ facing) at current stepIndex
  // A dead player freezes at the spot they died — never keeps drifting along their route ("ghost").
  const positionFor = (key: string, isAlive: boolean): Position => {
    if (!isAlive && deathPos.has(key)) return deathPos.get(key)!;
    return getPlayerPositionAtStep(
      playerWaypoints.get(key) || [],
      stepIndex,
      layout,
      mapId,
      isAlive,
      useSpatialRoutes,
    );
  };
  const yawOf = (key: string, pos: Position): number => {
    const wps = playerWaypoints.get(key) || [];
    const prev = getPlayerPositionAtStep(
      wps,
      Math.max(0, stepIndex - 0.06),
      layout,
      mapId,
      true,
      useSpatialRoutes,
    );
    const dx = pos.x - prev.x;
    const dy = pos.y - prev.y;
    if (dx * dx + dy * dy > 0.04) return (Math.atan2(dy, dx) * 180) / Math.PI; // face movement
    const dest = playerDest.get(key);
    if (dest) return (Math.atan2(dest.y - pos.y, dest.x - pos.x) * 180) / Math.PI; // hold: face objective
    return 0;
  };

  const youSimulated = you.players.map((p) => {
    const radarKey = teamPlayerKey("you", p.id);
    const isAlive = !deadIds.has(radarKey);
    const pos = positionFor(radarKey, isAlive);
    return {
      ...p,
      radarKey,
      x: pos.x,
      y: pos.y,
      yaw: yawOf(radarKey, pos),
      alive: isAlive,
      side: yourSide,
      team: "you" as const,
    };
  });

  const opponentSimulated = opponent.players.map((p) => {
    const radarKey = teamPlayerKey("opponent", p.id);
    const isAlive = !deadIds.has(radarKey);
    const pos = positionFor(radarKey, isAlive);
    return {
      ...p,
      radarKey,
      x: pos.x,
      y: pos.y,
      yaw: yawOf(radarKey, pos),
      alive: isAlive,
      side: opponentSide,
      team: "opponent" as const,
    };
  });

  // Keep last 6 traces that have already occurred in the round
  const activeTraces = roundTraces.filter((_, idx) => {
    const killTrace = roundTraces[idx];
    const step = allEvents.findIndex((e) => (!e.type || e.type === "kill") && e.victimId === killTrace.victimId);
    return step !== -1 && step + 1 <= stepIndex + 1e-6;
  }).slice(-6);

  let currentBombPos: Position | null = null;
  if (plantEventIndex !== -1 && stepIndex + 1e-6 >= plantEventIndex + 1) {
    // The arena's selected site owns the bomb marker. Narration coordinates can come from a generic
    // sim event and must not pull the post-plant back through a train/building.
    currentBombPos = onFloor(plantSite === "A" ? layout.bombsiteA : layout.bombsiteB);
  }

  return {
    players: [...youSimulated, ...opponentSimulated],
    traces: activeTraces,
    bomb: currentBombPos,
    flashed: {},
  };
}

// Fixed delay tables — map view is intentionally slower for smooth walking
const mapSpeedDelays: Record<number, number> = {
  0.5: 5500,
  1: 3200,
  2: 1600,
  4: 700,
};

const feedSpeedDelays: Record<number, number> = {
  0.5: 3500,
  1: 2200,
  2: 1000,
  4: 400,
};

// Mirage map-view pacing is by DISTANCE MOVED, not elapsed round-time: a step's real duration scales
// with how far the busiest player travels in that interval. So actual movement plays at a constant
// speed, while a post-kill hold (lots of round-time, little motion) is skipped quickly instead of
// dwelling — which is what made it look like it "slowed down after every kill".
const MS_PER_UNIT = 80; // real ms per radar-unit (0..100) of movement, at speed 1
const STEP_MIN = 300; // a kill/hold step still shows for a beat
const STEP_MAX = 4200; // cap so the longest single move can't drag

export function getStepDelay(
  match: MatchState,
  you: FieldTeam,
  opponent: FieldTeam,
  stepIndex: number,
  speed: number,
  liveFeedView: "feed" | "map"
): number {
  if (liveFeedView === "map" && match.map === "mirage" && match.roundTimeline && match.roundTimeline.length) {
    const active = match.pendingEvents?.[0]?.round ?? match.feed[0]?.round ?? match.round;
    const completed = match.feed.filter((e) => e.round === active);
    const remaining = (match.pendingEvents || []).filter((e) => e.round === active);
    const chron = [...[...completed].reverse(), ...remaining];
    const idx = completed.length; // the next event to reveal
    if (idx >= 1 && idx < chron.length) {
      const tA = chron[idx - 1].t ?? 0;
      const tB = chron[idx].t ?? 0;
      const tl = match.roundTimeline;
      const ids = tl[0]?.players.map((p) => p.id) ?? [];
      let maxMove = 0;
      for (const id of ids) {
        const a = sampleTimeline(tl, tA, id);
        const b = sampleTimeline(tl, tB, id);
        if (a && b) maxMove = Math.max(maxMove, Math.hypot(b.x - a.x, b.y - a.y));
      }
      return Math.max(STEP_MIN, Math.min(STEP_MAX, (maxMove * MS_PER_UNIT) / speed));
    }
  }
  if (liveFeedView === "map" && getNavGrid(match.map)) {
    // Pace the reconstructed 3D arena by the distance its busiest player actually travels between
    // these two event boundaries. This keeps the feed and arena synchronized without forcing a body
    // to its kill coordinate early or letting a long rotate play as a one-frame jump.
    const fromStep = Math.max(0, stepIndex - 1);
    const before = simulateRadarPlayers(match, you, opponent, fromStep).players;
    const after = simulateRadarPlayers(match, you, opponent, stepIndex).players;
    const beforeByKey = new Map(before.map((player) => [player.radarKey, player]));
    let maxMove = 0;
    for (const player of after) {
      const previous = beforeByKey.get(player.radarKey);
      if (!previous) continue;
      // Use travelled corridor length, not straight-line displacement. Around trains/buildings a
      // 25-unit route can have endpoints only a few units apart; Euclidean pacing made that entire
      // bend play in a fraction of a second and read as a teleport.
      maxMove = Math.max(
        maxMove,
        routeLength(
          cleanRoute(
            spatialRoute(
              match.map,
              { x: previous.x, y: previous.y },
              { x: player.x, y: player.y },
            ),
          ),
        ),
      );
    }
    return Math.max(STEP_MIN, Math.min(STEP_MAX, (maxMove * MS_PER_UNIT) / speed));
  }
  if (liveFeedView === "map") {
    return mapSpeedDelays[speed] ?? 3200;
  }
  return feedSpeedDelays[speed] ?? 2200;
}
