import {
  mapPool,
  rateStatsForRole,
  type Coach,
  type Era,
  type MapId,
  type Player,
  type PlayerStats,
  type Role,
  type Roster,
  type Style,
} from "./gameData";
import { playerVersionKey } from "./playerIdentity";
import { requiredRoles } from "./sim";

// A team's artwork normally lives on roster.logo (the built-ins resolve it from teamLogos.ts at build
// time). Callers may also pass hasLogo to vouch for art held elsewhere (e.g. a teamLogoUrls lookup),
// which suppresses the missing-logo warning.
export interface ValidationOptions {
  hasLogo?: (roster: Roster) => boolean;
}

// Pure data-integrity checks for rosters, players, coaches and imported HLTV data. Returns structured
// issues (no throwing) so the UI can block bad imports and a dev panel can list what's wrong. Catches
// bad roles, duplicate ids, missing logos, impossible overalls, out-of-range stats, broken map pools.

export type ValidationLevel = "error" | "warning";

export interface ValidationIssue {
  level: ValidationLevel;
  code: string;
  message: string;
  path: string;
}

export interface ValidationSummary {
  issues: ValidationIssue[];
  errors: number;
  warnings: number;
  ok: boolean; // no errors (warnings are allowed)
}

const ROLES: Role[] = ["IGL", "AWP", "Entry", "Lurker", "Rifler", "Support"];
const STYLES: Style[] = ["Aggressive", "Balanced", "Passive"];
const ERAS: Era[] = ["CS 1.6", "CS:Source", "CS:GO", "CS2"];
const COACH_STYLES: Coach["style"][] = ["Tactical", "Aggressive", "Discipline"];
const STAT_KEYS: (keyof PlayerStats)[] = ["aim", "clutch", "consistency", "awp", "igl"];
const MAP_IDS: MapId[] = mapPool.map((map) => map.id);

const OVR_MIN = 40;
const OVR_MAX = 99;
const OVR_TOLERANCE = 2; // how far a baked OVR may drift from rateStatsForRole before we warn
const EXPECTED_ROSTER_SIZE = 5;

export function summarize(issues: ValidationIssue[]): ValidationSummary {
  const errors = issues.filter((issue) => issue.level === "error").length;
  return { issues, errors, warnings: issues.length - errors, ok: errors === 0 };
}

function isFiniteInRange(value: unknown, lo: number, hi: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= lo && value <= hi;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validatePlayer(player: Player, path = `player:${player?.id ?? "?"}`): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string, suffix = "") =>
    issues.push({ level: "error", code, message, path: path + suffix });
  const warn = (code: string, message: string, suffix = "") =>
    issues.push({ level: "warning", code, message, path: path + suffix });

  if (!player || typeof player !== "object") {
    err("player.shape", "Player is not an object");
    return issues;
  }
  if (!nonEmptyString(player.id)) err("player.id", "Missing player id");
  if (!nonEmptyString(player.handle)) err("player.handle", "Missing handle");
  if (!nonEmptyString(player.realName)) warn("player.realName", `${player.handle || "Player"} has no real name`);
  if (!nonEmptyString(player.country)) warn("player.country", `${player.handle || "Player"} has no country`);

  if (!ROLES.includes(player.role)) err("player.role", `Invalid role "${player.role}"`);
  if (player.secondaryRole !== undefined) {
    if (!ROLES.includes(player.secondaryRole)) err("player.secondaryRole", `Invalid secondary role "${player.secondaryRole}"`);
    else if (player.secondaryRole === player.role) warn("player.secondaryRole", "Secondary role duplicates the primary role");
  }
  if (!STYLES.includes(player.style)) err("player.style", `Invalid style "${player.style}"`);

  if (!player.stats || typeof player.stats !== "object") {
    err("player.stats", "Missing stats block");
  } else {
    for (const key of STAT_KEYS) {
      if (!isFiniteInRange(player.stats[key], 0, 100)) {
        err("player.stat", `Stat ${key}=${player.stats[key]} is out of range (0–100)`, `/stats.${key}`);
      }
    }
  }

  if (!isFiniteInRange(player.ovr, OVR_MIN, OVR_MAX)) {
    err("player.ovr", `Impossible OVR ${player.ovr} (expected ${OVR_MIN}–${OVR_MAX})`);
  } else if (player.stats && ROLES.includes(player.role)) {
    const expected = rateStatsForRole(player.stats, player.role);
    if (Math.abs(expected - player.ovr) > OVR_TOLERANCE) {
      warn("player.ovr.drift", `OVR ${player.ovr} disagrees with stats/role (expected ~${expected})`);
    }
  }

  if (!player.maps || typeof player.maps !== "object") {
    err("player.maps", "Missing per-map ratings");
  } else {
    for (const mapId of MAP_IDS) {
      if (!isFiniteInRange(player.maps[mapId], 0, 100)) {
        err("player.map", `Map rating ${mapId}=${player.maps?.[mapId]} is out of range (0–100)`, `/maps.${mapId}`);
      }
    }
  }

  return issues;
}

export function validateCoach(coach: Coach, path = `coach:${coach?.id ?? "?"}`): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!coach || typeof coach !== "object") {
    issues.push({ level: "error", code: "coach.shape", message: "Coach is not an object", path });
    return issues;
  }
  if (!nonEmptyString(coach.id)) issues.push({ level: "error", code: "coach.id", message: "Missing coach id", path });
  if (!nonEmptyString(coach.handle)) issues.push({ level: "error", code: "coach.handle", message: "Missing coach handle", path });
  if (!COACH_STYLES.includes(coach.style)) {
    issues.push({ level: "error", code: "coach.style", message: `Invalid coach style "${coach.style}"`, path });
  }
  if (!isFiniteInRange(coach.rating, 0, 100)) {
    issues.push({ level: "error", code: "coach.rating", message: `Coach rating ${coach.rating} out of range (0–100)`, path });
  }
  return issues;
}

