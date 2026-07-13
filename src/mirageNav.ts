/**
 * Mirage tactical graph — node positions and connectivity are DERIVED FROM A REAL CS2 DEMO, not
 * eyeballed. Each callout's radar coordinate is the centroid of real player positions tagged with
 * that callout (`last_place_name`), and edges are the callout-to-callout transitions players actually
 * made. See scripts/calibrate-mirage.ts. Node ids keep the names the sim/AI code uses; the `callout`
 * string is the in-game CS2 name. Radar coords are 0..100 and project straight onto the radar image.
 *
 * Orientation (verified against the Simple Radar PNG via the demo): B site upper-left, A site
 * bottom-centre, T spawn right, CT spawn lower-left.
 */

export type NodeType = "spawn" | "site" | "mid" | "choke" | "connector" | "rotate" | "lurker";

export interface MapNode {
  id: string;
  callout: string;
  x: number; // radar 0..100
  y: number; // radar 0..100
  z: number; // relative elevation (tagging only)
  floor: number; // 0 ground, +1 elevated (palace/apps), -1 below (underpass)
  type: NodeType;
}

export type EdgeReq = "none" | "jump" | "drop" | "ladder" | "crouch";

export interface MapEdge {
  from: string;
  to: string;
  travelTime: number; // seconds-ish (auto: radar distance / walk speed)
  exposure: number; // 0..1 how open/peekable
  noise: number; // 0..1
  chokepoint: number; // 0..1 how pinch-y / utility-dependent
  utilityValue: number; // 0..1 how much util helps here
  oneWay?: boolean; // e.g. palace drop -> A (can't climb back)
  requires?: EdgeReq;
  tags?: string[];
}

// --- Nodes: real callout centroids (radar 0..100), averaged over 4 pro CS2 demos (~374k samples) ---
export const mirageNodes: MapNode[] = [
  { id: "tspawn", callout: "T Spawn", x: 86.5, y: 36.6, z: 0, floor: 0, type: "spawn" },
  { id: "ctspawn", callout: "CT Spawn", x: 31.9, y: 68.7, z: 0, floor: 0, type: "spawn" },
  { id: "asite", callout: "A Site", x: 54.4, y: 70.4, z: 0, floor: 0, type: "site" },
  { id: "bsite", callout: "B Site", x: 25.0, y: 28.2, z: 0, floor: 0, type: "site" },
  { id: "mid", callout: "Middle", x: 51.2, y: 48.0, z: 0, floor: 0, type: "mid" },
  { id: "topmid", callout: "Top Mid", x: 68.8, y: 41.3, z: 0, floor: 0, type: "mid" },
  { id: "window", callout: "Snipers Nest", x: 39.9, y: 47.9, z: 1, floor: 1, type: "choke" },
  { id: "connector", callout: "Connector", x: 50.3, y: 54.9, z: 0, floor: 0, type: "connector" },
  { id: "jungle", callout: "Jungle", x: 43.9, y: 60.9, z: 0, floor: 0, type: "connector" },
  { id: "catwalk", callout: "Catwalk", x: 47.8, y: 36.0, z: 0, floor: 0, type: "connector" },
  { id: "aramp", callout: "Stairs", x: 53.4, y: 61.6, z: 0, floor: 0, type: "choke" },
  { id: "palace", callout: "Palace", x: 71.0, y: 73.0, z: 1, floor: 1, type: "choke" },
  { id: "tramp", callout: "T Ramp", x: 70.4, y: 65.2, z: 0, floor: 0, type: "connector" },
  { id: "palacealley", callout: "Palace Alley", x: 78.5, y: 59.1, z: 0, floor: 0, type: "connector" },
  { id: "scaffolding", callout: "Scaffolding", x: 62.9, y: 73.3, z: 0, floor: 0, type: "connector" },
  { id: "sidealley", callout: "Side Alley", x: 73.5, y: 26.2, z: 0, floor: 0, type: "connector" },
  { id: "house", callout: "House", x: 69.2, y: 18.3, z: 0, floor: 0, type: "connector" },
  { id: "backalley", callout: "Back Alley", x: 53.2, y: 21.9, z: 0, floor: 0, type: "connector" },
  { id: "underpass", callout: "Underpass", x: 45.4, y: 31.8, z: -1, floor: -1, type: "lurker" },
  { id: "bapps", callout: "Apartments", x: 32.4, y: 19.5, z: 1, floor: 1, type: "choke" },
  { id: "van", callout: "Van", x: 20.4, y: 19.1, z: 0, floor: 0, type: "choke" },
  { id: "market", callout: "Market", x: 25.4, y: 43.9, z: 0, floor: 0, type: "connector" },
];

const nodeById = new Map(mirageNodes.map((n) => [n.id, n]));
export function getNode(id: string): MapNode | undefined {
  return nodeById.get(id);
}

// --- Edges: real callout adjacency (player transitions). travelTime auto from radar distance. ---
type EdgeTac = Partial<Omit<MapEdge, "from" | "to" | "travelTime">>;
const WALK = 5; // radar units/sec (calibrated from the demo)
function e(from: string, to: string, tac: EdgeTac = {}): MapEdge {
  const a = nodeById.get(from)!;
  const b = nodeById.get(to)!;
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  return {
    from,
    to,
    travelTime: Math.max(0.5, d / WALK),
    exposure: tac.exposure ?? 0.3,
    noise: tac.noise ?? 0.3,
    chokepoint: tac.chokepoint ?? 0.2,
    utilityValue: tac.utilityValue ?? 0.2,
    oneWay: tac.oneWay,
    requires: tac.requires,
    tags: tac.tags,
  };
}

