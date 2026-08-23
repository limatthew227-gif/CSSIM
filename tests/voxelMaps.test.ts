import { test } from "node:test";
import assert from "node:assert/strict";

import { mapPool, rosters, type MapId } from "../src/gameData";
import { MAP_LAYOUTS, simulateRadarPlayers } from "../src/radarSim";
import type { MatchState } from "../src/sim";
import {
  findPath,
  getNavGrid,
  hasLineOfSight,
  positionAlongPath,
} from "../src/mapGeometry";
import {
  getVoxelMap,
  VOXEL_MAP_PROFILES,
  voxelSurfaceAt,
} from "../src/voxelMaps";

function nearestFloorDistance(mapId: MapId, point: { x: number; y: number }) {
  const map = getVoxelMap(mapId);
  let nearest = Number.POSITIVE_INFINITY;
  for (let row = 0; row < map.res; row += 1) {
    for (let col = 0; col < map.res; col += 1) {
      if (!map.occupied[row * map.res + col]) continue;
      const x = ((col + 0.5) / map.res) * 100;
      const y = ((row + 0.5) / map.res) * 100;
      nearest = Math.min(nearest, Math.hypot(point.x - x, point.y - y));
    }
  }
  return nearest;
}

test("all competitive maps have source-derived voxel grids and a visual profile", () => {
  for (const { id } of mapPool) {
    const map = getVoxelMap(id);
    assert.equal(map.res, 56, `${id} should use the generated 56×56 voxel grid`);
    assert.equal(map.occupied.length, 56 * 56);
    assert.equal(map.heights.length, 56 * 56);
    assert.equal(map.navRes, 112, `${id} should include a dense movement grid`);
    assert.equal(map.navOccupied.length, 112 * 112);
    assert.equal(map.navHeights.length, 112 * 112);
    assert.ok(map.navOccupied.some(Boolean), `${id} should contain dense source nav cells`);
    assert.ok(map.occupied.some(Boolean), `${id} should contain nav-derived floor cells`);
    assert.equal(map.walls?.length, 56 * 56, `${id} should include Source 2 physics wall cells`);
    assert.equal(map.wallHeights?.length, 56 * 56, `${id} should include physics wall heights`);
    const wallCount = map.walls!.filter(Boolean).length;
    assert.ok(wallCount > 150, `${id} should have a substantial collision-derived silhouette`);
    assert.ok(wallCount < 700, `${id} physics walls should remain sparse enough for the voxel view`);
    for (let index = 0; index < map.occupied.length; index += 1) {
      assert.ok(
        !(map.occupied[index] && map.walls![index]),
        `${id} physics walls should not replace walkable surface cells`,
      );
    }
    assert.equal(VOXEL_MAP_PROFILES[id].id, id);
    assert.ok(VOXEL_MAP_PROFILES[id].props.length >= 4, `${id} should have authored voxel landmarks`);
  }
});

test("simulation anchors line up with the generated CS2 floor", () => {
  for (const { id } of mapPool) {
    const layout = MAP_LAYOUTS[id];
    const anchors = [
      layout.tSpawn,
      layout.ctSpawn,
      layout.bombsiteA,
      layout.bombsiteB,
      layout.mid,
    ];
    for (const anchor of anchors) {
      assert.ok(
        nearestFloorDistance(id, anchor) < 4.5,
        `${id} anchor ${anchor.x},${anchor.y} should land near a source nav area`,
      );
      assert.ok(Number.isFinite(voxelSurfaceAt(id, anchor)));
    }
  }
});

