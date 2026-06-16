/**
 * Code-constructed map geometry + navigation.
 *
 * Maps are defined as vector **walkable polygons** in a fixed square 0..100 space (CS radars are
 * square, so there is no aspect-ratio stretch). From the polygons we rasterize an occupancy grid and
 * run **any-angle pathfinding (Theta*)**, which yields straight, corner-hugging, near-shortest paths
 * that look like nav-mesh/funnel output while keeping dynamic obstacles trivial:
 *
 *   - **mollies** block *movement* — pass them to `findPath({ mollies })` and the route reroutes.
 *   - **smokes** block *line of sight* — pass them to `hasLineOfSight(..., smokes)`.
 *
 * This module is purely about *where things are / can move* — it never touches match outcomes.
 */
import type { MapId } from "./gameData";

export interface Vec {
  x: number;
  y: number;
}

/** A circular area effect (molotov fire / smoke cloud) in 0..100 space. */
export interface Circle {
  c: Vec;
  r: number;
}

export interface MapRegion {
  name: string;
  poly: Vec[];
}

export interface MapGeometry {
  id: MapId;
  /** Polygons whose union is the walkable floor. */
  walkable: Vec[][];
  /** Solid blockers carved out of the walkable union (pillars, boxes). */
  walls: Vec[][];
  spawns: { ct: Vec; t: Vec };
  sites: { a: Vec; b: Vec };
  mid: Vec;
  /** Named areas for future util targeting (smoke/molly a region). */
  regions: MapRegion[];
  /** Callout text drawn on the radar (connector, palace, apps, …). */
  labels: { text: string; at: Vec }[];
}

