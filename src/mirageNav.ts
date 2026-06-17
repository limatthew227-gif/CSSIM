/**
 * Mirage tactical graph — a hand-authored callout network used for AI movement/routing, replacing
 * the flawed radar-pixel grid (a flat 2D image can't represent Mirage's elevation: palace over A,
 * underpass under mid, ramps, connector, apps, etc.).
 *
 * Informed by Source `.nav` concepts (areas -> nodes, connections -> edges, per-corner Z -> floor/
 * elevation), but deliberately simplified to ~the real callouts so the AI routes tactically rather
 * than micro-pathing. Node x/y are in radar (0..100) space so they project straight onto the radar
 * image; z/floor are connectivity metadata (e.g. palace is a floor above A and drops in one-way).
 *
 * The radar PNG is ONLY a background for rendering — nothing here is derived from its pixels.
 */

export type NodeType = "spawn" | "site" | "mid" | "choke" | "connector" | "rotate" | "lurker";

export interface MapNode {
  id: string;
  callout: string;
  x: number; // radar 0..100
  y: number; // radar 0..100
  z: number; // relative elevation (for tagging, not projection)
  floor: number; // integer level: 0 ground, +1 elevated (palace/apps/window), -1 below (underpass)
  type: NodeType;
}

export type EdgeReq = "none" | "jump" | "drop" | "ladder" | "crouch";

export interface MapEdge {
  from: string;
  to: string;
  travelTime: number; // seconds-ish to traverse
  exposure: number; // 0..1 how open/peekable the path is
  noise: number; // 0..1 how loud (audible to enemies)
  chokepoint: number; // 0..1 how pinch-y / utility-dependent
  utilityValue: number; // 0..1 how much smokes/flashes/mollies help here
  oneWay?: boolean; // e.g. palace -> A is a drop you can't climb back up
  requires?: EdgeReq;
  tags?: string[]; // tactical labels: "rotate", "mid-control", "awp-angle", "split-b", "lurk", ...
}

// ---------------------------------------------------------------------------
// Nodes (the 18 key Mirage callouts) — radar coords match the Simple Radar image:
// A upper-left, B bottom-centre, T spawn upper-right, CT spawn lower-left.
// ---------------------------------------------------------------------------

export const mirageNodes: MapNode[] = [
  { id: "tspawn", callout: "T Spawn", x: 87, y: 37, z: 0, floor: 0, type: "spawn" },
  { id: "ctspawn", callout: "CT Spawn", x: 28, y: 71, z: 0, floor: 0, type: "spawn" },
  { id: "asite", callout: "A Site", x: 24, y: 28, z: 0, floor: 0, type: "site" },
  { id: "bsite", callout: "B Site", x: 54, y: 76, z: 0, floor: 0, type: "site" },
  { id: "mid", callout: "Mid", x: 46, y: 46, z: 0, floor: 0, type: "mid" },
  { id: "topmid", callout: "Top Mid", x: 57, y: 30, z: 0, floor: 0, type: "mid" },
  { id: "window", callout: "Window", x: 41, y: 38, z: 1, floor: 1, type: "choke" },
  { id: "connector", callout: "Connector", x: 38, y: 43, z: 0, floor: 0, type: "connector" },
  { id: "jungle", callout: "Jungle", x: 35, y: 37, z: 1, floor: 1, type: "connector" },
  { id: "catwalk", callout: "Catwalk", x: 47, y: 39, z: 0, floor: 0, type: "connector" },
  { id: "aramp", callout: "A Ramp", x: 40, y: 24, z: 0, floor: 0, type: "choke" },
  { id: "palace", callout: "Palace", x: 32, y: 33, z: 1, floor: 1, type: "choke" },
  { id: "tramp", callout: "T Ramp", x: 62, y: 25, z: 0, floor: 0, type: "connector" },
  { id: "ticket", callout: "Ticket", x: 28, y: 23, z: 0, floor: 0, type: "site" },
  { id: "underpass", callout: "Underpass", x: 47, y: 57, z: -1, floor: -1, type: "lurker" },
  { id: "bapps", callout: "B Apps", x: 38, y: 62, z: 1, floor: 1, type: "choke" },
  { id: "bshort", callout: "B Short", x: 51, y: 60, z: 0, floor: 0, type: "choke" },
  { id: "market", callout: "Market", x: 42, y: 70, z: 0, floor: 0, type: "connector" },
];

// ---------------------------------------------------------------------------
// Edges (real connectivity + tactical weights). Authored once; `e()` adds both directions
// unless oneWay. Tags drive utility-/state-aware routing (see pathfinder.edgeCost).
// ---------------------------------------------------------------------------

type EdgeSpec = Omit<MapEdge, "from" | "to">;
function e(from: string, to: string, spec: EdgeSpec): MapEdge {
  return { from, to, ...spec };
}

