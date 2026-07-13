import { test } from "node:test";
import assert from "node:assert/strict";

import { getNode } from "../src/mirageNav";
import { mirageNavAreas, mirageNavPlaces } from "../src/mirageNavMesh";
import { findMirageNavAreaIds, findMirageNavPath, mirageNavAreaCount } from "../src/mirageNavMeshPath";
import { corridorPath } from "../src/pathfinder";
import { getNavGrid, hasLineOfSight } from "../src/mapGeometry";

const areaById = new Map(mirageNavAreas.map((area) => [area.id, area]));

test("NAV mesh: generated Mirage data keeps all real areas, places, links and hiding spots", () => {
  assert.equal(mirageNavAreaCount(), 906);
  assert.equal(mirageNavPlaces.length - 1, 23);
  assert.ok(mirageNavAreas.reduce((sum, area) => sum + area.links.length, 0) > 3000);
  assert.ok(mirageNavAreas.reduce((sum, area) => sum + area.hidingSpots.length, 0) > 300);
});

test("NAV mesh: representative tactical routes use only real directed area connections", () => {
  const routes = [
    ["tspawn", "asite"],
    ["tspawn", "bsite"],
    ["topmid", "connector"],
    ["mid", "underpass"],
    ["palace", "asite"],
    ["ctspawn", "market"],
  ];

  for (const [fromId, toId] of routes) {
    const from = getNode(fromId)!;
    const to = getNode(toId)!;
    const ids = findMirageNavAreaIds(from, to, { startNodeId: fromId, endNodeId: toId });
    assert.ok(ids && ids.length > 1, `${fromId} -> ${toId} should have a NAV-area route`);
    ids!.slice(0, -1).forEach((areaId, index) => {
      assert.ok(areaById.get(areaId)?.links.includes(ids![index + 1]), `${areaId} should link to ${ids![index + 1]}`);
    });
  }
});

test("NAV mesh: generated movement paths remain finite and inside radar coordinates", () => {
  const from = getNode("tspawn")!;
  const to = getNode("bsite")!;
  const path = findMirageNavPath(from, to, { startNodeId: "tspawn", endNodeId: "bsite" });
  assert.ok(path && path.length > 10);
  path!.forEach((point) => {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    assert.ok(point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100);
  });
});

test("NAV mesh: mid-to-underpass preserves a real elevation transition", () => {
  const from = getNode("mid")!;
  const to = getNode("underpass")!;
  const ids = findMirageNavAreaIds(from, to, { startNodeId: "mid", endNodeId: "underpass" })!;
  const heights = ids.map((id) => areaById.get(id)!.z);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 70);
});

test("NAV mesh: rendered tactical corridors never project through the wall mask", () => {
  const grid = getNavGrid("mirage")!;
  const routes = [["tspawn", "asite"], ["tspawn", "bsite"], ["mid", "underpass"], ["palace", "asite"], ["bapps", "bsite"]];
  routes.forEach(([fromId, toId]) => {
    const path = corridorPath("mirage", [getNode(fromId)!, getNode(toId)!]);
    path.slice(1).forEach((point, index) => {
      assert.ok(hasLineOfSight(grid, path[index], point), `${fromId} -> ${toId} segment ${index} crosses a wall`);
    });
  });
});
