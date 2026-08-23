import assert from "node:assert/strict";
import test from "node:test";
import {
  buildColognePlayoffSeeds,
  buildCologneRoundPairs,
  cologneOverviewResults,
  cologneStageStatus,
  type ColognePair,
  type CologneResult,
  type CologneStage,
} from "../src/cologneFormat";

interface Team {
  id: string;
  rank: number;
}

const teams = (count: number): Team[] => Array.from(
  { length: count },
  (_, index) => ({ id: `team-${index + 1}`, rank: index + 1 }),
);

function winnerResult(pair: ColognePair<Team>, round: number, rightWins = false): CologneResult<Team> {
  return {
    pairId: pair.id,
    round,
    left: pair.left,
    right: pair.right,
    winnerId: rightWins ? pair.right.id : pair.left.id,
  };
}

function playRound(
  field: Team[],
  stage: CologneStage,
  round: number,
  results: CologneResult<Team>[],
  rightWins = false,
) {
  const pairs = buildCologneRoundPairs(field, stage, round, results, "team-1");
  results.push(...pairs.map((pair) => winnerResult(pair, round, rightWins)));
  return pairs;
}

test("Cologne Stage 1 follows opening, upper/lower, and qualification paths", () => {
  const field = teams(16);
  const results: CologneResult<Team>[] = [];
  assert.equal(playRound(field, "stage-1", 1, results).length, 8);
  const roundTwo = playRound(field, "stage-1", 2, results);
  assert.equal(roundTwo.filter((pair) => pair.id.includes("upper-quarterfinal")).length, 4);
  assert.equal(roundTwo.filter((pair) => pair.id.includes("lower-round-1")).length, 4);
  assert.equal(playRound(field, "stage-1", 3, results).length, 4);

  const status = cologneStageStatus(field, "stage-1", results, "team-1");
  assert.equal(status.advanced.length, 8);
  assert.equal(status.eliminated.length, 8);
  assert.equal(status.live.length, 0);
  assert.equal(status.resolved, true);
});

test("Cologne Stage 2 qualifies both upper finalists and only the lower-final winner", () => {
  const field = teams(8);
  const results: CologneResult<Team>[] = [];
  assert.equal(playRound(field, "stage-2", 1, results).length, 4);
  assert.equal(playRound(field, "stage-2", 2, results).length, 4);
  const roundThree = playRound(field, "stage-2", 3, results);
  assert.equal(roundThree.filter((pair) => pair.id.includes("upper-final")).length, 1);
  assert.equal(roundThree.filter((pair) => pair.id.includes("lower-semifinal")).length, 2);

  const beforeLowerFinal = cologneStageStatus(field, "stage-2", results, "team-1");
  assert.equal(beforeLowerFinal.advanced.length, 2);
  assert.equal(beforeLowerFinal.resolved, false);

  assert.equal(playRound(field, "stage-2", 4, results).length, 1);
  const status = cologneStageStatus(field, "stage-2", results, "team-1");
  assert.equal(status.advanced.length, 3);
  assert.equal(status.eliminated.length, 5);
  assert.equal(status.live.length, 0);
  assert.equal(status.resolved, true);
});

test("Stage 2 lower semifinals cross the two opening-match blocks", () => {
  const field = teams(8);
  const results: CologneResult<Team>[] = [];
  playRound(field, "stage-2", 1, results);
  const roundTwo = playRound(field, "stage-2", 2, results);
  const uppers = roundTwo.filter((pair) => pair.id.includes("upper-semifinal"));
  const lowers = roundTwo.filter((pair) => pair.id.includes("lower-round-1"));
  const roundThree = buildCologneRoundPairs(field, "stage-2", 3, results, "team-1");
  const lowerSemis = roundThree.filter((pair) => pair.id.includes("lower-semifinal"));

  assert.equal(lowerSemis[0].left.id, uppers[1].right.id);
  assert.equal(lowerSemis[0].right.id, lowers[0].left.id);
  assert.equal(lowerSemis[1].left.id, uppers[0].right.id);
  assert.equal(lowerSemis[1].right.id, lowers[1].left.id);
});

test("Cologne overview keeps Stage 1 statistics separate from the Main Stage", () => {
  const results = [
    { id: "stage-one", eventId: "stage-1" },
    { id: "group-stage", eventId: "stage-2" },
    { id: "playoff", eventId: "stage-3" },
  ];

  assert.deepEqual(
    cologneOverviewResults(results, "stage-1").map((result) => result.id),
    ["stage-one"],
  );
  assert.deepEqual(
    cologneOverviewResults(results, "stage-2").map((result) => result.id),
    ["group-stage"],
  );
  assert.deepEqual(
    cologneOverviewResults(results, "playoffs").map((result) => result.id),
    ["group-stage", "playoff"],
  );
  assert.deepEqual(
    cologneOverviewResults(results).map((result) => result.id),
    ["group-stage", "playoff"],
  );
});

test("Cologne playoffs can be seeded after the managed team is eliminated in Stage 2", () => {
  const groupA = teams(8);
  const groupB = teams(8).map((team) => ({ ...team, id: `group-b-${team.id}` }));
  const groupAResults: CologneResult<Team>[] = [];
  const groupBResults: CologneResult<Team>[] = [];

  for (let round = 1; round <= 4; round += 1) {
    const groupAPairs = buildCologneRoundPairs(groupA, "stage-2", round, groupAResults, "team-1");
    groupAResults.push(...groupAPairs.map((pair) => winnerResult(
      pair,
      round,
      pair.left.id === "team-1",
    )));
    playRound(groupB, "stage-2", round, groupBResults);
  }

  const groupAStatus = cologneStageStatus(groupA, "stage-2", groupAResults, "team-1");
  const groupBStatus = cologneStageStatus(groupB, "stage-2", groupBResults, "__neutral__");
  const seeds = buildColognePlayoffSeeds(groupAStatus, groupBStatus);

  assert.equal(groupAStatus.eliminated.some((team) => team.id === "team-1"), true);
  assert.ok(seeds, "resolved groups should seed playoffs even when the managed team is out");
  assert.equal(seeds.byes.length, 2);
  assert.equal(seeds.quarterfinals.flat().length, 4);
  assert.equal(
    [...seeds.byes, ...seeds.quarterfinals.flat()].some((team) => team.id === "team-1"),
    false,
  );
});
