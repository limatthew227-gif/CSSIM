import type { Player } from "./gameData";

// Career-continuation + transfer-market math. Pure and deterministic-given-rng so it is unit-testable
// and stays out of the seeded sim path. See the loop in App.tsx (continueCareer + the transfer window).

export const STARTING_BANKROLL = 40000;

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
