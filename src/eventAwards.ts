import type { Player } from "./gameData";
import {
  recalculateHltvStyleRating,
  type FieldTeam,
  type PlayerLine,
} from "./sim";
import { canonicalPlayerKey, playerInstanceKey, playerVersionKey } from "./playerIdentity";

export interface EventAwardMapResult {
  leftStats: Record<string, PlayerLine>;
  rightStats: Record<string, PlayerLine>;
}

export interface EventAwardSeriesResult {
  left: FieldTeam;
  right: FieldTeam;
  maps: EventAwardMapResult[];
}

export interface EventAwardCandidate {
  databaseKey: string;
  canonicalKey: string;
  versionKey: string;
  player: Player;
  team: FieldTeam;
  matches: number;
  line: PlayerLine;
}

export interface EventAwardLeaders {
  mvp?: EventAwardCandidate;
  evps: EventAwardCandidate[];
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

function addLine(target: PlayerLine, incoming: PlayerLine) {
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
  recalculateHltvStyleRating(target);
}

function addTeam(
  rows: Map<string, EventAwardCandidate>,
  team: FieldTeam,
  maps: EventAwardMapResult[],
  side: "left" | "right",
) {
  team.players.forEach((player) => {
    const databaseKey = playerInstanceKey(team, player);
    const current = rows.get(databaseKey) ?? {
      databaseKey,
      canonicalKey: canonicalPlayerKey(player),
      versionKey: playerVersionKey(player),
      player,
      team,
      matches: 0,
      line: emptyLine(),
    };
    maps.forEach((map) => {
      const incoming = (side === "left" ? map.leftStats : map.rightStats)[player.id];
      if (!incoming) return;
      current.matches += 1;
      addLine(current.line, incoming);
    });
    if (current.matches > 0) rows.set(databaseKey, current);
  });
}

/** Selects one champion-side MVP and up to four event-wide EVPs from a completed event sample. */
export function buildEventAwardLeaders(
  results: EventAwardSeriesResult[],
  championId?: string,
): EventAwardLeaders {
  const rows = new Map<string, EventAwardCandidate>();
  results.forEach((result) => {
    addTeam(rows, result.left, result.maps, "left");
    addTeam(rows, result.right, result.maps, "right");
  });
  const ranked = [...rows.values()].sort(
    (left, right) => right.line.rating - left.line.rating
      || right.line.kills - left.line.kills
      || left.player.handle.localeCompare(right.player.handle),
  );
  if (!ranked.length) return { mvp: undefined, evps: [] };

  const maxMaps = Math.max(...ranked.map((row) => row.matches));
  const minimumMaps = Math.max(1, Math.ceil(maxMaps * 0.45));
  const eligible = ranked.filter((row) => row.matches >= minimumMaps);
  const championRows = championId ? eligible.filter((row) => row.team.id === championId) : [];
  const mvp = (championRows.length ? championRows : eligible)[0] ?? ranked[0];
  return {
    mvp,
    evps: eligible.filter((row) => row.databaseKey !== mvp.databaseKey).slice(0, 4),
  };
}
