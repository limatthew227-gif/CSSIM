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

// ---- IndexedDB-backed storage (browser) -----------------------------------------------------------
// localStorage caps at ~5MB, which the Vault outgrows over a long career — old matches then get evicted.
// IndexedDB holds hundreds of MB. We keep the SYNCHRONOUS StorageAdapter contract by mirroring the data
// in memory: reads hit the in-memory cache; writes update it synchronously and persist to IndexedDB in
// the background. `ready` resolves once the full history has loaded from IndexedDB (migrating any old
// localStorage Vault into it on first run). Callers should await `ready` before reading or recording.
const IDB_NAME = "cssim-vault";
const IDB_STORE = "kv";

function openVaultIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function createIdbStorage(keys: string[] = [DB_KEY, LOG_KEY]): { adapter: StorageAdapter; ready: Promise<void> } {
  const cache = new Map<string, string>();
  let dbPromise: Promise<IDBDatabase> | null = null;
  const getDb = () => (dbPromise ??= openVaultIdb());
  const localGet = (key: string) => (typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem(key) : null);

  const ready = (async () => {
    try {
      const db = await getDb();
      for (const key of keys) {
        const stored = (await idbReq(db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key))) as string | undefined;
        if (stored != null) {
          cache.set(key, stored);
        } else {
          // First run on IndexedDB: migrate the existing localStorage Vault across so nothing is lost,
          // then drop the localStorage copy to give that ~5MB budget back to the autosave / save slots.
          const legacy = localGet(key);
          if (legacy != null) {
            cache.set(key, legacy);
            await idbReq(db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).put(legacy, key));
            try {
              window.localStorage.removeItem(key);
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch {
      // IndexedDB unavailable (e.g. private mode) — fall back to whatever localStorage holds.
      for (const key of keys) {
        const legacy = localGet(key);
        if (legacy != null) cache.set(key, legacy);
      }
    }
  })();

  const persist = (key: string, value: string | null) => {
    getDb()
      .then((db) => {
        const store = db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE);
        const req: IDBRequest = value == null ? store.delete(key) : store.put(value, key);
        return idbReq(req);
      })
      .catch(() => {
        // IndexedDB write failed — fall back to localStorage so the write isn't simply lost.
        try {
          if (typeof window === "undefined" || !window.localStorage) return;
          if (value == null) window.localStorage.removeItem(key);
          else window.localStorage.setItem(key, value);
        } catch {
          /* localStorage also failed (quota) — drop it */
        }
      });
  };

  const adapter: StorageAdapter = {
    getItem: (key) => cache.get(key) ?? null,
    setItem: (key, value) => {
      cache.set(key, value);
      persist(key, value);
    },
    removeItem: (key) => {
      cache.delete(key);
      persist(key, null);
    },
  };
  return { adapter, ready };
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

export type TeamEventPlacementTier = "champion" | "runner-up" | "top4" | "top8" | "swiss";

export interface MatchRecord {
  id: string;
  seriesId?: string;
  recordedAt: string; // ISO
  runId?: string;
  eventId?: string;
  eventName?: string;
  season?: number;
  placementTier?: TeamEventPlacementTier;
  eventWins?: number;
  eventLosses?: number;
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
  seriesId?: string;
  recordedAt: string;
  runId?: string;
  eventId?: string;
  eventName?: string;
  season?: number;
  placementTier?: TeamEventPlacementTier;
  eventWins?: number;
  eventLosses?: number;
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

export interface TeamCareerEventInput {
  eventId: string;
  eventName: string;
  season: number;
  tier: TeamEventPlacementTier;
  wins: number;
  losses: number;
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

export interface PlayerRatingAppearance {
  matchId: string;
  recordedAt: string;
  stage?: string;
  map: MapId;
  team: StoredTeamRef;
  opponent: StoredTeamRef;
  teamScore: number;
  oppScore: number;
  won: boolean;
  line: PlayerLine;
}

export interface PlayerRatingExtremes {
  best: PlayerRatingAppearance;
  worst: PlayerRatingAppearance;
}

export interface PlayerOpponentRecord {
  opponent: StoredTeamRef;
  maps: number;
  wins: number;
  losses: number;
  line: PlayerLine;
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

export interface TeamPlayerMatchRow extends TeamMatchRow {
  majorKey: string;
  eventId?: string;
  eventName?: string;
  season?: number;
  line: PlayerLine;
}

export interface TeamPlayerMajorResult {
  key: string;
  label: string;
  placement: string;
  detail: string;
  tone: "champion" | "podium" | "playoffs" | "grouped" | "stage" | "legacy";
  season?: number;
  stage?: string;
  maps: number;
  wins: number;
  losses: number;
  recordedAt: string;
  line: PlayerLine;
}

export interface TeamPlayerProfile {
  team: StoredTeamRef;
  player: TeamRosterRow;
  majors: TeamPlayerMajorResult[];
  history: TeamPlayerMatchRow[];
}

const DB_KEY = "cssim-match-db-v1";
const LOG_KEY = "cssim-match-logs-v1";
const SCHEMA_VERSION = 2; // v2 adds sideBox + a separate log store; v1 records still parse (fields optional)
// Generous ring buffers — backed by IndexedDB (createIdbStorage) the registry has hundreds of MB to work
// with, not localStorage's ~5MB, so a long career keeps its full match history (~100 Majors' worth) and
// far more replays. The caps are now just runaway backstops, not the everyday limit.
const MAX_MATCHES = 3000;
// Event logs are large (hundreds of events per map) and live in their OWN ring buffer, separate from the
// registry, so the registry stays fast and most matches stay replayable.
const MAX_EVENT_LOGS = 150;

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
      seriesId: input.seriesId,
      recordedAt: input.recordedAt,
      runId: input.runId,
      eventId: input.eventId,
      eventName: input.eventName,
      season: input.season,
      placementTier: input.placementTier,
      eventWins: input.eventWins,
      eventLosses: input.eventLosses,
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

  // A completed event used to be recorded again when the circuit advanced its season before clearing
  // matchResults. The copy has different scoped ids but an identical full payload. Remove only exact
  // copies within the same run/event, retaining the earlier event whose timestamps preserve map order.
  removeExactDuplicateRunEvents(): number {
    const db = this.read();
    const scopes = new Map<string, MatchRecord[]>();
    db.matches.forEach((match) => {
      if (!match.runId || match.season == null || !match.eventId) return;
      const scopeKey = `${match.runId}\u0000${match.season}\u0000${match.eventId}`;
      const scope = scopes.get(scopeKey) ?? [];
      scope.push(match);
      scopes.set(scopeKey, scope);
    });

    const orderedScopes = [...scopes.values()].sort((a, b) => {
      const aFirst = a.reduce((first, match) => (match.recordedAt < first ? match.recordedAt : first), a[0]?.recordedAt ?? "");
      const bFirst = b.reduce((first, match) => (match.recordedAt < first ? match.recordedAt : first), b[0]?.recordedAt ?? "");
      return aFirst.localeCompare(bFirst);
    });
    const seen = new Set<string>();
    const duplicateIds = new Set<string>();
    orderedScopes.forEach((matches) => {
      const first = matches[0];
      if (!first?.runId || !first.eventId) return;
      const fingerprint = `${first.runId}\u0000${first.eventId}\u0000${eventPayloadFingerprint(matches)}`;
      if (seen.has(fingerprint)) matches.forEach((match) => duplicateIds.add(match.id));
      else seen.add(fingerprint);
    });
    if (!duplicateIds.size) return 0;

    try {
      this.write({
        schemaVersion: SCHEMA_VERSION,
        matches: db.matches.filter((match) => !duplicateIds.has(match.id)),
      });
    } catch {
      return 0;
    }

    try {
      const logs = this.readLogs();
      if (logs.logs.some((entry) => duplicateIds.has(entry.id))) {
        this.writeLogs({
          schemaVersion: SCHEMA_VERSION,
          logs: logs.logs.filter((entry) => !duplicateIds.has(entry.id)),
        });
      }
    } catch {
      // The match registry is authoritative; a stale replay entry is harmless if log cleanup fails.
    }
    return duplicateIds.size;
  }

  // Older saves recorded box scores before Vault records carried run/event/season metadata. Rebuild
  // those completed event boundaries from the save's career ledger, assigning whole series from the
  // newest completed event backwards. Current in-progress match ids can be excluded by the caller.
  backfillTeamCareerEvents(
    teamId: string,
    runId: string,
    events: readonly TeamCareerEventInput[],
    excludeMatchIds: ReadonlySet<string> = new Set<string>(),
  ): number {
    if (!events.length) return 0;
    const db = this.read();
    let updated = 0;
    const completedKeys = new Set<string>();
    events.forEach((event) => {
      const taggedMatches = db.matches.filter(
        (match) =>
          match.runId === runId &&
          match.season === event.season &&
          match.eventId === event.eventId &&
          (match.left.id === teamId || match.right.id === teamId),
      );
      const expectedSeries = event.wins + event.losses + playoffSeriesForTier(event.eventId, event.tier);
      const taggedSeries = new Set(taggedMatches.map((match) => match.seriesId ?? inferLegacySeriesId(match))).size;
      if (expectedSeries <= 0 || taggedSeries < expectedSeries) {
        taggedMatches.forEach((match) => {
          if (match.placementTier == null && match.eventWins == null && match.eventLosses == null) return;
          delete match.placementTier;
          delete match.eventWins;
          delete match.eventLosses;
          updated += 1;
        });
        return;
      }
      completedKeys.add(`${event.season}:${event.eventId}`);
      taggedMatches.forEach((match) => {
        if (
          match.eventName === event.eventName &&
          match.placementTier === event.tier &&
          match.eventWins === event.wins &&
          match.eventLosses === event.losses
        ) {
          return;
        }
        match.eventName = event.eventName;
        match.placementTier = event.tier;
        match.eventWins = event.wins;
        match.eventLosses = event.losses;
        updated += 1;
      });
    });
    const pendingEvents = events.filter((event) => !completedKeys.has(`${event.season}:${event.eventId}`));

    const legacyMatches = db.matches
      .map((match, index) => ({ match, index }))
      .filter(
        ({ match }) =>
          !match.runId &&
          match.season == null &&
          !excludeMatchIds.has(match.id) &&
          (match.left.id === teamId || match.right.id === teamId),
      )
      .sort((a, b) => a.match.recordedAt.localeCompare(b.match.recordedAt) || a.index - b.index);

    const groups: Array<{ key: string; matches: MatchRecord[] }> = [];
    legacyMatches.forEach(({ match }) => {
      const key = match.seriesId ?? inferLegacySeriesId(match);
      const current = groups[groups.length - 1];
      if (current?.key === key) current.matches.push(match);
      else groups.push({ key, matches: [match] });
    });

    let cursor = groups.length;
    for (let eventIndex = pendingEvents.length - 1; eventIndex >= 0 && cursor > 0; eventIndex -= 1) {
      const event = pendingEvents[eventIndex];
      const expectedSeries = event.wins + event.losses + playoffSeriesForTier(event.eventId, event.tier);
      if (expectedSeries <= 0) continue;
      if (cursor < expectedSeries) break;
      const start = cursor - expectedSeries;
      groups.slice(start, cursor).forEach((group, groupIndex) => {
        group.matches.forEach((match) => {
          match.runId = runId;
          match.eventId = event.eventId;
          match.eventName = event.eventName;
          match.season = event.season;
          match.placementTier = event.tier;
          match.eventWins = event.wins;
          match.eventLosses = event.losses;
          match.seriesId = `${runId}:${event.season}:${event.eventId}:${groupIndex}:${group.key}`;
          updated += 1;
        });
      });
      cursor = start;
    }
    if (!updated) return 0;

    try {
      this.write({ schemaVersion: SCHEMA_VERSION, matches: db.matches });
      return updated;
    } catch {
      return 0;
    }
  }

  // Last-resort repair for Vault records that outlived their save slot. Series ids encode the Swiss
  // round/playoff round, so a reset back to round one marks a new stage. Consecutive 3-win Swiss
  // stages are folded into the same Major before the final placement is assigned.
  inferLegacyTeamCareerEvents(
    teamId: string,
    runId: string = "legacy-inferred",
    excludeMatchIds: ReadonlySet<string> = new Set<string>(),
  ): number {
    const db = this.read();
    const legacyMatches = db.matches
      .map((match, index) => ({ match, index }))
      .filter(
        ({ match }) =>
          !match.runId &&
          match.season == null &&
          !excludeMatchIds.has(match.id) &&
          (match.left.id === teamId || match.right.id === teamId),
      )
      .sort((a, b) => a.match.recordedAt.localeCompare(b.match.recordedAt) || a.index - b.index);
    if (!legacyMatches.length) return 0;

    const seriesGroups: LegacySeriesGroup[] = [];
    legacyMatches.forEach(({ match }) => {
      const key = match.seriesId ?? inferLegacySeriesId(match);
      const current = seriesGroups[seriesGroups.length - 1];
      if (current?.key === key) current.matches.push(match);
      else seriesGroups.push({ key, matches: [match] });
    });

    const stageSegments: LegacySeriesGroup[][] = [];
    seriesGroups.forEach((group) => {
      const current = stageSegments[stageSegments.length - 1];
      if (!current || startsNewLegacyStage(current[current.length - 1], group)) stageSegments.push([group]);
      else current.push(group);
    });

    const majors: LegacySeriesGroup[][] = [];
    let currentMajor: LegacySeriesGroup[] = [];
    stageSegments.forEach((segment) => {
      currentMajor.push(...segment);
      if (!legacySegmentAdvanced(teamId, segment)) {
        majors.push(currentMajor);
        currentMajor = [];
      }
    });
    if (currentMajor.length) majors.push(currentMajor);

    let updated = 0;
    majors.forEach((groups, majorIndex) => {
      const season = majorIndex + 1;
      const segments = stageSegmentsForMajor(groups);
      const finalSegment = segments[segments.length - 1] ?? groups;
      const tier = inferLegacyPlacementTier(teamId, finalSegment);
      const swissGroups = finalSegment.filter((group) => group.matches[0]?.stage === "swiss");
      const eventWins = swissGroups.filter((group) => seriesOutcome(teamId, group) === "win").length;
      const eventLosses = swissGroups.filter((group) => seriesOutcome(teamId, group) === "loss").length;
      const hasPlayoffs = groups.some((group) => group.matches[0]?.stage !== "swiss");
      const segmentCount = segments.length;
      const eventId = hasPlayoffs || segmentCount === 1 ? "major" : `stage-${Math.min(segmentCount, 3)}`;
      const eventName = `Major ${season}`;

      groups.forEach((group, seriesIndex) => {
        group.matches.forEach((match) => {
          match.runId = runId;
          match.eventId = eventId;
          match.eventName = eventName;
          match.season = season;
          match.placementTier = tier;
          match.eventWins = eventWins;
          match.eventLosses = eventLosses;
          match.seriesId = `${runId}:${season}:${eventId}:${seriesIndex}:${group.key}`;
          updated += 1;
        });
      });
    });
    if (!updated) return 0;

    try {
      this.write({ schemaVersion: SCHEMA_VERSION, matches: db.matches });
      return updated;
    } catch {
      return 0;
    }
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

  // A roster player's complete record for one organization, including former players. A Major finish
  // is credited only when the event has enough series to prove that placement and the player appeared
  // in every stored team map for that Major.
  teamPlayerProfile(teamId: string, versionKey: string): TeamPlayerProfile | undefined {
    const profile = this.teamProfile(teamId);
    const player = profile?.roster.find((row) => row.versionKey === versionKey);
    if (!profile || !player) return undefined;

    const matches = this.read().matches;
    const teamMatches = matches.filter((match) => match.left.id === teamId || match.right.id === teamId);
    const playerMatches = teamMatches.flatMap((match) => {
      const ref = match.players.find((entry) => entry.teamId === teamId && entry.versionKey === versionKey);
      const line = ref ? match.box[ref.id] : undefined;
      return ref && line ? [{ match, line }] : [];
    });
    if (!playerMatches.length) return undefined;

    const majorKeys = teamMajorInstanceKeys(teamId, teamMatches);
    const majorKey = (match: MatchRecord) => majorKeys.get(match.id) ?? "legacy";
    const playerMajorKeys = new Set(playerMatches.map(({ match }) => majorKey(match)));
    const majors = [...playerMajorKeys]
      .map((key) => {
        const appearances = playerMatches.filter(({ match }) => majorKey(match) === key);
        const majorTeamMatches = teamMatches.filter((match) => majorKey(match) === key);
        return buildTeamPlayerMajorResult(teamId, key, appearances, majorTeamMatches);
      })
      .filter((major): major is TeamPlayerMajorResult => Boolean(major))
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

    const history: TeamPlayerMatchRow[] = playerMatches
      .map(({ match, line }) => {
        const isLeft = match.left.id === teamId;
        return {
          matchId: match.id,
          majorKey: majorKey(match),
          recordedAt: match.recordedAt,
          map: match.map,
          stage: match.stage,
          eventId: match.eventId,
          eventName: match.eventName,
          season: match.season,
          opponent: isLeft ? match.right : match.left,
          teamScore: isLeft ? match.leftScore : match.rightScore,
          oppScore: isLeft ? match.rightScore : match.leftScore,
          won: match.winnerId === teamId,
          line,
        };
      })
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

    return { team: profile.team, player, majors, history };
  }

  // Career across every stored match, keyed by player VERSION — so a player folds together across
  // teams and runs of the SAME era (a drafted copy + their real-team appearances), while different
  // eras stay separate (FalleN 2018 is a distinct record from FalleN 2026). Optional {side, map} filters.
  playerCareer(versionKey: string, opts: CareerQuery = {}): PlayerCareerRecord | undefined {
    return this.aggregate(versionKey, this.read().matches, opts);
  }

  // Highest and lowest single-map ratings for one player version across the persistent Vault. Equal
  // ratings resolve to the most recently recorded map so the record card shows the latest occurrence.
  playerRatingExtremes(versionKey: string): PlayerRatingExtremes | undefined {
    let best: PlayerRatingAppearance | undefined;
    let worst: PlayerRatingAppearance | undefined;

    for (const match of this.read().matches) {
      for (const ref of match.players.filter((player) => player.versionKey === versionKey)) {
        const line = match.box[ref.id];
        if (!line) continue;
        const isLeft = ref.side === "left";
        const team = isLeft ? match.left : match.right;
        const opponent = isLeft ? match.right : match.left;
        const appearance: PlayerRatingAppearance = {
          matchId: match.id,
          recordedAt: match.recordedAt,
          stage: match.stage,
          map: match.map,
          team,
          opponent,
          teamScore: isLeft ? match.leftScore : match.rightScore,
          oppScore: isLeft ? match.rightScore : match.leftScore,
          won: match.winnerId === team.id,
          line,
        };
        const isNewerBest = best && appearance.recordedAt >= best.recordedAt;
        const isNewerWorst = worst && appearance.recordedAt >= worst.recordedAt;
        if (!best || line.rating > best.line.rating || (line.rating === best.line.rating && isNewerBest)) best = appearance;
        if (!worst || line.rating < worst.line.rating || (line.rating === worst.line.rating && isNewerWorst)) worst = appearance;
      }
    }

    return best && worst ? { best, worst } : undefined;
  }

  // One player's persistent record against every opponent. This follows the same version boundary as
  // playerCareer, so roster moves fold together while distinct historical eras remain separate.
  playerOpponentRecords(versionKey: string): PlayerOpponentRecord[] {
    const rows = new Map<string, PlayerOpponentRecord>();

    for (const match of this.read().matches) {
      for (const ref of match.players.filter((player) => player.versionKey === versionKey)) {
        const matchLine = match.box[ref.id];
        if (!matchLine) continue;
        const isLeft = ref.side === "left";
        const team = isLeft ? match.left : match.right;
        const opponent = isLeft ? match.right : match.left;
        const row = rows.get(opponent.id) ?? {
          opponent,
          maps: 0,
          wins: 0,
          losses: 0,
          line: emptyLine(),
        };
        row.opponent = opponent;
        row.maps += 1;
        if (match.winnerId === team.id) row.wins += 1;
        else row.losses += 1;
        addCounters(row.line, matchLine);
        rows.set(opponent.id, row);
      }
    }

    return [...rows.values()]
      .map((row) => {
        recalculateHltvStyleRating(row.line);
        return row;
      })
      .sort((a, b) => b.maps - a.maps || b.line.rating - a.line.rating || a.opponent.name.localeCompare(b.opponent.name));
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

const majorStageOrder: Record<string, number> = { mrq: 0, "stage-1": 1, "stage-2": 2, "stage-3": 3, major: 3 };
const majorStageLabel: Record<string, string> = {
  mrq: "MRQ",
  "stage-1": "Stage 1",
  "stage-2": "Stage 2",
  "stage-3": "Stage 3",
  major: "Major",
};

interface LegacySeriesGroup {
  key: string;
  matches: MatchRecord[];
}

function teamMajorInstanceKeys(teamId: string, teamMatches: MatchRecord[]): Map<string, string> {
  const keys = new Map<string, string>();
  const scopes = new Map<string, Array<{ match: MatchRecord; index: number }>>();
  teamMatches.forEach((match, index) => {
    if (!match.runId || match.season == null) {
      keys.set(match.id, "legacy");
      return;
    }
    const scopeKey = `${match.runId}:major:${match.season}`;
    const scope = scopes.get(scopeKey) ?? [];
    scope.push({ match, index });
    scopes.set(scopeKey, scope);
  });

  scopes.forEach((rows, scopeKey) => {
    rows.sort((a, b) => a.match.recordedAt.localeCompare(b.match.recordedAt) || a.index - b.index);
    if (rows.some(({ match }) => match.placementTier != null)) {
      rows.forEach(({ match }) => keys.set(match.id, scopeKey));
      return;
    }

    const seriesGroups: LegacySeriesGroup[] = [];
    rows.forEach(({ match }) => {
      const seriesKey = match.seriesId ?? inferLegacySeriesId(match);
      const current = seriesGroups[seriesGroups.length - 1];
      if (current?.key === seriesKey) current.matches.push(match);
      else seriesGroups.push({ key: seriesKey, matches: [match] });
    });

    const instances: LegacySeriesGroup[][] = [];
    seriesGroups.forEach((group) => {
      const current = instances[instances.length - 1];
      if (!current || startsNewTeamMajor(teamId, current, group)) instances.push([group]);
      else current.push(group);
    });

    instances.forEach((groups, index) => {
      const instanceKey = instances.length === 1 ? scopeKey : `${scopeKey}:event:${index + 1}`;
      groups.forEach((group) => group.matches.forEach((match) => keys.set(match.id, instanceKey)));
    });
  });

  return keys;
}

function startsNewTeamMajor(teamId: string, current: LegacySeriesGroup[], next: LegacySeriesGroup): boolean {
  const previous = current[current.length - 1];
  const previousMatch = previous.matches[0];
  const nextMatch = next.matches[0];
  if (!previousMatch || !nextMatch) return false;
  if (teamMajorEnded(teamId, current)) return true;

  const previousEventOrder = majorStageOrder[previousMatch.eventId ?? "major"];
  const nextEventOrder = majorStageOrder[nextMatch.eventId ?? "major"];
  if (previousEventOrder != null && nextEventOrder != null && nextEventOrder < previousEventOrder) return true;

  const previousStageOrder = majorStageOrderForSeries(previousMatch.stage);
  const nextStageOrder = majorStageOrderForSeries(nextMatch.stage);
  if (previousStageOrder > 1 && nextStageOrder === 1) return true;
  if (previousStageOrder > 1 && nextStageOrder > 1 && nextStageOrder <= previousStageOrder) return true;

  if (nextMatch.stage !== "swiss") return false;
  const sameEvent = (previousMatch.eventId ?? "major") === (nextMatch.eventId ?? "major");
  if (!sameEvent) return false;
  const swissSegment = trailingSwissSegment(current, previousMatch.eventId ?? "major");
  const wins = swissSegment.filter((group) => seriesOutcome(teamId, group) === "win").length;
  const losses = swissSegment.filter((group) => seriesOutcome(teamId, group) === "loss").length;
  if (losses >= 3) return true;
  if (wins >= 3) return false;

  const previousRound = legacySeriesRound(previous);
  const nextRound = legacySeriesRound(next);
  return previousRound != null && nextRound != null && nextRound <= previousRound;
}

function teamMajorEnded(teamId: string, current: LegacySeriesGroup[]): boolean {
  const previousGroup = current[current.length - 1];
  const previous = previousGroup?.matches[0];
  if (!previous) return false;
  const outcome = seriesOutcome(teamId, previousGroup);
  if (previous.stage === "final" && outcome !== "unknown") return true;
  if (
    (previous.stage === "quarterfinal" || previous.stage === "semifinal") &&
    outcome === "loss"
  ) {
    return true;
  }
  if (previous.stage !== "swiss") return false;
  const swissSegment = trailingSwissSegment(current, previous.eventId ?? "major");
  const losses = swissSegment.filter((group) => seriesOutcome(teamId, group) === "loss").length;
  return losses >= 3;
}

function trailingSwissSegment(groups: LegacySeriesGroup[], eventId: string): LegacySeriesGroup[] {
  const segment: LegacySeriesGroup[] = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    const match = group.matches[0];
    if (!match || match.stage !== "swiss" || (match.eventId ?? "major") !== eventId) break;
    segment.unshift(group);
  }
  return segment;
}

function inferLegacySeriesId(match: MatchRecord): string {
  const suffix = `-${match.map}-`;
  const suffixIndex = match.id.lastIndexOf(suffix);
  if (suffixIndex < 0) return match.id;
  const mapIndex = match.id.slice(suffixIndex + suffix.length);
  return /^\d+$/.test(mapIndex) ? match.id.slice(0, suffixIndex) : match.id;
}

function logicalMatchId(match: MatchRecord): string {
  if (!match.runId || !match.id.startsWith(`${match.runId}:`)) return match.id;
  const runScoped = match.id.slice(match.runId.length + 1);
  const eventScoped = match.season != null && match.eventId ? `${match.season}:${match.eventId}:` : "";
  return eventScoped && runScoped.startsWith(eventScoped) ? runScoped.slice(eventScoped.length) : runScoped;
}

function eventPayloadFingerprint(matches: MatchRecord[]): string {
  return matches
    .map((match) => {
      const box = Object.entries(match.box)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, line]) => [
          id,
          line.kills,
          line.deaths,
          line.assists,
          line.damage,
          line.rounds,
          line.kastRounds,
          line.firstKills,
          line.firstDeaths,
          line.multiKills,
          line.clutchWins,
          line.rating,
        ]);
      return JSON.stringify([
        logicalMatchId(match),
        match.eventName ?? "",
        match.placementTier ?? "",
        match.eventWins ?? "",
        match.eventLosses ?? "",
        match.stage ?? "",
        match.map,
        match.left.id,
        match.right.id,
        match.leftScore,
        match.rightScore,
        match.winnerId,
        box,
      ]);
    })
    .sort()
    .join("\u0001");
}

function legacySeriesRound(group: LegacySeriesGroup): number | undefined {
  const matches = [...group.key.matchAll(/(?:^|:)(\d+)-/g)];
  const match = matches[matches.length - 1];
  return match ? Number(match[1]) : undefined;
}

function seriesOutcome(teamId: string, group: LegacySeriesGroup): "win" | "loss" | "unknown" {
  const wins = group.matches.filter((match) => match.winnerId === teamId).length;
  const losses = group.matches.length - wins;
  const stage = group.matches[0]?.stage;
  const mapsNeeded = stage === "final" && group.matches.length > 1 ? 3 : group.matches.length > 1 ? 2 : 1;
  if (wins >= mapsNeeded) return "win";
  if (losses >= mapsNeeded) return "loss";
  return "unknown";
}

function startsNewLegacyStage(previous: LegacySeriesGroup, current: LegacySeriesGroup): boolean {
  const previousRound = legacySeriesRound(previous);
  const currentRound = legacySeriesRound(current);
  if (previousRound != null && currentRound != null) return currentRound <= previousRound;
  const previousStage = majorStageOrderForSeries(previous.matches[0]?.stage);
  const currentStage = majorStageOrderForSeries(current.matches[0]?.stage);
  return currentStage < previousStage || (currentStage === previousStage && currentStage > 0);
}

function majorStageOrderForSeries(stage?: string): number {
  if (stage === "quarterfinal") return 6;
  if (stage === "semifinal") return 7;
  if (stage === "final") return 8;
  return 1;
}

function legacySegmentAdvanced(teamId: string, segment: LegacySeriesGroup[]): boolean {
  if (segment.some((group) => group.matches[0]?.stage !== "swiss")) return false;
  const wins = segment.filter((group) => seriesOutcome(teamId, group) === "win").length;
  const losses = segment.filter((group) => seriesOutcome(teamId, group) === "loss").length;
  return wins >= 3 && losses < 3;
}

function stageSegmentsForMajor(groups: LegacySeriesGroup[]): LegacySeriesGroup[][] {
  const segments: LegacySeriesGroup[][] = [];
  groups.forEach((group) => {
    const current = segments[segments.length - 1];
    if (!current || startsNewLegacyStage(current[current.length - 1], group)) segments.push([group]);
    else current.push(group);
  });
  return segments;
}

function inferLegacyPlacementTier(teamId: string, groups: LegacySeriesGroup[]): TeamEventPlacementTier {
  const final = groups.find((group) => group.matches[0]?.stage === "final");
  if (final) {
    const outcome = seriesOutcome(teamId, final);
    if (outcome !== "unknown") return outcome === "win" ? "champion" : "runner-up";
  }
  if (groups.some((group) => group.matches[0]?.stage === "semifinal" && seriesOutcome(teamId, group) === "loss")) return "top4";
  if (groups.some((group) => group.matches[0]?.stage === "quarterfinal" && seriesOutcome(teamId, group) === "loss")) return "top8";
  return "swiss";
}

function playoffSeriesForTier(eventId: string, tier: TeamCareerEventInput["tier"]): number {
  if (eventId !== "stage-3" && eventId !== "major") return 0;
  return playoffSeriesForPlacement(tier);
}

function playoffSeriesForPlacement(tier?: TeamEventPlacementTier): number {
  if (tier === "champion" || tier === "runner-up") return 3;
  if (tier === "top4") return 2;
  if (tier === "top8") return 1;
  return 0;
}

function buildTeamPlayerMajorResult(
  teamId: string,
  key: string,
  appearances: Array<{ match: MatchRecord; line: PlayerLine }>,
  teamMatches: MatchRecord[],
): TeamPlayerMajorResult | undefined {
  if (key === "legacy" || !appearances.length || !teamMatches.length) return undefined;
  const appearanceIds = new Set(appearances.map(({ match }) => match.id));
  if (teamMatches.some((match) => !appearanceIds.has(match.id))) return undefined;

  const highestEventId = teamMatches
    .map((match) => match.eventId ?? "major")
    .sort((a, b) => (majorStageOrder[b] ?? -1) - (majorStageOrder[a] ?? -1))[0] ?? "major";
  const stageMatches = teamMatches.filter((match) => (match.eventId ?? "major") === highestEventId);
  if (!stageMatches.length) return undefined;
  const groupSeries = (matches: MatchRecord[]) => {
    const groups = new Map<string, LegacySeriesGroup>();
    matches.forEach((match) => {
      const seriesKey = match.seriesId ?? inferLegacySeriesId(match);
      const group = groups.get(seriesKey) ?? { key: seriesKey, matches: [] };
      group.matches.push(match);
      groups.set(seriesKey, group);
    });
    return [...groups.values()];
  };
  const allSeries = groupSeries(teamMatches);
  const stageSeries = groupSeries(stageMatches);
  const swiss = stageSeries.filter((group) => group.matches[0]?.stage === "swiss");
  const swissWins = swiss.filter((group) => seriesOutcome(teamId, group) === "win").length;
  const swissLosses = swiss.filter((group) => seriesOutcome(teamId, group) === "loss").length;
  const savedTier = stageMatches.find((match) => match.placementTier)?.placementTier;
  const eventWins = stageMatches.find((match) => match.eventWins != null)?.eventWins ?? swissWins;
  const eventLosses = stageMatches.find((match) => match.eventLosses != null)?.eventLosses ?? swissLosses;
  const lostIn = (stage: string) =>
    allSeries.some(
      (group) =>
        group.matches[0]?.stage === stage &&
        seriesOutcome(teamId, group) === "loss",
    );
  const final = [...allSeries].reverse().find((group) => group.matches[0]?.stage === "final");
  const finalOutcome = final ? seriesOutcome(teamId, final) : "unknown";
  const playoffTier: TeamEventPlacementTier | undefined = finalOutcome !== "unknown"
    ? finalOutcome === "win"
      ? "champion"
      : "runner-up"
    : lostIn("semifinal")
      ? "top4"
      : lostIn("quarterfinal")
        ? "top8"
        : undefined;
  const expectedSavedSeries = savedTier
    ? eventWins + eventLosses + playoffSeriesForTier(highestEventId, savedTier)
    : 0;
  const savedTierComplete = Boolean(savedTier && expectedSavedSeries > 0 && stageSeries.length >= expectedSavedSeries);
  const resolvedTier =
    (savedTierComplete ? savedTier : undefined) ??
    playoffTier ??
    (swissLosses >= 3
      ? "swiss"
      : highestEventId !== "stage-3" && highestEventId !== "major" && swissWins >= 3
        ? "top8"
        : undefined);
  if (!resolvedTier) return undefined;
  if (savedTier && !savedTierComplete) return undefined;
  const expectedSwissSeries = eventWins + eventLosses;
  const expectedPlayoffSeries = playoffSeriesForPlacement(playoffTier);
  const playoffSeries = allSeries.filter((group) => group.matches[0]?.stage !== "swiss");
  if (!savedTierComplete && !playoffTier && expectedSwissSeries > 0 && swiss.length < expectedSwissSeries) return undefined;
  if (!savedTierComplete && expectedPlayoffSeries > 0 && playoffSeries.length < expectedPlayoffSeries) return undefined;
  if (expectedSwissSeries <= 0 && expectedPlayoffSeries <= 0) return undefined;

  const line = emptyLine();
  appearances.forEach(({ line: appearance }) => addCounters(line, appearance));
  recalculateHltvStyleRating(line);
  const wins = appearances.filter(({ match }) => match.winnerId === teamId).length;
  const losses = appearances.length - wins;
  const recordedAt = appearances.reduce((latest, { match }) => (match.recordedAt > latest ? match.recordedAt : latest), "");
  const season = appearances.find(({ match }) => match.season != null)?.match.season;
  const stageLabel = majorStageLabel[highestEventId] ?? stageMatches[0]?.eventName ?? "Major";
  const label = stageMatches[0]?.eventName ?? (season != null ? `Major ${season}` : "Major");

  let placement = stageLabel;
  let detail = `${stageLabel} results`;
  let tone: TeamPlayerMajorResult["tone"] = "stage";
  if (resolvedTier === "champion") {
    placement = "1st";
    detail = "Champion";
    tone = "champion";
  } else if (resolvedTier === "runner-up") {
    placement = "2nd";
    detail = "Runner-up";
    tone = "podium";
  } else if (resolvedTier === "top4") {
    placement = "3-4th";
    detail = "Semifinal";
    tone = "podium";
  } else if (resolvedTier === "top8") {
    placement = "5-8th";
    detail = "Quarterfinal";
    tone = "playoffs";
  } else if ((highestEventId === "stage-3" || highestEventId === "major") && resolvedTier === "swiss") {
    placement = eventWins >= 2 ? "9-11th" : eventWins === 1 ? "12-14th" : "15-16th";
    detail = `Grouped · ${eventWins}-${eventLosses} in ${stageLabel}`;
    tone = "grouped";
  } else if (eventLosses >= 3) {
    placement = stageLabel;
    detail = `Eliminated · ${eventWins}-${eventLosses}`;
  } else if (eventWins >= 3) {
    placement = "Advanced";
    detail = `${stageLabel} · ${eventWins}-${eventLosses}`;
    tone = "playoffs";
  } else {
    placement = stageLabel;
    detail = `${eventWins}-${eventLosses} in progress`;
  }

  return {
    key,
    label,
    placement,
    detail,
    tone,
    season,
    stage: stageLabel,
    maps: appearances.length,
    wins,
    losses,
    recordedAt,
    line,
  };
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
