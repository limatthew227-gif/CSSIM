import { MatchState, FieldTeam } from "./sim";
import { MapId, Player } from "./gameData";
import { findRoute, corridorPath } from "./pathfinder";
import { nearestNode } from "./mirageNav";
import { getNavGrid, snapToWalkable, hasLineOfSight } from "./mapGeometry";
import type { TimelineFrame } from "./mirageRoundSim";

// Walkable mask for the graph map, memoized once (getNavGrid is itself memoized).
const MIRAGE_GRID = getNavGrid("mirage");
const onFloor = (p: Position): Position => (MIRAGE_GRID ? snapToWalkable(MIRAGE_GRID, p) : p);

// Longest believable engagement on the radar (units, 0..100). Kills resolved farther apart than this
// — or with no clear sightline — get the victim pulled in toward the killer so the trace reads as a
// real duel down a sightline instead of a shot across the whole map through buildings.
const MAX_ENGAGE = 34;
function plausibleEngagement(killer: Position, victim: Position): Position {
  const dx = victim.x - killer.x;
  const dy = victim.y - killer.y;
  const d = Math.hypot(dx, dy);
  let v = victim;
  // 1. Cap the distance so nothing reads as a shot across the whole map.
  if (d > MAX_ENGAGE) {
    const k = MAX_ENGAGE / d;
    v = { x: killer.x + dx * k, y: killer.y + dy * k };
  }
  // 2. Only correct line-of-sight on the longer shots — close-range grid LOS is noisy (thin 1-cell
  //    walls between adjacent free cells), and pulling every short duel in collapses them onto the
  //    killer and kills the spatial variety. Gentle pull, few steps.
  if (Math.hypot(v.x - killer.x, v.y - killer.y) > 14) {
    for (let i = 0; i < 3 && MIRAGE_GRID && !hasLineOfSight(MIRAGE_GRID, killer, v); i += 1) {
      v = { x: killer.x + (v.x - killer.x) * 0.75, y: killer.y + (v.y - killer.y) * 0.75 };
    }
  }
  return onFloor(v);
}

