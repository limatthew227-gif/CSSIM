import {
  Coach,
  CustomSettings,
  Difficulty,
  MapId,
  Player,
  Role,
  Roster,
  mapPool,
} from "./gameData";
import { hltvPlayerSplits2026 } from "./hltvPlayerSplits2026";
import { hltvPlayerPlayoffs2026 } from "./hltvPlayerPlayoffs2026";

export interface BonusLine {
  label: string;
  value: number;
  tone: "good" | "bad" | "neutral";
}

export interface StrengthBreakdown {
  average: number;
  composition: number;
  coach: number;
  difficulty: number;
  total: number;
}

export interface FieldTeam {
  id: string;
  tag: string;
  name: string;
  country: string;
  era: string;
  year: string;
  accent: string;
  logo?: string;
  players: Player[];
  coach?: Coach;
  rank?: number;
}

export type MatchStageContext = "swiss" | "quarterfinal" | "semifinal" | "final";

export interface MatchContext {
  map: MapId;
  stage?: MatchStageContext;
}

export interface VetoState {
  bestOf: number;
  available: MapId[];
  banned: Partial<Record<MapId, "you" | "opponent">>;
  picked: Partial<Record<MapId, "you" | "opponent" | "decider">>;
  selected: MapId[];
  log: string[];
  decider?: MapId;
  ready: boolean;
  prompt: string;
  pendingOpponent?: {
    action: "ban" | "pick";
    map: MapId;
  };
}

export interface PlayerLine {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  adr: number;
  kastRounds: number;
  rounds: number;
  impact: number;
  firstKills: number;
  firstDeaths: number;
  multiKills: number;
  clutchWins: number;
  rating: number;
}

export type MatchSide = "CT" | "T";
export type SideStats = Record<MatchSide, Record<string, PlayerLine>>;

export interface FeedLine {
  round: number;
  killer: string;
  killerId: string;
  victim: string;
  victimId: string;
  weapon: string;
  team: "you" | "opponent" | "neutral";
  first: boolean;
  type?: "kill" | "plant" | "defuse" | "explode" | "round_start" | "round_over";
  assistant?: string;
  assistantId?: string;
  killerDamage?: number;
  assistantDamage?: number;
  ctAlive?: number;
  tAlive?: number;
  tScore?: number;
  ctScore?: number;
  reason?: string;
  isHeadshot?: boolean;
}

export interface MatchState {
  map: MapId;
  context: MatchContext;
  round: number;
  you: number;
  opponent: number;
  side: "CT" | "T";
  economy: "ECO" | "FORCE" | "FULL";
  opponentEconomy: "ECO" | "FORCE" | "FULL";
  feed: FeedLine[];
  yourStats: Record<string, PlayerLine>;
  opponentStats: Record<string, PlayerLine>;
  yourSideStats: SideStats;
  opponentSideStats: SideStats;
  roundWinners: Array<"you" | "opponent">;
  running: boolean;
  ended: boolean;
  winner?: "you" | "opponent";
  lastReason?: string;
  yourMoney?: Record<string, number>;
  opponentMoney?: Record<string, number>;
  yourLossStreak?: number;
  opponentLossStreak?: number;
  yourWeapons?: Record<string, string>;
  opponentWeapons?: Record<string, string>;
  yourArmor?: Record<string, "none" | "kevlar" | "helmet">;
  opponentArmor?: Record<string, "none" | "kevlar" | "helmet">;
  // Streaming fields:
  pendingEvents?: FeedLine[];
  pendingRoundWinner?: "you" | "opponent";
  pendingRoundReason?: string;
  pendingYourMoney?: Record<string, number>;
  pendingOpponentMoney?: Record<string, number>;
  pendingYourLossStreak?: number;
  pendingOpponentLossStreak?: number;
  pendingYourWeapons?: Record<string, string>;
  pendingOpponentWeapons?: Record<string, string>;
  pendingYourArmor?: Record<string, "none" | "kevlar" | "helmet">;
  pendingOpponentArmor?: Record<string, "none" | "kevlar" | "helmet">;
  savedYourStats?: Record<string, PlayerLine>;
  savedOpponentStats?: Record<string, PlayerLine>;
  savedYourSideStats?: SideStats;
  savedOpponentSideStats?: SideStats;
  pendingYourStatsPatch?: Record<string, PlayerLine>;
  pendingOpponentStatsPatch?: Record<string, PlayerLine>;
}

export const requiredRoles: Role[] = ["IGL", "AWP", "Entry", "Support"];

export function toFieldTeam(roster: Roster): FieldTeam {
  return {
    id: roster.id,
    tag: roster.tag,
    name: roster.name,
    country: roster.country,
    era: roster.era,
    year: roster.year,
    accent: roster.accent,
    logo: roster.logo,
    players: roster.players,
    rank: roster.rank,
  };
}

export function draftedTeam(name: string, players: Player[], coach?: Coach): FieldTeam {
  return {
    id: "user",
    tag: initials(name),
    name,
    country: "DR",
    era: "Dream Team",
    year: "Custom",
    accent: "#65a7ff",
    players,
    coach,
  };
}

export function initials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return letters || "YOU";
}

export function averageOvr(players: Player[]) {
  if (!players.length) return 0;
  return players.reduce((sum, player) => sum + player.ovr, 0) / players.length;
}

export function composition(players: Player[], settings: CustomSettings, isUserTeam = false): BonusLine[] {
  const roles = new Set(players.map((player) => player.role));
  const bonuses: BonusLine[] = [];

  requiredRoles.forEach((role) => {
    if (roles.has(role)) {
      const value = role === "IGL" ? 0.85 : role === "AWP" ? 0.75 : 0.45;
      bonuses.push({ label: `${role} covered`, value, tone: "good" });
    } else {
      if (role !== "Support" || isUserTeam) {
        const value = role === "IGL" || role === "AWP" ? -settings.rolePenalty * 0.22 : -settings.rolePenalty * 0.12;
        bonuses.push({ label: `Missing ${role}`, value, tone: "bad" });
      }
    }
  });

  if (players.length >= 5) {
    const nonRiflers = players.filter(p => p.role !== "Rifler");
    const uniqueNonRiflers = new Set(nonRiflers.map(p => p.role));
    const isOverlapping = uniqueNonRiflers.size < nonRiflers.length;

    if (!isOverlapping) {
      bonuses.push({
        label: roles.size >= 5 ? "Five distinct jobs" : "Balanced roles",
        value: 0.8,
        tone: "good",
      });
    } else if (isUserTeam) {
      bonuses.push({
        label: "Role overlap",
        value: -0.7,
        tone: "bad",
      });
    }
  }

  const hltvCores = new Map<string, number>();
  players.forEach((player) => {
    if (!player.id.startsWith("hltv-")) return;
    hltvCores.set(player.source.name, (hltvCores.get(player.source.name) ?? 0) + 1);
  });
  const bestCore = Array.from(hltvCores.entries()).sort((a, b) => b[1] - a[1])[0];
  if (bestCore?.[1] >= 3) {
    bonuses.push({ label: `${bestCore[0]} core`, value: 10, tone: "good" });
  }

  const eraChemistry = eraChemistryValue(players, bestCore?.[1] ?? 0);
  if (players.length > 1 && eraChemistry > 0) {
    bonuses.push({ label: "Era chemistry", value: Number(eraChemistry.toFixed(1)), tone: "good" });
  }

  return bonuses;
}

function eraChemistryValue(players: Player[], bestCoreCount: number) {
  const eras = new Map<string, number>();
  players.forEach((player) => eras.set(player.source.era, (eras.get(player.source.era) ?? 0) + 1));
  const dominantEraCount = Math.max(0, ...Array.from(eras.values()));
  if (dominantEraCount < 3) return 0;

  const sameEraBase = dominantEraCount === players.length ? 0.22 : dominantEraCount * 0.04;
  const coreLift = bestCoreCount >= 5 ? 0.55 : bestCoreCount >= 3 ? 0.38 : 0;
  return Math.max(0.1, Math.min(0.8, sameEraBase + coreLift));
}

export function compositionScore(players: Player[], settings: CustomSettings, isUserTeam = false) {
  return composition(players, settings, isUserTeam).reduce((sum, bonus) => sum + bonus.value, 0);
}

export function teamStrengthBreakdown(team: FieldTeam, settings: CustomSettings, difficulty?: Difficulty, isOpponent = false): StrengthBreakdown {
  const average = averageOvr(team.players);
  const composition = compositionScore(team.players, settings, team.id === "user");
  const coachBoost = team.coach ? (team.coach.rating - 78) / 2.8 : 0;
  const diffBoost = isOpponent && difficulty ? difficulty.opponentBonus : 0;
  return {
    average,
    composition,
    coach: coachBoost,
    difficulty: diffBoost,
    total: average + composition + coachBoost + diffBoost,
  };
}

export function teamStrength(team: FieldTeam, settings: CustomSettings, difficulty?: Difficulty, isOpponent = false) {
  return teamStrengthBreakdown(team, settings, difficulty, isOpponent).total;
}

export function mapScore(team: FieldTeam, map: MapId, settings: CustomSettings) {
  const playerValue = team.players.reduce((sum, player) => sum + player.maps[map], 0) / Math.max(team.players.length, 1);
  const styleValue = team.players.reduce((sum, player) => {
    if (map === "dust2" && player.role === "AWP") return sum + 2;
    if (map === "inferno" && player.role === "Support") return sum + 1.5;
    if (map === "nuke" && player.role === "IGL") return sum + 1.5;
    if (map === "mirage" && player.role === "Entry") return sum + 1;
    if ((map === "ancient" || map === "anubis") && player.role === "Lurker") return sum + 1.35;
    return sum;
  }, 0);
  return (playerValue + styleValue) * settings.mapWeight;
}

export function mapEdge(you: FieldTeam, opponent: FieldTeam, map: MapId, settings: CustomSettings) {
  return (mapScore(you, map, settings) - mapScore(opponent, map, settings)) / 4;
}

export function createVeto(bestOf = 1): VetoState {
  return {
    bestOf,
    available: mapPool.map((map) => map.id),
    banned: {},
    picked: {},
    selected: [],
    log: [],
    ready: false,
    prompt: "Ban a map",
  };
}

export function applyUserBan(veto: VetoState, map: MapId, you: FieldTeam, opponent: FieldTeam, settings: CustomSettings) {
  if (veto.ready || veto.pendingOpponent || !veto.available.includes(map)) return veto;
  if (veto.bestOf >= 5) return applyMultiMapVeto(veto, map, you, opponent, settings, 5);
  if (veto.bestOf >= 3) return applyMultiMapVeto(veto, map, you, opponent, settings, 3);

  let next = banMap(veto, map, "you", `${you.name} banned ${mapName(map)}`);
  if (next.available.length > 1) {
    const opponentBan = opponentBanChoice(next.available, you, opponent, settings);
    return queueOpponentVeto(next, "ban", opponentBan, opponent.name);
  }
  return finishSingleMapVeto(next);
}

