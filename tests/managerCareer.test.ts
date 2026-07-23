import assert from "node:assert/strict";
import test from "node:test";
import type { Player } from "../src/gameData";
import { vrsPointsForRank } from "../src/vrs";
import {
  acceptManagerIncomingOffer,
  advanceManagerMajorStage,
  acceptManagerTradeCounter,
  advanceManagerDate,
  completeManagerEvent,
  createManagerCareer,
  createManagerIncomingOffer,
  counterManagerIncomingOffer,
  declineManagerIncomingOffer,
  launchManagerEvent,
  isCurrentManagerWorldRoster,
  managerEventById,
  managerEventPayoutTotal,
  managerEventName,
  managerEventSchedule,
  managerEvents,
  managerEventEligibility,
  managerEventReadyToLaunch,
  managerMajorEntryStage,
  managerMajorStageHasPlayoffs,
  managerMajorStageEnd,
  managerMajorStickerRevenue,
  MANAGER_MAJOR_CHAMPIONS_CAPSULE_REVENUE,
  managerFinancialStatus,
  managerLineupEditLocked,
  managerMonthlyPayroll,
  managerPlayerDynamics,
  managerTeamFamiliarity,
  managerTrainingPlan,
  managerActivePerformanceCamp,
  managerPerformanceCampEligibility,
  managerPerformanceCampPrograms,
  MANAGER_CAREER_VERSION,
  MANAGER_POTENTIAL_LAB_ELITE_COST,
  managerPotentialLabCost,
  managerCasinoCoinResult,
  managerCasinoVisitAllowed,
  evaluateManagerTradeProposal,
  managerRecommendedSalary,
  managerRenewalBonus,
  managerContractReleaseCost,
  nextManagerCheckpoint,
  normalizeManagerCareer,
  registerManagerEvent,
  renewManagerPlayerContract,
  releaseManagerPlayerContract,
  resolveManagerTrainingCycle,
  resolveManagerPotentialInvestment,
  resolveManagerCasinoVisit,
  scheduleManagerPerformanceCamp,
  resolveManagerOrganization,
  scoutManagerCandidate,
  setManagerStartingLineup,
  setManagerTrainingFocus,
  startNextManagerSeason,
  submitManagerFreeAgentOffer,
  submitManagerTradeOffer,
  toggleManagerShortlist,
  withdrawManagerTradeOffer,
  withdrawManagerEvent,
} from "../src/managerCareer";

const roster = ["p1", "p2", "p3", "p4", "p5"];
const rosterPlayers = roster.map((id) => ({ id, handle: id, role: "Rifler", ovr: 80 }));
const worldTeams = Array.from({ length: 40 }, (_, index) => ({
  id: `world-${index + 1}`,
  name: `World Team ${index + 1}`,
  rank: index + 1,
  vrsPoints: 2_000 - index * 30,
  strength: 94 - index * 0.65,
}));

test("Manager career starts at a stable date with a usable contender budget", () => {
  const state = createManagerCareer("save-a");
  assert.equal(state.date, "2026-07-20");
  assert.equal(state.vrsRank, 32);
  assert.equal(state.cash, 120_000);
  assert.equal(state.organizationName, "My Five");
  assert.equal(state.inbox.length, 1);
});

test("taking over an organization inherits its ranking and deterministic player contracts", () => {
  const players = [
    { id: "star", handle: "star", role: "AWP", ovr: 91, age: 23, potential: 93 },
    { id: "igl", handle: "igl", role: "IGL", ovr: 82, age: 26, potential: 83 },
    { id: "entry", handle: "entry", role: "Entry", ovr: 86, age: 20, potential: 90 },
    { id: "rifle", handle: "rifle", role: "Rifler", ovr: 85, age: 24, potential: 87 },
    { id: "support", handle: "support", role: "Support", ovr: 80, age: 25, potential: 81 },
  ];
  const state = createManagerCareer("takeover-a", {
    organizationId: "club-a",
    organizationName: "Club A",
    vrsRank: 7,
    vrsPoints: 1_900,
    players,
  });
  const replay = createManagerCareer("takeover-a", {
    organizationId: "club-a",
    organizationName: "Club A",
    vrsRank: 7,
    vrsPoints: 1_900,
    players,
  });
  assert.equal(state.organizationId, "club-a");
  assert.equal(state.vrsRank, 7);
  assert.equal(state.contracts.length, 5);
  assert.deepEqual(state.contracts, replay.contracts);
  assert.ok(managerMonthlyPayroll(state) > 0);
  assert.ok(state.cash >= managerMonthlyPayroll(state) * 6);
  assert.equal(state.contracts.find((contract) => contract.playerId === "star")?.squadRole, "star");
  assert.equal(state.contracts.find((contract) => contract.playerId === "entry")?.squadRole, "prospect");
});

test("manager training turns performance and potential into persistent player growth", () => {
  const stats = { aim: 78, clutch: 76, consistency: 75, awp: 55, igl: 52 };
  let players = [
    { id: "prospect", handle: "prospect", realName: "Prospect", country: "UA", role: "Entry", style: "Aggressive", traits: [], ovr: 80, age: 18, potential: 89, stats, maps: {}, source: { id: "club", name: "Club", tag: "CLB", country: "UA", era: "CS2", year: "2026", accent: "#fff" } },
    ...[1, 2, 3, 4].map((index) => ({ id: `v${index}`, handle: `v${index}`, realName: `V${index}`, country: "UA", role: "Rifler", style: "Balanced", traits: [], ovr: 76, age: 25, potential: 78, stats, maps: {}, source: { id: "club", name: "Club", tag: "CLB", country: "UA", era: "CS2", year: "2026", accent: "#fff" } })),
    { id: "bench", handle: "bench", realName: "Bench", country: "UA", role: "Rifler", style: "Balanced", traits: [], ovr: 72, age: 18, potential: 82, stats, maps: {}, source: { id: "club", name: "Club", tag: "CLB", country: "UA", era: "CS2", year: "2026", accent: "#fff" } },
  ] as Player[];
  let state = createManagerCareer("training-save", {
    organizationId: "club",
    organizationName: "Club",
    players,
  });
  state = setManagerTrainingFocus(state, players[0], "mechanics");
  assert.equal(managerTrainingPlan(state, players[0]).focus, "mechanics");

  for (let cycle = 0; cycle < 2; cycle += 1) {
    const result = resolveManagerTrainingCycle(state, players, { prospect: 1.5 }, "champion");
    state = result.state;
    players = result.players;
  }

  const prospect = players.find((player) => player.id === "prospect")!;
  const reserve = players.find((player) => player.id === "bench")!;
  assert.equal(prospect.ovr, 81);
  assert.ok(prospect.stats.aim > stats.aim);
  assert.equal(reserve.ovr, 72);
  assert.ok(managerTrainingPlan(state, reserve).progress < managerTrainingPlan(state, prospect).progress + 50);
  const locked = { ...state, activeEventId: "event" };
  assert.equal(setManagerTrainingFocus(locked, prospect, "recovery"), locked);
});

test("Potential Lab charges for every flip and can push potential beyond 99", () => {
  const player = { id: "ceiling-star", handle: "ceiling", role: "AWP", ovr: 98, potential: 99 };
  let state = createManagerCareer("potential-lab", {
    organizationId: "club",
    organizationName: "Club",
    cash: MANAGER_POTENTIAL_LAB_ELITE_COST * 3,
    players: [player, ...rosterPlayers.slice(1)],
  });

  state = resolveManagerPotentialInvestment(state, player, "heads", "tails");
  assert.equal(state.cash, MANAGER_POTENTIAL_LAB_ELITE_COST * 2);
  assert.equal(managerTrainingPlan(state, player).potentialOvr, 99);
  assert.equal(managerTrainingPlan(state, player).potentialLabAttempts, 1);
  assert.equal(managerTrainingPlan(state, player).potentialLabWins, 0);

  state = resolveManagerPotentialInvestment(state, player, "tails", "tails");
  assert.equal(state.cash, MANAGER_POTENTIAL_LAB_ELITE_COST);
  assert.equal(managerTrainingPlan(state, player).potentialOvr, 100);
  assert.equal(managerTrainingPlan(state, player).potentialLabAttempts, 2);
  assert.equal(managerTrainingPlan(state, player).potentialLabWins, 1);
  assert.equal(state.ledger.at(-1)?.category, "development");
  assert.match(state.inbox[0].body, /increased to 100/);
  assert.equal(managerPotentialLabCost(state, player), 250_000);
});

test("Potential Lab pricing scales with the value of the player's ceiling", () => {
  const low = { id: "low-pot", handle: "low", role: "Rifler", ovr: 64, potential: 68 };
  const prospect = { id: "prospect-pot", handle: "prospect", role: "Entry", ovr: 77, potential: 83 };
  const star = { id: "star-pot", handle: "star", role: "AWP", ovr: 89, potential: 94 };
  const state = createManagerCareer("potential-prices", { players: [low, prospect, star] });

  assert.equal(managerPotentialLabCost(state, low), 25_000);
  assert.equal(managerPotentialLabCost(state, prospect), 85_000);
  assert.equal(managerPotentialLabCost(state, star), 160_000);
});

test("Casino Night moves club cash, affects the selected player, and is limited to one visit per day", () => {
  const player = { id: "casino-player", handle: "lucky", role: "Rifler", ovr: 74, potential: 80 };
  const base = createManagerCareer("casino-night", { cash: 100_000, players: [player] });
  const morale = managerPlayerDynamics(base, player.id)!.morale;
  const result = managerCasinoCoinResult(base, player, 25_000);
  const won = resolveManagerCasinoVisit(base, player, 25_000, result, result);

  assert.equal(won.cash, 125_000);
  assert.equal(won.casinoVisits.length, 1);
  assert.equal(won.casinoVisits[0].net, 25_000);
  assert.equal(won.ledger.at(-1)?.category, "casino");
  assert.equal(managerPlayerDynamics(won, player.id)!.morale, morale + 6);
  assert.equal(managerCasinoVisitAllowed(won, player, 5_000).allowed, false);
  assert.equal(resolveManagerCasinoVisit(won, player, 5_000, "heads", "tails"), won);
});

