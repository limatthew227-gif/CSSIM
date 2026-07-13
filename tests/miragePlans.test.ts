import { test } from "node:test";
import assert from "node:assert/strict";

import type { MapId, Player, Role, Style } from "../src/gameData";
import { findRoute } from "../src/pathfinder";
import {
  assignMirageJobs,
  inferMirageCallStyle,
  miragePlans,
  routeForMirageJob,
  selectMiragePlan,
  type MirageJob,
  type MiragePlanContext,
} from "../src/miragePlans";

test("Mirage jobs: actual roles receive their tactical jobs regardless of roster order", () => {
  const players = [
    player("captain", "IGL", "Balanced"),
    player("lurker", "Lurker", "Passive"),
    player("support", "Support", "Passive"),
    player("entry", "Entry", "Aggressive"),
    player("sniper", "AWP", "Passive", 96),
  ];
  const jobs = assignMirageJobs(players, (candidate) => candidate.id === "sniper");

  assert.equal(jobs.get("sniper"), "awper");
  assert.equal(jobs.get("entry"), "entry");
  assert.equal(jobs.get("lurker"), "lurker");
  assert.equal(jobs.get("support"), "support");
  assert.equal(jobs.get("captain"), "trader");
});

test("Mirage jobs: the equipped AWP takes the AWP route even when their card role is Rifler", () => {
  const equipped = player("equipped", "Rifler", "Balanced", 94);
  const nominal = player("nominal", "AWP", "Passive", 91);
  const roster = [equipped, nominal, player("entry", "Entry", "Aggressive"), player("lurk", "Lurker", "Passive"), player("support", "Support", "Balanced")];
  const jobs = assignMirageJobs(roster, (candidate) => candidate.id === equipped.id);
  assert.equal(jobs.get(equipped.id), "awper");
});

test("Mirage plans: every job route is connected on the tactical graph", () => {
  const jobs: MirageJob[] = ["entry", "trader", "support", "awper", "lurker"];
  miragePlans.forEach((plan) => {
    jobs.forEach((job) => {
      let from = "tspawn";
      routeForMirageJob(plan, job).forEach((to) => {
        assert.ok(findRoute(from, to), `${plan.id}/${job}: ${from} should reach ${to}`);
        from = to;
      });
    });
  });
});

test("Mirage plans: low-utility aggressive ecos prefer contact play", () => {
  const eco = samplePlans({ tactic: "aggressive", economy: "ECO", utilityCount: 0 });
  const full = samplePlans({ tactic: "cautious", economy: "FULL", utilityCount: 10 });
  assert.ok((eco.get("contact-b") ?? 0) > (full.get("contact-b") ?? 0) * 2);
  assert.ok(((full.get("mid-to-a") ?? 0) + (full.get("mid-to-b") ?? 0)) > ((eco.get("mid-to-a") ?? 0) + (eco.get("mid-to-b") ?? 0)));
});

test("Mirage plans: opponent call style follows the roster profile", () => {
  assert.equal(inferMirageCallStyle([player("a", "Entry", "Aggressive"), player("b", "Rifler", "Aggressive"), player("c", "AWP", "Passive")]), "aggressive");
  assert.equal(inferMirageCallStyle([player("a", "AWP", "Passive"), player("b", "Lurker", "Passive"), player("c", "Support", "Passive")]), "cautious");
  assert.equal(inferMirageCallStyle([player("a", "IGL", "Balanced"), player("b", "Rifler", "Balanced")]), "standard");
});

function samplePlans(context: MiragePlanContext) {
  const counts = new Map<string, number>();
  const random = mulberry32(42);
  for (let index = 0; index < 2000; index += 1) {
    const id = selectMiragePlan(context, random).id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function player(id: string, role: Role, style: Style, awp = role === "AWP" ? 92 : 55): Player {
  const maps = ["mirage", "inferno", "nuke", "ancient", "anubis", "dust2", "train"].reduce((acc, map) => {
    acc[map as MapId] = 80;
    return acc;
  }, {} as Record<MapId, number>);
  return {
    id,
    handle: id,
    realName: id,
    country: "US",
    role,
    style,
    traits: [],
    stats: { aim: role === "Entry" ? 92 : 82, clutch: role === "Lurker" ? 92 : 82, consistency: role === "Support" ? 92 : 84, awp, igl: role === "IGL" ? 92 : 55 },
    ovr: 82,
    source: { tag: "TST", name: "Test", country: "US", era: "CS2", year: "2026", accent: "#fff" },
    maps,
  };
}