export interface NavGrid {
  res: number;
  /** 1 = cannot walk here (outside the floor or inside a wall). */
  blockedMove: Uint8Array;
  /** 1 = blocks vision (walls). Smokes are applied dynamically on top. */
  blockedVision: Uint8Array;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function rect(x1: number, y1: number, x2: number, y2: number): Vec[] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

export function pointInPolygon(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isWalkablePoint(geo: MapGeometry, p: Vec): boolean {
  if (geo.walls.some((w) => pointInPolygon(p, w))) return false;
  return geo.walkable.some((poly) => pointInPolygon(p, poly));
}

// ---------------------------------------------------------------------------
// Occupancy grid
// ---------------------------------------------------------------------------

export function buildNavGrid(geo: MapGeometry, res = 160): NavGrid {
  const blockedMove = new Uint8Array(res * res);
  const blockedVision = new Uint8Array(res * res);
  const cell = 100 / res;
  for (let gy = 0; gy < res; gy += 1) {
    for (let gx = 0; gx < res; gx += 1) {
      const p = { x: (gx + 0.5) * cell, y: (gy + 0.5) * cell };
      const walk = isWalkablePoint(geo, p);
      const idx = gy * res + gx;
      blockedMove[idx] = walk ? 0 : 1;
      blockedVision[idx] = walk ? 0 : 1; // walls block vision too
    }
  }
  return { res, blockedMove, blockedVision };
}

function toCell(v: Vec, res: number) {
  const cell = 100 / res;
  return {
    gx: Math.min(res - 1, Math.max(0, Math.floor(v.x / cell))),
    gy: Math.min(res - 1, Math.max(0, Math.floor(v.y / cell))),
  };
}

function cellCenter(gx: number, gy: number, res: number): Vec {
  const cell = 100 / res;
  return { x: (gx + 0.5) * cell, y: (gy + 0.5) * cell };
}

function inCircles(p: Vec, circles?: Circle[]): boolean {
  if (!circles) return false;
  for (const m of circles) {
    const dx = p.x - m.c.x;
    const dy = p.y - m.c.y;
    if (dx * dx + dy * dy <= m.r * m.r) return true;
  }
  return false;
}

function moveBlocked(grid: NavGrid, gx: number, gy: number, mollies?: Circle[]): boolean {
  if (gx < 0 || gy < 0 || gx >= grid.res || gy >= grid.res) return true;
  if (grid.blockedMove[gy * grid.res + gx]) return true;
  if (mollies && mollies.length && inCircles(cellCenter(gx, gy, grid.res), mollies)) return true;
  return false;
}

/** Walk the integer supercover of a cell-space line; `blocked` returning true stops it as obstructed. */
function lineClear(x0: number, y0: number, x1: number, y1: number, blocked: (x: number, y: number) => boolean): boolean {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let x = x0;
  let y = y0;
  let n = 1 + dx + dy;
  const xInc = x1 > x0 ? 1 : -1;
  const yInc = y1 > y0 ? 1 : -1;
  let error = dx - dy;
  dx *= 2;
  dy *= 2;
  for (; n > 0; n -= 1) {
    if (blocked(x, y)) return false;
    if (error > 0) {
      x += xInc;
      error -= dy;
    } else {
      y += yInc;
      error += dx;
    }
  }
  return true;
}

/**
 * Line of sight between two world points: blocked by static walls (vision grid) or any smoke circle.
 * This is the primitive a future smoke implementation uses to cut vision through a clouded area.
 */
export function hasLineOfSight(grid: NavGrid, a: Vec, b: Vec, smokes?: Circle[]): boolean {
  if (smokes && smokes.length && segmentHitsCircles(a, b, smokes)) return false;
  const ca = toCell(a, grid.res);
  const cb = toCell(b, grid.res);
  return lineClear(ca.gx, ca.gy, cb.gx, cb.gy, (gx, gy) => {
    if (gx < 0 || gy < 0 || gx >= grid.res || gy >= grid.res) return true;
    return grid.blockedVision[gy * grid.res + gx] === 1;
  });
}

function segmentHitsCircles(a: Vec, b: Vec, circles: Circle[]): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1e-9;
  for (const s of circles) {
    // closest point on segment ab to circle center
    let t = ((s.c.x - a.x) * dx + (s.c.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const ddx = px - s.c.x;
    const ddy = py - s.c.y;
    if (ddx * ddx + ddy * ddy <= s.r * s.r) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Any-angle pathfinding (Theta*)
// ---------------------------------------------------------------------------

class MinHeap {
  private idx: number[] = [];
  private key: number[] = [];
  get size() {
    return this.idx.length;
  }
  push(i: number, k: number) {
    this.idx.push(i);
    this.key.push(k);
    let c = this.idx.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.key[p] <= this.key[c]) break;
      this.swap(c, p);
      c = p;
    }
  }
  pop(): number {
    const top = this.idx[0];
    const last = this.idx.length - 1;
    this.idx[0] = this.idx[last];
    this.key[0] = this.key[last];
    this.idx.pop();
    this.key.pop();
    let i = 0;
    const n = this.idx.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let m = i;
      if (l < n && this.key[l] < this.key[m]) m = l;
      if (r < n && this.key[r] < this.key[m]) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
  private swap(i: number, j: number) {
    const a = this.idx[i];
    this.idx[i] = this.idx[j];
    this.idx[j] = a;
    const b = this.key[i];
    this.key[i] = this.key[j];
    this.key[j] = b;
  }
}

function nearestFreeIdx(grid: NavGrid, gx: number, gy: number, mollies?: Circle[]): number {
  const res = grid.res;
  if (!moveBlocked(grid, gx, gy, mollies)) return gy * res + gx;
  for (let radius = 1; radius < res; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const nx = gx + dx;
        const ny = gy + dy;
        if (!moveBlocked(grid, nx, ny, mollies)) return ny * res + nx;
      }
    }
  }
  return -1;
}

/**
 * Any-angle route from `startW` to `goalW` in world (0..100) coords. Returns smoothed waypoints that
 * never cross a wall (or a molly, when supplied). Endpoints are the exact requested points.
 */
export function findPath(grid: NavGrid, startW: Vec, goalW: Vec, opts?: { mollies?: Circle[] }): Vec[] {
  const mollies = opts?.mollies;
  const res = grid.res;
  const sCell = toCell(startW, res);
  const gCell = toCell(goalW, res);
  const startIdx = nearestFreeIdx(grid, sCell.gx, sCell.gy, mollies);
  const goalIdx = nearestFreeIdx(grid, gCell.gx, gCell.gy, mollies);
  if (startIdx < 0 || goalIdx < 0) return [startW, goalW];
  if (startIdx === goalIdx) return [startW, goalW];

  const gx2 = goalIdx % res;
  const gy2 = (goalIdx / res) | 0;

  const losMove = (ax: number, ay: number, bx: number, by: number) =>
    lineClear(ax, ay, bx, by, (x, y) => moveBlocked(grid, x, y, mollies));

  const h = (i: number) => {
    const x = i % res;
    const y = (i / res) | 0;
    return Math.hypot(x - gx2, y - gy2);
  };

  const N = res * res;
  const gScore = new Float64Array(N).fill(Infinity);
  const parent = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);

  gScore[startIdx] = 0;
  parent[startIdx] = startIdx;
  const open = new MinHeap();
  open.push(startIdx, h(startIdx));

  const NEI = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  while (open.size > 0) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goalIdx) break;

    const cx = cur % res;
    const cy = (cur / res) | 0;
    const par = parent[cur];
    const px = par % res;
    const py = (par / res) | 0;

