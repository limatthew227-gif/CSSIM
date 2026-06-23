import type { MapId, Player, Role } from "./gameData";
import type { MatchEventLog } from "./matchEvents";
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
  logo?: string; // resolved logo URL, so the Vault can render crests (older records fall back to the tag)
}

export interface StoredPlayerRef {
  id: string; // per-match (run) player id
  canonicalKey: string;
  versionKey: string;
  handle: string;
  realName: string;
  country: string;
  year?: string; // source-team year — distinguishes a player's eras (FalleN 2018 vs FalleN 2026)
  era?: string;
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
  sideBox?: { CT: Record<string, PlayerLine>; T: Record<string, PlayerLine> }; // CT/T split for filtering
  eventLog?: MatchEventLog; // legacy only: logs now live in a separate store (see getEventLog)
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
  // The authoritative live PlayerLine stats keyed by per-match player id (both teams). We store these
  // verbatim — NOT a re-derivation — so a player's all-time line matches exactly what the rest of the
  // app shows for the same maps. The event log is optional (replay payload), not the stat source.
  stats: Record<string, PlayerLine>;
  // Per-side (CT/T) splits, keyed by per-match player id, so the all-time leaderboards can filter by
  // side. Optional — records without it simply don't contribute to side-filtered queries.
  sideStats?: { CT: Record<string, PlayerLine>; T: Record<string, PlayerLine> };
  eventLog?: MatchEventLog;
  keepEventLog?: boolean;
}

// Optional filters for the all-time career queries. `map` narrows to one map; `side` aggregates only
// the CT or T split (records lacking a side split are skipped — never folded as their full combined
// line, which would double-count both sides into one).
export interface CareerQuery {
  side?: "CT" | "T";
  map?: MapId;
}

export interface PlayerCareerRecord {
  versionKey: string;
  handle: string;
  realName: string;
  country: string;
  year?: string; // the era this record covers (a 2018 player is a separate record from their 2026 self)
  era?: string;
  matches: number;
  teamIds: string[];
  line: PlayerLine; // aggregated across every stored appearance of THIS version
}

export interface TeamRecordRow {
  team: StoredTeamRef;
  matches: number;
  wins: number;
  losses: number;
}

export interface TeamMatchRow {
  matchId: string;
  recordedAt: string;
  map: MapId;
  stage?: string;
  opponent: StoredTeamRef;
  teamScore: number;
  oppScore: number;
  won: boolean;
}

export interface TeamMapRecord {
  map: MapId;
  wins: number;
  losses: number;
}

export interface TeamRosterRow {
  versionKey: string;
  handle: string;
  realName: string;
  country: string;
  year?: string;
  role: Role;
  maps: number;
  line: PlayerLine; // aggregated for THIS team only
  current: boolean; // on the roster as of the team's most recent match (false = a former/traded player)
}

export interface HeadToHeadRow {
  team: StoredTeamRef;
  wins: number;
  losses: number;
}

export interface TeamProfile {
  team: StoredTeamRef;
  matches: number;
  wins: number;
  losses: number;
  streak: { type: "W" | "L"; count: number } | null; // current run, from the most recent match
  byMap: TeamMapRecord[];
  roster: TeamRosterRow[]; // players who turned out for the team, best rating first
  headToHead: HeadToHeadRow[]; // record vs each opponent faced
  history: TeamMatchRow[]; // newest first
}

const DB_KEY = "cssim-match-db-v1";
const LOG_KEY = "cssim-match-logs-v1";
const SCHEMA_VERSION = 2; // v2 adds sideBox + a separate log store; v1 records still parse (fields optional)
// Ring buffer so the registry can't grow unbounded in localStorage. Each record now carries a combined
// box PLUS a CT/T split (~3x the stat payload), so this is kept conservative to stay well under quota.
const MAX_MATCHES = 300;
// Event logs are large (hundreds of events per map). They live in their OWN small ring buffer, separate
// from the registry, so the registry stays tiny/fast and only the most recent matches are replayable.
const MAX_EVENT_LOGS = 40;

interface DbShape {
  schemaVersion: number;
  matches: MatchRecord[];
}

interface LogStoreShape {
  schemaVersion: number;
  logs: Array<{ id: string; log: MatchEventLog }>;
}

