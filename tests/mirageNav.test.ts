/**
 * Mirage tactical graph + weighted pathfinder tests: the graph is connected, routes are
 * tactically sensible (A routes go A-side, B routes go B-side), one-way drops are respected, and
 * weighted edge costs respond to round state (AWP pressure, utility, post-plant rotations).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { mirageNodes, mirageEdges, getNode, type MapEdge } from "../src/mirageNav";
import { findRoute, edgeCost, NEUTRAL_STATE, type RoundState } from "../src/pathfinder";

const ids = (route: { nodes: { id: string }[] } | null) => (route ? route.nodes.map((n) => n.id) : []);
const edgeOf = (from: string, to: string): MapEdge => mirageEdges.find((e) => e.from === from && e.to === to)!;

test("graph: every callout is reachable from both spawns", () => {
  for (const spawn of ["tspawn", "ctspawn"]) {
    for (const n of mirageNodes) {
      assert.ok(findRoute(spawn, n.id), `${n.id} unreachable from ${spawn}`);
    }
  }
});

test("routing: T Spawn -> A Site stays on the A side (palace/ramp/mid), never through B", () => {
  const route = ids(findRoute("tspawn", "asite"));
  assert.ok(route.length >= 2);
  assert.ok(route.some((id) => ["palace", "aramp", "connector"].includes(id)), `expected an A approach, got ${route}`);
  for (const b of ["bsite", "van", "bapps", "market"]) {
    assert.ok(!route.includes(b), `A route should not detour through ${b}: ${route}`);
  }
});

test("routing: T Spawn -> B Site stays on the B side, never through A palace/ramp", () => {
  const route = ids(findRoute("tspawn", "bsite"));
  assert.ok(route.some((id) => ["bapps", "van", "catwalk"].includes(id)), `expected a B approach, got ${route}`);
  for (const a of ["aramp", "palace", "scaffolding"]) {
    assert.ok(!route.includes(a), `B route should not detour through ${a}: ${route}`);
  }
});

test("routing: CT Spawn can rotate to both bombsites", () => {
  assert.ok(findRoute("ctspawn", "asite"), "CT must reach A");
  assert.ok(findRoute("ctspawn", "bsite"), "CT must reach B");
});

test("routing: the palace drop is one-way (A -> Palace can't use the drop, goes around)", () => {
  const up = ids(findRoute("asite", "palace"));
  assert.ok(up.length > 2, `palace should still be reachable from A the long way, got ${up}`);
  // the one-way drop edge exists only palace -> asite (you can't climb back up it)
  assert.ok(edgeOf("palace", "asite").oneWay, "palace->A should be one-way");
  assert.ok(!edgeOf("asite", "palace"), "there should be no direct asite->palace edge (it's a drop)");
});

test("edgeCost: a strong enemy AWP makes open angles (window) much costlier", () => {
  const window = edgeOf("mid", "window");
  const calm: RoundState = { ...NEUTRAL_STATE, enemyAwperPressure: 0 };
  const awp: RoundState = { ...NEUTRAL_STATE, enemyAwperPressure: 1 };
  assert.ok(edgeCost(window, awp) > edgeCost(window, calm) + 1, "AWP pressure should raise exposed-angle cost");
});

test("edgeCost: utility makes a major choke (B apps drop) much cheaper to take", () => {
  const apps = edgeOf("bapps", "van");
  const dry: RoundState = { ...NEUTRAL_STATE, hasUtility: false };
  const nades: RoundState = { ...NEUTRAL_STATE, hasUtility: true, availableUtility: 1 };
  assert.ok(edgeCost(apps, nades) < edgeCost(apps, dry), "having utility should cut the choke cost");
});

test("edgeCost: after a plant, CT rotations are prioritised (cheaper)", () => {
  const rotate = edgeOf("ctspawn", "market");
  const pre: RoundState = { ...NEUTRAL_STATE, bombPlanted: false };
  const post: RoundState = { ...NEUTRAL_STATE, bombPlanted: true };
  assert.ok(edgeCost(rotate, post) < edgeCost(rotate, pre), "rotate edges should get cheaper post-plant");
});

test("routing: AWP pressure reroutes A approach away from the window angle", () => {
  // From Top Mid to A, a calm round may cut through mid; under heavy AWP the route should avoid window.
  const awp: RoundState = { ...NEUTRAL_STATE, enemyAwperPressure: 1 };
  const route = ids(findRoute("topmid", "asite", awp));
  assert.ok(route.length > 0);
  assert.ok(!route.includes("window"), `under AWP pressure the A route should avoid window, got ${route}`);
});