test("performance camps occupy calendar time, charge cash, and apply squad gains", () => {
  const players = roster.map((id, index) => ({
    id,
    handle: id,
    role: index === 0 ? "IGL" : "Rifler",
    ovr: 76,
    potential: 82,
  }));
  const base = createManagerCareer("camp-system", {
    organizationId: "club",
    organizationName: "Club",
    cash: 100_000,
    players,
  });
  const before = managerPlayerDynamics(base, "p1")!;
  const beforeProgress = managerTrainingPlan(base, players[0]).progress;
  const program = managerPerformanceCampPrograms.find((item) => item.id === "tactical")!;
  const eligibility = managerPerformanceCampEligibility(base, "tactical");
  assert.deepEqual({ eligible: eligibility.eligible, startsOn: eligibility.startsOn, endsOn: eligibility.endsOn }, {
    eligible: true,
    startsOn: "2026-07-21",
    endsOn: "2026-07-27",
  });

  const booked = scheduleManagerPerformanceCamp(base, "tactical");
  assert.equal(booked.cash, base.cash - program.cost);
  assert.equal(managerActivePerformanceCamp(booked)?.endsOn, "2026-07-27");
  assert.equal(booked.ledger.at(-1)?.category, "development");

  const advanced = advanceManagerDate(booked, "2026-07-27");
  assert.equal(managerActivePerformanceCamp(advanced), undefined);
  assert.equal(advanced.performanceCamps[0].status, "completed");
  assert.equal(managerPlayerDynamics(advanced, "p1")!.familiarity, before.familiarity + 7);
  assert.equal(managerTrainingPlan(advanced, players[0]).progress, beforeProgress + 8);
  assert.ok(advanced.inbox.some((item) => item.title === "System Camp complete"));
});

test("performance camps cannot overlap a confirmed tournament", () => {
  const base = createManagerCareer("camp-conflict", {
    organizationId: "club",
    organizationName: "Club",
    cash: 100_000,
    players: rosterPlayers,
  });
  const registered = registerManagerEvent(base, "frontier-open-2026", roster);
  const eligibility = managerPerformanceCampEligibility(registered, "mechanics");
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.some((reason) => reason.includes("Frontier Open")));
  assert.equal(scheduleManagerPerformanceCamp(registered, "mechanics"), registered);
});

test("old manager saves receive organization, contract, and market defaults during migration", () => {
  const oldState = createManagerCareer("legacy-a");
  const migrated = normalizeManagerCareer(
    { ...oldState, version: 1, organizationId: undefined, organizationName: undefined, contracts: undefined, market: undefined },
    {
      organizationId: "legacy-club",
      organizationName: "Legacy Club",
      players: [{ id: "p1", handle: "p1", role: "Rifler", ovr: 84 }],
    },
  )!;
  assert.equal(migrated.version, MANAGER_CAREER_VERSION);
  assert.equal(migrated.organizationId, "legacy-club");
  assert.equal(migrated.organizationName, "Legacy Club");
  assert.equal(migrated.contracts.length, 1);
  assert.equal(migrated.trainingPlans.length, 1);
  assert.deepEqual(migrated.performanceCamps, []);
  assert.deepEqual(migrated.casinoVisits, []);
  assert.equal(migrated.status, "active");
  assert.deepEqual(migrated.market, {
    scoutedPlayerIds: [],
    shortlistedPlayerIds: [],
    signedPlayerIds: [],
    offers: [],
    tradeOffers: [],
    incomingOffers: [],
    clubRelationships: [],
    rosterMoves: [],
    unavailablePlayerIds: [],
  });
  assert.equal(migrated.playerDynamics.length, 1);
  assert.equal(migrated.boardObjective.status, "active");
});

test("inherited rosters receive deterministic morale, familiarity, and a board mandate", () => {
  const players = roster.map((id, index) => ({ id, handle: id, role: index === 0 ? "IGL" : "Rifler", ovr: 74 + index }));
  const first = createManagerCareer("depth-a", { vrsRank: 28, players });
  const replay = createManagerCareer("depth-a", { vrsRank: 28, players });
  assert.deepEqual(first.playerDynamics, replay.playerDynamics);
  assert.equal(first.playerDynamics.length, 5);
  assert.equal(first.boardObjective.targetRank, 24);
  assert.equal(first.boardObjective.status, "active");
  assert.ok(managerTeamFamiliarity(first) >= 72);
});

test("lower-tier CIS contracts stay inside a realistic local salary band", () => {
  const prospect = { id: "ua-prospect", handle: "prospect", role: "Entry", ovr: 74, age: 18, potential: 86 };
  const localSalary = managerRecommendedSalary(prospect, { vrsRank: 26, organizationCountry: "UA" });
  const eliteSalary = managerRecommendedSalary({ ...prospect, ovr: 91, age: 23, potential: 93 }, { vrsRank: 4, organizationCountry: "FR" });
  assert.ok(localSalary >= 1_000 && localSalary <= 4_000);
  assert.ok(eliteSalary > localSalary * 4);
});

test("Manager calendar carries Swiss, round-robin, and direct knockout formats", () => {
  assert.equal(managerEventById("frontier-open-2026")?.format, "single-elimination");
  assert.equal(managerEventById("pro-league-challenger-2026")?.format, "round-robin");
  assert.equal(managerEventById("fall-global-major-2026")?.format, "swiss");
});

test("Manager seasons carry a dense S-tier and A-tier circuit with varied fields", () => {
  assert.equal(managerEvents.length, 12);
  assert.equal(managerEvents.filter((event) => event.classification === "S-Tier").length, 5);
  assert.equal(managerEvents.filter((event) => event.classification === "A-Tier").length, 4);
  assert.deepEqual(new Set(managerEvents.map((event) => event.format)), new Set(["single-elimination", "swiss", "round-robin"]));
  assert.deepEqual(new Set(managerEvents.map((event) => event.capacity)), new Set([8, 16, 32]));
  assert.ok(managerEvents.every((event) => event.formatStages.length >= 1));
});

test("Manager event operations are ordered and the calendar includes real scheduling choices", () => {
  managerEvents.forEach((event) => {
    assert.ok(event.registrationDeadline <= event.rosterLockOn, `${event.name} registration precedes lock`);
    assert.ok(event.rosterLockOn < event.startsOn, `${event.name} lock precedes start`);
    assert.ok(event.startsOn <= event.endsOn, `${event.name} start precedes finish`);
  });
  const bounty = managerEventById("summer-bounty-finals-2026")!;
  const challenger = managerEventById("global-challenger-2026")!;
  assert.equal(bounty.endsOn, challenger.startsOn);
});

test("the Manager calendar exposes one VRS-seeded Major cycle", () => {
  assert.equal(managerEventById("fall-mrq-2026"), undefined);
  assert.equal(managerEventById("fall-major-stage-1-2026"), undefined);
  assert.equal(managerEventById("fall-global-major-2026")?.majorCycle, true);
  assert.equal(managerEvents.filter((event) => event.majorCycle).length, 1);
});

test("declared Manager prize pools equal the total placement payouts", () => {
  managerEvents.forEach((event) => assert.equal(managerEventPayoutTotal(event), event.prizePool, event.name));
});

test("Manager event opponents use the current world while historic clubs remain valid takeovers", () => {
  assert.equal(isCurrentManagerWorldRoster({ era: "CS2", year: "2026" }), true);
  assert.equal(isCurrentManagerWorldRoster({ era: "CS:GO", year: "2018" }), false);
});

test("legacy Manager organization IDs recover the selected club by exact name", () => {
  const organizations = [
    { id: "nrg", name: "NRG" },
    { id: "nrg-academy", name: "NRG Academy" },
  ];
  assert.equal(resolveManagerOrganization(organizations, "legacy-user-organization", "NRG")?.id, "nrg");
  assert.equal(resolveManagerOrganization(organizations, "nrg-academy", "NRG")?.id, "nrg-academy");
});

test("Major entry stage is selected from launch-day VRS", () => {
  assert.equal(managerMajorEntryStage(1), "stage-3");
  assert.equal(managerMajorEntryStage(8), "stage-3");
  assert.equal(managerMajorEntryStage(9), "stage-2");
  assert.equal(managerMajorEntryStage(16), "stage-2");
  assert.equal(managerMajorEntryStage(17), "stage-1");
  assert.equal(managerMajorEntryStage(24), "stage-1");
  assert.equal(managerMajorEntryStage(25), "mrq");
  assert.equal(managerMajorEntryStage(64), "mrq");
});

test("only Major Stage 3 can produce a playoff bracket", () => {
  assert.equal(managerMajorStageHasPlayoffs("mrq"), false);
  assert.equal(managerMajorStageHasPlayoffs("stage-1"), false);
  assert.equal(managerMajorStageHasPlayoffs("stage-2"), false);
  assert.equal(managerMajorStageHasPlayoffs("stage-3"), true);
});

test("Major entry is assigned for free and recalculated from launch-day VRS", () => {
  const event = managerEventById("fall-global-major-2026")!;
  const registered = createManagerCareer("major-seeding", { vrsRank: 32, players: rosterPlayers });
  const assignment = registered.registrations.find((item) => item.eventId === event.id)!;
  assert.equal(event.entryFee + event.travelCost, 0);
  assert.equal(assignment.status, "confirmed");
  assert.equal(assignment.feePaid, 0);
  assert.equal(assignment.stickerRevenuePaid, 0);
  assert.deepEqual(assignment.lockedRosterIds, roster);
  assert.equal(registered.ledger.some((entry) => entry.eventId === event.id && entry.amount < 0), false);
  assert.equal(registerManagerEvent(registered, event.id, roster), registered);
  assert.equal(withdrawManagerEvent(registered, event.id), registered);

  const improved = { ...registered, vrsRank: 10, date: "2026-11-02" };
  assert.equal(managerEventReadyToLaunch(improved, event.id), true);
  const launched = launchManagerEvent(improved, event.id);
  assert.equal(launched.activeEventId, event.id);
  assert.equal(launched.activeMajorStage, "stage-2");
  assert.equal(launched.cash, registered.cash + managerMajorStickerRevenue("stage-2"));
  assert.equal(launched.registrations[0].stickerRevenuePaid, 550_000);
});

