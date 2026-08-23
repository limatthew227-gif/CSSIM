const DAY_MS = 24 * 60 * 60 * 1_000;

export const VRS_FLOOR = 400;
export const VRS_CEILING = 2_000;
export const VRS_WINDOW_DAYS = 6 * 30;
export const VRS_RESULT_BUCKET = 10;

export interface VrsMatchEvidence {
  id: string;
  opponentId: string;
  opponentName: string;
  opponentPoints: number;
  won: boolean;
}

export interface VrsEventEvidence {
  id: string;
  eventId: string;
  eventName: string;
  completedOn: string;
  prizePool: number;
  prizeWon: number;
  lan: boolean;
  prestige: number;
  matches: VrsMatchEvidence[];
}

export interface VrsProfile {
  baselineDate: string;
  baselinePoints: number;
  events: VrsEventEvidence[];
}

export interface VrsBreakdown {
  bountyOffered: number;
  bountyCollected: number;
  opponentNetwork: number;
  lanWins: number;
  seed: number;
  headToHead: number;
  points: number;
  activeEvents: number;
  activeMatches: number;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function timestamp(date: string) {
  const value = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(value) ? value : 0;
}

function ageDays(date: string, asOf: string) {
  return Math.max(0, (timestamp(asOf) - timestamp(date)) / DAY_MS);
}

/** Valve currently applies a linear modifier across a six-month results window. */
export function vrsAgeWeight(date: string, asOf: string) {
  return clamp(1 - ageDays(date, asOf) / VRS_WINDOW_DAYS);
}

export function vrsBountyCurve(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return 1 / (1 + Math.abs(Math.log10(value)));
}

export function vrsPointsForRank(rank: number, fieldSize = 64) {
  const safeSize = Math.max(2, Math.round(fieldSize));
  const safeRank = clamp(Math.round(rank), 1, safeSize);
  const percentile = 1 - (safeRank - 1) / (safeSize - 1);
  return Math.round(VRS_FLOOR + percentile * (VRS_CEILING - VRS_FLOOR));
}

export function vrsRankForPoints(points: number, fieldSize = 64) {
  const normalized = clamp((points - VRS_FLOOR) / (VRS_CEILING - VRS_FLOOR));
  return Math.max(1, Math.min(fieldSize, 1 + Math.round((1 - normalized) * (fieldSize - 1))));
}

export function createVrsProfile(date: string, rank: number, fieldSize = 64): VrsProfile {
  return {
    baselineDate: date,
    baselinePoints: vrsPointsForRank(rank, fieldSize),
    events: [],
  };
}

export function normalizeVrsProfile(
  profile: Partial<VrsProfile> | undefined,
  fallbackDate: string,
  fallbackRank: number,
): VrsProfile {
  if (!profile?.baselineDate || !Number.isFinite(profile.baselinePoints)) {
    return createVrsProfile(fallbackDate, fallbackRank);
  }
  return {
    baselineDate: profile.baselineDate,
    baselinePoints: clamp(Math.round(profile.baselinePoints!), VRS_FLOOR, VRS_CEILING),
    events: (profile.events ?? []).map((event) => ({
      ...event,
      prizePool: Math.max(0, event.prizePool ?? 0),
      prizeWon: Math.max(0, event.prizeWon ?? 0),
      prestige: clamp(event.prestige ?? 0.5),
      matches: (event.matches ?? []).map((match) => ({
        ...match,
        opponentPoints: clamp(Math.round(match.opponentPoints ?? VRS_FLOOR), VRS_FLOOR, VRS_CEILING),
        won: Boolean(match.won),
      })),
    })),
  };
}

function addEvidence(baseline: number, evidence: number) {
  return clamp(baseline + clamp(evidence) * (1 - baseline));
}

function eventStakes(event: VrsEventEvidence) {
  const prizeRatio = clamp(event.prizePool / 1_000_000);
  return vrsBountyCurve(prizeRatio) * clamp(event.prestige);
}

function eventPerformanceFactor(event: VrsEventEvidence) {
  if (!event.matches.length) return 1;
  const wins = event.matches.filter((match) => match.won).length;
  const winRate = wins / event.matches.length;
  // Positive bounty, network, and prize evidence must be earned by a competitive event record.
  // A result below 20% wins contributes no positive seed evidence; a 50% record receives full value.
  return clamp((winRate - 0.2) / 0.3);
}

export function calculateVrs(profile: VrsProfile, asOf: string): VrsBreakdown {
  const baseline = clamp((profile.baselinePoints - VRS_FLOOR) / (VRS_CEILING - VRS_FLOOR));
  const agedBaseline = baseline * vrsAgeWeight(profile.baselineDate, asOf);
  const activeEvents = profile.events
    .map((event) => ({
      event,
      age: vrsAgeWeight(event.completedOn, asOf),
      performance: eventPerformanceFactor(event),
    }))
    .filter(({ event, age }) => age > 0 && timestamp(event.completedOn) <= timestamp(asOf));

  const weightedPrizes = activeEvents
    .map(({ event, age, performance }) => event.prizeWon * age * clamp(event.prestige) * performance)
    .sort((left, right) => right - left)
    .slice(0, VRS_RESULT_BUCKET);
  const prizeEvidence = weightedPrizes.length
    ? vrsBountyCurve(clamp(weightedPrizes.reduce((sum, prize) => sum + prize, 0) / 500_000))
    : 0;

  const wins = activeEvents.flatMap(({ event, age, performance }) => event.matches
    .filter((match) => match.won)
    .map((match) => ({
      event,
      match,
      age,
      performance,
      stakes: eventStakes(event),
      opponentStrength: clamp((match.opponentPoints - VRS_FLOOR) / (VRS_CEILING - VRS_FLOOR)),
    })));
  const collectedEvidence = clamp(wins
    .map((win) => win.opponentStrength * win.age * win.stakes * win.performance)
    .sort((left, right) => right - left)
    .slice(0, VRS_RESULT_BUCKET)
    .reduce((sum, value) => sum + value, 0) / 5);

  const networkByOpponent = new Map<string, number>();
  wins.forEach((win) => {
    networkByOpponent.set(
      win.match.opponentId,
      Math.max(networkByOpponent.get(win.match.opponentId) ?? 0, win.age * win.performance),
    );
  });
  const networkEvidence = clamp([...networkByOpponent.values()]
    .sort((left, right) => right - left)
    .slice(0, VRS_RESULT_BUCKET)
    .reduce((sum, value) => sum + value, 0) / VRS_RESULT_BUCKET);

  const lanEvidence = clamp(wins
    .filter((win) => win.event.lan)
    .map((win) => win.age * win.stakes * win.performance)
    .sort((left, right) => right - left)
    .slice(0, VRS_RESULT_BUCKET)
    .reduce((sum, value) => sum + value, 0) / VRS_RESULT_BUCKET);

  const bountyOffered = addEvidence(agedBaseline, prizeEvidence);
  const bountyCollected = addEvidence(agedBaseline, collectedEvidence);
  const opponentNetwork = addEvidence(agedBaseline, networkEvidence);
  const lanWins = addEvidence(agedBaseline, lanEvidence);
  const seed = (bountyOffered + bountyCollected + opponentNetwork + lanWins) / 4;
  const seedPoints = VRS_FLOOR + seed * (VRS_CEILING - VRS_FLOOR);

  const headToHead = Math.round(activeEvents.flatMap(({ event, age, performance }) => event.matches.map((match) => {
    const expected = 1 / (1 + 10 ** ((match.opponentPoints - seedPoints) / 400));
    const result = match.won ? performance * (1 - expected) : -expected;
    return 24 * age * eventStakes(event) * result;
  })).reduce((sum, adjustment) => sum + adjustment, 0));
  // The 400-2000 range applies to seeding. Valve's match adjustments happen
  // afterward, so a sufficiently strong head-to-head record may cross either bound.
  const points = Math.round(seedPoints + headToHead);

  return {
    bountyOffered,
    bountyCollected,
    opponentNetwork,
    lanWins,
    seed,
    headToHead,
    points,
    activeEvents: activeEvents.length,
    activeMatches: activeEvents.reduce((sum, item) => sum + item.event.matches.length, 0),
  };
}

export function appendVrsEvent(profile: VrsProfile, event: VrsEventEvidence) {
  const byId = new Map(profile.events.map((item) => [item.id, item]));
  byId.set(event.id, event);
  return { ...profile, events: [...byId.values()] };
}
