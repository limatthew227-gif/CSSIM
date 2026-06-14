import { MatchState, FieldTeam } from "./sim";
import { MapId, Player } from "./gameData";

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
    tSpawn: { x: 88, y: 36 },
    ctSpawn: { x: 28, y: 70 },
    bombsiteA: { x: 54, y: 76 },
    bombsiteB: { x: 23, y: 28 },
    mid: { x: 50, y: 50 },
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
  const segmentCount = path.length - 1;
  const segment = Math.min(segmentCount - 1, Math.floor(t * segmentCount));
  const segmentT = (t * segmentCount) - segment;
  return interpolate(path[segment], path[segment + 1], segmentT);
}

interface Waypoint {
  step: number;
  pos: Position;
}

function getPlayerPositionAtStep(wps: Waypoint[], step: number, layout: MapLayout): Position {
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
  const t = denominator > 0 ? (step - w1.step) / denominator : 0;

  const n1 = getClosestNodeKey(w1.pos, layout);
  const n2 = getClosestNodeKey(w2.pos, layout);

  const pathNodes = getPathBetween(n1, n2, layout);
  const fullPath = [w1.pos, ...pathNodes, w2.pos];
  const cleaned = cleanRoute(fullPath);

  return getPathPosition(cleaned, t);
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
}