export const mirageEdges: MapEdge[] = [
  // T spawn out
  e("tspawn", "sidealley", { exposure: 0.3, tags: ["t-exit"] }),
  e("tspawn", "palacealley", { exposure: 0.4, tags: ["t-exit", "a-execute"] }),
  e("tspawn", "palace", { exposure: 0.4, chokepoint: 0.4, utilityValue: 0.4, tags: ["a-execute"] }),
  // A side (palace / ramp)
  e("palace", "asite", { exposure: 0.6, chokepoint: 0.5, utilityValue: 0.6, oneWay: true, requires: "drop", tags: ["a-execute"] }),
  e("palace", "tramp", { exposure: 0.3 }),
  e("palace", "scaffolding", { exposure: 0.4 }),
  e("palacealley", "tramp", { exposure: 0.3 }),
  e("tramp", "scaffolding", { exposure: 0.5, chokepoint: 0.5, utilityValue: 0.6, tags: ["a-execute"] }),
  e("asite", "aramp", { exposure: 0.6, chokepoint: 0.5, tags: ["a-execute"] }),
  e("asite", "scaffolding", { exposure: 0.4 }),
  e("asite", "connector", { exposure: 0.5, chokepoint: 0.4, tags: ["mid-to-a"] }),
  e("asite", "jungle", { exposure: 0.5, chokepoint: 0.4 }),
  // mid
  e("sidealley", "topmid", { exposure: 0.6, tags: ["mid-control"] }),
  e("topmid", "mid", { exposure: 0.8, chokepoint: 0.4, utilityValue: 0.5, tags: ["mid-control", "awp-angle"] }),
  e("mid", "connector", { exposure: 0.6, tags: ["mid-to-a", "mid-control"] }),
  e("mid", "window", { exposure: 0.9, chokepoint: 0.4, utilityValue: 0.5, tags: ["awp-angle", "mid-control"] }),
  e("mid", "underpass", { exposure: 0.3, chokepoint: 0.3, tags: ["mid-to-b", "lurk"] }),
  e("connector", "jungle", { exposure: 0.4 }),
  // B side (apartments / van / market / catwalk)
  e("sidealley", "house", { exposure: 0.3, tags: ["b-execute"] }),
  e("house", "backalley", { exposure: 0.3, tags: ["b-execute"] }),
  e("backalley", "bapps", { exposure: 0.4, chokepoint: 0.5, utilityValue: 0.5, tags: ["b-execute"] }),
  e("backalley", "underpass", { exposure: 0.3 }), // underpass -> back alley = the stairs UP to apartments
  e("bapps", "van", { exposure: 0.6, chokepoint: 0.6, utilityValue: 0.6, requires: "drop", tags: ["b-execute"] }),
  e("van", "bsite", { exposure: 0.6, chokepoint: 0.5, utilityValue: 0.5, tags: ["b-execute"] }),
  // mid -> short (catwalk) -> B. Catwalk is the raised short to B, reached from mid — NOT from the
  // underpass (the underpass instead goes UP the stairs to apartments via back alley).
  e("mid", "catwalk", { exposure: 0.5, chokepoint: 0.4, tags: ["mid-to-b", "split-b"] }),
  e("catwalk", "bsite", { exposure: 0.6, chokepoint: 0.5, utilityValue: 0.5, tags: ["mid-to-b", "split-b"] }),
  e("bsite", "market", { exposure: 0.4, tags: ["retake", "hold"] }),
  // CT rotations from spawn
  e("ctspawn", "asite", { exposure: 0.3, tags: ["rotate"] }),
  e("ctspawn", "market", { exposure: 0.3, tags: ["rotate"] }),
  e("ctspawn", "jungle", { exposure: 0.3, tags: ["rotate"] }),
  e("ctspawn", "window", { exposure: 0.4, tags: ["rotate"] }),
  e("ctspawn", "mid", { exposure: 0.4, tags: ["rotate"] }),
];

// Outgoing edges per node (bidirectional unless oneWay).
const adjacency = new Map<string, MapEdge[]>();
for (const node of mirageNodes) adjacency.set(node.id, []);
for (const edge of mirageEdges) {
  adjacency.get(edge.from)?.push(edge);
  if (!edge.oneWay) {
    adjacency.get(edge.to)?.push({ ...edge, from: edge.to, to: edge.from });
  }
}
export function neighbors(id: string): MapEdge[] {
  return adjacency.get(id) ?? [];
}

/** Nearest graph node to a radar (0..100) point. */
export function nearestNode(x: number, y: number): MapNode {
  let best = mirageNodes[0];
  let bestD = Infinity;
  for (const n of mirageNodes) {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function hashStr(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** T-side execute for the round: 0 = split A/B, 1 = stack A, 2 = stack B. */
export function mirageStrategy(tTeamName: string, round: number): number {
  return (hashStr(tTeamName) + round) % 3;
}

/** Objective callout for a player given their side, roster index, and the T strategy. */
export function tacticalObjective(side: "CT" | "T", idx: number, strategy: number): string {
  if (side === "CT") return idx === 0 || idx === 3 ? "asite" : idx === 1 || idx === 4 ? "bsite" : "mid";
  if (strategy === 1) return idx === 4 ? "mid" : "asite";
  if (strategy === 2) return idx === 4 ? "mid" : "bsite";
  return idx === 0 || idx === 1 ? "asite" : idx === 2 || idx === 3 ? "bsite" : "mid";
}

export function spawnNodeId(side: "CT" | "T"): string {
  return side === "CT" ? "ctspawn" : "tspawn";
}

/**
 * Two callouts are "in contact" if they're the same node or directly connected (share an edge). The
 * graph encodes real, elevation-aware adjacency, so this never reports a false sightline.
 */
export function areConnected(aId: string, bId: string): boolean {
  if (aId === bId) return true;
  return neighbors(aId).some((edge) => edge.to === bId);
}