export function applyOpponentVeto(veto: VetoState, opponent: FieldTeam) {
  if (veto.ready || !veto.pendingOpponent) return veto;
  const { action, map } = veto.pendingOpponent;
  if (!veto.available.includes(map)) return { ...veto, pendingOpponent: undefined };

  const label = action === "pick" ? `${opponent.name} picked ${mapName(map)}` : `${opponent.name} banned ${mapName(map)}`;
  let next = action === "pick" ? pickMap(veto, map, "opponent", label) : banMap(veto, map, "opponent", label);
  next = { ...next, pendingOpponent: undefined };

  if (next.bestOf >= 5) return finishMultiMapOpponentStep(next, 5);
  if (next.bestOf >= 3) return finishMultiMapOpponentStep(next, 3);
  return finishSingleMapVeto(next);
}

function applyMultiMapVeto(
  veto: VetoState,
  map: MapId,
  you: FieldTeam,
  opponent: FieldTeam,
  settings: CustomSettings,
  targetMaps: 3 | 5,
) {
  const userPickCount = veto.selected.filter((id) => veto.picked[id] === "you").length;
  if (!Object.keys(veto.banned).length) {
    const next = banMap(veto, map, "you", `${you.name} banned ${mapName(map)}`);
    const opponentBan = opponentBanChoice(next.available, you, opponent, settings);
    return queueOpponentVeto(next, "ban", opponentBan, opponent.name);
  }

  if (userPickCount < Math.floor(targetMaps / 2)) {
    let next = pickMap(veto, map, "you", `${you.name} picked ${mapName(map)}`);
    if (next.selected.length < targetMaps - 1 && next.available.length > 1) {
      const opponentPick = opponentPickChoice(next.available, you, opponent, settings);
      return queueOpponentVeto(next, "pick", opponentPick, opponent.name);
    }
    if (next.selected.length >= targetMaps - 1 && next.available.length === 1) {
      return setDecider(next, next.available[0]);
    }
    return { ...next, prompt: userPickCount + 1 < Math.floor(targetMaps / 2) ? "Pick your map" : "Ban a map" };
  }

  let next = banMap(veto, map, "you", `${you.name} banned ${mapName(map)}`);
  if (next.available.length > 1) {
    const opponentBan = opponentBanChoice(next.available, you, opponent, settings);
    return queueOpponentVeto(next, "ban", opponentBan, opponent.name);
  }
  return setDecider(next, next.available[0]);
}

function queueOpponentVeto(veto: VetoState, action: "ban" | "pick", map: MapId, opponentName: string): VetoState {
  return {
    ...veto,
    pendingOpponent: { action, map },
    prompt: `${opponentName} is thinking...`,
  };
}

function finishSingleMapVeto(veto: VetoState): VetoState {
  if (veto.available.length !== 1) return { ...veto, prompt: "Ban a map" };
  const decider = veto.available[0];
  return {
    ...veto,
    decider,
    selected: [decider],
    picked: { ...veto.picked, [decider]: "decider" },
    ready: true,
    prompt: "Map decided",
    log: [...veto.log, `${mapName(decider)} is the decider`],
  };
}

function finishMultiMapOpponentStep(veto: VetoState, targetMaps: 3 | 5): VetoState {
  if (veto.selected.length >= targetMaps - 1 && veto.available.length === 1) {
    return setDecider(veto, veto.available[0]);
  }
  const userPickCount = veto.selected.filter((id) => veto.picked[id] === "you").length;
  return { ...veto, prompt: userPickCount < Math.floor(targetMaps / 2) ? "Pick your map" : "Ban a map" };
}

function banMap(veto: VetoState, map: MapId, owner: "you" | "opponent", label: string): VetoState {
  return {
    ...veto,
    available: veto.available.filter((id) => id !== map),
    banned: { ...veto.banned, [map]: owner },
    log: [...veto.log, label],
  };
}

function pickMap(veto: VetoState, map: MapId, owner: "you" | "opponent", label: string): VetoState {
  return {
    ...veto,
    available: veto.available.filter((id) => id !== map),
    picked: { ...veto.picked, [map]: owner },
    selected: [...veto.selected, map],
    log: [...veto.log, label],
  };
}

function setDecider(veto: VetoState, map: MapId): VetoState {
  return {
    ...veto,
    available: veto.available.filter((id) => id !== map),
    picked: { ...veto.picked, [map]: "decider" },
    selected: [...veto.selected, map],
    decider: map,
    ready: true,
    prompt: "Map set ready",
    log: [...veto.log, `${mapName(map)} is the decider`],
  };
}

function opponentBanChoice(available: MapId[], you: FieldTeam, opponent: FieldTeam, settings: CustomSettings) {
  return [...available].sort((a, b) => mapEdge(you, opponent, b, settings) - mapEdge(you, opponent, a, settings))[0];
}

function opponentPickChoice(available: MapId[], you: FieldTeam, opponent: FieldTeam, settings: CustomSettings) {
  return [...available].sort((a, b) => mapEdge(you, opponent, a, settings) - mapEdge(you, opponent, b, settings))[0];
}

export function mapName(map: MapId) {
  return mapPool.find((item) => item.id === map)?.name ?? map;
}

export function initMatch(map: MapId, you: FieldTeam, opponent: FieldTeam, context?: Omit<MatchContext, "map">): MatchState {
  const yourMoney: Record<string, number> = {};
  const opponentMoney: Record<string, number> = {};
  const yourWeapons: Record<string, string> = {};
  const opponentWeapons: Record<string, string> = {};

  const yourArmor: Record<string, "none" | "kevlar" | "helmet"> = {};
  const opponentArmor: Record<string, "none" | "kevlar" | "helmet"> = {};

  you.players.forEach((p) => {
    yourMoney[p.id] = 800;
    yourWeapons[p.id] = "USP-S"; // CT starts
    yourArmor[p.id] = "none";
  });
  opponent.players.forEach((p) => {
    opponentMoney[p.id] = 800;
    opponentWeapons[p.id] = "Glock-18"; // T starts
    opponentArmor[p.id] = "none";
  });

  return {
    map,
    context: { ...context, map },
    round: 1,
    you: 0,
    opponent: 0,
    side: "CT",
    economy: "ECO",
    opponentEconomy: "ECO",
    feed: [],
    yourStats: makeLines(you.players),
    opponentStats: makeLines(opponent.players),
    yourSideStats: makeSideLines(you.players),
    opponentSideStats: makeSideLines(opponent.players),
    roundWinners: [],
    running: true,
    ended: false,
    yourMoney,
    opponentMoney,
    yourLossStreak: 0,
    opponentLossStreak: 0,
    yourWeapons,
    opponentWeapons,
    yourArmor,
    opponentArmor,
  };
}

function makeSideLines(players: Player[]): SideStats {
  return {
    CT: makeLines(players),
    T: makeLines(players),
  };
}

function makeLines(players: Player[]) {
  return players.reduce(
    (acc, player) => {
      acc[player.id] = {
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        adr: 0,
        kastRounds: 0,
        rounds: 0,
        impact: 0,
        firstKills: 0,
        firstDeaths: 0,
        multiKills: 0,
        clutchWins: 0,
        rating: 1,
      };
      return acc;
    },
    {} as Record<string, PlayerLine>,
  );
}

export type Tactic = "standard" | "aggressive" | "cautious" | "force" | "save";

function getAutoBuyState(
  playersMoney: number[],
  side: MatchSide,
  lossStreak: number,
  wonPrevRound: boolean,
): "ECO" | "FORCE" | "FULL" {
  const avgMoney = playersMoney.reduce((sum, m) => sum + m, 0) / playersMoney.length;
  const fullBuyThreshold = side === "CT" ? 4700 : 4200;
  if (avgMoney >= fullBuyThreshold) {
    return "FULL";
  }
  if (wonPrevRound) {
    return "FORCE";
  }
  const lossBonus = 1400 + Math.min(lossStreak, 4) * 500;
  if (avgMoney + lossBonus >= fullBuyThreshold) {
    return "ECO";
  }
  return avgMoney >= 2000 ? "FORCE" : "ECO";
}

