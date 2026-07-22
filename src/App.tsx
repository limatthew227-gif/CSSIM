import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CalendarDays,
  Coins,
  Award,
  Ban,
  Bomb,
  CheckCircle2,
  Clock3,
  Crosshair,
  Database,
  Dice5,
  Download,
  Dumbbell,
  Eye,
  FastForward,
  FileSearch,
  Flame,
  Footprints,
  Gauge,
  LayoutDashboard,
  Mail,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Skull,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Trash2,
  Upload,
  UserPlus,
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
import {
  STARTING_BANKROLL,
  type PlacementTier,
  playerValue,
  transferDelta,
  prizeForPlacement,
  placementTier,
  placementLabel,
  pickTransferCandidates,
  careerMetaForPlayer,
  ageAfterMajor,
  expectedRating,
  developPlayer,
} from "./career";
import { hltvProspectPotentialBonus } from "./hltvProspects2026";
import {
  advanceCircuit,
  circuitEventById,
  circuitEventIndex,
  circuitEvents,
  circuitFieldLabel,
  circuitParticipantIds,
  circuitPrize,
  circuitQualificationLabel,
  circuitWorldRank,
  composeCircuitField,
  firstCircuitEventId,
  nextCircuitEvent,
  normalizeCircuitEventId,
  pickCircuitRosters,
  rankRostersByVrs,
  type CircuitEvent,
  type CircuitEventId,
} from "./circuit";
import { hltvTop20Coaches, hltvTop20Rosters } from "./hltvTop20";
import { hltvRanked27To50Coaches, hltvRanked27To50Rosters } from "./hltvRanked27To50";
import { playerPhoto } from "./playerPhotos";
import { mapArtImages } from "./mapArt";
import { decideAutoCoach } from "./autoCoach";
import { simulateRadarPlayers, MAP_LAYOUTS, getStepDelay } from "./radarSim";
import { mapGeometries, hasPixelNav } from "./mapGeometry";
import {
  deleteRunSlot,
  formatRunSlotTime,
  loadRunSlots,
  saveRunSlot,
  writeAutosave,
  readAutosave,
  clearAutosave,
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
  createIdbStorage,
  teamRef,
  type StorageAdapter,
  type PlayerCareerRecord,
  type PlayerOpponentRecord,
  type PlayerRatingAppearance,
  type PlayerRatingExtremes,
  type MatchRecord,
  type TeamProfile,
  type TeamRecordRow,
  type TeamPlayerProfile,
  type RecordMatchInput,
} from "./matchDatabase";
import {
  acceptManagerIncomingOffer,
  advanceManagerMajorStage,
  acceptManagerTradeCounter,
  advanceManagerDate,
  completeManagerEvent,
  createManagerCareer,
  createManagerIncomingOffer,
  counterManagerIncomingOffer,
  declineManagerIncomingOffer,
  launchManagerEvent as beginManagerEvent,
  managerEventById,
  managerEventName,
  managerEventSchedule,
  managerEvents,
  managerEventReadyToLaunch,
  managerEventStartForRank,
  managerFormatDate,
  managerEventEligibility,
  managerContractDurationLabel,
  managerContractReleaseCost,
  MANAGER_CASINO_STAKES,
  managerTrainingPlan,
  managerActivePerformanceCamp,
  managerPerformanceCampEligibility,
  managerPerformanceCampPrograms,
  managerRenewalBonus,
  managerPlacementLabel,
  managerMonthlyPayroll,
  managerPotentialCoinResult,
  managerPotentialLabCost,
  managerCasinoCoinResult,
  managerCasinoVisitAllowed,
  managerRecommendedSalary,
  managerFinancialStatus,
  managerFamiliarityLabel,
  managerFormLabel,
  managerMoraleLabel,
  managerPlayerDynamics,
  managerTeamFamiliarity,
  managerTeamForm,
  managerMajorEntryStage,
  managerMajorStageStakes,
  managerMajorProjection,
  managerMajorStageHasPlayoffs,
  managerMajorStageLabel,
  markManagerInboxRead,
  managerLineupEditLocked,
  managerSeasonLabel,
  isCurrentManagerWorldRoster,
  managerClubRelationship,
  managerClubRelationshipLabel,
  managerTradeRoundsRemaining,
  resolveManagerOrganization,
  nextManagerCheckpoint,
  normalizeManagerCareer,
  registerManagerEvent,
  releaseManagerPlayerContract,
  resolveManagerTrainingCycle,
  resolveManagerPotentialInvestment,
  resolveManagerCasinoVisit,
  scheduleManagerPerformanceCamp,
  scoutManagerCandidate,
  submitManagerFreeAgentOffer,
  renewManagerPlayerContract,
  toggleManagerShortlist,
  withdrawManagerEvent,
  evaluateManagerOffer,
  evaluateManagerContractRenewal,
  evaluateManagerTradeProposal,
  submitManagerTradeOffer,
  setManagerStartingLineup,
  setManagerTrainingFocus,
  startNextManagerSeason,
  withdrawManagerTradeOffer,
  type ManagerOfferTerms,
  type ManagerTradeProposal,
  type ManagerSquadRole,
  type ManagerCareerState,
  type ManagerEvent,
  type ManagerMajorStage,
  type ManagerCoinSide,
  type ManagerCasinoStake,
  type ManagerPerformanceCampFocus,
  type ManagerTrainingFocus,
  type ManagerInboxItem,
  type ManagerIncomingOffer,
} from "./managerCareer";
import {
  applyManagerRosterMoves,
  createManagerAiTransferActivity,
  createManagerFreeAgentPool,
  createManagerTransferList,
  managerScoutingRange,
  type ManagerMarketCandidate,
  type ManagerRecentPlayerPerformance,
} from "./managerMarket";
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
import ctFactionIcon from "./assets/factions/ct.png";
import tFactionIcon from "./assets/factions/t.png";

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
const builtInHltvRosters = rankRostersByVrs([...hltvTop20Rosters, ...hltvRanked27To50Rosters]).map((roster) => ({
  ...roster,
  tagline:
    roster.rank && roster.vrsPoints != null
      ? `Mixed-era VRS #${roster.rank} with ${roster.vrsPoints} points. Source profile: ${roster.tagline}`
      : roster.tagline,
}));
const builtInHltvCoaches = [...hltvTop20Coaches, ...hltvRanked27To50Coaches];
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

type Screen = "setup" | "teams" | "draft" | "coach" | "manager-select" | "manager-home" | "manager-inbox" | "manager-calendar" | "manager-roster" | "manager-market" | "manager-history" | "manager-event-overview" | "swiss" | "playoffs" | "veto" | "match" | "result" | "universe" | "overview" | "stats" | "results" | "series-detail" | "player-detail" | "team-detail" | "balance-lab" | "vault" | "vault-replay" | "vault-team" | "compare" | "transfer";
type Mode = "classic" | "random" | "circuit" | "manager" | "spectator";
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

interface ManagerVrsStanding {
  team: Pick<Roster | FieldTeam, "id" | "tag" | "name" | "country" | "accent" | "logo">;
  rank: number;
  points: number;
  movement: number;
  managed: boolean;
}

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
  roundProbabilities?: number[];
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
  eventId?: CircuitEventId;
  eventName?: string;
}

interface SwissLaneResult {
  laneKey: string;
  result: SwissResult;
}

interface CareerHistoryEntry {
  event: number;
  tier: PlacementTier;
  prize: number;
  record: SwissRecord;
  eventId?: CircuitEventId;
  eventName?: string;
  season?: number;
  points?: number;
  qualified?: boolean;
  managerEventId?: string;
  archive?: ManagerEventArchive;
}

interface ManagerEventArchive {
  id: string;
  eventId: string;
  eventName: string;
  season: number;
  completedOn: string;
  majorStage?: ManagerMajorStage;
  phase: TournamentPhase;
  playoffRound: PlayoffRound;
  outcome: TournamentOutcome;
  winner?: FieldTeam;
  teams: FieldTeam[];
  records: Record<string, SwissRecord>;
  results: SwissResult[];
  playoffPairs: SwissPair[];
}

interface CircuitOffseasonTarget {
  eventId: CircuitEventId;
  season: number;
  points: number;
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
  autoCoach?: boolean;
  teamName: string;
  mode: Mode;
  runKind: RunKind;
  vaultRunId?: string;
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
  // Career continuation (optional — absent on older saves / non-career runs).
  careerActive?: boolean;
  careerMoney?: number;
  careerEvent?: number;
  playerFinish?: PlacementTier | null;
  careerHistory?: CareerHistoryEntry[];
  circuitEventId?: CircuitEventId;
  circuitSeason?: number;
  circuitPoints?: number;
  circuitMajorResults?: SwissResult[];
  circuitObserver?: boolean;
  circuitOffseasonTarget?: CircuitOffseasonTarget | null;
  transferCandidates?: Array<{ player: Player; team: Roster }>;
  transferTrade?: { incoming: Player; outgoing: Player; delta: number } | null;
  progressionSummary?: Array<{ handle: string; before: number; after: number; iglDelta: number }>;
  managerCareer?: ManagerCareerState;
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
// Resolves once the Vault's full history has loaded from IndexedDB (so reads/records wait for it).
let resolveMatchDbReady: () => void = () => {};
const matchDbReady: Promise<void> = new Promise((resolve) => {
  resolveMatchDbReady = resolve;
});

function getMatchDb(): MatchDatabase {
  if (!matchDbInstance) {
    if (typeof indexedDB !== "undefined") {
      // IndexedDB (hundreds of MB) so the Vault keeps a full career of matches; migrates old localStorage.
      const { adapter, ready } = createIdbStorage();
      matchDbInstance = new MatchDatabase(adapter);
      ready.then(() => resolveMatchDbReady());
    } else {
      const storage: StorageAdapter = typeof window !== "undefined" ? window.localStorage : memoryStorage();
      matchDbInstance = new MatchDatabase(storage);
      resolveMatchDbReady();
    }
  }
  return matchDbInstance;
}

interface VaultEventContext {
  runId: string;
  eventId: string;
  eventName: string;
  season: number;
}

function createVaultRunId() {
  return `career-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// Persist any completed series maps not already in the DB. Existing records from a resumed save are
// revisited when needed so older current-event maps can gain the newer event/season metadata.
function recordResultsToDb(results: SwissResult[], context: VaultEventContext) {
  const db = getMatchDb();
  const existing = new Map(db.listMatches().map((match) => [match.id, match])); // one read for dedupe
  const inputs: RecordMatchInput[] = [];
  results.forEach((series) => {
    series.maps.forEach((map, index) => {
      const legacyId = `${series.id}-${map.map}-${index}`;
      const eventId = series.eventId ?? context.eventId;
      const eventName = series.eventName ?? context.eventName;
      const legacyStored = existing.get(legacyId);
      const previousScopedId = `${context.runId}:${legacyId}`;
      const previousScopedStored = existing.get(previousScopedId);
      const scopedId = `${context.runId}:${context.season}:${eventId}:${legacyId}`;
      const belongsToEvent = (stored: MatchRecord | undefined) =>
        stored?.runId === context.runId &&
        stored.season === context.season &&
        stored.eventId === eventId;
      const id =
        legacyStored && (!legacyStored.runId || belongsToEvent(legacyStored))
          ? legacyId
          : belongsToEvent(previousScopedStored)
            ? previousScopedId
            : scopedId;
      const stored = existing.get(id);
      if (stored?.runId && stored.eventId && stored.seriesId) return;
      inputs.push({
        id,
        seriesId: `${context.runId}:${context.season}:${eventId}:${series.id}`,
        recordedAt: new Date().toISOString(),
        runId: context.runId,
        eventId,
        eventName,
        season: context.season,
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
  const [vaultRunId, setVaultRunId] = useState(createVaultRunId);
  const [difficulty, setDifficulty] = useState<Difficulty>(difficulties[0]);
  const [runSlots, setRunSlots] = useState<SavedRun[]>(() => loadRunSlots<RunSnapshot>());
  const [activeSaveId, setActiveSaveId] = useState<string>();
  const [saveMessage, setSaveMessage] = useState("");
  const [selected, setSelected] = useState<Player[]>([]);
  const [coach, setCoach] = useState<Coach | undefined>();
  const [coachOptions, setCoachOptions] = useState<Coach[]>([]);
  const [coachRevealKey, setCoachRevealKey] = useState(0);
  const [currentRoster, setCurrentRoster] = useState<Roster>(builtInHltvRosters[0]);
  const [usedRosterIds, setUsedRosterIds] = useState<string[]>([]);
  const [rolling, setRolling] = useState(false);
  const [rollSequence, setRollSequence] = useState<Roster[]>([]);
  const [rollsLeft, setRollsLeft] = useState(defaultSettings.draftRolls);
  const [opponent, setOpponent] = useState<FieldTeam>(toTournamentTeam(builtInHltvRosters[1] ?? builtInHltvRosters[0]));
  const [phase, setPhase] = useState<TournamentPhase>("swiss");
  const [playoffRound, setPlayoffRound] = useState<PlayoffRound>("quarterfinal");
  const [playoffPairs, setPlayoffPairs] = useState<SwissPair[]>([]);
  const [tournamentOutcome, setTournamentOutcome] = useState<TournamentOutcome>("running");
  // Where YOUR team actually finished this Major, captured at the moment you resolve (win/elim). The
  // bracket's playoffRound keeps advancing after you're out, so it can't be trusted for placement.
  const [playerFinish, setPlayerFinish] = useState<PlacementTier | null>(null);
  const [tournamentWinner, setTournamentWinner] = useState<FieldTeam | undefined>();
  const [swissField, setSwissField] = useState<FieldTeam[]>(() => buildSwissField(builtInHltvRosters));
  const [swissRecords, setSwissRecords] = useState<Record<string, SwissRecord>>({});
  const [spectatorSwissRound, setSpectatorSwissRound] = useState(1);
  const [playedOpponentIds, setPlayedOpponentIds] = useState<string[]>([]);
  const [matchResults, setMatchResults] = useState<SwissResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string>();
  const [detailPlayer, setDetailPlayer] = useState<{ player: Player; team: FieldTeam } | null>(null);
  const [detailTeam, setDetailTeam] = useState<FieldTeam | null>(null);
  const [vaultReplayId, setVaultReplayId] = useState<string | null>(null); // match id opened from the Vault
  const [vaultTeamId, setVaultTeamId] = useState<string | null>(null); // team id opened from the Vault standings
  const [compareAId, setCompareAId] = useState<string | null>(null); // player A pre-filled when opening Compare
  // Career continuation: keep this drafted roster across Majors, earn prize money, run a transfer window.
  const [careerActive, setCareerActive] = useState(false);
  const [careerMoney, setCareerMoney] = useState(0);
  const [careerEvent, setCareerEvent] = useState(1); // career event number currently being played (1-based)
  const [careerHistory, setCareerHistory] = useState<CareerHistoryEntry[]>([]);
  const [managerHistoryEntry, setManagerHistoryEntry] = useState<CareerHistoryEntry | null>(null);
  const [circuitEventId, setCircuitEventId] = useState<CircuitEventId>(firstCircuitEventId);
  const [circuitSeason, setCircuitSeason] = useState(1);
  const [circuitPoints, setCircuitPoints] = useState(0);
  const [circuitMajorResults, setCircuitMajorResults] = useState<SwissResult[]>([]);
  const [overviewEventId, setOverviewEventId] = useState<CircuitEventId | null>(null);
  const [circuitObserver, setCircuitObserver] = useState(false);
  const [circuitOffseasonTarget, setCircuitOffseasonTarget] = useState<CircuitOffseasonTarget | null>(null);
  const [transferCandidates, setTransferCandidates] = useState<Array<{ player: Player; team: Roster }>>([]);
  const [transferTrade, setTransferTrade] = useState<{ incoming: Player; outgoing: Player; delta: number } | null>(null); // one trade per window
  const [progressionSummary, setProgressionSummary] = useState<Array<{ handle: string; before: number; after: number; iglDelta: number }>>([]);
  const [managerCareer, setManagerCareer] = useState<ManagerCareerState>();
  const [managerMarketRole, setManagerMarketRole] = useState<Role | "all">("all");
  const [autosave, setAutosave] = useState(() => readAutosave<RunSnapshot>()); // last-session snapshot, read once at mount
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
  const [autoCoach, setAutoCoach] = useState(false);
  const [autoCoachStatus, setAutoCoachStatus] = useState("Watching the server");
  const lastAutoCoachRoundRef = useRef<string | undefined>(undefined);
  const liveTimeoutRef = useRef(false);
  const builtInRosterCount = builtInHltvRosters.length;
  const rosterPool = useMemo(() => [...builtInHltvRosters, ...customRosters], [customRosters]);
  const labTeams = useMemo(() => rosterPool.map(toTournamentTeam), [rosterPool]);
  const comparePool = useMemo(() => rosterPool.flatMap((roster) => roster.players.map((player) => ({ player, team: roster }))), [rosterPool]);
  const playerTeamMap = useMemo(() => {
    const map = new Map<string, Roster>();
    rosterPool.forEach((roster) => roster.players.forEach((player) => map.set(player.id, roster)));
    return map;
  }, [rosterPool]);
  const coachPool = useMemo(() => builtInHltvCoaches, []);
  const visibleCoachOptions = coachOptions.length ? coachOptions : coachPool.slice(0, COACH_SHORTLIST_SIZE);
  const activeCall = parseTactic(tactic);
  const circuitEvent = circuitEventById(circuitEventId);
  const managerActiveEvent = managerEventById(managerCareer?.activeEventId);
  const managerMajorActive = mode === "manager" && Boolean(managerActiveEvent?.majorCycle);
  const managerMajorStageId = managerCareer?.activeMajorStage
    ?? managerMajorEntryStage(managerCareer?.vrsRank ?? 64);
  const managerMajorStage = managerMajorActive ? circuitEventById(managerMajorStageId) : undefined;
  const activeMajorStageEvent = managerMajorStage ?? circuitEvent;
  const managerOrganization = managerCareer
    ? resolveManagerOrganization(rosterPool, managerCareer.organizationId, managerCareer.organizationName)
    : undefined;
  const managerControlledOrganizationId = managerOrganization?.id ?? managerCareer?.organizationId;
  const managerControlledOrganizationName = (managerOrganization?.name ?? managerCareer?.organizationName ?? "")
    .trim()
    .toLowerCase();
  const managerWorldRosters = useMemo(
    () => applyManagerRosterMoves(rosterPool, managerCareer?.market?.rosterMoves ?? []),
    [managerCareer?.market?.rosterMoves, rosterPool],
  );
  const managerAuthoritativeVrsRank = useMemo(() => {
    if (!managerCareer) return 64;
    const controlledName = managerCareer.organizationName.trim().toLowerCase();
    const rankedWorld = managerWorldRosters.filter((roster) => (
      isCurrentManagerWorldRoster(roster)
      && roster.id !== managerControlledOrganizationId
      && roster.name.trim().toLowerCase() !== controlledName
    ));
    return circuitWorldRank(managerCareer.vrsPoints, rankedWorld);
  }, [managerCareer, managerControlledOrganizationId, managerWorldRosters]);
  useEffect(() => {
    if (!managerCareer || managerCareer.vrsRank === managerAuthoritativeVrsRank) return;
    setManagerCareer((current) => current && current.vrsRank !== managerAuthoritativeVrsRank
      ? { ...current, vrsRank: managerAuthoritativeVrsRank }
      : current);
  }, [managerAuthoritativeVrsRank, managerCareer]);
  const managerEventRosters = useMemo(
    () => rankRostersByVrs(managerWorldRosters.filter((roster) => (
      isCurrentManagerWorldRoster(roster)
      && roster.id !== managerControlledOrganizationId
      && roster.name.trim().toLowerCase() !== managerControlledOrganizationName
    ))),
    [managerControlledOrganizationId, managerControlledOrganizationName, managerWorldRosters],
  );
  const managerFreeAgents = useMemo(
    () => createManagerFreeAgentPool(managerCareer?.seed ?? vaultRunId, 18, {
      vrsRank: managerCareer?.vrsRank,
      organizationCountry: managerCareer?.organizationCountry,
    }),
    [managerCareer?.organizationCountry, managerCareer?.seed, managerCareer?.vrsRank, vaultRunId],
  );
  const managerRecentPerformance = useMemo(
    () => buildManagerRecentPlayerPerformance(matchResults),
    [matchResults],
  );
  const managerTransferList = useMemo(
    () => createManagerTransferList(managerCareer?.seed ?? vaultRunId, managerWorldRosters, managerControlledOrganizationId ?? "", 18, {
      vrsRank: managerCareer?.vrsRank,
      organizationCountry: managerCareer?.organizationCountry,
    }, managerRecentPerformance),
    [managerCareer?.organizationCountry, managerCareer?.seed, managerCareer?.vrsRank, managerControlledOrganizationId, managerRecentPerformance, managerWorldRosters, vaultRunId],
  );
  const managerContractPlayers = useMemo(() => {
    const knownPlayers = new Map<string, Player>();
    rosterPool.forEach((roster) => roster.players.forEach((player) => knownPlayers.set(player.id, player)));
    [...managerFreeAgents, ...managerTransferList].forEach((candidate) => knownPlayers.set(candidate.id, candidate.player));
    managerCareer?.market.tradeOffers.forEach((offer) => {
      knownPlayers.set(offer.incoming.id, offer.incoming as Player);
      knownPlayers.set(offer.outgoing.id, offer.outgoing as Player);
    });
    selected.forEach((player) => knownPlayers.set(player.id, player));
    return managerCareer?.contracts
      .map((contract) => {
        const player = knownPlayers.get(contract.playerId);
        const plan = managerCareer.trainingPlans.find((item) => item.playerId === contract.playerId);
        return player && plan
          ? { ...player, ovr: plan.currentOvr, potential: plan.potentialOvr, stats: plan.currentStats ?? player.stats }
          : player;
      })
      .filter((player): player is Player => Boolean(player)) ?? selected;
  }, [managerCareer?.contracts, managerCareer?.market.tradeOffers, managerCareer?.trainingPlans, managerFreeAgents, managerTransferList, rosterPool, selected]);
  const managerSquad = useMemo(() => {
    const activeIds = new Set(managerCareer?.contracts
      .filter((contract) => contract.status !== "expired")
      .map((contract) => contract.playerId) ?? []);
    const activePlayers = managerContractPlayers.filter((player) => activeIds.has(player.id));
    return [
      ...selected.filter((player) => activeIds.has(player.id)),
      ...activePlayers.filter((player) => !selected.some((starter) => starter.id === player.id)),
    ];
  }, [managerCareer?.contracts, managerContractPlayers, selected]);
  const tournamentName = mode === "circuit"
    ? circuitEvent.name
    : mode === "manager"
      ? managerActiveEvent
        ? `${managerEventName(managerActiveEvent, managerCareer?.season ?? 1)}${managerMajorStage ? ` / ${managerMajorStage.shortName}` : ""}`
        : "Manager Career"
      : "Major";

  const formAdjustedPlayers = useMemo(
    () =>
      selected.map((player) => applyCarriedPlayerForm(player, playerForm[player.id] ?? 0)),
    [selected, playerForm],
  );
  const yourTeam = useMemo(() => {
    const team = draftedTeam(teamName, formAdjustedPlayers, coach);
    if (mode !== "circuit" && mode !== "manager") return team;
    if (mode === "manager" && managerOrganization) {
      return {
        ...team,
        tag: managerOrganization.tag,
        name: managerOrganization.name,
        country: managerOrganization.country,
        era: managerOrganization.era,
        year: managerOrganization.year,
        accent: managerOrganization.accent,
        logo: managerOrganization.logo,
        trophies: managerOrganization.trophies,
        rank: managerAuthoritativeVrsRank,
        vrsPoints: managerCareer?.vrsPoints,
      };
    }
    return {
      ...team,
      rank: mode === "manager" ? managerAuthoritativeVrsRank : circuitWorldRank(circuitPoints, builtInHltvRosters),
      vrsPoints: mode === "manager" ? managerCareer?.vrsPoints : circuitPoints,
    };
  }, [teamName, formAdjustedPlayers, coach, mode, circuitPoints, managerAuthoritativeVrsRank, managerCareer?.vrsPoints, managerOrganization]);
  const managerVrsStandings = useMemo<ManagerVrsStanding[]>(() => {
    if (!managerCareer) return [];
    const controlledName = managerCareer.organizationName.trim().toLowerCase();
    const world = managerWorldRosters.filter((roster) => (
      isCurrentManagerWorldRoster(roster)
      && roster.id !== managerControlledOrganizationId
      && roster.name.trim().toLowerCase() !== controlledName
    ));
    const baselineOrder = [
      ...world.map((team) => ({ id: team.id, rank: team.rank ?? 64 })),
      { id: yourTeam.id, rank: managerCareer.boardObjective.startingRank },
    ].sort((left, right) => left.rank - right.rank || left.id.localeCompare(right.id));
    const baselineRanks = new Map(baselineOrder.map((entry, index) => [entry.id, index + 1]));
    const rows: Array<{ team: Roster | FieldTeam; points: number; baselineRank: number; managed: boolean }> = world.map((team) => ({
      team,
      points: team.vrsPoints ?? 0,
      baselineRank: baselineRanks.get(team.id) ?? 64,
      managed: false,
    }));
    rows.push({
      team: yourTeam,
      points: managerCareer.vrsPoints,
      baselineRank: baselineRanks.get(yourTeam.id) ?? managerCareer.boardObjective.startingRank,
      managed: true,
    });
    rows.sort((left, right) => (
      right.points - left.points
      || left.baselineRank - right.baselineRank
      || left.team.id.localeCompare(right.team.id)
    ));
    return rows.map((row, index) => ({
      team: row.team,
      rank: index + 1,
      points: row.points,
      movement: row.baselineRank - (index + 1),
      managed: row.managed,
    }));
  }, [managerCareer, managerControlledOrganizationId, managerWorldRosters, yourTeam]);
  const bonuses = useMemo(() => composition(selected, settings, true), [selected, settings]);
  const opponentBonuses = useMemo(() => composition(opponent.players, settings, opponent.id === "user"), [opponent, settings]);
  const missingRoles = requiredRoles.filter((role) => !selected.some((player) => player.role === role));
  const swissHistory = useMemo(() => buildSwissHistory(matchResults), [matchResults]); // who has played whom in Swiss
  const managerRoundRobinActive = mode === "manager" && phase === "swiss" && managerActiveEvent?.format === "round-robin";
  const managerRoundRobinRounds = managerRoundRobinActive ? Math.max(1, managerActiveEvent.capacity - 1) : 0;
  const managerRoundRobinRound = record.wins + record.losses + 1;
  const swissPairs = useMemo(
    () => managerRoundRobinActive
      ? buildRoundRobinRoundPairs(yourTeam, swissField, managerRoundRobinRound)
      : buildSwissPairs(yourTeam, opponent, swissField, record, swissRecords, swissHistory),
    [managerRoundRobinActive, managerRoundRobinRound, opponent, record, swissField, swissHistory, swissRecords, yourTeam],
  );
  const swissUserFinished = runKind === "player" && phase === "swiss" && (managerRoundRobinActive
    ? record.wins + record.losses >= managerRoundRobinRounds
    : record.wins >= 3 || record.losses >= 3);
  const swissStageResolved = phase === "swiss" && (managerRoundRobinActive
    ? record.wins + record.losses >= managerRoundRobinRounds
    : isSwissStageResolved(swissField, swissRecords, record));
  const swissCanSim = !managerRoundRobinActive && swissUserFinished && !swissStageResolved;
  const circuitStageOnly = mode === "circuit" && !circuitEvent.hasPlayoffs;
  const circuitStageCleared = circuitStageOnly && record.wins >= 3 && swissStageResolved;
  const circuitNextEvent = nextCircuitEvent(circuitEvent);
  const managerMajorStageOnly = managerMajorActive && Boolean(managerMajorStage && !managerMajorStage.hasPlayoffs);
  const managerMajorStageCleared = managerMajorStageOnly && record.wins >= 3 && swissStageResolved;
  const managerMajorNextStage = managerMajorStage ? nextCircuitEvent(managerMajorStage) : undefined;
  const neutralSwissRun = runKind === "spectator" || circuitObserver;
  const spectatorSwissResolved = neutralSwissRun && phase === "swiss" && isNeutralSwissStageResolved(swissField, swissRecords);
  const spectatorSwissPairs = useMemo(
    () =>
      neutralSwissRun && phase === "swiss" && !spectatorSwissResolved
        ? buildRemainingSwissPairs(swissField, swissRecords, spectatorSwissRound, swissHistory)
        : [],
    [neutralSwissRun, phase, spectatorSwissResolved, spectatorSwissRound, swissField, swissRecords, swissHistory],
  );
  const swissDisplayPairs = useMemo(
    () => (swissUserFinished
      ? managerRoundRobinActive ? [] : buildRemainingSwissPairs(swissField, swissRecords, record.wins + record.losses + 1, swissHistory)
      : swissPairs),
    [managerRoundRobinActive, record, swissField, swissPairs, swissRecords, swissUserFinished, swissHistory],
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
  const normalizedCircuitArchive = useMemo(
    () => normalizeCircuitResultArchive(circuitMajorResults, activeMajorStageEvent),
    [activeMajorStageEvent, circuitMajorResults],
  );
  const majorRunResults = useMemo(
    () => mode === "circuit" || managerMajorActive
      ? [...normalizedCircuitArchive, ...tagCircuitResults(matchResults, activeMajorStageEvent)]
      : matchResults,
    [activeMajorStageEvent, managerMajorActive, matchResults, mode, normalizedCircuitArchive],
  );
  const managerArchivedEvent = managerHistoryEntry?.archive;
  const managerArchivedDefinition = managerHistoryEntry ? managerEventForHistory(managerHistoryEntry) : undefined;
  const archivedMajorStage = managerArchivedEvent?.majorStage
    ? circuitEventById(overviewEventId ?? managerArchivedEvent.majorStage)
    : undefined;
  const overviewCircuitEvent = managerArchivedEvent
    ? archivedMajorStage
    : mode === "circuit" || managerMajorActive
      ? circuitEventById(overviewEventId ?? activeMajorStageEvent.id)
      : undefined;
  const overviewIsCurrentEvent = !managerArchivedEvent && (!overviewCircuitEvent || overviewCircuitEvent.id === activeMajorStageEvent.id);
  const overviewAllResults = managerArchivedEvent?.results ?? majorRunResults;
  const overviewResults = useMemo(
    () => managerArchivedEvent
      ? archivedMajorStage
        ? managerArchivedEvent.results.filter((result) => result.eventId === archivedMajorStage.id)
        : managerArchivedEvent.results
      : overviewCircuitEvent
        ? majorRunResults.filter((result) => result.eventId === overviewCircuitEvent.id)
        : matchResults,
    [archivedMajorStage, majorRunResults, managerArchivedEvent, matchResults, overviewCircuitEvent],
  );
  const overviewTeams = useMemo(() => {
    if (managerArchivedEvent) {
      const resultTeams = teamsFromResults(overviewResults);
      return resultTeams.length ? resultTeams : managerArchivedEvent.teams;
    }
    if (overviewIsCurrentEvent) {
      return Array.from(
        new Map(
          (neutralSwissRun ? swissField : [yourTeam, ...swissField]).map((team) => [team.id, team]),
        ).values(),
      );
    }
    return teamsFromResults(overviewResults);
  }, [managerArchivedEvent, neutralSwissRun, overviewIsCurrentEvent, overviewResults, swissField, yourTeam]);
  const overviewRecords = useMemo(
    () => managerArchivedEvent && !archivedMajorStage
      ? managerArchivedEvent.records
      : overviewIsCurrentEvent
      ? neutralSwissRun
        ? swissRecords
        : { ...swissRecords, user: record }
      : recordsFromResults(overviewTeams, overviewResults),
    [archivedMajorStage, managerArchivedEvent, neutralSwissRun, overviewIsCurrentEvent, overviewResults, overviewTeams, record, swissRecords],
  );
  const overviewAvailableEventIds = useMemo(() => {
    const ids = new Set<CircuitEventId>([
      managerArchivedEvent?.majorStage ?? activeMajorStageEvent.id,
    ]);
    overviewAllResults.forEach((result) => {
      if (result.eventId) ids.add(result.eventId);
    });
    return [...ids];
  }, [activeMajorStageEvent.id, managerArchivedEvent?.majorStage, overviewAllResults]);
  const overviewPhase: TournamentPhase = managerArchivedEvent
    ? archivedMajorStage?.hasPlayoffs && overviewResults.some((result) => result.stage !== "swiss")
      ? "playoffs"
      : managerArchivedEvent.phase
    : overviewIsCurrentEvent
    ? phase
    : overviewCircuitEvent?.hasPlayoffs && overviewResults.some((result) => result.stage !== "swiss")
      ? "playoffs"
      : "swiss";
  const overviewOutcome: TournamentOutcome = managerArchivedEvent?.outcome ?? (overviewIsCurrentEvent ? tournamentOutcome : "complete");
  const overviewWinner = managerArchivedEvent
    ? winnerFromFinal(overviewResults) ?? (archivedMajorStage?.id === managerArchivedEvent.majorStage ? managerArchivedEvent.winner : undefined)
    : overviewIsCurrentEvent
    ? tournamentOutcome === "champion"
      ? yourTeam
      : tournamentWinner
    : winnerFromFinal(overviewResults);
  const overviewPlayoffRound = managerArchivedEvent?.playoffRound ?? (overviewIsCurrentEvent ? playoffRound : latestPlayoffRound(overviewResults));
  const overviewPlayerDatabase = useMemo(() => buildPlayerDatabase(overviewResults), [overviewResults]);
  const playerDatabase = useMemo(() => buildPlayerDatabase(matchResults), [matchResults]);
  const selectedResult = useMemo(
    () =>
      matchResults.find((result) => result.id === selectedResultId) ??
      majorRunResults.find((result) => result.id === selectedResultId) ??
      managerArchivedEvent?.results.find((result) => result.id === selectedResultId) ??
      matchResults[matchResults.length - 1] ??
      majorRunResults[majorRunResults.length - 1] ??
      managerArchivedEvent?.results[managerArchivedEvent.results.length - 1],
    [majorRunResults, managerArchivedEvent, matchResults, selectedResultId],
  );
  const runDone =
    runKind === "player" &&
    (tournamentOutcome !== "running" || (phase === "swiss" && !managerRoundRobinActive && record.losses >= 3) || circuitStageCleared || managerMajorStageCleared);
  const overviewDrilldown = navStack[navStack.length - 1] === "overview";
  const managerArchiveDrilldown = Boolean(managerArchivedEvent && (screen === "overview" || navStack.includes("overview")));
  const universeDrilldown = navStack[navStack.length - 1] === "universe";
  const canSimPlayoffPhase =
    phase === "playoffs" &&
    playoffPairs.length > 0 &&
    tournamentOutcome !== "champion" &&
    tournamentOutcome !== "complete" &&
    (runKind === "spectator" || circuitObserver || tournamentOutcome === "eliminated");
  const currentBestOf = phase === "playoffs"
    ? mode === "manager" && managerActiveEvent?.format === "single-elimination" && playoffRound === "quarterfinal"
      ? managerActiveEvent.groupBestOf
      : playoffBestOf(playoffRound)
    : managerRoundRobinActive
      ? managerActiveEvent?.groupBestOf ?? 3
      : swissBestOf(record);
  const currentSeriesLabel = phase === "playoffs"
    ? `${tournamentName} / ${playoffRoundLabel(playoffRound)}`
    : managerRoundRobinActive
      ? `${tournamentName} / Round robin matchday ${record.wins + record.losses + 1}`
      : `${tournamentName} / Swiss round ${record.wins + record.losses + 1}`;
  const strengthBreakdown = teamStrengthBreakdown(yourTeam, settings);
  const opponentStrengthBreakdown = teamStrengthBreakdown(opponent, settings, difficulty, true);
  const strength = strengthBreakdown.total;
  const opponentStrength = opponentStrengthBreakdown.total;
  const paperEdge = strength - opponentStrength;
  const resultMapResults = match
    ? series
      ? [...series.mapResults, mapResultFromState(match.map, match, series.left, series.right)]
      : [mapResultFromState(match.map, match, yourTeam, opponent)]
    : [];
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
  const hasEventOverview = runKind === "spectator" || (selected.length === 5 && Boolean(coach)) || matchResults.length > 0 || phase === "playoffs";
  const hasSaveUniverse = runKind === "player" && selected.length === 5 && Boolean(coach);

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

  function openEventOverview() {
    setManagerHistoryEntry(null);
    setOverviewEventId(mode === "circuit" ? circuitEvent.id : null);
    pushScreen("overview");
  }

  function openManagerHistoryEntry(entry: CareerHistoryEntry) {
    setManagerHistoryEntry(entry);
    if (entry.archive) {
      setOverviewEventId(entry.archive.majorStage ?? null);
      pushScreen("overview");
      return;
    }
    pushScreen("manager-event-overview");
  }

  function openCompletedManagerEvent(eventId: string) {
    const entry = [...careerHistory].reverse().find((item) => (
      item.managerEventId === eventId
      || item.archive?.eventId === eventId
      || managerEventForHistory(item)?.id === eventId
    ));
    if (entry) openManagerHistoryEntry(entry);
  }

  function openSaveUniverse() {
    if (!hasSaveUniverse || screen === "universe") return;
    if (mode === "manager") {
      if (screen !== "manager-home") pushScreen("manager-home");
      return;
    }
    pushScreen("universe");
  }

  function openCurrentTeamVault() {
    setVaultTeamId(yourTeam.id);
    pushScreen("vault-team");
  }

  function openUniverseHistory(entry: CareerHistoryEntry) {
    if (mode === "circuit" && entry.eventId && (entry.season ?? circuitSeason) === circuitSeason) {
      setOverviewEventId(entry.eventId);
      pushScreen("overview");
      return;
    }
    openCurrentTeamVault();
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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [screen]);

  // Older saves may contain a team that was eliminated in an early Major stage and then returned
  // as a later direct invite. Repair an untouched stage without rewriting any played results.
  useEffect(() => {
    if (mode !== "circuit" || phase !== "swiss" || matchResults.length || match || series) return;
    const repairedField = repairUnplayedCircuitField(rosterPool, circuitEvent, swissField, normalizedCircuitArchive);
    if (repairedField.every((team, index) => team.id === swissField[index]?.id)) return;

    const repairedRecords = initialSwissRecords(repairedField);
    setSwissField(repairedField);
    setSwissRecords(repairedRecords);
    setOpponent((current) =>
      repairedField.find((team) => team.id === current.id) ??
      (circuitObserver || runKind === "spectator"
        ? repairedField[0] ?? current
        : selectOpponentForRecord({ wins: 0, losses: 0 }, repairedField, repairedRecords, [])),
    );
    setPickems({});
    setLastPickemDelta(0);
  }, [circuitEvent, circuitObserver, match, matchResults.length, mode, normalizedCircuitArchive, phase, rosterPool, runKind, series, swissField]);

  // Manager fields are save snapshots, so older careers can still carry archival opponents or the
  // retired standalone MRQ bracket. Repair only an untouched event and preserve every played result.
  useEffect(() => {
    if (mode !== "manager" || !managerActiveEvent) return;

    const expectedOpponentCount = managerActiveEvent.majorCycle
      ? SWISS_OPPONENT_COUNT
      : Math.max(1, managerActiveEvent.capacity - 1);
    const currentOpponentIds = new Set(managerEventRosters.map((roster) => roster.id));
    const isManagedOrganization = (team: FieldTeam) => (
      Boolean(managerControlledOrganizationId && team.id === managerControlledOrganizationId)
      || Boolean(managerControlledOrganizationName && team.name.trim().toLowerCase() === managerControlledOrganizationName)
    );
    const fieldIsCurrent = swissField.length === expectedOpponentCount
      && swissField.every((team) => currentOpponentIds.has(team.id) && !isManagedOrganization(team));
    const duplicateManagedOrganization = swissField.find(isManagedOrganization);
    const invalidMajorBracket = managerActiveEvent.majorCycle
      && managerMajorStage
      && !managerMajorStageHasPlayoffs(managerMajorStage.id)
      && phase !== "swiss";

    if (duplicateManagedOrganization) {
      const candidateField = managerActiveEvent.majorCycle && managerMajorStage
        ? buildManagerMajorField(managerEventRosters, managerMajorStage, managerControlledOrganizationId)
        : buildManagerField(managerEventRosters, managerActiveEvent, managerControlledOrganizationId);
      const occupiedIds = new Set(swissField.map((team) => team.id));
      const replacement = candidateField.find((team) => !occupiedIds.has(team.id));
      if (replacement) {
        const nextField = swissField.map((team) => team.id === duplicateManagedOrganization.id ? replacement : team);
        const displacedRecord = swissRecords[duplicateManagedOrganization.id];
        const nextRecords = { ...swissRecords };
        delete nextRecords[duplicateManagedOrganization.id];
        nextRecords[replacement.id] = nextRecords[replacement.id] ?? displacedRecord ?? { wins: 0, losses: 0 };
        setSwissField(nextField);
        setSwissRecords(nextRecords);
        setPlayoffPairs((pairs) => pairs.map((pair) => ({
          ...pair,
          left: pair.left.id === duplicateManagedOrganization.id ? replacement : pair.left,
          right: pair.right.id === duplicateManagedOrganization.id ? replacement : pair.right,
        })));
        if (opponent.id === duplicateManagedOrganization.id) {
          setOpponent(replacement);
          setSeries(undefined);
          setMatch(undefined);
          setVeto(createVeto());
        }
        return;
      }
    }

    if (invalidMajorBracket) {
      setPhase("swiss");
      setPlayoffRound("quarterfinal");
      setPlayoffPairs([]);
      setSeries(undefined);
      setMatch(undefined);
      setVeto(createVeto());
      if (["playoffs", "veto", "match", "result", "series-detail"].includes(screen)) setScreen("swiss");
      if (matchResults.length || fieldIsCurrent) return;
    }

    if (matchResults.length || match || fieldIsCurrent) return;

    const repairedField = managerActiveEvent.majorCycle && managerMajorStage
      ? buildManagerMajorField(managerEventRosters, managerMajorStage, managerControlledOrganizationId)
      : buildManagerField(managerEventRosters, managerActiveEvent, managerControlledOrganizationId);
    const repairedRecords = initialSwissRecords(repairedField);

    if (!managerActiveEvent.majorCycle && managerActiveEvent.format === "single-elimination") {
      const pairs = buildPlayoffPairs("quarterfinal", [yourTeam, ...repairedField.slice(0, 7)], yourTeam);
      const active = pairs.find((pair) => pair.active) ?? pairs[0];
      setSwissField(repairedField);
      setSwissRecords(repairedRecords);
      setPhase("playoffs");
      setPlayoffRound("quarterfinal");
      setPlayoffPairs(pairs);
      if (active) setOpponent(active.left.id === "user" ? active.right : active.left);
      setVeto(createVeto());
      setSeries(undefined);
      if (screen === "swiss") setScreen("playoffs");
      return;
    }

    const pairs = managerActiveEvent.format === "round-robin"
      ? buildRoundRobinRoundPairs(yourTeam, repairedField, 1)
      : [];
    const active = pairs.find((pair) => pair.active);
    const expectedOpponent = active
      ? active.left.id === "user" ? active.right : active.left
      : selectOpponentForRecord({ wins: 0, losses: 0 }, repairedField, repairedRecords, []);
    setSwissField(repairedField);
    setSwissRecords(repairedRecords);
    if (expectedOpponent) setOpponent(expectedOpponent);
    setPhase("swiss");
    setPlayoffRound("quarterfinal");
    setPlayoffPairs([]);
    setRecord({ wins: 0, losses: 0 });
    setSeries(undefined);
    setVeto(createVeto());
    setPickems({});
    setLastPickemDelta(0);
    if (["playoffs", "swiss", "veto", "result"].includes(screen)) setScreen("swiss");
  }, [
    managerActiveEvent,
    managerControlledOrganizationId,
    managerControlledOrganizationName,
    managerEventRosters,
    managerMajorStage,
    match,
    matchResults.length,
    mode,
    opponent.id,
    phase,
    screen,
    swissField,
    swissRecords,
    yourTeam,
  ]);

  // Kick off the Vault's IndexedDB load and flip dbReady once its full history is in memory.
  const [dbReady, setDbReady] = useState(false);
  const [vaultRevision, setVaultRevision] = useState(0);
  const universeVaultProfile = dbReady ? getMatchDb().teamProfile(yourTeam.id) : undefined;
  useEffect(() => {
    getMatchDb(); // start the async load
    let live = true;
    matchDbReady.then(() => live && setDbReady(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    const removed = getMatchDb().removeExactDuplicateRunEvents();
    if (removed) setVaultRevision((revision) => revision + 1);
  }, [dbReady]);

  // One-time compatibility pass for saves whose older Vault maps predate event metadata. Career
  // history supplies the completed event boundaries; active-stage ids stay out of the backfill and
  // are upgraded by the normal recording effect below.
  useEffect(() => {
    if (!dbReady || runKind !== "player" || !careerHistory.length) return;
    const activeMatchIds = new Set<string>();
    if (screen !== "transfer") {
      matchResults.forEach((result) => {
        result.maps.forEach((map, index) => activeMatchIds.add(`${result.id}-${map.map}-${index}`));
      });
    }
    const updated = getMatchDb().backfillTeamCareerEvents(
      yourTeam.id,
      vaultRunId,
      careerHistory.map((entry) => ({
        eventId: entry.eventId ?? "major",
        eventName: entry.eventName ?? `Major ${entry.event}`,
        season: entry.season ?? entry.event,
        tier: entry.tier,
        wins: entry.record.wins,
        losses: entry.record.losses,
      })),
      activeMatchIds,
    );
    if (updated) setVaultRevision((revision) => revision + 1);
  }, [careerHistory, dbReady, matchResults, runKind, screen, vaultRunId, yourTeam.id]);

  // Saved careers can contribute their placement ledger even when they are not the active run. This
  // is what lets the Vault repair an older career opened from the setup screen. If no save still owns
  // the remaining legacy maps, infer separate Majors from their round/stage resets.
  useEffect(() => {
    if (!dbReady) return;
    const candidates = [
      ...runSlots.map((slot) => ({
        id: slot.snapshot.vaultRunId ?? `legacy-save:${slot.id}`,
        updatedAt: slot.updatedAt,
        snapshot: slot.snapshot,
      })),
      ...(autosave
        ? [{
            id: autosave.snapshot.vaultRunId ?? `legacy-autosave:${autosave.updatedAt}`,
            updatedAt: autosave.updatedAt,
            snapshot: autosave.snapshot,
          }]
        : []),
    ]
      .filter(({ snapshot }) => snapshot.runKind !== "spectator" && (snapshot.careerHistory?.length ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.snapshot.careerHistory?.length ?? 0) - (a.snapshot.careerHistory?.length ?? 0) ||
          b.updatedAt.localeCompare(a.updatedAt),
      );
    const db = getMatchDb();
    const savedActiveMatchIds = new Set<string>();
    candidates.forEach(({ snapshot }) => {
      if (snapshot.screen === "transfer") return;
      (snapshot.matchResults ?? []).forEach((result) => {
        result.maps.forEach((map, index) => savedActiveMatchIds.add(`${result.id}-${map.map}-${index}`));
      });
    });
    let updated = 0;
    candidates.forEach(({ id, snapshot }) => {
      updated += db.backfillTeamCareerEvents(
        "user",
        id,
        (snapshot.careerHistory ?? []).map((entry) => ({
          eventId: entry.eventId ?? "major",
          eventName: entry.eventName ?? `Major ${entry.event}`,
          season: entry.season ?? entry.event,
          tier: entry.tier,
          wins: entry.record.wins,
          losses: entry.record.losses,
        })),
        savedActiveMatchIds,
      );
    });
    updated += db.inferLegacyTeamCareerEvents("user", "legacy-inferred", savedActiveMatchIds);
    if (updated) setVaultRevision((revision) => revision + 1);
  }, [autosave, dbReady, runSlots]);

  // Accrue every completed map into the persistent match database (survives reloads and spans runs).
  // Gated on dbReady so we never write onto a half-loaded cache (which would clobber the loaded history).
  const recordedMatchResultsRef = useRef<typeof matchResults | null>(null);
  useEffect(() => {
    if (!dbReady || !matchResults.length || recordedMatchResultsRef.current === matchResults) return;
    recordedMatchResultsRef.current = matchResults;
    recordResultsToDb(matchResults, {
      runId: vaultRunId,
      eventId: mode === "circuit" ? circuitEvent.id : mode === "manager" ? managerActiveEvent?.id ?? "manager" : "major",
      eventName: mode === "circuit"
        ? circuitEvent.name
        : mode === "manager"
          ? managerActiveEvent ? managerEventName(managerActiveEvent, managerCareer?.season ?? 1) : "Manager event"
          : `Major ${careerEvent}`,
      season: mode === "circuit" ? circuitSeason : mode === "manager" ? managerCareer?.season ?? 1 : careerEvent,
    });
  }, [careerEvent, circuitEvent.id, circuitEvent.name, circuitSeason, dbReady, managerActiveEvent?.id, managerActiveEvent?.name, managerCareer?.season, matchResults, mode, vaultRunId]);

  useEffect(() => {
    saveCustomRosters(customRosters);
  }, [customRosters]);

  // Rolling autosave so a reload resumes the run/career. Fires only at stable points (screen/phase/
  // results/career changes), NOT during the live round drip, to avoid spamming localStorage.
  useEffect(() => {
    if (runKind !== "player") return;
    // Skip the pre-run flow and pure-viewer screens so the autosave reflects the last resumable game
    // state (swiss / playoffs / match / result / veto / transfer), not a transient sub-view.
    const transient: Screen[] = [
      "setup",
      "teams",
      "draft",
      "coach",
      "vault",
      "vault-replay",
      "vault-team",
      "universe",
      "overview",
      "manager-history",
      "manager-event-overview",
      "results",
      "series-detail",
      "stats",
      "balance-lab",
      "player-detail",
      "team-detail",
      "compare",
    ];
    if (transient.includes(screen)) return;
    writeAutosave(buildRunSnapshot(), buildRunSummary());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, phase, record, swissField, matchResults, careerMoney, careerEvent, selected, tournamentOutcome, circuitEventId, circuitSeason, circuitPoints, circuitMajorResults, circuitObserver, circuitOffseasonTarget, autoCoach, managerCareer]);

  useEffect(() => {
    if (screen !== "veto" || !veto.pendingOpponent) return;
    const timer = window.setTimeout(() => {
      setVeto((current) => applyOpponentVeto(current, opponent));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [screen, veto.pendingOpponent?.action, veto.pendingOpponent?.map, opponent]);

  useEffect(() => {
    if (!autoCoach) {
      lastAutoCoachRoundRef.current = undefined;
      return;
    }
    if (screen !== "match" || !match?.running || match.ended || (match.pendingEvents?.length ?? 0) > 0) return;

    const roundKey = `${series?.id ?? "standalone"}-${series?.currentMapIndex ?? 0}-${match.map}-${match.round}`;
    if (lastAutoCoachRoundRef.current === roundKey) return;
    lastAutoCoachRoundRef.current = roundKey;

    const roundRead = buildRoundRead(match, yourTeam, opponent, settings, totalYourMoney, totalOpponentMoney);
    const timeoutRead = buildCoachDeskRead(match, yourTeam, opponent, timeouts, timeoutPlan);
    const decision = decideAutoCoach({
      currentTactic: tactic,
      recommendedTactic: roundRead.tactic,
      recommendationLabel: roundRead.label,
      recommendationReason: roundRead.reason,
      timeoutRecommended: timeoutRead.canCallTimeout,
      timeoutPriority: timeoutRead.tone,
      timeoutLabel: timeoutRead.label,
      timeoutReason: timeoutRead.reason,
      availableTimeouts: timeouts,
      timeoutRounds: timeoutPlan.rounds,
      roundsPlayed: match.roundWinners.length,
    });

    if (decision.changedTactic) setTactic(decision.tactic);
    setAutoCoachStatus(decision.status);
    if (decision.callTimeout) useTimeout("auto");
  }, [
    autoCoach,
    match,
    opponent,
    screen,
    series?.currentMapIndex,
    series?.id,
    settings,
    tactic,
    timeouts,
    timeoutPlan,
    totalOpponentMoney,
    totalYourMoney,
    yourTeam,
  ]);

  useEffect(() => {
    if (screen !== "match" || !match?.running || match.ended) return;
    if (liveTimeoutRef.current) return;
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
    setVaultRunId(createVaultRunId());
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
    setCareerActive(false);
    setCareerMoney(0);
    setCareerEvent(1);
    setCareerHistory([]);
    setCircuitEventId(firstCircuitEventId);
    setCircuitSeason(1);
    setCircuitPoints(0);
    setCircuitMajorResults([]);
    setCircuitObserver(false);
    setCircuitOffseasonTarget(null);
    setTransferCandidates([]);
    setTransferTrade(null);
    setProgressionSummary([]);
    setManagerCareer(undefined);
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
    if (mode === "manager") {
      setCurrentRoster(rosterPool[0] ?? builtInHltvRosters[0]);
      setScreen("manager-select");
      return;
    }
    if (mode === "random") {
      setSelected(randomFiveWithIgl(rosterPool).map((player, index) => draftedPlayerCopy(player, index)));
      openCoachDraft();
      return;
    }
    setScreen("draft");
    rollRoster([]);
  }

  function activateManagerOrganization(roster: Roster, players: Player[], nextCoach?: Coach) {
    const nextCareer = createManagerCareer(vaultRunId, {
      organizationId: roster.id,
      organizationName: roster.name,
      organizationCountry: roster.country,
      vrsPoints: roster.vrsPoints ?? 900,
      vrsRank: roster.rank ?? Math.min(64, builtInRosterCount + 1),
      players,
    });
    const idlePool = rosterPool.filter((item) => item.id !== roster.id);
    const idleField = buildSwissField(idlePool.length ? idlePool : rosterPool);
    setCurrentRoster(roster);
    setTeamName(roster.name);
    setSelected(players);
    setCoach(nextCoach);
    setManagerCareer(nextCareer);
    setCareerActive(true);
    setCareerMoney(nextCareer.cash);
    setPlayerForm(generatePlayerForm(players));
    setAchievements((current) => unlockAchievements(current, draftAchievements(players)));
    setSwissField(idleField);
    setSwissRecords(initialSwissRecords(idleField));
    setOpponent(idleField[0] ?? opponent);
    setScreen("manager-home");
  }

  function chooseManagerOrganization(roster: Roster) {
    const inheritedPlayers = roster.players.slice(0, 5).map(withCareerMeta);
    const inheritedCoach = coachForRoster(roster);
    setCurrentRoster(roster);
    setTeamName(roster.name);
    setSelected(inheritedPlayers);
    if (inheritedCoach) {
      activateManagerOrganization(roster, inheritedPlayers, inheritedCoach);
      return;
    }
    setCoach(undefined);
    openCoachDraft();
  }

  function startSpectatorRun() {
    const nextSwissField = buildSpectatorField(rosterPool);
    const nextSwissRecords = initialSwissRecords(nextSwissField);
    setActiveSaveId(undefined);
    setSaveMessage("");
    setVaultRunId(createVaultRunId());
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
    setPlayerFinish(null);
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
    if (mode === "manager") {
      activateManagerOrganization(currentRoster, selected, nextCoach);
      return;
    }
    const nextSwissField = mode === "circuit"
      ? buildCircuitField(rosterPool, circuitEventById(circuitEventId))
      : buildSwissField(rosterPool);
    const nextSwissRecords = initialSwissRecords(nextSwissField);
    const rival = selectOpponentForRecord({ wins: 0, losses: 0 }, nextSwissField, nextSwissRecords, []);
    setPhase("swiss");
    setPlayoffRound("quarterfinal");
    setPlayoffPairs([]);
    setTournamentOutcome("running");
    setPlayerFinish(null);
    setTournamentWinner(undefined);
    setSwissField(nextSwissField);
    setSwissRecords(nextSwissRecords);
    setSpectatorSwissRound(1);
    setOpponent(rival);
    setPlayedOpponentIds([]);
    setMatchResults([]);
    setCircuitMajorResults([]);
    setCircuitObserver(false);
    setCircuitOffseasonTarget(null);
    setSelectedResultId(undefined);
    setStatsScope("all");
    setSeries(undefined);
    setMatch(undefined);
    setPlayerForm(generatePlayerForm(selected));
    setAchievements((current) => unlockAchievements(current, draftAchievements(selected)));
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
    liveTimeoutRef.current = false;
    setTactic("standard");
    setSeries(nextSeries);
    setMatch(initMatch(maps[0], yourTeam, opponent, { stage: nextSeries.stage }));
    setScreen("match");
  }

  function useTimeout(source: "manual" | "auto" = "manual") {
    if (timeouts <= 0 || !match || match.ended) return;
    liveTimeoutRef.current = true;
    const plan = tacticalTimeoutPlan(match, yourTeam, opponent);
    setTimeouts((value) => value - 1);
    setTimeoutPlan(plan);
    setMatch({
      ...match,
      running: false,
      lastReason: `${source === "auto" ? "Auto Coach called a timeout." : "Timeout called."} ${coach?.handle ?? "Coach"} adds +${(plan.boost * 100).toFixed(1)}% for ${plan.rounds} rounds.`,
    });
    window.setTimeout(() => {
      liveTimeoutRef.current = false;
      setMatch((current) => (current && !current.ended ? { ...current, running: true, lastReason: "Timeout complete. Back into the server." } : current));
    }, 3000);
  }

  function applyManualTactic(nextTactic: Tactic) {
    setAutoCoach(false);
    setAutoCoachStatus(`Manual / ${formatTacticLabel(nextTactic)}`);
    setTactic(nextTactic);
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

    if (managerRoundRobinActive && managerActiveEvent) {
      const roundNumber = record.wins + record.losses + 1;
      const nextRecord = {
        wins: record.wins + (playedResult.winnerId === "user" ? 1 : 0),
        losses: record.losses + (playedResult.winnerId === "user" ? 0 : 1),
      };
      const outsideResults = swissPairs
        .filter((pair) => !pair.active)
        .map((pair) => simulateSwissSeries(pair, roundNumber, settings, difficulty, swissRecords, managerActiveEvent.groupBestOf));
      const roundResults = [playedResult, ...outsideResults];
      const roundPickemScore = outsideResults.reduce(
        (sum, result) => sum + (pickems[result.pairId] === result.winnerId ? 1 : 0),
        0,
      );
      const nextSwissRecords = applyResultsToSwissRecords(swissRecords, roundResults);
      const nextPlayedOpponentIds = [...playedOpponentIds, opponent.id];
      setMatchResults((current) => [...current, ...roundResults]);
      setSelectedResultId(playedResult.id);
      setSeries(undefined);
      setMatch(undefined);
      setSwissRecords(nextSwissRecords);
      setPlayedOpponentIds(nextPlayedOpponentIds);
      setRecord(nextRecord);
      setPickemScore((value) => value + roundPickemScore);
      setLastPickemDelta(roundPickemScore);
      setPickems({});

      if (roundNumber >= managerRoundRobinRounds) {
        const standings = [yourTeam, ...swissField].sort((left, right) => {
          const leftRecord = left.id === "user" ? nextRecord : nextSwissRecords[left.id] ?? { wins: 0, losses: 0 };
          const rightRecord = right.id === "user" ? nextRecord : nextSwissRecords[right.id] ?? { wins: 0, losses: 0 };
          return rightRecord.wins - leftRecord.wins
            || leftRecord.losses - rightRecord.losses
            || teamStrength(right, settings, difficulty) - teamStrength(left, settings, difficulty);
        });
        const qualifiers = standings.slice(0, 4);
        if (qualifiers.some((team) => team.id === "user")) {
          const pairs = buildRoundRobinPlayoffPairs(qualifiers, yourTeam);
          const active = pairs.find((pair) => pair.active) ?? pairs[0];
          setPhase("playoffs");
          setPlayoffRound("semifinal");
          setPlayoffPairs(pairs);
          setOpponent(active.left.id === "user" ? active.right : active.left);
          setVeto(createVeto());
          setScreen("playoffs");
          return;
        }
        setTournamentOutcome("eliminated");
        setPlayerFinish("swiss");
        setScreen("swiss");
        return;
      }

      const nextPairs = buildRoundRobinRoundPairs(yourTeam, swissField, roundNumber + 1);
      const nextActive = nextPairs.find((pair) => pair.active);
      if (nextActive) setOpponent(nextActive.left.id === "user" ? nextActive.right : nextActive.left);
      setVeto(createVeto());
      setScreen("swiss");
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
        if ((mode === "circuit" && !circuitEvent.hasPlayoffs) || managerMajorStageOnly) {
          setScreen("swiss");
          return;
        }
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
      setPlayerFinish("swiss");
      if (isSwissStageResolved(swissField, nextSwissRecords, nextRecord)) {
        if ((mode === "circuit" && !circuitEvent.hasPlayoffs) || managerMajorStageOnly) {
          setScreen("swiss");
          return;
        }
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

    if (mode === "circuit" && !circuitEvent.hasPlayoffs) {
      setScreen("swiss");
      return;
    }

    if (record.wins >= 3) {
      enterPlayoffs(nextSwissRecords);
      return;
    }

    enterNeutralPlayoffs(nextSwissRecords, "eliminated");
  }

  function simSpectatorSwissPhase() {
    if (!neutralSwissRun || phase !== "swiss") return;
    setViewedSwissRound(null); // snap back to the live round when simming
    if (isNeutralSwissStageResolved(swissField, swissRecords)) {
      if (circuitObserver && !circuitEvent.hasPlayoffs) {
        advanceObservedCircuitStage();
      } else {
        enterNeutralPlayoffs(swissRecords, circuitObserver ? "eliminated" : "running");
      }
      return;
    }

    const pairs = buildRemainingSwissPairs(swissField, swissRecords, spectatorSwissRound, swissHistory);
    if (!pairs.length) {
      if (circuitObserver && !circuitEvent.hasPlayoffs) return;
      enterNeutralPlayoffs(swissRecords, circuitObserver ? "eliminated" : "running");
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
      if (circuitObserver && !circuitEvent.hasPlayoffs) return;
      enterNeutralPlayoffs(nextSwissRecords, circuitObserver ? "eliminated" : "running");
      return;
    }

    setSpectatorSwissRound((round) => Math.min(5, round + 1));
  }

  function roundTier(round: PlayoffRound): PlacementTier {
    return round === "final" ? "runner-up" : round === "semifinal" ? "top4" : "top8";
  }

  function simPlayoffPhase() {
    if (!playoffPairs.length || tournamentOutcome === "champion" || tournamentOutcome === "complete") return;
    const userInRound = playoffPairs.some((pair) => pair.left.id === "user" || pair.right.id === "user");
    const roundResults = playoffPairs.map((pair) => simulatePlayoffSeries(pair, playoffRound, settings, difficulty, currentBestOf));
    const winners = roundResults.map((result) => (result.winnerId === result.left.id ? result.left : result.right));
    const userWon = winners.some((team) => team.id === "user");
    setMatchResults((current) => [...current, ...roundResults]);
    setSelectedResultId(roundResults[roundResults.length - 1]?.id);

    if (playoffRound === "final") {
      const winner = winners[0];
      setTournamentWinner(winner);
      setTournamentOutcome(winner?.id === "user" ? "champion" : "complete");
      if (userInRound) setPlayerFinish(winner?.id === "user" ? "champion" : "runner-up");
      setScreen("playoffs");
      return;
    }

    if (userInRound && !userWon) setPlayerFinish(roundTier(playoffRound)); // you were knocked out this round
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
      .map((pair) => simulatePlayoffSeries(pair, playoffRound, settings, difficulty, currentBestOf));
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
        setPlayerFinish("runner-up");
        setScreen("playoffs");
        return;
      }
      const nextRound = playoffRound === "quarterfinal" ? "semifinal" : "final";
      const pairs = buildNeutralNextPlayoffPairs(nextRound, winners);
      setPlayerFinish(roundTier(playoffRound)); // the round you just LOST, before the bracket advances
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
      setPlayerFinish("champion");
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
    setCareerActive(false);
    setCareerMoney(0);
    setCareerEvent(1);
    setCareerHistory([]);
    setCircuitEventId(firstCircuitEventId);
    setCircuitSeason(1);
    setCircuitPoints(0);
    setCircuitMajorResults([]);
    setCircuitObserver(false);
    setCircuitOffseasonTarget(null);
    setTransferCandidates([]);
    setTransferTrade(null);
    setProgressionSummary([]);
    setManagerCareer(undefined);
    setPlayerFinish(null);
  }

  // ---- Career continuation -------------------------------------------------------------------------
  // Circuit stages settle independently, but player development and roster moves are an offseason-only
  // operation after the entire Major has finished.
  function recordCircuitStage(tier: PlacementTier) {
    const completedEvent = circuitEventById(circuitEventId);
    const progress = advanceCircuit(circuitEventId, tier, circuitSeason, circuitPoints);
    const prize = circuitPrize(completedEvent, tier);
    setCareerMoney((money) => (careerActive ? money : STARTING_BANKROLL) + prize);
    setCareerActive(true);
    setCareerHistory((history) => [
      ...history,
      {
        event: careerEvent,
        tier,
        prize,
        record: { ...record },
        eventId: completedEvent.id,
        eventName: completedEvent.name,
        season: circuitSeason,
        points: progress.pointsEarned,
        qualified: progress.qualified,
      },
    ]);
    setCircuitPoints(progress.points);
    return progress;
  }

  function openTransferForResults(tier: PlacementTier, results: SwissResult[], developmentCap?: number) {
    const ratings = majorPlayerRatings(results);
    const summary: Array<{ handle: string; before: number; after: number; iglDelta: number }> = [];
    const developed = selected.map((player) => {
      const meta = careerMetaForPlayer(player, hltvProspectPotentialBonus(player.handle));
      const rating = ratings.get(player.id) ?? expectedRating(player.ovr);
      const dev = developPlayer({
        player,
        rating,
        placement: tier,
        potential: meta.potential,
        maxGain: developmentCap,
        maxDrop: developmentCap == null ? undefined : 1,
        maxIglGain: developmentCap,
      });
      summary.push({ handle: player.handle, before: player.ovr, after: dev.ovr, iglDelta: dev.iglDelta });
      return {
        ...player,
        ovr: dev.ovr,
        stats: dev.stats,
        age: ageAfterMajor(meta.age),
        potential: meta.potential,
        potentialModelVersion: meta.potentialModelVersion,
      };
    });
    setSelected(developed);
    setProgressionSummary(summary);

    const picks = pickTransferCandidates(developed, comparePool.map((entry) => entry.player));
    setTransferCandidates(picks.map((player) => ({ player, team: playerTeamMap.get(player.id) ?? currentRoster })));
    setTransferTrade(null);
    setScreen("transfer");
  }

  function startCircuitStage(event: CircuitEvent, field: FieldTeam[], observer: boolean) {
    const nextSwissRecords = initialSwissRecords(field);
    const rival = observer
      ? field[0] ?? opponent
      : selectOpponentForRecord({ wins: 0, losses: 0 }, field, nextSwissRecords, []);
    setCircuitEventId(event.id);
    setCircuitObserver(observer);
    setRecord({ wins: 0, losses: 0 });
    setPhase("swiss");
    setPlayoffRound("quarterfinal");
    setPlayoffPairs([]);
    setTournamentOutcome(observer ? "eliminated" : "running");
    setPlayerFinish(observer ? "swiss" : null);
    setTournamentWinner(undefined);
    setSwissField(field);
    setSwissRecords(nextSwissRecords);
    setSpectatorSwissRound(1);
    setOpponent(rival);
    setPlayedOpponentIds([]);
    setMatchResults([]);
    setSelectedResultId(undefined);
    setPickems({});
    setLastPickemDelta(0);
    setViewedSwissRound(null);
    setSeries(undefined);
    setMatch(undefined);
    setVeto(createVeto());
    setScreen("swiss");
  }

  function advanceCircuitStage() {
    if (!circuitStageCleared) return;
    const progress = recordCircuitStage("top8");
    const nextEvent = circuitEventById(progress.nextEventId);
    const qualifiers = circuitStageQualifiers(swissField, swissRecords, yourTeam, record);
    const nextField = buildNextCircuitField(
      rosterPool,
      nextEvent,
      qualifiers,
      [yourTeam, ...swissField],
      true,
      normalizedCircuitArchive,
    );
    setCircuitMajorResults((results) => [...results, ...tagCircuitResults(matchResults, circuitEvent)]);
    setCircuitSeason(progress.season);
    setCircuitPoints(progress.points);
    setCareerEvent((event) => event + 1);
    startCircuitStage(nextEvent, nextField, false);
  }

  function advanceManagerMajorCycleStage() {
    if (!managerCareer || !managerMajorStageCleared || !managerMajorStage || !managerMajorNextStage) return;
    const qualifiers = circuitStageQualifiers(swissField, swissRecords, yourTeam, record);
    const archivedResults = [...normalizedCircuitArchive, ...tagCircuitResults(matchResults, managerMajorStage)];
    const nextField = buildNextCircuitField(
      rosterPool,
      managerMajorNextStage,
      qualifiers,
      [yourTeam, ...swissField],
      true,
      archivedResults,
    );
    const nextCareer = advanceManagerMajorStage(managerCareer, managerMajorNextStage.id as ManagerMajorStage);
    if (nextCareer === managerCareer) return;
    setCircuitMajorResults(archivedResults);
    commitManagerCareer(nextCareer);
    setPlayerForm(generateManagerPlayerForm(selected, nextCareer));
    startCircuitStage(managerMajorNextStage, nextField, false);
  }

  function circuitEliminationTarget(progress: ReturnType<typeof advanceCircuit>): CircuitOffseasonTarget {
    if (circuitEvent.hasPlayoffs) {
      return { eventId: progress.nextEventId, season: progress.season, points: progress.points };
    }
    return {
      eventId: circuitEvent.id,
      season: circuitSeason + 1,
      points: Math.round(progress.points * 0.72),
    };
  }

  function beginCircuitObservation() {
    if (mode !== "circuit" || record.losses < 3 || !swissStageResolved) return;
    const progress = recordCircuitStage("swiss");
    const target = circuitEliminationTarget(progress);
    setCircuitOffseasonTarget(target);
    setCircuitObserver(true);

    if (circuitEvent.hasPlayoffs) {
      enterNeutralPlayoffs(swissRecords, "eliminated");
      return;
    }

    const nextEvent = nextCircuitEvent(circuitEvent);
    const qualifiers = circuitStageQualifiers(swissField, swissRecords);
    const nextField = buildNextCircuitField(
      rosterPool,
      nextEvent,
      qualifiers,
      [yourTeam, ...swissField],
      false,
      normalizedCircuitArchive,
    );
    setCircuitMajorResults((results) => [...results, ...tagCircuitResults(matchResults, circuitEvent)]);
    startCircuitStage(nextEvent, nextField, true);
  }

  function advanceObservedCircuitStage() {
    if (!circuitObserver || circuitEvent.hasPlayoffs || !spectatorSwissResolved) return;
    const nextEvent = nextCircuitEvent(circuitEvent);
    const qualifiers = circuitStageQualifiers(swissField, swissRecords);
    const nextField = buildNextCircuitField(
      rosterPool,
      nextEvent,
      qualifiers,
      swissField,
      false,
      normalizedCircuitArchive,
    );
    setCircuitMajorResults((results) => [...results, ...tagCircuitResults(matchResults, circuitEvent)]);
    startCircuitStage(nextEvent, nextField, true);
  }

  function finishObservedCircuit() {
    const target = circuitOffseasonTarget;
    if (!target) return;
    const allResults = [...circuitMajorResults, ...matchResults];
    setCircuitEventId(target.eventId);
    setCircuitSeason(target.season);
    setCircuitPoints(target.points);
    setCircuitObserver(false);
    setCircuitOffseasonTarget(null);
    setCircuitMajorResults([]);
    openTransferForResults("swiss", allResults, 2);
  }

  function skipCircuitToNextSeason() {
    if (mode !== "circuit" || record.losses < 3 || !swissStageResolved) return;
    const progress = recordCircuitStage("swiss");
    const target = circuitEliminationTarget(progress);
    const simulated = simulateCircuitRemainder(
      circuitEvent,
      swissField,
      swissRecords,
      matchResults,
      normalizedCircuitArchive,
      rosterPool,
      settings,
      difficulty,
    );
    setTournamentWinner(simulated.winner);
    setCircuitEventId(target.eventId);
    setCircuitSeason(target.season);
    setCircuitPoints(target.points);
    setCircuitObserver(false);
    setCircuitOffseasonTarget(null);
    setCircuitMajorResults([]);
    openTransferForResults("swiss", [...circuitMajorResults, ...simulated.results], 2);
  }

  // Bank the completed Major, develop once from every stage played, then open the offseason.
  function enterTransferWindow() {
    const tier =
      playerFinish ??
      placementTier({ champion: tournamentOutcome === "champion", reachedPlayoffs: phase === "playoffs", playoffRound });
    const isCircuit = mode === "circuit";
    if (isCircuit && circuitObserver) {
      finishObservedCircuit();
      return;
    }
    if (isCircuit && !circuitEvent.hasPlayoffs) return;

    const completedEvent = circuitEventById(circuitEventId);
    const prize = isCircuit ? circuitPrize(completedEvent, tier) : prizeForPlacement(tier);
    const progress = isCircuit ? recordCircuitStage(tier) : undefined;
    if (!isCircuit) {
      setCareerMoney((money) => (careerActive ? money : STARTING_BANKROLL) + prize);
      setCareerActive(true);
      setCareerHistory((history) => [
        ...history,
        { event: careerEvent, tier, prize, record: { ...record }, eventName: "Major" },
      ]);
    }
    if (progress) {
      setCircuitEventId(progress.nextEventId);
      setCircuitSeason(progress.season);
      setCircuitPoints(progress.points);
    }

    const allResults = isCircuit ? [...circuitMajorResults, ...matchResults] : matchResults;
    setCircuitMajorResults([]);
    setCircuitObserver(false);
    setCircuitOffseasonTarget(null);
    openTransferForResults(tier, allResults, isCircuit ? 2 : undefined);
  }

  // The role-swap: send `outgoing` (your same-role player) to their team, receive `incoming`. A positive
  // delta is paid out of the bank; a negative delta (you traded a more valuable player) refunds the surplus.
  function doTransfer(incoming: Player, outgoing: Player) {
    if (transferTrade) return; // one trade per window
    const delta = transferDelta(incoming, outgoing);
    if (delta > careerMoney) return; // can't afford
    const careerIncoming = withCareerMeta(incoming);
    setSelected((current) => current.map((player) => (player.id === outgoing.id ? careerIncoming : player)));
    setCareerMoney((money) => money - delta);
    setTransferTrade({ incoming: careerIncoming, outgoing, delta });
  }

  function undoTransfer() {
    if (!transferTrade) return;
    const { incoming, outgoing, delta } = transferTrade;
    setSelected((current) => current.map((player) => (player.id === incoming.id ? outgoing : player)));
    setCareerMoney((money) => money + delta);
    setTransferTrade(null);
  }

  // Start the next event with the (possibly traded) roster — mirrors chooseCoach's reset but keeps the
  // roster, coach and bankroll.
  function startNextTournament() {
    setCareerEvent((event) => event + 1);
    const nextSwissField = mode === "circuit"
      ? buildCircuitField(rosterPool, circuitEventById(circuitEventId))
      : buildSwissField(rosterPool);
    const nextSwissRecords = initialSwissRecords(nextSwissField);
    const rival = selectOpponentForRecord({ wins: 0, losses: 0 }, nextSwissField, nextSwissRecords, []);
    setRecord({ wins: 0, losses: 0 });
    setPhase("swiss");
    setPlayoffRound("quarterfinal");
    setPlayoffPairs([]);
    setTournamentOutcome("running");
    setPlayerFinish(null);
    setTournamentWinner(undefined);
    setSwissField(nextSwissField);
    setSwissRecords(nextSwissRecords);
    setSpectatorSwissRound(1);
    setOpponent(rival);
    setPlayedOpponentIds([]);
    setMatchResults([]);
    setCircuitMajorResults([]);
    setCircuitObserver(false);
    setCircuitOffseasonTarget(null);
    setSelectedResultId(undefined);
    setStatsScope("all");
    setSeries(undefined);
    setMatch(undefined);
    setPlayerForm(generatePlayerForm(selected));
    setVeto(createVeto());
    setRunKind("player");
    setPlayerFinish(null);
    setScreen("swiss");
  }

  function commitManagerCareer(next: ManagerCareerState) {
    const current = managerCareer;
    if (current?.status === "bankrupt" && next !== current) return;
    const rankWorld = applyManagerRosterMoves(rosterPool, next.market.rosterMoves).filter((roster) => (
      isCurrentManagerWorldRoster(roster)
      && roster.id !== managerControlledOrganizationId
      && roster.name.trim().toLowerCase() !== next.organizationName.trim().toLowerCase()
    ));
    const authoritativeRank = circuitWorldRank(next.vrsPoints, rankWorld);
    const rankedNext: ManagerCareerState = {
      ...next,
      vrsRank: authoritativeRank,
      inbox: current && next.vrsPoints !== current.vrsPoints
        ? next.inbox.map((item) => item.kind === "ranking" && item.createdOn === next.date
          ? {
              ...item,
              title: authoritativeRank < current.vrsRank
                ? `VRS rise: #${current.vrsRank} to #${authoritativeRank}`
                : authoritativeRank > current.vrsRank
                  ? `VRS drop: #${current.vrsRank} to #${authoritativeRank}`
                  : `VRS position held at #${authoritativeRank}`,
              rankBefore: current.vrsRank,
              rankAfter: authoritativeRank,
            }
          : item)
        : next.inbox,
    };
    const crossedTime = current && rankedNext.date > current.date;
    const aiTransferActivity = crossedTime
      ? createManagerAiTransferActivity({
          seed: rankedNext.seed,
          rosters: applyManagerRosterMoves(rosterPool, rankedNext.market.rosterMoves).filter(isCurrentManagerWorldRoster),
          fromDate: current.date,
          toDate: rankedNext.date,
          existingMoves: rankedNext.market.rosterMoves,
          excludedOrganizationId: managerControlledOrganizationId,
          excludedOrganizationName: managerOrganization?.name ?? rankedNext.organizationName,
          recentPerformance: managerRecentPerformance,
        })
      : [];
    const transferSynchronized = aiTransferActivity.length
      ? {
          ...rankedNext,
          market: {
            ...rankedNext.market,
            rosterMoves: [...rankedNext.market.rosterMoves, ...aiTransferActivity.flatMap((activity) => activity.moves)],
          },
          inbox: [
            ...[...aiTransferActivity].reverse().map((activity) => ({
              id: activity.id,
              kind: "market" as const,
              createdOn: activity.date,
              title: activity.headline,
              body: activity.body,
              mandatory: false,
              read: false,
            })),
            ...rankedNext.inbox,
          ],
        }
      : rankedNext;
    const synchronized = crossedTime
      ? createManagerIncomingOffer(
          transferSynchronized,
          managerSquad,
          applyManagerRosterMoves(rosterPool, transferSynchronized.market.rosterMoves)
            .filter((roster) => (
              isCurrentManagerWorldRoster(roster)
              && roster.id !== managerControlledOrganizationId
              && roster.name.trim().toLowerCase() !== managerControlledOrganizationName
            )),
          rankedNext.date,
        )
      : transferSynchronized;
    setManagerCareer(synchronized);
    setCareerMoney(synchronized.cash);
  }

  function commitManagerTradeCareer(next: ManagerCareerState) {
    if (!managerCareer || next === managerCareer) return;
    const previousApplied = new Set(managerCareer.market.tradeOffers.filter((offer) => offer.appliedOn).map((offer) => offer.id));
    const completedTrades = next.market.tradeOffers.filter((offer) => offer.appliedOn && !previousApplied.has(offer.id));
    if (completedTrades.length) {
      setSelected((current) => completedTrades.reduce((roster, offer) => {
        const incoming = managerTransferList.find((candidate) => candidate.id === offer.incoming.id)?.player;
        if (!incoming) return roster;
        return roster.map((player) => player.id === offer.outgoing.id ? withCareerMeta(incoming) : player);
      }, current));
    }
    commitManagerCareer(next);
  }

  function commitManagerIncomingCareer(next: ManagerCareerState) {
    if (!managerCareer || next === managerCareer) return;
    const previousApplied = new Set(managerCareer.market.incomingOffers.filter((offer) => offer.appliedOn).map((offer) => offer.id));
    const soldPlayerIds = new Set(next.market.incomingOffers
      .filter((offer) => offer.appliedOn && !previousApplied.has(offer.id))
      .map((offer) => offer.targetPlayer.id));
    if (soldPlayerIds.size) {
      setSelected((current) => {
        const retained = current.filter((player) => !soldPlayerIds.has(player.id));
        const promoted = managerSquad.filter((player) => !soldPlayerIds.has(player.id) && !retained.some((starter) => starter.id === player.id));
        return [...retained, ...promoted].slice(0, 5);
      });
    }
    commitManagerCareer(next);
  }

  function registerForManagerEvent(eventId: string) {
    if (!managerCareer) return;
    const next = registerManagerEvent(managerCareer, eventId, selected.map((player) => player.id));
    if (next === managerCareer) return;
    commitManagerCareer(next);
  }

  function saveManagerStartingLineup(playerIds: string[]) {
    if (!managerCareer) return;
    const lineup = playerIds.map((id) => managerSquad.find((player) => player.id === id)).filter((player): player is Player => Boolean(player));
    if (lineup.length !== 5) return;
    const next = setManagerStartingLineup(managerCareer, playerIds);
    if (next === managerCareer) return;
    setSelected(lineup);
    commitManagerCareer(next);
  }

  function renewManagerContract(player: Player, terms: ManagerOfferTerms) {
    if (!managerCareer) return;
    const next = renewManagerPlayerContract(managerCareer, player, terms);
    if (next === managerCareer) return;
    commitManagerCareer(next);
  }

  function releaseManagerContract(playerId: string) {
    if (!managerCareer) return;
    const next = releaseManagerPlayerContract(managerCareer, playerId);
    if (next === managerCareer) return;
    commitManagerCareer(next);
  }

  function updateManagerTrainingFocus(player: Player, focus: ManagerTrainingFocus) {
    if (!managerCareer) return;
    const next = setManagerTrainingFocus(managerCareer, player, focus);
    if (next === managerCareer) return;
    commitManagerCareer(next);
  }

  function investManagerPlayerPotential(player: Player, choice: ManagerCoinSide, result: ManagerCoinSide) {
    if (!managerCareer) return;
    const next = resolveManagerPotentialInvestment(managerCareer, player, choice, result);
    if (next === managerCareer) return;
    if (choice === result) {
      const potential = managerTrainingPlan(next, player).potentialOvr;
      setSelected((current) => current.map((item) => item.id === player.id ? { ...item, potential } : item));
    }
    commitManagerCareer(next);
  }

  function playManagerCasinoNight(player: Player, stake: ManagerCasinoStake, choice: ManagerCoinSide, result: ManagerCoinSide) {
    if (!managerCareer) return;
    const next = resolveManagerCasinoVisit(managerCareer, player, stake, choice, result);
    if (next === managerCareer) return;
    commitManagerCareer(next);
  }

  function scheduleManagerCamp(focus: ManagerPerformanceCampFocus) {
    if (!managerCareer) return;
    const next = scheduleManagerPerformanceCamp(managerCareer, focus);
    if (next === managerCareer) return;
    commitManagerCareer(next);
  }

  function openManagerRecruitment(role: Role | "all" = "all") {
    setManagerMarketRole(role);
    pushScreen("manager-market");
  }

  function withdrawFromManagerEvent(eventId: string) {
    if (!managerCareer) return;
    const next = withdrawManagerEvent(managerCareer, eventId);
    if (next === managerCareer) return;
    commitManagerCareer(next);
  }

  function advanceManagerCareer(targetDate?: string) {
    if (!managerCareer) return;
    const checkpoint = targetDate && targetDate > managerCareer.date
      ? targetDate
      : nextManagerCheckpoint(managerCareer);
    if (!checkpoint) {
      const next = startNextManagerSeason(managerCareer);
      if (next === managerCareer) return;
      if (next.status === "bankrupt") {
        commitManagerCareer(next);
        setScreen("manager-home");
        return;
      }
      const contractedIds = new Set(next.contracts.filter((contract) => contract.status !== "expired").map((contract) => contract.playerId));
      const nextLineup = selected
        .filter((player) => contractedIds.has(player.id))
        .map((player) => ({ ...player, age: ageAfterMajor(player.age ?? careerMetaForPlayer(player).age) }));
      setSelected(nextLineup);
      setPlayerForm(generateManagerPlayerForm(nextLineup, next));
      setProgressionSummary([]);
      commitManagerCareer(next);
      return;
    }
    commitManagerTradeCareer(advanceManagerDate(managerCareer, checkpoint));
  }

  function launchRegisteredManagerEvent(eventId: string) {
    if (!managerCareer) return;
    const event = managerEventById(eventId);
    const nextCareer = beginManagerEvent(managerCareer, eventId);
    if (!event || nextCareer === managerCareer) return;
    const majorStage = event.majorCycle && nextCareer.activeMajorStage
      ? circuitEventById(nextCareer.activeMajorStage)
      : undefined;
    const nextSwissField = majorStage
      ? buildManagerMajorField(managerEventRosters, majorStage, managerControlledOrganizationId)
      : buildManagerField(managerEventRosters, event, managerControlledOrganizationId);
    const nextSwissRecords = initialSwissRecords(nextSwissField);
    const directPairs = event.format === "single-elimination"
      ? buildPlayoffPairs("quarterfinal", [yourTeam, ...nextSwissField.slice(0, 7)], yourTeam)
      : [];
    const groupPairs = event.format === "round-robin"
      ? buildRoundRobinRoundPairs(yourTeam, nextSwissField, 1)
      : [];
    const activePair = directPairs.find((pair) => pair.active) ?? groupPairs.find((pair) => pair.active);
    const rival = activePair
      ? activePair.left.id === yourTeam.id ? activePair.right : activePair.left
      : selectOpponentForRecord({ wins: 0, losses: 0 }, nextSwissField, nextSwissRecords, []);
    commitManagerCareer(nextCareer);
    if (majorStage) setCircuitEventId(majorStage.id);
    setCircuitMajorResults([]);
    setRecord({ wins: 0, losses: 0 });
    setPhase(event.format === "single-elimination" ? "playoffs" : "swiss");
    setPlayoffRound("quarterfinal");
    setPlayoffPairs(directPairs);
    setTournamentOutcome("running");
    setPlayerFinish(null);
    setTournamentWinner(undefined);
    setSwissField(nextSwissField);
    setSwissRecords(nextSwissRecords);
    setSpectatorSwissRound(1);
    setOpponent(rival);
    setPlayedOpponentIds([]);
    setMatchResults([]);
    setSelectedResultId(undefined);
    setStatsScope("all");
    setPickems({});
    setLastPickemDelta(0);
    setViewedSwissRound(null);
    setSeries(undefined);
    setMatch(undefined);
    setPlayerForm(generateManagerPlayerForm(selected, nextCareer));
    setVeto(createVeto());
    setScreen(event.format === "single-elimination" ? "playoffs" : "swiss");
  }

  function finishManagerTournament() {
    if (!managerCareer?.activeEventId) return;
    const event = managerEventById(managerCareer.activeEventId);
    if (!event) return;
    if (event.majorCycle && managerMajorStageCleared) {
      advanceManagerMajorCycleStage();
      return;
    }
    const tier = playerFinish ?? placementTier({
      champion: tournamentOutcome === "champion",
      reachedPlayoffs: phase === "playoffs",
      playoffRound,
    });
    const completedResults = event.majorCycle
      ? [...normalizedCircuitArchive, ...tagCircuitResults(matchResults, managerMajorStage ?? circuitEvent)]
      : matchResults;
    const playerRatings = Object.fromEntries(
      buildPlayerDatabase(completedResults)
        .filter((row) => row.team.id === yourTeam.id)
        .map((row) => [row.player.id, row.line.rating]),
    );
    const eventRecord = event.majorCycle
      ? userSeriesRecord(completedResults)
      : event.format === "swiss" ? record : userSeriesRecord(matchResults);
    const archivedResults = completedResults.map((result) => ({
      ...result,
      maps: result.maps.map((mapResult) => ({ ...mapResult, eventLog: undefined })),
    }));
    const archivedResultTeams = teamsFromResults(archivedResults);
    const archivedTeams = archivedResultTeams.length
      ? archivedResultTeams
      : Array.from(new Map([yourTeam, ...swissField].map((team) => [team.id, team])).values());
    const archivedWinner = winnerFromFinal(archivedResults) ?? tournamentWinner ?? (tier === "champion" ? yourTeam : undefined);
    const archive: ManagerEventArchive = {
      id: `manager:${managerCareer.season}:${event.id}:${managerCareer.activeMajorStage ?? "event"}`,
      eventId: event.id,
      eventName: managerEventName(event, managerCareer.season),
      season: managerCareer.season,
      completedOn: managerCareer.date,
      majorStage: event.majorCycle ? managerCareer.activeMajorStage : undefined,
      phase: event.hasPlayoffs && archivedResults.some((result) => result.stage !== "swiss") ? "playoffs" : "swiss",
      playoffRound: latestPlayoffRound(archivedResults),
      outcome: tier === "champion" ? "champion" : "complete",
      winner: archivedWinner,
      teams: archivedTeams,
      records: recordsFromResults(archivedTeams, archivedResults),
      results: archivedResults,
      playoffPairs,
    };
    const completedCareer = completeManagerEvent(managerCareer, event.id, tier, playerRatings);
    if (completedCareer === managerCareer) return;
    const training = resolveManagerTrainingCycle(completedCareer, managerContractPlayers, playerRatings, tier);
    const nextCareer = training.state;
    const developedById = new Map(training.players.map((player) => [player.id, player]));
    setSelected((current) => current.map((player) => developedById.get(player.id) ?? player));
    setProgressionSummary(training.reports
      .filter((report) => report.after !== report.before)
      .map((report) => ({ handle: report.handle, before: report.before, after: report.after, iglDelta: 0 })));
    commitManagerTradeCareer(nextCareer);
    setCareerActive(true);
    setCareerHistory((history) => [
      ...history,
      {
        event: careerEvent,
        tier,
        prize: event.prizes[tier],
        record: eventRecord,
        eventName: managerEventName(event, nextCareer.season),
        season: nextCareer.season,
        points: nextCareer.vrsPoints - managerCareer.vrsPoints,
        managerEventId: event.id,
        archive: { ...archive, completedOn: nextCareer.date },
      },
    ]);
    setCareerEvent((current) => current + 1);
    if (event.majorCycle) setCircuitMajorResults([]);
    setScreen("manager-home");
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
    // Strip the heavy replay data from the persisted snapshot: per-map event logs and the live match's
    // position timeline / feed buffers. The Vault is the canonical replay store (keyed by match id), so
    // duplicating it here would balloon every save/autosave and starve the Vault out of its localStorage
    // quota — which empties it over a few Majors. Resume keeps full scores, box stats, and structure.
    const slimResults = matchResults.map((result) => ({
      ...result,
      maps: result.maps.map((mapResult) => ({ ...mapResult, eventLog: undefined })),
    }));
    const slimCircuitResults = normalizeCircuitResultArchive(circuitMajorResults, circuitEvent).map((result) => ({
      ...result,
      maps: result.maps.map((mapResult) => ({ ...mapResult, eventLog: undefined })),
    }));
    const slimMatch = match ? { ...match, eventFeed: undefined, roundTimeline: undefined, feed: [], pendingEvents: undefined } : undefined;
    return {
      settings,
      screen,
      realTimeRounds,
      autoCoach,
      teamName,
      mode,
      runKind,
      vaultRunId,
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
      matchResults: slimResults,
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
      match: slimMatch,
      series,
      speed,
      tactic,
      timeouts,
      timeoutPlan,
      liveFeedView,
      careerActive,
      careerMoney,
      careerEvent,
      careerHistory,
      circuitEventId,
      circuitSeason,
      circuitPoints,
      circuitMajorResults: slimCircuitResults,
      circuitObserver,
      circuitOffseasonTarget,
      transferCandidates,
      transferTrade,
      playerFinish,
      progressionSummary,
      managerCareer,
    };
  }

  function buildRunSummary(): RunSummary {
    const recordLabel = runKind === "spectator" ? `${matchResults.length} series` : `${record.wins}-${record.losses}`;
    const phaseLabel = phase === "playoffs" ? playoffRoundLabel(playoffRound) : "Swiss";
    const eventLabel = mode === "circuit"
      ? circuitEvent.name
      : mode === "manager"
        ? managerActiveEvent ? managerEventName(managerActiveEvent, managerCareer?.season ?? 1) : "Manager HQ"
        : "Major";
    const detail = match
      ? `${eventLabel} / ${phaseLabel} / ${mapName(match.map)} ${match.you}-${match.opponent}`
      : tournamentOutcome === "champion"
        ? `${eventLabel} champion`
        : tournamentOutcome === "eliminated"
          ? `${eventLabel} eliminated`
          : `${eventLabel} / ${phaseLabel} / ${matchResults.length} saved series`;
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

  function applyRunSnapshot(snapshot: RunSnapshot) {
    const loadedCurrentRoster = snapshot.currentRoster
      ? currentVrsRoster(snapshot.currentRoster.id, rosterPool) ?? snapshot.currentRoster
      : builtInHltvRosters[0];
    const loadedOpponent = syncFieldTeamVrs(
      snapshot.opponent ?? toTournamentTeam(builtInHltvRosters[1] ?? builtInHltvRosters[0]),
      rosterPool,
    );
    const loadedSelected = (snapshot.selected ?? []).map(withCareerMeta);
    const savedManagerOrganization = snapshot.managerCareer
      ? resolveManagerOrganization(rosterPool, snapshot.managerCareer.organizationId, snapshot.managerCareer.organizationName)
        ?? (loadedCurrentRoster.name === snapshot.managerCareer.organizationName ? loadedCurrentRoster : undefined)
      : undefined;
    const normalizedManagerCareer = normalizeManagerCareer(snapshot.managerCareer, {
      organizationId: savedManagerOrganization?.id ?? snapshot.currentRoster?.id ?? "legacy-user-organization",
      organizationName: snapshot.managerCareer?.organizationName ?? snapshot.teamName ?? "My Five",
      organizationCountry: snapshot.managerCareer?.organizationCountry ?? savedManagerOrganization?.country ?? snapshot.currentRoster?.country ?? loadedSelected[0]?.country,
      vrsPoints: snapshot.managerCareer?.vrsPoints,
      vrsRank: snapshot.managerCareer?.vrsRank,
      players: loadedSelected,
    });
    const loadedManagerCareer = normalizedManagerCareer && savedManagerOrganization
      ? {
          ...normalizedManagerCareer,
          organizationId: savedManagerOrganization.id,
          organizationName: savedManagerOrganization.name,
          organizationCountry: savedManagerOrganization.country,
        }
      : normalizedManagerCareer;
    const loadedManagerMajorStage = loadedManagerCareer?.activeMajorStage;
    const forceManagerSwissStage = snapshot.mode === "manager"
      && Boolean(loadedManagerCareer?.activeEventId)
      && Boolean(loadedManagerMajorStage)
      && !managerMajorStageHasPlayoffs(loadedManagerMajorStage!)
      && snapshot.phase !== "swiss";
    const loadedPairs = forceManagerSwissStage
      ? []
      : (snapshot.playoffPairs ?? []).map((pair) => syncPairVrs(pair, rosterPool));
    const loadedResults = (snapshot.matchResults ?? []).map((result) => syncResultVrs(result, rosterPool));
    const loadedSeries = snapshot.series
      ? {
          ...snapshot.series,
          left: syncFieldTeamVrs(snapshot.series.left, rosterPool),
          right: syncFieldTeamVrs(snapshot.series.right, rosterPool),
      }
      : undefined;
    setSettings(snapshot.settings ?? defaultSettings);
    setRealTimeRounds(snapshot.realTimeRounds ?? true);
    setAutoCoach(snapshot.autoCoach ?? false);
    setAutoCoachStatus(snapshot.autoCoach ? "Save resumed / watching the server" : "Watching the server");
    setTeamName(snapshot.teamName ?? "My Five");
    setMode(snapshot.mode ?? "classic");
    setRunKind(snapshot.runKind ?? "player");
    setVaultRunId(snapshot.vaultRunId ?? createVaultRunId());
    setDifficulty(difficulties.find((item) => item.id === snapshot.difficultyId) ?? difficulties[0]);
    setSelected(loadedSelected);
    setCoach(snapshot.coach);
    setCoachOptions([]);
    setCoachRevealKey(0);
    setCurrentRoster(loadedCurrentRoster);
    setUsedRosterIds(snapshot.usedRosterIds ?? []);
    setRolling(false);
    setRollSequence([]);
    setRollsLeft(snapshot.rollsLeft ?? (snapshot.settings ?? defaultSettings).draftRolls);
    setOpponent(loadedOpponent);
    setPhase(forceManagerSwissStage ? "swiss" : snapshot.phase ?? "swiss");
    setPlayoffRound(snapshot.playoffRound ?? "quarterfinal");
    setPlayoffPairs(loadedPairs);
    setTournamentOutcome(snapshot.tournamentOutcome ?? "running");
    setTournamentWinner(snapshot.tournamentWinner ? syncFieldTeamVrs(snapshot.tournamentWinner, rosterPool) : undefined);
    setSwissField((snapshot.swissField ?? buildSwissField(rosterPool)).map((team) => syncFieldTeamVrs(team, rosterPool)));
    setSwissRecords(snapshot.swissRecords ?? {});
    setSpectatorSwissRound(snapshot.spectatorSwissRound ?? 1);
    setPlayedOpponentIds(snapshot.playedOpponentIds ?? []);
    setMatchResults(loadedResults);
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
    setMatch(forceManagerSwissStage ? undefined : snapshot.match ? { ...snapshot.match, running: false } : undefined);
    setSeries(forceManagerSwissStage ? undefined : loadedSeries);
    setSpeed(snapshot.speed ?? 1);
    setTactic(snapshot.tactic ?? "standard");
    setTimeouts(snapshot.timeouts ?? 2);
    setTimeoutPlan(snapshot.timeoutPlan ?? { boost: 0, rounds: 0 });
    liveTimeoutRef.current = false;
    setLiveFeedView(snapshot.liveFeedView ?? "feed");
    setCareerActive(snapshot.careerActive ?? false);
    setCareerMoney(snapshot.careerMoney ?? 0);
    setCareerEvent(snapshot.careerEvent ?? 1);
    setCareerHistory(
      (snapshot.careerHistory ?? []).map((entry) => {
        const normalizedEntry = entry.eventId
          ? { ...entry, eventId: normalizeCircuitEventId(entry.eventId) }
          : entry;
        if (!entry.archive) return normalizedEntry;
        return {
          ...normalizedEntry,
          archive: {
            ...entry.archive,
            majorStage: entry.archive.majorStage ? normalizeCircuitEventId(entry.archive.majorStage) as ManagerMajorStage : undefined,
            teams: entry.archive.teams.map((team) => syncFieldTeamVrs(team, rosterPool)),
            winner: entry.archive.winner ? syncFieldTeamVrs(entry.archive.winner, rosterPool) : undefined,
            results: entry.archive.results.map((result) => syncResultVrs(result, rosterPool)),
            playoffPairs: entry.archive.playoffPairs.map((pair) => ({
              ...pair,
              left: syncFieldTeamVrs(pair.left, rosterPool),
              right: syncFieldTeamVrs(pair.right, rosterPool),
            })),
          },
        };
      }),
    );
    setManagerHistoryEntry(null);
    const loadedCircuitEventId = normalizeCircuitEventId(snapshot.circuitEventId);
    setCircuitEventId(loadedCircuitEventId);
    setCircuitSeason(snapshot.circuitSeason ?? 1);
    setCircuitPoints(snapshot.circuitPoints ?? 0);
    setCircuitMajorResults(
      normalizeCircuitResultArchive(snapshot.circuitMajorResults ?? [], circuitEventById(loadedCircuitEventId))
        .map((result) => syncResultVrs(result, rosterPool)),
    );
    setCircuitObserver(snapshot.circuitObserver ?? false);
    setCircuitOffseasonTarget(
      snapshot.circuitOffseasonTarget
        ? { ...snapshot.circuitOffseasonTarget, eventId: normalizeCircuitEventId(snapshot.circuitOffseasonTarget.eventId) }
        : null,
    );
    setTransferCandidates(snapshot.transferCandidates ?? []);
    setTransferTrade(
      snapshot.transferTrade
        ? {
            ...snapshot.transferTrade,
            incoming: withCareerMeta(snapshot.transferTrade.incoming),
            outgoing: withCareerMeta(snapshot.transferTrade.outgoing),
          }
        : null,
    );
    setProgressionSummary(snapshot.progressionSummary ?? []);
    setManagerCareer(loadedManagerCareer);
    setPlayerFinish(snapshot.playerFinish ?? null);
    setDetailPlayer(null);
    setDetailTeam(null);
    setNavStack([]);
    setScreen(forceManagerSwissStage && ["playoffs", "veto", "match", "result", "series-detail"].includes(snapshot.screen)
      ? "swiss"
      : sanitizeLoadedScreen(snapshot.screen, snapshot));
  }

  function loadSavedRun(slot: SavedRun) {
    applyRunSnapshot(slot.snapshot);
    setActiveSaveId(slot.id);
    setSaveMessage(`${slot.summary.teamName} loaded.`);
  }

  function resumeAutosave() {
    if (!autosave) return;
    applyRunSnapshot(autosave.snapshot);
    setActiveSaveId(undefined);
    setSaveMessage("Resumed your last session.");
  }

  function dismissAutosave() {
    clearAutosave();
    setAutosave(null);
  }

  function deleteSavedRun(id: string) {
    deleteRunSlot(id);
    setRunSlots(loadRunSlots<RunSnapshot>());
    if (activeSaveId === id) setActiveSaveId(undefined);
    setSaveMessage("Save slot deleted.");
  }

  const navigationStages = mode === "manager"
    ? [
        { id: "setup", label: "Setup", active: screen === "setup" },
        { id: "club", label: "Club", active: screen === "manager-select" || screen === "coach" },
        { id: "hq", label: "HQ", active: screen === "manager-home" || screen === "manager-inbox" },
        { id: "calendar", label: "Calendar", active: screen === "manager-calendar" },
        { id: "roster", label: "Roster", active: screen === "manager-roster" },
        { id: "market", label: "Market", active: screen === "manager-market" },
        { id: "event", label: "Event", active: ["swiss", "playoffs", "veto", "match", "result"].includes(screen) },
      ]
    : ["setup", "teams", "draft", "swiss", "playoffs", "veto", "match"].map((item) => ({
        id: item,
        label: item[0].toUpperCase() + item.slice(1),
        active: screen === item,
      }));
  const vetoRecommendation = buildVetoRecommendation(veto, yourTeam, opponent, settings, matchResults);

  return (
    <div className={`app-shell ${mode === "manager" ? "manager-shell" : ""}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="crest" style={{ "--crest": settings.accent } as React.CSSProperties}>MD</div>
          <div>
            <strong>{settings.brand}</strong>
            <span>{mode === "manager" ? "counter-strike management simulator" : "counter-strike draft simulator"}</span>
          </div>
        </div>
        <nav className="stage-nav" aria-label="Progress">
          {navigationStages.map((stage, index) => (
            <span key={stage.id} className={stage.active ? "active" : ""} aria-current={stage.active ? "step" : undefined}>
              <i>{String(index + 1).padStart(2, "0")}</i>
              <b>{stage.label}</b>
            </span>
          ))}
        </nav>
        <div className="top-actions">
          <button className="icon-button top-utility-button" disabled={!hasSavableRun} onClick={saveCurrentRun} title="Save current run">
            <Save size={18} />
            <span>{activeSaveId ? "Quick Save" : "Save Run"}</span>
          </button>
          <button
            className="icon-button top-utility-button"
            disabled={runKind === "spectator" ? !hasEventOverview || screen === "overview" : !hasSaveUniverse || (mode === "manager" ? screen === "manager-home" : screen === "universe")}
            onClick={runKind === "spectator" ? openEventOverview : openSaveUniverse}
            title={runKind === "spectator" ? "Major overview" : mode === "manager" ? "Manager headquarters" : "Save universe"}
          >
            <LayoutDashboard size={18} />
            <span>{runKind === "spectator" ? "Overview" : mode === "manager" ? "HQ" : "Universe"}</span>
          </button>
          {mode === "manager" && managerCareer && (
            <>
              <button className="icon-button manager-top-link top-utility-button" disabled={screen === "manager-inbox"} onClick={() => pushScreen("manager-inbox")} title="Inbox and VRS reports">
                <Mail size={18} />
                <span>Inbox</span>
              </button>
              <button className="icon-button manager-top-link top-utility-button" disabled={screen === "manager-calendar"} onClick={() => pushScreen("manager-calendar")} title="Tournament calendar">
                <CalendarDays size={18} />
                <span>Calendar</span>
              </button>
              <button className="icon-button manager-top-link top-utility-button" disabled={screen === "manager-roster"} onClick={() => pushScreen("manager-roster")} title="Roster and contracts">
                <Users size={18} />
                <span>Roster</span>
              </button>
              <button className="icon-button manager-top-link top-utility-button" disabled={screen === "manager-market"} onClick={() => pushScreen("manager-market")} title="Scouting and recruitment">
                <BriefcaseBusiness size={18} />
                <span>Market</span>
              </button>
            </>
          )}
          <button className="icon-button top-utility-button" onClick={() => setScreen("teams")} title="Team database">
            <Database size={18} />
            <span>Team Lab</span>
          </button>
          <button className="icon-button top-utility-button" onClick={() => pushScreen("balance-lab")} title="Explain team strength, OVR & round probability">
            <Sparkles size={18} />
            <span>Balance Lab</span>
          </button>
          <button className="icon-button top-utility-button" onClick={() => pushScreen("vault")} title="All-time records from every saved match">
            <Trophy size={18} />
            <span>Vault</span>
          </button>
          <button className="icon-button top-utility-button" onClick={() => setShowSettings(true)} title="Customize">
            <Settings2 size={18} />
            <span>Customize</span>
          </button>
        </div>
      </header>

      {screen === "setup" && (
        <main className="layout setup-grid">
          {autosave && selected.length === 0 && (
            <section className="resume-banner">
              <div className="resume-info">
                <ArrowRight size={20} />
                <div>
                  <strong>Resume your last session</strong>
                  <span>{autosave.summary.teamName} · {autosave.summary.detail} · {formatRunSlotTime(autosave.updatedAt)}</span>
                </div>
              </div>
              <div className="resume-actions">
                <button className="primary" onClick={resumeAutosave}><ArrowRight size={15} /> Resume</button>
                <button className="secondary" onClick={dismissAutosave}>Dismiss</button>
              </div>
            </section>
          )}
          <section className="hero-panel">
            <div className="section-title"><Trophy size={18} /><span>Tournament run</span></div>
            <div className="setup-form">
              {mode === "manager" ? (
                <div className="circuit-setup-note"><BriefcaseBusiness size={17} /><span>Choose an existing organization and inherit its roster after starting.</span></div>
              ) : (
                <label>Team name<input value={teamName} onChange={(event) => setTeamName(event.target.value)} /></label>
              )}
              <div>
                <span className="label">Mode</span>
                <div className="segmented">
                  <button className={mode === "classic" ? "selected" : ""} onClick={() => setMode("classic")}><Target size={16} /> Classic</button>
                  <button className={mode === "random" ? "selected" : ""} onClick={() => setMode("random")}><Dice5 size={16} /> Random</button>
                  <button className={mode === "circuit" ? "selected" : ""} onClick={() => setMode("circuit")}><Award size={16} /> Circuit</button>
                  <button className={mode === "manager" ? "selected" : ""} onClick={() => setMode("manager")}><BriefcaseBusiness size={16} /> Manager</button>
                  <button className={mode === "spectator" ? "selected" : ""} onClick={() => setMode("spectator")}><Eye size={16} /> Spectator</button>
                </div>
              </div>
              {mode === "circuit" && (
                <div className="circuit-setup-note"><Award size={17} /><span>Begin in the MRQ against {circuitFieldLabel(circuitEvents[0])}, then survive Stage 1, Stage 2, and Stage 3 to reach the Major playoffs.</span></div>
              )}
              {mode === "manager" && (
                <div className="circuit-setup-note"><BriefcaseBusiness size={17} /><span>Manage registrations, deadlines, finances, VRS, contracts, and a persistent match history.</span></div>
              )}
              <div>
                <span className="label">Difficulty</span>
                <div className="difficulty-grid">
                  {difficulties.map((item) => (
                    <button key={item.id} className={difficulty.id === item.id ? "choice selected" : "choice"} onClick={() => setDifficulty(item)}>
                      <Gauge size={16} /><span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button className="primary large" onClick={startDraft}>
                {mode === "spectator" ? <FastForward size={19} /> : mode === "manager" ? <BriefcaseBusiness size={19} /> : <Dice5 size={19} />}
                {mode === "spectator" ? "Start spectator" : mode === "circuit" ? "Start circuit draft" : mode === "manager" ? "Start manager career" : "Start draft"}
              </button>
            </div>
          </section>
          <section className="field-panel">
            <div className="section-title"><Users size={18} /><span>Team database</span></div>
            <div className="database-callout">
              <div><strong>{rosterPool.length} teams loaded</strong><span>{builtInRosterCount} built-in / {customRosters.length} custom saved</span></div>
              <button className="secondary" onClick={() => setScreen("teams")}><Database size={16} /> Edit teams</button>
            </div>
            <div className="roster-grid compact">
              {rosterPool.slice(0, 6).map((roster) => <RosterBadge key={roster.id} roster={roster} />)}
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

      {screen === "manager-select" && mode === "manager" && (
        <ManagerOrganizationSelectPage
          rosters={rosterPool}
          builtInCount={builtInRosterCount}
          careerSeed={vaultRunId}
          selectedRoster={currentRoster}
          onSelect={setCurrentRoster}
          onBack={() => setScreen("setup")}
          onConfirm={chooseManagerOrganization}
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

      {screen === "manager-home" && mode === "manager" && managerCareer && (
        <ManagerHomePage
          team={yourTeam}
          roster={managerSquad}
          coach={coach}
          career={managerCareer}
          history={careerHistory}
          activeEvent={managerActiveEvent}
          phase={phase}
          record={record}
          results={matchResults}
          onOpenCalendar={() => pushScreen("manager-calendar")}
          onOpenRoster={() => pushScreen("manager-roster")}
          onOpenMarket={() => pushScreen("manager-market")}
          onOpenInbox={() => pushScreen("manager-inbox")}
          onRegister={registerForManagerEvent}
          onWithdraw={withdrawFromManagerEvent}
          onLaunch={launchRegisteredManagerEvent}
          onAdvance={advanceManagerCareer}
          onReturnEvent={() => setScreen(phase === "playoffs" ? "playoffs" : "swiss")}
          onOpenPlayer={openPlayerDetail}
          onOpenHistory={() => pushScreen("manager-history")}
          onOpenPastEvent={openManagerHistoryEntry}
        />
      )}

      {screen === "manager-inbox" && mode === "manager" && managerCareer && (
        <ManagerInboxPage
          team={yourTeam}
          career={managerCareer}
          standings={managerVrsStandings}
          worldTeams={managerWorldRosters}
          onBack={goBackScreen}
          onCareerChange={commitManagerIncomingCareer}
          onRead={(itemId) => commitManagerCareer(markManagerInboxRead(managerCareer, itemId))}
        />
      )}

      {screen === "manager-calendar" && mode === "manager" && managerCareer && (
        <ManagerCalendarPage
          career={managerCareer}
          roster={selected}
          activeEvent={managerActiveEvent}
          onBack={() => setScreen("manager-home")}
          onRegister={registerForManagerEvent}
          onWithdraw={withdrawFromManagerEvent}
          onLaunch={launchRegisteredManagerEvent}
          onReturnEvent={() => setScreen(phase === "playoffs" ? "playoffs" : "swiss")}
          onOpenCompletedEvent={openCompletedManagerEvent}
        />
      )}

      {screen === "manager-history" && mode === "manager" && managerCareer && (
        <ManagerClubHonorsPage
          team={yourTeam}
          career={managerCareer}
          history={careerHistory}
          onBack={goBackScreen}
          onOpenEvent={openManagerHistoryEntry}
        />
      )}

      {screen === "manager-event-overview" && mode === "manager" && managerCareer && managerHistoryEntry && (
        <ManagerLegacyEventOverviewPage
          team={yourTeam}
          entry={managerHistoryEntry}
          matches={dbReady ? managerVaultMatchesForHistory(getMatchDb().listMatches(), vaultRunId, managerHistoryEntry) : []}
          onBack={goBackScreen}
          onOpenReplay={(id) => {
            setVaultReplayId(id);
            pushScreen("vault-replay");
          }}
        />
      )}

      {screen === "manager-roster" && mode === "manager" && managerCareer && (
        <ManagerRosterPage
          team={yourTeam}
          roster={managerContractPlayers}
          starters={selected}
          coach={coach}
          career={managerCareer}
          onBack={() => setScreen("manager-home")}
          onOpenPlayer={openPlayerDetail}
          onSaveLineup={saveManagerStartingLineup}
          onRenewContract={renewManagerContract}
          onReleaseContract={releaseManagerContract}
          onOpenRecruitment={openManagerRecruitment}
          onSetTrainingFocus={updateManagerTrainingFocus}
          onPotentialInvestment={investManagerPlayerPotential}
          onCasinoVisit={playManagerCasinoNight}
          onSchedulePerformanceCamp={scheduleManagerCamp}
          onAdvanceDate={advanceManagerCareer}
        />
      )}

      {screen === "manager-market" && mode === "manager" && managerCareer && (
        <ManagerMarketPage
          team={yourTeam}
          roster={managerSquad}
          career={managerCareer}
          freeAgents={managerFreeAgents}
          transferList={managerTransferList}
          initialRole={managerMarketRole}
          onBack={() => setScreen("manager-home")}
          onCareerChange={commitManagerCareer}
          onTradeCareerChange={commitManagerTradeCareer}
          onOpenPlayer={openPlayerDetail}
        />
      )}

      {screen === "swiss" && neutralSwissRun && (
        <main className="layout swiss-stage">
          {mode === "circuit" && circuitObserver && (
            <CircuitProgressStrip event={circuitEvent} season={circuitSeason} points={circuitPoints} history={careerHistory} />
          )}
          <section className="swiss-round-panel">
            <div className="swiss-round-header">
              <div className="section-title">
                <Eye size={18} />
                <span>
                  {circuitObserver ? `${circuitEvent.name} - observer` : "Spectator mode"} - Swiss - {spectatorSwissResolved ? "Complete" : `Round ${spectatorSwissRound}`}
                </span>
              </div>
              <div className="swiss-actions">
                <button className="secondary" onClick={openEventOverview}>
                  <LayoutDashboard size={16} />
                  Overview
                </button>
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
                  {spectatorSwissResolved
                    ? circuitObserver && !circuitEvent.hasPlayoffs
                      ? `Advance to ${circuitNextEvent.shortName}`
                      : "Build playoffs"
                    : "Sim games"}
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
                  ? circuitObserver && !circuitEvent.hasPlayoffs
                    ? `The exact eight survivors are locked into ${circuitNextEvent.shortName}.`
                    : "The eight playoff teams are set. Build the bracket, then sim one playoff phase at a time."
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
                        onOpenTeam={openTeamDetail}
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
                      onOpenTeam={openTeamDetail}
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
              onOpenTeam={openTeamDetail}
            />
          </section>
        </main>
      )}

      {screen === "swiss" && !neutralSwissRun && (
        <main className="layout swiss-stage">
          {(mode === "circuit" || managerMajorActive) && (
            <CircuitProgressStrip
              event={managerMajorStage ?? circuitEvent}
              season={mode === "manager" ? managerCareer?.season ?? 1 : circuitSeason}
              points={mode === "manager" ? managerCareer?.vrsPoints ?? 0 : circuitPoints}
              history={careerHistory}
            />
          )}
          <section className="swiss-round-panel">
            <div className="swiss-round-header">
              <div className="section-title">
                <Trophy size={18} />
                <span>
                  {managerRoundRobinActive
                    ? `${tournamentName} - Round robin - ${swissUserFinished ? "Complete" : `Matchday ${managerRoundRobinRound} of ${managerRoundRobinRounds}`}`
                    : `${tournamentName} - Swiss - ${record.wins >= 3 ? "Qualified" : record.losses >= 3 ? "Eliminated" : `Round ${record.wins + record.losses + 1}`}`}
                </span>
              </div>
              <div className="swiss-actions">
                <button className="secondary" onClick={openEventOverview}>
                  <LayoutDashboard size={16} />
                  Overview
                </button>
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
                ) : circuitStageCleared ? (
                  <button className="primary" onClick={advanceCircuitStage}>
                    <ArrowRight size={17} />
                    Advance to {circuitNextEvent.shortName}
                  </button>
                ) : managerMajorStageCleared && managerMajorNextStage ? (
                  <button className="primary" onClick={advanceManagerMajorCycleStage}>
                    <ArrowRight size={17} />
                    Advance to {managerMajorNextStage.shortName}
                  </button>
                ) : runDone && record.losses >= 3 && swissStageResolved ? (
                  mode === "circuit" ? (
                    <>
                      <button className="primary" onClick={beginCircuitObservation}>
                        <FastForward size={17} />
                        Continue Major
                      </button>
                      <button className="secondary" onClick={skipCircuitToNextSeason}>
                        <SkipForward size={17} />
                        Sim to next season
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="primary" onClick={mode === "manager" ? finishManagerTournament : enterTransferWindow}>
                        <ArrowRight size={17} />
                        {mode === "manager" ? "Return to Manager HQ" : careerActive ? `Continue to Major ${careerEvent + 1}` : "Continue career"}
                      </button>
                      {!managerMajorStageOnly && (
                        <button className="secondary" onClick={() => enterNeutralPlayoffs(swissRecords, "eliminated")}>
                          <FastForward size={17} />
                          Continue bracket
                        </button>
                      )}
                      {mode !== "manager" && (
                        <button className="secondary" onClick={restartRun}>
                          <RefreshCcw size={17} />
                          Retry run
                        </button>
                      )}
                    </>
                  )
                ) : runDone ? (
                  <>
                    <button className="primary" onClick={mode === "manager" ? finishManagerTournament : enterTransferWindow}>
                      <ArrowRight size={17} />
                      {mode === "manager" ? "Return to Manager HQ" : mode === "circuit" ? "Circuit HQ" : careerActive ? `Continue to Major ${careerEvent + 1}` : "Continue career"}
                    </button>
                    <button className="secondary" onClick={restartRun}>
                      <RefreshCcw size={17} />
                      Retry run
                    </button>
                  </>
                ) : (
                  <button className="primary" onClick={startVeto}>
                    <Play size={17} />
                    Play my match
                  </button>
                )}
              </div>
            </div>
            {swissUserFinished && (
              <div className={managerRoundRobinActive ? "run-status eliminated" : record.wins >= 3 ? "run-status qualified" : "run-status eliminated"}>
                <strong>{managerRoundRobinActive ? "Group stage complete" : record.wins >= 3 ? "Qualified" : "Eliminated"}</strong>
                <span>
                  {managerRoundRobinActive
                    ? `The round robin finished ${record.wins}-${record.losses}, outside the top four playoff line.`
                    : record.wins >= 3
                    ? swissCanSim
                      ? circuitStageOnly || managerMajorStageOnly
                        ? `Your ${(managerMajorNextStage ?? circuitNextEvent).shortName} place is locked. Sim the remaining Swiss matches to settle the field.`
                        : "Your playoff spot is locked. Sim the remaining Swiss matches to build the bracket."
                      : circuitStageOnly || managerMajorStageOnly
                        ? `${(managerMajorStage ?? circuitEvent).shortName} is complete. Your roster advances to ${(managerMajorNextStage ?? circuitNextEvent).shortName}.`
                        : "The Swiss field is settled and the playoff bracket is ready."
                    : swissCanSim
                      ? "Your run is over, but you can still sim the remaining Swiss matches or retry."
                      : circuitStageOnly
                        ? `The run ended in ${circuitEvent.shortName}. Watch the qualified teams continue or sim straight to next season.`
                        : managerMajorStageOnly
                          ? `The Major run ended in ${managerMajorStage?.shortName}. Return to headquarters for the event review.`
                        : "The Swiss run ended before playoffs."}
                </span>
              </div>
            )}
            <div className="pickem-strip">
              <div className="pickem-title">
                <Target size={17} />
                <span>
                  {swissViewingPast
                    ? `${managerRoundRobinActive ? "Matchday" : "Swiss round"} ${viewedSwissRound} results - click a series to open the match`
                    : managerRoundRobinActive
                      ? "League fixtures: every team meets once before the top four advance"
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
                        onOpenTeam={openTeamDetail}
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
                      bestOf={pair.active ? currentBestOf : managerRoundRobinActive ? managerActiveEvent?.groupBestOf ?? 3 : swissPairBestOf(pair, swissRecords)}
                      onPick={(teamId) => pickWinner(pair, teamId)}
                      onOpenResult={openSeriesResult}
                      onOpenTeam={openTeamDetail}
                    />
                  ))
                ) : (
                  <div className="swiss-empty-row">{managerRoundRobinActive ? "Round robin is complete." : "Swiss stage is complete."}</div>
                )}
              </div>
            </div>
          </section>

          <section className="swiss-board-shell">
            <div className="swiss-board-title">
              <div className="section-title">
                <Target size={18} />
                <span>{managerRoundRobinActive ? "League standings" : "Swiss stage"}</span>
              </div>
              <span>{managerRoundRobinActive ? "Top four qualify for the knockout bracket" : "Click an ended series later to inspect match stats"}</span>
            </div>
            {managerRoundRobinActive ? (
              <ManagerRoundRobinStandings user={yourTeam} field={swissField} record={record} records={swissRecords} />
            ) : (
              <SwissBoard
                user={yourTeam}
                field={swissField}
                record={record}
                opponent={opponent}
                records={swissRecords}
                results={matchResults}
                onOpenResult={openSeriesResult}
                onOpenTeam={openTeamDetail}
              />
            )}
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

      {screen === "playoffs" && !managerMajorStageOnly && (
        <main className="layout swiss-stage">
          {mode === "circuit" && runKind === "player" && (
            <CircuitProgressStrip event={circuitEvent} season={circuitSeason} points={circuitPoints} history={careerHistory} />
          )}
          <section className="swiss-round-panel">
            <div className="swiss-round-header">
              <div className="section-title">
                <Trophy size={18} />
                <span>{tournamentName} playoffs - {playoffRoundLabel(playoffRound)}</span>
              </div>
              <div className="swiss-actions">
                <button className="secondary" onClick={openEventOverview}>
                  <LayoutDashboard size={16} />
                  Overview
                </button>
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
                ) : runKind === "player" ? (
                  <>
                    <button className="primary" onClick={mode === "manager" ? finishManagerTournament : enterTransferWindow}>
                      <ArrowRight size={17} />
                      {mode === "manager" ? "Return to Manager HQ" : mode === "circuit" ? "Circuit HQ" : careerActive ? `Continue to Major ${careerEvent + 1}` : "Continue career"}
                    </button>
                    <button className="secondary" onClick={restartRun}>
                      <RefreshCcw size={17} />
                      New run
                    </button>
                  </>
                ) : (
                  <button className="primary" onClick={restartRun}>
                    <RefreshCcw size={17} />
                    New run
                  </button>
                )}
              </div>
            </div>
            {(runKind === "spectator" || circuitObserver || tournamentOutcome !== "running") && (
              <div className={tournamentOutcome === "champion" || runKind === "spectator" || circuitObserver ? "run-status qualified" : "run-status eliminated"}>
                <strong>
                  {tournamentOutcome === "champion"
                    ? `${tournamentName} champions`
                    : tournamentOutcome === "complete"
                      ? "Tournament complete"
                      : runKind === "spectator" || circuitObserver
                        ? "Spectator bracket"
                        : "Eliminated"}
                </strong>
                <span>
                  {tournamentOutcome === "champion"
                    ? "Your five lifted the trophy."
                    : tournamentOutcome === "complete"
                      ? `${tournamentWinner?.name ?? "The winner"} lifted the trophy.`
                      : runKind === "spectator" || circuitObserver
                        ? "Sim one playoff phase at a time: quarterfinals, semifinals, then the BO5 final."
                        : "Your run is over, but you can keep simming the bracket to the end."}
                </span>
              </div>
            )}
            {(tournamentOutcome === "champion" || tournamentOutcome === "complete") && (
              <MajorAwardsPanel
                results={mode === "circuit" ? [...circuitMajorResults, ...matchResults] : matchResults}
                championId={tournamentOutcome === "champion" ? "user" : tournamentWinner?.id}
                championName={tournamentOutcome === "champion" ? yourTeam.name : tournamentWinner?.name}
                onOpenPlayer={openPlayerDetail}
              />
            )}
            <div className="pickem-strip">
              <div className="pickem-title">
                <Trophy size={17} />
                <span>{playoffRound === "final" ? "Grand final is BO5" : mode === "manager" && managerActiveEvent?.format === "single-elimination" && playoffRound === "quarterfinal" && currentBestOf === 1 ? "Open bracket starts with BO1s" : "Playoff matches are BO3"}</span>
                <b>BO{currentBestOf}</b>
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
                    bestOf={currentBestOf}
                    onPick={() => undefined}
                    onOpenResult={openSeriesResult}
                    onOpenTeam={openTeamDetail}
                  />
                ))}
              </div>
            </div>
          </section>

          <PlayoffBracket
            currentRound={playoffRound}
            pairs={playoffPairs}
            results={matchResults}
            quarterfinalBestOf={mode === "manager" && managerActiveEvent?.format === "single-elimination" ? 1 : 3}
            onOpenResult={openSeriesResult}
          />

          <section className="swiss-roster-bar">
            <div className="record-pill">
              <strong>{runKind === "spectator" || circuitObserver ? playoffPairs.length : `${record.wins}-${record.losses}`}</strong>
              <span>{runKind === "spectator" || circuitObserver ? "series this phase" : managerActiveEvent?.format === "round-robin" ? "Group record" : managerActiveEvent?.format === "single-elimination" ? "Knockout run" : "Swiss record"}</span>
            </div>
            <div className="compact-roster">
              {runKind === "spectator" || circuitObserver
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

      {screen === "universe" && runKind === "player" && (
        <SaveUniverseHub
          team={yourTeam}
          roster={selected}
          coach={coach}
          mode={mode}
          currentEvent={mode === "circuit" ? circuitEvent : undefined}
          season={mode === "circuit" ? circuitSeason : careerEvent}
          careerEvent={careerEvent}
          points={circuitPoints}
          money={careerMoney}
          history={careerHistory}
          record={record}
          phase={phase}
          playoffRound={playoffRound}
          outcome={tournamentOutcome}
          currentResults={matchResults}
          allResults={majorRunResults}
          playerForm={playerForm}
          development={progressionSummary}
          opponent={opponent}
          vaultProfile={universeVaultProfile}
          autoCoach={autoCoach}
          resumeScreen={navStack[navStack.length - 1]}
          onBack={goBackScreen}
          onOpenEvent={openEventOverview}
          onOpenStats={() => pushScreen("stats")}
          onOpenResults={() => pushScreen("results")}
          onOpenVault={() => pushScreen("vault")}
          onOpenTeamVault={openCurrentTeamVault}
          onOpenPlayer={openPlayerDetail}
          onOpenTeam={openTeamDetail}
          onOpenSeries={openSeriesResult}
          onOpenHistory={openUniverseHistory}
        />
      )}

      {screen === "overview" && (
        <EventOverviewPage
          name={managerArchivedEvent
            ? archivedMajorStage
              ? `${managerArchivedEvent.eventName} / ${archivedMajorStage.shortName}`
              : managerArchivedEvent.eventName
            : managerMajorActive && overviewCircuitEvent
            ? `${managerActiveEvent ? managerEventName(managerActiveEvent, managerCareer?.season ?? 1) : "Major"} / ${overviewCircuitEvent.shortName}`
            : overviewCircuitEvent?.name ?? tournamentName}
          phase={overviewPhase}
          outcome={overviewOutcome}
          winner={overviewWinner}
          teams={overviewTeams}
          records={overviewRecords}
          results={overviewResults}
          currentRound={overviewPlayoffRound}
          playoffPairs={managerArchivedEvent && archivedMajorStage?.id === managerArchivedEvent.majorStage
            ? managerArchivedEvent.playoffPairs
            : overviewIsCurrentEvent ? playoffPairs : []}
          settings={settings}
          circuit={(managerArchivedEvent?.majorStage || mode === "circuit" || managerMajorActive) && overviewCircuitEvent ? {
            event: overviewCircuitEvent,
            currentEvent: managerArchivedEvent?.majorStage ? circuitEventById(managerArchivedEvent.majorStage) : activeMajorStageEvent,
            availableEventIds: overviewAvailableEventIds,
            season: managerArchivedEvent?.season ?? (mode === "manager" ? managerCareer?.season ?? 1 : circuitSeason),
            points: mode === "manager" ? managerCareer?.vrsPoints ?? 0 : circuitPoints,
            worldRank: mode === "manager" ? managerAuthoritativeVrsRank : undefined,
          } : undefined}
          manager={mode === "manager" && (managerArchivedDefinition || managerActiveEvent) ? {
            event: managerArchivedDefinition ?? managerActiveEvent!,
            stage: managerArchivedEvent?.majorStage ? overviewCircuitEvent : managerMajorActive ? overviewCircuitEvent : undefined,
            vrsStandings: managerVrsStandings,
          } : undefined}
          onSelectCircuitEvent={setOverviewEventId}
          onBack={goBackScreen}
          onStats={() => pushScreen("stats")}
          onResults={() => pushScreen("results")}
          onOpenTeam={openTeamDetail}
          onOpenPlayer={openPlayerDetail}
          onOpenSeries={openSeriesResult}
        />
      )}

      {screen === "stats" && (
        <RunStatsPage
          rows={overviewDrilldown ? overviewPlayerDatabase : playerDatabase}
          eventName={overviewDrilldown ? managerArchivedEvent?.eventName ?? overviewCircuitEvent?.name ?? tournamentName : universeDrilldown ? tournamentName : undefined}
          scope={statsScope}
          onScopeChange={setStatsScope}
          onBack={overviewDrilldown || universeDrilldown ? goBackScreen : () => setScreen(phase === "playoffs" ? "playoffs" : "swiss")}
          onOpenPlayer={openPlayerDetail}
          onOpenTeam={openTeamDetail}
        />
      )}

      {screen === "player-detail" && detailPlayer && (
        <PlayerDetailPage
          player={detailPlayer.player}
          team={detailPlayer.team}
          results={managerArchiveDrilldown ? managerArchivedEvent?.results ?? [] : majorRunResults}
          managerCareer={mode === "manager" ? managerCareer : undefined}
          onBack={goBackScreen}
          onOpenSeries={openSeriesResult}
          onOpenTeam={openTeamDetail}
          onCompare={(p) => {
            setCompareAId(p.id);
            pushScreen("compare");
          }}
        />
      )}

      {screen === "compare" && <ComparePage pool={comparePool} initialAId={compareAId} onBack={goBackScreen} />}

      {screen === "transfer" && (
        <TransferWindow
          eventNumber={careerEvent}
          lastResult={careerHistory[careerHistory.length - 1]}
          money={careerMoney}
          roster={selected}
          candidates={transferCandidates}
          trade={transferTrade}
          development={progressionSummary}
          onTrade={doTransfer}
          onUndo={undoTransfer}
          circuit={mode === "circuit" ? { event: circuitEvent, season: circuitSeason, points: circuitPoints, history: careerHistory } : undefined}
          onStart={startNextTournament}
        />
      )}

      {screen === "team-detail" && detailTeam && (
        <TeamDetailPage
          team={detailTeam}
          results={managerArchiveDrilldown ? managerArchivedEvent?.results ?? [] : majorRunResults}
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
          onOpenTeam={(id) => {
            setVaultTeamId(id);
            pushScreen("vault-team");
          }}
          dbReady={dbReady}
        />
      )}

      {screen === "vault-replay" && (
        <MatchRoundReplayPanel
          match={vaultReplayId ? getMatchDb().getMatch(vaultReplayId) : undefined}
          log={vaultReplayId ? getMatchDb().getEventLog(vaultReplayId) : undefined}
          onBack={goBackScreen}
        />
      )}

      {screen === "vault-team" && (
        <VaultTeamPage
          teamId={vaultTeamId}
          revision={vaultRevision}
          onBack={goBackScreen}
          onOpenReplay={(id) => {
            setVaultReplayId(id);
            pushScreen("vault-replay");
          }}
          onOpenTeam={(id) => {
            setVaultTeamId(id);
            pushScreen("vault-team");
          }}
        />
      )}

      {screen === "results" && (
        <RunResultsPage
          results={overviewDrilldown ? overviewResults : matchResults}
          eventName={overviewDrilldown ? managerArchivedEvent?.eventName ?? overviewCircuitEvent?.name ?? tournamentName : universeDrilldown ? tournamentName : undefined}
          selectedResultId={selectedResultId}
          onOpen={openSeriesResult}
          onBack={overviewDrilldown || universeDrilldown ? goBackScreen : () => setScreen(phase === "playoffs" ? "playoffs" : "swiss")}
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
              <div><strong>BO{currentBestOf}</strong><span>{currentSeriesLabel} veto</span></div>
              <TeamPlate team={opponent} align="right" />
            </div>
            {veto.ready ? (
              <button className="primary center-action" onClick={startMatch}><Play size={18} /> Start series</button>
            ) : (
              <div className={`turn-banner ${veto.prompt.toLowerCase().includes("thinking") ? "thinking" : veto.prompt.toLowerCase().includes("pick") ? "pick" : "ban"}`}>
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
                  <div className="map-art">
                    <img src={mapArtImages[map.id]} alt="" aria-hidden="true" />
                  </div>
                  <span>{vetoMapLabel(veto, map.id)}</span>
                  <strong>{map.name}</strong>
                </button>
              ))}
            </div>
            <ol className="veto-log">
              {veto.log.map((line) => <li key={line}>{line}</li>)}
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
              recommendation={vetoRecommendation}
              you={yourTeam}
              opponent={opponent}
              disabled={Boolean(veto.ready || veto.pendingOpponent)}
              onApply={(map) => ban(map)}
            />
            <ScoutingReport you={yourTeam} opponent={opponent} settings={settings} />
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
                          <span className={mapRecordTone(yourMapRecord)}><TeamLogo team={yourTeam} small /><b>{formatMapRecord(yourMapRecord)}</b></span>
                          <span className={mapRecordTone(opponentMapRecord)}><TeamLogo team={opponent} small /><b>{formatMapRecord(opponentMapRecord)}</b></span>
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
                <button key={value} className={speed === value ? "selected" : ""} onClick={() => setSpeed(value)}>{value}x</button>
              ))}
              <button onClick={() => setMatch({ ...match, running: !match.running })}>
                {match.running ? <Pause size={15} /> : <Play size={15} />}
                {match.running ? "Pause" : "Resume"}
              </button>
              <button onClick={() => useTimeout("manual")} disabled={timeouts <= 0}><Clock3 size={15} /> Timeout ({timeouts})</button>
              <button
                className={autoCoach ? "selected" : ""}
                onClick={() => {
                  setAutoCoach((enabled) => !enabled);
                  setAutoCoachStatus(autoCoach ? "Manual coaching" : "Watching the server");
                }}
              >
                <Sparkles size={15} /> Auto Coach {autoCoach ? "On" : "Off"}
              </button>
              <button onClick={skipResult}><SkipForward size={15} /> Skip result</button>
              <button className={realTimeRounds ? "selected" : ""} onClick={() => setRealTimeRounds(!realTimeRounds)} title="Toggle between streaming events in real-time or playing entire rounds instantly">
                {realTimeRounds ? "⏱️ Real-time" : "⚡ Instant Rounds"}
              </button>
            </div>
          </section>
          <section className="score-hero live-scoreboard">
            <img
              className="scoreboard-map-art"
              src={mapArtImages[match.map]}
              alt=""
              aria-hidden="true"
            />
            <TeamPlate team={yourTeam} />
            <div className="score">
              <div className="score-map-identity">
                <Crosshair size={12} />
                <em>Map {(series?.currentMapIndex ?? 0) + 1}</em>
                <strong>{mapName(match.map)}</strong>
              </div>
              <span className="live-score-value">
                <FactionBadge side={match.side} compact label={false} />
                <AnimatedLiveScore value={match.you} className={match.side === "CT" ? "ct-team" : "t-team"} />
              </span>
              <span className="live-score-divider">:</span>
              <span className="live-score-value right">
                <AnimatedLiveScore value={match.opponent} className={match.side === "CT" ? "t-team" : "ct-team"} />
                <FactionBadge side={match.side === "CT" ? "T" : "CT"} compact label={false} />
              </span>
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

                      if (feed.type === "round_start") {
                        return (
                          <div className="feed-line start-line" key={`${feed.round}-${index}`}>
                            <span className="feed-round-badge">R{feed.round}</span>
                            <Crosshair className="feed-event-icon neutral" size={15} aria-hidden="true" />
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
                            {winnerSide !== "neutral" && <FactionBadge side={winnerSide} compact label={false} />}
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
                            <Bomb className="feed-event-icon t" size={16} aria-hidden="true" />
                            <span className="feed-message">
                              <b className="t-team">{feed.killer}</b> planted the bomb on <b>{plantSite}</b> (<span className="t-team">{feed.tAlive}</span>on<span className="ct-team">{feed.ctAlive}</span>)
                            </span>
                          </div>
                        );
                      }

                      if (feed.type === "defuse") {
                        return (
                          <div className="feed-line defuse-line" key={`${feed.round}-${index}`}>
                            <span className="feed-round-badge">R{feed.round}</span>
                            <ShieldCheck className="feed-event-icon ct" size={16} aria-hidden="true" />
                            <span className="feed-message">
                              <b className="ct-team">{feed.killer}</b> defused the bomb
                            </span>
                          </div>
                        );
                      }

                      if (feed.type === "explode") {
                        return (
                          <div className="feed-line explode-line" key={`${feed.round}-${index}`}>
                            <span className="feed-round-badge">R{feed.round}</span>
                            <Flame className="feed-event-icon t" size={16} aria-hidden="true" />
                            <span className="feed-message">
                              The bomb exploded
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
                        <div className={`feed-line kill-line ${killerSide.toLowerCase()}`} key={`${feed.round}-${index}`}>
                          <span className="feed-round-badge">R{feed.round}</span>
                          {killerSide !== "neutral" && <FactionBadge side={killerSide} compact label={false} />}
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
                            {feed.isHeadshot && <Skull className="hs-icon" size={14} aria-label="Headshot" />}
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
              <div className={`auto-coach-strip ${autoCoach ? "active" : ""}`}>
                <span><Sparkles size={15} /> Auto Coach</span>
                <strong>{autoCoach ? autoCoachStatus : "Off"}</strong>
                <small>{formatTacticLabel(tactic)} / {timeouts} timeout{timeouts === 1 ? "" : "s"}</small>
              </div>
              <div className="section-title">
                <Shield size={18} />
                <span>Round call</span>
              </div>
              <div className="econ-row">
                <span><FactionBadge side={match.side} compact label={false} /> {yourTeam.tag}: {match.economy} {match.yourMoney && `($${totalYourMoney.toLocaleString()})`}</span>
                <span><FactionBadge side={match.side === "CT" ? "T" : "CT"} compact label={false} /> {opponent.tag}: {match.opponentEconomy} {match.opponentMoney && `($${totalOpponentMoney.toLocaleString()})`}</span>
              </div>
              <RoundReadPanel
                read={buildRoundRead(match, yourTeam, opponent, settings, totalYourMoney, totalOpponentMoney)}
                currentTactic={tactic}
                onApply={applyManualTactic}
              />
              <div className="call-composer">
                <div className="call-row">
                  <span>Read</span>
                  {ROUND_STYLE_OPTIONS.map((item) => (
                    <button
                      className={activeCall.style === item.id ? "selected" : ""}
                      key={item.id}
                      onClick={() => applyManualTactic(composeTactic(item.id, activeCall.buy))}
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
                      onClick={() => applyManualTactic(composeTactic(activeCall.style, item.id))}
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
                onTimeout={() => useTimeout("manual")}
              />
              <p className="last-reason">{match.lastReason ?? "Opening defaults are live."}</p>
            </div>
          </section>
          <section className="match-stats-grid" aria-label="Live player statistics">
            <StatsTable title={yourTeam.name} players={selected} stats={match.yourStats} money={match.yourMoney} weapons={match.yourWeapons} armor={match.yourArmor} />
            <StatsTable title={opponent.name} players={opponent.players} stats={match.opponentStats} money={match.opponentMoney} weapons={match.opponentWeapons} armor={match.opponentArmor} />
          </section>
          {match.roundProbabilities.length > 0 && (
            <section className="winprob-panel live">
              <div className="replay-head">
                <div className="section-title">
                  <Gauge size={18} />
                  <span>Win probability</span>
                </div>
              </div>
              <WinProbGraph
                probabilities={match.roundProbabilities}
                winners={match.roundWinners.map((winner) => (winner === "you" ? "left" : "right"))}
                leftTag={yourTeam.tag}
                rightTag={opponent.tag}
              />
            </section>
          )}
        </main>
      )}

      {screen === "result" && match && (
        <main className="layout result-layout">
          <section className="score-hero result">
            <img
              className="scoreboard-map-art"
              src={mapArtImages[match.map]}
              alt=""
              aria-hidden="true"
            />
            <TeamPlate team={yourTeam} />
            <div className="score">
              <div className="score-map-identity">
                <Crosshair size={12} />
                <em>Final</em>
                <strong>{mapName(match.map)}</strong>
              </div>
              <b className={match.side === "CT" ? "t-team" : "ct-team"}>{match.you}</b>
              <span>:</span>
              <b className={match.side === "CT" ? "ct-team" : "t-team"}>{match.opponent}</b>
              <small>{series ? `${seriesMapScoreAfterCurrent(series, match)} / ` : ""}match complete</small>
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
          <ResultMapArtwork maps={resultMapResults} left={yourTeam} right={opponent} />
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
          <WinProbPanel left={yourTeam} right={opponent} maps={resultMapResults} />
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

function AnimatedLiveScore({ value, className }: { value: number; className: string }) {
  const previousValue = useRef(value);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (previousValue.current === value) return;
    previousValue.current = value;
    setRevision((current) => current + 1);
  }, [value]);

  return (
    <b className={className} aria-live="polite" aria-atomic="true">
      <span key={revision} className={revision > 0 ? "live-score-tick" : undefined}>{value}</span>
    </b>
  );
}

function FactionBadge({ side, compact = false, label = true }: { side: "CT" | "T"; compact?: boolean; label?: boolean }) {
  const name = side === "CT" ? "Counter-Terrorist" : "Terrorist";
  return (
    <span className={`faction-badge ${side.toLowerCase()}${compact ? " compact" : ""}`} title={name}>
      <img src={side === "CT" ? ctFactionIcon : tFactionIcon} alt="" aria-hidden="true" />
      {label && <b>{side}</b>}
    </span>
  );
}

function PlayerRoleGlyph({ role, size = 14 }: { role: Role | "Flex"; size?: number }) {
  const icon = role === "IGL"
    ? <Radio size={size} />
    : role === "AWP"
      ? <Crosshair size={size} />
      : role === "Entry"
        ? <Swords size={size} />
        : role === "Support"
          ? <Shield size={size} />
          : role === "Lurker"
            ? <Footprints size={size} />
            : <Users size={size} />;
  return <i className={`player-role-glyph role-${role.toLowerCase()}`} title={role}>{icon}</i>;
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
  missing,
  onClick,
}: {
  player: Player;
  missing: boolean;
  onClick: () => void;
}) {
  return (
    <button className={missing ? "player-card fills" : "player-card"} onClick={onClick}>
      {missing && <span className="fill-tag">fills {player.role}</span>}
      <Avatar label={player.handle} accent={player.source.accent} photo={playerPhoto(player.handle)} />
      <div className="player-head">
        <strong>{player.handle}</strong>
        <b>{player.ovr}</b>
      </div>
      <span className="player-id-meta"><Flag country={player.country} /> {player.country} / {player.realName} / Rating: {player.ovr}</span>
      <small>{player.role} / {player.style}</small>
      <StatBars player={player} />
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
  onOpenTeam,
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
  onOpenTeam?: (team: FieldTeam) => void;
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
      <SwissTeamName team={pair.left} record={leftRecord} completedRounds={completedRounds} onOpenTeam={onOpenTeam} />
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
      <SwissTeamName team={pair.right} align="right" record={rightRecord} completedRounds={completedRounds} onOpenTeam={onOpenTeam} />
    </div>
  );
}

function SwissTeamName({
  team,
  align = "left",
  record,
  completedRounds = 0,
  onOpenTeam,
}: {
  team: FieldTeam;
  align?: "left" | "right";
  record?: SwissRecord;
  completedRounds?: number;
  onOpenTeam?: (team: FieldTeam) => void;
}) {
  const content = (
    <>
      <TeamLogo team={team} small />
      <strong>{team.name}</strong>
      <span>{record ? `${record.wins}-${record.losses}` : projectedRecordLabel(team, completedRounds)}</span>
    </>
  );
  const className = align === "right" ? "swiss-team-name right" : "swiss-team-name";
  if (!onOpenTeam) return <div className={className}>{content}</div>;
  return (
    <button
      type="button"
      className={`${className} clickable-team`}
      title={`${team.name} - Major run`}
      onClick={(event) => {
        event.stopPropagation();
        onOpenTeam(team);
      }}
    >
      {content}
    </button>
  );
}

function PlayoffBracket({
  currentRound,
  pairs,
  results,
  quarterfinalBestOf = 3,
  onOpenResult,
}: {
  currentRound: PlayoffRound;
  pairs: SwissPair[];
  results: SwissResult[];
  quarterfinalBestOf?: number;
  onOpenResult: (id: string) => void;
}) {
  const rounds: Array<{ id: PlayoffRound; label: string; count: number; bestOf: number }> = [
    { id: "quarterfinal", label: "Quarterfinals", count: 4, bestOf: quarterfinalBestOf },
    { id: "semifinal", label: "Semifinals", count: 2, bestOf: 3 },
    { id: "final", label: "Grand final", count: 1, bestOf: 5 },
  ];

  return (
    <section className="playoff-bracket-shell">
      <div className="playoff-bracket-head">
        <div className="section-title">
          <Trophy size={18} />
          <span>Champions stage</span>
        </div>
        <span>Eight teams · single elimination</span>
      </div>
      <div className="playoff-bracket-grid">
        {rounds.map((round, roundIndex) => {
          const completed = results.filter((result) => result.stage === round.id);
          const completedIds = new Set(completed.map((result) => result.pairId));
          const livePairs = round.id === currentRound ? pairs.filter((pair) => !completedIds.has(pair.id)) : [];
          const entries: Array<{ result?: SwissResult; pair?: SwissPair }> = [
            ...completed.map((result) => ({ result, pair: { id: result.pairId, left: result.left, right: result.right } })),
            ...livePairs.map((pair) => ({ pair })),
          ].slice(0, round.count);
          while (entries.length < round.count) entries.push({});

          return (
            <div className={`playoff-bracket-round round-${roundIndex + 1}`} key={round.id}>
              <div className="playoff-bracket-round-head">
                <span>0{roundIndex + 1}</span>
                <strong>{round.label}</strong>
                <b>BO{round.bestOf}</b>
              </div>
              <div className="playoff-bracket-matches">
                {entries.map((entry, index) => {
                  const pair = entry.pair;
                  const result = entry.result;
                  if (!pair) {
                    return (
                      <div className="playoff-bracket-match placeholder" key={`${round.id}-placeholder-${index}`}>
                        <span>Awaiting winner</span>
                      </div>
                    );
                  }
                  const active = Boolean(pair.active && !result);
                  return (
                    <button
                      type="button"
                      className={`playoff-bracket-match${result ? " completed" : ""}${active ? " active" : ""}`}
                      key={result?.id ?? pair.id}
                      disabled={!result}
                      onClick={() => result && onOpenResult(result.id)}
                    >
                      <PlayoffBracketTeam team={pair.left} score={result?.leftScore} winner={result?.winnerId === pair.left.id} />
                      <PlayoffBracketTeam team={pair.right} score={result?.rightScore} winner={result?.winnerId === pair.right.id} />
                      <small>{result ? "View match" : active ? "Your series" : `BO${round.bestOf}`}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PlayoffBracketTeam({
  team,
  score,
  winner,
}: {
  team: FieldTeam;
  score?: number;
  winner: boolean;
}) {
  return (
    <span className={`playoff-bracket-team${winner ? " winner" : ""}`}>
      <TeamLogo team={team} small />
      <b>{team.name}</b>
      <em>{score ?? "–"}</em>
    </span>
  );
}

function ManagerRoundRobinStandings({
  user,
  field,
  record,
  records,
}: {
  user: FieldTeam;
  field: FieldTeam[];
  record: SwissRecord;
  records: Record<string, SwissRecord>;
}) {
  const rows = [user, ...field]
    .map((team) => ({ team, record: team.id === "user" ? record : records[team.id] ?? { wins: 0, losses: 0 } }))
    .sort((left, right) => right.record.wins - left.record.wins || left.record.losses - right.record.losses || (left.team.rank ?? 99) - (right.team.rank ?? 99));
  return (
    <div className="manager-league-table">
      <div className="manager-league-head"><span>#</span><span>Team</span><span>Played</span><span>W</span><span>L</span><span>Line</span></div>
      {rows.map(({ team, record: teamRecord }, index) => (
        <div className={team.id === "user" ? "user" : ""} key={team.id}>
          <b>{index + 1}</b>
          <span><TeamLogo team={team} small /><strong>{team.name}</strong></span>
          <em>{teamRecord.wins + teamRecord.losses}</em>
          <em>{teamRecord.wins}</em>
          <em>{teamRecord.losses}</em>
          <small className={index < 4 ? "qualified" : "outside"}>{index < 4 ? "Playoffs" : "Outside"}</small>
        </div>
      ))}
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
  onOpenTeam,
}: {
  user: FieldTeam;
  field: FieldTeam[];
  record: SwissRecord;
  opponent: FieldTeam;
  records: Record<string, SwissRecord>;
  results: SwissResult[];
  onOpenResult: (id: string) => void;
  onOpenTeam: (team: FieldTeam) => void;
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
                <SwissLane key={lane.key} title={lane.key} teams={lane.teams} results={lane.results} onOpenResult={onOpenResult} onOpenTeam={onOpenTeam} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="swiss-outcome-zone">
        <SwissOutcome
          title="Qualified"
          tone="qualified"
          teams={lanes.qualified ?? []}
          labels={["3:0", "3:1", "3:2"]}
          records={{ ...records, user: record }}
          onOpenTeam={onOpenTeam}
        />
        <SwissOutcome
          title="Eliminated"
          tone="eliminated"
          teams={lanes.eliminated ?? []}
          labels={["0:3", "1:3", "2:3"]}
          records={{ ...records, user: record }}
          onOpenTeam={onOpenTeam}
        />
      </div>
    </div>
  );
}

function SpectatorSwissBoard({
  field,
  records,
  results,
  onOpenResult,
  onOpenTeam,
}: {
  field: FieldTeam[];
  records: Record<string, SwissRecord>;
  results: SwissResult[];
  onOpenResult: (id: string) => void;
  onOpenTeam: (team: FieldTeam) => void;
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
                <SwissLane key={lane.key} title={lane.key} teams={lane.teams} results={lane.results} onOpenResult={onOpenResult} onOpenTeam={onOpenTeam} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="swiss-outcome-zone">
        <SwissOutcome
          title="Qualified"
          tone="qualified"
          teams={lanes.qualified ?? []}
          labels={["3:0", "3:1", "3:2"]}
          records={records}
          onOpenTeam={onOpenTeam}
        />
        <SwissOutcome
          title="Eliminated"
          tone="eliminated"
          teams={lanes.eliminated ?? []}
          labels={["0:3", "1:3", "2:3"]}
          records={records}
          onOpenTeam={onOpenTeam}
        />
      </div>
    </div>
  );
}

function SwissLane({
  title,
  teams,
  results,
  onOpenResult,
  onOpenTeam,
}: {
  title: string;
  teams: FieldTeam[];
  results: SwissResult[];
  onOpenResult: (id: string) => void;
  onOpenTeam: (team: FieldTeam) => void;
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
              <SwissLaneTeam team={left} onOpenTeam={onOpenTeam} />
              {right ? (
                <>
                  <span className="lane-vs">vs</span>
                  <SwissLaneTeam team={right} onOpenTeam={onOpenTeam} />
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

function SwissLaneTeam({ team, winner = false, onOpenTeam }: { team: FieldTeam; winner?: boolean; onOpenTeam?: (team: FieldTeam) => void }) {
  const className = `${team.id === "user" ? "lane-team user" : "lane-team"}${winner ? " winner" : ""}`;
  const content = (
    <>
      <TeamLogo team={team} small />
      <b>{team.tag}</b>
      {winner ? <small>win</small> : team.id === "user" && <small>you</small>}
    </>
  );
  if (!onOpenTeam) return <span className={className}>{content}</span>;
  return <button type="button" className={`${className} clickable-team`} onClick={() => onOpenTeam(team)} title={`${team.name} - Major run`}>{content}</button>;
}

function SwissOutcome({
  title,
  tone,
  teams,
  labels,
  records,
  onOpenTeam,
}: {
  title: string;
  tone: "qualified" | "eliminated";
  teams: FieldTeam[];
  labels: string[];
  records: Record<string, SwissRecord>;
  onOpenTeam: (team: FieldTeam) => void;
}) {
  return (
    <div className={`swiss-outcome ${tone}`}>
      <strong>{title}</strong>
      <div className="outcome-records">
        {labels.map((label) => {
          const recordTeams = teams.filter((team) => {
            const teamRecord = records[team.id];
            return teamRecord && `${teamRecord.wins}:${teamRecord.losses}` === label;
          });
          return (
            <div className="outcome-record-column" key={label}>
              <span className="outcome-record-label">{label}</span>
              <div className="outcome-record-teams">
                {recordTeams.length ? (
                  recordTeams.map((team) => (
                    <button
                      type="button"
                      className={`outcome-team${team.id === "user" ? " user" : ""}`}
                      key={`${tone}-${label}-${team.id}`}
                      title={`${team.name} (${label})${team.id === "user" ? " - your team" : ""}`}
                      onClick={() => onOpenTeam(team)}
                    >
                      <TeamLogo team={team} small />
                      <b>{team.tag}</b>
                      {team.id === "user" && <small>You</small>}
                    </button>
                  ))
                ) : (
                  <span className="outcome-record-empty">-</span>
                )}
              </div>
            </div>
          );
        })}
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

interface ScoutMapRow {
  map: MapId;
  name: string;
  oppStrength: number; // 0–100, opponent's avg per-player rating on this map
  yourEdge: number; // mapEdge — positive means you're favoured
  vaultRecord?: { wins: number; losses: number }; // opponent's real all-time W-L on this map, if known
}

interface ScoutReport {
  opponent: FieldTeam;
  maps: ScoutMapRow[]; // sorted by opponent strength, descending
  comfort: MapId[]; // their best maps
  weak: MapId[]; // their worst maps
  star: Player;
  starRating?: number; // their star's all-time Vault rating, if recorded
  form?: { streak: { type: "W" | "L"; count: number } | null; last5: Array<"W" | "L"> };
  headToHead?: { wins: number; losses: number }; // YOUR record vs them
  banSuggestion: MapId; // their strongest map
  targetSuggestion: MapId; // where you hold the biggest edge
}

// Build an opponent dossier from always-available roster data, enriched with Vault history when you've
// faced them before. Pure read — no UI.
function buildScoutingReport(you: FieldTeam, opponent: FieldTeam, settings: CustomSettings): ScoutReport {
  const db = getMatchDb();
  const oppVault = db.teamProfile(opponent.id);
  const youVault = db.teamProfile(you.id);

  const maps: ScoutMapRow[] = mapPool
    .map((map) => {
      const oppStrength = opponent.players.reduce((sum, player) => sum + (player.maps[map.id] ?? 0), 0) / Math.max(1, opponent.players.length);
      const record = oppVault?.byMap.find((entry) => entry.map === map.id);
      return {
        map: map.id,
        name: map.name,
        oppStrength,
        yourEdge: mapEdge(you, opponent, map.id, settings),
        vaultRecord: record ? { wins: record.wins, losses: record.losses } : undefined,
      };
    })
    .sort((a, b) => b.oppStrength - a.oppStrength);

  const star = [...opponent.players].sort((a, b) => b.ovr - a.ovr)[0];
  const targetSuggestion = [...maps].sort((a, b) => b.yourEdge - a.yourEdge)[0].map;

  return {
    opponent,
    maps,
    comfort: maps.slice(0, 2).map((m) => m.map),
    weak: maps.slice(-2).map((m) => m.map),
    star,
    starRating: oppVault?.roster.find((row) => row.handle === star.handle)?.line.rating,
    form: oppVault ? { streak: oppVault.streak, last5: oppVault.history.slice(0, 5).map((h) => (h.won ? "W" : "L")) } : undefined,
    headToHead: youVault?.headToHead.find((h) => h.team.id === opponent.id),
    banSuggestion: maps[0].map,
    targetSuggestion,
  };
}

// Opt-in opponent scouting report on the veto screen (behind a "Scout" button).
function ScoutingReport({ you, opponent, settings }: { you: FieldTeam; opponent: FieldTeam; settings: CustomSettings }) {
  const [open, setOpen] = useState(false);
  const report = useMemo(() => (open ? buildScoutingReport(you, opponent, settings) : null), [open, you, opponent, settings]);
  const maxStrength = report ? Math.max(...report.maps.map((m) => m.oppStrength), 1) : 1;
  const photo = report ? playerPhoto(report.star.handle) : undefined;

  return (
    <div className="scout-card">
      <button type="button" className="scout-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Search size={15} />
        {open ? "Hide scouting report" : `Scout ${opponent.name}`}
      </button>
      {open && report && (
        <div className="scout-body">
          <p className="scout-tip">
            Ban <b>{mapName(report.banSuggestion)}</b> (their best); steer toward <b>{mapName(report.targetSuggestion)}</b> (your biggest edge).
          </p>

          <div className="scout-section-title">Map threat board</div>
          <div className="scout-maps">
            {report.maps.map((row) => (
              <div className="scout-map-row" key={row.map}>
                <span className="scout-map-name">
                  {row.name}
                  {report.comfort.includes(row.map) && <em className="scout-flag comfort">comfort</em>}
                  {report.weak.includes(row.map) && <em className="scout-flag weak">weak</em>}
                </span>
                <span className="scout-bar-track">
                  <span className="scout-bar" style={{ width: `${(row.oppStrength / maxStrength) * 100}%` }} />
                </span>
                <span className={`scout-edge ${row.yourEdge >= 0 ? "good" : "bad"}`}>{fmtDiff(Math.round(row.yourEdge))}</span>
                {row.vaultRecord && (
                  <span className="scout-map-rec">
                    {row.vaultRecord.wins}-{row.vaultRecord.losses}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="scout-section-title">Watch out for</div>
          <div className="scout-star">
            {photo && <img className="scout-star-face" src={photo} alt={report.star.handle} loading="lazy" />}
            <Flag country={report.star.country} />
            <div className="scout-star-id">
              <strong>{report.star.handle}</strong>
              <span>{report.star.role} · OVR {report.star.ovr}{report.starRating ? ` · ${report.starRating.toFixed(2)} vault` : ""}</span>
            </div>
          </div>

          <div className="scout-foot">
            <div>
              <span className="scout-foot-label">Recent form</span>
              {report.form && report.form.last5.length ? (
                <span className="scout-form">
                  {report.form.last5.map((result, index) => (
                    <em key={index} className={result === "W" ? "good" : "bad"}>
                      {result}
                    </em>
                  ))}
                  {report.form.streak && <small>{report.form.streak.count}{report.form.streak.type} streak</small>}
                </span>
              ) : (
                <span className="scout-none">no prior matches</span>
              )}
            </div>
            <div>
              <span className="scout-foot-label">Head-to-head</span>
              {report.headToHead ? (
                <span className="scout-h2h">
                  <b className="good">{report.headToHead.wins}</b>–<b className="bad">{report.headToHead.losses}</b> for you
                </span>
              ) : (
                <span className="scout-none">first meeting</span>
              )}
            </div>
          </div>
        </div>
      )}
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
          <button aria-label="Show both sides" className={sideFilter === "both" ? "stats-filter active" : "stats-filter muted"} onClick={() => setSideFilter("both")}>
            <Swords size={15} /> <span>Both</span>
          </button>
          <button aria-label="Show Terrorist-side stats" className={sideFilter === "T" ? "stats-filter active" : "stats-filter muted"} onClick={() => setSideFilter("T")}>
            <FactionBadge side="T" compact label={false} /> <span>T side</span>
          </button>
          <button aria-label="Show Counter-Terrorist-side stats" className={sideFilter === "CT" ? "stats-filter active" : "stats-filter muted"} onClick={() => setSideFilter("CT")}>
            <FactionBadge side="CT" compact label={false} /> <span>CT side</span>
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
  eventName,
  scope,
  onScopeChange,
  onBack,
  onOpenPlayer,
  onOpenTeam,
}: {
  rows: PlayerDatabaseRow[];
  eventName?: string;
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
            <span>{eventName ? "Event stats" : "Run stats"}</span>
          </div>
          <h1>{eventName ?? "Player database"}</h1>
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

function VaultTeamPlayerPage({
  profile,
  replayIds,
  onBack,
  onOpenReplay,
}: {
  profile: TeamPlayerProfile;
  replayIds: Set<string>;
  onBack: () => void;
  onOpenReplay: (matchId: string) => void;
}) {
  const { player, team } = profile;
  const [tab, setTab] = useState<"majors" | "results">("majors");
  const [majorFilter, setMajorFilter] = useState<string | null>(null);
  const wins = profile.history.filter((row) => row.won).length;
  const losses = profile.history.length - wins;
  const kdDiff = player.line.kills - player.line.deaths;
  const photo = playerPhoto(player.handle);
  const selectedMajor = profile.majors.find((major) => major.key === majorFilter);
  const shownHistory = majorFilter ? profile.history.filter((row) => row.majorKey === majorFilter) : profile.history;
  const eventLabel = (row: TeamPlayerProfile["history"][number]) =>
    circuitEvents.find((event) => event.id === row.eventId)?.shortName ?? row.eventName ?? "Saved match";

  useEffect(() => {
    setTab("majors");
    setMajorFilter(null);
  }, [player.versionKey, team.id]);

  return (
    <main className="layout fullscreen-page vault-page vault-team-page vault-team-player-page" style={{ "--crest": team.accent } as React.CSSProperties}>
      <section className="fullscreen-head">
        <div className="vault-team-player-headline">
          {photo ? <img className="vault-team-player-photo" src={photo} alt={player.handle} loading="lazy" /> : <TeamLogo team={team} />}
          <div>
            <div className="section-title">
              <Users size={18} />
              <span>{player.current ? "Current roster" : "Former player"}</span>
            </div>
            <h1><Flag country={player.country} /> {player.handle}</h1>
            <p>{player.realName} · {player.role} · results with {team.name}</p>
          </div>
        </div>
        <button className="secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to team
        </button>
      </section>

      <section className="vault-hero vault-team-player-summary">
        <div className="vault-hero-tile">
          <strong>{player.maps}</strong>
          <span>Maps for team</span>
        </div>
        <div className="vault-hero-tile">
          <strong className={ratingTone(player.line.rating)}>{player.line.rating.toFixed(2)}</strong>
          <span>Rating</span>
        </div>
        <div className="vault-hero-tile">
          <strong className={kdDiff >= 0 ? "good" : "bad"}>{kdDiff >= 0 ? "+" : ""}{kdDiff}</strong>
          <span>K-D difference</span>
        </div>
        <div className="vault-hero-tile">
          <strong>{wins}-{losses}</strong>
          <span>Map record</span>
        </div>
      </section>

      <div className="segmented compact vault-team-player-tabs" role="tablist" aria-label="Player team history">
        <button
          className={tab === "majors" ? "selected" : ""}
          onClick={() => setTab("majors")}
          role="tab"
          aria-selected={tab === "majors"}
        >
          <Trophy size={15} />
          Majors
        </button>
        <button
          className={tab === "results" ? "selected" : ""}
          onClick={() => setTab("results")}
          role="tab"
          aria-selected={tab === "results"}
        >
          <Database size={15} />
          Results
        </button>
      </div>

      {tab === "majors" && (
        <section className="vault-card">
          <div className="vault-card-head">
            <div className="section-title">
              <Trophy size={18} />
              <span>Major placements with {team.tag}</span>
            </div>
            <span className="vault-card-note">{profile.majors.length} {profile.majors.length === 1 ? "Major" : "Majors"}</span>
          </div>
          <div className="vault-player-major-list">
            {profile.majors.length ? (
              profile.majors.map((major) => {
                const savedAt = new Date(major.recordedAt);
                const date = Number.isNaN(savedAt.getTime())
                  ? "Saved event"
                  : savedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                return (
                  <article className={`vault-player-major-row ${major.tone}`} key={major.key}>
                    <div className="vault-player-major-badge">
                      <Trophy size={14} />
                      <strong>{major.placement}</strong>
                    </div>
                    <div className="vault-player-major-team">
                      <TeamLogo team={team} small />
                      <b>{team.name}</b>
                    </div>
                    <div className="vault-player-major-event">
                      <b>{major.label}</b>
                      <small>{major.detail} · {major.maps} maps · {major.wins}-{major.losses} · {date}</small>
                    </div>
                    <div className="vault-player-major-rating">
                      <b className={ratingTone(major.line.rating)}>{major.line.rating.toFixed(2)}</b>
                      <small>Rating</small>
                    </div>
                    <button
                      type="button"
                      className="secondary compact"
                      onClick={() => {
                        setMajorFilter(major.key);
                        setTab("results");
                      }}
                    >
                      <Database size={14} />
                      Stats
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="vault-player-major-empty">
                <Trophy size={18} />
                <b>No complete Major placements recorded</b>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "results" && (
        <section className="vault-card">
          <div className="vault-card-head">
            <div className="section-title">
              <Database size={18} />
              <span>{selectedMajor ? `${selectedMajor.label} results` : `Results for ${team.tag}`}</span>
            </div>
            <div className="vault-player-result-actions">
              <span className="vault-card-note">{shownHistory.length} recorded maps</span>
              {majorFilter && (
                <button type="button" className="secondary compact" onClick={() => setMajorFilter(null)}>
                  All results
                </button>
              )}
            </div>
          </div>
          <div className="vault-player-result-wrap">
            <table className="vault-player-result-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Opponent</th>
                  <th>Map</th>
                  <th>Result</th>
                  <th>K-D</th>
                  <th>ADR</th>
                  <th>Rating</th>
                  <th aria-label="Replay" />
                </tr>
              </thead>
              <tbody>
                {shownHistory.map((row) => {
                  const canReplay = replayIds.has(row.matchId);
                  return (
                    <tr key={row.matchId}>
                      <td><b>{eventLabel(row)}</b><span>{row.stage ?? "match"}</span></td>
                      <td>
                        <div className="vault-player-result-opponent">
                          <TeamLogo team={row.opponent} small />
                          <b>{row.opponent.name}</b>
                        </div>
                      </td>
                      <td>{mapName(row.map)}</td>
                      <td><b className={row.won ? "good" : "bad"}>{row.won ? "W" : "L"} {row.teamScore}-{row.oppScore}</b></td>
                      <td>{row.line.kills}-{row.line.deaths}</td>
                      <td>{row.line.adr.toFixed(0)}</td>
                      <td><b className={ratingTone(row.line.rating)}>{row.line.rating.toFixed(2)}</b></td>
                      <td>
                        <button
                          type="button"
                          className="icon-button compact"
                          disabled={!canReplay}
                          onClick={() => canReplay && onOpenReplay(row.matchId)}
                          title={canReplay ? "Watch round replay" : "Replay not saved for this map"}
                        >
                          <Play size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

// A team's all-time profile from the Vault: record + streak, per-map W-L, roster ranked by per-team
// rating (with an MVP), head-to-head vs each opponent, and a replayable match history.
function VaultTeamPage({
  teamId,
  revision,
  onBack,
  onOpenReplay,
  onOpenTeam,
}: {
  teamId: string | null;
  revision: number;
  onBack: () => void;
  onOpenReplay: (matchId: string) => void;
  onOpenTeam: (teamId: string) => void;
}) {
  const db = useMemo(() => getMatchDb(), []);
  const profile = useMemo(() => (teamId ? db.teamProfile(teamId) : undefined), [db, revision, teamId]);
  const replayIds = useMemo(() => db.eventLogIds(), [db, revision]);
  const [vsFilter, setVsFilter] = useState<string | null>(null);
  const [rosterTab, setRosterTab] = useState<"current" | "former">("current");
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(null);
  const selectedPlayer = useMemo(
    () => (teamId && selectedPlayerKey ? db.teamPlayerProfile(teamId, selectedPlayerKey) : undefined),
    [db, revision, selectedPlayerKey, teamId],
  );

  useEffect(() => {
    setVsFilter(null); // reset the head-to-head filter when navigating to a different team
    setRosterTab("current");
    setSelectedPlayerKey(null);
  }, [teamId]);

  if (!profile) {
    return (
      <main className="layout fullscreen-page">
        <section className="fullscreen-head">
          <div>
            <div className="section-title">
              <Shield size={18} />
              <span>Team</span>
            </div>
            <h1>No saved matches for this team</h1>
          </div>
          <button className="secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
        </section>
      </main>
    );
  }

  if (selectedPlayer) {
    return (
      <VaultTeamPlayerPage
        profile={selectedPlayer}
        replayIds={replayIds}
        onBack={() => setSelectedPlayerKey(null)}
        onOpenReplay={onOpenReplay}
      />
    );
  }

  const winPct = profile.matches ? (profile.wins / profile.matches) * 100 : 0;
  const mvp = profile.roster[0];
  const mvpKey = profile.roster[0]?.versionKey;
  const formerRoster = profile.roster.filter((row) => !row.current);
  const currentRoster = profile.roster.filter((row) => row.current);
  const shownRoster = rosterTab === "former" ? formerRoster : currentRoster;
  const history = vsFilter ? profile.history.filter((row) => row.opponent.id === vsFilter) : profile.history;

  return (
    <main className="layout fullscreen-page vault-page vault-team-page" style={{ "--crest": profile.team.accent } as React.CSSProperties}>
      <section className="fullscreen-head">
        <div className="vault-team-headline">
          <TeamLogo team={profile.team} />
          <div>
            <div className="section-title">
              <Shield size={18} />
              <span>Team profile</span>
            </div>
            <h1>
              {profile.team.name}
              {profile.team.year && <em className="vault-era">'{profile.team.year.slice(-2)}</em>}
            </h1>
            <p>
              {profile.wins}–{profile.losses} · {winPct.toFixed(0)}% win rate · {profile.matches} maps
              {profile.streak ? ` · ${profile.streak.count}${profile.streak.type} streak` : ""}
            </p>
          </div>
        </div>
        <button className="secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
      </section>

      <section className="vault-hero">
        <div className="vault-hero-tile">
          <strong>
            {profile.wins}-{profile.losses}
          </strong>
          <span>Record</span>
        </div>
        <div className="vault-hero-tile">
          <strong>{winPct.toFixed(0)}%</strong>
          <span>Win rate</span>
        </div>
        <div className="vault-hero-tile">
          <strong>{profile.matches}</strong>
          <span>Maps</span>
        </div>
        {mvp && (
          <div className="vault-hero-leader">
            <span className="vault-hero-leader-label">Team MVP</span>
            <div className="vault-hero-leader-body">
              {playerPhoto(mvp.handle) && <img className="vault-face lg" src={playerPhoto(mvp.handle)} alt={mvp.handle} loading="lazy" />}
              <div className="vault-hero-leader-id">
                <strong>
                  <Flag country={mvp.country} /> {mvp.handle}
                </strong>
                <span>
                  {mvp.line.kills}-{mvp.line.deaths} K–D · {mvp.maps} maps
                </span>
              </div>
              <b className="vault-hero-leader-val">{mvp.line.rating.toFixed(2)}</b>
            </div>
          </div>
        )}
      </section>

      <section className="vault-card">
        <div className="section-title">
          <Gauge size={18} />
          <span>Map record</span>
        </div>
        <div className="team-map-chips">
          {profile.byMap.map((entry) => (
            <div className="team-map-chip" key={entry.map}>
              <b>{mapName(entry.map)}</b>
              <span>
                <em className="good">{entry.wins}W</em> <em className="bad">{entry.losses}L</em>
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="vault-two-col">
        <section className="vault-card">
          <div className="vault-card-head">
            <div className="section-title">
              <Users size={18} />
              <span>Roster</span>
            </div>
            {formerRoster.length > 0 && (
              <div className="segmented compact roster-tabs">
                <button className={rosterTab === "current" ? "selected" : ""} onClick={() => setRosterTab("current")}>
                  Current
                </button>
                <button className={rosterTab === "former" ? "selected" : ""} onClick={() => setRosterTab("former")}>
                  Former ({formerRoster.length})
                </button>
              </div>
            )}
          </div>
          <table className="vault-table team-roster-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Maps</th>
                <th>K–D</th>
                <th>ADR</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {shownRoster.map((row) => (
                <tr className="vault-roster-clickable" key={row.versionKey}>
                  <td className="vault-team-cell">
                    <button type="button" className="vault-roster-player-link" onClick={() => setSelectedPlayerKey(row.versionKey)}>
                      <Flag country={row.country} />
                      <b>{row.handle}</b>
                      <span>{row.role}</span>
                      {row.versionKey === mvpKey && <em className="team-mvp-badge">MVP</em>}
                      <ArrowRight size={13} />
                    </button>
                  </td>
                  <td>{row.maps}</td>
                  <td>
                    {row.line.kills}-{row.line.deaths}
                  </td>
                  <td>{row.line.adr.toFixed(0)}</td>
                  <td className={ratingTone(row.line.rating)}>{row.line.rating.toFixed(2)}</td>
                </tr>
              ))}
              {shownRoster.length === 0 && (
                <tr>
                  <td colSpan={5} className="roster-empty">
                    No former players yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="vault-card">
          <div className="section-title">
            <Swords size={18} />
            <span>Head-to-head</span>
          </div>
          <div className="team-h2h-list">
            {profile.headToHead.map((entry) => (
              <div className={`team-h2h-row${vsFilter === entry.team.id ? " active" : ""}`} key={entry.team.id}>
                <button
                  type="button"
                  className="team-h2h-main"
                  onClick={() => setVsFilter(vsFilter === entry.team.id ? null : entry.team.id)}
                  title={`Filter matches vs ${entry.team.name}`}
                >
                  <span className="team-h2h-name">
                    <TeamLogo team={entry.team} small />
                    <span>{entry.team.name}</span>
                  </span>
                  <span className="team-h2h-rec">
                    <em className="good">{entry.wins}</em>–<em className="bad">{entry.losses}</em>
                  </span>
                </button>
                <button type="button" className="team-h2h-go" onClick={() => onOpenTeam(entry.team.id)} title={`${entry.team.name} profile`}>
                  <ArrowLeft size={13} style={{ transform: "rotate(180deg)" }} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="vault-card">
        <div className="vault-card-head">
          <div className="section-title">
            <Clock3 size={18} />
            <span>Match history</span>
          </div>
          {vsFilter && (
            <button className="secondary" onClick={() => setVsFilter(null)}>
              Clear filter
            </button>
          )}
        </div>
        <div className="vault-match-list">
          {history.map((row) => {
            const canReplay = replayIds.has(row.matchId);
            return (
              <button
                type="button"
                className={`vault-match-row vault-team-match-row${canReplay ? "" : " no-replay"}`}
                key={row.matchId}
                aria-disabled={!canReplay}
                onClick={() => canReplay && onOpenReplay(row.matchId)}
                title={canReplay ? "Watch round replay" : "Replay not saved for this match"}
              >
                <span className="vault-match-map">{mapAbbr(row.map)}</span>
                <span className={`team-match-result ${row.won ? "won" : "lost"}`}>{row.won ? "W" : "L"}</span>
                <b>
                  {row.teamScore}–{row.oppScore}
                </b>
                <span className="team-match-opp">
                  <span className="team-match-vs">vs</span>
                  <TeamLogo team={row.opponent} small />
                  <span className="team-match-opp-name">{row.opponent.tag}</span>
                </span>
                <span className="vault-match-play">{canReplay ? <Play size={13} /> : null}</span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function VaultPage({
  onBack,
  onOpenReplay,
  onOpenTeam,
  dbReady,
}: {
  onBack: () => void;
  onOpenReplay: (matchId: string) => void;
  onOpenTeam: (teamId: string) => void;
  dbReady: boolean;
}) {
  const db = useMemo(() => getMatchDb(), []);
  const [refresh, setRefresh] = useState(0);
  // Recompute once the Vault's full history finishes loading from IndexedDB.
  useEffect(() => {
    if (dbReady) setRefresh((value) => value + 1);
  }, [dbReady]);
  const [statKey, setStatKey] = useState(VAULT_STATS[0].key);
  const [sideFilter, setSideFilter] = useState<StatsSideFilter>("both");
  const [mapFilter, setMapFilter] = useState<VaultMapFilter>("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc"); // desc = highest first; asc surfaces the lowest

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
  const leaders = useMemo(() => {
    const dir = sortDir === "asc" ? -1 : 1; // flip both the stat and the rating tiebreak when showing lowest
    return [...filteredPlayers]
      .sort((a, b) => dir * (stat.get(b.line) - stat.get(a.line)) || dir * (b.line.rating - a.line.rating))
      .slice(0, 25);
  }, [filteredPlayers, stat, sortDir]);
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
            <span className="vault-hero-leader-label">{sortDir === "asc" ? `Lowest ${stat.label}` : `${stat.label} leader`}</span>
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
          <button
            type="button"
            className="vault-sort-toggle"
            aria-pressed={sortDir === "asc"}
            onClick={() => setSortDir((dir) => (dir === "desc" ? "asc" : "desc"))}
            title={sortDir === "desc" ? "Showing highest — click for lowest" : "Showing lowest — click for highest"}
          >
            {sortDir === "desc" ? "Highest" : "Lowest"}
            <ArrowLeft size={13} style={{ transform: sortDir === "desc" ? "rotate(-90deg)" : "rotate(90deg)" }} />
          </button>
        </div>
        {leaders.length === 0 ? (
          <div className="vault-no-rows">No {sideFilter === "both" ? "" : `${sideFilter}-side `}records{mapFilter === "all" ? "" : ` on ${mapName(mapFilter)}`} yet.</div>
        ) : (
          <div className="vault-leader-list">
            {leaders.map((player, index) => {
              const photo = playerPhoto(player.handle);
              return (
                <div className={`vault-leader-row${index < 3 && sortDir === "desc" ? ` medal medal-${index + 1}` : ""}`} key={player.versionKey}>
                  <span className="vault-rank-chip">{index + 1}</span>
                  {photo ? (
                    <img className="vault-face" src={photo} alt={player.handle} loading="lazy" />
                  ) : (
                    <span className="vault-face placeholder" aria-hidden="true" />
                  )}
                  <div className="vault-leader-id">
                    <strong>
                      <Flag country={player.country} />
                      <span className="vault-handle">{player.handle}</span>
                      {player.year && <em className="vault-era">'{player.year.slice(-2)}</em>}
                    </strong>
                    <span className="vault-sub">
                      {player.matches} map{player.matches === 1 ? "" : "s"} · {player.line.rating.toFixed(2)} rating
                    </span>
                  </div>
                  <b className="vault-stat-val">{stat.fmt(player.line)}</b>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="vault-card">
        <div className="vault-card-head">
          <div className="section-title">
            <Shield size={18} />
            <span>Team standings</span>
          </div>
          <span className="vault-count">{teams.length} teams</span>
        </div>
        <div className="vault-standings-list">
          {teams.map((row: TeamRecordRow) => {
            const pct = (row.wins / Math.max(1, row.matches)) * 100;
            return (
              <button type="button" className="vault-standing-row" key={row.team.id} onClick={() => onOpenTeam(row.team.id)} title={`${row.team.name} — team profile`}>
                <TeamLogo team={row.team} small />
                <div className="vault-standing-id">
                  <strong>{row.team.name}</strong>
                  <span>{row.matches} map{row.matches === 1 ? "" : "s"}</span>
                </div>
                <span className="vault-standing-rec">
                  <em className="good">{row.wins}</em>–<em className="bad">{row.losses}</em>
                </span>
                <span className="vault-standing-pct">{pct.toFixed(0)}%</span>
              </button>
            );
          })}
        </div>
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

// Win-probability momentum graph: the engine's actual per-round win probability (for the left team)
// across a map, with the real round outcomes as dots and stars on upset/swing rounds.
function WinProbGraph({
  probabilities,
  winners,
  leftTag,
  rightTag,
}: {
  probabilities: number[];
  winners?: TimelineSide[];
  leftTag: string;
  rightTag: string;
}) {
  const n = probabilities.length;
  if (!n) return null;
  const xAt = (i: number) => (n === 1 ? 50 : 3 + (i / (n - 1)) * 94);
  const yAt = (p: number) => 2 + (1 - Math.max(0, Math.min(1, p))) * 28; // prob 1 -> top (y=2), 0 -> bottom (y=30)
  const linePoints = probabilities.map((p, i) => `${xAt(i).toFixed(2)},${yAt(p).toFixed(2)}`).join(" ");
  const halfX = n > 13 ? xAt(12) : null; // side switch after round 13

  return (
    <div className="winprob-graph">
      <svg viewBox="0 0 100 32" role="img" aria-label="Round win probability over the map">
        <rect x="0" y="2" width="100" height="14" className="wp-zone-left" />
        <rect x="0" y="16" width="100" height="14" className="wp-zone-right" />
        <line x1="0" y1="16" x2="100" y2="16" className="wp-centerline" />
        {halfX !== null && <line x1={halfX} y1="2" x2={halfX} y2="30" className="wp-halfline" />}
        <polyline points={linePoints} className="wp-line" vectorEffect="non-scaling-stroke" />
        {probabilities.map((p, i) => {
          const side = winners?.[i];
          const swing = side === "left" ? p < 0.35 : side === "right" ? p > 0.65 : false;
          return (
            <g key={i}>
              {swing && <circle cx={xAt(i)} cy={yAt(p)} r={1.7} className="wp-swing" />}
              <circle cx={xAt(i)} cy={yAt(p)} r={0.95} className={`wp-dot ${side === "left" ? "won" : side === "right" ? "lost" : ""}`} />
            </g>
          );
        })}
      </svg>
      <div className="winprob-axis">
        <span className="good">↑ {leftTag} favoured</span>
        <span className="wp-mid">dots: round winner · ★ upset</span>
        <span className="bad">{rightTag} favoured ↓</span>
      </div>
    </div>
  );
}

// A player's rating per map over the run, with event-stage boundaries when the circuit has several.
function FormChart({ ratings, segments = [] }: { ratings: number[]; segments?: Array<{ label: string; count: number }> }) {
  if (ratings.length < 2) return null;
  const lo = Math.min(0.8, ...ratings) - 0.05;
  const hi = Math.max(1.2, ...ratings) + 0.05;
  const xAt = (i: number) => 3 + (i / (ratings.length - 1)) * 94;
  const yAt = (r: number) => 2 + (1 - (r - lo) / (hi - lo)) * 28; // higher rating -> top
  const points = ratings.map((r, i) => `${xAt(i).toFixed(2)},${yAt(r).toFixed(2)}`).join(" ");
  const baseY = yAt(1).toFixed(2);
  let completedMaps = 0;
  const stageBoundaries = segments.slice(0, -1).map((segment) => {
    completedMaps += segment.count;
    return (xAt(completedMaps - 1) + xAt(completedMaps)) / 2;
  });

  return (
    <div className="form-chart">
      <svg viewBox="0 0 100 32" role="img" aria-label="Rating per map over the run">
        <line x1="0" y1={baseY} x2="100" y2={baseY} className="fc-baseline" />
        {stageBoundaries.map((x, index) => (
          <line key={index} x1={x} y1="2" x2={x} y2="30" className="fc-stage-line" />
        ))}
        <polyline points={points} className="fc-line" vectorEffect="non-scaling-stroke" />
        {ratings.map((r, i) => (
          <circle key={i} cx={xAt(i)} cy={yAt(r)} r={0.9} className={`fc-dot ${r >= 1 ? "good" : "bad"}`} />
        ))}
      </svg>
      {segments.length > 1 && (
        <div className="fc-stage-axis">
          {segments.map((segment) => (
            <span key={segment.label} style={{ flexGrow: segment.count }}>{segment.label}</span>
          ))}
        </div>
      )}
      <div className="winprob-axis">
        <span>Map 1</span>
        <span className="wp-mid">1.00 baseline</span>
        <span>Map {ratings.length}</span>
      </div>
    </div>
  );
}

// Series wrapper with per-map tabs (mirrors the replay/timeline panels).
function WinProbPanel({ left, right, maps }: { left: ReplayTeam; right: ReplayTeam; maps: SeriesMapResult[] }) {
  const withProbs = maps.filter((map) => (map.roundProbabilities?.length ?? 0) > 0);
  const [mapIndex, setMapIndex] = useState(0);
  if (!withProbs.length) return null;
  const active = withProbs[Math.min(mapIndex, withProbs.length - 1)];

  return (
    <section className="winprob-panel">
      <div className="replay-head">
        <div className="section-title">
          <Gauge size={18} />
          <span>Win probability</span>
        </div>
        {withProbs.length > 1 && (
          <div className="replay-map-tabs">
            {withProbs.map((map, index) => (
              <button key={`${map.map}-${index}`} className={index === mapIndex ? "active" : ""} onClick={() => setMapIndex(index)}>
                {mapName(map.map)}
              </button>
            ))}
          </div>
        )}
      </div>
      <WinProbGraph probabilities={active.roundProbabilities!} winners={active.roundWinners} leftTag={left.tag} rightTag={right.tag} />
    </section>
  );
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
function buildMajorAwards(results: SwissResult[], championId?: string): MajorAward[] {
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

  const championRows = championId ? rows.filter((row) => row.team.id === championId) : [];
  const championEligible = championRows.filter((row) => row.matches >= minMaps);
  const mvpPool = championId
    ? championEligible.length
      ? championEligible
      : championRows
    : eligible.length
      ? eligible
      : rows;
  const mvp = best(mvpPool, (row) => row.line.rating);
  if (mvp) {
    awards.push({
      key: "mvp",
      title: "Event MVP",
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
  championId,
  championName,
  onOpenPlayer,
}: {
  results: SwissResult[];
  championId?: string;
  championName?: string;
  onOpenPlayer: (player: Player, team: FieldTeam) => void;
}) {
  const awards = useMemo(() => buildMajorAwards(results, championId), [results, championId]);
  if (!awards.length) return null;

  return (
    <section className="awards-panel">
      <div className="awards-head">
        <div className="section-title">
          <Trophy size={18} />
          <span>Player of the event</span>
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
function PlayerVaultLine({ vault, extremes }: { vault: PlayerCareerRecord | undefined; extremes: PlayerRatingExtremes | undefined }) {
  if (!vault || vault.matches === 0) return null;
  const line = vault.line;
  return (
    <>
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
      {extremes && vault.matches >= 2 && (
        <section className="vault-records">
          <div className="vault-records-head">
            <div className="section-title">
              <Award size={17} />
              <span>Historic map ratings</span>
            </div>
            <span>{vault.matches} recorded {vault.matches === 1 ? "map" : "maps"}</span>
          </div>
          <div className="vault-record-grid">
            <VaultRatingRecord kind="best" appearance={extremes.best} />
            <VaultRatingRecord kind="worst" appearance={extremes.worst} />
          </div>
        </section>
      )}
    </>
  );
}

function VaultRatingRecord({ kind, appearance }: { kind: "best" | "worst"; appearance: PlayerRatingAppearance }) {
  const isBest = kind === "best";
  const savedAt = new Date(appearance.recordedAt);
  const dateLabel = Number.isNaN(savedAt.getTime())
    ? "Saved match"
    : savedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const stageLabel = appearance.stage
    ? appearance.stage.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
    : "Match";
  return (
    <article className={`vault-record ${kind}`}>
      <div className="vault-record-label">
        {isBest ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
        <span>{isBest ? "Historic best" : "Historic worst"}</span>
      </div>
      <strong className="vault-record-rating">{appearance.line.rating.toFixed(2)}</strong>
      <div className="vault-record-opponent">
        <span>vs</span>
        <TeamLogo team={appearance.opponent} small />
        <b>{appearance.opponent.name}</b>
      </div>
      <div className="vault-record-meta">
        <span>{mapName(appearance.map)}</span>
        <b className={appearance.won ? "good" : "bad"}>{appearance.teamScore}-{appearance.oppScore}</b>
        <span>{stageLabel}</span>
        <span>{appearance.team.tag}</span>
        <span>{dateLabel}</span>
      </div>
    </article>
  );
}

const RIVAL_SAMPLE_MAPS = 3;

function PlayerRivalCard({
  kind,
  record,
}: {
  kind: "favorite" | "nemesis" | "frequent";
  record: PlayerOpponentRecord;
}) {
  const label = kind === "favorite" ? "Favorite opponent" : kind === "nemesis" ? "Nemesis" : "Most faced";
  const winPct = record.maps ? (record.wins / record.maps) * 100 : 0;
  const kdDiff = record.line.kills - record.line.deaths;
  return (
    <article className={`player-rival-card ${kind}`}>
      <div className="player-rival-label">
        {kind === "favorite" ? <TrendingUp size={16} /> : kind === "nemesis" ? <TrendingDown size={16} /> : <Swords size={16} />}
        <span>{label}</span>
      </div>
      <div className="player-rival-team">
        <TeamLogo team={record.opponent} />
        <div>
          <strong>{record.opponent.name}</strong>
          <span>{record.opponent.tag}</span>
        </div>
      </div>
      <div className="player-rival-rating">
        <strong className={ratingTone(record.line.rating)}>{record.line.rating.toFixed(2)}</strong>
        <span>Rating</span>
      </div>
      <div className="player-rival-metrics">
        <span><b>{record.maps}</b><small>Maps</small></span>
        <span><b>{record.wins}-{record.losses}</b><small>Record</small></span>
        <span><b>{winPct.toFixed(0)}%</b><small>Win rate</small></span>
        <span><b className={kdDiff >= 0 ? "good" : "bad"}>{kdDiff >= 0 ? "+" : ""}{kdDiff}</b><small>K-D</small></span>
      </div>
    </article>
  );
}

function PlayerRivalsPanel({ matchups }: { matchups: PlayerOpponentRecord[] }) {
  if (!matchups.length) return <div className="empty-fullscreen">No Vault matchups recorded for this player yet.</div>;

  const qualified = matchups
    .filter((record) => record.maps >= RIVAL_SAMPLE_MAPS)
    .sort((a, b) => b.line.rating - a.line.rating || b.maps - a.maps);
  const favorite = qualified.length >= 2 ? qualified[0] : undefined;
  const nemesis = qualified.length >= 2 ? qualified[qualified.length - 1] : undefined;
  const mostFaced = matchups[0];

  return (
    <section className="player-rivals-panel">
      <div className="player-rivals-head">
        <div className="section-title">
          <Swords size={18} />
          <span>Vault matchups</span>
        </div>
        <span>{matchups.length} {matchups.length === 1 ? "opponent" : "opponents"}</span>
      </div>

      {favorite && nemesis ? (
        <div className="player-rival-spotlights">
          <PlayerRivalCard kind="favorite" record={favorite} />
          <PlayerRivalCard kind="nemesis" record={nemesis} />
          <PlayerRivalCard kind="frequent" record={mostFaced} />
        </div>
      ) : (
        <div className="player-rival-sample">
          <Swords size={18} />
          <div>
            <strong>Rival labels need a larger sample</strong>
            <span>Two opponents must reach {RIVAL_SAMPLE_MAPS} recorded maps. Most faced: {mostFaced.opponent.name} ({mostFaced.maps}).</span>
          </div>
        </div>
      )}

      <div className="player-matchup-list">
        <div className="player-matchup-list-head">
          <strong>All matchups</strong>
          <span>{RIVAL_SAMPLE_MAPS}+ maps qualifies for rival labels</span>
        </div>
        <div className="player-matchup-table-wrap">
          <table className="player-matchup-table">
            <thead>
              <tr>
                <th>Opponent</th>
                <th>Maps</th>
                <th>Rating</th>
                <th>K-D</th>
                <th>Record</th>
                <th>Win rate</th>
              </tr>
            </thead>
            <tbody>
              {matchups.map((record) => {
                const kdDiff = record.line.kills - record.line.deaths;
                return (
                  <tr key={record.opponent.id}>
                    <td>
                      <div className="player-matchup-team">
                        <TeamLogo team={record.opponent} small />
                        <div><b>{record.opponent.name}</b><span>{record.opponent.tag}</span></div>
                      </div>
                    </td>
                    <td>{record.maps}</td>
                    <td><b className={ratingTone(record.line.rating)}>{record.line.rating.toFixed(2)}</b></td>
                    <td className={kdDiff >= 0 ? "good" : "bad"}>{record.line.kills}-{record.line.deaths}</td>
                    <td>{record.wins}-{record.losses}</td>
                    <td>{((record.wins / record.maps) * 100).toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

// ---- Career transfer window ----------------------------------------------------------------------

const fmtMoney = (amount: number) => `${amount < 0 ? "-" : ""}$${Math.abs(Math.round(amount)).toLocaleString()}`;

function CircuitProgressStrip({
  event,
  season,
  points,
  history,
}: {
  event: CircuitEvent;
  season: number;
  points: number;
  history: CareerHistoryEntry[];
}) {
  const activeIndex = circuitEventIndex(event.id);
  const completed = new Set(
    history.filter((entry) => entry.season === season && entry.eventId).map((entry) => entry.eventId),
  );
  return (
    <section className="circuit-progress" aria-label="Circuit progression">
      <div className="circuit-progress-meta">
        <div>
          <Award size={17} />
          <strong>Season {season}</strong>
          <span>{event.name}</span>
        </div>
        <p>{event.description} · {circuitFieldLabel(event)} · {circuitQualificationLabel(event)}</p>
        <div className="circuit-rank">
          <span>World rank</span>
          <b>#{circuitWorldRank(points, builtInHltvRosters)}</b>
          <em>{points} pts</em>
        </div>
      </div>
      <div className="circuit-track">
        {circuitEvents.map((step, index) => {
          const isActive = step.id === event.id;
          const isDone = completed.has(step.id) || index < activeIndex;
          return (
            <div className={`circuit-step ${isActive ? "active" : isDone ? "done" : "locked"}`} key={step.id}>
              <span>{isDone && !isActive ? "✓" : index + 1}</span>
              <strong>{step.shortName}</strong>
              <small>{isActive ? circuitQualificationLabel(step) : index < activeIndex ? "cleared" : "locked"}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---- Manager career -----------------------------------------------------------------------------

type ManagerClubFilter = "all" | "elite" | "challenger" | "custom";

function ManagerOrganizationSelectPage({
  rosters,
  builtInCount,
  careerSeed,
  selectedRoster,
  onSelect,
  onBack,
  onConfirm,
}: {
  rosters: Roster[];
  builtInCount: number;
  careerSeed: string;
  selectedRoster: Roster;
  onSelect: (roster: Roster) => void;
  onBack: () => void;
  onConfirm: (roster: Roster) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ManagerClubFilter>("all");
  const customIds = useMemo(() => new Set(rosters.slice(builtInCount).map((roster) => roster.id)), [rosters, builtInCount]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rosters.filter((roster) => {
      const isCustom = customIds.has(roster.id);
      const matchesFilter = filter === "all"
        || (filter === "elite" && (roster.rank ?? 99) <= 16)
        || (filter === "challenger" && !isCustom && (roster.rank ?? 99) > 16)
        || (filter === "custom" && isCustom);
      const matchesQuery = !needle || [roster.name, roster.tag, roster.country, ...roster.players.map((player) => player.handle)]
        .some((value) => value.toLowerCase().includes(needle));
      return matchesFilter && matchesQuery;
    });
  }, [customIds, filter, query, rosters]);
  const inheritedPlayers = useMemo(() => selectedRoster.players.slice(0, 5).map(withCareerMeta), [selectedRoster]);
  const previewCareer = useMemo(() => createManagerCareer(careerSeed, {
    organizationId: selectedRoster.id,
    organizationName: selectedRoster.name,
    vrsPoints: selectedRoster.vrsPoints ?? 900,
    vrsRank: selectedRoster.rank ?? Math.min(64, builtInCount + 1),
    players: inheritedPlayers,
  }), [builtInCount, careerSeed, inheritedPlayers, selectedRoster]);
  const previewCoach = coachForRoster(selectedRoster);
  const monthlyPayroll = managerMonthlyPayroll(previewCareer);
  const contractByPlayer = new Map(previewCareer.contracts.map((contract) => [contract.playerId, contract]));
  const missingCoverage = requiredRoles.filter((role) => !inheritedPlayers.some((player) => player.role === role || player.secondaryRole === role));

  return (
    <main className="layout fullscreen-page manager-page manager-select-page">
      <section className="manager-takeover-head">
        <div>
          <button className="icon-only" onClick={onBack} title="Back to setup"><ArrowLeft size={18} /></button>
          <span><small>New manager career</small><h1>Choose an organization</h1></span>
        </div>
        <div className="manager-takeover-count"><b>{rosters.length}</b><span>clubs available</span></div>
      </section>

      <div className="manager-club-browser">
        <section className="manager-club-index">
          <div className="manager-club-tools">
            <label className="manager-club-search">
              <Search size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clubs or players" />
            </label>
            <div className="segmented manager-club-filters" aria-label="Organization filter">
              {(["all", "elite", "challenger", "custom"] as ManagerClubFilter[]).map((item) => (
                <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>
              ))}
            </div>
          </div>
          <div className="manager-club-list">
            {filtered.map((roster) => (
              <button key={roster.id} className={selectedRoster.id === roster.id ? "selected" : ""} onClick={() => onSelect(roster)}>
                <span className="manager-club-rank">{roster.rank ? `#${roster.rank}` : "NEW"}</span>
                <TeamLogo team={roster} small />
                <span className="manager-club-name"><strong>{roster.name}</strong><small><Flag country={roster.country} /> {roster.era} / {roster.year}</small></span>
                <span className="manager-club-rating"><b>{averageOvr(roster.players).toFixed(1)}</b><small>AVG OVR</small></span>
                <ArrowRight size={14} />
              </button>
            ))}
            {!filtered.length && <div className="manager-empty-state">No organization matches this view.</div>}
          </div>
        </section>

        <section className="manager-takeover-preview">
          <div className="manager-preview-identity">
            <TeamLogo team={selectedRoster} />
            <span><small>{selectedRoster.rank ? `VRS #${selectedRoster.rank}` : "Unranked organization"}</small><h2>{selectedRoster.name}</h2><p>{selectedRoster.tagline}</p></span>
          </div>
          <div className="manager-preview-kpis">
            <span><small>VRS points</small><b>{(selectedRoster.vrsPoints ?? 900).toLocaleString()}</b></span>
            <span><small>Opening cash</small><b>{fmtMoney(previewCareer.cash)}</b></span>
            <span><small>Monthly payroll</small><b>{fmtMoney(monthlyPayroll)}</b></span>
            <span><small>Head coach</small><b>{previewCoach?.handle ?? "Appoint next"}</b></span>
          </div>
          <div className="manager-preview-section-head">
            <span><small>Inherited squad</small><strong>Five contracted players</strong></span>
            <em className={missingCoverage.length ? "ineligible" : "eligible"}>{missingCoverage.length ? `Missing ${missingCoverage.join(" / ")}` : "Core roles covered"}</em>
          </div>
          <div className="manager-preview-roster">
            {inheritedPlayers.map((player) => {
              const photo = playerPhoto(player.handle);
              const contract = contractByPlayer.get(player.id);
              return (
                <div key={player.id}>
                  {photo ? <img src={photo} alt={player.handle} loading="lazy" /> : <Avatar label={player.handle} accent={selectedRoster.accent} />}
                  <span><strong><Flag country={player.country} /> {player.handle}</strong><small>{player.realName} / {player.role}</small></span>
                  <b>{player.ovr}<small>OVR</small></b>
                  <span className="manager-preview-contract"><strong>{contract ? `${fmtMoney(contract.monthlySalary)}/mo` : "No contract"}</strong><small>{contract ? `${managerContractDurationLabel(contract)} remaining` : "Staff action required"}</small></span>
                </div>
              );
            })}
          </div>
          <div className="manager-takeover-footer">
            <span><Shield size={16} /><em>Board expectation</em><strong>{(selectedRoster.rank ?? 99) <= 8 ? "Win elite events" : (selectedRoster.rank ?? 99) <= 24 ? "Reach playoffs" : "Climb the VRS"}</strong></span>
            <button className="primary large" disabled={inheritedPlayers.length < 5} onClick={() => onConfirm(selectedRoster)}>
              <BriefcaseBusiness size={18} /> Take over {selectedRoster.tag}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

const managerTrainingFocusOptions: Array<{ id: ManagerTrainingFocus; label: string; emphasis: string }> = [
  { id: "balanced", label: "Balanced", emphasis: "All-round growth" },
  { id: "mechanics", label: "Mechanics", emphasis: "Aim and clutch" },
  { id: "tactics", label: "Tactical prep", emphasis: "Consistency and IGL" },
  { id: "role", label: "Role mastery", emphasis: "Role attributes" },
  { id: "recovery", label: "Recovery", emphasis: "Morale and form" },
];

type ManagerRosterView = "lineup" | "development" | "contracts";
type ManagerPotentialFlipState = {
  playerId: string;
  startingPotential: number;
  cost: number;
  status: "choosing" | "flipping" | "won" | "lost";
  choice?: ManagerCoinSide;
  result?: ManagerCoinSide;
};

type ManagerCasinoFlipState = {
  playerId: string;
  stake: ManagerCasinoStake;
  startingCash: number;
  status: "choosing" | "flipping" | "won" | "lost";
  choice?: ManagerCoinSide;
  result?: ManagerCoinSide;
};

function ManagerRosterPage({
  team,
  roster,
  starters,
  coach,
  career,
  onBack,
  onOpenPlayer,
  onSaveLineup,
  onRenewContract,
  onReleaseContract,
  onOpenRecruitment,
  onSetTrainingFocus,
  onPotentialInvestment,
  onCasinoVisit,
  onSchedulePerformanceCamp,
  onAdvanceDate,
}: {
  team: FieldTeam;
  roster: Player[];
  starters: Player[];
  coach?: Coach;
  career: ManagerCareerState;
  onBack: () => void;
  onOpenPlayer: (player: Player, team: FieldTeam) => void;
  onSaveLineup: (playerIds: string[]) => void;
  onRenewContract: (player: Player, terms: ManagerOfferTerms) => void;
  onReleaseContract: (playerId: string) => void;
  onOpenRecruitment: (role: Role | "all") => void;
  onSetTrainingFocus: (player: Player, focus: ManagerTrainingFocus) => void;
  onPotentialInvestment: (player: Player, choice: ManagerCoinSide, result: ManagerCoinSide) => void;
  onCasinoVisit: (player: Player, stake: ManagerCasinoStake, choice: ManagerCoinSide, result: ManagerCoinSide) => void;
  onSchedulePerformanceCamp: (focus: ManagerPerformanceCampFocus) => void;
  onAdvanceDate: (targetDate?: string) => void;
}) {
  const [view, setView] = useState<ManagerRosterView>("lineup");
  const [lineupIds, setLineupIds] = useState(() => starters.map((player) => player.id));
  const [renewalPlayerId, setRenewalPlayerId] = useState("");
  const [renewalSalary, setRenewalSalary] = useState(1_000);
  const [renewalCycles, setRenewalCycles] = useState(3);
  const [releasePlayerId, setReleasePlayerId] = useState("");
  const [potentialFlip, setPotentialFlip] = useState<ManagerPotentialFlipState | null>(null);
  const [casinoPlayerId, setCasinoPlayerId] = useState("");
  const [casinoStake, setCasinoStake] = useState<ManagerCasinoStake>(MANAGER_CASINO_STAKES[0]);
  const [casinoFlip, setCasinoFlip] = useState<ManagerCasinoFlipState | null>(null);
  const potentialFlipTimer = useRef<number | undefined>(undefined);
  const casinoFlipTimer = useRef<number | undefined>(undefined);
  useEffect(() => setLineupIds(starters.map((player) => player.id)), [starters]);
  useEffect(() => () => {
    if (potentialFlipTimer.current) window.clearTimeout(potentialFlipTimer.current);
    if (casinoFlipTimer.current) window.clearTimeout(casinoFlipTimer.current);
  }, []);
  const contractByPlayer = new Map(career.contracts.map((contract) => [contract.playerId, contract]));
  const activeRoster = roster.filter((player) => contractByPlayer.get(player.id)?.status !== "expired");
  useEffect(() => {
    if (activeRoster[0] && !activeRoster.some((player) => player.id === casinoPlayerId)) setCasinoPlayerId(activeRoster[0].id);
  }, [activeRoster, casinoPlayerId]);
  const monthlyPayroll = managerMonthlyPayroll(career);
  const dynamicsByPlayer = new Map(career.playerDynamics.map((item) => [item.playerId, item]));
  const teamFamiliarity = managerTeamFamiliarity(career);
  const averageAge = activeRoster.length
    ? activeRoster.reduce((total, player) => total + (player.age ?? 24), 0) / activeRoster.length
    : 0;
  const lineupPlayers = lineupIds.map((id) => roster.find((player) => player.id === id)).filter((player): player is Player => Boolean(player));
  const depthChartClaims = new Set<string>();
  const depthChart = ([...requiredRoles, "Flex"] as Array<Role | "Flex">).map((role) => {
    const player = role === "Flex"
      ? lineupPlayers.find((item) => !depthChartClaims.has(item.id))
      : lineupPlayers.find((item) => !depthChartClaims.has(item.id) && item.role === role)
        ?? lineupPlayers.find((item) => !depthChartClaims.has(item.id) && item.secondaryRole === role);
    if (player) depthChartClaims.add(player.id);
    return { role, player };
  });
  const missingCoverage = requiredRoles.filter((role) => !lineupPlayers.some((player) => player.role === role || player.secondaryRole === role));
  const lineupLocked = managerLineupEditLocked(career);
  const lineupChanged = lineupIds.join("|") !== starters.map((player) => player.id).join("|");
  const renewalPlayer = roster.find((player) => player.id === renewalPlayerId);
  const renewalContract = renewalPlayer ? contractByPlayer.get(renewalPlayer.id) : undefined;
  const renewalTerms: ManagerOfferTerms | undefined = renewalContract
    ? { monthlySalary: renewalSalary, majorCycles: renewalCycles, squadRole: renewalContract.squadRole }
    : undefined;
  const renewalEvaluation = renewalPlayer && renewalContract && renewalTerms
    ? evaluateManagerContractRenewal(career, renewalContract, renewalPlayer, renewalTerms)
    : undefined;
  const renewalBonus = managerRenewalBonus(renewalSalary);
  const activeContractCount = career.contracts.filter((contract) => contract.status !== "expired").length;
  const releasePlayer = roster.find((player) => player.id === releasePlayerId);
  const releaseContract = releasePlayer ? contractByPlayer.get(releasePlayer.id) : undefined;
  const releaseCost = releaseContract ? managerContractReleaseCost(releaseContract) : 0;
  const potentialPlayer = potentialFlip ? activeRoster.find((player) => player.id === potentialFlip.playerId) : undefined;
  const potentialPlan = potentialPlayer ? managerTrainingPlan(career, potentialPlayer) : undefined;
  const nextPotentialCost = potentialPlayer ? managerPotentialLabCost(career, potentialPlayer) : 0;
  const casinoPlayer = activeRoster.find((player) => player.id === (casinoFlip?.playerId ?? casinoPlayerId));
  const casinoEligibility = casinoPlayer ? managerCasinoVisitAllowed(career, casinoPlayer, casinoStake) : undefined;
  const casinoNet = career.casinoVisits.reduce((total, visit) => total + visit.net, 0);
  const activeCamp = managerActivePerformanceCamp(career);
  const activeCampProgram = activeCamp
    ? managerPerformanceCampPrograms.find((program) => program.id === activeCamp.focus)
    : undefined;
  const completedCampCount = career.performanceCamps.filter((camp) => camp.status === "completed").length;
  const toggleLineupPlayer = (playerId: string) => {
    if (lineupLocked) return;
    setLineupIds((current) => current.includes(playerId)
      ? current.filter((id) => id !== playerId)
      : current.length < 5 ? [...current, playerId] : current);
  };
  const openRenewal = (player: Player) => {
    const contract = contractByPlayer.get(player.id);
    if (!contract) return;
    const recommended = managerRecommendedSalary(player, career);
    setRenewalPlayerId(player.id);
    setReleasePlayerId("");
    setRenewalSalary(Math.max(1_000, Math.ceil(recommended / 250) * 250));
    setRenewalCycles(3);
  };
  const submitRenewal = () => {
    if (!renewalPlayer || !renewalTerms || !renewalEvaluation) return;
    onRenewContract(renewalPlayer, renewalTerms);
    if (renewalEvaluation.accepted && career.cash >= renewalBonus) setRenewalPlayerId("");
  };
  const openRelease = (player: Player) => {
    setReleasePlayerId(player.id);
    setRenewalPlayerId("");
  };
  const submitRelease = () => {
    if (!releasePlayer || !releaseContract) return;
    onReleaseContract(releasePlayer.id);
    setReleasePlayerId("");
  };
  const openPotentialLab = (player: Player) => {
    setPotentialFlip({
      playerId: player.id,
      startingPotential: managerTrainingPlan(career, player).potentialOvr,
      cost: managerPotentialLabCost(career, player),
      status: "choosing",
    });
  };
  const startPotentialFlip = (choice: ManagerCoinSide) => {
    if (!potentialPlayer || potentialFlip?.status !== "choosing" || career.cash < potentialFlip.cost) return;
    const result = managerPotentialCoinResult(career, potentialPlayer);
    onPotentialInvestment(potentialPlayer, choice, result);
    setPotentialFlip({ ...potentialFlip, status: "flipping", choice, result });
    potentialFlipTimer.current = window.setTimeout(() => {
      setPotentialFlip((current) => current && current.status === "flipping"
        ? { ...current, status: current.choice === current.result ? "won" : "lost" }
        : current);
    }, 1700);
  };
  const openCasinoTable = () => {
    if (!casinoPlayer || !casinoEligibility?.allowed) return;
    setCasinoFlip({ playerId: casinoPlayer.id, stake: casinoStake, startingCash: career.cash, status: "choosing" });
  };
  const startCasinoFlip = (choice: ManagerCoinSide) => {
    if (!casinoPlayer || !casinoFlip || casinoFlip.status !== "choosing") return;
    const eligibility = managerCasinoVisitAllowed(career, casinoPlayer, casinoFlip.stake);
    if (!eligibility.allowed) return;
    const result = managerCasinoCoinResult(career, casinoPlayer, casinoFlip.stake);
    onCasinoVisit(casinoPlayer, casinoFlip.stake, choice, result);
    setCasinoFlip({ ...casinoFlip, status: "flipping", choice, result });
    casinoFlipTimer.current = window.setTimeout(() => {
      setCasinoFlip((current) => current && current.status === "flipping"
        ? { ...current, status: current.choice === current.result ? "won" : "lost" }
        : current);
    }, 1700);
  };

  return (
    <main className="layout fullscreen-page manager-page manager-roster-page">
      <section className="manager-calendar-head manager-roster-head">
        <div>
          <button className="icon-only" onClick={onBack} title="Back to manager headquarters"><ArrowLeft size={18} /></button>
          <TeamLogo team={team} />
          <span><small>{career.organizationName} / team operations</small><h1>Roster and Contracts</h1></span>
        </div>
        <div className="manager-roster-coach"><small>Head coach</small><b>{coach?.handle ?? "Vacant"}</b><span>{coach ? `${coach.style} / ${coach.rating}` : "Appointment required"}</span></div>
      </section>

      <section className="manager-roster-kpis" aria-label="Roster status">
        <div><span>Squad quality</span><b>{activeRoster.length ? averageOvr(activeRoster).toFixed(1) : "-"}</b><small>average OVR</small></div>
        <div><span>Average age</span><b>{averageAge.toFixed(1)}</b><small>years</small></div>
        <div><span>Monthly payroll</span><b>{fmtMoney(monthlyPayroll)}</b><small>{career.cash > 0 && monthlyPayroll > 0 ? `${(career.cash / monthlyPayroll).toFixed(1)} months runway` : "No active payroll"}</small></div>
        <div><span>Core familiarity</span><b>{teamFamiliarity}</b><small>{managerFamiliarityLabel(teamFamiliarity)}</small></div>
        <div><span>Role coverage</span><b className={missingCoverage.length ? "negative" : "positive"}>{missingCoverage.length ? missingCoverage.length : "Ready"}</b><small>{missingCoverage.length ? missingCoverage.join(" / ") : "IGL and AWP covered"}</small></div>
      </section>

      <nav className="manager-roster-tabs" role="tablist" aria-label="Roster workspace">
        <button role="tab" aria-selected={view === "lineup"} className={view === "lineup" ? "selected" : ""} onClick={() => setView("lineup")}><Users size={17} /><span><b>Lineup</b><small>{lineupIds.length} of 5 selected</small></span></button>
        <button role="tab" aria-selected={view === "development"} className={view === "development" ? "selected" : ""} onClick={() => setView("development")}><Dumbbell size={17} /><span><b>Development</b><small>Training and potential</small></span></button>
        <button role="tab" aria-selected={view === "contracts"} className={view === "contracts" ? "selected" : ""} onClick={() => setView("contracts")}><FileSearch size={17} /><span><b>Contracts</b><small>{activeContractCount} active deals</small></span></button>
      </nav>

      {view === "lineup" && (
        <div className="manager-roster-workspace" role="tabpanel">
          <section className="manager-depth-chart" aria-label="Starting five role plan">
            <div className="manager-depth-chart-head">
              <span><small>Match unit</small><h2>Starting five structure</h2></span>
              <b className={missingCoverage.length ? "negative" : "positive"}>{missingCoverage.length ? `${missingCoverage.length} role gap${missingCoverage.length === 1 ? "" : "s"}` : "Ready to register"}</b>
            </div>
            <div className="manager-depth-slots">
              {depthChart.map(({ role, player }) => (
                <div className={player ? "filled" : "vacant"} key={role}>
                  <span><small className="manager-role-label"><PlayerRoleGlyph role={role} size={12} /> {role}</small>{player ? <strong>{player.handle}</strong> : <strong>Vacant</strong>}</span>
                  {player ? (
                    <>
                      {playerPhoto(player.handle) ? <img src={playerPhoto(player.handle)} alt={player.handle} loading="lazy" /> : <Avatar label={player.handle} accent={team.accent} />}
                      <b>{player.ovr}</b>
                    </>
                  ) : role !== "Flex" ? (
                    <button className="secondary compact" onClick={() => onOpenRecruitment(role)}><Search size={14} /> Find {role}</button>
                  ) : <small>Any fifth player</small>}
                </div>
              ))}
            </div>
          </section>

          <section className="manager-lineup-pool">
            <div className="manager-lineup-toolbar">
              <div><span>Squad selection</span><strong>{lineupIds.length} / 5 starters selected</strong><small>{lineupLocked ? "Lineup locked for the active event" : "Choose the five players you want to register"}</small></div>
              <button className="primary" disabled={lineupLocked || lineupIds.length !== 5 || !lineupChanged} onClick={() => onSaveLineup(lineupIds)}><Save size={16} /> Save starting five</button>
            </div>
            <div className="manager-lineup-grid">
              {activeRoster.map((player) => {
                const selectedForLineup = lineupIds.includes(player.id);
                const plan = managerTrainingPlan(career, player);
                const disabled = lineupLocked || (!selectedForLineup && lineupIds.length >= 5);
                return (
                  <button className={`manager-lineup-card ${selectedForLineup ? "selected" : ""}`} disabled={disabled} onClick={() => toggleLineupPlayer(player.id)} key={player.id}>
                    <span className="manager-lineup-card-photo">{playerPhoto(player.handle) ? <img src={playerPhoto(player.handle)} alt={player.handle} loading="lazy" /> : <Avatar label={player.handle} accent={team.accent} />}<i>{selectedForLineup ? <CheckCircle2 size={15} /> : <Plus size={15} />}</i></span>
                    <span className="manager-lineup-card-name"><small>{selectedForLineup ? "Starting five" : "Reserve"}</small><strong><Flag country={player.country} /> {player.handle}</strong><em className="manager-role-label"><PlayerRoleGlyph role={player.role} size={11} /> {player.role} / age {player.age ?? "-"}</em></span>
                    <span className="manager-lineup-card-rating"><b>{player.ovr}</b><small>OVR</small><em>{plan.potentialOvr} POT</em></span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {view === "development" && (
        <section className="manager-training-desk manager-development-board" aria-label="Player training plans" role="tabpanel">
          <div className="manager-training-head">
            <span><Dumbbell size={17} /><small>Performance department</small><h2>Player development</h2></span>
            <div className="manager-development-budget"><small>Development budget</small><b>{fmtMoney(career.cash)}</b><em>Lab price scales with player ceiling</em></div>
          </div>
          <section className={`manager-camp-planner ${activeCamp ? "running" : ""}`} aria-label="Performance camp planner">
            <header>
              <span><Zap size={17} /><small>Seven-day team block</small><h3>Performance Camp</h3><p>Trade calendar space and cash for a focused squad-wide gain.</p></span>
              <div><b>{completedCampCount}</b><small>camps completed</small></div>
            </header>
            {activeCamp && activeCampProgram ? (
              <div className={`manager-camp-active ${activeCamp.focus}`}>
                <span className="manager-camp-active-icon">
                  {activeCamp.focus === "tactical" ? <Swords size={25} /> : activeCamp.focus === "mechanics" ? <Crosshair size={25} /> : <Shield size={25} />}
                </span>
                <span className="manager-camp-active-copy"><small>{activeCampProgram.department} / in progress</small><strong>{activeCampProgram.name}</strong><p>{activeCampProgram.description}</p></span>
                <span className="manager-camp-active-dates"><small>Camp window</small><b>{managerFormatDate(activeCamp.startsOn)} - {managerFormatDate(activeCamp.endsOn)}</b><em>{activeCampProgram.benefit}</em></span>
                <button className="primary" onClick={() => onAdvanceDate(activeCamp.endsOn)}><FastForward size={16} /> Finish camp</button>
              </div>
            ) : (
              <div className="manager-camp-options">
                {managerPerformanceCampPrograms.map((program) => {
                  const eligibility = managerPerformanceCampEligibility(career, program.id);
                  return (
                    <article className={program.id} key={program.id}>
                      <span className="manager-camp-option-icon">
                        {program.id === "tactical" ? <Swords size={20} /> : program.id === "mechanics" ? <Crosshair size={20} /> : <Shield size={20} />}
                      </span>
                      <span><small>{program.department}</small><strong>{program.name}</strong><p>{program.description}</p></span>
                      <div><b>{program.benefit}</b><small>{managerFormatDate(eligibility.startsOn)} - {managerFormatDate(eligibility.endsOn)}</small></div>
                      <button className="secondary" disabled={!eligibility.eligible} onClick={() => onSchedulePerformanceCamp(program.id)} title={eligibility.reasons[0] ?? `Book ${program.name}`}><CalendarDays size={15} /> {fmtMoney(program.cost)}</button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <section className="manager-casino-desk" aria-label="Casino night">
            <div className="manager-casino-intro">
              <span><Dice5 size={20} /></span>
              <div><small>Optional player outing / fair coin</small><h3>Casino Night</h3><p>Take one contracted player to the table. Club cash funds the stake, while the result affects that player's morale and form.</p></div>
            </div>
            <label><span>Player</span><select value={casinoPlayerId} onChange={(event) => setCasinoPlayerId(event.target.value)}>{activeRoster.map((player) => <option value={player.id} key={player.id}>{player.handle} / {player.role}</option>)}</select></label>
            <div className="manager-casino-stakes"><span>Table stake</span><div className="segmented">{MANAGER_CASINO_STAKES.map((stake) => <button className={casinoStake === stake ? "selected" : ""} onClick={() => setCasinoStake(stake)} key={stake}>{fmtMoney(stake)}</button>)}</div></div>
            <div className="manager-casino-record"><span><small>Club record</small><b>{career.casinoVisits.filter((visit) => visit.net > 0).length}-{career.casinoVisits.filter((visit) => visit.net < 0).length}</b></span><span><small>Casino net</small><b className={casinoNet >= 0 ? "positive" : "negative"}>{casinoNet >= 0 ? "+" : "-"}{fmtMoney(Math.abs(casinoNet))}</b></span></div>
            <button className="secondary manager-casino-open" disabled={!casinoEligibility?.allowed} onClick={openCasinoTable} title={casinoEligibility?.reasons[0] ?? "Open the casino table"}><Dice5 size={16} /> Open table</button>
          </section>
          <div className="manager-training-list">
            {activeRoster.map((player) => {
              const plan = managerTrainingPlan(career, player);
              const focus = managerTrainingFocusOptions.find((option) => option.id === plan.focus)!;
              const potential = Math.max(player.ovr, plan.potentialOvr);
              const atCeiling = player.ovr >= potential;
              const labCost = managerPotentialLabCost(career, player);
              const labDisabled = career.status !== "active" || career.cash < labCost;
              return (
                <article className="manager-training-row" key={player.id}>
                  <div className="manager-training-player">
                    {playerPhoto(player.handle) ? <img src={playerPhoto(player.handle)} alt={player.handle} loading="lazy" /> : <Avatar label={player.handle} accent={team.accent} />}
                    <span><small>{player.role} / age {player.age ?? "-"}</small><strong>{player.handle}</strong><em>{player.realName}</em></span>
                  </div>
                  <div className="manager-training-ceiling"><span><small>OVR</small><b>{player.ovr}</b></span><i /><span><small>Potential</small><b>{potential}</b></span></div>
                  <label className="manager-training-focus">
                    <span>Training focus</span>
                    <select value={plan.focus} disabled={Boolean(career.activeEventId)} onChange={(event) => onSetTrainingFocus(player, event.target.value as ManagerTrainingFocus)}>
                      {managerTrainingFocusOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
                    </select>
                    <small>{focus.emphasis}</small>
                  </label>
                  <div className="manager-training-progress">
                    <span><small>Next OVR</small><b>{atCeiling ? "At ceiling" : `${plan.progress}%`}</b></span>
                    <i><span style={{ width: `${atCeiling ? 100 : Math.max(0, Math.min(100, plan.progress))}%` }} /></i>
                  </div>
                  <div className="manager-training-card-footer">
                    <span><small>Last review</small><strong className={plan.lastOvrChange > 0 ? "positive" : ""}>{plan.lastOvrChange > 0 ? `+${plan.lastOvrChange} OVR` : plan.lastRating != null ? `${plan.lastRating.toFixed(2)} rating` : "No event sample"}</strong></span>
                    <span><small>Lab record</small><strong>{plan.potentialLabWins} / {plan.potentialLabAttempts}</strong></span>
                    <button className="secondary compact manager-potential-button" disabled={labDisabled} onClick={() => openPotentialLab(player)} title={career.cash < labCost ? "Not enough available cash" : `Open Potential Lab for ${player.handle} at ${fmtMoney(labCost)}`}><Coins size={15} /> Lab {fmtMoney(labCost)}</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {view === "contracts" && (
        <section className="manager-contract-board" role="tabpanel">
          <div className="manager-contract-board-head"><span><small>Business affairs</small><h2>Contract book</h2></span><div><b>{activeContractCount} / 8</b><small>contracts</small><b>{fmtMoney(monthlyPayroll)}</b><small>monthly</small></div></div>
          <div className="manager-contract-card-grid">
            {roster.map((player) => {
              const contract = contractByPlayer.get(player.id);
              const dynamics = dynamicsByPlayer.get(player.id);
              const photo = playerPhoto(player.handle);
              const plan = managerTrainingPlan(career, player);
              return (
                <article className={`manager-contract-card ${lineupIds.includes(player.id) ? "starter" : "bench"} ${contract?.status === "expired" ? "expired" : ""}`} key={player.id}>
                  <header>
                    {photo ? <img src={photo} alt={player.handle} loading="lazy" /> : <Avatar label={player.handle} accent={team.accent} />}
                    <span><small>{lineupIds.includes(player.id) ? "Starting five" : contract?.status === "expired" ? "Expired" : "Reserve squad"}</small><strong><Flag country={player.country} /> {player.handle}</strong><em>{player.realName} / {player.role}</em></span>
                    <b>{player.ovr}<small>OVR</small><em>{plan.potentialOvr} POT</em></b>
                  </header>
                  <div className="manager-contract-card-state">
                    <ManagerStateMeter label="Morale" value={dynamics?.morale ?? 50} />
                    <ManagerStateMeter label="Familiarity" value={dynamics?.familiarity ?? 0} />
                    <ManagerStateMeter label="Form" value={dynamics?.form ?? 50} />
                  </div>
                  <div className="manager-contract-card-terms">
                    <span><small>Squad role</small><b className="manager-squad-role">{contract?.squadRole ?? "uncontracted"}</b></span>
                    <span><small>Term</small><b>{contract ? managerContractDurationLabel(contract) : "No terms"}</b></span>
                    <span><small>Salary</small><b>{contract ? `${fmtMoney(contract.monthlySalary)}/mo` : "-"}</b></span>
                    <span><small>Buyout</small><b>{contract ? fmtMoney(contract.buyout) : "-"}</b></span>
                  </div>
                  <footer>
                    <button className="icon-only" onClick={() => onOpenPlayer(player, team)} title={`Open ${player.handle} profile`}><Eye size={16} /></button>
                    {contract?.status === "expired" ? (
                      <button className="secondary compact manager-find-replacement" onClick={() => onOpenRecruitment(player.role)}><Search size={14} /> Find replacement</button>
                    ) : (
                      <>
                        {contract && contract.majorCyclesRemaining <= 1 && <button className="secondary compact" onClick={() => openRenewal(player)}><RefreshCcw size={14} /> Renew</button>}
                        {contract && contract.status !== "active" && <button className="icon-only manager-release-button" disabled={activeContractCount <= 5 || lineupLocked || career.cash < managerContractReleaseCost(contract)} onClick={() => openRelease(player)} title={`Release ${player.handle}`}><Trash2 size={14} /></button>}
                      </>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {renewalPlayer && renewalContract && renewalTerms && renewalEvaluation && (
        <section className="manager-renewal-panel" aria-label={`Renew ${renewalPlayer.handle}'s contract`}>
          <div className="manager-renewal-heading">
            <span><small>Contract desk / {renewalContract.status === "expired" ? "expired deal" : "final Major cycle"}</small><h2>Renew {renewalPlayer.handle}</h2><p>Agree new terms to keep the player with {career.organizationName}. An expired player returns to the bench after signing.</p></span>
            <button className="icon-only" onClick={() => setRenewalPlayerId("")} title="Close renewal"><ArrowLeft size={16} /></button>
          </div>
          <div className="manager-renewal-controls">
            <label><span>Monthly salary</span><div className="manager-money-stepper"><button onClick={() => setRenewalSalary(Math.max(1_000, renewalSalary - 250))} title="Reduce salary"><Minus size={14} /></button><input type="number" step="250" min="1000" value={renewalSalary} onChange={(event) => setRenewalSalary(Math.max(1_000, Number(event.target.value) || 1_000))} /><button onClick={() => setRenewalSalary(renewalSalary + 250)} title="Increase salary"><Plus size={14} /></button></div></label>
            <label><span>New term</span><select value={renewalCycles} onChange={(event) => setRenewalCycles(Number(event.target.value))}><option value={1}>1 Major / 0.5 years</option><option value={2}>2 Majors / 1 year</option><option value={3}>3 Majors / 1.5 years</option><option value={4}>4 Majors / 2 years</option></select></label>
          </div>
          <div className="manager-offer-readout">
            <span><small>Player expectation</small><b>{fmtMoney(renewalEvaluation.askingSalary)}/mo</b></span>
            <span><small>Renewal bonus</small><b>{fmtMoney(renewalBonus)}</b></span>
            <span><small>Interest</small><b className={renewalEvaluation.accepted ? "positive" : "negative"}>{renewalEvaluation.score}%</b></span>
          </div>
          <div className="manager-renewal-actions">
            <small>{renewalEvaluation.reasons[0] ?? "The player is open to remaining at the club."}</small>
            <button className="primary" disabled={career.cash < renewalBonus} onClick={submitRenewal}><RefreshCcw size={16} /> Submit renewal</button>
          </div>
        </section>
      )}

      {releasePlayer && releaseContract && (
        <section className="manager-renewal-panel manager-release-panel" aria-label={`Release ${releasePlayer.handle}`}>
          <div className="manager-renewal-heading">
            <span><small>Contract desk / mutual termination</small><h2>Release {releasePlayer.handle}</h2><p>This permanently removes the player from your contracted squad and opens one recruitment slot.</p></span>
            <button className="icon-only" onClick={() => setReleasePlayerId("")} title="Close release"><ArrowLeft size={16} /></button>
          </div>
          <div className="manager-offer-readout">
            <span><small>Settlement</small><b>{fmtMoney(releaseCost)}</b></span>
            <span><small>Squad after release</small><b>{activeContractCount - 1} / 8</b></span>
            <span><small>Payroll saved</small><b>{fmtMoney(releaseContract.monthlySalary)}/mo</b></span>
          </div>
          <div className="manager-renewal-actions">
            <small>Only bench players can be released. Starting players must be removed from the saved five first.</small>
            <button className="danger" disabled={career.cash < releaseCost || activeContractCount <= 5 || lineupLocked} onClick={submitRelease}><Trash2 size={16} /> Pay settlement and release</button>
          </div>
        </section>
      )}

      {potentialFlip && potentialPlayer && potentialPlan && (
        <div className="manager-coin-overlay">
          <section className={`manager-coin-dialog ${potentialFlip.status}`} role="dialog" aria-modal="true" aria-labelledby="potential-lab-title">
            <header>
              <span><Coins size={18} /><small>Performance department / experimental program</small><h2 id="potential-lab-title">Potential Lab</h2></span>
              <button className="icon-only" disabled={potentialFlip.status === "flipping"} onClick={() => setPotentialFlip(null)} title="Close Potential Lab"><ArrowLeft size={17} /></button>
            </header>
            <div className="manager-coin-player">
              {playerPhoto(potentialPlayer.handle) ? <img src={playerPhoto(potentialPlayer.handle)} alt={potentialPlayer.handle} /> : <Avatar label={potentialPlayer.handle} accent={team.accent} />}
              <span><small>Selected player</small><strong><Flag country={potentialPlayer.country} /> {potentialPlayer.handle}</strong><em>{potentialPlayer.role} / age {potentialPlayer.age ?? "-"}</em></span>
              <div><span><small>OVR</small><b>{potentialPlayer.ovr}</b></span><i /><span><small>Potential</small><b>{potentialPlan.potentialOvr}</b></span></div>
            </div>
            <div className="manager-coin-stage" aria-live="polite">
              <ManagerAnimatedCoin status={potentialFlip.status} result={potentialFlip.result} />
            </div>
            {potentialFlip.status === "choosing" ? (
              <div className="manager-coin-decision">
                <span><small>One call. One flip.</small><h3>Choose a side</h3><p>A correct call raises {potentialPlayer.handle}'s potential by one. A miss still costs the full investment.</p></span>
                <div>
                  <button onClick={() => startPotentialFlip("heads")}><b>H</b><span><strong>Heads</strong><small>Call the crest</small></span></button>
                  <button onClick={() => startPotentialFlip("tails")}><b>T</b><span><strong>Tails</strong><small>Call the reverse</small></span></button>
                </div>
              </div>
            ) : potentialFlip.status === "flipping" ? (
              <div className="manager-coin-pending"><span /><b>{potentialPlayer.handle} called {potentialFlip.choice}</b><small>The investment is committed. Waiting for the coin...</small></div>
            ) : (
              <div className={`manager-coin-result ${potentialFlip.status}`}>
                <span><small>The coin landed {potentialFlip.result}</small><h3>{potentialFlip.status === "won" ? "Potential unlocked" : "The call missed"}</h3><p>{potentialFlip.status === "won" ? `${potentialPlayer.handle}'s ceiling rises from ${potentialFlip.startingPotential} to ${potentialPlan.potentialOvr}.` : `${potentialPlayer.handle} stays at ${potentialPlan.potentialOvr} potential.`}</p></span>
                <div>
                  <button className="secondary" disabled={career.cash < nextPotentialCost} onClick={() => setPotentialFlip({ playerId: potentialPlayer.id, startingPotential: potentialPlan.potentialOvr, cost: nextPotentialCost, status: "choosing" })}><RefreshCcw size={15} /> Run it again</button>
                  <button className="primary" onClick={() => setPotentialFlip(null)}><CheckCircle2 size={15} /> Return to development</button>
                </div>
              </div>
            )}
            <footer><span><small>Investment</small><b>{fmtMoney(potentialFlip.cost)}</b></span><span><small>Success chance</small><b>50%</b></span><span><small>Available cash</small><b>{fmtMoney(career.cash)}</b></span><p>Cost rises with the ceiling's value. Potential can exceed 99, while OVR still has to be earned.</p></footer>
          </section>
        </div>
      )}
      {casinoFlip && casinoPlayer && (
        <div className="manager-coin-overlay manager-casino-overlay">
          <section className={`manager-coin-dialog manager-casino-dialog ${casinoFlip.status}`} role="dialog" aria-modal="true" aria-labelledby="casino-night-title">
            <header>
              <span><Dice5 size={18} /><small>Player lounge / one visit per club day</small><h2 id="casino-night-title">Casino Night</h2></span>
              <button className="icon-only" disabled={casinoFlip.status === "flipping"} onClick={() => setCasinoFlip(null)} title="Close casino table"><ArrowLeft size={17} /></button>
            </header>
            <div className="manager-coin-player">
              {playerPhoto(casinoPlayer.handle) ? <img src={playerPhoto(casinoPlayer.handle)} alt={casinoPlayer.handle} /> : <Avatar label={casinoPlayer.handle} accent={team.accent} />}
              <span><small>Tonight's player</small><strong><Flag country={casinoPlayer.country} /> {casinoPlayer.handle}</strong><em>{casinoPlayer.role} / morale {dynamicsByPlayer.get(casinoPlayer.id)?.morale ?? 50}</em></span>
              <div><span><small>Cash</small><b>{fmtMoney(casinoFlip.startingCash)}</b></span><i /><span><small>Stake</small><b>{fmtMoney(casinoFlip.stake)}</b></span></div>
            </div>
            <div className="manager-coin-stage" aria-live="polite"><ManagerAnimatedCoin status={casinoFlip.status} result={casinoFlip.result} /></div>
            {casinoFlip.status === "choosing" ? (
              <div className="manager-coin-decision">
                <span><small>Even odds / net win equals stake</small><h3>Make the call</h3><p>A win adds {fmtMoney(casinoFlip.stake)} to club cash and lifts {casinoPlayer.handle}'s morale. A loss removes the stake and dents morale.</p></span>
                <div>
                  <button onClick={() => startCasinoFlip("heads")}><b>H</b><span><strong>Heads</strong><small>Call the crest</small></span></button>
                  <button onClick={() => startCasinoFlip("tails")}><b>T</b><span><strong>Tails</strong><small>Call the reverse</small></span></button>
                </div>
              </div>
            ) : casinoFlip.status === "flipping" ? (
              <div className="manager-coin-pending"><span /><b>{casinoPlayer.handle} called {casinoFlip.choice}</b><small>The stake is on the table. Waiting for the coin...</small></div>
            ) : (
              <div className={`manager-coin-result ${casinoFlip.status}`}>
                <span><small>The coin landed {casinoFlip.result}</small><h3>{casinoFlip.status === "won" ? "The table pays" : "The stake is gone"}</h3><p>{casinoFlip.status === "won" ? `${casinoPlayer.handle} brought home ${fmtMoney(casinoFlip.stake)} in profit.` : `${casinoPlayer.handle}'s call missed and the club lost ${fmtMoney(casinoFlip.stake)}.`}</p></span>
                <div><button className="primary" onClick={() => setCasinoFlip(null)}><CheckCircle2 size={15} /> Leave the table</button></div>
              </div>
            )}
            <footer><span><small>Stake</small><b>{fmtMoney(casinoFlip.stake)}</b></span><span><small>Win chance</small><b>50%</b></span><span><small>Club cash</small><b>{fmtMoney(career.cash)}</b></span><p>Casino Night is optional and limited to one visit per in-game date. Debt cannot be used as a stake.</p></footer>
          </section>
        </div>
      )}
    </main>
  );
}

function ManagerAnimatedCoin({ status, result }: { status: "choosing" | "flipping" | "won" | "lost"; result?: ManagerCoinSide }) {
  return (
    <div className={`manager-coin ${status === "flipping" ? "flipping" : "settled"} ${result ?? "heads"}`}>
      <span className="manager-coin-face front"><b>H</b><small>Heads</small></span>
      <span className="manager-coin-face back"><b>T</b><small>Tails</small></span>
    </div>
  );
}

function ManagerStateMeter({ label, value }: { label: string; value: number }) {
  const tone = value >= 70 ? "positive" : value < 40 ? "negative" : "neutral";
  return (
    <span className={`manager-state-meter ${tone}`}>
      <small>{label}</small>
      <i><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></i>
      <b>{value}</b>
    </span>
  );
}

type ManagerMarketView = "free-agents" | "transfer-list" | "shortlist" | "negotiations";

function ManagerMarketPage({
  team,
  roster,
  career,
  freeAgents,
  transferList,
  initialRole,
  onBack,
  onCareerChange,
  onTradeCareerChange,
  onOpenPlayer,
}: {
  team: FieldTeam;
  roster: Player[];
  career: ManagerCareerState;
  freeAgents: ManagerMarketCandidate[];
  transferList: ManagerMarketCandidate[];
  initialRole: Role | "all";
  onBack: () => void;
  onCareerChange: (career: ManagerCareerState) => void;
  onTradeCareerChange: (career: ManagerCareerState) => void;
  onOpenPlayer: (player: Player, team: FieldTeam) => void;
}) {
  const [view, setView] = useState<ManagerMarketView>("free-agents");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<Role | "all">(initialRole);
  const market = career.market ?? {
    scoutedPlayerIds: [],
    shortlistedPlayerIds: [],
    signedPlayerIds: [],
    offers: [],
    tradeOffers: [],
    clubRelationships: [],
    rosterMoves: [],
    unavailablePlayerIds: [],
  };
  const historicalTradeCandidates = useMemo(() => market.tradeOffers.map((offer): ManagerMarketCandidate => ({
    id: offer.incoming.id,
    kind: "transfer-listed",
    player: offer.incoming as Player,
    previousTeam: offer.sourceTeamName,
    askingSalary: offer.incomingSalary,
    estimatedFee: offer.askingFee,
    interest: 0,
  })), [market.tradeOffers]);
  const allCandidates = useMemo(() => [...freeAgents, ...transferList, ...historicalTradeCandidates]
    .filter((candidate, index, candidates) => candidates.findIndex((item) => item.id === candidate.id) === index), [freeAgents, historicalTradeCandidates, transferList]);
  const negotiationIds = useMemo(() => new Set(market.tradeOffers.map((offer) => offer.incoming.id)), [market.tradeOffers]);
  const contractedPlayerIds = new Set(career.contracts
    .filter((contract) => contract.status !== "expired")
    .map((contract) => contract.playerId));
  const sourceCandidates = view === "free-agents"
    ? freeAgents.filter((candidate) => !contractedPlayerIds.has(candidate.id))
    : view === "transfer-list"
      ? transferList.filter((candidate) => !market.unavailablePlayerIds.includes(candidate.id) && !contractedPlayerIds.has(candidate.id))
      : view === "negotiations"
        ? allCandidates.filter((candidate) => negotiationIds.has(candidate.id))
        : allCandidates.filter((candidate) => market.shortlistedPlayerIds.includes(candidate.id));
  const visibleCandidates = sourceCandidates.filter((candidate) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || [candidate.player.handle, candidate.player.realName, candidate.previousTeam]
      .some((value) => (value ?? "").toLowerCase().includes(needle));
    return matchesQuery && (role === "all" || candidate.player.role === role);
  });
  const [selectedId, setSelectedId] = useState(freeAgents[0]?.id ?? "");
  const selectedCandidate = visibleCandidates.find((candidate) => candidate.id === selectedId) ?? visibleCandidates[0];
  const [salary, setSalary] = useState(selectedCandidate?.askingSalary ?? 5_000);
  const [cycles, setCycles] = useState(3);
  const [squadRole, setSquadRole] = useState<ManagerSquadRole>("starter");
  const [outgoingId, setOutgoingId] = useState(roster[0]?.id ?? "");
  const [tradeCash, setTradeCash] = useState(0);

  useEffect(() => {
    if (!selectedCandidate) return;
    setSelectedId(selectedCandidate.id);
    setSalary(selectedCandidate.askingSalary);
    setCycles(3);
    setSquadRole((selectedCandidate.player.age ?? 24) <= 20 ? "prospect" : "starter");
  }, [selectedCandidate?.id]);

  useEffect(() => {
    if (!selectedCandidate || selectedCandidate.kind !== "transfer-listed") return;
    const replacement = roster.find((player) => player.role === selectedCandidate.player.role) ?? roster[0];
    if (replacement) setOutgoingId(replacement.id);
    setTradeCash(0);
  }, [selectedCandidate?.id, roster]);

  const isScouted = selectedCandidate
    ? market.scoutedPlayerIds.includes(selectedCandidate.id) || market.tradeOffers.some((offer) => offer.incoming.id === selectedCandidate.id)
    : false;
  const isShortlisted = selectedCandidate ? market.shortlistedPlayerIds.includes(selectedCandidate.id) : false;
  const isSigned = selectedCandidate ? contractedPlayerIds.has(selectedCandidate.id) : false;
  const scouting = selectedCandidate ? managerScoutingRange(selectedCandidate.player) : undefined;
  const offerTerms: ManagerOfferTerms = { monthlySalary: salary, majorCycles: cycles, squadRole };
  const evaluation = selectedCandidate ? evaluateManagerOffer(career, selectedCandidate.player, offerTerms) : undefined;
  const activeContracts = career.contracts.filter((contract) => contract.status !== "expired").length;
  const outgoingPlayer = roster.find((player) => player.id === outgoingId) ?? roster[0];
  const tradeProposal: ManagerTradeProposal | undefined = selectedCandidate?.kind === "transfer-listed" && outgoingPlayer && selectedCandidate.currentTeam
    ? {
        incoming: selectedCandidate.player,
        outgoing: outgoingPlayer,
        sourceTeamId: selectedCandidate.currentTeam.id,
        sourceTeamName: selectedCandidate.currentTeam.name,
        askingFee: selectedCandidate.estimatedFee,
        cashOffered: tradeCash,
        incomingSalary: selectedCandidate.askingSalary,
      }
    : undefined;
  const tradeEvaluation = tradeProposal ? evaluateManagerTradeProposal(career, tradeProposal) : undefined;
  const selectedTradeOffers = selectedCandidate
    ? market.tradeOffers.filter((offer) => offer.incoming.id === selectedCandidate.id)
    : [];
  const latestTradeOffer = selectedTradeOffers[selectedTradeOffers.length - 1];
  const relationship = selectedCandidate && latestTradeOffer
    ? managerClubRelationship(career, latestTradeOffer.sourceTeamId, latestTradeOffer.sourceTeamName)
    : selectedCandidate?.currentTeam
      ? managerClubRelationship(career, selectedCandidate.currentTeam.id, selectedCandidate.currentTeam.name)
      : undefined;
  const roundsRemaining = selectedCandidate ? managerTradeRoundsRemaining(career, selectedCandidate.id) : 0;
  const negotiationLocked = Boolean(
    latestTradeOffer
    && ["pending", "accepted", "delayed", "outbid"].includes(latestTradeOffer.status),
  ) || Boolean(selectedCandidate && market.unavailablePlayerIds.includes(selectedCandidate.id));

  useEffect(() => {
    if (latestTradeOffer?.status === "countered" && latestTradeOffer.counterCash != null) {
      setTradeCash(latestTradeOffer.counterCash);
    }
  }, [latestTradeOffer?.counterCash, latestTradeOffer?.id, latestTradeOffer?.status]);

  return (
    <main className="layout fullscreen-page manager-page manager-market-page">
      <section className="manager-market-head">
        <div>
          <button className="icon-only" onClick={onBack} title="Back to manager headquarters"><ArrowLeft size={18} /></button>
          <span><small>Scouting department</small><h1>Recruitment Hub</h1><p>Build a shortlist, commission reports, and negotiate with players and clubs.</p></span>
        </div>
        <div className="manager-market-summary">
          <span><small>Budget</small><b>{fmtMoney(career.cash)}</b></span>
          <span><small>Squad</small><b>{activeContracts} / 8</b></span>
          <span><small>Shortlist</small><b>{market.shortlistedPlayerIds.length}</b></span>
        </div>
      </section>

      <section className="manager-market-toolbar">
        <div className="segmented manager-market-tabs" aria-label="Recruitment market">
          <button className={view === "free-agents" ? "selected" : ""} onClick={() => setView("free-agents")}>Free agents <b>{freeAgents.filter((candidate) => !contractedPlayerIds.has(candidate.id)).length}</b></button>
          <button className={view === "transfer-list" ? "selected" : ""} onClick={() => setView("transfer-list")}>Transfer list <b>{transferList.filter((candidate) => !market.unavailablePlayerIds.includes(candidate.id) && !contractedPlayerIds.has(candidate.id)).length}</b></button>
          <button className={view === "shortlist" ? "selected" : ""} onClick={() => setView("shortlist")}>Shortlist <b>{market.shortlistedPlayerIds.length}</b></button>
          <button className={view === "negotiations" ? "selected" : ""} onClick={() => setView("negotiations")}>Negotiations <b>{negotiationIds.size}</b></button>
        </div>
        <label className="manager-market-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search players or clubs" /></label>
        <select value={role} onChange={(event) => setRole(event.target.value as Role | "all")} aria-label="Filter by role">
          <option value="all">All roles</option>
          {(["IGL", "AWP", "Entry", "Lurker", "Rifler", "Support"] as Role[]).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </section>

      <div className="manager-market-workspace">
        <section className="manager-candidate-list" aria-label="Recruitment candidates">
          <div className="manager-candidate-columns"><span>Player</span><span>Profile</span><span>Market</span><span /></div>
          {visibleCandidates.map((candidate) => {
            const candidateScouted = market.scoutedPlayerIds.includes(candidate.id);
            const candidateSigned = contractedPlayerIds.has(candidate.id);
            const candidateUnavailable = market.unavailablePlayerIds.includes(candidate.id);
            const candidateOffer = [...market.tradeOffers].reverse().find((offer) => offer.incoming.id === candidate.id);
            const range = managerScoutingRange(candidate.player);
            const photo = playerPhoto(candidate.player.handle);
            return (
              <div className={`manager-candidate-row ${selectedCandidate?.id === candidate.id ? "selected" : ""}`} key={candidate.id}>
                <button className="manager-candidate-main" onClick={() => setSelectedId(candidate.id)}>
                  {photo ? <img className="manager-candidate-photo" src={photo} alt={candidate.player.handle} loading="lazy" /> : <Avatar label={candidate.player.handle} accent={candidate.player.source?.accent ?? "#6aa7ff"} />}
                  <span><strong><Flag country={candidate.player.country ?? "INT"} /> {candidate.player.handle}</strong><small>{candidate.player.realName ?? candidate.player.handle} / age {candidate.player.age ?? "-"}</small></span>
                </button>
                <span className="manager-candidate-role"><strong>{candidate.player.role}</strong><small>{candidate.player.style ?? "Saved profile"}</small></span>
                <span className="manager-candidate-market"><strong>{candidateScouted ? candidate.player.ovr : `${range.low}-${range.high}`} <small>OVR</small></strong><em>{candidateSigned ? "Signed" : candidateUnavailable ? "Moved" : candidateOffer ? candidateOffer.status : candidate.kind === "free-agent" ? "Free agent" : candidate.previousTeam}</em></span>
                <button className="icon-only" onClick={() => onCareerChange(toggleManagerShortlist(career, candidate.id))} title={market.shortlistedPlayerIds.includes(candidate.id) ? "Remove from shortlist" : "Add to shortlist"}>
                  {market.shortlistedPlayerIds.includes(candidate.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                </button>
              </div>
            );
          })}
          {!visibleCandidates.length && <div className="manager-empty-state">No players match the current recruitment filters.</div>}
        </section>

        <aside className="manager-candidate-detail">
          {selectedCandidate ? (
            <>
              <div className="manager-candidate-hero">
                {playerPhoto(selectedCandidate.player.handle)
                  ? <img src={playerPhoto(selectedCandidate.player.handle)} alt={selectedCandidate.player.handle} />
                  : <Avatar label={selectedCandidate.player.handle} accent={selectedCandidate.player.source?.accent ?? "#6aa7ff"} />}
                <span><small>{selectedCandidate.kind === "free-agent" ? `Previously ${selectedCandidate.previousTeam}` : selectedCandidate.previousTeam}</small><h2><Flag country={selectedCandidate.player.country ?? "INT"} /> {selectedCandidate.player.handle}</h2><p>{selectedCandidate.player.realName ?? selectedCandidate.player.handle} / {selectedCandidate.player.role} / age {selectedCandidate.player.age ?? "-"}</p></span>
                <button className="icon-only" onClick={() => onCareerChange(toggleManagerShortlist(career, selectedCandidate.id))} title={isShortlisted ? "Remove from shortlist" : "Add to shortlist"}>{isShortlisted ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}</button>
              </div>

              <div className="manager-scout-grid">
                <span><small>Current level</small><b>{isScouted ? selectedCandidate.player.ovr : `${scouting?.low}-${scouting?.high}`}</b><em>OVR</em></span>
                <span><small>Potential</small><b>{isScouted ? `${scouting?.potentialLow}-${scouting?.potentialHigh}` : "Unknown"}</b><em>scout range</em></span>
                <span><small>Player interest</small><b>{selectedCandidate.interest}%</b><em>initial signal</em></span>
                <span><small>{selectedCandidate.kind === "free-agent" ? "Expected salary" : "Estimated fee"}</small><b>{isScouted ? fmtMoney(selectedCandidate.kind === "free-agent" ? selectedCandidate.askingSalary : selectedCandidate.estimatedFee) : "Hidden"}</b><em>{selectedCandidate.kind === "free-agent" ? "per month" : "club valuation"}</em></span>
              </div>

              {!isScouted ? (
                <div className="manager-scout-callout">
                  <FileSearch size={21} />
                  <span><strong>Commission a full report</strong><small>Reveal exact OVR, potential range, salary expectations, and market valuation.</small></span>
                  <button className="primary" disabled={career.cash < 1_500} onClick={() => onCareerChange(scoutManagerCandidate(career, selectedCandidate.player))}>Scout for $1,500</button>
                </div>
              ) : selectedCandidate.kind === "transfer-listed" ? (
                <div className="manager-trade-panel">
                  <div className="manager-offer-head">
                    <span><small>Trade desk / {selectedCandidate.previousTeam}</small><strong>Build a one-for-one proposal</strong></span>
                    {selectedCandidate.currentTeam && <button className="icon-only" onClick={() => onOpenPlayer(selectedCandidate.player, toTournamentTeam(selectedCandidate.currentTeam!))} title="Open player profile"><Eye size={16} /></button>}
                  </div>
                  <div className="manager-negotiation-meta">
                    <span><small>Club relationship</small><b>{relationship ? managerClubRelationshipLabel(relationship.trust) : "New contact"}</b><em>{relationship?.trust ?? 50} trust</em></span>
                    <span><small>Negotiation</small><b>{latestTradeOffer ? `Round ${latestTradeOffer.round} / 3` : "Not opened"}</b><em>{roundsRemaining} rounds remain</em></span>
                    <span><small>Market pressure</small><b>{latestTradeOffer && latestTradeOffer.status !== "pending" && latestTradeOffer.rivalTeamName ? latestTradeOffer.rivalTeamName : "Undisclosed"}</b><em>{latestTradeOffer?.status === "outbid" ? "deal completed" : "rival interest"}</em></span>
                  </div>
                  <label>
                    <span>Player offered</span>
                    <select disabled={negotiationLocked || roundsRemaining === 0} value={outgoingId} onChange={(event) => setOutgoingId(event.target.value)}>
                      {roster.map((player) => <option key={player.id} value={player.id}>{player.handle} / {player.role} / {player.ovr} OVR</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Cash adjustment</span>
                    <div className="manager-money-stepper">
                      <button disabled={negotiationLocked || roundsRemaining === 0} onClick={() => setTradeCash(Math.max(0, tradeCash - 5_000))} title="Reduce cash"><Minus size={14} /></button>
                      <input disabled={negotiationLocked || roundsRemaining === 0} type="number" step="5000" min="0" value={tradeCash} onChange={(event) => setTradeCash(Math.max(0, Number(event.target.value) || 0))} />
                      <button disabled={negotiationLocked || roundsRemaining === 0} onClick={() => setTradeCash(tradeCash + 5_000)} title="Increase cash"><Plus size={14} /></button>
                    </div>
                  </label>
                  <div className="manager-offer-readout">
                    <span><small>Seller valuation</small><b>{fmtMoney(selectedCandidate.estimatedFee)}</b></span>
                    <span><small>Player credit</small><b>{fmtMoney(tradeEvaluation?.outgoingCredit ?? 0)}</b></span>
                    <span><small>Likely cash line</small><b>{fmtMoney(tradeEvaluation?.requiredCash ?? 0)}</b></span>
                  </div>
                  {latestTradeOffer && (
                    <div className={`manager-trade-response ${latestTradeOffer.status}`}>
                      <strong>{latestTradeOffer.status === "pending" ? `Response due ${managerFormatDate(latestTradeOffer.responseOn)}` : latestTradeOffer.status === "accepted" ? "Trade completed" : latestTradeOffer.status === "delayed" ? "Accepted / roster-lock delay" : latestTradeOffer.status === "countered" ? `Counter: ${fmtMoney(latestTradeOffer.counterCash ?? 0)}` : latestTradeOffer.status === "outbid" ? `Outbid by ${latestTradeOffer.rivalTeamName}` : latestTradeOffer.status === "expired" ? "Counter expired" : latestTradeOffer.status === "withdrawn" ? "Offer withdrawn" : "Offer rejected"}</strong>
                      <small>{latestTradeOffer.reasons[latestTradeOffer.reasons.length - 1]}</small>
                      {latestTradeOffer.status === "countered" && (
                        <button className="primary compact" disabled={(latestTradeOffer.counterCash ?? 0) > career.cash} onClick={() => onTradeCareerChange(acceptManagerTradeCounter(career, latestTradeOffer.id))}>Accept counter</button>
                      )}
                      {latestTradeOffer.status === "pending" && (
                        <div className="manager-trade-response-actions">
                          <button className="secondary compact" disabled={Boolean(career.activeEventId)} onClick={() => onTradeCareerChange(advanceManagerDate(career, latestTradeOffer.responseOn))}><Clock3 size={14} /> Advance</button>
                          <button className="icon-only" onClick={() => onTradeCareerChange(withdrawManagerTradeOffer(career, latestTradeOffer.id))} title="Withdraw offer"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    className="primary large"
                    disabled={!tradeProposal || isSigned || tradeCash > career.cash || negotiationLocked || roundsRemaining === 0}
                    onClick={() => tradeProposal && onTradeCareerChange(submitManagerTradeOffer(career, tradeProposal))}
                  >
                    <ArrowLeftRight size={17} /> {latestTradeOffer ? "Submit revised offer" : "Submit trade offer"}
                  </button>
                  {selectedTradeOffers.length > 0 && (
                    <div className="manager-negotiation-history">
                      <div><span><small>Negotiation history</small><strong>{selectedTradeOffers.length} {selectedTradeOffers.length === 1 ? "offer" : "offers"}</strong></span><b>{relationship?.completedTrades ?? 0} completed with club</b></div>
                      {[...selectedTradeOffers].reverse().map((offer) => (
                        <article key={offer.id} className={offer.status}>
                          <span><b>Round {offer.round}</b><small>{managerFormatDate(offer.submittedOn)} / {offer.status}</small></span>
                          <span><b>{offer.outgoing.handle}</b><small>player offered</small></span>
                          <span><b>{fmtMoney(offer.cashOffered)}</b><small>cash</small></span>
                          <span><b>{offer.counterCash != null ? fmtMoney(offer.counterCash) : "-"}</b><small>club counter</small></span>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ) : isSigned ? (
                <div className="manager-scout-callout signed"><CheckCircle2 size={21} /><span><strong>Contract complete</strong><small>{selectedCandidate.player.handle} has joined the reserve squad and now counts toward payroll.</small></span></div>
              ) : (
                <div className="manager-offer-panel">
                  <div className="manager-offer-head"><span><small>Contract desk</small><strong>Build an offer</strong></span><b className={evaluation && evaluation.score >= 60 ? "positive" : "negative"}>{evaluation?.score ?? 0}% interest</b></div>
                  <label><span>Monthly salary</span><div className="manager-money-stepper"><button onClick={() => setSalary(Math.max(1_000, salary - 500))} title="Reduce salary"><Minus size={14} /></button><input type="number" step="500" min="1000" value={salary} onChange={(event) => setSalary(Math.max(1_000, Number(event.target.value) || 1_000))} /><button onClick={() => setSalary(salary + 500)} title="Increase salary"><Plus size={14} /></button></div></label>
                  <label><span>Contract length</span><select value={cycles} onChange={(event) => setCycles(Number(event.target.value))}><option value={1}>1 Major / 0.5 years</option><option value={2}>2 Majors / 1 year</option><option value={3}>3 Majors / 1.5 years</option><option value={4}>4 Majors / 2 years</option></select></label>
                  <label><span>Promised role</span><select value={squadRole} onChange={(event) => setSquadRole(event.target.value as ManagerSquadRole)}>{(["star", "starter", "rotation", "prospect", "bench"] as ManagerSquadRole[]).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                  <div className="manager-offer-readout"><span><small>Expectation</small><b>{fmtMoney(selectedCandidate.askingSalary)}/mo</b></span><span><small>Signing bonus</small><b>{fmtMoney(salary)}</b></span><span><small>Runway after signing</small><b>{managerMonthlyPayroll(career) + salary > 0 ? `${Math.max(0, (career.cash - salary) / (managerMonthlyPayroll(career) + salary)).toFixed(1)} mo` : "-"}</b></span></div>
                  <button className="primary large" disabled={activeContracts >= 8 || career.cash < salary} onClick={() => onCareerChange(submitManagerFreeAgentOffer(career, selectedCandidate.player, offerTerms))}><UserPlus size={17} /> Submit contract offer</button>
                </div>
              )}
            </>
          ) : <div className="manager-empty-state">Select a candidate to open the scouting desk.</div>}
        </aside>
      </div>
    </main>
  );
}

type ManagerInboxTab = "inbox" | "transfers" | "vrs";

function ManagerInboxKindIcon({ kind }: { kind: ManagerInboxItem["kind"] }) {
  if (kind === "ranking") return <TrendingUp size={17} />;
  if (kind === "market") return <ArrowLeftRight size={17} />;
  if (kind === "finance") return <Coins size={17} />;
  if (kind === "result") return <Trophy size={17} />;
  if (kind === "deadline") return <Clock3 size={17} />;
  return <Mail size={17} />;
}

function managerIncomingOfferRosterLock(career: ManagerCareerState, offer: ManagerIncomingOffer) {
  return career.registrations.some((registration) => {
    if (!registration.lockedRosterIds.includes(offer.targetPlayer.id)) return false;
    if (registration.status === "active") return true;
    const event = managerEventById(registration.eventId);
    if (!event || registration.status !== "confirmed") return false;
    const schedule = managerEventSchedule(event, career.season);
    return career.date >= schedule.rosterLockOn && career.date <= schedule.endsOn;
  });
}

function ManagerInboxPage({
  team,
  career,
  standings,
  worldTeams,
  onBack,
  onCareerChange,
  onRead,
}: {
  team: FieldTeam;
  career: ManagerCareerState;
  standings: ManagerVrsStanding[];
  worldTeams: Roster[];
  onBack: () => void;
  onCareerChange: (career: ManagerCareerState) => void;
  onRead: (itemId: string) => void;
}) {
  const [tab, setTab] = useState<ManagerInboxTab>("inbox");
  const messages = [...career.inbox].sort((left, right) => (
    right.createdOn.localeCompare(left.createdOn) || right.id.localeCompare(left.id)
  ));
  const [selectedMessageId, setSelectedMessageId] = useState(messages.find((item) => !item.read)?.id ?? messages[0]?.id);
  const selectedMessage = messages.find((item) => item.id === selectedMessageId) ?? messages[0];
  const offers = [...career.market.incomingOffers].sort((left, right) => (
    right.createdOn.localeCompare(left.createdOn) || right.id.localeCompare(left.id)
  ));
  const activeOfferCount = offers.filter((offer) => offer.status === "pending" || offer.status === "counter-pending").length;
  const [counterValues, setCounterValues] = useState<Record<string, number>>({});
  const activeContractCount = career.contracts.filter((contract) => contract.status !== "expired").length;
  const teamById = new Map(worldTeams.map((roster) => [roster.id, roster]));
  const unreadCount = messages.filter((item) => !item.read).length;

  function openMessage(item: ManagerInboxItem) {
    setSelectedMessageId(item.id);
    if (!item.read) onRead(item.id);
  }

  function buyerTeam(offer: ManagerIncomingOffer): Pick<Roster, "id" | "tag" | "name" | "country" | "accent" | "logo"> {
    return teamById.get(offer.buyerTeamId) ?? {
      id: offer.buyerTeamId,
      tag: offer.buyerTeamName.split(/\s+/).map((word) => word[0]).join("").slice(0, 3).toUpperCase(),
      name: offer.buyerTeamName,
      country: "World",
      accent: "#69aef8",
    };
  }

  return (
    <main className="layout fullscreen-page manager-page manager-inbox-page">
      <section className="manager-calendar-head manager-inbox-head">
        <div>
          <button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Headquarters</button>
          <span>Communications center</span>
          <h1>Inbox & world desk</h1>
          <p>Club decisions, transfer approaches, and the live Valve Regional Standings.</p>
        </div>
        <div className="manager-inbox-summary">
          <span><small>Unread</small><b>{unreadCount}</b></span>
          <span><small>Live offers</small><b>{activeOfferCount}</b></span>
          <span><small>VRS</small><b>#{career.vrsRank}</b><em>{career.vrsPoints.toLocaleString()} pts</em></span>
        </div>
      </section>

      <nav className="manager-inbox-tabs" role="tablist" aria-label="Inbox workspace">
        <button className={tab === "inbox" ? "active" : ""} role="tab" aria-selected={tab === "inbox"} onClick={() => setTab("inbox")}><Mail size={16} /> Inbox <b>{unreadCount}</b></button>
        <button className={tab === "transfers" ? "active" : ""} role="tab" aria-selected={tab === "transfers"} onClick={() => setTab("transfers")}><ArrowLeftRight size={16} /> Transfers {activeOfferCount > 0 && <b>{activeOfferCount}</b>}</button>
        <button className={tab === "vrs" ? "active" : ""} role="tab" aria-selected={tab === "vrs"} onClick={() => setTab("vrs")}><TrendingUp size={16} /> VRS ranking</button>
      </nav>

      {tab === "inbox" && (
        <section className="manager-mail-workspace">
          <div className="manager-mail-list" role="list">
            <header><span>Correspondence</span><small>{messages.length} messages</small></header>
            {messages.map((item) => (
              <button
                type="button"
                role="listitem"
                key={item.id}
                className={`${item.id === selectedMessage?.id ? "active" : ""} ${item.read ? "read" : "unread"}`}
                onClick={() => openMessage(item)}
              >
                <i className={`manager-mail-kind ${item.kind}`}><ManagerInboxKindIcon kind={item.kind} /></i>
                <span><small>{item.kind} / {managerFormatDate(item.createdOn)}</small><strong>{item.title}</strong><em>{item.body}</em></span>
                {!item.read && <b aria-label="Unread" />}
              </button>
            ))}
            {!messages.length && <div className="manager-empty-state">The communications desk is clear.</div>}
          </div>
          <article className="manager-mail-reader">
            {selectedMessage ? (
              <>
                <header>
                  <i className={`manager-mail-kind ${selectedMessage.kind}`}><ManagerInboxKindIcon kind={selectedMessage.kind} /></i>
                  <span><small>{selectedMessage.kind} report / {managerFormatDate(selectedMessage.createdOn)}</small><h2>{selectedMessage.title}</h2></span>
                </header>
                <p>{selectedMessage.body}</p>
                <div className="manager-mail-metadata">
                  {selectedMessage.deadline && <span><small>Response deadline</small><b>{managerFormatDate(selectedMessage.deadline)}</b></span>}
                  {selectedMessage.rankAfter != null && <span><small>VRS movement</small><b>#{selectedMessage.rankBefore} <ArrowRight size={13} /> #{selectedMessage.rankAfter}</b></span>}
                  {selectedMessage.pointsDelta != null && <span><small>Points earned</small><b className="positive">+{selectedMessage.pointsDelta}</b></span>}
                  {selectedMessage.eventId && <span><small>Event</small><b>{managerEventName(managerEventById(selectedMessage.eventId) ?? managerEvents[0], career.season)}</b></span>}
                </div>
                {selectedMessage.offerId && (
                  <button className="primary" onClick={() => setTab("transfers")}><ArrowLeftRight size={16} /> Open negotiation</button>
                )}
              </>
            ) : <div className="manager-empty-state">Select a message to read it.</div>}
          </article>
        </section>
      )}

      {tab === "transfers" && (
        <div className="manager-transfer-desk">
          <section className="manager-incoming-offers">
            <div className="manager-section-head"><div><span>Negotiation desk</span><h2>Incoming offers</h2></div><small>{activeOfferCount} requiring action</small></div>
            {offers.map((offer) => {
              const buyer = buyerTeam(offer);
              const locked = managerIncomingOfferRosterLock(career, offer);
              const canSell = activeContractCount > 5 && !locked;
              const pending = offer.status === "pending";
              const counter = counterValues[offer.id] ?? Math.ceil(offer.cashOffered * 1.15 / 5_000) * 5_000;
              return (
                <article className={`manager-incoming-offer ${offer.status}`} key={offer.id}>
                  <div className="manager-offer-club"><TeamLogo team={buyer} /><span><small>{offer.status.replace("-", " ")} / expires {managerFormatDate(offer.expiresOn)}</small><strong>{buyer.name}</strong><em>Approach for {offer.targetPlayer.handle}</em></span></div>
                  <div className="manager-offer-player">
                    {playerPhoto(offer.targetPlayer.handle) ? <img src={playerPhoto(offer.targetPlayer.handle)} alt={offer.targetPlayer.handle} /> : <Avatar label={offer.targetPlayer.handle} accent={team.accent} />}
                    <span><strong>{offer.targetPlayer.handle}</strong><small>{offer.targetPlayer.role} / {offer.targetPlayer.ovr} OVR</small></span>
                  </div>
                  <div className="manager-offer-money"><small>{offer.counterCash != null ? "Your counter" : "Cash offer"}</small><b>{fmtMoney(offer.counterCash ?? offer.cashOffered)}</b><em>{offer.reasons[0]}</em></div>
                  <div className="manager-offer-actions">
                    {pending ? (
                      <>
                        <button className="primary" disabled={!canSell} onClick={() => onCareerChange(acceptManagerIncomingOffer(career, offer.id))}><CheckCircle2 size={15} /> Accept</button>
                        <label><span>Counter</span><input type="number" min={offer.cashOffered + 5_000} step="5000" value={counter} onChange={(event) => setCounterValues((current) => ({ ...current, [offer.id]: Number(event.target.value) || 0 }))} /></label>
                        <button className="secondary" disabled={!canSell || counter <= offer.cashOffered} onClick={() => onCareerChange(counterManagerIncomingOffer(career, offer.id, counter))}><ArrowLeftRight size={15} /> Send</button>
                        <button className="danger" onClick={() => onCareerChange(declineManagerIncomingOffer(career, offer.id))}><Ban size={15} /> Decline</button>
                      </>
                    ) : offer.status === "counter-pending" ? (
                      <><span className="manager-offer-wait"><Clock3 size={15} /> Response due {managerFormatDate(offer.responseOn ?? offer.expiresOn)}</span><button className="danger" onClick={() => onCareerChange(declineManagerIncomingOffer(career, offer.id))}>Withdraw</button></>
                    ) : <span className={`manager-offer-status ${offer.status}`}>{offer.status}</span>}
                  </div>
                  {pending && !canSell && <p className="manager-offer-blocked">{locked ? "This player is committed to a locked event roster." : "Sign a sixth eligible player before accepting or countering. The club cannot fall below five contracts."}</p>}
                </article>
              );
            })}
            {!offers.length && <div className="manager-empty-state">No clubs have made a formal approach yet. Offers arrive as the calendar advances.</div>}
          </section>
          <aside className="manager-transfer-wire">
            <div className="manager-section-head"><div><span>World market</span><h2>Completed moves</h2></div><Radio size={17} /></div>
            {[...career.market.rosterMoves].reverse().map((move) => {
              const club = teamById.get(move.clubId) ?? { id: move.clubId, tag: move.clubName.slice(0, 3).toUpperCase(), name: move.clubName, country: "World", accent: "#69aef8" } as Roster;
              return <div className="manager-wire-move" key={move.id}><TeamLogo team={club} small /><span><small>{managerFormatDate(move.completedOn)}</small><strong>{move.acquiredPlayer.handle} joins {move.clubName}</strong><em>{move.acquiredPlayer.role} / {move.acquiredPlayer.ovr} OVR</em></span></div>;
            })}
            {!career.market.rosterMoves.length && <div className="manager-empty-state">The world transfer window has been quiet.</div>}
          </aside>
        </div>
      )}

      {tab === "vrs" && (
        <section className="manager-vrs-board">
          <header><div><span>Valve Regional Standings</span><h2>Global ranking</h2><p>Current points and movement across the active manager world.</p></div><div><small>Updated</small><b>{managerFormatDate(career.date)}</b></div></header>
          <div className="manager-vrs-columns"><span>Rank</span><span>Team</span><span>Points</span><span>Movement</span></div>
          <div className="manager-vrs-list">
            {standings.map((standing) => (
              <div className={standing.managed ? "managed" : ""} key={standing.team.id}>
                <b>#{standing.rank}</b>
                <span><TeamLogo team={standing.team} small /><strong><Flag country={standing.team.country} /> {standing.team.name}</strong>{standing.managed && <em>Your club</em>}</span>
                <strong>{standing.points.toLocaleString()}</strong>
                <small className={standing.movement > 0 ? "positive" : standing.movement < 0 ? "negative" : ""}>{standing.movement > 0 ? `+${standing.movement}` : standing.movement || "-"}</small>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function ManagerHomePage({
  team,
  roster,
  coach,
  career,
  history,
  activeEvent,
  phase,
  record,
  results,
  onOpenCalendar,
  onOpenRoster,
  onOpenMarket,
  onOpenInbox,
  onRegister,
  onWithdraw,
  onLaunch,
  onAdvance,
  onReturnEvent,
  onOpenPlayer,
  onOpenHistory,
  onOpenPastEvent,
}: {
  team: FieldTeam;
  roster: Player[];
  coach?: Coach;
  career: ManagerCareerState;
  history: CareerHistoryEntry[];
  activeEvent?: ManagerEvent;
  phase: TournamentPhase;
  record: SwissRecord;
  results: SwissResult[];
  onOpenCalendar: () => void;
  onOpenRoster: () => void;
  onOpenMarket: () => void;
  onOpenInbox: () => void;
  onRegister: (eventId: string) => void;
  onWithdraw: (eventId: string) => void;
  onLaunch: (eventId: string) => void;
  onAdvance: (targetDate?: string) => void;
  onReturnEvent: () => void;
  onOpenPlayer: (player: Player, team: FieldTeam) => void;
  onOpenHistory: () => void;
  onOpenPastEvent: (entry: CareerHistoryEntry) => void;
}) {
  const confirmed = career.registrations
    .filter((registration) => registration.status === "confirmed")
    .map((registration) => managerEventById(registration.eventId))
    .filter((event): event is ManagerEvent => Boolean(event))
    .sort((a, b) => managerEventStartForRank(a, career.vrsRank, career.season).localeCompare(managerEventStartForRank(b, career.vrsRank, career.season)));
  const nextConfirmed = confirmed[0];
  const nextConfirmedReady = nextConfirmed ? managerEventReadyToLaunch(career, nextConfirmed.id) : false;
  const checkpoint = nextManagerCheckpoint(career);
  const unread = career.inbox.filter((item) => !item.read);
  const decisionItems = career.inbox.filter((item) => item.kind !== "market");
  const worldNews = career.inbox.filter((item) => item.kind === "market").slice(0, 4);
  const financial = managerFinancialStatus(career);
  const teamFamiliarity = managerTeamFamiliarity(career);
  const teamForm = managerTeamForm(career);
  const contractByPlayer = new Map(career.contracts.map((contract) => [contract.playerId, contract]));
  const available = managerEvents
    .filter((event) => managerEventEligibility(career, event).eligible)
    .slice(0, 3);
  const visibleConfirmed = confirmed.slice(0, 3);
  const visibleAvailable = available.slice(0, Math.max(0, 3 - visibleConfirmed.length));
  const recentLedger = career.ledger.slice(-4).reverse();
  const continueLabel = activeEvent
    ? `Return to ${phase === "playoffs" ? "playoffs" : `Swiss ${record.wins}-${record.losses}`}`
    : nextConfirmedReady && nextConfirmed
      ? `Travel to ${nextConfirmed.shortName}`
      : checkpoint
        ? `Advance to ${managerFormatDate(checkpoint)}`
        : nextConfirmed
          ? `Advance to ${managerFormatDate(managerEventStartForRank(nextConfirmed, career.vrsRank, career.season))}`
          : `Start ${managerSeasonLabel(career.season + 1)}`;
  const continueAction = activeEvent
    ? onReturnEvent
    : nextConfirmedReady && nextConfirmed
      ? () => onLaunch(nextConfirmed.id)
      : checkpoint
        ? () => onAdvance(checkpoint)
        : nextConfirmed
          ? () => onAdvance(managerEventStartForRank(nextConfirmed, career.vrsRank, career.season))
          : () => onAdvance();

  if (career.status === "bankrupt") {
    const wins = history.filter((entry) => entry.tier === "champion").length;
    const prizeMoney = history.reduce((total, entry) => total + entry.prize, 0);
    return (
      <main className="layout fullscreen-page manager-page manager-ended-page">
        <section className="manager-command-bar manager-ended-command">
          <div className="manager-org-id"><TeamLogo team={team} /><div><span>Final organization report / Season {career.season}</span><h1>{team.name}</h1><p>Career closed {managerFormatDate(career.endedOn ?? career.date)}</p></div></div>
          <div className="manager-command-actions"><button className="secondary" onClick={onOpenHistory}><Trophy size={16} /> Club honors</button></div>
        </section>
        <section className="manager-insolvency-report">
          <div className="manager-insolvency-mark"><TrendingDown size={34} /></div>
          <div><small>Season-end financial ruling</small><h2>The organization is insolvent</h2><p>{career.endReason ?? `${career.organizationName} ended the season with a negative balance.`} The board gave the club leeway to finish its calendar, but a new season cannot begin with unpaid obligations.</p></div>
          <span><small>Closing balance</small><b>{fmtMoney(career.cash)}</b><em>Career complete</em></span>
        </section>
        <section className="manager-ended-kpis">
          <div><small>Seasons managed</small><b>{career.season}</b></div>
          <div><small>Events completed</small><b>{history.length}</b></div>
          <div><small>Championships</small><b>{wins}</b></div>
          <div><small>Prize money earned</small><b>{fmtMoney(prizeMoney)}</b></div>
          <div><small>Final VRS rank</small><b>#{career.vrsRank}</b></div>
        </section>
        <section className="manager-section manager-history-section">
          <div className="manager-section-head"><div><span>Organization record</span><h2>Final event ledger</h2></div><button className="text-action" onClick={onOpenHistory}>Open full history <ArrowRight size={14} /></button></div>
          {history.length ? <div className="manager-history-table">{history.slice(-8).reverse().map((entry, index) => <button type="button" key={`${entry.event}-${index}`} onClick={() => onOpenPastEvent(entry)}><span>S{entry.season ?? 1}</span><strong>{entry.eventName ?? `Event ${entry.event}`}</strong><b>{placementLabel(entry.tier, entry.record)}</b><em>{entry.record.wins}-{entry.record.losses}</em><small>{fmtMoney(entry.prize)}</small><ArrowRight size={14} /></button>)}</div> : <div className="manager-empty-state">No events were completed before the organization closed.</div>}
        </section>
      </main>
    );
  }

  return (
    <main className="layout fullscreen-page manager-page">
      <section className="manager-command-bar">
        <div className="manager-org-id">
          <TeamLogo team={team} />
          <div>
            <span>Organization Manager / Season {career.season}</span>
            <h1>{team.name}</h1>
            <p>{managerFormatDate(career.date)} / {coach ? `${coach.handle} coaching` : "Staff vacancy"}</p>
          </div>
        </div>
        <div className="manager-command-actions">
          <button className="secondary" onClick={onOpenInbox}><Mail size={16} /> Inbox{unread.length ? ` (${unread.length})` : ""}</button>
          <button className="secondary" onClick={onOpenRoster}><Users size={16} /> Roster</button>
          <button className="secondary" onClick={onOpenMarket}><BriefcaseBusiness size={16} /> Recruitment</button>
          <button className="secondary" onClick={onOpenCalendar}><CalendarDays size={16} /> Calendar</button>
          <button className="primary" onClick={continueAction}>
            <ArrowRight size={16} /> {continueLabel}
          </button>
        </div>
      </section>

      <section className="manager-kpis" aria-label="Organization status">
        <div><span>VRS ranking</span><b>#{career.vrsRank}</b><small>{career.vrsPoints.toLocaleString()} points</small></div>
        <div><span>Available cash</span><b>{fmtMoney(career.cash)}</b><small className={`manager-pressure-${financial.pressure}`}>{financial.inDebt ? "Season-end insolvency risk" : Number.isFinite(financial.runwayMonths) ? `${financial.runwayMonths.toFixed(1)} months runway` : "No active payroll"}</small></div>
        <div><span>Board confidence</span><b>{career.boardConfidence}</b><small>{career.boardConfidence >= 70 ? "Secure" : career.boardConfidence >= 45 ? "Stable" : "Under review"}</small></div>
        <div><span>Reputation</span><b>{career.reputation}</b><small>{career.reputation >= 70 ? "Elite pull" : career.reputation >= 45 ? "Established" : "Building"}</small></div>
        <button type="button" className="manager-kpi-action" onClick={onOpenInbox}><span>Inbox</span><b>{unread.length}</b><small>unread decision{unread.length === 1 ? "" : "s"}</small><ArrowRight size={15} /></button>
      </section>

      <section className={`manager-objective-strip ${career.boardObjective.status}`} aria-label="Board objective">
        <div><span>Board mandate</span><strong>{career.boardObjective.title}</strong><small>{career.boardObjective.description}</small></div>
        <div><span>Progress</span><strong>#{career.vrsRank} <ArrowRight size={14} /> #{career.boardObjective.targetRank}</strong><small>{career.boardObjective.status === "active" ? `Due ${managerFormatDate(career.boardObjective.deadline)}` : career.boardObjective.status}</small></div>
        <div><span>Squad pulse</span><strong>{teamForm} form / {teamFamiliarity} fit</strong><small>{managerFormLabel(teamForm)} / {managerFamiliarityLabel(teamFamiliarity)}</small></div>
      </section>

      <div className="manager-home-grid">
        <div className="manager-home-main">
          <section className="manager-section manager-schedule-section">
            <div className="manager-section-head">
              <div><span>Competition desk</span><h2>{activeEvent ? "Tournament in progress" : "Next assignments"}</h2></div>
              <button className="text-action" onClick={onOpenCalendar}>Full calendar <ArrowRight size={14} /></button>
            </div>
            {activeEvent ? (
              <div className="manager-active-event">
                <div className={`manager-tier-mark ${activeEvent.tier}`}><Trophy size={22} /></div>
                <div>
                  <small>{activeEvent.tier} / {activeEvent.environment} / {activeEvent.location}</small>
                  <strong>{managerEventName(activeEvent, career.season)}{activeEvent.majorCycle && career.activeMajorStage ? ` / ${managerMajorStageLabel(career.activeMajorStage)}` : ""}</strong>
                  <span>{activeEvent.majorCycle && career.activeMajorStage
                    ? managerMajorStageStakes(career.activeMajorStage)
                    : activeEvent.stakesLabel} / {results.length} completed series</span>
                </div>
                <button className="primary" onClick={onReturnEvent}><Play size={15} /> Return to event</button>
              </div>
            ) : (
              <div className="manager-event-stack">
                {visibleConfirmed.map((event) => (
                  <ManagerCompactEventRow
                    key={event.id}
                    event={event}
                    status="confirmed"
                    vrsRank={career.vrsRank}
                    season={career.season}
                    canLaunch={managerEventReadyToLaunch(career, event.id)}
                    onPrimary={() => onLaunch(event.id)}
                    onSecondary={event.majorCycle ? undefined : () => onWithdraw(event.id)}
                  />
                ))}
                {visibleAvailable.map((event) => (
                  <ManagerCompactEventRow
                    key={event.id}
                    event={event}
                    status="available"
                    vrsRank={career.vrsRank}
                    season={career.season}
                    onPrimary={() => onRegister(event.id)}
                  />
                ))}
                {!visibleConfirmed.length && !visibleAvailable.length && (
                  <div className="manager-empty-state">No eligible registration is currently open. Advance the calendar or improve the team's VRS position.</div>
                )}
              </div>
            )}
          </section>

          <section className="manager-section manager-inbox-section">
            <div className="manager-section-head">
              <div><span>Decision queue</span><h2>Inbox</h2></div>
              <button className="text-action" onClick={onOpenInbox}>{unread.length} unread <ArrowRight size={14} /></button>
            </div>
            <div className="manager-inbox-list">
              {decisionItems.slice(0, 6).map((item) => (
                <button type="button" onClick={onOpenInbox} className={item.read ? "read" : ""} key={item.id}>
                  <span className={`manager-mail-icon ${item.kind}`}><Mail size={15} /></span>
                  <span>
                    <small>{item.kind} / {managerFormatDate(item.createdOn)}</small>
                    <strong>{item.title}</strong>
                    <em>{item.body}</em>
                  </span>
                  {item.deadline && <b>{managerFormatDate(item.deadline)}</b>}
                </button>
              ))}
              {!decisionItems.length && <div className="manager-empty-state">No decisions require attention.</div>}
            </div>
          </section>

          <ManagerTrophyCabinet
            compact
            team={team}
            history={history}
            onOpenEvent={onOpenPastEvent}
            onOpenHistory={onOpenHistory}
          />
        </div>

        <aside className="manager-home-side">
          <section className="manager-section manager-roster-section">
            <div className="manager-section-head">
              <div><span>Organization squad</span><h2>Roster</h2></div>
              <button className="text-action" onClick={onOpenRoster}>Contracts <ArrowRight size={14} /></button>
            </div>
            <div className="manager-roster-list">
              {roster.map((player) => {
                const photo = playerPhoto(player.handle);
                const contract = contractByPlayer.get(player.id);
                return (
                  <button key={player.id} onClick={() => onOpenPlayer(player, team)}>
                    {photo ? <img src={photo} alt={player.handle} loading="lazy" /> : <Avatar label={player.handle} accent={team.accent} />}
                    <span><strong><Flag country={player.country} /> {player.handle}</strong><small className="manager-role-label"><PlayerRoleGlyph role={player.role} size={11} /> {player.role} / age {player.age ?? "-"}</small></span>
                    <b>{player.ovr}</b>
                    <em>{contract ? `${fmtMoney(contract.monthlySalary)}/mo` : player.style}</em>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="manager-section manager-finance-section">
            <div className="manager-section-head">
              <div><span>Cash movement</span><h2>Recent ledger</h2></div>
              <Coins size={17} />
            </div>
            <div className="manager-ledger-list">
              {recentLedger.map((entry) => (
                <div key={entry.id}>
                  <span><strong>{entry.description}</strong><small>{managerFormatDate(entry.date)}</small></span>
                  <b className={entry.amount >= 0 ? "positive" : "negative"}>{entry.amount >= 0 ? "+" : "-"}{fmtMoney(Math.abs(entry.amount))}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="manager-section manager-world-section">
            <div className="manager-section-head">
              <div><span>Universe news</span><h2>Transfer wire</h2></div>
              <ArrowLeftRight size={17} />
            </div>
            <div className="manager-world-list">
              {worldNews.map((item) => (
                <div key={item.id}>
                  <small>{managerFormatDate(item.createdOn)}</small>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </div>
              ))}
              {!worldNews.length && <div className="manager-empty-state">No transfer activity has reached the wire.</div>}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ManagerCompactEventRow({
  event,
  status,
  vrsRank,
  season,
  canLaunch = true,
  onPrimary,
  onSecondary,
}: {
  event: ManagerEvent;
  status: "available" | "confirmed";
  vrsRank: number;
  season: number;
  canLaunch?: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
}) {
  const majorProjection = event.majorCycle ? managerMajorProjection(vrsRank, season) : undefined;
  return (
    <div className="manager-compact-event">
      <span className={`manager-tier-mark ${event.tier}`}><Trophy size={17} /></span>
      <span>
        <small>{event.tier} / {majorProjection ? `VRS #${vrsRank} -> ${majorProjection.label}` : `VRS #${event.rankMin}-#${event.rankMax}`}</small>
        <strong>{managerEventName(event, season)}</strong>
        <em>{majorProjection ? `Projected ${majorProjection.label} entry / ${managerFormatDate(majorProjection.startsOn)}` : event.formatLabel}</em>
      </span>
      <span>
        <small>{event.majorCycle ? "Valve funded" : "Committed cost"}</small>
        <b>{fmtMoney(event.entryFee + event.travelCost)}</b>
        <em>{event.majorCycle ? "No organization payment" : `${fmtMoney(event.prizePool)} cash pool`}</em>
      </span>
      <div>
        {onSecondary && <button className="secondary compact" onClick={onSecondary}>Withdraw</button>}
        <button className="primary compact" disabled={status === "confirmed" && !canLaunch} onClick={onPrimary}>
          {status === "confirmed" ? canLaunch ? "Travel" : event.majorCycle ? "VRS assigned" : "Not started" : "Register"}
        </button>
      </div>
    </div>
  );
}

function ManagerCalendarPage({
  career,
  roster,
  activeEvent,
  onBack,
  onRegister,
  onWithdraw,
  onLaunch,
  onReturnEvent,
  onOpenCompletedEvent,
}: {
  career: ManagerCareerState;
  roster: Player[];
  activeEvent?: ManagerEvent;
  onBack: () => void;
  onRegister: (eventId: string) => void;
  onWithdraw: (eventId: string) => void;
  onLaunch: (eventId: string) => void;
  onReturnEvent: () => void;
  onOpenCompletedEvent: (eventId: string) => void;
}) {
  const registeredCount = career.registrations.filter((item) => ["confirmed", "active"].includes(item.status)).length;
  const eligibleCount = managerEvents.filter((event) => managerEventEligibility(career, event).eligible).length;
  return (
    <main className="layout fullscreen-page manager-page manager-calendar-page">
      <section className="manager-calendar-head">
        <div>
          <button className="icon-only" onClick={onBack} title="Back to manager headquarters"><ArrowLeft size={18} /></button>
          <span><small>Season {career.season} / {managerSeasonLabel(career.season)}</small><h1>Tournament Calendar</h1></span>
        </div>
        <div className="manager-calendar-summary">
          <span><small>Today</small><b>{managerFormatDate(career.date)}</b></span>
          <span><small>VRS</small><b>#{career.vrsRank}</b></span>
          <span><small>Cash</small><b>{fmtMoney(career.cash)}</b></span>
          <span><small>Open / booked</small><b>{eligibleCount} / {registeredCount}</b></span>
        </div>
      </section>

      <section className="manager-calendar-table">
        <div className="manager-calendar-columns">
          <span>Event</span><span>Dates and format</span><span>Entry and roster lock</span><span>Cost and stakes</span><span>Action</span>
        </div>
        {managerEvents.map((event) => {
          const registration = career.registrations.find((item) => item.eventId === event.id);
          const check = managerEventEligibility(career, event);
          const isActive = activeEvent?.id === event.id;
          const isComplete = registration?.status === "completed";
          const canLaunch = managerEventReadyToLaunch(career, event.id);
          const schedule = managerEventSchedule(event, career.season);
          const startsOn = managerEventStartForRank(event, career.vrsRank, career.season);
          const majorProjection = event.majorCycle ? managerMajorProjection(career.vrsRank, career.season) : undefined;
          return (
            <div className={`manager-calendar-row ${registration?.status ?? ""}`} key={event.id}>
              <div className="manager-calendar-event-name">
                <span className={`manager-tier-mark ${event.tier}`}><Trophy size={18} /></span>
                <span><small>{event.tier} / {event.entryType} / {event.environment}</small><strong>{managerEventName(event, career.season)}</strong><em>{event.description}</em></span>
              </div>
              <div><small>{event.location} / {event.capacity}-team field</small><strong>{managerFormatDate(startsOn)} - {managerFormatDate(schedule.endsOn)}</strong><em>{majorProjection ? `${majorProjection.label} projected / recalculated at launch` : event.formatLabel}</em></div>
              <div><small>Roster lock {managerFormatDate(schedule.rosterLockOn)}</small><strong>{majorProjection ? `VRS #${career.vrsRank} -> ${majorProjection.label}` : `VRS #${event.rankMin}-#${event.rankMax}`}</strong><em className={check.eligible || registration ? "eligible" : "ineligible"}>{registration ? event.majorCycle && registration.status === "confirmed" ? "VRS assigned" : registration.status : check.eligible ? "Eligible now" : check.reasons[0]}</em></div>
              <div className="manager-calendar-stakes"><small>{event.majorCycle ? "Valve funded / $0 commitment" : `${fmtMoney(event.entryFee + event.travelCost)} committed`}</small><strong>{event.majorCycle ? `${fmtMoney(event.prizePool)} overall Major purse` : `${fmtMoney(event.prizePool)} cash pool`}</strong><em>{majorProjection ? managerMajorStageStakes(majorProjection.stage) : event.stakesLabel}</em></div>
              <div className="manager-calendar-actions">
                {isActive ? (
                  <button className="primary compact" onClick={onReturnEvent}><Play size={14} /> Return</button>
                ) : registration?.status === "confirmed" ? (
                  <><button className="primary compact" disabled={!canLaunch} onClick={() => onLaunch(event.id)}>{canLaunch ? "Travel" : event.majorCycle ? "VRS assigned" : "Not started"}</button>{!event.majorCycle && <button className="secondary compact" onClick={() => onWithdraw(event.id)}>Withdraw</button>}</>
                ) : isComplete ? (
                  <>
                    <span className="manager-status completed"><CheckCircle2 size={14} /> {registration.placement ? managerPlacementLabel(registration.placement) : "Complete"}</span>
                    <button className="secondary compact" onClick={() => onOpenCompletedEvent(event.id)}>Overview</button>
                  </>
                ) : (
                  <button className="primary compact" disabled={!check.eligible || roster.length < 5} onClick={() => onRegister(event.id)}>Register</button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}

type ManagerHonorTab = "major" | "lan";

function managerEventForHistory(entry: CareerHistoryEntry) {
  const eventId = entry.managerEventId ?? entry.archive?.eventId;
  if (eventId) {
    const direct = managerEventById(eventId);
    if (direct) return direct;
  }
  const season = entry.season ?? entry.archive?.season ?? 1;
  return managerEvents.find((event) => managerEventName(event, season) === entry.eventName);
}

function managerHonorPlacement(entry: CareerHistoryEntry) {
  if (entry.tier === "champion") return "1st";
  if (entry.tier === "runner-up") return "2nd";
  if (entry.tier === "top4") return "3-4th";
  if (entry.tier === "top8") return "5-8th";
  if (entry.archive?.majorStage) return managerMajorStageLabel(entry.archive.majorStage);
  return "Grouped";
}

function managerHonorTone(entry: CareerHistoryEntry) {
  if (entry.tier === "champion") return "champion";
  if (entry.tier === "runner-up") return "runner-up";
  if (entry.tier === "top4") return "podium";
  return "placed";
}

function managerHistoryDate(entry: CareerHistoryEntry, event?: ManagerEvent) {
  if (entry.archive?.completedOn) return entry.archive.completedOn;
  if (event) return managerEventSchedule(event, entry.season ?? 1).endsOn;
  return undefined;
}

const managerTrophySlotHints = [
  "Major champion",
  "LAN champion",
  "Major finalist",
  "Podium finish",
  "Elite event title",
  "Top-four finish",
  "International final",
  "Historic season",
];

function managerTrophyDisplayScore(entry: CareerHistoryEntry) {
  const placementScore = entry.tier === "champion" ? 400 : entry.tier === "runner-up" ? 260 : entry.tier === "top4" ? 150 : entry.tier === "top8" ? 70 : 20;
  const event = managerEventForHistory(entry);
  const majorScore = event?.tier === "major" || entry.eventName?.toLowerCase().includes("major") ? 180 : 0;
  const lanScore = event?.environment === "LAN" ? 35 : 0;
  return placementScore + majorScore + lanScore;
}

function ManagerTrophyCabinet({
  team,
  history,
  compact = false,
  onOpenEvent,
  onOpenHistory,
}: {
  team: FieldTeam;
  history: CareerHistoryEntry[];
  compact?: boolean;
  onOpenEvent: (entry: CareerHistoryEntry) => void;
  onOpenHistory?: () => void;
}) {
  const slotCount = compact ? 4 : 8;
  const artifacts = history
    .map((entry, index) => ({ entry, index, score: managerTrophyDisplayScore(entry) }))
    .sort((a, b) => b.score - a.score || (b.entry.season ?? 1) - (a.entry.season ?? 1) || b.index - a.index)
    .slice(0, slotCount);
  const emptySlots = Math.max(0, slotCount - artifacts.length);

  return (
    <section
      className={`manager-trophy-room${compact ? " compact" : ""}`}
      style={{ "--trophy-accent": team.accent } as React.CSSProperties}
      aria-label={`${team.name} trophy room`}
    >
      <header className="manager-trophy-room-head">
        <div><span>Organization legacy</span><h2>{compact ? "Trophy cabinet" : "The trophy room"}</h2><small>{history.length ? `${history.length} archived event${history.length === 1 ? "" : "s"}` : "The first display is waiting"}</small></div>
        {onOpenHistory && <button className="text-action" onClick={onOpenHistory}>Enter room <ArrowRight size={14} /></button>}
      </header>
      <div className="manager-trophy-case">
        {artifacts.map(({ entry, index }) => {
          const event = managerEventForHistory(entry);
          const completedOn = managerHistoryDate(entry, event);
          const tone = managerHonorTone(entry);
          const Icon = entry.tier === "champion" ? Trophy : entry.tier === "runner-up" || entry.tier === "top4" ? Award : Shield;
          return (
            <button
              type="button"
              className={`manager-trophy-slot ${tone}`}
              key={entry.archive?.id ?? `${entry.event}-${index}`}
              onClick={() => onOpenEvent(entry)}
              title={`Open ${entry.eventName ?? event?.name ?? `Event ${entry.event}`} overview`}
            >
              <span className="manager-trophy-object" aria-hidden="true"><Icon size={compact ? 40 : 50} strokeWidth={1.55} /><i /></span>
              <span className="manager-trophy-plaque"><TeamLogo team={team} small /><b>{managerHonorPlacement(entry)}</b></span>
              <strong>{entry.eventName ?? event?.name ?? `Event ${entry.event}`}</strong>
              <small>{completedOn ? managerFormatDate(completedOn) : `Season ${entry.season ?? 1}`}</small>
            </button>
          );
        })}
        {Array.from({ length: emptySlots }, (_, index) => (
          <div className="manager-trophy-slot empty" key={`empty-${index}`} aria-hidden="true">
            <span className="manager-trophy-object"><Trophy size={compact ? 36 : 44} strokeWidth={1.35} /><i /></span>
            <strong>{managerTrophySlotHints[artifacts.length + index]}</strong>
            <small>Unclaimed</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ManagerClubHonorsPage({
  team,
  career,
  history,
  onBack,
  onOpenEvent,
}: {
  team: FieldTeam;
  career: ManagerCareerState;
  history: CareerHistoryEntry[];
  onBack: () => void;
  onOpenEvent: (entry: CareerHistoryEntry) => void;
}) {
  const [activeTab, setActiveTab] = useState<ManagerHonorTab>("major");
  const rows = history
    .map((entry, index) => ({ entry, index, event: managerEventForHistory(entry) }))
    .filter(({ entry, event }) => activeTab === "major"
      ? event?.tier === "major" || entry.eventName?.toLowerCase().includes("major")
      : event?.environment === "LAN" || (!event && !entry.eventName?.toLowerCase().includes("online")))
    .reverse();
  const titles = history.filter((entry) => entry.tier === "champion").length;
  const podiums = history.filter((entry) => ["champion", "runner-up", "top4"].includes(entry.tier)).length;
  const majorEntries = history.filter((entry) => managerEventForHistory(entry)?.tier === "major" || entry.eventName?.toLowerCase().includes("major"));
  const majorTitles = majorEntries.filter((entry) => entry.tier === "champion").length;
  const earnings = history.reduce((sum, entry) => sum + entry.prize, 0);

  return (
    <main className="layout fullscreen-page manager-page manager-honors-page">
      <section className="manager-honors-hero">
        <div className="manager-honors-team">
          <TeamLogo team={team} />
          <span><small>Organization record / {history.length} completed events</small><h1>{team.name} Club Honors</h1><p>Every placement earned under your management, with the tournament archive behind it.</p></span>
        </div>
        <button className="secondary" onClick={onBack}><ArrowLeft size={16} /> Back to HQ</button>
      </section>

      <section className="manager-honors-kpis" aria-label="Club achievements summary">
        <div><Trophy size={18} /><span><b>{titles}</b><small>Tournament titles</small></span></div>
        <div><Award size={18} /><span><b>{podiums}</b><small>Podium finishes</small></span></div>
        <div><Shield size={18} /><span><b>{majorTitles}</b><small>Major championships</small></span></div>
        <div><Coins size={18} /><span><b>{fmtMoney(earnings)}</b><small>Prize money earned</small></span></div>
        <div><TrendingUp size={18} /><span><b>#{career.vrsRank}</b><small>Current VRS rank</small></span></div>
      </section>

      <ManagerTrophyCabinet team={team} history={history} onOpenEvent={onOpenEvent} />

      <nav className="manager-honors-tabs" role="tablist" aria-label="Organization achievements">
        <button type="button" role="tab" aria-selected={activeTab === "major"} className={activeTab === "major" ? "active" : ""} onClick={() => setActiveTab("major")}><Trophy size={16} /> Majors <span>{majorEntries.length}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === "lan"} className={activeTab === "lan" ? "active" : ""} onClick={() => setActiveTab("lan")}><Database size={16} /> LAN events <span>{history.filter((entry) => managerEventForHistory(entry)?.environment === "LAN").length}</span></button>
      </nav>

      <section className="manager-honors-ledger">
        <div className="manager-honors-heading">
          <span>Placement</span><span>Organization</span><span>Tournament</span><span>Reward</span><span>Archive</span>
        </div>
        {rows.map(({ entry, index, event }) => {
          const completedOn = managerHistoryDate(entry, event);
          return (
            <button type="button" className="manager-honor-row" key={entry.archive?.id ?? `${entry.event}-${index}`} onClick={() => onOpenEvent(entry)}>
              <span className={`manager-placement-badge ${managerHonorTone(entry)}`}><Trophy size={14} /> {managerHonorPlacement(entry)}</span>
              <span className="manager-honor-team"><TeamLogo team={team} small /><b>{team.name}</b></span>
              <span className="manager-honor-event"><b>{entry.eventName ?? event?.name ?? `Event ${entry.event}`}</b><small>{event ? `${event.environment} / ${event.location}` : `Season ${entry.season ?? 1}`}{completedOn ? ` / ${managerFormatDate(completedOn)}` : ""}</small></span>
              <span className="manager-honor-reward"><b>{fmtMoney(entry.prize)}</b><small>+{entry.points ?? 0} VRS / {entry.record.wins}-{entry.record.losses}</small></span>
              <span className="manager-honor-open">Overview <ArrowRight size={15} /></span>
            </button>
          );
        })}
        {!rows.length && <div className="manager-empty-state">No {activeTab === "major" ? "Major" : "LAN"} placements have been recorded yet.</div>}
      </section>
    </main>
  );
}

function managerVaultMatchesForHistory(
  matches: MatchRecord[],
  runId: string,
  entry: CareerHistoryEntry,
) {
  const event = managerEventForHistory(entry);
  const season = entry.season ?? 1;
  return matches.filter((match) => {
    if (match.runId !== runId || match.season !== season) return false;
    if (event?.majorCycle) return ["major", "mrq", "stage-1", "stage-2", "stage-3"].includes(match.eventId ?? "");
    if (event) return match.eventId === event.id || match.eventName === entry.eventName;
    return match.eventName === entry.eventName;
  });
}

function ManagerLegacyEventOverviewPage({
  team,
  entry,
  matches,
  onBack,
  onOpenReplay,
}: {
  team: FieldTeam;
  entry: CareerHistoryEntry;
  matches: MatchRecord[];
  onBack: () => void;
  onOpenReplay: (id: string) => void;
}) {
  const event = managerEventForHistory(entry);
  const teamMatches = matches.filter((match) => (
    match.left.id === team.id || match.right.id === team.id || match.left.name === team.name || match.right.name === team.name
  ));
  const mapWins = teamMatches.filter((match) => match.winnerId === team.id || (
    match.winnerId === match.left.id ? match.left.name === team.name : match.right.name === team.name
  )).length;
  const participants = new Map<string, MatchRecord["left"]>();
  matches.forEach((match) => {
    participants.set(match.left.id, match.left);
    participants.set(match.right.id, match.right);
  });
  const mapUsage = mapPool.map((map) => ({ map, count: matches.filter((match) => match.map === map.id).length })).filter((row) => row.count > 0);

  return (
    <main className="layout fullscreen-page manager-page manager-legacy-event-page">
      <section className="manager-honors-hero manager-event-recap-hero">
        <div className="manager-honors-team">
          <span className={`manager-placement-badge large ${managerHonorTone(entry)}`}><Trophy size={19} /> {managerHonorPlacement(entry)}</span>
          <span><small>Archived event / Season {entry.season ?? 1}</small><h1>{entry.eventName ?? event?.name ?? `Event ${entry.event}`}</h1><p>{event?.description ?? "This event predates the full tournament archive; its saved Vault maps remain available below."}</p></span>
        </div>
        <button className="secondary" onClick={onBack}><ArrowLeft size={16} /> Back to honors</button>
      </section>

      <section className="manager-event-recap-facts">
        <div><small>Placement</small><b>{managerHonorPlacement(entry)}</b><span>{entry.record.wins}-{entry.record.losses} series record</span></div>
        <div><small>Prize earned</small><b>{fmtMoney(entry.prize)}</b><span>+{entry.points ?? 0} VRS points</span></div>
        <div><small>Venue</small><b>{event?.environment ?? "Archived"}</b><span>{event?.location ?? "Legacy save"}</span></div>
        <div><small>Format</small><b>{event?.format === "single-elimination" ? "Knockout" : event?.format === "round-robin" ? "Round robin" : "Swiss"}</b><span>{event?.formatLabel ?? "Saved match history"}</span></div>
        <div><small>Vault coverage</small><b>{teamMatches.length} maps</b><span>{mapWins}-{teamMatches.length - mapWins} map record</span></div>
      </section>

      <div className="manager-event-recap-grid">
        <section className="manager-section manager-event-recap-results">
          <div className="manager-section-head"><div><span>Team performance</span><h2>{team.name} results</h2></div><small>{teamMatches.length} saved maps</small></div>
          <div className="manager-event-map-table">
            {[...teamMatches].reverse().map((match) => {
              const teamLeft = match.left.id === team.id || match.left.name === team.name;
              const opponent = teamLeft ? match.right : match.left;
              const teamScore = teamLeft ? match.leftScore : match.rightScore;
              const opponentScore = teamLeft ? match.rightScore : match.leftScore;
              const won = match.winnerId === (teamLeft ? match.left.id : match.right.id);
              return (
                <button type="button" key={match.id} onClick={() => onOpenReplay(match.id)} title="Open saved map replay">
                  <span><b>{match.stage ?? "Match"}</b><small>{mapName(match.map)}</small></span>
                  <span className="manager-vault-opponent">{opponent.logo ? <img src={opponent.logo} alt="" /> : <Avatar label={opponent.tag} accent={opponent.accent} />}<b>{opponent.name}</b></span>
                  <strong className={won ? "positive" : "negative"}>{won ? "W" : "L"} {teamScore}-{opponentScore}</strong>
                  <Play size={14} />
                </button>
              );
            })}
            {!teamMatches.length && <div className="manager-empty-state">No map records from this older event remain in the Vault.</div>}
          </div>
        </section>

        <aside className="manager-event-recap-side">
          <section className="manager-section">
            <div className="manager-section-head"><div><span>Attendance</span><h2>Event field</h2></div><small>{participants.size} saved teams</small></div>
            <div className="manager-event-participants">
              {[...participants.values()].map((participant) => <span key={participant.id}>{participant.logo ? <img src={participant.logo} alt="" /> : <Avatar label={participant.tag} accent={participant.accent} />}<b>{participant.name}</b></span>)}
            </div>
          </section>
          <section className="manager-section">
            <div className="manager-section-head"><div><span>Active duty</span><h2>Map pool usage</h2></div></div>
            <div className="manager-event-map-usage">{mapUsage.map(({ map, count }) => <span key={map.id}><b>{map.name}</b><small>{count} played</small></span>)}</div>
          </section>
        </aside>
      </div>
    </main>
  );
}

// ---- Save universe ------------------------------------------------------------------------------

function SaveUniverseHub({
  team,
  roster,
  coach,
  mode,
  currentEvent,
  season,
  careerEvent,
  points,
  money,
  history,
  record,
  phase,
  playoffRound,
  outcome,
  currentResults,
  allResults,
  playerForm,
  development,
  opponent,
  vaultProfile,
  autoCoach,
  resumeScreen,
  onBack,
  onOpenEvent,
  onOpenStats,
  onOpenResults,
  onOpenVault,
  onOpenTeamVault,
  onOpenPlayer,
  onOpenTeam,
  onOpenSeries,
  onOpenHistory,
}: {
  team: FieldTeam;
  roster: Player[];
  coach?: Coach;
  mode: Mode;
  currentEvent?: CircuitEvent;
  season: number;
  careerEvent: number;
  points: number;
  money: number;
  history: CareerHistoryEntry[];
  record: SwissRecord;
  phase: TournamentPhase;
  playoffRound: PlayoffRound;
  outcome: TournamentOutcome;
  currentResults: SwissResult[];
  allResults: SwissResult[];
  playerForm: Record<string, number>;
  development: Array<{ handle: string; before: number; after: number; iglDelta: number }>;
  opponent: FieldTeam;
  vaultProfile?: TeamProfile;
  autoCoach: boolean;
  resumeScreen?: Screen;
  onBack: () => void;
  onOpenEvent: () => void;
  onOpenStats: () => void;
  onOpenResults: () => void;
  onOpenVault: () => void;
  onOpenTeamVault: () => void;
  onOpenPlayer: (player: Player, team: FieldTeam) => void;
  onOpenTeam: (team: FieldTeam) => void;
  onOpenSeries: (id: string) => void;
  onOpenHistory: (entry: CareerHistoryEntry) => void;
}) {
  const eventName = currentEvent?.name ?? `Major ${careerEvent}`;
  const worldRank = mode === "circuit" ? circuitWorldRank(points, builtInHltvRosters) : undefined;
  const average = roster.length ? roster.reduce((sum, player) => sum + player.ovr, 0) / roster.length : 0;
  const mapsPlayed = currentResults.reduce((sum, result) => sum + result.maps.length, 0);
  const latestSeries = allResults[allResults.length - 1];
  const latestWinner = latestSeries
    ? latestSeries.winnerId === latestSeries.left.id ? latestSeries.left : latestSeries.right
    : undefined;
  const latestLoser = latestSeries
    ? latestSeries.winnerId === latestSeries.left.id ? latestSeries.right : latestSeries.left
    : undefined;
  const latestHistory = history[history.length - 1];
  const eventLeaders = buildOverviewPlayerLeaders(currentResults, winnerFromFinal(currentResults)?.id);
  const prospect = roster
    .slice()
    .sort(
      (a, b) =>
        Math.max(0, (b.potential ?? b.ovr) - b.ovr) - Math.max(0, (a.potential ?? a.ovr) - a.ovr) ||
        (a.age ?? 99) - (b.age ?? 99),
    )[0];
  const prospectHeadroom = prospect ? Math.max(0, (prospect.potential ?? prospect.ovr) - prospect.ovr) : 0;
  const coldPlayer = roster
    .map((player) => ({ player, form: playerForm[player.id] ?? 0 }))
    .sort((a, b) => a.form - b.form)[0];
  const developmentByHandle = new Map(development.map((row) => [row.handle, row]));
  const currentEventIndex = currentEvent ? circuitEventIndex(currentEvent.id) : 0;
  const completedEventIds = new Set(
    history
      .filter((entry) => (entry.season ?? season) === season)
      .map((entry) => entry.eventId)
      .filter((eventId): eventId is CircuitEventId => Boolean(eventId)),
  );
  const stageLabel =
    outcome === "champion"
      ? "Champions"
      : outcome === "complete"
        ? "Complete"
        : phase === "playoffs"
          ? playoffRoundLabel(playoffRound)
          : record.wins >= 3
            ? "Qualified"
            : record.losses >= 3
              ? "Eliminated"
              : `Swiss ${record.wins}-${record.losses}`;
  const resumeLabel =
    resumeScreen === "transfer"
      ? "Return to roster window"
      : resumeScreen === "match"
        ? "Return to live match"
        : resumeScreen === "veto"
          ? "Return to veto"
          : resumeScreen === "playoffs"
            ? "Return to playoffs"
            : "Return to competition";

  const vrsTable = mode === "circuit"
    ? rankRostersByVrs<FieldTeam>([
        ...builtInHltvRosters.map(toTournamentTeam),
        { ...team, rank: undefined, vrsPoints: points },
      ]).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
    : [];
  const userRankIndex = vrsTable.findIndex((entry) => entry.id === team.id);
  const vrsStart = Math.max(0, Math.min(vrsTable.length - 5, userRankIndex - 2));
  const vrsWindow = vrsTable.slice(vrsStart, vrsStart + 5);

  const newsItems: Array<{
    icon: React.ReactNode;
    eyebrow: string;
    title: string;
    detail: string;
    onClick: () => void;
  }> = [];
  if (latestSeries && latestWinner && latestLoser) {
    newsItems.push({
      icon: <Swords size={17} />,
      eyebrow: latestSeries.eventName ?? eventName,
      title: `${latestWinner.name} beat ${latestLoser.name} ${Math.max(latestSeries.leftScore, latestSeries.rightScore)}-${Math.min(latestSeries.leftScore, latestSeries.rightScore)}`,
      detail: `${latestSeries.label} / ${latestSeries.maps.length} map${latestSeries.maps.length === 1 ? "" : "s"}`,
      onClick: () => onOpenSeries(latestSeries.id),
    });
  }
  if (latestHistory) {
    newsItems.push({
      icon: <Trophy size={17} />,
      eyebrow: `Season ${latestHistory.season ?? latestHistory.event}`,
      title: `${team.name} finished ${placementLabel(latestHistory.tier, latestHistory.record)}`,
      detail: `${latestHistory.eventName ?? `Major ${latestHistory.event}`} / ${fmtMoney(latestHistory.prize)}${latestHistory.points != null ? ` / +${latestHistory.points} VRS` : ""}`,
      onClick: () => onOpenHistory(latestHistory),
    });
  }
  if (eventLeaders.mvp) {
    const leader = eventLeaders.mvp;
    newsItems.push({
      icon: <Award size={17} />,
      eyebrow: "MVP watch",
      title: `${leader.player.handle} leads the event at ${leader.line.rating.toFixed(2)}`,
      detail: `${leader.team.name} / ${leader.matches} recorded map${leader.matches === 1 ? "" : "s"}`,
      onClick: () => onOpenPlayer(leader.player, leader.team),
    });
  }
  if (prospect && prospectHeadroom > 0) {
    newsItems.push({
      icon: <Sparkles size={17} />,
      eyebrow: "Prospect report",
      title: `${prospect.handle} carries ${prospectHeadroom} OVR of development headroom`,
      detail: `Age ${prospect.age ?? "-"} / ${prospect.ovr} current / ${prospect.potential ?? prospect.ovr} potential`,
      onClick: () => onOpenPlayer(prospect, team),
    });
  }
  if (!newsItems.length) {
    newsItems.push({
      icon: <Target size={17} />,
      eyebrow: "Opening desk",
      title: `${team.name} is ready for its first recorded series`,
      detail: `${eventName} / ${stageLabel}`,
      onClick: onBack,
    });
  }

  return (
    <main className="layout fullscreen-page universe-page">
      <section className="universe-hero">
        <div className="universe-team-id">
          <TeamLogo team={team} />
          <div>
            <span>Save universe / Season {season}</span>
            <h1>{team.name}</h1>
            <p>{eventName} / {stageLabel}{coach ? ` / coached by ${coach.handle}` : ""}</p>
          </div>
        </div>
        <div className="universe-hero-actions">
          <button className="secondary" onClick={onOpenEvent}>
            <LayoutDashboard size={16} />
            Event overview
          </button>
          <button className="primary" onClick={onBack}>
            <ArrowRight size={16} />
            {resumeLabel}
          </button>
        </div>
      </section>

      <section className="universe-metrics" aria-label="Save summary">
        <div>
          <span>{mode === "circuit" ? "VRS rank" : "Team OVR"}</span>
          <b>{worldRank ? `#${worldRank}` : average.toFixed(1)}</b>
          <small>{mode === "circuit" ? `${points} points` : "current roster"}</small>
        </div>
        <div>
          <span>Current record</span>
          <b>{record.wins}-{record.losses}</b>
          <small>{stageLabel}</small>
        </div>
        <div>
          <span>Career bank</span>
          <b>{fmtMoney(money)}</b>
          <small>{history.length} completed stage{history.length === 1 ? "" : "s"}</small>
        </div>
        <div>
          <span>Vault record</span>
          <b>{vaultProfile ? `${vaultProfile.wins}-${vaultProfile.losses}` : "-"}</b>
          <small>{vaultProfile ? `${vaultProfile.matches} saved maps` : "waiting for results"}</small>
        </div>
      </section>

      <div className="universe-grid">
        <div className="universe-main-column">
          <section className="universe-panel universe-event-panel">
            <div className="universe-panel-head">
              <div>
                <span>Current assignment</span>
                <h2>{eventName}</h2>
              </div>
              <b>{stageLabel}</b>
            </div>
            <p>{currentEvent?.description ?? "A fresh sixteen-team Major run with Swiss qualification and a championship bracket."}</p>
            <div className="universe-event-facts">
              <span><small>Record</small><b>{record.wins}-{record.losses}</b></span>
              <span><small>Series</small><b>{currentResults.length}</b></span>
              <span><small>Maps</small><b>{mapsPlayed}</b></span>
              <span><small>Next opponent</small><b>{opponent.tag}</b></span>
            </div>
            {currentEvent && (
              <div className="universe-route" aria-label="Major route">
                {circuitEvents.map((event, index) => {
                  const current = event.id === currentEvent.id;
                  const completed = completedEventIds.has(event.id);
                  const skipped = index < currentEventIndex && !completed;
                  return (
                    <div className={current ? "current" : completed ? "done" : skipped ? "skipped" : ""} key={event.id}>
                      <span>{index + 1}</span>
                      <b>{event.shortName}</b>
                      <small>{current ? "Live" : completed ? "Complete" : skipped ? "Skipped" : "Ahead"}</small>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="universe-panel-actions">
              <button className="primary" onClick={onOpenEvent}><LayoutDashboard size={15} /> Open event</button>
              <button className="secondary" disabled={!currentResults.length} onClick={onOpenResults}><Database size={15} /> Results</button>
              <button className="secondary" disabled={!currentResults.length} onClick={onOpenStats}><Target size={15} /> Stats</button>
            </div>
          </section>

          <section className="universe-panel universe-news-panel">
            <div className="universe-panel-head">
              <div>
                <span>Save-generated feed</span>
                <h2>World news</h2>
              </div>
              <small>{newsItems.length} stories</small>
            </div>
            <div className="universe-news-list">
              {newsItems.slice(0, 5).map((item, index) => (
                <button type="button" className="universe-news-row" key={`${item.eyebrow}-${index}`} onClick={item.onClick}>
                  <span className="universe-news-icon">{item.icon}</span>
                  <span>
                    <small>{item.eyebrow}</small>
                    <strong>{item.title}</strong>
                    <em>{item.detail}</em>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          </section>

          <section className="universe-panel universe-history-panel">
            <div className="universe-panel-head">
              <div>
                <span>Placement ledger</span>
                <h2>Recent history</h2>
              </div>
              <button type="button" className="text-action" onClick={onOpenTeamVault}>Full history <ArrowRight size={14} /></button>
            </div>
            {history.length ? (
              <div className="universe-history-list">
                {history.slice(-5).reverse().map((entry, index) => (
                  <button type="button" key={`${entry.event}-${entry.season ?? 0}-${index}`} onClick={() => onOpenHistory(entry)}>
                    <span>S{entry.season ?? entry.event}</span>
                    <strong>{entry.eventName ?? `Major ${entry.event}`}</strong>
                    <b>{placementLabel(entry.tier, entry.record)}</b>
                    <em>{entry.record.wins}-{entry.record.losses}</em>
                    <small>{entry.points != null ? `+${entry.points} pts` : fmtMoney(entry.prize)}</small>
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="universe-empty">Your first completed event will begin the placement ledger.</div>
            )}
          </section>
        </div>

        <aside className="universe-side-column">
          <section className="universe-panel universe-roster-panel">
            <div className="universe-panel-head">
              <div>
                <span>Team pulse</span>
                <h2>Current roster</h2>
              </div>
              <small>{average.toFixed(1)} avg OVR</small>
            </div>
            <div className="universe-roster-list">
              {roster.map((player) => {
                const photo = playerPhoto(player.handle);
                const form = playerForm[player.id] ?? 0;
                const dev = developmentByHandle.get(player.handle);
                return (
                  <button type="button" key={player.id} onClick={() => onOpenPlayer(player, team)}>
                    {photo ? <img src={photo} alt={player.handle} loading="lazy" /> : <Avatar label={player.handle} accent={team.accent} />}
                    <span>
                      <strong><Flag country={player.country} /> {player.handle}</strong>
                      <small>{player.role} / age {player.age ?? "-"}</small>
                    </span>
                    <span className="universe-player-form">
                      <b>{player.ovr}</b>
                      <small>{player.potential && player.potential > player.ovr ? `POT ${player.potential}` : "OVR"}</small>
                    </span>
                    <em className={form > 2 ? "good" : form < -2 ? "bad" : ""}>
                      {dev && dev.after !== dev.before ? `${dev.after > dev.before ? "+" : ""}${dev.after - dev.before} OVR` : `${form > 0 ? "+" : ""}${form}%`}
                    </em>
                  </button>
                );
              })}
            </div>
          </section>

          {mode === "circuit" ? (
            <section className="universe-panel universe-vrs-panel">
              <div className="universe-panel-head">
                <div>
                  <span>Global table</span>
                  <h2>VRS neighborhood</h2>
                </div>
                <small>{points} points</small>
              </div>
              <div className="universe-vrs-list">
                {vrsWindow.map((entry) => (
                  <button type="button" className={entry.id === team.id ? "user" : ""} key={entry.id} onClick={() => onOpenTeam(entry)}>
                    <span>#{entry.rank}</span>
                    <TeamLogo team={entry} small />
                    <strong>{entry.name}</strong>
                    <b>{entry.vrsPoints?.toLocaleString() ?? "-"}</b>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="universe-panel universe-vrs-panel">
              <div className="universe-panel-head">
                <div>
                  <span>Career picture</span>
                  <h2>Placement count</h2>
                </div>
              </div>
              <div className="universe-placement-counts">
                <span><b>{history.filter((entry) => entry.tier === "champion").length}</b><small>Titles</small></span>
                <span><b>{history.filter((entry) => entry.tier === "runner-up").length}</b><small>Finals</small></span>
                <span><b>{history.filter((entry) => ["champion", "runner-up", "top4", "top8"].includes(entry.tier)).length}</b><small>Playoffs</small></span>
              </div>
            </section>
          )}

          <section className="universe-panel universe-inbox-panel">
            <div className="universe-panel-head">
              <div>
                <span>Action queue</span>
                <h2>Decision inbox</h2>
              </div>
              <small>{autoCoach ? "Auto Coach on" : "Manual calls"}</small>
            </div>
            <div className="universe-inbox-list">
              <button type="button" onClick={onBack}>
                <span className="priority">1</span>
                <span>
                  <strong>{resumeScreen === "transfer" ? "Roster window is open" : `${stageLabel} against ${opponent.name}`}</strong>
                  <small>{resumeScreen === "transfer" ? "Review development and the transfer market." : resumeLabel}</small>
                </span>
                <ArrowRight size={15} />
              </button>
              {coldPlayer && coldPlayer.form < -2 ? (
                <button type="button" onClick={() => onOpenPlayer(coldPlayer.player, team)}>
                  <span className="warning">!</span>
                  <span>
                    <strong>{coldPlayer.player.handle} is running cold</strong>
                    <small>{coldPlayer.form}% carried form entering the next map.</small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              ) : prospect && prospectHeadroom > 0 ? (
                <button type="button" onClick={() => onOpenPlayer(prospect, team)}>
                  <span className="growth">+</span>
                  <span>
                    <strong>{prospect.handle} is your largest development project</strong>
                    <small>{prospectHeadroom} OVR remains before their current ceiling.</small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              ) : null}
            </div>
          </section>

          <section className="universe-panel universe-vault-panel">
            <div className="universe-panel-head">
              <div>
                <span>Persistent archive</span>
                <h2>Vault snapshot</h2>
              </div>
              <Database size={17} />
            </div>
            {vaultProfile ? (
              <>
                <div className="universe-vault-facts">
                  <span><b>{vaultProfile.matches}</b><small>Maps</small></span>
                  <span><b>{vaultProfile.wins}-{vaultProfile.losses}</b><small>Record</small></span>
                  <span><b>{vaultProfile.roster[0]?.line.rating.toFixed(2) ?? "-"}</b><small>Top rating</small></span>
                </div>
                <button className="secondary wide" onClick={onOpenTeamVault}>Open team archive <ArrowRight size={15} /></button>
              </>
            ) : (
              <>
                <p>No saved maps for this team yet.</p>
                <button className="secondary wide" onClick={onOpenVault}>Open Vault <ArrowRight size={15} /></button>
              </>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

// ---- Event overview -----------------------------------------------------------------------------

interface EventOverviewCircuit {
  event: CircuitEvent;
  currentEvent: CircuitEvent;
  availableEventIds: CircuitEventId[];
  season: number;
  points: number;
  worldRank?: number;
}

interface EventOverviewManager {
  event: ManagerEvent;
  stage?: CircuitEvent;
  vrsStandings: ManagerVrsStanding[];
}

interface EventPlacementRow {
  team: FieldTeam;
  record: SwissRecord;
  label: string;
  detail: string;
  prize?: number;
  order: number;
  tone: "champion" | "podium" | "qualified" | "eliminated" | "live";
}

function EventOverviewPage({
  name,
  phase,
  outcome,
  winner,
  teams,
  records,
  results,
  currentRound,
  playoffPairs,
  settings,
  circuit,
  manager,
  onSelectCircuitEvent,
  onBack,
  onStats,
  onResults,
  onOpenTeam,
  onOpenPlayer,
  onOpenSeries,
}: {
  name: string;
  phase: TournamentPhase;
  outcome: TournamentOutcome;
  winner?: FieldTeam;
  teams: FieldTeam[];
  records: Record<string, SwissRecord>;
  results: SwissResult[];
  currentRound: PlayoffRound;
  playoffPairs: SwissPair[];
  settings: CustomSettings;
  circuit?: EventOverviewCircuit;
  manager?: EventOverviewManager;
  onSelectCircuitEvent: (eventId: CircuitEventId) => void;
  onBack: () => void;
  onStats: () => void;
  onResults: () => void;
  onOpenTeam: (team: FieldTeam) => void;
  onOpenPlayer: (player: Player, team: FieldTeam) => void;
  onOpenSeries: (id: string) => void;
}) {
  const hasPlayoffs = manager?.stage?.hasPlayoffs ?? manager?.event.hasPlayoffs ?? circuit?.event.hasPlayoffs ?? true;
  const reviewingPastStage = Boolean(circuit && circuit.event.id !== circuit.currentEvent.id);
  const showCurrentCircuitRank = Boolean(circuit && !reviewingPastStage);
  const managerVrsByTeamId = new Map(manager?.vrsStandings.map((standing) => [standing.team.id, standing]) ?? []);
  const worldRankFor = (team: FieldTeam) => {
    if (manager) return managerVrsByTeamId.get(team.id)?.rank;
    return team.id === "user" && showCurrentCircuitRank && circuit
      ? circuitWorldRank(circuit.points, builtInHltvRosters)
      : currentVrsRank(team);
  };
  const vrsPointsFor = (team: FieldTeam) => {
    if (manager) return managerVrsByTeamId.get(team.id)?.points;
    return team.id === "user" && showCurrentCircuitRank && circuit ? circuit.points : currentVrsPoints(team);
  };
  const finalResult = [...results].reverse().find((result) => result.stage === "final");
  const championId = winner?.id ?? finalResult?.winnerId;
  const prizeForTier = (tier: PlacementTier) => {
    if (manager?.event.majorCycle && manager.stage?.id !== "stage-3") return 0;
    if (manager) return manager.event.prizes[tier];
    return circuit ? circuit.event.prizes[tier] : prizeForPlacement(tier);
  };
  const advanceTarget = manager?.stage && !hasPlayoffs
    ? nextCircuitEvent(manager.stage).shortName
    : circuit && !hasPlayoffs
      ? nextCircuitEvent(circuit.event).shortName
      : undefined;
  const placements = buildEventPlacements(teams, records, results, hasPlayoffs, prizeForTier, advanceTarget, worldRankFor);
  const placementGroups = groupEventPlacements(placements);
  const placementByTeam = new Map(placements.map((entry) => [entry.team.id, entry]));
  const playerLeaders = useMemo(() => buildOverviewPlayerLeaders(results, championId), [championId, results]);
  const vrsRows = teams
    .map((team) => ({
      team,
      record: records[team.id] ?? { wins: 0, losses: 0 },
      power: teamStrength(team, settings),
      worldRank: worldRankFor(team),
      points: vrsPointsFor(team),
    }))
    .sort((a, b) => (a.worldRank ?? 999) - (b.worldRank ?? 999) || b.power - a.power);
  const mapUsage = useMemo(() => {
    const usage = new Map<MapId, number>(mapPool.map((map) => [map.id, 0]));
    results.forEach((result) => result.maps.forEach((map) => usage.set(map.map, (usage.get(map.map) ?? 0) + 1)));
    return usage;
  }, [results]);
  const mapsPlayed = results.reduce((sum, result) => sum + result.maps.length, 0);
  const swissResolved = teams.every((team) => {
    const teamRecord = records[team.id] ?? { wins: 0, losses: 0 };
    return teamRecord.wins >= 3 || teamRecord.losses >= 3;
  });
  const eventStatus = outcome === "champion" || outcome === "complete"
    ? "Finished"
    : phase === "playoffs" && hasPlayoffs
      ? `${playoffRoundLabel(currentRound)} live`
      : swissResolved
        ? "Stage complete"
        : manager?.stage
          ? `${manager.stage.shortName} live`
          : manager?.event.format === "round-robin"
            ? "League live"
            : "Swiss live";
  const prizePool = manager?.event.prizePool ?? overviewPrizePool(prizeForTier);
  const prizeLabel = manager?.event.majorCycle ? "Overall Major purse" : "Prize pool";
  const stakesLabel = manager?.stage
    ? managerMajorStageStakes(manager.stage.id)
    : manager?.event.stakesLabel;
  const formatLabel = manager?.stage
    ? "16-team Swiss"
    : manager?.event.formatLabel;
  const eventDescription = manager?.stage
    ? `${manager.stage.description} ${manager.event.description}`
    : manager?.event.description ?? circuit?.event.description ?? "Sixteen teams, one Swiss field, and a single-elimination championship bracket.";
  const primaryFormatLabel = manager?.event.format === "round-robin" && !manager.stage
    ? "Round robin"
    : manager?.event.format === "single-elimination" && !manager.stage
      ? "Knockout"
      : "Swiss";
  const primaryFormatDetail = manager?.event.format === "round-robin" && !manager.stage
    ? `Every team plays once / BO${manager.event.groupBestOf}`
    : manager?.event.format === "single-elimination" && !manager.stage
      ? `Single elimination / opening round BO${manager.event.groupBestOf} / later rounds BO3`
      : "Opening matches BO1 / progression and elimination matches BO3";

  return (
    <main className="layout fullscreen-page event-overview-page">
      <section className="event-overview-hero">
        <div className="event-overview-titlebar">
          <div>
            <span className="event-kicker">{manager ? `Manager season ${circuit?.season ?? 1} / ${manager.stage?.shortName ?? manager.event.tier}` : circuit ? `Season ${circuit.season} / ${reviewingPastStage ? "Stage archive" : "Major circuit"}` : "Tournament hub"}</span>
            <h1>{name}</h1>
            <p>{eventDescription}</p>
          </div>
          <button className="secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Back to run
          </button>
        </div>
        <div className="event-overview-facts">
          <span><small>Status</small><b className={eventStatus.endsWith("live") ? "live" : "finished"}>{eventStatus}</b></span>
          <span><small>{prizeLabel}</small><b>{fmtMoney(prizePool)}</b></span>
          {stakesLabel && <span className="event-overview-stakes"><small>Stakes</small><b>{stakesLabel}</b></span>}
          <span><small>Teams</small><b>{teams.length}</b></span>
          <span><small>Played</small><b>{results.length} series / {mapsPlayed} maps</b></span>
          <span><small>Format</small><b>{formatLabel ?? (circuit ? circuitFieldLabel(circuit.event) : "Swiss / playoffs")}</b></span>
        </div>
        <div className="event-overview-tabs">
          <button className="active" type="button"><LayoutDashboard size={15} /> Overview</button>
          <button type="button" onClick={onResults} disabled={!results.length}><Database size={15} /> Results</button>
          <button type="button" onClick={onStats} disabled={!results.length}><Target size={15} /> Stats</button>
        </div>
      </section>

      {circuit && <EventStageRoute circuit={circuit} onSelect={onSelectCircuitEvent} />}

      <div className="overview-feature-grid">
        <section className="overview-section placement-overview">
          <div className="overview-section-head">
            <div>
              <span>{outcome === "complete" || outcome === "champion" ? "Final standings" : "Live event"}</span>
              <h2>Placement picture</h2>
            </div>
            <small>Teams are grouped by their final or current placement</small>
          </div>
          <div className="overview-placement-board">
            {placementGroups.map((group) => (
              <div className={`overview-placement-group ${group.tone}`} key={group.label}>
                <div className="overview-placement-rank">
                  <strong>{group.label}</strong>
                  <span>{group.detail}</span>
                  {group.prize != null && <small>{fmtMoney(group.prize)} per team</small>}
                </div>
                <div className="overview-placement-teams">
                  {group.entries.map((entry) => (
                    <button type="button" key={entry.team.id} onClick={() => onOpenTeam(entry.team)}>
                      <TeamLogo team={entry.team} />
                      <span>
                        <b>{entry.team.name}</b>
                        <small>{entry.record.wins}-{entry.record.losses} record</small>
                      </span>
                      <em>{entry.detail}</em>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <OverviewMvpRace leaders={playerLeaders} onOpenPlayer={onOpenPlayer} />
      </div>

      {hasPlayoffs && (
        <PlayoffBracket
          currentRound={currentRound}
          pairs={playoffPairs}
          results={results}
          onOpenResult={onOpenSeries}
          quarterfinalBestOf={manager?.event.format === "single-elimination" && !manager.stage
            ? manager.event.groupBestOf
            : 3}
        />
      )}

      <section className="overview-section event-teams-section">
        <div className="overview-section-head">
          <div>
            <span>Field</span>
            <h2>Teams attended</h2>
          </div>
          <small>Open any team for its stage-separated match and player history</small>
        </div>
        <div className="event-team-grid">
          {teams
            .slice()
            .sort((a, b) => {
              const rankA = worldRankFor(a) ?? 999;
              const rankB = worldRankFor(b) ?? 999;
              return rankA - rankB;
            })
            .map((team) => {
              const entry = placementByTeam.get(team.id);
              const teamRecord = records[team.id] ?? { wins: 0, losses: 0 };
              const worldRank = worldRankFor(team);
              return (
                <button type="button" className="event-team-card" key={team.id} onClick={() => onOpenTeam(team)}>
                  <span className="event-team-rank">{worldRank ? `#${worldRank}` : "Custom"}</span>
                  <TeamLogo team={team} />
                  <strong>{team.name}</strong>
                  <small>{teamRecord.wins}-{teamRecord.losses} / {entry?.label ?? "Live"}</small>
                </button>
              );
            })}
        </div>
      </section>

      <div className="overview-data-grid">
        <section className="overview-section overview-ranking">
          <div className="overview-section-head">
            <div>
              <span>Global ranking</span>
              <h2>VRS ranking</h2>
            </div>
            <small>{manager ? "Current 2026 opponent field; a selected historic club remains user-controlled" : "One mixed-era points table; your team uses its live circuit total"}</small>
          </div>
          <div className="overview-power-head">
            <span>#</span><span>Team</span><span>Points</span><span>Swiss</span><span>Paper</span><span>Placement</span>
          </div>
          <div className="overview-power-list">
            {vrsRows.map((row) => (
              <button type="button" className="overview-power-row" key={row.team.id} onClick={() => onOpenTeam(row.team)}>
                <span>{row.worldRank ? `#${row.worldRank}` : "-"}</span>
                <span className="overview-power-team"><TeamLogo team={row.team} small /><b>{row.team.name}</b></span>
                <span>{row.points != null ? row.points.toLocaleString() : "-"}</span>
                <span>{row.record.wins}-{row.record.losses}</span>
                <strong>{row.power.toFixed(1)}</strong>
                <span>{placementByTeam.get(row.team.id)?.label ?? "Live"}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="overview-side-data">
          <section className="overview-section event-format-panel">
            <div className="overview-section-head">
              <div><span>Rules</span><h2>Format</h2></div>
            </div>
            <div className="event-format-row">
              <b>{primaryFormatLabel}</b>
              <span>{primaryFormatDetail}</span>
            </div>
            <div className="event-format-row">
              <b>{manager && !manager.stage ? "Stakes" : hasPlayoffs ? "Playoffs" : "Advance"}</b>
              <span>{manager && !manager.stage ? manager.event.stakesLabel : hasPlayoffs ? "Single elimination / QF and SF BO3 / Final BO5" : manager?.stage ? managerMajorStageStakes(manager.stage.id) : circuit ? circuitQualificationLabel(circuit.event) : "Top eight advance"}</span>
            </div>
          </section>

          <section className="overview-section event-map-pool">
            <div className="overview-section-head">
              <div><span>Active duty</span><h2>Map pool</h2></div>
              <small>{mapsPlayed} maps played</small>
            </div>
            <div className="overview-map-list">
              {mapPool.map((map) => {
                const played = mapUsage.get(map.id) ?? 0;
                const art = mapArtImages[map.id];
                return (
                  <div
                    className="overview-map-row"
                    key={map.id}
                    style={{
                      "--map": map.accent,
                      backgroundImage: art ? `linear-gradient(90deg, rgba(11, 15, 20, .15), rgba(11, 15, 20, .88)), url(${art})` : undefined,
                    } as React.CSSProperties}
                  >
                    <b>{map.name}</b>
                    <span>{played} played</span>
                    <em>{mapsPlayed ? `${Math.round((played / mapsPlayed) * 100)}%` : "-"}</em>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function EventStageRoute({ circuit, onSelect }: { circuit: EventOverviewCircuit; onSelect: (eventId: CircuitEventId) => void }) {
  const currentIndex = circuitEventIndex(circuit.currentEvent.id);
  const available = new Set(circuit.availableEventIds);
  return (
    <section className="event-stage-route" aria-label="Major stages">
      {circuitEvents.map((event, index) => {
        const current = event.id === circuit.currentEvent.id;
        const viewing = event.id === circuit.event.id;
        const reviewable = available.has(event.id);
        const done = reviewable && !current && index < currentIndex;
        return (
          <button
            type="button"
            className={`event-stage-step ${current ? "active" : done ? "done" : "upcoming"}${viewing ? " viewing" : ""}`}
            key={event.id}
            disabled={!reviewable}
            aria-pressed={viewing}
            onClick={() => onSelect(event.id)}
            title={reviewable ? `View ${event.name}` : `${event.name} has not started`}
          >
            <span>{index + 1}</span>
            <b>{event.shortName}</b>
            <small>{viewing ? "Viewing" : current ? "Live" : done ? "Review" : "Upcoming"}</small>
          </button>
        );
      })}
      <div className="event-stage-rank">
        <small>Current world rank</small>
        <b>#{circuit.worldRank ?? circuitWorldRank(circuit.points, builtInHltvRosters)}</b>
        <span>{circuit.points} points</span>
      </div>
    </section>
  );
}

function OverviewMvpRace({
  leaders,
  onOpenPlayer,
}: {
  leaders: { mvp?: PlayerDatabaseRow; evps: PlayerDatabaseRow[] };
  onOpenPlayer: (player: Player, team: FieldTeam) => void;
}) {
  const { mvp, evps } = leaders;
  return (
    <section className="overview-section overview-mvp-race">
      <div className="overview-section-head">
        <div><span>Player awards</span><h2>{mvp ? "MVP race" : "MVP watch"}</h2></div>
        <small>Minimum map sample applied</small>
      </div>
      {mvp ? (
        <>
          <button type="button" className="overview-mvp-lead" onClick={() => onOpenPlayer(mvp.player, mvp.team)}>
            {playerPhoto(mvp.player.handle) ? (
              <img src={playerPhoto(mvp.player.handle)} alt={mvp.player.handle} />
            ) : (
              <Avatar label={mvp.player.handle} accent={mvp.team.accent} />
            )}
            <span>
              <small>Current leader</small>
              <strong><Flag country={mvp.player.country} /> {mvp.player.handle}</strong>
              <em>{mvp.team.name} / {mvp.matches} maps</em>
            </span>
            <b className={`rating-number ${ratingTone(mvp.line.rating)}`}>{mvp.line.rating.toFixed(2)}</b>
            <div>
              <span><small>K-D</small><b>{mvp.line.kills}-{mvp.line.deaths}</b></span>
              <span><small>ADR</small><b>{mvp.line.adr.toFixed(1)}</b></span>
              <span><small>KAST</small><b>{mvp.line.rounds ? `${((mvp.line.kastRounds / mvp.line.rounds) * 100).toFixed(1)}%` : "-"}</b></span>
            </div>
          </button>
          <div className="overview-evp-list">
            {evps.map((row, index) => (
              <button type="button" key={row.databaseKey} onClick={() => onOpenPlayer(row.player, row.team)}>
                <span>{index + 2}</span>
                <TeamLogo team={row.team} small />
                <b>{row.player.handle}</b>
                <small>{row.team.tag} / {row.matches} maps</small>
                <strong className={`rating-number ${ratingTone(row.line.rating)}`}>{row.line.rating.toFixed(2)}</strong>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="overview-empty-state">Player leaders appear after the first completed series.</div>
      )}
    </section>
  );
}

function buildOverviewPlayerLeaders(results: SwissResult[], championId?: string) {
  const rows = buildPlayerDatabase(results).filter((row) => row.matches > 0);
  if (!rows.length) return { mvp: undefined, evps: [] as PlayerDatabaseRow[] };
  const maxMaps = Math.max(...rows.map((row) => row.matches));
  const minMaps = Math.max(1, Math.ceil(maxMaps * 0.45));
  const eligible = rows.filter((row) => row.matches >= minMaps);
  const championRows = championId ? eligible.filter((row) => row.team.id === championId) : [];
  const mvp = (championRows.length ? championRows : eligible)[0] ?? rows[0];
  const evps = eligible.filter((row) => row.databaseKey !== mvp.databaseKey).slice(0, 4);
  return { mvp, evps };
}

function buildEventPlacements(
  teams: FieldTeam[],
  records: Record<string, SwissRecord>,
  results: SwissResult[],
  hasPlayoffs: boolean,
  prizeForTier: (tier: PlacementTier) => number,
  advanceTarget?: string,
  worldRankFor: (team: FieldTeam) => number | undefined = currentVrsRank,
): EventPlacementRow[] {
  const playoffLoser = (stage: PlayoffRound, teamId: string) =>
    results.some((result) => result.stage === stage && result.winnerId !== teamId && (result.left.id === teamId || result.right.id === teamId));
  const final = [...results].reverse().find((result) => result.stage === "final");

  return teams
    .map((team): EventPlacementRow => {
      const teamRecord = records[team.id] ?? { wins: 0, losses: 0 };
      if (final?.winnerId === team.id) {
        return { team, record: teamRecord, label: "1st", detail: "Champion", prize: prizeForTier("champion"), order: 1, tone: "champion" };
      }
      if (playoffLoser("final", team.id)) {
        return { team, record: teamRecord, label: "2nd", detail: "Runner-up", prize: prizeForTier("runner-up"), order: 2, tone: "podium" };
      }
      if (playoffLoser("semifinal", team.id)) {
        return { team, record: teamRecord, label: "3-4th", detail: "Semifinal", prize: prizeForTier("top4"), order: 3, tone: "podium" };
      }
      if (playoffLoser("quarterfinal", team.id)) {
        return { team, record: teamRecord, label: "5-8th", detail: "Quarterfinal", prize: prizeForTier("top8"), order: 5, tone: "qualified" };
      }
      if (teamRecord.losses >= 3) {
        const label = teamRecord.wins >= 2 ? "9-11th" : teamRecord.wins === 1 ? "12-14th" : "15-16th";
        const order = teamRecord.wins >= 2 ? 9 : teamRecord.wins === 1 ? 12 : 15;
        return { team, record: teamRecord, label, detail: "Eliminated", prize: prizeForTier("swiss"), order, tone: "eliminated" };
      }
      if (teamRecord.wins >= 3) {
        const label = hasPlayoffs
          ? "Playoffs"
          : teamRecord.losses === 0
            ? "1-2nd"
            : teamRecord.losses === 1
              ? "3-5th"
              : "6-8th";
        const order = hasPlayoffs ? 8 : teamRecord.losses === 0 ? 1 : teamRecord.losses === 1 ? 3 : 6;
        return {
          team,
          record: teamRecord,
          label,
          detail: hasPlayoffs ? "Playoff berth" : `Advanced to ${advanceTarget ?? "next stage"}`,
          prize: hasPlayoffs ? undefined : prizeForTier("top8"),
          order,
          tone: "qualified",
        };
      }
      return { team, record: teamRecord, label: "Live", detail: "In contention", order: 8, tone: "live" };
    })
    .sort((a, b) => a.order - b.order || (worldRankFor(a.team) ?? 999) - (worldRankFor(b.team) ?? 999) || a.team.name.localeCompare(b.team.name));
}

function groupEventPlacements(placements: EventPlacementRow[]) {
  const groups = new Map<string, { label: string; detail: string; prize?: number; tone: EventPlacementRow["tone"]; entries: EventPlacementRow[] }>();
  placements.forEach((entry) => {
    const current = groups.get(entry.label);
    if (current) current.entries.push(entry);
    else groups.set(entry.label, {
      label: entry.label,
      detail: entry.detail,
      prize: entry.prize,
      tone: entry.tone,
      entries: [entry],
    });
  });
  return [...groups.values()];
}

function overviewPrizePool(prizeForTier: (tier: PlacementTier) => number) {
  return (
    prizeForTier("champion") +
    prizeForTier("runner-up") +
    prizeForTier("top4") * 2 +
    prizeForTier("top8") * 4 +
    prizeForTier("swiss") * 8
  );
}

function TransferCandidateCard({
  candidate,
  roster,
  money,
  locked,
  onTrade,
}: {
  candidate: { player: Player; team: Roster };
  roster: Player[];
  money: number;
  locked: boolean;
  onTrade: (incoming: Player, outgoing: Player) => void;
}) {
  const sameRole = roster.filter((player) => player.role === candidate.player.role).sort((a, b) => playerValue(b) - playerValue(a));
  const [outId, setOutId] = useState(sameRole[0]?.id ?? "");
  const outgoing = sameRole.find((player) => player.id === outId) ?? sameRole[0];
  const delta = outgoing ? transferDelta(candidate.player, outgoing) : 0;
  const affordable = delta <= money;
  const photo = playerPhoto(candidate.player.handle);

  return (
    <div className="candidate-card" style={{ "--crest": candidate.team.accent } as React.CSSProperties}>
      <div className="candidate-head">
        {photo && <img className="candidate-face" src={photo} alt={candidate.player.handle} loading="lazy" />}
        <div className="candidate-id">
          <strong>
            <Flag country={candidate.player.country} /> {candidate.player.handle}
          </strong>
          <span>
            {candidate.team.tag} · {candidate.player.role} · OVR {candidate.player.ovr}
            {candidate.player.age != null ? ` · Age ${candidate.player.age}` : ""}
          </span>
        </div>
        <span className="candidate-value">{fmtMoney(playerValue(candidate.player))}</span>
      </div>
      <div className="candidate-trade">
        {sameRole.length > 1 ? (
          <select className="candidate-out" value={outId} onChange={(event) => setOutId(event.target.value)} aria-label="Player to send">
            {sameRole.map((player) => (
              <option key={player.id} value={player.id}>
                Send {player.handle} ({player.ovr})
              </option>
            ))}
          </select>
        ) : (
          <span className="candidate-out-label">Send {outgoing?.handle ?? "—"}</span>
        )}
        <span className={`candidate-cost ${delta > 0 ? "pay" : delta < 0 ? "gain" : ""}`}>
          {delta > 0 ? `Pay ${fmtMoney(delta)}` : delta < 0 ? `Gain ${fmtMoney(-delta)}` : "Even swap"}
        </span>
        <button className="primary" disabled={locked || !affordable || !outgoing} onClick={() => outgoing && onTrade(candidate.player, outgoing)}>
          <ArrowLeftRight size={14} />
          Trade
        </button>
      </div>
      {!affordable && !locked && <small className="candidate-warn">Not enough money</small>}
    </div>
  );
}

function TransferWindow({
  eventNumber,
  lastResult,
  money,
  roster,
  candidates,
  trade,
  development,
  circuit,
  onTrade,
  onUndo,
  onStart,
}: {
  eventNumber: number;
  lastResult?: CareerHistoryEntry;
  money: number;
  roster: Player[];
  candidates: Array<{ player: Player; team: Roster }>;
  trade: { incoming: Player; outgoing: Player; delta: number } | null;
  development: Array<{ handle: string; before: number; after: number; iglDelta: number }>;
  circuit?: { event: CircuitEvent; season: number; points: number; history: CareerHistoryEntry[] };
  onTrade: (incoming: Player, outgoing: Player) => void;
  onUndo: () => void;
  onStart: () => void;
}) {
  const moves = development.filter((row) => row.after !== row.before || row.iglDelta !== 0);
  return (
    <main className="layout fullscreen-page transfer-page">
      <section className="fullscreen-head">
        <div>
          <div className="section-title">
            <ArrowLeftRight size={18} />
            <span>{circuit ? "Circuit HQ" : "Transfer window"}</span>
          </div>
          <h1>After {lastResult?.eventName ?? `Major ${eventNumber}`}</h1>
          {lastResult && (
            <p>
              Finished <b>{placementLabel(lastResult.tier, lastResult.record)}</b> · earned <b>{fmtMoney(lastResult.prize)}</b>
              {lastResult.points != null && <> · <b>+{lastResult.points} ranking points</b></>}
              {circuit && <> · <b>{lastResult.qualified ? "qualified" : `re-entering ${circuit.event.name}`}</b></>}
            </p>
          )}
        </div>
        <div className="transfer-bank">
          <Coins size={18} />
          {fmtMoney(money)}
        </div>
      </section>

      {circuit && <CircuitProgressStrip event={circuit.event} season={circuit.season} points={circuit.points} history={circuit.history} />}

      {circuit && circuit.history.length > 0 && (
        <section className="circuit-ledger">
          <div className="section-title">
            <TrendingUp size={17} />
            <span>Recent circuit results</span>
          </div>
          <div className="circuit-ledger-rows">
            {circuit.history.slice(-5).reverse().map((entry) => (
              <div className="circuit-ledger-row" key={`${entry.event}-${entry.eventId ?? "major"}`}>
                <span>S{entry.season ?? 1}</span>
                <strong>{entry.eventName ?? `Major ${entry.event}`}</strong>
                <b>{placementLabel(entry.tier, entry.record)}</b>
                <em>+{entry.points ?? 0} pts</em>
                <small>{fmtMoney(entry.prize)}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {moves.length > 0 && (
        <section className="transfer-card development-card">
          <div className="section-title">
            <TrendingUp size={18} />
            <span>Development</span>
          </div>
          <div className="dev-rows">
            {moves.map((row) => {
              const up = row.after > row.before;
              return (
                <div className="dev-row" key={row.handle}>
                  <strong>{row.handle}</strong>
                  {row.after !== row.before ? (
                    <span className={up ? "good" : "bad"}>
                      {row.before} → {row.after} {up ? "▲" : "▼"}
                    </span>
                  ) : (
                    <span className="good">IGL +{row.iglDelta}</span>
                  )}
                  {row.iglDelta > 0 && row.after !== row.before && <small>IGL +{row.iglDelta}</small>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="transfer-grid">
        <section className="transfer-card">
          <div className="section-title">
            <Users size={18} />
            <span>Your roster</span>
          </div>
          <div className="transfer-roster">
            {roster.map((player) => (
              <div className="transfer-roster-row" key={player.id}>
                <Flag country={player.country} />
                <strong>{player.handle}</strong>
                <span className="tr-role">{player.role}</span>
                <span className="tr-meta">{player.age ? `age ${player.age}` : ""}</span>
                <span className="tr-ovr">
                  {player.ovr}
                  {player.potential != null && player.potential > player.ovr && <em> / {player.potential}</em>}
                </span>
                <span className="tr-value">{fmtMoney(playerValue(player))}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="transfer-card">
          <div className="vault-card-head">
            <div className="section-title">
              <ArrowLeftRight size={18} />
              <span>Market</span>
            </div>
            <span className="vault-count">one trade per event</span>
          </div>
          {trade && (
            <div className="transfer-done">
              <span>
                Sent <b>{trade.outgoing.handle}</b> → signed <b className="good">{trade.incoming.handle}</b> for{" "}
                <b>{trade.delta > 0 ? fmtMoney(trade.delta) : trade.delta < 0 ? `+${fmtMoney(-trade.delta)}` : "free"}</b>
              </span>
              <button className="secondary" onClick={onUndo}>
                Undo
              </button>
            </div>
          )}
          <div className="transfer-candidates">
            {candidates.map((candidate) => (
              <TransferCandidateCard key={candidate.player.id} candidate={candidate} roster={roster} money={money} locked={Boolean(trade)} onTrade={onTrade} />
            ))}
          </div>
        </section>
      </div>

      <div className="transfer-foot">
        <button className="primary" onClick={onStart}>
          <ArrowRight size={17} />
          Start {circuit ? circuit.event.name : `Major ${eventNumber + 1}`}
        </button>
      </div>
    </main>
  );
}

// ---- Player comparison ---------------------------------------------------------------------------

interface CompareEntry {
  player: Player;
  team: Roster;
}

const RADAR_AXES: Array<{ key: keyof PlayerStats; label: string }> = [
  { key: "aim", label: "AIM" },
  { key: "awp", label: "AWP" },
  { key: "clutch", label: "CLUTCH" },
  { key: "consistency", label: "CONSIST" },
  { key: "igl", label: "IGL" },
];

// A 5-axis radar of the two players' attributes, overlaid in their team accents.
function StatRadar({ a, b }: { a: { stats: PlayerStats; accent: string }; b: { stats: PlayerStats; accent: string } }) {
  const cx = 50;
  const cy = 52;
  const R = 33;
  const N = RADAR_AXES.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const norm = (v: number) => Math.max(0, Math.min(1, (v - 40) / 59)); // 40..99 -> 0..1
  const pt = (i: number, f: number) => [cx + R * f * Math.cos(ang(i)), cy + R * f * Math.sin(ang(i))] as const;
  const poly = (stats: PlayerStats) => RADAR_AXES.map((axis, i) => pt(i, norm(stats[axis.key])).map((n) => n.toFixed(2)).join(",")).join(" ");
  const ring = (f: number) => RADAR_AXES.map((_, i) => pt(i, f).map((n) => n.toFixed(2)).join(",")).join(" ");

  return (
    <svg viewBox="0 0 100 100" className="stat-radar" role="img" aria-label="Attribute radar">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} className="radar-grid" />
      ))}
      {RADAR_AXES.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x.toFixed(2)} y2={y.toFixed(2)} className="radar-axis" />;
      })}
      <polygon points={poly(b.stats)} className="radar-poly" style={{ "--c": b.accent } as React.CSSProperties} />
      <polygon points={poly(a.stats)} className="radar-poly" style={{ "--c": a.accent } as React.CSSProperties} />
      {RADAR_AXES.map((axis, i) => {
        const [x, y] = pt(i, 1.2);
        return (
          <text key={axis.key} x={x.toFixed(2)} y={y.toFixed(2)} className="radar-label">
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

function ComparePicker({ value, pool, onChange }: { value: string; pool: CompareEntry[]; onChange: (id: string) => void }) {
  const groups = new Map<string, CompareEntry[]>();
  pool.forEach((entry) => {
    const list = groups.get(entry.team.id) ?? [];
    list.push(entry);
    groups.set(entry.team.id, list);
  });
  return (
    <select className="compare-select" value={value} onChange={(event) => onChange(event.target.value)} aria-label="Pick a player">
      {[...groups.values()].map((group) => (
        <optgroup key={group[0].team.id} label={group[0].team.name}>
          {group.map((entry) => (
            <option key={entry.player.id} value={entry.player.id}>
              {entry.player.handle} ({entry.player.ovr})
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function ComparePage({ pool, initialAId, onBack }: { pool: CompareEntry[]; initialAId: string | null; onBack: () => void }) {
  const fallbackA = initialAId ?? pool[0]?.player.id ?? "";
  const [aId, setAId] = useState(fallbackA);
  const [bId, setBId] = useState(() => pool.find((entry) => entry.player.id !== fallbackA)?.player.id ?? fallbackA);
  useEffect(() => {
    if (initialAId) setAId(initialAId);
  }, [initialAId]);

  const db = useMemo(() => getMatchDb(), []);
  const a = pool.find((entry) => entry.player.id === aId) ?? pool[0];
  const b = pool.find((entry) => entry.player.id === bId) ?? pool[0];
  const aCareer = a ? db.playerCareer(playerVersionKey(a.player)) : undefined;
  const bCareer = b ? db.playerCareer(playerVersionKey(b.player)) : undefined;

  if (!a || !b) {
    return (
      <main className="layout fullscreen-page">
        <section className="fullscreen-head">
          <div>
            <div className="section-title">
              <Users size={18} />
              <span>Compare</span>
            </div>
            <h1>No players to compare</h1>
          </div>
          <button className="secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
        </section>
      </main>
    );
  }

  const statRows: Array<{ label: string; a: number; b: number; dp?: number }> = [
    { label: "Overall", a: a.player.ovr, b: b.player.ovr },
    ...RADAR_AXES.map((axis) => ({ label: axis.label.charAt(0) + axis.label.slice(1).toLowerCase(), a: a.player.stats[axis.key], b: b.player.stats[axis.key] })),
  ];
  const careerRows: Array<{ label: string; a: number; b: number; dp?: number }> =
    aCareer && bCareer
      ? [
          { label: "Vault rating", a: aCareer.line.rating, b: bCareer.line.rating, dp: 2 },
          { label: "K–D diff", a: aCareer.line.kills - aCareer.line.deaths, b: bCareer.line.kills - bCareer.line.deaths },
          { label: "ADR", a: aCareer.line.adr, b: bCareer.line.adr, dp: 0 },
          { label: "Maps", a: aCareer.matches, b: bCareer.matches },
        ]
      : [];
  const fmt = (value: number, dp = 0) => value.toFixed(dp);
  const aPhoto = playerPhoto(a.player.handle);
  const bPhoto = playerPhoto(b.player.handle);

  const head = (entry: CompareEntry, photo: string | undefined, onChange: (id: string) => void, value: string) => (
    <div className="compare-slot" style={{ "--crest": entry.team.accent } as React.CSSProperties}>
      {photo && <img className="compare-face" src={photo} alt={entry.player.handle} loading="lazy" />}
      <div className="compare-id">
        <strong>
          <Flag country={entry.player.country} /> {entry.player.handle}
        </strong>
        <span>
          {entry.team.tag} · {entry.player.role} · OVR {entry.player.ovr}
        </span>
      </div>
      <ComparePicker value={value} pool={pool} onChange={onChange} />
    </div>
  );

  return (
    <main className="layout fullscreen-page compare-page">
      <section className="fullscreen-head">
        <div>
          <div className="section-title">
            <Users size={18} />
            <span>Compare players</span>
          </div>
          <h1>
            {a.player.handle} <em>vs</em> {b.player.handle}
          </h1>
        </div>
        <button className="secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
      </section>

      <div className="compare-heads">
        {head(a, aPhoto, setAId, aId)}
        {head(b, bPhoto, setBId, bId)}
      </div>

      <section className="compare-card">
        <div className="section-title">
          <Target size={18} />
          <span>Attributes</span>
        </div>
        <StatRadar a={{ stats: a.player.stats, accent: a.team.accent }} b={{ stats: b.player.stats, accent: b.team.accent }} />
        <div className="radar-legend">
          <span style={{ color: a.team.accent }}>● {a.player.handle}</span>
          <span style={{ color: b.team.accent }}>● {b.player.handle}</span>
        </div>
      </section>

      <section className="compare-card">
        <div className="section-title">
          <Award size={18} />
          <span>Numbers{careerRows.length ? "" : " · play both to unlock Vault stats"}</span>
        </div>
        <table className="compare-table">
          <tbody>
            {[...statRows, ...careerRows].map((row) => (
              <tr key={row.label}>
                <td className={row.a > row.b ? "win" : ""}>{fmt(row.a, row.dp)}</td>
                <th>{row.label}</th>
                <td className={row.b > row.a ? "win" : ""}>{fmt(row.b, row.dp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="compare-card">
        <div className="section-title">
          <Gauge size={18} />
          <span>Map strengths</span>
        </div>
        <table className="compare-table">
          <tbody>
            {mapPool.map((map) => {
              const av = a.player.maps[map.id] ?? 0;
              const bv = b.player.maps[map.id] ?? 0;
              return (
                <tr key={map.id}>
                  <td className={av > bv ? "win" : ""}>{av}</td>
                  <th>{map.name}</th>
                  <td className={bv > av ? "win" : ""}>{bv}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function PlayerDetailPage({
  player,
  team,
  results,
  onBack,
  onOpenSeries,
  onOpenTeam,
  onCompare,
  managerCareer,
}: {
  player: Player;
  team: FieldTeam;
  results: SwissResult[];
  onBack: () => void;
  onOpenSeries: (id: string) => void;
  onOpenTeam: (team: FieldTeam) => void;
  onCompare?: (player: Player) => void;
  managerCareer?: ManagerCareerState;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "rivals" | "manager">("overview");
  useEffect(() => setActiveTab("overview"), [player.id]);
  const managerContract = managerCareer?.contracts.find((contract) => contract.playerId === player.id && contract.status !== "expired");
  const managerDynamics = managerCareer ? managerPlayerDynamics(managerCareer, player.id) : undefined;
  const managerScouting = managerCareer ? managerScoutingRange(player) : undefined;
  const managerScouted = Boolean(managerCareer?.market.scoutedPlayerIds.includes(player.id) || managerContract);
  const managerTrade = managerCareer ? [...managerCareer.market.tradeOffers].reverse().find((offer) => offer.incoming.id === player.id) : undefined;
  const roleCount = managerCareer?.contracts.filter((contract) => contract.status !== "expired" && contract.playerRole === player.role).length ?? 0;
  const managerRosterFit = managerContract ? "Current squad member" : roleCount === 0 ? `Fills the ${player.role} gap` : roleCount === 1 ? `Competes for the ${player.role} role` : `${player.role} role is crowded`;

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
  const stageGroups = buildPlayerStageGroups(maps);
  const displayStageGroups = [...stageGroups].reverse();
  const photo = playerPhoto(player.handle);
  const career = useMemo(() => buildPlayerCareer(results, playerVersionKey(player)), [results, player]);
  const vault = useMemo(() => {
    const db = getMatchDb();
    const versionKey = playerVersionKey(player);
    return {
      career: db.playerCareer(versionKey),
      extremes: db.playerRatingExtremes(versionKey),
      matchups: db.playerOpponentRecords(versionKey),
    };
  }, [player]);

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
              {player.realName} / {player.role}
              {player.age != null ? ` / Age ${player.age}` : ""} /{" "}
              <button type="button" className="inline-link" onClick={() => onOpenTeam(team)}>
                {team.name}
              </button>{" "}
              — {total} {total === 1 ? "map" : "maps"} across {stageGroups.length} {stageGroups.length === 1 ? "stage" : "stages"}
            </p>
          </div>
        </div>
        <div className="fullscreen-actions">
          {onCompare && (
            <button className="secondary" onClick={() => onCompare(player)}>
              <Users size={16} />
              Compare
            </button>
          )}
          <button className="secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </section>

      <nav className="player-detail-tabs" role="tablist" aria-label={`${player.handle} statistics`}>
        <button type="button" role="tab" aria-selected={activeTab === "overview"} className={activeTab === "overview" ? "active" : ""} onClick={() => setActiveTab("overview")}>
          <Gauge size={16} /> Overview
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "history"} className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>
          <Database size={16} /> Stage history <span>{stageGroups.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "rivals"} className={activeTab === "rivals" ? "active" : ""} onClick={() => setActiveTab("rivals")}>
          <Swords size={16} /> Rivals <span>{vault.matchups.length}</span>
        </button>
        {managerCareer && (
          <button type="button" role="tab" aria-selected={activeTab === "manager"} className={activeTab === "manager" ? "active" : ""} onClick={() => setActiveTab("manager")}>
            <BriefcaseBusiness size={16} /> Manager
          </button>
        )}
      </nav>

      {activeTab === "overview" && (
        <div className="player-tab-panel" role="tabpanel">
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

          {maps.length >= 2 && (
            <section className="form-panel">
              <div className="section-title">
                <TrendingUp size={18} />
                <span>Form — rating per map</span>
              </div>
              <FormChart
                ratings={maps.map((m) => m.line.rating)}
                segments={stageGroups.map((group) => ({ label: group.shortName, count: group.maps.length }))}
              />
            </section>
          )}

          <PlayerCareerPanel player={player} career={career} activeTeam={team} onOpenTeam={onOpenTeam} />
          <PlayerVaultLine vault={vault.career} extremes={vault.extremes} />
        </div>
      )}

      {activeTab === "history" && (
        <div className="player-tab-panel" role="tabpanel">
          {maps.length ? (
            <section className="player-history-block">
              <div className="player-history-head">
                <div className="section-title">
                  <Database size={18} />
                  <span>Stage history</span>
                </div>
                <span>{stageGroups.length} {stageGroups.length === 1 ? "stage" : "stages"} / {total} {total === 1 ? "map" : "maps"}</span>
              </div>
              <div className="player-stage-history">
                {displayStageGroups.map((group) => (
                  <PlayerStageSection key={group.key} group={group} onOpenSeries={onOpenSeries} />
                ))}
              </div>
            </section>
          ) : (
            <div className="empty-fullscreen">No completed maps for {player.handle} yet.</div>
          )}
        </div>
      )}

      {activeTab === "rivals" && <div className="player-tab-panel" role="tabpanel"><PlayerRivalsPanel matchups={vault.matchups} /></div>}

      {activeTab === "manager" && managerCareer && (
        <div className="player-tab-panel" role="tabpanel">
          <section className="manager-player-profile">
            <div className="manager-player-profile-head">
              <div>
                <span>{managerContract ? "Contracted player" : "Recruitment intelligence"}</span>
                <h2>{managerContract ? `${managerContract.squadRole} role at ${managerCareer.organizationName}` : `${player.role} at ${team.name}`}</h2>
                <p>{managerContract ? `${managerContract.status} / signed ${managerFormatDate(managerContract.signedOn)}` : managerTrade ? `Transfer talks / ${managerTrade.status}` : managerScouted ? "Full scout report available" : "Preliminary report only"}</p>
              </div>
              <div><small>{managerContract ? "Squad OVR" : "Scouted OVR"}</small><strong>{managerContract || managerScouted ? player.ovr : "?"}</strong></div>
            </div>
            {managerContract ? (
              <div className="manager-player-profile-state">
                <div>
                  <span>Morale</span>
                  <strong>{managerDynamics?.morale ?? 50}</strong>
                  <small>{managerMoraleLabel(managerDynamics?.morale ?? 50)}</small>
                  <ManagerStateMeter label="Current level" value={managerDynamics?.morale ?? 50} />
                </div>
                <div>
                  <span>Familiarity</span>
                  <strong>{managerDynamics?.familiarity ?? 0}</strong>
                  <small>{managerFamiliarityLabel(managerDynamics?.familiarity ?? 0)}</small>
                  <ManagerStateMeter label="System fit" value={managerDynamics?.familiarity ?? 0} />
                </div>
                <div>
                  <span>Recent form</span>
                  <strong>{managerDynamics?.form ?? 50}</strong>
                  <small>{managerFormLabel(managerDynamics?.form ?? 50)}</small>
                  <ManagerStateMeter label="Performance" value={managerDynamics?.form ?? 50} />
                </div>
              </div>
            ) : null}
            <div className="manager-player-contract-summary">
              {managerContract ? (
                <>
                  <div><span>Salary</span><strong>{fmtMoney(managerContract.monthlySalary)}</strong><small>per month</small></div>
                  <div><span>Release clause</span><strong>{fmtMoney(managerContract.buyout)}</strong><small>current buyout</small></div>
                  <div><span>Term remaining</span><strong>{managerContract.majorCyclesRemaining}</strong><small>Major cycles / {managerContractDurationLabel(managerContract)}</small></div>
                  <div><span>Roster fit</span><strong>{player.role}</strong><small>{managerRosterFit}</small></div>
                </>
              ) : (
                <>
                  <div><span>Scout confidence</span><strong>{managerScouted ? "Full" : "Preliminary"}</strong><small>{managerScouted ? "Exact current level" : "Range only"}</small></div>
                  <div><span>Current level</span><strong>{managerScouted ? player.ovr : `${managerScouting?.low}-${managerScouting?.high}`}</strong><small>OVR estimate</small></div>
                  <div><span>Estimated value</span><strong>{managerScouted ? fmtMoney(playerValue(player)) : "Hidden"}</strong><small>{managerTrade ? managerTrade.status : "No active offer"}</small></div>
                  <div><span>Roster fit</span><strong>{player.role}</strong><small>{managerRosterFit}</small></div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

type PlayerMapHistoryRow = {
  result: SwissResult;
  map: MapId;
  line: MatchState["yourStats"][string];
  opponent: FieldTeam;
  teamScore: number;
  oppScore: number;
  won: boolean;
};

interface PlayerStageGroup {
  key: string;
  name: string;
  shortName: string;
  maps: PlayerMapHistoryRow[];
  series: number;
  mapsWon: number;
  line: MatchState["yourStats"][string];
}

function buildPlayerStageGroups(maps: PlayerMapHistoryRow[]): PlayerStageGroup[] {
  const grouped = new Map<string, PlayerMapHistoryRow[]>();
  maps.forEach((map) => {
    const key = map.result.eventId ?? "event";
    grouped.set(key, [...(grouped.get(key) ?? []), map]);
  });

  return [...grouped.entries()]
    .map(([key, stageMaps]) => {
      const event = key === "event" ? undefined : circuitEventById(key);
      const line = emptyLine();
      stageMaps.forEach((map) => addPlayerLine(line, map.line));
      return {
        key,
        name: stageMaps[0]?.result.eventName ?? event?.name ?? "Major",
        shortName: event?.shortName ?? "Major",
        maps: stageMaps,
        series: new Set(stageMaps.map((map) => map.result.id)).size,
        mapsWon: stageMaps.filter((map) => map.won).length,
        line,
      };
    })
    .sort((a, b) => {
      if (a.key === "event") return 1;
      if (b.key === "event") return -1;
      return circuitEventIndex(a.key) - circuitEventIndex(b.key);
    });
}

function PlayerStageSection({ group, onOpenSeries }: { group: PlayerStageGroup; onOpenSeries: (id: string) => void }) {
  const displayMaps = [...group.maps].reverse();
  const kdDiff = group.line.kills - group.line.deaths;
  return (
    <section className="player-stage-section">
      <div className="player-stage-head">
        <div className="player-stage-title">
          <span>{group.shortName}</span>
          <strong>{group.name}</strong>
          <small>{group.series} series / {group.maps.length} {group.maps.length === 1 ? "map" : "maps"}</small>
        </div>
        <div className="player-stage-metrics">
          <span>
            <small>Rating</small>
            <b className={ratingTone(group.line.rating)}>{group.line.rating.toFixed(2)}</b>
          </span>
          <span>
            <small>K-D</small>
            <b className={kdDiff >= 0 ? "good" : "bad"}>{signedInteger(kdDiff)}</b>
          </span>
          <span>
            <small>Maps</small>
            <b>{group.mapsWon}-{group.maps.length - group.mapsWon}</b>
          </span>
        </div>
      </div>
      <div className="player-stage-table">
        <div className="full-table-head player-map-grid">
          <span>Match</span>
          <span>Opponent</span>
          <span>Map</span>
          <span>Score</span>
          <span>K - D</span>
          <span>+/-</span>
          <span>Rating</span>
        </div>
        {displayMaps.map((map, index) => {
          const newSeries = index === 0 || displayMaps[index - 1].result.id !== map.result.id;
          return (
            <button
              type="button"
              className={`full-table-row player-map-grid clickable${newSeries ? " series-start" : ""}`}
              key={`${map.result.id}-${map.map}-${index}`}
              onClick={() => onOpenSeries(map.result.id)}
            >
              <span className="pm-date">
                <b>{seriesDateLabel(map.result.round)}</b>
                <small>{map.result.label}</small>
              </span>
              <span className="run-team-cell">
                <TeamLogo team={map.opponent} small />
                <b>{map.opponent.name}</b>
              </span>
              <span className="pm-map">{mapAbbr(map.map)}</span>
              <span className={`pm-result ${map.won ? "won" : "lost"}`}>
                <b>{map.teamScore}</b><em>-</em><b>{map.oppScore}</b>
              </span>
              <span>{map.line.kills} - {map.line.deaths}</span>
              <span className={map.line.kills >= map.line.deaths ? "stat-positive" : "stat-negative"}>{signedInteger(map.line.kills - map.line.deaths)}</span>
              <span className={`rating-number ${ratingTone(map.line.rating)}`}>{map.line.rating.toFixed(2)}</span>
            </button>
          );
        })}
      </div>
    </section>
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
  const stageGroups = buildTeamStageGroups(team, games);

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
            {wins}-{games.length - wins} across this Major run / {games.length} series played
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
        <div className="team-stage-history">
          {stageGroups.map((group) => (
            <TeamStageSection
              key={group.key}
              group={group}
              team={team}
              onOpenSeries={onOpenSeries}
              onOpenPlayer={onOpenPlayer}
            />
          ))}
        </div>
      ) : (
        <div className="empty-fullscreen">No completed series for {team.name} yet.</div>
      )}
    </main>
  );
}

interface TeamStageGroup {
  key: string;
  name: string;
  games: SwissResult[];
  wins: number;
  maps: number;
  rows: PlayerDatabaseRow[];
}

function buildTeamStageGroups(team: FieldTeam, games: SwissResult[]): TeamStageGroup[] {
  const grouped = new Map<string, SwissResult[]>();
  games.forEach((result) => {
    const key = result.eventId ?? "event";
    grouped.set(key, [...(grouped.get(key) ?? []), result]);
  });
  return [...grouped.entries()]
    .map(([key, stageGames]) => ({
      key,
      name: stageGames[0]?.eventName ?? "Major",
      games: stageGames,
      wins: stageGames.filter((result) => result.winnerId === team.id).length,
      maps: stageGames.reduce((sum, result) => sum + result.maps.length, 0),
      rows: buildPlayerDatabase(stageGames).filter((row) => row.team.id === team.id),
    }))
    .sort((a, b) => {
      if (a.key === "event") return 1;
      if (b.key === "event") return -1;
      return circuitEventIndex(a.key) - circuitEventIndex(b.key);
    });
}

function TeamStageSection({
  group,
  team,
  onOpenSeries,
  onOpenPlayer,
}: {
  group: TeamStageGroup;
  team: FieldTeam;
  onOpenSeries: (id: string) => void;
  onOpenPlayer: (player: Player, team: FieldTeam) => void;
}) {
  return (
    <section className="team-stage-section">
      <div className="team-stage-head">
        <div>
          <span>Major run</span>
          <strong>{group.name}</strong>
        </div>
        <div className="team-stage-summary">
          <span><b>{group.wins}-{group.games.length - group.wins}</b> series</span>
          <span><b>{group.maps}</b> maps</span>
        </div>
      </div>

      <div className="team-stage-stats">
        <div className="team-stage-stats-head">
          <span>Player</span>
          <span>Maps</span>
          <span>K-D</span>
          <span>ADR</span>
          <span>KAST</span>
          <span>Rating</span>
        </div>
        {group.rows.map(({ databaseKey, player, matches, line }) => {
          const kast = line.rounds ? (line.kastRounds / line.rounds) * 100 : 0;
          return (
            <button className="team-stage-player" type="button" key={databaseKey} onClick={() => onOpenPlayer(player, team)}>
              <span className="team-stage-player-name">
                <Flag country={player.country} />
                <b>{player.handle}</b>
                <small>{player.role}</small>
              </span>
              <span>{matches}</span>
              <span>{line.kills}-{line.deaths}</span>
              <span>{line.adr.toFixed(1)}</span>
              <span>{kast.toFixed(1)}%</span>
              <span className={`rating-number ${ratingTone(line.rating)}`}>{line.rating.toFixed(2)}</span>
            </button>
          );
        })}
      </div>

      <TeamStageMatches team={team} games={group.games} onOpenSeries={onOpenSeries} />
    </section>
  );
}

function TeamStageMatches({ team, games, onOpenSeries }: { team: FieldTeam; games: SwissResult[]; onOpenSeries: (id: string) => void }) {
  return (
    <div className="team-match-list">
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
    </div>
  );
}

function ResultMapArtwork({ maps, left, right }: { maps: SeriesMapResult[]; left: FieldTeam; right: FieldTeam }) {
  const mapCount = Math.min(Math.max(maps.length, 1), 5);
  return (
    <section className={`result-map-artwork map-count-${mapCount}`} aria-label="Map results">
      {maps.map((map, index) => {
        const winner = map.winnerId === left.id ? left : right;
        return (
          <article className="result-map-art-card" key={`${map.map}-${index}`}>
            <img src={mapArtImages[map.map]} alt="" aria-hidden="true" />
            <div className="result-map-art-head">
              <span>Map {index + 1}</span>
              <strong>{mapName(map.map)}</strong>
            </div>
            <div className="result-map-scoreline">
              <span className={map.winnerId === left.id ? "winner" : ""}>
                <small>{left.tag}</small>
                <b>{map.leftScore}</b>
              </span>
              <em>:</em>
              <span className={map.winnerId === right.id ? "winner" : ""}>
                <b>{map.rightScore}</b>
                <small>{right.tag}</small>
              </span>
            </div>
            <div className="result-map-winner">
              <TeamLogo team={winner} small />
              <span>{winner.name}</span>
              <Trophy size={13} />
            </div>
          </article>
        );
      })}
    </section>
  );
}

function RunResultsPage({
  results,
  eventName,
  selectedResultId,
  onOpen,
  onBack,
}: {
  results: SwissResult[];
  eventName?: string;
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
            <span>{eventName ? "Event results" : "Previous results"}</span>
          </div>
          <h1>{eventName ?? "Series archive"}</h1>
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
                  <span className="series-map-pill-art" key={`${result.id}-${map.map}-${index}`}>
                    <img src={mapArtImages[map.map]} alt="" aria-hidden="true" />
                    <b>{mapName(map.map)}</b>
                    {map.leftScore}:{map.rightScore}
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

      <ResultMapArtwork maps={result.maps} left={result.left} right={result.right} />

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

      <WinProbPanel left={result.left} right={result.right} maps={result.maps} />
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
  const teamId = roster.id.replace(/^hltv-/, "").replace(/-20\d{2}-\d{2}-\d{2}$/, "");
  return builtInHltvCoaches.find((coach) => coach.id === `hltv-coach-${teamId}`);
}

function toTournamentTeam(roster: Roster): FieldTeam {
  return {
    ...toFieldTeam(roster),
    coach: coachForRoster(roster),
  };
}

function currentVrsRoster(teamId: string, rosterPool: Roster[]) {
  return rosterPool.find((roster) => roster.id === teamId);
}

function syncFieldTeamVrs(team: FieldTeam, rosterPool: Roster[]): FieldTeam {
  const roster = currentVrsRoster(team.id, rosterPool);
  if (!roster) return team;
  return {
    ...team,
    rank: roster.rank,
    vrsPoints: roster.vrsPoints,
  };
}

function syncPairVrs(pair: SwissPair, rosterPool: Roster[]): SwissPair {
  return {
    ...pair,
    left: syncFieldTeamVrs(pair.left, rosterPool),
    right: syncFieldTeamVrs(pair.right, rosterPool),
  };
}

function syncResultVrs(result: SwissResult, rosterPool: Roster[]): SwissResult {
  return {
    ...result,
    left: syncFieldTeamVrs(result.left, rosterPool),
    right: syncFieldTeamVrs(result.right, rosterPool),
  };
}

function currentVrsRank(team: FieldTeam) {
  return currentVrsRoster(team.id, builtInHltvRosters)?.rank ?? team.rank;
}

function currentVrsPoints(team: FieldTeam) {
  return currentVrsRoster(team.id, builtInHltvRosters)?.vrsPoints ?? team.vrsPoints;
}

function buildSwissField(rosterPool: Roster[]) {
  const majorPool = rosterPool.filter((roster) => roster.rank == null || roster.rank <= 20);
  return shuffle(majorPool).slice(0, SWISS_OPPONENT_COUNT).map(toTournamentTeam);
}

function buildCircuitField(rosterPool: Roster[], event: CircuitEvent) {
  return pickCircuitRosters(rosterPool, event, SWISS_OPPONENT_COUNT).map(toTournamentTeam);
}

function buildManagerMajorField(rosterPool: Roster[], event: CircuitEvent, controlledOrganizationId?: string) {
  return pickCircuitRosters(
    rosterPool.filter((roster) => roster.id !== controlledOrganizationId),
    event,
    SWISS_OPPONENT_COUNT,
  ).map(toTournamentTeam);
}

function buildManagerField(rosterPool: Roster[], event: ManagerEvent, controlledOrganizationId?: string) {
  const available = rosterPool.filter((roster) => roster.id !== controlledOrganizationId);
  const eligible = available.filter((roster) => {
    const rank = roster.rank ?? 99;
    return rank >= event.rankMin && rank <= event.rankMax;
  });
  const eligibleIds = new Set(eligible.map((roster) => roster.id));
  const fallback = available.filter((roster) => !eligibleIds.has(roster.id));
  return shuffle([...eligible, ...fallback]).slice(0, Math.max(1, event.capacity - 1)).map(toTournamentTeam);
}

function buildRoundRobinRoundPairs(user: FieldTeam, field: FieldTeam[], round: number): SwissPair[] {
  const teams = [user, ...field];
  if (teams.length < 2) return [];
  if (teams.length % 2 !== 0) teams.push({ ...user, id: "round-robin-bye", name: "Bye", tag: "BYE" });
  const rotating = [...teams];
  for (let step = 1; step < round; step += 1) {
    rotating.splice(1, 0, rotating.pop()!);
  }
  const pairs: SwissPair[] = [];
  for (let index = 0; index < rotating.length / 2; index += 1) {
    const left = rotating[index];
    const right = rotating[rotating.length - 1 - index];
    if (left.id === "round-robin-bye" || right.id === "round-robin-bye") continue;
    const includesUser = left.id === user.id || right.id === user.id;
    pairs.push({
      id: `round-robin-${round}-${left.id}-${right.id}`,
      left: includesUser && right.id === user.id ? right : left,
      right: includesUser && right.id === user.id ? left : right,
      active: includesUser,
    });
  }
  return pairs;
}

function buildRoundRobinPlayoffPairs(standings: FieldTeam[], user: FieldTeam): SwissPair[] {
  const seeds = standings.slice(0, 4);
  return [
    [seeds[0], seeds[3]],
    [seeds[1], seeds[2]],
  ]
    .filter((pair): pair is [FieldTeam, FieldTeam] => Boolean(pair[0] && pair[1]))
    .map(([left, right], index) => ({
      id: `semifinal-seeded-${index}-${left.id}-${right.id}`,
      left,
      right,
      active: left.id === user.id || right.id === user.id,
    }));
}

function tagCircuitResults(results: SwissResult[], event: CircuitEvent) {
  return results.map((result) => {
    if (result.eventId) return result;
    return {
      ...result,
      id: `${event.id}:${result.id}`,
      eventId: event.id,
      eventName: event.name,
    };
  });
}

function teamsFromResults(results: SwissResult[]) {
  const teams = new Map<string, FieldTeam>();
  results.forEach((result) => {
    teams.set(result.left.id, result.left);
    teams.set(result.right.id, result.right);
  });
  return [...teams.values()];
}

function recordsFromResults(teams: FieldTeam[], results: SwissResult[]) {
  const records = Object.fromEntries(teams.map((team) => [team.id, { wins: 0, losses: 0 }])) as Record<string, SwissRecord>;
  results.forEach((result) => {
    if (result.stage !== "swiss") return;
    records[result.left.id] ??= { wins: 0, losses: 0 };
    records[result.right.id] ??= { wins: 0, losses: 0 };
    const loserId = result.winnerId === result.left.id ? result.right.id : result.left.id;
    records[result.winnerId].wins += 1;
    records[loserId].losses += 1;
  });
  return records;
}

function userSeriesRecord(results: SwissResult[]): SwissRecord {
  return results.reduce<SwissRecord>((record, result) => {
    if (result.left.id !== "user" && result.right.id !== "user") return record;
    if (result.winnerId === "user") record.wins += 1;
    else record.losses += 1;
    return record;
  }, { wins: 0, losses: 0 });
}

function winnerFromFinal(results: SwissResult[]) {
  const final = [...results].reverse().find((result) => result.stage === "final");
  if (!final) return undefined;
  return final.winnerId === final.left.id ? final.left : final.right;
}

function latestPlayoffRound(results: SwissResult[]): PlayoffRound {
  if (results.some((result) => result.stage === "final")) return "final";
  if (results.some((result) => result.stage === "semifinal")) return "semifinal";
  return "quarterfinal";
}

function normalizeCircuitResultArchive(results: SwissResult[], currentEvent: CircuitEvent) {
  if (!results.some((result) => !result.eventId)) return results;

  const segments: SwissResult[][] = [];
  results.forEach((result) => {
    const segment = segments[segments.length - 1];
    const previous = segment?.[segment.length - 1];
    const crossedTaggedBoundary = Boolean(previous && (previous.eventId || result.eventId) && previous.eventId !== result.eventId);
    const crossedLegacyBoundary = Boolean(previous && !previous.eventId && !result.eventId && result.round < previous.round);
    if (!segment || crossedTaggedBoundary || crossedLegacyBoundary) segments.push([result]);
    else segment.push(result);
  });

  // Archived blocks always precede the active stage. Working backward from that stage also
  // migrates careers that began at Stage 1 or Stage 2 instead of at the MRQ.
  const currentIndex = circuitEventIndex(currentEvent.id);
  const firstArchivedIndex = Math.max(0, currentIndex - segments.length);
  return segments.flatMap((segment, index) => {
    if (segment[0]?.eventId) return segment;
    const inferredEvent = circuitEvents[Math.min(currentIndex, firstArchivedIndex + index)] ?? currentEvent;
    return tagCircuitResults(segment, inferredEvent);
  });
}

function circuitStageQualifiers(
  field: FieldTeam[],
  records: Record<string, SwissRecord>,
  user?: FieldTeam,
  userRecord?: SwissRecord,
) {
  const qualified = field.filter((team) => (records[team.id]?.wins ?? 0) >= 3);
  if (user && (userRecord?.wins ?? 0) >= 3) qualified.unshift(user);
  return qualified.slice(0, SWISS_FIELD_SIZE / 2);
}

function buildNextCircuitField(
  rosterPool: Roster[],
  event: CircuitEvent,
  qualifiers: FieldTeam[],
  previousField: FieldTeam[],
  userParticipating: boolean,
  priorResults: SwissResult[] = [],
) {
  const targetSize = userParticipating ? SWISS_OPPONENT_COUNT : SWISS_FIELD_SIZE;
  const carried = qualifiers.filter((team) => !userParticipating || team.id !== "user");
  const excluded = circuitParticipantIds(previousField, carried, teamsFromResults(priorResults));
  const inviteCount = Math.max(0, targetSize - carried.length);
  const invites = pickCircuitRosters(rosterPool, event, inviteCount, Math.random, excluded).map(toTournamentTeam);
  return composeCircuitField(carried, invites, targetSize);
}

function repairUnplayedCircuitField(
  rosterPool: Roster[],
  event: CircuitEvent,
  field: FieldTeam[],
  archivedResults: SwissResult[],
) {
  const eventIndex = circuitEventIndex(event.id);
  if (eventIndex === 0 || !archivedResults.length) return field;

  const previousEvent = circuitEvents[eventIndex - 1];
  const previousResults = archivedResults.filter(
    (result) => result.eventId === previousEvent.id && result.stage === "swiss",
  );
  const previousTeams = teamsFromResults(previousResults);
  const qualifierIds = new Set(
    circuitStageQualifiers(previousTeams, recordsFromResults(previousTeams, previousResults)).map((team) => team.id),
  );
  const priorTeams = teamsFromResults(archivedResults);
  const priorParticipantIds = circuitParticipantIds(priorTeams);
  const invalidIds = new Set(
    field
      .filter((team) => priorParticipantIds.has(team.id) && !qualifierIds.has(team.id))
      .map((team) => team.id),
  );
  if (!invalidIds.size) return field;

  const retained = field.filter((team) => !invalidIds.has(team.id));
  const excluded = circuitParticipantIds(priorTeams, field);
  const replacements = pickCircuitRosters(rosterPool, event, invalidIds.size, Math.random, excluded).map(toTournamentTeam);
  if (replacements.length !== invalidIds.size) return field;
  return composeCircuitField(retained, replacements, field.length);
}

function simulateNeutralSwissStage(
  field: FieldTeam[],
  settings: CustomSettings,
  difficulty: Difficulty,
) {
  let records = initialSwissRecords(field);
  const results: SwissResult[] = [];
  for (let round = 1; round <= 5 && !isNeutralSwissStageResolved(field, records); round += 1) {
    const history = buildSwissHistory(results);
    const pairs = buildRemainingSwissPairs(field, records, round, history);
    if (!pairs.length) break;
    const roundResults = pairs.map((pair) => simulateSwissSeries(pair, round, settings, difficulty, records));
    results.push(...roundResults);
    records = applyResultsToSwissRecords(records, roundResults);
  }
  return { records, results };
}

function simulateNeutralPlayoffs(
  field: FieldTeam[],
  records: Record<string, SwissRecord>,
  settings: CustomSettings,
  difficulty: Difficulty,
) {
  let round: PlayoffRound = "quarterfinal";
  let pairs = buildNeutralInitialPlayoffPairs(field, records, settings, difficulty);
  const results: SwissResult[] = [];
  let winner: FieldTeam | undefined;
  while (pairs.length) {
    const roundResults = pairs.map((pair) => simulatePlayoffSeries(pair, round, settings, difficulty));
    results.push(...roundResults);
    const winners = roundResults.map((result) => (result.winnerId === result.left.id ? result.left : result.right));
    if (round === "final") {
      winner = winners[0];
      break;
    }
    round = round === "quarterfinal" ? "semifinal" : "final";
    pairs = buildNeutralNextPlayoffPairs(round, winners);
  }
  return { results, winner };
}

function simulateCircuitRemainder(
  startingEvent: CircuitEvent,
  startingField: FieldTeam[],
  startingRecords: Record<string, SwissRecord>,
  startingResults: SwissResult[],
  priorResults: SwissResult[],
  rosterPool: Roster[],
  settings: CustomSettings,
  difficulty: Difficulty,
) {
  let event = startingEvent;
  let field = startingField;
  let records = startingRecords;
  const results = tagCircuitResults(startingResults, startingEvent);

  while (!event.hasPlayoffs) {
    const qualifiers = circuitStageQualifiers(field, records);
    const nextEvent = nextCircuitEvent(event);
    const nextField = buildNextCircuitField(
      rosterPool,
      nextEvent,
      qualifiers,
      field,
      false,
      [...priorResults, ...results],
    );
    const stage = simulateNeutralSwissStage(nextField, settings, difficulty);
    event = nextEvent;
    field = nextField;
    records = stage.records;
    results.push(...tagCircuitResults(stage.results, nextEvent));
  }

  const playoffs = simulateNeutralPlayoffs(field, records, settings, difficulty);
  results.push(...tagCircuitResults(playoffs.results, event));
  return { results, winner: playoffs.winner };
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

// Each of YOUR players' average HLTV-style rating across this Major (one entry per player id), from the
// per-map box scores — the input to post-Major development.
function majorPlayerRatings(results: SwissResult[]): Map<string, number> {
  const sums = new Map<string, { total: number; maps: number }>();
  for (const result of results) {
    const isLeft = result.left.id === "user";
    if (!isLeft && result.right.id !== "user") continue;
    for (const map of result.maps) {
      const stats = isLeft ? map.leftStats : map.rightStats;
      for (const [id, line] of Object.entries(stats)) {
        const entry = sums.get(id) ?? { total: 0, maps: 0 };
        entry.total += line.rating;
        entry.maps += 1;
        sums.set(id, entry);
      }
    }
  }
  const out = new Map<string, number>();
  for (const [id, { total, maps }] of sums) out.set(id, maps ? total / maps : 0);
  return out;
}

function mapResultFromState(map: MapId, state: MatchState, left: FieldTeam, right: FieldTeam): SeriesMapResult {
  return {
    map,
    leftScore: state.you,
    rightScore: state.opponent,
    winnerId: state.winner === "you" ? left.id : state.winner === "opponent" ? right.id : state.you >= state.opponent ? left.id : right.id,
    eventLog: eventLogFromMatchState(map, state),
    roundWinners: state.roundWinners.map((winner) => (winner === "you" ? "left" : "right")),
    roundProbabilities: state.roundProbabilities, // left (= "you") win probability entering each round
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
  bestOfOverride?: number,
) {
  const bestOf = bestOfOverride ?? swissPairBestOf(pair, records);
  const result = simulateSeries(pair, round, "swiss", bestOfOverride ? `Round robin matchday ${round}` : `Swiss round ${round}`, bestOf, settings, difficulty);
  result.laneKey = laneKeyForRecord(records[pair.left.id] ?? { wins: 0, losses: 0 });
  return result;
}

function simulatePlayoffSeries(pair: SwissPair, round: PlayoffRound, settings: CustomSettings, difficulty: Difficulty, bestOfOverride?: number) {
  return simulateSeries(pair, playoffRoundNumber(round), round, playoffRoundLabel(round), bestOfOverride ?? playoffBestOf(round), settings, difficulty);
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

function buildManagerRecentPlayerPerformance(results: SwissResult[]): ManagerRecentPlayerPerformance[] {
  const teamRecords = new Map<string, { wins: number; losses: number }>();
  results.forEach((result) => {
    [result.left.id, result.right.id].forEach((teamId) => {
      const record = teamRecords.get(teamId) ?? { wins: 0, losses: 0 };
      if (result.winnerId === teamId) record.wins += 1;
      else record.losses += 1;
      teamRecords.set(teamId, record);
    });
  });
  return buildPlayerDatabase(results).map((row) => {
    const record = teamRecords.get(row.team.id) ?? { wins: 0, losses: 0 };
    return {
      teamId: row.team.id,
      playerId: row.player.id,
      rating: row.line.rating,
      maps: row.matches,
      teamSeriesWins: record.wins,
      teamSeriesLosses: record.losses,
    };
  });
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

function generateManagerPlayerForm(players: Player[], career: ManagerCareerState) {
  const familiarityBonus = clampNumber((managerTeamFamiliarity(career) - 60) / 30, -1, 1);
  return players.reduce((form, player) => {
    const dynamics = managerPlayerDynamics(career, player.id);
    if (!dynamics) {
      form[player.id] = 0;
      return form;
    }
    const recentForm = clampNumber((dynamics.form - 50) / 15, -2, 2);
    const morale = clampNumber((dynamics.morale - 60) / 30, -1, 1);
    form[player.id] = clampNumber(recentForm + morale + familiarityBonus, -3, 3);
    return form;
  }, {} as Record<string, number>);
}

function draftedPlayerCopy(player: Player, pickIndex: number): Player {
  const meta = careerMetaForPlayer(player, hltvProspectPotentialBonus(player.handle));
  return {
    ...player,
    id: `user-pick-${pickIndex + 1}-${player.id}`,
    ...meta,
  };
}

function withCareerMeta(player: Player): Player {
  const meta = careerMetaForPlayer(player, hltvProspectPotentialBonus(player.handle));
  return { ...player, ...meta };
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

function draftAchievements(players: Player[]) {
  const unlocks: string[] = [];
  const roles = new Set(players.map((player) => player.role));
  if (requiredRoles.every((role) => roles.has(role))) unlocks.push("role-perfect");
  if (averageOvr(players) >= 88) unlocks.push("superteam");
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
  if (screen === "manager-select") return "setup";
  if (screen === "manager-home" || screen === "manager-inbox" || screen === "manager-calendar" || screen === "manager-roster" || screen === "manager-market") {
    return snapshot.mode === "manager" && snapshot.managerCareer ? screen : "setup";
  }
  if (screen === "universe") {
    if (snapshot.mode === "manager" && snapshot.managerCareer) return "manager-home";
    if (
      snapshot.tournamentOutcome !== "running" &&
      (snapshot.transferCandidates?.length ?? 0) > 0
    ) return "transfer";
    return snapshot.phase === "playoffs" ? "playoffs" : "swiss";
  }
  if (screen === "match" && !snapshot.match) return snapshot.phase === "playoffs" ? "playoffs" : "swiss";
  if (screen === "result" && !snapshot.match) return snapshot.phase === "playoffs" ? "playoffs" : "swiss";
  if (screen === "series-detail" && !snapshot.selectedResultId) return snapshot.phase === "playoffs" ? "playoffs" : "swiss";
  if (screen === "player-detail" || screen === "team-detail") return snapshot.phase === "playoffs" ? "playoffs" : "swiss";
  if (screen === "coach" && snapshot.runKind === "spectator") return "swiss";
  // Compare carries no persisted selection; the transfer window IS fully snapshotted, so it restores fine.
  if (screen === "compare") return snapshot.phase === "playoffs" ? "playoffs" : "swiss";
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

const rootElement = document.getElementById("root")!;
const appGlobal = globalThis as typeof globalThis & {
  __majorDraftLabRoot?: ReturnType<typeof createRoot>;
};
const appRoot = appGlobal.__majorDraftLabRoot ?? createRoot(rootElement);
appGlobal.__majorDraftLabRoot = appRoot;
appRoot.render(<App />);
