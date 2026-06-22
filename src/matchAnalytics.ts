import type { MapId } from "./gameData";
import type { MatchEvent, MatchEventLog, MatchEventTeam } from "./matchEvents";

// Advanced, HLTV-style stats DERIVED from the structured event log (matchEvents.ts).
//
// The sim's PlayerLine already tracks coarse counters (multiKills as an "extra kills" sum,
// clutchWins via a random heuristic), but it has no multi-kill *distribution*, no clutch
// *type* breakdown, no trade stats, and no headshot rate. Those all live latently in the
// event stream — this module reconstructs them deterministically. Pure functions only: no
// Math.random / Date, so they stay reproducible alongside the seeded sim.

export interface MultiKillBreakdown {
  k2: number;
  k3: number;
  k4: number;
  k5: number;
}

export interface ClutchTally {
  won: number;
  lost: number;
}

export type ClutchSize = 1 | 2 | 3 | 4 | 5;

export interface PlayerAnalytics {
  playerId: string;
  name: string;
  team: MatchEventTeam;
  kills: number;
  deaths: number;
  assists: number;
  headshotKills: number;
  headshotPct: number; // 0..1 of this player's kills that were headshots
  openingKills: number;
  openingDeaths: number;
  openingAttempts: number;
  openingWinRate: number; // openingKills / openingAttempts
  multiKills: MultiKillBreakdown;
  aces: number; // rounds with 5 kills (== multiKills.k5)
  multiKillRounds: number; // rounds with >= 2 kills
  tradeKills: number; // kills that avenged a teammate's recent death
  tradedDeaths: number; // this player's deaths that a teammate then avenged
  clutches: ClutchTally; // all 1vX situations this player entered
  clutchesByType: Record<ClutchSize, ClutchTally>; // keyed by enemies alive when the clutch began
}

export interface MatchAnalytics {
  maps: MapId[];
  rounds: number;
  players: PlayerAnalytics[];
  byId: Record<string, PlayerAnalytics>;
}

// A trade kill must land within this many subsequent kills of the teammate's death (the event
// stream doesn't always carry `t`, so kill-order is the robust window). When `t` is present we
// additionally require it within TRADE_WINDOW_SECONDS, matching HLTV's ~5s definition.
const TRADE_WINDOW_KILLS = 3;
const TRADE_WINDOW_SECONDS = 5;
const TEAM_SIZE = 5;

export function analyzeEventLog(log: MatchEventLog): MatchAnalytics {
  return analyzeEventLogs([log]);
}

// Merge several maps (a full series) into one set of per-player aggregates.
export function analyzeEventLogs(logs: MatchEventLog[]): MatchAnalytics {
  const byId = new Map<string, PlayerAnalytics>();
  let rounds = 0;

  for (const log of logs) {
    const meta = collectPlayers(log.events);
    for (const round of groupByRound(log.events)) {
      rounds += 1;
      accumulateRound(round, meta, byId);
    }
  }

  const players = [...byId.values()];
  for (const player of players) finalizeRates(player);
  players.sort(
    (a, b) =>
      b.kills - a.kills || b.openingKills - a.openingKills || a.name.localeCompare(b.name),
  );

  return {
    maps: logs.map((log) => log.map),
    rounds,
    players,
    byId: Object.fromEntries(players.map((player) => [player.playerId, player])),
  };
}

// Sum several per-instance analytics rows into one — used for a player's CAREER across a run, where
// the same human can appear under different ids (a drafted copy vs their real-team roster). Callers
// resolve which rows belong together (by canonical identity) and hand them here.
export function mergePlayerAnalytics(rows: PlayerAnalytics[]): PlayerAnalytics | null {
  if (!rows.length) return null;
  const merged = emptyPlayer(rows[0].playerId, rows[0].name, rows[0].team);
  for (const row of rows) {
    merged.kills += row.kills;
    merged.deaths += row.deaths;
    merged.assists += row.assists;
    merged.headshotKills += row.headshotKills;
    merged.openingKills += row.openingKills;
    merged.openingDeaths += row.openingDeaths;
    merged.openingAttempts += row.openingAttempts;
    merged.multiKillRounds += row.multiKillRounds;
    merged.tradeKills += row.tradeKills;
    merged.tradedDeaths += row.tradedDeaths;
    merged.multiKills.k2 += row.multiKills.k2;
    merged.multiKills.k3 += row.multiKills.k3;
    merged.multiKills.k4 += row.multiKills.k4;
    merged.multiKills.k5 += row.multiKills.k5;
    merged.clutches.won += row.clutches.won;
    merged.clutches.lost += row.clutches.lost;
    for (const size of [1, 2, 3, 4, 5] as ClutchSize[]) {
      merged.clutchesByType[size].won += row.clutchesByType[size].won;
      merged.clutchesByType[size].lost += row.clutchesByType[size].lost;
    }
  }
  finalizeRates(merged);
  return merged;
}

