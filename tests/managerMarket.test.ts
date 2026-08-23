import assert from "node:assert/strict";
import test from "node:test";
import { rosters } from "../src/gameData";
import {
  applyManagerRosterMoves,
  createManagerAiTransferActivity,
  createManagerFreeAgentPool,
  createManagerReleasedFreeAgentPool,
  createManagerTransferList,
  managerBenchedPlayerReleaseOn,
  managerEstimatedTransferFee,
  managerPlayerUnderperformed,
  managerRosterChangePressure,
  managerScoutingRange,
} from "../src/managerMarket";

test("the free-agent market contains the requested legends and confirmed current bench players", () => {
  const first = createManagerFreeAgentPool("career-seed");
  const replay = createManagerFreeAgentPool("career-seed");
  assert.deepEqual(first, replay);
  assert.equal(new Set(first.map((candidate) => candidate.id)).size, first.length);
  assert.equal(first.every((candidate) => candidate.kind === "free-agent"), true);
  assert.deepEqual(first.map((candidate) => candidate.player.handle), [
    "dupreeh",
    "degster",
    "jL",
    "Skadoodle",
    "lauNX",
    "broky",
    "MAJ3R",
    "HooXi",
    "gla1ve",
    "soulfly",
    "SunPayus",
    "cobrazera",
    "nota",
    "urban0",
    "DANK1NG",
    "Krimbo",
    "skullz",
    "levi",
    "Lucaozy",
    "Ag1l",
    "jkaem",
    "aragornN",
    "yxngstxr",
  ]);
  assert.equal(first.some((candidate) => candidate.player.handle === "nitr0"), false);
  assert.equal(first.every((candidate) => candidate.id.startsWith("manager-fa-real-")), true);
  assert.equal(first.every((candidate) => candidate.estimatedFee === 0), true);
});

