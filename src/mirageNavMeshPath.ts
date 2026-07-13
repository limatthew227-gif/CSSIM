import type { Vec } from "./mapGeometry";
import { mirageNavAreas, mirageNavPlaces, type MirageNavArea } from "./mirageNavMesh";

const areaById = new Map(mirageNavAreas.map((area) => [area.id, area]));
const placeIndex = new Map<string, number>(mirageNavPlaces.map((place, index) => [place, index]));
const routeCache = new Map<string, number[]>();

const tacticalPlace: Record<string, string> = {
  tspawn: "TSpawn",
  ctspawn: "CTSpawn",
  asite: "BombsiteA",
  bsite: "BombsiteB",
  mid: "Middle",
  topmid: "Middle",
  window: "SnipersNest",
  connector: "Connector",
  jungle: "Connector",
  catwalk: "Catwalk",
  aramp: "BombsiteA",
  palace: "PalaceInterior",
  tramp: "PalaceTunnel",
  palacealley: "PalaceAlley",
  scaffolding: "Scaffolding",
  sidealley: "SideAlley",
  house: "House",
  backalley: "BackAlley",
  underpass: "Tunnel",
  bapps: "Apartments",
  van: "BombsiteB",
  market: "Shop",
};

export interface MirageNavPathOptions {
  startNodeId?: string;
  endNodeId?: string;
}

export function mirageNavAreaCount() {
  return mirageNavAreas.length;
}

export function miragePlaceForTacticalNode(nodeId: string | undefined) {
  return nodeId ? tacticalPlace[nodeId] : undefined;
}

export function nearestMirageNavArea(point: Vec, placeHint?: string) {
  const hintedPlace = placeHint ? placeIndex.get(placeHint) : undefined;
  let best: MirageNavArea | undefined;
  let bestScore = Infinity;

  for (const area of mirageNavAreas) {
    if (hintedPlace !== undefined && area.place !== hintedPlace) continue;
    const [x0, y0, x1, y1] = area.bounds;
    const dx = point.x < x0 ? x0 - point.x : point.x > x1 ? point.x - x1 : 0;
    const dy = point.y < y0 ? y0 - point.y : point.y > y1 ? point.y - y1 : 0;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const score = dx * dx + dy * dy + Math.hypot(point.x - cx, point.y - cy) * 0.001;
    if (score < bestScore) {
      best = area;
      bestScore = score;
    }
  }

  if (!best && hintedPlace !== undefined) return nearestMirageNavArea(point);
  return best;
}

export function findMirageNavAreaIds(start: Vec, end: Vec, options: MirageNavPathOptions = {}) {
  const startArea = nearestMirageNavArea(start, miragePlaceForTacticalNode(options.startNodeId));
  const endArea = nearestMirageNavArea(end, miragePlaceForTacticalNode(options.endNodeId));
  if (!startArea || !endArea) return null;
  if (startArea.id === endArea.id) return [startArea.id];

  const cacheKey = `${startArea.id}>${endArea.id}`;
  const cached = routeCache.get(cacheKey);
  if (cached) return cached;

  const open = new AreaHeap();
  const cameFrom = new Map<number, number>();
  const score = new Map<number, number>([[startArea.id, 0]]);
  const closed = new Set<number>();
  open.push(startArea.id, areaDistance(startArea, endArea));

  while (open.size) {
    const currentId = open.pop();
    if (closed.has(currentId)) continue;
    if (currentId === endArea.id) break;
    closed.add(currentId);
    const current = areaById.get(currentId);
    if (!current) continue;

    for (const nextId of current.links) {
      if (closed.has(nextId)) continue;
      const next = areaById.get(nextId);
      if (!next) continue;
      const tentative = (score.get(currentId) ?? Infinity) + areaDistance(current, next);
      if (tentative >= (score.get(nextId) ?? Infinity)) continue;
      cameFrom.set(nextId, currentId);
      score.set(nextId, tentative);
      open.push(nextId, tentative + areaDistance(next, endArea));
    }
  }

  if (!cameFrom.has(endArea.id)) return null;
  const ids = [endArea.id];
  let current = endArea.id;
  while (current !== startArea.id && ids.length <= mirageNavAreas.length) {
    const previous = cameFrom.get(current);
    if (previous === undefined) return null;
    ids.push(previous);
    current = previous;
  }
  ids.reverse();
  if (routeCache.size < 5000) routeCache.set(cacheKey, ids);
  return ids;
}

export function findMirageNavPath(start: Vec, end: Vec, options: MirageNavPathOptions = {}) {
  const ids = findMirageNavAreaIds(start, end, options);
  if (!ids) return null;
  if (ids.length === 1) return [start, end];

  const points: Vec[] = [start];
  for (let index = 0; index < ids.length - 1; index += 1) {
    const current = areaById.get(ids[index]);
    const next = areaById.get(ids[index + 1]);
    if (current && next) points.push(portalBetween(current, next));
  }
  points.push(end);
  return removeDuplicatePoints(points);
}

function areaCenter(area: MirageNavArea): Vec {
  const [x0, y0, x1, y1] = area.bounds;
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

function areaDistance(a: MirageNavArea, b: MirageNavArea) {
  const ac = areaCenter(a);
  const bc = areaCenter(b);
  const planar = Math.hypot(ac.x - bc.x, ac.y - bc.y);
  const vertical = Math.abs(a.z - b.z) / 128;
  return Math.max(0.05, planar + vertical * 0.25);
}

function portalBetween(a: MirageNavArea, b: MirageNavArea): Vec {
  const [ax0, ay0, ax1, ay1] = a.bounds;
  const [bx0, by0, bx1, by1] = b.bounds;
  const overlapX0 = Math.max(ax0, bx0);
  const overlapX1 = Math.min(ax1, bx1);
  const overlapY0 = Math.max(ay0, by0);
  const overlapY1 = Math.min(ay1, by1);

  const x = overlapX0 <= overlapX1
    ? (overlapX0 + overlapX1) / 2
    : (Math.min(ax1, bx1) + Math.max(ax0, bx0)) / 2;
  const y = overlapY0 <= overlapY1
    ? (overlapY0 + overlapY1) / 2
    : (Math.min(ay1, by1) + Math.max(ay0, by0)) / 2;
  return { x, y };
}

function removeDuplicatePoints(points: Vec[]) {
  return points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return Math.hypot(point.x - previous.x, point.y - previous.y) > 0.03;
  });
}

class AreaHeap {
  private values: Array<{ id: number; priority: number }> = [];

  get size() {
    return this.values.length;
  }

  push(id: number, priority: number) {
    this.values.push({ id, priority });
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.values[parent].priority <= this.values[index].priority) break;
      [this.values[parent], this.values[index]] = [this.values[index], this.values[parent]];
      index = parent;
    }
  }

  pop() {
    const first = this.values[0];
    const last = this.values.pop()!;
    if (this.values.length) {
      this.values[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let next = index;
        if (left < this.values.length && this.values[left].priority < this.values[next].priority) next = left;
        if (right < this.values.length && this.values[right].priority < this.values[next].priority) next = right;
        if (next === index) break;
        [this.values[index], this.values[next]] = [this.values[next], this.values[index]];
        index = next;
      }
    }
    return first.id;
  }
}