interface PlayerMeta {
  team: Map<string, MatchEventTeam>;
  name: Map<string, string>;
}

// First pass: figure out every player's team and display name. A kill tells us the actor is on
// `event.team` and the victim is on the other side, so even players who only ever died get placed.
function collectPlayers(events: MatchEvent[]): PlayerMeta {
  const team = new Map<string, MatchEventTeam>();
  const name = new Map<string, string>();

  for (const event of events) {
    if (event.type !== "kill" || !event.actorId || !event.targetId) continue;
    if (event.team === "neutral") continue;
    const enemy = otherTeam(event.team);
    team.set(event.actorId, event.team);
    team.set(event.targetId, enemy);
    if (event.actor) name.set(event.actorId, event.actor);
    if (event.target) name.set(event.targetId, event.target);
  }

  return { team, name };
}

function groupByRound(events: MatchEvent[]): MatchEvent[][] {
  const rounds = new Map<number, MatchEvent[]>();
  for (const event of events) {
    const bucket = rounds.get(event.round);
    if (bucket) bucket.push(event);
    else rounds.set(event.round, [event]);
  }
  return [...rounds.entries()].sort((a, b) => a[0] - b[0]).map(([, bucket]) => bucket);
}

function accumulateRound(
  events: MatchEvent[],
  meta: PlayerMeta,
  byId: Map<string, PlayerAnalytics>,
) {
  const ensure = (id: string): PlayerAnalytics => {
    let row = byId.get(id);
    if (!row) {
      row = emptyPlayer(id, meta.name.get(id) ?? id, meta.team.get(id) ?? "neutral");
      byId.set(id, row);
    } else if (row.name === id && meta.name.get(id)) {
      row.name = meta.name.get(id)!;
    }
    return row;
  };

  const kills = events.filter(
    (event) => event.type === "kill" && event.actorId && event.targetId,
  );
  const winner = roundWinner(events);
  const killsByActor = new Map<string, number>();

  // Clutch tracking. CS rounds are always 5v5, so we count down from TEAM_SIZE (not from how many
  // players happen to appear in the log) and record who has died this round. When a side hits a lone
  // survivor we can name them by elimination — but only when the full 5-man roster is known, so a
  // sparse/partial log never fabricates a clutch.
  const aliveCount: Record<MatchEventTeam, number> = { left: TEAM_SIZE, right: TEAM_SIZE, neutral: 0 };
  const died: Record<MatchEventTeam, Set<string>> = { left: new Set(), right: new Set(), neutral: new Set() };
  const clutchSeen = new Set<string>(); // a player only "enters" a clutch once per round

  kills.forEach((event) => {
    const killer = ensure(event.actorId!);
    const victim = ensure(event.targetId!);
    killer.kills += 1;
    victim.deaths += 1;
    killsByActor.set(event.actorId!, (killsByActor.get(event.actorId!) ?? 0) + 1);
    if (event.headshot) killer.headshotKills += 1;
    if (event.assistantId) ensure(event.assistantId).assists += 1;
    if (event.firstKill) {
      killer.openingKills += 1;
      killer.openingAttempts += 1;
      victim.openingDeaths += 1;
      victim.openingAttempts += 1;
    }

    // Drop the victim, then check whether either side just fell to a single survivor.
    const victimSide = meta.team.get(event.targetId!) ?? otherTeam(event.team);
    if (victimSide !== "neutral") {
      aliveCount[victimSide] = Math.max(0, aliveCount[victimSide] - 1);
      died[victimSide].add(event.targetId!);
    }
    for (const side of ["left", "right"] as const) {
      if (aliveCount[side] !== 1) continue;
      const survivor = loneSurvivor(meta.team, died[side], side);
      if (!survivor || clutchSeen.has(survivor)) continue;
      const enemies = clampSize(aliveCount[otherTeam(side)]);
      clutchSeen.add(survivor);
      const clutcher = ensure(survivor);
      const outcome = winner === side ? "won" : "lost";
      clutcher.clutches[outcome] += 1;
      clutcher.clutchesByType[enemies][outcome] += 1;
    }
  });

  // Multi-kill buckets (an ace is exactly 5 in this round).
  for (const [id, count] of killsByActor) {
    if (count < 2) continue;
    const row = ensure(id);
    row.multiKillRounds += 1;
    const bucket = Math.min(count, 5) as 2 | 3 | 4 | 5;
    if (bucket === 2) row.multiKills.k2 += 1;
    else if (bucket === 3) row.multiKills.k3 += 1;
    else if (bucket === 4) row.multiKills.k4 += 1;
    else row.multiKills.k5 += 1;
  }

  accumulateTrades(kills, meta, ensure);
}

