import { expectedRating, playerValue, type PlacementTier } from "./career";
import type { Player, PlayerStats } from "./gameData";

export const MANAGER_CAREER_VERSION = 17;
export const MANAGER_START_DATE = "2026-07-20";
export const MANAGER_SALARY_MODEL_VERSION = 2;
export const MANAGER_POTENTIAL_LAB_ELITE_COST = 200_000;
export const MANAGER_CASINO_STAKES = [5_000, 25_000, 100_000] as const;

export type ManagerEventTier = "open" | "challenger" | "elite" | "major";
export type ManagerEntryType = "open" | "vrs" | "qualifier" | "invite";
export type ManagerRegistrationStatus = "confirmed" | "active" | "completed" | "withdrawn";
export type ManagerInboxKind = "welcome" | "event" | "deadline" | "result" | "finance" | "market" | "ranking";
export type ManagerSquadRole = "star" | "starter" | "rotation" | "prospect" | "bench";
export type ManagerContractStatus = "active" | "bench" | "transfer-listed" | "expired";
export type ManagerOfferStatus = "accepted" | "rejected";
export type ManagerTradeOfferStatus = "pending" | "accepted" | "rejected" | "countered" | "delayed" | "expired" | "withdrawn" | "superseded" | "outbid";
export type ManagerIncomingOfferStatus = "pending" | "counter-pending" | "accepted" | "declined" | "rejected" | "expired";
export type ManagerEventFormat = "swiss" | "round-robin" | "single-elimination";
export type ManagerMajorStage = "mrq" | "stage-1" | "stage-2" | "stage-3";
export type ManagerBoardObjectiveStatus = "active" | "completed" | "failed";
export type ManagerFinancialPressure = "healthy" | "watch" | "critical";
export type ManagerTrainingFocus = "balanced" | "mechanics" | "tactics" | "role" | "recovery";
export type ManagerCoinSide = "heads" | "tails";
export type ManagerCareerStatus = "active" | "bankrupt";
export type ManagerCasinoStake = typeof MANAGER_CASINO_STAKES[number];
export type ManagerPerformanceCampFocus = "tactical" | "mechanics" | "recovery";
export type ManagerPerformanceCampStatus = "active" | "completed";

export interface ManagerPerformanceCampProgram {
  id: ManagerPerformanceCampFocus;
  name: string;
  department: string;
  description: string;
  benefit: string;
  cost: number;
  durationDays: number;
}

export const managerPerformanceCampPrograms: ManagerPerformanceCampProgram[] = [
  {
    id: "tactical",
    name: "System Camp",
    department: "Tactical unit",
    description: "Build protocols, communication, and late-round structure around the starting five.",
    benefit: "+7 starter familiarity / +8 squad development",
    cost: 18_000,
    durationDays: 7,
  },
  {
    id: "mechanics",
    name: "Firepower Camp",
    department: "Performance unit",
    description: "High-volume aim work and pressure scrims accelerate the entire squad's development.",
    benefit: "+24 squad development / +5 form",
    cost: 22_000,
    durationDays: 7,
  },
  {
    id: "recovery",
    name: "Reset Camp",
    department: "Player care",
    description: "A controlled reset restores confidence and freshness before the next competition block.",
    benefit: "+10 morale / +8 form",
    cost: 12_000,
    durationDays: 7,
  },
];

export interface ManagerPerformanceCamp {
  id: string;
  focus: ManagerPerformanceCampFocus;
  bookedOn: string;
  startsOn: string;
  endsOn: string;
  cost: number;
  status: ManagerPerformanceCampStatus;
}

export interface ManagerCasinoVisit {
  id: string;
  playerId: string;
  playerHandle: string;
  date: string;
  stake: ManagerCasinoStake;
  choice: ManagerCoinSide;
  result: ManagerCoinSide;
  net: number;
}

export interface ManagerCareerPlayerSeed {
  id: string;
  handle: string;
  role: string;
  ovr: number;
  age?: number;
  potential?: number;
  hltvRating?: number;
  stats?: PlayerStats;
}

export interface ManagerTrainingPlan {
  playerId: string;
  focus: ManagerTrainingFocus;
  progress: number;
  currentOvr: number;
  potentialOvr: number;
  currentStats?: PlayerStats;
  lastRating?: number;
  lastOvrChange: number;
  lastUpdatedOn: string;
  potentialLabAttempts: number;
  potentialLabWins: number;
  lastPotentialLabOn?: string;
}

export interface ManagerTrainingReport {
  playerId: string;
  handle: string;
  focus: ManagerTrainingFocus;
  progressEarned: number;
  before: number;
  after: number;
  rating?: number;
}

export interface ManagerCareerStart {
  organizationId?: string;
  organizationName?: string;
  organizationCountry?: string;
  vrsPoints?: number;
  vrsRank?: number;
  cash?: number;
  players?: ManagerCareerPlayerSeed[];
}

export interface ManagerPlayerContract {
  id: string;
  playerId: string;
  playerHandle: string;
  playerRole: string;
  signedOn: string;
  majorCyclesRemaining: number;
  monthlySalary: number;
  buyout: number;
  squadRole: ManagerSquadRole;
  status: ManagerContractStatus;
  salaryModelVersion?: number;
}

export interface ManagerPlayerDynamics {
  playerId: string;
  morale: number;
  familiarity: number;
  form: number;
  lastUpdatedOn: string;
}

export interface ManagerBoardObjective {
  id: string;
  title: string;
  description: string;
  startingRank: number;
  targetRank: number;
  deadline: string;
  rewardConfidence: number;
  status: ManagerBoardObjectiveStatus;
}

export interface ManagerOfferTerms {
  monthlySalary: number;
  majorCycles: number;
  squadRole: ManagerSquadRole;
}

export interface ManagerMarketOffer extends ManagerOfferTerms {
  id: string;
  playerId: string;
  playerHandle: string;
  submittedOn: string;
  status: ManagerOfferStatus;
  interestScore: number;
}

export interface ManagerTradeOffer {
  id: string;
  incoming: ManagerCareerPlayerSeed;
  outgoing: ManagerCareerPlayerSeed;
  sourceTeamId: string;
  sourceTeamName: string;
  submittedOn: string;
  responseOn: string;
  round: number;
  askingFee: number;
  cashOffered: number;
  incomingSalary: number;
  status: ManagerTradeOfferStatus;
  parentOfferId?: string;
  counterCash?: number;
  rivalBidCash?: number;
  rivalTeamName?: string;
  expiresOn?: string;
  cashReservedOn?: string;
  delayedEventId?: string;
  resolvesOn?: string;
  appliedOn?: string;
  reasons: string[];
}

export interface ManagerIncomingOffer {
  id: string;
  buyerTeamId: string;
  buyerTeamName: string;
  targetPlayer: ManagerCareerPlayerSeed;
  displacedPlayer: ManagerCareerPlayerSeed;
  createdOn: string;
  expiresOn: string;
  cashOffered: number;
  buyerLimit: number;
  status: ManagerIncomingOfferStatus;
  counterCash?: number;
  responseOn?: string;
  appliedOn?: string;
  reasons: string[];
}

export interface ManagerOfferWorldTeam {
  id: string;
  name: string;
  rank?: number;
  players: ManagerCareerPlayerSeed[];
}

export interface ManagerClubRelationship {
  clubId: string;
  clubName: string;
  trust: number;
  approaches: number;
  completedTrades: number;
  failedNegotiations: number;
  lastContactOn?: string;
}

export interface ManagerClubRosterMove {
  id: string;
  clubId: string;
  clubName: string;
  releasedPlayerId: string;
  acquiredPlayer: ManagerCareerPlayerSeed;
  completedOn: string;
}

export interface ManagerTradeProposal {
  incoming: ManagerCareerPlayerSeed;
  outgoing: ManagerCareerPlayerSeed;
  sourceTeamId: string;
  sourceTeamName: string;
  askingFee: number;
  cashOffered: number;
  incomingSalary: number;
}

export interface ManagerMarketState {
  scoutedPlayerIds: string[];
  shortlistedPlayerIds: string[];
  signedPlayerIds: string[];
  offers: ManagerMarketOffer[];
  tradeOffers: ManagerTradeOffer[];
  incomingOffers: ManagerIncomingOffer[];
  clubRelationships: ManagerClubRelationship[];
  rosterMoves: ManagerClubRosterMove[];
  unavailablePlayerIds: string[];
}

export interface ManagerEvent {
  id: string;
  name: string;
  shortName: string;
  tier: ManagerEventTier;
  entryType: ManagerEntryType;
  region: string;
  startsOn: string;
  endsOn: string;
  registrationDeadline: string;
  rosterLockOn: string;
  rankMin: number;
  rankMax: number;
  capacity: number;
  format: ManagerEventFormat;
  formatLabel: string;
  groupBestOf: 1 | 3;
  entryFee: number;
  travelCost: number;
  prizePool: number;
  environment: "Online" | "LAN";
  location: string;
  stakesLabel: string;
  vrsWeight: number;
  hasPlayoffs: boolean;
  majorCycle?: boolean;
  description: string;
  prizes: Record<PlacementTier, number>;
}

export interface ManagerEventSchedule {
  startsOn: string;
  endsOn: string;
  registrationDeadline: string;
  rosterLockOn: string;
}

export interface ManagerRegistration {
  eventId: string;
  status: ManagerRegistrationStatus;
  registeredOn: string;
  feePaid: number;
  stickerRevenuePaid?: number;
  lockedRosterIds: string[];
  placement?: PlacementTier;
}

export interface ManagerInboxItem {
  id: string;
  kind: ManagerInboxKind;
  createdOn: string;
  title: string;
  body: string;
  eventId?: string;
  offerId?: string;
  deadline?: string;
  rankBefore?: number;
  rankAfter?: number;
  pointsDelta?: number;
  mandatory: boolean;
  read: boolean;
}

export interface ManagerLedgerEntry {
  id: string;
  date: string;
  category: "starting-balance" | "entry" | "travel" | "prize" | "sticker" | "withdrawal" | "payroll" | "scouting" | "signing" | "transfer" | "release" | "development" | "casino";
  description: string;
  amount: number;
  eventId?: string;
}

export interface ManagerCareerState {
  version: number;
  status: ManagerCareerStatus;
  endedOn?: string;
  endReason?: string;
  seed: string;
  date: string;
  season: number;
  organizationId: string;
  organizationName: string;
  organizationCountry: string;
  cash: number;
  vrsPoints: number;
  vrsRank: number;
  reputation: number;
  boardConfidence: number;
  activeEventId?: string;
  activeMajorStage?: ManagerMajorStage;
  registrations: ManagerRegistration[];
  completedEventIds: string[];
  contracts: ManagerPlayerContract[];
  playerDynamics: ManagerPlayerDynamics[];
  trainingPlans: ManagerTrainingPlan[];
  performanceCamps: ManagerPerformanceCamp[];
  casinoVisits: ManagerCasinoVisit[];
  boardObjective: ManagerBoardObjective;
  market: ManagerMarketState;
  inbox: ManagerInboxItem[];
  ledger: ManagerLedgerEntry[];
}

export interface ManagerEligibility {
  eligible: boolean;
  reasons: string[];
  totalCost: number;
}

export interface ManagerPerformanceCampEligibility {
  eligible: boolean;
  reasons: string[];
  startsOn: string;
  endsOn: string;
}

export function isCurrentManagerWorldRoster(roster: { era: string; year: string }) {
  return roster.era === "CS2" && Number.parseInt(roster.year, 10) >= 2026;
}

export function resolveManagerOrganization<T extends { id: string; name: string }>(
  rosters: readonly T[],
  organizationId?: string,
  organizationName?: string,
) {
  const direct = organizationId ? rosters.find((roster) => roster.id === organizationId) : undefined;
  if (direct || !organizationName?.trim()) return direct;
  const normalizedName = organizationName.trim().toLowerCase();
  return rosters.find((roster) => roster.name.trim().toLowerCase() === normalizedName);
}

function prizeDistribution(pool: number): Record<PlacementTier, number> {
  return {
    swiss: Math.round(pool * 0.005),
    top8: Math.round(pool * 0.04),
    top4: Math.round(pool * 0.1),
    "runner-up": Math.round(pool * 0.2),
    champion: Math.round(pool * 0.4),
  };
}

export const managerEvents: ManagerEvent[] = [
  {
    id: "frontier-open-2026",
    name: "Frontier Open 2026",
    shortName: "Frontier Open",
    tier: "open",
    entryType: "open",
    region: "Global",
    startsOn: "2026-07-27",
    endsOn: "2026-08-02",
    registrationDeadline: "2026-07-23",
    rosterLockOn: "2026-07-25",
    rankMin: 20,
    rankMax: 64,
    capacity: 8,
    format: "single-elimination",
    formatLabel: "8-team open entry / single elimination",
    groupBestOf: 1,
    entryFee: 2_000,
    travelCost: 4_000,
    prizePool: 50_000,
    environment: "Online",
    location: "Global servers",
    stakesLabel: "$50,000 cash and VRS points; no qualification berth is attached.",
    vrsWeight: 0.75,
    hasPlayoffs: true,
    description: "A compact open-entry cup. Lose once and the event is over; later rounds move to longer series.",
    prizes: prizeDistribution(50_000),
  },
  {
    id: "global-challenger-2026",
    name: "Global Challenger Series 2026",
    shortName: "Global Challenger",
    tier: "challenger",
    entryType: "vrs",
    region: "Global",
    startsOn: "2026-08-10",
    endsOn: "2026-08-16",
    registrationDeadline: "2026-08-03",
    rosterLockOn: "2026-08-07",
    rankMin: 10,
    rankMax: 48,
    capacity: 16,
    format: "swiss",
    formatLabel: "16-team Swiss / top 8 playoffs",
    groupBestOf: 1,
    entryFee: 3_500,
    travelCost: 5_000,
    prizePool: 100_000,
    environment: "Online",
    location: "Global servers",
    stakesLabel: "$100,000 cash and a medium VRS weighting toward later invitations.",
    vrsWeight: 1,
    hasPlayoffs: true,
    description: "A VRS-seeded challenger event with enough weight to reshape the invitation race.",
    prizes: prizeDistribution(100_000),
  },
  {
    id: "pro-league-challenger-2026",
    name: "Pro League Challenger 2026",
    shortName: "Pro League",
    tier: "challenger",
    entryType: "vrs",
    region: "Global",
    startsOn: "2026-09-14",
    endsOn: "2026-09-20",
    registrationDeadline: "2026-09-04",
    rosterLockOn: "2026-09-10",
    rankMin: 8,
    rankMax: 40,
    capacity: 8,
    format: "round-robin",
    formatLabel: "8-team round robin / top 4 playoffs",
    groupBestOf: 3,
    entryFee: 5_000,
    travelCost: 7_000,
    prizePool: 250_000,
    environment: "LAN",
    location: "European studio",
    stakesLabel: "$250,000 cash; the top four reach the playoff bracket after league play.",
    vrsWeight: 1.35,
    hasPlayoffs: true,
    description: "A league stop where every team meets once before the top four advance to a knockout playoff.",
    prizes: prizeDistribution(250_000),
  },
  {
    id: "new-york-elite-2026",
    name: "New York Elite 2026",
    shortName: "New York Elite",
    tier: "elite",
    entryType: "invite",
    region: "Global",
    startsOn: "2026-10-05",
    endsOn: "2026-10-11",
    registrationDeadline: "2026-09-21",
    rosterLockOn: "2026-09-30",
    rankMin: 1,
    rankMax: 24,
    capacity: 8,
    format: "round-robin",
    formatLabel: "8-team round robin / top 4 playoffs",
    groupBestOf: 3,
    entryFee: 0,
    travelCost: 10_000,
    prizePool: 500_000,
    environment: "LAN",
    location: "New York, US",
    stakesLabel: "$500,000 cash for an eight-team invitation field.",
    vrsWeight: 1.8,
    hasPlayoffs: true,
    description: "An elite invitation league with a full round robin before a four-team championship bracket.",
    prizes: prizeDistribution(500_000),
  },
  {
    id: "fall-global-major-2026",
    name: "Fall Global Major 2026",
    shortName: "Global Major",
    tier: "major",
    entryType: "vrs",
    region: "Global",
    startsOn: "2026-10-19",
    endsOn: "2026-11-22",
    registrationDeadline: "2026-10-12",
    rosterLockOn: "2026-10-17",
    rankMin: 1,
    rankMax: 64,
    capacity: 16,
    format: "swiss",
    formatLabel: "VRS-seeded path / MRQ through Stage 3",
    groupBestOf: 1,
    entryFee: 0,
    travelCost: 0,
    prizePool: 1_250_000,
    environment: "LAN",
    location: "Location TBA",
    stakesLabel: "Valve covers entry and travel. MRQ and Stages 1-2 award advancement only; the $1.25m purse is paid from final Major placement.",
    vrsWeight: 2.6,
    hasPlayoffs: true,
    majorCycle: true,
    description: "A Valve-funded Major entry automatically seeded by VRS into the MRQ, Stage 1, Stage 2, or Stage 3.",
    prizes: prizeDistribution(1_250_000),
  },
];

const managerMajorStageDetails: Record<ManagerMajorStage, { label: string; startsOn: string; rankMin: number; rankMax: number }> = {
  mrq: { label: "MRQ", startsOn: "2026-10-19", rankMin: 25, rankMax: 64 },
  "stage-1": { label: "Stage 1", startsOn: "2026-10-26", rankMin: 17, rankMax: 24 },
  "stage-2": { label: "Stage 2", startsOn: "2026-11-02", rankMin: 9, rankMax: 16 },
  "stage-3": { label: "Stage 3", startsOn: "2026-11-09", rankMin: 1, rankMax: 8 },
};

function shiftManagerSeasonDate(date: string, season: number) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCMonth(shifted.getUTCMonth() + Math.max(0, season - 1) * 6);
  return shifted.toISOString().slice(0, 10);
}

export function managerSeasonStartDate(season: number) {
  return shiftManagerSeasonDate(MANAGER_START_DATE, season);
}