test("legacy paid Major travel is reimbursed during save migration", () => {
  const base = createManagerCareer("major-refund", { vrsRank: 32, players: rosterPlayers });
  const migrated = normalizeManagerCareer({
    ...base,
    version: 10,
    cash: base.cash - 14_000,
    registrations: base.registrations.map((registration) => ({ ...registration, feePaid: 14_000 })),
    ledger: [
      ...base.ledger,
      {
        id: "old-major-charge",
        date: base.date,
        category: "entry",
        description: "Global Major entry and travel",
        amount: -14_000,
        eventId: "fall-global-major-2026",
      },
    ],
  })!;
  assert.equal(migrated.cash, base.cash);
  assert.equal(migrated.registrations[0].feePaid, 0);
  assert.equal(migrated.ledger.at(-1)?.description, "Valve-funded Major travel reimbursement");
  assert.equal(migrated.ledger.at(-1)?.amount, 14_000);
});

test("a qualified Manager Major roster receives only the next sticker tier top-up", () => {
  const event = managerEventById("fall-global-major-2026")!;
  const registered = registerManagerEvent(createManagerCareer("major-path", { vrsRank: 20 }), event.id, roster);
  const launched = launchManagerEvent({ ...registered, date: "2026-10-26" }, event.id);
  const advanced = advanceManagerMajorStage(launched, "stage-2");
  assert.equal(advanced.activeEventId, event.id);
  assert.equal(advanced.activeMajorStage, "stage-2");
  assert.equal(advanced.date, "2026-11-02");
  assert.equal(launched.registrations[0].stickerRevenuePaid, 400_000);
  assert.equal(advanced.cash, launched.cash + 150_000);
  assert.equal(advanced.registrations[0].stickerRevenuePaid, 550_000);
  assert.equal(advanced.registrations.length, 1);
  assert.equal(advanced.registrations[0].status, "active");
});

test("a Major champion receives the Champions Capsule sticker bonus", () => {
  const event = managerEventById("fall-global-major-2026")!;
  const assigned = createManagerCareer("major-champion", { vrsRank: 4, players: rosterPlayers });
  const launched = launchManagerEvent({ ...assigned, date: "2026-11-09" }, event.id);
  assert.equal(launched.cash, assigned.cash + managerMajorStickerRevenue("stage-3"));
  const completed = completeManagerEvent(launched, event.id, "champion");
  assert.equal(
    completed.cash,
    launched.cash + event.prizes.champion + MANAGER_MAJOR_CHAMPIONS_CAPSULE_REVENUE,
  );
  assert.equal(completed.registrations[0].stickerRevenuePaid, 1_200_000);
  assert.ok(completed.ledger.some((entry) => entry.category === "sticker" && entry.description.includes("Champions Capsule")));
});

test("an early Major exit completes on that stage's end date", () => {
  const event = managerEventById("fall-global-major-2026")!;
  const registered = registerManagerEvent(createManagerCareer("major-exit", { vrsRank: 31 }), event.id, roster);
  const launched = launchManagerEvent({ ...registered, date: "2026-10-19" }, event.id);
  const completed = completeManagerEvent(launched, event.id, "swiss");
  assert.equal(completed.date, managerMajorStageEnd("mrq"));
  assert.equal(completed.activeMajorStage, undefined);
});

test("legacy split Major registrations migrate into one active cycle", () => {
  const base = createManagerCareer("major-migration", { vrsRank: 18 });
  const migrated = normalizeManagerCareer({
    ...base,
    version: 4,
    activeEventId: "fall-major-stage-1-2026",
    registrations: [
      { eventId: "fall-major-stage-1-2026", status: "active", registeredOn: base.date, feePaid: 9_000, lockedRosterIds: roster },
      { eventId: "fall-global-major-2026", status: "confirmed", registeredOn: base.date, feePaid: 14_000, lockedRosterIds: roster },
    ],
  })!;
  assert.equal(migrated.activeEventId, "fall-global-major-2026");
  assert.equal(migrated.activeMajorStage, "stage-1");
  assert.equal(migrated.registrations.length, 1);
  assert.equal(migrated.registrations[0].status, "active");
});

test("the retired standalone Fall MRQ resumes as the unified Major MRQ", () => {
  const base = createManagerCareer("standalone-mrq-migration", { vrsRank: 30 });
  const migrated = normalizeManagerCareer({
    ...base,
    version: 7,
    date: "2026-08-24",
    activeEventId: "fall-mrq-2026",
    registrations: [
      { eventId: "fall-mrq-2026", status: "active", registeredOn: base.date, feePaid: 5_500, lockedRosterIds: roster },
    ],
  })!;
  assert.equal(migrated.activeEventId, "fall-global-major-2026");
  assert.equal(migrated.activeMajorStage, "mrq");
  assert.equal(migrated.date, "2026-10-19");
  assert.equal(migrated.registrations[0].eventId, "fall-global-major-2026");
  assert.equal(migrated.registrations[0].status, "active");
});

test("a completed legacy Fall MRQ does not mark the unified Major complete", () => {
  const base = createManagerCareer("completed-standalone-mrq", { vrsRank: 24 });
  const migrated = normalizeManagerCareer({
    ...base,
    version: 7,
    completedEventIds: ["fall-mrq-2026"],
    registrations: [
      { eventId: "fall-mrq-2026", status: "completed", registeredOn: base.date, feePaid: 5_500, lockedRosterIds: roster, placement: "champion" },
    ],
  })!;
  assert.deepEqual(migrated.completedEventIds, ["fall-mrq-2026"]);
  assert.equal(migrated.completedEventIds.includes("fall-global-major-2026"), false);
  assert.equal(managerEventEligibility(migrated, managerEventById("fall-global-major-2026")!).reasons.includes("Event already completed"), false);
});

test("scouting charges once and shortlists remain save-local", () => {
  const state = createManagerCareer("market-a");
  const player = { id: "free-igl", handle: "freeIGL" };
  const scouted = scoutManagerCandidate(state, player);
  assert.equal(scouted.cash, state.cash - 1_500);
  assert.deepEqual(scouted.market.scoutedPlayerIds, [player.id]);
  assert.equal(scouted.ledger.at(-1)?.category, "scouting");
  assert.equal(scoutManagerCandidate(scouted, player), scouted);

  const shortlisted = toggleManagerShortlist(scouted, player.id);
  assert.deepEqual(shortlisted.market.shortlistedPlayerIds, [player.id]);
  assert.deepEqual(toggleManagerShortlist(shortlisted, player.id).market.shortlistedPlayerIds, []);
});

test("free-agent offers reject weak terms and sign accepted players to the reserve squad", () => {
  const player = { id: "free-awp", handle: "newAWP", role: "AWP", ovr: 78, age: 20, potential: 86 };
  const state = scoutManagerCandidate(createManagerCareer("market-b"), player);
  const rejected = submitManagerFreeAgentOffer(state, player, {
    monthlySalary: 2_000,
    majorCycles: 1,
    squadRole: "bench",
  });
  assert.equal(rejected.market.offers.at(-1)?.status, "rejected");
  assert.equal(rejected.contracts.length, 0);
  assert.equal(rejected.cash, state.cash);

  const salary = Math.ceil(managerRecommendedSalary(player) * 1.2 / 500) * 500;
  const signed = submitManagerFreeAgentOffer(rejected, player, {
    monthlySalary: salary,
    majorCycles: 3,
    squadRole: "starter",
  });
  assert.equal(signed.market.offers.at(-1)?.status, "accepted");
  assert.deepEqual(signed.market.signedPlayerIds, [player.id]);
  assert.equal(signed.contracts.at(-1)?.status, "bench");
  assert.equal(signed.contracts.at(-1)?.squadRole, "starter");
  assert.equal(signed.cash, state.cash - salary);
  assert.equal(signed.ledger.at(-1)?.category, "signing");
  assert.match(signed.inbox[0].title, /signed/);
  assert.equal(managerMonthlyPayroll(signed), salary);
});

test("a manager cannot sign beyond the eight-player contract limit", () => {
  const inheritedPlayers = roster.map((id, index) => ({
    id,
    handle: id,
    role: index === 0 ? "IGL" : "Rifler",
    ovr: 80 + index,
  }));
  let state = createManagerCareer("market-limit", {
    organizationId: "club-a",
    organizationName: "Club A",
    cash: 1_000_000,
    players: inheritedPlayers,
  });
  for (let index = 0; index < 3; index += 1) {
    const player = { id: `reserve-${index}`, handle: `reserve${index}`, role: "Rifler", ovr: 74, age: 20, potential: 82 };
    state = scoutManagerCandidate(state, player);
    state = submitManagerFreeAgentOffer(state, player, {
      monthlySalary: managerRecommendedSalary(player) * 2,
      majorCycles: 3,
      squadRole: "starter",
    });
  }
  assert.equal(state.contracts.length, 8);
  const ninth = { id: "reserve-4", handle: "reserve4", role: "AWP", ovr: 74, age: 20, potential: 82 };
  const scouted = scoutManagerCandidate(state, ninth);
  assert.equal(submitManagerFreeAgentOffer(scouted, ninth, {
    monthlySalary: managerRecommendedSalary(ninth) * 2,
    majorCycles: 3,
    squadRole: "starter",
  }), scouted);
});

function incomingOfferFixture(seed = "incoming-offer") {
  const managed = [
    { id: "managed-awp", handle: "managedAWP", role: "AWP", ovr: 83, age: 21, potential: 88 },
    { id: "managed-igl", handle: "managedIGL", role: "IGL", ovr: 76, age: 26, potential: 78 },
    { id: "managed-entry", handle: "managedEntry", role: "Entry", ovr: 81, age: 20, potential: 87 },
    { id: "managed-rifle", handle: "managedRifle", role: "Rifler", ovr: 79, age: 23, potential: 83 },
    { id: "managed-support", handle: "managedSupport", role: "Support", ovr: 75, age: 25, potential: 77 },
    { id: "managed-sixth", handle: "managedSixth", role: "Rifler", ovr: 73, age: 19, potential: 82 },
  ];
  const world = [{
    id: "buyer-club",
    name: "Buyer Club",
    rank: 18,
    players: [
      { id: "buyer-awp", handle: "buyerAWP", role: "AWP", ovr: 76, age: 25 },
      { id: "buyer-igl", handle: "buyerIGL", role: "IGL", ovr: 72, age: 28 },
      { id: "buyer-entry", handle: "buyerEntry", role: "Entry", ovr: 74, age: 24 },
      { id: "buyer-rifle", handle: "buyerRifle", role: "Rifler", ovr: 75, age: 24 },
      { id: "buyer-support", handle: "buyerSupport", role: "Support", ovr: 71, age: 26 },
    ],
  }];
  const career = createManagerCareer(seed, {
    organizationId: "managed-club",
    organizationName: "Managed Club",
    cash: 250_000,
    players: managed,
  });
  return { managed, world, career };
}

