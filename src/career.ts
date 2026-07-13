import type { Player, PlayerStats } from "./gameData";

// Career-continuation + transfer-market math. Pure and deterministic-given-rng so it is unit-testable
// and stays out of the seeded sim path. See the loop in App.tsx (continueCareer + the transfer window).

export const STARTING_BANKROLL = 40000;

export const OVR_CAP = 96; // nobody develops past this, whatever their potential
export const MAX_OVR_GAIN = 2; // most OVR a player can add in one Major
export const MAX_OVR_DROP = 2; // most OVR a player can shed in one Major

export type PlacementTier = "champion" | "runner-up" | "top4" | "top8" | "swiss";

const PRIZES: Record<PlacementTier, number> = {
  champion: 250000,
  "runner-up": 130000,
  top4: 70000,
  top8: 40000,
  swiss: 12000,
};

// A player's transfer value in dollars — convex in OVR so a top star costs far more than a role player
// (each OVR point near the top is worth more than one near the bottom).
export function playerValue(player: Player): number {
  const above = Math.max(0, player.ovr - 50) / 10;
  return Math.round(Math.pow(above, 2.4) * 8000);
}

// Signed cost of swapping `outgoing` (your same-role player) for `candidate`:
//   > 0  → you pay the difference (their player is worth more)
//   < 0  → you bank the surplus  (you traded a more valuable player — the "sell high" refund)
export function transferDelta(candidate: Player, outgoing: Player): number {
  return playerValue(candidate) - playerValue(outgoing);
}

export function prizeForPlacement(tier: PlacementTier): number {
  return PRIZES[tier];
}

// Where you finished this Major, from the run's end state.
export function placementTier(args: { champion: boolean; reachedPlayoffs: boolean; playoffRound: string }): PlacementTier {
  if (args.champion) return "champion";
  if (args.reachedPlayoffs) {
    if (args.playoffRound === "final") return "runner-up";
    if (args.playoffRound === "semifinal") return "top4";
    return "top8"; // quarterfinal
  }
  return "swiss";
}

export function placementLabel(tier: PlacementTier, record: { wins: number; losses: number }): string {
  switch (tier) {
    case "champion":
      return "Champion";
    case "runner-up":
      return "Runner-up";
    case "top4":
      return "Top 4";
    case "top8":
      return "Top 8";
    default:
      return `Swiss exit (${record.wins}-${record.losses})`;
  }
}

// `count` distinct players from the pool, each of a role you already field and none already on your
// roster (so a same-role swap always exists). De-duped by handle so the same pro from two eras can't
// appear twice. rng is injectable for tests.
export function pickTransferCandidates(roster: Player[], pool: Player[], count = 5, rng: () => number = Math.random): Player[] {
  const myRoles = new Set(roster.map((player) => player.role));
  const myIds = new Set(roster.map((player) => player.id));
  const myHandles = new Set(roster.map((player) => player.handle));
  const eligible = pool.filter((player) => !myIds.has(player.id) && !myHandles.has(player.handle) && myRoles.has(player.role));

  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const seen = new Set<string>();
  const picks: Player[] = [];
  for (const player of shuffled) {
    if (seen.has(player.handle)) continue;
    seen.add(player.handle);
    picks.push(player);
    if (picks.length >= count) break;
  }
  return picks;
}

// ---- Player development (your team's versions only) -----------------------------------------------

export interface CareerMeta {
  age: number;
  potential: number; // the OVR ceiling this player can develop toward
}

// Potential headroom by age: younger players can develop toward a higher ceiling, veterans are at peak.
function potentialHeadroom(age: number): number {
  return age <= 20 ? 6 : age <= 23 ? 4 : age <= 26 ? 3 : age <= 29 ? 1 : 0;
}

// Career meta when a player joins your roster. Uses the player's real (Liquipedia-derived, era-adjusted)
// age when known; otherwise synthesises one (e.g. custom-team players with no birth year on record).
export function rollCareerMeta(ovr: number, knownAge?: number, rng: () => number = Math.random): CareerMeta {
  const age = knownAge ?? 18 + Math.floor(rng() * 15); // 18..32
  return { age, potential: Math.min(OVR_CAP, ovr + potentialHeadroom(age)) };
}

// The HLTV-style rating a player of this OVR is "supposed" to put up. Beating it trends their OVR up,
// falling short trends it down. Calibrated so ~+0.15 over expectation earns the full +2.
export function expectedRating(ovr: number): number {
  // Calibrated against the sim (scratch/rating-calibration.ts): in a roughly even fight a player rates
  // close to this, so development is driven by genuinely beating/missing your level, not a constant bias.
  return 1.06 + (ovr - 80) * 0.011; // OVR 80 -> 1.06, 90 -> 1.17, 70 -> 0.95
}

export interface Development {
  ovr: number;
  stats: PlayerStats;
  ovrDelta: number;
  iglDelta: number;
}

// How a player on YOUR roster develops after an event, from their rating + your placement.
// - IGLs frag less, so they're placement-driven: deep runs raise their IGL stat (and OVR); their OVR
//   only drops if they genuinely flopped.
// - Everyone else trends on rating-vs-expectation, capped at +/-2 and the potential ceiling.
export function developPlayer(args: {
  player: Player;
  rating: number;
  placement: PlacementTier;
  potential: number;
  maxGain?: number;
  maxDrop?: number;
  maxIglGain?: number;
}): Development {
  const {
    player,
    rating,
    placement,
    potential,
    maxGain = MAX_OVR_GAIN,
    maxDrop = MAX_OVR_DROP,
    maxIglGain = MAX_OVR_GAIN,
  } = args;
  const goodRun = placement === "champion" || placement === "runner-up" || placement === "top4";
  let ovrDelta = 0;
  let iglDelta = 0;

  if (player.role === "IGL") {
    iglDelta = Math.min(maxIglGain, placement === "champion" ? 2 : goodRun ? 1 : 0);
    const flopped = rating < expectedRating(player.ovr) - 0.15;
    ovrDelta = iglDelta > 0 ? iglDelta : flopped ? -1 : 0;
  } else {
    ovrDelta = Math.round((rating - expectedRating(player.ovr)) * 13);
  }

  // Clamp to the event bounds, the potential ceiling on the way up, and 50 on the way down.
  ovrDelta = Math.max(-maxDrop, Math.min(maxGain, ovrDelta));
  if (ovrDelta > 0) ovrDelta = Math.min(ovrDelta, Math.max(0, potential - player.ovr));
  else ovrDelta = Math.max(ovrDelta, 50 - player.ovr);

  const ovr = player.ovr + ovrDelta;
  const stats = { ...player.stats };
  if (player.role === "IGL" && iglDelta) stats.igl = Math.min(99, stats.igl + iglDelta);
  else if (ovrDelta !== 0) stats.aim = Math.max(50, Math.min(99, stats.aim + ovrDelta)); // keep the card's bars roughly in step

  return { ovr, stats, ovrDelta, iglDelta };
}
