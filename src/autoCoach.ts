import type { Tactic } from "./sim";

export interface AutoCoachInput {
  currentTactic: Tactic;
  recommendedTactic: Tactic;
  recommendationLabel: string;
  recommendationReason: string;
  timeoutRecommended: boolean;
  timeoutPriority: "good" | "neutral" | "bad";
  timeoutLabel: string;
  timeoutReason: string;
  availableTimeouts: number;
  timeoutRounds: number;
  roundsPlayed: number;
}

export interface AutoCoachDecision {
  tactic: Tactic;
  changedTactic: boolean;
  callTimeout: boolean;
  status: string;
  reason: string;
}

export function decideAutoCoach(input: AutoCoachInput): AutoCoachDecision {
  const changedTactic = input.currentTactic !== input.recommendedTactic;
  const timeoutWindow =
    input.roundsPlayed >= 3 &&
    (input.timeoutPriority === "bad" || (input.timeoutPriority === "neutral" && input.roundsPlayed >= 20));
  const callTimeout =
    input.timeoutRecommended &&
    timeoutWindow &&
    input.availableTimeouts > 0 &&
    input.timeoutRounds <= 0;

  if (callTimeout) {
    return {
      tactic: input.recommendedTactic,
      changedTactic,
      callTimeout: true,
      status: `${input.timeoutLabel} / ${input.recommendationLabel}`,
      reason: `${input.timeoutReason} ${input.recommendationReason}`,
    };
  }

  return {
    tactic: input.recommendedTactic,
    changedTactic,
    callTimeout: false,
    status: changedTactic ? `Switch to ${input.recommendationLabel}` : `Hold ${input.recommendationLabel}`,
    reason: input.recommendationReason,
  };
}