test("AI clubs make deterministic incoming offers for contracted players", () => {
  const { managed, world, career } = incomingOfferFixture("incoming-deterministic");
  const date = "2026-07-24";
  const first = createManagerIncomingOffer(career, managed, world, date);
  const replay = createManagerIncomingOffer(career, managed, world, date);
  assert.equal(first.market.incomingOffers.length, 1);
  assert.deepEqual(first.market.incomingOffers, replay.market.incomingOffers);
  assert.equal(first.market.incomingOffers[0].buyerTeamId, "buyer-club");
  assert.ok(first.market.incomingOffers[0].cashOffered > 0);
  assert.equal(first.inbox[0].offerId, first.market.incomingOffers[0].id);
});

test("accepting an incoming bid sells the player and updates the buyer roster", () => {
  const { managed, world, career } = incomingOfferFixture("incoming-accepted");
  const offered = createManagerIncomingOffer(career, managed, world, career.date);
  const offer = offered.market.incomingOffers[0];
  const accepted = acceptManagerIncomingOffer(offered, offer.id);
  assert.equal(accepted.market.incomingOffers[0].status, "accepted");
  assert.equal(accepted.contracts.length, 5);
  assert.equal(accepted.contracts.some((contract) => contract.playerId === offer.targetPlayer.id), false);
  assert.equal(accepted.cash, career.cash + offer.cashOffered);
  assert.equal(accepted.ledger.at(-1)?.category, "transfer");
  assert.equal(accepted.market.rosterMoves.at(-1)?.clubId, "buyer-club");
  assert.equal(accepted.market.rosterMoves.at(-1)?.acquiredPlayer.id, offer.targetPlayer.id);
});

test("incoming counteroffers resolve on the calendar", () => {
  const { managed, world, career } = incomingOfferFixture("incoming-counter-accepted");
  const offered = createManagerIncomingOffer(career, managed, world, career.date);
  const offer = offered.market.incomingOffers[0];
  const countered = counterManagerIncomingOffer(offered, offer.id, offer.buyerLimit);
  assert.equal(countered.market.incomingOffers[0].status, "counter-pending");
  assert.equal(nextManagerCheckpoint(countered), countered.market.incomingOffers[0].responseOn);
  const accepted = advanceManagerDate(countered, countered.market.incomingOffers[0].responseOn!);
  assert.equal(accepted.market.incomingOffers[0].status, "accepted");
  assert.equal(accepted.cash, career.cash + offer.buyerLimit);

  const secondFixture = incomingOfferFixture("incoming-counter-rejected");
  const secondOfferState = createManagerIncomingOffer(secondFixture.career, secondFixture.managed, secondFixture.world, secondFixture.career.date);
  const secondOffer = secondOfferState.market.incomingOffers[0];
  const expensiveCounter = Math.floor(secondOffer.buyerLimit * 1.5 / 5_000) * 5_000;
  const waiting = counterManagerIncomingOffer(secondOfferState, secondOffer.id, expensiveCounter);
  const rejected = advanceManagerDate(waiting, waiting.market.incomingOffers[0].responseOn!);
  assert.equal(rejected.market.incomingOffers[0].status, "rejected");
});

test("incoming bids can be declined and cannot strip a five-player or locked roster", () => {
  const { managed, world, career } = incomingOfferFixture("incoming-guardrails");
  const offered = createManagerIncomingOffer(career, managed, world, career.date);
  const offer = offered.market.incomingOffers[0];
  const declined = declineManagerIncomingOffer(offered, offer.id);
  assert.equal(declined.market.incomingOffers[0].status, "declined");
  assert.equal(declined.contracts.length, 6);

  const fivePlayerCareer = createManagerCareer("incoming-five", {
    organizationId: "managed-club",
    organizationName: "Managed Club",
    players: managed.slice(0, 5),
  });
  const fivePlayerOffer = createManagerIncomingOffer(fivePlayerCareer, managed.slice(0, 5), world, fivePlayerCareer.date);
  assert.equal(fivePlayerOffer.market.incomingOffers.length, 1);
  assert.equal(acceptManagerIncomingOffer(fivePlayerOffer, fivePlayerOffer.market.incomingOffers[0].id), fivePlayerOffer);

  const locked = {
    ...offered,
    registrations: [{
      eventId: "frontier-open-2026",
      status: "active" as const,
      registeredOn: offered.date,
      feePaid: 0,
      lockedRosterIds: [offer.targetPlayer.id, ...managed.filter((player) => player.id !== offer.targetPlayer.id).slice(0, 4).map((player) => player.id)],
    }],
  };
  assert.equal(acceptManagerIncomingOffer(locked, offer.id), locked);
});

test("a fair one-for-one trade applies cash, contracts, and negotiation history", () => {
  const inherited = roster.map((id, index) => ({
    id,
    handle: id,
    role: index === 0 ? "AWP" : "Rifler",
    ovr: index === 0 ? 78 : 74,
    age: 24,
  }));
  const incoming = { id: "trade-awp", handle: "tradeAWP", role: "AWP", ovr: 82, age: 22, potential: 85 };
  let state = createManagerCareer("trade-accepted", { organizationId: "club", organizationName: "Club", cash: 500_000, players: inherited });
  state = scoutManagerCandidate(state, incoming);
  const draft = {
    incoming,
    outgoing: inherited[0],
    sourceTeamId: "seller",
    sourceTeamName: "Seller",
    askingFee: 180_000,
    cashOffered: 0,
    incomingSalary: 5_000,
  };
  const evaluation = evaluateManagerTradeProposal(state, draft);
  const submitted = submitManagerTradeOffer(state, { ...draft, cashOffered: evaluation.requiredCash + 50_000 });
  assert.equal(submitted.market.tradeOffers[0].status, "pending");
  const completed = advanceManagerDate(submitted, submitted.market.tradeOffers[0].responseOn);
  assert.equal(completed.market.tradeOffers[0].status, "accepted");
  assert.ok(completed.market.tradeOffers[0].appliedOn);
  assert.equal(completed.contracts.some((contract) => contract.playerId === incoming.id), true);
  assert.equal(completed.contracts.some((contract) => contract.playerId === inherited[0].id), false);
  assert.equal(completed.cash, state.cash - evaluation.requiredCash - 50_000);
  assert.equal(completed.ledger.at(-1)?.category, "transfer");
  assert.equal(completed.market.rosterMoves[0].releasedPlayerId, incoming.id);
  assert.equal(completed.market.clubRelationships[0].completedTrades, 1);
});

test("a close trade receives a counter that the manager can accept", () => {
  const outgoing = { id: "p1", handle: "p1", role: "Rifler", ovr: 72, age: 25 };
  const incoming = { id: "trade-rifle", handle: "tradeRifle", role: "Rifler", ovr: 86, age: 21, potential: 89 };
  let state = createManagerCareer("trade-counter", {
    organizationId: "club",
    organizationName: "Club",
    cash: 700_000,
    players: [outgoing, ...roster.slice(1).map((id) => ({ id, handle: id, role: "Rifler", ovr: 72 }))],
  });
  state = scoutManagerCandidate(state, incoming);
  const proposal = {
    incoming,
    outgoing,
    sourceTeamId: "seller",
    sourceTeamName: "Seller",
    askingFee: 300_000,
    cashOffered: 0,
    incomingSalary: 7_000,
  };
  const requiredCash = evaluateManagerTradeProposal(state, proposal).requiredCash;
  const submitted = submitManagerTradeOffer(state, { ...proposal, cashOffered: Math.ceil(requiredCash * 0.7 / 5_000) * 5_000 });
  const countered = advanceManagerDate(submitted, submitted.market.tradeOffers[0].responseOn);
  assert.equal(countered.market.tradeOffers[0].status, "countered");
  assert.ok((countered.market.tradeOffers[0].counterCash ?? 0) >= requiredCash);
  const accepted = acceptManagerTradeCounter(countered, countered.market.tradeOffers[0].id);
  assert.equal(accepted.market.tradeOffers[0].status, "accepted");
  assert.equal(accepted.contracts.some((contract) => contract.playerId === incoming.id), true);
});

test("an identical pending, rejected, or countered trade cannot be spammed", () => {
  const outgoing = { id: "p1", handle: "p1", role: "Rifler", ovr: 68, age: 27 };
  const incoming = { id: "trade-star", handle: "tradeStar", role: "AWP", ovr: 88, age: 20, potential: 92 };
  let state = createManagerCareer("trade-repeat", {
    organizationId: "club",
    organizationName: "Club",
    cash: 700_000,
    players: [outgoing, ...roster.slice(1).map((id) => ({ id, handle: id, role: "Rifler", ovr: 70 }))],
  });
  state = scoutManagerCandidate(state, incoming);
  const proposal = {
    incoming,
    outgoing,
    sourceTeamId: "seller",
    sourceTeamName: "Seller",
    askingFee: 500_000,
    cashOffered: 0,
    incomingSalary: 10_000,
  };
  const submitted = submitManagerTradeOffer(state, proposal);
  assert.equal(submitManagerTradeOffer(submitted, proposal), submitted);
  const responded = advanceManagerDate(submitted, submitted.market.tradeOffers[0].responseOn);
  assert.ok(["rejected", "countered"].includes(responded.market.tradeOffers[0].status));
  assert.equal(submitManagerTradeOffer(responded, proposal), responded);
});

