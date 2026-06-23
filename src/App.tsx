import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  Award,
  Ban,
  CheckCircle2,
  Clock3,
  Crosshair,
  Database,
  Dice5,
  Download,
  Eye,
  FastForward,
  Flame,
  Gauge,
  Pause,
  Play,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  Shield,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Trash2,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import {
  Coach,
  CustomSettings,
  Difficulty,
  Era,
  MapId,
  Player,
  PlayerStats,
  Roster,
  Role,
  SourceTeam,
  Style,
  defaultSettings,
  difficulties,
  mapPool,
  rateStatsForRole,
  ovrBreakdown,
  type OvrBreakdown,
} from "./gameData";
import {
  FieldTeam,
  MatchState,
  Tactic,
  type BuyCall,
  type RoundStyleCall,
  VetoState,
  applyOpponentVeto,
  applyUserBan,
  averageOvr,
  composeTactic,
  composition,
  createVeto,
  draftedTeam,
  initMatch,
  mapEdge,
  mapName,
  playerCallFitScore,
  playRound,
  parseTactic,
  resultNotes,
  requiredRoles,
  recalculateHltvStyleRating,
  teamStrength,
  teamStrengthBreakdown,
  explainRoundProbability,
  toFieldTeam,
  type StrengthBreakdown,
  type RoundProbabilityExplanation,
  type RoundScenario,
} from "./sim";
import { hltvTop20Coaches, hltvTop20Rosters } from "./hltvTop20";
import { playerPhoto } from "./playerPhotos";
import { simulateRadarPlayers, MAP_LAYOUTS, getStepDelay } from "./radarSim";
import { mapGeometries, hasPixelNav } from "./mapGeometry";
import {
  deleteRunSlot,
  formatRunSlotTime,
  loadRunSlots,
  saveRunSlot,
  type RunSummary,
  type SavedRunSlot,
} from "./runDatabase";
import { eventLogFromMatchState, type MatchEvent, type MatchEventLog, type MatchEventTeam } from "./matchEvents";
import { buildReplayTimeline, replayRoundDuration, visibleEntries, type TimelineEntry } from "./replayTimeline";
import {
  analyzeEventLogs,
  matchInsightLeaders,
  mergePlayerAnalytics,
  formatMultiKills,
  formatClutches,
  type PlayerAnalytics,
} from "./matchAnalytics";
import { canonicalPlayerKey, playerInstanceKey, playerVersionKey } from "./playerIdentity";
import { validateRoster, validateDataset, type ValidationIssue } from "./validation";
import {
  MatchDatabase,
  memoryStorage,
  teamRef,
  type StorageAdapter,
  type PlayerCareerRecord,
  type MatchRecord,
  type TeamRecordRow,
  type RecordMatchInput,
} from "./matchDatabase";
import "./styles.css";

import mirageRadar from "./assets/radar/mirage.png";
import infernoRadar from "./assets/radar/inferno.png";
import dust2Radar from "./assets/radar/dust2.png";
import nukeRadar from "./assets/radar/nuke.png";
import ancientRadar from "./assets/radar/ancient.png";
import trainRadar from "./assets/radar/train.png";

const radarImages: Record<string, string> = {
  mirage: mirageRadar,
  inferno: infernoRadar,
  dust2: dust2Radar,
  nuke: nukeRadar,
  ancient: ancientRadar,
  train: trainRadar,
};

import ak47Icon from "./assets/weapons/ak47.svg";
import awpIcon from "./assets/weapons/awp.svg";
import deagleIcon from "./assets/weapons/deagle.svg";
import famasIcon from "./assets/weapons/famas.svg";
import galilarIcon from "./assets/weapons/galilar.svg";
import glockIcon from "./assets/weapons/glock.svg";
import m4a1Icon from "./assets/weapons/m4a1.svg";
import m4a1SilencerIcon from "./assets/weapons/m4a1_silencer.svg";
import mac10Icon from "./assets/weapons/mac10.svg";
import mp9Icon from "./assets/weapons/mp9.svg";
import p250Icon from "./assets/weapons/p250.svg";
import uspSilencerIcon from "./assets/weapons/usp_silencer.svg";

import flashIcon from "./assets/utility/flash.svg";
import smokeIcon from "./assets/utility/smoke.svg";
import molotovIcon from "./assets/utility/molotov.svg";
import heIcon from "./assets/utility/he.svg";

const weaponIcons: Record<string, string> = {
  "AK-47": ak47Icon,
  "M4A4": m4a1Icon,
  "M4A1-S": m4a1SilencerIcon,
  "AWP": awpIcon,
  "Galil AR": galilarIcon,
  "Galil": galilarIcon,
  "Famas": famasIcon,
  "MAC-10": mac10Icon,
  "MP9": mp9Icon,
  "Desert Eagle": deagleIcon,
  "USP-S": uspSilencerIcon,
  "Glock-18": glockIcon,
  "P250": p250Icon,
};

const utilityIcons: Record<string, string> = {
  flash: flashIcon,
  smoke: smokeIcon,
  molotov: molotovIcon,
  he: heIcon,
};

const utilityLabels: Record<string, string> = {
  flash: "popped a flashbang",
  smoke: "deployed smoke",
  molotov: "threw a molotov",
  he: "threw an HE grenade",
};

const COACH_SHORTLIST_SIZE = 5;
const ROUND_STYLE_OPTIONS: Array<{ id: RoundStyleCall; label: string }> = [
  { id: "standard", label: "Standard" },
  { id: "aggressive", label: "Aggro" },
  { id: "cautious", label: "Cautious" },
];
const BUY_CALL_OPTIONS: Array<{ id: BuyCall; label: string }> = [
  { id: "normal", label: "Normal" },
  { id: "force", label: "Force" },
  { id: "save", label: "Save" },
];

type Screen = "setup" | "teams" | "draft" | "coach" | "swiss" | "playoffs" | "veto" | "match" | "result" | "stats" | "results" | "series-detail" | "player-detail" | "team-detail" | "balance-lab" | "vault" | "vault-replay";
type Mode = "classic" | "blind" | "random" | "spectator";
type RunKind = "player" | "spectator";
type SwissRecord = { wins: number; losses: number };
type TimeoutPlan = { boost: number; rounds: number };
type TournamentPhase = "swiss" | "playoffs";
type PlayoffRound = "quarterfinal" | "semifinal" | "final";
type TournamentOutcome = "running" | "eliminated" | "champion" | "complete";
type SeriesStage = "swiss" | PlayoffRound;
type StatsSideFilter = "both" | "T" | "CT";
type StatsMapFilter = "all" | number;
type StatsScope = "all" | "mine";
type LiveFeedView = "feed" | "map";
type TeamLabView = "builder" | "scout" | "integrity";
type ScoutSortKey = "ovr" | "hltv" | "audit" | "aim" | "clutch" | "consistency" | "awp" | "igl" | "team";
type ScoutAuditSeverity = "danger" | "warn" | "info";

interface TeamFormPlayer {
  handle: string;
  realName: string;
  country: string;
  role: Role;
  style: Style;
  aim: number;
  clutch: number;
  consistency: number;
  awp: number;
  igl: number;
}

interface TeamForm {
  tag: string;
  name: string;
  country: string;
  era: Era;
  year: string;
  accent: string;
  tagline: string;
  mapBase: Record<MapId, number>;
  players: TeamFormPlayer[];
}

interface SwissPair {
  id: string;
  left: FieldTeam;
  right: FieldTeam;
  active?: boolean;
}

type TimelineSide = "left" | "right";

interface SeriesMapResult {
  map: MapId;
  leftScore: number;
  rightScore: number;
  winnerId: string;
  eventLog?: MatchEventLog;
  roundWinners?: TimelineSide[];
  leftStats: MatchState["yourStats"];
  rightStats: MatchState["yourStats"];
  leftSideStats: Record<"CT" | "T", MatchState["yourStats"]>;
  rightSideStats: Record<"CT" | "T", MatchState["yourStats"]>;
}

interface RoundTimelineMap {
  key: string;
  map: MapId;
  leftScore: number;
  rightScore: number;
  roundWinners?: TimelineSide[];
  activeRound?: number;
}

interface SwissResult {
  id: string;
  pairId: string;
  round: number;
  stage: SeriesStage;
  laneKey?: string;
  label: string;
  bestOf: number;
  left: FieldTeam;
  right: FieldTeam;
  leftScore: number;
  rightScore: number;
  winnerId: string;
  maps: SeriesMapResult[];
  leftStats: MatchState["yourStats"];
  rightStats: MatchState["yourStats"];
  played: boolean;
}

interface SwissLaneResult {
  laneKey: string;
  result: SwissResult;
}

interface ActiveSeries {
  id: string;
  pairId: string;
  round: number;
  stage: SeriesStage;
  laneKey?: string;
  label: string;
  bestOf: number;
  maps: MapId[];
  currentMapIndex: number;
  left: FieldTeam;
  right: FieldTeam;
  mapResults: SeriesMapResult[];
}

interface PlayerDatabaseRow {
  databaseKey: string;
  canonicalKey: string;
  versionKey: string;
  player: Player;
  team: FieldTeam;
  matches: number;
  line: MatchState["yourStats"][string];
}

interface ScoutRow {
  player: Player;
  roster: Roster;
  bestMap: { name: string; value: number; delta: number };
  worstMap: { name: string; value: number; delta: number };
  auditFlags: ScoutAuditFlag[];
  hltvLabel: string;
  hltvTone: string;
  sampleLabel: string;
}

interface ScoutAuditFlag {
  label: string;
  reason: string;
  severity: ScoutAuditSeverity;
}

interface RunSnapshot {
  settings: CustomSettings;
  screen: Screen;
  realTimeRounds: boolean;
  teamName: string;
  mode: Mode;
  runKind: RunKind;
  difficultyId: Difficulty["id"];
  selected: Player[];
  coach?: Coach;
  currentRoster: Roster;
  usedRosterIds: string[];
  rollsLeft: number;
  opponent: FieldTeam;
  phase: TournamentPhase;
  playoffRound: PlayoffRound;
  playoffPairs: SwissPair[];
  tournamentOutcome: TournamentOutcome;
  tournamentWinner?: FieldTeam;
  swissField: FieldTeam[];
  swissRecords: Record<string, SwissRecord>;
  spectatorSwissRound: number;
  playedOpponentIds: string[];
  matchResults: SwissResult[];
  selectedResultId?: string;
  statsScope: StatsScope;
  record: SwissRecord;
  pickems: Record<string, string>;
  pickemScore: number;
  lastPickemDelta: number;
  viewedSwissRound: number | null;
  achievements: string[];
  playerForm: Record<string, number>;
  veto: VetoState;
  match?: MatchState;
  series?: ActiveSeries;
  speed: number;
  tactic: Tactic;
  timeouts: number;
  timeoutPlan: TimeoutPlan;
  liveFeedView: LiveFeedView;
}

type SavedRun = SavedRunSlot<RunSnapshot>;

interface VetoRecommendation {
  action: "ban" | "pick";
  map: MapId;
  score: number;
  edge: number;
  yourRecord: SwissRecord;
  opponentRecord: SwissRecord;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  alternatives: Array<{ map: MapId; score: number; edge: number }>;
}

const speedDelays: Record<number, number> = {
  0.5: 3500,
  1: 2200,
  2: 1000,
  4: 400,
};

const AUTO_SIM_ROUND_LIMIT = 240;
const CASE_ROLL_WINNER_INDEX = 31;
const CUSTOM_ROSTERS_KEY = "major-draft-lab-custom-rosters";
const SWISS_FIELD_SIZE = 16;
const SWISS_OPPONENT_COUNT = SWISS_FIELD_SIZE - 1;
const roleOptions: Role[] = ["IGL", "AWP", "Entry", "Lurker", "Rifler", "Support"];
const styleOptions: Style[] = ["Aggressive", "Balanced", "Passive"];
const eraOptions: Era[] = ["CS 1.6", "CS:Source", "CS:GO", "CS2"];

function createTeamForm(): TeamForm {
  return {
    tag: "NEW",
    name: "New Circuit Five",
    country: "US",
    era: "CS2",
    year: "2026",
    accent: "#5eead4",
    tagline: "A custom contender built for the Major simulator.",
    mapBase: mapPool.reduce(
      (acc, map, index) => {
        acc[map.id] = 78 + ((index * 4) % 13);
        return acc;
      },
      {} as Record<MapId, number>,
    ),
    players: [
      createFormPlayer("Caller", "Alex Morgan", "US", "IGL", "Balanced", { aim: 78, clutch: 83, consistency: 88, awp: 55, igl: 91 }),
      createFormPlayer("Scope", "Jordan Lee", "US", "AWP", "Passive", { aim: 88, clutch: 86, consistency: 84, awp: 92, igl: 52 }),
      createFormPlayer("Crash", "Sam Rivera", "US", "Entry", "Aggressive", { aim: 89, clutch: 78, consistency: 80, awp: 56, igl: 50 }),
      createFormPlayer("Anchor", "Taylor Quinn", "US", "Support", "Passive", { aim: 80, clutch: 82, consistency: 89, awp: 54, igl: 64 }),
      createFormPlayer("Glide", "Casey Brooks", "US", "Rifler", "Balanced", { aim: 86, clutch: 84, consistency: 85, awp: 60, igl: 58 }),
    ],
  };
}

function createFormPlayer(
  handle: string,
  realName: string,
  country: string,
  role: Role,
  style: Style,
  stats: PlayerStats,
): TeamFormPlayer {
  return { handle, realName, country, role, style, ...stats };
}

// Persistent local match database (localStorage in the browser, in-memory under SSR/tests). A single
// instance so every completed map accrues into one queryable store of matches + canonical careers.
let matchDbInstance: MatchDatabase | null = null;
function getMatchDb(): MatchDatabase {
  if (!matchDbInstance) {
    const storage: StorageAdapter = typeof window !== "undefined" ? window.localStorage : memoryStorage();
    matchDbInstance = new MatchDatabase(storage);
  }
  return matchDbInstance;
}

// Persist any completed series maps not already in the DB. Idempotent: keyed by series+map id.
function recordResultsToDb(results: SwissResult[]) {
  const db = getMatchDb();
  const existing = new Set(db.listMatches().map((match) => match.id)); // one read for dedupe
  const inputs: RecordMatchInput[] = [];
  results.forEach((series) => {
    series.maps.forEach((map, index) => {
      const id = `${series.id}-${map.map}-${index}`;
      if (existing.has(id)) return; // every box score is recorded; the log (if any) goes to the log store
      existing.add(id);
      inputs.push({
        id,
        recordedAt: new Date().toISOString(),
        stage: series.stage,
        map: map.map,
        left: { team: teamRef(series.left), players: series.left.players },
        right: { team: teamRef(series.right), players: series.right.players },
        leftScore: map.leftScore,
        rightScore: map.rightScore,
        winnerId: map.winnerId,
        stats: { ...map.leftStats, ...map.rightStats },
        sideStats: {
          CT: { ...map.leftSideStats.CT, ...map.rightSideStats.CT },
          T: { ...map.leftSideStats.T, ...map.rightSideStats.T },
        },
        eventLog: map.eventLog,
        keepEventLog: Boolean(map.eventLog),
      });
    });
  });
  if (inputs.length) db.recordMany(inputs); // single read/sort/serialize for the whole batch
}

function loadCustomRosters() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_ROSTERS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isUsableRoster) : [];
  } catch {
    return [];
  }
}

function saveCustomRosters(customRosters: Roster[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOM_ROSTERS_KEY, JSON.stringify(customRosters));
}

function isUsableRoster(value: unknown): value is Roster {
  const roster = value as Roster;
  return Boolean(
    roster &&
      typeof roster.id === "string" &&
      typeof roster.name === "string" &&
      typeof roster.tag === "string" &&
      Array.isArray(roster.players) &&
      roster.players.length >= 5,
  );
}

function rosterFromForm(form: TeamForm): Roster {
  const tag = normalizeTag(form.tag);
  const name = form.name.trim() || "Custom Team";
  const id = `custom-${slugify(name)}-${Date.now()}`;
  const source: SourceTeam = {
    tag,
    name,
    country: form.country.trim().toUpperCase().slice(0, 3) || "INT",
    era: form.era,
    year: form.year.trim() || "2026",
    accent: form.accent || "#65a7ff",
  };
  const mapPoolForTeam = normalizeMapPool(form.mapBase, 82);

  return {
    id,
    ...source,
    tagline: form.tagline.trim() || "A custom contender built for the Major simulator.",
    mapPool: mapPoolForTeam,
    players: form.players.slice(0, 5).map((player, index) => {
      const handle = player.handle.trim() || `Player${index + 1}`;
      const stats = normalizeStats({
        aim: player.aim,
        clutch: player.clutch,
        consistency: player.consistency,
        awp: player.awp,
        igl: player.igl,
      });
      return {
        id: `${id}-${slugify(handle)}`,
        handle,
        realName: player.realName.trim() || handle,
        country: player.country.trim().toUpperCase().slice(0, 3) || source.country,
        role: player.role,
        style: player.style,
        traits: Array.from(new Set([player.role, player.style === "Aggressive" ? "Entry" : player.style === "Passive" ? "Anchor" : "Trade"])),
        stats,
        ovr: ratePlayer(stats, player.role),
        source,
        maps: playerMapValues(index, player.role, mapPoolForTeam),
      };
    }),
  };
}

function normalizeTag(tag: string) {
  return tag.trim().replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase() || "NEW";
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "team";
}

function normalizeStats(stats: PlayerStats): PlayerStats {
  return {
    aim: clampWhole(stats.aim, 50, 99),
    clutch: clampWhole(stats.clutch, 50, 99),
    consistency: clampWhole(stats.consistency, 50, 99),
    awp: clampWhole(stats.awp, 45, 99),
    igl: clampWhole(stats.igl, 45, 99),
  };
}

function normalizeMapPool(values: Record<MapId, number>, fallback: number) {
  return mapPool.reduce(
    (acc, map) => {
      acc[map.id] = clampWhole(values[map.id] ?? fallback, 55, 99);
      return acc;
    },
    {} as Record<MapId, number>,
  );
}

function playerMapValues(index: number, role: Role, base: Record<MapId, number>) {
  return mapPool.reduce(
    (acc, map, mapIndex) => {
      const roleBoost =
        (map.id === "dust2" && role === "AWP") ||
        (map.id === "nuke" && role === "IGL") ||
        (map.id === "inferno" && role === "Support") ||
        (map.id === "mirage" && role === "Entry") ||
        ((map.id === "ancient" || map.id === "anubis") && role === "Lurker")
          ? 2
          : 0;
      acc[map.id] = clampWhole(base[map.id] + ((index * 5 + mapIndex * 3) % 7) - 3 + roleBoost, 55, 99);
      return acc;
    },
    {} as Record<MapId, number>,
  );
}

function ratePlayer(stats: PlayerStats, role: Role) {
  return rateStatsForRole(stats, role);
}

function mergeRosterLists(current: Roster[], incoming: Roster[]) {
  const byId = new Map(current.map((roster) => [roster.id, roster]));
  incoming.forEach((roster) => byId.set(roster.id, roster));
  return Array.from(byId.values());
}

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function draftPoolPlayers(rosterPool: Roster[]) {
  const byIdentity = new Map<string, Player>();
  rosterPool.forEach((roster) => {
    roster.players.forEach((player) => {
      const identity = `${player.handle.toLowerCase()}|${player.realName.toLowerCase()}|${player.country}`;
      if (!byIdentity.has(identity)) byIdentity.set(identity, player);
    });
  });
  return Array.from(byIdentity.values());
}

function randomFiveWithIgl(rosterPool: Roster[]) {
  const players = shuffled(draftPoolPlayers(rosterPool));
  const draft = players.slice(0, 5);
  if (draft.some((player) => player.role === "IGL") || draft.length < 5) return draft;

  const igl = shuffled(players.filter((player) => player.role === "IGL"))[0];
  if (!igl) return draft;

  draft[Math.floor(Math.random() * draft.length)] = igl;
  return draft;
}

function coachShortlist(coaches: Coach[]) {
  return shuffled(coaches).slice(0, Math.min(COACH_SHORTLIST_SIZE, coaches.length));
}

