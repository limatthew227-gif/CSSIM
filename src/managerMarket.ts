import { careerMetaForPlayer, playerValue } from "./career";
import { rateStatsForRole, rosters as scoutingRosters, type Player, type Role, type Roster } from "./gameData";
import { managerRecommendedSalary, type ManagerClubRosterMove, type ManagerSalaryContext } from "./managerCareer";

export type ManagerMarketKind = "free-agent" | "transfer-listed";

export interface ManagerMarketCandidate {
  id: string;
  kind: ManagerMarketKind;
  player: Player;
  currentTeam?: Roster;
  previousTeam: string;
  askingSalary: number;
  estimatedFee: number;
  interest: number;
}

export interface ManagerAiTransferActivity {
  id: string;
  date: string;
  moves: [ManagerClubRosterMove, ManagerClubRosterMove];
  headline: string;
  body: string;
}

export interface ManagerRecentPlayerPerformance {
  teamId: string;
  playerId: string;
  rating: number;
  maps: number;
  teamSeriesWins: number;
  teamSeriesLosses: number;
}

export interface ManagerAiTransferOptions {
  seed: string;
  rosters: Roster[];
  fromDate: string;
  toDate: string;
  existingMoves?: ManagerClubRosterMove[];
  excludedOrganizationId?: string;
  excludedOrganizationName?: string;
  recentPerformance?: ManagerRecentPlayerPerformance[];
}

function stableHash(value: string) {
  return Math.abs(value.split("").reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 17));
}

function monthlyTransferDates(fromDate: string, toDate: string) {
  const cursor = new Date(`${fromDate.slice(0, 7)}-01T00:00:00Z`);
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  const dates: string[] = [];
  while (cursor.toISOString().slice(0, 10) <= toDate) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return dates;
}

export function createManagerAiTransferActivity({
  seed,
  rosters,
  fromDate,
  toDate,
  existingMoves = [],
  excludedOrganizationId,
  excludedOrganizationName = "",
  recentPerformance = [],
}: ManagerAiTransferOptions): ManagerAiTransferActivity[] {
  if (toDate <= fromDate) return [];
  const excludedName = excludedOrganizationName.trim().toLowerCase();
  const usedPlayerIds = new Set(existingMoves.flatMap((move) => [move.releasedPlayerId, move.acquiredPlayer.id]));
  const existingMoveIds = new Set(existingMoves.map((move) => move.id));
  let world = rosters.filter((roster) => (
    roster.players.length >= 5
    && roster.id !== excludedOrganizationId
    && roster.name.trim().toLowerCase() !== excludedName
  ));
  const performanceByPlayer = new Map(recentPerformance.map((item) => [`${item.teamId}:${item.playerId}`, item]));

  return monthlyTransferDates(fromDate, toDate).flatMap((date) => {
    const swaps = world.flatMap((leftTeam, leftIndex) => world.slice(leftIndex + 1).flatMap((rightTeam) => (
      leftTeam.players.flatMap((leftPlayer) => rightTeam.players
        .filter((rightPlayer) => (
          rightPlayer.role === leftPlayer.role
          && rightPlayer.id !== leftPlayer.id
          && Math.abs(rightPlayer.ovr - leftPlayer.ovr) <= 8
          && !usedPlayerIds.has(leftPlayer.id)
          && !usedPlayerIds.has(rightPlayer.id)
          && managerRosterChangePressure(
            seed,
            date,
            leftTeam,
            leftPlayer,
            performanceByPlayer.get(`${leftTeam.id}:${leftPlayer.id}`),
          ) > 0
          && managerRosterChangePressure(
            seed,
            date,
            rightTeam,
            rightPlayer,
            performanceByPlayer.get(`${rightTeam.id}:${rightPlayer.id}`),
          ) > 0
          && ((leftTeam.rank ?? 64) > 10 || rightPlayer.ovr >= leftPlayer.ovr - 2)
          && ((rightTeam.rank ?? 64) > 10 || leftPlayer.ovr >= rightPlayer.ovr - 2)
        ))
        .map((rightPlayer) => ({
          leftTeam,
          rightTeam,
          leftPlayer,
          rightPlayer,
          pressure: managerRosterChangePressure(seed, date, leftTeam, leftPlayer, performanceByPlayer.get(`${leftTeam.id}:${leftPlayer.id}`))
            + managerRosterChangePressure(seed, date, rightTeam, rightPlayer, performanceByPlayer.get(`${rightTeam.id}:${rightPlayer.id}`)),
        })))
    ))).sort((left, right) => (
      right.pressure - left.pressure
      || stableHash(`${seed}:${date}:${left.leftTeam.id}:${left.leftPlayer.id}:${left.rightTeam.id}:${left.rightPlayer.id}`)
      - stableHash(`${seed}:${date}:${right.leftTeam.id}:${right.leftPlayer.id}:${right.rightTeam.id}:${right.rightPlayer.id}`)
    ));
    const swap = swaps[0];
    if (!swap) return [];

    const activityId = `${seed}:ai-transfer:${date}:${swap.leftTeam.id}:${swap.rightTeam.id}`;
    const moves: [ManagerClubRosterMove, ManagerClubRosterMove] = [
      {
        id: `${activityId}:${swap.leftTeam.id}`,
        clubId: swap.leftTeam.id,
        clubName: swap.leftTeam.name,
        releasedPlayerId: swap.leftPlayer.id,
        acquiredPlayer: swap.rightPlayer,
        completedOn: date,
      },
      {
        id: `${activityId}:${swap.rightTeam.id}`,
        clubId: swap.rightTeam.id,
        clubName: swap.rightTeam.name,
        releasedPlayerId: swap.rightPlayer.id,
        acquiredPlayer: swap.leftPlayer,
        completedOn: date,
      },
    ];
    if (moves.every((move) => existingMoveIds.has(move.id))) return [];

    usedPlayerIds.add(swap.leftPlayer.id);
    usedPlayerIds.add(swap.rightPlayer.id);
    moves.forEach((move) => existingMoveIds.add(move.id));
    world = applyManagerRosterMoves(world, moves);
    return [{
      id: activityId,
      date,
      moves,
      headline: `${swap.leftTeam.name} and ${swap.rightTeam.name} complete a transfer`,
      body: `${swap.rightPlayer.handle} joins ${swap.leftTeam.name}; ${swap.leftPlayer.handle} moves to ${swap.rightTeam.name}. Both clubs retain their ${swap.leftPlayer.role} role coverage.`,
    }];
  });
}