test("an accepted trade waits for a locked event roster and resolves after the event", () => {
  const outgoing = { id: "p1", handle: "p1", role: "AWP", ovr: 78, age: 24 };
  const incoming = { id: "locked-awp", handle: "lockedAWP", role: "AWP", ovr: 81, age: 22, potential: 84 };
  let state = createManagerCareer("trade-delay", {
    organizationId: "club",
    organizationName: "Club",
    cash: 500_000,
    players: [outgoing, ...roster.slice(1).map((id) => ({ id, handle: id, role: "Rifler", ovr: 72 }))],
  });
  state = scoutManagerCandidate(state, incoming);
  const event = managerEventById("frontier-open-2026")!;
  state = registerManagerEvent(state, event.id, roster);
  state = launchManagerEvent({ ...state, date: event.startsOn }, event.id);
  const proposal = {
    incoming,
    outgoing,
    sourceTeamId: "seller",
    sourceTeamName: "Seller",
    askingFee: 160_000,
    cashOffered: 0,
    incomingSalary: 5_000,
  };
  const requiredCash = evaluateManagerTradeProposal(state, proposal).requiredCash;
  const pending = submitManagerTradeOffer(state, { ...proposal, cashOffered: requiredCash + 50_000 });
  assert.equal(pending.market.tradeOffers[0].status, "pending");
  assert.equal(pending.contracts.some((contract) => contract.playerId === incoming.id), false);
  const cashBeforeResponse = pending.cash;
  const reserved = advanceManagerDate({ ...pending, activeEventId: undefined }, pending.market.tradeOffers[0].responseOn);
  assert.equal(reserved.market.tradeOffers[0].status, "delayed");
  assert.equal(reserved.cash, cashBeforeResponse - pending.market.tradeOffers[0].cashOffered);
  assert.ok(reserved.market.tradeOffers[0].cashReservedOn);
  assert.equal(reserved.ledger.filter((entry) => entry.category === "transfer").length, 1);
  const resolved = completeManagerEvent(pending, event.id, "top8");
  assert.equal(resolved.market.tradeOffers[0].status, "accepted");
  assert.ok(resolved.market.tradeOffers[0].appliedOn);
  assert.equal(resolved.contracts.some((contract) => contract.playerId === incoming.id), true);
  assert.equal(resolved.contracts.some((contract) => contract.playerId === outgoing.id), false);
  assert.equal(resolved.cash, state.cash - pending.market.tradeOffers[0].cashOffered - managerMonthlyPayroll(state) + event.prizes.top8);
  assert.equal(resolved.ledger.filter((entry) => entry.category === "transfer").length, 1);
});

test("trade responses are calendar checkpoints and counteroffers expire", () => {
  const outgoing = { id: "p1", handle: "p1", role: "Rifler", ovr: 72, age: 25 };
  const incoming = { id: "expiry-target", handle: "target", role: "Rifler", ovr: 84, age: 22 };
  let state = createManagerCareer("trade-expiry", {
    organizationId: "club",
    organizationName: "Club",
    cash: 700_000,
    players: [outgoing, ...roster.slice(1).map((id) => ({ id, handle: id, role: "Rifler", ovr: 72 }))],
  });
  state = scoutManagerCandidate(state, incoming);
  const proposal = { incoming, outgoing, sourceTeamId: "seller", sourceTeamName: "Seller", askingFee: 280_000, cashOffered: 0, incomingSalary: 6_000 };
  const required = evaluateManagerTradeProposal(state, proposal).requiredCash;
  const submitted = submitManagerTradeOffer(state, { ...proposal, cashOffered: Math.ceil(required * 0.7 / 5_000) * 5_000 });
  assert.equal(nextManagerCheckpoint(submitted), submitted.market.tradeOffers[0].responseOn);
  const countered = advanceManagerDate(submitted, submitted.market.tradeOffers[0].responseOn);
  assert.equal(countered.market.tradeOffers[0].status, "countered");
  const expiresOn = countered.market.tradeOffers[0].expiresOn!;
  const expired = advanceManagerDate(countered, expiresOn);
  assert.ok(["expired", "outbid"].includes(expired.market.tradeOffers[0].status));
});

test("trade talks allow three rounds and a pending offer can be withdrawn", () => {
  const outgoing = { id: "p1", handle: "p1", role: "Support", ovr: 70 };
  const incoming = { id: "round-target", handle: "roundTarget", role: "Support", ovr: 80 };
  let state = createManagerCareer("trade-rounds", {
    organizationId: "club",
    organizationName: "Club",
    cash: 600_000,
    players: [outgoing, ...roster.slice(1).map((id) => ({ id, handle: id, role: "Rifler", ovr: 70 }))],
  });
  state = scoutManagerCandidate(state, incoming);
  const base = { incoming, outgoing, sourceTeamId: "seller", sourceTeamName: "Seller", askingFee: 260_000, incomingSalary: 5_000 };
  for (let round = 1; round <= 3; round += 1) {
    state = submitManagerTradeOffer(state, { ...base, cashOffered: round * 5_000 });
    assert.equal(state.market.tradeOffers.at(-1)?.round, round);
    state = withdrawManagerTradeOffer(state, state.market.tradeOffers.at(-1)!.id);
    assert.equal(state.market.tradeOffers.at(-1)?.status, "withdrawn");
  }
  assert.equal(submitManagerTradeOffer(state, { ...base, cashOffered: 20_000 }), state);
  assert.equal(state.market.clubRelationships[0].approaches, 3);
  assert.ok(state.market.clubRelationships[0].trust < 50);
});

test("trade response timing and rival interest are deterministic for a save", () => {
  const outgoing = { id: "p1", handle: "p1", role: "Rifler", ovr: 72, age: 24 };
  const incoming = { id: "deterministic-target", handle: "target", role: "Rifler", ovr: 86, age: 21 };
  const createScoutedCareer = () => scoutManagerCandidate(createManagerCareer("trade-deterministic", {
    organizationId: "club",
    organizationName: "Club",
    cash: 700_000,
    players: [outgoing, ...roster.slice(1).map((id) => ({ id, handle: id, role: "Rifler", ovr: 72 }))],
  }), incoming);
  const proposal = { incoming, outgoing, sourceTeamId: "seller", sourceTeamName: "Seller", askingFee: 300_000, cashOffered: 110_000, incomingSalary: 6_000 };
  const first = submitManagerTradeOffer(createScoutedCareer(), proposal).market.tradeOffers[0];
  const replay = submitManagerTradeOffer(createScoutedCareer(), proposal).market.tradeOffers[0];
  assert.equal(first.responseOn, replay.responseOn);
  assert.equal(first.rivalBidCash, replay.rivalBidCash);
  assert.equal(first.rivalTeamName, replay.rivalTeamName);
});

test("a revised proposal supersedes the counter and consumes the next round", () => {
  const outgoing = { id: "p1", handle: "p1", role: "AWP", ovr: 73, age: 24 };
  const incoming = { id: "revision-target", handle: "target", role: "AWP", ovr: 84, age: 22 };
  let state = createManagerCareer("trade-revision", {
    organizationId: "club",
    organizationName: "Club",
    cash: 700_000,
    players: [outgoing, ...roster.slice(1).map((id) => ({ id, handle: id, role: "Rifler", ovr: 72 }))],
  });
  state = scoutManagerCandidate(state, incoming);
  const base = { incoming, outgoing, sourceTeamId: "seller", sourceTeamName: "Seller", askingFee: 300_000, cashOffered: 0, incomingSalary: 6_000 };
  const required = evaluateManagerTradeProposal(state, base).requiredCash;
  state = submitManagerTradeOffer(state, { ...base, cashOffered: Math.ceil(required * 0.7 / 5_000) * 5_000 });
  state = advanceManagerDate(state, state.market.tradeOffers[0].responseOn);
  assert.equal(state.market.tradeOffers[0].status, "countered");
  state = submitManagerTradeOffer(state, { ...base, cashOffered: Math.min(state.cash, required + 5_000) });
  assert.equal(state.market.tradeOffers[0].status, "superseded");
  assert.equal(state.market.tradeOffers[1].status, "pending");
  assert.equal(state.market.tradeOffers[1].round, 2);
  assert.equal(state.market.tradeOffers[1].parentOfferId, state.market.tradeOffers[0].id);
});

test("one outgoing player cannot be committed to two live trade talks", () => {
  const outgoing = { id: "p1", handle: "p1", role: "Rifler", ovr: 74 };
  const firstTarget = { id: "first-target", handle: "first", role: "Rifler", ovr: 80 };
  const secondTarget = { id: "second-target", handle: "second", role: "Rifler", ovr: 81 };
  let state = createManagerCareer("trade-outgoing-lock", {
    organizationId: "club",
    organizationName: "Club",
    cash: 600_000,
    players: [outgoing, ...roster.slice(1).map((id) => ({ id, handle: id, role: "Rifler", ovr: 72 }))],
  });
  state = scoutManagerCandidate(scoutManagerCandidate(state, firstTarget), secondTarget);
  const first = submitManagerTradeOffer(state, { incoming: firstTarget, outgoing, sourceTeamId: "seller-a", sourceTeamName: "Seller A", askingFee: 180_000, cashOffered: 30_000, incomingSalary: 5_000 });
  const blocked = submitManagerTradeOffer(first, { incoming: secondTarget, outgoing, sourceTeamId: "seller-b", sourceTeamName: "Seller B", askingFee: 190_000, cashOffered: 40_000, incomingSalary: 5_000 });
  assert.equal(blocked, first);
});

test("a trade lapses cleanly when its cash is gone before the response", () => {
  const outgoing = { id: "p1", handle: "p1", role: "AWP", ovr: 76 };
  const incoming = { id: "unfunded-target", handle: "target", role: "AWP", ovr: 79 };
  let state = createManagerCareer("trade-unfunded", {
    organizationId: "club",
    organizationName: "Club",
    cash: 200_000,
    players: [outgoing, ...roster.slice(1).map((id) => ({ id, handle: id, role: "Rifler", ovr: 72 }))],
  });
  state = scoutManagerCandidate(state, incoming);
  const base = { incoming, outgoing, sourceTeamId: "seller", sourceTeamName: "Seller", askingFee: 350_000, cashOffered: 0, incomingSalary: 4_000 };
  const required = evaluateManagerTradeProposal(state, base).requiredCash;
  state = submitManagerTradeOffer(state, { ...base, cashOffered: required });
  state = { ...state, cash: Math.max(0, required - 1) };
  state = advanceManagerDate(state, state.market.tradeOffers[0].responseOn);
  assert.equal(state.market.tradeOffers[0].status, "expired");
  assert.equal(state.market.tradeOffers[0].appliedOn, undefined);
  assert.equal(state.contracts.some((contract) => contract.playerId === incoming.id), false);
});