function spendMoney(
  money: Record<string, number>,
  players: Player[],
  side: MatchSide,
  buyState: "ECO" | "FORCE" | "FULL",
  carriedWeapons: Record<string, string>,
  carriedArmor: Record<string, "none" | "kevlar" | "helmet">,
): {
  nextMoney: Record<string, number>;
  finalWeapons: Record<string, string>;
  finalArmor: Record<string, "none" | "kevlar" | "helmet">;
} {
  const nextMoney = { ...money };
  const finalWeapons = { ...carriedWeapons };
  const finalArmor = { ...carriedArmor };
  const costs: Record<string, number> = {};

  players.forEach((p) => {
    const weapon = carriedWeapons[p.id] ?? (side === "CT" ? "USP-S" : "Glock-18");
    const hasRifle = weapon === "AK-47" || weapon === "M4A4" || weapon === "AWP" || weapon === "M4A1-S" || weapon === "M4A1";
    const hasSMG = weapon === "MP9" || weapon === "MAC-10" || weapon === "Famas" || weapon === "Galil AR" || weapon === "Galil";
    const playerMoney = nextMoney[p.id] ?? 800;

    if (buyState === "FULL") {
      const wantWeapon = p.role === "AWP" ? "AWP" : (side === "CT" ? "M4A4" : "AK-47");
      const weaponCost = p.role === "AWP" ? 4750 : (side === "CT" ? 2900 : 2700);
      const fullCost = p.role === "AWP" ? (side === "CT" ? 6950 : 6550) : (side === "CT" ? 4900 : 4500);
      const minCost = weaponCost + 1000; // Weapon + helmet

      if (hasRifle) {
        if (p.role === "AWP" && weapon !== "AWP") {
          // AWPer wants to upgrade from regular rifle to AWP
          if (playerMoney >= minCost) {
            costs[p.id] = Math.min(playerMoney, fullCost);
            finalWeapons[p.id] = "AWP";
            finalArmor[p.id] = "helmet";
          } else {
            costs[p.id] = fullCost;
            finalWeapons[p.id] = "AWP";
            finalArmor[p.id] = "helmet";
          }
        } else {
          // Keep current rifle
          costs[p.id] = 0;
          finalWeapons[p.id] = weapon;
        }
      } else if (hasSMG) {
        if (p.role === "AWP") {
          if (playerMoney >= minCost) {
            costs[p.id] = Math.min(playerMoney, fullCost);
            finalWeapons[p.id] = "AWP";
            finalArmor[p.id] = "helmet";
          } else {
            costs[p.id] = fullCost;
            finalWeapons[p.id] = "AWP";
            finalArmor[p.id] = "helmet";
          }
        } else {
          if (playerMoney >= fullCost) {
            costs[p.id] = fullCost;
            finalWeapons[p.id] = wantWeapon;
            finalArmor[p.id] = "helmet";
          } else {
            costs[p.id] = 0;
            finalWeapons[p.id] = weapon;
          }
        }
      } else {
        if (playerMoney >= minCost) {
          costs[p.id] = Math.min(playerMoney, fullCost);
          finalWeapons[p.id] = wantWeapon;
          finalArmor[p.id] = "helmet";
        } else {
          costs[p.id] = fullCost;
          finalWeapons[p.id] = wantWeapon;
          finalArmor[p.id] = "helmet";
        }
      }
    } else if (buyState === "FORCE") {
      if (p.role === "AWP") {
        if (weapon === "AWP") {
          costs[p.id] = 0;
          finalWeapons[p.id] = "AWP";
        } else if (playerMoney >= 5750) {
          costs[p.id] = 5750;
          finalWeapons[p.id] = "AWP";
          finalArmor[p.id] = "helmet";
        } else if (playerMoney >= 5400) {
          costs[p.id] = 5400;
          finalWeapons[p.id] = "AWP";
          finalArmor[p.id] = "kevlar";
        } else if (playerMoney >= 4750) {
          costs[p.id] = 4750;
          finalWeapons[p.id] = "AWP";
          finalArmor[p.id] = "none";
        } else if (hasRifle || hasSMG) {
          costs[p.id] = 0;
          finalWeapons[p.id] = weapon;
        } else {
          costs[p.id] = side === "CT" ? 2450 : 2350;
          finalWeapons[p.id] = Math.random() < 0.5 ? (side === "CT" ? "Famas" : "Galil AR") : (side === "CT" ? "MP9" : "MAC-10");
          finalArmor[p.id] = "kevlar";
        }
      } else if (hasRifle || hasSMG) {
        costs[p.id] = 0;
        finalWeapons[p.id] = weapon;
      } else {
        costs[p.id] = side === "CT" ? 2450 : 2350;
        finalWeapons[p.id] = Math.random() < 0.5 ? (side === "CT" ? "Famas" : "Galil AR") : (side === "CT" ? "MP9" : "MAC-10");
        finalArmor[p.id] = "kevlar";
      }
    } else {
      if (hasRifle || hasSMG) {
        costs[p.id] = 0;
        finalWeapons[p.id] = weapon;
      } else {
        if (playerMoney >= 1000) {
          costs[p.id] = 500;
          finalWeapons[p.id] = Math.random() < 0.35 ? "Desert Eagle" : "P250";
        } else {
          costs[p.id] = 0;
          finalWeapons[p.id] = weapon;
        }
      }
    }
  });

  if (buyState === "FULL") {
    const needy: { playerId: string; weaponCost: number; personalCost: number }[] = [];
    players.forEach((p) => {
      const currentVal = nextMoney[p.id] ?? 800;
      const totalCost = costs[p.id];
      if (totalCost > 0 && currentVal < totalCost) {
        const weaponCost = p.role === "AWP" ? 4750 : side === "CT" ? 2900 : 2700;
        const personalCost = totalCost - weaponCost;
        needy.push({ playerId: p.id, weaponCost, personalCost });
      }
    });

    // Sort needy list so that AWPer gets top priority, IGL gets lowest priority, and star players (OVR desc) get dropped first
    const needySorted = [...needy].sort((a, b) => {
      const playerA = players.find(p => p.id === a.playerId)!;
      const playerB = players.find(p => p.id === b.playerId)!;
      if (playerA.role === "AWP" && playerB.role !== "AWP") return -1;
      if (playerB.role === "AWP" && playerA.role !== "AWP") return 1;
      if (playerA.role === "IGL" && playerB.role !== "IGL") return 1;
      if (playerB.role === "IGL" && playerA.role !== "IGL") return -1;
      return playerB.ovr - playerA.ovr;
    });

    needySorted.forEach((n) => {
      // 1. Look for free droppers (who don't have to sacrifice their own buy)
      // Prefer IGL if they can afford it as a free dropper
      const iglFreeDropper = players.find((p) => {
        if (p.id === n.playerId) return false;
        if (p.role !== "IGL") return false;
        const currentVal = nextMoney[p.id] ?? 800;
        const selfCost = costs[p.id] ?? 0;
        return currentVal >= selfCost + n.weaponCost;
      });

      const otherFreeDropper = players.find((p) => {
        if (p.id === n.playerId) return false;
        if (p.role === "IGL") return false;
        const currentVal = nextMoney[p.id] ?? 800;
        const selfCost = costs[p.id] ?? 0;
        return currentVal >= selfCost + n.weaponCost;
      });

      let dropper = iglFreeDropper ?? otherFreeDropper;

      // 2. If no free dropper, and needy player is not IGL, check if IGL can sacrifice their buy to drop
      if (!dropper && n.playerId !== players.find(p => p.role === "IGL")?.id) {
        const igl = players.find(p => p.role === "IGL");
        if (igl) {
          const iglMoney = nextMoney[igl.id] ?? 800;
          if (iglMoney >= n.weaponCost) {
            dropper = igl;
            // The IGL is sacrificing their buy.
            // We set the IGL's own planned cost to 0 and their weapon/armor to default
            costs[igl.id] = 0;
            finalWeapons[igl.id] = side === "CT" ? "USP-S" : "Glock-18";
            finalArmor[igl.id] = "none";
          }
        }
      }

      if (dropper) {
        nextMoney[dropper.id] = (nextMoney[dropper.id] ?? 800) - n.weaponCost;
        const finalPersonalCost = Math.min(nextMoney[n.playerId] ?? 800, n.personalCost);
        nextMoney[n.playerId] = (nextMoney[n.playerId] ?? 800) - finalPersonalCost;
        costs[n.playerId] = 0;
        finalArmor[n.playerId] = "helmet";
      }
    });

    // Fallbacks for remaining needy players who did not get a drop
    players.forEach((p) => {
      const totalCost = costs[p.id] ?? 0;
      if (totalCost > 0) {
        const currentVal = nextMoney[p.id] ?? 800;
        if (currentVal < totalCost) {
          const wantWeapon = p.role === "AWP" ? "AWP" : (side === "CT" ? "M4A4" : "AK-47");
          const weaponCost = p.role === "AWP" ? 4750 : (side === "CT" ? 2900 : 2700);

          if (currentVal >= weaponCost + 1000) {
            costs[p.id] = weaponCost + 1000;
            finalWeapons[p.id] = wantWeapon;
            finalArmor[p.id] = "helmet";
          } else if (currentVal >= weaponCost + 650) {
            costs[p.id] = weaponCost + 650;
            finalWeapons[p.id] = wantWeapon;
            finalArmor[p.id] = "kevlar";
          } else if (currentVal >= weaponCost) {
            costs[p.id] = weaponCost;
            finalWeapons[p.id] = wantWeapon;
            finalArmor[p.id] = "none";
          } else {
            const forceCost = side === "CT" ? 2450 : 2350;
            if (currentVal >= forceCost) {
              costs[p.id] = forceCost;
              finalWeapons[p.id] = p.role === "AWP" && Math.random() < 0.5 ? (side === "CT" ? "Famas" : "Galil AR") : (side === "CT" ? "MP9" : "MAC-10");
              finalArmor[p.id] = "kevlar";
            } else {
              if (currentVal >= 1000) {
                costs[p.id] = 500;
                finalWeapons[p.id] = Math.random() < 0.35 ? "Desert Eagle" : "P250";
                finalArmor[p.id] = "none";
              } else {
                costs[p.id] = 0;
                finalWeapons[p.id] = side === "CT" ? "USP-S" : "Glock-18";
                finalArmor[p.id] = "none";
              }
            }
          }
        }
      }
    });

    // Post-drop force buy fallback for default sidearm/pistol players (like a sacrificing IGL)
    players.forEach((p) => {
      const weapon = finalWeapons[p.id] ?? (side === "CT" ? "USP-S" : "Glock-18");
      const isDefaultPistol = weapon === "USP-S" || weapon === "Glock-18";
      if (isDefaultPistol) {
        const remMoney = nextMoney[p.id] ?? 800;
        const mp9Mac10Cost = side === "CT" ? 1900 : 1700;
        if (remMoney >= mp9Mac10Cost) {
          nextMoney[p.id] = remMoney - mp9Mac10Cost;
          finalWeapons[p.id] = side === "CT" ? "MP9" : "MAC-10";
          finalArmor[p.id] = "kevlar";
        } else if (remMoney >= 1150) {
          nextMoney[p.id] = remMoney - 1150;
          finalWeapons[p.id] = Math.random() < 0.35 ? "Desert Eagle" : "P250";
          finalArmor[p.id] = "kevlar";
        } else if (remMoney >= 500) {
          nextMoney[p.id] = remMoney - 500;
          finalWeapons[p.id] = Math.random() < 0.35 ? "Desert Eagle" : "P250";
          finalArmor[p.id] = "none";
        }
      }
    });
  }

  players.forEach((p) => {
    const cost = costs[p.id] ?? 0;
    if (cost > 0) {
      const currentVal = nextMoney[p.id] ?? 800;
      if (currentVal >= cost) {
        nextMoney[p.id] = currentVal - cost;
      } else {
        if (buyState === "FORCE") {
          nextMoney[p.id] = 0;
        } else if (buyState === "ECO") {
          nextMoney[p.id] = Math.max(0, currentVal - cost);
        } else {
          nextMoney[p.id] = 0;
          finalWeapons[p.id] = side === "CT" ? "USP-S" : "Glock-18";
          finalArmor[p.id] = "none";
        }
      }
    }
  });

  return { nextMoney, finalWeapons, finalArmor };
}

function getEquippedWeapon(player: Player, side: MatchSide, buyState: "ECO" | "FORCE" | "FULL"): string {
  if (buyState === "FULL") {
    if (player.role === "AWP") return "AWP";
    return side === "CT" ? "M4A4" : "AK-47";
  } else if (buyState === "FORCE") {
    if (player.role === "AWP" && Math.random() < 0.5) return side === "CT" ? "Famas" : "Galil AR";
    return side === "CT" ? "MP9" : "MAC-10";
  } else {
    if (side === "CT") {
      return Math.random() < 0.25 ? "Desert Eagle" : "USP-S";
    } else {
      return Math.random() < 0.25 ? "Desert Eagle" : "Glock-18";
    }
  }
}

function otherMatchSide(side: MatchSide): MatchSide {
  return side === "CT" ? "T" : "CT";
}

function economyValue(economy: MatchState["economy"]) {
  if (economy === "FULL") return 0.035;
  if (economy === "FORCE") return -0.005;
  return -0.055;
}

type ArmorState = "none" | "kevlar" | "helmet";

interface LoadoutProfile {
  buyState: MatchState["economy"];
  primaryWeapons: number;
  midWeapons: number;
  upgradedPistols: number;
  armor: number;
  nakedEco: boolean;
}

function loadoutProfile(
  players: Player[],
  buyState: MatchState["economy"],
  weapons: Record<string, string>,
  armor: Record<string, ArmorState>,
): LoadoutProfile {
  let primaryWeapons = 0;
  let midWeapons = 0;
  let upgradedPistols = 0;
  let armorCount = 0;

  players.forEach((player) => {
    const weapon = weapons[player.id] ?? "";
    if (weapon === "AK-47" || weapon === "M4A4" || weapon === "M4A1-S" || weapon === "M4A1" || weapon === "AWP") {
      primaryWeapons += 1;
    } else if (weapon === "Galil AR" || weapon === "Galil" || weapon === "Famas" || weapon === "MP9" || weapon === "MAC-10") {
      midWeapons += 1;
    } else if (weapon === "Desert Eagle" || weapon === "P250") {
      upgradedPistols += 1;
    }
    if ((armor[player.id] ?? "none") !== "none") armorCount += 1;
  });

  return {
    buyState,
    primaryWeapons,
    midWeapons,
    upgradedPistols,
    armor: armorCount,
    nakedEco: buyState === "ECO" && primaryWeapons === 0 && midWeapons === 0 && upgradedPistols === 0 && armorCount === 0,
  };
}