export interface Position {
  x: number;
  y: number;
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
    // Spawns/sites read from the radar image (A = triple-box upper-left, B = market bottom-centre,
    // T = upper-right, CT = lower-left). Movement routes on the Mirage tactical graph (mirageNav.ts),
    // not the radar pixels or the legacy node routes below.
    tSpawn: { x: 87, y: 37 },
    ctSpawn: { x: 28, y: 71 },
    bombsiteA: { x: 24, y: 28 },
    bombsiteB: { x: 54, y: 76 },
    mid: { x: 44, y: 45 },
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
  x: number;
  y: number;
  yaw: number; // facing in degrees (0 = +x / east), from movement direction
  alive: boolean;
  side: "CT" | "T";
  team: "you" | "opponent";
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
  return cleaned;
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

// Movement speed for graph maps, in radar units (0..100) per event-step. Waypoint steps are re-timed
// so no leg is ever traversed faster than this — the cure for "supersonic" sprints.
const WALK_SPEED = 15;

function polylineLength(pts: Position[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

function getPlayerPositionAtStep(wps: Waypoint[], step: number, layout: MapLayout, isAlive: boolean = true, useGraph = false): Position {
  if (wps.length === 0) return { x: 50, y: 50 };
  if (wps.length === 1) return wps[0].pos;
  if (step >= wps[wps.length - 1].step) return wps[wps.length - 1].pos;

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
  if (useGraph) {
    // Tactical graph: route callout-to-callout (elevation-aware), never off the radar image. The
    // any-angle corridor path is already corner-hugging and strictly on the floor; we do NOT Chaikin
    // it (corner-cutting shaved routes back into walls, and snapping those back caused jitter).
    cleaned = cleanRoute(graphRoute(w1.pos, w2.pos)).map(onFloor);
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
  // Final guard: a point interpolated between two floor vertices can still clip a wall corner, so
  // snap the rendered position onto the walkable mask (no-op when already on the floor).
  return useGraph ? onFloor(pos) : pos;
}

export interface RadarTrace {
  round: number;
  killerId: string;
  victimId: string;
  killerPos: Position;
  victimPos: Position;
  side: "CT" | "T" | "neutral";
}

export interface RadarSimulationResult {
  players: SimulatedRadarPlayer[];
  traces: RadarTrace[];
  bomb: Position | null;
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
      return { x: pa.x + (pb.x - pa.x) * f, y: pa.y + (pb.y - pa.y) * f, yaw: pa.yaw };
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
  const useGraph = mapId === "mirage"; // route on the tactical graph; legacy node routes elsewhere
  const yourSide = match.side;
  const opponentSide: "CT" | "T" = yourSide === "CT" ? "T" : "CT";

  // Reconstruct round event stream
  const activeRound = match.pendingEvents?.[0]?.round ?? match.feed[0]?.round ?? match.round;
  const completedEvents = match.feed.filter((e) => e.round === activeRound);
  const remainingEvents = (match.pendingEvents || []).filter((e) => e.round === activeRound);
  const allEvents = [...[...completedEvents].reverse(), ...remainingEvents];
  
  const stepIndex = stepOverride !== undefined ? stepOverride : completedEvents.length;
  const totalSteps = Math.max(1, allEvents.length);

  const deadIds = new Set();
  for (let i = 0; i < allEvents.length; i++) {
    const event = allEvents[i];
    if ((!event.type || event.type === "kill") && event.victimId) {
      if (i < stepIndex) {
        deadIds.add(event.victimId);
      }
    }
  }

  // === Mirage spatial replay: play the engine's real per-player trajectories (set by playRound). ===
  // This is the authoritative movement now — players spread across approaches and only meet where the
  // duels actually happened, so no funnel/teleport and traces are real sightlines.
  if (useGraph && match.roundTimeline && match.roundTimelineRound === activeRound && match.roundTimeline.length) {
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
        const s = sampleTimeline(tl, curT, p.id);
        return { ...p, x: s?.x ?? 50, y: s?.y ?? 50, yaw: s?.yaw ?? 0, alive: !deadIds.has(p.id), side, team };
      });
    const players = [...mk(you.players, yourSide, "you"), ...mk(opponent.players, opponentSide, "opponent")];

    const traces: RadarTrace[] = [];
    for (let i = 0; i < allEvents.length && i < stepIndex; i += 1) {
      const e = allEvents[i];
      if ((!e.type || e.type === "kill") && e.killerId && e.victimId && e.killerPos && e.victimPos) {
        traces.push({ round: activeRound, killerId: e.killerId, victimId: e.victimId, killerPos: e.killerPos, victimPos: e.victimPos, side: e.team === "you" ? yourSide : opponentSide });
      }
    }
    const pe = allEvents.findIndex((e) => e.type === "plant");
    const bomb = pe !== -1 && stepIndex > pe ? allEvents[pe].killerPos ?? null : null;
    return { players, traces: traces.slice(-6), bomb };
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

  // 1. Determine base destinations — always use exact known node positions
  const allPlayers = [
    ...you.players.map((p, idx) => ({ p, idx, side: yourSide, team: "you" as const })),
    ...opponent.players.map((p, idx) => ({ p, idx, side: opponentSide, team: "opponent" as const }))
  ];

  const playerDest = new Map<string, Position>();
  for (const { p, idx, side } of allPlayers) {
    let dest: Position;
    if (side === "CT") {
      if (idx === 0 || idx === 3) dest = layout.bombsiteA;
      else if (idx === 1 || idx === 4) dest = layout.bombsiteB;
      else dest = layout.mid;
    } else {
      if (tStrategy === 1) dest = idx === 4 ? layout.mid : layout.bombsiteA;
      else if (tStrategy === 2) dest = idx === 4 ? layout.mid : layout.bombsiteB;
      else {
        if (idx === 0 || idx === 1) dest = layout.bombsiteA;
        else if (idx === 2 || idx === 3) dest = layout.bombsiteB;
        else dest = layout.mid;
      }
    }
    playerDest.set(p.id, dest);
  }

  // 2. Initialize waypoints — everyone starts at spawn
  const playerWaypoints = new Map<string, Waypoint[]>();
  for (const { p, side } of allPlayers) {
    const spawn = side === "CT" ? layout.ctSpawn : layout.tSpawn;
    playerWaypoints.set(p.id, [{ step: 0, pos: spawn }]);
  }

  const roundTraces: RadarTrace[] = [];
  const deadIdsSet = new Set<string>();
  const deathPos = new Map<string, Position>(); // where each victim died — dead dots freeze here

  // 3. Process events chronologically
  for (let i = 0; i < allEvents.length; i++) {
    const event = allEvents[i];
    
    if (event.type === "plant") {
       const plantSitePos = plantSite === "A" ? layout.bombsiteA : layout.bombsiteB;
       for (const { p, idx, team } of allPlayers) {
         if (!deadIdsSet.has(p.id)) {
           const wps = playerWaypoints.get(p.id)!;
           const lastWp = wps[wps.length - 1];
           // By the plant a player should be AT their pre-plant objective (site/mid), then rotate —
           // NOT frozen at spawn. Anchor them at their current destination at the plant step; the
           // rotate leg (below) then runs from there over the rest of the round.
           const preplantDest = playerDest.get(p.id) ?? lastWp.pos;
           if (lastWp.step < i) {
             wps.push({ step: i, pos: preplantDest });
           }

           const actualSide = team === "you" ? yourSide : opponentSide;
           if (actualSide === "T") {
             // One lurker goes mid, rest play on site
             if (idx === 0) {
               playerDest.set(p.id, layout.mid);
             } else {
               playerDest.set(p.id, plantSitePos);
             }
           } else {
             // CT retakes toward bomb site
             playerDest.set(p.id, plantSitePos);
           }
         }
       }
    }
    
    if ((!event.type || event.type === "kill") && event.victimId) {
      const victimId = event.victimId;
      const killerId = event.killerId;
      deadIdsSet.add(victimId);

      // Raw spots the sim resolved the duel at (pixel-nav maps like mirage); else where they headed.
      const rawVictim = onFloor(event.victimPos ?? playerDest.get(victimId) ?? layout.mid);
      // Killer position first (needed to make the engagement plausible): the sim's, else a peek offset.
      const angle = hashString((killerId || "") + i) * (Math.PI / 180);
      const killerFightPos = onFloor(event.killerPos ?? {
        x: rawVictim.x + Math.cos(angle) * 1.2,
        y: rawVictim.y + Math.sin(angle) * 1.2,
      });
      // Pull the victim in so the duel is a believable sightline, not a cross-map shot through walls.
      const victimDestination = killerId ? plausibleEngagement(killerFightPos, rawVictim) : rawVictim;
      deathPos.set(victimId, victimDestination); // dead players freeze here (no ghost wandering)

      const victimWps = playerWaypoints.get(victimId);
      if (victimWps) {
        victimWps.push({ step: i, pos: victimDestination });
        victimWps.push({ step: totalSteps, pos: victimDestination }); // stay dead
      }

      if (killerId) {
        const killerWps = playerWaypoints.get(killerId);
        if (killerWps) {
          killerWps.push({ step: i, pos: killerFightPos });

          // After the kill the killer drifts toward their objective over the REST of the round, not
          // in a single step — a one-step hop across the map was the main "supersonic" sprint.
          const killerOwnDest = playerDest.get(killerId) ?? victimDestination;
          if (i + 1 < totalSteps) {
            killerWps.push({ step: totalSteps, pos: killerOwnDest });
          }

          const traceSide = event.team === "you" ? yourSide : opponentSide;
          roundTraces.push({
            round: activeRound,
            killerId,
            victimId,
            killerPos: killerFightPos,
            victimPos: victimDestination,
            side: traceSide
          });
        }
      }
    }
  }

  // 4. Finalize waypoints for survivors
  for (const { p } of allPlayers) {
    if (!deadIdsSet.has(p.id)) {
      const wps = playerWaypoints.get(p.id)!;
      const lastStep = wps[wps.length - 1].step;
      if (lastStep < totalSteps) {
        wps.push({ step: totalSteps, pos: playerDest.get(p.id)! });
      }
    }
  }

  // 4b. Collapse any duplicate-step waypoints (keep the latest write) and sort by step. Two
  // waypoints at the same step — e.g. a post-kill "head to dest" point colliding with a second
  // kill on the next event — would otherwise make the dot teleport across the map within one step.
  for (const { p } of allPlayers) {
    const wps = playerWaypoints.get(p.id)!;
    const byStep = new Map<number, Position>();
    for (const wp of wps) byStep.set(wp.step, wp.pos); // later writes win
    playerWaypoints.set(
      p.id,
      [...byStep.entries()].sort((a, b) => a[0] - b[0]).map(([step, pos]) => ({ step, pos })),
    );
  }

  // 4c. Re-time waypoints (graph maps) so every leg gets enough event-steps for its actual corridor
  // length at WALK_SPEED. This is the core "supersonic" cure: a long route crammed into one step
  // used to be traversed instantly; now each leg's step span is at least length/WALK_SPEED, so the
  // dot moves at a constant, believable pace. Anchors only ever move LATER (so order is preserved),
  // and a player whose timeline runs past round-end simply hasn't finished crossing — which is fine.
  if (useGraph) {
    for (const { p } of allPlayers) {
      const wps = playerWaypoints.get(p.id)!;
      if (wps.length < 2) continue;
      const retimed: Waypoint[] = [wps[0]];
      let prevStep = wps[0].step;
      for (let k = 1; k < wps.length; k += 1) {
        const legLen = polylineLength(graphRoute(wps[k - 1].pos, wps[k].pos));
        const step = Math.max(wps[k].step, prevStep + legLen / WALK_SPEED);
        retimed.push({ step, pos: wps[k].pos });
        prevStep = step;
      }
      playerWaypoints.set(p.id, retimed);
    }
  }

  // 5. Calculate final positions (+ facing) at current stepIndex
  // A dead player freezes at the spot they died — never keeps drifting along their route ("ghost").
  const positionFor = (p: Player, isAlive: boolean): Position => {
    if (!isAlive && deathPos.has(p.id)) return deathPos.get(p.id)!;
    return getPlayerPositionAtStep(playerWaypoints.get(p.id) || [], stepIndex, layout, isAlive, useGraph);
  };
  const yawOf = (p: Player, pos: Position): number => {
    const wps = playerWaypoints.get(p.id) || [];
    const prev = getPlayerPositionAtStep(wps, Math.max(0, stepIndex - 0.06), layout, true, useGraph);
    const dx = pos.x - prev.x;
    const dy = pos.y - prev.y;
    if (dx * dx + dy * dy > 0.04) return (Math.atan2(dy, dx) * 180) / Math.PI; // face movement
    const dest = playerDest.get(p.id);
    if (dest) return (Math.atan2(dest.y - pos.y, dest.x - pos.x) * 180) / Math.PI; // hold: face objective
    return 0;
  };

  const youSimulated = you.players.map((p) => {
    const isAlive = !deadIds.has(p.id);
    const pos = positionFor(p, isAlive);
    return {
      ...p,
      x: pos.x,
      y: pos.y,
      yaw: yawOf(p, pos),
      alive: isAlive,
      side: yourSide,
      team: "you" as const,
    };
  });

  const opponentSimulated = opponent.players.map((p) => {
    const isAlive = !deadIds.has(p.id);
    const pos = positionFor(p, isAlive);
    return {
      ...p,
      x: pos.x,
      y: pos.y,
      yaw: yawOf(p, pos),
      alive: isAlive,
      side: opponentSide,
      team: "opponent" as const,
    };
  });

  // Keep last 6 traces that have already occurred in the round
  const activeTraces = roundTraces.filter((_, idx) => {
    const killTrace = roundTraces[idx];
    const step = allEvents.findIndex((e) => (!e.type || e.type === "kill") && e.victimId === killTrace.victimId);
    return step !== -1 && step < stepIndex;
  }).slice(-6);

  let currentBombPos: Position | null = null;
  if (plantEventIndex !== -1 && stepIndex >= plantEventIndex) {
    // Prefer the plant position the sim chose (matches the CT retake target); else fall back to the seed.
    currentBombPos = onFloor(allEvents[plantEventIndex].killerPos ?? (plantSite === "A" ? layout.bombsiteA : layout.bombsiteB));
  }

  return {
    players: [...youSimulated, ...opponentSimulated],
    traces: activeTraces,
    bomb: currentBombPos,
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

// Real radar-seconds (ms) per ROUND-second of the spatial timeline. The per-step delay is the gap to
// the next event scaled by this, so the radar advances at a CONSTANT rate — movement speed no longer
// lurches with how close together kills happen. Clamped so the opening walk fast-forwards a little
// and a quick trade still reads.
const MS_PER_SIM_SEC = 900;
const STEP_MIN = 350;
const STEP_MAX = 2800;

export function getStepDelay(
  match: MatchState,
  _you: FieldTeam,
  _opponent: FieldTeam,
  _stepIndex: number,
  speed: number,
  liveFeedView: "feed" | "map"
): number {
  // Mirage map view plays the spatial timeline — pace by real round-time so movement is constant.
  if (liveFeedView === "map" && match.map === "mirage" && match.roundTimeline) {
    const active = match.pendingEvents?.[0]?.round ?? match.feed[0]?.round ?? match.round;
    const completed = match.feed.filter((e) => e.round === active);
    const remaining = (match.pendingEvents || []).filter((e) => e.round === active);
    const chron = [...[...completed].reverse(), ...remaining];
    const idx = completed.length; // the next event to reveal
    if (idx >= 1 && idx < chron.length) {
      const gap = Math.max(0, (chron[idx].t ?? 0) - (chron[idx - 1].t ?? 0));
      return Math.max(STEP_MIN, Math.min(STEP_MAX, (gap * MS_PER_SIM_SEC) / speed));
    }
  }
  if (liveFeedView === "map") {
    return mapSpeedDelays[speed] ?? 3200;
  }
  return feedSpeedDelays[speed] ?? 2200;
}