test("club trust changes the seller cash line", () => {
  const outgoing = { id: "p1", handle: "p1", role: "Entry", ovr: 72 };
  const incoming = { id: "trust-target", handle: "target", role: "Entry", ovr: 84 };
  const base = createManagerCareer("trade-trust", {
    organizationId: "club",
    organizationName: "Club",
    players: [outgoing, ...roster.slice(1).map((id) => ({ id, handle: id, role: "Rifler", ovr: 72 }))],
  });
  const proposal = { incoming, outgoing, sourceTeamId: "seller", sourceTeamName: "Seller", askingFee: 300_000, cashOffered: 0, incomingSalary: 6_000 };
  const relationship = { clubId: "seller", clubName: "Seller", trust: 80, approaches: 4, completedTrades: 2, failedNegotiations: 0 };
  const warm = evaluateManagerTradeProposal({ ...base, market: { ...base.market, clubRelationships: [relationship] } }, proposal);
  const wary = evaluateManagerTradeProposal({ ...base, market: { ...base.market, clubRelationships: [{ ...relationship, trust: 20 }] } }, proposal);
  assert.ok(warm.requiredCash < wary.requiredCash);
});

test("legacy applied trades rebuild seller roster moves during migration", () => {
  const outgoing = { id: "p1", handle: "p1", role: "Support", ovr: 72 };
  const incoming = { id: "legacy-target", handle: "target", role: "Support", ovr: 80 };
  const base = createManagerCareer("trade-migration", {
    organizationId: "club",
    organizationName: "Club",
    players: [outgoing, ...roster.slice(1).map((id) => ({ id, handle: id, role: "Rifler", ovr: 72 }))],
  });
  const migrated = normalizeManagerCareer({
    ...base,
    version: 6,
    market: {
      ...base.market,
      rosterMoves: undefined,
      tradeOffers: [{
        id: "legacy-offer",
        incoming,
        outgoing,
        sourceTeamId: "seller",
        sourceTeamName: "Seller",
        submittedOn: base.date,
        askingFee: 120_000,
        cashOffered: 20_000,
        incomingSalary: 4_000,
        status: "accepted",
        appliedOn: "2026-07-22",
        reasons: ["Legacy completion"],
      }],
    },
  } as never)!;
  assert.equal(migrated.market.tradeOffers[0].round, 1);
  assert.equal(migrated.market.tradeOffers[0].responseOn, base.date);
  assert.deepEqual(migrated.market.rosterMoves[0], {
    id: "legacy-offer:club-move",
    clubId: "seller",
    clubName: "Seller",
    releasedPlayerId: incoming.id,
    acquiredPlayer: outgoing,
    completedOn: "2026-07-22",
  });
});

test("event eligibility explains rank restrictions", () => {
  const state = createManagerCareer("save-a");
  const elite = managerEventById("new-york-elite-2026")!;
  const check = managerEventEligibility(state, elite);
  assert.equal(check.eligible, false);
  assert.ok(check.reasons.some((reason) => reason.includes("VRS rank")));
});

test("registering locks the roster, pays costs, and creates an inbox confirmation", () => {
  const state = createManagerCareer("save-a");
  const event = managerEventById("frontier-open-2026")!;
  const registered = registerManagerEvent(state, event.id, roster);
  const registration = registered.registrations.find((item) => item.eventId === event.id)!;
  assert.equal(registration.status, "confirmed");
  assert.deepEqual(registration.lockedRosterIds, roster);
  assert.equal(registered.cash, state.cash - event.entryFee - event.travelCost);
  assert.match(registered.inbox[0].title, /confirmed/);
});

test("registration rejects incomplete rosters and duplicate entries", () => {
  const state = createManagerCareer("save-a");
  const eventId = "frontier-open-2026";
  assert.equal(registerManagerEvent(state, eventId, roster.slice(0, 4)), state);
  const registered = registerManagerEvent(state, eventId, roster);
  assert.equal(registerManagerEvent(registered, eventId, roster), registered);
});

test("schedule conflicts are detected across confirmed events", () => {
  const state = createManagerCareer("save-a");
  const first = managerEventById("frontier-open-2026")!;
  const registered = registerManagerEvent(state, first.id, roster);
  const overlapping = {
    ...managerEventById("global-challenger-2026")!,
    id: "overlap",
    startsOn: "2026-07-30",
    endsOn: "2026-08-04",
  };
  const check = managerEventEligibility(registered, overlapping);
  assert.equal(check.eligible, false);
  assert.ok(check.reasons.some((reason) => reason.includes("Schedule conflict")));
});

test("withdrawing before roster lock returns half the committed cost", () => {
  const state = createManagerCareer("save-a");
  const event = managerEventById("frontier-open-2026")!;
  const registered = registerManagerEvent(state, event.id, roster);
  const withdrawn = withdrawManagerEvent(registered, event.id);
  assert.equal(withdrawn.registrations.find((item) => item.eventId === event.id)?.status, "withdrawn");
  assert.equal(withdrawn.cash, registered.cash + Math.round((event.entryFee + event.travelCost) * 0.5));
  assert.equal(withdrawn.reputation, registered.reputation - 1);
});

test("launch and completion settle event money, VRS, rank, and status", () => {
  const state = createManagerCareer("save-a");
  const event = managerEventById("frontier-open-2026")!;
  const registered = registerManagerEvent(state, event.id, roster);
  assert.equal(managerEventReadyToLaunch(registered, event.id), false);
  assert.equal(launchManagerEvent(registered, event.id), registered);
  const onStartDate = advanceManagerDate(registered, event.startsOn);
  assert.equal(managerEventReadyToLaunch(onStartDate, event.id), true);
  const launched = launchManagerEvent(onStartDate, event.id);
  assert.equal(launched.activeEventId, event.id);
  assert.equal(launched.date, event.startsOn);
  const completed = completeManagerEvent(launched, event.id, "champion", { p1: 1.4 });
  assert.equal(completed.activeEventId, undefined);
  assert.equal(completed.registrations.find((item) => item.eventId === event.id)?.status, "completed");
  assert.equal(completed.registrations.find((item) => item.eventId === event.id)?.placement, "champion");
  assert.equal(completed.cash, launched.cash + event.prizes.champion);
  assert.ok(completed.vrsPoints > launched.vrsPoints);
  assert.ok(completed.vrsRank < launched.vrsRank);
  const rankingReport = completed.inbox.find((item) => item.kind === "ranking");
  assert.equal(rankingReport?.rankBefore, launched.vrsRank);
  assert.equal(rankingReport?.rankAfter, completed.vrsRank);
  assert.ok((rankingReport?.pointsDelta ?? 0) > 0);
});

test("completed events build lineup familiarity and affect benched promised starters", () => {
  const players = [...roster, "p6"].map((id, index) => ({ id, handle: id, role: index === 0 ? "IGL" : "Rifler", ovr: 75 + index }));
  const state = createManagerCareer("dynamics-event", { players });
  const withBenchPromise = {
    ...state,
    contracts: state.contracts.map((contract) => contract.playerId === "p6" ? { ...contract, squadRole: "starter" as const } : contract),
  };
  const event = managerEventById("frontier-open-2026")!;
  const launched = launchManagerEvent(advanceManagerDate(registerManagerEvent(withBenchPromise, event.id, roster), event.startsOn), event.id);
  const usedBefore = managerPlayerDynamics(launched, "p1")!;
  const benchBefore = managerPlayerDynamics(launched, "p6")!;
  const completed = completeManagerEvent(launched, event.id, "champion");
  assert.equal(managerPlayerDynamics(completed, "p1")!.familiarity, usedBefore.familiarity + 3);
  assert.equal(managerPlayerDynamics(completed, "p1")!.morale, Math.min(100, usedBefore.morale + 7));
  assert.ok(managerPlayerDynamics(completed, "p1")!.form > usedBefore.form);
  assert.equal(managerPlayerDynamics(completed, "p6")!.familiarity, benchBefore.familiarity - 1);
  assert.equal(managerPlayerDynamics(completed, "p6")!.morale, benchBefore.morale - 3);
});

test("the manager can select a starting five before roster lock", () => {
  const players = [...roster, "p6"].map((id, index) => ({ id, handle: id, role: index === 0 ? "IGL" : "Rifler", ovr: 75 + index }));
  const base = createManagerCareer("lineup-a", { players });
  const state = {
    ...base,
    contracts: base.contracts.map((contract) => contract.playerId === "p6" ? { ...contract, status: "bench" as const } : contract),
  };
  const changed = setManagerStartingLineup(state, ["p2", "p3", "p4", "p5", "p6"]);
  assert.equal(changed.contracts.find((contract) => contract.playerId === "p1")?.status, "bench");
  assert.equal(changed.contracts.find((contract) => contract.playerId === "p6")?.status, "active");
  assert.equal(managerPlayerDynamics(changed, "p1")!.morale, managerPlayerDynamics(state, "p1")!.morale - 2);
  assert.equal(managerPlayerDynamics(changed, "p6")!.morale, managerPlayerDynamics(state, "p6")!.morale + 1);

  const event = managerEventById("frontier-open-2026")!;
  const launched = launchManagerEvent(advanceManagerDate(registerManagerEvent(changed, event.id, ["p2", "p3", "p4", "p5", "p6"]), event.startsOn), event.id);
  assert.equal(managerLineupEditLocked(launched), true);
  assert.equal(setManagerStartingLineup(launched, roster), launched);
});

test("financial pressure reports payroll runway bands", () => {
  const state = createManagerCareer("runway-a", {
    players: roster.map((id) => ({ id, handle: id, role: "Rifler", ovr: 80 })),
  });
  const payroll = managerMonthlyPayroll(state);
  assert.equal(managerFinancialStatus({ ...state, cash: payroll * 5 }).pressure, "healthy");
  assert.equal(managerFinancialStatus({ ...state, cash: payroll * 3 }).pressure, "watch");
  assert.equal(managerFinancialStatus({ ...state, cash: payroll }).pressure, "critical");
  assert.equal(managerFinancialStatus({ ...state, cash: -1 }).inDebt, true);
});