function hasRealFullBuy(profile: LoadoutProfile) {
  return profile.buyState === "FULL" && profile.primaryWeapons >= 3 && profile.armor >= 3;
}

function ecoUpsetCap(ecoProfile: LoadoutProfile, fullProfile: LoadoutProfile, strengthAdvantage: number) {
  if (ecoProfile.buyState !== "ECO" || !hasRealFullBuy(fullProfile)) return undefined;
  if (strengthAdvantage >= 20) return clamp(0.18 + (strengthAdvantage - 20) * 0.004, 0.18, 0.3);

  const advantageLift = Math.max(0, strengthAdvantage) * 0.003;
  if (ecoProfile.nakedEco) return clamp(0.035 + advantageLift, 0.025, 0.095);
  if (ecoProfile.primaryWeapons > 0 || ecoProfile.midWeapons > 0) return clamp(0.12 + advantageLift, 0.1, 0.18);
  return clamp(0.07 + advantageLift + ecoProfile.upgradedPistols * 0.006 + ecoProfile.armor * 0.004, 0.055, 0.15);
}

function applyEcoUpsetCaps(
  probability: number,
  yourProfile: LoadoutProfile,
  opponentProfile: LoadoutProfile,
  yourStrength: number,
  opponentStrength: number,
) {
  const yourEcoCap = ecoUpsetCap(yourProfile, opponentProfile, yourStrength - opponentStrength);
  if (yourEcoCap !== undefined) probability = Math.min(probability, yourEcoCap);

  const opponentEcoCap = ecoUpsetCap(opponentProfile, yourProfile, opponentStrength - yourStrength);
  if (opponentEcoCap !== undefined) probability = Math.max(probability, 1 - opponentEcoCap);

  return probability;
}

function matchWinThreshold(round: number) {
  if (round < 25) return 13;
  const overtimeNumber = Math.floor((round - 25) / 6) + 1;
  return 13 + overtimeNumber * 3;
}

function isMatchOver(youScore: number, opponentScore: number, round: number) {
  const threshold = matchWinThreshold(round);
  return (youScore >= threshold || opponentScore >= threshold) && Math.abs(youScore - opponentScore) >= 2;
}

function nextSideAfterRound(currentSide: MatchSide, nextRound: number) {
  if (nextRound === 13) return otherMatchSide(currentSide);
  if (nextRound > 24) {
    const overtimeRound = nextRound - 24;
    if (overtimeRound > 1 && overtimeRound % 3 === 1) return otherMatchSide(currentSide);
  }
  return currentSide;
}

function isFreshHalfBuy(nextRound: number) {
  return nextRound === 13 || (nextRound >= 25 && (nextRound - 25) % 3 === 0);
}

