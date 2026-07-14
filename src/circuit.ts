import type { PlacementTier } from "./career";
import type { Roster } from "./gameData";

export type CircuitEventId = "mrq" | "stage-1" | "stage-2" | "stage-3";

export interface CircuitEvent {
  id: CircuitEventId;
  name: string;
  shortName: string;
  description: string;
  rankMin: number;
  rankMax: number;
  qualifiesAt: PlacementTier;
  hasPlayoffs: boolean;
  developmentCap: 1 | 2;
  pointMultiplier: number;
  prizes: Record<PlacementTier, number>;
}

export interface CircuitProgress {
  nextEventId: CircuitEventId;
  season: number;
  points: number;
  pointsEarned: number;
  qualified: boolean;
  seasonComplete: boolean;
}

const placements: Record<PlacementTier, number> = {
  swiss: 0,
  top8: 1,
  top4: 2,
  "runner-up": 3,
  champion: 4,
};

const basePoints: Record<PlacementTier, number> = {
  swiss: 8,
  top8: 20,
  top4: 32,
  "runner-up": 44,
  champion: 55,
};

// The Circuit mirrors Austin's route into the Major: a qualifying gateway followed by three
// 16-team Swiss stages. Only Stage 3 produces the eight-team playoff bracket.
export const circuitEvents: CircuitEvent[] = [
  {
    id: "mrq",
    name: "Major Regional Qualifier",
    shortName: "MRQ",
    description: "Regional contenders play for eight places in Stage 1.",
    rankMin: 27,
    rankMax: 99,
    qualifiesAt: "top8",
    hasPlayoffs: false,
    developmentCap: 1,
    pointMultiplier: 1,
    prizes: { swiss: 6000, top8: 12000, top4: 12000, "runner-up": 12000, champion: 12000 },
  },
  {
    id: "stage-1",
    name: "Major Stage 1",
    shortName: "Stage 1",
    description: "Eight MRQ survivors meet eight direct invites; eight survive into Stage 2.",
    rankMin: 17,
    rankMax: 50,
    qualifiesAt: "top8",
    hasPlayoffs: false,
    developmentCap: 1,
    pointMultiplier: 1.3,
    prizes: { swiss: 9000, top8: 18000, top4: 18000, "runner-up": 18000, champion: 18000 },
  },
  {
    id: "stage-2",
    name: "Major Stage 2",
    shortName: "Stage 2",
    description: "Eight Stage 1 survivors meet eight direct invites; eight advance.",
    rankMin: 9,
    rankMax: 34,
    qualifiesAt: "top8",
    hasPlayoffs: false,
    developmentCap: 2,
    pointMultiplier: 1.7,
    prizes: { swiss: 12000, top8: 28000, top4: 28000, "runner-up": 28000, champion: 28000 },
  },
  {
    id: "stage-3",
    name: "Major Stage 3",
    shortName: "Stage 3",
    description: "The final Swiss field decides the eight teams in the Major playoffs.",
    rankMin: 1,
    rankMax: 20,
    qualifiesAt: "top8",
    hasPlayoffs: true,
    developmentCap: 2,
    pointMultiplier: 2.6,
    prizes: { swiss: 12000, top8: 40000, top4: 70000, "runner-up": 130000, champion: 250000 },
  },
];

export const firstCircuitEventId: CircuitEventId = circuitEvents[0].id;

const legacyEventIds: Record<string, CircuitEventId> = {
  "open-cup": "mrq",
  challenger: "stage-1",
  regional: "stage-2",
  "major-qualifier": "stage-3",
  major: "stage-3",
};

export function normalizeCircuitEventId(id: unknown): CircuitEventId {
  if (typeof id !== "string") return firstCircuitEventId;
  if (circuitEvents.some((event) => event.id === id)) return id as CircuitEventId;
  return legacyEventIds[id] ?? firstCircuitEventId;
}

export function circuitEventById(id: CircuitEventId | string) {
  const normalized = normalizeCircuitEventId(id);
  return circuitEvents.find((event) => event.id === normalized) ?? circuitEvents[0];
}

export function circuitEventIndex(id: CircuitEventId | string) {
  const normalized = normalizeCircuitEventId(id);
  return Math.max(0, circuitEvents.findIndex((event) => event.id === normalized));
}