test("negative cash is survivable during the season", () => {
  const state = { ...createManagerCareer("debt-leeway"), cash: -12_000 };
  const advanced = advanceManagerDate(state, "2026-07-21");
  assert.equal(advanced.status, "active");
  assert.ok(advanced.cash < 0);
});

test("calendar advancement recalculates decayed VRS evidence", () => {
  const state = createManagerCareer("vrs-decay", { vrsRank: 12 });
  const advanced = advanceManagerDate(state, "2026-08-20");
  assert.ok(advanced.vrsPoints < state.vrsPoints);
  assert.ok(advanced.vrsRank > state.vrsRank);
  assert.equal(advanced.vrsProfile.baselineDate, state.date);
});

test("every world team decays and skipped events resolve into persistent standings", () => {
  const state = createManagerCareer("world-decay", {
    organizationId: "managed-club",
    organizationName: "Managed Club",
    vrsRank: 18,
    worldTeams,
  });
  const before = new Map(state.worldVrs.teams.map((team) => [team.id, team.points]));
  const advanced = advanceManagerDate(state, "2026-08-02");
  const frontier = advanced.worldVrs.events.find((result) => result.eventId === "frontier-open-2026");
  assert.ok(frontier);
  assert.equal(frontier.placements.length, 8);
  assert.equal(frontier.placements.some((placement) => placement.managed), false);
  const nonParticipant = advanced.worldVrs.teams.find((team) => (
    !frontier.placements.some((placement) => placement.teamId === team.id)
  ))!;
  assert.ok(nonParticipant.points < before.get(nonParticipant.id)!);
  assert.equal(nonParticipant.profile.events.length, 0);
  const participant = advanced.worldVrs.teams.find((team) => team.id === frontier.placements[0].teamId)!;
  assert.equal(participant.profile.events.length, 1);
  assert.ok(participant.profile.events[0].matches.length > 0);
  const ranks = [advanced.vrsRank, ...advanced.worldVrs.teams.map((team) => team.rank)];
  assert.equal(new Set(ranks).size, ranks.length);
  const replay = advanceManagerDate(createManagerCareer("world-decay", {
    organizationId: "managed-club",
    organizationName: "Managed Club",
    vrsRank: 18,
    worldTeams,
  }), "2026-08-02");
  assert.deepEqual(frontier.placements, replay.worldVrs.events[0].placements);
  assert.equal(advanceManagerDate(advanced, "2026-08-03").worldVrs.events.length, 1);
});

test("off-screen tournament matches give both clubs mirrored VRS evidence", () => {
  const state = advanceManagerDate(createManagerCareer("world-matches", {
    organizationId: "managed-club",
    organizationName: "Managed Club",
    vrsRank: 18,
    worldTeams,
  }), "2026-08-02");
  const firstTeam = state.worldVrs.teams.find((team) => team.profile.events.length)!;
  const firstMatch = firstTeam.profile.events[0].matches[0];
  const opponent = state.worldVrs.teams.find((team) => team.id === firstMatch.opponentId)!;
  const mirrored = opponent.profile.events[0].matches.find((match) => match.id === firstMatch.id)!;
  assert.equal(mirrored.opponentId, firstTeam.id);
  assert.equal(mirrored.won, !firstMatch.won);
});

test("all elapsed events are simulated even when the manager enters none of them", () => {
  const state = createManagerCareer("world-calendar", {
    organizationId: "managed-club",
    organizationName: "Managed Club",
    vrsRank: 18,
    worldTeams,
  });
  const advanced = advanceManagerDate(state, "2026-09-28");
  assert.deepEqual(
    advanced.worldVrs.events.map((result) => result.eventId),
    managerEvents.slice(0, 6).map((event) => event.id),
  );
  assert.ok(advanced.inbox.some((item) => item.title.includes("take the title")));
});

test("a managed event is inserted once into the shared world result", () => {
  const base = createManagerCareer("world-managed-event", {
    organizationId: "managed-club",
    organizationName: "Managed Club",
    vrsRank: 24,
    players: rosterPlayers,
    worldTeams,
  });
  const event = managerEventById("frontier-open-2026")!;
  const launched = launchManagerEvent(advanceManagerDate(registerManagerEvent(base, event.id, roster), event.startsOn), event.id);
  const completed = completeManagerEvent(launched, event.id, "champion");
  const result = completed.worldVrs.events.find((item) => item.eventId === event.id)!;
  assert.equal(result.placements.filter((placement) => placement.managed).length, 1);
  assert.equal(result.placements[0].teamId, base.organizationId);
  assert.equal(result.placements[0].placement, "champion");
  assert.equal(completed.worldVrs.events.filter((item) => item.eventId === event.id).length, 1);
});

test("legacy manager saves seed and backfill the world VRS circuit on load", () => {
  const legacy = createManagerCareer("world-migration", {
    organizationId: "managed-club",
    organizationName: "Managed Club",
    vrsRank: 18,
  });
  const migrated = normalizeManagerCareer({ ...legacy, version: 18, date: "2026-08-16" }, {
    organizationId: "managed-club",
    organizationName: "Managed Club",
    vrsRank: 18,
    worldTeams,
  })!;
  assert.equal(migrated.worldVrs.teams.length, worldTeams.length);
  assert.deepEqual(
    migrated.worldVrs.events.map((result) => result.eventId),
    managerEvents.slice(0, 3).map((event) => event.id),
  );
});

test("save migration removes a duplicate AI profile for the managed club", () => {
  const career = createManagerCareer("world-managed-duplicate", {
    organizationId: "managed-club",
    organizationName: "Managed Club",
    vrsRank: 18,
    worldTeams,
  });
  const duplicate = {
    ...career.worldVrs.teams[0],
    id: career.organizationId,
    name: career.organizationName,
  };
  const migrated = normalizeManagerCareer({
    ...career,
    version: MANAGER_CAREER_VERSION,
    date: "2026-07-27",
    worldVrs: {
      ...career.worldVrs,
      teams: [duplicate, ...career.worldVrs.teams],
    },
  }, {
    organizationId: career.organizationId,
    organizationName: career.organizationName,
    vrsRank: career.vrsRank,
    worldTeams,
  })!;
  assert.equal(migrated.worldVrs.teams.some((team) => (
    team.id === migrated.organizationId
    || team.name.toLowerCase() === migrated.organizationName.toLowerCase()
  )), false);
  const ranks = [migrated.vrsRank, ...migrated.worldVrs.teams.map((team) => team.rank)].sort((a, b) => a - b);
  assert.equal(new Set(ranks).size, ranks.length);
  assert.ok(ranks.every((rank) => rank >= 1 && rank <= 64));
});

test("partial world data preserves absolute VRS rank gaps", () => {
  const partialWorld = [
    { id: "top-1", name: "Top 1", rank: 1, vrsPoints: vrsPointsForRank(1), strength: 96 },
    { id: "top-2", name: "Top 2", rank: 2, vrsPoints: vrsPointsForRank(2), strength: 94 },
    { id: "nip", name: "Ninjas in Pyjamas", rank: 27, vrsPoints: vrsPointsForRank(27), strength: 78 },
    { id: "sharks", name: "Sharks", rank: 31, vrsPoints: vrsPointsForRank(31), strength: 74 },
    { id: "nemesis", name: "Nemesis", rank: 32, vrsPoints: vrsPointsForRank(32), strength: 73 },
  ];
  const state = createManagerCareer("absolute-vrs-gaps", {
    organizationId: "liquid",
    organizationName: "Liquid",
    vrsRank: 28,
    vrsPoints: vrsPointsForRank(28),
    worldTeams: partialWorld,
  });

  assert.equal(state.vrsRank, 28);
  assert.equal(state.worldVrs.teams.find((team) => team.id === "nip")?.rank, 27);
  assert.equal(state.worldVrs.teams.find((team) => team.id === "sharks")?.rank, 31);
  assert.equal(state.worldVrs.teams.find((team) => team.id === "nemesis")?.rank, 32);
  const ranks = [state.vrsRank, ...state.worldVrs.teams.map((team) => team.rank)];
  assert.equal(new Set(ranks).size, ranks.length);

  const decayed = advanceManagerDate(state, "2026-07-27");
  assert.equal(decayed.worldVrs.teams.find((team) => team.id === "top-1")?.rank, 1);
  assert.equal(decayed.worldVrs.teams.find((team) => team.id === "top-2")?.rank, 2);
  assert.equal(decayed.vrsRank, 28);
  assert.equal(decayed.worldVrs.teams.find((team) => team.id === "sharks")?.rank, 31);
});

test("version 20 saves migrate from compressed ranks to organization source ranks", () => {
  const old = createManagerCareer("absolute-vrs-migration", {
    organizationId: "liquid",
    organizationName: "Liquid",
    vrsRank: 21,
    vrsPoints: vrsPointsForRank(21),
  });
  const evidence = {
    id: "liquid-result",
    eventName: "Recorded Event",
    completedOn: "2026-07-20",
    prizePool: 0,
    prizeWon: 0,
    lan: true,
    prestige: 0,
    matches: [],
  };
  const saved = {
    ...old,
    version: 20,
    vrsProfile: {
      ...old.vrsProfile,
      baselinePoints: vrsPointsForRank(21),
      events: [evidence],
    },
  };
  const migrated = normalizeManagerCareer(saved, {
    organizationId: "liquid",
    organizationName: "Liquid",
    vrsRank: 28,
    vrsPoints: vrsPointsForRank(28),
    worldTeams: [
      { id: "nip", name: "Ninjas in Pyjamas", rank: 27, vrsPoints: vrsPointsForRank(27), strength: 78 },
      { id: "sharks", name: "Sharks", rank: 31, vrsPoints: vrsPointsForRank(31), strength: 74 },
      { id: "nemesis", name: "Nemesis", rank: 32, vrsPoints: vrsPointsForRank(32), strength: 73 },
    ],
  })!;

  assert.equal(migrated.vrsProfile.baselinePoints, vrsPointsForRank(28));
  assert.equal(migrated.vrsProfile.baselineDate, "2026-07-20");
  assert.deepEqual(migrated.vrsProfile.events, [evidence]);
  assert.equal(migrated.vrsRank, 28);
  assert.equal(migrated.boardObjective.startingRank, 28);
});

