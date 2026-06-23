import type { MapId, Player, Role } from "./gameData";
import type { MatchEventLog } from "./matchEvents";
import { boxScoreFromEventLog } from "./eventSourcing";
import { canonicalPlayerKey, playerVersionKey } from "./playerIdentity";
import { recalculateHltvStyleRating, type PlayerLine } from "./sim";

// A persistent, queryable local database of completed matches. Each record stores the event-sourced
// box score (small) plus enough identity to aggregate a player's CAREER across teams and runs by
// canonical id — tying together canonical IDs, event sourcing and the run history. Storage is behind a
// sync key/value adapter so localStorage is a drop-in in the browser and tests use an in-memory store.

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryStorage(seed: Record<string, string> = {}): StorageAdapter {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

export interface StoredTeamRef {
  id: string;
  name: string;
  tag: string;
  accent: string;
  year: string;
}

export interface StoredPlayerRef {
  id: string; // per-match (run) player id
  canonicalKey: string;
  versionKey: string;
  handle: string;
  realName: string;
  country: string;
  role: Role;
  side: "left" | "right";
  teamId: string;
}

export interface MatchRecord {
  id: string;
  recordedAt: string; // ISO
  runId?: string;
  stage?: string;
  map: MapId;
  left: StoredTeamRef;
  right: StoredTeamRef;
  leftScore: number;
  rightScore: number;
  winnerId: string;
  players: StoredPlayerRef[];
  box: Record<string, PlayerLine>; // keyed by per-match player id (both teams)
  eventLog?: MatchEventLog; // kept only when requested (replays) — large
}

export interface RecordMatchInput {
  id: string;
  recordedAt: string;
  runId?: string;
  stage?: string;
  map: MapId;
  left: { team: StoredTeamRef; players: Player[] };
  right: { team: StoredTeamRef; players: Player[] };
  leftScore: number;
  rightScore: number;
  winnerId: string;
  eventLog: MatchEventLog;
  keepEventLog?: boolean;
}

export interface PlayerCareerRecord {
  canonicalKey: string;
  handle: string;
  realName: string;
  country: string;
  matches: number;
  teamIds: string[];
  line: PlayerLine; // aggregated across every stored appearance
}

export interface TeamRecordRow {
  team: StoredTeamRef;
  matches: number;
  wins: number;
  losses: number;
}

const DB_KEY = "cssim-match-db-v1";
const SCHEMA_VERSION = 1;
const MAX_MATCHES = 500; // ring buffer so the store can't grow unbounded in localStorage

interface DbShape {
  schemaVersion: number;
  matches: MatchRecord[];
}

export class MatchDatabase {
  constructor(
    private storage: StorageAdapter,
    private key: string = DB_KEY,
  ) {}

  private read(): DbShape {
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return { schemaVersion: SCHEMA_VERSION, matches: [] };
      const parsed = JSON.parse(raw) as DbShape;
      if (!parsed || !Array.isArray(parsed.matches)) return { schemaVersion: SCHEMA_VERSION, matches: [] };
      return { schemaVersion: SCHEMA_VERSION, matches: parsed.matches };
    } catch {
      return { schemaVersion: SCHEMA_VERSION, matches: [] };
    }
  }

  private write(db: DbShape) {
    this.storage.setItem(this.key, JSON.stringify(db));
  }

  recordMatch(input: RecordMatchInput): MatchRecord {
    const box = boxScoreFromEventLog(input.eventLog, input.left.players, input.right.players);
    const players: StoredPlayerRef[] = [
      ...input.left.players.map((player) => playerRef(player, "left", input.left.team.id)),
      ...input.right.players.map((player) => playerRef(player, "right", input.right.team.id)),
    ];
    const record: MatchRecord = {
      id: input.id,
      recordedAt: input.recordedAt,
      runId: input.runId,
      stage: input.stage,
      map: input.map,
      left: input.left.team,
      right: input.right.team,
      leftScore: input.leftScore,
      rightScore: input.rightScore,
      winnerId: input.winnerId,
      players,
      box: { ...box.left, ...box.right },
      eventLog: input.keepEventLog ? input.eventLog : undefined,
    };

    const db = this.read();
    const next = db.matches.filter((match) => match.id !== record.id); // dedupe by id (re-record replaces)
    next.push(record);
    next.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    this.write({ schemaVersion: SCHEMA_VERSION, matches: next.slice(-MAX_MATCHES) });
    return record;
  }

  recordMany(inputs: RecordMatchInput[]): MatchRecord[] {
    return inputs.map((input) => this.recordMatch(input));
  }

  listMatches(): MatchRecord[] {
    return this.read().matches;
  }

  getMatch(id: string): MatchRecord | undefined {
    return this.read().matches.find((match) => match.id === id);
  }

  count(): number {
    return this.read().matches.length;
  }

  clear() {
    this.storage.removeItem(this.key);
  }

  listTeams(): TeamRecordRow[] {
    const rows = new Map<string, TeamRecordRow>();
    for (const match of this.read().matches) {
      for (const ref of [match.left, match.right]) {
        const row = rows.get(ref.id) ?? { team: ref, matches: 0, wins: 0, losses: 0 };
        row.matches += 1;
        if (match.winnerId === ref.id) row.wins += 1;
        else row.losses += 1;
        rows.set(ref.id, row);
      }
    }
    return [...rows.values()].sort((a, b) => b.wins - a.wins || b.matches - a.matches);
  }

  // Career across every stored match, keyed by canonical identity — so a player folds together across
  // teams and runs (a drafted copy + their real-team appearances), with historical versions distinct.
  playerCareer(canonicalKey: string): PlayerCareerRecord | undefined {
    const line = emptyLine();
    const teamIds = new Set<string>();
    let matches = 0;
    let identity: StoredPlayerRef | undefined;

    for (const match of this.read().matches) {
      const refs = match.players.filter((ref) => ref.canonicalKey === canonicalKey);
      if (!refs.length) continue;
      matches += 1;
      for (const ref of refs) {
        identity = identity ?? ref;
        teamIds.add(ref.teamId);
        const matchLine = match.box[ref.id];
        if (matchLine) addLine(line, matchLine);
      }
    }

    if (!identity) return undefined;
    return {
      canonicalKey,
      handle: identity.handle,
      realName: identity.realName,
      country: identity.country,
      matches,
      teamIds: [...teamIds],
      line,
    };
  }

  // All distinct canonical players, most-played first — the persistent player registry.
  listPlayers(): PlayerCareerRecord[] {
    const keys = new Set<string>();
    for (const match of this.read().matches) for (const ref of match.players) keys.add(ref.canonicalKey);
    return [...keys]
      .map((key) => this.playerCareer(key))
      .filter((career): career is PlayerCareerRecord => Boolean(career))
      .sort((a, b) => b.matches - a.matches || b.line.rating - a.line.rating);
  }
}

export function teamRef(team: { id: string; name: string; tag: string; accent: string; year: string }): StoredTeamRef {
  return { id: team.id, name: team.name, tag: team.tag, accent: team.accent, year: team.year };
}

function playerRef(player: Player, side: "left" | "right", teamId: string): StoredPlayerRef {
  return {
    id: player.id,
    canonicalKey: canonicalPlayerKey(player),
    versionKey: playerVersionKey(player),
    handle: player.handle,
    realName: player.realName,
    country: player.country,
    role: player.role,
    side,
    teamId,
  };
}

// Sum a match line into a running career total, then refresh the derived adr/impact/rating.
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