// A trade kill = killing the player who just killed your teammate. Walk forward; for each kill,
// look back over the recent kills for one where the current victim was the killer and the earlier
// victim was a teammate of the current killer. Each death is credited as "traded" only once.
function accumulateTrades(
  kills: MatchEvent[],
  meta: PlayerMeta,
  ensure: (id: string) => PlayerAnalytics,
) {
  const tradedKillIndex = new Set<number>();
  kills.forEach((event, index) => {
    const avengerId = event.actorId!;
    const slainEnemyId = event.targetId!;
    const avengerTeam = meta.team.get(avengerId);
    for (let j = index - 1; j >= 0 && index - j <= TRADE_WINDOW_KILLS; j--) {
      if (tradedKillIndex.has(j)) continue;
      const prior = kills[j];
      if (prior.actorId !== slainEnemyId) continue; // the slain enemy must have made the prior kill
      const teammateId = prior.targetId!;
      if (meta.team.get(teammateId) !== avengerTeam) continue; // and killed a teammate of the avenger
      if (event.time !== undefined && prior.time !== undefined && event.time - prior.time > TRADE_WINDOW_SECONDS) {
        continue;
      }
      tradedKillIndex.add(j);
      ensure(avengerId).tradeKills += 1;
      ensure(teammateId).tradedDeaths += 1;
      break;
    }
  });
}

// The lone survivor on `side`, identified by elimination — but only when we know the full 5-man
// roster, so partial logs (where some players never appear) don't mis-attribute a clutch.
function loneSurvivor(
  team: Map<string, MatchEventTeam>,
  died: Set<string>,
  side: MatchEventTeam,
): string | undefined {
  const roster = [...team.entries()].filter(([, value]) => value === side).map(([id]) => id);
  if (roster.length !== TEAM_SIZE) return undefined;
  const survivors = roster.filter((id) => !died.has(id));
  return survivors.length === 1 ? survivors[0] : undefined;
}

function roundWinner(events: MatchEvent[]): MatchEventTeam | undefined {
  const over = [...events].reverse().find((event) => event.type === "round_over");
  if (over && over.team !== "neutral") return over.team;
  return undefined;
}

function finalizeRates(player: PlayerAnalytics) {
  player.aces = player.multiKills.k5;
  player.headshotPct = player.kills > 0 ? player.headshotKills / player.kills : 0;
  player.openingWinRate = player.openingAttempts > 0 ? player.openingKills / player.openingAttempts : 0;
}

function emptyPlayer(playerId: string, name: string, team: MatchEventTeam): PlayerAnalytics {
  return {
    playerId,
    name,
    team,
    kills: 0,
    deaths: 0,
    assists: 0,
    headshotKills: 0,
    headshotPct: 0,
    openingKills: 0,
    openingDeaths: 0,
    openingAttempts: 0,
    openingWinRate: 0,
    multiKills: { k2: 0, k3: 0, k4: 0, k5: 0 },
    aces: 0,
    multiKillRounds: 0,
    tradeKills: 0,
    tradedDeaths: 0,
    clutches: { won: 0, lost: 0 },
    clutchesByType: {
      1: { won: 0, lost: 0 },
      2: { won: 0, lost: 0 },
      3: { won: 0, lost: 0 },
      4: { won: 0, lost: 0 },
      5: { won: 0, lost: 0 },
    },
  };
}

function otherTeam(team: MatchEventTeam): MatchEventTeam {
  if (team === "left") return "right";
  if (team === "right") return "left";
  return "neutral";
}

function clampSize(count: number): ClutchSize {
  return Math.max(1, Math.min(5, count)) as ClutchSize;
}

// ---- Highlight leaders (for the UI insights strip) ---------------------------------------------

export interface InsightLeader {
  key: string;
  title: string;
  player: PlayerAnalytics;
  value: number;
  display: string;
  detail: string;
}