test("non-Mirage movement routes stay on the dense voxel floor and never cross walls", () => {
  for (const { id } of mapPool.filter((map) => map.id !== "mirage")) {
    const grid = getNavGrid(id)!;
    const layout = MAP_LAYOUTS[id];
    const routes = [
      [layout.tSpawn, layout.bombsiteA],
      [layout.tSpawn, layout.bombsiteB],
      [layout.ctSpawn, layout.bombsiteA],
      [layout.ctSpawn, layout.bombsiteB],
      [layout.mid, layout.bombsiteA],
      [layout.mid, layout.bombsiteB],
    ] as const;

    for (const [start, goal] of routes) {
      const path = findPath(grid, start, goal);
      assert.ok(path.length >= 2, `${id} should connect ${start.x},${start.y} to ${goal.x},${goal.y}`);
      for (let index = 1; index < path.length; index += 1) {
        assert.ok(
          hasLineOfSight(grid, path[index - 1], path[index]),
          `${id} route segment ${index - 1} should not cross a voxel wall`,
        );
      }
      for (let sample = 0; sample <= 40; sample += 1) {
        const point = positionAlongPath(path, sample / 40);
        const col = Math.min(grid.res - 1, Math.max(0, Math.floor((point.x / 100) * grid.res)));
        const row = Math.min(grid.res - 1, Math.max(0, Math.floor((point.y / 100) * grid.res)));
        assert.equal(
          grid.blockedMove[row * grid.res + col],
          0,
          `${id} route sample should remain on a walkable voxel cell`,
        );
      }
    }
  }
});

test("live non-Mirage player frames and kill traces obey the voxel movement surface", () => {
  const you = rosters[0];
  const opponent = rosters[1];
  for (const { id } of mapPool.filter((map) => map.id !== "mirage")) {
    const spawnMatch = {
      map: id,
      side: "T",
      round: 1,
      feed: [],
      pendingEvents: [{
        round: 1,
        killer: "",
        killerId: "",
        victim: "",
        victimId: "",
        weapon: "",
        team: "neutral",
        first: false,
        type: "round_start",
      }],
    } as unknown as MatchState;
    const spawned = simulateRadarPlayers(spawnMatch, you, opponent, 0).players;
    for (const side of ["CT", "T"] as const) {
      const sidePlayers = spawned.filter((player) => player.side === side);
      for (let left = 0; left < sidePlayers.length; left += 1) {
        for (let right = left + 1; right < sidePlayers.length; right += 1) {
          assert.ok(
            Math.hypot(
              sidePlayers[left].x - sidePlayers[right].x,
              sidePlayers[left].y - sidePlayers[right].y,
            ) >= 1.35,
            `${id} ${side} spawn formation should keep players out of one clump`,
          );
        }
      }
    }

    const pendingEvents = Array.from({ length: 5 }, (_, index) => ({
      round: 1,
      killer: you.players[index].handle,
      killerId: you.players[index].id,
      victim: opponent.players[index].handle,
      victimId: opponent.players[index].id,
      weapon: "AK-47",
      team: "you" as const,
      first: index === 0,
      type: "kill" as const,
    }));
    const match = {
      map: id,
      side: "T",
      round: 1,
      feed: [],
      pendingEvents,
    } as unknown as MatchState;
    const grid = getNavGrid(id)!;

    for (let frame = 0; frame <= pendingEvents.length * 4; frame += 1) {
      const result = simulateRadarPlayers(match, you, opponent, frame / 4);
      for (const player of result.players) {
        const col = Math.min(grid.res - 1, Math.max(0, Math.floor((player.x / 100) * grid.res)));
        const row = Math.min(grid.res - 1, Math.max(0, Math.floor((player.y / 100) * grid.res)));
        assert.equal(
          grid.blockedMove[row * grid.res + col],
          0,
          `${id} live frame should keep ${player.handle} on walkable voxel floor`,
        );
      }
      for (const trace of result.traces) {
        assert.ok(
          hasLineOfSight(grid, trace.killerPos, trace.victimPos),
          `${id} live kill trace should not pass through a voxel wall`,
        );
      }
    }
  }
});

