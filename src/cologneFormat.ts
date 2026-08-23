export type CologneStage = "stage-1" | "stage-2";
export type CologneOverviewStage = CologneStage | "playoffs";

export interface CologneTeam {
  id: string;
  rank?: number;
}

export interface ColognePair<T extends CologneTeam> {
  id: string;
  left: T;
  right: T;
  active?: boolean;
}

export interface CologneResult<T extends CologneTeam> {
  pairId: string;
  round: number;
  left: T;
  right: T;
  winnerId: string;
}

export interface CologneStageStatus<T extends CologneTeam> {
  advanced: T[];
  eliminated: T[];
  live: T[];
  resolved: boolean;
}

export interface ColognePlayoffSeeds<T extends CologneTeam> {
  byes: [T, T];
  quarterfinals: [[T, T], [T, T]];
}

export function cologneOverviewResults<T extends { eventId?: string }>(
  results: T[],
  activeStage?: CologneOverviewStage,
) {
  if (activeStage === "stage-1") {
    return results.filter((result) => result.eventId === "stage-1");
  }
  if (activeStage === "stage-2") {
    return results.filter((result) => result.eventId === "stage-2");
  }
  return results.filter((result) => result.eventId !== "stage-1");
}

const STAGE_ONE_OPENING_SEEDS: Array<[number, number]> = [
  [0, 15],
  [7, 8],
  [3, 12],
  [4, 11],
  [1, 14],
  [6, 9],
  [2, 13],
  [5, 10],
];

const STAGE_TWO_OPENING_SEEDS: Array<[number, number]> = [
  [0, 7],
  [3, 4],
  [1, 6],
  [2, 5],
];

function ranked<T extends CologneTeam>(teams: T[]) {
  return [...teams].sort((left, right) => (
    (left.rank ?? 999) - (right.rank ?? 999)
    || left.id.localeCompare(right.id)
  ));
}

function pair<T extends CologneTeam>(
  stage: CologneStage,
  round: number,
  lane: string,
  index: number,
  left: T | undefined,
  right: T | undefined,
  userId: string,
): ColognePair<T> | undefined {
  if (!left || !right) return undefined;
  return {
    id: `cologne-${stage}-r${round}-${lane}-${index}-${left.id}-${right.id}`,
    left,
    right,
    active: left.id === userId || right.id === userId,
  };
}

function openingPairs<T extends CologneTeam>(
  teams: T[],
  stage: CologneStage,
  userId: string,
) {
  const seeds = ranked(teams);
  const pairings = stage === "stage-1" ? STAGE_ONE_OPENING_SEEDS : STAGE_TWO_OPENING_SEEDS;
  return pairings.flatMap(([leftIndex, rightIndex], index) => {
    const next = pair(stage, 1, "opening", index, seeds[leftIndex], seeds[rightIndex], userId);
    return next ? [next] : [];
  });
}

function resultForPair<T extends CologneTeam>(
  results: CologneResult<T>[],
  nextPair: ColognePair<T>,
) {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    if (results[index].pairId === nextPair.id) return results[index];
  }
  return undefined;
}

function winner<T extends CologneTeam>(result: CologneResult<T> | undefined) {
  if (!result) return undefined;
  return result.winnerId === result.left.id ? result.left : result.right;
}

function loser<T extends CologneTeam>(result: CologneResult<T> | undefined) {
  if (!result) return undefined;
  return result.winnerId === result.left.id ? result.right : result.left;
}

function roundTwoPairs<T extends CologneTeam>(
  teams: T[],
  stage: CologneStage,
  results: CologneResult<T>[],
  userId: string,
) {
  const opening = openingPairs(teams, stage, userId);
  const openingResults = opening.map((nextPair) => resultForPair(results, nextPair));
  const upperLabel = stage === "stage-1" ? "upper-quarterfinal" : "upper-semifinal";
  const pairs: ColognePair<T>[] = [];

  for (let index = 0; index < opening.length; index += 2) {
    const upper = pair(
      stage,
      2,
      upperLabel,
      index / 2,
      winner(openingResults[index]),
      winner(openingResults[index + 1]),
      userId,
    );
    const lower = pair(
      stage,
      2,
      "lower-round-1",
      index / 2,
      loser(openingResults[index]),
      loser(openingResults[index + 1]),
      userId,
    );
    if (upper) pairs.push(upper);
    if (lower) pairs.push(lower);
  }
  return pairs;
}