    for (const [dx, dy] of NEI) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= res || ny >= res) continue;
      const nIdx = ny * res + nx;
      if (closed[nIdx] || moveBlocked(grid, nx, ny, mollies)) continue;
      // prevent corner-cutting through diagonal wall gaps
      if (dx !== 0 && dy !== 0 && (moveBlocked(grid, cx + dx, cy, mollies) || moveBlocked(grid, cx, cy + dy, mollies))) continue;

      // Theta*: try to attach the neighbour straight to the current node's parent (any-angle).
      if (losMove(px, py, nx, ny)) {
        const ng = gScore[par] + Math.hypot(nx - px, ny - py);
        if (ng < gScore[nIdx]) {
          gScore[nIdx] = ng;
          parent[nIdx] = par;
          open.push(nIdx, ng + h(nIdx));
        }
      } else {
        const ng = gScore[cur] + Math.hypot(dx, dy);
        if (ng < gScore[nIdx]) {
          gScore[nIdx] = ng;
          parent[nIdx] = cur;
          open.push(nIdx, ng + h(nIdx));
        }
      }
    }
  }

  if (parent[goalIdx] < 0) return [startW, goalW];

  // reconstruct cell path (already any-angle thanks to Theta* parents)
  const cells: number[] = [];
  let node = goalIdx;
  let guard = 0;
  while (node !== startIdx && guard < N) {
    cells.push(node);
    node = parent[node];
    guard += 1;
  }
  cells.push(startIdx);
  cells.reverse();

  const path: Vec[] = cells.map((i) => cellCenter(i % res, (i / res) | 0, res));
  // pin exact endpoints for clean rendering / interpolation
  path[0] = startW;
  path[path.length - 1] = goalW;
  return path;
}

/** Total length of a polyline route in 0..100 units. */
export function pathLength(path: Vec[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    total += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Map definitions (first map: mirage). Authored as a simplified, connected
// floorplan; proportions to be refined against the radar image when rendering.
// ---------------------------------------------------------------------------

// Traced from the Simple Radar mirage image (A site upper-left, B bottom-centre, CT spawn right,
// T spawn lower-left). Corridors follow the real callouts and wind around the central building.
const mirage: MapGeometry = {
  id: "mirage",
  walkable: [
    rect(16, 15, 54, 23), // top mid lane
    rect(50, 14, 73, 24), // top -> CT
    rect(70, 18, 89, 33), // CT top approach
    rect(82, 30, 92, 45), // CT spawn
    rect(80, 42, 92, 64), // right corridor (upper)
    rect(68, 58, 92, 76), // right corridor (lower) / market side
    rect(15, 23, 31, 35), // A site
    rect(23, 20, 35, 28), // A -> top link
    rect(11, 25, 19, 38), // A left (stairs)
    rect(19, 33, 37, 53), // ramp
    rect(30, 27, 46, 53), // connector (A <-> mid)
    rect(39, 20, 47, 41), // mid window
    rect(33, 39, 48, 61), // mid
    rect(46, 45, 75, 61), // mid -> CT (under central building)
    rect(39, 55, 60, 71), // B short
    rect(47, 70, 63, 82), // B site
    rect(58, 68, 81, 82), // market
    rect(60, 59, 81, 73), // market upper
    rect(12, 38, 28, 67), // left corridor (T <-> A)
    rect(19, 62, 34, 80), // T spawn
    rect(19, 78, 56, 88), // T -> B (bottom lane)
    rect(26, 53, 42, 68), // T -> apps/mid link
    rect(45, 57, 62, 72), // apps -> B
  ],
  walls: [
    rect(48, 24, 70, 45), // central building
    rect(34, 66, 47, 80), // apartments block
  ],
  spawns: { ct: { x: 87, y: 37 }, t: { x: 26, y: 71 } },
  sites: { a: { x: 22, y: 29 }, b: { x: 55, y: 76 } },
  mid: { x: 42, y: 49 },
  regions: [
    { name: "A", poly: rect(15, 23, 31, 35) },
    { name: "B", poly: rect(47, 70, 63, 82) },
    { name: "Mid", poly: rect(33, 39, 48, 61) },
    { name: "Market", poly: rect(58, 68, 81, 82) },
    { name: "CT", poly: rect(82, 30, 92, 45) },
  ],
  labels: [
    { text: "A", at: { x: 22, y: 29 } },
    { text: "B", at: { x: 55, y: 76 } },
    { text: "T", at: { x: 25, y: 71 } },
    { text: "CT", at: { x: 87, y: 37 } },
    { text: "Mid", at: { x: 41, y: 50 } },
    { text: "Window", at: { x: 43, y: 26 } },
    { text: "Connector", at: { x: 37, y: 33 } },
    { text: "Palace", at: { x: 29, y: 24 } },
    { text: "Ramp", at: { x: 23, y: 46 } },
    { text: "Jungle", at: { x: 44, y: 43 } },
    { text: "Top Mid", at: { x: 27, y: 18 } },
    { text: "Short", at: { x: 51, y: 64 } },
    { text: "Apps", at: { x: 32, y: 61 } },
    { text: "Market", at: { x: 70, y: 76 } },
  ],
};

export const mapGeometries: Partial<Record<MapId, MapGeometry>> = {
  mirage,
};

const gridCache = new Map<MapId, NavGrid>();

/** Memoized nav grid for a map, or null if the map has no code geometry yet. */
export function getNavGrid(id: MapId): NavGrid | null {
  const geo = mapGeometries[id];
  if (!geo) return null;
  let grid = gridCache.get(id);
  if (!grid) {
    grid = buildNavGrid(geo);
    gridCache.set(id, grid);
  }
  return grid;
}