function expectedManagerRating(player: Player) {
  return player.hltvRating ?? Math.max(0.96, Math.min(1.24, 0.82 + player.ovr * 0.004));
}

export function managerPlayerUnderperformed(
  player: Player,
  performance?: ManagerRecentPlayerPerformance,
) {
  return Boolean(
    performance
    && performance.maps >= 4
    && performance.rating <= expectedManagerRating(player) - 0.12,
  );
}

export function managerRosterChangePressure(
  seed: string,
  date: string,
  team: Roster,
  player: Player,
  performance?: ManagerRecentPlayerPerformance,
) {
  const rank = team.rank ?? 64;
  const playerSlumped = managerPlayerUnderperformed(player, performance);
  const teamUnderachieved = Boolean(performance && performance.teamSeriesLosses >= performance.teamSeriesWins);
  if (rank <= 10) {
    if (!playerSlumped || !teamUnderachieved) return 0;
    return 180 + Math.round((expectedManagerRating(player) - performance!.rating) * 100);
  }
  if (playerSlumped) return 120 + Math.round((expectedManagerRating(player) - performance!.rating) * 100);
  const churnChance = rank <= 20 ? 5 : rank <= 35 ? 10 : 16;
  return stableHash(`${seed}:${date}:${team.id}:${player.id}:roster-pressure`) % 100 < churnChance
    ? 40 + Math.max(0, rank - 10)
    : 0;
}

export function managerEstimatedTransferFee(player: Player, teamRank = 64, underperformed = false) {
  const clubControl = teamRank <= 5 ? 1.32 : teamRank <= 10 ? 1.2 : teamRank <= 20 ? 1.08 : 1;
  const availability = underperformed ? 0.92 : 1.08;
  return Math.max(25_000, Math.round(playerValue(player) * clubControl * availability / 5_000) * 5_000);
}

function adjustedFreeAgent(seed: string, player: Player, role: Role = player.role): Player {
  const reduction = 2 + stableHash(`${seed}:${player.id}:level`) % 7;
  const age = 18 + stableHash(`${seed}:${player.id}:age`) % 12;
  const adjust = (value: number) => Math.max(50, value - reduction);
  const stats = {
    aim: adjust(player.stats.aim),
    clutch: adjust(player.stats.clutch),
    consistency: adjust(player.stats.consistency),
    awp: adjust(player.stats.awp),
    igl: adjust(player.stats.igl),
  };
  const ovr = rateStatsForRole(stats, role);
  const meta = careerMetaForPlayer({ ovr, age }, 0);
  return {
    ...player,
    id: `manager-fa-${player.id}`,
    role,
    stats,
    ovr,
    ...meta,
    maps: Object.fromEntries(
      Object.entries(player.maps).map(([map, rating]) => [map, Math.max(58, rating - reduction)]),
    ) as Player["maps"],
  };
}