test("non-Mirage corridor interpolation never snaps sideways and back at voxel boundaries", () => {
  const you = rosters[0];
  const opponent = rosters[1];
  const pendingEvents = Array.from({ length: 5 }, (_, index) => ({
    round: 1,
    killer: you.players[index].handle,
    killerId: you.players[index].id,
    victim: opponent.players[index].handle,
    victimId: opponent.players[index].id,
    weapon: "AK-47",
    team: "you" as const,
    first: index === 0,
    type: "kill" as const,
  }));

  for (const { id } of mapPool.filter((map) => map.id !== "mirage")) {
    const match = {
      map: id,
      side: "T",
      round: 1,
      feed: [],
      pendingEvents,
    } as unknown as MatchState;
    let twoFramesAgo = simulateRadarPlayers(match, you, opponent, 0).players;
    let oneFrameAgo = simulateRadarPlayers(match, you, opponent, 0.01).players;

    for (let step = 0.02; step <= pendingEvents.length + 1e-6; step += 0.01) {
      const current = simulateRadarPlayers(match, you, opponent, step).players;
      for (const player of current) {
        const previous = oneFrameAgo.find((candidate) => candidate.radarKey === player.radarKey)!;
        const earlier = twoFramesAgo.find((candidate) => candidate.radarKey === player.radarKey)!;
        const currentDelta = {
          x: player.x - previous.x,
          y: player.y - previous.y,
        };
        const previousDelta = {
          x: previous.x - earlier.x,
          y: previous.y - earlier.y,
        };
        assert.ok(
          Math.hypot(currentDelta.x, currentDelta.y) < 0.95,
          `${id} ${player.handle} should not jump to a neighbouring voxel cell at step ${step.toFixed(2)}`,
        );

        // Event boundaries can legitimately redirect a player toward a new duel. Inside an event
        // interval, however, a large negative dot product means one frame jumped off the corridor
        // and the next frame snapped back in the opposite direction.
        const phase = step - Math.floor(step);
        if (phase > 0.08 && phase < 0.92) {
          const reversal =
            -(previousDelta.x * currentDelta.x + previousDelta.y * currentDelta.y);
          assert.ok(
            reversal < 0.2,
            `${id} ${player.handle} should not snap sideways and back at step ${step.toFixed(2)}`,
          );
        }
      }
      twoFramesAgo = oneFrameAgo;
      oneFrameAgo = current;
    }
  }
});

test("non-Mirage tactical phases preserve lanes, trade depth, and retake spacing", () => {
  const you = rosters[0];
  const opponent = rosters[1];
  const neutralEvent = (type: string) => ({
    round: 1,
    killer: "",
    killerId: "",
    victim: "",
    victimId: "",
    weapon: "",
    team: "neutral" as const,
    first: false,
    type,
  });
  const pendingEvents = [
    neutralEvent("round_start"),
    neutralEvent("smoke"),
    neutralEvent("flash"),
    { ...neutralEvent("plant"), killerId: you.players[3].id },
    neutralEvent("smoke"),
    neutralEvent("round_over"),
  ];

  for (const { id } of mapPool.filter((map) => map.id !== "mirage")) {
    const match = {
      map: id,
      side: "T",
      round: 1,
      feed: [],
      pendingEvents,
    } as unknown as MatchState;

    // Setup, execute/plant, and post-plant. Spawn spacing is covered separately above.
    for (const step of [2, 4, 6]) {
      const players = simulateRadarPlayers(match, you, opponent, step).players;
      for (const side of ["CT", "T"] as const) {
        const teammates = players.filter((player) => player.side === side);
        const pairDistances: number[] = [];
        for (let left = 0; left < teammates.length; left += 1) {
          const localPack = teammates.filter(
            (right) =>
              Math.hypot(
                teammates[left].x - right.x,
                teammates[left].y - right.y,
              ) < 4,
          );
          assert.ok(
            localPack.length <= 2,
            `${id} ${side} phase ${step} should never collapse three players into one pocket`,
          );
          for (let right = left + 1; right < teammates.length; right += 1) {
            pairDistances.push(
              Math.hypot(
                teammates[left].x - teammates[right].x,
                teammates[left].y - teammates[right].y,
              ),
            );
          }
        }
        assert.ok(
          Math.max(...pairDistances) >= 14,
          `${id} ${side} phase ${step} should preserve a second lane or backline`,
        );
      }
    }
  }
});

