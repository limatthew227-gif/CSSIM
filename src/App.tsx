import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  Award,
  Ban,
  CheckCircle2,
  Clock3,
  Database,
  Dice5,
  Download,
  Eye,
  FastForward,
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
  Swords,
  Target,
  Trophy,
  Trash2,
  Upload,
  Users,
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
} from "./gameData";
import {
  FieldTeam,
  MatchState,
  Tactic,
  VetoState,
  applyOpponentVeto,
  applyUserBan,
  averageOvr,
  composition,
  createVeto,
  draftedTeam,
  initMatch,
  mapEdge,
  mapName,
  playRound,
  resultNotes,
  requiredRoles,
  recalculateHltvStyleRating,
  teamStrength,
  teamStrengthBreakdown,
  toFieldTeam,
} from "./sim";
import { hltvTop20Coaches, hltvTop20Rosters } from "./hltvTop20";
import { simulateRadarPlayers, MAP_LAYOUTS, getStepDelay } from "./radarSim";
import { mapGeometries } from "./mapGeometry";
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

type Screen = "setup" | "teams" | "draft" | "coach" | "swiss" | "playoffs" | "veto" | "match" | "result" | "stats" | "results" | "series-detail";
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
type TeamLabView = "builder" | "scout";
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

interface SeriesMapResult {
  map: MapId;
  leftScore: number;
  rightScore: number;
  winnerId: string;
  leftStats: MatchState["yourStats"];
  rightStats: MatchState["yourStats"];
  leftSideStats: Record<"CT" | "T", MatchState["yourStats"]>;
  rightSideStats: Record<"CT" | "T", MatchState["yourStats"]>;
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

const speedDelays: Record<number, number> = {
  0.5: 3500,
  1: 2200,
  2: 1000,
  4: 400,
};

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
  const [statsScope, setStatsScope] = useState<StatsScope>("all");
  const [record, setRecord] = useState({ wins: 0, losses: 0 });
  const [pickems, setPickems] = useState<Record<string, string>>({});
  const [pickemScore, setPickemScore] = useState(0);
  const [lastPickemDelta, setLastPickemDelta] = useState(0);
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
  const coachPool = useMemo(() => hltvTop20Coaches, []);
  const visibleCoachOptions = coachOptions.length ? coachOptions : coachPool.slice(0, COACH_SHORTLIST_SIZE);

  const formAdjustedPlayers = useMemo(
    () =>
      selected.map((player) => ({
        ...player,
        ovr: Math.max(60, Math.min(99, player.ovr + Math.round((playerForm[player.id] ?? 0) / 4))),
      })),
    [selected, playerForm],
  );
  const yourTeam = useMemo(() => draftedTeam(teamName, formAdjustedPlayers, coach), [teamName, formAdjustedPlayers, coach]);
  const bonuses = useMemo(() => composition(selected, settings, true), [selected, settings]);
  const opponentBonuses = useMemo(() => composition(opponent.players, settings, opponent.id === "user"), [opponent, settings]);
  const missingRoles = requiredRoles.filter((role) => !selected.some((player) => player.role === role));
  const swissPairs = useMemo(() => buildSwissPairs(yourTeam, opponent, swissField, record, swissRecords), [yourTeam, opponent, swissField, record, swissRecords]);
  const swissUserFinished = runKind === "player" && phase === "swiss" && (record.wins >= 3 || record.losses >= 3);
  const swissCanSim = swissUserFinished && !isSwissStageResolved(swissField, swissRecords, record);
  const spectatorSwissResolved = runKind === "spectator" && phase === "swiss" && isNeutralSwissStageResolved(swissField, swissRecords);
  const spectatorSwissPairs = useMemo(
    () =>
      runKind === "spectator" && phase === "swiss" && !spectatorSwissResolved
        ? buildRemainingSwissPairs(swissField, swissRecords, spectatorSwissRound)
        : [],
    [phase, runKind, spectatorSwissResolved, spectatorSwissRound, swissField, swissRecords],
  );
  const swissDisplayPairs = useMemo(
    () => (swissUserFinished ? buildRemainingSwissPairs(swissField, swissRecords, record.wins + record.losses + 1) : swissPairs),
    [record, swissField, swissPairs, swissRecords, swissUserFinished],
  );
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