export function playRound(
  state: MatchState,
  you: FieldTeam,
  opponent: FieldTeam,
  settings: CustomSettings,
  difficulty: Difficulty,
  tactic: Tactic,
  timeoutBoost: number,
  instant = false,
) {
  if (state.ended) return state;

  // Flush pending events instantly if we are mid-round but need instant completion
  if (instant && state.pendingEvents && state.pendingEvents.length > 0) {
    let yourStats = { ...state.savedYourStats! };
    let opponentStats = { ...state.savedOpponentStats! };
    let yourSideStats = { ...state.savedYourSideStats! };
    let opponentSideStats = { ...state.savedOpponentSideStats! };

    yourStats = applyStatPatch(yourStats, state.pendingYourStatsPatch!);
    opponentStats = applyStatPatch(opponentStats, state.pendingOpponentStatsPatch!);
    const opponentSide = otherMatchSide(state.side);
    yourSideStats = {
      ...yourSideStats,
      [state.side]: applyStatPatch(yourSideStats[state.side], state.pendingYourStatsPatch!),
    };
    opponentSideStats = {
      ...opponentSideStats,
      [opponentSide]: applyStatPatch(opponentSideStats[opponentSide], state.pendingOpponentStatsPatch!),
    };

    const youScore = state.you + (state.pendingRoundWinner === "you" ? 1 : 0);
    const opponentScore = state.opponent + (state.pendingRoundWinner === "opponent" ? 1 : 0);
    const nextRound = state.round + 1;
    const ended = isMatchOver(youScore, opponentScore, state.round);
    const nextSide = nextSideAfterRound(state.side, nextRound);

    let nextEconomyState: "ECO" | "FORCE" | "FULL";
    let nextOpponentEconomyState: "ECO" | "FORCE" | "FULL";

    if (isFreshHalfBuy(nextRound)) {
      nextEconomyState = nextRound === 13 ? "ECO" : "FULL";
      nextOpponentEconomyState = nextRound === 13 ? "ECO" : "FULL";
    } else {
      nextEconomyState = getAutoBuyState(
        you.players.map((p) => state.pendingYourMoney?.[p.id] ?? 800),
        nextSide,
        state.pendingYourLossStreak ?? 0,
        state.pendingRoundWinner === "you",
      );
      nextOpponentEconomyState = getAutoBuyState(
        opponent.players.map((p) => state.pendingOpponentMoney?.[p.id] ?? 800),
        otherMatchSide(nextSide),
        state.pendingOpponentLossStreak ?? 0,
        state.pendingRoundWinner === "opponent",
      );
    }

    state = {
      ...state,
      round: nextRound,
      you: youScore,
      opponent: opponentScore,
      economy: nextEconomyState,
      opponentEconomy: nextOpponentEconomyState,
      side: nextSide,
      feed: [...[...state.pendingEvents].reverse(), ...state.feed].slice(0, 60),
      yourStats,
      opponentStats,
      yourSideStats,
      opponentSideStats,
      roundWinners: [...state.roundWinners, state.pendingRoundWinner!],
      running: !ended,
      ended,
      winner: ended ? (youScore > opponentScore ? ("you" as "you" | "opponent") : ("opponent" as "you" | "opponent")) : undefined,
      lastReason: state.pendingRoundReason,
      yourMoney: state.pendingYourMoney,
      opponentMoney: state.pendingOpponentMoney,
      yourLossStreak: state.pendingYourLossStreak,
      opponentLossStreak: state.pendingOpponentLossStreak,
      yourWeapons: state.pendingYourWeapons,
      opponentWeapons: state.pendingOpponentWeapons,
      yourArmor: state.pendingYourArmor,
      opponentArmor: state.pendingOpponentArmor,
      pendingEvents: undefined,
      pendingRoundWinner: undefined,
      pendingRoundReason: undefined,
      pendingYourMoney: undefined,
      pendingOpponentMoney: undefined,
      pendingYourLossStreak: undefined,
      pendingOpponentLossStreak: undefined,
      pendingYourWeapons: undefined,
      pendingOpponentWeapons: undefined,
      pendingYourArmor: undefined,
      pendingOpponentArmor: undefined,
      savedYourStats: undefined,
      savedOpponentStats: undefined,
      savedYourSideStats: undefined,
      savedOpponentSideStats: undefined,
      pendingYourStatsPatch: undefined,
      pendingOpponentStatsPatch: undefined,
    };

    if (ended) return state;
  }

  // If streaming events
  if (!instant && state.pendingEvents && state.pendingEvents.length > 0) {
    const event = state.pendingEvents[0];
    const nextPending = state.pendingEvents.slice(1);
    const nextFeed = [event, ...state.feed].slice(0, 60);

    let yourStats = cloneStats(state.yourStats);
    let opponentStats = cloneStats(state.opponentStats);
    let yourSideStats = cloneSideStats(state.yourSideStats);
    let opponentSideStats = cloneSideStats(state.opponentSideStats);
    let yourMoney = state.yourMoney ? { ...state.yourMoney } : {};
    let opponentMoney = state.opponentMoney ? { ...state.opponentMoney } : {};
    let yourWeapons = state.yourWeapons ? { ...state.yourWeapons } : {};
    let opponentWeapons = state.opponentWeapons ? { ...state.opponentWeapons } : {};
    let yourArmor = state.yourArmor ? { ...state.yourArmor } : {};
    let opponentArmor = state.opponentArmor ? { ...state.opponentArmor } : {};

    if (!event.type || event.type === "kill") {
      const killerId = event.killerId;
      const victimId = event.victimId;
      const assistantId = event.assistantId;
      const opponentSide = otherMatchSide(state.side);

      const reward = getKillReward(event.weapon);
      if (event.team === "you") {
        if (killerId) {
          yourMoney[killerId] = clamp((yourMoney[killerId] ?? 0) + reward, 0, 10000);
        }
        if (victimId) {
          opponentWeapons[victimId] = "";
          opponentArmor[victimId] = "none";
        }
        if (killerId && yourStats[killerId]) {
          yourStats[killerId].kills += 1;
          yourStats[killerId].damage += event.killerDamage ?? 72;
          recalculateHltvStyleRating(yourStats[killerId]);

          if (yourSideStats[state.side]?.[killerId]) {
            yourSideStats[state.side][killerId].kills += 1;
            yourSideStats[state.side][killerId].damage += event.killerDamage ?? 72;
            recalculateHltvStyleRating(yourSideStats[state.side][killerId]);
          }
        }
        if (assistantId && yourStats[assistantId]) {
          yourStats[assistantId].assists += 1;
          yourStats[assistantId].damage += event.assistantDamage ?? 40;
          recalculateHltvStyleRating(yourStats[assistantId]);

          if (yourSideStats[state.side]?.[assistantId]) {
            yourSideStats[state.side][assistantId].assists += 1;
            yourSideStats[state.side][assistantId].damage += event.assistantDamage ?? 40;
            recalculateHltvStyleRating(yourSideStats[state.side][assistantId]);
          }
        }
        if (victimId && opponentStats[victimId]) {
          opponentStats[victimId].deaths += 1;
          recalculateHltvStyleRating(opponentStats[victimId]);

          if (opponentSideStats[opponentSide]?.[victimId]) {
            opponentSideStats[opponentSide][victimId].deaths += 1;
            recalculateHltvStyleRating(opponentSideStats[opponentSide][victimId]);
          }
        }
      } else {
        if (killerId) {
          opponentMoney[killerId] = clamp((opponentMoney[killerId] ?? 0) + reward, 0, 10000);
        }
        if (victimId) {
          yourWeapons[victimId] = "";
          yourArmor[victimId] = "none";
        }
        if (killerId && opponentStats[killerId]) {
          opponentStats[killerId].kills += 1;
          opponentStats[killerId].damage += event.killerDamage ?? 72;
          recalculateHltvStyleRating(opponentStats[killerId]);

          if (opponentSideStats[opponentSide]?.[killerId]) {
            opponentSideStats[opponentSide][killerId].kills += 1;
            opponentSideStats[opponentSide][killerId].damage += event.killerDamage ?? 72;
            recalculateHltvStyleRating(opponentSideStats[opponentSide][killerId]);
          }
        }
        if (assistantId && opponentStats[assistantId]) {
          opponentStats[assistantId].assists += 1;
          opponentStats[assistantId].damage += event.assistantDamage ?? 40;
          recalculateHltvStyleRating(opponentStats[assistantId]);

          if (opponentSideStats[opponentSide]?.[assistantId]) {
            opponentSideStats[opponentSide][assistantId].assists += 1;
            opponentSideStats[opponentSide][assistantId].damage += event.assistantDamage ?? 40;
            recalculateHltvStyleRating(opponentSideStats[opponentSide][assistantId]);
          }
        }
        if (victimId && yourStats[victimId]) {
          yourStats[victimId].deaths += 1;
          recalculateHltvStyleRating(yourStats[victimId]);

          if (yourSideStats[state.side]?.[victimId]) {
            yourSideStats[state.side][victimId].deaths += 1;
            recalculateHltvStyleRating(yourSideStats[state.side][victimId]);
          }
        }
      }
    }

    if (nextPending.length === 0) {
      let finalYourStats = { ...state.savedYourStats! };
      let finalOpponentStats = { ...state.savedOpponentStats! };
      let finalYourSideStats = { ...state.savedYourSideStats! };
      let finalOpponentSideStats = { ...state.savedOpponentSideStats! };

      finalYourStats = applyStatPatch(finalYourStats, state.pendingYourStatsPatch!);
      finalOpponentStats = applyStatPatch(finalOpponentStats, state.pendingOpponentStatsPatch!);
      const opponentSide = otherMatchSide(state.side);
      finalYourSideStats = {
        ...finalYourSideStats,
        [state.side]: applyStatPatch(finalYourSideStats[state.side], state.pendingYourStatsPatch!),
      };
      finalOpponentSideStats = {
        ...finalOpponentSideStats,
        [opponentSide]: applyStatPatch(finalOpponentSideStats[opponentSide], state.pendingOpponentStatsPatch!),
      };

      const youScore = state.you + (state.pendingRoundWinner === "you" ? 1 : 0);
      const opponentScore = state.opponent + (state.pendingRoundWinner === "opponent" ? 1 : 0);
      const nextRound = state.round + 1;
      const ended = isMatchOver(youScore, opponentScore, state.round);
      const nextSide = nextSideAfterRound(state.side, nextRound);

      let nextEconomyState: "ECO" | "FORCE" | "FULL";
      let nextOpponentEconomyState: "ECO" | "FORCE" | "FULL";

      if (isFreshHalfBuy(nextRound)) {
        nextEconomyState = nextRound === 13 ? "ECO" : "FULL";
        nextOpponentEconomyState = nextRound === 13 ? "ECO" : "FULL";
      } else {
        nextEconomyState = getAutoBuyState(
          you.players.map((p) => state.pendingYourMoney?.[p.id] ?? 800),
          nextSide,
          state.pendingYourLossStreak ?? 0,
          state.pendingRoundWinner === "you",
        );
        nextOpponentEconomyState = getAutoBuyState(
          opponent.players.map((p) => state.pendingOpponentMoney?.[p.id] ?? 800),
          otherMatchSide(nextSide),
          state.pendingOpponentLossStreak ?? 0,
          state.pendingRoundWinner === "opponent",
        );
      }

      return {
        ...state,
        round: nextRound,
        you: youScore,
        opponent: opponentScore,
        economy: nextEconomyState,
        opponentEconomy: nextOpponentEconomyState,
        side: nextSide,
        feed: nextFeed,
        yourStats: finalYourStats,
        opponentStats: finalOpponentStats,
        yourSideStats: finalYourSideStats,
        opponentSideStats: finalOpponentSideStats,
        roundWinners: [...state.roundWinners, state.pendingRoundWinner!],
        running: !ended,
        ended,
        winner: ended ? (youScore > opponentScore ? ("you" as "you" | "opponent") : ("opponent" as "you" | "opponent")) : undefined,
        lastReason: state.pendingRoundReason,
        yourMoney: state.pendingYourMoney,
        opponentMoney: state.pendingOpponentMoney,
        yourLossStreak: state.pendingYourLossStreak,
        opponentLossStreak: state.pendingOpponentLossStreak,
        yourWeapons: state.pendingYourWeapons,
        opponentWeapons: state.pendingOpponentWeapons,
        yourArmor: state.pendingYourArmor,
        opponentArmor: state.pendingOpponentArmor,
        pendingEvents: undefined,
        pendingRoundWinner: undefined,
        pendingRoundReason: undefined,
        pendingYourMoney: undefined,
        pendingOpponentMoney: undefined,
        pendingYourLossStreak: undefined,
        pendingOpponentLossStreak: undefined,
        pendingYourWeapons: undefined,
        pendingOpponentWeapons: undefined,
        pendingYourArmor: undefined,
        pendingOpponentArmor: undefined,
        savedYourStats: undefined,
        savedOpponentStats: undefined,
        savedYourSideStats: undefined,
        savedOpponentSideStats: undefined,
        pendingYourStatsPatch: undefined,
        pendingOpponentStatsPatch: undefined,
      };
    }

    return {
      ...state,
      feed: nextFeed,
      yourStats,
      opponentStats,
      yourSideStats,
      opponentSideStats,
      yourMoney,
      opponentMoney,
      yourWeapons,
      opponentWeapons,
      yourArmor,
      opponentArmor,
      pendingEvents: nextPending,
    };
  }

  // --- START NEW ROUND SIMULATION ---
  let yourMoney = { ...state.yourMoney };
  let opponentMoney = { ...state.opponentMoney };
  let yourLossStreak = state.yourLossStreak ?? 0;
  let opponentLossStreak = state.opponentLossStreak ?? 0;
  let currentEconomy = state.economy;
  let currentOpponentEconomy = state.opponentEconomy;

  you.players.forEach((p) => {
    if (yourMoney[p.id] === undefined) yourMoney[p.id] = 800;
  });
  opponent.players.forEach((p) => {
    if (opponentMoney[p.id] === undefined) opponentMoney[p.id] = 800;
  });

  let carriedYourWeapons = { ...state.yourWeapons };
  let carriedOpponentWeapons = { ...state.opponentWeapons };
  let carriedYourArmor = state.yourArmor ? { ...state.yourArmor } : {};
  let carriedOpponentArmor = state.opponentArmor ? { ...state.opponentArmor } : {};

  const isHalftime = state.round === 13;
  const isOvertimeStart = state.round >= 25 && (state.round - 25) % 3 === 0;

  if (isHalftime) {
    you.players.forEach((p) => {
      yourMoney[p.id] = 800;
      carriedYourWeapons[p.id] = state.side === "CT" ? "Glock-18" : "USP-S";
      carriedYourArmor[p.id] = "none";
    });
    opponent.players.forEach((p) => {
      opponentMoney[p.id] = 800;
      carriedOpponentWeapons[p.id] = state.side === "CT" ? "USP-S" : "Glock-18";
      carriedOpponentArmor[p.id] = "none";
    });
    yourLossStreak = 0;
    opponentLossStreak = 0;
    currentEconomy = "ECO";
    currentOpponentEconomy = "ECO";
  } else if (isOvertimeStart) {
    you.players.forEach((p) => {
      yourMoney[p.id] = 10000;
      carriedYourWeapons[p.id] = p.role === "AWP" ? "AWP" : (state.side === "CT" ? "M4A4" : "AK-47");
      carriedYourArmor[p.id] = "helmet";
    });
    opponent.players.forEach((p) => {
      opponentMoney[p.id] = 10000;
      carriedOpponentWeapons[p.id] = p.role === "AWP" ? "AWP" : (state.side === "CT" ? "AK-47" : "M4A4");
      carriedOpponentArmor[p.id] = "helmet";
    });
    yourLossStreak = 0;
    opponentLossStreak = 0;
    currentEconomy = "FULL";
    currentOpponentEconomy = "FULL";
  }

  if (tactic === "save") {
    currentEconomy = "ECO";
  } else if (tactic === "force") {
    currentEconomy = "FORCE";
  }

  const { nextMoney: updatedYourMoney, finalWeapons: yourWeapons, finalArmor: yourArmor } = spendMoney(
    yourMoney,
    you.players,
    state.side,
    currentEconomy,
    carriedYourWeapons,
    carriedYourArmor,
  );
  yourMoney = updatedYourMoney;

  const { nextMoney: updatedOpponentMoney, finalWeapons: opponentWeapons, finalArmor: opponentArmor } = spendMoney(
    opponentMoney,
    opponent.players,
    otherMatchSide(state.side),
    currentOpponentEconomy,
    carriedOpponentWeapons,
    carriedOpponentArmor,
  );
  opponentMoney = updatedOpponentMoney;

  let endOfRoundYourMoney = { ...updatedYourMoney };
  let endOfRoundOpponentMoney = { ...updatedOpponentMoney };

  let yourStrength = teamStrength(you, settings) + mapEdge(you, opponent, state.map, settings);
  you.players.forEach((p) => {
    if (p.role === "AWP" && yourWeapons[p.id] === "AWP") {
      yourStrength += (p.ovr * 0.15) / 5;
    }
  });

  let opponentStrength = teamStrength(opponent, settings, difficulty, true);
  opponent.players.forEach((p) => {
    if (p.role === "AWP" && opponentWeapons[p.id] === "AWP") {
      opponentStrength += (p.ovr * 0.15) / 5;
    }
  });
  const yourLoadout = loadoutProfile(you.players, currentEconomy, yourWeapons, yourArmor);
  const opponentLoadout = loadoutProfile(opponent.players, currentOpponentEconomy, opponentWeapons, opponentArmor);
  const economyMod = economyValue(currentEconomy) - economyValue(currentOpponentEconomy);
  const sideMod = state.side === "CT" ? 0.015 : -0.005;
  const tacticMod =
    tactic === "aggressive"
      ? 0.025
      : tactic === "cautious"
        ? state.side === "CT"
          ? 0.02
          : -0.01
        : tactic === "force"
          ? currentEconomy !== "FULL"
            ? 0.035
            : -0.01
          : tactic === "save"
            ? -0.04
            : 0;
  const luck = (Math.random() - 0.5) * (settings.luck + difficulty.luck) * 0.34;
  const baseProbability = clamp(0.5 + (yourStrength - opponentStrength) / 58 + economyMod + sideMod + tacticMod + timeoutBoost + luck, 0.16, 0.84);
  const probability = applyEcoUpsetCaps(baseProbability, yourLoadout, opponentLoadout, yourStrength, opponentStrength);
  const youWin = Math.random() < probability;

  const winningTeamId: "you" | "opponent" = youWin ? "you" : "opponent";
  const losingTeamId: "you" | "opponent" = youWin ? "opponent" : "you";

  const youScore = state.you + (youWin ? 1 : 0);
  const opponentScore = state.opponent + (youWin ? 0 : 1);

  let tPlantedBomb = false;
  let bombOutcome: "none" | "defused" | "exploded" = "none";
  const tSideTeam = state.side === "T" ? "you" : "opponent";
  if (losingTeamId === tSideTeam) {
    const tBuyState = tSideTeam === "you" ? currentEconomy : currentOpponentEconomy;
    const plantChance = tBuyState === "ECO" ? 0.15 : 0.45;
    tPlantedBomb = Math.random() < plantChance;
    if (tPlantedBomb) {
      bombOutcome = "defused";
    }
  } else {
    const tBuyState = tSideTeam === "you" ? currentEconomy : currentOpponentEconomy;
    const plantChance = tBuyState === "ECO" ? 0.40 : 0.70;
    tPlantedBomb = Math.random() < plantChance;
    if (tPlantedBomb) {
      bombOutcome = "exploded";
    }
  }

  const feed = createRoundFeed(
    state.round,
    you,
    opponent,
    youWin,
    yourWeapons,
    opponentWeapons,
    tactic,
    currentEconomy,
    currentOpponentEconomy,
    tPlantedBomb,
    bombOutcome,
    state.side,
    youScore,
    opponentScore,
    state.context,
  );

  // Add kill rewards to player money
  feed.forEach((event) => {
    if (!event.type || event.type === "kill") {
      const reward = getKillReward(event.weapon);
      if (event.team === "you" && event.killerId) {
        endOfRoundYourMoney[event.killerId] = clamp((endOfRoundYourMoney[event.killerId] ?? 0) + reward, 0, 10000);
      } else if (event.team === "opponent" && event.killerId) {
        endOfRoundOpponentMoney[event.killerId] = clamp((endOfRoundOpponentMoney[event.killerId] ?? 0) + reward, 0, 10000);
      }
    }
  });

  const yourRoundPatch = createRoundStatPatch(you.players, feed, "you", youWin, state.context, opponent.rank, yourWeapons);
  const opponentRoundPatch = createRoundStatPatch(opponent.players, feed, "opponent", !youWin, state.context, you.rank, opponentWeapons);

  if (youWin) {
    yourLossStreak = Math.max(0, yourLossStreak - 1);
    opponentLossStreak = Math.min(4, opponentLossStreak + 1);
  } else {
    yourLossStreak = Math.min(4, yourLossStreak + 1);
    opponentLossStreak = Math.max(0, opponentLossStreak - 1);
  }

  const yourLossBonus = 1400 + yourLossStreak * 500;
  const opponentLossBonus = 1400 + opponentLossStreak * 500;

  const deadPlayerIds = new Set(feed.map((event) => event.victimId));

  const pendingYourMoney: Record<string, number> = {};
  you.players.forEach((p) => {
    let income = 0;
    if (winningTeamId === "you") {
      income = 3250;
    } else {
      if (state.side === "T") {
        if (tPlantedBomb) {
          income = yourLossBonus + 800;
        } else {
          const survived = !deadPlayerIds.has(p.id);
          income = survived ? 0 : yourLossBonus;
        }
      } else {
        income = yourLossBonus;
      }
    }
    pendingYourMoney[p.id] = clamp((endOfRoundYourMoney[p.id] ?? 800) + income, 0, 10000);
  });

  const pendingOpponentMoney: Record<string, number> = {};
  opponent.players.forEach((p) => {
    let income = 0;
    if (winningTeamId === "opponent") {
      income = 3250;
    } else {
      if (state.side === "CT") {
        if (tPlantedBomb) {
          income = opponentLossBonus + 800;
        } else {
          const survived = !deadPlayerIds.has(p.id);
          income = survived ? 0 : opponentLossBonus;
        }
      } else {
        income = opponentLossBonus;
      }
    }
    pendingOpponentMoney[p.id] = clamp((endOfRoundOpponentMoney[p.id] ?? 800) + income, 0, 10000);
  });

  const winningPlayers = winningTeamId === "you" ? you.players : opponent.players;
  const mvpPlayer = winningPlayers[Math.floor(Math.random() * winningPlayers.length)];
  if (mvpPlayer) {
    if (winningTeamId === "you") {
      pendingYourMoney[mvpPlayer.id] = clamp((pendingYourMoney[mvpPlayer.id] ?? 800) + 300, 0, 10000);
    } else {
      pendingOpponentMoney[mvpPlayer.id] = clamp((pendingOpponentMoney[mvpPlayer.id] ?? 800) + 300, 0, 10000);
    }
  }

  let roundReason = "";
  if (youWin) {
    if (state.side === "CT") {
      if (bombOutcome === "defused") {
        roundReason = "Your defenders defuse the bomb and secure the round.";
      } else {
        roundReason = "Your defenders shut down the attack and secure the round.";
      }
    } else {
      if (bombOutcome === "exploded") {
        roundReason = "Your bomb explodes on target, securing the site.";
      } else {
        roundReason = "Your squad hunts down the remaining defenders.";
      }
    }
  } else {
    if (state.side === "CT") {
      if (bombOutcome === "exploded") {
        roundReason = "The opponent detonates the bomb, taking the round.";
      } else {
        roundReason = "The opponent's executes clean out the defenders.";
      }
    } else {
      if (bombOutcome === "defused") {
        roundReason = "The opponents defuse your bomb in a successful retake.";
      } else {
        roundReason = "The opponent holds the site and shuts down your execution.";
      }
    }
  }

  const nextYourWeapons: Record<string, string> = {};
  you.players.forEach((p) => {
    if (deadPlayerIds.has(p.id)) {
      nextYourWeapons[p.id] = state.side === "CT" ? "USP-S" : "Glock-18";
    } else {
      nextYourWeapons[p.id] = yourWeapons[p.id];
    }
  });

  const nextOpponentWeapons: Record<string, string> = {};
  opponent.players.forEach((p) => {
    if (deadPlayerIds.has(p.id)) {
      nextOpponentWeapons[p.id] = state.side === "CT" ? "Glock-18" : "USP-S";
    } else {
      nextOpponentWeapons[p.id] = opponentWeapons[p.id];
    }
  });

  const nextYourArmor: Record<string, "none" | "kevlar" | "helmet"> = {};
  you.players.forEach((p) => {
    if (deadPlayerIds.has(p.id)) {
      nextYourArmor[p.id] = "none";
    } else {
      nextYourArmor[p.id] = yourArmor[p.id] ?? "none";
    }
  });

  const nextOpponentArmor: Record<string, "none" | "kevlar" | "helmet"> = {};
  opponent.players.forEach((p) => {
    if (deadPlayerIds.has(p.id)) {
      nextOpponentArmor[p.id] = "none";
    } else {
      nextOpponentArmor[p.id] = opponentArmor[p.id] ?? "none";
    }
  });

  if (instant) {
    const finalYourStats = applyStatPatch(state.yourStats, yourRoundPatch);
    const finalOpponentStats = applyStatPatch(state.opponentStats, opponentRoundPatch);
    const opponentSide = otherMatchSide(state.side);
    const finalYourSideStats = {
      ...state.yourSideStats,
      [state.side]: applyStatPatch(state.yourSideStats[state.side], yourRoundPatch),
    };
    const finalOpponentSideStats = {
      ...state.opponentSideStats,
      [opponentSide]: applyStatPatch(state.opponentSideStats[opponentSide], opponentRoundPatch),
    };

    const nextRound = state.round + 1;
    const youScore = state.you + (youWin ? 1 : 0);
    const opponentScore = state.opponent + (youWin ? 0 : 1);
    const ended = isMatchOver(youScore, opponentScore, state.round);
    const nextSide = nextSideAfterRound(state.side, nextRound);

    let nextEconomyState: "ECO" | "FORCE" | "FULL";
    let nextOpponentEconomyState: "ECO" | "FORCE" | "FULL";

    if (isFreshHalfBuy(nextRound)) {
      nextEconomyState = nextRound === 13 ? "ECO" : "FULL";
      nextOpponentEconomyState = nextRound === 13 ? "ECO" : "FULL";
    } else {
      nextEconomyState = getAutoBuyState(
        you.players.map((p) => pendingYourMoney[p.id] ?? 800),
        nextSide,
        yourLossStreak,
        youWin,
      );
      nextOpponentEconomyState = getAutoBuyState(
        opponent.players.map((p) => pendingOpponentMoney[p.id] ?? 800),
        otherMatchSide(nextSide),
        opponentLossStreak,
        !youWin,
      );
    }

    return {
      ...state,
      round: nextRound,
      you: youScore,
      opponent: opponentScore,
      economy: nextEconomyState,
      opponentEconomy: nextOpponentEconomyState,
      side: nextSide,
      feed: [...[...feed].reverse(), ...state.feed].slice(0, 60),
      yourStats: finalYourStats,
      opponentStats: finalOpponentStats,
      yourSideStats: finalYourSideStats,
      opponentSideStats: finalOpponentSideStats,
      roundWinners: [...state.roundWinners, winningTeamId],
      running: !ended,
      ended,
      winner: ended ? (youScore > opponentScore ? ("you" as "you" | "opponent") : ("opponent" as "you" | "opponent")) : undefined,
      lastReason: roundReason,
      yourMoney: pendingYourMoney,
      opponentMoney: pendingOpponentMoney,
      yourLossStreak,
      opponentLossStreak,
      yourWeapons: nextYourWeapons,
      opponentWeapons: nextOpponentWeapons,
      yourArmor: nextYourArmor,
      opponentArmor: nextOpponentArmor,
    };
  }

  return {
    ...state,
    yourMoney,
    opponentMoney,
    yourWeapons,
    opponentWeapons,
    yourArmor,
    opponentArmor,
    pendingEvents: feed,
    pendingRoundWinner: winningTeamId,
    pendingRoundReason: roundReason,
    pendingYourMoney,
    pendingOpponentMoney,
    pendingYourLossStreak: yourLossStreak,
    pendingOpponentLossStreak: opponentLossStreak,
    pendingYourWeapons: nextYourWeapons,
    pendingOpponentWeapons: nextOpponentWeapons,
    pendingYourArmor: nextYourArmor,
    pendingOpponentArmor: nextOpponentArmor,
    savedYourStats: cloneStats(state.yourStats),
    savedOpponentStats: cloneStats(state.opponentStats),
    savedYourSideStats: cloneSideStats(state.yourSideStats),
    savedOpponentSideStats: cloneSideStats(state.opponentSideStats),
    pendingYourStatsPatch: yourRoundPatch,
    pendingOpponentStatsPatch: opponentRoundPatch,
  };
}