export class MatchDatabase {
  constructor(
    private storage: StorageAdapter,
    private key: string = DB_KEY,
    private logKey: string = LOG_KEY,
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

  private readLogs(): LogStoreShape {
    try {
      const raw = this.storage.getItem(this.logKey);
      if (!raw) return { schemaVersion: SCHEMA_VERSION, logs: [] };
      const parsed = JSON.parse(raw) as LogStoreShape;
      if (!parsed || !Array.isArray(parsed.logs)) return { schemaVersion: SCHEMA_VERSION, logs: [] };
      return { schemaVersion: SCHEMA_VERSION, logs: parsed.logs };
    } catch {
      return { schemaVersion: SCHEMA_VERSION, logs: [] };
    }
  }

  private writeLogs(store: LogStoreShape) {
    this.storage.setItem(this.logKey, JSON.stringify(store));
  }

  // Store a replay log in the separate, capped log store. Guarded so a quota failure here NEVER aborts
  // the (tiny, must-succeed) box-score write that already happened — on quota error we shed half the
  // logs and retry once, then give up silently.
  private putEventLog(id: string, log: MatchEventLog) {
    const existing = this.readLogs().logs.filter((entry) => entry.id !== id);
    existing.push({ id, log });
    const capped = existing.slice(-MAX_EVENT_LOGS);
    try {
      this.writeLogs({ schemaVersion: SCHEMA_VERSION, logs: capped });
    } catch {
      try {
        this.writeLogs({ schemaVersion: SCHEMA_VERSION, logs: capped.slice(-Math.floor(MAX_EVENT_LOGS / 2)) });
      } catch {
        /* drop the log silently — the box score is already persisted */
      }
    }
  }

  getEventLog(id: string): MatchEventLog | undefined {
    return this.readLogs().logs.find((entry) => entry.id === id)?.log;
  }

  hasEventLog(id: string): boolean {
    return this.readLogs().logs.some((entry) => entry.id === id);
  }

  // The set of match ids that have a stored replay log — for cheap "is this row clickable" checks.
  eventLogIds(): Set<string> {
    return new Set(this.readLogs().logs.map((entry) => entry.id));
  }

  // Assemble a MatchRecord (box + CT/T split) without touching storage.
  private buildRecord(input: RecordMatchInput): MatchRecord {
    const players: StoredPlayerRef[] = [
      ...input.left.players.map((player) => playerRef(player, "left", input.left.team.id)),
      ...input.right.players.map((player) => playerRef(player, "right", input.right.team.id)),
    ];
    // Keep only the lines for players actually in this match.
    const box: Record<string, PlayerLine> = {};
    players.forEach((ref) => {
      const line = input.stats[ref.id];
      if (line) box[ref.id] = line;
    });
    let sideBox: MatchRecord["sideBox"];
    if (input.sideStats) {
      const ct: Record<string, PlayerLine> = {};
      const t: Record<string, PlayerLine> = {};
      players.forEach((ref) => {
        if (input.sideStats!.CT[ref.id]) ct[ref.id] = input.sideStats!.CT[ref.id];
        if (input.sideStats!.T[ref.id]) t[ref.id] = input.sideStats!.T[ref.id];
      });
      sideBox = { CT: ct, T: t };
    }
    return {
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
      box,
      sideBox,
      // Logs are NOT inlined in the registry — they go to the separate log store.
    };
  }

  // Commit records to the registry (dedupe by id, sort by time, cap), then store any logs. The registry
  // write is guarded so a quota error sheds the oldest records and retries rather than throwing up
  // through the recording effect and crashing the run.
  private commit(records: MatchRecord[], inputs: RecordMatchInput[]) {
    // De-dupe the incoming batch by id (last wins) so the registry never holds the same id twice.
    const byId = new Map<string, MatchRecord>();
    records.forEach((record) => byId.set(record.id, record));
    const next = [...this.read().matches.filter((match) => !byId.has(match.id)), ...byId.values()]
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
      .slice(-MAX_MATCHES);
    try {
      this.write({ schemaVersion: SCHEMA_VERSION, matches: next });
    } catch {
      // Out of quota. Replay logs are cosmetic and the heaviest thing the Vault owns — drop them to make
      // room and keep the FULL match registry (stats/leaderboards) before sacrificing any records.
      try {
        this.storage.removeItem(this.logKey);
        this.write({ schemaVersion: SCHEMA_VERSION, matches: next });
      } catch {
        try {
          this.write({ schemaVersion: SCHEMA_VERSION, matches: next.slice(-Math.floor(next.length / 2)) });
        } catch {
          /* give up — keep whatever was already persisted */
        }
      }
    }
    inputs.forEach((input, index) => {
      if (input.keepEventLog && input.eventLog) this.putEventLog(records[index].id, input.eventLog);
    });
  }

  recordMatch(input: RecordMatchInput): MatchRecord {
    const record = this.buildRecord(input);
    this.commit([record], [input]);
    return record;
  }

  // Batched insert: reads/sorts/serializes the registry ONCE for the whole set (a Swiss round records
  // many maps), instead of once per map.
  recordMany(inputs: RecordMatchInput[]): MatchRecord[] {
    if (!inputs.length) return [];
    const records = inputs.map((input) => this.buildRecord(input));
    this.commit(records, inputs);
    return records;
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
    this.storage.removeItem(this.logKey);
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

  // Everything about one team across every saved match: record, current streak, per-map W-L, the
  // roster aggregated for THIS team, head-to-head vs each opponent, and the (newest-first) match list.
  teamProfile(teamId: string): TeamProfile | undefined {
    const games = this.read()
      .matches.filter((match) => match.left.id === teamId || match.right.id === teamId)
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    if (!games.length) return undefined;

    let wins = 0;
    let losses = 0;
    const mapRec = new Map<MapId, TeamMapRecord>();
    const h2h = new Map<string, HeadToHeadRow>();
    const rosterAgg = new Map<string, { ref: StoredPlayerRef; line: PlayerLine; matchIds: Set<string> }>();
    const history: TeamMatchRow[] = [];
    let latestRef = games[games.length - 1].left.id === teamId ? games[games.length - 1].left : games[games.length - 1].right;

    for (const match of games) {
      const isLeft = match.left.id === teamId;
      const opponent = isLeft ? match.right : match.left;
      const teamScore = isLeft ? match.leftScore : match.rightScore;
      const oppScore = isLeft ? match.rightScore : match.leftScore;
      const won = match.winnerId === teamId;
      if (won) wins += 1;
      else losses += 1;
      latestRef = isLeft ? match.left : match.right;

      const mr = mapRec.get(match.map) ?? { map: match.map, wins: 0, losses: 0 };
      if (won) mr.wins += 1;
      else mr.losses += 1;
      mapRec.set(match.map, mr);

      const hh = h2h.get(opponent.id) ?? { team: opponent, wins: 0, losses: 0 };
      if (won) hh.wins += 1;
      else hh.losses += 1;
      h2h.set(opponent.id, hh);

      match.players
        .filter((ref) => ref.teamId === teamId)
        .forEach((ref) => {
          const agg = rosterAgg.get(ref.versionKey) ?? { ref, line: emptyLine(), matchIds: new Set<string>() };
          const matchLine = match.box[ref.id];
          if (matchLine) {
            addCounters(agg.line, matchLine);
            agg.matchIds.add(match.id);
          }
          agg.ref = ref; // keep the most recent identity for display
          rosterAgg.set(ref.versionKey, agg);
        });

      history.push({ matchId: match.id, recordedAt: match.recordedAt, map: match.map, stage: match.stage, opponent, teamScore, oppScore, won });
    }

    history.reverse(); // newest first
    let streak: TeamProfile["streak"] = null;
    if (history.length) {
      const type = history[0].won ? "W" : "L";
      let count = 0;
      for (const row of history) {
        if ((row.won ? "W" : "L") === type) count += 1;
        else break;
      }
      streak = { type, count };
    }

    // The current roster = whoever turned out in the team's most recent match record (all five start
    // every map, so that record's players are the present lineup); everyone else is a former player.
    const lastGame = games[games.length - 1];
    const currentKeys = new Set(lastGame.players.filter((ref) => ref.teamId === teamId).map((ref) => ref.versionKey));

    const roster: TeamRosterRow[] = [...rosterAgg.values()]
      .filter((agg) => agg.matchIds.size > 0)
      .map((agg) => {
        recalculateHltvStyleRating(agg.line);
        return {
          versionKey: agg.ref.versionKey,
          handle: agg.ref.handle,
          realName: agg.ref.realName,
          country: agg.ref.country,
          year: agg.ref.year,
          role: agg.ref.role,
          maps: agg.matchIds.size,
          line: agg.line,
          current: currentKeys.has(agg.ref.versionKey),
        };
      })
      .sort((a, b) => b.line.rating - a.line.rating || b.line.kills - b.line.deaths - (a.line.kills - a.line.deaths));

    return {
      team: latestRef,
      matches: games.length,
      wins,
      losses,
      streak,
      byMap: [...mapRec.values()].sort((a, b) => b.wins + b.losses - (a.wins + a.losses)),
      roster,
      headToHead: [...h2h.values()].sort((a, b) => b.wins + b.losses - (a.wins + a.losses) || b.wins - a.wins),
      history,
    };
  }

  // Career across every stored match, keyed by player VERSION — so a player folds together across
  // teams and runs of the SAME era (a drafted copy + their real-team appearances), while different
  // eras stay separate (FalleN 2018 is a distinct record from FalleN 2026). Optional {side, map} filters.
  playerCareer(versionKey: string, opts: CareerQuery = {}): PlayerCareerRecord | undefined {
    return this.aggregate(versionKey, this.read().matches, opts);
  }

  // All distinct player VERSIONS, most-played first — the persistent player registry. Each era of a
  // player (2018 vs 2026) is its own entry. Reads the matches array ONCE for the whole registry.
  listPlayers(opts: CareerQuery = {}): PlayerCareerRecord[] {
    const matches = this.read().matches;
    const keys = new Set<string>();
    for (const match of matches) for (const ref of match.players) keys.add(ref.versionKey);
    return [...keys]
      .map((key) => this.aggregate(key, matches, opts))
      .filter((career): career is PlayerCareerRecord => Boolean(career))
      .sort((a, b) => b.matches - a.matches || b.line.rating - a.line.rating);
  }

  // Sum one player version's line across the given matches, honouring optional side/map filters. A
  // side filter reads only that side's split and SKIPS records without one (so legacy combined-only
  // records never get double-counted as both CT and T). Returns undefined when nothing contributed.
  private aggregate(versionKey: string, matches: MatchRecord[], opts: CareerQuery): PlayerCareerRecord | undefined {
    const line = emptyLine();
    const teamIds = new Set<string>();
    let matchCount = 0;
    let identity: StoredPlayerRef | undefined;

    for (const match of matches) {
      if (opts.map && match.map !== opts.map) continue;
      const refs = match.players.filter((ref) => ref.versionKey === versionKey);
      if (!refs.length) continue;
      let contributed = false;
      for (const ref of refs) {
        identity = identity ?? ref;
        const matchLine = opts.side ? match.sideBox?.[opts.side]?.[ref.id] : match.box[ref.id];
        if (matchLine) {
          addCounters(line, matchLine);
          teamIds.add(ref.teamId);
          contributed = true;
        }
      }
      if (contributed) matchCount += 1;
    }

    if (!identity || matchCount === 0) return undefined;
    recalculateHltvStyleRating(line); // derive adr/impact/rating once, from the summed counters
    return {
      versionKey,
      handle: identity.handle,
      realName: identity.realName,
      country: identity.country,
      year: identity.year,
      era: identity.era,
      matches: matchCount,
      teamIds: [...teamIds],
      line,
    };
  }
}

export function teamRef(team: { id: string; name: string; tag: string; accent: string; year: string; logo?: string }): StoredTeamRef {
  return { id: team.id, name: team.name, tag: team.tag, accent: team.accent, year: team.year, logo: team.logo };
}

function playerRef(player: Player, side: "left" | "right", teamId: string): StoredPlayerRef {
  return {
    id: player.id,
    canonicalKey: canonicalPlayerKey(player),
    versionKey: playerVersionKey(player),
    handle: player.handle,
    realName: player.realName,
    country: player.country,
    year: player.source?.year,
    era: player.source?.era,
    role: player.role,
    side,
    teamId,
  };
}

// Sum a match line's raw counters into a running career total. The derived adr/impact/rating are
// recomputed ONCE by the caller after the whole sum, not per appearance.
function addCounters(target: PlayerLine, incoming: PlayerLine) {
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