const MIN_KILLS_FOR_HS = 5;

// Pick the standout player for each advanced category. Returns only categories that actually have
// a non-trivial leader, in a stable display order.
export function matchInsightLeaders(analytics: MatchAnalytics): InsightLeader[] {
  const players = analytics.players;
  if (!players.length) return [];

  const leaders: InsightLeader[] = [];

  const opener = best(players, (p) => p.openingKills - p.openingDeaths, (p) => p.openingKills);
  if (opener && opener.openingKills > 0) {
    const diff = opener.openingKills - opener.openingDeaths;
    leaders.push({
      key: "opening",
      title: "Opening duels",
      player: opener,
      value: diff,
      display: `${diff >= 0 ? "+" : ""}${diff}`,
      detail: `${opener.openingKills} opening kills / ${opener.openingDeaths} deaths`,
    });
  }

  const fragger = best(players, multiKillScore, (p) => p.kills);
  if (fragger && multiKillScore(fragger) > 0) {
    leaders.push({
      key: "multikill",
      title: fragger.aces > 0 ? "Aces" : "Multi-kills",
      player: fragger,
      value: fragger.aces > 0 ? fragger.aces : fragger.multiKillRounds,
      display: fragger.aces > 0 ? `${fragger.aces} ace${fragger.aces === 1 ? "" : "s"}` : `${fragger.multiKillRounds}`,
      detail: formatMultiKills(fragger.multiKills),
    });
  }

  const clutcher = best(players, (p) => p.clutches.won, (p) => p.clutches.won - p.clutches.lost);
  if (clutcher && clutcher.clutches.won > 0) {
    leaders.push({
      key: "clutch",
      title: "Clutches",
      player: clutcher,
      value: clutcher.clutches.won,
      display: `${clutcher.clutches.won} won`,
      detail: formatClutches(clutcher),
    });
  }

  const trader = best(players, (p) => p.tradeKills, (p) => p.kills);
  if (trader && trader.tradeKills > 0) {
    leaders.push({
      key: "trade",
      title: "Trade kills",
      player: trader,
      value: trader.tradeKills,
      display: `${trader.tradeKills}`,
      detail: `Avenged ${trader.tradeKills} teammate death${trader.tradeKills === 1 ? "" : "s"}`,
    });
  }

  const eligibleHs = players.filter((p) => p.kills >= MIN_KILLS_FOR_HS);
  const sharpshooter = best(eligibleHs, (p) => p.headshotPct, (p) => p.kills);
  if (sharpshooter && sharpshooter.headshotKills > 0) {
    leaders.push({
      key: "headshot",
      title: "Headshot %",
      player: sharpshooter,
      value: sharpshooter.headshotPct,
      display: `${Math.round(sharpshooter.headshotPct * 100)}%`,
      detail: `${sharpshooter.headshotKills} of ${sharpshooter.kills} kills`,
    });
  }

  return leaders;
}

function multiKillScore(p: PlayerAnalytics) {
  return p.multiKills.k2 + p.multiKills.k3 * 2 + p.multiKills.k4 * 4 + p.multiKills.k5 * 8;
}

export function formatMultiKills(multi: MultiKillBreakdown) {
  const parts: string[] = [];
  if (multi.k2) parts.push(`${multi.k2}×2K`);
  if (multi.k3) parts.push(`${multi.k3}×3K`);
  if (multi.k4) parts.push(`${multi.k4}×4K`);
  if (multi.k5) parts.push(`${multi.k5}×ace`);
  return parts.length ? parts.join(" · ") : "No multi-kills";
}

export function formatClutches(player: PlayerAnalytics) {
  const parts: string[] = [];
  for (const size of [1, 2, 3, 4, 5] as ClutchSize[]) {
    const tally = player.clutchesByType[size];
    if (tally.won) parts.push(`${tally.won}×1v${size}`);
  }
  return parts.length ? parts.join(" · ") : "No clutches";
}

function best<T>(items: T[], primary: (item: T) => number, secondary: (item: T) => number): T | undefined {
  let leader: T | undefined;
  let leaderPrimary = -Infinity;
  let leaderSecondary = -Infinity;
  for (const item of items) {
    const p = primary(item);
    const s = secondary(item);
    if (p > leaderPrimary || (p === leaderPrimary && s > leaderSecondary)) {
      leader = item;
      leaderPrimary = p;
      leaderSecondary = s;
    }
  }
  return leader;
}