function splitRoundTwo<T extends CologneTeam>(
  teams: T[],
  stage: CologneStage,
  results: CologneResult<T>[],
  userId: string,
) {
  const pairs = roundTwoPairs(teams, stage, results, userId);
  return {
    upper: pairs.filter((nextPair) => nextPair.id.includes("-upper-")),
    lower: pairs.filter((nextPair) => nextPair.id.includes("-lower-")),
  };
}

function roundThreePairs<T extends CologneTeam>(
  teams: T[],
  stage: CologneStage,
  results: CologneResult<T>[],
  userId: string,
) {
  const { upper, lower } = splitRoundTwo(teams, stage, results, userId);
  const upperResults = upper.map((nextPair) => resultForPair(results, nextPair));
  const lowerResults = lower.map((nextPair) => resultForPair(results, nextPair));

  if (stage === "stage-1") {
    return upper.flatMap((_, index) => {
      const next = pair(
        stage,
        3,
        "lower-round-2",
        index,
        loser(upperResults[index]),
        winner(lowerResults[index]),
        userId,
      );
      return next ? [next] : [];
    });
  }

  const pairs: ColognePair<T>[] = [];
  const upperFinal = pair(
    stage,
    3,
    "upper-final",
    0,
    winner(upperResults[0]),
    winner(upperResults[1]),
    userId,
  );
  if (upperFinal) pairs.push(upperFinal);

  // HLTV's group bracket crosses the lower path: each upper semi-final loser
  // meets the winner from the opposite opening-match block.
  const lowerSources: Array<[T | undefined, T | undefined]> = [
    [loser(upperResults[1]), winner(lowerResults[0])],
    [loser(upperResults[0]), winner(lowerResults[1])],
  ];
  lowerSources.forEach(([left, right], index) => {
    const next = pair(stage, 3, "lower-semifinal", index, left, right, userId);
    if (next) pairs.push(next);
  });
  return pairs;
}

function roundFourPairs<T extends CologneTeam>(
  teams: T[],
  results: CologneResult<T>[],
  userId: string,
) {
  const roundThree = roundThreePairs(teams, "stage-2", results, userId);
  const lowerSemifinals = roundThree.filter((nextPair) => nextPair.id.includes("-lower-semifinal-"));
  const lowerResults = lowerSemifinals.map((nextPair) => resultForPair(results, nextPair));
  const next = pair(
    "stage-2",
    4,
    "lower-final",
    0,
    winner(lowerResults[0]),
    winner(lowerResults[1]),
    userId,
  );
  return next ? [next] : [];
}

export function buildCologneRoundPairs<T extends CologneTeam>(
  teams: T[],
  stage: CologneStage,
  round: number,
  results: CologneResult<T>[],
  userId = "user",
): ColognePair<T>[] {
  if (round === 1) return openingPairs(teams, stage, userId);
  if (round === 2) return roundTwoPairs(teams, stage, results, userId);
  if (round === 3) return roundThreePairs(teams, stage, results, userId);
  if (round === 4 && stage === "stage-2") return roundFourPairs(teams, results, userId);
  return [];
}

