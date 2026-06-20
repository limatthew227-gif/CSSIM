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
import type { Vec } from "./mapGeometry";
import { findRoute, pointAlongRoute, nodeIndexAt, corridorPath } from "./pathfinder";
import { mirageStrategy, spawnNodeId, areConnected, getNode, type MapNode } from "./mirageNav";
import { objectiveFor, roundStateFor, type Situation, type Site } from "./roundAI";
import { simulateMirageRound, type TimelineFrame } from "./mirageRoundSim";

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
  peakingPlayers?: string[];
  coldPlayers?: string[];
  yourForm?: number; // per-MATCH team form (strength delta) — drives day-to-day upsets
  opponentForm?: number;
}

// Per-match "form" (a team's day): a strength delta in OVR units, rolled once per map. Independent
// per team, so sometimes the underdog is hot and the favourite cold -> a real chance of an upset
// even in a mismatch. ~sum of 3 uniforms => mean 0, ~bell-shaped, range ±1.5*FORM_SD.
const envNum = (k: string, d: number) => (typeof process !== "undefined" && process.env && process.env[k] ? Number(process.env[k]) : d);
export const FORM_SD = envNum("FORM_SD", 14);
// Per-round win-prob clamp. The ceiling caps how dominant a favourite can be in a single round; a
// lower ceiling stops big-gap matchups from compounding to ~100% maps, which is what made the strongest
// team win ~60% of majors. Symmetric so neither side is structurally favoured. Tuned with FORM_SD via
// scripts/major-sim.ts: even teams ~50%, a +5-OVR side ~70% of a BO3, the best team ~50% of majors
// (was ~62%) with 6+ different champions. (Env-overridable for re-calibration; defaults in production.)
export const ROUND_CLAMP_HI = envNum("CLAMP_HI", 0.78);
export const ROUND_CLAMP_LO = envNum("CLAMP_LO", 0.22);
export function rollForm(): number {
  return (Math.random() + Math.random() + Math.random() - 1.5) * FORM_SD;
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
  type?: "kill" | "plant" | "defuse" | "explode" | "round_start" | "round_over" | "flash" | "smoke" | "molotov" | "he";
  flashAssist?: boolean;
  killerPos?: { x: number; y: number };
  victimPos?: { x: number; y: number };
  targetPos?: { x: number; y: number }; // where a thrown grenade lands (killerPos = where it's thrown from)
  engage?: { from: string; to: string }; // callouts the duel was resolved between (graph nav)
  t?: number; // round-time (seconds) this event happened — maps the radar onto the spatial timeline
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
  // Mirage spatial replay: per-player position frames for the active round, so the radar plays the
  // engine's REAL trajectories (not a reconstruction). roundTimelineRound says which round it covers.
  roundTimeline?: TimelineFrame[];
  roundTimelineRound?: number;
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

// True if the player does this job as either their primary or secondary role. Used for "does the team
// have an IGL/AWP?" coverage — NOT for fragging weights (those stay keyed to the primary role).
export function playerCoversRole(player: Player, role: Role): boolean {
  return player.role === role || player.secondaryRole === role;
}

export function composition(players: Player[], settings: CustomSettings, isUserTeam = false): BonusLine[] {
  const roles = new Set<Role>();
  players.forEach((player) => {
    roles.add(player.role);
    if (player.secondaryRole) roles.add(player.secondaryRole);
  });
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
  const coachBoost = team.coach ? (team.coach.rating - 68) / 18.0 : 0;
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

/**
 * How well a team uses utility (smokes / flashes / mollies), independent of money.
 * Derived from existing signals — dedicated Support players, IGL coordination, team
 * discipline (consistency), and a tactical/disciplined coach. Returns roughly 0..4.
 */
export function utilityRating(team: FieldTeam): number {
  const players = team.players;
  if (!players.length) return 0;
  const supportCount = players.filter((p) => p.role === "Support").length;
  const igl = players.find((p) => playerCoversRole(p, "IGL")); // an AWP-IGL (secondary role) counts
  const avgConsistency = players.reduce((sum, p) => sum + p.stats.consistency, 0) / players.length;

  let rating = (avgConsistency - 75) * 0.05; // disciplined teams throw better util
  rating += supportCount * 0.6; // dedicated support players bring more lineups
  rating += igl ? (igl.stats.igl - 80) * 0.04 : -0.5; // a good caller coordinates the util
  if (team.coach?.style === "Tactical" || team.coach?.style === "Discipline") rating += 0.5;

  return clamp(rating, 0, 4);
}

/**
 * How much of a team's utility skill is actually expressed this round, gated by how
 * many nades they bought: 0 on a full eco (no nades) ramping to 1 on a full util load.
 */
export function utilFactor(nadeCount: number): number {
  return clamp(nadeCount / 12, 0, 1);
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
  // /2 (not /4): a team's map specialization should genuinely swing a matchup — a weaker team on their
  // best map vs a stronger team's worst map is a real upset spot, so the per-map OVR gap matters more.
  return (mapScore(you, map, settings) - mapScore(opponent, map, settings)) / 2;
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

  const peakingPlayers: string[] = [];
  const stage = context?.stage;
  if (stage && stage !== "swiss") {
    const youRank = you.rank || 20;
    const oppRank = opponent.rank || 20;

    you.players.forEach((p) => {
      if (p.ovr >= 85) {
        const pBase = 0.08 + (p.ovr - 90) * 0.015;
        const delta = getPlayoffDelta(p, opponent.rank);
        const deltaAdj = delta * 0.5;
        const volatility = Math.max(0, (95 - p.stats.consistency) / 200);
        const clutchAdj = Math.max(0, (p.stats.clutch - 75) / 200);

        // Underdog effect: positive rank gap (underdog) boosts chance; negative (favorite) reduces it
        const rankGap = youRank - oppRank;
        const underdogEffect = rankGap * 0.012;

        const peakProb = clamp(pBase + deltaAdj + volatility + clutchAdj + underdogEffect, 0.02, 0.45);
        if (Math.random() < peakProb) {
          peakingPlayers.push(p.id);
        }
      }
    });
    opponent.players.forEach((p) => {
      if (p.ovr >= 85) {
        const pBase = 0.08 + (p.ovr - 90) * 0.015;
        const delta = getPlayoffDelta(p, you.rank);
        const deltaAdj = delta * 0.5;
        const volatility = Math.max(0, (95 - p.stats.consistency) / 200);
        const clutchAdj = Math.max(0, (p.stats.clutch - 75) / 200);

        const rankGap = oppRank - youRank;
        const underdogEffect = rankGap * 0.012;

        const peakProb = clamp(pBase + deltaAdj + volatility + clutchAdj + underdogEffect, 0.02, 0.45);
        if (Math.random() < peakProb) {
          peakingPlayers.push(p.id);
        }
      }
    });
  }

  const coldPlayers: string[] = [];
  you.players.forEach((p) => {
    if (peakingPlayers.includes(p.id)) return;
    const coldProb = clamp(0.02 + (90 - p.stats.consistency) * 0.003, 0.01, 0.18);
    if (Math.random() < coldProb) {
      coldPlayers.push(p.id);
    }
  });
  opponent.players.forEach((p) => {
    if (peakingPlayers.includes(p.id)) return;
    const coldProb = clamp(0.02 + (90 - p.stats.consistency) * 0.003, 0.01, 0.18);
    if (Math.random() < coldProb) {
      coldPlayers.push(p.id);
    }
  });

  return {
    map,
    context: { ...context, map, peakingPlayers, coldPlayers, yourForm: rollForm(), opponentForm: rollForm() },
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

export function lossBonusForStreak(lossStreak: number): number {
  return 1400 + Math.min(lossStreak, 4) * 500;
}

/**
 * Per-player money earned at the end of a round.
 *
 * Real CS2: the entire losing team receives the loss bonus regardless of side or
 * whether an individual survived. (Survivors additionally keep their weapons, which is
 * modeled separately via weapon carry-over.) Ts who planted the bomb but still lost the
 * round earn an extra $800.
 *
 * `side` is the team's own side for the round.
 */
export function roundIncome(opts: { won: boolean; side: MatchSide; planted: boolean; lossBonus: number }): number {
  if (opts.won) return 3250;
  let income = opts.lossBonus;
  if (opts.side === "T" && opts.planted) income += 800;
  return income;
}

export function getAutoBuyState(
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
  const lossBonus = lossBonusForStreak(lossStreak);
  if (avgMoney + lossBonus >= fullBuyThreshold) {
    return "ECO";
  }
  return avgMoney >= 2000 ? "FORCE" : "ECO";
}

export function spendMoney(
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
  finalUtility: Record<string, number>;
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

  // --- Utility (grenade) purchases with whatever is left after guns + armor ---
  // Nades are consumed each round (not carried), so this is a pure per-round spend.
  // Leftover cash after the weapon/armor buy naturally caps how much util a team fields,
  // which is what makes eco/force rounds util-starved relative to a full buy.
  const finalUtility: Record<string, number> = {};
  players.forEach((p) => {
    finalUtility[p.id] = 0;
    if (buyState === "ECO") return;

    const weapon = finalWeapons[p.id] ?? "";
    const hasGun =
      weapon === "AK-47" || weapon === "M4A4" || weapon === "M4A1-S" || weapon === "M4A1" || weapon === "AWP" ||
      weapon === "Galil AR" || weapon === "Galil" || weapon === "Famas" || weapon === "MP9" || weapon === "MAC-10";
    if (!hasGun) return; // pistol-only loadouts skip nades

    const reserve = buyState === "FULL" ? 0 : 250;
    let budget = Math.max(0, (nextMoney[p.id] ?? 0) - reserve);

    // cheapest-first: flash, smoke, HE, then molotov (T) / incendiary (CT)
    const nadeCosts = [200, 300, 300, side === "CT" ? 600 : 400];
    const maxNades = buyState === "FULL" ? (p.role === "Support" || p.role === "IGL" ? 4 : 3) : 2;

    let count = 0;
    for (let i = 0; i < maxNades && i < nadeCosts.length; i += 1) {
      if (budget >= nadeCosts[i]) {
        budget -= nadeCosts[i];
        count += 1;
      } else {
        break;
      }
    }
    const spent = (nextMoney[p.id] ?? 0) - reserve - budget;
    if (spent > 0) nextMoney[p.id] = Math.max(0, (nextMoney[p.id] ?? 0) - spent);
    finalUtility[p.id] = count;
  });

  return { nextMoney, finalWeapons, finalArmor, finalUtility };
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

  const { nextMoney: updatedYourMoney, finalWeapons: yourWeapons, finalArmor: yourArmor, finalUtility: yourUtility } = spendMoney(
    yourMoney,
    you.players,
    state.side,
    currentEconomy,
    carriedYourWeapons,
    carriedYourArmor,
  );
  yourMoney = updatedYourMoney;

  const { nextMoney: updatedOpponentMoney, finalWeapons: opponentWeapons, finalArmor: opponentArmor, finalUtility: opponentUtility } = spendMoney(
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

  let yourStrength = teamStrength(you, settings) + mapEdge(you, opponent, state.map, settings) + (state.context.yourForm ?? 0);
  you.players.forEach((p) => {
    if (p.role === "AWP" && yourWeapons[p.id] === "AWP") {
      yourStrength += (p.ovr * 0.15) / 5;
    }
  });

  let opponentStrength = teamStrength(opponent, settings, difficulty, true) + (state.context.opponentForm ?? 0);
  opponent.players.forEach((p) => {
    if (p.role === "AWP" && opponentWeapons[p.id] === "AWP") {
      opponentStrength += (p.ovr * 0.15) / 5;
    }
  });

  // Playoff adjustments (split deltas & superstar peaks)
  if (state.context.stage && state.context.stage !== "swiss") {
    // 1. Playoff splits delta impact
    you.players.forEach((p) => {
      const delta = getPlayoffDelta(p, opponent.rank);
      if (delta >= 0.13) {
        yourStrength += delta * 6;
      } else if (delta <= -0.13 && p.handle.toLowerCase() !== "donk" && p.handle.toLowerCase() !== "m0nesy") {
        yourStrength += delta * 6;
      }
    });
    opponent.players.forEach((p) => {
      const delta = getPlayoffDelta(p, you.rank);
      if (delta >= 0.13) {
        opponentStrength += delta * 6;
      } else if (delta <= -0.13 && p.handle.toLowerCase() !== "donk" && p.handle.toLowerCase() !== "m0nesy") {
        opponentStrength += delta * 6;
      }
    });

    // 2. Peaking superstar carry boost (OVR and Aim based)
    if (state.context.peakingPlayers && state.context.peakingPlayers.length > 0) {
      const peakingSet = new Set(state.context.peakingPlayers);
      you.players.forEach((p) => {
        if (peakingSet.has(p.id)) {
          const boost = 2.0 + (p.ovr - 85) * 0.15 + (p.stats.aim - 75) * 0.05;
          yourStrength += boost;
        }
      });
      opponent.players.forEach((p) => {
        if (peakingSet.has(p.id)) {
          const boost = 2.0 + (p.ovr - 85) * 0.15 + (p.stats.aim - 75) * 0.05;
          opponentStrength += boost;
        }
      });
    }
  }

  // Cold player penalty (applies in all stages)
  if (state.context.coldPlayers && state.context.coldPlayers.length > 0) {
    const coldSet = new Set(state.context.coldPlayers);
    you.players.forEach((p) => {
      if (coldSet.has(p.id)) {
        const penalty = 2.0 + (p.ovr - 85) * 0.10;
        yourStrength -= penalty;
      }
    });
    opponent.players.forEach((p) => {
      if (coldSet.has(p.id)) {
        const penalty = 2.0 + (p.ovr - 85) * 0.10;
        opponentStrength -= penalty;
      }
    });
  }

  const yourLoadout = loadoutProfile(you.players, currentEconomy, yourWeapons, yourArmor);
  const opponentLoadout = loadoutProfile(opponent.players, currentOpponentEconomy, opponentWeapons, opponentArmor);
  const economyMod = economyValue(currentEconomy) - economyValue(currentOpponentEconomy);
  // Symmetric so the CT side's edge is zero-sum — it no longer favours whoever STARTS CT over a match
  // (both teams play equal CT/T halves). Was 0.015/-0.005, which handed the CT-starting team ~5% extra.
  const sideMod = state.side === "CT" ? 0.01 : -0.01;
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

  // Utility edge: how much each team's util skill is expressed this round, gated by how
  // many nades they actually bought (eco rounds buy none → ~0 effect). The better-util
  // team gains more from an equivalent buy. Bounded so it nudges rather than dominates.
  const yourUtilCount = Object.values(yourUtility).reduce((sum, n) => sum + n, 0);
  const opponentUtilCount = Object.values(opponentUtility).reduce((sum, n) => sum + n, 0);
  const utilEdge = utilityRating(you) * utilFactor(yourUtilCount) - utilityRating(opponent) * utilFactor(opponentUtilCount);
  const utilMod = clamp(utilEdge * 0.012, -0.04, 0.04);

  const baseProbability = clamp(0.5 + (yourStrength - opponentStrength) / 58 + economyMod + sideMod + tacticMod + timeoutBoost + utilMod + luck, ROUND_CLAMP_LO, ROUND_CLAMP_HI);
  // Anti-blowout: once a map is decided, ease the leader's per-round edge so games don't snowball to
  // 13:0/13:1 (the trailing team forces / plays loose, the leader relaxes). Applied AFTER the eco-upset
  // caps so it also tames the near-automatic eco rounds that drive bagels. Only past a 4-round lead and
  // symmetric, so it shrinks blowouts without deciding close games.
  const scoreGap = state.you - state.opponent;
  const comebackMod = -Math.sign(scoreGap) * Math.min(Math.max(0, Math.abs(scoreGap) - 2) * 0.035, 0.15);
  const probability = clamp(applyEcoUpsetCaps(baseProbability, yourLoadout, opponentLoadout, yourStrength, opponentStrength) + comebackMod, 0.05, 0.95);

  const dynamicResult = generateDynamicRound(
    state.round,
    you,
    opponent,
    yourWeapons,
    opponentWeapons,
    tactic,
    currentEconomy,
    currentOpponentEconomy,
    state.side,
    state.you,
    state.opponent,
    state.context,
    yourLossStreak,
    opponentLossStreak,
    yourMoney,
    opponentMoney,
    yourArmor,
    opponentArmor,
    probability,
    killWeight,
    deathWeight,
    yourUtilCount,
    opponentUtilCount
  );

  const youWin = dynamicResult.youWin;
  const tPlantedBomb = dynamicResult.tPlantedBomb;
  const bombOutcome = dynamicResult.bombOutcome;
  const feed = dynamicResult.feed;
  const roundTimeline = dynamicResult.timeline; // mirage spatial replay (undefined on other maps)

  const winningTeamId: "you" | "opponent" = youWin ? "you" : "opponent";
  const losingTeamId: "you" | "opponent" = youWin ? "opponent" : "you";

  const youScore = state.you + (youWin ? 1 : 0);
  const opponentScore = state.opponent + (youWin ? 0 : 1);

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

  const yourLossBonus = lossBonusForStreak(yourLossStreak);
  const opponentLossBonus = lossBonusForStreak(opponentLossStreak);

  const deadPlayerIds = new Set(feed.map((event) => event.victimId));

  const yourIncome = roundIncome({
    won: winningTeamId === "you",
    side: state.side,
    planted: tPlantedBomb,
    lossBonus: yourLossBonus,
  });
  const opponentIncome = roundIncome({
    won: winningTeamId === "opponent",
    side: otherMatchSide(state.side),
    planted: tPlantedBomb,
    lossBonus: opponentLossBonus,
  });

  const pendingYourMoney: Record<string, number> = {};
  you.players.forEach((p) => {
    pendingYourMoney[p.id] = clamp((endOfRoundYourMoney[p.id] ?? 800) + yourIncome, 0, 10000);
  });

  const pendingOpponentMoney: Record<string, number> = {};
  opponent.players.forEach((p) => {
    pendingOpponentMoney[p.id] = clamp((endOfRoundOpponentMoney[p.id] ?? 800) + opponentIncome, 0, 10000);
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
      roundTimeline,
      roundTimelineRound: state.round,
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
    roundTimeline,
    roundTimelineRound: state.round,
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

function getWeaponCost(w: string): number {
  if (!w) return 200;
  const upper = w.toUpperCase();
  if (upper.includes("AWP")) return 4750;
  if (upper.includes("AK")) return 2700;
  if (upper.includes("M4A4")) return 3100;
  if (upper.includes("M4A1")) return 2900;
  if (upper.includes("FAMAS")) return 2050;
  if (upper.includes("GALIL")) return 1800;
  if (upper.includes("MP9")) return 1250;
  if (upper.includes("MAC")) return 1050;
  if (upper.includes("DEAGLE")) return 700;
  if (upper.includes("P90")) return 2350;
  if (upper.includes("SSG")) return 1700;
  if (upper.includes("UMP") || upper.includes("MP7") || upper.includes("MP5")) return 1200;
  if (upper.includes("NOVA") || upper.includes("XM1014") || upper.includes("MAG-7")) return 1500;
  return 300;
}

export function generateDynamicRound(
  round: number,
  you: FieldTeam,
  opponent: FieldTeam,
  yourWeapons: Record<string, string>,
  opponentWeapons: Record<string, string>,
  tactic: Tactic,
  yourBuyState: "ECO" | "FORCE" | "FULL",
  opponentBuyState: "ECO" | "FORCE" | "FULL",
  side: MatchSide,
  youScore: number,
  opponentScore: number,
  context: MatchContext,
  yourLossStreak: number,
  opponentLossStreak: number,
  yourMoney: Record<string, number>,
  opponentMoney: Record<string, number>,
  yourArmor: Record<string, "none" | "kevlar" | "helmet">,
  opponentArmor: Record<string, "none" | "kevlar" | "helmet">,
  initialProbability: number,
  killWeightFn: (p: Player, ctx: MatchContext, oppRank?: number, weapon?: string) => number,
  deathWeightFn: (p: Player, ctx: MatchContext, oppRank?: number, weapon?: string) => number,
  yourUtilCount = 0,
  opponentUtilCount = 0,
) {
  let p = clamp(initialProbability, 0.01, 0.99);
  let logit = Math.log(p / (1 - p)) * 0.7;


  let timeRemaining = 115;
  let bombTimer = 0;
  let tPlantedBomb = false;
  let bombOutcome: "none" | "defused" | "exploded" = "none";
  let roundEnded = false;
  let winningTeamId: "you" | "opponent" | null = null;
  let finalReason = "";

  const alive = {
    you: [...you.players],
    opponent: [...opponent.players]
  };

  const feed: FeedLine[] = [];
  
  // Start reason
  let startReason: string | undefined = undefined;
  if (round === 1) {
    const peakingNames: string[] = [];
    const coldNames: string[] = [];
    if (context.peakingPlayers && context.peakingPlayers.length > 0) {
      const peakingSet = new Set(context.peakingPlayers);
      you.players.forEach((p) => { if (peakingSet.has(p.id)) peakingNames.push(p.handle); });
      opponent.players.forEach((p) => { if (peakingSet.has(p.id)) peakingNames.push(p.handle); });
    }
    if (context.coldPlayers && context.coldPlayers.length > 0) {
      const coldSet = new Set(context.coldPlayers);
      you.players.forEach((p) => { if (coldSet.has(p.id)) coldNames.push(p.handle); });
      opponent.players.forEach((p) => { if (coldSet.has(p.id)) coldNames.push(p.handle); });
    }
    const parts: string[] = [];
    if (peakingNames.length > 0) parts.push(`🔥 Superstar form active: ${peakingNames.join(", ")} in the zone!`);
    if (coldNames.length > 0) parts.push(`❄️ Cold form active: ${coldNames.join(", ")} struggling to find impact.`);
    if (parts.length > 0) startReason = parts.join("  ");
  }

  feed.push({
    round, killer: "", killerId: "", victim: "", victimId: "", weapon: "", team: "neutral", first: false, type: "round_start", reason: startReason
  });

  let isFirstKill = true;
  let lastKillTime = 0;
  let lastKillerSide: "you" | "opponent" | null = null;

  // --- Utility events (Phase 2): narrative only. Budgets come from nades actually bought
  // this round; throwing util never changes the round outcome or player K/D, it just
  // surfaces flashes/smokes/mollies in the feed (and flags flash-assisted kills). ---
  const utilLeft: Record<"you" | "opponent", number> = { you: yourUtilCount, opponent: opponentUtilCount };
  let utilEventsThisRound = 0;
  const MAX_UTIL_EVENTS = 6;

  const tTeamKey = side === "T" ? "you" : "opponent";
  const ctTeamKey = side === "CT" ? "you" : "opponent";

  // --- Map-aware engagements (mirage tactical graph): each player routes from spawn to their
  // objective callout via weighted A*, advancing over the round, and kills are gated to pairs in
  // contact on the GRAPH (same / adjacent callout — elevation-aware, no false 2D sightlines through
  // walls or between different floors). OVR/role weighting still decides who wins. Maps without a
  // tactical graph skip all of this. The radar image is never used for movement. ---
  const usePositions = context.map === "mirage";
  const WALK_SECONDS = 30; // ~time to reach the held objective
  let noLosStreak = 0;
  const routeOf = new Map<string, Vec[]>(); // corridor-hugging point polyline (drives positions)
  const nodesOf = new Map<string, MapNode[]>(); // callout node route (drives LOS / current callout)
  const phaseStartOf = new Map<string, number>(); // elapsed (s into round) when the current route began

  const tName = side === "T" ? you.name : opponent.name;
  const strategy = mirageStrategy(tName, round);

  // === Mirage: real spatial round (navigation + line-of-sight DUELS drive the outcome) ===
  // Replaces the logit-narration model below. Players route to role-based objectives and only trade
  // when they actually see each other; the round result emerges from those duels. Economy/stats are
  // unchanged (they consume the feed this builds). See mirageRoundSim.ts.
  if (usePositions) {
    const skill = new Map<string, number>();
    const awpSet = new Set<string>();
    const weaponsAll: Record<string, string> = {};
    const fillSkill = (players: Player[], weapons: Record<string, string>, oppRank: number | undefined) => {
      for (const pl of players) {
        const wpn = weapons[pl.id] ?? "";
        const kw = killWeightFn(pl, context, oppRank, wpn);
        const dw = Math.max(0.2, deathWeightFn(pl, context, oppRank, wpn));
        skill.set(pl.id, Math.max(0.1, kw / dw)); // strong duelists: high kill weight, low death weight
        if (wpn.toUpperCase().includes("AWP")) awpSet.add(pl.id);
        weaponsAll[pl.id] = wpn;
      }
    };
    fillSkill(you.players, yourWeapons, opponent.rank);
    fillSkill(opponent.players, opponentWeapons, you.rank);
    const teamBias = clamp(initialProbability, 0.01, 0.99) - 0.5; // team strength still tilts duels

    const sim = simulateMirageRound({ you, opponent, side, strategy, skill, awp: awpSet, weapons: weaponsAll, teamBias, tactic });

    const idMap = new Map<string, Player>([...you.players, ...opponent.players].map((pl) => [pl.id, pl] as const));
    const deathTimeOf = new Map<string, number>();
    for (const ev of sim.events) if (ev.type === "kill" && ev.victimId) deathTimeOf.set(ev.victimId, ev.t);
    const aliveAt = (teamKey: "you" | "opponent", atT: number) =>
      (teamKey === "you" ? you.players : opponent.players).filter((pl) => {
        const d = deathTimeOf.get(pl.id);
        return d === undefined || d > atT;
      });
    const countsAt = (atT: number) => ({ ct: aliveAt(ctTeamKey, atT).length, t: aliveAt(tTeamKey, atT).length });

    // Cosmetic utility, gated by nades actually bought (never mints kills). Thrown FROM the thrower's
    // real position (sampled off the timeline) TOWARD a target (the execute site / contested mid), so
    // the radar can draw the throw arc + where it lands. Spread through the round.
    const frameAt = (atT: number) => sim.timeline.reduce((best, f) => (Math.abs(f.t - atT) < Math.abs(best.t - atT) ? f : best), sim.timeline[0]);
    const utilBudget: Record<"you" | "opponent", number> = { you: yourUtilCount, opponent: opponentUtilCount };
    const utilLines: FeedLine[] = [];
    for (let k = 0; k < MAX_UTIL_EVENTS && utilLines.length < MAX_UTIL_EVENTS; k += 1) {
      const teamKey = k % 2 === 0 ? tTeamKey : ctTeamKey;
      if (utilBudget[teamKey] <= 0) continue;
      utilBudget[teamKey] -= 1;
      const type: "smoke" | "flash" | "molotov" | "he" =
        teamKey === tTeamKey ? (Math.random() < 0.6 ? "smoke" : "flash") : Math.random() < 0.5 ? "molotov" : "he";
      const squad = teamKey === "you" ? you.players : opponent.players;
      const thrower = squad[Math.floor(Math.random() * squad.length)];
      const ut = 3 + k * 3 + Math.random() * 2;
      const fr = sim.timeline.length ? frameAt(ut).players.find((p) => p.id === thrower.id) : undefined;
      const from = fr ? { x: fr.x, y: fr.y } : undefined;
      // T util lands on the site being hit; CT util contests mid / the choke.
      const targetNode = getNode(teamKey === tTeamKey ? (strategy === 2 ? "bsite" : "asite") : "mid");
      const targetPos = targetNode ? { x: targetNode.x, y: targetNode.y } : undefined;
      utilLines.push({ round, killer: thrower.handle, killerId: "", victim: "", victimId: "", weapon: type, team: teamKey, first: false, type, killerPos: from ?? targetPos, targetPos, t: ut });
    }

    // Translate engine events -> feed lines (with timestamps so the radar plays the timeline).
    const eventLines: FeedLine[] = [];
    let killSeen = 0;
    for (const ev of sim.events) {
      if (ev.type === "kill" && ev.killerId && ev.victimId) {
        const killer = idMap.get(ev.killerId)!;
        const victim = idMap.get(ev.victimId)!;
        const isFirst = killSeen === 0;
        killSeen += 1;
        // assist: a living teammate of the killer at that moment (cosmetic), ~36% of kills
        let assistant: Player | undefined;
        let assistantDmg = 0;
        let killerDmg: number;
        if (Math.random() < 0.36) {
          const mates = aliveAt(ev.side, ev.t).filter((pl) => pl.id !== killer.id);
          if (mates.length) {
            assistant = mates[Math.floor(Math.random() * mates.length)];
            assistantDmg = Math.floor(25 + Math.random() * 30);
          }
        }
        killerDmg = assistantDmg > 0 ? Math.max(30, 100 - assistantDmg) : Math.floor(65 + Math.random() * 35);
        eventLines.push({
          round, killer: killer.handle, killerId: killer.id, victim: victim.handle, victimId: victim.id,
          weapon: weaponsAll[killer.id] || "Pistol", team: ev.side, first: isFirst,
          assistant: assistant?.handle, assistantId: assistant?.id, killerDamage: killerDmg, assistantDamage: assistantDmg,
          isHeadshot: !!ev.headshot, flashAssist: Math.random() < 0.25, killerPos: ev.killerPos, victimPos: ev.victimPos, engage: ev.engage, t: ev.t,
        });
      } else if (ev.type === "plant") {
        const c = countsAt(ev.t);
        const planter = ev.killerId ? idMap.get(ev.killerId) : undefined;
        eventLines.push({ round, killer: planter?.handle ?? "", killerId: ev.killerId ?? "", victim: "Bomb Site", victimId: "", weapon: "bomb", team: tTeamKey, first: false, type: "plant", ctAlive: c.ct, tAlive: c.t, killerPos: ev.killerPos, t: ev.t });
      } else if (ev.type === "defuse") {
        const c = countsAt(ev.t);
        const defuser = ev.killerId ? idMap.get(ev.killerId) : undefined;
        eventLines.push({ round, killer: defuser?.handle ?? "", killerId: ev.killerId ?? "", victim: "Bomb", victimId: "", weapon: "defuse_kit", team: ctTeamKey, first: false, type: "defuse", ctAlive: c.ct, tAlive: c.t, t: ev.t });
      } else if (ev.type === "explode") {
        eventLines.push({ round, killer: "Bomb", killerId: "", victim: "", victimId: "", weapon: "bomb", team: "neutral", first: false, type: "explode", killerPos: ev.killerPos, t: ev.t });
      }
    }

    const ordered = [...eventLines, ...utilLines].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
    feed.push(...ordered);

    const youWin = sim.youWin;
    const endT = sim.timeline.length ? sim.timeline[sim.timeline.length - 1].t : undefined;
    feed.push({
      round, killer: "", killerId: "", victim: "", victimId: "", weapon: "", team: youWin ? "you" : "opponent", first: false, type: "round_over",
      tScore: side === "T" ? youScore + (youWin ? 1 : 0) : opponentScore + (youWin ? 0 : 1),
      ctScore: side === "CT" ? youScore + (youWin ? 1 : 0) : opponentScore + (youWin ? 0 : 1),
      reason: sim.roundReason, t: endT,
    });
    return { feed, youWin, tPlantedBomb: sim.tPlantedBomb, bombOutcome: sim.bombOutcome, roundReason: sim.roundReason, timeline: sim.timeline };
  }
  const youHasAwp = you.players.some((pl) => yourWeapons[pl.id] === "AWP");
  const oppHasAwp = opponent.players.some((pl) => opponentWeapons[pl.id] === "AWP");
  const sideOf = (teamKey: "you" | "opponent"): MatchSide => (teamKey === tTeamKey ? "T" : "CT");
  const situationFor = (teamKey: "you" | "opponent", planted: boolean, plantSite?: Site): Situation => {
    const util = teamKey === "you" ? yourUtilCount : opponentUtilCount;
    return {
      bombPlanted: planted,
      plantSite,
      enemyAwperPressure: (teamKey === "you" ? oppHasAwp : youHasAwp) ? 0.7 : 0.2,
      hasUtility: util > 4,
      availableUtility: Math.min(1, util / 12),
      saving: teamKey === "you" && tactic === "save",
    };
  };

  const progressOf = (pl: Player, elapsed: number) =>
    Math.min(1, Math.max(0, (elapsed - (phaseStartOf.get(pl.id) ?? 0)) / WALK_SECONDS));
  const posOf = (pl: Player, elapsed: number): Vec => {
    const route = routeOf.get(pl.id);
    if (!route || !route.length) return { x: 50, y: 50 };
    return pointAlongRoute(route, progressOf(pl, elapsed));
  };
  const nodeOf = (pl: Player, elapsed: number): MapNode | undefined => {
    const nodes = nodesOf.get(pl.id);
    if (!nodes || !nodes.length) return undefined;
    return nodes[nodeIndexAt(nodes, progressOf(pl, elapsed))];
  };

  // Plan a team's routes (objectives + RoundState come from roundAI). fromCurrent re-routes alive
  // players from where they are now (used for the post-plant retake/hold re-plan); otherwise from spawn.
  const planTeam = (teamKey: "you" | "opponent", planted: boolean, plantSite: Site | undefined, fromCurrent: boolean, elapsed: number) => {
    const players = teamKey === "you" ? you.players : opponent.players;
    const teamSide = sideOf(teamKey);
    const sit = situationFor(teamKey, planted, plantSite);
    players.forEach((pl, idx) => {
      const start = fromCurrent ? nodeOf(pl, elapsed)?.id ?? spawnNodeId(teamSide) : spawnNodeId(teamSide);
      const route = findRoute(start, objectiveFor(teamSide, idx, strategy, sit), roundStateFor(sit));
      const nodes = route ? route.nodes : [];
      nodesOf.set(pl.id, nodes);
      // shape the drawn/position path to hug the real corridors (graph still owns connectivity/LOS)
      routeOf.set(pl.id, corridorPath(context.map, nodes.map((n) => ({ x: n.x, y: n.y }))));
      phaseStartOf.set(pl.id, fromCurrent ? elapsed : 0);
    });
  };
  const replanForPlant = (elapsed: number, plantSite: Site) => {
    if (!usePositions) return;
    planTeam("you", true, plantSite, true, elapsed);
    planTeam("opponent", true, plantSite, true, elapsed);
  };

  if (usePositions) {
    planTeam("you", false, undefined, false, 0);
    planTeam("opponent", false, undefined, false, 0);
  }

  function throwUtil(teamSide: "you" | "opponent", type: "smoke" | "flash" | "molotov" | "he"): boolean {
    if (utilLeft[teamSide] <= 0 || utilEventsThisRound >= MAX_UTIL_EVENTS) return false;
    const squad = alive[teamSide];
    if (!squad.length) return false;
    utilLeft[teamSide] -= 1;
    utilEventsThisRound += 1;
    const thrower = squad[Math.floor(Math.random() * squad.length)];
    const at = usePositions ? posOf(thrower, 115 - timeRemaining) : undefined;
    feed.push({ round, killer: thrower.handle, killerId: "", victim: "", victimId: "", weapon: type, team: teamSide, first: false, type, killerPos: at });
    return true;
  }

  const getAliveCounts = () => ({
    ct: alive[ctTeamKey].length,
    t: alive[tTeamKey].length,
  });

  const getP = () => 1 / (1 + Math.exp(-logit));

  function otherSide(s: "you" | "opponent"): "you" | "opponent" {
    return s === "you" ? "opponent" : "you";
  }

  function getWeaponCost(w: string): number {
    if (!w) return 200;
    const upper = w.toUpperCase();
    if (upper.includes("AWP")) return 4750;
    if (upper.includes("AK")) return 2700;
    if (upper.includes("M4A4")) return 3100;
    if (upper.includes("M4A1")) return 2900;
    if (upper.includes("FAMAS")) return 2050;
    if (upper.includes("GALIL")) return 1800;
    if (upper.includes("MP9")) return 1250;
    if (upper.includes("MAC")) return 1050;
    if (upper.includes("DEAGLE")) return 700;
    if (upper.includes("P90")) return 2350;
    if (upper.includes("SSG")) return 1700;
    if (upper.includes("UMP") || upper.includes("MP7") || upper.includes("MP5")) return 1200;
    if (upper.includes("NOVA") || upper.includes("XM1014") || upper.includes("MAG-7")) return 1500;
    return 300;
  }

  const isLastRoundOfHalf = round === 12 || round === 24 || (round > 24 && (round - 24) % 6 === 0);
  const matchWinThreshold = (r: number) => r < 25 ? 13 : 13 + (Math.floor((r - 25) / 6) + 1) * 3;
  const isMatchPoint = (youScore >= matchWinThreshold(round) - 1) || (opponentScore >= matchWinThreshold(round) - 1);

  while (!roundEnded && timeRemaining > 0) {

    // 1. Shorter time steps to allow more sequential fights/events
    let timeStep = Math.floor(Math.random() * 5) + 2; // 2-6 seconds pre-plant
    
    if (tPlantedBomb) {
      timeStep = Math.floor(Math.random() * 4) + 2; // 2-5 seconds post-plant
      bombTimer -= timeStep;
      if (bombTimer <= 0) {
        bombOutcome = "exploded";
        winningTeamId = tTeamKey;
        finalReason = "Target bombed";
        roundEnded = true;
        feed.push({ round, killer: "Bomb", killerId: "", victim: "", victimId: "", weapon: "bomb", team: "neutral", first: false, type: "explode" });
        break;
      }
    }

    timeRemaining -= timeStep;
    if (timeRemaining <= 0 && !tPlantedBomb) {
      winningTeamId = ctTeamKey;
      finalReason = "Time ran out";
      roundEnded = true;
      break;
    }

    const counts = getAliveCounts();

    // Occasional standalone utility — T execute setup / CT area denial (pre-plant).
    if (!tPlantedBomb && counts.t > 0 && counts.ct > 0) {
      if (Math.random() < 0.12) throwUtil(tTeamKey, Math.random() < 0.6 ? "smoke" : "flash");
      else if (Math.random() < 0.09) throwUtil(ctTeamKey, Math.random() < 0.5 ? "molotov" : "he");
    }

    let eventType: "kill" | "plant" | "defuse" | "save" | "idle" = "idle";

    if (tPlantedBomb) {
       if (counts.ct > 0 && counts.t === 0) {
         eventType = "defuse";
       } else if (counts.ct > 0) {
         // Ninja defuse chance is very rare (0.5% per step) while Ts are still alive
         if (Math.random() < 0.005) {
           eventType = "defuse";
         } else if (Math.random() > 0.30) {
           eventType = "kill";
         }
       }
    } else {
       const ctAlive = counts.ct;
       const tAlive = counts.t;
       const isDesperate = timeRemaining < 35;
       // Strict site control: Ts must have numbers advantage (t > ct) or defenders must be cleared (ct <= 1)
       const hasSiteControl = tAlive > ctAlive || ctAlive <= 1;

       if (tAlive > 0 && (hasSiteControl || isDesperate)) {
         const pPlant = isDesperate ? 0.35 : 0.20;
         if (Math.random() < pPlant) {
           eventType = "plant";
         } else if (Math.random() > 0.30) {
           eventType = "kill";
         }
       } else if (Math.random() > 0.30) {
         eventType = "kill";
       }
    }

    // Saving logic
    if (!isLastRoundOfHalf && !isMatchPoint) {
      // Check if disadvantaged side should save
      const checkSave = (sideKey: "you" | "opponent") => {
        const sideAlive = alive[sideKey].length;
        const oppAlive = alive[otherSide(sideKey)].length;
        if (sideAlive === 0 || oppAlive === 0) return false;
        
        if (sideAlive >= oppAlive && !tPlantedBomb) return false;
        if (tPlantedBomb && sideKey === ctTeamKey && sideAlive >= oppAlive) return false;
        
        if (sideAlive <= oppAlive - 2 || (tPlantedBomb && sideKey === ctTeamKey && sideAlive < oppAlive)) {
           let equipVal = 0;
           const sideWeapons = sideKey === "you" ? yourWeapons : opponentWeapons;
           alive[sideKey].forEach(p => { equipVal += getWeaponCost(sideWeapons[p.id] ?? ""); });
           const avgEquip = equipVal / sideAlive;
           
           if (avgEquip >= 2500) {
             return Math.random() < 0.85; // highly likely to save
           }
           return Math.random() < 0.35;
        }
        return false;
      };

      if (!tPlantedBomb && timeRemaining < 30) {
        if (checkSave(tTeamKey)) {
           // Ts save
           winningTeamId = ctTeamKey;
           finalReason = "Time ran out";
           roundEnded = true;
           break;
        }
      }

      if (tPlantedBomb && bombTimer < 25) {
        if (checkSave(ctTeamKey)) {
           // CTs save
           bombTimer = 0;
           bombOutcome = "exploded";
           winningTeamId = tTeamKey;
           finalReason = "Target bombed";
           roundEnded = true;
           feed.push({ round, killer: "Bomb", killerId: "", victim: "", victimId: "", weapon: "bomb", team: "neutral", first: false, type: "explode" });
           break;
        }
      }
    }

    if (eventType === "plant") {
       tPlantedBomb = true;
       bombTimer = 40;
       const tBoost = counts.ct > counts.t ? 0.85 : 0.45;
       logit += tTeamKey === "you" ? tBoost : -tBoost;

       const planter = alive[tTeamKey][Math.floor(Math.random() * counts.t)];
       const plantSite: Site = strategy === 2 ? "bsite" : strategy === 1 ? "asite" : Math.random() < 0.5 ? "asite" : "bsite";
       const plantNode = usePositions ? getNode(plantSite) : undefined;
       if (usePositions) replanForPlant(115 - timeRemaining, plantSite); // CTs rotate to retake, Ts hold
       feed.push({ round, killer: planter.handle, killerId: planter.id, victim: "Bomb Site", victimId: "", weapon: "bomb", team: tTeamKey, first: false, type: "plant", ctAlive: counts.ct, tAlive: counts.t, killerPos: plantNode ? { x: plantNode.x, y: plantNode.y } : undefined });
       continue;
    }

    if (eventType === "defuse") {
       bombOutcome = "defused";
       winningTeamId = ctTeamKey;
       finalReason = "Bomb defused";
       roundEnded = true;
       const defuser = alive[ctTeamKey][Math.floor(Math.random() * counts.ct)];
       feed.push({ round, killer: defuser.handle, killerId: defuser.id, victim: "Bomb", victimId: "", weapon: "defuse_kit", team: ctTeamKey, first: false, type: "defuse", ctAlive: counts.ct, tAlive: counts.t });
       break;
    }

    if (eventType === "kill") {
       let youGetKillProb = getP();
       const playerAdvantage = alive.you.length - alive.opponent.length;
       // Individual skill of the best player still alive on each side sways the duel, so a star can
       // carry a weak team (and isn't "shut down" just because his teammates are low-rated). The
       // carry's edge persists while they live and vanishes when they die. getP() stays the
       // team-strength baseline; this adds the star factor a team average alone misses.
       // Carry factor: how much the best player still alive OUTSHINES their own team average — large
       // for a star stuck with weak mates, ~0 for a uniformly strong side (getP already covers that),
       // so it lifts the shut-down star without inflating already-good teams. Persists while the star
       // lives (carry + clutch) and disappears when they die.
       const topYou = alive.you.reduce((m, pl) => Math.max(m, pl.ovr), 0);
       const topOpp = alive.opponent.reduce((m, pl) => Math.max(m, pl.ovr), 0);
       const avgYou = you.players.reduce((s, pl) => s + pl.ovr, 0) / you.players.length;
       const avgOpp = opponent.players.reduce((s, pl) => s + pl.ovr, 0) / opponent.players.length;
       const carryEdge = Math.max(0, topYou - avgYou) - Math.max(0, topOpp - avgOpp);
       youGetKillProb = clamp(youGetKillProb + playerAdvantage * 0.045 + carryEdge * 0.0035, 0.05, 0.95);

       const killerSide = Math.random() < youGetKillProb ? "you" : "opponent";
       const victimSide = otherSide(killerSide);

       if (alive[victimSide].length === 0) continue;

       const killerEquipped = killerSide === "you" ? yourWeapons : opponentWeapons;
       const victimEquipped = victimSide === "you" ? yourWeapons : opponentWeapons;
       const killerOppRank = killerSide === "you" ? opponent.rank : you.rank;
       const victimOppRank = victimSide === "you" ? opponent.rank : you.rank;

       let killer: Player;
       let victim: Player;
       let killerPos: Vec | undefined;
       let victimPos: Vec | undefined;
       let engage: { from: string; to: string } | undefined;

       if (usePositions) {
         // Only players in contact on the graph (same/adjacent callout) can trade. Among those pairs
         // the winner is still OVR/role-weighted via killWeightFn / deathWeightFn.
         const elapsed = 115 - timeRemaining;
         const losPairs: Array<[Player, Player]> = [];
         for (const k of alive[killerSide]) {
           const kn = nodeOf(k, elapsed);
           for (const v of alive[victimSide]) {
             const vn = nodeOf(v, elapsed);
             if (kn && vn && areConnected(kn.id, vn.id)) losPairs.push([k, v]);
           }
         }
         if (losPairs.length === 0) {
           noLosStreak += 1;
           const cleanup = alive[killerSide].length <= 1 || alive[victimSide].length <= 1;
           // No sightline yet: let players keep approaching and try again next tick. The cap + low-time
           // + cleanup conditions guarantee the round still resolves (a push/rotation engagement).
           if (noLosStreak < 6 && timeRemaining > 15 && !cleanup) continue;
           killer = pickWeightedBy(alive[killerSide], p => killWeightFn(p, context, killerOppRank, killerEquipped[p.id]));
           victim = pickWeightedBy(alive[victimSide], p => deathWeightFn(p, context, victimOppRank, victimEquipped[p.id]));
         } else {
           noLosStreak = 0;
           const killersWithLos = Array.from(new Set(losPairs.map(([k]) => k)));
           killer = pickWeightedBy(killersWithLos, p => killWeightFn(p, context, killerOppRank, killerEquipped[p.id]));
           const visibleVictims = losPairs.filter(([k]) => k.id === killer.id).map(([, v]) => v);
           victim = pickWeightedBy(visibleVictims, p => deathWeightFn(p, context, victimOppRank, victimEquipped[p.id]));
         }
         killerPos = posOf(killer, elapsed);
         victimPos = posOf(victim, elapsed);
         const kNode = nodeOf(killer, elapsed);
         const vNode = nodeOf(victim, elapsed);
         if (kNode && vNode) engage = { from: kNode.id, to: vNode.id };
       } else {
         killer = pickWeightedBy(alive[killerSide], p => killWeightFn(p, context, killerOppRank, killerEquipped[p.id]));
         victim = pickWeightedBy(alive[victimSide], p => deathWeightFn(p, context, victimOppRank, victimEquipped[p.id]));
       }

       alive[victimSide] = alive[victimSide].filter(p => p.id !== victim.id);

       if (isFirstKill) {
          isFirstKill = false;
          // Scaled opener shift: 0.35
          const delta = 0.35;
          logit += killerSide === "you" ? delta : -delta;
       } else {
          if (timeRemaining > lastKillTime - 12 && killerSide !== lastKillerSide) {
             // Scaled trade shift: 0.25
             const tradeDelta = 0.25;
             logit += killerSide === "you" ? tradeDelta : -tradeDelta;
          } else {
             // Scaled standard kill shift: 0.18
             const normalDelta = 0.18;
             logit += killerSide === "you" ? normalDelta : -normalDelta;
          }
       }

       if (victim.ovr >= 85) {
          // Scaled star death penalty
          const starDelta = 0.08 + (victim.ovr - 85) * 0.02;
          logit += victimSide === "you" ? -starDelta : starDelta;
       }

       lastKillTime = timeRemaining;
       lastKillerSide = killerSide;

       // A flash from the killer's side that immediately precedes the kill = flash assist.
       const flashAssist = Math.random() < 0.28 ? throwUtil(killerSide, "flash") : false;

       let assistant: Player | undefined;
       let assistantDmg = 0;
       let killerDmg = 0;
       if (Math.random() < 0.36) {
          const teammates = alive[killerSide].filter(p => p.id !== killer.id);
          if (teammates.length > 0) {
            assistant = teammates[Math.floor(Math.random() * teammates.length)];
            assistantDmg = Math.floor(25 + Math.random() * 30);
            killerDmg = Math.max(30, 100 - assistantDmg);
          }
       }
       if (assistantDmg === 0) killerDmg = Math.floor(65 + Math.random() * 35);

       feed.push({
         round, killer: killer.handle, killerId: killer.id, victim: victim.handle, victimId: victim.id,
         weapon: killerEquipped[killer.id] ?? "Pistol", team: killerSide, first: feed.filter(f => !f.type || f.type === "kill").length === 0,
         assistant: assistant?.handle, assistantId: assistant?.id, killerDamage: killerDmg, assistantDamage: assistantDmg,
         isHeadshot: Math.random() < 0.38, flashAssist, killerPos, victimPos, engage,
       });

       if (alive[victimSide].length === 0) {
          if (tPlantedBomb && victimSide === ctTeamKey) {
             bombOutcome = "exploded";
             winningTeamId = tTeamKey;
             finalReason = "Target bombed"; // Changed from Squad eliminated if bomb planted
             roundEnded = true;
          } else if (tPlantedBomb && victimSide === tTeamKey) {
             bombOutcome = "defused";
             winningTeamId = ctTeamKey;
             finalReason = "Bomb defused";
             roundEnded = true;
             const defuser = alive[ctTeamKey][Math.floor(Math.random() * alive[ctTeamKey].length)];
             feed.push({ round, killer: defuser.handle, killerId: defuser.id, victim: "Bomb", victimId: "", weapon: "defuse_kit", team: ctTeamKey, first: false, type: "defuse", ctAlive: alive[ctTeamKey].length, tAlive: 0 });
          } else {
             winningTeamId = killerSide;
             finalReason = "Squad eliminated";
             roundEnded = true;
          }
       }
    }
  }

  const youWin = winningTeamId === "you";
  feed.push({
    round, killer: "", killerId: "", victim: "", victimId: "", weapon: "", team: youWin ? "you" : "opponent", first: false, type: "round_over",
    tScore: side === "T" ? youScore + (youWin ? 1 : 0) : opponentScore + (youWin ? 0 : 1),
    ctScore: side === "CT" ? youScore + (youWin ? 1 : 0) : opponentScore + (youWin ? 0 : 1),
    reason: finalReason
  });

  return { feed, youWin, tPlantedBomb, bombOutcome, roundReason: finalReason, timeline: undefined as TimelineFrame[] | undefined };
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
  const isDonk = player.handle.toLowerCase() === "donk";
  const eliteEntryControl = player.role === "Entry" ? clamp((player.ovr - 86) / 12, 0, 1) : 0;
  const roleMod =
    player.role === "Entry" ? (isDonk ? 1.10 + eliteEntryControl * 0.03 : 1.03 + eliteEntryControl * 0.02) :
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
  const isDonk = player.handle.toLowerCase() === "donk";
  const eliteEntryControl = player.role === "Entry" ? clamp((player.ovr - 86) / 12, 0, 1) : 0;
  const roleMod =
    player.role === "Entry" ? (isDonk ? 1.12 - eliteEntryControl * 0.12 : 1.16 - eliteEntryControl * 0.04) :
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

  // AWP / Scout performance boost scaled by AWP skill stat
  const isAwpOrScout = weapon === "AWP" || (weapon && weapon.toUpperCase().includes("SSG"));
  if (isAwpOrScout) {
    const isAwper = player.role === "AWP";
    const baseline = isAwper ? 84 : 85; 
    const diff = player.stats.awp - baseline;
    const factor = diff >= 0 ? diff * 0.008 : diff * 0.015;
    const multiplierChange = diff >= 0 ? Math.min(0.08, factor) : factor;
    multiplier *= Math.max(0.5, 1.0 + multiplierChange);
  }

  // Playoff performance buff / debuff
  if (context.stage && context.stage !== "swiss") {
    const delta = getPlayoffDelta(player, opponentRank);
    if (delta >= 0.13) {
      multiplier *= 1.10;
    } else if (delta <= -0.13 && handle !== "donk" && handle !== "m0nesy") {
      multiplier *= 0.90;
    }
  }

  // Superstar peaking boost (Aim and Consistency based)
  if (context.peakingPlayers && context.peakingPlayers.includes(player.id)) {
    const peakMultiplier = 1.10 + (player.stats.aim - 75) * 0.005 + (player.stats.consistency - 75) * 0.002;
    multiplier *= peakMultiplier;
  }

  // Cold player penalty (Individual performance penalty)
  if (context.coldPlayers && context.coldPlayers.includes(player.id)) {
    multiplier *= 0.88;
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
    // Only kills (legacy untyped events) mutate stats; plant/defuse/explode/util are inert here.
    if (event.type && event.type !== "kill") return;

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

export function getKillReward(weapon: string): number {
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