function createRoundFeed(
  round: number,
  you: FieldTeam,
  opponent: FieldTeam,
  youWin: boolean,
  yourWeapons: Record<string, string>,
  opponentWeapons: Record<string, string>,
  tactic: Tactic,
  yourBuyState: "ECO" | "FORCE" | "FULL",
  opponentBuyState: "ECO" | "FORCE" | "FULL",
  tPlantedBomb: boolean,
  bombOutcome: "none" | "defused" | "exploded",
  side: MatchSide,
  youScore: number,
  opponentScore: number,
  context: MatchContext,
) {
  const teams = { you: you.players, opponent: opponent.players };
  const alive = {
    you: [...you.players],
    opponent: [...opponent.players],
  };
  const winnerTeamSide: MatchSide = youWin ? side : (side === "CT" ? "T" : "CT");
  const isTWinner = winnerTeamSide === "T";

  const losingTeamId = youWin ? "opponent" : "you";
  const losingBuyState = losingTeamId === "you" ? yourBuyState : opponentBuyState;
  const losingTactic = losingTeamId === "you" ? tactic : "standard";
  const losingSide = losingTeamId === "you" ? side : otherMatchSide(side);

  let isSaving = losingTactic === "save" || losingBuyState === "ECO";
  
  // T-side special logic: never save on ECO unless holding high value weapons or in extreme deficit
  if (isSaving && losingSide === "T" && losingBuyState === "ECO") {
    const losingPlayers = losingTeamId === "you" ? you.players : opponent.players;
    const losingWeapons = losingTeamId === "you" ? yourWeapons : opponentWeapons;
    
    const aliveCount = alive[losingTeamId].length;
    const opponentAliveCount = alive[youWin ? "you" : "opponent"].length;
    
    // Check if anyone has a high value weapon
    const hasHighValueWeapon = alive[losingTeamId].some(p => {
      const w = losingWeapons[p.id];
      return w === "AWP" || w === "AK-47" || w === "M4A4" || w === "M4A1-S";
    });

    if (!hasHighValueWeapon) {
      // If no high value weapons, they only save in extreme deficit (e.g., 2v5 or 1v5)
      // Clutch stat reduces the threshold for saving (braver players try to plant)
      const avgClutch = losingPlayers.reduce((sum, p) => sum + p.stats.clutch, 0) / losingPlayers.length;
      const deficitThreshold = avgClutch > 85 ? 4 : 3;
      
      if (opponentAliveCount - aliveCount < deficitThreshold) {
        isSaving = false;
      }
    }
  }

  let ctDeaths = 0;
  let tDeaths = 0;
  let finalReason = "";

  if (isTWinner) {
    if (bombOutcome === "exploded") {
      finalReason = "Target bombed";
      ctDeaths = isSaving ? weightedCount([3, 4, 4, 5]) : weightedCount([4, 4, 5, 5]);
      tDeaths = weightedCount([0, 1, 1, 2, 2, 3, 4]);
    } else {
      finalReason = "Squad eliminated";
      ctDeaths = 5;
      tDeaths = weightedCount([0, 1, 1, 2, 2, 3, 4]);
    }
  } else {
    if (bombOutcome === "defused") {
      finalReason = "Bomb defused";
      tDeaths = isSaving ? weightedCount([2, 3, 4, 4, 5]) : weightedCount([3, 4, 4, 5, 5]);
      ctDeaths = weightedCount([0, 1, 1, 2, 2, 3, 4]);
    } else {
      const timeRanOut = Math.random() < 0.45;
      if (timeRanOut) {
        finalReason = "Time ran out";
        tDeaths = weightedCount([1, 2, 3, 4]);
        ctDeaths = weightedCount([0, 1, 1, 2, 2, 3, 4]);
      } else {
        finalReason = "Squad eliminated";
        tDeaths = 5;
        ctDeaths = weightedCount([0, 1, 1, 2, 2, 3, 4]);
      }
    }
  }

  const remainingKills = {
    you: side === "CT" ? tDeaths : ctDeaths,
    opponent: side === "CT" ? ctDeaths : tDeaths,
  };
  const winnerSide = youWin ? "you" : "opponent";
  const loserSide = youWin ? "opponent" : "you";
  const openingSide: "you" | "opponent" = Math.random() < 0.58 ? winnerSide : loserSide;
  const feed: FeedLine[] = [];

  feed.push({
    round,
    killer: "",
    killerId: "",
    victim: "",
    victimId: "",
    weapon: "",
    team: "neutral",
    first: false,
    type: "round_start",
  });

  const tTeamKey = side === "T" ? "you" : "opponent";
  const ctTeamKey = side === "CT" ? "you" : "opponent";

  while (remainingKills.you + remainingKills.opponent > 0) {
    const preferred = feed.length === 1 ? openingSide : pickKillSide(remainingKills);
    let sideKey: "you" | "opponent" = remainingKills[preferred] > 0 ? preferred : otherSide(preferred);
    if (remainingKills[sideKey] <= 0) break;

    let victimSide: "you" | "opponent" = otherSide(sideKey);
    // Prevent a team from being completely wiped out if they still have kills to get,
    // which would otherwise result in dead players getting kills later in the round.
    if (alive[victimSide].length === 1 && remainingKills[victimSide] > 0) {
      sideKey = victimSide;
      victimSide = otherSide(sideKey);
    }

    const killerPool = alive[sideKey].length ? alive[sideKey] : teams[sideKey];
    const victimPool = alive[victimSide];
    if (!victimPool.length) {
      remainingKills[sideKey] = 0;
      continue;
    }

    const equipped = sideKey === "you" ? yourWeapons : opponentWeapons;
    const victimEquipped = victimSide === "you" ? yourWeapons : opponentWeapons;

    const killerOpponentRank = sideKey === "you" ? opponent.rank : you.rank;
    const victimOpponentRank = victimSide === "you" ? opponent.rank : you.rank;

    const killer = pickWeightedBy(killerPool, (player) => killWeight(player, context, killerOpponentRank, equipped[player.id]));
    const victim = pickWeightedBy(victimPool, (player) => deathWeight(player, context, victimOpponentRank, victimEquipped[player.id]));
    alive[victimSide] = alive[victimSide].filter((player) => player.id !== victim.id);
    remainingKills[sideKey] -= 1;

    const killerWeapon = equipped[killer.id] ?? "Pistol";

    let assistant: Player | undefined;
    let assistantDmg = 0;
    let killerDmg = 0;

    if (Math.random() < 0.36) {
      const teammates = sideKey === "you" ? you.players : opponent.players;
      const pool = teammates.filter((player) => player.id !== killer.id);
      if (pool.length > 0) {
        assistant = pool[Math.floor(Math.random() * pool.length)];
        assistantDmg = Math.floor(25 + Math.random() * 30);
        killerDmg = Math.max(30, 100 - assistantDmg);
      }
    }

    if (assistantDmg === 0) {
      killerDmg = Math.floor(65 + Math.random() * 35);
    }

    feed.push({
      round,
      killer: killer.handle,
      killerId: killer.id,
      victim: victim.handle,
      victimId: victim.id,
      weapon: killerWeapon,
      team: sideKey,
      first: feed.length === 1,
      assistant: assistant?.handle,
      assistantId: assistant?.id,
      killerDamage: killerDmg,
      assistantDamage: assistantDmg,
      isHeadshot: Math.random() < 0.38,
    });
  }

  const getAliveCounts = () => {
    return {
      ct: side === "CT" ? alive.you.length : alive.opponent.length,
      t: side === "T" ? alive.you.length : alive.opponent.length,
    };
  };

  if (tPlantedBomb) {
    const tPlayers = side === "T" ? you.players : opponent.players;
    let plantIndex = Math.min(3, feed.length);
    let aliveTs: Player[] = [];
    while (plantIndex >= 1) {
      const deadTsBeforePlant = new Set(feed.slice(1, plantIndex).map((event) => event.victimId));
      aliveTs = tPlayers.filter((p) => !deadTsBeforePlant.has(p.id));
      if (aliveTs.length > 0) {
        break;
      }
      plantIndex--;
    }
    const planterPool = aliveTs.length ? aliveTs : tPlayers;
    const planter = planterPool[Math.floor(Math.random() * planterPool.length)];

    const deadBeforePlant = new Set(feed.slice(1, plantIndex).map((event) => event.victimId));
    const ctAliveAtPlant = (side === "CT" ? you.players : opponent.players).filter((p) => !deadBeforePlant.has(p.id)).length;
    const tAliveAtPlant = (side === "T" ? you.players : opponent.players).filter((p) => !deadBeforePlant.has(p.id)).length;

    feed.splice(plantIndex, 0, {
      round,
      killer: planter.handle,
      killerId: planter.id,
      victim: "Bomb Site",
      victimId: "",
      weapon: "bomb",
      team: tTeamKey,
      first: false,
      type: "plant",
      ctAlive: ctAliveAtPlant,
      tAlive: tAliveAtPlant,
    });
  }

  if (bombOutcome === "defused") {
    const ctPlayers = side === "CT" ? you.players : opponent.players;
    const deadCTs = new Set(feed.filter(e => e.type !== "plant" && e.type !== "round_start").map((event) => event.victimId));
    const aliveCTs = ctPlayers.filter((p) => !deadCTs.has(p.id));
    const defuserPool = aliveCTs.length ? aliveCTs : ctPlayers;
    const defuser = defuserPool[Math.floor(Math.random() * defuserPool.length)];

    const counts = getAliveCounts();

    feed.push({
      round,
      killer: defuser.handle,
      killerId: defuser.id,
      victim: "Bomb",
      victimId: "",
      weapon: "defuse_kit",
      team: ctTeamKey,
      first: false,
      type: "defuse",
      ctAlive: counts.ct,
      tAlive: counts.t,
    });
  } else if (bombOutcome === "exploded") {
    feed.push({
      round,
      killer: "Bomb",
      killerId: "",
      victim: "",
      victimId: "",
      weapon: "bomb",
      team: "neutral",
      first: false,
      type: "explode",
    });
  }

  const tScoreVal = side === "T" ? youScore : opponentScore;
  const ctScoreVal = side === "CT" ? youScore : opponentScore;

  feed.push({
    round,
    killer: "",
    killerId: "",
    victim: "",
    victimId: "",
    weapon: "",
    team: youWin ? "you" : "opponent",
    first: false,
    type: "round_over",
    tScore: tScoreVal,
    ctScore: ctScoreVal,
    reason: finalReason,
  });

  return feed;
}

