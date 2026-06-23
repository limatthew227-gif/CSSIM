import { test } from "node:test";
import assert from "node:assert/strict";

import { validatePlayer, validateRoster, validateCoach, validateDataset } from "../src/validation";
import { rateStatsForRole, mapPool } from "../src/gameData";
import type { Coach, MapId, Player, Role, Roster } from "../src/gameData";

test("validatePlayer: a well-formed player has no issues", () => {
  assert.equal(validatePlayer(makePlayer("navi-makazze", "makazze", "Entry")).length, 0);
});

test("validatePlayer: catches bad role, impossible OVR, and out-of-range stats", () => {
  const bad = makePlayer("x", "x", "Entry");
  (bad as { role: string }).role = "Coach"; // not a real role
  bad.ovr = 140; // impossible
  bad.stats.aim = 130; // out of range
  const codes = validatePlayer(bad).map((issue) => issue.code);
  assert.ok(codes.includes("player.role"));
  assert.ok(codes.includes("player.ovr"));
  assert.ok(codes.includes("player.stat"));
});

test("validatePlayer: warns when OVR disagrees with stats/role", () => {
  const player = makePlayer("y", "y", "Entry");
  player.ovr = player.ovr + 12; // far from rateStatsForRole
  const issue = validatePlayer(player).find((entry) => entry.code === "player.ovr.drift");
  assert.ok(issue && issue.level === "warning");
});

test("validateRoster: duplicate ids error, missing logo warns, missing required role warns", () => {
  const roster = makeRoster("dup");
  roster.players[2].id = roster.players[0].id; // duplicate id (two non-AWP players)
  roster.players = roster.players.filter((player) => player.role !== "AWP"); // drop required AWP role
  roster.players.push(makePlayer("dup-extra", "extra", "Rifler"));
  delete (roster as { logo?: string }).logo;

  const issues = validateRoster(roster);
  const codes = issues.map((issue) => issue.code);
  assert.ok(codes.includes("roster.dupId"));
  assert.ok(issues.find((issue) => issue.code === "roster.logo")?.level === "warning");
  assert.ok(codes.includes("roster.role"));
});

test("validateRoster: a hasLogo predicate suppresses the missing-logo warning", () => {
  const roster = makeRoster("nologo");
  delete (roster as { logo?: string }).logo;
  assert.ok(validateRoster(roster).some((issue) => issue.code === "roster.logo"));
  assert.ok(!validateRoster(roster, { hasLogo: () => true }).some((issue) => issue.code === "roster.logo"));
});

test("validateCoach: flags an invalid style and rating", () => {
  const coach: Coach = { id: "c", handle: "Coach", realName: "A Coach", country: "US", style: "Tactical", rating: 80, text: "" };
  assert.equal(validateCoach(coach).length, 0);
  (coach as { style: string }).style = "Screamer";
  coach.rating = -3;
  const codes = validateCoach(coach).map((issue) => issue.code);
  assert.ok(codes.includes("coach.style"));
  assert.ok(codes.includes("coach.rating"));
});

test("validateDataset: duplicate team id errors and the same human on two teams warns", () => {
  const a = makeRoster("alpha");
  const b = makeRoster("beta");
  // same canonical player (same handle + real name + country) under different per-team ids
  b.players[0] = { ...a.players[0], id: "beta-shared" };
  const dupId = makeRoster("alpha"); // reuse id "alpha"

  const summary = validateDataset([a, b, dupId]);
  const codes = summary.issues.map((issue) => issue.code);
  assert.ok(codes.includes("dataset.dupTeamId"));
  assert.ok(codes.includes("dataset.dupPlayer"));
  assert.ok(!summary.ok); // duplicate team id is an error
});

const ROLE_FILL: Role[] = ["IGL", "AWP", "Entry", "Support", "Rifler"];

function makePlayer(id: string, handle: string, role: Role): Player {
  const stats = { aim: 84, clutch: 80, consistency: 82, awp: role === "AWP" ? 90 : 55, igl: role === "IGL" ? 90 : 55 };
  const maps = mapPool.reduce((acc, map) => ((acc[map.id] = 82), acc), {} as Record<MapId, number>);
  return {
    id,
    handle,
    realName: `${handle} Real`,
    country: "US",
    role,
    style: "Balanced",
    traits: [role],
    stats,
    ovr: rateStatsForRole(stats, role),
    source: { tag: "TST", name: "Test", country: "US", era: "CS2", year: "2026", accent: "#fff" },
    maps,
  };
}

function makeRoster(id: string): Roster {
  const maps = mapPool.reduce((acc, map) => ((acc[map.id] = 82), acc), {} as Record<MapId, number>);
  return {
    id,
    tag: id.slice(0, 3).toUpperCase(),
    name: id,
    country: "US",
    era: "CS2",
    year: "2026",
    accent: "#fff",
    logo: "logo.png",
    tagline: "test",
    mapPool: maps,
    players: ROLE_FILL.map((role, index) => makePlayer(`${id}-${role.toLowerCase()}-${index}`, `${id}${index}`, role)),
  };
}