export function managerSeasonLabel(season: number) {
  const start = new Date(`${managerSeasonStartDate(season)}T00:00:00Z`);
  return `${start.getUTCMonth() < 6 ? "Spring" : "Fall"} ${start.getUTCFullYear()}`;
}

export function managerEventSchedule(event: ManagerEvent, season: number): ManagerEventSchedule {
  return {
    startsOn: shiftManagerSeasonDate(event.startsOn, season),
    endsOn: shiftManagerSeasonDate(event.endsOn, season),
    registrationDeadline: shiftManagerSeasonDate(event.registrationDeadline, season),
    rosterLockOn: shiftManagerSeasonDate(event.rosterLockOn, season),
  };
}

export function managerEventName(event: ManagerEvent, season: number) {
  if (season === 1) return event.name;
  const [cycle, year] = managerSeasonLabel(season).split(" ");
  if (event.majorCycle) return event.name.replace(/^(Fall|Spring)/, cycle).replace(/\d{4}$/, year);
  return event.name.replace(/\s+(Fall|Spring)?\s*\d{4}$/, ` ${cycle} ${year}`);
}

export function managerMajorEntryStage(vrsRank: number): ManagerMajorStage {
  if (vrsRank <= 8) return "stage-3";
  if (vrsRank <= 16) return "stage-2";
  if (vrsRank <= 24) return "stage-1";
  return "mrq";
}

export function managerMajorStageLabel(stage: ManagerMajorStage) {
  return managerMajorStageDetails[stage].label;
}

export function managerMajorStageHasPlayoffs(stage: ManagerMajorStage) {
  return stage === "stage-3";
}

const managerMajorStickerRevenueByStage: Record<ManagerMajorStage, number> = {
  mrq: 0,
  "stage-1": 400_000,
  "stage-2": 550_000,
  "stage-3": 700_000,
};

export const MANAGER_MAJOR_CHAMPIONS_CAPSULE_REVENUE = 500_000;

export function managerMajorStickerRevenue(stage: ManagerMajorStage) {
  return managerMajorStickerRevenueByStage[stage];
}

export function managerMajorStageStakes(stage: ManagerMajorStage) {
  if (stage === "mrq") return "Top 8 advance to Stage 1 and unlock $400,000 in sticker revenue";
  if (stage === "stage-1") return "$400,000 sticker share guaranteed; Stage 2 raises the share to $550,000";
  if (stage === "stage-2") return "$550,000 sticker share guaranteed; Stage 3 raises the share to $700,000";
  return "$700,000 sticker share guaranteed; the champion earns another $500,000 from the Champions Capsule";
}

export function managerEventPayoutTotal(event: ManagerEvent) {
  return event.prizes.champion
    + event.prizes["runner-up"]
    + event.prizes.top4 * 2
    + event.prizes.top8 * 4
    + event.prizes.swiss * 8;
}

export function managerMajorStageStart(stage: ManagerMajorStage, season = 1) {
  return shiftManagerSeasonDate(managerMajorStageDetails[stage].startsOn, season);
}

export function managerMajorStageEnd(stage: ManagerMajorStage, season = 1) {
  if (stage === "stage-3") {
    const event = managerEventById("fall-global-major-2026");
    return event ? managerEventSchedule(event, season).endsOn : shiftManagerSeasonDate("2026-11-22", season);
  }
  const stages: ManagerMajorStage[] = ["mrq", "stage-1", "stage-2", "stage-3"];
  const nextStage = stages[stages.indexOf(stage) + 1];
  const nextStart = new Date(`${managerMajorStageStart(nextStage, season)}T00:00:00Z`);
  nextStart.setUTCDate(nextStart.getUTCDate() - 1);
  return nextStart.toISOString().slice(0, 10);
}

export function managerMajorProjection(vrsRank: number, season = 1) {
  const stage = managerMajorEntryStage(vrsRank);
  return {
    stage,
    ...managerMajorStageDetails[stage],
    startsOn: managerMajorStageStart(stage, season),
  };
}

export function managerEventStartForRank(event: ManagerEvent, vrsRank: number, season = 1) {
  return event.majorCycle
    ? managerMajorStageStart(managerMajorEntryStage(vrsRank), season)
    : managerEventSchedule(event, season).startsOn;
}

function inboxId(state: ManagerCareerState, suffix: string) {
  return `${state.seed}:${state.date}:${suffix}:${state.inbox.length}`;
}

function ledgerId(state: ManagerCareerState, suffix: string) {
  return `${state.seed}:${state.date}:${suffix}:${state.ledger.length}`;
}

