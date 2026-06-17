/**
 * Weighted routing over the Mirage tactical graph. Cost is NOT just distance — it folds in exposure,
 * chokepoints, available utility and round state, so the AI picks realistic routes (e.g. avoid a dry
 * A-ramp with no smokes, avoid mid/window vs a strong AWP, take the fastest rotate after a plant).
 */
import { mirageNodes, neighbors, getNode, type MapEdge, type MapNode } from "./mirageNav";

export interface RoundState {
  enemyAwperPressure: number; // 0..1 — how much the enemy AWP locks down open angles
  hasUtility: boolean; // do we have nades to clear a choke right now
  availableUtility: number; // 0..1 — how much util we have to spend
  bombPlanted: boolean;
  saving?: boolean; // prioritise safe, low-exposure escape routes
}

export const NEUTRAL_STATE: RoundState = {
  enemyAwperPressure: 0,
  hasUtility: false,
  availableUtility: 0,
  bombPlanted: false,
};

/** Weighted cost of traversing one edge given the current round situation. */
export function edgeCost(edge: MapEdge, state: RoundState): number {
  let cost = edge.travelTime;

  // Open angles are punishing when the enemy AWP is online.
  cost += edge.exposure * state.enemyAwperPressure * 3;

  // Chokepoints are cheap to take WITH utility, brutal to dry-peek without it.
  cost += edge.chokepoint * (state.hasUtility ? 0.5 : 3);

  // Routes where our utility is impactful get a discount when we actually have it.
  cost -= edge.utilityValue * state.availableUtility * 0.6;

  // After a plant, CT rotations are urgent.
  if (state.bombPlanted && edge.tags?.includes("rotate")) cost *= 0.75;

  // When saving, avoid exposure even more (don't trade your gun for nothing).
  if (state.saving) cost += edge.exposure * 2;

  return Math.max(1, cost);
}

export interface Route {
  nodes: MapNode[];
  cost: number;
}

/**
 * Weighted shortest route between two callouts (Dijkstra — exact, and the graph is tiny). Returns
 * null if unreachable. Respects one-way edges (e.g. the palace drop).
 */
export function findRoute(fromId: string, toId: string, state: RoundState = NEUTRAL_STATE): Route | null {
  const from = getNode(fromId);
  const to = getNode(toId);
  if (!from || !to) return null;
  if (fromId === toId) return { nodes: [from], cost: 0 };

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  for (const n of mirageNodes) dist.set(n.id, Infinity);
  dist.set(fromId, 0);

  for (;;) {
    let u: string | null = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d;
        u = id;
      }
    }
    if (u === null || best === Infinity) break;
    if (u === toId) break;
    visited.add(u);
    for (const edge of neighbors(u)) {
      if (visited.has(edge.to)) continue;
      const nd = best + edgeCost(edge, state);
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd);
        prev.set(edge.to, u);
      }
    }
  }

  if (!prev.has(toId)) return null;
  const ids: string[] = [];
  let cur: string | undefined = toId;
  let guard = 0;
  while (cur && guard < mirageNodes.length + 1) {
    ids.push(cur);
    cur = prev.get(cur);
    guard += 1;
  }
  ids.reverse();
  return { nodes: ids.map((id) => getNode(id)!), cost: dist.get(toId) ?? Infinity };
}

/** Polyline of radar (0..100) points for a route, for rendering / movement interpolation. */
export function routePoints(route: Route): Array<{ x: number; y: number }> {
  return route.nodes.map((n) => ({ x: n.x, y: n.y }));
}

/** Index of the route node nearest fraction t (0..1) — the player's "current callout". */
export function nodeIndexAt(nodes: MapNode[], t: number): number {
  if (nodes.length <= 1) return 0;
  return Math.max(0, Math.min(nodes.length - 1, Math.round(t * (nodes.length - 1))));
}

/** Interpolated radar point at fraction t (0..1) along a route's nodes (uniform per segment). */
export function pointAlongRoute(nodes: MapNode[], t: number): { x: number; y: number } {
  if (nodes.length === 0) return { x: 50, y: 50 };
  if (nodes.length === 1) return { x: nodes[0].x, y: nodes[0].y };
  const ct = Math.max(0, Math.min(1, t)) * (nodes.length - 1);
  const i = Math.floor(ct);
  const f = ct - i;
  const a = nodes[i];
  const b = nodes[Math.min(nodes.length - 1, i + 1)];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/**
 * World (game) coordinate -> radar (image) coordinate, per the CS overview convention. Unused while
 * nodes are authored directly in radar space, but kept for when real .nav/world coords are wired in.
 */
export function worldToRadar(
  world: { x: number; y: number },
  overview: { posX: number; posY: number; scale: number },
): { x: number; y: number } {
  return {
    x: (world.x - overview.posX) / overview.scale,
    y: (overview.posY - world.y) / overview.scale,
  };
}