function weightedCount(values: number[]) {
  return values[Math.floor(Math.random() * values.length)];
}

function pickKillSide(remainingKills: Record<"you" | "opponent", number>): "you" | "opponent" {
  const total = remainingKills.you + remainingKills.opponent;
  return Math.random() * total < remainingKills.you ? "you" : "opponent";
}

function otherSide(side: "you" | "opponent") {
  return side === "you" ? "opponent" : "you";
}

function pickWeightedBy(players: Player[], weightFor: (player: Player) => number) {
  const total = players.reduce((sum, player) => sum + weightFor(player), 0);
  let roll = Math.random() * total;
  for (const player of players) {
    roll -= weightFor(player);
    if (roll <= 0) return player;
  }
  return players[0];
}

export function getPlayoffDelta(player: Player, opponentRank?: number): number {
  const teamKey = player.source.name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  const handleKey = player.handle.toLowerCase().replace(/[^a-z0-9-]+/g, "");
  const key = `${teamKey}|${handleKey}`;

  let filter: "overall" | "top5" | "top10" | "top20" | "top50" = "overall";
  if (opponentRank) {
    if (opponentRank <= 5) filter = "top5";
    else if (opponentRank <= 10) filter = "top10";
    else if (opponentRank <= 20) filter = "top20";
    else if (opponentRank <= 50) filter = "top50";
  }

  const overallSample = hltvPlayerSplits2026[key]?.[filter];
  const playoffSample = hltvPlayerPlayoffs2026[key]?.[filter];

  if (!overallSample || !playoffSample) return 0;

  const rOverall = overallSample.rating;
  const mOverall = overallSample.maps;
  const rPlayoffs = playoffSample.rating;
  const mPlayoffs = playoffSample.maps;

  if (mOverall <= mPlayoffs || mPlayoffs <= 0) return 0;

  const rGroup = (rOverall * mOverall - rPlayoffs * mPlayoffs) / (mOverall - mPlayoffs);
  return rPlayoffs - rGroup;
}