test("non-Mirage deaths complete at the arena contact point without a feed-handoff teleport", () => {
  const you = rosters[0];
  const opponent = rosters[1];
  for (const { id } of mapPool.filter((map) => map.id !== "mirage")) {
    const roundStart = {
      round: 1,
      killer: "",
      killerId: "",
      victim: "",
      victimId: "",
      weapon: "",
      team: "neutral" as const,
      first: false,
      type: "round_start" as const,
    };
    const kill = {
      round: 1,
      killer: you.players[0].handle,
      killerId: you.players[0].id,
      victim: opponent.players[0].handle,
      victimId: opponent.players[0].id,
      weapon: "AK-47",
      team: "you" as const,
      first: true,
      type: "kill" as const,
      // Deliberately bogus narration coordinates: the arena must ignore them and resolve contact
      // from its own walkable routes.
      killerPos: { x: 2, y: 2 },
      victimPos: { x: 98, y: 98 },
    };
    const roundOver = {
      round: 1,
      killer: "",
      killerId: "",
      victim: "",
      victimId: "",
      weapon: "",
      team: "you" as const,
      first: false,
      type: "round_over" as const,
    };
    const pendingMatch = {
      map: id,
      side: "T",
      round: 1,
      feed: [],
      pendingEvents: [roundStart, kill, roundOver],
    } as unknown as MatchState;
    const streamedMatch = {
      ...pendingMatch,
      // Live feed is newest-first; reversing it must reconstruct the exact same spatial future.
      feed: [kill, roundStart],
      pendingEvents: [roundOver],
    } as unknown as MatchState;

    const beforeHandoff = simulateRadarPlayers(pendingMatch, you, opponent, 1.75);
    const afterHandoff = simulateRadarPlayers(streamedMatch, you, opponent, 1.75);
    for (const beforePlayer of beforeHandoff.players) {
      const afterPlayer = afterHandoff.players.find((player) => player.radarKey === beforePlayer.radarKey)!;
      assert.ok(
        Math.hypot(beforePlayer.x - afterPlayer.x, beforePlayer.y - afterPlayer.y) < 1e-6,
        `${id} feed handoff should not change ${beforePlayer.handle}'s arena position`,
      );
    }

    const justBefore = simulateRadarPlayers(pendingMatch, you, opponent, 1.999);
    const atContact = simulateRadarPlayers(pendingMatch, you, opponent, 2);
    const victimBefore = justBefore.players.find(
      (player) => player.team === "opponent" && player.id === opponent.players[0].id,
    )!;
    const victimAt = atContact.players.find(
      (player) => player.team === "opponent" && player.id === opponent.players[0].id,
    )!;
    const killerAt = atContact.players.find(
      (player) => player.team === "you" && player.id === you.players[0].id,
    )!;
    assert.equal(victimBefore.alive, true, `${id} victim should stay alive while approaching contact`);
    assert.equal(victimAt.alive, false, `${id} victim should fall when the contact interval completes`);
    assert.ok(
      Math.hypot(victimBefore.x - victimAt.x, victimBefore.y - victimAt.y) < 0.25,
      `${id} victim body should not teleport on the death frame`,
    );
    assert.equal(justBefore.traces.length, 0, `${id} shot should not render before contact`);
    const trace = atContact.traces.find((candidate) => candidate.victimId === kill.victimId)!;
    assert.ok(trace, `${id} should render the resolved shot at contact`);
    assert.ok(
      Math.hypot(trace.killerPos.x - killerAt.x, trace.killerPos.y - killerAt.y) < 1e-6,
      `${id} trace ${trace.killerPos.x},${trace.killerPos.y} must start at rendered killer ${killerAt.x},${killerAt.y}`,
    );
    assert.ok(
      Math.hypot(trace.victimPos.x - victimAt.x, trace.victimPos.y - victimAt.y) < 1e-6,
      `${id} trace must end at the rendered victim`,
    );
    assert.ok(
      hasLineOfSight(getNavGrid(id)!, trace.killerPos, trace.victimPos),
      `${id} resolved shot must have line of sight`,
    );
  }
});

test("Nuke retains a distinct lower navigation layer for B", () => {
  const nuke = getVoxelMap("nuke");
  assert.ok(nuke.lowerOccupied, "Nuke should include overlapping lower-level floor cells");
  assert.ok(nuke.lowerHeights, "Nuke should include lower-level elevation samples");
  assert.ok(nuke.lowerOccupied!.filter(Boolean).length > 80, "Nuke lower layer should be substantial");
  const b = MAP_LAYOUTS.nuke.bombsiteB;
  const bIndex =
    Math.floor((b.y / 100) * nuke.res) * nuke.res + Math.floor((b.x / 100) * nuke.res);
  const upperAtB = (nuke.heights[bIndex] - 128) * 0.24;
  assert.ok(voxelSurfaceAt("nuke", b) < upperAtB, "B site should select the nearby lower nav surface");
});
