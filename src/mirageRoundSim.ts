/**
 * Mirage spatial round simulator — the round outcome EMERGES from real navigation + line-of-sight
 * duels, instead of being decided by a probability and narrated. Players route from spawn to
 * role-based objectives on the tactical graph (entry/support/AWP/lurker spread across different
 * approaches — NOT all through one choke), and a kill only happens when two enemies actually have
 * line-of-sight on the nav grid and fight. Who wins a duel is still skill-weighted (the `skill` map,
 * built from the sim's killWeight) plus holder/AWP/crossfire factors and a small team bias, so
 * aggregate win rates still track team strength.
 *
 * Output: an ordered event list (kills/plant/defuse/explode with real positions + timestamps) and a
 * position timeline the radar plays back, so movement and kills are the SAME spatial truth.
 */
import type { Player } from "./gameData";
import type { Vec } from "./mapGeometry";
import { getNavGrid, hasLineOfSight, snapToWalkable } from "./mapGeometry";
import { getNode, nearestNode, neighbors, spawnNodeId } from "./mirageNav";
import { findRoute, corridorPath } from "./pathfinder";
import { roundStateFor, type Situation, type Site } from "./roundAI";
import {
  assignMirageJobs,
  ctObjectiveForMirageJob,
  postPlantObjectiveForMirageJob,
  routeForMirageJob,
  selectMirageCtPushers,
  type MirageEconomy,
  type MirageCallStyle,
  type MirageJob,
  type MiragePlan,
} from "./miragePlans";

const GRID = getNavGrid("mirage");

// --- Tunables (radar units are 0..100; seconds are round-time) ---
const DT = 0.5; // simulation tick
const ROUND_TIME = 115;
const WALK_SPEED = 5.0; // radar units/sec — calibrated from a real CS2 demo (run ~4.8 u/s)
const SIGHT_RANGE = 44; // farthest a duel reaches. Safe to be generous now that the nav-mesh grid
// blocks real walls — long range only enables genuinely CLEAR sightlines, not through-wall shots.
const PLANT_TIME = 3.2;
const DEFUSE_TIME = 9.0;
const BOMB_TIME = 40;
const TTK_BASE = 0.7; // seconds from "we see each other" to someone dying — paces deaths
const envN = (k: string, d: number) => (typeof process !== "undefined" && process.env && process.env[k] ? Number(process.env[k]) : d);
const HOLDER_EDGE = 1.45; // a player holding their angle beats a peeker, all else equal
// AWP first-shot advantage. Lowered from 1.7: on mirage's spatial sim a star AWP was hoarding ~33% of
// the team's kills (vs a realistic ~25%), which compounded to absurd tournament K-D differentials. The
// AWP is still clearly favoured first-shot, just not single-handedly running the server. Env-tunable.
const AWP_EDGE = envN("AWP_EDGE", 1.55);
const DEFUSE_EXPOSE = 1.5; // a CT caught defusing is exposed — a T who re-peeks (flash out) is favoured
const CROSSFIRE = 1.1; // each extra enemy with LOS on you sharply cuts your odds (1vN is a near-loss)
// Aggregate-balance knobs. Per-duel edges COMPOUND over a ~16-round match, so individual OVR skill is
// compressed (SKILL_W) and team strength (the [0.16,0.84]-style probability) is the primary, bounded
// driver (TEAM_W). The per-duel clamp keeps even mismatches from being a sure thing (preserves upsets).
// Spawn placement: 5 pads in a pentagon around the (demo-calibrated) spawn centre, so the dots are
// clearly separated (real pads are too tight and overlap on the radar). Snapped to the floor.
const SPAWN_CENTER: Record<"T" | "CT", Vec> = { T: { x: 86.5, y: 36.6 }, CT: { x: 31.9, y: 68.7 } };
const SPAWN_R: Record<"T" | "CT", number> = { T: 3.4, CT: 2.8 };
// Repositioning: once holding, players don't freeze — they shuffle between nearby angles every few
// seconds (peek / re-angle / hold a different spot), so CTs and held Ts play dynamically.
const REPO_MIN = 3.0; // seconds
const REPO_VAR = 5.0;
const REPO_AGGRO = 1.6; // a player repositions sooner right after winning a duel (re-aggress/relocate)
const ROTATE_CHANCE = 0.6; // chance a dead player's teammate swings toward the fight (trade / retake)
const LANE_W = 1.9; // per-player radial offset (radar units) so teammates never render as one stacked
// dot (each sits at a fixed angle around its true position). Visual only — duels use true positions.

