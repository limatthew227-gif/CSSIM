/**
 * Navigation engine tests: paths stay on the walkable floor, any-angle routing is near-shortest,
 * and the dynamic obstacle hooks (molly = movement block, smoke = vision block) behave — the
 * primitives a future in-match utility system will lean on.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  mapGeometries,
  buildNavGrid,
  getNavGrid,
  findPath,
  hasLineOfSight,
  isWalkablePoint,
  pathLength,
} from "../src/mapGeometry";
import type { Circle, MapGeometry, Vec } from "../src/mapGeometry";

const GEO = mapGeometries.mirage as MapGeometry;

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

test("mirage geometry: spawns/sites/mid are walkable, void is not", () => {
  assert.ok(isWalkablePoint(GEO, GEO.spawns.t));
  assert.ok(isWalkablePoint(GEO, GEO.spawns.ct));
  assert.ok(isWalkablePoint(GEO, GEO.sites.a));
  assert.ok(isWalkablePoint(GEO, GEO.sites.b));
  assert.ok(isWalkablePoint(GEO, GEO.mid));
  assert.ok(!isWalkablePoint(GEO, { x: 1, y: 1 }));
  assert.ok(!isWalkablePoint(GEO, { x: 99, y: 99 }));
});

test("getNavGrid: built for mirage, null for maps without geometry yet", () => {
  assert.ok(getNavGrid("mirage"));
  assert.equal(getNavGrid("nuke"), null);
});

test("findPath: routes T spawn -> B site without crossing a wall", () => {
  const grid = buildNavGrid(GEO);
  const path = findPath(grid, GEO.spawns.t, GEO.sites.b);
  assert.ok(path.length >= 2, "should produce a multi-point path");
  assert.deepEqual(path[0], GEO.spawns.t, "start pinned exactly");
  assert.deepEqual(path[path.length - 1], GEO.sites.b, "goal pinned exactly");
  for (let i = 0; i < path.length - 1; i += 1) {
    assert.ok(hasLineOfSight(grid, path[i], path[i + 1]), `segment ${i} crosses a wall`);
  }
});

// Two points with clear line of sight inside the open market box (bottom-right).
const OPEN_A = { x: 58, y: 76 };
const OPEN_B = { x: 86, y: 76 };

test("findPath: open stretches come out near-straight (any-angle, not grid-stepped)", () => {
  const grid = buildNavGrid(GEO);
  assert.ok(hasLineOfSight(grid, OPEN_A, OPEN_B), "test points should see each other");
  const path = findPath(grid, OPEN_A, OPEN_B);
  const straight = Math.hypot(OPEN_B.x - OPEN_A.x, OPEN_B.y - OPEN_A.y);
  assert.ok(pathLength(path) <= straight * 1.08, `expected ~straight, got ${pathLength(path).toFixed(1)} vs ${straight.toFixed(1)}`);
});

test("findPath: a molly reroutes movement around the fire", () => {
  const grid = buildNavGrid(GEO);
  const molly: Circle = { c: { x: 72, y: 76 }, r: 5 };
  const open = findPath(grid, OPEN_A, OPEN_B);
  const around = findPath(grid, OPEN_A, OPEN_B, { mollies: [molly] });
  const entersFire = sampleSegments(around).some((p) => Math.hypot(p.x - molly.c.x, p.y - molly.c.y) < molly.r - 0.6);
  assert.ok(!entersFire, "rerouted path should avoid the molly");
  assert.ok(pathLength(around) >= pathLength(open) - 0.5, "a detour should not be shorter than the open route");
});

test("hasLineOfSight: walls and smokes both cut vision", () => {
  const grid = buildNavGrid(GEO);
  assert.ok(hasLineOfSight(grid, OPEN_A, OPEN_B), "clear market sightline");
  const smoke: Circle = { c: { x: 72, y: 76 }, r: 5 };
  assert.ok(!hasLineOfSight(grid, OPEN_A, OPEN_B, [smoke]), "smoke on the sightline blocks it");
  assert.ok(!hasLineOfSight(grid, GEO.mid, { x: 65, y: 40 }), "sightline through the central building is blocked");
});