function rangesOverlap(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) {
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function stableHash(value: string) {
  return Math.abs(value.split("").reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 17));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function adjustPlayerMorale(state: ManagerCareerState, playerId: string, delta: number, date: string) {
  return {
    ...state,
    playerDynamics: state.playerDynamics.map((item) => item.playerId === playerId
      ? { ...item, morale: clampScore(item.morale + delta), lastUpdatedOn: date }
      : item),
  };
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export interface ManagerSalaryContext {
  vrsRank?: number;
  organizationCountry?: string;
}

const cisSalaryCountries = new Set(["AM", "AZ", "BY", "GE", "KZ", "KG", "MD", "RU", "TJ", "TM", "UA", "UZ"]);

export function managerRecommendedSalary(
  player: ManagerCareerPlayerSeed,
  context: ManagerSalaryContext = {},
) {
  const rank = context.vrsRank ?? 32;
  const currentQuality = 900
    + Math.max(0, player.ovr - 58) * 115
    + Math.max(0, player.ovr - 76) * 220
    + Math.max(0, player.ovr - 86) * 450;
  const upside = Math.max(0, (player.potential ?? player.ovr) - player.ovr) * 90;
  const youngPremium = (player.age ?? 24) <= 20 ? 250 : 0;
  const clubMultiplier = rank <= 5 ? 2.8 : rank <= 10 ? 2 : rank <= 20 ? 1.35 : rank <= 35 ? 0.8 : rank <= 50 ? 0.62 : 0.5;
  const country = context.organizationCountry?.toUpperCase();
  const regionalMultiplier = country && cisSalaryCountries.has(country) && rank > 15 ? 0.72 : 1;
  const tierCap = rank <= 5 ? 45_000 : rank <= 10 ? 28_000 : rank <= 20 ? 15_000 : rank <= 35 ? 6_500 : rank <= 50 ? 4_500 : 3_500;
  const regionalCap = country && cisSalaryCountries.has(country) && rank > 20 ? 4_000 : tierCap;
  const floor = rank <= 20 ? 2_500 : 1_000;
  return Math.max(floor, Math.min(regionalCap, roundTo((currentQuality + upside + youngPremium) * clubMultiplier * regionalMultiplier, 250)));
}

export function createManagerContracts(
  seed: string,
  players: ManagerCareerPlayerSeed[],
  context: ManagerSalaryContext = {},
) {
  const qualityOrder = [...players]
    .sort((left, right) => right.ovr - left.ovr || left.handle.localeCompare(right.handle))
    .map((player) => player.id);
  return players.map((player): ManagerPlayerContract => {
    const salary = managerRecommendedSalary(player, context);
    const majorCyclesRemaining = 1 + (stableHash(`${seed}:${player.id}:duration`) % 4);
    const upside = Math.max(0, (player.potential ?? player.ovr) - player.ovr);
    const squadRole: ManagerSquadRole = qualityOrder[0] === player.id
      ? "star"
      : (player.age ?? 24) <= 20 && upside >= 3
        ? "prospect"
        : "starter";
    return {
      id: `${seed}:contract:${player.id}`,
      playerId: player.id,
      playerHandle: player.handle,
      playerRole: player.role,
      signedOn: MANAGER_START_DATE,
      majorCyclesRemaining,
      monthlySalary: salary,
      buyout: Math.max(25_000, roundTo(salary * majorCyclesRemaining * 8, 5_000)),
      squadRole,
      status: "active",
      salaryModelVersion: MANAGER_SALARY_MODEL_VERSION,
    };
  });
}

export function managerMonthlyPayroll(state: Pick<ManagerCareerState, "contracts">) {
  return state.contracts
    .filter((contract) => contract.status !== "expired")
    .reduce((total, contract) => total + contract.monthlySalary, 0);
}

function createPlayerDynamics(
  seed: string,
  contracts: ManagerPlayerContract[],
  date = MANAGER_START_DATE,
) {
  return contracts.map((contract): ManagerPlayerDynamics => ({
    playerId: contract.playerId,
    morale: 64 + stableHash(`${seed}:${contract.playerId}:morale`) % 15,
    familiarity: contract.status === "active"
      ? 72 + stableHash(`${seed}:${contract.playerId}:familiarity`) % 13
      : 28 + stableHash(`${seed}:${contract.playerId}:familiarity`) % 13,
    form: 48 + stableHash(`${seed}:${contract.playerId}:form`) % 7,
    lastUpdatedOn: date,
  }));
}

function defaultManagerTrainingFocus(player: ManagerCareerPlayerSeed): ManagerTrainingFocus {
  if (player.role === "IGL" || player.role === "Support") return "tactics";
  if (player.role === "AWP") return "role";
  if ((player.age ?? 24) <= 21) return "mechanics";
  return "balanced";
}

function createManagerTrainingPlan(player: ManagerCareerPlayerSeed, date: string): ManagerTrainingPlan {
  return {
    playerId: player.id,
    focus: defaultManagerTrainingFocus(player),
    progress: 0,
    currentOvr: player.ovr,
    potentialOvr: Math.max(player.ovr, player.potential ?? player.ovr),
    currentStats: player.stats ? { ...player.stats } : undefined,
    lastOvrChange: 0,
    lastUpdatedOn: date,
    potentialLabAttempts: 0,
    potentialLabWins: 0,
  };
}

function createManagerTrainingPlans(players: ManagerCareerPlayerSeed[], date: string) {
  return players.map((player) => createManagerTrainingPlan(player, date));
}

export function managerTrainingPlan(
  state: Pick<ManagerCareerState, "trainingPlans" | "date">,
  player: ManagerCareerPlayerSeed,
) {
  return state.trainingPlans.find((plan) => plan.playerId === player.id)
    ?? createManagerTrainingPlan(player, state.date);
}

export function setManagerTrainingFocus(
  state: ManagerCareerState,
  player: ManagerCareerPlayerSeed,
  focus: ManagerTrainingFocus,
): ManagerCareerState {
  if (state.activeEventId) return state;
  const current = managerTrainingPlan(state, player);
  return {
    ...state,
    trainingPlans: [
      ...state.trainingPlans.filter((plan) => plan.playerId !== player.id),
      { ...current, focus, lastUpdatedOn: state.date },
    ],
  };
}

export function managerPotentialCoinResult(
  state: Pick<ManagerCareerState, "seed" | "date" | "trainingPlans">,
  player: ManagerCareerPlayerSeed,
): ManagerCoinSide {
  const attempts = state.trainingPlans.find((plan) => plan.playerId === player.id)?.potentialLabAttempts ?? 0;
  return stableHash(`${state.seed}:${state.date}:potential-lab:${player.id}:${attempts + 1}`) % 2 === 0 ? "heads" : "tails";
}

export function managerPotentialLabCost(
  state: Pick<ManagerCareerState, "trainingPlans" | "date">,
  player: ManagerCareerPlayerSeed,
) {
  const potential = managerTrainingPlan(state, player).potentialOvr;
  if (potential < 70) return 25_000;
  if (potential < 75) return 40_000;
  if (potential < 80) return 60_000;
  if (potential < 85) return 85_000;
  if (potential < 90) return 120_000;
  if (potential < 95) return 160_000;
  if (potential < 100) return MANAGER_POTENTIAL_LAB_ELITE_COST;
  return Math.min(500_000, 250_000 + Math.max(0, potential - 100) * 25_000);
}

export function resolveManagerPotentialInvestment(
  state: ManagerCareerState,
  player: ManagerCareerPlayerSeed,
  choice: ManagerCoinSide,
  result: ManagerCoinSide,
): ManagerCareerState {
  const cost = managerPotentialLabCost(state, player);
  if (state.status !== "active" || state.cash < cost) return state;
  const contract = state.contracts.find((item) => item.playerId === player.id && item.status !== "expired");
  if (!contract) return state;
  const current = managerTrainingPlan(state, player);
  const won = choice === result;
  const attempts = (current.potentialLabAttempts ?? 0) + 1;
  const currentPotential = Math.max(current.currentOvr, current.potentialOvr ?? player.potential ?? player.ovr);
  const potentialOvr = won ? currentPotential + 1 : currentPotential;
  const transactionId = `${state.seed}:${state.date}:potential-lab:${player.id}:${attempts}`;
  return {
    ...state,
    cash: state.cash - cost,
    trainingPlans: [
      ...state.trainingPlans.filter((plan) => plan.playerId !== player.id),
      {
        ...current,
        potentialOvr,
        potentialLabAttempts: attempts,
        potentialLabWins: (current.potentialLabWins ?? 0) + (won ? 1 : 0),
        lastPotentialLabOn: state.date,
        lastUpdatedOn: state.date,
      },
    ],
    inbox: [
      {
        id: `${transactionId}:result`,
        kind: "finance",
        createdOn: state.date,
        title: won ? `${player.handle} wins the Potential Lab flip` : `${player.handle} misses the Potential Lab flip`,
        body: won
          ? `${player.handle} called ${choice}, the coin landed ${result}, and their potential increased to ${potentialOvr}.`
          : `${player.handle} called ${choice}, but the coin landed ${result}. Their potential remains ${potentialOvr}.`,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
    ledger: [
      ...state.ledger,
      {
        id: transactionId,
        date: state.date,
        category: "development",
        description: `Potential Lab: ${player.handle} called ${choice} (${won ? "won" : "lost"})`,
        amount: -cost,
      },
    ],
  };
}

export function managerCasinoCoinResult(
  state: Pick<ManagerCareerState, "seed" | "date" | "casinoVisits">,
  player: Pick<ManagerCareerPlayerSeed, "id">,
  stake: ManagerCasinoStake,
): ManagerCoinSide {
  return stableHash(`${state.seed}:${state.date}:casino:${player.id}:${stake}:${state.casinoVisits.length + 1}`) % 2 === 0
    ? "heads"
    : "tails";
}

export function managerCasinoVisitAllowed(
  state: Pick<ManagerCareerState, "status" | "activeEventId" | "cash" | "date" | "casinoVisits" | "contracts">,
  player: Pick<ManagerCareerPlayerSeed, "id">,
  stake: ManagerCasinoStake,
) {
  const reasons: string[] = [];
  if (state.status !== "active") reasons.push("The manager career has ended");
  if (state.activeEventId) reasons.push("Casino nights are unavailable during an active tournament");
  if (!MANAGER_CASINO_STAKES.includes(stake)) reasons.push("Choose a listed table stake");
  if (state.cash < stake) reasons.push(`Requires $${stake.toLocaleString()} available cash`);
  if (state.casinoVisits.some((visit) => visit.date === state.date)) reasons.push("The club has already used tonight's casino visit");
  if (!state.contracts.some((contract) => contract.playerId === player.id && contract.status !== "expired")) {
    reasons.push("Choose a contracted player");
  }
  return { allowed: reasons.length === 0, reasons };
}

export function resolveManagerCasinoVisit(
  state: ManagerCareerState,
  player: ManagerCareerPlayerSeed,
  stake: ManagerCasinoStake,
  choice: ManagerCoinSide,
  result: ManagerCoinSide,
): ManagerCareerState {
  const eligibility = managerCasinoVisitAllowed(state, player, stake);
  if (!eligibility.allowed) return state;
  const won = choice === result;
  const net = won ? stake : -stake;
  const visitNumber = state.casinoVisits.length + 1;
  const id = `${state.seed}:${state.date}:casino:${visitNumber}`;
  return {
    ...state,
    cash: state.cash + net,
    casinoVisits: [
      ...state.casinoVisits,
      {
        id,
        playerId: player.id,
        playerHandle: player.handle,
        date: state.date,
        stake,
        choice,
        result,
        net,
      },
    ],
    playerDynamics: state.playerDynamics.map((item) => item.playerId === player.id
      ? {
          ...item,
          morale: clampScore(item.morale + (won ? 6 : -5)),
          form: clampScore(item.form + (won ? 2 : -2)),
          lastUpdatedOn: state.date,
        }
      : item),
    inbox: [
      {
        id: `${id}:result`,
        kind: "finance",
        createdOn: state.date,
        title: won ? `${player.handle} wins at casino night` : `${player.handle} loses at casino night`,
        body: `${player.handle} called ${choice}; the coin landed ${result}. The club ${won ? "won" : "lost"} $${stake.toLocaleString()}.`,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
    ledger: [
      ...state.ledger,
      {
        id,
        date: state.date,
        category: "casino",
        description: `Casino night: ${player.handle} called ${choice}`,
        amount: net,
      },
    ],
  };
}

export function managerActivePerformanceCamp(state: Pick<ManagerCareerState, "performanceCamps">) {
  return state.performanceCamps.find((camp) => camp.status === "active");
}

export function managerPerformanceCampEligibility(
  state: ManagerCareerState,
  focus: ManagerPerformanceCampFocus,
): ManagerPerformanceCampEligibility {
  const program = managerPerformanceCampPrograms.find((item) => item.id === focus)!;
  const startsOn = addDays(state.date, 1);
  const endsOn = addDays(state.date, program.durationDays);
  const reasons: string[] = [];
  if (state.status !== "active") reasons.push("The manager career has ended");
  if (state.activeEventId) reasons.push("An event is currently in progress");
  if (managerActivePerformanceCamp(state)) reasons.push("Another performance camp is already active");
  if (state.cash < program.cost) reasons.push(`The program requires $${program.cost.toLocaleString()} in available cash`);
  if (state.contracts.filter((contract) => contract.status !== "expired").length < 5) reasons.push("At least five contracted players are required");
  const conflict = state.registrations.find((registration) => {
    if (registration.status !== "confirmed" && registration.status !== "active") return false;
    const event = managerEventById(registration.eventId);
    if (!event) return false;
    const eventStartsOn = managerEventStartForRank(event, state.vrsRank, state.season);
    const eventEndsOn = event.majorCycle
      ? managerMajorStageEnd(managerMajorEntryStage(state.vrsRank), state.season)
      : managerEventSchedule(event, state.season).endsOn;
    return rangesOverlap(startsOn, endsOn, eventStartsOn, eventEndsOn);
  });
  if (conflict) {
    const event = managerEventById(conflict.eventId)!;
    reasons.push(`${managerEventName(event, state.season)} overlaps the seven-day camp window`);
  }
  return { eligible: reasons.length === 0, reasons, startsOn, endsOn };
}

export function scheduleManagerPerformanceCamp(
  state: ManagerCareerState,
  focus: ManagerPerformanceCampFocus,
): ManagerCareerState {
  const program = managerPerformanceCampPrograms.find((item) => item.id === focus);
  if (!program) return state;
  const eligibility = managerPerformanceCampEligibility(state, focus);
  if (!eligibility.eligible) return state;
  const camp: ManagerPerformanceCamp = {
    id: `${state.seed}:${state.date}:performance-camp:${focus}:${state.performanceCamps.length + 1}`,
    focus,
    bookedOn: state.date,
    startsOn: eligibility.startsOn,
    endsOn: eligibility.endsOn,
    cost: program.cost,
    status: "active",
  };
  return {
    ...state,
    cash: state.cash - program.cost,
    performanceCamps: [...state.performanceCamps, camp],
    ledger: [
      ...state.ledger,
      {
        id: ledgerId(state, `performance-camp:${focus}`),
        date: state.date,
        category: "development",
        description: `${program.name} booking`,
        amount: -program.cost,
      },
    ],
    inbox: [
      {
        id: inboxId(state, `performance-camp:${focus}`),
        kind: "event",
        createdOn: state.date,
        title: `${program.name} booked`,
        body: `${program.department} will run from ${eligibility.startsOn} through ${eligibility.endsOn}. ${program.benefit}.`,
        deadline: eligibility.endsOn,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
}

function resolveManagerPerformanceCamps(state: ManagerCareerState, nextDate: string): ManagerCareerState {
  const completed = state.performanceCamps.filter((camp) => camp.status === "active" && camp.endsOn <= nextDate);
  if (!completed.length) return state;
  const starterIds = new Set(state.contracts.filter((contract) => contract.status === "active").map((contract) => contract.playerId));
  const contractedIds = new Set(state.contracts.filter((contract) => contract.status !== "expired").map((contract) => contract.playerId));
  let playerDynamics = state.playerDynamics;
  let trainingPlans = state.trainingPlans;
  const resultItems: ManagerInboxItem[] = [];
  completed.forEach((camp) => {
    const program = managerPerformanceCampPrograms.find((item) => item.id === camp.focus)!;
    playerDynamics = playerDynamics.map((item) => {
      if (!contractedIds.has(item.playerId)) return item;
      if (camp.focus === "tactical") {
        return {
          ...item,
          familiarity: clampScore(item.familiarity + (starterIds.has(item.playerId) ? 7 : 2)),
          morale: clampScore(item.morale + 2),
          lastUpdatedOn: camp.endsOn,
        };
      }
      if (camp.focus === "mechanics") {
        return {
          ...item,
          form: clampScore(item.form + 5),
          morale: clampScore(item.morale - 1),
          lastUpdatedOn: camp.endsOn,
        };
      }
      return {
        ...item,
        morale: clampScore(item.morale + 10),
        form: clampScore(item.form + 8),
        familiarity: clampScore(item.familiarity + (starterIds.has(item.playerId) ? 2 : 0)),
        lastUpdatedOn: camp.endsOn,
      };
    });
    if (camp.focus !== "recovery") {
      const progress = camp.focus === "mechanics" ? 24 : 8;
      trainingPlans = trainingPlans.map((plan) => contractedIds.has(plan.playerId)
        ? { ...plan, progress: plan.currentOvr < plan.potentialOvr ? plan.progress + progress : 0, lastUpdatedOn: camp.endsOn }
        : plan);
    }
    resultItems.push({
      id: `${camp.id}:complete`,
      kind: "result",
      createdOn: camp.endsOn,
      title: `${program.name} complete`,
      body: `${program.benefit}. The performance department has applied the gains to the current squad.`,
      mandatory: false,
      read: false,
    });
  });
  const completedIds = new Set(completed.map((camp) => camp.id));
  return {
    ...state,
    playerDynamics,
    trainingPlans,
    performanceCamps: state.performanceCamps.map((camp) => completedIds.has(camp.id) ? { ...camp, status: "completed" as const } : camp),
    inbox: [...resultItems.reverse(), ...state.inbox],
  };
}

function managerTrainingAgeBase(age: number) {
  if (age <= 19) return 32;
  if (age <= 22) return 25;
  if (age <= 25) return 18;
  if (age <= 28) return 12;
  return 7;
}

function improveManagerTrainingStats(
  stats: PlayerStats,
  role: Player["role"],
  focus: ManagerTrainingFocus,
  gain: number,
) {
  const next = { ...stats };
  const add = (key: keyof PlayerStats, amount: number) => {
    next[key] = Math.max(50, Math.min(99, next[key] + amount));
  };
  if (focus === "mechanics") {
    add("aim", gain * 2);
    add("clutch", gain);
  } else if (focus === "tactics") {
    add("consistency", gain * 2);
    add("igl", gain);
  } else if (focus === "role") {
    if (role === "AWP") add("awp", gain * 2);
    else if (role === "IGL") add("igl", gain * 2);
    else if (role === "Support") add("consistency", gain * 2);
    else {
      add("aim", gain);
      add("consistency", gain);
    }
  } else if (focus === "balanced") {
    add("aim", gain);
    add("consistency", gain);
  } else {
    add("consistency", gain);
  }
  return next;
}

export function resolveManagerTrainingCycle(
  state: ManagerCareerState,
  players: Player[],
  playerRatings: Record<string, number>,
  placement: PlacementTier,
): { state: ManagerCareerState; players: Player[]; reports: ManagerTrainingReport[] } {
  const activeIds = new Set(state.contracts
    .filter((contract) => contract.status !== "expired")
    .map((contract) => contract.playerId));
  const planByPlayer = new Map(state.trainingPlans.map((plan) => [plan.playerId, plan]));
  const placementBonus = placement === "champion" ? 8 : placement === "runner-up" ? 6 : placement === "top4" ? 4 : placement === "top8" ? 2 : 0;
  const reports: ManagerTrainingReport[] = [];
  const nextPlans: ManagerTrainingPlan[] = [];
  const nextPlayers = players.map((player) => {
    if (!activeIds.has(player.id)) return player;
    const plan = planByPlayer.get(player.id) ?? createManagerTrainingPlan(player, state.date);
    const before = plan.currentOvr ?? player.ovr;
    const potential = Math.max(before, plan.potentialOvr ?? player.potential ?? before);
    const rating = playerRatings[player.id];
    const played = Number.isFinite(rating);
    const performancePoints = played
      ? Math.max(-18, Math.min(30, Math.round((rating - expectedRating(before)) * 120)))
      : 0;
    const focusBonus = plan.focus === "recovery" ? 0 : plan.focus === "balanced" ? 6 : 10;
    const participation = played ? 1 : 0.48;
    const rawProgress = (managerTrainingAgeBase(player.age ?? 24) + focusBonus + performancePoints + placementBonus) * participation;
    const progressEarned = before < potential
      ? Math.max(3, Math.round(rawProgress * (plan.focus === "recovery" ? 0.45 : 1)))
      : 0;
    const accumulated = plan.progress + progressEarned;
    const ovrGain = accumulated >= 100 && before < potential ? 1 : 0;
    const after = Math.min(potential, before + ovrGain);
    const currentStats = improveManagerTrainingStats(plan.currentStats ?? player.stats, player.role, plan.focus, ovrGain);
    nextPlans.push({
      ...plan,
      progress: before < potential ? accumulated - ovrGain * 100 : 0,
      currentOvr: after,
      currentStats,
      lastRating: played ? rating : plan.lastRating,
      lastOvrChange: ovrGain,
      lastUpdatedOn: state.date,
    });
    reports.push({
      playerId: player.id,
      handle: player.handle,
      focus: plan.focus,
      progressEarned,
      before,
      after,
      rating: played ? rating : undefined,
    });
    return { ...player, ovr: after, potential, stats: currentStats };
  });
  state.trainingPlans.forEach((plan) => {
    if (!activeIds.has(plan.playerId) || nextPlans.some((item) => item.playerId === plan.playerId)) return;
    nextPlans.push(plan);
  });
  const recoveryIds = new Set(nextPlans.filter((plan) => plan.focus === "recovery").map((plan) => plan.playerId));
  const playerDynamics = state.playerDynamics.map((item) => recoveryIds.has(item.playerId)
    ? {
        ...item,
        morale: clampScore(item.morale + 7),
        form: clampScore(item.form + 6),
        lastUpdatedOn: state.date,
      }
    : item);
  return {
    state: { ...state, trainingPlans: nextPlans, playerDynamics },
    players: nextPlayers,
    reports,
  };
}

function createBoardObjective(seed: string, vrsRank: number, season = 1): ManagerBoardObjective {
  const targetRank = vrsRank === 1 ? 1 : vrsRank <= 3 ? 1 : vrsRank <= 8 ? 3 : vrsRank <= 16 ? 8 : vrsRank <= 24 ? 16 : 24;
  const title = vrsRank === 1
    ? "Defend the VRS No. 1 ranking"
    : `Reach the VRS top ${targetRank}`;
  const cycle = managerSeasonLabel(season).split(" ")[0];
  return {
    id: `${seed}:board:season-${season}-vrs`,
    title,
    description: vrsRank === 1
      ? `Remain the world's top-ranked team through the ${cycle} Major cycle.`
      : `Move from VRS #${vrsRank} to #${targetRank} or better before the ${cycle} Major cycle closes.`,
    startingRank: vrsRank,
    targetRank,
    deadline: managerMajorStageEnd("stage-3", season),
    rewardConfidence: 6,
    status: "active",
  };
}

export function managerPlayerDynamics(
  state: Pick<ManagerCareerState, "playerDynamics">,
  playerId: string,
) {
  return state.playerDynamics.find((item) => item.playerId === playerId);
}

export function managerTeamFamiliarity(
  state: Pick<ManagerCareerState, "contracts" | "playerDynamics">,
) {
  const activeIds = new Set(state.contracts.filter((contract) => contract.status === "active").map((contract) => contract.playerId));
  const values = state.playerDynamics.filter((item) => activeIds.has(item.playerId)).map((item) => item.familiarity);
  return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0;
}

export function managerTeamForm(
  state: Pick<ManagerCareerState, "contracts" | "playerDynamics">,
) {
  const activeIds = new Set(state.contracts.filter((contract) => contract.status === "active").map((contract) => contract.playerId));
  const values = state.playerDynamics.filter((item) => activeIds.has(item.playerId)).map((item) => item.form);
  return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 50;
}

export function managerFinancialStatus(
  state: Pick<ManagerCareerState, "cash" | "contracts">,
) {
  const monthlyPayroll = managerMonthlyPayroll(state);
  const runwayMonths = monthlyPayroll > 0 ? state.cash / monthlyPayroll : Number.POSITIVE_INFINITY;
  const pressure: ManagerFinancialPressure = runwayMonths < 2 ? "critical" : runwayMonths < 4 ? "watch" : "healthy";
  return { monthlyPayroll, runwayMonths, pressure, inDebt: state.cash < 0 };
}

export function managerMoraleLabel(morale: number) {
  if (morale >= 80) return "Excellent";
  if (morale >= 65) return "Positive";
  if (morale >= 45) return "Steady";
  if (morale >= 25) return "Concerned";
  return "Unsettled";
}

export function managerFamiliarityLabel(familiarity: number) {
  if (familiarity >= 85) return "Instinctive";
  if (familiarity >= 70) return "Established";
  if (familiarity >= 50) return "Developing";
  if (familiarity >= 30) return "New core";
  return "Unfamiliar";
}

export function managerFormLabel(form: number) {
  if (form >= 70) return "Hot";
  if (form >= 57) return "Sharp";
  if (form >= 44) return "Steady";
  if (form >= 30) return "Cold";
  return "Slumping";
}

export function managerContractDurationLabel(contract: Pick<ManagerPlayerContract, "majorCyclesRemaining">) {
  const years = contract.majorCyclesRemaining / 2;
  return `${Number.isInteger(years) ? years.toFixed(0) : years.toFixed(1)} ${years === 1 ? "year" : "years"}`;
}

export function managerLineupEditLocked(state: ManagerCareerState) {
  return state.registrations.some((registration) => {
    if (registration.status === "active") return true;
    if (registration.status !== "confirmed") return false;
    const event = managerEventById(registration.eventId);
    if (!event) return false;
    const schedule = managerEventSchedule(event, state.season);
    return state.date >= schedule.rosterLockOn && state.date <= schedule.endsOn;
  });
}

export function setManagerStartingLineup(state: ManagerCareerState, playerIds: string[]): ManagerCareerState {
  const uniqueIds = Array.from(new Set(playerIds));
  const contractedIds = new Set(state.contracts.filter((contract) => contract.status !== "expired").map((contract) => contract.playerId));
  if (uniqueIds.length !== 5 || uniqueIds.some((id) => !contractedIds.has(id)) || managerLineupEditLocked(state)) return state;
  const starterIds = new Set(uniqueIds);
  const previousStarters = new Set(state.contracts.filter((contract) => contract.status === "active").map((contract) => contract.playerId));
  return {
    ...state,
    contracts: state.contracts.map((contract) => contract.status === "expired"
      ? contract
      : { ...contract, status: starterIds.has(contract.playerId) ? "active" as const : "bench" as const }),
    playerDynamics: state.playerDynamics.map((item) => {
      const promoted = starterIds.has(item.playerId) && !previousStarters.has(item.playerId);
      const benched = !starterIds.has(item.playerId) && previousStarters.has(item.playerId);
      if (!promoted && !benched) return item;
      return {
        ...item,
        morale: clampScore(item.morale + (promoted ? 1 : -2)),
        lastUpdatedOn: state.date,
      };
    }),
    registrations: state.registrations.map((registration) => {
      const event = managerEventById(registration.eventId);
      if (registration.status !== "confirmed" || !event || state.date >= managerEventSchedule(event, state.season).rosterLockOn) return registration;
      return { ...registration, lockedRosterIds: uniqueIds };
    }),
    inbox: [
      {
        id: inboxId(state, `lineup:${uniqueIds.join(":")}`),
        kind: "event",
        createdOn: state.date,
        title: "Starting five updated",
        body: "The new lineup will be used for future events and any registration that has not reached roster lock.",
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
}

function createManagerMarketState(): ManagerMarketState {
  return {
    scoutedPlayerIds: [],
    shortlistedPlayerIds: [],
    signedPlayerIds: [],
    offers: [],
    tradeOffers: [],
    incomingOffers: [],
    clubRelationships: [],
    rosterMoves: [],
    unavailablePlayerIds: [],
  };
}

function organizationStartingCash(rank: number, contracts: ManagerPlayerContract[]) {
  const rankBudget = rank <= 8 ? 500_000 : rank <= 16 ? 350_000 : rank <= 24 ? 250_000 : rank <= 40 ? 175_000 : 130_000;
  const sixMonthsPayroll = contracts.reduce((total, contract) => total + contract.monthlySalary, 0) * 6;
  return Math.max(rankBudget, sixMonthsPayroll + 50_000);
}

function reputationForRank(rank: number) {
  return Math.max(38, Math.min(88, 92 - rank * 1.35));
}

export function managerEventById(id: string | undefined) {
  return managerEvents.find((event) => event.id === id);
}

const legacyManagerMajorStages: Record<string, ManagerMajorStage> = {
  "fall-mrq-2026": "mrq",
  "fall-major-mrq-2026": "mrq",
  "fall-major-stage-1-2026": "stage-1",
  "fall-major-stage-2-2026": "stage-2",
  "fall-global-major-2026": "stage-3",
};

function managerMajorEventId(id: string) {
  return id in legacyManagerMajorStages ? "fall-global-major-2026" : id;
}

function managerRegistrationEventId(registration: ManagerRegistration) {
  if (registration.eventId === "fall-mrq-2026" && registration.status === "completed") return registration.eventId;
  return managerMajorEventId(registration.eventId);
}

const MANAGER_MAJOR_EVENT_ID = "fall-global-major-2026";

function managerStartingLineupIds(contracts: ManagerPlayerContract[]) {
  const active = contracts.filter((contract) => contract.status === "active").map((contract) => contract.playerId);
  const eligible = contracts.filter((contract) => contract.status !== "expired").map((contract) => contract.playerId);
  return Array.from(new Set([...active, ...eligible])).slice(0, 5);
}

function automaticManagerMajorRegistration(
  date: string,
  contracts: ManagerPlayerContract[],
): ManagerRegistration {
  return {
    eventId: MANAGER_MAJOR_EVENT_ID,
    status: "confirmed",
    registeredOn: date,
    feePaid: 0,
    stickerRevenuePaid: 0,
    lockedRosterIds: managerStartingLineupIds(contracts),
  };
}

function completedManagerEventId(id: string) {
  return id === "fall-mrq-2026" ? id : managerMajorEventId(id);
}

function registrationPriority(status: ManagerRegistrationStatus) {
  if (status === "active") return 4;
  if (status === "confirmed") return 3;
  if (status === "completed") return 2;
  return 1;
}

export function createManagerCareer(seed: string, start: ManagerCareerStart = {}): ManagerCareerState {
  const vrsRank = start.vrsRank ?? 32;
  const organizationCountry = start.organizationCountry ?? "INT";
  const contracts = createManagerContracts(seed, start.players ?? [], { vrsRank, organizationCountry });
  const organizationId = start.organizationId ?? "independent-manager";
  const organizationName = start.organizationName ?? "My Five";
  const inheritedOrganization = Boolean(start.organizationId);
  const openingCash = start.cash ?? (inheritedOrganization ? organizationStartingCash(vrsRank, contracts) : 120_000);
  const reputation = inheritedOrganization ? Math.round(reputationForRank(vrsRank)) : 48;
  const state: ManagerCareerState = {
    version: MANAGER_CAREER_VERSION,
    status: "active",
    seed,
    date: MANAGER_START_DATE,
    season: 1,
    organizationId,
    organizationName,
    organizationCountry,
    cash: openingCash,
    vrsPoints: start.vrsPoints ?? 1_240,
    vrsRank,
    reputation,
    boardConfidence: 68,
    registrations: [automaticManagerMajorRegistration(MANAGER_START_DATE, contracts)],
    completedEventIds: [],
    contracts,
    playerDynamics: createPlayerDynamics(seed, contracts),
    trainingPlans: createManagerTrainingPlans(start.players ?? [], MANAGER_START_DATE),
    performanceCamps: [],
    casinoVisits: [],
    boardObjective: createBoardObjective(seed, vrsRank, 1),
    market: createManagerMarketState(),
    inbox: [],
    ledger: [
      {
        id: `${seed}:opening-balance`,
        date: MANAGER_START_DATE,
        category: "starting-balance",
        description: `${organizationName} operating budget`,
        amount: openingCash,
      },
    ],
  };
  return {
    ...state,
    inbox: [
      {
        id: `${seed}:welcome`,
        kind: "welcome",
        createdOn: MANAGER_START_DATE,
        title: `Welcome to ${organizationName}`,
        body: "Audit the inherited contracts and review the calendar. Your Valve-funded Major entry is already assigned; its starting stage will follow launch-day VRS.",
        eventId: managerEvents[0].id,
        deadline: managerEvents[0].registrationDeadline,
        mandatory: false,
        read: false,
      },
    ],
  };
}

export function normalizeManagerCareer(
  saved: Partial<ManagerCareerState> | undefined,
  fallback: ManagerCareerStart = {},
): ManagerCareerState | undefined {
  if (!saved) return undefined;
  const base = createManagerCareer(saved.seed ?? "manager-save", {
    ...fallback,
    organizationId: saved.organizationId ?? fallback.organizationId,
    organizationName: saved.organizationName ?? fallback.organizationName,
    organizationCountry: saved.organizationCountry ?? fallback.organizationCountry,
    vrsPoints: saved.vrsPoints ?? fallback.vrsPoints,
    vrsRank: saved.vrsRank ?? fallback.vrsRank,
    cash: saved.cash ?? fallback.cash,
  });
  const normalizedSeason = saved.season ?? base.season;
  const savedContracts = saved.contracts?.length ? saved.contracts : base.contracts;
  const normalizedDate = saved.activeEventId === "fall-mrq-2026" && (saved.date ?? base.date) < managerMajorStageStart("mrq", normalizedSeason)
    ? managerMajorStageStart("mrq", normalizedSeason)
    : saved.date ?? base.date;
  const fallbackPlayers = new Map((fallback.players ?? []).map((player) => [player.id, player]));
  const contracts = savedContracts.map((contract) => {
    const player = fallbackPlayers.get(contract.playerId);
    if (!player || contract.salaryModelVersion === MANAGER_SALARY_MODEL_VERSION) return contract;
    const monthlySalary = managerRecommendedSalary(player, {
      vrsRank: saved.vrsRank ?? base.vrsRank,
      organizationCountry: saved.organizationCountry ?? fallback.organizationCountry ?? base.organizationCountry,
    });
    return {
      ...contract,
      monthlySalary,
      buyout: Math.max(25_000, roundTo(monthlySalary * contract.majorCyclesRemaining * 8, 5_000)),
      salaryModelVersion: MANAGER_SALARY_MODEL_VERSION,
    };
  });
  const savedDynamics = new Map((saved.playerDynamics ?? []).map((item) => [item.playerId, item]));
  const defaultDynamics = new Map(createPlayerDynamics(base.seed, contracts, normalizedDate).map((item) => [item.playerId, item]));
  const playerDynamics = contracts.map((contract) => {
    const savedItem = savedDynamics.get(contract.playerId);
    const fallbackItem = defaultDynamics.get(contract.playerId)!;
    return savedItem
      ? {
          ...fallbackItem,
          ...savedItem,
          morale: clampScore(savedItem.morale),
          familiarity: clampScore(savedItem.familiarity),
          form: clampScore(savedItem.form ?? fallbackItem.form),
        }
      : fallbackItem;
  });
  const completedEventIds = Array.from(new Set((saved.completedEventIds ?? []).map(completedManagerEventId)));
  const savedRegistrations = saved.registrations ?? [];
  const registrations = [...savedRegistrations.reduce((items, registration) => {
    const migrated = { ...registration, eventId: managerRegistrationEventId(registration) };
    const current = items.get(migrated.eventId);
    if (!current || registrationPriority(migrated.status) > registrationPriority(current.status)) {
      items.set(migrated.eventId, migrated);
    }
    return items;
  }, new Map<string, ManagerRegistration>()).values()].map((registration) => {
    const event = managerEventById(registration.eventId);
    if (!event) return registration;
    const eventEnded = managerEventSchedule(event, normalizedSeason).endsOn < normalizedDate;
    if (event.majorCycle) {
      return {
        ...registration,
        feePaid: 0,
        stickerRevenuePaid: registration.stickerRevenuePaid ?? 0,
        status: registration.status === "confirmed" && eventEnded
          ? "withdrawn" as const
          : registration.status === "withdrawn" && !eventEnded
            ? "confirmed" as const
            : registration.status,
        lockedRosterIds: registration.lockedRosterIds.length
          ? registration.lockedRosterIds
          : managerStartingLineupIds(contracts),
      };
    }
    return registration.status === "confirmed" && eventEnded
      ? { ...registration, status: "withdrawn" as const }
      : registration;
  });
  const majorEvent = managerEventById(MANAGER_MAJOR_EVENT_ID)!;
  const majorEnded = managerEventSchedule(majorEvent, normalizedSeason).endsOn < normalizedDate;
  if (
    !registrations.some((registration) => registration.eventId === MANAGER_MAJOR_EVENT_ID)
    && !completedEventIds.includes(MANAGER_MAJOR_EVENT_ID)
    && !majorEnded
  ) {
    registrations.push(automaticManagerMajorRegistration(normalizedDate, contracts));
  }
  const reimbursedMajorCost = (saved.version ?? 0) < 11
    ? (saved.ledger ?? []).reduce((total, entry) => (
        entry.amount < 0
        && ["entry", "travel"].includes(entry.category)
        && entry.eventId
        && managerMajorEventId(entry.eventId) === MANAGER_MAJOR_EVENT_ID
          ? total + Math.abs(entry.amount)
          : total
      ), 0)
    : 0;
  const ledger = [...(saved.ledger ?? base.ledger)];
  if (reimbursedMajorCost > 0) {
    ledger.push({
      id: `${base.seed}:${normalizedDate}:major-valve-reimbursement`,
      date: normalizedDate,
      category: "withdrawal",
      description: "Valve-funded Major travel reimbursement",
      amount: reimbursedMajorCost,
      eventId: MANAGER_MAJOR_EVENT_ID,
    });
  }
  const legacyActiveMajorStage = saved.activeEventId ? legacyManagerMajorStages[saved.activeEventId] : undefined;
  const migratedActiveEventId = saved.activeEventId ? managerMajorEventId(saved.activeEventId) : undefined;
  const activeRegistration = registrations.find((registration) => (
    registration.eventId === migratedActiveEventId && registration.status === "active"
  ));
  const activeEventId = migratedActiveEventId && managerEventById(migratedActiveEventId) && activeRegistration
    ? migratedActiveEventId
    : undefined;
  const activeMajorStage = activeEventId
    ? saved.activeMajorStage
      ?? legacyActiveMajorStage
      ?? (activeEventId === "fall-global-major-2026" ? managerMajorEntryStage(saved.vrsRank ?? base.vrsRank) : undefined)
    : undefined;
  const tradeRoundCounts = new Map<string, number>();
  const tradeOffers = (saved.market?.tradeOffers ?? []).map((offer) => {
    const round = offer.round ?? (tradeRoundCounts.get(offer.incoming.id) ?? 0) + 1;
    tradeRoundCounts.set(offer.incoming.id, round);
    return {
      ...offer,
      round,
      responseOn: offer.responseOn ?? offer.submittedOn,
    };
  });
  const rosterMoves = saved.market?.rosterMoves ?? tradeOffers
    .filter((offer) => offer.appliedOn)
    .map((offer): ManagerClubRosterMove => ({
      id: `${offer.id}:club-move`,
      clubId: offer.sourceTeamId,
      clubName: offer.sourceTeamName,
      releasedPlayerId: offer.incoming.id,
      acquiredPlayer: offer.outgoing,
      completedOn: offer.appliedOn!,
    }));
  const mergedTrainingPlans = [
    ...(saved.trainingPlans ?? []),
    ...base.trainingPlans.filter((plan) => !(saved.trainingPlans ?? []).some((savedPlan) => savedPlan.playerId === plan.playerId)),
  ];
  const trainingPlans = mergedTrainingPlans.map((plan) => {
    const player = fallbackPlayers.get(plan.playerId);
    const currentOvr = plan.currentOvr ?? player?.ovr ?? 50;
    return {
      ...plan,
      currentOvr,
      potentialOvr: Math.max(currentOvr, plan.potentialOvr ?? player?.potential ?? player?.ovr ?? currentOvr),
      potentialLabAttempts: plan.potentialLabAttempts ?? 0,
      potentialLabWins: plan.potentialLabWins ?? 0,
    };
  });
  const normalized: ManagerCareerState = {
    ...base,
    ...saved,
    version: MANAGER_CAREER_VERSION,
    status: saved.status ?? "active",
    endedOn: saved.endedOn,
    endReason: saved.endReason,
    season: normalizedSeason,
    date: normalizedDate,
    organizationId: saved.organizationId ?? base.organizationId,
    organizationName: saved.organizationName ?? base.organizationName,
    organizationCountry: saved.organizationCountry ?? base.organizationCountry,
    cash: (saved.cash ?? base.cash) + reimbursedMajorCost,
    activeEventId,
    activeMajorStage,
    registrations,
    completedEventIds,
    contracts,
    playerDynamics,
    trainingPlans,
    performanceCamps: saved.performanceCamps ?? [],
    casinoVisits: saved.casinoVisits ?? [],
    boardObjective: saved.boardObjective ?? createBoardObjective(base.seed, saved.vrsRank ?? base.vrsRank, saved.season ?? base.season),
    market: {
      ...base.market,
      ...saved.market,
      scoutedPlayerIds: saved.market?.scoutedPlayerIds ?? [],
      shortlistedPlayerIds: saved.market?.shortlistedPlayerIds ?? [],
      signedPlayerIds: saved.market?.signedPlayerIds ?? [],
      offers: saved.market?.offers ?? [],
      tradeOffers,
      incomingOffers: saved.market?.incomingOffers ?? [],
      clubRelationships: saved.market?.clubRelationships ?? [],
      rosterMoves,
      unavailablePlayerIds: saved.market?.unavailablePlayerIds ?? [],
    },
    inbox: saved.inbox ?? base.inbox,
    ledger,
  };
  const activeMajor = activeEventId ? managerEventById(activeEventId) : undefined;
  return (saved.version ?? 0) < MANAGER_CAREER_VERSION && activeMajor?.majorCycle && activeMajorStage
    ? awardManagerMajorStickerRevenue(normalized, activeMajor, activeMajorStage, normalizedDate)
    : normalized;
}

export function scoutManagerCandidate(
  state: ManagerCareerState,
  player: Pick<ManagerCareerPlayerSeed, "id" | "handle">,
  cost = 1_500,
): ManagerCareerState {
  if (state.market.scoutedPlayerIds.includes(player.id) || state.cash < cost) return state;
  return {
    ...state,
    cash: state.cash - cost,
    market: {
      ...state.market,
      scoutedPlayerIds: [...state.market.scoutedPlayerIds, player.id],
    },
    ledger: [
      ...state.ledger,
      {
        id: ledgerId(state, `scout:${player.id}`),
        date: state.date,
        category: "scouting",
        description: `Scouting report: ${player.handle}`,
        amount: -cost,
      },
    ],
  };
}

export function toggleManagerShortlist(state: ManagerCareerState, playerId: string): ManagerCareerState {
  const shortlisted = state.market.shortlistedPlayerIds.includes(playerId);
  return {
    ...state,
    market: {
      ...state.market,
      shortlistedPlayerIds: shortlisted
        ? state.market.shortlistedPlayerIds.filter((id) => id !== playerId)
        : [...state.market.shortlistedPlayerIds, playerId],
    },
  };
}

export interface ManagerOfferEvaluation {
  accepted: boolean;
  score: number;
  askingSalary: number;
  reasons: string[];
}

export function evaluateManagerOffer(
  state: Pick<ManagerCareerState, "reputation" | "vrsRank" | "organizationCountry">,
  player: ManagerCareerPlayerSeed,
  terms: ManagerOfferTerms,
): ManagerOfferEvaluation {
  const askingSalary = managerRecommendedSalary(player, state);
  const salaryRatio = terms.monthlySalary / askingSalary;
  const roleScore = terms.squadRole === "star"
    ? 18
    : terms.squadRole === "starter"
      ? 11
      : terms.squadRole === "prospect" && (player.age ?? 24) <= 21
        ? 15
        : terms.squadRole === "rotation"
          ? 3
          : -18;
  const durationScore = terms.majorCycles >= 4 ? 8 : terms.majorCycles === 3 ? 5 : terms.majorCycles === 2 ? 1 : -7;
  const reputationScore = (state.reputation - 50) * 0.35;
  const qualityDemand = Math.max(0, player.ovr - 74) * 1.4;
  const score = Math.round(Math.max(0, Math.min(100,
    45 + (salaryRatio - 1) * 82 + roleScore + durationScore + reputationScore - qualityDemand,
  )));
  const reasons: string[] = [];
  if (salaryRatio < 0.9) reasons.push("Salary is below the player's expectation");
  else if (salaryRatio >= 1.12) reasons.push("Salary shows strong commitment");
  if (terms.squadRole === "bench") reasons.push("The proposed bench role reduces interest");
  if (terms.squadRole === "star" || terms.squadRole === "starter") reasons.push("The promised role is attractive");
  if (terms.majorCycles === 1) reasons.push("The short contract offers little security");
  if (state.reputation >= 65) reasons.push("The club's reputation helps the approach");
  return { accepted: score >= 60, score, askingSalary, reasons };
}

export function evaluateManagerContractRenewal(
  state: Pick<ManagerCareerState, "reputation" | "vrsRank" | "organizationCountry" | "playerDynamics">,
  contract: ManagerPlayerContract,
  player: ManagerCareerPlayerSeed,
  terms: ManagerOfferTerms,
): ManagerOfferEvaluation {
  if (contract.status !== "expired" && contract.majorCyclesRemaining > 1) {
    return {
      accepted: false,
      score: 0,
      askingSalary: managerRecommendedSalary(player, state),
      reasons: ["Renewal talks open in the final Major cycle of the contract"],
    };
  }
  const marketSalary = managerRecommendedSalary(player, state);
  const askingSalary = roundTo(marketSalary * (contract.status === "expired" ? 1.05 : 1), 250);
  const normalizedTerms = {
    ...terms,
    monthlySalary: terms.monthlySalary * (marketSalary / Math.max(1, askingSalary)),
  };
  const base = evaluateManagerOffer(state, player, normalizedTerms);
  const dynamics = state.playerDynamics.find((item) => item.playerId === player.id);
  const loyaltyScore = 8 + Math.round(((dynamics?.familiarity ?? 40) - 40) * 0.12);
  const score = Math.max(0, Math.min(100, base.score + loyaltyScore));
  const reasons = [...base.reasons];
  if (loyaltyScore >= 10) reasons.push("The player's familiarity with the club helps the talks");
  if (contract.status === "expired") reasons.push("An expired deal carries a small market premium");
  return { accepted: score >= 60, score, askingSalary, reasons };
}

export function managerRenewalBonus(monthlySalary: number) {
  return roundTo(Math.max(500, monthlySalary * 0.5), 250);
}

export function managerContractReleaseCost(contract: Pick<ManagerPlayerContract, "monthlySalary" | "majorCyclesRemaining" | "buyout">) {
  const settlementMonths = Math.max(1, Math.min(2, contract.majorCyclesRemaining));
  return Math.min(contract.buyout, roundTo(contract.monthlySalary * settlementMonths, 250));
}

export function releaseManagerPlayerContract(
  state: ManagerCareerState,
  playerId: string,
): ManagerCareerState {
  const contract = state.contracts.find((item) => item.playerId === playerId);
  const activeContracts = state.contracts.filter((item) => item.status !== "expired");
  const liveTrade = state.market.tradeOffers.some((offer) => (
    offer.outgoing.id === playerId
    && ["pending", "countered", "delayed"].includes(offer.status)
  ));
  if (
    !contract
    || contract.status === "expired"
    || contract.status === "active"
    || activeContracts.length <= 5
    || managerLineupEditLocked(state)
    || liveTrade
  ) return state;
  const releaseCost = managerContractReleaseCost(contract);
  if (state.cash < releaseCost) return state;
  return {
    ...state,
    cash: state.cash - releaseCost,
    contracts: state.contracts.filter((item) => item.playerId !== playerId),
    trainingPlans: state.trainingPlans.filter((plan) => plan.playerId !== playerId),
    registrations: state.registrations.map((registration) => ({
      ...registration,
      lockedRosterIds: registration.lockedRosterIds.filter((id) => id !== playerId),
    })),
    ledger: [
      ...state.ledger,
      {
        id: ledgerId(state, `release:${playerId}`),
        date: state.date,
        category: "release",
        description: `${contract.playerHandle} contract settlement`,
        amount: -releaseCost,
      },
    ],
    inbox: [
      {
        id: inboxId(state, `release:${playerId}`),
        kind: "market",
        createdOn: state.date,
        title: `${contract.playerHandle} released`,
        body: `${state.organizationName} paid a $${releaseCost.toLocaleString()} settlement. The player is now available to other clubs.`,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
}

export function renewManagerPlayerContract(
  state: ManagerCareerState,
  player: ManagerCareerPlayerSeed,
  terms: ManagerOfferTerms,
): ManagerCareerState {
  const contract = state.contracts.find((item) => item.playerId === player.id);
  const activeContracts = state.contracts.filter((item) => item.status !== "expired");
  if (
    !contract
    || (contract.status !== "expired" && contract.majorCyclesRemaining > 1)
    || (contract.status === "expired" && activeContracts.length >= 8)
    || terms.monthlySalary < 1_000
    || terms.majorCycles < 1
    || terms.majorCycles > 4
  ) return state;

  const evaluation = evaluateManagerContractRenewal(state, contract, player, terms);
  const signingBonus = managerRenewalBonus(terms.monthlySalary);
  if (evaluation.accepted && state.cash < signingBonus) return state;
  const offer: ManagerMarketOffer = {
    id: `${state.seed}:renewal:${player.id}:${state.market.offers.length}`,
    playerId: player.id,
    playerHandle: player.handle,
    submittedOn: state.date,
    status: evaluation.accepted ? "accepted" : "rejected",
    interestScore: evaluation.score,
    ...terms,
  };
  const market = {
    ...state.market,
    offers: [...state.market.offers, offer],
  };
  if (!evaluation.accepted) {
    return {
      ...state,
      market,
      inbox: [
        {
          id: inboxId(state, `renewal-rejected:${player.id}`),
          kind: "market",
          createdOn: state.date,
          title: `${player.handle} rejected the renewal offer`,
          body: evaluation.reasons[0] ?? "The proposed renewal did not meet the player's expectations.",
          mandatory: false,
          read: false,
        },
        ...state.inbox,
      ],
    };
  }

  const renewedContract: ManagerPlayerContract = {
    ...contract,
    signedOn: state.date,
    majorCyclesRemaining: terms.majorCycles,
    monthlySalary: terms.monthlySalary,
    buyout: Math.max(25_000, roundTo(terms.monthlySalary * terms.majorCycles * 10, 5_000)),
    squadRole: terms.squadRole,
    status: contract.status === "active" ? "active" : "bench",
    salaryModelVersion: MANAGER_SALARY_MODEL_VERSION,
  };
  const existingDynamics = state.playerDynamics.find((item) => item.playerId === player.id);
  return {
    ...state,
    cash: state.cash - signingBonus,
    contracts: [...state.contracts.filter((item) => item.playerId !== player.id), renewedContract],
    playerDynamics: [
      ...state.playerDynamics.filter((item) => item.playerId !== player.id),
      {
        playerId: player.id,
        morale: Math.max(64, existingDynamics?.morale ?? 50),
        familiarity: existingDynamics?.familiarity ?? 35,
        form: existingDynamics?.form ?? 50,
        lastUpdatedOn: state.date,
      },
    ],
    market: {
      ...market,
      signedPlayerIds: Array.from(new Set([...state.market.signedPlayerIds, player.id])),
    },
    ledger: [
      ...state.ledger,
      {
        id: ledgerId(state, `renewal:${player.id}`),
        date: state.date,
        category: "signing",
        description: `${player.handle} contract renewal bonus`,
        amount: -signingBonus,
      },
    ],
    inbox: [
      {
        id: inboxId(state, `renewal-accepted:${player.id}`),
        kind: "market",
        createdOn: state.date,
        title: `${player.handle} renewed with ${state.organizationName}`,
        body: `${managerContractDurationLabel(renewedContract)} at $${terms.monthlySalary.toLocaleString()} per month.`,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
}

export function submitManagerFreeAgentOffer(
  state: ManagerCareerState,
  player: ManagerCareerPlayerSeed,
  terms: ManagerOfferTerms,
): ManagerCareerState {
  const activeContracts = state.contracts.filter((contract) => contract.status !== "expired");
  const alreadyContracted = activeContracts.some((contract) => contract.playerId === player.id);
  if (
    !state.market.scoutedPlayerIds.includes(player.id)
    || alreadyContracted
    || activeContracts.length >= 8
    || terms.monthlySalary < 1_000
    || terms.majorCycles < 1
    || terms.majorCycles > 4
  ) return state;
  const evaluation = evaluateManagerOffer(state, player, terms);
  const signingBonus = terms.monthlySalary;
  if (evaluation.accepted && state.cash < signingBonus) return state;
  const offer: ManagerMarketOffer = {
    id: `${state.seed}:offer:${player.id}:${state.market.offers.length}`,
    playerId: player.id,
    playerHandle: player.handle,
    submittedOn: state.date,
    status: evaluation.accepted ? "accepted" : "rejected",
    interestScore: evaluation.score,
    ...terms,
  };
  const nextMarket: ManagerMarketState = {
    ...state.market,
    signedPlayerIds: evaluation.accepted
      ? Array.from(new Set([...state.market.signedPlayerIds, player.id]))
      : state.market.signedPlayerIds,
    offers: [...state.market.offers, offer],
  };
  if (!evaluation.accepted) {
    return {
      ...state,
      market: nextMarket,
      inbox: [
        {
          id: inboxId(state, `offer-rejected:${player.id}`),
          kind: "market",
          createdOn: state.date,
          title: `${player.handle} rejected the contract offer`,
          body: evaluation.reasons[0] ?? "The overall package did not meet the player's expectations.",
          mandatory: false,
          read: false,
        },
        ...state.inbox,
      ],
    };
  }
  const contract: ManagerPlayerContract = {
    id: `${state.seed}:contract:${player.id}`,
    playerId: player.id,
    playerHandle: player.handle,
    playerRole: player.role,
    signedOn: state.date,
    majorCyclesRemaining: terms.majorCycles,
    monthlySalary: terms.monthlySalary,
    buyout: Math.max(25_000, roundTo(terms.monthlySalary * terms.majorCycles * 10, 5_000)),
    squadRole: terms.squadRole,
    status: "bench",
    salaryModelVersion: MANAGER_SALARY_MODEL_VERSION,
  };
  return {
    ...state,
    cash: state.cash - signingBonus,
    contracts: [...state.contracts.filter((item) => item.playerId !== player.id), contract],
    trainingPlans: [
      ...state.trainingPlans.filter((plan) => plan.playerId !== player.id),
      managerTrainingPlan(state, player),
    ],
    playerDynamics: [
      ...state.playerDynamics.filter((item) => item.playerId !== player.id),
      {
        playerId: player.id,
        morale: 70,
        familiarity: 24,
        form: 50,
        lastUpdatedOn: state.date,
      },
    ],
    market: nextMarket,
    ledger: [
      ...state.ledger,
      {
        id: ledgerId(state, `signing:${player.id}`),
        date: state.date,
        category: "signing",
        description: `${player.handle} signing bonus`,
        amount: -signingBonus,
      },
    ],
    inbox: [
      {
        id: inboxId(state, `offer-accepted:${player.id}`),
        kind: "market",
        createdOn: state.date,
        title: `${player.handle} signed for ${state.organizationName}`,
        body: `${managerContractDurationLabel(contract)} at $${terms.monthlySalary.toLocaleString()} per month. The player joins the reserve squad.`,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
}

export interface ManagerTradeEvaluation {
  status: "accepted" | "rejected" | "countered";
  outgoingCredit: number;
  requiredCash: number;
  counterCash?: number;
  relationshipTrust: number;
  reasons: string[];
}

const MAX_TRADE_ROUNDS = 3;
const rivalClubNames = ["Northstar", "Redline", "Atlas", "Vertex", "Monarch", "Kinetic"];

function baseManagerClubRelationship(seed: string, clubId: string, clubName: string): ManagerClubRelationship {
  return {
    clubId,
    clubName,
    trust: 47 + stableHash(`${seed}:${clubId}:relationship`) % 9,
    approaches: 0,
    completedTrades: 0,
    failedNegotiations: 0,
  };
}

export function managerClubRelationship(
  state: Pick<ManagerCareerState, "seed" | "market">,
  clubId: string,
  clubName: string,
) {
  return state.market.clubRelationships.find((relationship) => relationship.clubId === clubId)
    ?? baseManagerClubRelationship(state.seed, clubId, clubName);
}

export function managerClubRelationshipLabel(trust: number) {
  if (trust >= 72) return "Trusted partner";
  if (trust >= 58) return "Warm";
  if (trust >= 43) return "Professional";
  if (trust >= 28) return "Wary";
  return "Strained";
}

function updateClubRelationship(
  state: ManagerCareerState,
  clubId: string,
  clubName: string,
  trustDelta: number,
  changes: Partial<Pick<ManagerClubRelationship, "approaches" | "completedTrades" | "failedNegotiations">> = {},
  contactOn = state.date,
): ManagerCareerState {
  const current = managerClubRelationship(state, clubId, clubName);
  const next: ManagerClubRelationship = {
    ...current,
    clubName,
    trust: Math.max(0, Math.min(100, current.trust + trustDelta)),
    approaches: current.approaches + (changes.approaches ?? 0),
    completedTrades: current.completedTrades + (changes.completedTrades ?? 0),
    failedNegotiations: current.failedNegotiations + (changes.failedNegotiations ?? 0),
    lastContactOn: contactOn,
  };
  return {
    ...state,
    market: {
      ...state.market,
      clubRelationships: [
        ...state.market.clubRelationships.filter((relationship) => relationship.clubId !== clubId),
        next,
      ],
    },
  };
}

export function managerTradeRoundsRemaining(state: Pick<ManagerCareerState, "market">, incomingPlayerId: string) {
  const used = Math.max(0, ...state.market.tradeOffers
    .filter((offer) => offer.incoming.id === incomingPlayerId)
    .map((offer) => offer.round));
  return Math.max(0, MAX_TRADE_ROUNDS - used);
}

export function managerPlayerTradeValue(player: ManagerCareerPlayerSeed) {
  return playerValue(player);
}

function managerIncomingOfferTransferAllowed(state: ManagerCareerState, playerId: string, onDate = state.date) {
  const eligibleContracts = state.contracts.filter((contract) => contract.status !== "expired");
  return eligibleContracts.length > 5
    && eligibleContracts.some((contract) => contract.playerId === playerId)
    && !managerTradeLockingEvent(state, playerId, onDate);
}

function managerIncomingOfferCooldown(state: Pick<ManagerCareerState, "seed" | "market">, onDate: string) {
  const dates = state.market.incomingOffers.map((offer) => offer.createdOn).sort();
  const latest = dates[dates.length - 1];
  if (!latest) return true;
  const cooldown = 18 + stableHash(`${state.seed}:${latest}:incoming-cooldown`) % 5;
  return addDays(latest, cooldown) <= onDate;
}

export function createManagerIncomingOffer(
  state: ManagerCareerState,
  managedPlayers: ManagerCareerPlayerSeed[],
  worldTeams: ManagerOfferWorldTeam[],
  onDate = state.date,
): ManagerCareerState {
  const activeOffer = state.market.incomingOffers.some((offer) => (
    offer.status === "pending" || offer.status === "counter-pending"
  ));
  if (activeOffer || !managerIncomingOfferCooldown(state, onDate)) return state;

  const contractedIds = new Set(state.contracts
    .filter((contract) => contract.status !== "expired")
    .map((contract) => contract.playerId));
  const contractByPlayer = new Map(state.contracts.map((contract) => [contract.playerId, contract]));
  const targets = managedPlayers.filter((player) => contractedIds.has(player.id));
  const candidates = worldTeams.flatMap((team) => team.players.flatMap((displacedPlayer) => targets
    .filter((targetPlayer) => (
      targetPlayer.role === displacedPlayer.role
      && targetPlayer.id !== displacedPlayer.id
      && targetPlayer.ovr >= displacedPlayer.ovr - 2
    ))
    .map((targetPlayer) => {
      const contract = contractByPlayer.get(targetPlayer.id);
      const value = Math.max(managerPlayerTradeValue(targetPlayer), contract?.buyout ?? 0);
      const clubPremium = (team.rank ?? 64) <= 8 ? 1.2 : (team.rank ?? 64) <= 20 ? 1.08 : 1;
      const buyerLimit = Math.max(25_000, roundTo(value * clubPremium * (1.02 + (stableHash(`${state.seed}:${onDate}:${team.id}:${targetPlayer.id}:limit`) % 15) / 100), 5_000));
      const openingRatio = 0.78 + (stableHash(`${state.seed}:${onDate}:${team.id}:${targetPlayer.id}:opening`) % 13) / 100;
      return {
        team,
        displacedPlayer,
        targetPlayer,
        buyerLimit,
        cashOffered: Math.max(20_000, roundTo(buyerLimit * openingRatio, 5_000)),
        score: (targetPlayer.ovr - displacedPlayer.ovr) * 20
          + Math.max(0, 30 - (team.rank ?? 64))
          + stableHash(`${state.seed}:${onDate}:${team.id}:${targetPlayer.id}:score`) % 35,
      };
    })));
  const selected = candidates.sort((left, right) => right.score - left.score || left.team.id.localeCompare(right.team.id))[0];
  if (!selected) return state;

  const expiresOn = addDays(onDate, 5);
  const offer: ManagerIncomingOffer = {
    id: `${state.seed}:incoming:${onDate}:${selected.team.id}:${selected.targetPlayer.id}`,
    buyerTeamId: selected.team.id,
    buyerTeamName: selected.team.name,
    targetPlayer: selected.targetPlayer,
    displacedPlayer: selected.displacedPlayer,
    createdOn: onDate,
    expiresOn,
    cashOffered: selected.cashOffered,
    buyerLimit: selected.buyerLimit,
    status: "pending",
    reasons: [
      `${selected.team.name} wants an upgrade at ${selected.targetPlayer.role}`,
      `${selected.targetPlayer.handle}'s current level and contract control shaped the valuation`,
    ],
  };
  return {
    ...state,
    market: {
      ...state.market,
      incomingOffers: [...state.market.incomingOffers, offer],
    },
    inbox: [
      {
        id: inboxId(state, `incoming-offer:${offer.id}`),
        kind: "market",
        createdOn: onDate,
        title: `${selected.team.name} bid for ${selected.targetPlayer.handle}`,
        body: `The club has offered $${selected.cashOffered.toLocaleString()}. Accept, counter, or decline before ${expiresOn}.`,
        offerId: offer.id,
        deadline: expiresOn,
        mandatory: true,
        read: false,
      },
      ...state.inbox,
    ],
  };
}

function applyManagerIncomingOffer(
  state: ManagerCareerState,
  offerId: string,
  cash: number,
  appliedOn: string,
): ManagerCareerState {
  const offer = state.market.incomingOffers.find((item) => item.id === offerId);
  if (!offer || offer.appliedOn || !managerIncomingOfferTransferAllowed(state, offer.targetPlayer.id, appliedOn)) return state;
  const contracts = state.contracts.filter((contract) => contract.playerId !== offer.targetPlayer.id);
  const next: ManagerCareerState = {
    ...state,
    cash: state.cash + cash,
    contracts,
    trainingPlans: state.trainingPlans.filter((plan) => plan.playerId !== offer.targetPlayer.id),
    playerDynamics: state.playerDynamics.filter((item) => item.playerId !== offer.targetPlayer.id),
    registrations: state.registrations.map((registration) => {
      const event = managerEventById(registration.eventId);
      if (
        registration.status !== "confirmed"
        || !event
        || appliedOn >= managerEventSchedule(event, state.season).rosterLockOn
        || !registration.lockedRosterIds.includes(offer.targetPlayer.id)
      ) return registration;
      return { ...registration, lockedRosterIds: managerStartingLineupIds(contracts) };
    }),
    market: {
      ...state.market,
      signedPlayerIds: state.market.signedPlayerIds.filter((id) => id !== offer.targetPlayer.id),
      unavailablePlayerIds: Array.from(new Set([...state.market.unavailablePlayerIds, offer.targetPlayer.id])),
      incomingOffers: state.market.incomingOffers.map((item) => item.id === offerId
        ? { ...item, status: "accepted" as const, appliedOn, cashOffered: cash, responseOn: undefined }
        : item),
      rosterMoves: state.market.rosterMoves.some((move) => move.id === `${offer.id}:buyer-move`)
        ? state.market.rosterMoves
        : [...state.market.rosterMoves, {
            id: `${offer.id}:buyer-move`,
            clubId: offer.buyerTeamId,
            clubName: offer.buyerTeamName,
            releasedPlayerId: offer.displacedPlayer.id,
            acquiredPlayer: offer.targetPlayer,
            completedOn: appliedOn,
          }],
    },
    ledger: [
      ...state.ledger,
      {
        id: ledgerId(state, `incoming-transfer:${offer.targetPlayer.id}`),
        date: appliedOn,
        category: "transfer",
        description: `${offer.targetPlayer.handle} sold to ${offer.buyerTeamName}`,
        amount: cash,
      },
    ],
    inbox: [
      {
        id: inboxId(state, `incoming-complete:${offer.id}`),
        kind: "market",
        createdOn: appliedOn,
        title: `${offer.targetPlayer.handle} joins ${offer.buyerTeamName}`,
        body: `${offer.buyerTeamName} paid $${cash.toLocaleString()}. The transfer is complete and the player has left the contracted squad.`,
        offerId: offer.id,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
  return updateClubRelationship(next, offer.buyerTeamId, offer.buyerTeamName, 6, { completedTrades: 1 }, appliedOn);
}

export function acceptManagerIncomingOffer(state: ManagerCareerState, offerId: string): ManagerCareerState {
  const offer = state.market.incomingOffers.find((item) => item.id === offerId && item.status === "pending");
  if (!offer || state.date > offer.expiresOn) return state;
  return applyManagerIncomingOffer(state, offerId, offer.cashOffered, state.date);
}

export function counterManagerIncomingOffer(state: ManagerCareerState, offerId: string, counterCash: number): ManagerCareerState {
  const offer = state.market.incomingOffers.find((item) => item.id === offerId && item.status === "pending");
  if (
    !offer
    || state.date > offer.expiresOn
    || counterCash <= offer.cashOffered
    || counterCash > offer.buyerLimit * 2
    || !managerIncomingOfferTransferAllowed(state, offer.targetPlayer.id)
  ) return state;
  const responseOn = addDays(state.date, 2);
  return {
    ...state,
    market: {
      ...state.market,
      incomingOffers: state.market.incomingOffers.map((item) => item.id === offerId
        ? { ...item, status: "counter-pending" as const, counterCash: roundTo(counterCash, 5_000), responseOn }
        : item),
    },
    inbox: [
      {
        id: inboxId(state, `incoming-counter:${offer.id}`),
        kind: "market",
        createdOn: state.date,
        title: `Counteroffer sent to ${offer.buyerTeamName}`,
        body: `${state.organizationName} requested $${roundTo(counterCash, 5_000).toLocaleString()} for ${offer.targetPlayer.handle}. A response is expected by ${responseOn}.`,
        offerId: offer.id,
        deadline: responseOn,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
}

export function declineManagerIncomingOffer(state: ManagerCareerState, offerId: string): ManagerCareerState {
  const offer = state.market.incomingOffers.find((item) => item.id === offerId && (item.status === "pending" || item.status === "counter-pending"));
  if (!offer) return state;
  const next: ManagerCareerState = {
    ...state,
    market: {
      ...state.market,
      incomingOffers: state.market.incomingOffers.map((item) => item.id === offerId
        ? { ...item, status: "declined" as const, responseOn: undefined, reasons: [...item.reasons, `${state.organizationName} declined the approach`] }
        : item),
    },
    inbox: [
      {
        id: inboxId(state, `incoming-declined:${offer.id}`),
        kind: "market",
        createdOn: state.date,
        title: `${offer.buyerTeamName} offer declined`,
        body: `${offer.targetPlayer.handle} remains under contract with ${state.organizationName}.`,
        offerId: offer.id,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
  return updateClubRelationship(next, offer.buyerTeamId, offer.buyerTeamName, -1, { failedNegotiations: 1 });
}

export function evaluateManagerTradeProposal(
  state: Pick<ManagerCareerState, "seed" | "reputation" | "vrsRank"> & Partial<Pick<ManagerCareerState, "market">>,
  proposal: ManagerTradeProposal,
): ManagerTradeEvaluation {
  const sameRole = proposal.incoming.role === proposal.outgoing.role;
  const outgoingValue = managerPlayerTradeValue(proposal.outgoing);
  const roleMultiplier = sameRole ? 0.98 : proposal.outgoing.role === "IGL" ? 0.7 : 0.8;
  const sellerTemper = 0.94 + (stableHash(`${state.seed}:${proposal.incoming.id}:${proposal.sourceTeamId}:trade`) % 9) / 100;
  const reputationDiscount = Math.max(0, state.reputation - 60) * 0.002;
  const relationshipTrust = state.market
    ? managerClubRelationship(state as Pick<ManagerCareerState, "seed" | "market">, proposal.sourceTeamId, proposal.sourceTeamName).trust
    : 50;
  const relationshipAdjustment = (50 - relationshipTrust) * 0.0025;
  const requiredTotal = Math.round(proposal.askingFee * Math.max(0.84, sellerTemper - reputationDiscount + relationshipAdjustment));
  const outgoingCredit = roundTo(outgoingValue * roleMultiplier, 5_000);
  const requiredCash = Math.max(0, roundTo(requiredTotal - outgoingCredit, 5_000));
  const reasons = [
    sameRole
      ? `${proposal.outgoing.handle} directly replaces the role ${proposal.sourceTeamName} would lose`
      : `${proposal.outgoing.handle} does not directly replace ${proposal.incoming.role}`,
  ];
  if (relationshipTrust >= 58) reasons.push("A strong club relationship softens the seller's valuation");
  if (relationshipTrust < 40) reasons.push("Previous talks make the seller less flexible");
  if (proposal.outgoing.ovr >= proposal.incoming.ovr - 2) reasons.push("The outgoing player's current level carries strong trade value");
  if ((proposal.outgoing.age ?? 24) <= 21) reasons.push("The seller values the outgoing player's development runway");
  if (proposal.cashOffered >= requiredCash) {
    reasons.push("The combined player and cash value meets the club's valuation");
    return { status: "accepted", outgoingCredit, requiredCash, relationshipTrust, reasons };
  }
  if (proposal.cashOffered >= requiredCash * 0.65) {
    reasons.push(`The proposal is close, but ${proposal.sourceTeamName} requires more cash`);
    return { status: "countered", outgoingCredit, requiredCash, counterCash: requiredCash, relationshipTrust, reasons };
  }
  reasons.push("The proposal is too far below the club's valuation");
  return { status: "rejected", outgoingCredit, requiredCash, relationshipTrust, reasons };
}

function managerTradeLockingEvent(state: ManagerCareerState, outgoingPlayerId: string, onDate = state.date) {
  return state.registrations.find((registration) => {
    if (!registration.lockedRosterIds.includes(outgoingPlayerId)) return false;
    const event = managerEventById(registration.eventId);
    if (!event) return false;
    if (registration.status === "active") return true;
    const schedule = managerEventSchedule(event, state.season);
    return registration.status === "confirmed" && onDate >= schedule.rosterLockOn && onDate <= schedule.endsOn;
  });
}

function applyManagerTrade(state: ManagerCareerState, offerId: string, appliedOn: string): ManagerCareerState {
  const offer = state.market.tradeOffers.find((item) => item.id === offerId);
  if (!offer || offer.appliedOn || (!offer.cashReservedOn && state.cash < offer.cashOffered)) return state;
  const incomingContract: ManagerPlayerContract = {
    id: `${state.seed}:contract:${offer.incoming.id}`,
    playerId: offer.incoming.id,
    playerHandle: offer.incoming.handle,
    playerRole: offer.incoming.role,
    signedOn: appliedOn,
    majorCyclesRemaining: 3,
    monthlySalary: offer.incomingSalary,
    buyout: Math.max(offer.askingFee, roundTo(offer.incomingSalary * 30, 5_000)),
    squadRole: "starter",
    status: "active",
    salaryModelVersion: MANAGER_SALARY_MODEL_VERSION,
  };
  const next: ManagerCareerState = {
    ...state,
    cash: state.cash - (offer.cashReservedOn ? 0 : offer.cashOffered),
    contracts: [
      ...state.contracts.filter((contract) => contract.playerId !== offer.outgoing.id && contract.playerId !== offer.incoming.id),
      incomingContract,
    ],
    trainingPlans: [
      ...state.trainingPlans.filter((plan) => plan.playerId !== offer.outgoing.id && plan.playerId !== offer.incoming.id),
      createManagerTrainingPlan(offer.incoming, appliedOn),
    ],
    playerDynamics: [
      ...state.playerDynamics.filter((item) => item.playerId !== offer.incoming.id && item.playerId !== offer.outgoing.id),
      {
        playerId: offer.incoming.id,
        morale: 72,
        familiarity: 26,
        form: 50,
        lastUpdatedOn: appliedOn,
      },
    ],
    registrations: state.registrations.map((registration) => {
      const event = managerEventById(registration.eventId);
      if (
        registration.status !== "confirmed"
        || !event
        || appliedOn >= managerEventSchedule(event, state.season).rosterLockOn
        || !registration.lockedRosterIds.includes(offer.outgoing.id)
      ) return registration;
      return {
        ...registration,
        lockedRosterIds: registration.lockedRosterIds.map((id) => id === offer.outgoing.id ? offer.incoming.id : id),
      };
    }),
    market: {
      ...state.market,
      signedPlayerIds: Array.from(new Set([
        ...state.market.signedPlayerIds.filter((id) => id !== offer.outgoing.id),
        offer.incoming.id,
      ])),
      tradeOffers: state.market.tradeOffers.map((item) => item.id === offerId
        ? { ...item, status: "accepted" as const, appliedOn, resolvesOn: undefined, expiresOn: undefined }
        : item),
      rosterMoves: state.market.rosterMoves.some((move) => move.id === `${offer.id}:club-move`)
        ? state.market.rosterMoves
        : [...state.market.rosterMoves, {
            id: `${offer.id}:club-move`,
            clubId: offer.sourceTeamId,
            clubName: offer.sourceTeamName,
            releasedPlayerId: offer.incoming.id,
            acquiredPlayer: offer.outgoing,
            completedOn: appliedOn,
          }],
    },
    ledger: offer.cashReservedOn
      ? state.ledger
      : [
          ...state.ledger,
          {
            id: ledgerId(state, `transfer:${offer.incoming.id}`),
            date: appliedOn,
            category: "transfer",
            description: `${offer.incoming.handle} acquired from ${offer.sourceTeamName}; ${offer.outgoing.handle} exchanged`,
            amount: -offer.cashOffered,
          },
        ],
    inbox: [
      {
        id: inboxId(state, `trade-complete:${offer.incoming.id}`),
        kind: "market",
        createdOn: appliedOn,
        title: `${offer.incoming.handle} joins ${state.organizationName}`,
        body: `${offer.outgoing.handle} moves to ${offer.sourceTeamName} with $${offer.cashOffered.toLocaleString()} in the completed exchange.`,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
  return updateClubRelationship(next, offer.sourceTeamId, offer.sourceTeamName, 6, { completedTrades: 1 }, appliedOn);
}

function tradeResponseDelay(state: Pick<ManagerCareerState, "seed">, incomingId: string, round: number) {
  return 1 + stableHash(`${state.seed}:${incomingId}:${round}:response-delay`) % 3;
}

function tradeRivalBid(
  state: Pick<ManagerCareerState, "seed">,
  proposal: ManagerTradeProposal,
  requiredCash: number,
  round: number,
) {
  const chance = Math.max(12, Math.min(70, 18 + (proposal.incoming.ovr - 72) * 4));
  if (stableHash(`${state.seed}:${proposal.incoming.id}:${round}:rival-roll`) % 100 >= chance) return {};
  const premium = 0.92 + (stableHash(`${state.seed}:${proposal.incoming.id}:${round}:rival-value`) % 17) / 100;
  return {
    rivalBidCash: Math.max(0, roundTo(requiredCash * premium, 5_000)),
    rivalTeamName: rivalClubNames[stableHash(`${state.seed}:${proposal.incoming.id}:rival-club`) % rivalClubNames.length],
  };
}

export function submitManagerTradeOffer(
  state: ManagerCareerState,
  proposal: ManagerTradeProposal,
): ManagerCareerState {
  const outgoingContract = state.contracts.find((contract) => contract.playerId === proposal.outgoing.id && contract.status !== "expired");
  const targetOffers = state.market.tradeOffers.filter((offer) => offer.incoming.id === proposal.incoming.id);
  const latestOffer = targetOffers[targetOffers.length - 1];
  const nextRound = Math.max(0, ...targetOffers.map((offer) => offer.round)) + 1;
  const repeatedOffer = state.market.tradeOffers.some((offer) =>
    offer.incoming.id === proposal.incoming.id
    && offer.outgoing.id === proposal.outgoing.id
    && offer.cashOffered === proposal.cashOffered
    && !["withdrawn", "superseded", "expired"].includes(offer.status));
  const outgoingCommittedElsewhere = state.market.tradeOffers.some((offer) =>
    offer.outgoing.id === proposal.outgoing.id
    && offer.incoming.id !== proposal.incoming.id
    && ["pending", "countered", "accepted", "delayed"].includes(offer.status));
  if (
    !state.market.scoutedPlayerIds.includes(proposal.incoming.id)
    || !outgoingContract
    || state.market.signedPlayerIds.includes(proposal.incoming.id)
    || proposal.incoming.id === proposal.outgoing.id
    || proposal.cashOffered < 0
    || proposal.cashOffered > state.cash
    || repeatedOffer
    || outgoingCommittedElsewhere
    || nextRound > MAX_TRADE_ROUNDS
    || state.market.unavailablePlayerIds.includes(proposal.incoming.id)
    || Boolean(latestOffer && ["pending", "accepted", "delayed"].includes(latestOffer.status))
    || Boolean(latestOffer?.status === "countered" && latestOffer.expiresOn && state.date > latestOffer.expiresOn)
  ) return state;
  const evaluation = evaluateManagerTradeProposal(state, proposal);
  const responseOn = addDays(state.date, tradeResponseDelay(state, proposal.incoming.id, nextRound));
  const rival = tradeRivalBid(state, proposal, evaluation.requiredCash, nextRound);
  const offer: ManagerTradeOffer = {
    id: `${state.seed}:trade:${proposal.incoming.id}:${state.market.tradeOffers.length}`,
    ...proposal,
    submittedOn: state.date,
    responseOn,
    round: nextRound,
    status: "pending",
    parentOfferId: latestOffer?.id,
    ...rival,
    reasons: [
      `Round ${nextRound} proposal sent to ${proposal.sourceTeamName}`,
      `A response is expected by ${responseOn}`,
    ],
  };
  const supersededOffers = state.market.tradeOffers.map((item) => item.id === latestOffer?.id && item.status === "countered"
    ? { ...item, status: "superseded" as const, reasons: [...item.reasons, "A revised proposal replaced this counteroffer"] }
    : item);
  const next: ManagerCareerState = {
    ...state,
    market: { ...state.market, tradeOffers: [...supersededOffers, offer] },
    inbox: [
      {
        id: inboxId(state, `trade-submitted:${proposal.incoming.id}:${nextRound}`),
        kind: "market" as const,
        createdOn: state.date,
        title: `Trade proposal sent to ${proposal.sourceTeamName}`,
        body: `Round ${nextRound} offers ${proposal.outgoing.handle} plus $${proposal.cashOffered.toLocaleString()} for ${proposal.incoming.handle}. A response is expected by ${responseOn}.`,
        deadline: responseOn,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
  return updateClubRelationship(next, proposal.sourceTeamId, proposal.sourceTeamName, 0, { approaches: 1 });
}

function resolveManagerTradeOffer(state: ManagerCareerState, offerId: string): ManagerCareerState {
  const offer = state.market.tradeOffers.find((item) => item.id === offerId && item.status === "pending");
  if (!offer) return state;
  const evaluation = evaluateManagerTradeProposal(state, offer);
  const beatenByRival = offer.rivalBidCash != null && offer.cashOffered < offer.rivalBidCash;
  const closedByRoundLimit = offer.round >= MAX_TRADE_ROUNDS;
  let status: ManagerTradeOfferStatus;
  let counterCash = evaluation.counterCash;
  let reasons = [...evaluation.reasons];
  if (beatenByRival) {
    const rivalLine = Math.max(evaluation.requiredCash, (offer.rivalBidCash ?? 0) + 5_000);
    reasons.push(`${offer.rivalTeamName} submitted a stronger package`);
    if (closedByRoundLimit) {
      status = "outbid";
      reasons.push(`${offer.incoming.handle} is no longer available`);
    } else {
      status = "countered";
      counterCash = rivalLine;
      reasons.push(`${offer.sourceTeamName} will continue talks at $${rivalLine.toLocaleString()}`);
    }
  } else if (evaluation.status === "accepted") {
    status = "accepted";
  } else if (evaluation.status === "countered" && !closedByRoundLimit) {
    status = "countered";
    counterCash = evaluation.counterCash;
  } else {
    status = "rejected";
    if (closedByRoundLimit) reasons.push("The club has closed negotiations after the final round");
  }
  if (status === "accepted" && state.cash < offer.cashOffered) {
    status = "expired";
    reasons.push("The proposal lapsed because the committed cash was no longer available");
  }
  const lock = status === "accepted" ? managerTradeLockingEvent(state, offer.outgoing.id, offer.responseOn) : undefined;
  const event = lock ? managerEventById(lock.eventId) : undefined;
  const eventSchedule = event ? managerEventSchedule(event, state.season) : undefined;
  if (lock) status = "delayed";
  const expiresOn = status === "countered" ? addDays(offer.responseOn, 3) : undefined;
  let next: ManagerCareerState = {
    ...state,
    cash: lock ? state.cash - offer.cashOffered : state.cash,
    market: {
      ...state.market,
      unavailablePlayerIds: status === "outbid"
        ? Array.from(new Set([...state.market.unavailablePlayerIds, offer.incoming.id]))
        : state.market.unavailablePlayerIds,
      tradeOffers: state.market.tradeOffers.map((item) => item.id === offer.id
        ? {
            ...item,
            status,
            counterCash,
            expiresOn,
            cashReservedOn: lock ? offer.responseOn : item.cashReservedOn,
            delayedEventId: lock?.eventId,
            resolvesOn: eventSchedule?.endsOn,
            reasons,
          }
        : item),
    },
    ledger: lock
      ? [
          ...state.ledger,
          {
            id: ledgerId(state, `transfer-reserve:${offer.incoming.id}`),
            date: offer.responseOn,
            category: "transfer",
            description: `${offer.incoming.handle} transfer funds committed pending ${event?.shortName ?? "roster lock"}`,
            amount: -offer.cashOffered,
          },
        ]
      : state.ledger,
    inbox: [
      {
        id: inboxId(state, `trade-response:${offer.incoming.id}:${offer.round}`),
        kind: "market",
        createdOn: offer.responseOn,
        title: status === "accepted"
          ? `${offer.sourceTeamName} accepted the trade`
          : status === "delayed"
            ? `${offer.sourceTeamName} accepted; transfer delayed`
            : status === "countered"
              ? `${offer.sourceTeamName} sent a counteroffer`
              : status === "outbid"
                ? `${offer.rivalTeamName} won the race for ${offer.incoming.handle}`
                : status === "expired"
                  ? `Trade for ${offer.incoming.handle} lapsed`
                  : `${offer.sourceTeamName} rejected the trade`,
        body: status === "delayed"
          ? `${offer.outgoing.handle} is on a locked event roster. The accepted exchange will complete after ${event?.shortName ?? "the event"}.`
          : status === "countered"
            ? `The club wants ${offer.outgoing.handle} plus $${(counterCash ?? 0).toLocaleString()}. This counter expires ${expiresOn}.`
            : reasons[reasons.length - 1] ?? "The club has responded to the proposal.",
        eventId: lock?.eventId,
        deadline: expiresOn,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
  const trustDelta = status === "accepted" || status === "delayed" ? 3 : status === "countered" ? 0 : -4;
  if (["rejected", "outbid", "expired"].includes(status)) {
    next = adjustPlayerMorale(next, offer.outgoing.id, -2, offer.responseOn);
  }
  next = updateClubRelationship(next, offer.sourceTeamId, offer.sourceTeamName, trustDelta, {
    failedNegotiations: ["rejected", "outbid"].includes(status) ? 1 : 0,
  }, offer.responseOn);
  return status === "accepted" ? applyManagerTrade(next, offer.id, offer.responseOn) : next;
}

function expireManagerTradeCounters(state: ManagerCareerState, throughDate: string) {
  return state.market.tradeOffers
    .filter((offer) => offer.status === "countered" && offer.expiresOn && offer.expiresOn <= throughDate)
    .reduce<ManagerCareerState>((current, offer) => {
      const status: ManagerTradeOfferStatus = offer.rivalBidCash != null ? "outbid" : "expired";
      let next: ManagerCareerState = {
        ...current,
        market: {
          ...current.market,
          unavailablePlayerIds: status === "outbid"
            ? Array.from(new Set([...current.market.unavailablePlayerIds, offer.incoming.id]))
            : current.market.unavailablePlayerIds,
          tradeOffers: current.market.tradeOffers.map((item) => item.id === offer.id
            ? { ...item, status, reasons: [...item.reasons, status === "outbid" ? `${offer.rivalTeamName} completed a competing deal` : "The counteroffer expired"] }
            : item),
        },
        inbox: [
          {
            id: inboxId(current, `trade-expired:${offer.incoming.id}:${offer.round}`),
            kind: "market",
            createdOn: offer.expiresOn!,
            title: status === "outbid" ? `${offer.incoming.handle} joined ${offer.rivalTeamName}` : `${offer.sourceTeamName}'s counteroffer expired`,
            body: status === "outbid" ? "A competing club completed the transfer while the counteroffer was open." : "The negotiation can be reopened only if rounds remain.",
            mandatory: false,
            read: false,
          },
          ...current.inbox,
        ],
      };
      next = adjustPlayerMorale(next, offer.outgoing.id, -2, offer.expiresOn!);
      next = updateClubRelationship(next, offer.sourceTeamId, offer.sourceTeamName, -2, { failedNegotiations: 1 }, offer.expiresOn!);
      return next;
    }, state);
}

function resolveManagerIncomingOffer(state: ManagerCareerState, offerId: string) {
  const offer = state.market.incomingOffers.find((item) => item.id === offerId && item.status === "counter-pending");
  if (!offer || offer.counterCash == null || !offer.responseOn) return state;
  const accepted = offer.counterCash <= offer.buyerLimit
    && managerIncomingOfferTransferAllowed(state, offer.targetPlayer.id, offer.responseOn);
  if (accepted) {
    return applyManagerIncomingOffer(state, offer.id, offer.counterCash, offer.responseOn);
  }
  const rosterBlocked = !managerIncomingOfferTransferAllowed(state, offer.targetPlayer.id, offer.responseOn);
  const next: ManagerCareerState = {
    ...state,
    market: {
      ...state.market,
      incomingOffers: state.market.incomingOffers.map((item) => item.id === offer.id
        ? {
            ...item,
            status: "rejected" as const,
            responseOn: undefined,
            reasons: [...item.reasons, rosterBlocked
              ? "The transfer could not clear the squad-size or roster-lock rules"
              : `${offer.buyerTeamName} would not meet the counter valuation`],
          }
        : item),
    },
    inbox: [
      {
        id: inboxId(state, `incoming-counter-response:${offer.id}`),
        kind: "market",
        createdOn: offer.responseOn,
        title: rosterBlocked
          ? `${offer.targetPlayer.handle} transfer could not proceed`
          : `${offer.buyerTeamName} rejected the counteroffer`,
        body: rosterBlocked
          ? "The club must retain five eligible players and cannot transfer a player on a locked event roster."
          : `${offer.buyerTeamName} ended negotiations after the $${offer.counterCash.toLocaleString()} counteroffer.`,
        offerId: offer.id,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
  return updateClubRelationship(next, offer.buyerTeamId, offer.buyerTeamName, -3, { failedNegotiations: 1 }, offer.responseOn);
}

function expireManagerIncomingOffers(state: ManagerCareerState, throughDate: string) {
  return state.market.incomingOffers
    .filter((offer) => offer.status === "pending" && offer.expiresOn <= throughDate)
    .reduce<ManagerCareerState>((current, offer) => ({
      ...current,
      market: {
        ...current.market,
        incomingOffers: current.market.incomingOffers.map((item) => item.id === offer.id
          ? { ...item, status: "expired" as const, reasons: [...item.reasons, "The response window closed"] }
          : item),
      },
      inbox: [
        {
          id: inboxId(current, `incoming-expired:${offer.id}`),
          kind: "market",
          createdOn: offer.expiresOn,
          title: `${offer.buyerTeamName} withdrew its bid`,
          body: `The $${offer.cashOffered.toLocaleString()} offer for ${offer.targetPlayer.handle} expired without a response.`,
          offerId: offer.id,
          mandatory: false,
          read: false,
        },
        ...current.inbox,
      ],
    }), state);
}

export function resolveManagerTradeTimeline(state: ManagerCareerState, throughDate: string) {
  const responded = state.market.tradeOffers
    .filter((offer) => offer.status === "pending" && offer.responseOn <= throughDate)
    .sort((left, right) => left.responseOn.localeCompare(right.responseOn) || left.id.localeCompare(right.id))
    .reduce<ManagerCareerState>((current, offer) => resolveManagerTradeOffer(current, offer.id), state);
  const outgoingResolved = expireManagerTradeCounters(responded, throughDate);
  const incomingResponded = outgoingResolved.market.incomingOffers
    .filter((offer) => offer.status === "counter-pending" && offer.responseOn && offer.responseOn <= throughDate)
    .sort((left, right) => left.responseOn!.localeCompare(right.responseOn!) || left.id.localeCompare(right.id))
    .reduce<ManagerCareerState>((current, offer) => resolveManagerIncomingOffer(current, offer.id), outgoingResolved);
  return expireManagerIncomingOffers(incomingResponded, throughDate);
}

export function acceptManagerTradeCounter(state: ManagerCareerState, offerId: string) {
  const offer = state.market.tradeOffers.find((item) => item.id === offerId && item.status === "countered");
  if (!offer || offer.counterCash == null || offer.counterCash > state.cash || (offer.expiresOn != null && state.date > offer.expiresOn)) return state;
  const lock = managerTradeLockingEvent(state, offer.outgoing.id, state.date);
  const event = lock ? managerEventById(lock.eventId) : undefined;
  const eventSchedule = event ? managerEventSchedule(event, state.season) : undefined;
  const next: ManagerCareerState = {
    ...state,
    cash: lock ? state.cash - offer.counterCash : state.cash,
    market: {
      ...state.market,
      tradeOffers: state.market.tradeOffers.map((item) => item.id === offerId
        ? {
            ...item,
            cashOffered: offer.counterCash!,
            status: lock ? "delayed" : "accepted",
            cashReservedOn: lock ? state.date : item.cashReservedOn,
            delayedEventId: lock?.eventId,
            resolvesOn: eventSchedule?.endsOn,
            expiresOn: undefined,
            reasons: [...item.reasons, `${state.organizationName} accepted the club's counteroffer`],
          }
        : item),
    },
    inbox: [
      {
        id: inboxId(state, `trade-counter-accepted:${offer.incoming.id}`),
        kind: "market",
        createdOn: state.date,
        title: lock ? "Counteroffer accepted; transfer delayed" : "Counteroffer accepted",
        body: lock
          ? `${offer.outgoing.handle}'s roster lock delays the exchange until ${event?.shortName ?? "the event"} ends.`
          : `${offer.incoming.handle} will join for ${offer.outgoing.handle} plus $${offer.counterCash.toLocaleString()}.`,
        eventId: lock?.eventId,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
    ledger: lock
      ? [
          ...state.ledger,
          {
            id: ledgerId(state, `transfer-reserve:${offer.incoming.id}`),
            date: state.date,
            category: "transfer",
            description: `${offer.incoming.handle} transfer funds committed pending ${event?.shortName ?? "roster lock"}`,
            amount: -offer.counterCash,
          },
        ]
      : state.ledger,
  };
  const relationshipState = updateClubRelationship(next, offer.sourceTeamId, offer.sourceTeamName, 3);
  return lock ? relationshipState : applyManagerTrade(relationshipState, offerId, state.date);
}

export function withdrawManagerTradeOffer(state: ManagerCareerState, offerId: string) {
  const offer = state.market.tradeOffers.find((item) => item.id === offerId && item.status === "pending");
  if (!offer) return state;
  const next: ManagerCareerState = {
    ...state,
    market: {
      ...state.market,
      tradeOffers: state.market.tradeOffers.map((item) => item.id === offerId
        ? { ...item, status: "withdrawn", reasons: [...item.reasons, `${state.organizationName} withdrew the proposal`] }
        : item),
    },
    inbox: [
      {
        id: inboxId(state, `trade-withdrawn:${offer.incoming.id}:${offer.round}`),
        kind: "market",
        createdOn: state.date,
        title: `Trade proposal withdrawn from ${offer.sourceTeamName}`,
        body: `Talks for ${offer.incoming.handle} ended before the club responded.`,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
  return updateClubRelationship(next, offer.sourceTeamId, offer.sourceTeamName, -2);
}

function resolveDelayedManagerTrades(state: ManagerCareerState, eventId: string, resolvedOn: string) {
  return state.market.tradeOffers
    .filter((offer) => offer.status === "delayed" && offer.delayedEventId === eventId && !offer.appliedOn)
    .reduce<ManagerCareerState>((current, offer) => applyManagerTrade(current, offer.id, resolvedOn), state);
}

function monthStartsBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const dates: string[] = [];
  while (cursor.toISOString().slice(0, 10) <= endDate) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return dates;
}

function settlePayroll(state: ManagerCareerState, throughDate: string) {
  const monthlyPayroll = managerMonthlyPayroll(state);
  const payrollDates = monthlyPayroll ? monthStartsBetween(state.date, throughDate) : [];
  if (!payrollDates.length) return { cash: state.cash, ledger: state.ledger, monthlyPayroll, charged: 0 };
  const entries = payrollDates.map((date): ManagerLedgerEntry => ({
    id: `${state.seed}:${date}:payroll`,
    date,
    category: "payroll",
    description: `${state.organizationName} player payroll`,
    amount: -monthlyPayroll,
  }));
  return {
    cash: state.cash - monthlyPayroll * payrollDates.length,
    ledger: [...state.ledger, ...entries],
    monthlyPayroll,
    charged: monthlyPayroll * payrollDates.length,
  };
}

export function managerEventEligibility(
  state: ManagerCareerState,
  event: ManagerEvent,
): ManagerEligibility {
  const reasons: string[] = [];
  const totalCost = event.entryFee + event.travelCost;
  const schedule = managerEventSchedule(event, state.season);
  const existing = state.registrations.find((registration) => registration.eventId === event.id);
  if (state.status !== "active") reasons.push("The manager career has ended");
  if (existing && existing.status !== "withdrawn") reasons.push("Already registered");
  if (state.completedEventIds.includes(event.id)) reasons.push("Event already completed");
  if (state.date > schedule.registrationDeadline) reasons.push("Registration deadline passed");
  if (state.vrsRank < event.rankMin || state.vrsRank > event.rankMax) {
    reasons.push(`Requires VRS rank #${event.rankMin}-#${event.rankMax}`);
  }
  if (state.cash < totalCost) reasons.push(`Requires $${totalCost.toLocaleString()} available cash`);
  const conflict = state.registrations
    .filter((registration) => ["confirmed", "active"].includes(registration.status))
    .map((registration) => managerEventById(registration.eventId))
    .find((registeredEvent) =>
      registeredEvent && rangesOverlap(
        schedule.startsOn,
        schedule.endsOn,
        managerEventSchedule(registeredEvent, state.season).startsOn,
        managerEventSchedule(registeredEvent, state.season).endsOn,
      ),
    );
  if (conflict) reasons.push(`Schedule conflict with ${conflict.shortName}`);
  return { eligible: reasons.length === 0, reasons, totalCost };
}

export function registerManagerEvent(
  state: ManagerCareerState,
  eventId: string,
  rosterIds: string[],
): ManagerCareerState {
  const event = managerEventById(eventId);
  if (!event) return state;
  if (event.majorCycle) return state;
  const check = managerEventEligibility(state, event);
  const contractedIds = new Set(state.contracts.filter((contract) => contract.status !== "expired").map((contract) => contract.playerId));
  const uniqueRosterIds = Array.from(new Set(rosterIds));
  const eligibleRosterIds = state.contracts.length
    ? uniqueRosterIds.filter((id) => contractedIds.has(id))
    : uniqueRosterIds;
  if (!check.eligible || eligibleRosterIds.length < 5) return state;
  const schedule = managerEventSchedule(event, state.season);
  const registration: ManagerRegistration = {
    eventId,
    status: "confirmed",
    registeredOn: state.date,
    feePaid: check.totalCost,
    lockedRosterIds: eligibleRosterIds.slice(0, 5),
  };
  const majorProjection = event.majorCycle ? managerMajorProjection(state.vrsRank, state.season) : undefined;
  return {
    ...state,
    cash: state.cash - check.totalCost,
    registrations: [...state.registrations.filter((item) => item.eventId !== eventId), registration],
    ledger: [
      ...state.ledger,
      {
        id: ledgerId(state, `register:${eventId}`),
        date: state.date,
        category: "entry",
        description: `${event.shortName} entry and travel`,
        amount: -check.totalCost,
        eventId,
      },
    ],
    inbox: [
      {
        id: inboxId(state, `registered:${eventId}`),
        kind: "event",
        createdOn: state.date,
        title: `${event.shortName} registration confirmed`,
        body: majorProjection
          ? `Current VRS #${state.vrsRank} projects a ${majorProjection.label} start on ${majorProjection.startsOn}. Entry is recalculated from VRS when the Major begins.`
          : `Roster lock is ${schedule.rosterLockOn}. The event begins ${schedule.startsOn}.`,
        eventId,
        deadline: schedule.rosterLockOn,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
}

export function withdrawManagerEvent(state: ManagerCareerState, eventId: string): ManagerCareerState {
  const event = managerEventById(eventId);
  const registration = state.registrations.find((item) => item.eventId === eventId);
  if (!event || event.majorCycle || !registration || registration.status !== "confirmed") return state;
  const beforeLock = state.date < managerEventSchedule(event, state.season).rosterLockOn;
  const refund = beforeLock ? Math.round(registration.feePaid * 0.5) : 0;
  const reputationPenalty = beforeLock ? 1 : 5;
  return {
    ...state,
    cash: state.cash + refund,
    reputation: Math.max(0, state.reputation - reputationPenalty),
    registrations: state.registrations.map((item) =>
      item.eventId === eventId ? { ...item, status: "withdrawn" } : item,
    ),
    ledger: refund
      ? [
          ...state.ledger,
          {
            id: ledgerId(state, `withdraw:${eventId}`),
            date: state.date,
            category: "withdrawal",
            description: `${event.shortName} withdrawal refund`,
            amount: refund,
            eventId,
          },
        ]
      : state.ledger,
    inbox: [
      {
        id: inboxId(state, `withdrawn:${eventId}`),
        kind: "event",
        createdOn: state.date,
        title: `Withdrawn from ${event.shortName}`,
        body: beforeLock
          ? `Half of the committed cost was returned. Reputation decreased by ${reputationPenalty}.`
          : `The roster lock had passed. Costs were forfeited and reputation decreased by ${reputationPenalty}.`,
        eventId,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
}

export function managerEventReadyToLaunch(state: ManagerCareerState, eventId: string) {
  const event = managerEventById(eventId);
  const registration = state.registrations.find((item) => item.eventId === eventId);
  const startsOn = event ? managerEventStartForRank(event, state.vrsRank, state.season) : "";
  const endsOn = event ? managerEventSchedule(event, state.season).endsOn : "";
  return Boolean(
    event &&
    registration?.status === "confirmed" &&
    !state.activeEventId &&
    state.date >= startsOn &&
    state.date <= endsOn,
  );
}

function awardManagerMajorStickerRevenue(
  state: ManagerCareerState,
  event: ManagerEvent,
  stage: ManagerMajorStage,
  date: string,
  championsCapsule = false,
) {
  const registration = state.registrations.find((item) => item.eventId === event.id);
  if (!event.majorCycle || !registration) return state;
  const targetRevenue = managerMajorStickerRevenue(stage)
    + (championsCapsule ? MANAGER_MAJOR_CHAMPIONS_CAPSULE_REVENUE : 0);
  const paid = registration.stickerRevenuePaid ?? 0;
  const amount = Math.max(0, targetRevenue - paid);
  if (amount === 0) return state;
  const label = championsCapsule ? "Champions Capsule" : `${managerMajorStageLabel(stage)} sticker share`;
  return {
    ...state,
    cash: state.cash + amount,
    registrations: state.registrations.map((item) => item.eventId === event.id
      ? { ...item, stickerRevenuePaid: targetRevenue }
      : item),
    ledger: [
      ...state.ledger,
      {
        id: ledgerId(state, `sticker:${event.id}:${stage}:${targetRevenue}`),
        date,
        category: "sticker" as const,
        description: `${event.shortName} ${label} revenue`,
        amount,
        eventId: event.id,
      },
    ],
    inbox: [
      {
        id: inboxId(state, `sticker:${event.id}:${stage}:${targetRevenue}`),
        kind: "finance" as const,
        createdOn: date,
        title: `${label}: $${amount.toLocaleString()}`,
        body: `The organization has received $${targetRevenue.toLocaleString()} in cumulative sticker revenue from this Major cycle.`,
        eventId: event.id,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
}

export function launchManagerEvent(state: ManagerCareerState, eventId: string): ManagerCareerState {
  const event = managerEventById(eventId);
  const registration = state.registrations.find((item) => item.eventId === eventId);
  if (!event || !registration || !managerEventReadyToLaunch(state, eventId)) return state;
  const majorStage = event.majorCycle ? managerMajorEntryStage(state.vrsRank) : undefined;
  const launched: ManagerCareerState = {
    ...state,
    activeEventId: eventId,
    activeMajorStage: majorStage,
    registrations: state.registrations.map((item) =>
      item.eventId === eventId ? { ...item, status: "active" } : item,
    ),
    inbox: state.inbox.map((item) => (item.eventId === eventId ? { ...item, read: true } : item)),
  };
  return majorStage
    ? awardManagerMajorStickerRevenue(launched, event, majorStage, state.date)
    : launched;
}

export function advanceManagerMajorStage(
  state: ManagerCareerState,
  nextStage: ManagerMajorStage,
): ManagerCareerState {
  const event = managerEventById(state.activeEventId);
  if (!event?.majorCycle || !state.activeMajorStage) return state;
  const startsOn = managerMajorStageStart(nextStage, state.season);
  const advanced: ManagerCareerState = {
    ...state,
    date: startsOn,
    activeMajorStage: nextStage,
    inbox: [
      {
        id: inboxId(state, `major-advance:${nextStage}`),
        kind: "event",
        createdOn: startsOn,
        title: `${event.shortName}: qualified for ${managerMajorStageLabel(nextStage)}`,
        body: `The locked roster advances to ${managerMajorStageLabel(nextStage)}. No new registration or travel payment is required.`,
        eventId: event.id,
        mandatory: false,
        read: false,
      },
      ...state.inbox,
    ],
  };
  return awardManagerMajorStickerRevenue(advanced, event, nextStage, startsOn);
}

const rankMovement: Record<PlacementTier, number> = {
  swiss: 2,
  top8: -1,
  top4: -3,
  "runner-up": -5,
  champion: -7,
};

const baseVrsAward: Record<PlacementTier, number> = {
  swiss: 6,
  top8: 18,
  top4: 32,
  "runner-up": 46,
  champion: 64,
};

export function completeManagerEvent(
  state: ManagerCareerState,
  eventId: string,
  placement: PlacementTier,
  playerRatings: Record<string, number> = {},
): ManagerCareerState {
  const event = managerEventById(eventId);
  const registration = state.registrations.find((item) => item.eventId === eventId);
  if (!event || !registration || registration.status !== "active" || state.activeEventId !== eventId) return state;
  const prize = event.prizes[placement];
  const points = Math.round(baseVrsAward[placement] * event.vrsWeight);
  const nextRank = Math.max(1, Math.min(64, state.vrsRank + rankMovement[placement]));
  const boardDelta = placement === "champion" ? 8 : placement === "runner-up" ? 5 : placement === "top4" ? 3 : placement === "top8" ? 1 : -3;
  const completedOn = event.majorCycle && state.activeMajorStage
    ? managerMajorStageEnd(state.activeMajorStage, state.season)
    : managerEventSchedule(event, state.season).endsOn;
  const stickerState = event.majorCycle && state.activeMajorStage && placement === "champion"
    ? awardManagerMajorStickerRevenue(state, event, state.activeMajorStage, completedOn, true)
    : state;
  const working = resolveManagerTradeTimeline(stickerState, completedOn);
  const payroll = settlePayroll(working, completedOn);
  const usedPlayerIds = new Set(registration.lockedRosterIds);
  const moraleDelta = placement === "champion" ? 7 : placement === "runner-up" ? 5 : placement === "top4" ? 3 : placement === "top8" ? 1 : -4;
  const contractByPlayer = new Map(working.contracts.map((contract) => [contract.playerId, contract]));
  const playerDynamics = working.playerDynamics.map((item) => {
    const contract = contractByPlayer.get(item.playerId);
    if (!contract || contract.status === "expired") return item;
    if (usedPlayerIds.has(item.playerId)) {
      const rating = playerRatings[item.playerId];
      const targetForm = Number.isFinite(rating)
        ? clampScore(50 + (rating - 1) * 58)
        : clampScore(50 + moraleDelta * 2);
      return {
        ...item,
        morale: clampScore(item.morale + moraleDelta),
        familiarity: clampScore(item.familiarity + 3),
        form: clampScore(item.form * 0.45 + targetForm * 0.55),
        lastUpdatedOn: completedOn,
      };
    }
    const rolePenalty = contract.squadRole === "star" ? 4 : contract.squadRole === "starter" ? 3 : contract.squadRole === "rotation" ? 1 : 0;
    return {
      ...item,
      morale: clampScore(item.morale - rolePenalty),
      familiarity: clampScore(item.familiarity - 1),
      form: clampScore(item.form * 0.82 + 50 * 0.18),
      lastUpdatedOn: completedOn,
    };
  });
  const objectiveCompleted = working.boardObjective.status === "active"
    && (
      (working.boardObjective.startingRank > working.boardObjective.targetRank && nextRank <= working.boardObjective.targetRank)
      || (working.boardObjective.startingRank === 1 && completedOn >= working.boardObjective.deadline && nextRank === 1)
    );
  const boardObjective = objectiveCompleted
    ? { ...working.boardObjective, status: "completed" as const }
    : working.boardObjective;
  const completedState: ManagerCareerState = {
    ...working,
    date: completedOn,
    cash: payroll.cash + prize,
    vrsPoints: working.vrsPoints + points,
    vrsRank: nextRank,
    reputation: Math.max(0, Math.min(100, working.reputation + Math.max(-1, -rankMovement[placement]))),
    boardConfidence: Math.max(0, Math.min(100, working.boardConfidence + boardDelta + (objectiveCompleted ? boardObjective.rewardConfidence : 0))),
    activeEventId: undefined,
    activeMajorStage: undefined,
    completedEventIds: Array.from(new Set([...working.completedEventIds, eventId])),
    registrations: working.registrations.map((item) =>
      item.eventId === eventId ? { ...item, status: "completed", placement } : item,
    ),
    playerDynamics,
    boardObjective,
    ledger: [
      ...payroll.ledger,
      {
        id: ledgerId(working, `prize:${eventId}`),
        date: completedOn,
        category: "prize",
        description: `${event.shortName} prize money`,
        amount: prize,
        eventId,
      },
    ],
    inbox: [
      ...(objectiveCompleted
        ? [{
            id: inboxId(working, `board-objective:${boardObjective.id}`),
            kind: "result" as const,
            createdOn: completedOn,
            title: "Board objective achieved",
            body: `${boardObjective.title}. Board confidence increased by ${boardObjective.rewardConfidence} points.`,
            mandatory: false,
            read: false,
          }]
        : []),
      {
        id: inboxId(working, `ranking:${eventId}:${nextRank}:${points}`),
        kind: "ranking",
        createdOn: completedOn,
        title: nextRank < working.vrsRank
          ? `VRS rise: #${working.vrsRank} to #${nextRank}`
          : nextRank > working.vrsRank
            ? `VRS drop: #${working.vrsRank} to #${nextRank}`
            : `VRS position held at #${nextRank}`,
        body: `${event.shortName} added ${points} points. ${working.organizationName} now has ${working.vrsPoints + points} VRS points.`,
        eventId,
        rankBefore: working.vrsRank,
        rankAfter: nextRank,
        pointsDelta: points,
        mandatory: false,
        read: false,
      },
      {
        id: inboxId(working, `result:${eventId}`),
        kind: "result",
        createdOn: completedOn,
        title: `${event.shortName} campaign complete`,
        body: `${placementLabel(placement)} earned $${prize.toLocaleString()} and ${points} VRS points.`,
        eventId,
        mandatory: false,
        read: false,
      },
      ...working.inbox,
    ],
  };
  return resolveDelayedManagerTrades(completedState, eventId, completedOn);
}

export function advanceManagerDate(state: ManagerCareerState, nextDate: string): ManagerCareerState {
  if (state.status !== "active") return state;
  const activeRegistration = state.registrations.find((registration) => (
    registration.eventId === state.activeEventId && registration.status === "active"
  ));
  if (managerEventById(state.activeEventId) && activeRegistration) return state;
  const unlockedState = state.activeEventId
    ? { ...state, activeEventId: undefined, activeMajorStage: undefined }
    : state;
  const expiryDate = nextDate > unlockedState.date ? nextDate : unlockedState.date;
  const expiredRegistrations = unlockedState.registrations.filter((registration) => {
    const event = managerEventById(registration.eventId);
    return registration.status === "confirmed" && Boolean(event && managerEventSchedule(event, unlockedState.season).endsOn < expiryDate);
  });
  const recoveredState = expiredRegistrations.length
    ? {
        ...unlockedState,
        registrations: unlockedState.registrations.map((registration) => (
          expiredRegistrations.some((expired) => expired.eventId === registration.eventId)
            ? { ...registration, status: "withdrawn" as const }
            : registration
        )),
        inbox: [
          ...expiredRegistrations.map((registration): ManagerInboxItem => {
            const event = managerEventById(registration.eventId)!;
            return {
              id: `${unlockedState.seed}:${expiryDate}:expired:${event.id}`,
              kind: "deadline",
              createdOn: expiryDate,
              title: `${event.shortName} event window passed`,
              body: "The confirmed entry was retired because the event dates have already passed.",
              eventId: event.id,
              mandatory: false,
              read: false,
            };
          }),
          ...unlockedState.inbox,
        ],
      }
    : unlockedState;
  if (nextDate <= recoveredState.date) return recoveredState;
  const payroll = settlePayroll(recoveredState, nextDate);
  const crossedDeadlines = managerEvents.filter(
    (event) => {
      const schedule = managerEventSchedule(event, recoveredState.season);
      return recoveredState.date <= schedule.registrationDeadline
        && nextDate > schedule.registrationDeadline
        && !recoveredState.registrations.some((registration) => registration.eventId === event.id);
    },
  );
  const advanced: ManagerCareerState = {
    ...recoveredState,
    date: nextDate,
    cash: payroll.cash,
    ledger: payroll.ledger,
    inbox: [
      ...(payroll.monthlyPayroll > 0 && payroll.cash < payroll.monthlyPayroll * 2
        ? [{
            id: `${recoveredState.seed}:${nextDate}:low-cash`,
            kind: "finance" as const,
            createdOn: nextDate,
            title: "Operating runway is below two months",
            body: `Available cash is below two payroll cycles (${payroll.monthlyPayroll.toLocaleString()} per month).`,
            mandatory: false,
            read: false,
          }]
        : []),
      ...crossedDeadlines.map((event, index): ManagerInboxItem => ({
        id: `${recoveredState.seed}:${nextDate}:missed:${event.id}:${index}`,
        kind: "deadline",
        createdOn: nextDate,
        title: `${event.shortName} registration closed`,
        body: "The organization did not submit an entry before the deadline.",
        eventId: event.id,
        mandatory: false,
        read: false,
      })),
      ...recoveredState.inbox,
    ],
  };
  const resolvedCamps = resolveManagerPerformanceCamps(advanced, nextDate);
  const resolvedTrades = resolveManagerTradeTimeline(resolvedCamps, nextDate);
  const objective = resolvedTrades.boardObjective;
  if (objective.status !== "active" || nextDate < objective.deadline) return resolvedTrades;
  const completed = resolvedTrades.vrsRank <= objective.targetRank;
  return {
    ...resolvedTrades,
    boardObjective: { ...objective, status: completed ? "completed" : "failed" },
    boardConfidence: clampScore(resolvedTrades.boardConfidence + (completed ? objective.rewardConfidence : -8)),
    inbox: [
      {
        id: inboxId(resolvedTrades, `board-objective-deadline:${objective.id}`),
        kind: "result",
        createdOn: nextDate,
        title: completed ? "Board objective achieved" : "Board objective missed",
        body: completed
          ? `${objective.title}. Board confidence increased by ${objective.rewardConfidence} points.`
          : `${objective.title} was not completed before the deadline. The board will review the season plan.`,
        mandatory: !completed,
        read: false,
      },
      ...resolvedTrades.inbox,
    ],
  };
}

export function startNextManagerSeason(state: ManagerCareerState): ManagerCareerState {
  if (state.status !== "active" || state.activeEventId || nextManagerCheckpoint(state)) return state;
  const nextSeason = state.season + 1;
  const nextDate = managerSeasonStartDate(nextSeason);
  if (nextDate <= state.date) return state;
  const resolved = resolveManagerTradeTimeline(state, nextDate);
  const payroll = settlePayroll(resolved, nextDate);
  if (payroll.cash < 0) {
    const endReason = `${resolved.organizationName} closed Season ${resolved.season} with ${Math.abs(payroll.cash).toLocaleString()} in unpaid obligations.`;
    return {
      ...resolved,
      status: "bankrupt",
      endedOn: nextDate,
      endReason,
      date: nextDate,
      cash: payroll.cash,
      boardConfidence: 0,
      ledger: payroll.ledger,
      inbox: [
        {
          id: `${resolved.seed}:${nextDate}:insolvency`,
          kind: "finance",
          createdOn: nextDate,
          title: "Season-end insolvency closes the club",
          body: `${endReason} The board allowed operations through the season, but will not authorize another competition cycle.`,
          mandatory: true,
          read: false,
        },
        ...resolved.inbox,
      ],
    };
  }
  const contracts = resolved.contracts.map((contract): ManagerPlayerContract => {
    if (contract.status === "expired") return contract;
    const majorCyclesRemaining = Math.max(0, contract.majorCyclesRemaining - 1);
    return {
      ...contract,
      majorCyclesRemaining,
      status: majorCyclesRemaining === 0 ? "expired" : contract.status,
    };
  });
  const expired = contracts.filter((contract) => (
    contract.status === "expired"
    && resolved.contracts.some((previous) => previous.playerId === contract.playerId && previous.status !== "expired")
  ));
  const activePlayerIds = new Set(contracts.filter((contract) => contract.status !== "expired").map((contract) => contract.playerId));
  const nextState: ManagerCareerState = {
    ...resolved,
    season: nextSeason,
    date: nextDate,
    cash: payroll.cash,
    activeEventId: undefined,
    activeMajorStage: undefined,
    registrations: [automaticManagerMajorRegistration(nextDate, contracts)],
    completedEventIds: [],
    contracts,
    playerDynamics: resolved.playerDynamics.map((item) => activePlayerIds.has(item.playerId)
      ? {
          ...item,
          familiarity: clampScore(item.familiarity - 3),
          form: clampScore(item.form * 0.65 + 50 * 0.35),
          lastUpdatedOn: nextDate,
        }
      : item),
    boardObjective: createBoardObjective(resolved.seed, resolved.vrsRank, nextSeason),
    market: {
      ...resolved.market,
      unavailablePlayerIds: [],
    },
    ledger: payroll.ledger,
    inbox: [
      {
        id: `${resolved.seed}:${nextDate}:season-${nextSeason}`,
        kind: "welcome",
        createdOn: nextDate,
        title: `${managerSeasonLabel(nextSeason)} planning begins`,
        body: expired.length
          ? `${expired.length} player contract${expired.length === 1 ? " has" : "s have"} expired. Rebuild the starting five before the first roster lock.`
          : "The competition calendar is open, contracts have rolled forward, and the board has issued a new VRS mandate. Valve has automatically assigned the team to the next Major cycle at no cost.",
        deadline: managerEventSchedule(managerEvents[0], nextSeason).registrationDeadline,
        mandatory: expired.length > 0,
        read: false,
      },
      ...resolved.inbox,
    ],
  };
  return nextState;
}

export function nextManagerCheckpoint(state: ManagerCareerState) {
  if (state.status !== "active") return undefined;
  const dates = managerEvents.flatMap((event) => {
    if (state.completedEventIds.includes(event.id)) return [];
    const registration = state.registrations.find((item) => item.eventId === event.id);
    const schedule = managerEventSchedule(event, state.season);
    const startsOn = managerEventStartForRank(event, state.vrsRank, state.season);
    if (registration?.status === "confirmed" && startsOn > state.date) return [startsOn];
    if (!registration && schedule.registrationDeadline > state.date) return [schedule.registrationDeadline];
    return [];
  });
  const tradeDates = state.market.tradeOffers.flatMap((offer) => {
    if (offer.status === "pending" && offer.responseOn > state.date) return [offer.responseOn];
    if (offer.status === "countered" && offer.expiresOn && offer.expiresOn > state.date) return [offer.expiresOn];
    return [];
  });
  const incomingOfferDates = state.market.incomingOffers.flatMap((offer) => {
    if (offer.status === "pending" && offer.expiresOn > state.date) return [offer.expiresOn];
    if (offer.status === "counter-pending" && offer.responseOn && offer.responseOn > state.date) return [offer.responseOn];
    return [];
  });
  const objectiveDates = state.boardObjective.status === "active" && state.boardObjective.deadline > state.date
    ? [state.boardObjective.deadline]
    : [];
  const campDates = state.performanceCamps
    .filter((camp) => camp.status === "active" && camp.endsOn > state.date)
    .map((camp) => camp.endsOn);
  return [...dates, ...tradeDates, ...incomingOfferDates, ...objectiveDates, ...campDates].sort()[0];
}

export function managerPlacementLabel(placement: PlacementTier) {
  return placementLabel(placement);
}

function placementLabel(placement: PlacementTier) {
  if (placement === "champion") return "1st";
  if (placement === "runner-up") return "2nd";
  if (placement === "top4") return "3-4th";
  if (placement === "top8") return "5-8th";
  return "Swiss exit";
}

export function markManagerInboxRead(state: ManagerCareerState, itemId: string): ManagerCareerState {
  return {
    ...state,
    inbox: state.inbox.map((item) => (item.id === itemId ? { ...item, read: true } : item)),
  };
}

export function managerFormatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
}