test("reaching the board VRS target completes the mandate once", () => {
  const players = roster.map((id) => ({ id, handle: id, role: "Rifler", ovr: 80 }));
  const state = createManagerCareer("board-target", { vrsRank: 25, players });
  const event = managerEventById("frontier-open-2026")!;
  const launched = launchManagerEvent(advanceManagerDate(registerManagerEvent(state, event.id, roster), event.startsOn), event.id);
  const completed = completeManagerEvent(launched, event.id, "champion", {}, {
    id: "board-target-result",
    eventId: event.id,
    eventName: event.name,
    completedOn: event.endsOn,
    prizePool: event.prizePool,
    prizeWon: event.prizes.champion,
    lan: false,
    prestige: 1,
    matches: Array.from({ length: 7 }, (_, index) => ({
      id: `board-target-${index}`,
      opponentId: `top-${index}`,
      opponentName: `Top ${index}`,
      opponentPoints: 1_850,
      won: true,
    })),
  });
  assert.equal(completed.boardObjective.status, "completed");
  assert.ok(completed.inbox.some((item) => item.title === "Board objective achieved"));
});

test("expired and final-cycle player contracts can be renewed", () => {
  const player = { id: "igl", handle: "captain", role: "IGL", ovr: 72, age: 27, potential: 73 };
  const base = createManagerCareer("renewal-a", {
    organizationId: "club-a",
    organizationName: "Club A",
    organizationCountry: "UA",
    vrsRank: 34,
    cash: 100_000,
    players: [player],
  });
  const expired = {
    ...base,
    contracts: base.contracts.map((contract) => ({ ...contract, status: "expired" as const, majorCyclesRemaining: 0 })),
  };
  const salary = Math.ceil(managerRecommendedSalary(player, expired) * 1.25 / 250) * 250;
  const renewed = renewManagerPlayerContract(expired, player, {
    monthlySalary: salary,
    majorCycles: 3,
    squadRole: "starter",
  });
  assert.notEqual(renewed, expired);
  assert.equal(renewed.contracts.length, 1);
  assert.equal(renewed.contracts[0].status, "bench");
  assert.equal(renewed.contracts[0].majorCyclesRemaining, 3);
  assert.equal(renewed.contracts[0].monthlySalary, salary);
  assert.equal(renewed.cash, expired.cash - managerRenewalBonus(salary));
  assert.deepEqual(renewed.market.signedPlayerIds, [player.id]);
  assert.match(renewed.inbox[0].title, /renewed/);

  const longDeal = { ...renewed, contracts: renewed.contracts.map((contract) => ({ ...contract, status: "active" as const, majorCyclesRemaining: 2 })) };
  assert.equal(renewManagerPlayerContract(longDeal, player, {
    monthlySalary: salary,
    majorCycles: 4,
    squadRole: "starter",
  }), longDeal);
});

test("a former signing can rejoin after their contract expires", () => {
  const player = { id: "returning-awp", handle: "returning", role: "AWP", ovr: 75, age: 23, potential: 79 };
  const scouted = scoutManagerCandidate(createManagerCareer("renewal-market", { cash: 200_000 }), player);
  const salary = Math.ceil(managerRecommendedSalary(player, scouted) * 1.3 / 250) * 250;
  const firstDeal = submitManagerFreeAgentOffer(scouted, player, {
    monthlySalary: salary,
    majorCycles: 1,
    squadRole: "starter",
  });
  const expired = {
    ...firstDeal,
    contracts: firstDeal.contracts.map((contract) => ({ ...contract, status: "expired" as const, majorCyclesRemaining: 0 })),
  };
  const secondDeal = submitManagerFreeAgentOffer(expired, player, {
    monthlySalary: salary,
    majorCycles: 3,
    squadRole: "starter",
  });
  assert.equal(secondDeal.contracts.length, 1);
  assert.equal(secondDeal.contracts[0].status, "bench");
  assert.equal(secondDeal.contracts[0].majorCyclesRemaining, 3);
  assert.deepEqual(secondDeal.market.signedPlayerIds, [player.id]);
});

test("a manager can release a bench contract without dropping below five players", () => {
  const players = [...rosterPlayers, { id: "p6", handle: "reserve", role: "Support", ovr: 72 }];
  const base = createManagerCareer("release-bench", {
    organizationId: "club",
    organizationName: "Club",
    cash: 100_000,
    players,
  });
  const state = setManagerStartingLineup(base, roster);
  const reserveContract = state.contracts.find((contract) => contract.playerId === "p6")!;
  assert.equal(reserveContract.status, "bench");
  const cost = managerContractReleaseCost(reserveContract);
  const released = releaseManagerPlayerContract(state, "p6");
  assert.equal(released.contracts.length, 5);
  assert.equal(released.contracts.some((contract) => contract.playerId === "p6"), false);
  assert.equal(released.cash, state.cash - cost);
  assert.equal(released.ledger.at(-1)?.category, "release");
  assert.match(released.inbox[0].title, /released/);

  assert.equal(releaseManagerPlayerContract(state, "p1"), state);
  assert.equal(releaseManagerPlayerContract(released, "p5"), released);
});

test("an unmet board mandate fails at its deadline", () => {
  const state = createManagerCareer("board-deadline", { vrsRank: 32 });
  const advanced = advanceManagerDate(state, "2026-11-23");
  assert.equal(advanced.boardObjective.status, "failed");
  assert.ok(advanced.inbox.some((item) => item.title === "Board objective missed"));
});

test("a completed manager season opens a fresh six-month event cycle", () => {
  const players = roster.map((id) => ({ id, handle: id, role: "Rifler", ovr: 80 }));
  const base = createManagerCareer("season-rollover", { players });
  const completedSeason = advanceManagerDate({
    ...base,
    completedEventIds: managerEvents.map((event) => event.id),
    contracts: base.contracts.map((contract, index) => ({
      ...contract,
      majorCyclesRemaining: index === 0 ? 1 : 2,
    })),
  }, "2026-11-23");
  assert.equal(nextManagerCheckpoint(completedSeason), undefined);

  const next = startNextManagerSeason(completedSeason);
  const frontier = managerEventById("frontier-open-2026")!;
  assert.equal(next.season, 2);
  assert.equal(next.date, "2027-01-20");
  assert.equal(next.registrations.length, 1);
  assert.equal(next.registrations[0].eventId, "fall-global-major-2026");
  assert.equal(next.registrations[0].feePaid, 0);
  assert.equal(next.completedEventIds.length, 0);
  assert.equal(next.boardObjective.deadline, "2027-05-22");
  assert.equal(next.contracts[0].status, "expired");
  assert.equal(next.contracts[1].majorCyclesRemaining, 1);
  assert.deepEqual(managerEventSchedule(frontier, next.season), {
    startsOn: "2027-01-27",
    endsOn: "2027-02-02",
    registrationDeadline: "2027-01-23",
    rosterLockOn: "2027-01-25",
  });
  assert.equal(managerEventName(frontier, next.season), "Frontier Open Spring 2027");
  assert.equal(nextManagerCheckpoint(next), "2027-01-23");
});

test("a manager career ends only when season-end books close below zero", () => {
  const base = createManagerCareer("season-insolvent", { cash: -30_000 });
  const completedSeason = advanceManagerDate({
    ...base,
    completedEventIds: managerEvents.map((event) => event.id),
    registrations: base.registrations.map((registration) => ({ ...registration, status: "completed" as const })),
  }, "2026-11-23");
  assert.equal(nextManagerCheckpoint(completedSeason), undefined);

  const ended = startNextManagerSeason(completedSeason);
  assert.equal(ended.status, "bankrupt");
  assert.equal(ended.season, 1);
  assert.equal(ended.boardConfidence, 0);
  assert.match(ended.endReason ?? "", /unpaid obligations/);
  assert.equal(startNextManagerSeason(ended), ended);
});

test("manager season rollover stays locked while calendar decisions remain", () => {
  const state = createManagerCareer("season-not-ready");
  assert.equal(startNextManagerSeason(state), state);
});

test("calendar advancement records missed deadlines and finds the next checkpoint", () => {
  const state = createManagerCareer("save-a");
  assert.equal(nextManagerCheckpoint(state), "2026-07-23");
  const advanced = advanceManagerDate(state, "2026-07-24");
  assert.equal(advanced.date, "2026-07-24");
  assert.match(advanced.inbox[0].title, /registration closed/);
});

test("advancing from the deadline to a later checkpoint records the closure", () => {
  const state = { ...createManagerCareer("save-a"), date: "2026-07-23" };
  const advanced = advanceManagerDate(state, "2026-08-03");
  assert.ok(advanced.inbox.some((item) => item.eventId === "frontier-open-2026" && item.kind === "deadline"));
});

test("calendar advancement charges inherited player payroll once per crossed month", () => {
  const state = createManagerCareer("payroll-a", {
    organizationId: "club-a",
    organizationName: "Club A",
    players: roster.map((id, index) => ({ id, handle: id, role: index === 0 ? "IGL" : "Rifler", ovr: 80 + index })),
  });
  const payroll = managerMonthlyPayroll(state);
  const advanced = advanceManagerDate(state, "2026-09-03");
  assert.equal(advanced.cash, state.cash - payroll * 2);
  assert.equal(advanced.ledger.filter((entry) => entry.category === "payroll").length, 2);
});

test("an orphaned active-event lock cannot block the next confirmed event date", () => {
  const base = createManagerCareer("stale-event-lock");
  const stale = {
    ...base,
    date: "2026-08-16",
    activeEventId: "retired-manager-event",
  };
  const migrated = normalizeManagerCareer(stale)!;
  assert.equal(migrated.activeEventId, undefined);

  const advanced = advanceManagerDate(stale, "2026-09-14");
  assert.equal(advanced.date, "2026-09-14");
  assert.equal(advanced.activeEventId, undefined);
});

test("a confirmed event that has passed is retired instead of trapping the calendar", () => {
  const event = managerEventById("frontier-open-2026")!;
  const registered = registerManagerEvent(createManagerCareer("expired-confirmation"), event.id, roster);
  const advanced = advanceManagerDate(registered, "2026-09-14");
  assert.equal(advanced.date, "2026-09-14");
  assert.equal(advanced.registrations.find((item) => item.eventId === event.id)?.status, "withdrawn");
  assert.ok(advanced.inbox.some((item) => item.title.includes("event window passed")));
});
