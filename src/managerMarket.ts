import { careerMetaForPlayer, playerValue } from "./career";
import { rateStatsForRole, type Player, type Role, type Roster } from "./gameData";
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
  priority?: boolean;
  listingReason?: string;
  availableOn?: string;
}

export interface ManagerAiTransferActivity {
  id: string;
  date: string;
  moves: ManagerClubRosterMove[];
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
  freeAgents?: Player[];
  freeAgentAvailableOn?: Record<string, string>;
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

export const MANAGER_BENCHED_RELEASE_DAYS = 90;

function managerDateAfterDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function managerBenchedPlayerReleaseOn(move: ManagerClubRosterMove) {
  return managerDateAfterDays(move.completedOn, MANAGER_BENCHED_RELEASE_DAYS);
}

function activeManagerBenchedMoves(rosterMoves: ManagerClubRosterMove[]) {
  const latestPlayerState = new Map<string, { index: number; state: "benched" | "acquired" | "moved" }>();
  rosterMoves.forEach((move, index) => {
    latestPlayerState.set(move.releasedPlayerId, {
      index,
      state: move.releasedToTransferList ? "benched" : "moved",
    });
    latestPlayerState.set(move.acquiredPlayer.id, { index, state: "acquired" });
  });
  return rosterMoves.filter((move, index) => {
    const latest = latestPlayerState.get(move.releasedPlayerId);
    return Boolean(
      move.releasedToTransferList
      && move.releasedPlayer
      && latest?.index === index
      && latest.state === "benched",
    );
  });
}

export function createManagerAiTransferActivity({
  seed,
  rosters,
  fromDate,
  toDate,
  existingMoves = [],
  freeAgents = [],
  freeAgentAvailableOn = {},
  excludedOrganizationId,
  excludedOrganizationName = "",
  recentPerformance = [],
}: ManagerAiTransferOptions): ManagerAiTransferActivity[] {
  if (toDate <= fromDate) return [];
  const excludedName = excludedOrganizationName.trim().toLowerCase();
  const usedPlayerIds = new Set<string>();
  existingMoves.forEach((move) => {
    usedPlayerIds.add(move.releasedPlayerId);
    usedPlayerIds.add(move.acquiredPlayer.id);
    if (move.releasedToTransferList) usedPlayerIds.delete(move.releasedPlayerId);
  });
  const existingMoveIds = new Set(existingMoves.map((move) => move.id));
  let world = rosters.filter((roster) => (
    roster.players.length >= 5
    && roster.id !== excludedOrganizationId
    && roster.name.trim().toLowerCase() !== excludedName
  ));
  const rosteredPlayerIds = new Set(world.flatMap((roster) => roster.players.map((player) => player.id)));
  const performanceByPlayer = new Map(recentPerformance.map((item) => [`${item.teamId}:${item.playerId}`, item]));

  return monthlyTransferDates(fromDate, toDate).flatMap((date) => {
    const freeAgentSignings = world.flatMap((team) => {
      const teamCeiling = Math.max(...team.players.map((player) => player.ovr));
      const teamAverage = team.players.reduce((sum, player) => sum + player.ovr, 0) / team.players.length;
      const recruitmentReach = (team.rank ?? 64) <= 10 ? 9 : (team.rank ?? 64) <= 20 ? 7 : (team.rank ?? 64) <= 35 ? 5 : 3;
      return team.players.flatMap((releasedPlayer) => {
        const pressure = managerRosterChangePressure(
          seed,
          date,
          team,
          releasedPlayer,
          performanceByPlayer.get(`${team.id}:${releasedPlayer.id}`),
        );
        if (pressure <= 0 || usedPlayerIds.has(releasedPlayer.id)) return [];
        return freeAgents
          .filter((freeAgent) => (
            freeAgent.role === releasedPlayer.role
            && !usedPlayerIds.has(freeAgent.id)
            && !rosteredPlayerIds.has(freeAgent.id)
            && (!freeAgentAvailableOn[freeAgent.id] || freeAgentAvailableOn[freeAgent.id] <= date)
            && freeAgent.ovr >= releasedPlayer.ovr - 2
            && freeAgent.ovr <= teamCeiling + 5
            && freeAgent.ovr <= teamAverage + recruitmentReach
            && ((team.rank ?? 64) > 10 || freeAgent.ovr >= releasedPlayer.ovr)
          ))
          .map((freeAgent) => ({
            team,
            releasedPlayer,
            freeAgent,
            pressure,
            score: pressure + (freeAgent.ovr - releasedPlayer.ovr) * 14,
          }));
      });
    }).sort((left, right) => (
      right.score - left.score
      || stableHash(`${seed}:${date}:${left.team.id}:${left.releasedPlayer.id}:${left.freeAgent.id}`)
      - stableHash(`${seed}:${date}:${right.team.id}:${right.releasedPlayer.id}:${right.freeAgent.id}`)
    ));
    const signing = freeAgentSignings[0];
    if (signing) {
      const activityId = `${seed}:ai-free-agent:${date}:${signing.team.id}:${signing.freeAgent.id}`;
      const move: ManagerClubRosterMove = {
        id: `${activityId}:${signing.team.id}`,
        clubId: signing.team.id,
        clubName: signing.team.name,
        releasedPlayerId: signing.releasedPlayer.id,
        acquiredPlayer: signing.freeAgent,
        completedOn: date,
        transactionType: "free-agent-signing",
        releasedPlayer: signing.releasedPlayer,
        releasedToTransferList: true,
      };
      if (existingMoveIds.has(move.id)) return [];

      usedPlayerIds.add(signing.releasedPlayer.id);
      usedPlayerIds.add(signing.freeAgent.id);
      rosteredPlayerIds.delete(signing.releasedPlayer.id);
      rosteredPlayerIds.add(signing.freeAgent.id);
      existingMoveIds.add(move.id);
      world = applyManagerRosterMoves(world, [move]);
      return [{
        id: activityId,
        date,
        moves: [move],
        headline: `${signing.team.name} signs ${signing.freeAgent.handle}`,
        body: `${signing.freeAgent.handle} joins as a free agent and takes the ${signing.releasedPlayer.role} spot. ${signing.releasedPlayer.handle} has been benched and placed on the priority transfer list.`,
      }];
    }

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
    const moves: ManagerClubRosterMove[] = [
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

const REAL_FREE_AGENT_SOURCE = {
  tag: "FA",
  name: "Free Agents",
  country: "INT",
  era: "CS2" as const,
  year: "2026",
  accent: "#48d7b2",
};

type RealFreeAgent = {
  previousTeam: string;
  player: Omit<Player, "ovr" | "potential" | "potentialModelVersion">;
};

function benchedFreeAgent(
  handle: string,
  realName: string,
  country: string,
  previousTeam: string,
  role: Role,
  style: Player["style"],
  hltvRating: number,
  hltvMaps: number,
  age: number,
): RealFreeAgent {
  const base = Math.max(62, Math.min(90, Math.round(74 + (hltvRating - 1) * 90)));
  const maps = {
    mirage: base,
    inferno: Math.max(58, base - 1),
    nuke: Math.max(58, base - 2),
    ancient: Math.max(58, base - 1),
    anubis: Math.max(58, base - 2),
    dust2: Math.min(94, base + 1),
    train: Math.max(58, base - 3),
  };
  return {
    previousTeam,
    player: {
      id: `manager-fa-real-${handle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`,
      handle,
      realName,
      country,
      role,
      style,
      traits: role === "AWP"
        ? ["Sniper", "Clutch", "Free transfer"]
        : role === "IGL"
          ? ["Caller", "Leadership", "Free transfer"]
          : role === "Entry"
            ? ["Entry", "Trade", "Free transfer"]
            : ["Aim", "Trade", "Free transfer"],
      stats: {
        aim: Math.min(96, base + (role === "Entry" || role === "Rifler" || role === "Lurker" ? 4 : 1)),
        clutch: Math.min(94, base + (role === "Lurker" || role === "AWP" ? 3 : 0)),
        consistency: Math.max(58, base - (style === "Aggressive" ? 2 : 0)),
        awp: role === "AWP" ? Math.min(96, base + 8) : Math.max(44, base - 14),
        igl: role === "IGL" ? Math.min(94, base + 8) : Math.max(42, base - 18),
      },
      hltvRating,
      hltvMaps,
      age,
      source: { ...REAL_FREE_AGENT_SOURCE, country },
      maps,
    },
  };
}

const REAL_FREE_AGENTS: RealFreeAgent[] = [
  {
    previousTeam: "Falcons",
    player: {
      id: "manager-fa-real-dupreeh",
      handle: "dupreeh",
      realName: "Peter Rasmussen",
      country: "DK",
      role: "Entry",
      style: "Aggressive",
      traits: ["Entry", "Trade", "Major winner"],
      stats: { aim: 80, clutch: 81, consistency: 82, awp: 63, igl: 69 },
      hltvRating: 1.07,
      hltvMaps: 2303,
      age: 33,
      source: { ...REAL_FREE_AGENT_SOURCE, country: "DK" },
      maps: { mirage: 80, inferno: 84, nuke: 86, ancient: 78, anubis: 77, dust2: 82, train: 84 },
    },
  },
  {
    previousTeam: "Falcons",
    player: {
      id: "manager-fa-real-degster",
      handle: "degster",
      realName: "Abdul Gasanov",
      country: "RU",
      role: "AWP",
      style: "Aggressive",
      traits: ["Sniper", "Opening", "Firepower"],
      stats: { aim: 83, clutch: 81, consistency: 78, awp: 86, igl: 52 },
      hltvRating: 1.08,
      hltvMaps: 1019,
      age: 25,
      source: { ...REAL_FREE_AGENT_SOURCE, country: "RU" },
      maps: { mirage: 85, inferno: 79, nuke: 82, ancient: 80, anubis: 83, dust2: 85, train: 77 },
    },
  },
  {
    previousTeam: "Natus Vincere",
    player: {
      id: "manager-fa-real-jl",
      handle: "jL",
      realName: "Justinas Lekavicius",
      country: "LT",
      role: "Rifler",
      secondaryRole: "Entry",
      style: "Aggressive",
      traits: ["Aim", "Trade", "Major MVP"],
      stats: { aim: 86, clutch: 87, consistency: 85, awp: 56, igl: 67 },
      hltvRating: 1.11,
      hltvMaps: 958,
      age: 26,
      source: { ...REAL_FREE_AGENT_SOURCE, country: "LT" },
      maps: { mirage: 88, inferno: 84, nuke: 87, ancient: 86, anubis: 88, dust2: 85, train: 82 },
    },
  },
  {
    previousTeam: "Cloud9",
    player: {
      id: "manager-fa-real-skadoodle",
      handle: "Skadoodle",
      realName: "Tyler Latham",
      country: "US",
      role: "AWP",
      style: "Passive",
      traits: ["Sniper", "Clutch", "Major winner"],
      stats: { aim: 68, clutch: 73, consistency: 67, awp: 72, igl: 48 },
      hltvRating: 0.98,
      hltvMaps: 1085,
      age: 33,
      source: { ...REAL_FREE_AGENT_SOURCE, country: "US" },
      maps: { mirage: 72, inferno: 67, nuke: 69, ancient: 62, anubis: 62, dust2: 75, train: 74 },
    },
  },
  benchedFreeAgent("lauNX", "Laurențiu Țârlea", "RO", "FUT", "Entry", "Aggressive", 1.10, 214, 21),
  benchedFreeAgent("broky", "Helvijs Saukants", "LV", "FaZe", "AWP", "Passive", 1.11, 1182, 25),
  benchedFreeAgent("MAJ3R", "Engin Küpeli", "TR", "Aurora", "IGL", "Balanced", 0.89, 249, 35),
  benchedFreeAgent("HooXi", "Rasmus Nielsen", "DK", "G2", "IGL", "Balanced", 0.88, 1050, 31),
  benchedFreeAgent("gla1ve", "Lukas Rossander", "DK", "ENCE", "IGL", "Balanced", 0.97, 1900, 31),
  benchedFreeAgent("soulfly", "Caner Kesici", "TR", "Aurora", "Entry", "Aggressive", 1.01, 111, 22),
  benchedFreeAgent("SunPayus", "Álvaro García", "ES", "G2", "AWP", "Passive", 1.05, 215, 27),
  benchedFreeAgent("cobrazera", "Anarbileg Uuganbayar", "MN", "The MongolZ", "Rifler", "Balanced", 1.02, 96, 20),
  benchedFreeAgent("nota", "Emil Moskvitin", "RU", "PARIVISION", "Support", "Balanced", 1.04, 447, 19),
  benchedFreeAgent("urban0", "Lucas Urbano", "BR", "9z", "Support", "Balanced", 1.00, 109, 23),
  benchedFreeAgent("DANK1NG", "Zhenghao Lv", "CN", "TYLOO", "AWP", "Aggressive", 1.00, 343, 25),
  benchedFreeAgent("Krimbo", "Karim Moussa", "DE", "BIG", "Lurker", "Balanced", 1.00, 789, 23),
  benchedFreeAgent("skullz", "Felipe Medeiros", "BR", "Imperial", "Support", "Balanced", 1.01, 110, 24),
  benchedFreeAgent("levi", "Guilherme Gustavo", "BR", "Imperial", "Rifler", "Aggressive", 1.00, 81, 21),
  benchedFreeAgent("Lucaozy", "Lucas Neves", "BR", "Fluxo", "Entry", "Aggressive", 1.03, 195, 24),
  benchedFreeAgent("Ag1l", "André Gil", "PT", "100 Thieves", "Support", "Balanced", 1.05, 115, 22),
  benchedFreeAgent("jkaem", "Joakim Myrbostad", "NO", "BC.Game", "Entry", "Aggressive", 1.03, 177, 32),
  benchedFreeAgent("aragornN", "António Barbosa", "PT", "BC.Game", "Support", "Balanced", 0.87, 44, 23),
  benchedFreeAgent("yxngstxr", "Simon Boije", "SE", "HEROIC", "Rifler", "Balanced", 0.99, 289, 21),
];

export function createManagerFreeAgentPool(
  seed: string,
  count?: number,
  salaryContext: ManagerSalaryContext = {},
): ManagerMarketCandidate[] {
  const candidates = REAL_FREE_AGENTS.map(({ player: sourcePlayer, previousTeam }) => {
    const ovr = rateStatsForRole(sourcePlayer.stats, sourcePlayer.role);
    const player: Player = {
      ...sourcePlayer,
      ovr,
      ...careerMetaForPlayer({ ovr, age: sourcePlayer.age }, 0),
    };
    return {
      id: player.id,
      kind: "free-agent" as const,
      player,
      previousTeam,
      askingSalary: managerRecommendedSalary(player, salaryContext),
      estimatedFee: 0,
      interest: Math.max(28, Math.min(92, 76 - player.ovr + (player.potential ?? player.ovr) - player.ovr + stableHash(`${seed}:${player.id}:interest`) % 28)),
    };
  });
  return count == null ? candidates : candidates.slice(0, Math.max(0, count));
}

export function createManagerReleasedFreeAgentPool(
  seed: string,
  rosterMoves: ManagerClubRosterMove[],
  currentDate: string,
  salaryContext: ManagerSalaryContext = {},
): ManagerMarketCandidate[] {
  return activeManagerBenchedMoves(rosterMoves)
    .filter((move) => managerBenchedPlayerReleaseOn(move) <= currentDate)
    .map((move) => {
      const player = move.releasedPlayer!;
      const availableOn = managerBenchedPlayerReleaseOn(move);
      return {
        id: player.id,
        kind: "free-agent" as const,
        player,
        previousTeam: move.clubName,
        askingSalary: managerRecommendedSalary(player, salaryContext),
        estimatedFee: 0,
        interest: Math.max(34, Math.min(95, 84 - player.ovr + stableHash(`${seed}:${player.id}:released-interest`) % 34)),
        availableOn,
        listingReason: `${move.clubName} released the player after ${MANAGER_BENCHED_RELEASE_DAYS} days on the transfer list.`,
      };
    })
    .sort((left, right) => right.availableOn.localeCompare(left.availableOn)
      || left.player.handle.localeCompare(right.player.handle));
}

export function createManagerTransferList(
  seed: string,
  rosters: Roster[],
  excludedOrganizationId: string,
  count?: number,
  salaryContext: ManagerSalaryContext = {},
  recentPerformance: ManagerRecentPlayerPerformance[] = [],
  rosterMoves: ManagerClubRosterMove[] = [],
  currentDate?: string,
): ManagerMarketCandidate[] {
  const performanceByPlayer = new Map(recentPerformance.map((item) => [`${item.teamId}:${item.playerId}`, item]));
  const priorityCandidates = activeManagerBenchedMoves(rosterMoves)
    .reverse()
    .filter((move) => (
      move.clubId !== excludedOrganizationId
      && (!currentDate || currentDate < managerBenchedPlayerReleaseOn(move))
    ))
    .map((move): ManagerMarketCandidate | undefined => {
      const team = rosters.find((roster) => roster.id === move.clubId);
      const player = move.releasedPlayer;
      if (!team || !player) return undefined;
      const estimatedFee = Math.max(
        25_000,
        Math.round(managerEstimatedTransferFee(player, team.rank, true) * 0.82 / 5_000) * 5_000,
      );
      return {
        id: player.id,
        kind: "transfer-listed",
        player,
        currentTeam: team,
        previousTeam: team.name,
        askingSalary: managerRecommendedSalary(player, {
          ...salaryContext,
          vrsRank: team.rank ?? salaryContext.vrsRank,
          organizationCountry: team.country ?? salaryContext.organizationCountry,
        }),
        estimatedFee,
        interest: Math.max(36, Math.min(94, 82 - player.ovr + stableHash(`${seed}:${player.id}:priority-interest`) % 34)),
        priority: true,
        listingReason: `Benched after ${team.name} signed a free agent; the club is actively trying to sell.`,
      };
    })
    .filter((candidate): candidate is ManagerMarketCandidate => Boolean(candidate))
    .filter((candidate, index, candidates) => candidates.findIndex((item) => item.id === candidate.id) === index);
  const organicCandidates = rosters
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
  const candidates = [...priorityCandidates, ...organicCandidates]
    .filter((candidate, index, entries) => entries.findIndex((item) => item.id === candidate.id) === index);
  return count == null ? candidates : candidates.slice(0, Math.max(0, count));
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