function App() {
  const [settings, setSettings] = useState<CustomSettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [screen, setScreen] = useState<Screen>("setup");
  const [realTimeRounds, setRealTimeRounds] = useState<boolean>(true);
  const [customRosters, setCustomRosters] = useState<Roster[]>(loadCustomRosters);
  const [teamForm, setTeamForm] = useState<TeamForm>(() => createTeamForm());
  const [teamJson, setTeamJson] = useState("");
  const [teamLabMessage, setTeamLabMessage] = useState("");
  const [teamName, setTeamName] = useState("My Five");
  const [mode, setMode] = useState<Mode>("classic");
  const [runKind, setRunKind] = useState<RunKind>("player");
  const [difficulty, setDifficulty] = useState<Difficulty>(difficulties[0]);
  const [runSlots, setRunSlots] = useState<SavedRun[]>(() => loadRunSlots<RunSnapshot>());
  const [activeSaveId, setActiveSaveId] = useState<string>();
  const [saveMessage, setSaveMessage] = useState("");
  const [selected, setSelected] = useState<Player[]>([]);
  const [coach, setCoach] = useState<Coach | undefined>();
  const [coachOptions, setCoachOptions] = useState<Coach[]>([]);
  const [coachRevealKey, setCoachRevealKey] = useState(0);
  const [currentRoster, setCurrentRoster] = useState<Roster>(hltvTop20Rosters[0]);
  const [usedRosterIds, setUsedRosterIds] = useState<string[]>([]);
  const [rolling, setRolling] = useState(false);
  const [rollSequence, setRollSequence] = useState<Roster[]>([]);
  const [rollsLeft, setRollsLeft] = useState(defaultSettings.draftRolls);
  const [opponent, setOpponent] = useState<FieldTeam>(toTournamentTeam(hltvTop20Rosters[1] ?? hltvTop20Rosters[0]));
  const [phase, setPhase] = useState<TournamentPhase>("swiss");
  const [playoffRound, setPlayoffRound] = useState<PlayoffRound>("quarterfinal");
  const [playoffPairs, setPlayoffPairs] = useState<SwissPair[]>([]);
  const [tournamentOutcome, setTournamentOutcome] = useState<TournamentOutcome>("running");
  const [tournamentWinner, setTournamentWinner] = useState<FieldTeam | undefined>();
  const [swissField, setSwissField] = useState<FieldTeam[]>(() => buildSwissField(hltvTop20Rosters));
  const [swissRecords, setSwissRecords] = useState<Record<string, SwissRecord>>({});
  const [spectatorSwissRound, setSpectatorSwissRound] = useState(1);
  const [playedOpponentIds, setPlayedOpponentIds] = useState<string[]>([]);
  const [matchResults, setMatchResults] = useState<SwissResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string>();
  const [detailPlayer, setDetailPlayer] = useState<{ player: Player; team: FieldTeam } | null>(null);
  const [detailTeam, setDetailTeam] = useState<FieldTeam | null>(null);
  const [vaultReplayId, setVaultReplayId] = useState<string | null>(null); // match id opened from the Vault
  const [navStack, setNavStack] = useState<Screen[]>([]); // back-stack for the detail pages
  const [statsScope, setStatsScope] = useState<StatsScope>("all");
  const [record, setRecord] = useState({ wins: 0, losses: 0 });
  const [pickems, setPickems] = useState<Record<string, string>>({});
  const [pickemScore, setPickemScore] = useState(0);
  const [lastPickemDelta, setLastPickemDelta] = useState(0);
  const [viewedSwissRound, setViewedSwissRound] = useState<number | null>(null); // null = live current round
  const [achievements, setAchievements] = useState<string[]>([]);
  const [playerForm, setPlayerForm] = useState<Record<string, number>>({});
  const [veto, setVeto] = useState<VetoState>(createVeto());
  const [match, setMatch] = useState<MatchState | undefined>();
  const [series, setSeries] = useState<ActiveSeries | undefined>();
  const [speed, setSpeed] = useState(1);
  const [tactic, setTactic] = useState<Tactic>("standard");
  const [timeouts, setTimeouts] = useState(2);
  const [timeoutPlan, setTimeoutPlan] = useState<TimeoutPlan>({ boost: 0, rounds: 0 });
  const [liveFeedView, setLiveFeedView] = useState<LiveFeedView>("feed");
  const builtInRosterCount = hltvTop20Rosters.length;
  const rosterPool = useMemo(() => [...hltvTop20Rosters, ...customRosters], [customRosters]);
  const labTeams = useMemo(() => rosterPool.map(toTournamentTeam), [rosterPool]);
  const coachPool = useMemo(() => hltvTop20Coaches, []);
  const visibleCoachOptions = coachOptions.length ? coachOptions : coachPool.slice(0, COACH_SHORTLIST_SIZE);
  const activeCall = parseTactic(tactic);

  const formAdjustedPlayers = useMemo(
    () =>
      selected.map((player) => applyCarriedPlayerForm(player, playerForm[player.id] ?? 0)),
    [selected, playerForm],
  );
  const yourTeam = useMemo(() => draftedTeam(teamName, formAdjustedPlayers, coach), [teamName, formAdjustedPlayers, coach]);
  const bonuses = useMemo(() => composition(selected, settings, true), [selected, settings]);
  const opponentBonuses = useMemo(() => composition(opponent.players, settings, opponent.id === "user"), [opponent, settings]);
  const missingRoles = requiredRoles.filter((role) => !selected.some((player) => player.role === role));
  const swissHistory = useMemo(() => buildSwissHistory(matchResults), [matchResults]); // who has played whom in Swiss
  const swissPairs = useMemo(() => buildSwissPairs(yourTeam, opponent, swissField, record, swissRecords, swissHistory), [yourTeam, opponent, swissField, record, swissRecords, swissHistory]);
  const swissUserFinished = runKind === "player" && phase === "swiss" && (record.wins >= 3 || record.losses >= 3);
  const swissCanSim = swissUserFinished && !isSwissStageResolved(swissField, swissRecords, record);
  const spectatorSwissResolved = runKind === "spectator" && phase === "swiss" && isNeutralSwissStageResolved(swissField, swissRecords);
  const spectatorSwissPairs = useMemo(
    () =>
      runKind === "spectator" && phase === "swiss" && !spectatorSwissResolved
        ? buildRemainingSwissPairs(swissField, swissRecords, spectatorSwissRound, swissHistory)
        : [],
    [phase, runKind, spectatorSwissResolved, spectatorSwissRound, swissField, swissRecords, swissHistory],
  );
  const swissDisplayPairs = useMemo(
    () => (swissUserFinished ? buildRemainingSwissPairs(swissField, swissRecords, record.wins + record.losses + 1, swissHistory) : swissPairs),
    [record, swissField, swissPairs, swissRecords, swissUserFinished, swissHistory],
  );
  // Swiss round navigation: the live round (the one being picked/played) plus every past round that
  // has saved results, so you can flip back through the clean pick'em list to review any round.
  const swissLiveRound = swissUserFinished ? null : record.wins + record.losses + 1;
  const swissPastRounds = useMemo(() => {
    const rounds = new Set<number>();
    matchResults.forEach((r) => {
      if (r.stage === "swiss" && (swissLiveRound === null || r.round < swissLiveRound)) rounds.add(r.round);
    });
    return Array.from(rounds).sort((a, b) => a - b);
  }, [matchResults, swissLiveRound]);
  const swissHasLive = swissDisplayPairs.length > 0;
  const swissViewingPast = viewedSwissRound != null && swissPastRounds.includes(viewedSwissRound);
  const swissPastResults = useMemo(() => {
    if (viewedSwissRound == null) return [] as SwissResult[];
    const byPair = new Map<string, SwissResult>();
    matchResults
      .filter((r) => r.stage === "swiss" && r.round === viewedSwissRound)
      .forEach((r) => byPair.set(r.pairId, r)); // keep the latest result per pairing
    return Array.from(byPair.values());
  }, [matchResults, viewedSwissRound]);
  // Spectator-mode round navigation (same idea, keyed to the spectator round). swissPastResults above
  // is mode-agnostic — it just filters matchResults by the viewed round — so it's reused here.
  const spectatorLiveRound = spectatorSwissResolved ? null : spectatorSwissRound;
  const spectatorPastRounds = useMemo(() => {
    const rounds = new Set<number>();
    matchResults.forEach((r) => {
      if (r.stage === "swiss" && (spectatorLiveRound === null || r.round < spectatorLiveRound)) rounds.add(r.round);
    });
    return Array.from(rounds).sort((a, b) => a - b);
  }, [matchResults, spectatorLiveRound]);
  const spectatorHasLive = spectatorSwissPairs.length > 0;
  const spectatorViewingPast = viewedSwissRound != null && spectatorPastRounds.includes(viewedSwissRound);
  // Each team's record as it stood ENTERING the viewed round (only rounds before it count), so a past
  // round shows the standings teams brought into it — round 1 is all 0-0, round 2 is 1-0 / 0-1, etc.
  const swissRecordsBeforeViewed = useMemo(() => {
    const recs: Record<string, SwissRecord> = {};
    if (viewedSwissRound == null) return recs;
    const touch = (id: string) => {
      if (!recs[id]) recs[id] = { wins: 0, losses: 0 };
    };
    matchResults.forEach((r) => {
      if (r.stage !== "swiss") return;
      touch(r.left.id);
      touch(r.right.id);
      if (r.round >= viewedSwissRound) return; // only count rounds played BEFORE the viewed one
      const loserId = r.winnerId === r.left.id ? r.right.id : r.left.id;
      recs[r.winnerId].wins += 1;
      recs[loserId].losses += 1;
    });
    return recs;
  }, [matchResults, viewedSwissRound]);
  const playerDatabase = useMemo(() => buildPlayerDatabase(matchResults), [matchResults]);
  const selectedResult = useMemo(
    () => matchResults.find((result) => result.id === selectedResultId) ?? matchResults[matchResults.length - 1],
    [matchResults, selectedResultId],
  );
  const runDone = runKind === "player" && (tournamentOutcome !== "running" || (phase === "swiss" && record.losses >= 3));
  const canSimPlayoffPhase =
    phase === "playoffs" &&
    playoffPairs.length > 0 &&
    tournamentOutcome !== "champion" &&
    tournamentOutcome !== "complete" &&
    (runKind === "spectator" || tournamentOutcome === "eliminated");
  const currentBestOf = phase === "playoffs" ? playoffBestOf(playoffRound) : swissBestOf(record);
  const currentSeriesLabel = phase === "playoffs" ? playoffRoundLabel(playoffRound) : `Swiss round ${record.wins + record.losses + 1}`;
  const strengthBreakdown = teamStrengthBreakdown(yourTeam, settings);
  const opponentStrengthBreakdown = teamStrengthBreakdown(opponent, settings, difficulty, true);
  const strength = strengthBreakdown.total;
  const opponentStrength = opponentStrengthBreakdown.total;
  const paperEdge = strength - opponentStrength;
  const resultMapResults = match && series ? [...series.mapResults, mapResultFromState(match.map, match, series.left, series.right)] : [];
  const resultMaps = resultMapResults.length ? resultMapResults.map((item) => item.map) : match ? [match.map] : [];
  const totalYourMoney = match?.yourMoney ? Object.values(match.yourMoney).reduce((sum, val) => sum + val, 0) : 0;
  const totalOpponentMoney = match?.opponentMoney ? Object.values(match.opponentMoney).reduce((sum, val) => sum + val, 0) : 0;
  const hasSavableRun =
    selected.length > 0 ||
    runKind === "spectator" ||
    matchResults.length > 0 ||
    Boolean(match) ||
    Boolean(series) ||
    phase === "playoffs";

  const resultStatsTeams = match
    ? resultMapResults.length
      ? [
          { team: yourTeam, players: selected, stats: aggregateSeriesStats(yourTeam, resultMapResults, "left"), side: "left" as const },
          { team: opponent, players: opponent.players, stats: aggregateSeriesStats(opponent, resultMapResults, "right"), side: "right" as const },
        ]
      : [
          { team: yourTeam, players: selected, stats: match.yourStats, side: "left" as const },
          { team: opponent, players: opponent.players, stats: match.opponentStats, side: "right" as const },
        ]
    : [];

  // Detail-page navigation uses a small back-stack so "Back" returns to wherever you came from
  // (results, swiss board, a team page, a player page, …) even across player <-> team <-> series hops.
  function pushScreen(next: Screen) {
    setNavStack((stack) => [...stack, screen]);
    setScreen(next);
  }

  function goBackScreen() {
    setNavStack((stack) => {
      const copy = [...stack];
      const prev = copy.pop();
      setScreen(prev ?? (phase === "playoffs" ? "playoffs" : "swiss"));
      return copy;
    });
  }

  function openSeriesResult(id: string) {
    setSelectedResultId(id);
    pushScreen("series-detail");
  }

  function openPlayerDetail(player: Player, team: FieldTeam) {
    setDetailPlayer({ player, team });
    pushScreen("player-detail");
  }

  function openTeamDetail(team: FieldTeam) {
    setDetailTeam(team);
    pushScreen("team-detail");
  }

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", settings.accent);
  }, [settings.accent]);

  // Accrue every completed map into the persistent match database (survives reloads and spans runs).
  useEffect(() => {
    if (matchResults.length) recordResultsToDb(matchResults);
  }, [matchResults]);

  useEffect(() => {
    saveCustomRosters(customRosters);
  }, [customRosters]);

  useEffect(() => {
    if (screen !== "veto" || !veto.pendingOpponent) return;
    const timer = window.setTimeout(() => {
      setVeto((current) => applyOpponentVeto(current, opponent));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [screen, veto.pendingOpponent?.action, veto.pendingOpponent?.map, opponent]);

  useEffect(() => {
    if (screen !== "match" || !match?.running || match.ended) return;
    const activeTimeoutBoost = timeoutPlan.rounds > 0 ? timeoutPlan.boost : 0;
    
    const activeRound = match.pendingEvents?.[0]?.round ?? match.feed[0]?.round ?? match.round;
    const completedEvents = match.feed.filter((e) => e.round === activeRound);
    const nextStepIndex = completedEvents.length + 1;
    const delay = getStepDelay(match, yourTeam, opponent, nextStepIndex, speed, liveFeedView);

    const timer = window.setTimeout(() => {
      setMatch((current) => {
        if (!current) return current;
        const next = playRound(current, yourTeam, opponent, settings, difficulty, tactic, activeTimeoutBoost, !realTimeRounds);
        if (next.round > current.round) {
          if (timeoutPlan.rounds > 0) {
            setTimeout(() => {
              setTimeoutPlan((plan) => ({ boost: plan.rounds > 1 ? plan.boost : 0, rounds: Math.max(0, plan.rounds - 1) }));
            }, 0);
          }
          if (settings.tacticalPauses) {
            const pauseReason = next.lastReason ?? "Tactical pause between rounds.";
            window.setTimeout(() => {
              setMatch((paused) =>
                paused && !paused.ended && !paused.running && paused.round === next.round && paused.lastReason === pauseReason
                  ? { ...paused, running: true, lastReason: "Tactical pause complete. Back into the server." }
                  : paused,
              );
            }, 3000);
            return { ...next, running: false, lastReason: pauseReason };
          }
        }
        return next;
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [screen, match, speed, yourTeam, opponent, settings, difficulty, tactic, timeoutPlan, realTimeRounds, liveFeedView]);

  useEffect(() => {
    if (screen !== "match" || !match?.ended) return;
    if (!series) {
      // standalone map: drift form from this map's performance, then show the result
      setPlayerForm((current) => shiftPlayerForm(current, selected, match));
      setScreen("result");
      return;
    }
    const nextSeries = completedSeriesState(series, match);
    if (seriesIsDone(nextSeries)) {
      // final/deciding map of the series (this is every BO1): advanceCompletedMap won't run, so drift
      // form here before the result screen — otherwise BO1 matches never move player form.
      setPlayerForm((current) => shiftPlayerForm(current, selected, match));
      setScreen("result");
      return;
    }
    const timer = window.setTimeout(() => advanceCompletedMap(match, series), 900);
    return () => window.clearTimeout(timer);
  }, [screen, match, series]);

  function randomRoster(nextUsed = usedRosterIds) {
    const available = rosterPool.filter((roster) => !nextUsed.includes(roster.id));
    return available[Math.floor(Math.random() * available.length)] ?? rosterPool[Math.floor(Math.random() * rosterPool.length)];
  }

  function buildRollSequence(target: Roster, nextUsed = usedRosterIds) {
    const pool = rosterPool.filter((roster) => roster.id !== target.id && !nextUsed.includes(roster.id));
    const fallback = rosterPool.filter((roster) => roster.id !== target.id);
    return Array.from({ length: CASE_ROLL_WINNER_INDEX + 7 }).map((_, index) => {
      if (index === CASE_ROLL_WINNER_INDEX) return target;
      const source = pool.length ? pool : fallback;
      return source[Math.floor(Math.random() * source.length)] ?? target;
    });
  }

  function rollRoster(nextUsed = usedRosterIds) {
    const target = randomRoster(nextUsed);
    setRolling(true);
    setRollSequence(buildRollSequence(target, nextUsed));
    window.setTimeout(() => {
      setCurrentRoster(target);
      setRolling(false);
    }, 3950);
  }

  function dealCoachOptions() {
    setCoachOptions(coachShortlist(coachPool));
    setCoachRevealKey((value) => value + 1);
  }

  function openCoachDraft() {
    dealCoachOptions();
    setScreen("coach");
  }

  function startDraft() {
    if (mode === "spectator") {
      startSpectatorRun();
      return;
    }
    setActiveSaveId(undefined);
    setSaveMessage("");
    setRunKind("player");
    setSelected([]);
    setCoach(undefined);
    setCoachOptions([]);
    setCoachRevealKey(0);
    setRecord({ wins: 0, losses: 0 });
    setPickems({});
    setPickemScore(0);
    setLastPickemDelta(0);
    setAchievements([]);
    setPlayerForm({});
    setUsedRosterIds([]);
    setPhase("swiss");
    setPlayoffRound("quarterfinal");
    setPlayoffPairs([]);
    setTournamentOutcome("running");
    setTournamentWinner(undefined);
    setSwissRecords({});
    setSpectatorSwissRound(1);
    setPlayedOpponentIds([]);
    setMatchResults([]);
    setSelectedResultId(undefined);
    setStatsScope("all");
    setSeries(undefined);
    setMatch(undefined);
    setRolling(false);
    setRollSequence([]);
    setRollsLeft(settings.draftRolls);
    if (mode === "random") {
      setSelected(randomFiveWithIgl(rosterPool).map((player, index) => draftedPlayerCopy(player, index)));
      openCoachDraft();
      return;
    }
    setScreen("draft");
    rollRoster([]);
  }

  function startSpectatorRun() {
    const nextSwissField = buildSpectatorField(rosterPool);
    const nextSwissRecords = initialSwissRecords(nextSwissField);
    setActiveSaveId(undefined);
    setSaveMessage("");
    setRunKind("spectator");
    setSelected([]);
    setCoach(undefined);
    setCoachOptions([]);
    setCoachRevealKey(0);
    setRecord({ wins: 0, losses: 0 });
    setPickems({});
    setPickemScore(0);
    setLastPickemDelta(0);
    setAchievements([]);
    setPlayerForm({});
    setUsedRosterIds([]);
    setPhase("swiss");
    setPlayoffRound("quarterfinal");
    setPlayoffPairs([]);
    setTournamentOutcome("running");
    setTournamentWinner(undefined);
    setSwissField(nextSwissField);
    setSwissRecords(nextSwissRecords);
    setSpectatorSwissRound(1);
    setOpponent(nextSwissField[0] ?? opponent);
    setPlayedOpponentIds([]);
    setMatchResults([]);
    setSelectedResultId(undefined);
    setStatsScope("all");
    setSeries(undefined);
    setMatch(undefined);
    setRolling(false);
    setRollSequence([]);
    setVeto(createVeto());
    setScreen("swiss");
  }

  function choosePlayer(player: Player) {
    const nextSelected = [...selected, draftedPlayerCopy(player, selected.length)];
    const nextUsed = [...usedRosterIds, currentRoster.id];
    setSelected(nextSelected);
    setUsedRosterIds(nextUsed);
    if (nextSelected.length >= 5) {
      openCoachDraft();
      return;
    }
    rollRoster(nextUsed);
  }

  function reroll() {
    if (rollsLeft <= 0 || rolling) return;
    setRollsLeft((value) => value - 1);
    rollRoster(usedRosterIds);
  }

  function chooseCoach(nextCoach: Coach) {
    setRunKind("player");
    setCoach(nextCoach);
    const nextSwissField = buildSwissField(rosterPool);
    const nextSwissRecords = initialSwissRecords(nextSwissField);
    const rival = selectOpponentForRecord({ wins: 0, losses: 0 }, nextSwissField, nextSwissRecords, []);
    setPhase("swiss");
    setPlayoffRound("quarterfinal");
    setPlayoffPairs([]);
    setTournamentOutcome("running");
    setTournamentWinner(undefined);
    setSwissField(nextSwissField);
    setSwissRecords(nextSwissRecords);
    setSpectatorSwissRound(1);
    setOpponent(rival);
    setPlayedOpponentIds([]);
    setMatchResults([]);
    setSelectedResultId(undefined);
    setStatsScope("all");
    setSeries(undefined);
    setMatch(undefined);
    setPlayerForm(generatePlayerForm(selected));
    setAchievements((current) => unlockAchievements(current, draftAchievements(selected, mode)));
    setVeto(createVeto());
    setScreen("swiss");
  }

  function startVeto() {
    if (runDone || swissUserFinished) return;
    setViewedSwissRound(null); // snap back to the live round when starting a match
    setVeto(createVeto(currentBestOf));
    setScreen("veto");
  }

  function ban(map: MapId) {
    setVeto((current) => applyUserBan(current, map, yourTeam, opponent, settings));
  }

  function startMatch() {
    const maps = veto.selected.length ? veto.selected : buildSeriesMaps(veto.decider ?? veto.available[0], yourTeam, opponent, currentBestOf, settings);
    const activePair = phase === "playoffs" ? playoffPairs.find((pair) => pair.active) : swissPairs.find((pair) => pair.active);
    const nextSeries: ActiveSeries = {
      id: `${phase}-${currentSeriesLabel}-${Date.now()}`,
      pairId: activePair?.id ?? `${phase}-${recordKey(record)}-user`,
      round: phase === "playoffs" ? playoffRoundNumber(playoffRound) : record.wins + record.losses + 1,
      stage: phase === "playoffs" ? playoffRound : "swiss",
      laneKey: phase === "swiss" ? laneKeyForRecord(record) : undefined,
      label: currentSeriesLabel,
      bestOf: currentBestOf,
      maps,
      currentMapIndex: 0,
      left: yourTeam,
      right: opponent,
      mapResults: [],
    };
    setTimeouts(2);
    setTimeoutPlan({ boost: 0, rounds: 0 });
    setTactic("standard");
    setSeries(nextSeries);
    setMatch(initMatch(maps[0], yourTeam, opponent, { stage: nextSeries.stage }));
    setScreen("match");
  }

  function useTimeout() {
    if (timeouts <= 0 || !match || match.ended) return;
    const plan = tacticalTimeoutPlan(match, yourTeam, opponent);
    setTimeouts((value) => value - 1);
    setTimeoutPlan(plan);
    setMatch({
      ...match,
      running: false,
      lastReason: `Timeout called. ${coach?.handle ?? "Coach"} adds +${(plan.boost * 100).toFixed(1)}% for ${plan.rounds} rounds.`,
    });
    window.setTimeout(() => {
      setMatch((current) => (current && !current.ended ? { ...current, running: true, lastReason: "Timeout complete. Back into the server." } : current));
    }, 3000);
  }

  function skipResult() {
    if (!match) return;
    let next = match;
    let guard = 0;
    let plan = timeoutPlan;
    while (!next.ended && guard < AUTO_SIM_ROUND_LIMIT) {
      const activeTimeoutBoost = plan.rounds > 0 ? plan.boost : 0;
      next = playRound(next, yourTeam, opponent, settings, difficulty, tactic, activeTimeoutBoost, true);
      if (plan.rounds > 0) plan = { boost: plan.rounds > 1 ? plan.boost : 0, rounds: Math.max(0, plan.rounds - 1) };
      guard += 1;
    }
    next = resolveAutoSimMatch(next, yourTeam, opponent, settings);
    setTimeoutPlan(plan);
    if (series) {
      advanceCompletedMap(next, series);
      return;
    }
    setMatch(next);
    setPlayerForm((current) => shiftPlayerForm(current, selected, next));
    setScreen("result");
  }

  function completedSeriesState(activeSeries: ActiveSeries, completedMatch: MatchState) {
    const currentMapResult = mapResultFromState(completedMatch.map, completedMatch, activeSeries.left, activeSeries.right);
    return {
      ...activeSeries,
      mapResults: [...activeSeries.mapResults, currentMapResult],
      currentMapIndex: activeSeries.currentMapIndex + 1,
    };
  }

  function advanceCompletedMap(completedMatch: MatchState, activeSeries: ActiveSeries) {
    setPlayerForm((current) => shiftPlayerForm(current, selected, completedMatch));
    const nextSeries = completedSeriesState(activeSeries, completedMatch);
    if (!seriesIsDone(nextSeries)) {
      const nextMap = nextSeries.maps[nextSeries.currentMapIndex];
      setSeries(nextSeries);
      setTimeouts(2);
      setTimeoutPlan({ boost: 0, rounds: 0 });
      setTactic("standard");
      setMatch(initMatch(nextMap, activeSeries.left, activeSeries.right, { stage: activeSeries.stage }));
      setScreen("match");
      return;
    }
    setMatch(completedMatch);
    setScreen("result");
  }

  function continueSeries() {
    if (!match?.winner || !series) return;
    const currentMapResult = mapResultFromState(match.map, match, series.left, series.right);
    const nextMapResults = [...series.mapResults, currentMapResult];
    const nextSeries = {
      ...series,
      mapResults: nextMapResults,
      currentMapIndex: series.currentMapIndex + 1,
    };
    if (!seriesIsDone(nextSeries)) {
      const nextMap = nextSeries.maps[nextSeries.currentMapIndex];
      setSeries(nextSeries);
      setTimeouts(2);
      setTimeoutPlan({ boost: 0, rounds: 0 });
      setTactic("standard");
      setMatch(initMatch(nextMap, yourTeam, opponent, { stage: series.stage }));
      setScreen("match");
      return;
    }

    const playedResult = seriesResultFromMaps(nextSeries, true);
    if (phase === "playoffs") {
      continuePlayoffs(playedResult);
      return;
    }

    const roundNumber = record.wins + record.losses + 1;
    const nextRecord = {
      wins: record.wins + (playedResult.winnerId === "user" ? 1 : 0),
      losses: record.losses + (playedResult.winnerId === "user" ? 0 : 1),
    };
    const outsideResults = swissPairs
      .filter((pair) => !pair.active)
      .map((pair) => simulateSwissSeries(pair, roundNumber, settings, difficulty, swissRecords));
    const roundResults = [playedResult, ...outsideResults];
    const pickemScore = outsideResults.reduce((sum, result) => sum + (pickems[result.pairId] === result.winnerId ? 1 : 0), 0);
    const nextSwissRecords = applyResultsToSwissRecords(swissRecords, roundResults);
    const nextPlayedOpponentIds = [...playedOpponentIds, opponent.id];
    const newAchievements = matchAchievements(match, yourTeam, opponent, settings, difficulty, nextRecord);
    setPickemScore((value) => value + pickemScore);
    setLastPickemDelta(pickemScore);
    setPickems({});
    setAchievements((current) => unlockAchievements(current, newAchievements));
    setMatchResults((current) => [...current, ...roundResults]);
    setSelectedResultId(playedResult.id);
    setSeries(undefined);
    setMatch(undefined);
    setSwissRecords(nextSwissRecords);
    setPlayedOpponentIds(nextPlayedOpponentIds);
    setRecord(nextRecord);
    if (nextRecord.wins >= 3) {
      if (isSwissStageResolved(swissField, nextSwissRecords, nextRecord)) {
        enterPlayoffs(nextSwissRecords);
        return;
      }
      setVeto(createVeto());
      setScreen("swiss");
      return;
    }
    if (nextRecord.losses < 3) {
      setOpponent(selectOpponentForRecord(nextRecord, swissField, nextSwissRecords, nextPlayedOpponentIds));
      setVeto(createVeto());
    } else {
      setTournamentOutcome("eliminated");
      if (isSwissStageResolved(swissField, nextSwissRecords, nextRecord)) {
        enterNeutralPlayoffs(nextSwissRecords, "eliminated");
        return;
      }
    }
    setScreen("swiss");
  }

  function enterPlayoffs(nextSwissRecords: Record<string, SwissRecord>) {
    const pairs = buildInitialPlayoffPairs(yourTeam, swissField, nextSwissRecords, settings, difficulty);
    const active = pairs.find((pair) => pair.active) ?? pairs[0];
    setPhase("playoffs");
    setPlayoffRound("quarterfinal");
    setPlayoffPairs(pairs);
    setTournamentOutcome("running");
    setTournamentWinner(undefined);
    setOpponent(active.right.id === "user" ? active.left : active.right);
    setVeto(createVeto());
    setScreen("playoffs");
  }

  function enterNeutralPlayoffs(nextSwissRecords: Record<string, SwissRecord>, outcome: TournamentOutcome = "eliminated") {
    const pairs = buildNeutralInitialPlayoffPairs(swissField, nextSwissRecords, settings, difficulty);
    setPhase("playoffs");
    setPlayoffRound("quarterfinal");
    setPlayoffPairs(pairs);
    setTournamentOutcome(outcome);
    setTournamentWinner(undefined);
    setOpponent(pairs[0]?.right ?? pairs[0]?.left ?? opponent);
    setVeto(createVeto());
    setScreen("playoffs");
  }

  function simRemainingSwissGames() {
    setViewedSwissRound(null); // snap back to the live round when simming
    let nextSwissRecords = { ...swissRecords };
    const simulatedResults: SwissResult[] = [];
    let nextRound = Math.min(record.wins + record.losses + 1, 5);

    while (nextRound <= 5 && !isSwissStageResolved(swissField, nextSwissRecords, record)) {
      // rebuild history each round so the games we just simulated also block rematches
      const history = buildSwissHistory([...matchResults, ...simulatedResults]);
      const pairs = buildRemainingSwissPairs(swissField, nextSwissRecords, nextRound, history);
      if (!pairs.length) break;
      const roundResults = pairs.map((pair) => simulateSwissSeries(pair, nextRound, settings, difficulty, nextSwissRecords));
      simulatedResults.push(...roundResults);
      nextSwissRecords = applyResultsToSwissRecords(nextSwissRecords, roundResults);
      nextRound += 1;
    }

    setSwissRecords(nextSwissRecords);
    setPickems({});
    setLastPickemDelta(0);
    if (simulatedResults.length) {
      setMatchResults((current) => [...current, ...simulatedResults]);
      setSelectedResultId(simulatedResults[simulatedResults.length - 1].id);
    }

    if (record.wins >= 3) {
      enterPlayoffs(nextSwissRecords);
      return;
    }

    enterNeutralPlayoffs(nextSwissRecords, "eliminated");
  }

  function simSpectatorSwissPhase() {
    if (runKind !== "spectator" || phase !== "swiss") return;
    setViewedSwissRound(null); // snap back to the live round when simming
    if (isNeutralSwissStageResolved(swissField, swissRecords)) {
      enterNeutralPlayoffs(swissRecords, "running");
      return;
    }

    const pairs = buildRemainingSwissPairs(swissField, swissRecords, spectatorSwissRound, swissHistory);
    if (!pairs.length) {
      enterNeutralPlayoffs(swissRecords, "running");
      return;
    }

    const roundResults = pairs.map((pair) => simulateSwissSeries(pair, spectatorSwissRound, settings, difficulty, swissRecords));
    const nextSwissRecords = applyResultsToSwissRecords(swissRecords, roundResults);
    setSwissRecords(nextSwissRecords);
    setPickems({});
    setLastPickemDelta(0);
    setMatchResults((current) => [...current, ...roundResults]);
    setSelectedResultId(roundResults[roundResults.length - 1]?.id);

    if (isNeutralSwissStageResolved(swissField, nextSwissRecords) || spectatorSwissRound >= 5) {
      enterNeutralPlayoffs(nextSwissRecords, "running");
      return;
    }

    setSpectatorSwissRound((round) => Math.min(5, round + 1));
  }

  function simPlayoffPhase() {
    if (!playoffPairs.length || tournamentOutcome === "champion" || tournamentOutcome === "complete") return;
    const roundResults = playoffPairs.map((pair) => simulatePlayoffSeries(pair, playoffRound, settings, difficulty));
    const winners = roundResults.map((result) => (result.winnerId === result.left.id ? result.left : result.right));
    setMatchResults((current) => [...current, ...roundResults]);
    setSelectedResultId(roundResults[roundResults.length - 1]?.id);

    if (playoffRound === "final") {
      const winner = winners[0];
      setTournamentWinner(winner);
      setTournamentOutcome(winner?.id === "user" ? "champion" : "complete");
      setScreen("playoffs");
      return;
    }

    const nextRound = playoffRound === "quarterfinal" ? "semifinal" : "final";
    const pairs = winners.some((team) => team.id === "user")
      ? buildNextPlayoffPairs(nextRound, winners, yourTeam)
      : buildNeutralNextPlayoffPairs(nextRound, winners);
    const active = pairs.find((pair) => pair.active) ?? pairs[0];
    setPlayoffRound(nextRound);
    setPlayoffPairs(pairs);
    setOpponent(active ? (active.right.id === "user" ? active.left : active.right) : opponent);
    setScreen("playoffs");
  }

  function continuePlayoffs(playedResult: SwissResult) {
    const otherResults = playoffPairs
      .filter((pair) => !pair.active)
      .map((pair) => simulatePlayoffSeries(pair, playoffRound, settings, difficulty));
    const roundResults = [playedResult, ...otherResults];
    setMatchResults((current) => [...current, ...roundResults]);
    setSelectedResultId(playedResult.id);
    setSeries(undefined);
    setMatch(undefined);

    if (playedResult.winnerId !== "user") {
      const winners = roundResults.map((result) => (result.winnerId === result.left.id ? result.left : result.right));
      if (playoffRound === "final") {
        setTournamentWinner(winners[0]);
        setTournamentOutcome("complete");
        setScreen("playoffs");
        return;
      }
      const nextRound = playoffRound === "quarterfinal" ? "semifinal" : "final";
      const pairs = buildNeutralNextPlayoffPairs(nextRound, winners);
      setPlayoffRound(nextRound);
      setPlayoffPairs(pairs);
      setOpponent(pairs[0]?.right ?? pairs[0]?.left ?? opponent);
      setTournamentOutcome("eliminated");
      setScreen("playoffs");
      return;
    }
    if (playoffRound === "final") {
      setTournamentWinner(yourTeam);
      setTournamentOutcome("champion");
      setScreen("playoffs");
      return;
    }

    const nextRound = playoffRound === "quarterfinal" ? "semifinal" : "final";
    const winners = roundResults.map((result) => (result.winnerId === result.left.id ? result.left : result.right));
    const pairs = buildNextPlayoffPairs(nextRound, winners, yourTeam);
    const active = pairs.find((pair) => pair.active) ?? pairs[0];
    setPlayoffRound(nextRound);
    setPlayoffPairs(pairs);
    setOpponent(active.right.id === "user" ? active.left : active.right);
    setVeto(createVeto());
    setScreen("playoffs");
  }

  function pickWinner(pair: SwissPair, teamId: string) {
    setPickems((current) => ({ ...current, [pair.id]: teamId }));
  }

  function restartRun() {
    setActiveSaveId(undefined);
    setSaveMessage("");
    setScreen("setup");
    setRunKind("player");
    setSelected([]);
    setCoach(undefined);
    setRecord({ wins: 0, losses: 0 });
    setPickems({});
    setPickemScore(0);
    setLastPickemDelta(0);
    setAchievements([]);
    setPlayerForm({});
    setPhase("swiss");
    setPlayoffRound("quarterfinal");
    setPlayoffPairs([]);
    setTournamentOutcome("running");
    setTournamentWinner(undefined);
    setSwissRecords({});
    setSpectatorSwissRound(1);
    setPlayedOpponentIds([]);
    setMatchResults([]);
    setSelectedResultId(undefined);
    setStatsScope("all");
    setVeto(createVeto());
    setSeries(undefined);
    setMatch(undefined);
  }

  function saveTeam() {
    const roster = rosterFromForm(teamForm);
    setCustomRosters((current) => [roster, ...current]);
    setTeamLabMessage(`${roster.name} saved. It is now in draft rolls and can enter future Swiss fields.`);
  }

  function removeTeam(id: string) {
    setCustomRosters((current) => current.filter((roster) => roster.id !== id));
    setTeamLabMessage("Custom team removed.");
  }

  function exportTeams() {
    setTeamJson(JSON.stringify(customRosters, null, 2));
    setTeamLabMessage(customRosters.length ? "Export JSON is ready below." : "No custom teams saved yet.");
  }

  function importTeams() {
    try {
      const parsed = JSON.parse(teamJson);
      const incoming = (Array.isArray(parsed) ? parsed : [parsed]).filter(isUsableRoster);
      if (!incoming.length) {
        setTeamLabMessage("That JSON did not contain any valid teams exported from this app.");
        return;
      }
      // Validate before accepting: import only the teams that are structurally sound, so a bad role,
      // impossible OVR or duplicate id can't silently corrupt the pool. Report what was rejected.
      const clean: Roster[] = [];
      let rejected = 0;
      let warnings = 0;
      incoming.forEach((roster) => {
        const issues = validateRoster(roster);
        const errors = issues.filter((issue) => issue.level === "error");
        warnings += issues.length - errors.length;
        if (errors.length) rejected += 1;
        else clean.push(roster);
      });
      if (clean.length) setCustomRosters((current) => mergeRosterLists(current, clean));
      const parts = [`${clean.length} team${clean.length === 1 ? "" : "s"} imported`];
      if (rejected) parts.push(`${rejected} rejected (validation errors)`);
      if (warnings) parts.push(`${warnings} warning${warnings === 1 ? "" : "s"}`);
      setTeamLabMessage(`${parts.join(" · ")}.`);
    } catch {
      setTeamLabMessage("Could not parse that JSON.");
    }
  }

  function buildRunSnapshot(): RunSnapshot {
    return {
      settings,
      screen,
      realTimeRounds,
      teamName,
      mode,
      runKind,
      difficultyId: difficulty.id,
      selected,
      coach,
      currentRoster,
      usedRosterIds,
      rollsLeft,
      opponent,
      phase,
      playoffRound,
      playoffPairs,
      tournamentOutcome,
      tournamentWinner,
      swissField,
      swissRecords,
      spectatorSwissRound,
      playedOpponentIds,
      matchResults,
      selectedResultId,
      statsScope,
      record,
      pickems,
      pickemScore,
      lastPickemDelta,
      viewedSwissRound,
      achievements,
      playerForm,
      veto,
      match,
      series,
      speed,
      tactic,
      timeouts,
      timeoutPlan,
      liveFeedView,
    };
  }

  function buildRunSummary(): RunSummary {
    const recordLabel = runKind === "spectator" ? `${matchResults.length} series` : `${record.wins}-${record.losses}`;
    const phaseLabel = phase === "playoffs" ? playoffRoundLabel(playoffRound) : "Swiss";
    const detail = match
      ? `${phaseLabel} / ${mapName(match.map)} ${match.you}-${match.opponent}`
      : tournamentOutcome === "champion"
        ? "Champion"
        : tournamentOutcome === "eliminated"
          ? "Eliminated"
          : `${phaseLabel} / ${matchResults.length} saved series`;
    return {
      teamName: runKind === "spectator" ? "Spectator run" : teamName,
      mode,
      runKind,
      phase,
      screen,
      recordLabel,
      matchCount: matchResults.length,
      detail,
    };
  }

  function saveCurrentRun() {
    if (!hasSavableRun) {
      setSaveMessage("Start a run before saving.");
      return;
    }
    const saved = saveRunSlot(buildRunSnapshot(), buildRunSummary(), activeSaveId);
    setActiveSaveId(saved.id);
    setRunSlots(loadRunSlots<RunSnapshot>());
    setSaveMessage(`${saved.summary.teamName} saved.`);
  }

  function loadSavedRun(slot: SavedRun) {
    const snapshot = slot.snapshot;
    setSettings(snapshot.settings ?? defaultSettings);
    setRealTimeRounds(snapshot.realTimeRounds ?? true);
    setTeamName(snapshot.teamName ?? "My Five");
    setMode(snapshot.mode ?? "classic");
    setRunKind(snapshot.runKind ?? "player");
    setDifficulty(difficulties.find((item) => item.id === snapshot.difficultyId) ?? difficulties[0]);
    setSelected(snapshot.selected ?? []);
    setCoach(snapshot.coach);
    setCoachOptions([]);
    setCoachRevealKey(0);
    setCurrentRoster(snapshot.currentRoster ?? hltvTop20Rosters[0]);
    setUsedRosterIds(snapshot.usedRosterIds ?? []);
    setRolling(false);
    setRollSequence([]);
    setRollsLeft(snapshot.rollsLeft ?? (snapshot.settings ?? defaultSettings).draftRolls);
    setOpponent(snapshot.opponent ?? toTournamentTeam(hltvTop20Rosters[1] ?? hltvTop20Rosters[0]));
    setPhase(snapshot.phase ?? "swiss");
    setPlayoffRound(snapshot.playoffRound ?? "quarterfinal");
    setPlayoffPairs(snapshot.playoffPairs ?? []);
    setTournamentOutcome(snapshot.tournamentOutcome ?? "running");
    setTournamentWinner(snapshot.tournamentWinner);
    setSwissField(snapshot.swissField ?? buildSwissField(rosterPool));
    setSwissRecords(snapshot.swissRecords ?? {});
    setSpectatorSwissRound(snapshot.spectatorSwissRound ?? 1);
    setPlayedOpponentIds(snapshot.playedOpponentIds ?? []);
    setMatchResults(snapshot.matchResults ?? []);
    setSelectedResultId(snapshot.selectedResultId);
    setStatsScope(snapshot.statsScope ?? "all");
    setRecord(snapshot.record ?? { wins: 0, losses: 0 });
    setPickems(snapshot.pickems ?? {});
    setPickemScore(snapshot.pickemScore ?? 0);
    setLastPickemDelta(snapshot.lastPickemDelta ?? 0);
    setViewedSwissRound(snapshot.viewedSwissRound ?? null);
    setAchievements(snapshot.achievements ?? []);
    setPlayerForm(snapshot.playerForm ?? {});
    setVeto(snapshot.veto ?? createVeto());
    setMatch(snapshot.match ? { ...snapshot.match, running: false } : undefined);
    setSeries(snapshot.series);
    setSpeed(snapshot.speed ?? 1);
    setTactic(snapshot.tactic ?? "standard");
    setTimeouts(snapshot.timeouts ?? 2);
    setTimeoutPlan(snapshot.timeoutPlan ?? { boost: 0, rounds: 0 });
    setLiveFeedView(snapshot.liveFeedView ?? "feed");
    setDetailPlayer(null);
    setDetailTeam(null);
    setNavStack([]);
    setActiveSaveId(slot.id);
    setSaveMessage(`${slot.summary.teamName} loaded.`);
    setScreen(sanitizeLoadedScreen(snapshot.screen, snapshot));
  }

  function deleteSavedRun(id: string) {
    deleteRunSlot(id);
    setRunSlots(loadRunSlots<RunSnapshot>());
    if (activeSaveId === id) setActiveSaveId(undefined);
    setSaveMessage("Save slot deleted.");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="crest" style={{ "--crest": settings.accent } as React.CSSProperties}>
            MD
          </div>
          <div>
            <strong>{settings.brand}</strong>
            <span>counter-strike draft simulator</span>
          </div>
        </div>
        <nav className="stage-nav" aria-label="Progress">
          {["setup", "teams", "draft", "swiss", "playoffs", "veto", "match"].map((item) => (
            <span key={item} className={screen === item ? "active" : ""}>
              {item}
            </span>
          ))}
        </nav>
        <div className="top-actions">
          <button className="icon-button" disabled={!hasSavableRun} onClick={saveCurrentRun} title="Save current run">
            <Save size={18} />
            <span>{activeSaveId ? "Quick Save" : "Save Run"}</span>
          </button>
          <button className="icon-button" onClick={() => setScreen("teams")} title="Team database">
            <Database size={18} />
            <span>Team Lab</span>
          </button>
          <button className="icon-button" onClick={() => pushScreen("balance-lab")} title="Explain team strength, OVR & round probability">
            <Sparkles size={18} />
            <span>Balance Lab</span>
          </button>
          <button className="icon-button" onClick={() => pushScreen("vault")} title="All-time records from every saved match">
            <Trophy size={18} />
            <span>Vault</span>
          </button>
          <button className="icon-button" onClick={() => setShowSettings(true)} title="Customize">
            <Settings2 size={18} />
            <span>Customize</span>
          </button>
        </div>
      </header>

      {screen === "setup" && (
        <main className="layout setup-grid">
          <section className="hero-panel">
            <div className="section-title">
              <Trophy size={18} />
              <span>Major run</span>
            </div>
            <div className="setup-form">
              <label>
                Team name
                <input value={teamName} onChange={(event) => setTeamName(event.target.value)} />
              </label>
              <div>
                <span className="label">Mode</span>
                <div className="segmented">
                  <button className={mode === "classic" ? "selected" : ""} onClick={() => setMode("classic")}>
                    <Target size={16} />
                    Classic
                  </button>
                  <button className={mode === "blind" ? "selected" : ""} onClick={() => setMode("blind")}>
                    <Shield size={16} />
                    Almanac
                  </button>
                  <button className={mode === "random" ? "selected" : ""} onClick={() => setMode("random")}>
                    <Dice5 size={16} />
                    Random
                  </button>
                  <button className={mode === "spectator" ? "selected" : ""} onClick={() => setMode("spectator")}>
                    <Eye size={16} />
                    Spectator
                  </button>
                </div>
              </div>
              <div>
                <span className="label">Difficulty</span>
                <div className="difficulty-grid">
                  {difficulties.map((item) => (
                    <button
                      key={item.id}
                      className={difficulty.id === item.id ? "choice selected" : "choice"}
                      onClick={() => setDifficulty(item)}
                    >
                      <Gauge size={16} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button className="primary large" onClick={startDraft}>
                {mode === "spectator" ? <FastForward size={19} /> : <Dice5 size={19} />}
                {mode === "spectator" ? "Start spectator" : "Start draft"}
              </button>
            </div>
          </section>
          <section className="field-panel">
            <div className="section-title">
              <Users size={18} />
              <span>Team database</span>
            </div>
            <div className="database-callout">
              <div>
                <strong>{rosterPool.length} teams loaded</strong>
                <span>{builtInRosterCount} built-in / {customRosters.length} custom saved</span>
              </div>
              <button className="secondary" onClick={() => setScreen("teams")}>
                <Database size={16} />
                Edit teams
              </button>
            </div>
            <div className="roster-grid compact">
              {rosterPool.slice(0, 6).map((roster) => (
                <RosterBadge key={roster.id} roster={roster} />
              ))}
            </div>
          </section>
          <RunDatabasePanel
            slots={runSlots}
            activeId={activeSaveId}
            message={saveMessage}
            canSave={hasSavableRun}
            onSave={saveCurrentRun}
            onLoad={loadSavedRun}
            onDelete={deleteSavedRun}
          />
        </main>
      )}

      {screen === "teams" && (
        <TeamLab
          rosterPool={rosterPool}
          coaches={coachPool}
          builtInCount={builtInRosterCount}
          customRosters={customRosters}
          teamForm={teamForm}
          teamJson={teamJson}
          message={teamLabMessage}
          setTeamForm={setTeamForm}
          setTeamJson={setTeamJson}
          onSave={saveTeam}
          onReset={() => {
            setTeamForm(createTeamForm());
            setTeamLabMessage("Sample team restored.");
          }}
          onExport={exportTeams}
          onImport={importTeams}
          onDelete={removeTeam}
          onBack={() => setScreen("setup")}
        />
      )}

      {screen === "draft" && (
        <main className="layout">
          <section className="draft-top">
            <div className="section-title">
              <Dice5 size={18} />
              <span>Draft pick {selected.length + 1} of 5</span>
            </div>
            <button className="secondary" disabled={rollsLeft <= 0 || rolling} onClick={reroll}>
              <RefreshCcw size={16} />
              Reroll ({rollsLeft})
            </button>
          </section>
          {rolling ? (
            <CaseRoll sequence={rollSequence} winnerIndex={CASE_ROLL_WINNER_INDEX} />
          ) : (
            <>
              <section className="roster-spotlight">
                <RosterBadge roster={currentRoster} large />
                <div className="missing-row">
                  {missingRoles.length === 0 ? (
                    <span className="chip good">Complete roles</span>
                  ) : (
                    missingRoles.map((role) => (
                      <span className="chip warn" key={role}>
                        Missing {role}
                      </span>
                    ))
                  )}
                </div>
              </section>
              <section className="player-grid">
                {currentRoster.players.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    hidden={mode === "blind"}
                    missing={missingRoles.includes(player.role)}
                    onClick={() => choosePlayer(player)}
                  />
                ))}
              </section>
            </>
          )}
          <Bench players={selected} coach={coach} />
        </main>
      )}

      {screen === "coach" && (
        <main className="layout">
          <section className="draft-top">
            <div className="section-title">
              <SlidersHorizontal size={18} />
              <span>Choose coach</span>
            </div>
            <div className="top-actions">
              <button className="secondary" onClick={dealCoachOptions}>
                <RefreshCcw size={16} />
                New shortlist
              </button>
            </div>
          </section>
          <section className="coach-grid coach-draft-grid" key={coachRevealKey}>
            {visibleCoachOptions.map((item, index) => (
              <button
                className="coach-card coach-reveal-card"
                key={`${coachRevealKey}-${item.id}`}
                onClick={() => chooseCoach(item)}
                style={{ "--deal-delay": `${index * 90}ms` } as React.CSSProperties}
              >
                <Avatar label={item.handle} accent={settings.accent} />
                <strong>{item.handle}</strong>
                <span>{item.country} / {item.realName}</span>
                <b>{item.rating} coach</b>
                <small>{item.style}</small>
                <p>{item.text}</p>
              </button>
            ))}
          </section>
          <Bench players={selected} coach={coach} />
        </main>
      )}

      {screen === "swiss" && runKind === "spectator" && (
        <main className="layout swiss-stage">
          <section className="swiss-round-panel">
            <div className="swiss-round-header">
              <div className="section-title">
                <Eye size={18} />
                <span>
                  Spectator mode - Swiss - {spectatorSwissResolved ? "Complete" : `Round ${spectatorSwissRound}`}
                </span>
              </div>
              <div className="swiss-actions">
                <button className="secondary" onClick={() => setScreen("stats")}>
                  <Target size={16} />
                  Stats
                </button>
                <button className="secondary" disabled={!matchResults.length} onClick={() => setScreen("results")}>
                  <Database size={16} />
                  Results
                </button>
                <button className="primary" onClick={simSpectatorSwissPhase}>
                  <FastForward size={17} />
                  {spectatorSwissResolved ? "Build playoffs" : "Sim games"}
                </button>
                <button className="secondary" onClick={restartRun}>
                  <RefreshCcw size={17} />
                  New run
                </button>
              </div>
            </div>
            <div className="run-status qualified">
              <strong>{spectatorSwissResolved ? "Swiss settled" : `Round ${spectatorSwissRound} ready`}</strong>
              <span>
                {spectatorSwissResolved
                  ? "The eight playoff teams are set. Build the bracket, then sim one playoff phase at a time."
                  : "Each click simulates only the visible Swiss round, saving results and player stats as it goes."}
              </span>
            </div>
            <div className="pickem-strip">
              <div className="pickem-title">
                <Target size={17} />
                <span>
                  {spectatorViewingPast
                    ? `Swiss round ${viewedSwissRound} results — click a series to open the match`
                    : spectatorSwissResolved
                      ? "Qualified teams are locked"
                      : `Swiss round ${spectatorSwissRound} pairings`}
                </span>
                <b>{swissField.length} teams</b>
              </div>
              {spectatorPastRounds.length > 0 && (
                <div className="swiss-round-tabs">
                  {spectatorPastRounds.map((rn) => (
                    <button key={rn} className={viewedSwissRound === rn ? "active" : ""} onClick={() => setViewedSwissRound(rn)}>
                      Round {rn}
                    </button>
                  ))}
                  {spectatorHasLive && (
                    <button className={!spectatorViewingPast ? "active" : ""} onClick={() => setViewedSwissRound(null)}>
                      {spectatorLiveRound ? `Round ${spectatorLiveRound}` : "Current"}
                    </button>
                  )}
                </div>
              )}
              <div className="swiss-match-list">
                {spectatorViewingPast ? (
                  swissPastResults.length ? (
                    swissPastResults.map((res) => (
                      <SwissMatchRow
                        key={res.id}
                        pair={{ id: res.pairId, left: res.left, right: res.right }}
                        record={swissRecordsBeforeViewed["user"] ?? { wins: 0, losses: 0 }}
                        teamRecords={swissRecordsBeforeViewed}
                        result={res}
                        locked
                        bestOf={res.bestOf}
                        onPick={() => undefined}
                        onOpenResult={openSeriesResult}
                      />
                    ))
                  ) : (
                    <div className="swiss-empty-row">No results saved for this round.</div>
                  )
                ) : spectatorSwissPairs.length ? (
                  spectatorSwissPairs.map((pair) => (
                    <SwissMatchRow
                      key={pair.id}
                      pair={pair}
                      record={record}
                      teamRecords={swissRecords}
                      result={latestResultForPair(matchResults, pair.id)}
                      locked
                      bestOf={swissPairBestOf(pair, swissRecords)}
                      onPick={() => undefined}
                      onOpenResult={openSeriesResult}
                    />
                  ))
                ) : (
                  <div className="swiss-empty-row">Swiss stage is complete.</div>
                )}
              </div>
            </div>
          </section>

          <section className="swiss-board-shell">
            <div className="swiss-board-title">
              <div className="section-title">
                <Target size={18} />
                <span>Swiss stage</span>
              </div>
              <span>Completed series stay clickable for stats</span>
            </div>
            <SpectatorSwissBoard
              field={swissField}
              records={swissRecords}
              results={matchResults}
              onOpenResult={openSeriesResult}
            />
          </section>
        </main>
      )}

      {screen === "swiss" && runKind !== "spectator" && (
        <main className="layout swiss-stage">
          <section className="swiss-round-panel">
            <div className="swiss-round-header">
              <div className="section-title">
                <Trophy size={18} />
                <span>
                  Major run - Swiss - {record.wins >= 3 ? "Qualified" : record.losses >= 3 ? "Eliminated" : `Round ${record.wins + record.losses + 1}`}
                </span>
              </div>
              <div className="swiss-actions">
                <button className="secondary" onClick={() => setScreen("stats")}>
                  <Target size={16} />
                  Stats
                </button>
                <button className="secondary" disabled={!matchResults.length} onClick={() => setScreen("results")}>
                  <Database size={16} />
                  Results
                </button>
                {swissCanSim ? (
                  <>
                    <button className="primary" onClick={simRemainingSwissGames}>
                      <FastForward size={17} />
                      Sim games
                    </button>
                    {record.losses >= 3 && (
                      <button className="secondary" onClick={restartRun}>
                        <RefreshCcw size={17} />
                        Retry run
                      </button>
                    )}
                  </>
                ) : runDone && record.losses >= 3 && isSwissStageResolved(swissField, swissRecords, record) ? (
                  <>
                    <button className="primary" onClick={() => enterNeutralPlayoffs(swissRecords, "eliminated")}>
                      <FastForward size={17} />
                      Continue bracket
                    </button>
                    <button className="secondary" onClick={restartRun}>
                      <RefreshCcw size={17} />
                      Retry run
                    </button>
                  </>
                ) : runDone ? (
                  <button className="primary" onClick={restartRun}>
                    <RefreshCcw size={17} />
                    Retry run
                  </button>
                ) : (
                  <button className="primary" onClick={startVeto}>
                    <Play size={17} />
                    Play my match
                  </button>
                )}
              </div>
            </div>
            {swissUserFinished && (
              <div className={record.wins >= 3 ? "run-status qualified" : "run-status eliminated"}>
                <strong>{record.wins >= 3 ? "Qualified" : "Eliminated"}</strong>
                <span>
                  {record.wins >= 3
                    ? swissCanSim
                      ? "Your playoff spot is locked. Sim the remaining Swiss matches to build the bracket."
                      : "The Swiss field is settled and the playoff bracket is ready."
                    : swissCanSim
                      ? "Your run is over, but you can still sim the remaining Swiss matches or retry."
                      : "The Swiss run ended before playoffs."}
                </span>
              </div>
            )}
            <div className="pickem-strip">
              <div className="pickem-title">
                <Target size={17} />
                <span>
                  {swissViewingPast
                    ? `Swiss round ${viewedSwissRound} results — click a series to open the match`
                    : "Pick'Em: bet on the winners of the other series and rack up points"}
                </span>
                <b>{pickemScore} pts</b>
                {lastPickemDelta > 0 && <em>+{lastPickemDelta}</em>}
              </div>
              {swissPastRounds.length > 0 && (
                <div className="swiss-round-tabs">
                  {swissPastRounds.map((rn) => (
                    <button
                      key={rn}
                      className={viewedSwissRound === rn ? "active" : ""}
                      onClick={() => setViewedSwissRound(rn)}
                    >
                      Round {rn}
                    </button>
                  ))}
                  {swissHasLive && (
                    <button
                      className={!swissViewingPast ? "active" : ""}
                      onClick={() => setViewedSwissRound(null)}
                    >
                      {swissLiveRound ? `Round ${swissLiveRound}` : "Current"}
                    </button>
                  )}
                </div>
              )}
              <div className="swiss-match-list">
                {swissViewingPast ? (
                  swissPastResults.length ? (
                    swissPastResults.map((res) => (
                      <SwissMatchRow
                        key={res.id}
                        pair={{ id: res.pairId, left: res.left, right: res.right }}
                        record={swissRecordsBeforeViewed["user"] ?? { wins: 0, losses: 0 }}
                        teamRecords={swissRecordsBeforeViewed}
                        result={res}
                        locked
                        bestOf={res.bestOf}
                        onPick={() => undefined}
                        onOpenResult={openSeriesResult}
                      />
                    ))
                  ) : (
                    <div className="swiss-empty-row">No results saved for this round.</div>
                  )
                ) : swissDisplayPairs.length ? (
                  swissDisplayPairs.map((pair) => (
                    <SwissMatchRow
                      key={pair.id}
                      pair={pair}
                      pick={pickems[pair.id]}
                      record={record}
                      teamRecords={swissRecords}
                      result={latestResultForPair(matchResults, pair.id)}
                      locked={pair.active || runDone || swissUserFinished}
                      bestOf={pair.active ? currentBestOf : swissPairBestOf(pair, swissRecords)}
                      onPick={(teamId) => pickWinner(pair, teamId)}
                      onOpenResult={openSeriesResult}
                    />
                  ))
                ) : (
                  <div className="swiss-empty-row">Swiss stage is complete.</div>
                )}
              </div>
            </div>
          </section>

          <section className="swiss-board-shell">
            <div className="swiss-board-title">
              <div className="section-title">
                <Target size={18} />
                <span>Swiss stage</span>
              </div>
              <span>Click an ended series later to inspect match stats</span>
            </div>
            <SwissBoard
              user={yourTeam}
              field={swissField}
              record={record}
              opponent={opponent}
              records={swissRecords}
              results={matchResults}
              onOpenResult={openSeriesResult}
            />
          </section>

          <section className="swiss-roster-bar">
            <div className="record-pill">
              <strong>{record.wins}-{record.losses}</strong>
              <span>{yourTeam.name}</span>
            </div>
            <div className="compact-roster">
              {selected.map((player) => (
                <span key={player.id}>
                  <b>{player.handle}</b>
                  {player.role}
                </span>
              ))}
              {coach && (
                <span>
                  <b>{coach.handle}</b>
                  Coach
                </span>
              )}
            </div>
            <AchievementStrip achievements={achievements} />
          </section>
        </main>
      )}

      {screen === "playoffs" && (
        <main className="layout swiss-stage">
          <section className="swiss-round-panel">
            <div className="swiss-round-header">
              <div className="section-title">
                <Trophy size={18} />
                <span>Playoffs - {playoffRoundLabel(playoffRound)}</span>
              </div>
              <div className="swiss-actions">
                <button className="secondary" onClick={() => setScreen("stats")}>
                  <Target size={16} />
                  Stats
                </button>
                <button className="secondary" disabled={!matchResults.length} onClick={() => setScreen("results")}>
                  <Database size={16} />
                  Results
                </button>
                {runKind === "player" && tournamentOutcome === "running" ? (
                  <button className="primary" onClick={startVeto}>
                    <Play size={17} />
                    Play series
                  </button>
                ) : canSimPlayoffPhase ? (
                  <button className="primary" onClick={simPlayoffPhase}>
                    <FastForward size={17} />
                    Sim games
                  </button>
                ) : (
                  <button className="primary" onClick={restartRun}>
                    <RefreshCcw size={17} />
                    New run
                  </button>
                )}
              </div>
            </div>
            {(runKind === "spectator" || tournamentOutcome !== "running") && (
              <div className={tournamentOutcome === "champion" || runKind === "spectator" ? "run-status qualified" : "run-status eliminated"}>
                <strong>
                  {tournamentOutcome === "champion"
                    ? "Major champions"
                    : tournamentOutcome === "complete"
                      ? "Tournament complete"
                      : runKind === "spectator"
                        ? "Spectator bracket"
                        : "Eliminated"}
                </strong>
                <span>
                  {tournamentOutcome === "champion"
                    ? "Your five lifted the trophy."
                    : tournamentOutcome === "complete"
                      ? `${tournamentWinner?.name ?? "The winner"} lifted the trophy.`
                      : runKind === "spectator"
                        ? "Sim one playoff phase at a time: quarterfinals, semifinals, then the BO5 final."
                        : "Your run is over, but you can keep simming the bracket to the end."}
                </span>
              </div>
            )}
            {(tournamentOutcome === "champion" || tournamentOutcome === "complete") && (
              <MajorAwardsPanel
                results={matchResults}
                championName={tournamentOutcome === "champion" ? yourTeam.name : tournamentWinner?.name}
                onOpenPlayer={openPlayerDetail}
              />
            )}
            <div className="pickem-strip">
              <div className="pickem-title">
                <Trophy size={17} />
                <span>{playoffRound === "final" ? "Grand final is BO5" : "Playoff matches are BO3"}</span>
                <b>BO{playoffBestOf(playoffRound)}</b>
              </div>
              <div className="swiss-match-list">
                {playoffPairs.map((pair) => (
                  <SwissMatchRow
                    key={pair.id}
                    pair={pair}
                    record={record}
                    teamRecords={swissRecords}
                    result={latestResultForPair(matchResults, pair.id)}
                    locked
                    bestOf={playoffBestOf(playoffRound)}
                    onPick={() => undefined}
                    onOpenResult={openSeriesResult}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="swiss-roster-bar">
            <div className="record-pill">
              <strong>{runKind === "spectator" ? playoffPairs.length : `${record.wins}-${record.losses}`}</strong>
              <span>{runKind === "spectator" ? "series this phase" : "Swiss record"}</span>
            </div>
            <div className="compact-roster">
              {runKind === "spectator"
                ? playoffPairs.flatMap((pair) => [pair.left, pair.right]).map((team) => (
                    <span key={team.id}>
                      <b>{team.tag}</b>
                      {team.name}
                    </span>
                  ))
                : (
                    <>
                      {selected.map((player) => (
                        <span key={player.id}>
                          <b>{player.handle}</b>
                          {player.role}
                        </span>
                      ))}
                      {coach && (
                        <span>
                          <b>{coach.handle}</b>
                          Coach
                        </span>
                      )}
                    </>
                  )}
            </div>
            {runKind === "player" && <AchievementStrip achievements={achievements} />}
          </section>
        </main>
      )}

      {screen === "stats" && (
        <RunStatsPage
          rows={playerDatabase}
          scope={statsScope}
          onScopeChange={setStatsScope}
          onBack={() => setScreen(phase === "playoffs" ? "playoffs" : "swiss")}
          onOpenPlayer={openPlayerDetail}
          onOpenTeam={openTeamDetail}
        />
      )}

      {screen === "player-detail" && detailPlayer && (
        <PlayerDetailPage
          player={detailPlayer.player}
          team={detailPlayer.team}
          results={matchResults}
          onBack={goBackScreen}
          onOpenSeries={openSeriesResult}
          onOpenTeam={openTeamDetail}
        />
      )}

      {screen === "team-detail" && detailTeam && (
        <TeamDetailPage
          team={detailTeam}
          results={matchResults}
          onBack={goBackScreen}
          onOpenSeries={openSeriesResult}
          onOpenPlayer={openPlayerDetail}
        />
      )}

      {screen === "balance-lab" && (
        <BalanceLabPage
          teams={labTeams}
          settings={settings}
          difficulty={difficulty}
          onBack={goBackScreen}
          onOpenTeam={openTeamDetail}
        />
      )}

      {screen === "vault" && (
        <VaultPage
          onBack={goBackScreen}
          onOpenReplay={(id) => {
            setVaultReplayId(id);
            pushScreen("vault-replay");
          }}
        />
      )}

      {screen === "vault-replay" && (
        <MatchRoundReplayPanel
          match={vaultReplayId ? getMatchDb().getMatch(vaultReplayId) : undefined}
          log={vaultReplayId ? getMatchDb().getEventLog(vaultReplayId) : undefined}
          onBack={goBackScreen}
        />
      )}

      {screen === "results" && (
        <RunResultsPage
          results={matchResults}
          selectedResultId={selectedResultId}
          onOpen={openSeriesResult}
          onBack={() => setScreen(phase === "playoffs" ? "playoffs" : "swiss")}
        />
      )}

      {screen === "series-detail" && (
        <SeriesDetailPage
          result={selectedResult}
          onBack={goBackScreen}
          onBackToRun={() => {
            setNavStack([]);
            setScreen(phase === "playoffs" ? "playoffs" : "swiss");
          }}
          onOpenPlayer={openPlayerDetail}
          onOpenTeam={openTeamDetail}
        />
      )}

      {screen === "veto" && (
        <main className="layout veto-grid">
          <section className="veto-board">
            <div className="match-header">
              <TeamPlate team={yourTeam} />
              <div>
                <strong>BO{currentBestOf}</strong>
                <span>{currentSeriesLabel} veto</span>
              </div>
              <TeamPlate team={opponent} align="right" />
            </div>
            {veto.ready ? (
              <button className="primary center-action" onClick={startMatch}>
                <Play size={18} />
                Start series
              </button>
            ) : (
              <div
                className={`turn-banner ${
                  veto.prompt.toLowerCase().includes("thinking")
                    ? "thinking"
                    : veto.prompt.toLowerCase().includes("pick")
                      ? "pick"
                      : "ban"
                }`}
              >
                {veto.prompt.toLowerCase().includes("pick") ? <Target size={18} /> : <Ban size={18} />}
                {veto.prompt}
              </div>
            )}
            <div className="map-set-strip">
              <strong>Map set</strong>
              {Array.from({ length: currentBestOf }).map((_, index) => {
                const map = veto.selected[index];
                return map ? (
                  <span key={`${map}-${index}`}>
                    {index + 1}. {mapName(map)}
                    <small>{veto.picked[map] === "you" ? "your pick" : veto.picked[map] === "opponent" ? `${opponent.tag} pick` : "decider"}</small>
                  </span>
                ) : (
                  <span className="pending" key={`pending-map-${index}`}>
                    {index + 1}. TBD
                    <small>pending</small>
                  </span>
                );
              })}
            </div>
            <div className="map-grid">
              {mapPool.map((map) => (
                <button
                  key={map.id}
                  className={`map-card ${veto.banned[map.id] ? "banned" : ""} ${veto.picked[map.id] ? "picked" : ""} ${veto.decider === map.id ? "decider" : ""}`}
                  disabled={Boolean(veto.banned[map.id] || veto.picked[map.id] || veto.ready || veto.pendingOpponent)}
                  onClick={() => ban(map.id)}
                  style={{ "--map": map.accent } as React.CSSProperties}
                >
                  <div className="map-art" />
                  <span>{vetoMapLabel(veto, map.id)}</span>
                  <strong>{map.name}</strong>
                </button>
              ))}
            </div>
            <ol className="veto-log">
              {veto.log.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
            <LineupCompare you={yourTeam} opponent={opponent} />
          </section>
          <aside className="analysis-panel">
            <div className="section-title">
              <Target size={18} />
              <span>Pre-match</span>
            </div>
            <PaperStrengthCompare
              you={yourTeam}
              opponent={opponent}
              yourStrength={strength}
              opponentStrength={opponentStrength}
              yourBreakdown={strengthBreakdown}
              opponentBreakdown={opponentStrengthBreakdown}
              edge={paperEdge}
            />
            <VetoCoachCard
              recommendation={buildVetoRecommendation(veto, yourTeam, opponent, settings, matchResults)}
              you={yourTeam}
              opponent={opponent}
              disabled={Boolean(veto.ready || veto.pendingOpponent)}
              onApply={(map) => ban(map)}
            />
            <div className="map-edges">
              {mapPool
                .map((map) => ({ ...map, edge: mapEdge(yourTeam, opponent, map.id, settings) }))
                .sort((a, b) => b.edge - a.edge)
                .map((map) => {
                  const status = vetoEdgeStatus(veto, map.id, opponent.tag);
                  const mapState = veto.banned[map.id] ? "banned" : veto.picked[map.id] === "decider" ? "decider" : veto.picked[map.id] ? "picked" : "";
                  const yourMapRecord = mapRecordForTeam(matchResults, yourTeam.id, map.id);
                  const opponentMapRecord = mapRecordForTeam(matchResults, opponent.id, map.id);
                  return (
                    <div className={`edge ${map.edge >= 0 ? "good" : "bad"} ${mapState}`} key={map.id}>
                      <span className="map-edge-label">
                        <span className="map-edge-name">{map.name}</span>
                        {status && <small>{status}</small>}
                        <span className="map-record-pair">
                          <span className={mapRecordTone(yourMapRecord)}>
                            <TeamLogo team={yourTeam} small />
                            <b>{formatMapRecord(yourMapRecord)}</b>
                          </span>
                          <span className={mapRecordTone(opponentMapRecord)}>
                            <TeamLogo team={opponent} small />
                            <b>{formatMapRecord(opponentMapRecord)}</b>
                          </span>
                        </span>
                      </span>
                      <meter min={-8} max={8} value={map.edge} />
                      <b>{map.edge > 0 ? "+" : ""}{map.edge.toFixed(1)}</b>
                    </div>
                  );
                })}
            </div>
            <FormList players={selected} form={playerForm} />
            <div className="bonus-compare">
              <BonusList title="Your bonuses" bonuses={bonuses} />
              <BonusList title={`${opponent.tag} bonuses`} bonuses={opponentBonuses} />
            </div>
          </aside>
        </main>
      )}

      {screen === "match" && match && (
        <main className="layout match-layout">
          <section className="live-top">
            <div className="section-title">
              <Swords size={18} />
              <span>{series?.label ?? currentSeriesLabel} / Map {(series?.currentMapIndex ?? 0) + 1} of {series?.bestOf ?? currentBestOf} / {mapName(match.map)}</span>
            </div>
            <div className="speed-row">
              {[0.5, 1, 2, 4].map((value) => (
                <button key={value} className={speed === value ? "selected" : ""} onClick={() => setSpeed(value)}>
                  {value}x
                </button>
              ))}
              <button onClick={() => setMatch({ ...match, running: !match.running })}>
                {match.running ? <Pause size={15} /> : <Play size={15} />}
                {match.running ? "Pause" : "Resume"}
              </button>
              <button onClick={useTimeout} disabled={timeouts <= 0}>
                <Clock3 size={15} />
                Timeout ({timeouts})
              </button>
              <button onClick={skipResult}>
                <SkipForward size={15} />
                Skip result
              </button>
              <button 
                className={realTimeRounds ? "selected" : ""} 
                onClick={() => setRealTimeRounds(!realTimeRounds)}
                title="Toggle between streaming events in real-time or playing entire rounds instantly"
              >
                {realTimeRounds ? "⏱️ Real-time" : "⚡ Instant Rounds"}
              </button>
            </div>
          </section>
          <section className="score-hero live-scoreboard">
            <TeamPlate team={yourTeam} />
            <div className="score">
              <b className={match.side === "CT" ? "ct-team" : "t-team"}>{match.you}</b>
              <span>:</span>
              <b className={match.side === "CT" ? "t-team" : "ct-team"}>{match.opponent}</b>
              <small>{series ? `${seriesMapScore(series)} / ` : ""}{match.running ? "live" : "paused"} / round {Math.min(match.round, 30)} / {match.side}</small>
            </div>
            <TeamPlate team={opponent} align="right" />
          </section>
          <RoundTimelinePanel
            title="Round timeline"
            label={`${mapName(match.map)} momentum`}
            left={yourTeam}
            right={opponent}
            maps={[roundTimelineMapFromMatch(match)]}
          />
          <section className="live-grid">
            <div className="feed-panel">
              <div className="feed-panel-head">
                <div className="section-title">
                  <FastForward size={18} />
                  <span>{liveFeedView === "feed" ? "Killfeed" : "Map view"}</span>
                </div>
                <div className="segmented compact feed-view-toggle">
                  <button className={liveFeedView === "feed" ? "selected" : ""} onClick={() => setLiveFeedView("feed")}>
                    Feed
                  </button>
                  <button className={liveFeedView === "map" ? "selected" : ""} onClick={() => setLiveFeedView("map")}>
                    Map
                  </button>
                </div>
              </div>
              {liveFeedView === "map" ? (
                <MatchMapView match={match} you={yourTeam} opponent={opponent} speed={speed} />
              ) : (
              <div className="feed-list">
                {match.feed.length ? (
                  match.feed.map((feed, index) => {
                    const getEventSide = (eventTeam: "you" | "opponent" | "neutral"): "CT" | "T" | "neutral" => {
                      if (eventTeam === "neutral") return "neutral";
                      return eventTeam === "you" ? match.side : (match.side === "CT" ? "T" : "CT");
                    };

                    const getPlayerSide = (playerId: string): "CT" | "T" => {
                      const isYourPlayer = selected.some(p => p.id === playerId);
                      return isYourPlayer ? match.side : (match.side === "CT" ? "T" : "CT");
                    };

                    if (feed.type === "round_start") {
                      return (
                        <div className="feed-line start-line" key={`${feed.round}-${index}`}>
                          <span className="feed-round-badge">R{feed.round}</span>
                          <span className="feed-message">{feed.reason || "Round started"}</span>
                        </div>
                      );
                    }

                    if (feed.type === "round_over") {
                      const winnerSide = getEventSide(feed.team);
                      const isCTWinner = winnerSide === "CT";
                      return (
                        <div className={`feed-line round-over-line ${winnerSide.toLowerCase()}`} key={`${feed.round}-${index}`}>
                          <span className="feed-round-badge">R{feed.round}</span>
                          <span className="feed-message">
                            Round over - Winner: <span className={isCTWinner ? "ct-team" : "t-team"}><b>{winnerSide}</b></span> (
                            <span className="t-team"><b>{feed.tScore}</b></span> - <span className="ct-team"><b>{feed.ctScore}</b></span>) - {feed.reason}
                          </span>
                        </div>
                      );
                    }

                    if (feed.type === "plant") {
                      const plantSite = (feed.round + (feed.killerId ? feed.killerId.charCodeAt(0) : 0)) % 2 === 0 ? "A" : "B";
                      return (
                        <div className="feed-line plant-line" key={`${feed.round}-${index}`}>
                          <span className="feed-round-badge">R{feed.round}</span>
                          <span className="feed-message">
                            💣 <b className="t-team">{feed.killer}</b> planted the bomb on <b>{plantSite}</b> (<span className="t-team">{feed.tAlive}</span>on<span className="ct-team">{feed.ctAlive}</span>)
                          </span>
                        </div>
                      );
                    }

                    if (feed.type === "defuse") {
                      return (
                        <div className="feed-line defuse-line" key={`${feed.round}-${index}`}>
                          <span className="feed-round-badge">R{feed.round}</span>
                          <span className="feed-message">
                            ⚙️ <b className="ct-team">{feed.killer}</b> defused the bomb
                          </span>
                        </div>
                      );
                    }

                    if (feed.type === "explode") {
                      return (
                        <div className="feed-line explode-line" key={`${feed.round}-${index}`}>
                          <span className="feed-round-badge">R{feed.round}</span>
                          <span className="feed-message">
                            💥 The bomb exploded
                          </span>
                        </div>
                      );
                    }

                    if (feed.type === "flash" || feed.type === "smoke" || feed.type === "molotov" || feed.type === "he") {
                      const utilSide = getEventSide(feed.team);
                      return (
                        <div className={`feed-line util-line ${utilSide.toLowerCase()}`} key={`${feed.round}-${index}`}>
                          <span className="feed-round-badge">R{feed.round}</span>
                          <img className="util-feed-icon" src={utilityIcons[feed.type]} alt={feed.type} title={feed.type} />
                          <span className="feed-message">
                            <b className={`${utilSide.toLowerCase()}-team`}>{feed.killer}</b> {utilityLabels[feed.type]}
                          </span>
                        </div>
                      );
                    }

                    const killerSide = getEventSide(feed.team);
                    const victimSide = killerSide === "CT" ? "T" : "CT";
                    const assistantSide = feed.assistant ? killerSide : null;

                    return (
                      <div className="feed-line kill-line" key={`${feed.round}-${index}`}>
                        <span className="feed-round-badge">R{feed.round}</span>
                        <span className="feed-killer-name">
                          <b className={`${killerSide.toLowerCase()}-team`}>{feed.killer}</b>
                          {feed.assistant && (
                            <>
                              <span className="assistant-plus"> + </span>
                              <b className={`${assistantSide?.toLowerCase()}-team`}>{feed.assistant}</b>
                            </>
                          )}
                        </span>
                        <div className="feed-icons">
                          {weaponIcons[feed.weapon] ? (
                            <img className="weapon-feed-icon" src={weaponIcons[feed.weapon]} alt={feed.weapon} title={feed.weapon} />
                          ) : (
                            <span className="weapon-text">{feed.weapon}</span>
                          )}
                          {feed.flashAssist && (
                            <img className="util-feed-icon flash-assist" src={utilityIcons.flash} alt="flash assist" title="Flash assist" />
                          )}
                          {feed.isHeadshot && <span className="hs-icon" title="Headshot">💀</span>}
                        </div>
                        <span className={`${victimSide.toLowerCase()}-team`}><b>{feed.victim}</b></span>
                        {feed.first && <span className="first-badge">first</span>}
                      </div>
                    );
                  })
                ) : (
                  <div className="feed-empty">Waiting for the opener...</div>
                )}
              </div>
              )}
            </div>
            <div className="tactics-panel">
              <div className="section-title">
                <Shield size={18} />
                <span>Round call</span>
              </div>
              <div className="econ-row">
                <span>{yourTeam.tag}: {match.economy} {match.yourMoney && `($${totalYourMoney.toLocaleString()})`}</span>
                <span>{opponent.tag}: {match.opponentEconomy} {match.opponentMoney && `($${totalOpponentMoney.toLocaleString()})`}</span>
              </div>
              <RoundReadPanel
                read={buildRoundRead(match, yourTeam, opponent, settings, totalYourMoney, totalOpponentMoney)}
                currentTactic={tactic}
                onApply={setTactic}
              />
              <div className="call-composer">
                <div className="call-row">
                  <span>Read</span>
                  {ROUND_STYLE_OPTIONS.map((item) => (
                    <button
                      className={activeCall.style === item.id ? "selected" : ""}
                      key={item.id}
                      onClick={() => setTactic(composeTactic(item.id, activeCall.buy))}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="call-row">
                  <span>Buy</span>
                  {BUY_CALL_OPTIONS.map((item) => (
                    <button
                      className={activeCall.buy === item.id ? "selected" : ""}
                      key={item.id}
                      onClick={() => setTactic(composeTactic(activeCall.style, item.id))}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <CallFitPanel players={yourTeam.players} activeStyle={activeCall.style} />
              <CoachDeskPanel
                match={match}
                you={yourTeam}
                opponent={opponent}
                timeouts={timeouts}
                timeoutPlan={timeoutPlan}
                onTimeout={useTimeout}
              />
              <p>{match.lastReason ?? "Opening defaults are live."}</p>
            </div>
          </section>
          <section className="match-stats-grid">
            <StatsTable title={yourTeam.name} players={selected} stats={match.yourStats} money={match.yourMoney} weapons={match.yourWeapons} armor={match.yourArmor} />
            <StatsTable title={opponent.name} players={opponent.players} stats={match.opponentStats} money={match.opponentMoney} weapons={match.opponentWeapons} armor={match.opponentArmor} />
          </section>
        </main>
      )}

      {screen === "result" && match && (
        <main className="layout result-layout">
          <section className="score-hero result">
            <TeamPlate team={yourTeam} />
            <div className="score">
              <b className={match.side === "CT" ? "t-team" : "ct-team"}>{match.you}</b>
              <span>:</span>
              <b className={match.side === "CT" ? "ct-team" : "t-team"}>{match.opponent}</b>
              <small>{series ? `${seriesMapScoreAfterCurrent(series, match)} / ` : ""}{mapName(match.map)} final</small>
            </div>
            <TeamPlate team={opponent} align="right" />
          </section>
          {/* Primary action up top so it stays reachable now that the full box score leads the page. */}
          <div className="result-action-bar">
            <button className="primary" onClick={continueSeries}>
              <Play size={17} />
              {series && !seriesIsDone({ ...series, mapResults: [...series.mapResults, mapResultFromState(match.map, match, yourTeam, opponent)] }) ? "Next map" : "Continue"}
            </button>
          </div>
          <MatchStatsPanel
            maps={resultMaps}
            mapResults={resultMapResults}
            teams={resultStatsTeams}
          />
          <section className="analysis-panel full series-analysis">
            <div className="series-analysis-head">
              <div className="section-title">
                <CheckCircle2 size={18} />
                <span>Series analysis</span>
              </div>
              <span>{series?.label ?? currentSeriesLabel} report</span>
            </div>
            <div className="analysis-note-grid">
              {resultNotes(match, yourTeam, opponent, settings, difficulty).map((note, index) => (
                <p className="note analysis-note" key={note}>
                  <b>{["Result", "Strength", "Veto"][index] ?? "Note"}</b>
                  <span>{note}</span>
                </p>
              ))}
            </div>
            <AchievementStrip achievements={achievements} />
          </section>
          <MatchLineups teams={resultStatsTeams} />
          <RoundTimelinePanel
            title="Round timeline"
            label="Momentum report"
            left={yourTeam}
            right={opponent}
            maps={resultMapResults.map((map, index) => roundTimelineMapFromResult(map, index))}
          />
          <SeriesRoundReplayPanel left={yourTeam} right={opponent} maps={resultMapResults} />
        </main>
      )}

      {showSettings && (
        <SettingsDrawer
          settings={settings}
          setSettings={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function TeamLab({
  rosterPool,
  coaches,
  builtInCount,
  customRosters,
  teamForm,
  teamJson,
  message,
  setTeamForm,
  setTeamJson,
  onSave,
  onReset,
  onExport,
  onImport,
  onDelete,
  onBack,
}: {
  rosterPool: Roster[];
  coaches: Coach[];
  builtInCount: number;
  customRosters: Roster[];
  teamForm: TeamForm;
  teamJson: string;
  message: string;
  setTeamForm: React.Dispatch<React.SetStateAction<TeamForm>>;
  setTeamJson: React.Dispatch<React.SetStateAction<string>>;
  onSave: () => void;
  onReset: () => void;
  onExport: () => void;
  onImport: () => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  const [labView, setLabView] = useState<TeamLabView>("builder");
  const [scoutQuery, setScoutQuery] = useState("");
  const [scoutRole, setScoutRole] = useState<Role | "all">("all");
  const [scoutSort, setScoutSort] = useState<ScoutSortKey>("ovr");
  const [scoutDescending, setScoutDescending] = useState(true);
  const [scoutAuditOnly, setScoutAuditOnly] = useState(false);
  const scoutRows = useMemo(() => buildScoutRows(rosterPool), [rosterPool]);
  const filteredScoutRows = useMemo(
    () => filterScoutRows(scoutRows, scoutQuery, scoutRole, scoutSort, scoutDescending, scoutAuditOnly),
    [scoutAuditOnly, scoutDescending, scoutQuery, scoutRole, scoutRows, scoutSort],
  );
  const scoutSummary = useMemo(() => summarizeScoutRows(scoutRows), [scoutRows]);

  const update = <K extends keyof TeamForm>(key: K, value: TeamForm[K]) => {
    setTeamForm((current) => ({ ...current, [key]: value }));
  };

  const updatePlayer = <K extends keyof TeamFormPlayer>(index: number, key: K, value: TeamFormPlayer[K]) => {
    setTeamForm((current) => ({
      ...current,
      players: current.players.map((player, playerIndex) => (playerIndex === index ? { ...player, [key]: value } : player)),
    }));
  };

  const updateMap = (map: MapId, value: number) => {
    setTeamForm((current) => ({
      ...current,
      mapBase: { ...current.mapBase, [map]: value },
    }));
  };

  return (
    <main className="layout team-lab">
      <section className="team-lab-hero">
        <div>
          <div className="section-title">
            <Database size={18} />
            <span>Team Lab</span>
          </div>
          <h1>Build the teams you want in the Major pool.</h1>
          <p>Saved teams join the case roll and can qualify into future 16-team Swiss fields.</p>
        </div>
        <div className="database-stats">
          <span>
            <b>{rosterPool.length}</b>
            total teams
          </span>
          <span>
            <b>{customRosters.length}</b>
            custom teams
          </span>
          <div className="team-lab-tabs segmented compact">
            <button className={labView === "builder" ? "selected" : ""} onClick={() => setLabView("builder")}>
              <Users size={15} />
              Builder
            </button>
            <button className={labView === "scout" ? "selected" : ""} onClick={() => setLabView("scout")}>
              <Search size={15} />
              Players
            </button>
            <button className={labView === "integrity" ? "selected" : ""} onClick={() => setLabView("integrity")}>
              <CheckCircle2 size={15} />
              Integrity
            </button>
          </div>
          <button className="secondary" onClick={onBack}>
            Back to setup
          </button>
        </div>
      </section>

      {labView === "integrity" && <DataIntegrityPanel rosters={rosterPool} coaches={coaches} />}

      {labView === "builder" && (
        <section className="team-editor-panel">
          <div className="team-editor-toolbar">
            <div className="section-title">
              <Users size={18} />
              <span>New team</span>
            </div>
            <div>
              <button className="secondary" onClick={onReset}>
                <RefreshCcw size={16} />
                Sample
              </button>
              <button className="primary" onClick={onSave}>
                <Save size={16} />
                Save team
              </button>
            </div>
          </div>

          {message && <div className="team-lab-message">{message}</div>}

          <div className="team-form-grid">
            <label>
              Team tag
              <input value={teamForm.tag} maxLength={5} onChange={(event) => update("tag", event.target.value)} />
            </label>
            <label>
              Team name
              <input value={teamForm.name} onChange={(event) => update("name", event.target.value)} />
            </label>
            <label>
              Country
              <input value={teamForm.country} maxLength={3} onChange={(event) => update("country", event.target.value)} />
            </label>
            <label>
              Era
              <select value={teamForm.era} onChange={(event) => update("era", event.target.value as Era)}>
                {eraOptions.map((era) => (
                  <option key={era} value={era}>
                    {era}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Year
              <input value={teamForm.year} onChange={(event) => update("year", event.target.value)} />
            </label>
            <label>
              Accent
              <input type="color" value={teamForm.accent} onChange={(event) => update("accent", event.target.value)} />
            </label>
            <label className="wide-field">
              Team note
              <textarea value={teamForm.tagline} onChange={(event) => update("tagline", event.target.value)} />
            </label>
          </div>

          <div className="map-editor">
            <div className="section-title">
              <Target size={18} />
              <span>Map strengths</span>
            </div>
            <div className="map-editor-grid">
              {mapPool.map((map) => (
                <Range
                  key={map.id}
                  label={map.name}
                  value={teamForm.mapBase[map.id]}
                  min={55}
                  max={99}
                  step={1}
                  onChange={(value) => updateMap(map.id, value)}
                />
              ))}
            </div>
          </div>

          <div className="player-editor-list">
            {teamForm.players.map((player, index) => {
              const stats = normalizeStats({
                aim: player.aim,
                clutch: player.clutch,
                consistency: player.consistency,
                awp: player.awp,
                igl: player.igl,
              });
              return (
                <article className="player-editor-card" key={index}>
                  <div className="player-editor-head">
                    <strong>Player {index + 1}</strong>
                    <span>{ratePlayer(stats, player.role)} OVR</span>
                  </div>
                  <div className="player-editor-grid">
                    <label>
                      Handle
                      <input value={player.handle} onChange={(event) => updatePlayer(index, "handle", event.target.value)} />
                    </label>
                    <label>
                      Real name
                      <input value={player.realName} onChange={(event) => updatePlayer(index, "realName", event.target.value)} />
                    </label>
                    <label>
                      Country
                      <input value={player.country} maxLength={3} onChange={(event) => updatePlayer(index, "country", event.target.value)} />
                    </label>
                    <label>
                      Role
                      <select value={player.role} onChange={(event) => updatePlayer(index, "role", event.target.value as Role)}>
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Style
                      <select value={player.style} onChange={(event) => updatePlayer(index, "style", event.target.value as Style)}>
                        {styleOptions.map((style) => (
                          <option key={style} value={style}>
                            {style}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(["aim", "clutch", "consistency", "awp", "igl"] as const).map((stat) => (
                      <label key={stat}>
                        {stat}
                        <input
                          type="number"
                          min={stat === "awp" || stat === "igl" ? 45 : 50}
                          max={99}
                          value={player[stat]}
                          onChange={(event) => updatePlayer(index, stat, Number(event.target.value))}
                        />
                      </label>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {labView === "scout" && (
        <section className="team-scout-panel">
          <div className="team-editor-toolbar">
            <div className="section-title">
              <Search size={18} />
              <span>Player scouting</span>
            </div>
            <span className="scout-count">{filteredScoutRows.length} shown</span>
          </div>

          <div className="scout-summary-grid">
            <div>
              <span>Players</span>
              <b>{scoutSummary.players}</b>
            </div>
            <div>
              <span>Avg OVR</span>
              <b>{scoutSummary.avgOvr.toFixed(1)}</b>
            </div>
            <div>
              <span>88+ cards</span>
              <b>{scoutSummary.stars}</b>
            </div>
            <div>
              <span>Low sample</span>
              <b>{scoutSummary.lowSample}</b>
            </div>
            <div>
              <span>Audit flags</span>
              <b>{scoutSummary.auditRows}</b>
            </div>
          </div>

          <div className="scout-controls">
            <label className="scout-search">
              Search
              <div>
                <Search size={16} />
                <input value={scoutQuery} onChange={(event) => setScoutQuery(event.target.value)} placeholder="Player, team, country, role..." />
              </div>
            </label>
            <label>
              Role
              <select value={scoutRole} onChange={(event) => setScoutRole(event.target.value as Role | "all")}>
                <option value="all">All roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select value={scoutSort} onChange={(event) => setScoutSort(event.target.value as ScoutSortKey)}>
                <option value="ovr">OVR</option>
                <option value="hltv">HLTV rating</option>
                <option value="audit">Audit flags</option>
                <option value="aim">Aim</option>
                <option value="clutch">Clutch</option>
                <option value="consistency">Consistency</option>
                <option value="awp">AWP</option>
                <option value="igl">IGL</option>
                <option value="team">Team</option>
              </select>
            </label>
            <button className="secondary" onClick={() => setScoutDescending((current) => !current)}>
              {scoutDescending ? "High to low" : "Low to high"}
            </button>
            <button className={scoutAuditOnly ? "secondary selected" : "secondary"} onClick={() => setScoutAuditOnly((current) => !current)}>
              Audit only
            </button>
          </div>

          <div className="scout-table-card">
            <div className="scout-table-head scout-grid">
              <span>Player</span>
              <span>Team</span>
              <span>OVR</span>
              <span>HLTV</span>
              <span>Aim</span>
              <span>Clutch</span>
              <span>Const.</span>
              <span>AWP</span>
              <span>IGL</span>
              <span>Map fit</span>
              <span>Audit</span>
            </div>
            {filteredScoutRows.map((row) => (
              <article className={`scout-table-row scout-grid ${row.auditFlags.length ? "has-audit" : ""}`} key={`${row.roster.id}-${row.player.id}`}>
                <div className="scout-player-cell">
                  <Flag country={row.player.country} />
                  <div>
                    <strong>{row.player.handle}</strong>
                    <small>{row.player.country} / {row.player.realName} / {row.player.role} / {row.player.style}</small>
                  </div>
                </div>
                <div className="scout-team-cell">
                  <TeamLogo team={row.roster} small />
                  <div>
                    <b>{row.roster.tag}</b>
                    <small>{row.roster.year}</small>
                  </div>
                </div>
                <span className={`scout-ovr ${overallTone(row.player.ovr)}`}>{row.player.ovr}</span>
                <span className={`scout-hltv ${row.hltvTone}`}>
                  {row.hltvLabel}
                  <small>{row.sampleLabel}</small>
                </span>
                <StatCell value={row.player.stats.aim} />
                <StatCell value={row.player.stats.clutch} />
                <StatCell value={row.player.stats.consistency} />
                <StatCell value={row.player.stats.awp} />
                <StatCell value={row.player.stats.igl} />
                <span className="scout-map-cell">
                  <b title={`${row.bestMap.name} raw map value ${row.bestMap.value}`}>
                    {row.bestMap.name} {formatSignedWhole(row.bestMap.delta)}
                  </b>
                  <small title={`${row.worstMap.name} raw map value ${row.worstMap.value}`}>
                    {row.worstMap.name} {formatSignedWhole(row.worstMap.delta)}
                  </small>
                </span>
                <span className={`scout-audit-cell ${primaryAuditSeverity(row.auditFlags)}`}>
                  {row.auditFlags.length ? (
                    <>
                      {row.auditFlags.slice(0, 2).map((flag) => (
                        <b className={flag.severity} key={flag.label} title={flag.reason}>
                          {flag.label}
                        </b>
                      ))}
                      {row.auditFlags.length > 2 && <small>+{row.auditFlags.length - 2} more</small>}
                    </>
                  ) : (
                    <small>Clean</small>
                  )}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}

      <aside className="team-database-panel">
        <div className="section-title">
          <Database size={18} />
          <span>Loaded teams</span>
        </div>
        <div className="team-list">
          {rosterPool.map((roster, index) => {
            const isCustom = index >= builtInCount;
            return (
              <article className="team-row" key={roster.id} style={{ "--crest": roster.accent } as React.CSSProperties}>
                <TeamLogo team={roster} small />
                <div>
                  <strong>{roster.name}</strong>
                  <span>{roster.country} / {roster.era} / {averageOvr(roster.players).toFixed(1)} avg</span>
                </div>
                <em>{isCustom ? "custom" : "built-in"}</em>
                {isCustom && (
                  <button className="danger-icon" title={`Delete ${roster.name}`} onClick={() => onDelete(roster.id)}>
                    <Trash2 size={15} />
                  </button>
                )}
              </article>
            );
          })}
        </div>

        <div className="json-tools">
          <div className="section-title">
            <Upload size={18} />
            <span>Import / export</span>
          </div>
          <textarea
            value={teamJson}
            placeholder="Paste exported team JSON here, or press Export JSON."
            onChange={(event) => setTeamJson(event.target.value)}
          />
          <div className="json-actions">
            <button className="secondary" onClick={onExport}>
              <Download size={16} />
              Export JSON
            </button>
            <button className="secondary" onClick={onImport}>
              <Upload size={16} />
              Import JSON
            </button>
          </div>
        </div>
      </aside>
    </main>
  );
}

function DataIntegrityPanel({ rosters, coaches }: { rosters: Roster[]; coaches: Coach[] }) {
  const summary = useMemo(() => validateDataset(rosters, coaches), [rosters, coaches]);
  const grouped = useMemo(() => groupIssuesByCode(summary.issues), [summary]);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? summary.issues : summary.issues.slice(0, 30);

  return (
    <section className="integrity-panel">
      <div className="integrity-head">
        <div className="section-title">
          <CheckCircle2 size={18} />
          <span>Data integrity</span>
        </div>
        <div className="integrity-counts">
          <span className={summary.errors ? "bad" : "good"}>{summary.errors} errors</span>
          <span className={summary.warnings ? "warn" : "good"}>{summary.warnings} warnings</span>
          <span className="muted">
            {rosters.length} teams · {coaches.length} coaches
          </span>
        </div>
      </div>

      {summary.issues.length === 0 ? (
        <p className="integrity-clean">Every team, player and coach passes validation.</p>
      ) : (
        <>
          <div className="integrity-bycode">
            {grouped.map((group) => (
              <span key={group.code} className={`integrity-chip ${group.level}`}>
                {group.code}
                <b>{group.count}</b>
              </span>
            ))}
          </div>
          <ul className="integrity-list">
            {visible.map((issue, index) => (
              <li key={`${issue.code}-${issue.path}-${index}`} className={issue.level}>
                <em>{issue.level}</em>
                <b>{issue.message}</b>
                <span>{issue.path}</span>
              </li>
            ))}
          </ul>
          {summary.issues.length > 30 && (
            <button className="secondary" onClick={() => setShowAll((value) => !value)}>
              {showAll ? "Show fewer" : `Show all ${summary.issues.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function groupIssuesByCode(issues: ValidationIssue[]) {
  const map = new Map<string, { code: string; level: ValidationIssue["level"]; count: number }>();
  for (const issue of issues) {
    const current = map.get(issue.code) ?? { code: issue.code, level: issue.level, count: 0 };
    current.count += 1;
    map.set(issue.code, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function buildScoutRows(rosterPool: Roster[]): ScoutRow[] {
  return rosterPool.flatMap((roster) =>
    roster.players.map((player) => {
      const mapValues = mapPool.map((map) => ({ name: map.name, value: player.maps[map.id] ?? roster.mapPool[map.id] ?? 0 }));
      const averageMap = mapValues.reduce((sum, map) => sum + map.value, 0) / Math.max(mapValues.length, 1);
      const maps = mapValues
        .map((map) => ({ ...map, delta: Math.round(map.value - averageMap) }))
        .sort((a, b) => b.value - a.value);
      const hasHltvRating = typeof player.hltvRating === "number" && (player.hltvMaps ?? 0) > 0;
      const auditFlags = auditScoutPlayer(player, maps, hasHltvRating);

      return {
        player,
        roster,
        bestMap: maps[0] ?? { name: "-", value: 0, delta: 0 },
        worstMap: maps[maps.length - 1] ?? { name: "-", value: 0, delta: 0 },
        auditFlags,
        hltvLabel: hasHltvRating ? player.hltvRating!.toFixed(2) : "-",
        hltvTone: hasHltvRating ? ratingTone(player.hltvRating!) : "muted",
        sampleLabel: hasHltvRating ? `${player.hltvMaps} maps` : "no data",
      };
    }),
  );
}

function filterScoutRows(
  rows: ScoutRow[],
  query: string,
  role: Role | "all",
  sortKey: ScoutSortKey,
  descending: boolean,
  auditOnly: boolean,
) {
  const normalizedQuery = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (role !== "all" && row.player.role !== role) return false;
    if (auditOnly && row.auditFlags.length === 0) return false;
    if (!normalizedQuery) return true;
    return [
      row.player.handle,
      row.player.realName,
      row.player.country,
      row.player.role,
      row.player.style,
      ...row.auditFlags.map((flag) => flag.label),
      row.roster.name,
      row.roster.tag,
      row.roster.country,
      row.roster.year,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return [...visible].sort((a, b) => {
    if (sortKey === "team") {
      const teamCompare = a.roster.name.localeCompare(b.roster.name);
      if (teamCompare !== 0) return descending ? -teamCompare : teamCompare;
      return b.player.ovr - a.player.ovr;
    }
    if (sortKey === "audit") {
      const scoreCompare = scoutAuditScore(a) - scoutAuditScore(b);
      if (scoreCompare !== 0) return descending ? -scoreCompare : scoreCompare;
      return b.player.ovr - a.player.ovr;
    }

    const aValue = scoutSortValue(a.player, sortKey);
    const bValue = scoutSortValue(b.player, sortKey);
    if (aValue === bValue) return a.player.handle.localeCompare(b.player.handle);
    return descending ? bValue - aValue : aValue - bValue;
  });
}

function scoutSortValue(player: Player, sortKey: ScoutSortKey) {
  if (sortKey === "ovr") return player.ovr;
  if (sortKey === "hltv") return typeof player.hltvRating === "number" ? player.hltvRating : -1;
  if (sortKey === "team") return 0;
  if (sortKey === "audit") return 0;
  return player.stats[sortKey];
}

function scoutAuditScore(row: ScoutRow) {
  return row.auditFlags.reduce(
    (sum, flag) => sum + (flag.severity === "danger" ? 3 : flag.severity === "warn" ? 2 : 1),
    0,
  );
}

function summarizeScoutRows(rows: ScoutRow[]) {
  const players = rows.length;
  const avgOvr = players ? rows.reduce((sum, row) => sum + row.player.ovr, 0) / players : 0;
  const stars = rows.filter((row) => row.player.ovr >= 88).length;
  const lowSample = rows.filter((row) => typeof row.player.hltvMaps === "number" && row.player.hltvMaps > 0 && row.player.hltvMaps < 30).length;
  const auditRows = rows.filter((row) => row.auditFlags.length > 0).length;
  return { players, avgOvr, stars, lowSample, auditRows };
}

function auditScoutPlayer(
  player: Player,
  maps: Array<{ name: string; value: number; delta: number }>,
  hasHltvRating: boolean,
): ScoutAuditFlag[] {
  const flags: ScoutAuditFlag[] = [];
  const hltvRating = player.hltvRating ?? 0;
  const hltvMaps = player.hltvMaps ?? 0;
  const mapSpread = maps.length ? maps[0].value - maps[maps.length - 1].value : 0;

  if (hasHltvRating) {
    if (hltvRating >= 1.18 && player.ovr < 84) {
      flags.push({ label: "Star low OVR", reason: `HLTV ${hltvRating.toFixed(2)} but only ${player.ovr} OVR.`, severity: "danger" });
    } else if (hltvRating >= 1.1 && player.ovr < 77) {
      flags.push({ label: "Maybe low", reason: `HLTV ${hltvRating.toFixed(2)} is strong for a ${player.ovr} OVR card.`, severity: "warn" });
    }

    if (hltvRating <= 0.92 && player.ovr >= 78) {
      flags.push({ label: "Maybe high", reason: `HLTV ${hltvRating.toFixed(2)} may not support ${player.ovr} OVR.`, severity: "warn" });
    }

    if (hltvMaps > 0 && hltvMaps < 30) {
      flags.push({ label: "Low sample", reason: `${hltvMaps} maps in the current HLTV sample.`, severity: "info" });
    }
  }

  if (player.role === "AWP" && player.stats.awp < 78) {
    flags.push({ label: "AWP stat", reason: `AWPer with ${player.stats.awp} AWP stat.`, severity: "warn" });
  }
  if (player.role === "IGL" && player.stats.igl < 78) {
    flags.push({ label: "IGL stat", reason: `IGL with ${player.stats.igl} IGL stat.`, severity: "warn" });
  }
  if (player.role === "Entry" && player.stats.aim < 78) {
    flags.push({ label: "Entry aim", reason: `Entry with ${player.stats.aim} aim.`, severity: "warn" });
  }
  if (player.role === "Lurker" && player.stats.clutch < 78) {
    flags.push({ label: "Lurk clutch", reason: `Lurker with ${player.stats.clutch} clutch.`, severity: "warn" });
  }
  if (player.role === "Support" && player.stats.consistency < 75) {
    flags.push({ label: "Support floor", reason: `Support with ${player.stats.consistency} consistency.`, severity: "warn" });
  }

  if (mapSpread >= 12) {
    flags.push({ label: "Map swing", reason: `${mapSpread} point gap between best and worst map fit.`, severity: "info" });
  }

  return flags;
}

function overallTone(ovr: number) {
  if (ovr >= 86) return "good";
  if (ovr >= 76) return "neutral";
  return "bad";
}

function primaryAuditSeverity(flags: ScoutAuditFlag[]) {
  if (flags.some((flag) => flag.severity === "danger")) return "danger";
  if (flags.some((flag) => flag.severity === "warn")) return "warn";
  if (flags.length) return "info";
  return "clean";
}

function StatCell({ value }: { value: number }) {
  return (
    <span className="scout-stat-cell">
      <b>{value}</b>
      <i style={{ "--stat-fill": `${Math.max(0, Math.min(100, value))}%` } as React.CSSProperties} />
    </span>
  );
}

function formatSignedWhole(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function TeamLogo({ team, small = false }: { team: Pick<Roster | FieldTeam, "tag" | "name" | "accent" | "logo">; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(team.logo && !failed);
  const className = `team-logo${small ? " small" : ""}${showLogo ? " has-image" : ""}`;

  useEffect(() => {
    setFailed(false);
  }, [team.logo]);

  return (
    <div className={className} style={{ "--crest": team.accent } as React.CSSProperties}>
      {showLogo ? (
        <img
          src={team.logo}
          alt={`${team.name} logo`}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        team.tag
      )}
    </div>
  );
}

function RosterBadge({ roster, large = false }: { roster: Roster; large?: boolean }) {
  return (
    <article className={large ? "roster-badge large" : "roster-badge"} style={{ "--crest": roster.accent } as React.CSSProperties}>
      <TeamLogo team={roster} />
      <div>
        <strong>{roster.name}</strong>
        <span>{roster.country} / {roster.era} / {roster.year}</span>
        {large && <p>{roster.tagline}</p>}
      </div>
    </article>
  );
}

function RunDatabasePanel({
  slots,
  activeId,
  message,
  canSave,
  onSave,
  onLoad,
  onDelete,
}: {
  slots: SavedRun[];
  activeId?: string;
  message: string;
  canSave: boolean;
  onSave: () => void;
  onLoad: (slot: SavedRun) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="run-db-panel">
      <div className="run-db-head">
        <div className="section-title">
          <Database size={18} />
          <span>Run database</span>
        </div>
        <div className="run-db-actions">
          {message && <span>{message}</span>}
          <button className="secondary" disabled={!canSave} onClick={onSave}>
            <Save size={16} />
            {activeId ? "Quick save" : "Save current"}
          </button>
        </div>
      </div>
      {slots.length ? (
        <div className="run-slot-list">
          {slots.map((slot) => (
            <article className={slot.id === activeId ? "run-slot active" : "run-slot"} key={slot.id}>
              <div>
                <strong>{slot.summary.teamName}</strong>
                <span>
                  {slot.summary.detail} / {slot.summary.recordLabel} / {slot.summary.matchCount} series
                </span>
              </div>
              <em>{formatRunSlotTime(slot.updatedAt)}</em>
              <button className="secondary" onClick={() => onLoad(slot)}>
                <Upload size={15} />
                Load
              </button>
              <button className="danger-icon" onClick={() => onDelete(slot.id)} title="Delete save">
                <Trash2 size={15} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="run-slot-empty">
          <strong>No saved runs yet</strong>
          <span>Start a draft or spectator run, then save it here as a resumable slot.</span>
        </div>
      )}
    </section>
  );
}

function CaseRoll({ sequence, winnerIndex }: { sequence: Roster[]; winnerIndex: number }) {
  return (
    <section className="case-roll">
      <div className="case-roll-header">
        <div className="section-title">
          <Dice5 size={18} />
          <span>Rolling historical pack</span>
        </div>
        <span>Wait for the marker</span>
      </div>
      <div className="case-window">
        <div className="case-marker" />
        <div
          className="case-track"
          style={
            {
              "--roll-distance": `-${winnerIndex * 148 + 69}px`,
            } as React.CSSProperties
          }
        >
          {sequence.map((roster, index) => (
            <article
              className={index === winnerIndex ? "case-card winner" : "case-card"}
              key={`${roster.id}-${index}`}
              style={{ "--crest": roster.accent } as React.CSSProperties}
            >
              <TeamLogo team={roster} small />
              <strong>{roster.name}</strong>
              <span>{roster.era}</span>
              <small>{roster.year}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RoundTimelinePanel({
  title,
  label,
  left,
  right,
  maps,
}: {
  title: string;
  label: string;
  left: FieldTeam;
  right: FieldTeam;
  maps: RoundTimelineMap[];
}) {
  const visibleMaps = maps.filter((map) => (map.roundWinners?.length ?? 0) > 0 || Boolean(map.activeRound));
  if (!visibleMaps.length) return null;

  const allRounds = visibleMaps.flatMap((map) => map.roundWinners ?? []);
  const leftLongest = Math.max(0, ...visibleMaps.map((map) => longestTimelineStreak(map.roundWinners ?? [], "left")));
  const rightLongest = Math.max(0, ...visibleMaps.map((map) => longestTimelineStreak(map.roundWinners ?? [], "right")));
  const recent = allRounds.slice(-5);
  const recentLeft = recent.filter((winner) => winner === "left").length;
  const recentRight = recent.length - recentLeft;
  const leadSwings = visibleMaps.reduce((sum, map) => sum + timelineLeadSwings(map.roundWinners ?? []), 0);

  return (
    <section className="round-timeline-panel">
      <div className="round-timeline-head">
        <div className="section-title">
          <Gauge size={18} />
          <span>{title}</span>
        </div>
        <span>{label}</span>
      </div>
      <div className="round-timeline-legend">
        <span>
          <TeamLogo team={left} small />
          {left.tag}
        </span>
        <span>
          <TeamLogo team={right} small />
          {right.tag}
        </span>
      </div>
      <div className="round-timeline-maps">
        {visibleMaps.map((map) => {
          const rounds = map.roundWinners ?? [];
          const showActive = Boolean(map.activeRound && map.activeRound > rounds.length);
          return (
            <div className="round-timeline-map" key={map.key}>
              <div className="round-timeline-map-head">
                <strong>{mapName(map.map)}</strong>
                <span>{map.leftScore}:{map.rightScore}</span>
              </div>
              <div className="round-timeline-strip">
                {rounds.map((winner, index) => {
                  const team = winner === "left" ? left : right;
                  return (
                    <span
                      className={`round-cell ${winner} ${roundTimelineBreakClass(index)}`}
                      key={`${map.key}-${index}`}
                      title={`R${index + 1}: ${team.name}`}
                    />
                  );
                })}
                {showActive && (
                  <span
                    className={`round-cell active ${roundTimelineBreakClass(rounds.length)}`}
                    title={`R${map.activeRound}: live`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {allRounds.length > 0 ? (
        <div className="round-timeline-summary">
          <span>{left.tag} run <b>{leftLongest}</b></span>
          <span>{right.tag} run <b>{rightLongest}</b></span>
          <span>Swings <b>{leadSwings}</b></span>
          <span>Last 5 <b>{recentLeft}-{recentRight}</b></span>
        </div>
      ) : (
        <div className="round-timeline-summary">
          <span>Opening round live</span>
        </div>
      )}
    </section>
  );
}

function roundTimelineMapFromMatch(match: MatchState): RoundTimelineMap {
  return {
    key: `live-${match.map}`,
    map: match.map,
    leftScore: match.you,
    rightScore: match.opponent,
    roundWinners: match.roundWinners.map((winner) => (winner === "you" ? "left" : "right")),
    activeRound: match.ended ? undefined : match.round,
  };
}

function roundTimelineMapFromResult(result: SeriesMapResult, index: number): RoundTimelineMap {
  return {
    key: `${result.map}-${index}`,
    map: result.map,
    leftScore: result.leftScore,
    rightScore: result.rightScore,
    roundWinners: result.roundWinners,
  };
}

function longestTimelineStreak(rounds: TimelineSide[], side: TimelineSide) {
  let current = 0;
  let longest = 0;
  rounds.forEach((winner) => {
    current = winner === side ? current + 1 : 0;
    longest = Math.max(longest, current);
  });
  return longest;
}

function timelineLeadSwings(rounds: TimelineSide[]) {
  let leftScore = 0;
  let rightScore = 0;
  let leader: TimelineSide | undefined;
  let swings = 0;
  rounds.forEach((winner) => {
    if (winner === "left") leftScore += 1;
    if (winner === "right") rightScore += 1;
    const nextLeader: TimelineSide | undefined = leftScore === rightScore ? undefined : leftScore > rightScore ? "left" : "right";
    if (nextLeader && leader && nextLeader !== leader) swings += 1;
    if (nextLeader) leader = nextLeader;
  });
  return swings;
}

function roundTimelineBreakClass(index: number) {
  if (index === 12) return "half-break";
  if (index >= 24 && (index - 24) % 3 === 0) return "ot-break";
  return "";
}

function RoundReadPanel({
  read,
  currentTactic,
  onApply,
}: {
  read: ReturnType<typeof buildRoundRead>;
  currentTactic: Tactic;
  onApply: (tactic: Tactic) => void;
}) {
  const readLabel = formatTacticLabel(read.tactic);
  return (
    <div className={`round-read-panel ${read.tone}`}>
      <div className="round-read-main">
        <span>Read</span>
        <strong>{read.label}</strong>
        <b>{read.pressure}</b>
      </div>
      <p>{read.reason}</p>
      <div className="round-read-actions">
        {read.chips.map((chip) => (
          <span key={chip}>{chip}</span>
        ))}
        <button type="button" disabled={currentTactic === read.tactic} onClick={() => onApply(read.tactic)}>
          {currentTactic === read.tactic ? "Set" : `Use ${readLabel}`}
        </button>
      </div>
    </div>
  );
}

function CallFitPanel({ players, activeStyle }: { players: Player[]; activeStyle: RoundStyleCall }) {
  const aggroFits = callFitRows(players, "aggressive");
  const passiveFits = callFitRows(players, "cautious");
  const neutralNames = players
    .filter((player) => player.style === "Balanced")
    .map((player) => player.handle)
    .slice(0, 3);
  const activeText =
    activeStyle === "aggressive"
      ? `${aggroFits.length} aggro fit${aggroFits.length === 1 ? "" : "s"}`
      : activeStyle === "cautious"
        ? `${passiveFits.length} passive fit${passiveFits.length === 1 ? "" : "s"}`
        : "standard is neutral";

  return (
    <div className="call-fit-panel">
      <div className="call-fit-head">
        <span>Call fit</span>
        <b>{activeText}</b>
      </div>
      <div className="call-fit-groups">
        <CallFitGroup label="Aggro" active={activeStyle === "aggressive"} rows={aggroFits} empty="No aggro fit" />
        <CallFitGroup label="Passive" active={activeStyle === "cautious"} rows={passiveFits} empty="No passive fit" />
      </div>
      {neutralNames.length > 0 && <span className="call-fit-neutral">Neutral: {neutralNames.join(", ")}</span>}
    </div>
  );
}

function CallFitGroup({
  label,
  rows,
  active,
  empty,
}: {
  label: string;
  rows: Array<{ player: Player; score: number }>;
  active: boolean;
  empty: string;
}) {
  return (
    <div className={`call-fit-group ${active ? "active" : ""}`}>
      <span>{label}</span>
      <div className="call-fit-chips">
        {rows.length ? (
          rows.map(({ player, score }) => (
            <span className={score >= 1.2 ? "call-fit-chip strong" : "call-fit-chip"} key={player.id} title={`${player.handle}: ${player.role} / ${player.style}`}>
              <b>{player.handle}</b>
              <small>{fitRoleLabel(player)}</small>
            </span>
          ))
        ) : (
          <em>{empty}</em>
        )}
      </div>
    </div>
  );
}

function callFitRows(players: Player[], style: RoundStyleCall) {
  return players
    .map((player) => ({ player, score: playerCallFitScore(player, style) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || b.player.ovr - a.player.ovr || a.player.handle.localeCompare(b.player.handle));
}

function fitRoleLabel(player: Player) {
  if (player.role === "Entry" && player.style === "Aggressive") return "ENTRY+";
  if (player.role === "AWP" && player.style === "Passive") return "AWP";
  return player.role.toUpperCase();
}

function CoachDeskPanel({
  match,
  you,
  opponent,
  timeouts,
  timeoutPlan,
  onTimeout,
}: {
  match: MatchState;
  you: FieldTeam;
  opponent: FieldTeam;
  timeouts: number;
  timeoutPlan: TimeoutPlan;
  onTimeout: () => void;
}) {
  const read = buildCoachDeskRead(match, you, opponent, timeouts, timeoutPlan);
  return (
    <div className={`coach-desk ${read.tone}`}>
      <div className="coach-desk-head">
        <span>Coach desk</span>
        <strong>{read.label}</strong>
        <button type="button" disabled={!read.canCallTimeout} onClick={onTimeout}>
          {read.buttonLabel}
        </button>
      </div>
      <div className="coach-desk-metrics">
        <span>
          Boost <b>{read.boostLabel}</b>
        </span>
        <span>
          Threat <b>{read.threatLabel}</b>
        </span>
      </div>
      <span className="coach-desk-note">{read.reason}</span>
    </div>
  );
}

function buildCoachDeskRead(
  match: MatchState,
  you: FieldTeam,
  opponent: FieldTeam,
  timeouts: number,
  timeoutPlan: TimeoutPlan,
) {
  const plan = tacticalTimeoutPlan(match, you, opponent);
  const opponentStreak = trailingRoundWins(match.roundWinners, "opponent");
  const yourStreak = trailingRoundWins(match.roundWinners, "you");
  const threshold = liveWinThreshold(match.round);
  const opponentAtMapPoint = match.opponent >= threshold - 1;
  const youAtMapPoint = match.you >= threshold - 1;
  const scoreGap = match.you - match.opponent;
  const coachDelta = (you.coach?.rating ?? 68) - (opponent.coach?.rating ?? 68);
  const threat = liveThreatPlayer(opponent, match);
  const boostLabel = `${plan.boost >= 0 ? "+" : ""}${(plan.boost * 100).toFixed(1)}% / ${plan.rounds}r`;

  if (timeoutPlan.rounds > 0) {
    return {
      label: "Timeout active",
      buttonLabel: `${timeoutPlan.rounds}r left`,
      canCallTimeout: false,
      boostLabel: `${timeoutPlan.boost >= 0 ? "+" : ""}${(timeoutPlan.boost * 100).toFixed(1)}% / ${timeoutPlan.rounds}r`,
      threatLabel: threat.label,
      reason: "The boost is already live. Let this call breathe before spending another pause.",
      tone: "good" as const,
    };
  }

  if (timeouts <= 0) {
    return {
      label: "No pauses",
      buttonLabel: "Used",
      canCallTimeout: false,
      boostLabel,
      threatLabel: threat.label,
      reason: `Keep the call clean; ${threat.player.handle} is the main problem right now.`,
      tone: "neutral" as const,
    };
  }

  const dangerReasons = [
    opponentAtMapPoint ? "map point" : "",
    opponentStreak >= 3 ? `${opponentStreak}-round run` : "",
    scoreGap <= -4 ? `${Math.abs(scoreGap)} down` : "",
    match.economy === "ECO" && match.opponentEconomy === "FULL" ? "bad buy" : "",
  ].filter(Boolean);
  const prepReasons = [
    youAtMapPoint ? "close-out round" : "",
    opponentStreak === 2 ? "run forming" : "",
    coachDelta >= 8 ? "coach edge" : "",
    match.round >= 20 && Math.abs(scoreGap) <= 2 ? "late tight map" : "",
  ].filter(Boolean);

  if (dangerReasons.length > 0) {
    return {
      label: "Call timeout",
      buttonLabel: `Use (${timeouts})`,
      canCallTimeout: true,
      boostLabel,
      threatLabel: threat.label,
      reason: `${dangerReasons.join(", ")}. Reset around ${threat.player.handle} before the map slips.`,
      tone: "bad" as const,
    };
  }

  if (prepReasons.length > 0 && yourStreak < 3) {
    return {
      label: "Prep timeout",
      buttonLabel: `Use (${timeouts})`,
      canCallTimeout: true,
      boostLabel,
      threatLabel: threat.label,
      reason: `${prepReasons.join(", ")}. A pause can cash in the next few rounds.`,
      tone: "neutral" as const,
    };
  }

  return {
    label: "Hold timeout",
    buttonLabel: `${timeouts} left`,
    canCallTimeout: false,
    boostLabel,
    threatLabel: threat.label,
    reason: yourStreak >= 3 ? `You have ${yourStreak} straight; keep the rhythm.` : `Save it unless ${threat.player.handle} starts chaining rounds.`,
    tone: "good" as const,
  };
}

function liveThreatPlayer(opponent: FieldTeam, match: MatchState) {
  const rows = statRows(opponent.players, match.opponentStats, true);
  const active = rows.find((row) => row.line.kills > 0 || row.line.damage > 0);
  if (active) {
    return {
      player: active.player,
      label: `${active.player.handle} ${active.line.rating.toFixed(2)}`,
    };
  }
  const player = [...opponent.players].sort((a, b) => b.ovr - a.ovr || a.handle.localeCompare(b.handle))[0] ?? opponent.players[0];
  return {
    player,
    label: `${player.handle} ${player.ovr}`,
  };
}

function formatTacticLabel(tactic: Tactic) {
  const parsed = parseTactic(tactic);
  const style = parsed.style === "aggressive" ? "aggro" : parsed.style;
  return parsed.buy === "normal" ? style : `${style} ${parsed.buy}`;
}

function buildRoundRead(
  match: MatchState,
  you: FieldTeam,
  opponent: FieldTeam,
  settings: CustomSettings,
  yourMoney: number,
  opponentMoney: number,
) {
  const opponentStreak = trailingRoundWins(match.roundWinners, "opponent");
  const yourStreak = trailingRoundWins(match.roundWinners, "you");
  const threshold = liveWinThreshold(match.round);
  const opponentAtMapPoint = match.opponent >= threshold - 1;
  const youAtMapPoint = match.you >= threshold - 1;
  const scoreGap = match.you - match.opponent;
  const moneyGap = yourMoney - opponentMoney;
  const mapGap = mapEdge(you, opponent, match.map, settings);

  let tactic: Tactic = "standard";
  let label = "Default";
  let reason = "Keep the round clean and avoid giving away first contact.";
  let tone: "good" | "bad" | "neutral" = "neutral";

  if (match.economy === "ECO" && match.opponentEconomy === "FULL") {
    const needsForce = opponentAtMapPoint || scoreGap <= -4;
    tactic = needsForce ? composeTactic("aggressive", "force") : composeTactic("cautious", "save");
    label = needsForce ? "Last stand" : "Bank";
    reason = needsForce ? "Low buy in danger territory; fight for space early." : "Full-save spot: preserve money and dodge a low-value gamble.";
    tone = "bad";
  } else if (match.opponentEconomy === "ECO" && match.economy === "FULL") {
    tactic = composeTactic("cautious", "normal");
    label = "Anti-eco";
    reason = "They are light on weapons, so avoid solo duels and trade it out.";
    tone = "good";
  } else if (opponentStreak >= 3 || opponentAtMapPoint) {
    tactic = composeTactic("cautious", "normal");
    label = opponentAtMapPoint ? "Map point hold" : "Stop run";
    reason = opponentAtMapPoint ? "Opponent can close the map; slow the opener." : `Opponent has ${opponentStreak} straight; stabilize first contact.`;
    tone = "bad";
  } else if (scoreGap <= -4 && match.economy !== "ECO") {
    tactic = composeTactic("aggressive", "normal");
    label = "Steal tempo";
    reason = "You are trailing; a faster call can break their defaults.";
    tone = "bad";
  } else if (yourStreak >= 3 && moneyGap >= 0) {
    tactic = "standard";
    label = "Keep shape";
    reason = `You have ${yourStreak} straight with stable money.`;
    tone = "good";
  } else if (mapGap >= 1.5 && match.economy === "FULL") {
    tactic = composeTactic("aggressive", "normal");
    label = "Map edge";
    reason = `${mapName(match.map)} leans your way (${signedValue(mapGap)}).`;
    tone = "good";
  }

  const pressure = Math.min(
    99,
    Math.max(
      8,
      28 +
        Math.abs(scoreGap) * 5 +
        opponentStreak * 8 +
        (opponentAtMapPoint || youAtMapPoint ? 20 : 0) +
        (match.economy === "ECO" ? 12 : 0) -
        (yourStreak >= 3 ? 8 : 0),
    ),
  );

  const parsed = parseTactic(tactic);

  return {
    tactic,
    label,
    reason,
    tone,
    pressure,
    chips: [`${parsed.style}/${parsed.buy}`, `${match.economy}/${match.opponentEconomy}`, `streak ${yourStreak}-${opponentStreak}`, signedValue(mapGap)],
  };
}

function liveWinThreshold(round: number) {
  if (round < 25) return 13;
  return 13 + (Math.floor((round - 25) / 6) + 1) * 3;
}

function Avatar({ label, accent, photo }: { label: string; accent: string; photo?: string }) {
  if (photo) {
    return (
      <div className="avatar avatar-photo" style={{ "--avatar": accent } as React.CSSProperties}>
        <img src={photo} alt={label} loading="lazy" />
      </div>
    );
  }
  return (
    <div className="avatar" style={{ "--avatar": accent } as React.CSSProperties}>
      {label.slice(0, 2).toUpperCase()}
    </div>
  );
}

function PlayerCard({
  player,
  hidden,
  missing,
  onClick,
}: {
  player: Player;
  hidden: boolean;
  missing: boolean;
  onClick: () => void;
}) {
  return (
    <button className={missing ? "player-card fills" : "player-card"} onClick={onClick}>
      {missing && <span className="fill-tag">fills {player.role}</span>}
      <Avatar label={player.handle} accent={player.source.accent} photo={playerPhoto(player.handle)} />
      <div className="player-head">
        <strong>{player.handle}</strong>
        <b>{hidden ? "??" : player.ovr}</b>
      </div>
      <span className="player-id-meta"><Flag country={player.country} /> {player.country} / {player.realName} {!hidden && ` / Rating: ${player.ovr}`}</span>
      <small>{player.role} / {player.style}</small>
      {hidden ? (
        <div className="hidden-stats">ratings hidden</div>
      ) : (
        <StatBars player={player} />
      )}
    </button>
  );
}

function StatBars({ player }: { player: Player }) {
  const rows = [
    ["Aim", player.stats.aim],
    ["Clutch", player.stats.clutch],
    ["Const.", player.stats.consistency],
    ["AWP", player.stats.awp],
    ["IGL", player.stats.igl],
  ];
  return (
    <div className="bars">
      {rows.map(([label, value]) => (
        <label key={label}>
          <span>{label}</span>
          <meter min={50} max={100} value={Number(value)} />
          <b>{value}</b>
        </label>
      ))}
    </div>
  );
}

function Bench({ players, coach }: { players: Player[]; coach?: Coach }) {
  return (
    <section className="bench">
      <div className="section-title">
        <Users size={18} />
        <span>Your roster</span>
      </div>
      <div className="bench-grid">
        {Array.from({ length: 5 }).map((_, index) => {
          const player = players[index];
          return player ? (
            <div className="bench-slot filled" key={player.id}>
              <strong>{player.handle} {player.ovr}</strong>
              <span>{player.role}</span>
              <small>{player.source.name} {player.source.year}</small>
            </div>
          ) : (
            <div className="bench-slot" key={index}>
              Pick {index + 1}
            </div>
          );
        })}
        {coach && (
          <div className="bench-slot filled coach">
            <strong>{coach.handle} {coach.rating}</strong>
            <span>{coach.style}</span>
            <small>Coach</small>
          </div>
        )}
      </div>
    </section>
  );
}

function MatchMapView({ match, you, opponent, speed = 1 }: { match: MatchState; you: FieldTeam; opponent: FieldTeam; speed?: number }) {
  const activeRound = match.pendingEvents?.[0]?.round ?? match.feed[0]?.round ?? match.round;
  const roundEvents = match.feed.filter((event) => event.round === activeRound);
  const chronologicalEvents = [...roundEvents].reverse();
  const killEvents = chronologicalEvents.filter(isKillFeedEvent).slice(-6);
  const displayEvents = chronologicalEvents.filter((event) => event.type !== "round_start").slice(-4);
  const yourSide = match.side;
  const mapInfo = mapPool.find((map) => map.id === match.map);
  const layout = MAP_LAYOUTS[match.map] || MAP_LAYOUTS.mirage;
  const geometry = mapGeometries[match.map];
  const pixelNav = hasPixelNav(match.map); // nav + visual come from the real radar image
  const showVectorFloor = Boolean(geometry) && !pixelNav;

  const [smoothMovement, setSmoothMovement] = React.useState(true);
  const [showUnderlay, setShowUnderlay] = React.useState(false);
  const [fraction, setFraction] = React.useState(1);
  const prevStepRef = React.useRef(roundEvents.length);

  // Reset the tween to 0 synchronously (pre-paint) whenever a new event arrives. Without this the
  // stale fraction (left at 1 by the previous step) makes stepIndex overshoot to the next position
  // for one frame and then snap back — the "teleport twitch" the dots showed.
  React.useLayoutEffect(() => {
    setFraction(0);
  }, [roundEvents.length]);

  React.useEffect(() => {
    const currentStep = roundEvents.length;
    if (currentStep !== prevStepRef.current) {
      const startTime = performance.now();
      const duration = getStepDelay(match, you, opponent, currentStep, speed, "map");
      let animId: number;

      const tick = () => {
        const elapsed = performance.now() - startTime;
        const f = Math.min(1, elapsed / duration);
        setFraction(f);
        if (f < 1) {
          animId = requestAnimationFrame(tick);
        }
      };

      animId = requestAnimationFrame(tick);
      prevStepRef.current = currentStep;

      return () => cancelAnimationFrame(animId);
    }
  }, [roundEvents.length, speed, match, you, opponent]);

  const stepIndex = smoothMovement && roundEvents.length > 0
    ? roundEvents.length - 1 + fraction
    : roundEvents.length;

  // Get simulated coordinates and state for all 10 players, and active firefight traces
  const { players: radarPlayers, traces: radarTraces, bomb, flashed } = simulateRadarPlayers(match, you, opponent, stepIndex);

  // Utility thrown this round, placed at the thrower's graph position (smokes/mollies show an area).
  const utilMarkers = roundEvents
    .filter((e) => e.killerPos && (e.type === "smoke" || e.type === "molotov" || e.type === "he" || e.type === "flash"))
    .slice(-6);
  const radarImage = radarImages[match.map];

  const currentStepDelay = getStepDelay(match, you, opponent, roundEvents.length, speed, "map");
  const duration = smoothMovement ? 0 : Math.max(100, currentStepDelay - 150);

  return (
    <div className="radar-shell">
      <div
        className={`radar-map radar-map-${match.map} ${match.running ? "" : "paused"}`}
        style={
          {
            "--map-accent": mapInfo?.accent ?? "#65a7ff",
            backgroundImage: radarImage && (pixelNav || !geometry || showUnderlay) ? `url(${radarImage})` : undefined,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            "--transition-duration": `${duration}ms`,
          } as React.CSSProperties
        }
      >
        <div className="radar-map-label">
          <strong>{mapName(match.map)}</strong>
          <span>Round {activeRound}</span>
          <label className="radar-smooth-toggle" style={{ marginLeft: "12px", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", cursor: "pointer", userSelect: "none", opacity: 0.85 }}>
            <input
              type="checkbox"
              checked={smoothMovement}
              onChange={(e) => setSmoothMovement(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <span>Fluid Motion</span>
          </label>
          {showVectorFloor && (
            <label className="radar-smooth-toggle" style={{ marginLeft: "8px", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", cursor: "pointer", userSelect: "none", opacity: 0.85 }}>
              <input
                type="checkbox"
                checked={showUnderlay}
                onChange={(e) => setShowUnderlay(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <span>Image underlay</span>
            </label>
          )}
        </div>

        {/* Vector floor only for maps without a pixel-accurate radar (pixel-nav maps render the PNG) */}
        {showVectorFloor && (
          <svg className="radar-geometry" viewBox="0 0 100 100" preserveAspectRatio="none">
            {geometry!.walkable.map((poly, i) => (
              <polygon key={`floor-${i}`} className="floor" points={poly.map((pt) => `${pt.x},${pt.y}`).join(" ")} />
            ))}
            {geometry!.walls.map((poly, i) => (
              <polygon key={`wall-${i}`} className="wall" points={poly.map((pt) => `${pt.x},${pt.y}`).join(" ")} />
            ))}
          </svg>
        )}

        {/* Callouts: pixel-nav maps (mirage) use the real radar PNG, which carries its own labels —
            our overlaid callouts don't line up with it, so we omit them. Vector-floor maps draw their
            code-geometry labels; legacy maps fall back to the basic site/spawn tags. */}
        {pixelNav ? null : geometry ? (
          geometry.labels.map((lb) => (
            <div
              key={`${lb.text}-${lb.at.x}-${lb.at.y}`}
              className={`radar-region-label${lb.text === "A" || lb.text === "B" ? " site" : ""}`}
              style={{ left: `${lb.at.x}%`, top: `${lb.at.y}%` }}
            >
              {lb.text}
            </div>
          ))
        ) : (
          <>
            <div className="radar-site site-a" style={{ left: `${layout.bombsiteA.x}%`, top: `${layout.bombsiteA.y}%` }}>A</div>
            <div className="radar-site site-b" style={{ left: `${layout.bombsiteB.x}%`, top: `${layout.bombsiteB.y}%` }}>B</div>
            <div className="radar-spawn t-spawn-label" style={{ left: `${layout.tSpawn.x}%`, top: `${layout.tSpawn.y}%` }}>T Spawn</div>
            <div className="radar-spawn ct-spawn-label" style={{ left: `${layout.ctSpawn.x}%`, top: `${layout.ctSpawn.y}%` }}>CT Spawn</div>
          </>
        )}

        {/* Grenade throw arcs (from thrower -> landing) */}
        <svg className="radar-util-arcs" viewBox="0 0 100 100" preserveAspectRatio="none">
          {utilMarkers.map((m, i) =>
            m.killerPos && m.targetPos ? (
              <line
                key={`utilarc-${activeRound}-${i}`}
                className={`radar-util-arc radar-util-arc-${m.type}`}
                x1={m.killerPos.x}
                y1={m.killerPos.y}
                x2={m.targetPos.x}
                y2={m.targetPos.y}
              />
            ) : null,
          )}
        </svg>
        {/* Utility effects (smoke clouds / molotov fire / flash / HE) where they LAND */}
        {utilMarkers.map((m, i) => {
          const at = m.targetPos ?? m.killerPos!;
          return (
            <div
              key={`util-${activeRound}-${i}-${at.x}`}
              className={`radar-util radar-util-${m.type}`}
              style={{ left: `${at.x}%`, top: `${at.y}%` }}
            >
              {(m.type === "smoke" || m.type === "molotov") && <span className="radar-util-area" />}
              <img className="radar-util-icon" src={utilityIcons[m.type!]} alt={m.type} title={m.type} />
            </div>
          );
        })}

        {/* Bomb icon */}
        {bomb && (
          <div className="radar-bomb blink-fast" style={{ left: `${bomb.x}%`, top: `${bomb.y}%` }}>
            <span role="img" aria-label="bomb">💣</span>
          </div>
        )}

        {/* SVG schematic corridor map layout - fallback if no image */}
        {!radarImage && (
          <svg className="radar-blueprint" viewBox="0 0 100 100" preserveAspectRatio="none">
            <g className="blueprint-corridors">
              {layout.paths.map((d, index) => (
                <path key={index} d={d} className="blueprint-path" />
              ))}
            </g>
          </svg>
        )}

        <svg className="radar-traces" viewBox="0 0 100 100" preserveAspectRatio="none">
          {radarTraces.map((trace, index) => {
            return (
              <line
                key={`${trace.round}-${trace.killerId}-${trace.victimId}-${index}`}
                className={`radar-trace ${trace.side.toLowerCase()}`}
                style={{ opacity: trace.opacity }}
                x1={trace.killerPos.x}
                y1={trace.killerPos.y}
                x2={trace.victimPos.x}
                y2={trace.victimPos.y}
              />
            );
          })}
        </svg>
        {radarTraces.map((trace, index) => {
          return (
            <span
              className={`radar-ping ${trace.side.toLowerCase()}`}
              key={`${trace.round}-${trace.victimId}-ping-${index}`}
              style={{ left: `${trace.victimPos.x}%`, top: `${trace.victimPos.y}%`, opacity: trace.opacity, "--ping-delay": `${index * 90}ms` } as React.CSSProperties}
            />
          );
        })}
        {radarPlayers.map((simPlayer, index) => {
          const { id, radarKey, handle, side, team, alive, x, y, yaw } = simPlayer;
          const blind = alive ? flashed[radarKey] ?? 0 : 0;
          return (
            <div
              className={`radar-player ${side.toLowerCase()} ${team} ${alive ? "alive" : "dead"}`}
              key={radarKey || `${team}-${id}-${index}`}
              style={
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  "--yaw": `${yaw}deg`,
                } as React.CSSProperties
              }
            >
              {alive && <i className="radar-facing" aria-hidden="true" />}
              {!alive && <i className="radar-death-x" aria-hidden="true" />}
              {blind > 0 && <i className="radar-flash-blind" style={{ opacity: blind } as React.CSSProperties} aria-hidden="true" />}
              <span>{handle.slice(0, 2).toUpperCase()}</span>
              <small>{handle}</small>
            </div>
          );
        })}
        <div className="radar-legend">
          <span className="ct-team">CT</span>
          <span className="t-team">T</span>
        </div>
      </div>
      {/* recent events as a compact strip BELOW the map, so nothing overlaps the radar */}
      <div className="radar-feed-strip">
        {displayEvents.length ? (
          displayEvents.map((event, index) => (
            <span key={`${event.round}-radar-event-${index}`}>{radarEventText(event, yourSide)}</span>
          ))
        ) : (
          <span className="radar-feed-idle">Waiting for contact…</span>
        )}
      </div>
    </div>
  );
}

function isKillFeedEvent(event: MatchState["feed"][number]) {
  return (!event.type || event.type === "kill") && Boolean(event.killerId && event.victimId);
}

function radarEventSide(event: MatchState["feed"][number], yourSide: "CT" | "T") {
  if (event.team === "neutral") return "neutral";
  return event.team === "you" ? yourSide : oppositeMatchSide(yourSide);
}

function radarEventText(event: MatchState["feed"][number], yourSide: "CT" | "T") {
  if (isKillFeedEvent(event)) {
    const side = radarEventSide(event, yourSide);
    return `${side}: ${event.killer}${event.assistant ? ` + ${event.assistant}` : ""} -> ${event.victim}`;
  }
  if (event.type === "plant") return `${radarEventSide(event, yourSide)} plant by ${event.killer}`;
  if (event.type === "defuse") return `${radarEventSide(event, yourSide)} defuse by ${event.killer}`;
  if (event.type === "explode") return "Bomb exploded";
  if (event.type === "round_over") return `Round over: ${event.reason}`;
  return "Round started";
}

function oppositeMatchSide(side: "CT" | "T") {
  return side === "CT" ? "T" : "CT";
}

function Pairing({
  pair,
  pick,
  onPick,
}: {
  pair: SwissPair;
  pick?: string;
  onPick?: (teamId: string) => void;
}) {
  const { left, right, active = false } = pair;
  return (
    <div className={active ? "pairing active" : "pairing"}>
      <TeamMini team={left} />
      {onPick ? (
        <div className="pickem-controls">
          <button className={pick === left.id ? "selected" : ""} onClick={() => onPick(left.id)}>
            {left.tag}
          </button>
          <button className={pick === right.id ? "selected" : ""} onClick={() => onPick(right.id)}>
            {right.tag}
          </button>
        </div>
      ) : (
        <span>vs</span>
      )}
      <TeamMini team={right} flip />
    </div>
  );
}

function SwissMatchRow({
  pair,
  pick,
  record,
  teamRecords,
  result,
  locked,
  bestOf,
  onPick,
  onOpenResult,
}: {
  pair: SwissPair;
  pick?: string;
  record: SwissRecord;
  teamRecords: Record<string, SwissRecord>;
  result?: SwissResult;
  locked: boolean;
  bestOf: number;
  onPick: (teamId: string) => void;
  onOpenResult?: (id: string) => void;
}) {
  const completedRounds = record.wins + record.losses;
  const leftRecord = pair.left.id === "user" ? record : teamRecords[pair.left.id];
  const rightRecord = pair.right.id === "user" ? record : teamRecords[pair.right.id];
  return (
    <div
      className={`${pair.active ? "swiss-match-row active" : "swiss-match-row"}${result ? " completed clickable" : ""}`}
      onClick={result && onOpenResult ? () => onOpenResult(result.id) : undefined}
      role={result && onOpenResult ? "button" : undefined}
      tabIndex={result && onOpenResult ? 0 : undefined}
      onKeyDown={
        result && onOpenResult
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenResult(result.id);
              }
            }
          : undefined
      }
    >
      <SwissTeamName team={pair.left} record={leftRecord} completedRounds={completedRounds} />
      {result ? (
        <div className="swiss-result-score">
          {/* a single-map series (BO1) shows the map round score, not a 1-0 series tally */}
          <b className={result.winnerId === pair.left.id ? "winner" : ""}>
            {result.maps.length === 1 ? result.maps[0].leftScore : result.leftScore}
          </b>
          <span>-</span>
          <b className={result.winnerId === pair.right.id ? "winner" : ""}>
            {result.maps.length === 1 ? result.maps[0].rightScore : result.rightScore}
          </b>
        </div>
      ) : locked ? (
        <div className="swiss-versus">BO{bestOf}</div>
      ) : (
        <div className="swiss-pick-buttons">
          <button className={pick === pair.left.id ? "selected" : ""} onClick={() => onPick(pair.left.id)}>
            {pair.left.tag}
          </button>
          <button className={pick === pair.right.id ? "selected" : ""} onClick={() => onPick(pair.right.id)}>
            {pair.right.tag}
          </button>
        </div>
      )}
      <SwissTeamName team={pair.right} align="right" record={rightRecord} completedRounds={completedRounds} />
    </div>
  );
}

function SwissTeamName({
  team,
  align = "left",
  record,
  completedRounds = 0,
}: {
  team: FieldTeam;
  align?: "left" | "right";
  record?: SwissRecord;
  completedRounds?: number;
}) {
  return (
    <div className={align === "right" ? "swiss-team-name right" : "swiss-team-name"}>
      <TeamLogo team={team} small />
      <strong>{team.name}</strong>
      <span>{record ? `${record.wins}-${record.losses}` : projectedRecordLabel(team, completedRounds)}</span>
    </div>
  );
}

function SwissBoard({
  user,
  field,
  record,
  opponent,
  records,
  results,
  onOpenResult,
}: {
  user: FieldTeam;
  field: FieldTeam[];
  record: SwissRecord;
  opponent: FieldTeam;
  records: Record<string, SwissRecord>;
  results: SwissResult[];
  onOpenResult: (id: string) => void;
}) {
  const lanes = buildSwissLaneData(user, field, record, opponent, records);
  const completedByLane = swissLaneResults(results).reduce(
    (acc, item) => {
      acc[item.laneKey] = [...(acc[item.laneKey] ?? []), item.result];
      return acc;
    },
    {} as Record<string, SwissResult[]>,
  );
  const roundGroups = [
    { round: 1, lanes: [{ key: "0:0", teams: lanes["0:0"] ?? [], results: completedByLane["0:0"] ?? [] }] },
    {
      round: 2,
      lanes: [
        { key: "1:0", teams: lanes["1:0"] ?? [], results: completedByLane["1:0"] ?? [] },
        { key: "0:1", teams: lanes["0:1"] ?? [], results: completedByLane["0:1"] ?? [] },
      ],
    },
    {
      round: 3,
      lanes: [
        { key: "2:0", teams: lanes["2:0"] ?? [], results: completedByLane["2:0"] ?? [] },
        { key: "1:1", teams: lanes["1:1"] ?? [], results: completedByLane["1:1"] ?? [] },
        { key: "0:2", teams: lanes["0:2"] ?? [], results: completedByLane["0:2"] ?? [] },
      ],
    },
    {
      round: 4,
      lanes: [
        { key: "2:1", teams: lanes["2:1"] ?? [], results: completedByLane["2:1"] ?? [] },
        { key: "1:2", teams: lanes["1:2"] ?? [], results: completedByLane["1:2"] ?? [] },
      ],
    },
    { round: 5, lanes: [{ key: "2:2", teams: lanes["2:2"] ?? [], results: completedByLane["2:2"] ?? [] }] },
  ];

  return (
    <div className="swiss-board">
      <div className="swiss-rounds-flow">
        {roundGroups.map((group) => (
          <div className="swiss-round-group" key={`round-${group.round}`}>
            <div className="swiss-round-label">Round {group.round}</div>
            <div className="swiss-round-lanes">
              {group.lanes.map((lane) => (
                <SwissLane key={lane.key} title={lane.key} teams={lane.teams} results={lane.results} onOpenResult={onOpenResult} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="swiss-outcome-zone">
        <SwissOutcome title="Qualified" tone="qualified" teams={lanes.qualified ?? []} labels={["3:0", "3:1", "3:2"]} />
        <SwissOutcome title="Eliminated" tone="eliminated" teams={lanes.eliminated ?? []} labels={["0:3", "1:3", "2:3"]} />
      </div>
    </div>
  );
}

function SpectatorSwissBoard({
  field,
  records,
  results,
  onOpenResult,
}: {
  field: FieldTeam[];
  records: Record<string, SwissRecord>;
  results: SwissResult[];
  onOpenResult: (id: string) => void;
}) {
  const lanes = buildNeutralSwissLaneData(field, records);
  const completedByLane = swissLaneResults(results).reduce(
    (acc, item) => {
      acc[item.laneKey] = [...(acc[item.laneKey] ?? []), item.result];
      return acc;
    },
    {} as Record<string, SwissResult[]>,
  );
  const roundGroups = [
    { round: 1, lanes: [{ key: "0:0", teams: lanes["0:0"] ?? [], results: completedByLane["0:0"] ?? [] }] },
    {
      round: 2,
      lanes: [
        { key: "1:0", teams: lanes["1:0"] ?? [], results: completedByLane["1:0"] ?? [] },
        { key: "0:1", teams: lanes["0:1"] ?? [], results: completedByLane["0:1"] ?? [] },
      ],
    },
    {
      round: 3,
      lanes: [
        { key: "2:0", teams: lanes["2:0"] ?? [], results: completedByLane["2:0"] ?? [] },
        { key: "1:1", teams: lanes["1:1"] ?? [], results: completedByLane["1:1"] ?? [] },
        { key: "0:2", teams: lanes["0:2"] ?? [], results: completedByLane["0:2"] ?? [] },
      ],
    },
    {
      round: 4,
      lanes: [
        { key: "2:1", teams: lanes["2:1"] ?? [], results: completedByLane["2:1"] ?? [] },
        { key: "1:2", teams: lanes["1:2"] ?? [], results: completedByLane["1:2"] ?? [] },
      ],
    },
    { round: 5, lanes: [{ key: "2:2", teams: lanes["2:2"] ?? [], results: completedByLane["2:2"] ?? [] }] },
  ];

  return (
    <div className="swiss-board">
      <div className="swiss-rounds-flow">
        {roundGroups.map((group) => (
          <div className="swiss-round-group" key={`spectator-round-${group.round}`}>
            <div className="swiss-round-label">Round {group.round}</div>
            <div className="swiss-round-lanes">
              {group.lanes.map((lane) => (
                <SwissLane key={lane.key} title={lane.key} teams={lane.teams} results={lane.results} onOpenResult={onOpenResult} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="swiss-outcome-zone">
        <SwissOutcome title="Qualified" tone="qualified" teams={lanes.qualified ?? []} labels={["3:0", "3:1", "3:2"]} />
        <SwissOutcome title="Eliminated" tone="eliminated" teams={lanes.eliminated ?? []} labels={["0:3", "1:3", "2:3"]} />
      </div>
    </div>
  );
}

function SwissLane({
  title,
  teams,
  results,
  onOpenResult,
}: {
  title: string;
  teams: FieldTeam[];
  results: SwissResult[];
  onOpenResult: (id: string) => void;
}) {
  const isCurrent = teams.some((team) => team.id === "user");
  const laneCount = teams.length + results.length * 2;

  // Pair teams into matchup rows for visual clarity
  const pairs: [FieldTeam, FieldTeam | undefined][] = [];
  for (let i = 0; i < teams.length; i += 2) {
    pairs.push([teams[i], teams[i + 1]]);
  }

  return (
    <div className={`swiss-lane${isCurrent ? " current" : ""}`}>
      <div className="lane-header">
        <strong>{title}</strong>
        {laneCount > 0 && <span className="lane-count">{laneCount}</span>}
      </div>
      <div className="lane-matchups">
        {results.length > 0 &&
          results.map((result) => (
            <SwissLaneResultCard key={result.id} result={result} onOpen={() => onOpenResult(result.id)} />
          ))}
        {pairs.length > 0 &&
          pairs.map(([left, right], idx) => (
            <div className="lane-matchup-row" key={`${title}-pair-${idx}`}>
              <SwissLaneTeam team={left} />
              {right ? (
                <>
                  <span className="lane-vs">vs</span>
                  <SwissLaneTeam team={right} />
                </>
              ) : (
                <span className="lane-bye">bye</span>
              )}
            </div>
          ))}
        {!results.length && !pairs.length && (
          <div className="lane-matchup-row empty">
            <span className="empty-lane">?</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SwissLaneResultCard({ result, onOpen }: { result: SwissResult; onOpen: () => void }) {
  return (
    <button className="lane-matchup-row completed" type="button" onClick={onOpen}>
      <SwissLaneTeam team={result.left} winner={result.winnerId === result.left.id} />
      <span className="lane-result-score">
        <b className={result.winnerId === result.left.id ? "winner" : ""}>
          {result.maps.length === 1 ? result.maps[0].leftScore : result.leftScore}
        </b>
        <em>-</em>
        <b className={result.winnerId === result.right.id ? "winner" : ""}>
          {result.maps.length === 1 ? result.maps[0].rightScore : result.rightScore}
        </b>
      </span>
      <SwissLaneTeam team={result.right} winner={result.winnerId === result.right.id} />
    </button>
  );
}

function SwissLaneTeam({ team, winner = false }: { team: FieldTeam; winner?: boolean }) {
  return (
    <span className={`${team.id === "user" ? "lane-team user" : "lane-team"}${winner ? " winner" : ""}`}>
      <TeamLogo team={team} small />
      <b>{team.tag}</b>
      {winner ? <small>win</small> : team.id === "user" && <small>you</small>}
    </span>
  );
}

function SwissOutcome({
  title,
  tone,
  teams,
  labels,
}: {
  title: string;
  tone: "qualified" | "eliminated";
  teams: FieldTeam[];
  labels: string[];
}) {
  return (
    <div className={`swiss-outcome ${tone}`}>
      <strong>{title}</strong>
      <div className="outcome-labels">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="outcome-teams">
        {teams.length ? (
          teams.map((team) => <SwissLaneTeam key={`${tone}-${team.id}`} team={team} />)
        ) : (
          <span className="empty-lane solo">?</span>
        )}
      </div>
    </div>
  );
}

function TeamMini({ team, flip = false }: { team: FieldTeam; flip?: boolean }) {
  return (
    <div className={flip ? "team-mini flip" : "team-mini"}>
      <TeamLogo team={team} small />
      <strong>{team.name}</strong>
    </div>
  );
}

function TeamPlate({ team, align = "left" }: { team: FieldTeam; align?: "left" | "right" }) {
  return (
    <div className={`team-plate ${align}`}>
      <TeamLogo team={team} />
      <div>
        <strong>{team.name}</strong>
        <span><Flag country={team.country} /> {team.country} / {team.year}</span>
      </div>
    </div>
  );
}

function PaperStrengthCompare({
  you,
  opponent,
  yourStrength,
  opponentStrength,
  yourBreakdown,
  opponentBreakdown,
  edge,
}: {
  you: FieldTeam;
  opponent: FieldTeam;
  yourStrength: number;
  opponentStrength: number;
  yourBreakdown: ReturnType<typeof teamStrengthBreakdown>;
  opponentBreakdown: ReturnType<typeof teamStrengthBreakdown>;
  edge: number;
}) {
  const favored = edge >= 0 ? you.name : opponent.name;
  return (
    <div className="paper-strength-panel">
      <PaperStrengthCard team={you} label="Your paper strength" value={yourStrength} breakdown={yourBreakdown} />
      <div className={edge >= 0 ? "paper-edge good" : "paper-edge bad"}>
        <span>Paper edge</span>
        <strong>{edge > 0 ? "+" : ""}{edge.toFixed(1)}</strong>
        <small>{favored} favored</small>
      </div>
      <PaperStrengthCard team={opponent} label="Opponent paper strength" value={opponentStrength} breakdown={opponentBreakdown} align="right" />
    </div>
  );
}

function PaperStrengthCard({
  team,
  label,
  value,
  breakdown,
  align = "left",
}: {
  team: FieldTeam;
  label: string;
  value: number;
  breakdown: ReturnType<typeof teamStrengthBreakdown>;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "paper-strength-card right" : "paper-strength-card"}>
      <span>{label}</span>
      <strong>{value.toFixed(1)}</strong>
      <small>{team.name}</small>
      <div className="paper-strength-details">
        <em>Avg {breakdown.average.toFixed(1)}</em>
        <em>Bonuses {signedValue(breakdown.composition)}</em>
        <em>Coach {signedValue(breakdown.coach)}</em>
        {breakdown.difficulty !== 0 && <em>Diff {signedValue(breakdown.difficulty)}</em>}
      </div>
    </div>
  );
}

function VetoCoachCard({
  recommendation,
  you,
  opponent,
  disabled,
  onApply,
}: {
  recommendation?: VetoRecommendation;
  you: FieldTeam;
  opponent: FieldTeam;
  disabled: boolean;
  onApply: (map: MapId) => void;
}) {
  if (!recommendation) {
    return (
      <div className="veto-coach-card idle">
        <div className="veto-coach-head">
          <Shield size={16} />
          <span>Veto coach</span>
        </div>
        <p>The map set is locked. Review the edge table before starting.</p>
      </div>
    );
  }

  const verb = recommendation.action === "pick" ? "Pick" : "Ban";
  return (
    <div className={`veto-coach-card ${recommendation.action}`}>
      <div className="veto-coach-head">
        <Shield size={16} />
        <span>Veto coach</span>
        <b>{recommendation.confidence}</b>
      </div>
      <div className="veto-coach-main">
        <span>{verb}</span>
        <strong>{mapName(recommendation.map)}</strong>
        <em>{recommendation.edge > 0 ? "+" : ""}{recommendation.edge.toFixed(1)} edge</em>
      </div>
      <div className="veto-coach-records">
        <span className={mapRecordTone(recommendation.yourRecord)}>
          <TeamLogo team={you} small />
          {formatMapRecord(recommendation.yourRecord)}
        </span>
        <span className={mapRecordTone(recommendation.opponentRecord)}>
          <TeamLogo team={opponent} small />
          {formatMapRecord(recommendation.opponentRecord)}
        </span>
      </div>
      <ul>
        {recommendation.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <div className="veto-coach-actions">
        <button className="secondary" type="button" disabled={disabled} onClick={() => onApply(recommendation.map)}>
          {verb} {mapName(recommendation.map)}
        </button>
        <div className="veto-coach-alt">
          {recommendation.alternatives.slice(1, 3).map((item) => (
            <span key={item.map}>
              {mapName(item.map)} <b>{item.edge > 0 ? "+" : ""}{item.edge.toFixed(1)}</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BonusList({ title, bonuses }: { title: string; bonuses: ReturnType<typeof composition> }) {
  return (
    <div className="bonus-list">
      <strong>{title}</strong>
      {bonuses.map((bonus) => (
        <div className={bonus.tone} key={bonus.label}>
          <span>{bonus.label}</span>
          <b>{bonus.value > 0 ? "+" : ""}{bonus.value.toFixed(1)}</b>
        </div>
      ))}
    </div>
  );
}

function signedValue(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function signedInteger(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function vetoMapLabel(veto: VetoState, map: MapId) {
  const pick = veto.picked[map];
  if (pick === "decider") return "Decider";
  if (pick === "you") return "Your pick";
  if (pick === "opponent") return "Opponent pick";
  if (veto.banned[map]) return "Ban";
  if (veto.pendingOpponent && veto.available.includes(map)) return "Thinking";
  return veto.prompt.toLowerCase().includes("pick") ? "Pick" : "Open";
}

function vetoEdgeStatus(veto: VetoState, map: MapId, opponentTag: string) {
  const ban = veto.banned[map];
  if (ban === "you") return "your ban";
  if (ban === "opponent") return `${opponentTag} ban`;
  const pick = veto.picked[map];
  if (pick === "you") return "your pick";
  if (pick === "opponent") return `${opponentTag} pick`;
  if (pick === "decider") return "decider";
  return "";
}

function buildVetoRecommendation(
  veto: VetoState,
  you: FieldTeam,
  opponent: FieldTeam,
  settings: CustomSettings,
  results: SwissResult[],
): VetoRecommendation | undefined {
  if (veto.ready || veto.pendingOpponent || !veto.available.length) return undefined;

  const action: VetoRecommendation["action"] = veto.prompt.toLowerCase().includes("pick") ? "pick" : "ban";
  const candidates = mapPool
    .filter((map) => veto.available.includes(map.id))
    .map((map) => {
      const edge = mapEdge(you, opponent, map.id, settings);
      const yourRecord = mapRecordForTeam(results, you.id, map.id);
      const opponentRecord = mapRecordForTeam(results, opponent.id, map.id);
      const yourRecordScore = yourRecord.wins - yourRecord.losses;
      const opponentRecordScore = opponentRecord.wins - opponentRecord.losses;
      const score =
        action === "pick"
          ? edge + (yourRecordScore - opponentRecordScore) * 0.45
          : -edge + (opponentRecordScore - yourRecordScore) * 0.45;

      return { map: map.id, score, edge, yourRecord, opponentRecord };
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best) return undefined;

  const nextBest = candidates[1];
  const gap = nextBest ? best.score - nextBest.score : 2;
  const confidence: VetoRecommendation["confidence"] = gap >= 1.4 ? "high" : gap >= 0.65 ? "medium" : "low";
  const reasons: string[] = [];
  const totalYourMaps = best.yourRecord.wins + best.yourRecord.losses;
  const totalOpponentMaps = best.opponentRecord.wins + best.opponentRecord.losses;

  if (action === "pick") {
    reasons.push(
      best.edge >= 0
        ? `Best remaining paper edge at ${signedValue(best.edge)}.`
        : `Least damaging pick at ${signedValue(best.edge)}.`,
    );
  } else {
    reasons.push(
      best.edge < 0
        ? `Biggest danger map at ${signedValue(best.edge)}.`
        : `Lowest-value open map at ${signedValue(best.edge)}.`,
    );
  }

  if (totalYourMaps > 0) reasons.push(`${you.tag} are ${formatMapRecord(best.yourRecord)} on it this run.`);
  if (totalOpponentMaps > 0) reasons.push(`${opponent.tag} are ${formatMapRecord(best.opponentRecord)} on it this run.`);
  if (veto.available.length === 1) reasons.push("Only map left in the veto.");
  if (reasons.length < 2) {
    reasons.push(
      action === "pick"
        ? "Keeps the series on your strongest remaining lane."
        : "Protects the series from the worst remaining lane.",
    );
  }

  return {
    action,
    map: best.map,
    score: best.score,
    edge: best.edge,
    yourRecord: best.yourRecord,
    opponentRecord: best.opponentRecord,
    confidence,
    reasons: reasons.slice(0, 3),
    alternatives: candidates.slice(0, 3).map(({ map, score, edge }) => ({ map, score, edge })),
  };
}

function SwissPath({ record }: { record: SwissRecord }) {
  const lanes = ["0-0", "1-0", "0-1", "2-0", "1-1", "0-2", "2-1", "1-2", "2-2", "3 wins", "3 losses"];
  const current = record.wins >= 3 ? "3 wins" : record.losses >= 3 ? "3 losses" : `${record.wins}-${record.losses}`;
  return (
    <div className="swiss-path">
      {lanes.map((lane) => (
        <span key={lane} className={lane === current ? "active" : ""}>
          {lane}
        </span>
      ))}
    </div>
  );
}

const achievementText: Record<string, string> = {
  "role-perfect": "Role perfect",
  superteam: "Superteam",
  almanac: "Almanac brain",
  "veto-read": "Veto read",
  "upset-artist": "Upset artist",
  "close-call": "Close call",
  "clean-win": "Clean win",
  "playoff-ticket": "Playoff ticket",
};

function AchievementStrip({ achievements }: { achievements: string[] }) {
  if (!achievements.length) return null;
  return (
    <div className="achievement-strip">
      <div className="section-title">
        <Award size={18} />
        <span>Achievements</span>
      </div>
      <div className="achievement-grid">
        {achievements.map((achievement) => (
          <span key={achievement}>{achievementText[achievement] ?? achievement}</span>
        ))}
      </div>
    </div>
  );
}

function FormList({ players, form }: { players: Player[]; form: Record<string, number> }) {
  if (!players.length) return null;
  return (
    <div className="form-list">
      <strong>Player form</strong>
      {players.map((player) => {
        const value = form[player.id] ?? 0;
        const label = value > 2 ? "hot" : value < -2 ? "cold" : "stable";
        return (
          <div className={value > 2 ? "good" : value < -2 ? "bad" : "neutral"} key={player.id}>
            <span>{player.handle}</span>
            <b>{label} {value > 0 ? "+" : ""}{value}%</b>
          </div>
        );
      })}
    </div>
  );
}

function LineupCompare({ you, opponent }: { you: FieldTeam; opponent: FieldTeam }) {
  return (
    <div className="lineup-compare">
      <LineupColumn title={you.name} players={you.players} />
      <LineupColumn title={opponent.name} players={opponent.players} />
    </div>
  );
}

// HLTV-style lineups: per team a header (logo + name + world rank) over a row of player photo cards.
function MatchLineups({ teams }: { teams: Array<{ team: FieldTeam; players: Player[] }> }) {
  return (
    <section className="match-lineups">
      <div className="section-title">
        <Users size={18} />
        <span>Lineups</span>
      </div>
      {teams.map(({ team, players }) => (
        <div className="lineup-team" key={team.id} style={{ "--crest": team.accent } as React.CSSProperties}>
          <div className="lineup-team-head">
            <TeamLogo team={team} small />
            <strong>{team.name}</strong>
            {team.rank ? <span className="lineup-rank">World rank: <b>#{team.rank}</b></span> : null}
          </div>
          <div className="lineup-photo-grid">
            {players.map((p) => {
              const photo = playerPhoto(p.handle);
              return (
                <div className="lineup-photo-card" key={p.id}>
                  <div className="lineup-photo-frame">
                    {photo ? (
                      <img src={photo} alt={p.handle} loading="lazy" />
                    ) : (
                      <span className="lineup-photo-fallback">{p.handle.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="lineup-photo-name">
                    <Flag country={p.country} />
                    <span>{p.handle}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function LineupColumn({ title, players }: { title: string; players: Player[] }) {
  return (
    <div className="lineup-column">
      <strong>{title}</strong>
      {players.map((player) => {
        const hltvRating = typeof player.hltvRating === "number" && (player.hltvMaps ?? 0) > 0 ? player.hltvRating.toFixed(2) : undefined;
        const photo = playerPhoto(player.handle);
        return (
          <div className="lineup-row" key={player.id}>
            <div className="lineup-player-main">
              {photo && <img className="lineup-avatar" src={photo} alt={player.handle} loading="lazy" />}
              <Flag country={player.country} />
              <b>{player.handle}</b>
              <span className="lineup-ovr">{player.ovr}</span>
            </div>
            <div className="lineup-player-sub">
              <small>{player.role} / {player.style}</small>
              {hltvRating && <em>HLTV {hltvRating}</em>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Advanced stats the box score can't show — opening duels, multi-kills/aces, real clutch outcomes,
// trade kills, headshot rate — all reconstructed from the structured event log (matchAnalytics.ts).
function MatchInsightsPanel({
  left,
  right,
  mapResults,
}: {
  left: FieldTeam;
  right: FieldTeam;
  mapResults: SeriesMapResult[];
}) {
  const logs = useMemo(
    () => mapResults.map((map) => map.eventLog).filter((log): log is MatchEventLog => Boolean(log)),
    [mapResults],
  );
  const analytics = useMemo(() => analyzeEventLogs(logs), [logs]);
  const leaders = useMemo(() => matchInsightLeaders(analytics), [analytics]);

  if (!logs.length || !analytics.players.length) return null;

  const playerById = new Map<string, Player>();
  [...left.players, ...right.players].forEach((player) => playerById.set(player.id, player));
  const teamForSide = (side: MatchEventTeam) => (side === "right" ? right : left);

  return (
    <section className="match-insights-panel">
      <div className="match-insights-head">
        <div className="section-title">
          <Sparkles size={18} />
          <span>Advanced insights</span>
        </div>
        <span>{analytics.rounds} rounds analysed · from the round-by-round event log</span>
      </div>

      {leaders.length > 0 && (
        <div className="insight-card-grid">
          {leaders.map((leader) => {
            const team = teamForSide(leader.player.team);
            const player = playerById.get(leader.player.playerId);
            const photo = player ? playerPhoto(player.handle) : undefined;
            return (
              <article className="insight-card" key={leader.key} style={{ "--crest": team.accent } as React.CSSProperties}>
                <div className="insight-card-top">
                  <span className="insight-card-stat">
                    <InsightIcon kind={leader.key} />
                    {leader.title}
                  </span>
                  <TeamLogo team={team} small />
                </div>
                <div className="insight-card-player">
                  {photo && <img className="insight-face" src={photo} alt={leader.player.name} loading="lazy" />}
                  {player && <Flag country={player.country} />}
                  <strong>{player?.handle ?? leader.player.name}</strong>
                </div>
                <b className="insight-card-value">{leader.display}</b>
                <p>{leader.detail}</p>
              </article>
            );
          })}
        </div>
      )}

      <div className="insight-team-stack">
        {([left, right] as FieldTeam[]).map((team, index) => {
          const side: MatchEventTeam = index === 0 ? "left" : "right";
          const rows = analytics.players
            .filter((row) => row.team === side)
            .sort((a, b) => insightSort(b) - insightSort(a));
          if (!rows.length) return null;
          return (
            <div className="insight-team-block" key={team.id} style={{ "--crest": team.accent } as React.CSSProperties}>
              <div className="insight-team-head">
                <TeamLogo team={team} small />
                <strong>{team.name}</strong>
              </div>
              <table className="insight-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th title="Kills / deaths">K–D</th>
                    <th title="Opening kills minus opening deaths">Open</th>
                    <th title="Rounds with 2 or more kills">MK</th>
                    <th title="Clutches won / lost">CL</th>
                    <th title="Trade kills (avenged a teammate)">TK</th>
                    <th title="Headshot percentage">HS%</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const player = playerById.get(row.playerId);
                    return (
                      <tr key={row.playerId}>
                        <td className="insight-name">
                          {player && <Flag country={player.country} />}
                          <span>{player?.handle ?? row.name}</span>
                          {row.aces > 0 && (
                            <em className="insight-ace" title={`${row.aces} ace${row.aces === 1 ? "" : "s"}`}>ACE</em>
                          )}
                        </td>
                        <td>{row.kills}–{row.deaths}</td>
                        <td className={openTone(row)}>{fmtDiff(row.openingKills - row.openingDeaths)}</td>
                        <td title={formatMultiKills(row.multiKills)}>{row.multiKillRounds || "–"}</td>
                        <td title={formatClutches(row)} className={row.clutches.won ? "good" : ""}>
                          {row.clutches.won}-{row.clutches.lost}
                        </td>
                        <td>{row.tradeKills || "–"}</td>
                        <td>{row.kills ? `${Math.round(row.headshotPct * 100)}%` : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function InsightIcon({ kind }: { kind: string }) {
  const size = 14;
  if (kind === "opening") return <Crosshair size={size} />;
  if (kind === "multikill") return <Flame size={size} />;
  if (kind === "clutch") return <Swords size={size} />;
  if (kind === "trade") return <Zap size={size} />;
  if (kind === "headshot") return <Target size={size} />;
  return <Award size={size} />;
}

function insightSort(row: PlayerAnalytics) {
  return (
    row.kills +
    row.tradeKills * 0.5 +
    row.clutches.won * 1.5 +
    (row.openingKills - row.openingDeaths) * 0.5
  );
}

function openTone(row: PlayerAnalytics) {
  const diff = row.openingKills - row.openingDeaths;
  return diff > 0 ? "good" : diff < 0 ? "bad" : "";
}

function fmtDiff(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function MatchStatsPanel({
  maps,
  mapResults = [],
  teams,
  onOpenPlayer,
  onOpenTeam,
}: {
  maps: MapId[];
  mapResults?: SeriesMapResult[];
  teams: Array<{ team: FieldTeam; players: Player[]; stats: MatchState["yourStats"]; side?: "left" | "right" }>;
  onOpenPlayer?: (player: Player, team: FieldTeam) => void;
  onOpenTeam?: (team: FieldTeam) => void;
}) {
  const [sideFilter, setSideFilter] = useState<StatsSideFilter>("both");
  const [mapFilter, setMapFilter] = useState<StatsMapFilter>("all");
  const visibleMaps = mapResults.length ? mapResults.map((result) => result.map) : maps.length ? maps : ["mirage" as MapId];
  const filteredTeams = teams.map((entry) => ({
    ...entry,
    stats: statsForPanelFilter(entry, mapResults, mapFilter, sideFilter),
  }));

  useEffect(() => {
    setSideFilter("both");
    setMapFilter("all");
  }, [mapResults.map((result) => `${result.map}-${result.leftScore}-${result.rightScore}`).join("|")]);

  return (
    <section className="match-stats-page">
      <div className="match-stats-top">
        <h2>Match stats</h2>
        <div className="stats-filter-strip" aria-label="Stats filters">
          <button className="stats-filter muted">HLTV-style</button>
          <span>Side</span>
          <button className={sideFilter === "both" ? "stats-filter active" : "stats-filter muted"} onClick={() => setSideFilter("both")}>
            Both
          </button>
          <button className={sideFilter === "T" ? "stats-filter active" : "stats-filter muted"} onClick={() => setSideFilter("T")}>
            Terrorist
          </button>
          <button className={sideFilter === "CT" ? "stats-filter active" : "stats-filter muted"} onClick={() => setSideFilter("CT")}>
            Counter-Terrorist
          </button>
        </div>
      </div>
      <div className="stats-map-bar">
        <div className="stats-map-tabs">
          <button className={mapFilter === "all" ? "active" : ""} onClick={() => setMapFilter("all")}>All maps</button>
          {visibleMaps.map((map, index) => (
            <button className={mapFilter === index ? "active" : ""} key={`${map}-${index}`} onClick={() => setMapFilter(index)}>
              {mapName(map)}
            </button>
          ))}
        </div>
        <button className="detailed-stats-button">Detailed stats</button>
      </div>
      <div className="team-stats-stack">
        {filteredTeams.map(({ team, players, stats }) => (
          <TeamStatsBlock key={team.id} team={team} players={players} stats={stats} onOpenPlayer={onOpenPlayer} onOpenTeam={onOpenTeam} />
        ))}
      </div>
    </section>
  );
}

function statsForPanelFilter(
  entry: { team: FieldTeam; stats: MatchState["yourStats"]; side?: "left" | "right" },
  mapResults: SeriesMapResult[],
  mapFilter: StatsMapFilter,
  sideFilter: StatsSideFilter,
) {
  if (!mapResults.length || !entry.side) return entry.stats;
  const selectedMaps = mapFilter === "all" ? mapResults : mapResults[mapFilter] ? [mapResults[mapFilter]] : mapResults;
  if (sideFilter === "both") return aggregateSeriesStats(entry.team, selectedMaps, entry.side);
  return aggregateSeriesSideStats(entry.team, selectedMaps, entry.side, sideFilter);
}

function aggregateSeriesSideStats(team: FieldTeam, maps: SeriesMapResult[], teamSide: "left" | "right", statsSide: "CT" | "T") {
  const stats = team.players.reduce(
    (acc, player) => {
      acc[player.id] = emptyLine();
      return acc;
    },
    {} as MatchState["yourStats"],
  );
  maps.forEach((map) => {
    const source =
      teamSide === "left"
        ? map.leftSideStats?.[statsSide] ?? map.leftStats
        : map.rightSideStats?.[statsSide] ?? map.rightStats;
    team.players.forEach((player) => {
      const incoming = source[player.id];
      if (incoming) addPlayerLine(stats[player.id], incoming);
    });
  });
  return stats;
}

function RunStatsPage({
  rows,
  scope,
  onScopeChange,
  onBack,
  onOpenPlayer,
  onOpenTeam,
}: {
  rows: PlayerDatabaseRow[];
  scope: StatsScope;
  onScopeChange: (scope: StatsScope) => void;
  onBack: () => void;
  onOpenPlayer: (player: Player, team: FieldTeam) => void;
  onOpenTeam: (team: FieldTeam) => void;
}) {
  const visibleRows = scope === "mine" ? rows.filter((row) => row.team.id === "user") : rows;
  const leader = visibleRows[0];
  return (
    <main className="layout fullscreen-page">
      <section className="fullscreen-head">
        <div>
          <div className="section-title">
            <Target size={18} />
            <span>Run stats</span>
          </div>
          <h1>Player database</h1>
          <p>{rows.length ? `${rows.length} players tracked from completed series.` : "Complete a series and the run database will start filling in here."}</p>
        </div>
        <div className="fullscreen-actions">
          <div className="segmented compact">
            <button className={scope === "all" ? "selected" : ""} onClick={() => onScopeChange("all")}>
              <Users size={16} />
              All players
            </button>
            <button className={scope === "mine" ? "selected" : ""} onClick={() => onScopeChange("mine")}>
              <Target size={16} />
              My players
            </button>
          </div>
          <button className="secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </section>

      {leader && (
        <section className="stats-leader-strip">
          <div>
            <span>Top rating</span>
            <strong>{leader.player.handle}</strong>
            <small>{leader.team.name} / {leader.line.rating.toFixed(2)}</small>
          </div>
          <div>
            <span>Best ADR</span>
            <strong>{[...visibleRows].sort((a, b) => b.line.adr - a.line.adr)[0]?.player.handle}</strong>
            <small>{[...visibleRows].sort((a, b) => b.line.adr - a.line.adr)[0]?.line.adr.toFixed(1)} ADR</small>
          </div>
          <div>
            <span>Scope</span>
            <strong>{scope === "mine" ? "My roster" : "Full field"}</strong>
            <small>{visibleRows.length} listed</small>
          </div>
        </section>
      )}

      <section className="full-table-card">
        <div className="full-table-head run-stats-grid">
          <span>Player</span>
          <span>Nation</span>
          <span>Team</span>
          <span>Role</span>
          <span>Maps</span>
          <span>K-D</span>
          <span>+/-</span>
          <span>ADR</span>
          <span>KAST</span>
          <span>Clutch</span>
          <span>Rating</span>
        </div>
        {visibleRows.length ? (
          visibleRows.map(({ databaseKey, player, team, matches, line }) => {
            const kast = line.rounds ? (line.kastRounds / line.rounds) * 100 : 0;
            return (
              <div className="full-table-row run-stats-grid" key={databaseKey}>
                <button type="button" className="full-player-cell link-cell" onClick={() => onOpenPlayer(player, team)} title={`${player.handle} — per-match stats`}>
                  <Flag country={player.country} />
                  <b>{player.handle}</b>
                  <small>{player.realName}</small>
                </button>
                <span>{player.country}</span>
                <button type="button" className="run-team-cell link-cell" onClick={() => onOpenTeam(team)} title={`${team.name} — major results`}>
                  <TeamLogo team={team} small />
                  <b>{team.tag}</b>
                </button>
                <span>{player.role}</span>
                <span>{matches}</span>
                <span>{line.kills}-{line.deaths}</span>
                <span className={line.kills >= line.deaths ? "stat-positive" : "stat-negative"}>{signedInteger(line.kills - line.deaths)}</span>
                <span>{line.adr.toFixed(1)}</span>
                <span>{kast.toFixed(1)}%</span>
                <span>{line.clutchWins}</span>
                <span className={`rating-number ${ratingTone(line.rating)}`}>{line.rating.toFixed(2)}</span>
              </div>
            );
          })
        ) : (
          <div className="empty-fullscreen">No player stats for this filter yet.</div>
        )}
      </section>
    </main>
  );
}

// ---- Vault: all-time records from the persistent local match database ---------------------------

const VAULT_STATS: Array<{
  key: string;
  label: string;
  get: (line: PlayerCareerRecord["line"]) => number;
  fmt: (line: PlayerCareerRecord["line"]) => string;
}> = [
  { key: "rating", label: "Rating", get: (l) => l.rating, fmt: (l) => l.rating.toFixed(2) },
  { key: "kd", label: "K–D", get: (l) => l.kills - l.deaths, fmt: (l) => fmtDiff(l.kills - l.deaths) },
  { key: "kills", label: "Kills", get: (l) => l.kills, fmt: (l) => `${l.kills}` },
  { key: "adr", label: "ADR", get: (l) => l.adr, fmt: (l) => l.adr.toFixed(1) },
  { key: "multi", label: "Multi-kills", get: (l) => l.multiKills, fmt: (l) => `${l.multiKills}` },
  { key: "clutch", label: "Clutches", get: (l) => l.clutchWins, fmt: (l) => `${l.clutchWins}` },
  { key: "opening", label: "Openings", get: (l) => l.firstKills - l.firstDeaths, fmt: (l) => fmtDiff(l.firstKills - l.firstDeaths) },
];

type VaultMapFilter = "all" | MapId;

const SIDE_FILTERS: Array<{ key: StatsSideFilter; label: string }> = [
  { key: "both", label: "Both" },
  { key: "CT", label: "CT" },
  { key: "T", label: "T" },
];

function VaultPage({ onBack, onOpenReplay }: { onBack: () => void; onOpenReplay: (matchId: string) => void }) {
  const db = useMemo(() => getMatchDb(), []);
  const [refresh, setRefresh] = useState(0);
  const [statKey, setStatKey] = useState(VAULT_STATS[0].key);
  const [sideFilter, setSideFilter] = useState<StatsSideFilter>("both");
  const [mapFilter, setMapFilter] = useState<VaultMapFilter>("all");

  const matches = useMemo(() => db.listMatches(), [db, refresh]);
  const teams = useMemo(() => db.listTeams(), [db, refresh]);
  // Distinct player versions, derived from the already-fetched matches (no extra DB scan).
  const totalPlayers = useMemo(() => {
    const keys = new Set<string>();
    matches.forEach((match) => match.players.forEach((ref) => keys.add(ref.versionKey)));
    return keys.size;
  }, [matches]);
  const replayIds = useMemo(() => db.eventLogIds(), [db, refresh]);
  const filteredPlayers = useMemo(
    () =>
      db.listPlayers({
        side: sideFilter === "both" ? undefined : sideFilter,
        map: mapFilter === "all" ? undefined : mapFilter,
      }),
    [db, refresh, sideFilter, mapFilter],
  );

  const stat = VAULT_STATS.find((entry) => entry.key === statKey) ?? VAULT_STATS[0];
  const leaders = useMemo(
    () => [...filteredPlayers].sort((a, b) => stat.get(b.line) - stat.get(a.line) || b.line.rating - a.line.rating).slice(0, 25),
    [filteredPlayers, stat],
  );
  const top = leaders[0];

  if (!matches.length) {
    return (
      <main className="layout fullscreen-page vault-page">
        <section className="fullscreen-head">
          <div>
            <div className="section-title">
              <Trophy size={18} />
              <span>Vault</span>
            </div>
            <h1>All-time records</h1>
          </div>
          <button className="secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
        </section>
        <div className="vault-empty">
          <Trophy size={32} />
          <strong>No saved matches yet</strong>
          <p>Play or sim a series and your all-time records — leaderboards, team standings, and replays — start accruing here, across every run.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="layout fullscreen-page vault-page">
      <section className="fullscreen-head">
        <div>
          <div className="section-title">
            <Trophy size={18} />
            <span>Vault</span>
          </div>
          <h1>All-time records</h1>
          <p>Every saved match, across every run — kept locally on this device.</p>
        </div>
        <div className="fullscreen-actions">
          <button
            className="secondary"
            onClick={() => {
              if (typeof window !== "undefined" && window.confirm("Clear all saved match records? This can't be undone.")) {
                db.clear();
                setRefresh((value) => value + 1);
              }
            }}
          >
            <Trash2 size={16} />
            Clear vault
          </button>
          <button className="secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </section>

      <section className="vault-hero">
        <div className="vault-hero-tile">
          <strong>{matches.length}</strong>
          <span>Maps</span>
        </div>
        <div className="vault-hero-tile">
          <strong>{totalPlayers}</strong>
          <span>Players</span>
        </div>
        <div className="vault-hero-tile">
          <strong>{teams.length}</strong>
          <span>Teams</span>
        </div>
        {top && (
          <div className="vault-hero-leader">
            <span className="vault-hero-leader-label">{stat.label} leader</span>
            <div className="vault-hero-leader-body">
              {playerPhoto(top.handle) && <img className="vault-face lg" src={playerPhoto(top.handle)} alt={top.handle} loading="lazy" />}
              <div className="vault-hero-leader-id">
                <strong>
                  <Flag country={top.country} /> {top.handle}
                  {top.year && <em className="vault-era">'{top.year.slice(-2)}</em>}
                </strong>
                <span>{top.matches} map{top.matches === 1 ? "" : "s"}</span>
              </div>
              <b className="vault-hero-leader-val">{stat.fmt(top.line)}</b>
            </div>
          </div>
        )}
      </section>

      <section className="vault-card">
        <div className="vault-card-head">
          <div className="section-title">
            <Award size={18} />
            <span>Leaderboard</span>
          </div>
          <div className="vault-stat-tabs">
            {VAULT_STATS.map((entry) => (
              <button key={entry.key} className={entry.key === statKey ? "active" : ""} onClick={() => setStatKey(entry.key)}>
                {entry.label}
              </button>
            ))}
          </div>
        </div>
        <div className="vault-filter-row">
          <div className="vault-side-tabs" role="group" aria-label="Side filter">
            {SIDE_FILTERS.map((entry) => (
              <button
                key={entry.key}
                aria-pressed={entry.key === sideFilter}
                className={entry.key === sideFilter ? "active" : ""}
                onClick={() => setSideFilter(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <select
            className="vault-map-select"
            aria-label="Filter by map"
            value={mapFilter}
            onChange={(event) => setMapFilter(event.target.value as VaultMapFilter)}
          >
            <option value="all">All maps</option>
            {mapPool.map((map) => (
              <option key={map.id} value={map.id}>
                {mapName(map.id)}
              </option>
            ))}
          </select>
        </div>
        {leaders.length === 0 ? (
          <div className="vault-no-rows">No {sideFilter === "both" ? "" : `${sideFilter}-side `}records{mapFilter === "all" ? "" : ` on ${mapName(mapFilter)}`} yet.</div>
        ) : (
          <div className="vault-leader-list">
            {leaders.map((player, index) => {
              const photo = playerPhoto(player.handle);
              return (
                <div className={`vault-leader-row${index < 3 ? ` medal medal-${index + 1}` : ""}`} key={player.versionKey}>
                  <span className="vault-rank-chip">{index + 1}</span>
                  {photo ? (
                    <img className="vault-face" src={photo} alt={player.handle} loading="lazy" />
                  ) : (
                    <span className="vault-face placeholder" aria-hidden="true" />
                  )}
                  <Flag country={player.country} />
                  <strong>
                    {player.handle}
                    {player.year && <em className="vault-era">'{player.year.slice(-2)}</em>}
                  </strong>
                  <span className="vault-sub">
                    {player.matches} map{player.matches === 1 ? "" : "s"} · {player.line.rating.toFixed(2)} rating
                  </span>
                  <b className="vault-stat-val">{stat.fmt(player.line)}</b>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="vault-two-col">
        <section className="vault-card">
          <div className="section-title">
            <Shield size={18} />
            <span>Team standings</span>
          </div>
          <table className="vault-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Maps</th>
                <th>W</th>
                <th>L</th>
                <th>Win%</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((row: TeamRecordRow) => (
                <tr key={row.team.id}>
                  <td className="vault-team-cell">
                    <b>{row.team.tag}</b>
                    <span>{row.team.name}</span>
                  </td>
                  <td>{row.matches}</td>
                  <td>{row.wins}</td>
                  <td>{row.losses}</td>
                  <td>{((row.wins / Math.max(1, row.matches)) * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="vault-card">
          <div className="section-title">
            <Clock3 size={18} />
            <span>Recent matches</span>
          </div>
          <div className="vault-match-list">
            {[...matches].reverse().slice(0, 40).map((match: MatchRecord) => {
              const canReplay = replayIds.has(match.id);
              return (
                <button
                  type="button"
                  className={`vault-match-row${canReplay ? "" : " no-replay"}`}
                  key={match.id}
                  aria-disabled={!canReplay}
                  onClick={() => canReplay && onOpenReplay(match.id)}
                  title={canReplay ? "Watch round replay" : "Replay not saved for this match"}
                >
                  <span className="vault-match-map">{mapAbbr(match.map)}</span>
                  <span className={`vault-match-team${match.winnerId === match.left.id ? " won" : ""}`}>{match.left.tag}</span>
                  <b>
                    {match.leftScore}–{match.rightScore}
                  </b>
                  <span className={`vault-match-team right${match.winnerId === match.right.id ? " won" : ""}`}>{match.right.tag}</span>
                  <span className="vault-match-play">{canReplay ? <Play size={13} /> : null}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

// ---- Round mini-replay: step through a map's rounds from the stored event log -------------------

interface ReplayRound {
  round: number;
  events: MatchEvent[];
}

function groupEventsByRound(events: MatchEvent[]): ReplayRound[] {
  const rounds = new Map<number, MatchEvent[]>();
  for (const event of events) {
    const bucket = rounds.get(event.round);
    if (bucket) bucket.push(event);
    else rounds.set(event.round, [event]);
  }
  return [...rounds.entries()].sort((a, b) => a[0] - b[0]).map(([round, list]) => ({ round, events: list }));
}

// Minimal team shape the replay needs — satisfied by both FieldTeam and the DB's StoredTeamRef.
type ReplayTeam = { name: string; tag: string; accent: string };
const REPLAY_SPEEDS = [1, 2, 4];

// The animated replay core: a per-round timeline played by a requestAnimationFrame loop. Kills (and on
// mirage, bomb events) reveal as the playhead passes their timestamp; play/pause, speed and a scrubber
// drive it. Reused by the series panel (map tabs) and the Vault single-match screen.
function RoundReplayCore({
  left,
  right,
  mapId,
  rounds,
  autoAdvance = true,
}: {
  left: ReplayTeam;
  right: ReplayTeam;
  mapId: MapId;
  rounds: ReplayRound[];
  autoAdvance?: boolean;
}) {
  const total = rounds.length;
  const [round, setRound] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const clamped = Math.min(Math.max(round, 1), Math.max(1, total));
  const current = rounds.find((entry) => entry.round === clamped) ?? rounds[clamped - 1] ?? rounds[0];
  const timeline = useMemo<TimelineEntry[]>(() => (current ? buildReplayTimeline(current.events, mapId) : []), [current, mapId]);
  const duration = useMemo(() => (current ? replayRoundDuration(timeline, current.events) : 0), [timeline, current]);

  const ctRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);

  // Back to round 1 whenever the source rounds change (new map / series / match).
  useEffect(() => {
    setRound(1);
    setPlaying(false);
  }, [rounds]);

  // Zero the playhead at the start of each round.
  useEffect(() => {
    ctRef.current = 0;
    setCurrentTime(0);
  }, [clamped, mapId]);

  // Playback loop.
  useEffect(() => {
    if (!playing || duration <= 0) return;
    lastTsRef.current = 0;
    const tick = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = ((ts - lastTsRef.current) / 1000) * speed;
      lastTsRef.current = ts;
      const next = ctRef.current + dt;
      if (next >= duration) {
        if (autoAdvance && clamped < total) {
          // Advance AND zero the playhead in the same update so the next round never renders for a
          // frame with the previous round's (large) currentTime — which would flash all its kills.
          ctRef.current = 0;
          setCurrentTime(0);
          setRound(clamped + 1);
        } else {
          ctRef.current = duration;
          setCurrentTime(duration);
          setPlaying(false);
        }
        return;
      }
      ctRef.current = next;
      setCurrentTime(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, speed, duration, clamped, total, autoAdvance]);

  if (!current) return null;

  const visible = visibleEntries(timeline, currentTime);
  const visibleKills = visible.filter((entry) => entry.event.type === "kill");
  const totalKills = timeline.filter((entry) => entry.event.type === "kill").length;
  const over = current.events.find((event) => event.type === "round_over");
  const winnerTeam = over && over.team !== "neutral" ? (over.team === "left" ? left : right) : undefined;

  const alive: Record<MatchEventTeam, number> = { left: 5, right: 5, neutral: 0 };
  const teamFor = (team: MatchEventTeam) => (team === "left" ? left : right);
  const step = (delta: number) => {
    setPlaying(false);
    setRound(Math.min(Math.max(clamped + delta, 1), total));
  };
  const togglePlay = () => {
    if (!playing && currentTime >= duration) {
      ctRef.current = 0;
      setCurrentTime(0);
    }
    setPlaying((value) => !value);
  };
  const scrub = (value: number) => {
    setPlaying(false);
    ctRef.current = value;
    setCurrentTime(value);
  };
  const cycleSpeed = () => setSpeed((value) => REPLAY_SPEEDS[(REPLAY_SPEEDS.indexOf(value) + 1) % REPLAY_SPEEDS.length]);

  return (
    <>
      <div className="replay-round-bar">
        <button className="secondary" onClick={() => step(-1)} disabled={clamped <= 1} title="Previous round">
          <ArrowLeft size={15} />
        </button>
        <div className="replay-round-label">
          <strong>Round {clamped}</strong>
          <span>
            of {total}
            {winnerTeam ? ` · ${winnerTeam.tag} won` : ""}
            {over?.reason ? ` (${over.reason})` : ""}
          </span>
        </div>
        <button className="secondary" onClick={() => step(1)} disabled={clamped >= total} title="Next round">
          <ArrowLeft size={15} style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>

      <div className="replay-controls">
        <button className="replay-play" onClick={togglePlay} title={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <input
          className="replay-scrubber"
          type="range"
          min={0}
          max={Math.max(duration, 0.001)}
          step={0.05}
          value={Math.min(currentTime, duration)}
          onChange={(event) => scrub(Number(event.target.value))}
          aria-label="Replay scrubber"
        />
        <button className="replay-speed" onClick={cycleSpeed} title="Playback speed">
          {speed}×
        </button>
      </div>

      <div className={`replay-body${mapId === "mirage" ? " has-radar" : ""}`}>
        <ol className="replay-feed">
          {totalKills === 0 && <li className="replay-empty">No kills recorded this round.</li>}
          {visibleKills.map((entry, index) => {
            const event = entry.event;
            const killerTeam = event.team;
            const victimTeam = killerTeam === "left" ? "right" : killerTeam === "right" ? "left" : "neutral";
            if (victimTeam !== "neutral") alive[victimTeam] = Math.max(0, alive[victimTeam] - 1);
            return (
              <li key={`${event.id}-${index}`} className="replay-kill">
                <span className="replay-killer" style={{ color: teamFor(killerTeam)?.accent }}>
                  {event.actor}
                </span>
                <span className="replay-weapon">
                  {event.firstKill && <em className="replay-badge entry">FK</em>}
                  {event.weapon}
                  {event.headshot && <em className="replay-badge hs">HS</em>}
                </span>
                <span className="replay-victim">{event.target}</span>
                <span className="replay-alive">
                  {alive.left}v{alive.right}
                </span>
              </li>
            );
          })}
        </ol>

        {mapId === "mirage" && (
          <div className="replay-radar">
            <img src={mirageRadar} alt="mirage radar" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              {visible.map((entry, index) => {
                const event = entry.event;
                if (event.type !== "kill" || !event.actorPos || !event.targetPos) return null;
                return (
                  <g key={`${event.id}-pos-${index}`}>
                    <line
                      x1={event.actorPos.x}
                      y1={event.actorPos.y}
                      x2={event.targetPos.x}
                      y2={event.targetPos.y}
                      className={`replay-line ${event.team}`}
                    />
                    <circle cx={event.actorPos.x} cy={event.actorPos.y} r={1.5} className={`replay-dot killer ${event.team}`} />
                    <circle cx={event.targetPos.x} cy={event.targetPos.y} r={1.3} className="replay-dot victim" />
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </>
  );
}

// Embedded replay for a played series (one or more maps with logs), with map tabs.
function SeriesRoundReplayPanel({ left, right, maps }: { left: ReplayTeam; right: ReplayTeam; maps: SeriesMapResult[] }) {
  const playable = maps.filter((map) => map.eventLog && map.eventLog.events.length > 0);
  const [mapIndex, setMapIndex] = useState(0);
  const activeMap = playable[Math.min(mapIndex, Math.max(0, playable.length - 1))];
  const rounds = useMemo(() => (activeMap?.eventLog ? groupEventsByRound(activeMap.eventLog.events) : []), [activeMap]);
  if (!playable.length || !activeMap || !rounds.length) return null;

  return (
    <section className="replay-panel">
      <div className="replay-head">
        <div className="section-title">
          <Play size={18} />
          <span>Round replay</span>
        </div>
        {playable.length > 1 && (
          <div className="replay-map-tabs">
            {playable.map((map, index) => (
              <button key={`${map.map}-${index}`} className={index === mapIndex ? "active" : ""} onClick={() => setMapIndex(index)}>
                {mapName(map.map)}
              </button>
            ))}
          </div>
        )}
      </div>
      <RoundReplayCore left={left} right={right} mapId={activeMap.map} rounds={rounds} />
    </section>
  );
}

// Full-screen replay for a single stored match opened from the Vault.
function MatchRoundReplayPanel({
  match,
  log,
  onBack,
}: {
  match: MatchRecord | undefined;
  log: MatchEventLog | undefined;
  onBack: () => void;
}) {
  const rounds = useMemo(() => (log ? groupEventsByRound(log.events) : []), [log]);
  return (
    <main className="layout fullscreen-page">
      <section className="fullscreen-head">
        <div>
          <div className="section-title">
            <Play size={18} />
            <span>Round replay</span>
          </div>
          <h1>
            {match ? `${match.left.tag} ${match.leftScore}–${match.rightScore} ${match.right.tag}` : "Replay"}
          </h1>
          {match && (
            <p>
              {mapName(match.map)}
              {match.stage ? ` · ${match.stage}` : ""}
            </p>
          )}
        </div>
        <button className="secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
      </section>
      {match && rounds.length ? (
        <section className="replay-panel">
          <RoundReplayCore left={match.left} right={match.right} mapId={match.map} rounds={rounds} />
        </section>
      ) : (
        <div className="empty-fullscreen">This match's replay isn't saved — only the most recent matches keep their full logs.</div>
      )}
    </main>
  );
}

// ---- Player of the Major: end-of-run awards -----------------------------------------------------

interface MajorAward {
  key: string;
  title: string;
  row: PlayerDatabaseRow;
  value: string;
  detail: string;
  primary?: boolean;
}

// Curate the standout performers across an entire Major, from the aggregated box scores plus the
// event-log analytics (aces / headshot rate). The MVP is the headline; the rest celebrate a niche.
function buildMajorAwards(results: SwissResult[]): MajorAward[] {
  const rows = buildPlayerDatabase(results).filter((row) => row.matches > 0);
  if (!rows.length) return [];
  const logs = results.flatMap((result) => result.maps.map((map) => map.eventLog).filter((log): log is MatchEventLog => Boolean(log)));
  const analytics = logs.length ? analyzeEventLogs(logs) : null;
  const analyticsById = new Map((analytics?.players ?? []).map((player) => [player.playerId, player]));

  const maxMaps = Math.max(...rows.map((row) => row.matches));
  const minMaps = Math.min(3, maxMaps); // a fair sample, but never exclude everyone in a short run
  const eligible = rows.filter((row) => row.matches >= minMaps);
  const awards: MajorAward[] = [];

  const best = <T,>(pool: T[], score: (item: T) => number): T | undefined =>
    pool.reduce<{ item: T; score: number } | undefined>((acc, item) => {
      const value = score(item);
      return !acc || value > acc.score ? { item, score: value } : acc;
    }, undefined)?.item;

  const mvp = best(eligible.length ? eligible : rows, (row) => row.line.rating);
  if (mvp) {
    awards.push({
      key: "mvp",
      title: "Major MVP",
      row: mvp,
      value: mvp.line.rating.toFixed(2),
      detail: `${mvp.line.kills}-${mvp.line.deaths} K–D · ${mvp.line.adr.toFixed(0)} ADR over ${mvp.matches} maps`,
      primary: true,
    });
  }

  const fragger = best(rows, (row) => row.line.kills);
  if (fragger) {
    awards.push({
      key: "frag",
      title: "Top fragger",
      row: fragger,
      value: `${fragger.line.kills}`,
      detail: `${(fragger.line.kills / Math.max(1, fragger.matches)).toFixed(1)} kills / map`,
    });
  }

  const opener = best(eligible.length ? eligible : rows, (row) => row.line.firstKills - row.line.firstDeaths);
  if (opener && opener.line.firstKills > 0) {
    const diff = opener.line.firstKills - opener.line.firstDeaths;
    awards.push({
      key: "open",
      title: "Opening duels",
      row: opener,
      value: fmtDiff(diff),
      detail: `${opener.line.firstKills} entries / ${opener.line.firstDeaths} opening deaths`,
    });
  }

  const clutcher = best(rows, (row) => row.line.clutchWins);
  if (clutcher && clutcher.line.clutchWins > 0) {
    awards.push({
      key: "clutch",
      title: "Clutch master",
      row: clutcher,
      value: `${clutcher.line.clutchWins}`,
      detail: `clutch round${clutcher.line.clutchWins === 1 ? "" : "s"} won`,
    });
  }

  if (analytics) {
    const aceRow = best(rows, (row) => analyticsById.get(row.player.id)?.aces ?? 0);
    const aces = aceRow ? analyticsById.get(aceRow.player.id)?.aces ?? 0 : 0;
    if (aceRow && aces > 0) {
      awards.push({ key: "ace", title: "Ace leader", row: aceRow, value: `${aces}`, detail: `${aces} ace${aces === 1 ? "" : "s"} (5K rounds)` });
    }

    const hsPool = rows.filter((row) => (analyticsById.get(row.player.id)?.kills ?? 0) >= 30);
    const hsRow = best(hsPool, (row) => analyticsById.get(row.player.id)?.headshotPct ?? 0);
    const hs = hsRow ? analyticsById.get(hsRow.player.id) : undefined;
    if (hsRow && hs && hs.headshotKills > 0) {
      awards.push({
        key: "hs",
        title: "Headshot %",
        row: hsRow,
        value: `${Math.round(hs.headshotPct * 100)}%`,
        detail: `${hs.headshotKills} of ${hs.kills} kills`,
      });
    }
  }

  return awards;
}

function MajorAwardsPanel({
  results,
  championName,
  onOpenPlayer,
}: {
  results: SwissResult[];
  championName?: string;
  onOpenPlayer: (player: Player, team: FieldTeam) => void;
}) {
  const awards = useMemo(() => buildMajorAwards(results), [results]);
  if (!awards.length) return null;

  return (
    <section className="awards-panel">
      <div className="awards-head">
        <div className="section-title">
          <Trophy size={18} />
          <span>Player of the Major</span>
        </div>
        <span>{championName ? `${championName} — champions` : "Tournament awards"}</span>
      </div>
      <div className="awards-grid">
        {awards.map((award) => {
          const photo = playerPhoto(award.row.player.handle);
          return (
            <button
              type="button"
              className={award.primary ? "award-card primary" : "award-card"}
              key={award.key}
              style={{ "--crest": award.row.team.accent } as React.CSSProperties}
              onClick={() => onOpenPlayer(award.row.player, award.row.team)}
              title={`${award.row.player.handle} — player profile`}
            >
              <div className="award-card-top">
                <span>{award.title}</span>
                <TeamLogo team={award.row.team} small />
              </div>
              <div className="award-player">
                {photo && <img className="award-face" src={photo} alt={award.row.player.handle} loading="lazy" />}
                <Flag country={award.row.player.country} />
                <strong>{award.row.player.handle}</strong>
                <em>{award.row.team.tag}</em>
              </div>
              <b className="award-value">{award.value}</b>
              <p>{award.detail}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---- Balance Lab: explain team strength, OVR, and round win probability -------------------------

const LAB_SCENARIOS: Array<{ key: string; label: string; scenario: RoundScenario }> = [
  { key: "ct-full", label: "You CT · both full", scenario: { side: "CT", yourEconomy: "FULL", opponentEconomy: "FULL" } },
  { key: "t-full", label: "You T · both full", scenario: { side: "T", yourEconomy: "FULL", opponentEconomy: "FULL" } },
  { key: "you-force", label: "You force vs full", scenario: { side: "CT", yourEconomy: "FORCE", opponentEconomy: "FULL", buy: "force" } },
  { key: "you-eco", label: "You eco vs full", scenario: { side: "T", yourEconomy: "ECO", opponentEconomy: "FULL", buy: "save" } },
  { key: "they-eco", label: "Their eco vs your full", scenario: { side: "CT", yourEconomy: "FULL", opponentEconomy: "ECO" } },
];

function labPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
function labSignedPP(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}pp`;
}
function labSignedFixed(value: number, digits: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}
function roundProbTone(value: number) {
  return value >= 0.6 ? "good" : value <= 0.4 ? "bad" : "neutral";
}

function BalanceLabPage({
  teams,
  settings,
  difficulty,
  onBack,
  onOpenTeam,
}: {
  teams: FieldTeam[];
  settings: CustomSettings;
  difficulty: Difficulty;
  onBack: () => void;
  onOpenTeam: (team: FieldTeam) => void;
}) {
  const [leftId, setLeftId] = useState(teams[0]?.id ?? "");
  const [rightId, setRightId] = useState(teams[1]?.id ?? teams[0]?.id ?? "");
  const [scenarioKey, setScenarioKey] = useState(LAB_SCENARIOS[0].key);
  const [playerId, setPlayerId] = useState("");

  const left = teams.find((team) => team.id === leftId) ?? teams[0];
  const right = teams.find((team) => team.id === rightId) ?? teams[1] ?? teams[0];
  if (!left || !right) {
    return (
      <main className="layout fullscreen-page">
        <div className="empty-fullscreen">No teams loaded.</div>
      </main>
    );
  }

  const leftBreakdown = teamStrengthBreakdown(left, settings, difficulty, false);
  const rightBreakdown = teamStrengthBreakdown(right, settings, difficulty, true);

  const scenarios = LAB_SCENARIOS.map((entry) => ({
    ...entry,
    explanation: explainRoundProbability(left, right, settings, difficulty, entry.scenario),
  }));
  const active = scenarios.find((entry) => entry.key === scenarioKey) ?? scenarios[0];

  const roster = [
    ...left.players.map((player) => ({ player, team: left })),
    ...right.players.map((player) => ({ player, team: right })),
  ];
  const selected = roster.find((entry) => entry.player.id === playerId) ?? roster[0];
  const ovr = selected ? ovrBreakdown(selected.player.stats, selected.player.role) : null;

  return (
    <main className="layout fullscreen-page balance-lab">
      <section className="fullscreen-head">
        <div>
          <div className="section-title">
            <Sparkles size={18} />
            <span>Balance Lab</span>
          </div>
          <h1>Why the sim says what it says</h1>
          <p>
            Team strength, player OVR, and per-round win probability — every contribution itemised. Left is framed as
            “you”, right as the “opponent”, so the difficulty bonus lands on the opponent exactly as it does in a real match.
          </p>
        </div>
        <button className="secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
      </section>

      <section className="lab-matchup">
        <LabTeamPicker label="You" value={left.id} teams={teams} onChange={setLeftId} />
        <button
          className="secondary lab-swap"
          onClick={() => {
            setLeftId(right.id);
            setRightId(left.id);
          }}
          title="Swap sides"
        >
          <RefreshCcw size={16} />
        </button>
        <LabTeamPicker label="Opponent" value={right.id} teams={teams} onChange={setRightId} />
      </section>

      <section className="lab-card">
        <div className="section-title">
          <Gauge size={18} />
          <span>Paper strength</span>
        </div>
        <div className="lab-strength-grid">
          <LabStrengthColumn team={left} breakdown={leftBreakdown} onOpenTeam={onOpenTeam} />
          <div className="lab-strength-gap">
            <span>Strength gap</span>
            <strong className={leftBreakdown.total >= rightBreakdown.total ? "good" : "bad"}>
              {labSignedFixed(leftBreakdown.total - rightBreakdown.total, 1)}
            </strong>
            <em>OVR-equivalent · feeds the round model as gap / 58</em>
          </div>
          <LabStrengthColumn team={right} breakdown={rightBreakdown} onOpenTeam={onOpenTeam} />
        </div>
      </section>

      <section className="lab-card">
        <div className="section-title">
          <Target size={18} />
          <span>Round win probability</span>
        </div>
        <div className="lab-scenario-tabs">
          {scenarios.map((entry) => (
            <button
              key={entry.key}
              className={entry.key === active.key ? "active" : ""}
              onClick={() => setScenarioKey(entry.key)}
            >
              <span>{entry.label}</span>
              <b className={roundProbTone(entry.explanation.final)}>{labPct(entry.explanation.final)}</b>
            </button>
          ))}
        </div>
        <LabProbabilityWaterfall explanation={active.explanation} leftTag={left.tag} rightTag={right.tag} />
      </section>

      <section className="lab-card">
        <div className="section-title">
          <Crosshair size={18} />
          <span>Player OVR</span>
        </div>
        <select className="lab-select" value={selected?.player.id ?? ""} onChange={(event) => setPlayerId(event.target.value)}>
          {roster.map((entry) => (
            <option key={entry.player.id} value={entry.player.id}>
              {entry.team.tag} · {entry.player.handle} ({entry.player.role}) — OVR {entry.player.ovr}
            </option>
          ))}
        </select>
        {ovr && selected && <LabOvrBreakdown player={selected.player} breakdown={ovr} />}
      </section>
    </main>
  );
}

function LabTeamPicker({
  label,
  value,
  teams,
  onChange,
}: {
  label: string;
  value: string;
  teams: FieldTeam[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="lab-team-picker">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} (OVR {Math.round(averageOvr(team.players))})
          </option>
        ))}
      </select>
    </label>
  );
}

function LabStrengthColumn({
  team,
  breakdown,
  onOpenTeam,
}: {
  team: FieldTeam;
  breakdown: StrengthBreakdown;
  onOpenTeam: (team: FieldTeam) => void;
}) {
  const rows: Array<{ label: string; value: number; signed: boolean }> = [
    { label: "Avg OVR", value: breakdown.average, signed: false },
    { label: "Composition", value: breakdown.composition, signed: true },
    { label: "Coach", value: breakdown.coach, signed: true },
    { label: "Difficulty", value: breakdown.difficulty, signed: true },
  ];
  return (
    <div className="lab-strength-col" style={{ "--crest": team.accent } as React.CSSProperties}>
      <button type="button" className="lab-strength-team" onClick={() => onOpenTeam(team)}>
        <TeamLogo team={team} small />
        <strong>{team.name}</strong>
      </button>
      <div className="lab-strength-rows">
        {rows.map((row) => (
          <div className="lab-strength-row" key={row.label}>
            <span>{row.label}</span>
            <b className={row.signed ? (row.value > 0 ? "good" : row.value < 0 ? "bad" : "") : ""}>
              {row.signed ? labSignedFixed(row.value, 1) : row.value.toFixed(1)}
            </b>
          </div>
        ))}
        <div className="lab-strength-row total">
          <span>Total</span>
          <b>{breakdown.total.toFixed(1)}</b>
        </div>
      </div>
      <div className="lab-player-ovrs">
        {team.players.map((player) => (
          <span key={player.id} className="lab-player-ovr">
            <em>{player.handle}</em>
            <b>{player.ovr}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function LabProbabilityWaterfall({
  explanation,
  leftTag,
  rightTag,
}: {
  explanation: RoundProbabilityExplanation;
  leftTag: string;
  rightTag: string;
}) {
  const swing = explanation.contributions.filter((entry) => entry.key !== "base");
  const maxAbs = Math.max(0.02, ...swing.map((entry) => Math.abs(entry.value)));
  const steps: Array<{ label: string; value: string; muted?: boolean; strong?: boolean }> = [
    { label: "Sum (pre-clamp)", value: labPct(explanation.base) },
    { label: "Per-round clamp", value: labPct(explanation.baseClamped), muted: explanation.base === explanation.baseClamped },
    { label: "Eco-upset caps", value: labPct(explanation.afterEcoCaps), muted: explanation.afterEcoCaps === explanation.baseClamped },
    { label: "Comeback nudge", value: labSignedPP(explanation.comeback), muted: explanation.comeback === 0 },
    { label: "Final", value: labPct(explanation.final), strong: true },
  ];
  return (
    <div className="lab-waterfall">
      <div className="lab-final">
        <div>
          <span>{leftTag} round win</span>
          <strong className={roundProbTone(explanation.final)}>{labPct(explanation.final)}</strong>
        </div>
        <div className="lab-final-opp">
          <span>{rightTag}</span>
          <strong>{labPct(1 - explanation.final)}</strong>
        </div>
      </div>
      <div className="lab-contributions">
        {explanation.contributions.map((entry) => (
          <div className="lab-contribution" key={entry.key}>
            <span className="lab-contribution-label">{entry.label}</span>
            <div className="lab-bar-track center">
              {entry.key === "base" ? (
                <span className="lab-base-pill">{labPct(entry.value)} start</span>
              ) : (
                <div
                  className={`lab-bar ${entry.value >= 0 ? "pos" : "neg"}`}
                  style={{ width: `${(Math.abs(entry.value) / maxAbs) * 50}%` }}
                />
              )}
            </div>
            <b className={entry.key === "base" ? "muted" : entry.value > 0 ? "good" : entry.value < 0 ? "bad" : "muted"}>
              {entry.key === "base" ? "—" : labSignedPP(entry.value)}
            </b>
          </div>
        ))}
      </div>
      <div className="lab-prob-steps">
        {steps.map((step) => (
          <div className={`lab-step${step.strong ? " strong" : ""}${step.muted ? " muted" : ""}`} key={step.label}>
            <span>{step.label}</span>
            <b>{step.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function LabOvrBreakdown({ player, breakdown }: { player: Player; breakdown: OvrBreakdown }) {
  const max = Math.max(0.001, ...breakdown.contributions.map((entry) => entry.contribution));
  return (
    <div className="lab-ovr">
      <div className="lab-ovr-head">
        <Flag country={player.country} />
        <strong>{player.handle}</strong>
        <em>{player.role}</em>
        <b className="lab-ovr-total">OVR {breakdown.ovr}</b>
      </div>
      <div className="lab-ovr-bars">
        {breakdown.contributions.map((entry) => (
          <div className="lab-ovr-row" key={entry.stat}>
            <span className="lab-ovr-stat">{entry.stat}</span>
            <span className="lab-ovr-rating">{entry.rating}</span>
            <div className="lab-bar-track">
              <div className="lab-bar pos" style={{ width: `${(entry.contribution / max) * 100}%` }} />
            </div>
            <span className="lab-ovr-weight">×{entry.weight.toFixed(2)}</span>
            <b>{entry.contribution.toFixed(1)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// All-time line from the persistent local match database — spans every saved match across all runs.
function PlayerVaultLine({ vault }: { vault: PlayerCareerRecord | undefined }) {
  if (!vault || vault.matches === 0) return null;
  const line = vault.line;
  return (
    <section className="vault-line">
      <div className="vault-label">
        <Database size={15} />
        <span>All-time</span>
        <em>local match database</em>
      </div>
      <div className="vault-tiles">
        <div className="vault-tile">
          <strong>{vault.matches}</strong>
          <span>Maps</span>
        </div>
        <div className="vault-tile">
          <strong className={ratingTone(line.rating)}>{line.rating.toFixed(2)}</strong>
          <span>Rating</span>
        </div>
        <div className="vault-tile">
          <strong>
            {line.kills}–{line.deaths}
          </strong>
          <span>K–D</span>
        </div>
        <div className="vault-tile">
          <strong>{line.adr.toFixed(0)}</strong>
          <span>ADR</span>
        </div>
        <div className="vault-tile">
          <strong>{vault.teamIds.length}</strong>
          <span>{vault.teamIds.length === 1 ? "Team" : "Teams"}</span>
        </div>
      </div>
    </section>
  );
}

// A player's whole-run "career": event-log advanced stats summed across every team they appeared on.
function PlayerCareerPanel({
  player,
  career,
  activeTeam,
  onOpenTeam,
}: {
  player: Player;
  career: PlayerCareer;
  activeTeam: FieldTeam;
  onOpenTeam: (team: FieldTeam) => void;
}) {
  if (career.totalMaps === 0) return null;
  const advanced = career.advanced;
  const openingDiff = advanced ? advanced.openingKills - advanced.openingDeaths : 0;
  const tiles: Array<{ label: string; value: string; tone?: string; title?: string }> = [
    { label: "Maps", value: `${career.totalMaps}` },
    { label: "Rating", value: career.line.rating.toFixed(2), tone: ratingTone(career.line.rating) },
    { label: "K–D", value: `${career.line.kills}–${career.line.deaths}` },
  ];
  if (advanced) {
    tiles.push(
      {
        label: "Open +/–",
        value: fmtDiff(openingDiff),
        tone: openingDiff > 0 ? "good" : openingDiff < 0 ? "bad" : "",
        title: `${advanced.openingKills} opening kills / ${advanced.openingDeaths} opening deaths`,
      },
      { label: "Multi-kills", value: `${advanced.multiKillRounds}`, title: formatMultiKills(advanced.multiKills) },
      { label: "Aces", value: `${advanced.aces}`, tone: advanced.aces > 0 ? "good" : "" },
      {
        label: "Clutches",
        value: `${advanced.clutches.won}-${advanced.clutches.lost}`,
        tone: advanced.clutches.won ? "good" : "",
        title: formatClutches(advanced),
      },
      { label: "Trades", value: `${advanced.tradeKills}`, title: `Avenged ${advanced.tradeKills} teammate deaths` },
      { label: "HS%", value: advanced.kills ? `${Math.round(advanced.headshotPct * 100)}%` : "–" },
    );
  }

  return (
    <section className="player-career-panel">
      <div className="match-insights-head">
        <div className="section-title">
          <Sparkles size={18} />
          <span>Career — this run</span>
        </div>
        <span>
          {career.totalMaps} {career.totalMaps === 1 ? "map" : "maps"}
          {career.stints.length > 1 ? ` · ${career.stints.length} teams` : ""}
          {advanced ? "" : " · advanced stats unavailable"}
        </span>
      </div>
      <div className="career-tile-row">
        {tiles.map((tile) => (
          <div className="career-tile" key={tile.label} title={tile.title}>
            <strong className={tile.tone}>{tile.value}</strong>
            <span>{tile.label}</span>
          </div>
        ))}
      </div>
      {career.stints.length > 1 && (
        <div className="career-stint-row">
          {career.stints.map((stint) => (
            <button
              type="button"
              key={stint.team.id}
              className={`career-stint${stint.team.id === activeTeam.id ? " active" : ""}`}
              style={{ "--crest": stint.team.accent } as React.CSSProperties}
              onClick={() => onOpenTeam(stint.team)}
              title={`${stint.team.name} — ${stint.maps} maps`}
            >
              <TeamLogo team={stint.team} small />
              <b>{stint.team.name}</b>
              <em>
                {stint.maps} {stint.maps === 1 ? "map" : "maps"} · {stint.line.rating.toFixed(2)}
              </em>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function PlayerDetailPage({
  player,
  team,
  results,
  onBack,
  onOpenSeries,
  onOpenTeam,
}: {
  player: Player;
  team: FieldTeam;
  results: SwissResult[];
  onBack: () => void;
  onOpenSeries: (id: string) => void;
  onOpenTeam: (team: FieldTeam) => void;
}) {
  // one row per MAP the player featured in (HLTV-style match history), in chronological order
  const maps = results
    .filter((r) => r.left.id === team.id || r.right.id === team.id)
    .flatMap((r) => {
      const isLeft = r.left.id === team.id;
      const opponent = isLeft ? r.right : r.left;
      return r.maps.map((m) => {
        const line = (isLeft ? m.leftStats : m.rightStats)[player.id];
        return {
          result: r,
          map: m.map,
          line,
          opponent,
          teamScore: isLeft ? m.leftScore : m.rightScore,
          oppScore: isLeft ? m.rightScore : m.leftScore,
          won: m.winnerId === team.id,
        };
      });
    })
    .filter((m) => m.line);

  const total = maps.length;
  // Headline rating = rating of the SUMMED stats (the HLTV career method), so it agrees with the
  // "Career — this run" and all-time panels instead of averaging per-map ratings.
  const aggregateLine = (() => {
    const line = emptyLine();
    maps.forEach((m) => {
      if (m.line) addPlayerLine(line, m.line);
    });
    return line;
  })();
  const avgRating = aggregateLine.rating;
  const mapsWonPct = total ? (maps.filter((m) => m.won).length / total) * 100 : 0;
  const onePlusPct = total ? (maps.filter((m) => m.line.rating >= 1).length / total) * 100 : 0;
  let streak = 0;
  let bestStreak = 0;
  maps.forEach((m) => {
    if (m.line.rating >= 1) { streak += 1; bestStreak = Math.max(bestStreak, streak); } else streak = 0;
  });
  const display = [...maps].reverse(); // most recent first
  const photo = playerPhoto(player.handle);
  const career = useMemo(() => buildPlayerCareer(results, playerVersionKey(player)), [results, player]);
  const vault = useMemo(() => getMatchDb().playerCareer(playerVersionKey(player)), [player]);

  return (
    <main className="layout fullscreen-page">
      <section className="fullscreen-head">
        <div className="player-detail-id">
          {photo && <img className="player-detail-photo" src={photo} alt={player.handle} loading="lazy" />}
          <div>
            <div className="section-title">
              <Target size={18} />
              <span>Player</span>
            </div>
            <h1>
              <Flag country={player.country} /> {player.handle}
            </h1>
            <p>
              {player.realName} / {player.role} /{" "}
              <button type="button" className="inline-link" onClick={() => onOpenTeam(team)}>
                {team.name}
              </button>{" "}
              — match history, {total} {total === 1 ? "map" : "maps"} this major
            </p>
          </div>
        </div>
        <button className="secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
      </section>

      {total > 0 && (
        <section className="player-summary-cards">
          <div>
            <strong className={ratingTone(avgRating)}>{avgRating.toFixed(2)}</strong>
            <span>Rating</span>
          </div>
          <div>
            <strong>{mapsWonPct.toFixed(1)}%</strong>
            <span>Maps won</span>
          </div>
          <div>
            <strong>{onePlusPct.toFixed(1)}%</strong>
            <span>Maps with 1+ rating</span>
          </div>
          <div>
            <strong>{bestStreak}</strong>
            <span>Best 1+ rating streak</span>
          </div>
        </section>
      )}

      <PlayerCareerPanel player={player} career={career} activeTeam={team} onOpenTeam={onOpenTeam} />

      <PlayerVaultLine vault={vault} />

      <section className="full-table-card">
        <div className="full-table-head player-map-grid">
          <span>Date</span>
          <span>Player team</span>
          <span>Opponent</span>
          <span>Map</span>
          <span>K - D</span>
          <span>+/-</span>
          <span>Rating</span>
        </div>
        {display.length ? (
          display.map((m, index) => {
            const newSeries = index === 0 || display[index - 1].result.id !== m.result.id;
            return (
              <button
                type="button"
                className={`full-table-row player-map-grid clickable${newSeries ? " series-start" : ""}`}
                key={`${m.result.id}-${m.map}-${index}`}
                onClick={() => onOpenSeries(m.result.id)}
              >
                <span className="pm-date">{seriesDateLabel(m.result.round)}</span>
                <span className="run-team-cell">
                  <TeamLogo team={team} small />
                  <b>{team.name}</b>
                  <em className="pm-mapscore">({m.teamScore})</em>
                </span>
                <span className="run-team-cell">
                  <TeamLogo team={m.opponent} small />
                  <b>{m.opponent.name}</b>
                  <em className="pm-mapscore">({m.oppScore})</em>
                </span>
                <span className="pm-map">{mapAbbr(m.map)}</span>
                <span>{m.line.kills} - {m.line.deaths}</span>
                <span className={m.line.kills >= m.line.deaths ? "stat-positive" : "stat-negative"}>{signedInteger(m.line.kills - m.line.deaths)}</span>
                <span className={`rating-number ${ratingTone(m.line.rating)}`}>{m.line.rating.toFixed(2)}</span>
              </button>
            );
          })
        ) : (
          <div className="empty-fullscreen">No completed maps for {player.handle} yet.</div>
        )}
      </section>
    </main>
  );
}

function TeamDetailPage({
  team,
  results,
  onBack,
  onOpenSeries,
  onOpenPlayer,
}: {
  team: FieldTeam;
  results: SwissResult[];
  onBack: () => void;
  onOpenSeries: (id: string) => void;
  onOpenPlayer: (player: Player, team: FieldTeam) => void;
}) {
  const games = results.filter((r) => r.left.id === team.id || r.right.id === team.id);
  const wins = games.filter((r) => r.winnerId === team.id).length;
  const played = games.length > 0;

  return (
    <main className="layout fullscreen-page">
      <section className="fullscreen-head">
        <div>
          <div className="section-title">
            <Database size={18} />
            <span>Team</span>
          </div>
          <h1 className="team-detail-title">
            <TeamLogo team={team} small /> {team.name}
          </h1>
          <p>
            {wins}-{games.length - wins} at this major / {games.length} {games.length === 1 ? "series" : "series"} played
          </p>
        </div>
        <button className="secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
      </section>

      <section className="team-profile-grid">
        <div className="team-roster-card">
          <div className="card-subhead">
            <Users size={16} />
            <span>Roster</span>
          </div>
          {team.players.map((player) => (
            <button type="button" className="team-roster-row" key={player.id} onClick={() => onOpenPlayer(player, team)} title={`${player.handle} — per-match stats`}>
              <Flag country={player.country} />
              <b>{player.handle}</b>
              <small>{player.realName}</small>
              <em>{player.role}</em>
              <span className={`team-roster-ovr ${ratingTone(player.ovr / 80)}`}>{player.ovr}</span>
            </button>
          ))}
          {team.coach && (
            <div className="team-roster-row coach">
              <Flag country={team.coach.country} />
              <b>{team.coach.handle}</b>
              <small>{team.coach.realName}</small>
              <em>Coach</em>
              <span />
            </div>
          )}
        </div>

        <div className="team-trophy-card">
          <div className="card-subhead">
            <Trophy size={16} />
            <span>Trophies</span>
          </div>
          {team.trophies?.length ? (
            team.trophies.map((trophy) => (
              <div className="team-trophy-row" key={trophy}>
                <Trophy size={15} />
                <span>{trophy}</span>
              </div>
            ))
          ) : (
            <div className="team-trophy-empty">No major titles on record.</div>
          )}
        </div>
      </section>

      {played ? (
        <section className="team-match-list">
          {[...games].reverse().map((result) => {
            const isLeft = result.left.id === team.id;
            const opponent = isLeft ? result.right : result.left;
            const won = result.winnerId === team.id;
            const single = result.maps.length === 1;
            const teamScore = single ? (isLeft ? result.maps[0].leftScore : result.maps[0].rightScore) : isLeft ? result.leftScore : result.rightScore;
            const oppScore = single ? (isLeft ? result.maps[0].rightScore : result.maps[0].leftScore) : isLeft ? result.rightScore : result.leftScore;
            return (
              <div className="team-match-row" key={result.id}>
                <span className="tm-date">
                  <strong>{seriesDateLabel(result.round)}</strong>
                  <small>{result.label} / BO{result.bestOf}</small>
                </span>
                <span className="tm-team home">
                  <strong>{team.name}</strong>
                  <TeamLogo team={team} small />
                </span>
                <span className="tm-score">
                  <b className={won ? "winner" : ""}>{teamScore}</b>
                  <em>:</em>
                  <b className={!won ? "winner" : ""}>{oppScore}</b>
                </span>
                <span className="tm-team away">
                  <TeamLogo team={opponent} small />
                  <strong>{opponent.name}</strong>
                </span>
                <button type="button" className="tm-match-btn" onClick={() => onOpenSeries(result.id)}>
                  Match
                </button>
              </div>
            );
          })}
        </section>
      ) : (
        <div className="empty-fullscreen">No completed series for {team.name} yet.</div>
      )}
    </main>
  );
}

function RunResultsPage({
  results,
  selectedResultId,
  onOpen,
  onBack,
}: {
  results: SwissResult[];
  selectedResultId?: string;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <main className="layout fullscreen-page">
      <section className="fullscreen-head">
        <div>
          <div className="section-title">
            <Database size={18} />
            <span>Previous results</span>
          </div>
          <h1>Series archive</h1>
          <p>{results.length ? `${results.length} completed series saved for this run.` : "Completed series will be stored here."}</p>
        </div>
        <button className="secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
      </section>

      <section className="results-grid-full">
        {results.length ? (
          [...results].reverse().map((result) => (
            <button
              className={selectedResultId === result.id ? "series-result-card selected" : "series-result-card"}
              key={result.id}
              onClick={() => onOpen(result.id)}
            >
              <span className="series-stage-pill">{result.label} / BO{result.bestOf}</span>
              <div className="series-card-score">
                <div>
                  <TeamLogo team={result.left} small />
                  <strong>{result.left.name}</strong>
                </div>
                <b>
                  <span className={result.winnerId === result.left.id ? "winner" : ""}>
                    {result.maps.length === 1 ? result.maps[0].leftScore : result.leftScore}
                  </span>
                  <em>:</em>
                  <span className={result.winnerId === result.right.id ? "winner" : ""}>
                    {result.maps.length === 1 ? result.maps[0].rightScore : result.rightScore}
                  </span>
                </b>
                <div>
                  <TeamLogo team={result.right} small />
                  <strong>{result.right.name}</strong>
                </div>
              </div>
              <div className="series-map-pills">
                {result.maps.map((map, index) => (
                  <span key={`${result.id}-${map.map}-${index}`}>
                    {mapName(map.map)} {map.leftScore}:{map.rightScore}
                  </span>
                ))}
              </div>
              <small>{result.winnerId === result.left.id ? result.left.name : result.right.name} won{result.played ? " / your match" : ""}</small>
            </button>
          ))
        ) : (
          <div className="empty-fullscreen">No previous results yet. Finish a series and it will appear here.</div>
        )}
      </section>
    </main>
  );
}

function SeriesDetailPage({
  result,
  onBack,
  onBackToRun,
  onOpenPlayer,
  onOpenTeam,
}: {
  result?: SwissResult;
  onBack: () => void;
  onBackToRun: () => void;
  onOpenPlayer: (player: Player, team: FieldTeam) => void;
  onOpenTeam: (team: FieldTeam) => void;
}) {
  if (!result) {
    return (
      <main className="layout fullscreen-page">
        <section className="fullscreen-head">
          <div>
            <div className="section-title">
              <Database size={18} />
              <span>Series details</span>
            </div>
            <h1>No series selected</h1>
            <p>Open a completed result to inspect its maps and player stats.</p>
          </div>
          <button className="secondary" onClick={onBackToRun}>
            <ArrowLeft size={16} />
            Back to run
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="layout fullscreen-page series-detail-page">
      <section className="fullscreen-head">
        <div>
          <div className="section-title">
            <Database size={18} />
            <span>Series details</span>
          </div>
          <h1>{result.label}</h1>
          <p>BO{result.bestOf} / {result.played ? "Your series" : "Simmed series"}</p>
        </div>
        <div className="fullscreen-actions">
          <button className="secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
          <button className="secondary" onClick={onBackToRun}>
            Back to run
          </button>
        </div>
      </section>

      <section className="series-detail-hero">
        <button type="button" className="series-detail-team link-team" style={{ "--crest": result.left.accent } as React.CSSProperties} onClick={() => onOpenTeam(result.left)} title={`${result.left.name} — team profile`}>
          <TeamLogo team={result.left} />
          <strong>{result.left.name}</strong>
          <span>{result.left.country} / {result.left.year}</span>
        </button>
        <div className="series-detail-score">
          <strong>
            <span className={result.winnerId === result.left.id ? "winner" : ""}>
              {result.maps.length === 1 ? result.maps[0].leftScore : result.leftScore}
            </span>
            <em>:</em>
            <span className={result.winnerId === result.right.id ? "winner" : ""}>
              {result.maps.length === 1 ? result.maps[0].rightScore : result.rightScore}
            </span>
          </strong>
          <small>{result.label}</small>
        </div>
        <button type="button" className="series-detail-team right link-team" style={{ "--crest": result.right.accent } as React.CSSProperties} onClick={() => onOpenTeam(result.right)} title={`${result.right.name} — team profile`}>
          <TeamLogo team={result.right} />
          <strong>{result.right.name}</strong>
          <span>{result.right.country} / {result.right.year}</span>
        </button>
      </section>

      <section className="series-map-summary">
        {result.maps.map((map, index) => (
          <span key={`${result.id}-detail-${map.map}-${index}`}>
            <b>{mapName(map.map)}</b>
            {map.leftScore}:{map.rightScore}
            {map.eventLog && <small>{map.eventLog.events.length} events</small>}
          </span>
        ))}
      </section>

      <MatchStatsPanel
        maps={result.maps.map((map) => map.map)}
        mapResults={result.maps}
        teams={[
          { team: result.left, players: result.left.players, stats: result.leftStats, side: "left" },
          { team: result.right, players: result.right.players, stats: result.rightStats, side: "right" },
        ]}
        onOpenPlayer={onOpenPlayer}
        onOpenTeam={onOpenTeam}
      />

      <MatchInsightsPanel left={result.left} right={result.right} mapResults={result.maps} />

      <MatchLineups
        teams={[
          { team: result.left, players: result.left.players },
          { team: result.right, players: result.right.players },
        ]}
      />

      <RoundTimelinePanel
        title="Round timeline"
        label={`${result.maps.length} map${result.maps.length === 1 ? "" : "s"} played`}
        left={result.left}
        right={result.right}
        maps={result.maps.map((map, index) => roundTimelineMapFromResult(map, index))}
      />

      <SeriesRoundReplayPanel left={result.left} right={result.right} maps={result.maps} />
    </main>
  );
}

function TeamStatsBlock({
  team,
  players,
  stats,
  onOpenPlayer,
  onOpenTeam,
}: {
  team: FieldTeam;
  players: Player[];
  stats: MatchState["yourStats"];
  onOpenPlayer?: (player: Player, team: FieldTeam) => void;
  onOpenTeam?: (team: FieldTeam) => void;
}) {
  const rows = statRows(players, stats, true);
  return (
    <section className="team-stats-block" style={{ "--crest": team.accent } as React.CSSProperties}>
      <div className="team-stats-grid team-stats-head">
        {onOpenTeam ? (
          <button type="button" className="team-stats-title link-team" onClick={() => onOpenTeam(team)} title={`${team.name} — team profile`}>
            <TeamLogo team={team} small />
            <strong>{team.name}</strong>
          </button>
        ) : (
          <div className="team-stats-title">
            <TeamLogo team={team} small />
            <strong>{team.name}</strong>
          </div>
        )}
        <b>K-D</b>
        <b>Swing</b>
        <b>ADR</b>
        <b>KAST</b>
        <b>Impact</b>
        <b>FK-FD</b>
        <b>2K+</b>
        <b>
          Rating
          <span>3.0</span>
        </b>
      </div>
      {rows.map(({ player, line, kast, swing }) => {
        const RowTag = onOpenPlayer ? "button" : "div";
        return (
        <RowTag
          className={`team-stats-grid team-stats-row${onOpenPlayer ? " clickable" : ""}`}
          key={player.id}
          {...(onOpenPlayer ? { type: "button" as const, onClick: () => onOpenPlayer(player, team), title: `${player.handle} — match history` } : {})}
        >
          <div className="stats-player">
            <Flag country={player.country} />
            <span className="country-code">{player.country}</span>
            <span className="player-name">
              <span className="player-real">{player.realName}</span> <b>{player.handle}</b>
            </span>
          </div>
          <span data-label="K-D">{line.kills}-{line.deaths}</span>
          <span data-label="Swing" className={`swing-cell ${swingTone(swing)}`}>{formatSignedPercent(swing)}</span>
          <span data-label="ADR">{line.adr.toFixed(1)}</span>
          <span data-label="KAST">{kast.toFixed(1)}%</span>
          <span data-label="Impact">{line.impact.toFixed(2)}</span>
          <span data-label="FK-FD">{line.firstKills}-{line.firstDeaths}</span>
          <span data-label="2K+">{line.multiKills}</span>
          <span data-label="Rating" className={`rating-number ${ratingTone(line.rating)}`}>{line.rating.toFixed(2)}</span>
        </RowTag>
        );
      })}
    </section>
  );
}

function StatsTable({
  title,
  players,
  stats,
  money,
  weapons,
  armor,
  sort = true,
}: {
  title: string;
  players: Player[];
  stats: MatchState["yourStats"];
  money?: Record<string, number>;
  weapons?: Record<string, string>;
  armor?: Record<string, "none" | "kevlar" | "helmet">;
  sort?: boolean;
}) {
  const rows = statRows(players, stats, sort);

  return (
    <section className="stats-table">
      <div className="section-title">
        <Target size={18} />
        <span>{title}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            {weapons && <th>Weapon</th>}
            {money && <th>Money</th>}
            <th>K-D-A</th>
            <th>ADR</th>
            <th>KAST</th>
            <th>IMP</th>
            <th>Rating</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ player, line, kast }) => {
            const playerMoney = money ? (money[player.id] ?? 0) : 0;
            const playerWeapon = weapons ? (weapons[player.id] ?? "") : "";
            const weaponSrc = weaponIcons[playerWeapon];
            return (
              <tr key={player.id}>
                <td className="stats-player-cell">
                  <div className="stats-player-identity">
                    <Flag country={player.country} />
                    <strong>{player.handle}</strong>
                    <span className="player-ovr-tag">{player.ovr}</span>
                  </div>
                  <span>{player.role}</span>
                </td>
                {weapons && (
                  <td className="weapon-cell">
                    <div className="weapon-cell-content">
                      {weaponSrc ? (
                        <img className="weapon-icon-img" src={weaponSrc} alt={playerWeapon} title={playerWeapon} />
                      ) : (
                        <span>{playerWeapon || "-"}</span>
                      )}
                      {armor && armor[player.id] && armor[player.id] !== "none" && (
                        <span className="armor-badge" title={armor[player.id] === "helmet" ? "Kevlar + Helmet" : "Kevlar Vest"}>
                          {armor[player.id] === "helmet" ? "🛡️🪖" : "🛡️"}
                        </span>
                      )}
                    </div>
                  </td>
                )}
                {money && <td className="money-cell">${playerMoney.toLocaleString()}</td>}
                <td>{line.kills}-{line.deaths}-{line.assists}</td>
                <td>{line.adr.toFixed(0)}</td>
                <td>{kast.toFixed(0)}%</td>
                <td>{line.impact.toFixed(2)}</td>
                <td className={`rating-cell ${ratingTone(line.rating)}`}>{line.rating.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function ratingTone(rating: number) {
  if (rating < 0.9) return "bad";
  if (rating > 1.06) return "good";
  return "neutral";
}

function statRows(players: Player[], stats: MatchState["yourStats"], sort = true) {
  const rows = players.map((player) => {
    const line = stats[player.id] ?? {
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
    const kast = line.rounds ? (line.kastRounds / line.rounds) * 100 : 0;
    return { player, line, kast };
  });
  const teamAverageContribution = rows.length
    ? rows.reduce((sum, row) => sum + roundContribution(row.line), 0) / rows.length
    : 0;
  
  const mapped = rows.map((row) => ({ ...row, swing: roundSwing(row.line, teamAverageContribution) }));
  
  if (!sort) return mapped;
  
  return mapped.sort((a, b) => b.line.rating - a.line.rating || b.line.kills - a.line.kills || a.player.handle.localeCompare(b.player.handle));
}

function roundContribution(line: MatchState["yourStats"][string]) {
  const rounds = Math.max(1, line.rounds);
  return (
    line.kills +
    line.assists * 0.35 +
    line.firstKills * 0.45 +
    line.multiKills * 0.25 +
    line.clutchWins * 0.55 -
    line.firstDeaths * 0.25
  ) / rounds;
}

function roundSwing(line: MatchState["yourStats"][string], teamAverageContribution: number) {
  const value = (roundContribution(line) - teamAverageContribution) * 8;
  return Number(Math.max(-6, Math.min(6, value)).toFixed(2));
}

function swingTone(value: number) {
  if (value > 1) return "good";
  if (value < -1) return "bad";
  return "neutral";
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function SettingsDrawer({
  settings,
  setSettings,
  onClose,
}: {
  settings: CustomSettings;
  setSettings: React.Dispatch<React.SetStateAction<CustomSettings>>;
  onClose: () => void;
}) {
  const update = <K extends keyof CustomSettings>(key: K, value: CustomSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="settings-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="section-title">
          <Settings2 size={18} />
          <span>Customize</span>
        </div>
        <label>
          Brand
          <input value={settings.brand} onChange={(event) => update("brand", event.target.value)} />
        </label>
        <label>
          Accent
          <input type="color" value={settings.accent} onChange={(event) => update("accent", event.target.value)} />
        </label>
        <Range label="Draft rerolls" value={settings.draftRolls} min={0} max={4} step={1} onChange={(value) => update("draftRolls", value)} />
        <Range label="Role penalty" value={settings.rolePenalty} min={2} max={10} step={1} onChange={(value) => update("rolePenalty", value)} />
        <Range label="Map weight" value={settings.mapWeight} min={0.4} max={1.8} step={0.1} onChange={(value) => update("mapWeight", value)} />
        <Range label="Luck" value={settings.luck} min={0.05} max={0.8} step={0.05} onChange={(value) => update("luck", value)} />
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.tacticalPauses}
            onChange={(event) => update("tacticalPauses", event.target.checked)}
          />
          Tactical pauses
        </label>
        <button className="primary" onClick={onClose}>
          <CheckCircle2 size={17} />
          Done
        </button>
      </aside>
    </div>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="range-label">
        {label}
        <b>{value}</b>
      </span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function buildSwissLaneData(user: FieldTeam, field: FieldTeam[], record: SwissRecord, opponent: FieldTeam, records: Record<string, SwissRecord>) {
  const lanes: Record<string, FieldTeam[]> = {
    "0:0": [],
    "1:0": [],
    "0:1": [],
    "2:0": [],
    "1:1": [],
    "0:2": [],
    "2:1": [],
    "1:2": [],
    "2:2": [],
    qualified: [],
    eliminated: [],
  };

  const add = (key: string, team: FieldTeam) => {
    lanes[key] = [...(lanes[key] ?? []), team];
  };

  const userKey = record.wins >= 3 ? "qualified" : record.losses >= 3 ? "eliminated" : `${record.wins}:${record.losses}`;
  add(userKey, user);

  field.forEach((team) => {
    if (team.id === opponent.id && record.wins < 3 && record.losses < 3) {
      add(`${record.wins}:${record.losses}`, team);
      return;
    }
    const teamRecord = records[team.id] ?? { wins: 0, losses: 0 };
    const key = teamRecord.wins >= 3 ? "qualified" : teamRecord.losses >= 3 ? "eliminated" : `${teamRecord.wins}:${teamRecord.losses}`;
    add(key, team);
  });

  return lanes;
}

function buildNeutralSwissLaneData(field: FieldTeam[], records: Record<string, SwissRecord>) {
  const lanes: Record<string, FieldTeam[]> = {
    "0:0": [],
    "1:0": [],
    "0:1": [],
    "2:0": [],
    "1:1": [],
    "0:2": [],
    "2:1": [],
    "1:2": [],
    "2:2": [],
    qualified: [],
    eliminated: [],
  };

  field.forEach((team) => {
    const teamRecord = records[team.id] ?? { wins: 0, losses: 0 };
    const key = teamRecord.wins >= 3 ? "qualified" : teamRecord.losses >= 3 ? "eliminated" : `${teamRecord.wins}:${teamRecord.losses}`;
    lanes[key] = [...(lanes[key] ?? []), team];
  });

  return lanes;
}

function swissLaneResults(results: SwissResult[]): SwissLaneResult[] {
  return results
    .filter((result) => result.stage === "swiss")
    .map((result) => ({ result, laneKey: result.laneKey ?? inferSwissLaneKey(result) }))
    .filter((item) => Boolean(item.laneKey));
}

function inferSwissLaneKey(result: SwissResult) {
  const direct = result.pairId.match(/^(\d)-(\d)-/);
  if (direct) return `${direct[1]}:${direct[2]}`;
  const simulated = result.pairId.match(/^swiss-sim-\d+-(\d)-(\d)-/);
  if (simulated) return `${simulated[1]}:${simulated[2]}`;
  return "";
}

function syntheticSwissRecord(team: FieldTeam, index: number, completedRounds: number): SwissRecord {
  if (completedRounds <= 0) return { wins: 0, losses: 0 };
  const strength = averageOvr(team.players);
  const powerBias = strength >= 89 ? 1 : strength >= 86 ? 0.45 : strength >= 83 ? 0 : -0.55;
  const seedBias = ((index % 3) - 1) * 0.35;
  const wins = clampWhole(Math.round(completedRounds / 2 + powerBias + seedBias), 0, completedRounds);
  return { wins, losses: completedRounds - wins };
}

function projectedRecordLabel(team: FieldTeam, completedRounds: number) {
  if (completedRounds <= 0) return "0-0";
  const synthetic = syntheticSwissRecord(team, Math.abs(hashText(team.id)) % 5, completedRounds);
  return `${synthetic.wins}-${synthetic.losses}`;
}

function hashText(value: string) {
  return value.split("").reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7);
}

function coachForRoster(roster: Roster) {
  if (!roster.id.startsWith("hltv-")) return undefined;
  const teamId = roster.id.replace(/^hltv-/, "").replace(/-2026-06-08$/, "");
  return hltvTop20Coaches.find((coach) => coach.id === `hltv-coach-${teamId}`);
}

function toTournamentTeam(roster: Roster): FieldTeam {
  return {
    ...toFieldTeam(roster),
    coach: coachForRoster(roster),
  };
}

function buildSwissField(rosterPool: Roster[]) {
  return shuffle(rosterPool).slice(0, SWISS_OPPONENT_COUNT).map(toTournamentTeam);
}

function buildSpectatorField(rosterPool: Roster[]) {
  return shuffle(rosterPool).slice(0, SWISS_FIELD_SIZE).map(toTournamentTeam);
}

// Opponent history for the Swiss stage: teamId -> set of opponent ids it has already faced. Used to
// prevent rematches, which a CS Major Swiss (Buchholz) never produces — two teams only meet again in
// the playoff bracket. Only swiss-stage results count.
function buildSwissHistory(results: SwissResult[]): Map<string, Set<string>> {
  const history = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    const set = history.get(a) ?? new Set<string>();
    set.add(b);
    history.set(a, set);
  };
  results.forEach((result) => {
    if (result.stage !== "swiss") return;
    add(result.left.id, result.right.id);
    add(result.right.id, result.left.id);
  });
  return history;
}

// Pair a (seed-sorted) record group with NO repeat opponents. Pairs high seed vs low seed and
// backtracks whenever a rematch blocks a slot; only if no rematch-free matching exists at all (very
// rare) does it fall back to plain adjacency. Odd groups float one team down to the next record group.
function pairWithoutRematch(teams: FieldTeam[], history: Map<string, Set<string>>): { pairs: [FieldTeam, FieldTeam][]; leftover: FieldTeam[] } {
  const played = (a: FieldTeam, b: FieldTeam) => history.get(a.id)?.has(b.id) ?? false;
  const solve = (rem: FieldTeam[]): [FieldTeam, FieldTeam][] | null => {
    if (rem.length === 0) return [];
    const [a, ...rest] = rem;
    for (let i = rest.length - 1; i >= 0; i -= 1) {
      if (played(a, rest[i])) continue;
      const sub = solve([...rest.slice(0, i), ...rest.slice(i + 1)]);
      if (sub) return [[a, rest[i]], ...sub];
    }
    return null;
  };
  if (teams.length % 2 === 0) {
    const matched = solve(teams);
    if (matched) return { pairs: matched, leftover: [] };
  } else {
    for (let f = teams.length - 1; f >= 0; f -= 1) {
      const matched = solve([...teams.slice(0, f), ...teams.slice(f + 1)]);
      if (matched) return { pairs: matched, leftover: [teams[f]] };
    }
  }
  const pairs: [FieldTeam, FieldTeam][] = [];
  const even = teams.length - (teams.length % 2);
  for (let i = 0; i < even; i += 2) pairs.push([teams[i], teams[i + 1]]);
  return { pairs, leftover: teams.length % 2 ? [teams[teams.length - 1]] : [] };
}

// Group a seed-sorted pool by record, pair each group without rematches, then pair any odd-group
// floats together (also rematch-free). The shared core of both swiss pairing builders.
function pairPoolNoRematch(pool: FieldTeam[], records: Record<string, SwissRecord>, history: Map<string, Set<string>>, makeId: (a: FieldTeam, b: FieldTeam, key: string) => string): SwissPair[] {
  const groups: Record<string, FieldTeam[]> = {};
  pool.forEach((team) => {
    const key = recordKey(records[team.id] ?? { wins: 0, losses: 0 });
    groups[key] = [...(groups[key] ?? []), team];
  });
  const laneKeys = Object.keys(groups).sort((a, b) => {
    const [aWins, aLosses] = a.split("-").map(Number);
    const [bWins, bLosses] = b.split("-").map(Number);
    return bWins - aWins || aLosses - bLosses;
  });
  const pairs: SwissPair[] = [];
  const floats: FieldTeam[] = [];
  laneKeys.forEach((key) => {
    const { pairs: groupPairs, leftover } = pairWithoutRematch(groups[key], history);
    groupPairs.forEach(([left, right]) => pairs.push({ id: makeId(left, right, key), left, right }));
    floats.push(...leftover);
  });
  const { pairs: floatPairs } = pairWithoutRematch(floats, history);
  floatPairs.forEach(([left, right]) => pairs.push({ id: makeId(left, right, "float"), left, right }));
  return pairs;
}

function buildSwissPairs(
  user: FieldTeam,
  opponent: FieldTeam,
  field: FieldTeam[],
  record: SwissRecord,
  records: Record<string, SwissRecord>,
  history: Map<string, Set<string>>,
): SwissPair[] {
  // the user's match is fixed (opponent already chosen rematch-free); pair everyone else rematch-free.
  const pool = swissPairPool(field.filter((team) => team.id !== opponent.id), records);
  const others = pairPoolNoRematch(pool, records, history, (a, b, key) => `${record.wins}-${record.losses}-${key}-${a.id}-${b.id}`);
  return [{ id: `${record.wins}-${record.losses}-user`, left: user, right: opponent, active: true }, ...others];
}

function buildRemainingSwissPairs(field: FieldTeam[], records: Record<string, SwissRecord>, round: number, history: Map<string, Set<string>>) {
  const pool = swissPairPool(field, records);
  return pairPoolNoRematch(pool, records, history, (a, b, key) => `swiss-sim-${round}-${key}-${a.id}-${b.id}`);
}

function isSwissStageResolved(field: FieldTeam[], records: Record<string, SwissRecord>, userRecord: SwissRecord) {
  const userQualified = userRecord.wins >= 3 ? 1 : 0;
  const qualifiedTeams = field.filter((team) => {
    const teamRecord = records[team.id] ?? { wins: 0, losses: 0 };
    return teamRecord.wins >= 3;
  }).length;
  const liveTeams = field.filter((team) => {
    const teamRecord = records[team.id] ?? { wins: 0, losses: 0 };
    return teamRecord.wins < 3 && teamRecord.losses < 3;
  }).length;
  return userQualified + qualifiedTeams >= SWISS_FIELD_SIZE / 2 || liveTeams === 0;
}

function isNeutralSwissStageResolved(field: FieldTeam[], records: Record<string, SwissRecord>) {
  const qualifiedTeams = field.filter((team) => {
    const teamRecord = records[team.id] ?? { wins: 0, losses: 0 };
    return teamRecord.wins >= 3;
  }).length;
  const liveTeams = field.filter((team) => {
    const teamRecord = records[team.id] ?? { wins: 0, losses: 0 };
    return teamRecord.wins < 3 && teamRecord.losses < 3;
  }).length;
  return qualifiedTeams >= SWISS_FIELD_SIZE / 2 || liveTeams === 0;
}

function initialSwissRecords(field: FieldTeam[]) {
  return field.reduce(
    (acc, team) => {
      acc[team.id] = { wins: 0, losses: 0 };
      return acc;
    },
    {} as Record<string, SwissRecord>,
  );
}

function swissPairPool(field: FieldTeam[], records: Record<string, SwissRecord>) {
  const active = field.filter((team) => {
    const teamRecord = records[team.id] ?? { wins: 0, losses: 0 };
    return teamRecord.wins < 3 && teamRecord.losses < 3;
  });
  const order = new Map(active.map((team, index) => [team.id, index]));
  return [...active].sort((a, b) => {
    const aRecord = records[a.id] ?? { wins: 0, losses: 0 };
    const bRecord = records[b.id] ?? { wins: 0, losses: 0 };
    return bRecord.wins - aRecord.wins || aRecord.losses - bRecord.losses || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });
}

function selectOpponentForRecord(
  record: SwissRecord,
  field: FieldTeam[],
  records: Record<string, SwissRecord>,
  playedOpponentIds: string[],
) {
  const active = field.filter((team) => {
    const teamRecord = records[team.id] ?? { wins: 0, losses: 0 };
    return teamRecord.wins < 3 && teamRecord.losses < 3;
  });
  const sameLane = active.filter((team) => {
    const teamRecord = records[team.id] ?? { wins: 0, losses: 0 };
    return teamRecord.wins === record.wins && teamRecord.losses === record.losses;
  });
  const freshLane = sameLane.filter((team) => !playedOpponentIds.includes(team.id));
  const pool = freshLane.length ? freshLane : sameLane.length ? sameLane : active.filter((team) => !playedOpponentIds.includes(team.id));
  return randomItem(pool.length ? pool : active) ?? field[0];
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function randomItem<T>(items: T[]) {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function swissBestOf(record: SwissRecord) {
  return record.wins === 2 || record.losses === 2 ? 3 : 1;
}

function swissPairBestOf(pair: SwissPair, records: Record<string, SwissRecord>) {
  const leftRecord = pair.left.id === "user" ? undefined : records[pair.left.id];
  const rightRecord = pair.right.id === "user" ? undefined : records[pair.right.id];
  return [leftRecord, rightRecord].some((item) => item && (item.wins === 2 || item.losses === 2)) ? 3 : 1;
}

function playoffBestOf(round: PlayoffRound) {
  return round === "final" ? 5 : 3;
}

function playoffRoundLabel(round: PlayoffRound) {
  if (round === "quarterfinal") return "Quarterfinal";
  if (round === "semifinal") return "Semifinal";
  return "Grand final";
}

function playoffRoundNumber(round: PlayoffRound) {
  return round === "quarterfinal" ? 6 : round === "semifinal" ? 7 : 8;
}

// Plausible per-round calendar for a Major: Swiss rounds 1-5 over Jun 11-15 2026, then playoffs
// (QF/SF/Final) Jun 17-19, with the final landing on the current in-app date. round is 1-5 for Swiss
// and 6/7/8 for the playoff rounds (playoffRoundNumber).
function seriesDateLabel(round: number): string {
  const day = round <= 5 ? 10 + round : round === 6 ? 17 : round === 7 ? 18 : 19;
  const date = new Date(2026, 5, day); // June 2026
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear().toString().slice(2)}`;
}

// Short map tag (HLTV-style) for the player match-history table.
function mapAbbr(map: MapId): string {
  const abbr: Partial<Record<MapId, string>> = { mirage: "mrg", inferno: "inf", nuke: "nuke", dust2: "d2", train: "trn", ancient: "anc", anubis: "anb" };
  return abbr[map] ?? map;
}

function buildSeriesMaps(openingMap: MapId | undefined, you: FieldTeam, opponent: FieldTeam, bestOf: number, settings: CustomSettings) {
  const opener = openingMap ?? randomItem(mapPool)?.id ?? "mirage";
  const rest = mapPool
    .map((map) => map.id)
    .filter((map) => map !== opener)
    .sort((a, b) => Math.abs(mapEdge(you, opponent, b, settings)) - Math.abs(mapEdge(you, opponent, a, settings)));
  return [opener, ...rest].slice(0, bestOf);
}

function seriesIsDone(series: ActiveSeries) {
  const needed = Math.ceil(series.bestOf / 2);
  const wins = seriesMapWins(series.mapResults, series.left.id);
  const losses = seriesMapWins(series.mapResults, series.right.id);
  return wins >= needed || losses >= needed || series.mapResults.length >= series.bestOf;
}

function seriesMapWins(results: SeriesMapResult[], teamId: string) {
  return results.filter((result) => result.winnerId === teamId).length;
}

function mapRecordForTeam(results: SwissResult[], teamId: string, mapId: MapId): SwissRecord {
  return results.reduce(
    (record, result) => {
      const teamPlayedSeries = result.left.id === teamId || result.right.id === teamId;
      if (!teamPlayedSeries) return record;

      result.maps.forEach((mapResult) => {
        if (mapResult.map !== mapId) return;
        if (mapResult.winnerId === teamId) {
          record.wins += 1;
        } else {
          record.losses += 1;
        }
      });

      return record;
    },
    { wins: 0, losses: 0 },
  );
}

function formatMapRecord(record: SwissRecord) {
  return `${record.wins}-${record.losses}`;
}

function mapRecordTone(record: SwissRecord) {
  if (record.wins > record.losses) return "winning";
  if (record.losses > record.wins) return "losing";
  return "neutral";
}

function seriesMapScore(series: ActiveSeries) {
  return `${seriesMapWins(series.mapResults, series.left.id)}-${seriesMapWins(series.mapResults, series.right.id)}`;
}

function seriesMapScoreAfterCurrent(series: ActiveSeries, match: MatchState) {
  const next = [...series.mapResults, mapResultFromState(match.map, match, series.left, series.right)];
  return `${seriesMapWins(next, series.left.id)}-${seriesMapWins(next, series.right.id)}`;
}

function resolveAutoSimMatch(state: MatchState, left: FieldTeam, right: FieldTeam, settings: CustomSettings): MatchState {
  if (state.ended && state.you !== state.opponent) return state;

  const currentLeader: "you" | "opponent" | undefined = state.you === state.opponent ? undefined : state.you > state.opponent ? "you" : "opponent";
  const forcedWinner = currentLeader ?? (teamStrength(left, settings) >= teamStrength(right, settings) ? "you" : "opponent");
  const winnerScore = forcedWinner === "you" ? state.you : state.opponent;
  const loserScore = forcedWinner === "you" ? state.opponent : state.you;
  const legalWinnerScore = Math.max(winnerScore, loserScore + 2, autoSimWinThreshold(state.round));
  const addedRounds = Math.max(0, legalWinnerScore - winnerScore);
  const forcedRounds = Array.from({ length: addedRounds }, () => forcedWinner) as MatchState["roundWinners"];

  return {
    ...state,
    round: state.round + addedRounds,
    you: forcedWinner === "you" ? legalWinnerScore : loserScore,
    opponent: forcedWinner === "opponent" ? legalWinnerScore : loserScore,
    roundWinners: [...state.roundWinners, ...forcedRounds],
    running: false,
    ended: true,
    winner: forcedWinner,
    lastReason: "Extended overtime resolved after the auto-sim safety limit.",
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
  };
}

function autoSimWinThreshold(round: number) {
  if (round < 25) return 13;
  return 13 + (Math.floor((round - 25) / 6) + 1) * 3;
}

function mapResultFromState(map: MapId, state: MatchState, left: FieldTeam, right: FieldTeam): SeriesMapResult {
  return {
    map,
    leftScore: state.you,
    rightScore: state.opponent,
    winnerId: state.winner === "you" ? left.id : state.winner === "opponent" ? right.id : state.you >= state.opponent ? left.id : right.id,
    eventLog: eventLogFromMatchState(map, state),
    roundWinners: state.roundWinners.map((winner) => (winner === "you" ? "left" : "right")),
    leftStats: state.yourStats,
    rightStats: state.opponentStats,
    leftSideStats: state.yourSideStats,
    rightSideStats: state.opponentSideStats,
  };
}

function seriesResultFromMaps(series: ActiveSeries, played: boolean): SwissResult {
  const leftScore = seriesMapWins(series.mapResults, series.left.id);
  const rightScore = seriesMapWins(series.mapResults, series.right.id);
  return {
    id: `${series.round}-${series.pairId}`,
    pairId: series.pairId,
    round: series.round,
    stage: series.stage,
    laneKey: series.laneKey,
    label: series.label,
    bestOf: series.bestOf,
    left: series.left,
    right: series.right,
    leftScore,
    rightScore,
    winnerId: leftScore >= rightScore ? series.left.id : series.right.id,
    maps: series.mapResults,
    leftStats: aggregateSeriesStats(series.left, series.mapResults, "left"),
    rightStats: aggregateSeriesStats(series.right, series.mapResults, "right"),
    played,
  };
}

function simulateSwissSeries(
  pair: SwissPair,
  round: number,
  settings: CustomSettings,
  difficulty: Difficulty,
  records: Record<string, SwissRecord>,
) {
  const bestOf = swissPairBestOf(pair, records);
  const result = simulateSeries(pair, round, "swiss", `Swiss round ${round}`, bestOf, settings, difficulty);
  result.laneKey = laneKeyForRecord(records[pair.left.id] ?? { wins: 0, losses: 0 });
  return result;
}

function simulatePlayoffSeries(pair: SwissPair, round: PlayoffRound, settings: CustomSettings, difficulty: Difficulty) {
  return simulateSeries(pair, playoffRoundNumber(round), round, playoffRoundLabel(round), playoffBestOf(round), settings, difficulty);
}

function simulateSeries(
  pair: SwissPair,
  round: number,
  stage: SeriesStage,
  label: string,
  bestOf: number,
  settings: CustomSettings,
  difficulty: Difficulty,
) {
  const maps = buildSeriesMaps(undefined, pair.left, pair.right, bestOf, settings);
  const neutralDifficulty = { ...difficulty, opponentBonus: 0 };
  const activeSeries: ActiveSeries = {
    id: `${round}-${pair.id}`,
    pairId: pair.id,
    round,
    stage,
    label,
    bestOf,
    maps,
    currentMapIndex: 0,
    left: pair.left,
    right: pair.right,
    mapResults: [],
  };
  for (const map of maps) {
    let state = initMatch(map, pair.left, pair.right, { stage });
    let guard = 0;
    while (!state.ended && guard < AUTO_SIM_ROUND_LIMIT) {
      state = playRound(state, pair.left, pair.right, settings, neutralDifficulty, "standard", 0, true);
      guard += 1;
    }
    state = resolveAutoSimMatch(state, pair.left, pair.right, settings);
    activeSeries.mapResults.push(mapResultFromState(map, state, pair.left, pair.right));
    if (seriesIsDone(activeSeries)) break;
    activeSeries.currentMapIndex += 1;
  }
  return seriesResultFromMaps(activeSeries, false);
}

function applyResultsToSwissRecords(records: Record<string, SwissRecord>, results: SwissResult[]) {
  return results.reduce(
    (acc, result) => {
      applyTeamResult(acc, result.left.id, result.winnerId === result.left.id);
      applyTeamResult(acc, result.right.id, result.winnerId === result.right.id);
      return acc;
    },
    { ...records },
  );
}

function applyTeamResult(records: Record<string, SwissRecord>, teamId: string, won: boolean) {
  if (teamId === "user") return;
  const current = records[teamId] ?? { wins: 0, losses: 0 };
  records[teamId] = {
    wins: current.wins + (won ? 1 : 0),
    losses: current.losses + (won ? 0 : 1),
  };
}

function latestResultForPair(results: SwissResult[], pairId: string) {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    if (results[index].pairId === pairId) return results[index];
  }
  return undefined;
}

interface CareerTeamStint {
  team: FieldTeam;
  maps: number;
  line: MatchState["yourStats"][string];
}

interface PlayerCareer {
  advanced: PlayerAnalytics | null; // event-log stats summed across every appearance
  stints: CareerTeamStint[]; // one per team the player turned out for this run
  totalMaps: number;
  line: MatchState["yourStats"][string]; // PlayerLine summed across all stints
}

// Aggregate one player VERSION's whole run by identity, not by team — so a pro drafted onto your
// roster and the same-era pro on their real HLTV team fold into one career line, while a different
// era of that player (e.g. FalleN 2018 vs 2026) stays a separate career.
function buildPlayerCareer(results: SwissResult[], versionKey: string): PlayerCareer {
  const logs: MatchEventLog[] = [];
  const idToPlayer = new Map<string, Player>();
  const stintByTeam = new Map<string, CareerTeamStint>();
  const line = emptyLine();

  results.forEach((result) => {
    ([
      ["left", result.left],
      ["right", result.right],
    ] as const).forEach(([sideKey, team]) => {
      team.players.forEach((player) => idToPlayer.set(player.id, player));
      const member = team.players.find((player) => playerVersionKey(player) === versionKey);
      if (!member) return;
      // Sum PER-MAP stats (not the series-level aggregate) so this career line matches the player-card
      // and all-time vault, which both aggregate per-map lines.
      const stint = stintByTeam.get(team.id) ?? { team, maps: 0, line: emptyLine() };
      let appeared = false;
      result.maps.forEach((map) => {
        const incoming = (sideKey === "left" ? map.leftStats : map.rightStats)?.[member.id];
        if (!incoming) return;
        stint.maps += 1;
        addPlayerLine(stint.line, incoming);
        addPlayerLine(line, incoming);
        appeared = true;
      });
      if (appeared) stintByTeam.set(team.id, stint);
    });
    result.maps.forEach((map) => {
      if (map.eventLog) logs.push(map.eventLog);
    });
  });

  const analytics = logs.length ? analyzeEventLogs(logs) : null;
  const advanced = analytics
    ? mergePlayerAnalytics(
        analytics.players.filter((row) => {
          const player = idToPlayer.get(row.playerId);
          return player ? playerVersionKey(player) === versionKey : false;
        }),
      )
    : null;

  const stints = [...stintByTeam.values()].sort((a, b) => b.maps - a.maps);
  const totalMaps = stints.reduce((sum, stint) => sum + stint.maps, 0);
  return { advanced, stints, totalMaps, line };
}

function buildPlayerDatabase(results: SwissResult[]): PlayerDatabaseRow[] {
  const rows = new Map<string, PlayerDatabaseRow>();
  results.forEach((result) => {
    addTeamToPlayerDatabase(rows, result.left, result.leftStats, result.maps.length);
    addTeamToPlayerDatabase(rows, result.right, result.rightStats, result.maps.length);
  });
  return Array.from(rows.values()).sort((a, b) => b.line.rating - a.line.rating || b.line.kills - a.line.kills || a.player.handle.localeCompare(b.player.handle));
}

function addTeamToPlayerDatabase(rows: Map<string, PlayerDatabaseRow>, team: FieldTeam, stats: MatchState["yourStats"], mapCount: number) {
  team.players.forEach((player) => {
    const incoming = stats[player.id];
    if (!incoming) return;
    const databaseKey = playerInstanceKey(team, player);
    const current = rows.get(databaseKey);
    if (!current) {
      rows.set(databaseKey, {
        databaseKey,
        canonicalKey: canonicalPlayerKey(player),
        versionKey: playerVersionKey(player),
        player,
        team,
        matches: mapCount,
        line: { ...incoming },
      });
      return;
    }
    current.matches += mapCount;
    addPlayerLine(current.line, incoming);
  });
}

function aggregateSeriesStats(team: FieldTeam, maps: SeriesMapResult[], side: "left" | "right") {
  const stats = team.players.reduce(
    (acc, player) => {
      acc[player.id] = emptyLine();
      return acc;
    },
    {} as MatchState["yourStats"],
  );
  maps.forEach((map) => {
    const source = side === "left" ? map.leftStats : map.rightStats;
    team.players.forEach((player) => {
      const incoming = source[player.id];
      if (incoming) addPlayerLine(stats[player.id], incoming);
    });
  });
  return stats;
}

function addPlayerLine(target: MatchState["yourStats"][string], incoming: MatchState["yourStats"][string]) {
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

function emptyLine(): MatchState["yourStats"][string] {
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

function seriesMapSummary(result: SwissResult) {
  return result.maps.map((map) => `${mapName(map.map)} ${map.leftScore}-${map.rightScore}`).join(", ");
}

function buildInitialPlayoffPairs(
  user: FieldTeam,
  field: FieldTeam[],
  records: Record<string, SwissRecord>,
  settings: CustomSettings,
  difficulty: Difficulty,
) {
  const orderedSeeds = playoffSeeds(field, records, settings, difficulty).filter((team) => team.id !== user.id);
  const qualifiedSeeds = orderedSeeds.filter((team) => (records[team.id]?.wins ?? 0) >= 3);
  const backupSeeds = orderedSeeds.filter((team) => !qualifiedSeeds.some((qualified) => qualified.id === team.id));
  const seeds = [...qualifiedSeeds, ...backupSeeds].slice(0, 7);
  return buildPlayoffPairs("quarterfinal", [user, ...seeds], user);
}

function buildNeutralInitialPlayoffPairs(
  field: FieldTeam[],
  records: Record<string, SwissRecord>,
  settings: CustomSettings,
  difficulty: Difficulty,
) {
  const orderedSeeds = playoffSeeds(field, records, settings, difficulty);
  const qualifiedSeeds = orderedSeeds.filter((team) => (records[team.id]?.wins ?? 0) >= 3);
  const backupSeeds = orderedSeeds.filter((team) => !qualifiedSeeds.some((qualified) => qualified.id === team.id));
  return buildNeutralPlayoffPairs("quarterfinal", [...qualifiedSeeds, ...backupSeeds].slice(0, SWISS_FIELD_SIZE / 2));
}

function buildNextPlayoffPairs(round: PlayoffRound, winners: FieldTeam[], user: FieldTeam) {
  const ordered = [user, ...winners.filter((team) => team.id !== "user")];
  return buildPlayoffPairs(round, ordered, user);
}

function buildNeutralNextPlayoffPairs(round: PlayoffRound, winners: FieldTeam[]) {
  return buildNeutralPlayoffPairs(round, winners);
}

function buildNeutralPlayoffPairs(round: PlayoffRound, teams: FieldTeam[]): SwissPair[] {
  const seeds = teams.slice(0, SWISS_FIELD_SIZE / 2);
  const order =
    round === "quarterfinal" && seeds.length >= 8
      ? [
          [0, 7],
          [3, 4],
          [2, 5],
          [1, 6],
        ]
      : Array.from({ length: Math.floor(seeds.length / 2) }, (_, index) => [index * 2, index * 2 + 1]);

  return order
    .map(([leftIndex, rightIndex], pairIndex) => {
      const left = seeds[leftIndex];
      const right = seeds[rightIndex];
      if (!left || !right) return undefined;
      return {
        id: `${round}-${pairIndex}-${left.id}-${right.id}`,
        left,
        right,
      };
    })
    .filter(Boolean) as SwissPair[];
}

function buildPlayoffPairs(round: PlayoffRound, teams: FieldTeam[], user: FieldTeam): SwissPair[] {
  const opponents = teams.filter((team) => team.id !== "user");
  const userOpponent = opponents[opponents.length - 1] ?? opponents[0] ?? user;
  const nonUser = opponents.filter((team) => team.id !== userOpponent.id);
  const pairs: SwissPair[] = [
    {
      id: `${round}-user-${userOpponent.id}`,
      left: user,
      right: userOpponent,
      active: true,
    },
  ];
  for (let index = 0; index < nonUser.length - 1; index += 2) {
    pairs.push({
      id: `${round}-${nonUser[index].id}-${nonUser[index + 1].id}`,
      left: nonUser[index],
      right: nonUser[index + 1],
    });
  }
  return pairs;
}

function playoffSeeds(field: FieldTeam[], records: Record<string, SwissRecord>, settings: CustomSettings, difficulty: Difficulty) {
  return [...field].sort((a, b) => {
    const aRecord = records[a.id] ?? { wins: 0, losses: 0 };
    const bRecord = records[b.id] ?? { wins: 0, losses: 0 };
    return (
      bRecord.wins - aRecord.wins ||
      aRecord.losses - bRecord.losses ||
      teamStrength(b, settings, difficulty) - teamStrength(a, settings, difficulty)
    );
  });
}

function recordKey(record: SwissRecord) {
  return `${record.wins}-${record.losses}`;
}

function laneKeyForRecord(record: SwissRecord) {
  return `${record.wins}:${record.losses}`;
}

function tacticalTimeoutPlan(match: MatchState, you: FieldTeam, opponent: FieldTeam): TimeoutPlan {
  const coachDelta = (you.coach?.rating ?? 68) - (opponent.coach?.rating ?? 68);
  const coachValue = coachDelta >= 0 ? Math.min(0.04, coachDelta / 240) : Math.max(-0.006, coachDelta / 900);
  const opponentStreak = trailingRoundWins(match.roundWinners, "opponent");
  const pressure =
    match.you >= 12 || match.opponent >= 12
      ? 0.018
      : match.you >= 10 || match.opponent >= 10
        ? 0.01
        : 0;
  const streakValue = opponentStreak >= 3 ? 0.018 : opponentStreak >= 2 ? 0.012 : 0;
  const deficitValue = match.opponent - match.you >= 4 ? 0.01 : match.opponent > match.you ? 0.005 : 0;
  const boost = clampNumber(0.012 + coachValue + pressure + streakValue + deficitValue, 0.006, 0.085);
  const rounds = pressure > 0 || opponentStreak >= 3 ? 4 : 3;
  return { boost, rounds };
}

function trailingRoundWins(roundWinners: MatchState["roundWinners"], side: "you" | "opponent") {
  let count = 0;
  for (let index = roundWinners.length - 1; index >= 0; index -= 1) {
    if (roundWinners[index] !== side) break;
    count += 1;
  }
  return count;
}

function resolvePickems(
  pairs: SwissPair[],
  picks: Record<string, string>,
  settings: CustomSettings,
  difficulty: Difficulty,
) {
  return pairs.reduce(
    (result, pair) => {
      if (pair.active || !picks[pair.id]) return result;
      const winner = simulatePairWinner(pair, settings, difficulty);
      return {
        score: result.score + (picks[pair.id] === winner ? 1 : 0),
      };
    },
    { score: 0 },
  );
}

function simulatePairWinner(pair: SwissPair, settings: CustomSettings, difficulty: Difficulty) {
  const leftScore = teamStrength(pair.left, settings, difficulty) + Math.random() * 8;
  const rightScore = teamStrength(pair.right, settings, difficulty) + Math.random() * 8;
  return leftScore >= rightScore ? pair.left.id : pair.right.id;
}

function generatePlayerForm(players: Player[]) {
  // Everyone starts the Major at neutral form (0%); it drifts up/down after each map from performance.
  return players.reduce(
    (acc, player) => {
      acc[player.id] = 0;
      return acc;
    },
    {} as Record<string, number>,
  );
}

function draftedPlayerCopy(player: Player, pickIndex: number): Player {
  return {
    ...player,
    id: `user-pick-${pickIndex + 1}-${player.id}`,
  };
}

function applyCarriedPlayerForm(player: Player, formPercent: number): Player {
  const form = clampNumber(formPercent, -5, 5);
  if (form === 0) return player;

  const multiplier = 1 + form / 100;
  const softMultiplier = 1 + form / 160;
  const scaleSkill = (value: number, mult = multiplier) => clampWhole(value * mult, 1, 99);
  const maps = Object.fromEntries(
    Object.entries(player.maps).map(([map, value]) => [map, scaleSkill(value, softMultiplier)]),
  ) as Player["maps"];

  return {
    ...player,
    ovr: clampWhole(player.ovr * multiplier, 60, 99),
    stats: {
      ...player.stats,
      aim: scaleSkill(player.stats.aim),
      clutch: scaleSkill(player.stats.clutch),
      consistency: scaleSkill(player.stats.consistency, softMultiplier),
      awp: player.role === "AWP" ? scaleSkill(player.stats.awp) : scaleSkill(player.stats.awp, softMultiplier),
    },
    maps,
  };
}

function shiftPlayerForm(current: Record<string, number>, players: Player[], match: MatchState) {
  return players.reduce(
    (acc, player) => {
      const line = match.yourStats[player.id];
      if (!line) {
        acc[player.id] = current[player.id] ?? 0;
        return acc;
      }
      const rounds = Math.max(1, line.rounds);
      const kdPerRound = (line.kills - line.deaths) / rounds;
      const kast = line.kastRounds / rounds;
      const performance =
        (line.rating - 1) * 7 +
        kdPerRound * 5 +
        (line.adr - 75) * 0.045 +
        (kast - 0.72) * 3;
      const drift = clampWhole(performance, -2, 2);
      acc[player.id] = clampNumber((current[player.id] ?? 0) + drift, -5, 5);
      return acc;
    },
    { ...current },
  );
}

function unlockAchievements(current: string[], incoming: string[]) {
  return Array.from(new Set([...current, ...incoming]));
}

function draftAchievements(players: Player[], mode: Mode) {
  const unlocks: string[] = [];
  const roles = new Set(players.map((player) => player.role));
  if (requiredRoles.every((role) => roles.has(role))) unlocks.push("role-perfect");
  if (averageOvr(players) >= 88) unlocks.push("superteam");
  if (mode === "blind") unlocks.push("almanac");
  return unlocks;
}

function matchAchievements(
  match: MatchState,
  you: FieldTeam,
  opponent: FieldTeam,
  settings: CustomSettings,
  difficulty: Difficulty,
  nextRecord: SwissRecord,
) {
  const unlocks: string[] = [];
  const strengthGap = teamStrength(you, settings) - teamStrength(opponent, settings, difficulty, true);
  const edge = mapEdge(you, opponent, match.map, settings);
  const scoreDiff = Math.abs(match.you - match.opponent);
  if (match.winner === "you" && edge > 0) unlocks.push("veto-read");
  if (match.winner === "you" && strengthGap < -1) unlocks.push("upset-artist");
  if (scoreDiff <= 2) unlocks.push("close-call");
  if (match.winner === "you" && match.opponent <= 7) unlocks.push("clean-win");
  if (nextRecord.wins >= 3) unlocks.push("playoff-ticket");
  return unlocks;
}

function sanitizeLoadedScreen(screen: Screen | undefined, snapshot: RunSnapshot): Screen {
  if (!screen) return "setup";
  if (screen === "match" && !snapshot.match) return snapshot.phase === "playoffs" ? "playoffs" : "swiss";
  if (screen === "result" && !snapshot.match) return snapshot.phase === "playoffs" ? "playoffs" : "swiss";
  if (screen === "series-detail" && !snapshot.selectedResultId) return snapshot.phase === "playoffs" ? "playoffs" : "swiss";
  if (screen === "player-detail" || screen === "team-detail") return snapshot.phase === "playoffs" ? "playoffs" : "swiss";
  if (screen === "coach" && snapshot.runKind === "spectator") return "swiss";
  return screen;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampWhole(value: number, min: number, max: number) {
  return Math.round(Math.max(min, Math.min(max, value)));
}

function getFlagUrl(countryCode: string) {
  if (!countryCode || countryCode.length !== 2) return "";
  return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
}

function Flag({ country }: { country: string }) {
  if (!country || country === "INT" || country === "EU") return null;
  return (
    <img
      className="flat-flag"
      src={getFlagUrl(country)}
      alt={country}
      title={country}
      loading="lazy"
    />
  );
}

createRoot(document.getElementById("root")!).render(<App />);