export function simulateRadarPlayers(
  match: MatchState,
  you: FieldTeam,
  opponent: FieldTeam
): RadarSimulationResult {
  const mapId = match.map;
  const layout = MAP_LAYOUTS[mapId] || MAP_LAYOUTS.mirage;
  const yourSide = match.side;
  const opponentSide: "CT" | "T" = yourSide === "CT" ? "T" : "CT";

  // Reconstruct round event stream
  const activeRound = match.pendingEvents?.[0]?.round ?? match.feed[0]?.round ?? match.round;
  const completedEvents = match.feed.filter((e) => e.round === activeRound);
  const remainingEvents = (match.pendingEvents || []).filter((e) => e.round === activeRound);
  const allEvents = [...[...completedEvents].reverse(), ...remainingEvents];

  const elapsedSeconds = match.elapsedSeconds;
  const roundEndTime = match.roundEndTime;

  const stepIndex = elapsedSeconds !== undefined ? elapsedSeconds : completedEvents.length;
  const totalSteps = roundEndTime !== undefined ? roundEndTime : Math.max(1, allEvents.length);

  const getEventStep = (idx: number): number => {
    if (elapsedSeconds !== undefined) {
      const event = allEvents[idx];
      return event?.time !== undefined ? event.time : idx;
    }
    return idx;
  };

  const deadIds = new Set(completedEvents.filter((e) => !e.type || e.type === "kill").map((e) => e.victimId));

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

  // 1. Initialize waypoints for all players
  const playerWaypoints = new Map<string, Waypoint[]>();
  
  const allPlayers = [
    ...you.players.map((p, idx) => ({ p, idx, side: yourSide, team: "you" as const })),
    ...opponent.players.map((p, idx) => ({ p, idx, side: opponentSide, team: "opponent" as const }))
  ];

  const reachStep = elapsedSeconds !== undefined ? 15 : Math.max(1, Math.floor(totalSteps * 0.3));

  for (const { p, idx, side } of allPlayers) {
    const spawn = side === "CT" ? layout.ctSpawn : layout.tSpawn;
    
    // Initial destination site
    let initDest: "bombsiteA" | "bombsiteB" | "mid" = "bombsiteA";
    if (side === "CT") {
      if (idx === 0 || idx === 3) initDest = "bombsiteA";
      else if (idx === 1 || idx === 4) initDest = "bombsiteB";
      else initDest = "mid";
    } else {
      if (tStrategy === 1) initDest = idx === 4 ? "mid" : "bombsiteA";
      else if (tStrategy === 2) initDest = idx === 4 ? "mid" : "bombsiteB";
      else {
        if (idx === 0 || idx === 1) initDest = "bombsiteA";
        else if (idx === 2 || idx === 3) initDest = "bombsiteB";
        else initDest = "mid";
      }
    }
    
    const destPos = initDest === "bombsiteA" ? layout.bombsiteA : initDest === "bombsiteB" ? layout.bombsiteB : layout.mid;
    
    // Create base route waypoints (step 0 at spawn, step reachStep at target site, step totalSteps at target site)
    const wps: Waypoint[] = [
      { step: 0, pos: spawn },
      { step: reachStep, pos: destPos },
      { step: totalSteps, pos: destPos }
    ];
    playerWaypoints.set(p.id, wps);
  }

  // 2. Adjust target destinations for bomb plant (rotate to plant site)
  const plantStep = plantEventIndex !== -1 ? getEventStep(plantEventIndex) : -1;
  if (plantStep !== -1) {
    const plantSitePos = plantSite === "A" ? layout.bombsiteA : layout.bombsiteB;
    for (const { p } of allPlayers) {
      const wps = playerWaypoints.get(p.id)!;
      // Filter out base waypoints after plantStep, and insert rotation
      const cleaned = wps.filter((w) => w.step < plantStep);
      const posAtPlant = getPlayerPositionAtStep(wps, plantStep, layout);
      cleaned.push({ step: plantStep, pos: posAtPlant });
      cleaned.push({ step: totalSteps, pos: plantSitePos });
      playerWaypoints.set(p.id, cleaned);
    }
  }

  const roundTraces: RadarTrace[] = [];

  // 3. Process kill events in chronological order to match positions
  for (let i = 0; i < allEvents.length; i++) {
    const event = allEvents[i];
    if ((!event.type || event.type === "kill") && event.victimId) {
      const victimId = event.victimId;
      const killerId = event.killerId;
      const eventStep = getEventStep(i);
      
      const victimWps = playerWaypoints.get(victimId);
      if (victimWps) {
        // Find victim position at eventStep before death
        const victimPos = getPlayerPositionAtStep(victimWps, eventStep, layout);
        
        // Victim dies here: freeze them at victimPos from eventStep onwards
        const cleanedWps = victimWps.filter((w) => w.step < eventStep);
        cleanedWps.push({ step: eventStep, pos: victimPos });
        cleanedWps.push({ step: totalSteps, pos: victimPos });
        playerWaypoints.set(victimId, cleanedWps);
        
        // Force the killer to match the victim's position at eventStep (offset slightly for line-of-sight)
        if (killerId) {
          const killerWps = playerWaypoints.get(killerId);
          if (killerWps) {
            const angle = hashString(killerId + i) * (Math.PI / 180);
            const offset = { x: Math.cos(angle) * 3.5, y: Math.sin(angle) * 3.5 };
            const killerFightPos = { x: victimPos.x + offset.x, y: victimPos.y + offset.y };
            
            // Record fight trace
            const traceSide = event.team === "you" ? yourSide : opponentSide;
            roundTraces.push({
              round: activeRound,
              killerId,
              victimId,
              killerPos: killerFightPos,
              victimPos: victimPos,
              side: traceSide
            });

            // Insert the fight waypoint for the killer at eventStep
            const insertIdx = killerWps.findIndex((w) => w.step > eventStep);
            if (insertIdx !== -1) {
              const before = killerWps.slice(0, insertIdx);
              const after = killerWps.slice(insertIdx);
              
              if (before.length > 0 && before[before.length - 1].step === eventStep) {
                before[before.length - 1].pos = killerFightPos;
                playerWaypoints.set(killerId, [...before, ...after]);
              } else {
                playerWaypoints.set(killerId, [...before, { step: eventStep, pos: killerFightPos }, ...after]);
              }
            }
          }
        }
      }
    }
  }

  // 4. Calculate final positions at current stepIndex
  const youSimulated = you.players.map((p) => {
    const wps = playerWaypoints.get(p.id) || [];
    const pos = getPlayerPositionAtStep(wps, stepIndex, layout);
    return {
      ...p,
      x: pos.x,
      y: pos.y,
      alive: !deadIds.has(p.id),
      side: yourSide,
      team: "you" as const,
    };
  });

  const opponentSimulated = opponent.players.map((p) => {
    const wps = playerWaypoints.get(p.id) || [];
    const pos = getPlayerPositionAtStep(wps, stepIndex, layout);
    return {
      ...p,
      x: pos.x,
      y: pos.y,
      alive: !deadIds.has(p.id),
      side: opponentSide,
      team: "opponent" as const,
    };
  });

  // Keep last 6 traces that have already occurred in the round
  const activeTraces = roundTraces.filter((_, idx) => {
    const killTrace = roundTraces[idx];
    const eventIdx = allEvents.findIndex((e) => (!e.type || e.type === "kill") && e.victimId === killTrace.victimId);
    const eventStep = eventIdx !== -1 ? getEventStep(eventIdx) : -1;
    return eventStep !== -1 && eventStep < stepIndex;
  }).slice(-6);

  return {
    players: [...youSimulated, ...opponentSimulated],
    traces: activeTraces
  };
}