export function cologneStageStatus<T extends CologneTeam>(
  teams: T[],
  stage: CologneStage,
  results: CologneResult<T>[],
  userId = "user",
): CologneStageStatus<T> {
  const allTeams = ranked(teams);
  const roundTwo = splitRoundTwo(teams, stage, results, userId);
  const upperRoundResults = roundTwo.upper
    .map((nextPair) => resultForPair(results, nextPair))
    .filter((result): result is CologneResult<T> => Boolean(result));
  const lowerRoundOneResults = roundTwo.lower
    .map((nextPair) => resultForPair(results, nextPair))
    .filter((result): result is CologneResult<T> => Boolean(result));

  let advanced: T[] = [];
  const eliminated: T[] = lowerRoundOneResults
    .map(loser)
    .filter((team): team is T => Boolean(team));

  if (stage === "stage-1") {
    const lowerRoundTwo = buildCologneRoundPairs(teams, stage, 3, results, userId);
    const lowerRoundTwoResults = lowerRoundTwo
      .map((nextPair) => resultForPair(results, nextPair))
      .filter((result): result is CologneResult<T> => Boolean(result));
    advanced = [
      ...upperRoundResults.map(winner),
      ...lowerRoundTwoResults.map(winner),
    ].filter((team): team is T => Boolean(team));
    eliminated.push(...lowerRoundTwoResults.map(loser).filter((team): team is T => Boolean(team)));
  } else {
    const roundThree = buildCologneRoundPairs(teams, stage, 3, results, userId);
    const upperFinal = roundThree.find((nextPair) => nextPair.id.includes("-upper-final-"));
    const upperFinalResult = upperFinal ? resultForPair(results, upperFinal) : undefined;
    const lowerSemifinalResults = roundThree
      .filter((nextPair) => nextPair.id.includes("-lower-semifinal-"))
      .map((nextPair) => resultForPair(results, nextPair))
      .filter((result): result is CologneResult<T> => Boolean(result));
    const lowerFinal = buildCologneRoundPairs(teams, stage, 4, results, userId)[0];
    const lowerFinalResult = lowerFinal ? resultForPair(results, lowerFinal) : undefined;

    if (upperFinalResult) {
      const upperWinner = winner(upperFinalResult);
      const upperRunnerUp = loser(upperFinalResult);
      if (upperWinner) advanced.push(upperWinner);
      if (upperRunnerUp) advanced.push(upperRunnerUp);
    }
    if (lowerFinalResult) {
      const lowerWinner = winner(lowerFinalResult);
      if (lowerWinner) advanced.push(lowerWinner);
      const lowerLoser = loser(lowerFinalResult);
      if (lowerLoser) eliminated.push(lowerLoser);
    }
    eliminated.push(...lowerSemifinalResults.map(loser).filter((team): team is T => Boolean(team)));
  }

  advanced = advanced.filter((team, index) => advanced.findIndex((item) => item.id === team.id) === index);
  const uniqueEliminated = eliminated.filter(
    (team, index) => eliminated.findIndex((item) => item.id === team.id) === index
      && !advanced.some((item) => item.id === team.id),
  );
  const settledIds = new Set([...advanced, ...uniqueEliminated].map((team) => team.id));
  const live = allTeams.filter((team) => !settledIds.has(team.id));
  const qualifierTarget = stage === "stage-1" ? 8 : 3;

  return {
    advanced,
    eliminated: uniqueEliminated,
    live,
    resolved: advanced.length === qualifierTarget && live.length === 0,
  };
}

export function cologneTeamFinished<T extends CologneTeam>(
  teams: T[],
  stage: CologneStage,
  results: CologneResult<T>[],
  teamId: string,
) {
  const status = cologneStageStatus(teams, stage, results, teamId);
  return status.advanced.some((team) => team.id === teamId)
    || status.eliminated.some((team) => team.id === teamId);
}

export function buildColognePlayoffSeeds<T extends CologneTeam>(
  groupA: CologneStageStatus<T>,
  groupB: CologneStageStatus<T>,
): ColognePlayoffSeeds<T> | undefined {
  if (
    !groupA.resolved
    || !groupB.resolved
    || groupA.advanced.length < 3
    || groupB.advanced.length < 3
  ) return undefined;

  return {
    byes: [groupA.advanced[0], groupB.advanced[0]],
    quarterfinals: [
      [groupA.advanced[1], groupB.advanced[2]],
      [groupB.advanced[1], groupA.advanced[2]],
    ],
  };
}
