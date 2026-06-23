import type { MatchEvent, MatchEventLog, MatchEventTeam } from "./matchEvents";
import { analyzeEventLog } from "./matchAnalytics";
import { recalculateHltvStyleRating, type PlayerLine } from "./sim";
import type { Player } from "./gameData";

// Event-sourced box score: derive a full PlayerLine per player PURELY from the stored event log,
// instead of mutating stats live. The counting stats (K/D/A, opening kills/deaths, multi-kills,
// rounds) are reproduced EXACTLY as the live sim accrues them. ADR/KAST/rating are recomputed from
// the log via the same recalculateHltvStyleRating formula — these are the reproducible-from-events
// view and differ slightly from the live numbers, which add non-recorded chip damage and a small
// trade-RNG. clutchWins here use the REAL 1vX detection (deterministic), not the live heuristic.
//
// This is the store-events-then-derive foundation for stats pages, replays, player history, and the
// local match database.

export interface BoxScore {
  left: Record<string, PlayerLine>;
  right: Record<string, PlayerLine>;
}

const DEFAULT_KILL_DAMAGE = 100;
const DEFAULT_ASSIST_DAMAGE = 40;
const TRADE_WINDOW_KILLS = 2; // a death counts as traded if avenged within this many subsequent kills

export function boxScoreFromEventLog(log: MatchEventLog, leftPlayers: Player[], rightPlayers: Player[]): BoxScore {
  const left: Record<string, PlayerLine> = {};
  const right: Record<string, PlayerLine> = {};
  const side = new Map<string, MatchEventTeam>();
  leftPlayers.forEach((player) => {
    left[player.id] = emptyLine();
    side.set(player.id, "left");
  });
  rightPlayers.forEach((player) => {
    right[player.id] = emptyLine();
    side.set(player.id, "right");
  });
  const lineFor = (id: string | undefined): PlayerLine | undefined => {
    if (!id) return undefined;
    const team = side.get(id);
    return team === "left" ? left[id] : team === "right" ? right[id] : undefined;
  };

  const rounds = groupByRound(log.events);
  const totalRounds = rounds.length;
  [...leftPlayers, ...rightPlayers].forEach((player) => {
    const line = lineFor(player.id);
    if (line) line.rounds = totalRounds;
  });

  const clutchWins = clutchWinsByPlayer(log);

  for (const roundEvents of rounds) {
    const kills = roundEvents.filter((event) => event.type === "kill" && event.actorId && event.targetId);
    const killsByActor = new Map<string, number>();
    const assisted = new Set<string>();
    const victims = new Set<string>();

    kills.forEach((event) => {
      const killer = lineFor(event.actorId);
      if (killer) {
        killer.kills += 1;
        killer.damage += event.killerDamage ?? DEFAULT_KILL_DAMAGE;
        if (event.firstKill) killer.firstKills += 1;
      }
      killsByActor.set(event.actorId!, (killsByActor.get(event.actorId!) ?? 0) + 1);

      const victim = lineFor(event.targetId);
      if (victim) {
        victim.deaths += 1;
        if (event.firstKill) victim.firstDeaths += 1;
      }
      victims.add(event.targetId!);

      if (event.assistantId) {
        const assist = lineFor(event.assistantId);
        if (assist) {
          assist.assists += 1;
          assist.damage += event.assistantDamage ?? DEFAULT_ASSIST_DAMAGE;
        }
        assisted.add(event.assistantId);
      }
    });

    side.forEach((playerSide, id) => {
      const line = lineFor(id);
      if (!line) return;
      const roundKills = killsByActor.get(id) ?? 0;
      if (roundKills > 1) line.multiKills += roundKills - 1; // PlayerLine convention: count of "extra" kills
      const survived = !victims.has(id);
      const traded = !survived && deathWasTraded(id, playerSide, kills, side);
      if (roundKills > 0 || assisted.has(id) || survived || traded) line.kastRounds += 1;
    });
  }

  [...leftPlayers, ...rightPlayers].forEach((player) => {
    const line = lineFor(player.id);
    if (!line) return;
    line.clutchWins = clutchWins.get(player.id) ?? 0;
    recalculateHltvStyleRating(line);
  });

  return { left, right };
}

function deathWasTraded(id: string, playerSide: MatchEventTeam, kills: MatchEvent[], side: Map<string, MatchEventTeam>) {
  const deathIndex = kills.findIndex((event) => event.targetId === id);
  if (deathIndex < 0) return false;
  const killerId = kills[deathIndex].actorId;
  return kills
    .slice(deathIndex + 1, deathIndex + 1 + TRADE_WINDOW_KILLS)
    .some((event) => event.targetId === killerId && side.get(event.actorId ?? "") === playerSide);
}

function clutchWinsByPlayer(log: MatchEventLog): Map<string, number> {
  const analytics = analyzeEventLog(log);
  const wins = new Map<string, number>();
  analytics.players.forEach((player) => wins.set(player.playerId, player.clutches.won));
  return wins;
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

function emptyLine(): PlayerLine {
  return {
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
}
