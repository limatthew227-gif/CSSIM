/**
 * Round AI — decides each player's objective callout and the weighted RoundState used for routing,
 * with tactical phases:
 *   - pre-plant: T executes by strategy with one lurker taking an off-angle; CT holds a default.
 *   - post-plant: CT rotates to retake the planted site; T holds it; the T lurker watches a flank.
 *   - saving biases routes toward low exposure (via RoundState).
 *
 * Outputs feed mirageNav/pathfinder. Nothing here decides who wins a duel — that stays OVR/role-based
 * in the sim. This is the "RoundAI.ts" layer from the map-system architecture.
 */
import { tacticalObjective } from "./mirageNav";
import type { RoundState } from "./pathfinder";

export type Site = "asite" | "bsite";

export interface Situation {
  bombPlanted: boolean;
  plantSite?: Site;
  enemyAwperPressure: number; // 0..1
  hasUtility: boolean;
  availableUtility: number; // 0..1
  saving: boolean;
}

/** Objective callout for a player given side, roster index, the T strategy, and the live situation. */
export function objectiveFor(side: "CT" | "T", idx: number, strategy: number, sit: Situation): string {
  if (sit.bombPlanted && sit.plantSite) {
    if (side === "CT") return sit.plantSite; // retake the planted site
    if (idx === 4) return sit.plantSite === "asite" ? "connector" : "underpass"; // lurker watches the flank
    return sit.plantSite; // rest of T holds the plant
  }
  if (side === "T" && idx === 4) {
    // pre-plant lurker takes an off-angle route instead of stacking the execute
    return strategy === 2 ? "underpass" : "connector";
  }
  return tacticalObjective(side, idx, strategy);
}

export function roundStateFor(sit: Situation): RoundState {
  return {
    enemyAwperPressure: sit.enemyAwperPressure,
    hasUtility: sit.hasUtility,
    availableUtility: sit.availableUtility,
    bombPlanted: sit.bombPlanted,
    saving: sit.saving,
  };
}