const SKILL_W = 0.28; // how much the raw OVR/role skill ratio sways one duel
const TEAM_W = 0.36; // how much team-strength bias sways one duel
const DUEL_CLAMP = 0.28; // per-duel win prob is clamped to [DUEL_CLAMP, 1 - DUEL_CLAMP]

type TeamKey = "you" | "opponent";

export interface MirageSimInput {
  you: Team;
  opponent: Team;
  side: "CT" | "T"; // your team's side
  plan: MiragePlan;
  skill: Map<string, number>; // `${team}:${playerId}` -> duel skill (from killWeight); higher wins more
  awp: Set<string>; // `${team}:${playerId}` entries holding an AWP
  weapons: Record<string, string>; // `${team}:${playerId}` -> weapon name (for the feed)
  teamBias: number; // -0.5..0.5: >0 favours "you" per duel (from team-strength probability)
  tactics: Record<TeamKey, MirageCallStyle>;
  utilityCounts: Record<TeamKey, number>;
  economies: Record<TeamKey, MirageEconomy>;
  preparation?: {
    plan: "anti-awp" | "punish-aggression" | "heavy-utility" | "targeted-site-stack";
    targetSite: "A" | "B";
  };
}
interface Team {
  players: Player[];
}

export interface SimEvent {
  t: number;
  type: "kill" | "plant" | "defuse" | "explode";
  side: TeamKey; // acting team (killer/planter/defuser); "explode" uses T team
  killerId?: string;
  victimId?: string;
  killerPos?: Vec;
  victimPos?: Vec;
  engage?: { from: string; to: string };
  headshot?: boolean;
  weapon?: string;
  site?: Site;
}
export interface TimelineFrame {
  t: number;
  players: { id: string; x: number; y: number; alive: boolean; yaw: number }[];
}
export interface MirageSimResult {
  events: SimEvent[];
  timeline: TimelineFrame[];
  planId: MiragePlan["id"];
  planLabel: string;
  youWin: boolean;
  tPlantedBomb: boolean;
  bombOutcome: "none" | "defused" | "exploded";
  roundReason: string;
}

interface SimP {
  ref: Player;
  key: string;
  team: TeamKey;
  side: "CT" | "T";
  idx: number;
  job: MirageJob;
  pts: Vec[];
  cum: number[];
  len: number;
  dist: number; // distance travelled along current route
  pos: Vec;
  nodeId: string;
  objective: string;
  alive: boolean;
  awp: boolean;
  skill: number;
  yaw: number;
  fightTimer: number;
  fightTarget: string | null;
  hasBomb: boolean;
  home: string; // the callout this player is anchored to (repositions around it)
  repoTimer: number; // seconds until the next reposition while holding
}

function playerKey(team: TeamKey, id: string) {
  return `${team}:${id}`;
}

// Route through a sequence of callouts (each leg via findRoute), corridor-snapped to the floor.
function buildPlanRoute(startId: string, plan: string[], sit: Situation): { pts: Vec[]; cum: number[]; len: number; lastNode: string } {
  const nodeSeq: string[] = [startId];
  let from = startId;
  for (const to of plan) {
    const r = findRoute(from, to, roundStateFor(sit));
    const legNodes = r ? r.nodes.map((n) => n.id) : [to];
    for (let i = 1; i < legNodes.length; i += 1) nodeSeq.push(legNodes[i]); // skip the shared join node
    from = to;
  }
  const raw = nodeSeq.map((id) => getNode(id)).filter(Boolean).map((n) => ({ x: n!.x, y: n!.y }));
  const pts = (corridorPath("mirage", raw) || raw).map((p) => (GRID ? snapToWalkable(GRID, p) : p));
  const cum = [0];
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    cum.push(len);
  }
  return { pts: pts.length ? pts : [{ x: 50, y: 50 }], cum, len, lastNode: plan[plan.length - 1] ?? startId };
}