test("gameplay markets are uncapped unless a caller explicitly requests a smaller sample", () => {
  const freeAgents = createManagerFreeAgentPool("uncapped-market");
  assert.ok(freeAgents.length > 18);
  assert.equal(createManagerFreeAgentPool("uncapped-market", 18).length, 18);

  const expandedWorld = Array.from({ length: 12 }, (_, copy) => rosters.map((roster, rosterIndex) => ({
    ...roster,
    id: `${roster.id}-market-copy-${copy}`,
    name: `${roster.name} Market Copy ${copy}`,
    rank: 20 + copy * rosters.length + rosterIndex,
    players: roster.players.map((player) => ({
      ...player,
      id: `${player.id}-market-copy-${copy}`,
    })),
  }))).flat();
  const uncappedTransfers = createManagerTransferList("uncapped-market", expandedWorld, "managed-club");
  const cappedTransfers = createManagerTransferList("uncapped-market", expandedWorld, "managed-club", 18);

  assert.ok(uncappedTransfers.length > 18);
  assert.equal(cappedTransfers.length, 18);
  assert.deepEqual(uncappedTransfers.slice(0, 18), cappedTransfers);
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

test("AI clubs sign free agents and priority-list the player they bench", () => {
  const sourceTeam = rosters.find((team) => team.era === "CS2")!;
  const releasedPlayer = {
    ...sourceTeam.players[0],
    ovr: 66,
    hltvRating: 1.01,
  };
  const team = {
    ...sourceTeam,
    id: "ai-free-agent-club",
    name: "AI Free Agent Club",
    rank: 24,
    players: [releasedPlayer, ...sourceTeam.players.slice(1)],
  };
  const freeAgent = createManagerFreeAgentPool("ai-signing", 30)
    .find((candidate) => candidate.player.role === releasedPlayer.role
      && candidate.player.ovr >= releasedPlayer.ovr
      && candidate.player.ovr <= Math.max(...team.players.map((player) => player.ovr)) + 5)!.player;
  const options = {
    seed: "ai-signing",
    rosters: [team],
    freeAgents: [team.players.find((player) => player.role === releasedPlayer.role)!, freeAgent],
    fromDate: "2026-07-20",
    toDate: "2026-08-02",
    recentPerformance: [{
      teamId: team.id,
      playerId: releasedPlayer.id,
      rating: 0.72,
      maps: 8,
      teamSeriesWins: 1,
      teamSeriesLosses: 4,
    }],
  };

  const activity = createManagerAiTransferActivity(options);
  assert.deepEqual(activity, createManagerAiTransferActivity(options));
  assert.equal(activity.length, 1);
  assert.equal(activity[0].moves.length, 1);
  const move = activity[0].moves[0];
  assert.equal(move.transactionType, "free-agent-signing");
  assert.equal(move.acquiredPlayer.id, freeAgent.id);
  assert.equal(move.releasedPlayerId, releasedPlayer.id);
  assert.equal(move.releasedPlayer?.id, releasedPlayer.id);
  assert.equal(move.releasedToTransferList, true);

  const updated = applyManagerRosterMoves([team], [move]);
  assert.equal(updated[0].players.length, 5);
  assert.equal(updated[0].players.some((player) => player.id === freeAgent.id), true);
  assert.equal(updated[0].players.some((player) => player.id === releasedPlayer.id), false);

  const transferList = createManagerTransferList(
    "ai-signing",
    updated,
    "managed-club",
    18,
    {},
    [],
    [move],
  );
  assert.equal(transferList[0].id, releasedPlayer.id);
  assert.equal(transferList[0].currentTeam?.id, team.id);
  assert.equal(transferList[0].priority, true);
  assert.match(transferList[0].listingReason ?? "", /actively trying to sell/i);
  assert.ok(transferList[0].estimatedFee < managerEstimatedTransferFee(releasedPlayer, team.rank));

  const releaseOn = managerBenchedPlayerReleaseOn(move);
  assert.equal(releaseOn, "2026-10-30");
  const beforeRelease = createManagerReleasedFreeAgentPool("ai-signing", [move], "2026-10-29");
  assert.equal(beforeRelease.length, 0);
  const releasedPool = createManagerReleasedFreeAgentPool("ai-signing", [move], releaseOn);
  assert.equal(releasedPool.length, 1);
  assert.equal(releasedPool[0].id, releasedPlayer.id);
  assert.equal(releasedPool[0].previousTeam, team.name);
  assert.equal(releasedPool[0].estimatedFee, 0);
  assert.equal(releasedPool[0].availableOn, releaseOn);

  const expiredTransferList = createManagerTransferList(
    "ai-signing",
    updated,
    "managed-club",
    18,
    {},
    [],
    [move],
    releaseOn,
  );
  assert.equal(expiredTransferList.some((candidate) => candidate.id === releasedPlayer.id), false);

  const receiverPlayers = sourceTeam.players.map((player, index) => ({
    ...player,
    id: `receiver-${player.id}`,
    ...(index === 0 ? { role: releasedPlayer.role, ovr: 65, hltvRating: 1 } : {}),
  }));
  const receiver = {
    ...sourceTeam,
    id: "ai-receiver-club",
    name: "AI Receiver Club",
    rank: 26,
    players: receiverPlayers,
  };
  const recycledActivity = createManagerAiTransferActivity({
    seed: "ai-recycled-signing",
    rosters: [updated[0], receiver],
    existingMoves: [move],
    freeAgents: releasedPool.map((candidate) => candidate.player),
    freeAgentAvailableOn: { [releasedPlayer.id]: releaseOn },
    fromDate: "2026-10-02",
    toDate: "2026-11-02",
    recentPerformance: [{
      teamId: receiver.id,
      playerId: receiverPlayers[0].id,
      rating: 0.7,
      maps: 8,
      teamSeriesWins: 0,
      teamSeriesLosses: 4,
    }],
  });
  assert.equal(recycledActivity.length, 1);
  assert.equal(recycledActivity[0].moves[0].clubId, receiver.id);
  assert.equal(recycledActivity[0].moves[0].acquiredPlayer.id, releasedPlayer.id);
});