export function createManagerFreeAgentPool(
  seed: string,
  count = 18,
  salaryContext: ManagerSalaryContext = {},
): ManagerMarketCandidate[] {
  const roleOrder: Role[] = ["IGL", "AWP", "Entry", "Lurker", "Rifler", "Support"];
  const candidates = scoutingRosters.flatMap((team, teamIndex) => team.players.map((sourcePlayer) => {
    // The fictional source set predates the explicit Lurker role. Split its riflers between the
    // two rifle jobs so every career market can actually solve either roster need.
    const marketRole: Role = sourcePlayer.role === "Rifler" && teamIndex % 2 === 0 ? "Lurker" : sourcePlayer.role;
    const player = adjustedFreeAgent(seed, sourcePlayer, marketRole);
    return {
      id: player.id,
      kind: "free-agent" as const,
      player,
      previousTeam: team.name,
      askingSalary: managerRecommendedSalary(player, salaryContext),
      estimatedFee: 0,
      interest: Math.max(28, Math.min(92, 78 - player.ovr + (player.potential ?? player.ovr) - player.ovr + stableHash(`${seed}:${player.id}:interest`) % 28)),
    };
  }));
  const ordered = [...candidates].sort((left, right) =>
    stableHash(`${seed}:${left.id}:order`) - stableHash(`${seed}:${right.id}:order`),
  );
  const picks: ManagerMarketCandidate[] = [];
  roleOrder.forEach((role) => {
    const roleCandidates = ordered.filter((candidate) => candidate.player.role === role).slice(0, 2);
    picks.push(...roleCandidates);
  });
  picks.push(...ordered.filter((candidate) => !picks.some((pick) => pick.id === candidate.id)));
  return picks.slice(0, count);
}

export function createManagerTransferList(
  seed: string,
  rosters: Roster[],
  excludedOrganizationId: string,
  count = 18,
  salaryContext: ManagerSalaryContext = {},
  recentPerformance: ManagerRecentPlayerPerformance[] = [],
): ManagerMarketCandidate[] {
  const performanceByPlayer = new Map(recentPerformance.map((item) => [`${item.teamId}:${item.playerId}`, item]));
  return rosters
    .filter((team) => team.id !== excludedOrganizationId)
    .flatMap((team) => team.players.map((player) => ({ team, player })))
    .filter(({ team, player }) => {
      const performance = performanceByPlayer.get(`${team.id}:${player.id}`);
      if ((team.rank ?? 64) <= 10) {
        return managerPlayerUnderperformed(player, performance)
          && Boolean(performance && performance.teamSeriesLosses >= performance.teamSeriesWins)
          && stableHash(`${seed}:${player.id}:elite-listed`) % 3 === 0;
      }
      return managerPlayerUnderperformed(player, performance)
        || stableHash(`${seed}:${player.id}:listed`) % 4 === 0;
    })
    .sort((left, right) => stableHash(`${seed}:${left.player.id}:transfer-order`) - stableHash(`${seed}:${right.player.id}:transfer-order`))
    .slice(0, count)
    .map(({ team, player }) => ({
      id: player.id,
      kind: "transfer-listed" as const,
      player,
      currentTeam: team,
      previousTeam: team.name,
      askingSalary: managerRecommendedSalary(player, {
        ...salaryContext,
        vrsRank: team.rank ?? salaryContext.vrsRank,
        organizationCountry: team.country ?? salaryContext.organizationCountry,
      }),
      estimatedFee: managerEstimatedTransferFee(
        player,
        team.rank,
        managerPlayerUnderperformed(player, performanceByPlayer.get(`${team.id}:${player.id}`)),
      ),
      interest: Math.max(20, Math.min(90, 70 - player.ovr + stableHash(`${seed}:${player.id}:transfer-interest`) % 35)),
    }));
}

export function managerScoutingRange(player: Player) {
  const uncertainty = player.age != null && player.age <= 20 ? 4 : 3;
  return {
    low: Math.max(50, player.ovr - uncertainty),
    high: Math.min(99, player.ovr + uncertainty),
    potentialLow: Math.max(player.ovr, (player.potential ?? player.ovr) - 2),
    potentialHigh: Math.min(99, (player.potential ?? player.ovr) + 1),
  };
}

const managerRoles = new Set<Role>(["IGL", "AWP", "Entry", "Lurker", "Rifler", "Support"]);

function tradedPlayer(move: ManagerClubRosterMove, released: Player, rosters: Roster[]): Player {
  const known = rosters.flatMap((roster) => roster.players).find((player) => player.id === move.acquiredPlayer.id);
  if (known) return known;
  const saved = move.acquiredPlayer as Player;
  if (saved.stats && saved.maps && saved.source) return saved;
  const role = managerRoles.has(move.acquiredPlayer.role as Role) ? move.acquiredPlayer.role as Role : released.role;
  return {
    ...released,
    id: move.acquiredPlayer.id,
    handle: move.acquiredPlayer.handle,
    realName: move.acquiredPlayer.handle,
    role,
    ovr: move.acquiredPlayer.ovr,
    age: move.acquiredPlayer.age,
    potential: move.acquiredPlayer.potential,
  };
}

export function applyManagerRosterMoves(rosters: Roster[], moves: ManagerClubRosterMove[]) {
  return moves.reduce<Roster[]>((world, move) => world.map((roster) => {
    if (roster.id !== move.clubId) return roster;
    const released = roster.players.find((player) => player.id === move.releasedPlayerId);
    if (!released) return roster;
    const acquired = tradedPlayer(move, released, world);
    return {
      ...roster,
      players: roster.players.map((player) => player.id === move.releasedPlayerId ? acquired : player),
    };
  }), rosters);
}