function killWeight(player: Player, context: MatchContext, opponentRank?: number, weapon?: string) {
  const eliteEntryControl = player.role === "Entry" ? clamp((player.ovr - 86) / 12, 0, 1) : 0;
  const roleMod =
    player.role === "Entry" ? 1.10 + eliteEntryControl * 0.03 :
    player.role === "AWP" ? 1.06 :
    player.role === "IGL" ? 0.88 :
    player.role === "Support" ? 0.94 :
    player.role === "Lurker" ? 1.02 :
    1;

  const styleMod =
    player.style === "Aggressive" ? 1.05 :
    player.style === "Passive" ? 0.97 :
    1;

  const skill = clamp((player.ovr - 50) / 50, 0, 1);

  // 60 OVR ≈ 0.92, 80 OVR ≈ 1.46, 95 OVR ≈ 1.87
  const baseWeight = 0.65 + skill * 1.35;

  return baseWeight * roleMod * styleMod * playerPerformanceMultiplier(player, context, opponentRank, weapon);
}

function deathWeight(player: Player, context: MatchContext, opponentRank?: number, weapon?: string) {
  const eliteEntryControl = player.role === "Entry" ? clamp((player.ovr - 86) / 12, 0, 1) : 0;
  const roleMod =
    player.role === "Entry" ? 1.12 - eliteEntryControl * 0.12 :
    player.role === "IGL" ? 1.05 :
    player.role === "AWP" ? 0.92 :
    player.role === "Lurker" ? 0.96 :
    player.role === "Support" ? 1.02 :
    1;

  const styleMod =
    player.style === "Aggressive" ? 1.06 - eliteEntryControl * 0.04 :
    player.style === "Passive" ? 0.94 :
    1;

  const skill = clamp((player.ovr - 50) / 50, 0, 1);

  // 60 OVR ≈ 1.24, 80 OVR ≈ 1.02, 95 OVR ≈ 0.86
  const baseWeight = 1.35 - skill * 0.55;

  return (baseWeight * roleMod * styleMod) / playerPerformanceMultiplier(player, context, opponentRank, weapon);
}

function playerPerformanceMultiplier(player: Player, context: MatchContext, opponentRank?: number, weapon?: string) {
  const handle = player.handle.toLowerCase();
  let multiplier = 1;

  if (handle === "makazze" && context.map === "ancient") multiplier *= 1.05;
  if (handle === "m0nesy" && context.stage && context.stage !== "swiss") multiplier *= 1.05;
  if (handle === "niko" && player.source.year === "2026" && context.stage === "final") multiplier *= 0.9;

  // AWP performance boost
  if (player.role === "AWP" && weapon === "AWP") {
    multiplier *= 1.15;
  }

  // Playoff performance buff / debuff
  if (context.stage && context.stage !== "swiss") {
    const delta = getPlayoffDelta(player, opponentRank);
    if (delta >= 0.13) {
      multiplier *= 1.10;
    } else if (delta <= -0.13 && handle !== "donk") {
      multiplier *= 0.90;
    }
  }

  return multiplier;
}

function createRoundStatPatch(
  players: Player[],
  feed: FeedLine[],
  team: "you" | "opponent",
  roundWon: boolean,
  context?: MatchContext,
  opponentRank?: number,
  weapons?: Record<string, string>,
) {
  const patch = makeLines(players);
  const playersById = new Map(players.map((player) => [player.id, player]));
  const killsThisRound = new Map<string, number>();
  const deathsThisRound = new Set<string>();
  const assistedThisRound = new Set<string>();

  players.forEach((player) => {
    patch[player.id].rounds = 1;
  });

  feed.forEach((event) => {
    if (event.type === "plant" || event.type === "defuse" || event.type === "explode") return;

    if (event.team === team) {
      const killerId = event.killerId;
      if (killerId) {
        const killer = playersById.get(killerId);
        const performance = killer && context ? playerPerformanceMultiplier(killer, context, opponentRank, event.weapon) : 1;
        patch[killerId].kills += 1;
        patch[killerId].damage += (event.killerDamage ?? killDamage(event.weapon)) * performance;
        killsThisRound.set(killerId, (killsThisRound.get(killerId) ?? 0) + 1);
        if (event.first) patch[killerId].firstKills += 1;
      }
      const assistantId = event.assistantId;
      if (assistantId && patch[assistantId]) {
        patch[assistantId].assists += 1;
        patch[assistantId].damage += event.assistantDamage ?? 40;
        assistedThisRound.add(assistantId);
      }
    } else {
      const victimId = event.victimId;
      if (victimId) {
        patch[victimId].deaths += 1;
        deathsThisRound.add(victimId);
        if (event.first) patch[victimId].firstDeaths += 1;
      }
    }
  });

  players.forEach((player) => {
    const line = patch[player.id];
    const roundKills = killsThisRound.get(player.id) ?? 0;
    const survived = !deathsThisRound.has(player.id);
    const traded = !survived && wasTraded(player.id, feed, team);
    if (roundKills > 1) line.multiKills += roundKills - 1;
    if (roundWon && survived && roundKills >= 2 && Math.random() < 0.12) line.clutchWins += 1;
    if (roundKills > 0 || assistedThisRound.has(player.id) || survived || traded) line.kastRounds += 1;
    line.damage += chipDamage(player, roundKills, survived, context, opponentRank, weapons?.[player.id]);
  });
  return patch;
}

function applyStatPatch(lines: Record<string, PlayerLine>, patch: Record<string, PlayerLine>) {
  const next = Object.fromEntries(Object.entries(lines).map(([id, line]) => [id, { ...line }])) as Record<string, PlayerLine>;
  Object.entries(patch).forEach(([id, incoming]) => {
    if (!next[id]) next[id] = { ...incoming };
    else addRawLine(next[id], incoming);
    recalculateHltvStyleRating(next[id]);
  });
  return next;
}

function addRawLine(target: PlayerLine, incoming: PlayerLine) {
  target.kills += incoming.kills;
  target.deaths += incoming.deaths;
  target.assists += incoming.assists;
  target.damage += incoming.damage;
  target.kastRounds += incoming.kastRounds;
  target.rounds += incoming.rounds;
  target.firstKills += incoming.firstKills;
  target.firstDeaths += incoming.firstDeaths;
  target.multiKills += incoming.multiKills;
  target.clutchWins += incoming.clutchWins;
}

function killDamage(weapon: string) {
  const base = weapon === "AWP" ? 86 : weapon === "USP-S" ? 58 : weapon === "MAC-10" ? 63 : 72;
  return base + Math.random() * 24;
}

function chipDamage(player: Player, roundKills: number, survived: boolean, context?: MatchContext, opponentRank?: number, weapon?: string) {
  const activity = player.style === "Aggressive" ? 8 : player.style === "Passive" ? 4 : 6;
  const survivalBonus = survived ? 2 : 0;
  const skillBonus = (player.ovr - 70) * 0.2;
  const performance = context ? playerPerformanceMultiplier(player, context, opponentRank, weapon) : 1;
  
  if (roundKills > 0) {
    return Math.max(4, (4 + activity * 0.4 + Math.random() * 8) * performance);
  }
  
  return Math.max(6, (8 + activity + survivalBonus + skillBonus + Math.random() * 14) * performance);
}

function pickAssistant(players: Player[], killerId: string) {
  const pool = players.filter((player) => player.id !== killerId);
  if (!pool.length) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

function wasTraded(playerId: string, feed: FeedLine[], team: "you" | "opponent") {
  const deathIndex = feed.findIndex((event) => event.team !== team && event.victimId === playerId);
  if (deathIndex < 0) return false;
  const killerId = feed[deathIndex].killerId;
  return feed
    .slice(deathIndex + 1, deathIndex + 3)
    .some((event) => event.team === team && event.victimId === killerId);
}

function getKillReward(weapon: string): number {
  if (weapon === "AWP") return 100;
  if (weapon === "MP9" || weapon === "MAC-10") return 600;
  return 300;
}

function cloneStats(stats: Record<string, PlayerLine>): Record<string, PlayerLine> {
  return Object.fromEntries(
    Object.entries(stats).map(([id, line]) => [id, { ...line }])
  );
}

function cloneSideStats(sideStats: SideStats): SideStats {
  return {
    CT: cloneStats(sideStats.CT),
    T: cloneStats(sideStats.T),
  };
}

export function recalculateHltvStyleRating(line: PlayerLine) {
  const rounds = Math.max(1, line.rounds);
  const kpr = line.kills / rounds;
  const dpr = line.deaths / rounds;
  const apr = line.assists / rounds;
  const kast = (line.kastRounds / rounds) * 100;
  const adr = line.damage / rounds;
  const contextImpact =
    (line.firstKills / rounds) * 0.18 -
    (line.firstDeaths / rounds) * 0.12 +
    (line.multiKills / rounds) * 0.12 +
    (line.clutchWins / rounds) * 0.2;
  const impact = clamp(2.13 * kpr + 0.42 * apr - 0.41 + contextImpact, 0, 3.0);
  const rating =
    0.007383 * kast +
    0.359123 * kpr -
    0.532957 * dpr +
    0.237218 * impact +
    0.003235 * adr +
    0.158739;

  line.adr = Number(adr.toFixed(1));
  line.impact = Number(impact.toFixed(2));
  line.rating = Number(clamp(rating, 0.01, 2.8).toFixed(2));
}

export function resultNotes(state: MatchState, you: FieldTeam, opponent: FieldTeam, settings: CustomSettings, difficulty: Difficulty) {
  const winner = state.winner === "you" ? you : opponent;
  const loser = state.winner === "you" ? opponent : you;
  const strengthGap =
    teamStrength(you, settings) - teamStrength(opponent, settings, difficulty, true);
  const edge = mapEdge(you, opponent, state.map, settings);
  const notes = [
    `${winner.name} won the key map ${mapName(state.map)} ${state.you}-${state.opponent}.`,
    strengthGap >= 0
      ? `${you.name} had a ${Math.abs(strengthGap).toFixed(1)} paper-strength edge.`
      : `${opponent.name} entered ${Math.abs(strengthGap).toFixed(1)} points stronger on paper.`,
    edge >= 0 ? `${mapName(state.map)} leaned toward your roster.` : `${mapName(state.map)} favored ${opponent.name}.`,
  ];
  if (loser.id === "user") notes.push("The veto left too little room for error.");
  return notes;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
