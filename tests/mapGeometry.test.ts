/**
 * Navigation engine tests. Engine behaviour (rasterize, any-angle pathfinding, molly/smoke hooks) is
 * tested on a synthetic RING map so it's decoupled from any real map's data. A separate block checks
 * the pixel-accurate mirage grid baked from the radar image (spawns on the floor, T->A stays walkable).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildNavGrid,
  getNavGrid,
  findPath,
  hasLineOfSight,
  isWalkablePoint,
  pathLength,
  hasPixelNav,
  mapGeometries,
} from "../src/mapGeometry";
import type { Circle, MapGeometry, Vec } from "../src/mapGeometry";

function rect(x1: number, y1: number, x2: number, y2: number): Vec[] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

// Synthetic ring: a square loop of corridors with a non-walkable centre. Lets us test routing,
// detours and line-of-sight with fully known geometry.
const RING: MapGeometry = {
  id: "mirage",
  walkable: [rect(10, 10, 90, 28), rect(10, 72, 90, 90), rect(10, 10, 28, 90), rect(72, 10, 90, 90)],
  walls: [],
  spawns: { ct: { x: 81, y: 81 }, t: { x: 19, y: 19 } },
  sites: { a: { x: 81, y: 19 }, b: { x: 19, y: 81 } },
  mid: { x: 50, y: 19 },
  regions: [],
  labels: [],
};

function sampleSegments(path: Vec[]): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return pts;
}

test("ring geometry: corridors walkable, centre void is not", () => {
  assert.ok(isWalkablePoint(RING, RING.spawns.t));
  assert.ok(isWalkablePoint(RING, RING.sites.a));
  assert.ok(isWalkablePoint(RING, RING.mid));
  assert.ok(!isWalkablePoint(RING, { x: 50, y: 50 }));
});

test("findPath: open corridor comes out near-straight (any-angle, not grid-stepped)", () => {
  const grid = buildNavGrid(RING);
  const a = { x: 20, y: 19 };
  const b = { x: 80, y: 19 };
  assert.ok(hasLineOfSight(grid, a, b), "endpoints should see each other");
  const path = findPath(grid, a, b);
  const straight = Math.hypot(b.x - a.x, b.y - a.y);
  assert.ok(pathLength(path) <= straight * 1.08, `expected ~straight, got ${pathLength(path).toFixed(1)} vs ${straight.toFixed(1)}`);
});

test("findPath: a molly across the top corridor forces a detour around the ring", () => {
  const grid = buildNavGrid(RING);
  const a = { x: 20, y: 19 };
  const b = { x: 80, y: 19 };
  const molly: Circle = { c: { x: 50, y: 19 }, r: 9 };
  const open = findPath(grid, a, b);
  const around = findPath(grid, a, b, { mollies: [molly] });
  const entersFire = sampleSegments(around).some((p) => Math.hypot(p.x - molly.c.x, p.y - molly.c.y) < molly.r - 0.6);
  assert.ok(!entersFire, "rerouted path must avoid the molly");
  assert.ok(pathLength(around) > pathLength(open) + 10, "going around the ring is clearly longer");
});

test("hasLineOfSight: corridor clear, smoke and void both cut vision", () => {
  const grid = buildNavGrid(RING);
  const a = { x: 20, y: 19 };
  const b = { x: 80, y: 19 };
  assert.ok(hasLineOfSight(grid, a, b), "clear corridor sightline");
  const smoke: Circle = { c: { x: 50, y: 19 }, r: 6 };
  assert.ok(!hasLineOfSight(grid, a, b, [smoke]), "smoke on the sightline blocks it");
  assert.ok(!hasLineOfSight(grid, { x: 30, y: 19 }, { x: 30, y: 81 }), "a sightline across the void is blocked");
});

test("baked mirage grid: derived from the radar — spawns/sites on the floor, T->A stays walkable", () => {
  assert.ok(hasPixelNav("mirage"), "mirage uses a pixel-accurate baked grid");
  const grid = getNavGrid("mirage");
  assert.ok(grid, "mirage nav grid is present");
  assert.equal(grid!.res, 160); // derived from the real .nav walkable mesh

  const m = mapGeometries.mirage as MapGeometry;
  const blockedAt = (p: Vec) =>
    grid!.blockedMove[Math.floor((p.y / 100) * grid!.res) * grid!.res + Math.floor((p.x / 100) * grid!.res)];
  assert.equal(blockedAt(m.spawns.t), 0, "T spawn is on the floor");
  assert.equal(blockedAt(m.spawns.ct), 0, "CT spawn is on the floor");
  assert.equal(blockedAt(m.sites.a), 0, "A site is on the floor");
  assert.equal(blockedAt(m.sites.b), 0, "B site is on the floor");

  const path = findPath(grid!, m.spawns.t, m.sites.a);
  assert.ok(path.length >= 2, "a T->A route exists on the real floor");
  for (let i = 0; i < path.length - 1; i += 1) {
    assert.ok(hasLineOfSight(grid!, path[i], path[i + 1]), `route segment ${i} crosses a wall`);
  }
});

test("getNavGrid: null for maps without a baked grid or geometry", () => {
  assert.equal(getNavGrid("nuke"), null);
});