  function openSeriesResult(id: string) {
    setSelectedResultId(id);
    setScreen("series-detail");
  }

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", settings.accent);
  }, [settings.accent]);

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
      setScreen("result");
      return;
    }
    const nextSeries = completedSeriesState(series, match);
    if (seriesIsDone(nextSeries)) {
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
      setSelected(randomFiveWithIgl(rosterPool));
      openCoachDraft();
      return;
    }
    setScreen("draft");
    rollRoster([]);
  }

  function startSpectatorRun() {
    const nextSwissField = buildSpectatorField(rosterPool);
    const nextSwissRecords = initialSwissRecords(nextSwissField);
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
    const nextSelected = [...selected, player];
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
    while (!next.ended && guard < 40) {
      const activeTimeoutBoost = plan.rounds > 0 ? plan.boost : 0;
      next = playRound(next, yourTeam, opponent, settings, difficulty, tactic, activeTimeoutBoost, true);
      if (plan.rounds > 0) plan = { boost: plan.rounds > 1 ? plan.boost : 0, rounds: Math.max(0, plan.rounds - 1) };
      guard += 1;
    }
    setTimeoutPlan(plan);
    if (series) {
      advanceCompletedMap(next, series);
      return;
    }
    setMatch(next);
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
    let nextSwissRecords = { ...swissRecords };
    const simulatedResults: SwissResult[] = [];
    let nextRound = Math.min(record.wins + record.losses + 1, 5);

    while (nextRound <= 5 && !isSwissStageResolved(swissField, nextSwissRecords, record)) {
      const pairs = buildRemainingSwissPairs(swissField, nextSwissRecords, nextRound);
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
    if (isNeutralSwissStageResolved(swissField, swissRecords)) {
      enterNeutralPlayoffs(swissRecords, "running");
      return;
    }

    const pairs = buildRemainingSwissPairs(swissField, swissRecords, spectatorSwissRound);
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
      setCustomRosters((current) => mergeRosterLists(current, incoming));
      setTeamLabMessage(`${incoming.length} team${incoming.length === 1 ? "" : "s"} imported.`);
    } catch {
      setTeamLabMessage("Could not parse that JSON.");
    }
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
          <button className="icon-button" onClick={() => setScreen("teams")} title="Team database">
            <Database size={18} />
            <span>Team Lab</span>
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
        </main>
      )}

      {screen === "teams" && (
        <TeamLab
          rosterPool={rosterPool}
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
                <span>{spectatorSwissResolved ? "Qualified teams are locked" : `Swiss round ${spectatorSwissRound} pairings`}</span>
                <b>{swissField.length} teams</b>
              </div>
              <div className="swiss-match-list">
                {spectatorSwissPairs.length ? (
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
                <span>Pick'Em: bet on the winners of the other series and rack up points</span>
                <b>{pickemScore} pts</b>
                {lastPickemDelta > 0 && <em>+{lastPickemDelta}</em>}
              </div>
              <div className="swiss-match-list">
                {swissDisplayPairs.length ? (
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
          onBack={() => setScreen("results")}
          onBackToRun={() => setScreen(phase === "playoffs" ? "playoffs" : "swiss")}
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
              <div className="tactic-grid">
                {(["standard", "aggressive", "cautious", "force", "save"] as Tactic[]).map((item) => (
                  <button className={tactic === item ? "selected" : ""} key={item} onClick={() => setTactic(item)}>
                    {item}
                  </button>
                ))}
              </div>
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
            <div className="series-analysis-actions">
              <button className="primary" onClick={continueSeries}>
                <Play size={17} />
                {series && !seriesIsDone({ ...series, mapResults: [...series.mapResults, mapResultFromState(match.map, match, yourTeam, opponent)] }) ? "Next map" : "Continue"}
              </button>
            </div>
            <AchievementStrip achievements={achievements} />
          </section>
          <MatchStatsPanel
            maps={resultMaps}
            mapResults={resultMapResults}
            teams={resultStatsTeams}
          />
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
          </div>
          <button className="secondary" onClick={onBack}>
            Back to setup
          </button>
        </div>
      </section>

      {labView === "builder" ? (
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
      ) : (
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

function Avatar({ label, accent }: { label: string; accent: string }) {
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
      <Avatar label={player.handle} accent={player.source.accent} />
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

  const [smoothMovement, setSmoothMovement] = React.useState(true);
  const [showUnderlay, setShowUnderlay] = React.useState(false);
  const [fraction, setFraction] = React.useState(1);
  const prevStepRef = React.useRef(roundEvents.length);

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
  const { players: radarPlayers, traces: radarTraces, bomb } = simulateRadarPlayers(match, you, opponent, stepIndex);
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
            backgroundImage: radarImage && (!geometry || showUnderlay) ? `url(${radarImage})` : undefined,
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
          {geometry && (
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

        {/* Code-built map geometry (walkable floor) — the surface players actually navigate */}
        {geometry && (
          <svg className="radar-geometry" viewBox="0 0 100 100" preserveAspectRatio="none">
            {geometry.walkable.map((poly, i) => (
              <polygon key={`floor-${i}`} className="floor" points={poly.map((pt) => `${pt.x},${pt.y}`).join(" ")} />
            ))}
            {geometry.walls.map((poly, i) => (
              <polygon key={`wall-${i}`} className="wall" points={poly.map((pt) => `${pt.x},${pt.y}`).join(" ")} />
            ))}
          </svg>
        )}

        {/* Dynamic site tags positioned at exact coords */}
        <div className="radar-site site-a" style={{ left: `${layout.bombsiteA.x}%`, top: `${layout.bombsiteA.y}%` }}>A</div>
        <div className="radar-site site-b" style={{ left: `${layout.bombsiteB.x}%`, top: `${layout.bombsiteB.y}%` }}>B</div>

        {/* Spawn points labels */}
        <div className="radar-spawn t-spawn-label" style={{ left: `${layout.tSpawn.x}%`, top: `${layout.tSpawn.y}%` }}>T Spawn</div>
        <div className="radar-spawn ct-spawn-label" style={{ left: `${layout.ctSpawn.x}%`, top: `${layout.ctSpawn.y}%` }}>CT Spawn</div>

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
              style={{ left: `${trace.victimPos.x}%`, top: `${trace.victimPos.y}%`, "--ping-delay": `${index * 90}ms` } as React.CSSProperties}
            />
          );
        })}
        {radarPlayers.map((simPlayer, index) => {
          const { id, handle, side, team, alive, x, y } = simPlayer;
          return (
            <div
              className={`radar-player ${side.toLowerCase()} ${team} ${alive ? "alive" : "dead"}`}
              key={id}
              style={
                {
                  left: `${x}%`,
                  top: `${y}%`,
                } as React.CSSProperties
              }
            >
              <span>{handle.slice(0, 2).toUpperCase()}</span>
              <small>{handle}</small>
            </div>
          );
        })}
        <div className="radar-event-stack">
          {displayEvents.length ? (
            displayEvents.map((event, index) => (
              <span key={`${event.round}-radar-event-${index}`}>{radarEventText(event, yourSide)}</span>
            ))
          ) : (
            <span>Waiting for contact...</span>
          )}
        </div>
        <div className="radar-legend">
          <span className="ct-team">CT</span>
          <span className="t-team">T</span>
        </div>
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
          <b className={result.winnerId === pair.left.id ? "winner" : ""}>{result.leftScore}</b>
          <span>-</span>
          <b className={result.winnerId === pair.right.id ? "winner" : ""}>{result.rightScore}</b>
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
        <b className={result.winnerId === result.left.id ? "winner" : ""}>{result.leftScore}</b>
        <em>-</em>
        <b className={result.winnerId === result.right.id ? "winner" : ""}>{result.rightScore}</b>
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

function LineupColumn({ title, players }: { title: string; players: Player[] }) {
  return (
    <div className="lineup-column">
      <strong>{title}</strong>
      {players.map((player) => {
        const hltvRating = typeof player.hltvRating === "number" && (player.hltvMaps ?? 0) > 0 ? player.hltvRating.toFixed(2) : undefined;
        return (
          <div className="lineup-row" key={player.id}>
            <div className="lineup-player-main">
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

function MatchStatsPanel({
  maps,
  mapResults = [],
  teams,
}: {
  maps: MapId[];
  mapResults?: SeriesMapResult[];
  teams: Array<{ team: FieldTeam; players: Player[]; stats: MatchState["yourStats"]; side?: "left" | "right" }>;
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
          <TeamStatsBlock key={team.id} team={team} players={players} stats={stats} />
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
}: {
  rows: PlayerDatabaseRow[];
  scope: StatsScope;
  onScopeChange: (scope: StatsScope) => void;
  onBack: () => void;
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
                <span className="full-player-cell">
                  <Flag country={player.country} />
                  <b>{player.handle}</b>
                  <small>{player.realName}</small>
                </span>
                <span>{player.country}</span>
                <span className="run-team-cell" title={team.name}>
                  <TeamLogo team={team} small />
                  <b>{team.tag}</b>
                </span>
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
                  <span className={result.winnerId === result.left.id ? "winner" : ""}>{result.leftScore}</span>
                  <em>:</em>
                  <span className={result.winnerId === result.right.id ? "winner" : ""}>{result.rightScore}</span>
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
}: {
  result?: SwissResult;
  onBack: () => void;
  onBackToRun: () => void;
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
            Results
          </button>
          <button className="secondary" onClick={onBackToRun}>
            Back to run
          </button>
        </div>
      </section>

      <section className="series-detail-hero">
        <div className="series-detail-team" style={{ "--crest": result.left.accent } as React.CSSProperties}>
          <TeamLogo team={result.left} />
          <strong>{result.left.name}</strong>
          <span>{result.left.country} / {result.left.year}</span>
        </div>
        <div className="series-detail-score">
          <strong>
            <span className={result.winnerId === result.left.id ? "winner" : ""}>{result.leftScore}</span>
            <em>:</em>
            <span className={result.winnerId === result.right.id ? "winner" : ""}>{result.rightScore}</span>
          </strong>
          <small>{result.label}</small>
        </div>
        <div className="series-detail-team right" style={{ "--crest": result.right.accent } as React.CSSProperties}>
          <TeamLogo team={result.right} />
          <strong>{result.right.name}</strong>
          <span>{result.right.country} / {result.right.year}</span>
        </div>
      </section>

      <section className="series-map-summary">
        {result.maps.map((map, index) => (
          <span key={`${result.id}-detail-${map.map}-${index}`}>
            <b>{mapName(map.map)}</b>
            {map.leftScore}:{map.rightScore}
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
      />
    </main>
  );
}

function TeamStatsBlock({
  team,
  players,
  stats,
}: {
  team: FieldTeam;
  players: Player[];
  stats: MatchState["yourStats"];
}) {
  const rows = statRows(players, stats, true);
  return (
    <section className="team-stats-block" style={{ "--crest": team.accent } as React.CSSProperties}>
      <div className="team-stats-grid team-stats-head">
        <div className="team-stats-title">
          <TeamLogo team={team} small />
          <strong>{team.name}</strong>
        </div>
        <b>K-D</b>
        <b>Swing</b>
        <b>ADR</b>
        <b>KAST</b>
        <b>Impact</b>
        <b>FK-FD</b>
        <b>2K+</b>
        <b>
          Rating
          <span>2.0</span>
        </b>
      </div>
      {rows.map(({ player, line, kast, swing }) => (
        <div className="team-stats-grid team-stats-row" key={player.id}>
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
        </div>
      ))}
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

function buildSwissPairs(
  user: FieldTeam,
  opponent: FieldTeam,
  field: FieldTeam[],
  record: SwissRecord,
  records: Record<string, SwissRecord>,
): SwissPair[] {
  const pool = swissPairPool(field.filter((team) => team.id !== opponent.id), records);
  const others: SwissPair[] = [];
  for (let index = 0; index < pool.length - 1 && others.length < SWISS_FIELD_SIZE / 2 - 1; index += 2) {
    others.push({
      id: `${record.wins}-${record.losses}-${pool[index].id}-${pool[index + 1].id}`,
      left: pool[index],
      right: pool[index + 1],
    });
  }
  return [
    others[0],
    { id: `${record.wins}-${record.losses}-user`, left: user, right: opponent, active: true },
    ...others.slice(1),
  ].filter(Boolean) as SwissPair[];
}

function buildRemainingSwissPairs(field: FieldTeam[], records: Record<string, SwissRecord>, round: number) {
  const pool = swissPairPool(field, records);
  const groups = pool.reduce(
    (acc, team) => {
      const teamRecord = records[team.id] ?? { wins: 0, losses: 0 };
      const key = recordKey(teamRecord);
      acc[key] = [...(acc[key] ?? []), team];
      return acc;
    },
    {} as Record<string, FieldTeam[]>,
  );
  const pairs: SwissPair[] = [];
  const floats: FieldTeam[] = [];
  const laneKeys = Object.keys(groups).sort((a, b) => {
    const [aWins, aLosses] = a.split("-").map(Number);
    const [bWins, bLosses] = b.split("-").map(Number);
    return bWins - aWins || aLosses - bLosses;
  });

  laneKeys.forEach((key) => {
    const teams = groups[key];
    for (let index = 0; index < teams.length - 1; index += 2) {
      pairs.push({
        id: `swiss-sim-${round}-${key}-${teams[index].id}-${teams[index + 1].id}`,
        left: teams[index],
        right: teams[index + 1],
      });
    }
    if (teams.length % 2 === 1) floats.push(teams[teams.length - 1]);
  });

  for (let index = 0; index < floats.length - 1; index += 2) {
    const leftRecord = records[floats[index].id] ?? { wins: 0, losses: 0 };
    pairs.push({
      id: `swiss-sim-${round}-${recordKey(leftRecord)}-float-${floats[index].id}-${floats[index + 1].id}`,
      left: floats[index],
      right: floats[index + 1],
    });
  }

  return pairs;
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

function mapResultFromState(map: MapId, state: MatchState, left: FieldTeam, right: FieldTeam): SeriesMapResult {
  return {
    map,
    leftScore: state.you,
    rightScore: state.opponent,
    winnerId: state.winner === "you" ? left.id : state.winner === "opponent" ? right.id : state.you >= state.opponent ? left.id : right.id,
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
    while (!state.ended && guard < 40) {
      state = playRound(state, pair.left, pair.right, settings, neutralDifficulty, "standard", 0, true);
      guard += 1;
    }
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
    const databaseKey = `${team.id}:${player.id}`;
    const current = rows.get(databaseKey);
    if (!current) {
      rows.set(databaseKey, {
        databaseKey,
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
  return players.reduce(
    (acc, player) => {
      acc[player.id] = 0;
      return acc;
    },
    {} as Record<string, number>,
  );
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