export function nextCircuitEvent(event: CircuitEvent) {
  const index = circuitEventIndex(event.id);
  return circuitEvents[Math.min(circuitEvents.length - 1, index + 1)];
}

export function circuitPrize(event: CircuitEvent, tier: PlacementTier) {
  return event.prizes[tier];
}

export function circuitPointsAward(event: CircuitEvent, tier: PlacementTier) {
  return Math.round(basePoints[tier] * event.pointMultiplier);
}

export function qualifiesForNextEvent(event: CircuitEvent, tier: PlacementTier) {
  return placements[tier] >= placements[event.qualifiesAt];
}

export function advanceCircuit(
  currentEventId: CircuitEventId,
  tier: PlacementTier,
  season: number,
  currentPoints: number,
): CircuitProgress {
  const event = circuitEventById(currentEventId);
  const pointsEarned = circuitPointsAward(event, tier);
  const qualified = qualifiesForNextEvent(event, tier);
  const totalPoints = currentPoints + pointsEarned;

  if (!event.hasPlayoffs) {
    return {
      nextEventId: qualified ? nextCircuitEvent(event).id : event.id,
      season,
      points: totalPoints,
      pointsEarned,
      qualified,
      seasonComplete: false,
    };
  }

  // Ranking points partially decay between seasons. Deep playoff runs retain a Stage 3 seed,
  // while earlier exits re-enter lower in the next Austin-style path.
  const nextEventId: CircuitEventId =
    placements[tier] >= placements.top4 ? "stage-3" : tier === "top8" ? "stage-2" : "stage-1";
  return {
    nextEventId,
    season: season + 1,
    points: Math.round(totalPoints * 0.72),
    pointsEarned,
    qualified,
    seasonComplete: true,
  };
}

export function circuitWorldRank(points: number) {
  return Math.max(1, 32 - Math.floor(Math.max(0, points) / 9));
}

export function circuitFieldLabel(event: CircuitEvent) {
  if (event.rankMax >= 90) return `HLTV #${event.rankMin}+ and unranked`;
  return `HLTV #${event.rankMin}-${event.rankMax}`;
}

export function circuitQualificationLabel(event: CircuitEvent) {
  return event.hasPlayoffs ? "Top 8 to playoffs" : `Top 8 to ${nextCircuitEvent(event).shortName}`;
}

export function isCircuitEligible(roster: Roster, event: CircuitEvent) {
  const rank = roster.rank ?? 99;
  return rank >= event.rankMin && rank <= event.rankMax;
}

export function pickCircuitRosters(
  rosters: Roster[],
  event: CircuitEvent,
  count: number,
  rng: () => number = Math.random,
  excludedIds: Iterable<string> = [],
) {
  const excluded = new Set(excludedIds);
  const available = rosters.filter((roster) => !excluded.has(roster.id));
  const eligible = shuffled(available.filter((roster) => isCircuitEligible(roster, event)), rng);
  if (eligible.length >= count) return eligible.slice(0, count);

  // The bundled database fills every intended rank band. This fallback protects smaller imported
  // databases by preferring teams nearest to the event's eligibility window.
  const selected = new Set(eligible.map((roster) => roster.id));
  const fallback = shuffled(available.filter((roster) => !selected.has(roster.id)), rng).sort((a, b) => {
    return distanceFromBand(a.rank ?? 99, event) - distanceFromBand(b.rank ?? 99, event);
  });
  return [...eligible, ...fallback].slice(0, count);
}

export function circuitParticipantIds<T extends { id: string }>(...groups: Iterable<T>[]) {
  const ids = new Set<string>();
  groups.forEach((group) => {
    for (const team of group) ids.add(team.id);
  });
  return ids;
}

export function composeCircuitField<T extends { id: string }>(qualifiers: T[], directInvites: T[], size: number) {
  const seen = new Set<string>();
  return [...qualifiers, ...directInvites].filter((team) => {
    if (seen.has(team.id)) return false;
    seen.add(team.id);
    return true;
  }).slice(0, size);
}

function shuffled<T>(items: T[], rng: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function distanceFromBand(rank: number, event: CircuitEvent) {
  if (rank < event.rankMin) return event.rankMin - rank;
  if (rank > event.rankMax) return rank - event.rankMax;
  return 0;
}
