import assert from "node:assert/strict";
import test from "node:test";
import { rosters } from "../src/gameData";
import {
  applyManagerRosterMoves,
  createManagerAiTransferActivity,
  createManagerFreeAgentPool,
  createManagerTransferList,
  managerEstimatedTransferFee,
  managerPlayerUnderperformed,
  managerRosterChangePressure,
  managerScoutingRange,
} from "../src/managerMarket";

test("the free-agent market is deterministic, unique, and covers every role", () => {
  const first = createManagerFreeAgentPool("career-seed", 18);
  const replay = createManagerFreeAgentPool("career-seed", 18);
  assert.deepEqual(first, replay);
  assert.equal(new Set(first.map((candidate) => candidate.id)).size, first.length);
  assert.equal(first.every((candidate) => candidate.kind === "free-agent"), true);
  for (const role of ["IGL", "AWP", "Entry", "Lurker", "Rifler", "Support"]) {
    assert.ok(first.some((candidate) => candidate.player.role === role), `missing ${role}`);
  }
});

test("elite clubs protect their roster unless the team and specific player underperform", () => {
  const elite = { ...rosters[0], rank: 3 };
  const world = [elite, ...rosters.slice(1)];
  const player = elite.players[0];
  const stableList = createManagerTransferList("elite-stability", world, "managed", 100);
  assert.equal(stableList.some((candidate) => candidate.currentTeam?.id === elite.id), false);
  assert.equal(managerRosterChangePressure("elite-stability", "2026-08-01", elite, player), 0);

  const slump = {
    teamId: elite.id,
    playerId: player.id,
    rating: 0.75,
    maps: 8,
    teamSeriesWins: 1,
    teamSeriesLosses: 3,
  };
  assert.equal(managerPlayerUnderperformed(player, slump), true);
  assert.ok(managerRosterChangePressure("elite-stability", "2026-08-01", elite, player, slump) > 0);
  const poorIndividualGoodTeam = { ...slump, teamSeriesWins: 4, teamSeriesLosses: 1 };
  assert.equal(managerRosterChangePressure("elite-stability", "2026-08-01", elite, player, poorIndividualGoodTeam), 0);
  const protectedList = createManagerTransferList("elite-stability", world, "managed", 100, {}, [poorIndividualGoodTeam]);
  assert.equal(protectedList.some((candidate) => candidate.id === player.id), false);
});

test("elite superstar fees are prohibitive even before negotiation", () => {
  const superstar = {
    ...rosters[0].players[0],
    ovr: 99,
    age: 19,
    potential: 99,
    hltvRating: 1.45,
  };
  assert.ok(managerEstimatedTransferFee(superstar, 3) >= 2_500_000);
});

test("the transfer list excludes the managed organization and carries club context", () => {
  const managed = rosters[0];
  const listed = createManagerTransferList("career-seed", rosters, managed.id, 30);
  assert.equal(listed.every((candidate) => candidate.currentTeam?.id !== managed.id), true);
  assert.equal(listed.every((candidate) => candidate.kind === "transfer-listed"), true);
  assert.equal(listed.every((candidate) => candidate.estimatedFee >= 25_000), true);
  assert.equal(listed.every((candidate) => candidate.previousTeam === candidate.currentTeam?.name), true);
});

test("unscouted reports hide exact level inside a bounded range", () => {
  const candidate = createManagerFreeAgentPool("range-seed", 1)[0];
  const range = managerScoutingRange(candidate.player);
  assert.ok(range.low < candidate.player.ovr);
  assert.ok(range.high > candidate.player.ovr);
  assert.ok(range.potentialLow >= candidate.player.ovr);
  assert.ok(range.potentialHigh <= 99);
});

test("completed Manager trades replace the player on the selling club", () => {
  const seller = rosters[1];
  const released = seller.players[0];
  const acquired = rosters[0].players[0];
  const updated = applyManagerRosterMoves(rosters, [{
    id: "move-1",
    clubId: seller.id,
    clubName: seller.name,
    releasedPlayerId: released.id,
    acquiredPlayer: acquired,
    completedOn: "2026-07-22",
  }]);
  const updatedSeller = updated.find((team) => team.id === seller.id)!;
  assert.equal(updatedSeller.players.some((player) => player.id === released.id), false);
  assert.equal(updatedSeller.players.some((player) => player.id === acquired.id), true);
  assert.equal(updatedSeller.players.length, seller.players.length);
  assert.equal(rosters[1].players[0].id, released.id);
});

test("AI clubs make deterministic role-safe transfers without touching the managed club", () => {
  const world = rosters.filter((team) => team.era === "CS2");
  const managed = world[0];
  const options = {
    seed: "ai-world-market",
    rosters: world,
    fromDate: "2026-07-20",
    toDate: "2026-09-14",
    excludedOrganizationId: "historic-managed-identity",
    excludedOrganizationName: managed.name,
  };
  const activity = createManagerAiTransferActivity(options);
  assert.deepEqual(activity, createManagerAiTransferActivity(options));
  assert.ok(activity.length > 0);

  const moves = activity.flatMap((item) => item.moves);
  assert.equal(moves.every((move) => move.clubId !== managed.id), true);
  moves.forEach((move) => {
    const sourceTeam = world.find((team) => team.id === move.clubId)!;
    const released = sourceTeam.players.find((player) => player.id === move.releasedPlayerId)!;
    assert.equal(move.acquiredPlayer.role, released.role);
  });

  const updated = applyManagerRosterMoves(world, moves);
  assert.equal(updated.every((team) => team.players.length === 5), true);
  assert.deepEqual(updated.find((team) => team.id === managed.id), managed);
  const playerIds = updated.flatMap((team) => team.players.map((player) => player.id));
  assert.equal(new Set(playerIds).size, playerIds.length);
});