export const mirageEdges: MapEdge[] = [
  // T side -> A (ramp / palace)
  e("tspawn", "tramp", { travelTime: 4, exposure: 0.2, noise: 0.3, chokepoint: 0.2, utilityValue: 0.1 }),
  e("tramp", "aramp", { travelTime: 3, exposure: 0.6, noise: 0.4, chokepoint: 0.7, utilityValue: 0.6, tags: ["a-execute"] }),
  e("tramp", "palace", { travelTime: 3, exposure: 0.4, noise: 0.4, chokepoint: 0.5, utilityValue: 0.5, tags: ["a-execute"] }),
  e("aramp", "asite", { travelTime: 2, exposure: 0.85, noise: 0.5, chokepoint: 0.8, utilityValue: 0.7, tags: ["a-execute", "dry-danger"] }),
  e("palace", "asite", { travelTime: 2, exposure: 0.6, noise: 0.4, chokepoint: 0.5, utilityValue: 0.6, oneWay: true, requires: "drop", tags: ["a-execute"] }),
  e("asite", "ticket", { travelTime: 1, exposure: 0.3, noise: 0.2, chokepoint: 0.2, utilityValue: 0.1 }),

  // T side -> mid
  e("tspawn", "topmid", { travelTime: 3, exposure: 0.3, noise: 0.3, chokepoint: 0.3, utilityValue: 0.2 }),
  e("topmid", "mid", { travelTime: 3, exposure: 0.7, noise: 0.4, chokepoint: 0.5, utilityValue: 0.5, tags: ["mid-control"] }),
  e("mid", "window", { travelTime: 2, exposure: 0.9, noise: 0.3, chokepoint: 0.4, utilityValue: 0.5, tags: ["awp-angle", "mid-control"] }),
  e("mid", "connector", { travelTime: 2, exposure: 0.6, noise: 0.3, chokepoint: 0.5, utilityValue: 0.5, tags: ["mid-control"] }),
  e("mid", "catwalk", { travelTime: 2, exposure: 0.5, noise: 0.3, chokepoint: 0.4, utilityValue: 0.4 }),
  e("mid", "bshort", { travelTime: 3, exposure: 0.5, noise: 0.3, chokepoint: 0.4, utilityValue: 0.4 }),
  e("mid", "underpass", { travelTime: 2, exposure: 0.3, noise: 0.2, chokepoint: 0.3, utilityValue: 0.3, tags: ["lurk"] }),

  // connector / jungle / catwalk -> A
  e("connector", "jungle", { travelTime: 2, exposure: 0.4, noise: 0.3, chokepoint: 0.4, utilityValue: 0.4 }),
  e("jungle", "asite", { travelTime: 2, exposure: 0.5, noise: 0.3, chokepoint: 0.5, utilityValue: 0.5 }),
  e("connector", "asite", { travelTime: 3, exposure: 0.5, noise: 0.3, chokepoint: 0.5, utilityValue: 0.5 }),
  e("catwalk", "asite", { travelTime: 2, exposure: 0.6, noise: 0.4, chokepoint: 0.5, utilityValue: 0.5 }),
  e("window", "jungle", { travelTime: 2, exposure: 0.5, noise: 0.2, chokepoint: 0.3, utilityValue: 0.3 }),

  // B side
  e("tspawn", "bapps", { travelTime: 5, exposure: 0.3, noise: 0.3, chokepoint: 0.4, utilityValue: 0.3 }),
  e("underpass", "bapps", { travelTime: 2, exposure: 0.3, noise: 0.3, chokepoint: 0.4, utilityValue: 0.3, tags: ["lurk"] }),
  e("bapps", "bsite", { travelTime: 3, exposure: 0.8, noise: 0.5, chokepoint: 0.9, utilityValue: 0.8, tags: ["b-execute", "major-choke", "dry-danger"] }),
  e("catwalk", "bshort", { travelTime: 2, exposure: 0.4, noise: 0.3, chokepoint: 0.4, utilityValue: 0.4, tags: ["split-b"] }),
  e("bshort", "bsite", { travelTime: 2, exposure: 0.6, noise: 0.4, chokepoint: 0.6, utilityValue: 0.5, tags: ["split-b"] }),
  e("market", "bsite", { travelTime: 2, exposure: 0.5, noise: 0.4, chokepoint: 0.5, utilityValue: 0.4, tags: ["retake", "hold"] }),
  e("market", "bshort", { travelTime: 2, exposure: 0.3, noise: 0.3, chokepoint: 0.3, utilityValue: 0.3 }),

  // CT rotations from spawn
  e("ctspawn", "market", { travelTime: 3, exposure: 0.2, noise: 0.3, chokepoint: 0.3, utilityValue: 0.2, tags: ["rotate"] }),
  e("ctspawn", "connector", { travelTime: 4, exposure: 0.3, noise: 0.3, chokepoint: 0.3, utilityValue: 0.3, tags: ["rotate"] }),
  e("ctspawn", "jungle", { travelTime: 4, exposure: 0.3, noise: 0.3, chokepoint: 0.3, utilityValue: 0.3, tags: ["rotate"] }),
  e("ctspawn", "window", { travelTime: 3, exposure: 0.4, noise: 0.3, chokepoint: 0.3, utilityValue: 0.3, tags: ["rotate"] }),
];

// ---------------------------------------------------------------------------
// Adjacency + lookups
// ---------------------------------------------------------------------------

const nodeById = new Map(mirageNodes.map((n) => [n.id, n]));
export function getNode(id: string): MapNode | undefined {
  return nodeById.get(id);
}

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

/** Nearest graph node to a radar (0..100) point — for snapping arbitrary positions onto the graph. */
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

// --- Round assignment helpers (shared by the sim and the radar so they agree on executes) ---

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
 * graph encodes real, elevation-aware adjacency, so this never reports a false sightline (e.g. palace
 * and mid sit close on the 2D radar but aren't connected, so players there can't trade).
 */
export function areConnected(aId: string, bId: string): boolean {
  if (aId === bId) return true;
  return neighbors(aId).some((edge) => edge.to === bId);
}