export function validateRoster(roster: Roster, options: ValidationOptions = {}, path = `roster:${roster?.id ?? "?"}`): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string) => issues.push({ level: "error", code, message, path });
  const warn = (code: string, message: string) => issues.push({ level: "warning", code, message, path });

  if (!roster || typeof roster !== "object") {
    err("roster.shape", "Roster is not an object");
    return issues;
  }
  if (!nonEmptyString(roster.id)) err("roster.id", "Missing roster id");
  if (!nonEmptyString(roster.tag)) err("roster.tag", "Missing team tag");
  if (!nonEmptyString(roster.name)) err("roster.name", "Missing team name");
  if (!nonEmptyString(roster.logo) && !options.hasLogo?.(roster)) {
    warn("roster.logo", `${roster.name || roster.id} has no logo`);
  }
  if (roster.era && !ERAS.includes(roster.era)) warn("roster.era", `Unknown era "${roster.era}"`);

  if (!Array.isArray(roster.players)) {
    err("roster.players", "Roster has no players array");
    return issues;
  }
  if (roster.players.length < EXPECTED_ROSTER_SIZE) {
    err("roster.size", `Only ${roster.players.length} players (need ${EXPECTED_ROSTER_SIZE})`);
  } else if (roster.players.length > EXPECTED_ROSTER_SIZE) {
    warn("roster.size", `${roster.players.length} players (expected ${EXPECTED_ROSTER_SIZE})`);
  }

  const seenIds = new Map<string, number>();
  const seenHandles = new Map<string, number>();
  roster.players.forEach((player, index) => {
    issues.push(...validatePlayer(player, `${path}/player:${player?.id ?? index}`));
    if (nonEmptyString(player?.id)) seenIds.set(player.id, (seenIds.get(player.id) ?? 0) + 1);
    const handleKey = player?.handle?.toLowerCase();
    if (handleKey) seenHandles.set(handleKey, (seenHandles.get(handleKey) ?? 0) + 1);
  });
  for (const [id, count] of seenIds) if (count > 1) err("roster.dupId", `Duplicate player id "${id}" (${count}×)`);
  for (const [handle, count] of seenHandles) if (count > 1) warn("roster.dupHandle", `Duplicate handle "${handle}" (${count}×)`);

  // Required roles, counting a secondary role as coverage (the way composition does).
  const covered = new Set<Role>();
  roster.players.forEach((player) => {
    if (player?.role) covered.add(player.role);
    if (player?.secondaryRole) covered.add(player.secondaryRole);
  });
  for (const role of requiredRoles) {
    if (!covered.has(role)) warn("roster.role", `No ${role} in the lineup`);
  }

  if (roster.mapPool && typeof roster.mapPool === "object") {
    for (const mapId of MAP_IDS) {
      if (!isFiniteInRange(roster.mapPool[mapId], 0, 100)) {
        err("roster.map", `Team map rating ${mapId}=${roster.mapPool?.[mapId]} out of range (0–100)`);
      }
    }
  }

  return issues;
}

// Whole-dataset checks: duplicate team/coach ids, and the SAME player VERSION appearing on two teams
// (the "drafted makazze vs real makazze in one field" hazard). Keyed by playerVersionKey so historical
// editions of a player — s1mple 2018 vs s1mple 2026 — are correctly treated as distinct, not duplicates.
export function validateDataset(rosters: Roster[], coaches: Coach[] = [], options: ValidationOptions = {}): ValidationSummary {
  const issues: ValidationIssue[] = [];

  const teamIds = new Map<string, number>();
  const versionOwners = new Map<string, string[]>();

  rosters.forEach((roster) => {
    issues.push(...validateRoster(roster, options));
    if (nonEmptyString(roster?.id)) teamIds.set(roster.id, (teamIds.get(roster.id) ?? 0) + 1);
    (roster?.players ?? []).forEach((player) => {
      if (!player?.handle) return;
      const key = playerVersionKey(player);
      const owners = versionOwners.get(key) ?? [];
      if (!owners.includes(roster.id)) owners.push(roster.id);
      versionOwners.set(key, owners);
    });
  });

  for (const [id, count] of teamIds) {
    if (count > 1) issues.push({ level: "error", code: "dataset.dupTeamId", message: `Team id "${id}" used by ${count} teams`, path: "dataset" });
  }
  for (const [key, owners] of versionOwners) {
    if (owners.length > 1) {
      issues.push({ level: "warning", code: "dataset.dupPlayer", message: `Same player version on multiple teams (${owners.join(", ")})`, path: `dataset/${key}` });
    }
  }

  coaches.forEach((coach) => issues.push(...validateCoach(coach)));
  const coachIds = new Map<string, number>();
  coaches.forEach((coach) => {
    if (nonEmptyString(coach?.id)) coachIds.set(coach.id, (coachIds.get(coach.id) ?? 0) + 1);
  });
  for (const [id, count] of coachIds) {
    if (count > 1) issues.push({ level: "error", code: "dataset.dupCoachId", message: `Coach id "${id}" used ${count}×`, path: "dataset" });
  }

  return summarize(issues);
}