function buildRoute(fromId: string, toId: string, sit: Situation): { pts: Vec[]; cum: number[]; len: number } {
  const r = findRoute(fromId, toId, roundStateFor(sit));
  const nodes = r ? r.nodes : [getNode(fromId)!].filter(Boolean);
  const raw = nodes.map((n) => ({ x: n.x, y: n.y }));
  const pts = (corridorPath("mirage", raw) || raw).map((p) => (GRID ? snapToWalkable(GRID, p) : p));
  const cum = [0];
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    cum.push(len);
  }
  return { pts: pts.length ? pts : [{ x: 50, y: 50 }], cum, len };
}
// Prepend a starting position (e.g. a spawn pad, or current pos when repositioning) to a route.
// `replaceFirst` drops the route's first node (the spawn node) so players head from their pad
// straight toward the objective instead of funnelling back to the single spawn node and stacking.
function withStart(route: { pts: Vec[]; cum: number[]; len: number }, start: Vec, replaceFirst = false): { pts: Vec[]; cum: number[]; len: number } {
  const base = replaceFirst && route.pts.length > 1 ? route.pts.slice(1) : route.pts;
  const pts = Math.hypot(base[0].x - start.x, base[0].y - start.y) < 0.5 ? base.slice() : [start, ...base];
  const cum = [0];
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) { len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); cum.push(len); }
  return { pts, cum, len };
}
function posAtDist(p: SimP): Vec {
  if (p.pts.length <= 1) return p.pts[0] ?? { x: 50, y: 50 };
  const d = Math.max(0, Math.min(p.len, p.dist));
  if (d >= p.len) return p.pts[p.pts.length - 1];
  let i = 1;
  while (i < p.cum.length && p.cum[i] < d) i += 1;
  const segLen = p.cum[i] - p.cum[i - 1];
  const f = segLen > 0 ? (d - p.cum[i - 1]) / segLen : 0;
  const a = p.pts[i - 1];
  const b = p.pts[i];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

function siteNode(site: Site): Vec {
  const n = getNode(site)!;
  return { x: n.x, y: n.y };
}

export function simulateMirageRound(input: MirageSimInput): MirageSimResult {
  const { side, plan, skill, awp, teamBias } = input;
  const tKey: TeamKey = side === "T" ? "you" : "opponent";
  const ctKey: TeamKey = side === "CT" ? "you" : "opponent";
  const sideOf = (team: TeamKey): "CT" | "T" => (team === tKey ? "T" : "CT");

  const bombSite = plan.site;

  // Build the 10 players with role-based objectives (spread across approaches).
  const situationFor = (team: TeamKey): Situation => {
    const enemy = team === "you" ? "opponent" : "you";
    const utilityCount = input.utilityCounts[team] ?? 0;
    const enemyHasAwp = [...awp].some((key) => key.startsWith(`${enemy}:`));
    return {
      bombPlanted: false,
      enemyAwperPressure: enemyHasAwp ? 0.75 : 0.18,
      hasUtility: utilityCount > 0,
      availableUtility: Math.min(1, utilityCount / 10),
      saving: input.economies[team] === "ECO" && input.tactics[team] === "cautious",
    };
  };
  const make = (team: TeamKey, players: Player[]): SimP[] => {
    const pside = sideOf(team);
    const jobs = assignMirageJobs(players, (player) => awp.has(playerKey(team, player.id)) || awp.has(player.id));
    const pushers = pside === "CT"
      ? selectMirageCtPushers(players, jobs, input.tactics[team])
      : new Set<string>();
    const situation = situationFor(team);
    return players.map((ref, idx) => {
      let route: { pts: Vec[]; cum: number[]; len: number };
      let objective: string;
      const job = jobs.get(ref.id) ?? "trader";
      if (pside === "T") {
        const routePlan = routeForMirageJob(plan, job);
        const r = buildPlanRoute("tspawn", routePlan, situation);
        route = { pts: r.pts, cum: r.cum, len: r.len };
        objective = r.lastNode;
      } else {
        if (team === "you" && input.preparation?.plan === "targeted-site-stack") {
          const stackObjectives = input.preparation.targetSite === "A"
            ? ["asite", "jungle", "connector", "asite", "jungle"]
            : ["bsite", "market", "catwalk", "bsite", "market"];
          objective = stackObjectives[idx % stackObjectives.length];
        } else {
          objective = ctObjectiveForMirageJob(job, pushers.has(ref.id));
        }
        route = buildRoute("ctspawn", objective, situation);
      }
      // start spread in a pentagon around the spawn centre so the 5 dots don't stack. Not snapped to
      // the mesh (the strict spawn floor is tiny and would collapse them) — it's just the visual start
      // inside the spawn box; the route corridor-snaps from the first node onward.
      const c = SPAWN_CENTER[pside];
      const ang = ((idx % 5) * 72 + 18) * (Math.PI / 180);
      const pad: Vec = { x: c.x + Math.cos(ang) * SPAWN_R[pside], y: c.y + Math.sin(ang) * SPAWN_R[pside] };
      route = withStart(route, pad, true); // straight from pad toward objective (no spawn-node funnel)
      const key = playerKey(team, ref.id);
      return {
        ref,
        key,
        team,
        side: pside,
        idx,
        job,
        ...route,
        dist: 0,
        pos: pad,
        nodeId: pside === "CT" ? "ctspawn" : "tspawn",
        objective,
        alive: true,
        awp: awp.has(key) || awp.has(ref.id),
        skill: Math.max(0.1, skill.get(key) ?? skill.get(ref.id) ?? 1),
        yaw: 0,
        fightTimer: 0,
        fightTarget: null,
        hasBomb: false,
        home: objective,
        repoTimer: REPO_MIN + Math.random() * REPO_VAR,
      };
    });
  };
  const ps: SimP[] = [...make("you", input.you.players), ...make("opponent", input.opponent.players)];
  const byId = new Map(ps.map((p) => [p.key, p]));
  // bomb carrier: the lowest-idx T whose objective is the bomb site
  const carrier = ps.filter((p) => p.side === "T" && p.objective === bombSite).sort((a, b) => a.idx - b.idx)[0]
    ?? ps.find((p) => p.side === "T");
  if (carrier) carrier.hasBomb = true;

  const aliveOf = (s: "CT" | "T") => ps.filter((p) => p.alive && p.side === s);
  const enemiesOf = (p: SimP) => ps.filter((q) => q.alive && q.side !== p.side);

  // Timeline players with a fixed per-player radial offset (a tiny pentagon) so teammates never
  // render as one stacked dot — even bunched on a corridor they read as 5 distinct markers. Sim/duel
  // positions (p.pos) are untouched, so this is purely visual.
  const framePlayers = () =>
    ps.map((p) => {
      const a = p.idx * ((2 * Math.PI) / 5);
      return { id: p.key, x: p.pos.x + Math.cos(a) * LANE_W, y: p.pos.y + Math.sin(a) * LANE_W, alive: p.alive, yaw: p.yaw };
    });

  const events: SimEvent[] = [];
  const timeline: TimelineFrame[] = [];

  let t = 0;
  let planted = false;
  let bombTimer = BOMB_TIME;
  let plantProgress = 0;
  let defuseProgress = 0;
  let defusingId: string | null = null; // a CT mid-defuse (exposed); cleared after a short grace
  let defuseGrace = 0;
  let bombOutcome: "none" | "defused" | "exploded" = "none";
  let winner: TeamKey | null = null;
  let reason = "";
  let lastFrameT = -1;

  let plantedSite: Site | null = null;
  const replan = (plantSite: Site) => {
    plantedSite = plantSite;
    for (const p of ps) {
      if (!p.alive) continue;
      const sit: Situation = { ...situationFor(p.team), bombPlanted: true, plantSite };
      const obj = postPlantObjectiveForMirageJob(p.side, p.job, plantSite);
      const route = withStart(buildRoute(p.nodeId, obj, sit), p.pos);
      p.pts = route.pts;
      p.cum = route.cum;
      p.len = route.len;
      p.dist = 0;
      p.objective = obj;
      p.home = obj;
      p.fightTarget = null;
      p.fightTimer = 0;
      p.repoTimer = REPO_MIN + Math.random() * REPO_VAR;
    }
  };

  // Reposition a player from where they are to a new callout (peek/re-angle/rotate) — keeps play dynamic.
  const sitNow = (team: TeamKey): Situation => {
    const situation = situationFor(team);
    return plantedSite ? { ...situation, bombPlanted: true, plantSite: plantedSite } : situation;
  };
  const repositionTo = (p: SimP, toNodeId: string) => {
    const fromNode = nearestNode(p.pos.x, p.pos.y).id;
    const route = withStart(buildRoute(fromNode, toNodeId, sitNow(p.team)), p.pos);
    p.pts = route.pts;
    p.cum = route.cum;
    p.len = route.len;
    p.dist = 0;
    p.objective = toNodeId;
  };
  // Pick where to reposition: the player's home callout or an adjacent angle — never retreat to a
  // spawn or wander to the far site, so they hold/peek their assigned area dynamically.
  const repositionTarget = (p: SimP): string => {
    const banned = new Set([spawnNodeId("CT"), spawnNodeId("T")]);
    const opts = [p.home, p.home, ...neighbors(p.home).map((e) => e.to)].filter((id) => !banned.has(id));
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : p.home;
  };

  const hasLos = (a: SimP, b: SimP): boolean => {
    const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
    if (d > SIGHT_RANGE) return false;
    if (!GRID) return true;
    return hasLineOfSight(GRID, a.pos, b.pos);
  };

  // win probability for A in a duel vs B. Built so aggregate round/match win% tracks TEAM strength
  // (the bounded [0.16,0.84]-style probability) while individual skill adds a compressed edge (so a
  // star carries but small OVR gaps don't snowball to ~100% over a match) plus situational factors.
  const winProbA = (a: SimP, b: SimP): number => {
    // CORE = individual skill (compressed) + team-strength bias. This is the balanced driver and is
    // clamped so a 1v1 / team duel is never a sure thing.
    const rawSkill = a.skill / (a.skill + b.skill);
    let core = 0.5 + (rawSkill - 0.5) * SKILL_W + (a.team === "you" ? teamBias : -teamBias) * TEAM_W;
    core = Math.max(DUEL_CLAMP, Math.min(1 - DUEL_CLAMP, core));
    // SITUATIONAL = holder / AWP / crossfire, applied AFTER the clamp so being outnumbered CAN make a
    // duel a near-loss — a lone player peeking into several enemies should rarely win (no 0.28 floor).
    const holdA = a.dist >= a.len ? HOLDER_EDGE : 1;
    const holdB = b.dist >= b.len ? HOLDER_EDGE : 1;
    const awpA = a.awp ? AWP_EDGE : 1;
    const awpB = b.awp ? AWP_EDGE : 1;
    const xfA = 1 + CROSSFIRE * (enemiesOf(a).filter((e) => hasLos(a, e)).length - 1);
    const xfB = 1 + CROSSFIRE * (enemiesOf(b).filter((e) => hasLos(b, e)).length - 1);
    // a CT caught mid-defuse can't fight back — whoever peeks them is hugely favoured
    const defA = a.key === defusingId ? 1 / DEFUSE_EXPOSE : 1;
    const defB = b.key === defusingId ? 1 / DEFUSE_EXPOSE : 1;
    const mult = (holdA * awpA * defA) / Math.max(1, xfA) / ((holdB * awpB * defB) / Math.max(1, xfB));
    const odds = (core / (1 - core)) * mult;
    return Math.max(0.03, Math.min(0.97, odds / (1 + odds)));
  };

  const kill = (killer: SimP, victim: SimP) => {
    victim.alive = false;
    victim.fightTarget = null;
    killer.fightTarget = null;
    killer.fightTimer = 0;
    killer.repoTimer = Math.min(killer.repoTimer, REPO_AGGRO); // re-aggress / relocate soon after a kill
    const kn = getNode(killer.nodeId);
    const vn = getNode(victim.nodeId);
    events.push({
      t,
      type: "kill",
      side: killer.team,
      killerId: killer.ref.id,
      victimId: victim.ref.id,
      killerPos: { ...killer.pos },
      victimPos: { ...victim.pos },
      engage: kn && vn ? { from: kn.id, to: vn.id } : undefined,
      headshot: Math.random() < 0.4,
      weapon: input.weapons[killer.key] ?? input.weapons[killer.ref.id] ?? "Rifle",
    });
    // Reactive rotation / trade: a free teammate of the player who just died swings toward the
    // fight to trade the killer or retake the area — so kills pull players in, like real CS.
    const mates = aliveOf(victim.side).filter((q) => q !== victim && q !== killer && !q.fightTarget);
    if (mates.length && Math.random() < ROTATE_CHANCE) {
      let best: SimP | null = null;
      let bd = Infinity;
      for (const m of mates) {
        const d = Math.hypot(m.pos.x - victim.pos.x, m.pos.y - victim.pos.y);
        if (d > 10 && d < bd) { bd = d; best = m; } // must actually travel (not already there)
      }
      if (best) { repositionTo(best, victim.nodeId); best.repoTimer = REPO_MIN + Math.random() * REPO_VAR; }
    }
    if (victim.hasBomb && victim.side === "T") {
      // drop the bomb to a nearby living T (simplified pickup)
      victim.hasBomb = false;
      const heir = aliveOf("T").sort((a, b) => a.idx - b.idx)[0];
      if (heir) heir.hasBomb = true;
    }
  };

  // initial frame at t=0 so the radar shows players spread on their spawn pads before they move
  timeline.push({ t: 0, players: framePlayers() });

  while (t < ROUND_TIME && !winner) {
    t = Math.round((t + DT) * 100) / 100;

    // 1. Movement — advance toward objective; once arrived, periodically reposition (don't freeze).
    for (const p of ps) {
      if (!p.alive) continue;
      if (p.dist < p.len) {
        const prev = p.pos;
        p.dist = Math.min(p.len, p.dist + WALK_SPEED * DT);
        p.pos = posAtDist(p);
        const dx = p.pos.x - prev.x;
        const dy = p.pos.y - prev.y;
        if (dx * dx + dy * dy > 0.02) p.yaw = (Math.atan2(dy, dx) * 180) / Math.PI;
        p.nodeId = nearestNode(p.pos.x, p.pos.y).id; // current callout for engage/LOS gating
      } else if (!p.fightTarget) {
        // holding: shuffle to a nearby angle every few seconds so play stays dynamic
        p.repoTimer -= DT;
        if (p.repoTimer <= 0) {
          repositionTo(p, repositionTarget(p));
          p.repoTimer = REPO_MIN + Math.random() * REPO_VAR;
        }
      }
    }

    // 2. Fights — resolve ongoing, then form new ones from real LOS contact.
    for (const p of ps) {
      if (!p.alive || !p.fightTarget) continue;
      const foe = byId.get(p.fightTarget);
      if (!foe || !foe.alive || !hasLos(p, foe)) {
        p.fightTarget = null;
        continue;
      }
      p.fightTimer -= DT;
      if (p.fightTimer <= 0 && foe.fightTarget === p.key) {
        // resolve once (guard so the pair resolves a single death)
        if (foe.alive && p.alive) {
          const pWins = Math.random() < winProbA(p, foe);
          if (pWins) kill(p, foe);
          else kill(foe, p);
        }
      }
    }
    // form new fights: each free, alive player engages the nearest enemy in LOS
    for (const p of ps) {
      if (!p.alive || p.fightTarget) continue;
      let nearest: SimP | null = null;
      let nd = Infinity;
      for (const foe of enemiesOf(p)) {
        if (foe.fightTarget && foe.fightTarget !== p.key) continue; // already dueling someone else
        if (!hasLos(p, foe)) continue;
        const d = Math.hypot(p.pos.x - foe.pos.x, p.pos.y - foe.pos.y);
        if (d < nd) {
          nd = d;
          nearest = foe;
        }
      }
      if (nearest) {
        // Outnumbered contact resolves faster (several guns on one player = quick death, not a clean
        // walk-in): scale the reaction time down by how lopsided the LOS count is here.
        const losMax = Math.max(
          enemiesOf(p).filter((e) => hasLos(p, e)).length,
          enemiesOf(nearest).filter((e) => hasLos(nearest, e)).length,
        );
        const timer = (TTK_BASE * (0.5 + Math.random()) * (p.awp || nearest.awp ? 0.7 : 1)) / (1 + 0.5 * (losMax - 1));
        p.fightTarget = nearest.key;
        p.fightTimer = timer;
        nearest.fightTarget = p.key;
        nearest.fightTimer = timer;
      }
    }

    // 3. Bomb logic
    const tAlive = aliveOf("T");
    const ctAlive = aliveOf("CT");
    if (!planted) {
      const c = carrier && carrier.alive ? carrier : tAlive.find((p) => p.hasBomb);
      const onSite = c && Math.hypot(c.pos.x - siteNode(bombSite).x, c.pos.y - siteNode(bombSite).y) < 9;
      const contested = c ? ctAlive.some((ct) => hasLos(ct, c)) : true;
      if (c && onSite && !contested) {
        plantProgress += DT;
        if (plantProgress >= PLANT_TIME) {
          planted = true;
          events.push({ t, type: "plant", side: tKey, killerId: c.ref.id, site: bombSite, killerPos: siteNode(bombSite) });
          replan(bombSite);
        }
      } else {
        plantProgress = Math.max(0, plantProgress - DT * 0.5);
      }
    } else {
      bombTimer -= DT;
      if (bombTimer <= 0) {
        bombOutcome = "exploded";
        winner = tKey;
        reason = "Target bombed";
        events.push({ t, type: "explode", side: tKey, killerPos: siteNode(bombSite) });
        break;
      }
      // defuse: a CT at the site with no T holding LOS on the site
      const site = siteNode(bombSite);
      defuseGrace = Math.max(0, defuseGrace - DT);
      if (defuseGrace === 0) defusingId = null;
      const ctAtSite = ctAlive.find((ct) => Math.hypot(ct.pos.x - site.x, ct.pos.y - site.y) < 8);
      const tWatching = tAlive.some((tp) => Math.hypot(tp.pos.x - site.x, tp.pos.y - site.y) < SIGHT_RANGE && GRID && hasLineOfSight(GRID, tp.pos, site));
      if (ctAtSite && !tWatching) {
        defuseProgress += DT;
        defusingId = ctAtSite.key; // flag the defuser as exposed (stays briefly via the grace)
        defuseGrace = 1.2;
        // Ts never give up the bomb: pull the nearest free T back to contest the defuse (re-peek).
        const helpers = tAlive.filter((tp) => !tp.fightTarget);
        helpers.sort((a, b2) => Math.hypot(a.pos.x - site.x, a.pos.y - site.y) - Math.hypot(b2.pos.x - site.x, b2.pos.y - site.y));
        const help = helpers[0];
        if (help && Math.hypot(help.pos.x - site.x, help.pos.y - site.y) > 6 && help.objective !== bombSite) repositionTo(help, bombSite);
        if (defuseProgress >= DEFUSE_TIME) {
          bombOutcome = "defused";
          winner = ctKey;
          reason = "Bomb defused";
          events.push({ t, type: "defuse", side: ctKey, killerId: ctAtSite.ref.id });
          break;
        }
      } else {
        defuseProgress = Math.max(0, defuseProgress - DT);
      }
    }

    // 4. Round-end by elimination
    if (!winner) {
      const tA = aliveOf("T").length;
      const ctA = aliveOf("CT").length;
      if (tA === 0) {
        if (planted) {
          // no Ts left to contest — CTs defuse
          bombOutcome = "defused";
          winner = ctKey;
          reason = "Bomb defused";
          const ct = aliveOf("CT")[0];
          events.push({ t, type: "defuse", side: ctKey, killerId: ct?.ref.id });
        } else {
          winner = ctKey;
          reason = "Squad eliminated";
        }
      } else if (ctA === 0) {
        winner = tKey;
        reason = planted ? "Target bombed" : "Squad eliminated";
      }
    }

    // 5. Timeline frame (~1s cadence keeps it small)
    if (t - lastFrameT >= 1 - 1e-6) {
      lastFrameT = t;
      timeline.push({ t, players: framePlayers() });
    }
  }

  if (!winner) {
    // time expired
    if (planted) {
      bombOutcome = "exploded";
      winner = tKey;
      reason = "Target bombed";
      events.push({ t: ROUND_TIME, type: "explode", side: tKey, killerPos: siteNode(bombSite) });
    } else {
      winner = ctKey;
      reason = "Time ran out";
    }
  }
  // final frame
  timeline.push({ t, players: framePlayers() });

  return {
    events,
    timeline,
    planId: plan.id,
    planLabel: plan.label,
    youWin: winner === "you",
    tPlantedBomb: planted,
    bombOutcome,
    roundReason: reason,
  };
}
