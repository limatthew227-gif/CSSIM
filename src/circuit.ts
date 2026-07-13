import type { PlacementTier } from "./career";
import type { Roster } from "./gameData";

export type CircuitEventId = "open-cup" | "challenger" | "regional" | "major-qualifier" | "major";

export interface CircuitEvent {
  id: CircuitEventId;
  name: string;
  shortName: string;
  description: string;
  rankMin: number;
  rankMax: number;
  qualifiesAt: PlacementTier | "season";
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

export const circuitEvents: CircuitEvent[] = [
  {
    id: "open-cup",
    name: "Open Cup",
    shortName: "Open",
    description: "Lower-ranked and unranked teams fight for a Challenger invitation.",
    rankMin: 6,
    rankMax: 99,
    qualifiesAt: "top8",
    developmentCap: 1,
    pointMultiplier: 1,
    prizes: { swiss: 8000, top8: 12000, top4: 18000, "runner-up": 25000, champion: 35000 },
  },
  {
    id: "challenger",
    name: "Challenger Series",
    shortName: "Challenger",
    description: "Established tier-two teams enter as the road begins to narrow.",
    rankMin: 4,
    rankMax: 30,
    qualifiesAt: "top8",
    developmentCap: 1,
    pointMultiplier: 1.25,
    prizes: { swiss: 10000, top8: 18000, top4: 30000, "runner-up": 45000, champion: 65000 },
  },
  {
    id: "regional",
    name: "Regional Finals",
    shortName: "Regional",
    description: "A top-four finish is required against teams closing in on the elite.",
    rankMin: 2,
    rankMax: 24,
    qualifiesAt: "top4",
    developmentCap: 2,
    pointMultiplier: 1.55,
    prizes: { swiss: 12000, top8: 25000, top4: 45000, "runner-up": 70000, champion: 100000 },
  },
  {
    id: "major-qualifier",
    name: "Major Qualifier",
    shortName: "Qualifier",
    description: "The strongest available field plays for eight Major places.",
    rankMin: 1,
    rankMax: 20,
    qualifiesAt: "top8",
    developmentCap: 2,
    pointMultiplier: 1.9,
    prizes: { swiss: 15000, top8: 30000, top4: 55000, "runner-up": 90000, champion: 140000 },
  },
  {
    id: "major",
    name: "The Major",
    shortName: "Major",
    description: "The full top-level field and the largest rewards of the season.",
    rankMin: 1,
    rankMax: 20,
    qualifiesAt: "season",
    developmentCap: 2,
    pointMultiplier: 2.6,
    prizes: { swiss: 12000, top8: 40000, top4: 70000, "runner-up": 130000, champion: 250000 },
  },
];

export const firstCircuitEventId: CircuitEventId = circuitEvents[0].id;

export function circuitEventById(id: CircuitEventId) {
  return circuitEvents.find((event) => event.id === id) ?? circuitEvents[0];
}

export function circuitEventIndex(id: CircuitEventId) {
  return Math.max(0, circuitEvents.findIndex((event) => event.id === id));
}

export function circuitPrize(event: CircuitEvent, tier: PlacementTier) {
  return event.prizes[tier];
}

export function circuitPointsAward(event: CircuitEvent, tier: PlacementTier) {
  return Math.round(basePoints[tier] * event.pointMultiplier);
}

export function qualifiesForNextEvent(event: CircuitEvent, tier: PlacementTier) {
  return event.qualifiesAt === "season" || placements[tier] >= placements[event.qualifiesAt];
}

export function advanceCircuit(
  currentEventId: CircuitEventId,
  tier: PlacementTier,
  season: number,
  currentPoints: number,
): CircuitProgress {
  const event = circuitEventById(currentEventId);
  const index = circuitEventIndex(currentEventId);
  const pointsEarned = circuitPointsAward(event, tier);
  const qualified = qualifiesForNextEvent(event, tier);
  const totalPoints = currentPoints + pointsEarned;

  if (event.id !== "major") {
    return {
      nextEventId: qualified ? circuitEvents[Math.min(circuitEvents.length - 1, index + 1)].id : event.id,
      season,
      points: totalPoints,
      pointsEarned,
      qualified,
      seasonComplete: false,
    };
  }

  // Ranking points partially decay between seasons. A deep Major run grants a later starting seed,
  // while a Swiss exit sends the team back through more of the circuit.
  const nextEventId: CircuitEventId =
    placements[tier] >= placements.top4 ? "major-qualifier" : tier === "top8" ? "regional" : "challenger";
  return {
    nextEventId,
    season: season + 1,
    points: Math.round(totalPoints * 0.72),
    pointsEarned,
    qualified: true,
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
  if (event.qualifiesAt === "season") return "Season finale";
  const labels: Record<PlacementTier, string> = {
    swiss: "Swiss finish",
    top8: "Top 8",
    top4: "Top 4",
    "runner-up": "Final",
    champion: "Title",
  };
  return `${labels[event.qualifiesAt]} to advance`;
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
) {
  const eligible = shuffled(rosters.filter((roster) => isCircuitEligible(roster, event)), rng);
  if (eligible.length >= count) return eligible.slice(0, count);

  // The bundled database always fills every event from its intended rank band. This fallback only
  // protects small imported databases, preferring teams nearest to the event's eligibility window.
  const selected = new Set(eligible.map((roster) => roster.id));
  const fallback = shuffled(rosters.filter((roster) => !selected.has(roster.id)), rng).sort((a, b) => {
    return distanceFromBand(a.rank ?? 99, event) - distanceFromBand(b.rank ?? 99, event);
  });
  return [...eligible, ...fallback].slice(0, count);
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
